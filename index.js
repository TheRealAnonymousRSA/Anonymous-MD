require('dotenv').config();
const express = require('express');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const config = require('./config');
const { handleMessage } = require('./lib/msgHandler');
const { handleGroupParticipantsUpdate } = require('./lib/groupEvents');
const qrcode = require('qrcode-terminal');

// --- Keep-alive web server ---------------------------------------------
// Render/Railway free tiers expect something listening on $PORT, and
// pinging this URL periodically (e.g. with UptimeRobot) stops the
// instance from spinning down on inactivity.
const app = express();
app.get('/', (req, res) => res.send(`✅ ${config.botName} is running`));
app.listen(process.env.PORT || 3000, () =>
  console.log(`Web server listening on port ${process.env.PORT || 3000}`)
);

// --- WhatsApp connection --------------------------------------------------
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
browser: Browsers.macOS('Chrome'),
    logger: pino({ level: 'silent' }),
  });

  // Pairing-code login: no QR needed, works well on headless hosts.
  if (config.usePairingCode && !sock.authState.creds.registered) {
    const phoneNumber = config.ownerNumber.replace(/[^0-9]/g, '');
    if (!phoneNumber) {
      console.log('⚠️  Set OWNER_NUMBER in .env to use pairing-code login.');
    } else {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phoneNumber);
          console.log(`\n📱 Pairing code: ${code}\n   Open WhatsApp > Linked Devices > Link with phone number, and enter this code.\n`);
        } catch (e) {
          console.error('Failed to request pairing code:', e);
        }
      }, 3000);
    }
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

  if (qr) {
    qrcode.generate(qr, { small: true });
  }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed.', shouldReconnect ? 'Reconnecting…' : 'Logged out — delete ./session and restart to relink.');
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log(`✅ ${config.botName} connected to WhatsApp`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    try {
      await handleMessage(sock, msg);
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  sock.ev.on('group-participants.update', (update) => {
    handleGroupParticipantsUpdate(sock, update).catch((err) =>
      console.error('Error handling group-participants.update:', err)
    );
  });
}

startBot().catch((err) => console.error('Fatal error starting bot:', err));
