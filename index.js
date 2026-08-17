
// Anonymous-MD identity
const DEVELOPER_NAME = process.env.DEVELOPER_NAME || "TheRealAnonymousRSA";
function getBotOwnerJid(sock) {
  return sock?.user?.id || null;
}
function getBotOwnerNumber(sock) {
  const jid = getBotOwnerJid(sock);
  return jid ? jid.split(":")[0].split("@")[0] : null;
}

require('dotenv').config();
const express = require('express');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
} = require('angularsockets');
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
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
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
          const code = await sock.requestPairingCode(phoneNumber, "KINGANON");
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

    // QR support remains available when pairing-code mode is disabled.
    if (qr && !config.usePairingCode) {
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(
        'Connection closed.',
        shouldReconnect
          ? 'Reconnecting in 5 seconds…'
          : 'Logged out — remove the persistent session only if you intend to pair again.'
      );

      if (shouldReconnect) {
        setTimeout(() => startBot().catch((err) => console.error('Reconnect failed:', err)), 5000);
      }
    } else if (connection === 'open') {
      console.log(`✅ ${config.botName} connected to WhatsApp`);
    }
  });


  // Angularsockets @lid group-mention compatibility.
  // Resolves WhatsApp LID mentions to participant JIDs before command handling.
  sock.ev.on('messages.upsert', async (chatUpdate) => {
    try {
      const mek = chatUpdate?.messages?.[0];
      if (!mek?.message) return;

      const remoteJid = mek.key?.remoteJid || '';
      if (!remoteJid.endsWith('@g.us')) return;

      const extended = mek.message.extendedTextMessage;
      const mentionedJid = extended?.contextInfo?.mentionedJid || [];
      if (!Array.isArray(mentionedJid) || !mentionedJid.some(j => j.endsWith('@lid'))) return;

      const groupMetadata = await sock.groupMetadata(remoteJid);
      const lidMap = {};

      for (const lid of mentionedJid) {
        if (!lid.endsWith('@lid')) continue;
        const match = groupMetadata.participants.find(p => p.id === lid);
        if (match?.jid) {
          lidMap[lid.split('@')[0]] = match.jid.split('@')[0];
        }
      }

      if (!Object.keys(lidMap).length) return;

      const replaceLidInText = (value) => {
        if (!value) return value;
        for (const [lidNum, jidNum] of Object.entries(lidMap)) {
          value = value.replace(new RegExp(`@${lidNum}\\\\b`, 'g'), `@${jidNum}`);
        }
        return value;
      };

      if (mek.message.conversation) {
        mek.message.conversation = replaceLidInText(mek.message.conversation);
      }
      if (extended?.text) {
        extended.text = replaceLidInText(extended.text);
      }

      const resolvedMentions = mentionedJid.map(jid => {
        if (!jid.endsWith('@lid')) return jid;
        const match = groupMetadata.participants.find(p => p.id === jid);
        return match?.jid || jid;
      });
      extended.contextInfo.mentionedJid = resolvedMentions;
    } catch (err) {
      // Ignore LID normalization failures; normal message processing continues.
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

// Web pairing/status site
require("./pairing-server");

// Developer/owner identity helpers for command handlers:
// .developer / .dev -> TheRealAnonymousRSA
// .owner -> the WhatsApp account currently authenticated by this bot instance.
