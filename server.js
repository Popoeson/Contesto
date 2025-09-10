const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;



const app = express();

// ✅ Allow Vercel frontend
app.use(cors({
  origin: "https://contesto-tau.vercel.app", // your frontend domain
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
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

//==========================
// 👤 User Schema
//==========================
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  profilePicture: { type: String },
  about: { type: String },
  location: { type: String },
  interests: [{ type: String }],
  social: { type: [String]},
  status: { type: String, enum: ['incomplete', 'active', 'inactive'], default: 'incomplete' },
  createdAt: { type: Date, default: Date.now }
});

// ==========================
// 🖼️ Meme Schema
// ==========================
const memeSchema = new mongoose.Schema({
  caption: String,
  memeId: {
      type: mongoose.Schema.Types.ObjectId, // this is the link to the Meme collection
      ref: 'Meme',
      required: true,
    },
  imageUrl: String,
  public_id: String,
  uploadedAt: { type: Date, default: Date.now }
});



// module.exports = Meme;

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

// module.exports = mongoose.model("Caption", captionSchema);

// Models
const User = mongoose.model('User', userSchema);
const Meme = mongoose.model('Meme', memeSchema);
const Caption = mongoose.model("Caption", captionSchema);

// Export models together
module.exports = {
  Caption,
  Meme,
  User
};
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
// 📝 User Auth Routes
// ==========================

// Register
app.post('/api/users/register', async (req, res) => {
  try {
    const { fullName, username, email, phone, password } = req.body;

    if (!fullName || !username || !email || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if username/email already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(409).json({ message: 'Username or Email already taken' });
    }

    const newUser = new User({
      fullName,
      username,
      email,
      phone,
      password, // ⚠️ no hashing yet
      status: 'incomplete'   // <-- Important
    });

    await newUser.save();

    res.status(201).json({
      message: 'Step 1 complete, proceed to profile setup',
      userId: newUser._id   // <-- return ID so frontend can continue
    });

  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// ✅ Check if username exists
app.get('/api/users/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ exists: false, message: "No username provided" });
    }

    const user = await User.findOne({ username });
    res.json({ exists: !!user });
  } catch (err) {
    console.error("Check Username Error:", err);
    res.status(500).json({ exists: false, message: "Server error" });
  }
});

// 🚨 Important: put this AFTER check-username
// app.get('/api/users/:id', async (req, res) => {
 // try {
//    const user = await User.findById(req.params.id);
//    if (!user) return res.status(404).json({ message: "User not found" });
//    res.json(user);
//  } catch (err) {
//    console.error("Get User Error:", err);
//    res.status(500).json({ message: "Error retrieving user" });
//  }
// });

//============================
// ✅ Complete Registration 
//============================
app.post('/api/users/complete-profile/:id', upload.single("profilePic"), async (req, res) => {
  try {
    const { id } = req.params;
    const { about, location, interests, social } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 🔹 Profile picture
    if (req.file && req.file.path) {
      user.profilePicture = req.file.path; // ✅ Cloudinary uploaded file
    } else if (!user.profilePicture) {
      // ✅ Set dummy default only if not already set
      user.profilePicture = "https://via.placeholder.com/150?text=Profile";
    }

    // 🔹 Other fields
    if (about) user.about = about;
    if (location) user.location = location;
    if (interests) user.interests = interests.split(',').map(i => i.trim());
    if (social) user.social = social.split(',').map(s => s.trim());

    user.status = 'active';

    await user.save();

    res.status(200).json({ message: 'Profile setup complete', user });
  } catch (err) {
    console.error('Profile Setup Error:', err);
    res.status(500).json({ message: 'Could not complete profile' });
  }
});

// ==========================
// 🔑 User Login
// ==========================
app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Plain password check (⚠️ no hashing yet)
    if (user.password !== password) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
});


// ==========================
// 👤 Get User by ID
// ==========================
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt
    });
  } catch (err) {
    console.error('Get User Error:', err);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// 📋 Get All Users (Admin)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    res.json(users.map((user, index) => ({
      serial: index + 1,
      id: user._id,
      profilePicture: user.profilePicture || "https://via.placeholder.com/100x100?text=User",
      email: user.email,
      phone: user.phone,
      location: user.location || "N/A",
      about: user.about || "N/A",
      interest: user.interest || "N/A",
      socials: user.social || [],   // assuming array of links
      status: user.status || "active",
      createdAt: user.createdAt
    })));
  } catch (err) {
    console.error('Get All Users Error:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});


// ==========================
// 🔴 Deactivate User (Admin)
// ==========================
app.patch('/api/users/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { status: 'inactive' },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User deactivated successfully', user });
  } catch (err) {
    console.error('Deactivate User Error:', err);
    res.status(500).json({ message: 'Failed to deactivate user' });
  }
});


// ==========================
// 🟢 Activate User (Admin)
// ==========================
app.patch('/api/users/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { status: 'active' },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User activated successfully', user });
  } catch (err) {
    console.error('Activate User Error:', err);
    res.status(500).json({ message: 'Failed to activate user' });
  }
});

// ==========================
// ❌ Delete User (Admin)
// ==========================
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete User Error:', err);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});
// ==========================
// 📄 Fetch Memes
// ==========================
app.get("/api/memes", async (req, res) => {
  try {
    const memes = await Meme.find().sort({ createdAt: -1 });

    // For each meme, count how many captions it has
    const memesWithCounts = await Promise.all(memes.map(async (meme) => {
      const count = await Caption.countDocuments({ meme: meme.imageUrl }); // or meme._id if using ID
      return {
        _id: meme._id,
        imageUrl: meme.imageUrl,
        createdAt: meme.createdAt,
        captionCount: count,
      };
    }));

    res.json(memesWithCounts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch memes" });
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
app.post('/api/captions', async (req, res) => {
  try {
    const { meme, memeId, username, caption } = req.body;

    if (!meme || !username || !caption) {
      return res.status(400).json({ message: 'Meme, username, and caption are required' });
    }

    // 🛑 Prevent duplicate caption submission
    const exists = await Caption.exists({ username, meme, memeId, caption });

    if (exists) {
      return res.status(409).json({ message: 'Duplicate caption: You have already submitted this caption for this meme.' });
    }

    // ✅ Save new caption
    const newCaption = new Caption({ meme, memeId, username, caption });
    await newCaption.save();

    res.status(201).json({ message: 'Caption submitted successfully', caption: newCaption });

  } catch (error) {
    console.error('Caption Submission Error:', error);
    res.status(500).json({ message: 'Error submitting caption' });
  }
});

 // ❌ Prevent Duplicate Caption 
 app.get("/api/captions/check", async (req, res) => {
  const { username, memeId, meme, caption} = req.query;
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

//===============================
// 📌 Get all submitted captions
//======≠=========================
app.get('/api/caption-check', async (req, res) => {
  try {
    const captions = await Caption.find().sort({ createdAt: -1 });
    res.status(200).json(captions);
  } catch (err) {
    console.error("❌ Error fetching captions:", err);
    res.status(500).json({ message: "Server error fetching captions." });
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
