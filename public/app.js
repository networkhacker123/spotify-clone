const $ = selector => document.querySelector(selector)
const state = { tracks: [], saved: new Set(), user: null, currentId: null, queue: [], authMode: 'login', genre: 'All', view: 'home' }
const audio = $('#audio')
const icons = { play: '<svg><use href="#i-play"/></svg>', pause: '<svg><use href="#i-pause"/></svg>' }
audio.volume = .75

function toast(message) {
  const element = $('#toast')
  element.textContent = message
  element.classList.remove('hidden')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => element.classList.add('hidden'), 3500)
}
async function request(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options })
  let result = {}
  try { result = await response.json() } catch (_) {}
  if (!response.ok) throw new Error(result.message || 'Something went wrong')
  return result
}
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0')
}
function gradient(track) {
  const colors = track.colors?.length ? track.colors : ['#28634f', '#81b858']
  return 'linear-gradient(135deg, ' + colors[0] + ', ' + colors[1] + ')'
}
function makeCover(track, className) {
  const cover = document.createElement('div')
  cover.className = className
  cover.style.background = gradient(track)
  cover.innerHTML = '<svg><use href="#i-music"/></svg>'
  return cover
}
function setUser(user) {
  state.user = user
  $('#register-button').classList.toggle('hidden', !!user)
  $('#login-button').classList.toggle('hidden', !!user)
  $('#account-wrap').classList.toggle('hidden', !user)
  if (user) {
    $('#account-name').textContent = user.username
    $('#account-avatar').textContent = user.username[0].toUpperCase()
    $('#account-role').textContent = user.role === 'artist' ? 'Artist account' : 'Listener account'
  } else {
    state.saved.clear()
    renderLibrary()
    renderCatalog()
  }
}
function setView(view) {
  state.view = view
  const actual = view === 'search' ? 'home' : view
  for (const name of ['home', 'library', 'database']) $('#' + name + '-view').classList.toggle('hidden', actual !== name)
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view))
  $('#page-kicker').textContent = { home: 'LISTEN YOUR WAY', search: 'FIND YOUR SOUND', library: 'YOUR COLLECTION', database: 'UNDER THE HOOD' }[view]
  $('#main-panel').scrollTop = 0
  window.scrollTo({ top: 0, behavior: 'smooth' })
  if (view === 'search') {
    $('#catalog-section').scrollIntoView({ behavior: 'smooth' })
    setTimeout(() => $('#search-input').focus(), 250)
  }
  if (view === 'database') loadDatabase()
  if (view === 'library') renderLibrary()
}
function currentTrack() { return state.tracks.find(track => track.id === state.currentId) }
function updatePlayer() {
  const track = currentTrack()
  const playing = track && !audio.paused
  $('#play-button').innerHTML = playing ? icons.pause : icons.play
  $('#play-button').setAttribute('aria-label', playing ? 'Pause' : 'Play')
  $('#play-button').disabled = !track
  $('#player-save').disabled = !track
  $('#player-save').classList.toggle('saved', !!track && state.saved.has(track.id))
  $('#player-save').setAttribute('aria-label', track && state.saved.has(track.id) ? 'Remove from library' : 'Save current song')
  document.querySelectorAll('.track-row').forEach(row => {
    const active = row.dataset.id === state.currentId
    row.classList.toggle('playing', active)
    const button = row.querySelector('.track-index')
    button.innerHTML = active ? (playing ? icons.pause : icons.play) : button.dataset.number
  })
}
function playTrack(track, queue = state.tracks) {
  if (!track) return
  if (state.currentId === track.id) {
    if (audio.paused) audio.play().catch(() => toast('Could not play this song'))
    else audio.pause()
    return
  }
  state.currentId = track.id
  state.queue = queue.map(item => item.id)
  audio.src = track.uri
  $('#player-title').textContent = track.title
  $('#player-artist').textContent = track.artist
  $('#player-art').style.background = gradient(track)
  $('#duration').textContent = formatTime(track.duration)
  $('#current-time').textContent = '0:00'
  $('#seek').disabled = false
  audio.play().catch(() => toast('Could not play this song'))
  updatePlayer()
}
function stepTrack(delta) {
  if (!state.queue.length) return
  const index = state.queue.indexOf(state.currentId)
  const next = state.queue[(index + delta + state.queue.length) % state.queue.length]
  playTrack(state.tracks.find(track => track.id === next), state.queue.map(id => state.tracks.find(track => track.id === id)).filter(Boolean))
}
function renderRows(container, tracks) {
  container.replaceChildren()
  tracks.forEach((track, index) => {
    const row = document.createElement('div')
    row.className = 'track-row'
    row.dataset.id = track.id
    const number = document.createElement('button')
    number.className = 'track-index'
    number.dataset.number = String(index + 1).padStart(2, '0')
    number.textContent = number.dataset.number
    number.setAttribute('aria-label', 'Play ' + track.title)
    number.addEventListener('click', () => playTrack(track, tracks))
    const main = document.createElement('div')
    main.className = 'track-main'
    const text = document.createElement('div')
    text.className = 'track-text'
    const title = document.createElement('strong')
    title.textContent = track.title
    const artist = document.createElement('span')
    artist.textContent = track.artist
    text.append(title, artist)
    main.append(makeCover(track, 'track-art'), text)
    const genre = document.createElement('span')
    genre.className = 'track-genre'
    genre.textContent = track.genre || 'Community'
    const duration = document.createElement('span')
    duration.className = 'track-length'
    duration.textContent = formatTime(track.duration)
    const save = document.createElement('button')
    save.className = 'save-button' + (state.saved.has(track.id) ? ' saved' : '')
    save.innerHTML = '<svg><use href="#i-heart"/></svg>'
    save.setAttribute('aria-label', state.saved.has(track.id) ? 'Remove ' + track.title + ' from library' : 'Save ' + track.title + ' to library')
    save.addEventListener('click', () => toggleSave(track.id))
    row.append(number, main, genre, duration, save)
    row.addEventListener('dblclick', event => { if (!event.target.closest('.save-button')) playTrack(track, tracks) })
    container.append(row)
  })
  updatePlayer()
}
function renderQuick() {
  const grid = $('#quick-grid')
  grid.replaceChildren()
  const liked = document.createElement('button')
  liked.className = 'quick-card'
  liked.innerHTML = '<div class="quick-cover liked-icon"><svg><use href="#i-heart"/></svg></div><span>Liked Songs</span><div class="quick-play">' + icons.play + '</div>'
  liked.addEventListener('click', () => setView('library'))
  grid.append(liked)
  state.tracks.slice(0, 5).forEach(track => {
    const card = document.createElement('button')
    card.className = 'quick-card'
    const label = document.createElement('span')
    label.textContent = track.title
    const play = document.createElement('div')
    play.className = 'quick-play'
    play.innerHTML = icons.play
    card.append(makeCover(track, 'quick-cover'), label, play)
    card.addEventListener('click', () => playTrack(track))
    grid.append(card)
  })
}
function renderFeatured() {
  const grid = $('#featured-grid')
  grid.replaceChildren()
  const featured = [state.tracks[5], state.tracks[6], state.tracks[7], state.tracks[8], state.tracks[9]].filter(Boolean)
  featured.forEach(track => {
    const card = document.createElement('button')
    card.className = 'feature-card'
    const title = document.createElement('strong')
    title.textContent = track.title
    const detail = document.createElement('small')
    detail.textContent = track.genre + ' · ' + track.artist
    card.append(makeCover(track, 'feature-cover'), title, detail)
    card.addEventListener('click', () => playTrack(track))
    grid.append(card)
  })
}
function renderFilters() {
  const holder = $('#filter-pills')
  holder.replaceChildren()
  const genres = ['All', ...new Set(state.tracks.map(track => track.genre || 'Community'))]
  genres.forEach(genre => {
    const button = document.createElement('button')
    button.textContent = genre
    button.classList.toggle('active', genre === state.genre)
    button.addEventListener('click', () => { state.genre = genre; renderFilters(); renderCatalog() })
    holder.append(button)
  })
}
function renderCatalog() {
  const query = $('#search-input').value.trim().toLowerCase()
  const filtered = state.tracks.filter(track =>
    (state.genre === 'All' || (track.genre || 'Community') === state.genre) &&
    (track.title + ' ' + track.artist + ' ' + (track.genre || '')).toLowerCase().includes(query)
  )
  $('#track-count').textContent = state.tracks.length + (state.tracks.length === 1 ? ' song' : ' songs')
  renderRows($('#track-list'), filtered)
  $('#empty-search').classList.toggle('hidden', !!filtered.length)
}
function renderLibrary() {
  const tracks = state.tracks.filter(track => state.saved.has(track.id))
  $('#library-count').textContent = tracks.length + (tracks.length === 1 ? ' song' : ' songs')
  $('#sidebar-liked-count').textContent = tracks.length + (tracks.length === 1 ? ' saved track' : ' saved tracks')
  $('#library-empty').classList.toggle('hidden', tracks.length > 0)
  $('#play-library').disabled = !tracks.length
  renderRows($('#library-list'), tracks)
  const sidebar = $('#sidebar-saved')
  sidebar.replaceChildren()
  tracks.slice(0, 6).forEach(track => {
    const button = document.createElement('button')
    button.textContent = '♪  ' + track.title
    button.addEventListener('click', () => playTrack(track, tracks))
    sidebar.append(button)
  })
}
async function loadTracks() {
  try {
    const result = await request('/api/music')
    state.tracks = result.tracks || []
    renderQuick()
    renderFeatured()
    renderFilters()
    renderCatalog()
    renderLibrary()
  } catch (error) {
    $('#empty-search').textContent = error.message
    $('#empty-search').classList.remove('hidden')
  }
}
async function loadSaved() {
  if (!state.user) { state.saved.clear(); renderLibrary(); renderCatalog(); return }
  try {
    const result = await request('/api/library')
    state.saved = new Set(result.savedTracks || [])
    renderLibrary()
    renderCatalog()
  } catch (error) { toast(error.message) }
}
async function toggleSave(id) {
  if (!state.user) return showAuth('login')
  try {
    const result = await request('/api/library/' + encodeURIComponent(id), { method: 'PUT' })
    state.saved = new Set(result.savedTracks || [])
    renderLibrary()
    renderCatalog()
    updatePlayer()
    toast(state.saved.has(id) ? 'Added to Liked Songs' : 'Removed from Liked Songs')
    if (state.view === 'database') loadDatabase()
  } catch (error) { toast(error.message) }
}
async function loadDatabase() {
  $('#db-name').textContent = 'Checking database…'
  try {
    const result = await request('/api/database')
    $('#db-name').textContent = result.mode === 'mongodb' ? 'MongoDB · ' + result.database : 'Local JSON · ' + result.database
    $('#db-note').textContent = result.note
    $('#db-badge').textContent = result.connection === 'connected' || result.connection === 'active' ? '● Connected' : '● Disconnected'
    $('#db-badge').classList.toggle('disconnected', result.connection === 'disconnected')
    $('#flow-storage').textContent = result.mode === 'mongodb' ? 'MongoDB' : 'Local JSON'
    $('#flow-detail').textContent = result.mode === 'mongodb' ? 'Collections & documents' : 'JSON records & audio files'
    const grid = $('#collections-grid')
    grid.replaceChildren()
    result.collections.forEach(collection => {
      const card = document.createElement('div')
      card.className = 'collection-card'
      const head = document.createElement('div')
      head.className = 'collection-head'
      const name = document.createElement('strong')
      name.textContent = collection.name
      const count = document.createElement('span')
      count.textContent = collection.count + ' records'
      head.append(name, count)
      const body = document.createElement('pre')
      body.textContent = collection.documents.length ? JSON.stringify(collection.documents.slice(0, 15), null, 2) : 'Sign in to see your account document, or add records to this collection.'
      card.append(head, body)
      grid.append(card)
    })
  } catch (error) {
    $('#db-name').textContent = 'Database unavailable'
    $('#db-note').textContent = error.message
  }
}
function showAuth(mode = 'login') {
  setAuthMode(mode)
  $('#auth-error').classList.add('hidden')
  $('#auth-dialog').showModal()
}
function setAuthMode(mode) {
  state.authMode = mode
  const register = mode === 'register'
  $('#auth-title').textContent = register ? 'Join Pulse' : 'Log in to Pulse'
  $('#auth-subtitle').textContent = register ? 'Create an account and find your sound.' : 'Pick up right where the music left off.'
  $('#register-fields').classList.toggle('hidden', !register)
  $('#login-fields').classList.toggle('hidden', register)
  $('#artist-check').classList.toggle('hidden', !register)
  $('#auth-submit').textContent = register ? 'Create account' : 'Log in'
  $('#password').autocomplete = register ? 'new-password' : 'current-password'
  $('#username').required = register
  $('#email').required = register
  $('#identity').required = !register
  document.querySelectorAll('[data-auth-mode]').forEach(button => button.classList.toggle('selected', button.dataset.authMode === mode))
}
function showUpload() {
  if (!state.user) return showAuth('register')
  if (state.user.role !== 'artist') return toast('Upload is available for artist accounts')
  $('#upload-error').classList.add('hidden')
  $('#upload-dialog').showModal()
}

$('#register-button').addEventListener('click', () => showAuth('register'))
$('#login-button').addEventListener('click', () => showAuth('login'))
$('#upload-button').addEventListener('click', showUpload)
$('#library-upload').addEventListener('click', showUpload)
$('#sidebar-liked').addEventListener('click', () => setView('library'))
$('#refresh-db').addEventListener('click', loadDatabase)
$('#play-library').addEventListener('click', () => {
  const tracks = state.tracks.filter(track => state.saved.has(track.id))
  if (tracks.length) playTrack(tracks[0], tracks)
})
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)))
document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)))
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $('#' + button.dataset.close).close()))
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() }))
$('#search-input').addEventListener('input', renderCatalog)
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setView('search') } })
$('#account-button').addEventListener('click', () => { $('#account-menu').classList.toggle('hidden'); $('#account-button').setAttribute('aria-expanded', String(!$('#account-menu').classList.contains('hidden'))) })
document.addEventListener('click', event => { if (!$('#account-wrap').contains(event.target)) $('#account-menu').classList.add('hidden') })
$('#logout-button').addEventListener('click', async () => {
  try { await request('/api/auth/logout', { method: 'POST' }); setUser(null); $('#account-menu').classList.add('hidden'); toast('You are logged out') }
  catch (error) { toast(error.message) }
})
$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault()
  const register = state.authMode === 'register'
  const endpoint = register ? '/api/auth/register' : '/api/auth/login'
  const body = register
    ? { username: $('#username').value.trim(), email: $('#email').value.trim(), password: $('#password').value, role: $('#artist-role').checked ? 'artist' : 'user' }
    : { identity: $('#identity').value.trim(), password: $('#password').value }
  const submit = $('#auth-submit')
  submit.disabled = true
  submit.textContent = register ? 'Creating account…' : 'Logging in…'
  try {
    const result = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setUser(result.user)
    await loadSaved()
    $('#auth-dialog').close()
    $('#auth-form').reset()
    toast('Welcome, ' + result.user.username)
    if (state.view === 'database') loadDatabase()
  } catch (error) {
    $('#auth-error').textContent = error.message
    $('#auth-error').classList.remove('hidden')
  } finally {
    submit.disabled = false
    submit.textContent = register ? 'Create account' : 'Log in'
  }
})
$('#audio-file').addEventListener('change', () => { $('#file-name').textContent = $('#audio-file').files[0]?.name || 'Choose an audio file' })
$('#upload-form').addEventListener('submit', async event => {
  event.preventDefault()
  const file = $('#audio-file').files[0]
  if (!file) return
  if (file.size > 25 * 1024 * 1024) { $('#upload-error').textContent = 'Choose a file smaller than 25 MB'; $('#upload-error').classList.remove('hidden'); return }
  const submit = $('#upload-submit')
  submit.disabled = true
  submit.textContent = 'Uploading…'
  try {
    const form = new FormData()
    form.set('title', $('#track-title').value.trim())
    form.set('audio', file)
    await request('/api/music', { method: 'POST', body: form })
    $('#upload-dialog').close()
    $('#upload-form').reset()
    $('#file-name').textContent = 'Choose an audio file'
    toast('Your track is live')
    await loadTracks()
    if (state.view === 'database') loadDatabase()
  } catch (error) {
    $('#upload-error').textContent = error.message
    $('#upload-error').classList.remove('hidden')
  } finally { submit.disabled = false; submit.textContent = 'Upload track' }
})
$('#play-button').addEventListener('click', () => playTrack(currentTrack()))
$('#next-button').addEventListener('click', () => stepTrack(1))
$('#previous-button').addEventListener('click', () => stepTrack(-1))
$('#player-save').addEventListener('click', () => { if (state.currentId) toggleSave(state.currentId) })
audio.addEventListener('play', updatePlayer)
audio.addEventListener('pause', updatePlayer)
audio.addEventListener('ended', () => stepTrack(1))
audio.addEventListener('loadedmetadata', () => { $('#duration').textContent = formatTime(audio.duration) })
audio.addEventListener('timeupdate', () => { $('#current-time').textContent = formatTime(audio.currentTime) === '—' ? '0:00' : formatTime(audio.currentTime); $('#seek').value = audio.duration ? String(audio.currentTime / audio.duration * 100) : '0' })
$('#seek').addEventListener('input', event => { if (audio.duration) audio.currentTime = Number(event.target.value) / 100 * audio.duration })
$('#volume').addEventListener('input', event => { audio.volume = Number(event.target.value) / 100 })

const now = new Date()
$('#greeting').textContent = 'Good ' + (now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening')
$('#today-label').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
Promise.all([
  request('/api/auth/me').then(result => { setUser(result.user); return loadSaved() }).catch(() => {}),
  loadTracks(),
])

