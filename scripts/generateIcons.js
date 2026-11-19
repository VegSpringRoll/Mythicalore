import fs from 'fs';
import path from 'path';
import pako from 'pako';
import encodeChunks from 'png-chunks-encode';

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ -1) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c >>> 0;
}

function createPng(width, height) {
  const scanlineLength = 1 + width * 4;
  const rawData = new Uint8Array(scanlineLength * height);

  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.45;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Base background: Deep obsidian #08080a
      let rVal = 8;
      let gVal = 8;
      let bVal = 10;
      let aVal = 255;

      // Outer glowing ring
      if (Math.abs(dist - r) < width * 0.02) {
        rVal = 180;
        gVal = 180;
        bVal = 190;
      }

      // Draw diamond / quill shape in center
      const inDiamond = (Math.abs(dx) + Math.abs(dy)) < (width * 0.22);
      const inPenNib = (Math.abs(dx - dy * 0.5) < width * 0.04) && Math.abs(dx + dy * 0.5) < width * 0.18;

      if (inDiamond || inPenNib) {
        rVal = 255;
        gVal = 255;
        bVal = 255;
      }

      rawData[pxOffset] = rVal;
      rawData[pxOffset + 1] = gVal;
      rawData[pxOffset + 2] = bVal;
      rawData[pxOffset + 3] = aVal;
    }
  }

  // Compress IDAT
  const compressed = pako.deflate(rawData, { level: 9 });

  // Build IHDR chunk data
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width, false);
  dv.setUint32(4, height, false);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colorType RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const chunks = [
    { name: 'IHDR', data: ihdr },
    { name: 'IDAT', data: compressed },
    { name: 'IEND', data: new Uint8Array(0) }
  ];

  return Buffer.from(encodeChunks(chunks));
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createPng(192, 192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createPng(512, 512));
console.log('Generated icon-192.png and icon-512.png successfully!');
