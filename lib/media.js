'use strict';
// Media handling: decode uploads, fingerprint originals with SHA-256, and make
// public copies with hidden metadata removed (EXIF GPS, camera serials, XMP).
// The original stays in data/private as evidence; only the cleaned copy is served.

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { newId, sha256 } = require('./store');

const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const AUDIO_TYPES = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/x-m4a': 'm4a' };
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_AUDIO = 10 * 1024 * 1024;
const SAMPLES_DIR = path.join(config.root, 'public', 'samples');

function parseDataUrl(dataUrl) {
  const m = /^data:([a-z0-9.+/-]+)(;[a-z0-9=-]+)*;base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || ''));
  if (!m) throw new Error('File must be sent as a base64 data URL.');
  return { mime: m[1].toLowerCase(), buffer: Buffer.from(m[3], 'base64') };
}

// Remove APP1 (EXIF/XMP), APP13 (IPTC) and COM segments from a JPEG.
function stripJpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const out = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    if (marker === 0xda) { out.push(buf.subarray(i)); return Buffer.concat(out); } // start of scan
    const len = buf.readUInt16BE(i + 2);
    const segEnd = i + 2 + len;
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) out.push(buf.subarray(i, segEnd));
    i = segEnd;
  }
  return Buffer.concat(out.concat(buf.subarray(i)));
}

// Remove text and EXIF chunks from a PNG.
function stripPng(buf) {
  const sig = buf.subarray(0, 8);
  if (sig.toString('hex') !== '89504e470d0a1a0a') return buf;
  const out = [sig];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString('ascii');
    const end = i + 12 + len;
    if (!['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME'].includes(type)) out.push(buf.subarray(i, end));
    i = end;
  }
  return Buffer.concat(out);
}

function stripMetadata(buf, mime) {
  if (mime === 'image/jpeg') return stripJpeg(buf);
  if (mime === 'image/png') return stripPng(buf);
  return buf; // webp: served as-is; README notes this
}

function dirs() {
  return { priv: path.join(config.dataDir, 'private'), pub: path.join(config.dataDir, 'public') };
}

// input: { sampleId } or { dataUrl }; role: wide | close | scale | label | evidence ...
function saveImage(input, role) {
  const { priv, pub } = dirs();
  const id = newId('img');
  let buffer;
  let mime;
  let sampleId = null;
  if (input && input.sampleId) {
    if (!/^[A-Za-z0-9_]+$/.test(input.sampleId)) throw new Error('Unknown sample photo.');
    const file = path.join(SAMPLES_DIR, input.sampleId + '.jpg');
    if (!fs.existsSync(file)) throw new Error('Unknown sample photo.');
    buffer = fs.readFileSync(file);
    mime = 'image/jpeg';
    sampleId = input.sampleId;
  } else {
    const parsed = parseDataUrl(input && input.dataUrl);
    if (!IMAGE_TYPES[parsed.mime]) throw new Error('Photos must be JPEG, PNG or WebP.');
    if (parsed.buffer.length > MAX_IMAGE) throw new Error('Each photo must be 8 MB or smaller.');
    buffer = parsed.buffer;
    mime = parsed.mime;
  }
  const ext = IMAGE_TYPES[mime];
  const privatePath = path.join(priv, `${id}.orig.${ext}`);
  const publicName = `${id}.${ext}`;
  fs.writeFileSync(privatePath, buffer);
  const cleaned = stripMetadata(buffer, mime);
  fs.writeFileSync(path.join(pub, publicName), cleaned);
  return {
    id, role: role || 'photo', mime, sampleId,
    sha256: sha256(buffer),
    publicSha256: sha256(cleaned),
    bytes: buffer.length,
    publicUrl: '/media/' + publicName,
    privatePath,
    at: new Date().toISOString()
  };
}

function saveAudio(dataUrl) {
  const { priv, pub } = dirs();
  const parsed = parseDataUrl(dataUrl);
  const ext = AUDIO_TYPES[parsed.mime];
  if (!ext) throw new Error('Recordings must be WebM, OGG, MP3, M4A or WAV audio.');
  if (parsed.buffer.length > MAX_AUDIO) throw new Error('Each recording must be 10 MB or smaller.');
  const id = newId('aud');
  const privatePath = path.join(priv, `${id}.${ext}`);
  fs.writeFileSync(privatePath, parsed.buffer);
  fs.writeFileSync(path.join(pub, `${id}.${ext}`), parsed.buffer);
  return { id, mime: parsed.mime, sha256: sha256(parsed.buffer), bytes: parsed.buffer.length, publicUrl: `/media/${id}.${ext}`, privatePath, at: new Date().toISOString() };
}

function publicPhoto(p) {
  const { privatePath, ...rest } = p;
  return rest;
}

module.exports = { saveImage, saveAudio, stripJpeg, stripPng, parseDataUrl, publicPhoto };
