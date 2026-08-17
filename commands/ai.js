const config = require('../config');
const { getGroupSettings, setGroupSetting } = require('../lib/db');
const { isOnCooldown } = require('../lib/cooldown');
const { canModerate } = require('../lib/groupAuth');

async function callAI(prompt) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error('NO_API_KEY');

  const apiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 500 }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API_ERROR:${res.status}:${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function replyWithAIError(err, sock, from) {
  if (err?.message === 'NO_API_KEY') {
    return sock.sendMessage(from, { text: "❌ AI features aren't configured. Ask the bot owner to set AI_API_KEY in .env." });
  }
  console.error('AI call failed:', err.message || err);
  return sock.sendMessage(from, { text: '❌ The AI provider returned an error. Try again shortly.' });
}

function getQuotedText(msg) {
  const q = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
  return q?.conversation || q?.extendedTextMessage?.text || null;
}

function aiDisabledHere(from) {
  return from.endsWith('@g.us') && getGroupSettings(from).aiEnabled === false;
}

module.exports = [
  {
    name: 'ai',
    aliases: ['ask'],
    description: 'Ask the AI a question — .ai <question>',
    category: 'ai',
    async execute({ sock, from, sender, text }) {
      if (!text) return sock.sendMessage(from, { text: 'Usage: .ai <question>' });
      if (aiDisabledHere(from)) return sock.sendMessage(from, { text: 'AI commands are turned off in this group.' });

      const wait = isOnCooldown(`ai:${sender}`, config.aiCooldownMs);
      if (wait) return sock.sendMessage(from, { text: `⏳ Wait ${wait}s before asking again.` });

      try {
        const reply = await callAI(text);
        await sock.sendMessage(from, { text: reply || "❌ The AI didn't return a response." });
      } catch (err) {
        await replyWithAIError(err, sock, from);
      }
    },
  },

  {
    name: 'summarize',
    description: 'Summarize a replied-to message, or given text — .summarize <text>',
    category: 'ai',
    async execute({ sock, msg, from, sender, text }) {
      const content = text || getQuotedText(msg);
      if (!content) return sock.sendMessage(from, { text: 'Reply to a message, or give text: .summarize <text>' });
      if (aiDisabledHere(from)) return sock.sendMessage(from, { text: 'AI commands are turned off in this group.' });

      const wait = isOnCooldown(`summarize:${sender}`, config.aiCooldownMs);
      if (wait) return sock.sendMessage(from, { text: `⏳ Wait ${wait}s before trying again.` });

      try {
        const reply = await callAI(`Summarize the following in 2-3 sentences:\n\n${content}`);
        await sock.sendMessage(from, { text: reply || '❌ Could not generate a summary.' });
      } catch (err) {
        await replyWithAIError(err, sock, from);
      }
    },
  },

  {
    name: 'translate',
    description: 'Translate text — .translate <language> (reply to a message, or add text after the language)',
    category: 'ai',
    async execute({ sock, msg, from, sender, args }) {
      if (!args[0]) return sock.sendMessage(from, { text: 'Usage: .translate <language> — reply to a message, or add text after the language.' });
      const language = args[0];
      const rest = args.slice(1).join(' ');
      const content = rest || getQuotedText(msg);
      if (!content) return sock.sendMessage(from, { text: 'Reply to a message, or add the text to translate after the language.' });
      if (aiDisabledHere(from)) return sock.sendMessage(from, { text: 'AI commands are turned off in this group.' });

      const wait = isOnCooldown(`translate:${sender}`, config.aiCooldownMs);
      if (wait) return sock.sendMessage(from, { text: `⏳ Wait ${wait}s before trying again.` });

      try {
        const reply = await callAI(`Translate the following into ${language}. Only output the translation, nothing else:\n\n${content}`);
        await sock.sendMessage(from, { text: reply || '❌ Could not translate that.' });
      } catch (err) {
        await replyWithAIError(err, sock, from);
      }
    },
  },

  {
    name: 'aitoggle',
    description: 'Turn AI commands on/off for this group — .aitoggle on|off (admins/sudo only)',
    category: 'ai',
    async execute({ sock, from, sender, args }) {
      if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: 'Groups only.' });
      if (!(await canModerate(sock, from, sender))) return sock.sendMessage(from, { text: '❌ Admins only.' });
      const choice = args[0]?.toLowerCase();
      if (!['on', 'off'].includes(choice)) return sock.sendMessage(from, { text: 'Usage: .aitoggle on | .aitoggle off' });
      setGroupSetting(from, 'aiEnabled', choice === 'on');
      await sock.sendMessage(from, { text: `AI commands turned ${choice} for this group.` });
    },
  },
];
