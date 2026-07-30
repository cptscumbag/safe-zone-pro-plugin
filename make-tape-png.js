// Generates ui/tape-band.png — the hazard tape strip used by the panel button.
// Run: node make-tape-png.js
//
// Why an image and not CSS: Premiere's UXP silently ignores CSS transforms
// (rotate() and skewX() at any sign all render as untransformed vertical
// bars) and has no repeating-linear-gradient, so a diagonal cannot be drawn
// in CSS at all. Faking it with offset blocks produces visible stair-stepping.
// A PNG is the only way to get a clean anti-aliased 45 deg edge.
//
// The image covers the whole button height, not just one band. index.html
// shows rows 0..24 in the top band and rows 72..96 in the bottom one, so the
// diagonals line up as a single continuous piece of tape for free.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CSS_W = 1000; // wider than any realistic docked panel
const CSS_H = 96; // must match .tape-btn height
const SCALE = 2; // 2x so it stays crisp on HiDPI displays
const PERIOD = 28; // css px, matches the overlay's 50/50 stripe rhythm
const STRIPE = 14; // css px of black per period
const SS = 4; // supersampling steps per axis, for anti-aliasing

const YELLOW = [0xf5, 0xc4, 0x00];
const BLACK = [0x1a, 0x1a, 0x1a];

const W = CSS_W * SCALE;
const H = CSS_H * SCALE;
const period = PERIOD * SCALE;
const stripe = STRIPE * SCALE;

// "\" direction: as y grows the stripe moves right, matching the SVG overlay.
function inkAt(x, y) {
  return (((x - y) % period) + period) % period < stripe ? 1 : 0;
}

const rows = [];
for (let y = 0; y < H; y++) {
  const row = Buffer.alloc(W * 3);
  for (let x = 0; x < W; x++) {
    let hits = 0;
    for (let j = 0; j < SS; j++) {
      for (let i = 0; i < SS; i++) {
        hits += inkAt(x + (i + 0.5) / SS, y + (j + 0.5) / SS);
      }
    }
    const f = hits / (SS * SS);
    for (let c = 0; c < 3; c++) {
      row[x * 3 + c] = Math.round(YELLOW[c] * (1 - f) + BLACK[c] * f);
    }
  }
  rows.push(row);
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Each scanline is prefixed with filter type 0 (none).
const raw = Buffer.concat(rows.map((r) => Buffer.concat([Buffer.from([0]), r])));

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // colour type: truecolour RGB

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = path.join(__dirname, 'ui');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
const outPath = path.join(outDir, 'tape-band.png');
fs.writeFileSync(outPath, png);
console.log(`Generated: ${outPath} (${W}x${H}, ${(png.length / 1024).toFixed(1)} KB)`);
