const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const validator = require("validator");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, "data", "waitlist.json");

// --- 1. SETUP & MIDDLEWARE ---
app.use(cors());
app.use(express.json()); // Essential: This allows Node to read JSON from Postman/Frontend

// Create 'data' folder if it doesn't exist (keeps things organized)
if (!fs.existsSync(path.join(__dirname, "data"))) {
  fs.mkdirSync(path.join(__dirname, "data"));
}

const nodemailer = require("nodemailer");

// Initialize the SMTP transporter for Resend
const transporter = nodemailer.createTransport({
  host: "smtp.resend.com",
  port: 465,
  secure: true, // Port 465 uses SSL
  auth: {
    user: "resend",
    pass: process.env.RESEND_API_KEY, // Stored safely in Render Env
  },
});

const sendWelcomeEmail = async (userEmail) => {
  try {
    // 💡 IMPORTANT: Now that your domain is verified,
    // you can use any name before @zussgo.com (e.g., hello, support, hi)
    await transporter.sendMail({
      from: "ZussGo <hello@zussgo.com>",
      to: userEmail,
      subject: "Welcome to ZussGo! 🚀 Your trip starts here",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #f0f0f0; padding: 40px; border-radius: 12px;">
          <h1 style="color: #7B2FF7; text-align: center;">You're in! 🌍</h1>
          <p style="font-size: 16px; color: #333;">Hi traveler,</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Thanks for joining the ZussGo waitlist. We’re building a community where finding your perfect travel match is safer, faster, and more exciting.
          </p>
          <div style="background-color: #f8f5ff; padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center;">
            <p style="margin: 0; font-weight: bold; color: #7B2FF7;">Stay tuned for your beta invite code!</p>
          </div>
          <p style="font-size: 14px; color: #888; text-align: center;">
            Follow our journey at <a href="https://zussgo.com" style="color: #7B2FF7; text-decoration: none;">zussgo.com</a>
          </p>
        </div>
      `,
    });
    console.log(`📧 Professional email sent to: ${userEmail}`);
  } catch (error) {
    console.error("SMTP Error:", error);
  }
};
// --- 2. THE LOGIC (The "Brain") ---

app.post("/api/waitlist", async (req, res) => {
  try {
    const { email } = req.body;

    // A. Validation: Check if input is empty
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required!" });
    }

    // B. Validation: Check if it's a real email format
    if (!validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format. Please check again.",
      });
    }

    // C. Persistence: Load existing users
    let waitlist = [];
    if (fs.existsSync(DATA_FILE)) {
      const fileData = fs.readFileSync(DATA_FILE);
      waitlist = JSON.parse(fileData);
    }

    // D. Duplicate Check: Prevent same email twice
    const alreadyExists = waitlist.some(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: "You're already on the ZussGo list!",
      });
    }

    // E. Save: Add new user with a timestamp
    const newUser = {
      email: email.toLowerCase(),
      joinedAt: new Date().toISOString(),
    };

    waitlist.push(newUser);
    fs.writeFileSync(DATA_FILE, JSON.stringify(waitlist, null, 2));
    try {
      await sendWelcomeEmail(newUser.email);
      console.log(`📧 Email sent to ${newUser.email}`);
    } catch (mailError) {
      console.error("❌ Mail failed but user saved:", mailError);
      // We still return 201 because the user IS on the list,
      // but we log the error so we can fix the transporter.
    }

    console.log(`✅ Success: ${email} added to ZussGo`);
    return res.status(201).json({
      success: true,
      message: "Welcome to ZussGo! You're officially on the waitlist.",
      count: waitlist.length,
    });
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

// --- 3. START SERVER ---
app.listen(PORT, () => {
  console.log(`🚀 ZussGo Server ready at http://localhost:${PORT}`);
});
app.get("/api/admin/waitlist", (req, res) => {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE);
    return res.json(JSON.parse(data));
  }
  res.json([]);
});
app.delete("/api/admin/clear-waitlist", (req, res) => {
  try {
    const emptyList = [];
    fs.writeFileSync(DATA_FILE, JSON.stringify(emptyList, null, 2));
    console.log("🗑️ Waitlist has been cleared for testing.");
    res.json({ success: true, message: "Waitlist cleared successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Could not clear list." });
  }
});
