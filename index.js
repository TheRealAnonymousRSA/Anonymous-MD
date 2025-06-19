

js
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const pino = require("pino");

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: true,
    auth: state,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log("Logged out. Delete session and scan again.");
        fs.rmSync("session", { recursive: true, force: true });
      } else {
        startBot();
      }
    } else if (connection === "open") {
      console.log("✅ Bot connected");
    }
  });

  sock.ev.on("messages.upsert", async (msg) => {
    const m = msg.messages[0];if (!m.message || m.key.fromMe) return;

    const text = m.message.conversation || m.message.extendedTextMessage?.text || "";

    if (text === "/ping") {
      await sock.sendMessage(m.key.remoteJid, { text: "🏓 Pong!" }, { quoted: m });
    }

    if (text === "/menu") {
      await sock.sendMessage(m.key.remoteJid, { text: "🤖 Anonymous-MD Bot Online\nUse /ping or /menu" }, { quoted: m });
    }
  });
}

startBot();