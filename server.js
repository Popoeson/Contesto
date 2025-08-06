const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const app = express();

// ==========================
// 🌥️ Cloudinary Configuration
// ==========================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ==========================
// 📦 Multer + Cloudinary Setup
// ==========================
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'memes',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 800, crop: 'limit' }]
  }
});

const upload = multer({ storage });

// ==========================
// 🔌 Middleware
// ==========================
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================
// 🔗 MongoDB Connection
// ==========================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ==========================
// 👤 Contestant Schema
// ==========================
const contestantSchema = new mongoose.Schema({
  username: { type: String, required: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Contestant = mongoose.model('Contestant', contestantSchema);

// ==========================
// 🖼️ Meme Schema
// ==========================
const memeSchema = new mongoose.Schema({
  caption: String,
  imageUrl: String,
  public_id: String,
  uploadedAt: { type: Date, default: Date.now }
});

const Meme = mongoose.model('Meme', memeSchema);

module.exports = Meme;

//==========================
// 📃 Caption Schema 
//=========================
const captionSchema = new mongoose.Schema(
  {
    meme: {
      type: String, 
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      required: true,
      maxlength: 150,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Caption", captionSchema);
// ==========================
// 📤 Upload Meme Route
// ==========================
// app.post('/api/upload', upload.single('image'), async (req, res) => {
  //try {
//    const { title } = req.body;

 //   if (!req.file || !title) {
   //   return res.status(400).json({ message: 'Title and image are required.' });
 //   }

  //  const imageUrl = req.file.path; // Cloudinary hosted URL
   // const meme = new Meme({ title, imageUrl });
 //   await meme.save();

  //  res.status(201).json({ message: 'Meme uploaded successfully', meme });
// } catch (error) {
 //   console.error('Upload Error:', error);
  // res.status(500).json({ message: 'Failed to upload meme' });
  // }
// });


 app.post('/api/upload', upload.single('image'), async (req, res) => {
   console.log("Received meme upload");
   
  try {
    if (!req.file || !req.body.title) {
  return res.status(400).json({ message: 'Title and image are required.' });
    }

   const uploaded = await cloudinary.uploader.upload(req.file.path);
    
 const meme = new Meme({
      imageUrl: uploaded.secure_url,
     public_id: uploaded.public_id,
      title: req.body.title
    });

    await meme.save();
    res.status(201).json({ message: 'Meme uploaded successfully!' });

  } catch (err) {
    console.error(err);
   res.status(500).json({ error: 'Failed to upload meme' });
  }
 });

// ==========================
// 📝 Contestant Auth Routes
// ==========================

// Register
app.post('/api/contestants/register', async (req, res) => {
  try {
    const { username, phone, password } = req.body;

    if (!username || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await Contestant.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    const newContestant = new Contestant({ username, phone, password });
    await newContestant.save();

    res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'Registration failed' });
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

// Login
app.post('/api/contestants/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const contestant = await Contestant.findOne({ username });
    if (!contestant || contestant.password !== password) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

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
    res.status(500).json({ message: 'Login failed' });
  }
});

// ==========================
// ❌ Delete Contestant
// ==========================
app.delete('/api/contestants/:id', async (req, res) => {
  try {
    await Contestant.findByIdAndDelete(req.params.id);
    res.json({ message: 'Contestant deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Deletion failed' });
  }
});

// ==========================
// 📄 Fetch Memes
// ==========================
app.get('/api/memes', async (req, res) => {
  try {
    const memes = await Meme.find().sort({ uploadedAt: -1 });
    res.json(memes);
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).json({ message: 'Failed to fetch memes' });
  }
});

// ==========================
// 📄 Fetch Latest Meme Only
// ==========================
app.get('/api/memes/latest', async (req, res) => {
  try {
    const latestMeme = await Meme.findOne().sort({ uploadedAt: -1 });
    if (!latestMeme) {
      return res.status(404).json({ message: 'No memes found' });
    }
    res.json(latestMeme);
  } catch (error) {
    console.error('Fetch Latest Meme Error:', error);
    res.status(500).json({ message: 'Failed to fetch latest meme' });
  }
});

//=========================
// 📸 Submit Caption Route
//=========================
app.post('/api/captions', async (req, res) => {
  try {
    const { meme, username, caption } = req.body;

    if (!meme || !username || !caption) {
      return res.status(400).json({ message: 'Meme, username, and caption are required' });
    }

    const newCaption = new Caption({
      meme,
      username,
      caption,
    });

    await newCaption.save();

    res.status(201).json({ message: 'Caption submitted successfully', caption: newCaption });
  } catch (error) {
    console.error('Caption Submission Error:', error);
    res.status(500).json({ message: 'Error submitting caption' });
  }
});

// ❌ Prevent Duplicate Caption 
app.get("/api/captions/check", async (req, res) => {
  const { username, meme, caption} = req.query;
  if (!username || !meme || !caption) {
    return res.status(400).json({ message: "Username, meme and caption are required." });
  }

  try {
    const exists = await Caption.exists({ username, meme, caption });
    res.json({ exists: !!exists });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error." });
  }
});
//==========================
// 🚫 Error Handling 
//===========================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ==========================
// 🏠 Root Endpoint
// ==========================
app.get('/', (req, res) => {
  res.send('Meme Server is running...');
});

// ==========================
// 🚀 Start Server
// ==========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
