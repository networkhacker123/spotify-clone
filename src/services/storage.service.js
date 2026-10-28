const { ImageKit } = require('@imagekit/nodejs')

async function uploadFile(file, originalName = 'track.mp3') {
  const imageKit = new ImageKit({ privateKey: process.env.IMAGEKIT_PRIVATE_KEY })
  return imageKit.files.upload({
    file,
    fileName: 'music_' + Date.now() + '_' + originalName.replace(/[^a-zA-Z0-9._-]/g, '_'),
    folder: 'yt-complete-backend/music',
  })
}

module.exports = { uploadFile }

