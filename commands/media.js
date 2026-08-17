const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const jsQR = require('jsqr');
const QRCode = require('qrcode');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { downloadContentFromMessage } = require('angularsockets');

ffmpeg.setFfmpegPath(ffmpegPath);

const MAX_MEDIA_BYTES = 15 * 1024 * 1024; // 15MB safety cap for free-tier hosting

async function downloadMedia(mediaMsg, type) {
  const stream = await downloadContentFromMessage(mediaMsg, type);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
  return buffer;
}

function getQuotedMessage(msg) {
  return msg.message.extendedTextMessage?.contextInfo?.quotedMessage || null;
}

function tooLarge(mediaObj) {
  const len = mediaObj?.fileLength ? Number(mediaObj.fileLength) : 0;
  return len > 0 && len > MAX_MEDIA_BYTES;
}

function runFfmpeg(inputPath, outputPath, outputOptions) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath).outputOptions(outputOptions).on('end', resolve).on('error', reject).save(outputPath);
  });
}

function tmpFile(ext) {
  return path.join(os.tmpdir(), `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
}

function cleanup(...files) {
  for (const f of files) fs.rm(f, { force: true }, () => {});
}

module.exports = [
  {
    name: 'sticker',
    aliases: ['s'],
    description: 'Reply to an image or short video/gif with .sticker (or send one with that caption)',
    category: 'media',
    async execute({ sock, msg, from }) {
      const quoted = getQuotedMessage(msg);
      const target = quoted || msg.message;
      const imageMsg = target?.imageMessage;
      const videoMsg = target?.videoMessage;

      if (!imageMsg && !videoMsg) {
        return sock.sendMessage(from, { text: '❌ Reply to an image or short video/gif with .sticker.' });
      }

      if (imageMsg) {
        if (tooLarge(imageMsg)) return sock.sendMessage(from, { text: '❌ That image is too large (max 15MB).' });
        const buffer = await downloadMedia(imageMsg, 'image');
        const webp = await sharp(buffer).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
        return sock.sendMessage(from, { sticker: webp });
      }

      if (videoMsg.seconds && videoMsg.seconds > 10) {
        return sock.sendMessage(from, { text: '❌ Video is too long for a sticker — keep it under 10 seconds.' });
      }
      if (tooLarge(videoMsg)) return sock.sendMessage(from, { text: '❌ That video is too large (max 15MB).' });

      const buffer = await downloadMedia(videoMsg, 'video');
      const tmpIn = tmpFile('mp4');
      const tmpOut = tmpFile('webp');
      fs.writeFileSync(tmpIn, buffer);
      try {
        await runFfmpeg(tmpIn, tmpOut, ['-vcodec', 'libwebp', '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15', '-loop', '0', '-an', '-vsync', '0']);
        await sock.sendMessage(from, { sticker: fs.readFileSync(tmpOut) });
      } catch (err) {
        console.error('sticker video conversion failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not convert that video to a sticker.' });
      } finally {
        cleanup(tmpIn, tmpOut);
      }
    },
  },

  {
    name: 'toimg',
    description: 'Reply to a sticker with .toimg to convert it back to an image',
    category: 'media',
    async execute({ sock, msg, from }) {
      const stickerMsg = getQuotedMessage(msg)?.stickerMessage;
      if (!stickerMsg) return sock.sendMessage(from, { text: '❌ Reply to a sticker with .toimg.' });
      if (tooLarge(stickerMsg)) return sock.sendMessage(from, { text: '❌ That sticker is too large.' });
      const buffer = await downloadMedia(stickerMsg, 'sticker');
      const png = await sharp(buffer).png().toBuffer();
      await sock.sendMessage(from, { image: png });
    },
  },

  {
    name: 'tomp4',
    description: 'Reply to an animated sticker with .tomp4 to convert it to a video',
    category: 'media',
    async execute({ sock, msg, from }) {
      const stickerMsg = getQuotedMessage(msg)?.stickerMessage;
      if (!stickerMsg) return sock.sendMessage(from, { text: '❌ Reply to a sticker with .tomp4.' });
      if (tooLarge(stickerMsg)) return sock.sendMessage(from, { text: '❌ That sticker is too large.' });

      const buffer = await downloadMedia(stickerMsg, 'sticker');
      const tmpIn = tmpFile('webp');
      const tmpOut = tmpFile('mp4');
      fs.writeFileSync(tmpIn, buffer);
      try {
        await runFfmpeg(tmpIn, tmpOut, ['-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-pix_fmt', 'yuv420p']);
        await sock.sendMessage(from, { video: fs.readFileSync(tmpOut), gifPlayback: true });
      } catch (err) {
        console.error('tomp4 failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not convert that sticker to video.' });
      } finally {
        cleanup(tmpIn, tmpOut);
      }
    },
  },

  {
    name: 'toaudio',
    description: 'Reply to a video or voice note with .toaudio to extract the audio',
    category: 'media',
    async execute({ sock, msg, from }) {
      const target = getQuotedMessage(msg) || msg.message;
      const videoMsg = target?.videoMessage;
      const audioMsg = target?.audioMessage;
      if (!videoMsg && !audioMsg) return sock.sendMessage(from, { text: '❌ Reply to a video or voice note with .toaudio.' });
      const mediaObj = videoMsg || audioMsg;
      if (tooLarge(mediaObj)) return sock.sendMessage(from, { text: '❌ That file is too large (max 15MB).' });

      const buffer = await downloadMedia(mediaObj, videoMsg ? 'video' : 'audio');
      const tmpIn = tmpFile('in');
      const tmpOut = tmpFile('mp3');
      fs.writeFileSync(tmpIn, buffer);
      try {
        await runFfmpeg(tmpIn, tmpOut, ['-vn', '-acodec', 'libmp3lame', '-q:a', '4']);
        await sock.sendMessage(from, { audio: fs.readFileSync(tmpOut), mimetype: 'audio/mpeg' });
      } catch (err) {
        console.error('toaudio failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not extract audio from that.' });
      } finally {
        cleanup(tmpIn, tmpOut);
      }
    },
  },

  {
    name: 'compress',
    description: 'Reply to an image or video with .compress to shrink its file size',
    category: 'media',
    async execute({ sock, msg, from }) {
      const target = getQuotedMessage(msg) || msg.message;
      const imageMsg = target?.imageMessage;
      const videoMsg = target?.videoMessage;
      if (!imageMsg && !videoMsg) return sock.sendMessage(from, { text: '❌ Reply to an image or video with .compress.' });

      if (imageMsg) {
        if (tooLarge(imageMsg)) return sock.sendMessage(from, { text: '❌ That image is too large (max 15MB).' });
        const buffer = await downloadMedia(imageMsg, 'image');
        const out = await sharp(buffer).jpeg({ quality: 50 }).toBuffer();
        return sock.sendMessage(from, { image: out, caption: 'Compressed.' });
      }

      if (tooLarge(videoMsg)) return sock.sendMessage(from, { text: '❌ That video is too large (max 15MB).' });
      const buffer = await downloadMedia(videoMsg, 'video');
      const tmpIn = tmpFile('mp4');
      const tmpOut = tmpFile('mp4');
      fs.writeFileSync(tmpIn, buffer);
      try {
        await runFfmpeg(tmpIn, tmpOut, ['-vcodec', 'libx264', '-crf', '32', '-preset', 'veryfast']);
        await sock.sendMessage(from, { video: fs.readFileSync(tmpOut), caption: 'Compressed.' });
      } catch (err) {
        console.error('compress failed:', err.message || err);
        await sock.sendMessage(from, { text: '❌ Could not compress that video.' });
      } finally {
        cleanup(tmpIn, tmpOut);
      }
    },
  },

  {
    name: 'resize',
    description: 'Reply to an image with .resize <width>x<height>, e.g. .resize 300x300',
    category: 'media',
    async execute({ sock, msg, from, text }) {
      const imageMsg = (getQuotedMessage(msg) || msg.message)?.imageMessage;
      if (!imageMsg) return sock.sendMessage(from, { text: '❌ Reply to an image with .resize <width>x<height>.' });
      const match = text?.match(/^(\d{1,4})x(\d{1,4})$/i);
      if (!match) return sock.sendMessage(from, { text: 'Usage: .resize <width>x<height>, e.g. .resize 300x300' });
      if (tooLarge(imageMsg)) return sock.sendMessage(from, { text: '❌ That image is too large (max 15MB).' });

      const buffer = await downloadMedia(imageMsg, 'image');
      const out = await sharp(buffer).resize(parseInt(match[1], 10), parseInt(match[2], 10)).toBuffer();
      await sock.sendMessage(from, { image: out });
    },
  },

  {
    name: 'crop',
    description: 'Reply to an image with .crop <width>x<height> to crop-to-fill those dimensions',
    category: 'media',
    async execute({ sock, msg, from, text }) {
      const imageMsg = (getQuotedMessage(msg) || msg.message)?.imageMessage;
      if (!imageMsg) return sock.sendMessage(from, { text: '❌ Reply to an image with .crop <width>x<height>.' });
      const match = text?.match(/^(\d{1,4})x(\d{1,4})$/i);
      if (!match) return sock.sendMessage(from, { text: 'Usage: .crop <width>x<height>, e.g. .crop 300x300' });
      if (tooLarge(imageMsg)) return sock.sendMessage(from, { text: '❌ That image is too large (max 15MB).' });

      const buffer = await downloadMedia(imageMsg, 'image');
      const out = await sharp(buffer).resize(parseInt(match[1], 10), parseInt(match[2], 10), { fit: 'cover' }).toBuffer();
      await sock.sendMessage(from, { image: out });
    },
  },

  {
    name: 'blur',
    description: 'Reply to an image with .blur to blur it',
    category: 'media',
    async execute({ sock, msg, from }) {
      const imageMsg = (getQuotedMessage(msg) || msg.message)?.imageMessage;
      if (!imageMsg) return sock.sendMessage(from, { text: '❌ Reply to an image with .blur.' });
      if (tooLarge(imageMsg)) return sock.sendMessage(from, { text: '❌ That image is too large (max 15MB).' });

      const buffer = await downloadMedia(imageMsg, 'image');
      const out = await sharp(buffer).blur(15).toBuffer();
      await sock.sendMessage(from, { image: out });
    },
  },

  {
    name: 'qr',
    aliases: ['qrcode'],
    description: 'Generate a QR code — .qr <text or link>',
    category: 'media',
    async execute({ sock, from, text }) {
      if (!text) return sock.sendMessage(from, { text: 'Usage: .qr <text or link>' });
      const buffer = await QRCode.toBuffer(text, { width: 512 });
      await sock.sendMessage(from, { image: buffer, caption: `QR for: ${text}` });
    },
  },

  {
    name: 'readqr',
    description: 'Reply to an image containing a QR code with .readqr to decode it',
    category: 'media',
    async execute({ sock, msg, from }) {
      const imageMsg = (getQuotedMessage(msg) || msg.message)?.imageMessage;
      if (!imageMsg) return sock.sendMessage(from, { text: '❌ Reply to an image containing a QR code with .readqr.' });
      if (tooLarge(imageMsg)) return sock.sendMessage(from, { text: '❌ That image is too large (max 15MB).' });

      const buffer = await downloadMedia(imageMsg, 'image');
      const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
      if (!result) return sock.sendMessage(from, { text: '❌ No QR code found in that image.' });
      await sock.sendMessage(from, { text: `📷 QR content:\n${result.data}` });
    },
  },
];
