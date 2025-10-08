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
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
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

const memeSchema = new mongoose.Schema({
  caption: String,
  imageUrl: String,
  public_id: String,
  uploadedAt: { type: Date, default: Date.now },

  // 🆕 New fields for control
  isVotingActive: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false },

  // Optional: count of captions/comments
  captionCount: { type: Number, default: 0 },
});

//==========================
// 📃 Caption Schema 
//=========================
const captionSchema = new mongoose.Schema({
  meme: { type: String, required: true },
  memeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meme' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional
  username: { type: String, required: true },
  profilePicture: { type: String }, // store the user's profile image url
  caption: { type: String, required: true },
}, { timestamps: true });

//=========================
// 🎉 Winner Schema
//=========================
const winnerSchema = new mongoose.Schema({
  username: { type: String, required: true },
  caption: { type: String, required: true },
  meme: { type: String, required: true },
  profilePicture: { type: String },
  pickedAt: { type: Date, default: Date.now }
});

// 🗨️ Updated Message Schema
const messageSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true },
    senderRole: { type: String, enum: ["user", "admin"], required: true },
    receiverId: { type: String, required: true },
    message: { type: String, required: true },
    room: { type: String, required: true },
    replyTo: { type: String, default: null }, // ✅ New field
  },
  { timestamps: true }
);

// Models
const User = mongoose.model('User', userSchema);
const Meme = mongoose.model('Meme', memeSchema);
const Caption = mongoose.model("Caption", captionSchema);
const Winner = mongoose.model("Winner", winnerSchema);
const Message = mongoose.model("Message", messageSchema);
// Export models together
module.exports = {
  Caption,
  Meme,
  User,
  Winner,
  Message
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

    // ✅ Respond with all needed fields
    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        phone: user.phone,
        profilePicture: user.profilePicture, // ✅ now included
        createdAt: user.createdAt
      }
    });

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
});

// ==========================
// 👤 Get User by ID (with profile)
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
      fullName: user.fullName || "N/A",
      username: user.username || "Anonymous",
      email: user.email || "N/A",
      phone: user.phone || "N/A",
      profilePicture: user.profilePicture || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
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
      fullName: user.fullName || "N/A",
      username: user.username || "N/A",
      email: user.email,
      phone: user.phone,
      location: user.location || "N/A",
      about: user.about || "N/A",
      interest: user.interests && user.interests.length ? user.interests.join(", ") : "N/A",
      socials: user.social && user.social.length ? user.social : [],
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

// ✅ Toggle voting status
app.patch("/api/memes/:id/vote", async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id);
    if (!meme) return res.status(404).json({ message: "Meme not found" });

    meme.isVotingActive = !meme.isVotingActive;
    await meme.save();

    res.json({
      message: meme.isVotingActive ? "Voting started" : "Voting ended",
      meme,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Toggle archive status
app.patch("/api/memes/:id/archive", async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id);
    if (!meme) return res.status(404).json({ message: "Meme not found" });

    meme.isArchived = !meme.isArchived;
    await meme.save();

    res.json({
      message: meme.isArchived ? "Meme archived" : "Meme unarchived",
      meme,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Delete meme
app.delete("/api/memes/:id", async (req, res) => {
  try {
    const meme = await Meme.findById(req.params.id);
    if (!meme) {
      return res.status(404).json({ message: "Meme not found" });
    }

    // 🧹 Optional: Delete from Cloudinary if you’re using it
    if (meme.public_id) {
      try {
        const cloudinary = require("cloudinary").v2;
        await cloudinary.uploader.destroy(meme.public_id);
      } catch (cloudErr) {
        console.warn("⚠️ Cloudinary deletion failed:", cloudErr.message);
      }
    }

    // Delete from MongoDB
    await Meme.findByIdAndDelete(req.params.id);

    res.json({ message: "Meme deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting meme:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//=========================
// 📸 Submit Caption Route

app.post('/api/captions', async (req, res) => {
  try {
    const { meme, memeId, username, caption, userId, profilePicture } = req.body;

    if (!meme || !username || !caption) {
      return res.status(400).json({ message: 'Meme, username, and caption are required' });
    }

    // Prevent exact duplicate from same user
    const exists = await Caption.exists({ username, meme, memeId, caption });
    if (exists) {
      return res.status(409).json({ message: 'Duplicate caption: You have already submitted this caption for this meme.' });
    }

    const newCaption = new Caption({
      meme,
      memeId,
      userId: userId || undefined,
      username,
      profilePicture: profilePicture || undefined,
      caption
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

    // Fetch user data for each caption (parallelized)
    const enriched = await Promise.all(captions.map(async (cap) => {
      const user = await User.findOne({ username: cap.username });
      return {
        _id: cap._id,
        username: cap.username,
        caption: cap.caption,
        createdAt: cap.createdAt,
        meme: cap.meme,
        profilePicture: user?.profilePicture || "https://via.placeholder.com/100?text=User"
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error("❌ Error fetching captions:", err);
    res.status(500).json({ message: "Server error fetching captions." });
  }
});

// ===============================
// 🎯 Save Random Winner
// ===============================
app.post("/api/winner/save", async (req, res) => {
  try {
    const { username, caption, meme, profilePicture } = req.body;

    if (!username || !caption || !meme) {
      return res.status(400).json({ message: "Username, caption, and meme are required." });
    }

    // 🛑 Prevent duplicate winner for the same meme
    const existingWinner = await Winner.findOne({ meme });
    if (existingWinner) {
      return res.status(409).json({ message: "Winner already picked for this meme." });
    }

    // ✅ Save the winner
    const newWinner = new Winner({ username, caption, meme, profilePicture });
    await newWinner.save();

    res.status(201).json({
      message: "Winner saved successfully!",
      winner: newWinner
    });

  } catch (error) {
    console.error("Error saving winner:", error);
    res.status(500).json({ message: "Server error saving winner." });
  }
});

// ==========================
// 🏆 Get All Winners
// ==========================
app.get('/api/winners', async (req, res) => {
  try {
    const winners = await Winner.find().sort({ createdAt: -1 });
    res.json(winners);
  } catch (error) {
    console.error('Error fetching winners:', error);
    res.status(500).json({ message: 'Failed to fetch winners' });
  }
});

// 💬 Chat: Save a new message
app.post("/api/chat/send", async (req, res) => {
  try {
    const { senderId, senderRole, receiverId, message, room, replyTo } = req.body;
    if (!senderId || !senderRole || !receiverId || !message || !room) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newMessage = new Message({ senderId, senderRole, receiverId, message, room, replyTo });
    await newMessage.save();

    res.status(201).json({ message: "Message sent successfully" });
  } catch (err) {
    console.error("❌ Chat send error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 💬 Chat: Get all messages in a specific room
app.get("/api/chat/messages/:room", async (req, res) => {
  try {
    const { room } = req.params;
    const messages = await Message.find({ room }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    console.error("❌ Fetch messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 💬 Chat: Get all users who have active chats (for admin chat list)
app.get("/api/chat/admin/chat-users", async (req, res) => {
  try {
    const Message = mongoose.model("Message");
    const User = mongoose.model("User");

    const chats = await Message.aggregate([
      {
        $match: { senderRole: "user" }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: "$senderId",
          lastMessage: { $first: "$message" },
          lastActive: { $first: "$createdAt" },
          room: { $first: "$room" }
        }
      },
      // 🧠 Convert senderId (string) to ObjectId for lookup
      {
        $addFields: {
          senderObjectId: {
            $convert: {
              input: "$_id",
              to: "objectId",
              onError: null,
              onNull: null
            }
          }
        }
      },
      {
        $lookup: {
          from: User.collection.name, // ✅ dynamically get actual collection name
          localField: "senderObjectId",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          username: { $ifNull: ["$user.username", "Unknown User"] },
          profilePicture: {
            $ifNull: [
              "$user.profilePicture",
              "https://cdn-icons-png.flaticon.com/512/149/149071.png"
            ]
          },
          lastMessage: 1,
          lastActive: 1,
          room: 1
        }
      },
      { $sort: { lastActive: -1 } }
    ]);

    res.json(chats);
  } catch (err) {
    console.error("Fetch Admin Chat Users Error:", err);
    res.status(500).json({ message: err.message || "Failed to fetch chat users" });
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
// 🚀 Start Server with Socket.io
// ==========================
const http = require("http");
const { Server } = require("socket.io");

// Create HTTP server from your existing Express app
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// 🟢 Handle socket connections
io.on("connection", (socket) => {
  console.log("⚡ New client connected:", socket.id);

  // Join room
  socket.on("joinRoom", (room) => {
    socket.join(room);
    console.log(`📱 Joined room: ${room}`);
  });

  // Unified message handler
  socket.on("sendMessage", ({ room, senderRole, message }) => {
    console.log(`💬 ${senderRole} sent: ${message}`);
    io.to(room).emit("receiveMessage", { senderRole, message });
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// ✅ Start your combined HTTP + WebSocket server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
