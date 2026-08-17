const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DEVELOPER_NAME = process.env.DEVELOPER_NAME || "TheRealAnonymousRSA";
const PORT = Number(process.env.PORT || 3000);

// The bot process can update these values when a WhatsApp session is paired.
let currentPairingCode = null;
let pairedOwner = null;

function setPairingState({ code, owner }) {
  currentPairingCode = code || null;
  pairedOwner = owner || null;
}

app.get("/api/status", (_req, res) => {
  res.json({
    developer: DEVELOPER_NAME,
    paired: Boolean(pairedOwner),
    owner: pairedOwner
  });
});

app.get("/api/pairing-code", (_req, res) => {
  res.json({
    developer: DEVELOPER_NAME,
    code: currentPairingCode
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Pairing site running on port ${PORT}`);
});

module.exports = { app, setPairingState };
