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

const { Resend } = require("resend");

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

const sendWelcomeEmail = async (userEmail) => {
  try {
    // Note: On the Resend Free Tier, you can only send emails
    // to the email address you used to sign up for Resend
    // UNLESS you verify your own domain later.

    await resend.emails.send({
      from: "ZussGo <onboarding@resend.dev>", // Keep this as is for now
      to: userEmail,
      subject: "Welcome to the ZussGo Waitlist! 🌍",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
          <h2 style="color: #7B2FF7;">You're on the list!</h2>
          <p>Thanks for joining ZussGo. We're excited to have you with us.</p>
          <p>We'll notify you as soon as we launch our travel match features.</p>
          <br />
          <p>Cheers,<br />The ZussGo Team</p>
        </div>
      `,
    });
    console.log(`📧 Email sent via Resend to: ${userEmail}`);
  } catch (error) {
    console.error("Resend Sending Error:", error);
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
