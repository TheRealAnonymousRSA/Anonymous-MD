module.exports = {
  name: "ping",
  description: "Check bot response",
  execute: async (sock, m) => {
    await sock.sendMessage(m.key.remoteJid, { text: "🏓 Pong!" }, { quoted: m });
  }
};