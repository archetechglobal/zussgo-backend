const axios = require("axios");

const URL = "https://zussgo-backend.onrender.com/api/admin/waitlist";

const startPinging = () => {
  // Use a shorter range (5 to 12 minutes) to stay ahead of the 15-min sleep timer
  const randomMinutes = Math.floor(Math.random() * (12 - 5 + 1) + 5);
  const delay = randomMinutes * 60 * 1000;

  setTimeout(async () => {
    try {
      // Adding a random user-agent makes the request look like a real browser
      await axios.get(URL, {
        headers: { "User-Agent": "ZussGo-Health-Check" },
      });
      console.log(
        `📡 Ping successful! Server is awake. Next check in ${randomMinutes}m.`,
      );
    } catch (err) {
      // If it fails, the server might already be asleep; we try again sooner
      console.error("📡 Ping failed. Retrying in 1 minute...");
      setTimeout(startPinging, 60000);
      return;
    }
    startPinging();
  }, delay);
};

module.exports = startPinging;
