const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("🤖 Anonymous-MD Bot is live.");
});

app.listen(PORT, () => {
  console.log(`🌐 App running on http://localhost:${PORT}`);
});