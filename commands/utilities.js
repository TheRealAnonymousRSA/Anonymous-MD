module.exports = [
  {
    name: 'weather',
    description: 'Get current weather for a city — .weather Cape Town',
    category: 'utilities',
    async execute({ sock, from, text }) {
      if (!text) return sock.sendMessage(from, { text: 'Usage: .weather <city>' });
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=1`);
        const geo = await geoRes.json();
        const place = geo.results?.[0];
        if (!place) return sock.sendMessage(from, { text: `❌ Couldn't find a city called "${text}".` });

        const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,wind_speed_10m`);
        const wx = await wxRes.json();
        const c = wx.current;
        await sock.sendMessage(from, { text: `🌤️ Weather in ${place.name}, ${place.country}\nTemperature: ${c.temperature_2m}°C\nWind: ${c.wind_speed_10m} km/h` });
      } catch (err) {
        console.error('weather lookup failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not fetch the weather right now.' });
      }
    },
  },

  {
    name: 'define',
    description: "Look up a word's definition — .define ephemeral",
    category: 'utilities',
    async execute({ sock, from, text }) {
      if (!text) return sock.sendMessage(from, { text: 'Usage: .define <word>' });
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text.trim())}`);
        if (res.status === 404) return sock.sendMessage(from, { text: `❌ No definition found for "${text}".` });
        const data = await res.json();
        const entry = data[0];
        const meaning = entry.meanings?.[0];
        const def = meaning?.definitions?.[0]?.definition;
        if (!def) return sock.sendMessage(from, { text: `❌ No definition found for "${text}".` });
        await sock.sendMessage(from, { text: `📖 *${entry.word}* (${meaning.partOfSpeech})\n${def}` });
      } catch (err) {
        console.error('define lookup failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not look that up right now.' });
      }
    },
  },

  {
    name: 'github',
    description: 'Look up a GitHub user — .github torvalds',
    category: 'utilities',
    async execute({ sock, from, text }) {
      if (!text) return sock.sendMessage(from, { text: 'Usage: .github <username>' });
      try {
        const headers = process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {};
        const res = await fetch(`https://api.github.com/users/${encodeURIComponent(text.trim())}`, { headers });
        if (res.status === 404) return sock.sendMessage(from, { text: `❌ No GitHub user called "${text}".` });
        const u = await res.json();
        await sock.sendMessage(from, { text: `👤 *${u.login}*\n${u.name || ''}\n${u.bio || ''}\nRepos: ${u.public_repos} | Followers: ${u.followers}\n${u.html_url}` });
      } catch (err) {
        console.error('github lookup failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not reach GitHub right now.' });
      }
    },
  },

  {
    name: 'time',
    description: 'Show the current time in a city — .time Tokyo',
    category: 'utilities',
    async execute({ sock, from, text }) {
      if (!text) return sock.sendMessage(from, { text: 'Usage: .time <city>' });
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=1`);
        const geo = await geoRes.json();
        const place = geo.results?.[0];
        if (!place) return sock.sendMessage(from, { text: `❌ Couldn't find a city called "${text}".` });
        const now = new Date().toLocaleString('en-US', { timeZone: place.timezone, dateStyle: 'medium', timeStyle: 'short' });
        await sock.sendMessage(from, { text: `🕒 ${place.name}, ${place.country}: ${now} (${place.timezone})` });
      } catch (err) {
        console.error('time lookup failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not look up the time right now.' });
      }
    },
  },

  {
    name: 'calc',
    aliases: ['calculate'],
    description: 'Basic calculator — .calc 12*(4+3)',
    category: 'utilities',
    async execute({ sock, from, text }) {
      if (!text) return sock.sendMessage(from, { text: 'Usage: .calc 2+2*5' });
      if (!/^[0-9+\-*/().\s]+$/.test(text)) {
        return sock.sendMessage(from, { text: '❌ Only numbers and + - * / ( ) are allowed.' });
      }
      try {
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${text})`)();
        await sock.sendMessage(from, { text: `🧮 ${text} = ${result}` });
      } catch {
        await sock.sendMessage(from, { text: '❌ Invalid expression.' });
      }
    },
  },
];
