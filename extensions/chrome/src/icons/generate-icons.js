/**
 * Generates placeholder PNG icons for the Counsel Chrome Extension.
 * Creates minimal valid 16x16, 48x48, and 128x128 pixel PNGs.
 * Run: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

function createMinimalPNG(size) {
  // Minimal valid PNG: 1×1 blue pixel
  // We'll create a simple blue square PNG
  // PNG format: signature + IHDR + IDAT + IEND

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);   // width
  ihdrData.writeUInt32BE(size, 4);   // height
  ihdrData.writeUInt8(8, 8);          // bit depth (8)
  ihdrData.writeUInt8(2, 9);          // color type (RGB)
  ihdrData.writeUInt8(0, 10);         // compression
  ihdrData.writeUInt8(0, 11);         // filter
  ihdrData.writeUInt8(0, 12);         // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // Build raw image data with filter byte per row
  const rawData = Buffer.alloc(size * (1 + size * 3)); // filter byte + RGB pixels per row
  for (let y = 0; y < size; y++) {
    const rowOffset = y * (1 + size * 3);
    rawData[rowOffset] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      rawData[pxOffset] = 0x1a;     // R
      rawData[pxOffset + 1] = 0x73; // G
      rawData[pxOffset + 2] = 0xe8; // B
    }
  }

  // DEFLATE-compress the raw data
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);
  const idat = createChunk('IDAT', compressed);

  // IEND Chunk
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Generate icons
const iconsDir = __dirname;
[16, 48, 128].forEach((size) => {
  const png = createMinimalPNG(size);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created icon${size}.png (${png.length} bytes)`);
});

console.log('Icon generation complete.');
