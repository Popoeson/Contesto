const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Load .env

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Schema for Meme
const memeSchema = new mongoose.Schema({
  title: String,
  imageUrl: String,
  uploadedAt: { type: Date, default: Date.now }
});

const Meme = mongoose.model('Meme', memeSchema);

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// POST /api/upload - Admin uploads meme
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    const { title } = req.body;
    const imageUrl = `/uploads/${req.file.filename}`;

    const meme = new Meme({ title, imageUrl });
    await meme.save();

    res.status(201).json({ message: 'Meme uploaded successfully', meme });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ message: 'Failed to upload meme' });
  }
});

// GET /api/memes - Get all memes
app.get('/api/memes', async (req, res) => {
  try {
    const memes = await Meme.find().sort({ uploadedAt: -1 });
    res.json(memes);
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).json({ message: 'Failed to fetch memes' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Meme Server is running...');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
