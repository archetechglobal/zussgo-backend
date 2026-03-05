const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose"); // Added Mongoose
const validator = require("validator");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// --- 1. SETUP & MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- 2. MONGODB CONNECTION ---
// Make sure to add MONGODB_URI to your Render Environment Variables
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to ZussGo Database"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// Define User Schema
const waitlistSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  joinedAt: { type: Date, default: Date.now },
});

const Waitlist = mongoose.model("Waitlist", waitlistSchema);

// --- 3. EMAIL LOGIC (Resend) ---
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

const sendWelcomeEmail = async (userEmail, displayCount) => {
  try {
    await resend.emails.send({
      from: "ZussGo <hello@zussgo.com>",
      to: userEmail,
      subject: "Pack your bags! You're on the ZussGo list ✈️",
      html: `
        <div style="font-family: 'Helvetica', Arial, sans-serif; background-color: #ffffff; padding: 40px; border-radius: 20px; border: 1px solid #eee; max-width: 500px; margin: auto;">
          <div style="text-align: center; margin-bottom: 30px;">
            <span style="font-size: 40px;">🌍</span>
            <h1 style="color: #7B2FF7; margin-top: 10px; letter-spacing: -1px;">Welcome to the Inner Circle</h1>
          </div>
          
          <p style="font-size: 16px; line-height: 1.6; color: #444;">
            The wait is almost over. We're building the future of social travel, and you're officially <strong>#${displayCount}</strong> in line.
          </p>

          <div style="background: linear-gradient(135deg, #7B2FF7, #F15A24); padding: 2px; border-radius: 12px; margin: 25px 0;">
            <div style="background: white; padding: 20px; border-radius: 11px; text-align: center;">
              <p style="margin: 0; color: #7B2FF7; font-weight: bold; font-size: 14px; text-transform: uppercase;">Your Global Rank</p>
              <h2 style="margin: 5px 0 0; font-size: 32px; color: #333;">#${displayCount}</h2>
            </div>
          </div>

          <p style="font-size: 15px; color: #666;">
            We're letting people in small batches to ensure the best travel matches.
          </p>

          <footer style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #aaa;">
            ZussGo Travel Tech • Hyderabad, India<br/>
            Unsubscribe if you hate adventure.
          </footer>
        </div>
      `,
    });
  } catch (error) {
    console.error("Email error:", error);
  }
};

// --- 4. THE LOGIC (API Routes) ---

app.post("/api/waitlist", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    // A. Duplicate Check using MongoDB
    const alreadyExists = await Waitlist.findOne({
      email: email.toLowerCase(),
    });

    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: "You're already on the ZussGo list!",
      });
    }

    // B. Save to Database
    const newUser = new Waitlist({ email: email.toLowerCase() });
    await newUser.save();

    // C. Get Rank (Current DB count + 412 offset)
    const dbCount = await Waitlist.countDocuments();
    const currentWaitlistPosition = dbCount + 411;

    // D. Send Email
    try {
      await sendWelcomeEmail(newUser.email, currentWaitlistPosition);
      console.log(`📧 Email sent to ${newUser.email}`);
    } catch (mailError) {
      console.error("❌ Mail failed but user saved to DB:", mailError);
    }

    console.log(`✅ Success: ${email} added to MongoDB`);
    return res.status(201).json({
      success: true,
      message: "Welcome to ZussGo!",
      count: currentWaitlistPosition,
    });
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// --- 5. ADMIN ROUTES ---

// Get all users
app.get("/api/admin/waitlist", async (req, res) => {
  try {
    const users = await Waitlist.find().sort({ joinedAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error fetching list" });
  }
});

// Clear waitlist (Testing only)
app.delete("/api/admin/clear-waitlist", async (req, res) => {
  try {
    await Waitlist.deleteMany({});
    console.log("🗑️ Database cleared.");
    res.json({ success: true, message: "Waitlist cleared successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not clear DB." });
  }
});

// --- 6. START SERVER ---
app.listen(PORT, () => {
  console.log(`🚀 ZussGo Server ready at PORT: ${PORT}`);
});
