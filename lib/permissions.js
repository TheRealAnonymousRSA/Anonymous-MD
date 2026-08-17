const config = require('../config');
const { getSudoList } = require('./db');

function normalizeJid(input) {
  if (!input) return null;
  const digits = String(input).replace(/[^0-9]/g, '');
  return digits ? `${digits}@s.whatsapp.net` : null;
}

function isOwner(jid) {
  const ownerJid = normalizeJid(config.ownerNumber);
  return !!ownerJid && jid === ownerJid;
}

function isSudo(jid) {
  return isOwner(jid) || getSudoList().includes(jid);
}

module.exports = { isOwner, isSudo, normalizeJid };
