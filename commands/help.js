module.exports = {
  name: "help",
  description: "Display help information",
  async execute(sock, m) {
    const helpMessage = `
🤖 *Anonymous-MD Bot Help Menu*

- /ping : Check if the bot is alive
- /menu : Show main menu
- /help : Show this help message

More commands coming soon!
    `;
    await sock.sendMessage(m.key.remoteJid, { text: helpMessage }, { quoted: m });
  },
};
