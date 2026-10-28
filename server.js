require('dotenv').config()
const app = require('./src/app')
const connectDB = require('./db/db')

if (process.env.STORAGE_MODE === 'local') {
  console.log('Using local file storage')
} else {
  connectDB()
}

const port = Number(process.env.PORT || 3000)
app.listen(port, () => console.log('Server is running on port ' + port))

