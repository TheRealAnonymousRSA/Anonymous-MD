const { addWarn, removeWarn, getWarns, resetWarns, setGroupSetting } = require('../lib/db');
const { canModerate } = require('../lib/groupAuth');
const { normalizePhoneNumber, toJid } = require('../lib/jid');
const config = require('../config');

function getQuotedTarget(msg) {
  return msg.message.extendedTextMessage?.contextInfo?.participant || null;
}

async function requireGroupModerator({ from, sender, sock }) {
  if (!from.endsWith('@g.us')) {
    await sock.sendMessage(from, { text: 'Groups only.' });
    return false;
  }
  if (!(await canModerate(sock, from, sender))) {
    await sock.sendMessage(from, { text: '❌ Admins only.' });
    return false;
  }
  return true;
}

module.exports = [
  {
    name: 'add',
    description: `Add a member by phone number, any country — .add 27821234567 (include the country code, no + or leading 0) (admins/sudo only)`,
    category: 'group',
    async execute(ctx) {
      const { sock, from, args } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      if (!args[0]) return sock.sendMessage(from, { text: 'Usage: .add <number with country code>, e.g. .add 27821234567 or .add 14155552671' });

      const digits = normalizePhoneNumber(args[0]);
      if (!digits) {
        return sock.sendMessage(from, { text: "❌ Include the country code with no leading 0 or +, e.g. .add 27821234567 (South Africa) or .add 14155552671 (US)." });
      }

      const targetJid = toJid(digits);
      try {
        const result = await sock.groupParticipantsUpdate(from, [targetJid], 'add');
        const status = result?.[0]?.status;
        if (status === '200') {
          return sock.sendMessage(from, { text: `✅ Added @${digits}.`, mentions: [targetJid] });
        }
        if (status === '403') {
          return sock.sendMessage(from, { text: "❌ Couldn't add that number directly — their privacy settings block it. Send them the invite link instead: .link" });
        }
        if (status === '408' || status === '409') {
          return sock.sendMessage(from, { text: '❌ That number is already in the group, or already has a pending invite.' });
        }
        return sock.sendMessage(from, { text: `❌ WhatsApp didn't confirm the add (status: ${status || 'unknown'}). They may need an invite link instead: .link` });
      } catch (err) {
        console.error('add failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not add that number — is the bot a group admin?' });
      }
    },
  },

  {
    name: 'kick',
    description: 'Remove a member — reply to their message with .kick (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, msg, from } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      const target = getQuotedTarget(msg);
      if (!target) return sock.sendMessage(from, { text: 'Reply to the member you want to remove.' });
      try {
        await sock.groupParticipantsUpdate(from, [target], 'remove');
      } catch (err) {
        console.error('kick failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not remove that member — is the bot a group admin?' });
      }
    },
  },

  {
    name: 'promote',
    description: 'Make a member admin — reply to their message with .promote (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, msg, from } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      const target = getQuotedTarget(msg);
      if (!target) return sock.sendMessage(from, { text: 'Reply to the member you want to promote.' });
      try {
        await sock.groupParticipantsUpdate(from, [target], 'promote');
      } catch (err) {
        console.error('promote failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not promote that member — is the bot a group admin?' });
      }
    },
  },

  {
    name: 'demote',
    description: 'Remove admin from a member — reply to their message with .demote (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, msg, from } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      const target = getQuotedTarget(msg);
      if (!target) return sock.sendMessage(from, { text: 'Reply to the member you want to demote.' });
      try {
        await sock.groupParticipantsUpdate(from, [target], 'demote');
      } catch (err) {
        console.error('demote failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not demote that member — is the bot a group admin?' });
      }
    },
  },

  {
    name: 'mute',
    description: 'Restrict the group so only admins can send messages (admins/sudo only) — note: WhatsApp has no per-member mute, this mutes everyone',
    category: 'group',
    async execute(ctx) {
      const { sock, from } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      try {
        await sock.groupSettingUpdate(from, 'announcement');
        await sock.sendMessage(from, { text: "🔇 Group muted — only admins can send messages. (WhatsApp doesn't support muting a single member.)" });
      } catch (err) {
        console.error('mute failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not mute the group — is the bot a group admin?' });
      }
    },
  },

  {
    name: 'unmute',
    description: 'Allow all members to send messages again (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, from } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      try {
        await sock.groupSettingUpdate(from, 'not_announcement');
        await sock.sendMessage(from, { text: '🔊 Group unmuted — all members can send messages.' });
      } catch (err) {
        console.error('unmute failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not unmute the group — is the bot a group admin?' });
      }
    },
  },

  {
    name: 'warn',
    description: 'Warn a member — reply to their message with .warn (admins/sudo only, auto-kicks at the configured threshold)',
    category: 'group',
    async execute(ctx) {
      const { sock, msg, from } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      const target = getQuotedTarget(msg);
      if (!target) return sock.sendMessage(from, { text: 'Reply to the member you want to warn.' });

      const count = addWarn(from, target);
      if (count >= config.autoKickWarnThreshold) {
        resetWarns(from, target);
        try {
          await sock.groupParticipantsUpdate(from, [target], 'remove');
          return sock.sendMessage(from, {
            text: `⚠️ @${target.split('@')[0]} reached ${config.autoKickWarnThreshold} warnings and was removed.`,
            mentions: [target],
          });
        } catch (err) {
          console.error('auto-kick after warn failed:', err.message || err);
          return sock.sendMessage(from, { text: `⚠️ @${target.split('@')[0]} hit the warning limit, but I couldn't remove them — is the bot a group admin?`, mentions: [target] });
        }
      }
      await sock.sendMessage(from, { text: `⚠️ @${target.split('@')[0]} warned (${count}/${config.autoKickWarnThreshold}).`, mentions: [target] });
    },
  },

  {
    name: 'unwarn',
    description: 'Remove one warning — reply to their message with .unwarn (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, msg, from } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      const target = getQuotedTarget(msg);
      if (!target) return sock.sendMessage(from, { text: 'Reply to the member you want to unwarn.' });
      const count = removeWarn(from, target);
      await sock.sendMessage(from, { text: `✅ @${target.split('@')[0]} now has ${count}/${config.autoKickWarnThreshold} warnings.`, mentions: [target] });
    },
  },

  {
    name: 'warnings',
    description: "Check a member's warn count — reply to their message with .warnings",
    category: 'group',
    async execute({ sock, msg, from }) {
      const target = getQuotedTarget(msg);
      if (!target) return sock.sendMessage(from, { text: 'Reply to a member to check their warnings.' });
      const count = getWarns(from, target);
      await sock.sendMessage(from, { text: `@${target.split('@')[0]} has ${count}/${config.autoKickWarnThreshold} warnings.`, mentions: [target] });
    },
  },

  {
    name: 'tagall',
    description: 'Mention every member in the group — .tagall [message] (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, from, text } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      const metadata = await sock.groupMetadata(from);
      const mentions = metadata.participants.map((p) => p.id);
      const header = text ? `${text}\n\n` : '';
      const body = header + mentions.map((m) => `@${m.split('@')[0]}`).join(' ');
      await sock.sendMessage(from, { text: body, mentions });
    },
  },

  {
    name: 'hidetag',
    description: 'Notify everyone without listing all @mentions in the text — .hidetag <message> (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, from, text } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      if (!text) return sock.sendMessage(from, { text: 'Usage: .hidetag <message>' });
      const metadata = await sock.groupMetadata(from);
      const mentions = metadata.participants.map((p) => p.id);
      await sock.sendMessage(from, { text, mentions });
    },
  },

  {
    name: 'admins',
    description: 'List current group admins',
    category: 'group',
    async execute({ sock, from }) {
      if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: 'Groups only.' });
      const metadata = await sock.groupMetadata(from);
      const admins = metadata.participants.filter((p) => p.admin);
      const text = admins.map((a) => `• @${a.id.split('@')[0]} (${a.admin})`).join('\n') || 'No admins found.';
      await sock.sendMessage(from, { text: `👑 Group admins:\n${text}`, mentions: admins.map((a) => a.id) });
    },
  },

  {
    name: 'groupinfo',
    description: 'Show group information',
    category: 'group',
    async execute({ sock, from }) {
      if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: 'Groups only.' });
      const m = await sock.groupMetadata(from);
      await sock.sendMessage(from, {
        text: `📋 *${m.subject}*\n${m.desc ? m.desc + '\n' : ''}Members: ${m.participants.length}\nCreated: ${new Date(m.creation * 1000).toDateString()}`,
      });
    },
  },

  {
    name: 'link',
    aliases: ['invite'],
    description: 'Get the group invite link (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, from } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      try {
        const code = await sock.groupInviteCode(from);
        await sock.sendMessage(from, { text: `🔗 https://chat.whatsapp.com/${code}` });
      } catch (err) {
        console.error('invite link fetch failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not fetch the invite link — is the bot a group admin?' });
      }
    },
  },

  {
    name: 'revoke',
    description: 'Reset the group invite link, invalidating the old one (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, from } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      try {
        await sock.groupRevokeInvite(from);
        await sock.sendMessage(from, { text: '✅ Invite link reset.' });
      } catch (err) {
        console.error('revoke failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not reset the invite link — is the bot a group admin?' });
      }
    },
  },

  {
    name: 'setname',
    description: 'Rename the group — .setname <name> (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, from, text } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      if (!text) return sock.sendMessage(from, { text: 'Usage: .setname <new group name>' });
      try {
        await sock.groupUpdateSubject(from, text);
        await sock.sendMessage(from, { text: '✅ Group name updated.' });
      } catch (err) {
        console.error('setname failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not rename the group — is the bot a group admin?' });
      }
    },
  },

  {
    name: 'setdesc',
    description: 'Update the group description — .setdesc <text> (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, from, text } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      if (!text) return sock.sendMessage(from, { text: 'Usage: .setdesc <description>' });
      try {
        await sock.groupUpdateDescription(from, text);
        await sock.sendMessage(from, { text: '✅ Group description updated.' });
      } catch (err) {
        console.error('setdesc failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not update the description — is the bot a group admin?' });
      }
    },
  },

  {
    name: 'setwelcome',
    description: 'Set the welcome message (use {user} and {group} as placeholders) (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, from, text } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      if (!text) return sock.sendMessage(from, { text: 'Usage: .setwelcome Welcome {user} to {group}!' });
      setGroupSetting(from, 'welcomeMessage', text);
      await sock.sendMessage(from, { text: '✅ Welcome message saved. Turn it on with .welcome on' });
    },
  },

  {
    name: 'setgoodbye',
    description: 'Set the goodbye message (use {user} and {group} as placeholders) (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, from, text } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      if (!text) return sock.sendMessage(from, { text: 'Usage: .setgoodbye Goodbye {user}!' });
      setGroupSetting(from, 'goodbyeMessage', text);
      await sock.sendMessage(from, { text: '✅ Goodbye message saved. Turn it on with .goodbye on' });
    },
  },

  {
    name: 'welcome',
    description: 'Toggle welcome messages — .welcome on|off (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, from, args } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      const choice = args[0]?.toLowerCase();
      if (!['on', 'off'].includes(choice)) return sock.sendMessage(from, { text: 'Usage: .welcome on | .welcome off' });
      setGroupSetting(from, 'welcome', choice === 'on');
      await sock.sendMessage(from, { text: `Welcome messages turned ${choice}.` });
    },
  },

  {
    name: 'goodbye',
    description: 'Toggle goodbye messages — .goodbye on|off (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, from, args } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      const choice = args[0]?.toLowerCase();
      if (!['on', 'off'].includes(choice)) return sock.sendMessage(from, { text: 'Usage: .goodbye on | .goodbye off' });
      setGroupSetting(from, 'goodbye', choice === 'on');
      await sock.sendMessage(from, { text: `Goodbye messages turned ${choice}.` });
    },
  },

  {
    name: 'lock',
    description: 'Only admins can edit group info (name/icon/description) (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, from } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      try {
        await sock.groupSettingUpdate(from, 'locked');
        await sock.sendMessage(from, { text: '🔒 Group info locked to admins.' });
      } catch (err) {
        console.error('lock failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not lock the group — is the bot a group admin?' });
      }
    },
  },

  {
    name: 'unlock',
    description: 'Allow all members to edit group info (admins/sudo only)',
    category: 'group',
    async execute(ctx) {
      const { sock, from } = ctx;
      if (!(await requireGroupModerator(ctx))) return;
      try {
        await sock.groupSettingUpdate(from, 'unlocked');
        await sock.sendMessage(from, { text: '🔓 Group info unlocked for all members.' });
      } catch (err) {
        console.error('unlock failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not unlock the group — is the bot a group admin?' });
      }
    },
  },
];
