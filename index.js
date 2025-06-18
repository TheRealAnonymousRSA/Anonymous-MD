js
const { default: makeWASocket, DisconnectReason, useSingleFileAuthState } = require('@adiwajshing/baileys');
const express = require('express');
const { Boom } = require('@hapi/boom');
const fs = require('fs');

const { state, saveState } = useSingleFileAuthState('./auth_info.json');

const app = express();
const PORT = process.env.PORT || 3000;

async function startBot() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if(connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting:', shouldReconnect);
      if(shouldReconnect) {
        startBot();
      }
    } else if(connection === 'open') {
      console.log('Connected');
    }
  });

  sock.ev.on('creds.update', saveState);

  // Example command handler
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if(messageContent?.startsWith('/ping')) {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Pong!' }, { quoted: msg });
    }
  });
}

startBot();

app.get('/', (req, res) => {
  res.send('Anonymous-MD Bot is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT});
});