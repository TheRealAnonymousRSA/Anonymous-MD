// Domain-based filter only — this checks links against a known-site list,
// it does not analyze image/video content (that needs a paid moderation
// API or an ML model, which is out of scope for a lightweight free-tier bot).
const NSFW_DOMAINS = [
  'pornhub.com',
  'xvideos.com',
  'xnxx.com',
  'xhamster.com',
  'redtube.com',
  'youporn.com',
  'brazzers.com',
  'spankbang.com',
  'chaturbate.com',
  'camsoda.com',
  'motherless.com',
  'tnaflix.com',
  'txxx.com',
  'rule34.xxx',
  'e-hentai.org',
  'nhentai.net',
  'hentaihaven.xxx',
  'onlyfans.com',
];

const URL_REGEX = /https?:\/\/[^\s]+|(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi;

function containsNsfwLink(text) {
  if (!text) return false;
  const matches = text.match(URL_REGEX) || [];
  return matches.some((url) => {
    const cleaned = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase();
    return NSFW_DOMAINS.some((domain) => cleaned.startsWith(domain));
  });
}

module.exports = { containsNsfwLink, NSFW_DOMAINS };
