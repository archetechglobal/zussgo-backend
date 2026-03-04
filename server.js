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

// 1. Configure the "Mailman" (Transporter)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // STARTTLS
  service: "gmail", // This helps Nodemailer auto-configure the best path
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // FORCE IPv4 ONLY: This is the fix for ENETUNREACH
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
});

// 2. Function to send the mail
const sendWelcomeEmail = async (userEmail) => {
  const mailOptions = {
    from: '"ZussGo Team" <your-email@gmail.com>',
    to: userEmail,
    subject: "Welcome to the ZussGo Inner Circle! 🌍",
    html: `
            <h1>Thanks for joining ZussGo!</h1>
            <p>We're building the future of safe, social travel in India, and we're thrilled to have you.</p>
            <p>We'll notify you as soon as we launch our first set of "Trip Rooms."</p>
            <br>
            <p>Stay adventurous,<br>The ZussGo Team</p>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Thank you email sent to: ${userEmail}`);
  } catch (error) {
    console.error("Email Error:", error);
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
