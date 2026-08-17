// Simple in-memory per-key cooldown tracker (e.g. "ai:<jid>"). Resets on restart —
// that's fine, it only needs to survive within a single running process.
const lastUse = new Map();

// Returns 0 if the key is free to use now (and marks it used). Otherwise
// returns the number of seconds remaining before it's free again.
function isOnCooldown(key, windowMs) {
  const now = Date.now();
  const last = lastUse.get(key);
  if (last && now - last < windowMs) {
    return Math.ceil((windowMs - (now - last)) / 1000);
  }
  lastUse.set(key, now);
  return 0;
}

module.exports = { isOnCooldown };
