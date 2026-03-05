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
const resend = new Resend(process.env.RESEND_API_KEY);

const sendWelcomeEmail = async (userEmail, count) => {
  const displayCount = count; // Starts the waitlist at #412

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
    const currentWaitlistPosition = waitlist.length + 412;
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
      await sendWelcomeEmail(newUser.email, currentWaitlistPosition);
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
