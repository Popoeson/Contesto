const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Load .env
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinaryConfig'); // or wherever you exported it
const upload = multer({ storage });
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'memes', // Optional: folder in your Cloudinary account
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 800, crop: 'limit' }]
  }
});

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ===================
// 🧾 Contestant Schema
// ===================
const contestantSchema = new mongoose.Schema({
  username: { type: String, required: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Contestant = mongoose.model('Contestant', contestantSchema);

// ===================
// 📝 Meme Schema
// ===================
const memeSchema = new mongoose.Schema({
  title: String,
  imageUrl: String,
  uploadedAt: { type: Date, default: Date.now }
});

const Meme = mongoose.model('Meme', memeSchema);

const Meme = require('./models/Meme'); // adjust path if needed

// ==============================
// 📥 Multer setup for file uploads
// ==============================
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

// =============================
// 📤 POST /api/upload - Admin uploads meme
// =============================
// app.post('/api/upload', upload.single('image'), async (req, res) => {
//  try {
//    const { title } = req.body;

    // Handle missing input
 //   if (!req.file || !title) {
   //   return res.status(400).json({ message: 'Title and image are required.' });
 //   }

// const imageUrl = `/uploads/${req.file.filename}`; // for local dev

 //   const meme = new Meme({ title, imageUrl });
 //   await meme.save();

//    res.status(201).json({ message: 'Meme uploaded successfully', meme });
 // } catch (error) {
//    console.error('Upload Error:', error);
 //   res.status(500).json({ message: 'Failed to upload meme' });
 // }
// });
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    const { title } = req.body;
    const imageUrl = req.file.path; // Cloudinary gives the URL here

    const meme = new Meme({ title, imageUrl });
    await meme.save();

    res.status(201).json({ message: 'Meme uploaded successfully', meme });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ message: 'Failed to upload meme' });
  }
});
// ✅ Contestant Registration Route
app.post('/api/contestants/register', async (req, res) => {
  try {
    const { username, phone, password } = req.body;

    if (!username || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if username already exists
    const existingUser = await Contestant.findOne({ username });

    if (existingUser) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    const newContestant = new Contestant({ username, phone, password });
    await newContestant.save();

    res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'An error occurred during registration' });
  }
});

// Get all contestants
app.get('/api/contestants', async (req, res) => {
  try {
    const contestants = await Contestant.find().sort({ createdAt: -1 });
    res.json(contestants);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch contestants' });
  }
});
// ✅ Contestant Login Route
app.post('/api/contestants/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find contestant
    const contestant = await Contestant.findOne({ username });

    if (!contestant || contestant.password !== password) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Success
    res.status(200).json({
      message: 'Login successful',
      contestant: {
        username: contestant.username,
        phone: contestant.phone,
        id: contestant._id
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'An error occurred during login' });
  }
});
// Delete contestant by ID
app.delete('/api/contestants/:id', async (req, res) => {
  try {
    await Contestant.findByIdAndDelete(req.params.id);
    res.json({ message: 'Contestant deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Deletion failed' });
  }
});

// ====================
// 📥 GET /api/memes
// ====================
app.get('/api/memes', async (req, res) => {
  try {
    const memes = await Meme.find().sort({ uploadedAt: -1 });
    res.json(memes);
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).json({ message: 'Failed to fetch memes' });
  }
});

// ====================
// 🏠 Root endpoint
// ====================
app.get('/', (req, res) => {
  res.send('Meme Server is running...');
});

// ====================
// 🚀 Start server
// ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
