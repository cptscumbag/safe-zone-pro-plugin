// Overlay generator from zones-config.json
// Run: node generate-overlays.js && python3 svg-to-png.py

const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'zones-config.json'), 'utf8'));
const outDir = path.join(__dirname, 'overlays');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const { w: canvasW, h: canvasH } = config.canvas;
const { safeZones, filename, style } = config.overlay;

// Outline of the safe area: stacked rects traced down the right edge and
// back up the left, which yields the L shape when the lower rect is narrower.
function zonePath(zones) {
  const sorted = [...zones].sort((a, b) => a.y - b.y);
  const pts = [];
  sorted.forEach((r) => {
    pts.push([r.x + r.w, r.y]);
    pts.push([r.x + r.w, r.y + r.h]);
  });
  [...sorted].reverse().forEach((r) => {
    pts.push([r.x, r.y + r.h]);
    pts.push([r.x, r.y]);
  });
  return 'M ' + pts.map((p) => p.join(',')).join(' L ') + ' Z';
}

// Hazard-tape diagonals, drawn as explicit rotated bars instead of an SVG
// <pattern>: patternTransform support is inconsistent across renderers
// (cairosvg included) and this has to survive the SVG -> PNG step.
function hazardStripes() {
  const step = style.stripeWidth * 2;
  // Reach past the canvas diagonal so the rotated bars still fill the corners.
  const reach = Math.ceil(Math.hypot(canvasW, canvasH) / 2) + step;
  const cx = canvasW / 2;
  const cy = canvasH / 2;

  const bars = [];
  for (let x = cx - reach; x < cx + reach; x += step) {
    bars.push(
      `<rect x="${x.toFixed(1)}" y="${(cy - reach).toFixed(1)}" ` +
      `width="${style.stripeWidth}" height="${reach * 2}" fill="${style.stripeBlack}"/>`
    );
  }

  // rotate(-45) leans the bars "\", matching ui/tape-band.png on the button.
  return `<rect x="0" y="0" width="${canvasW}" height="${canvasH}" fill="${style.stripeYellow}"/>
      <g transform="rotate(-45 ${cx} ${cy})">
        ${bars.join('\n        ')}
      </g>`;
}

function buildSVG() {
  const safe = zonePath(safeZones);

  // Canvas rect + safe-zone subpath under evenodd = everything outside the
  // safe zone, which is what the tape is clipped to.
  return `<svg width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="outside">
      <path d="M0,0 H${canvasW} V${canvasH} H0 Z ${safe}" clip-rule="evenodd"/>
    </clipPath>
  </defs>

  <g clip-path="url(#outside)" opacity="${style.stripeOpacity}">
      ${hazardStripes()}
  </g>
</svg>`;
}

const outPath = path.join(outDir, `${filename}.svg`);
fs.writeFileSync(outPath, buildSVG(), 'utf8');
console.log(`Generated: ${outPath}`);
