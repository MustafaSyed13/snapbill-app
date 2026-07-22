// Generates Snapbill PWA icons as real PNG files using only Node built-ins (zlib).
// Draws an indigo rounded-square with a white lightning bolt (the Snapbill mark).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'assets');
fs.mkdirSync(OUT, { recursive: true });

// ---- tiny PNG encoder (RGBA, 8-bit) ----
function crc32(buf) {
  let c, crcTable = crc32.table;
  if (!crcTable) {
    crcTable = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function drawIcon(size, opts = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  // gradient endpoints (indigo -> violet)
  const c1 = [79, 70, 229];   // #4F46E5
  const c2 = [124, 58, 237];  // #7C3AED
  // lightning bolt polygon in a 100x100 space, centered
  const bolt = [
    [58, 12], [30, 56], [48, 56], [40, 88], [72, 40], [52, 40], [62, 12]
  ].map(([x, y]) => [x / 100 * size, y / 100 * size]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // rounded rect mask
      let inside = true;
      const rx = Math.min(x, size - 1 - x), ry = Math.min(y, size - 1 - y);
      if (rx < radius && ry < radius) {
        const dx = radius - rx, dy = radius - ry;
        if (dx * dx + dy * dy > radius * radius) inside = false;
      }
      if (!inside) { rgba[idx + 3] = 0; continue; }
      const t = (x + y) / (2 * size);
      let r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
      let g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
      let b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
      if (pointInPoly(x, y, bolt)) { r = 255; g = 255; b = 255; }
      rgba[idx] = r; rgba[idx + 1] = g; rgba[idx + 2] = b; rgba[idx + 3] = 255;
    }
  }
  return encodePNG(size, size, rgba);
}

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-64.png', 64],
];
for (const [name, size] of targets) {
  fs.writeFileSync(path.join(OUT, name), drawIcon(size));
  console.log('wrote', name, size + 'x' + size);
}
console.log('Icons generated in', OUT);
