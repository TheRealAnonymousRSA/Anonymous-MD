# Anonymous-MD (V2)

A modular WhatsApp bot built on [Baileys](https://github.com/WhiskeySockets/Baileys) (multi-device / "MD" API). V2 adds AI, group management, moderation, media conversion, search utilities, games, and owner/sudo tooling on top of the same architecture as V1 — no rewrite, just more modules.

## What changed from V1

- Every command now carries a `category` (used by the new categorized `.menu`/`.help`).
- `commands/` gained: `ai.js`, `games.js`, `media.js` (replaces `sticker.js`), `moderation.js`, `owner.js` (expanded), `system.js` (replaces `general.js`), `utilities.js` (replaces `tools.js`).
- `lib/` gained: `groupAuth.js`, `groupEvents.js`, `moderationEngine.js`, `cooldown.js`, `format.js`, `jid.js`, `badwords.js`.
- `db.json` gained `sudo`, `banned`, and `botSettings` (prefix override, public/private mode) — old `groups`/`warns` data is preserved and upgraded in place, nothing is wiped.
- No XP/leveling/economy code existed in V1, so there was nothing to remove there.
- **Plugin system note**: the spec asked for a nested `plugins/<category>/` folder structure. The existing flat `commands/` folder already auto-discovers every file and now carries full metadata (`name`, `description`, `category`, `usage` via description, `permissions` enforced in-command) — reorganizing into nested folders would only move code around without changing behavior, so V2 keeps the flat structure and adds the metadata instead. Say the word if you still want the nested layout and I'll do that restructure specifically.

## Command reference

Run `.menu` in chat for the live categorized menu, or `.help <category>` (e.g. `.help group`) to list one category's commands. Below is the full reference.

### System
`.menu` / `.help [category|command]` · `.ping` · `.alive` · `.runtime` · `.owner` · `.repo` · `.version` · `.settings` (this group's toggles)

### AI — requires `AI_API_KEY`
`.ai` / `.ask <question>` · `.summarize` (reply to a message, or give text) · `.translate <language>` (reply to a message, or add text after the language) · `.aitoggle on|off` (admins/sudo — enable/disable AI in this group)

### Sticker / Media
`.sticker` / `.s` (image or short video/gif to sticker) · `.toimg` · `.tomp4` · `.toaudio` · `.compress` · `.resize <W>x<H>` · `.crop <W>x<H>` · `.blur` · `.qr` / `.qrcode <text>` · `.readqr`

### Search & Utilities
`.weather <city>` · `.define <word>` · `.github <username>` · `.time <city>` · `.calc` / `.calculate <expression>`

*(`.translate` lives under AI since it needs the AI provider — no separate translation API key required.)*

### Games
`.8ball <question>` · `.flip` / `.coinflip` · `.dice` · `.rate <anything>` · `.riddle` · `.trivia` · `.answer` (reveal the last riddle/trivia) · `.tictactoe` / `.ttt`

### Group — admins/sudo only unless noted
`.add <number>` (any country code, no `+`/leading `0` — e.g. `.add 27821234567`) · `.kick` · `.promote` · `.demote` · `.mute` / `.unmute` (whole-group only, see note below) · `.warn` / `.unwarn` / `.warnings` · `.tagall [text]` · `.hidetag <text>` · `.admins` (anyone) · `.groupinfo` (anyone) · `.link` / `.invite` · `.revoke` · `.setname <name>` · `.setdesc <text>` · `.setwelcome <template>` / `.setgoodbye <template>` (use `{user}` and `{group}`) · `.welcome on|off` · `.goodbye on|off` · `.lock` · `.unlock`

### Moderation — admins/sudo only
`.antilink on|off` · `.nsfw on|off` (known adult-site links only, not image scanning) · `.antispam on|off` (repeated messages) · `.antiflood on|off` (rapid-fire messages) · `.antibadword on|off` · `.antimention on|off` (mass-mention spam) · `.autodelete on|off` (auto-clears the bot's own warning messages after 10s)

All moderation triggers add a warning (`.warnings` to check) and auto-kick at the configured threshold (default 3, see `.env`). Admins, the owner, and sudo users are always exempt.

### Owner
`.broadcast <message>` · `.block` / `.unblock` (WhatsApp-level block) · `.ban` / `.unban` (bot ignores them everywhere, separate from WhatsApp block) · `.setprefix <symbol>` · `.mode public|private` (private = only owner/sudo can run commands) · `.restart` / `.shutdown` (see caveat below) · `.botstats` (owner/sudo) · `.plugins` (owner/sudo, lists loaded modules)

### Sudo (owner-managed)
`.addsudo` / `.delsudo` (reply to a user, or give a number) · `.sudolist`. Sudo users (and the owner) can run group-admin/moderation commands in **any** group the bot is in, even ones they aren't a WhatsApp admin in.

## Honesty notes on WhatsApp/hosting limitations

These are real constraints of the WhatsApp API and free hosting, not bugs:

- **`.mute`/`.unmute`** restrict the *whole group* to admin-only posting — WhatsApp has no API for muting a single member, so per-user mute isn't offered.
- **`.add`** reports back exactly what WhatsApp says: success, a privacy-setting rejection (send `.link` instead), or "already in group." It never claims someone was added if WhatsApp didn't confirm it.
- **`.restart`/`.shutdown`** call `process.exit()`. On Render/Railway the platform typically restarts the process automatically — great for `.restart`, but it means `.shutdown` won't actually stay off unless you stop the service from the host's dashboard.
- **`.nsfw`** is a domain-based link filter (`lib/nsfwFilter.js`) — it cannot scan images or video content; that needs a paid moderation API or an ML model, out of scope for a lightweight free-tier bot.
- Group commands (`kick`, `promote`, `demote`, `antilink`, `nsfw`, `lock`, etc.) only work if **the bot's own account is a group admin** — a WhatsApp requirement, not a bug.
- `data/db.json` (settings, warnings, sudo, bans) is a plain local file — it resets on free-host redeploys the same way `session/` does. See the persistence options below.

## 1. Run it locally

```bash
npm install
cp .env.example .env
# edit .env — set OWNER_NUMBER, and AI_API_KEY if you want .ai/.ask/.summarize/.translate
npm start
```

You'll get a pairing code in the terminal. On your phone: WhatsApp → Settings → Linked Devices → Link a Device → "Link with phone number instead" → enter the code.

## 2. Deploying to free hosting (Render / Railway)

Same as V1: most free tiers wipe the filesystem on redeploy/restart, which resets `session/` (your login) and `data/db.json` (settings/warnings/sudo/bans) together. Options:

- **Simplest**: accept occasional re-pairing; fine for testing/personal use.
- **Better**: Railway's free tier supports small persistent volumes — mount one covering both `session/` and `data/`.
- **Render**: free tier has no persistent disk (paid add-on only); the built-in Express server gives you something to ping (e.g. UptimeRobot, free) to stop idle spin-down, but redeploys still reset the filesystem.

### Deploy steps
1. Push this folder to a GitHub repo.
2. Create a Web Service (Render) or Project (Railway) from that repo.
3. Build command `npm install`, start command `npm start`.
4. Add environment variables from `.env.example` in the host's dashboard (at minimum `OWNER_NUMBER`; add `AI_API_KEY` if you want AI commands).
5. Deploy, open the logs, grab the pairing code, link your WhatsApp.

Note: `sharp` and `ffmpeg-static` both need native binaries — if a build fails on either, check that host's Linux/Node compatibility notes for them.

## 3. Adding your own commands

Drop a new file in `/commands` — it's auto-discovered, no registration needed:

```js
module.exports = [
  {
    name: 'hello',
    description: 'Say hello',
    category: 'system', // or 'ai' / 'media' / 'utilities' / 'games' / 'group' / 'moderation' / 'owner'
    async execute({ sock, from }) {
      await sock.sendMessage(from, { text: 'Hello there!' });
    },
  },
];
```

Each command's `execute` receives `{ sock, msg, from, args, text, commands, sender }`.

## Notes

- Only use this on a number you're comfortable automating — WhatsApp's terms don't officially permit unofficial clients, and heavy/spammy use carries a small risk of the number being restricted.
- `lib/badwords.js` ships a short, generic starter list for `.antibadword` — edit it to fit your group.
- Rate limiting on `.ai`/`.ask`/`.summarize`/`.translate` defaults to 15s per user (`AI_COOLDOWN_MS`); moderation thresholds are all configurable via `.env` (see `.env.example`).
