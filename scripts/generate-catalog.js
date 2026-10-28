const fs = require('fs')
const path = require('path')

const rate = 16000
const bars = 32
const root = path.join(__dirname, '..')
const audioDir = path.join(root, 'public', 'audio')
const manifestPath = path.join(root, 'src', 'data', 'catalog.json')
fs.mkdirSync(audioDir, { recursive: true })

const songs = [
  { id: 'midnight-city-lights', title: 'Midnight City Lights', artist: 'Pulse Originals', genre: 'Electronic', bpm: 112, key: 45, colors: ['#672d9b', '#d45a9f'], seed: 11 },
  { id: 'greenroom-echo', title: 'Greenroom Echo', artist: 'Pulse Originals', genre: 'Chill', bpm: 96, key: 48, colors: ['#205b47', '#a3c653'], seed: 23 },
  { id: 'coastal-drive', title: 'Coastal Drive', artist: 'Pulse Originals', genre: 'Indie', bpm: 108, key: 50, colors: ['#195f88', '#e6a665'], seed: 35 },
  { id: 'neon-rain', title: 'Neon Rain', artist: 'Pulse Originals', genre: 'Electronic', bpm: 118, key: 43, colors: ['#194583', '#b549ce'], seed: 47 },
  { id: 'after-hours', title: 'After Hours', artist: 'Pulse Originals', genre: 'Lo-fi', bpm: 88, key: 41, colors: ['#5e3158', '#d08068'], seed: 59 },
  { id: 'daybreak-bloom', title: 'Daybreak Bloom', artist: 'Pulse Originals', genre: 'Chill', bpm: 104, key: 52, colors: ['#49733b', '#ecd16e'], seed: 71 },
  { id: 'low-tide', title: 'Low Tide', artist: 'Pulse Originals', genre: 'Ambient', bpm: 92, key: 46, colors: ['#1e5f69', '#7eb5ad'], seed: 83 },
  { id: 'static-dreams', title: 'Static Dreams', artist: 'Pulse Originals', genre: 'Lo-fi', bpm: 94, key: 44, colors: ['#493f79', '#ba8eaf'], seed: 97 },
  { id: 'velvet-steps', title: 'Velvet Steps', artist: 'Pulse Originals', genre: 'Groove', bpm: 110, key: 47, colors: ['#603e36', '#e3a660'], seed: 109 },
  { id: 'golden-hour', title: 'Golden Hour', artist: 'Pulse Originals', genre: 'Indie', bpm: 106, key: 49, colors: ['#985d28', '#e7c46e'], seed: 121 },
  { id: 'deep-current', title: 'Deep Current', artist: 'Pulse Originals', genre: 'Ambient', bpm: 90, key: 42, colors: ['#164953', '#4a8cb0'], seed: 133 },
  { id: 'night-market', title: 'Night Market', artist: 'Pulse Originals', genre: 'Groove', bpm: 116, key: 51, colors: ['#683549', '#e46e67'], seed: 145 },
]

function rng(seed) {
  let value = seed >>> 0
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296 }
}
function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12) }
function addTone(out, start, length, frequency, amplitude, shape) {
  const first = Math.floor(start * rate)
  const count = Math.min(Math.floor(length * rate), out.length - first)
  if (first < 0 || count <= 0) return
  const attack = shape === 'pad' ? 0.18 : 0.012
  const release = shape === 'pad' ? 0.35 : 0.12
  for (let i = 0; i < count; i++) {
    const t = i / rate
    const envelope = Math.min(1, t / attack) * Math.min(1, (length - t) / release)
    const phase = 2 * Math.PI * frequency * t
    let tone
    if (shape === 'bass') tone = Math.sin(phase) + 0.18 * Math.sin(phase * 2)
    else if (shape === 'pad') tone = Math.sin(phase) + 0.34 * Math.sin(phase * 2.005) + 0.14 * Math.sin(phase * 3)
    else tone = Math.sin(phase) + 0.22 * Math.sin(phase * 2) + 0.08 * Math.sin(phase * 4)
    out[first + i] += tone * amplitude * Math.max(0, envelope)
  }
}
function addKick(out, start, amplitude) {
  const first = Math.floor(start * rate)
  for (let i = 0; i < Math.min(rate * .25, out.length - first); i++) {
    const t = i / rate
    const phase = 2 * Math.PI * (53 * t + 68 * .028 * (1 - Math.exp(-t / .028)))
    out[first + i] += Math.sin(phase) * Math.exp(-t * 18) * amplitude
  }
}
function addNoise(out, start, length, amplitude, random, snare = false) {
  const first = Math.floor(start * rate)
  const count = Math.min(Math.floor(length * rate), out.length - first)
  let previous = 0
  for (let i = 0; i < count; i++) {
    const t = i / rate
    const noise = random() * 2 - 1
    const high = noise - previous
    previous = noise
    out[first + i] += high * Math.exp(-t * (snare ? 18 : 52)) * amplitude
  }
}
function writeWav(filename, samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24)
  buffer.writeUInt32LE(rate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples.length * 2, 40)
  let peak = .01
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
  const gain = Math.min(1.4, .84 / peak)
  for (let i = 0; i < samples.length; i++) {
    const fade = Math.min(1, i / (rate * .18), (samples.length - i) / (rate * .7))
    const value = Math.max(-1, Math.min(1, samples[i] * gain * fade))
    buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2)
  }
  fs.writeFileSync(filename, buffer)
}

const manifest = []
for (const song of songs) {
  const random = rng(song.seed)
  const beat = 60 / song.bpm
  const duration = bars * 4 * beat
  const out = new Float32Array(Math.floor(duration * rate))
  const progressions = [[0, 3, 7, 5], [0, 5, 3, 7], [0, 7, 5, 3], [0, 3, 5, 7]]
  const progression = progressions[song.seed % progressions.length]
  const melodySteps = [0, 2, 3, 5, 7, 10, 12, 14]
  for (let bar = 0; bar < bars; bar++) {
    const start = bar * 4 * beat
    const base = song.key + progression[bar % 4]
    const chord = [base, base + 3, base + 7]
    for (const note of chord) addTone(out, start, 4 * beat * .92, hz(note + 12), .075, 'pad')
    for (let b = 0; b < 4; b++) {
      const at = start + b * beat
      addTone(out, at, beat * .82, hz(base - 12 + (b === 3 ? 7 : 0)), .19, 'bass')
      if (song.genre !== 'Ambient') {
        if (b === 0 || b === 2) addKick(out, at, .4)
        if (b === 1 || b === 3) addNoise(out, at, .15, .14, random, true)
      } else if (b === 0) addKick(out, at, .22)
      for (let h = 0; h < 2; h++) if (song.genre !== 'Ambient') addNoise(out, at + h * beat / 2, .075, .045, random)
    }
    for (let step = 0; step < 8; step++) {
      if (random() < (song.genre === 'Ambient' ? .46 : .76)) {
        const note = base + 12 + melodySteps[Math.floor(random() * melodySteps.length)]
        addTone(out, start + step * beat / 2, beat * (random() < .3 ? .9 : .42), hz(note), song.genre === 'Ambient' ? .075 : .11, 'lead')
      }
    }
  }
  const filename = song.id + '.wav'
  writeWav(path.join(audioDir, filename), out)
  manifest.push({ id: song.id, title: song.title, artist: song.artist, genre: song.genre, duration: Math.round(duration), uri: '/audio/' + filename, colors: song.colors, source: 'catalog', license: 'CC0-1.0' })
  console.log(filename, Math.round(duration) + 's')
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')


