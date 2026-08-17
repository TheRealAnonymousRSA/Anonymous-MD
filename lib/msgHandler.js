const fs = require('fs');
const path = require('path');
const config = require('../config');
const { getBotSettings, isBanned } = require('./db');
const { isSudo } = require('./permissions');
const { runModerationChecks } = require('./moderationEngine');

const commands = new Map();

function loadCommands() {
  const commandsPath = path.join(__dirname, '../commands');
  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const mod = require(path.join(commandsPath, file));
    const list = Array.isArray(mod) ? mod : [mod];
    for (const cmd of list) {
      commands.set(cmd.name, cmd);
      for (const alias of cmd.aliases || []) {
        commands.set(alias, cmd);
      }
    }
  }
  console.log(`Loaded ${commands.size} command(s)/alias(es) from ${files.length} file(s).`);
}
loadCommands();

function getMessageText(msg) {
  const m = msg.message;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  );
}

async function handleMessage(sock, msg) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const text = getMessageText(msg).trim();

  if (isBanned(sender)) return; // silently ignore bot-banned users everywhere

  if (from.endsWith('@g.us')) {
    const removed = await runModerationChecks(sock, msg, from, sender, text);
    if (removed) return;
  }

  const botSettings = getBotSettings();
  const prefix = botSettings.prefix || config.prefix;

  if (!text.startsWith(prefix)) return;

  if (botSettings.mode === 'private' && !isSudo(sender)) return; // private mode: owner/sudo only

  const args = text.slice(prefix.length).trim().split(/ +/);
  const cmdName = args.shift().toLowerCase();
  const command = commands.get(cmdName);
  if (!command) return;

  const ctx = {
    sock,
    msg,
    from,
    args,
    text: args.join(' '),
    commands,
    sender,
  };

  try {
    await command.execute(ctx);
  } catch (err) {
    console.error(`Error running command "${cmdName}":`, err);
    try {
      await sock.sendMessage(from, { text: '❌ Something went wrong running that command.' });
    } catch {
      // if even the error reply fails, there's nothing more we can do here
    }
  }
}

module.exports = { handleMessage, commands };
