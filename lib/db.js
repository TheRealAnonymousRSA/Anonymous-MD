const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');

const DEFAULT_DB = { groups: {}, warns: {}, sudo: [], banned: [], botSettings: { prefix: null, mode: 'public' } };

const DEFAULT_GROUP_SETTINGS = {
  antilink: false,
  nsfw: false,
  antispam: false,
  antiflood: false,
  antibadword: false,
  antimention: false,
  autodelete: false,
  welcome: false,
  goodbye: false,
  welcomeMessage: null,
  goodbyeMessage: null,
  aiEnabled: true,
};

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  // Upgrade older db.json files that predate these fields — never destroys existing data.
  if (!db.groups) db.groups = {};
  if (!db.warns) db.warns = {};
  if (!db.sudo) db.sudo = [];
  if (!db.banned) db.banned = [];
  if (!db.botSettings) db.botSettings = { prefix: null, mode: 'public' };
  return db;
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ---- Group settings ----
function getGroupSettings(jid) {
  const db = loadDB();
  return { ...DEFAULT_GROUP_SETTINGS, ...(db.groups[jid] || {}) };
}

function setGroupSetting(jid, key, value) {
  const db = loadDB();
  db.groups[jid] = { ...DEFAULT_GROUP_SETTINGS, ...(db.groups[jid] || {}), [key]: value };
  saveDB(db);
}

// ---- Warnings ----
function addWarn(jid, user) {
  const db = loadDB();
  if (!db.warns[jid]) db.warns[jid] = {};
  db.warns[jid][user] = (db.warns[jid][user] || 0) + 1;
  saveDB(db);
  return db.warns[jid][user];
}

function removeWarn(jid, user) {
  const db = loadDB();
  if (!db.warns[jid]) db.warns[jid] = {};
  const next = Math.max(0, (db.warns[jid][user] || 0) - 1);
  db.warns[jid][user] = next;
  saveDB(db);
  return next;
}

function getWarns(jid, user) {
  const db = loadDB();
  return db.warns[jid]?.[user] || 0;
}

function resetWarns(jid, user) {
  const db = loadDB();
  if (db.warns[jid]) delete db.warns[jid][user];
  saveDB(db);
}

// ---- Sudo ----
function getSudoList() {
  return loadDB().sudo;
}
function addSudo(jid) {
  const db = loadDB();
  if (!db.sudo.includes(jid)) db.sudo.push(jid);
  saveDB(db);
}
function removeSudo(jid) {
  const db = loadDB();
  db.sudo = db.sudo.filter((x) => x !== jid);
  saveDB(db);
}

// ---- Bot-level ban list (bot ignores these users everywhere) ----
function getBannedList() {
  return loadDB().banned;
}
function isBanned(jid) {
  return loadDB().banned.includes(jid);
}
function addBanned(jid) {
  const db = loadDB();
  if (!db.banned.includes(jid)) db.banned.push(jid);
  saveDB(db);
}
function removeBanned(jid) {
  const db = loadDB();
  db.banned = db.banned.filter((x) => x !== jid);
  saveDB(db);
}

// ---- Bot-wide settings (prefix override, public/private mode) ----
function getBotSettings() {
  return loadDB().botSettings;
}
function setBotSetting(key, value) {
  const db = loadDB();
  db.botSettings[key] = value;
  saveDB(db);
}

module.exports = {
  getGroupSettings,
  setGroupSetting,
  addWarn,
  removeWarn,
  getWarns,
  resetWarns,
  getSudoList,
  addSudo,
  removeSudo,
  getBannedList,
  isBanned,
  addBanned,
  removeBanned,
  getBotSettings,
  setBotSetting,
};
