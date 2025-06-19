js
const { default: makeWASocket, useSingleFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { state, saveState } = useSingleFileAuthState('./session.json');

async function startBot() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (!text) return;

    // Ping Command
    if (text === '/ping') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'pong 🏓' });
    }

    // Emoji Combiner Example (basic)
    if (text.startsWith('/emoji ')) {
      const emojis = text.replace('/emoji ', '').split('+');
      await sock.sendMessage(msg.key.remoteJid, { text: `Combined: ${emojis.join('')}` });
    }

    // Sniff Placeholder
    if (text === '/sniff') {
      await sock.sendMessage(msg.key.remoteJid, { text: 'Sniffing... 🔍 (feature coming soon)' });
    }// Quote (Motivation)
    if (text === '/quote') {
      await sock.sendMessage(msg.key.remoteJid, { text: '“One often meets his destiny on the road he takes to avoid it.” – Master Oogway 🐢' });
    }
  });
}

startBot();