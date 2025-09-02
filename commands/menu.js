module.exports = {
  name: "menu",
  description: "Displays bot menu",
  execute: async (sock, m) => {
    const menu = `🤖 *Anonymous-MD Menu*
    
Available Commands:
/ping - Check bot status
/menu - Show this menu

More features coming soon...`;

    await sock.sendMessage(m.key.remoteJid, { text: menu }, { quoted: m });
  },
};
