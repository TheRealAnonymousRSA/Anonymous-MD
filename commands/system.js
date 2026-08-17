const config = require('../config');
const { formatUptime } = require('../lib/format');
const { getGroupSettings, getBotSettings } = require('../lib/db');

const CATEGORY_LABELS = {
  ai: '🤖 AI',
  media: '🎨 STICKER / MEDIA',
  utilities: '🔎 SEARCH & UTILITIES',
  games: '🎮 GAMES',
  group: '👥 GROUP',
  moderation: '🛡️ MODERATION',
  owner: '👑 OWNER',
  system: '⚙️ SYSTEM',
};

module.exports = [
  {
    name: 'menu',
    aliases: ['help'],
    description: 'Show the categorized menu, or .help <category> / .help <command>',
    category: 'system',
    async execute({ sock, from, args, text, commands }) {
      const query = (args[0] || '').toLowerCase();

      if (!query) {
        const categories = Object.values(CATEGORY_LABELS).map((label) => `┃ ${label}`).join('\n');
        const body = `╭━━━〔 👻 ${config.botName.toUpperCase()} 〕━━━╮\n┃\n${categories}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━╯\n\nPrefix: ${(getBotSettings().prefix || config.prefix)}\nVersion: ${config.version}\nStatus: 🟢 Online\n\nUse *${config.prefix}help <category>* to see commands, e.g. ${config.prefix}help group`;
        return sock.sendMessage(from, { text: body });
      }

      if (CATEGORY_LABELS[query]) {
        const seen = new Set();
        let list = '';
        for (const [, cmd] of commands) {
          if (cmd.category !== query || seen.has(cmd)) continue;
          seen.add(cmd);
          list += `*${config.prefix}${cmd.name}* — ${cmd.description}\n`;
        }
        return sock.sendMessage(from, { text: `${CATEGORY_LABELS[query]}\n\n${list || 'No commands in this category yet.'}` });
      }

      const cmd = commands.get(query);
      if (cmd) return sock.sendMessage(from, { text: `*${config.prefix}${cmd.name}*\n${cmd.description}` });

      return sock.sendMessage(from, { text: `No category or command called "${query}". Try *${config.prefix}menu* to see categories.` });
    },
  },

  {
    name: 'ping',
    description: 'Check bot latency',
    category: 'system',
    async execute({ sock, from }) {
      const start = Date.now();
      const sent = await sock.sendMessage(from, { text: '🏓 PONG' });
      const latency = Date.now() - start;
      await sock.sendMessage(from, { text: `Latency: ${latency}ms\nStatus: 🟢 Online` }, { quoted: sent });
    },
  },

  {
    name: 'alive',
    description: 'Show bot status',
    category: 'system',
    async execute({ sock, from, commands }) {
      const uniqueCommands = new Set([...commands.values()]).size;
      await sock.sendMessage(from, {
        text: `👻 *${config.botName}*\nVersion: ${config.version}\nUptime: ${formatUptime(process.uptime())}\nCommands: ${uniqueCommands}\nMode: ${getBotSettings().mode}\nStatus: 🟢 Online`,
      });
    },
  },

  {
    name: 'runtime',
    description: 'Show bot uptime',
    category: 'system',
    async execute({ sock, from }) {
      await sock.sendMessage(from, { text: `⏱️ Uptime: ${formatUptime(process.uptime())}` });
    },
  },

  {
    name: 'owner',
    description: 'Show the bot owner contact',
    category: 'system',
    async execute({ sock, from }) {
      const num = config.ownerNumber || 'not set';
      await sock.sendMessage(from, { text: `👑 Bot owner: wa.me/${num}` });
    },
  },

  {
    name: 'repo',
    description: "Show the bot's source repository",
    category: 'system',
    async execute({ sock, from }) {
      await sock.sendMessage(from, { text: `📦 ${process.env.REPO_URL || 'Repository URL not set (set REPO_URL in .env)'}` });
    },
  },

  {
    name: 'version',
    description: 'Show bot version',
    category: 'system',
    async execute({ sock, from }) {
      await sock.sendMessage(from, { text: `Version: ${config.version}` });
    },
  },

  {
    name: 'settings',
    description: "Show this group's current settings",
    category: 'system',
    async execute({ sock, from }) {
      if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: 'Group settings only apply inside groups.' });
      const s = getGroupSettings(from);
      const lines = Object.entries(s)
        .filter(([, v]) => typeof v === 'boolean')
        .map(([k, v]) => `${k}: ${v ? '✅ on' : '❌ off'}`)
        .join('\n');
      await sock.sendMessage(from, { text: `⚙️ *Group settings*\n${lines}` });
    },
  },
];
