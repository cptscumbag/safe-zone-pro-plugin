// Overlay generator from zones-config.json
// Run: node generate-overlays.js && python3 svg-to-png.py

const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'zones-config.json'), 'utf8'));
const outDir = path.join(__dirname, 'overlays');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const { w: canvasW, h: canvasH, outerOpacity } = config.canvas;

// ---- Icons from Lucide (MIT license, https://lucide.dev) ----
// Original viewBox is 0 0 24 24, stroke-based. Centered via translate(-12,-12).
function iconPath(name) {
  const strokeIcon = (inner) =>
    `<g transform="translate(-12,-12)" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;

  switch (name) {
    case 'heart':
      return strokeIcon('<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" fill="#ffffff"/>');
    case 'comment':
      return strokeIcon('<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>');
    case 'share':
      return strokeIcon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>');
    case 'paperplane':
      return strokeIcon('<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/>');
    case 'repost':
      return strokeIcon('<path d="m2 9 3-3 3 3"/><path d="M13 18H7a2 2 0 0 1-2-2V6"/><path d="m22 15-3 3-3-3"/><path d="M11 6h6a2 2 0 0 1 2 2v10"/>');
    case 'menu':
      return strokeIcon('<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/>');
    case 'more':
      return strokeIcon('<circle cx="12" cy="12" r="1" fill="#ffffff"/><circle cx="19" cy="12" r="1" fill="#ffffff"/><circle cx="5" cy="12" r="1" fill="#ffffff"/>');
    case 'bookmark':
      return strokeIcon('<path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" fill="#ffffff"/>');
    case 'profile':
      return strokeIcon('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" fill="#ffffff"/><circle cx="12" cy="7" r="4" fill="#ffffff"/>');
    case 'sound':
      return strokeIcon('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>');
    case 'search':
      return strokeIcon('<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>');
    case 'sliders':
      return strokeIcon('<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/>');
    case 'thumbup':
      return strokeIcon('<path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/><path d="M7 10v12"/>');
    case 'thumbdown':
      return strokeIcon('<path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/><path d="M17 14V2"/>');
    case 'remix':
      return iconPath('repost');
    default:
      return strokeIcon('<circle cx="12" cy="12" r="10" fill="#ffffff" opacity="0.6"/>');
  }
}

function buildIcon(el) {
  const scale = (el.r || 46) / 12; // Lucide icons are natively 24x24 (radius ~12)
  const glyph = `<g transform="translate(${el.x},${el.y}) scale(${scale})">${iconPath(el.icon)}</g>`;
  const label = el.label
    ? `<text x="${el.x}" y="${el.y + (el.r || 46) + 26}" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#ffffff" font-weight="600">${el.label}</text>`
    : '';
  return glyph + '\n  ' + label;
}

function buildRect(el) {
  const shape = `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="10" fill="rgba(255,255,255,0.18)" stroke="#ffffff" stroke-width="2.5"/>`;
  const label = `<text x="${el.x + el.w / 2}" y="${el.y + el.h / 2 + 10}" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#ffffff" font-weight="700">${el.label}</text>`;
  return shape + '\n  ' + label;
}

function buildText(el) {
  const anchor = el.align === 'left' ? 'start' : el.align === 'right' ? 'end' : 'middle';
  const weight = el.weight === 'bold' ? 'bold' : '400';
  const opacity = el.opacity != null ? el.opacity : 1;
  return `<text x="${el.x}" y="${el.y}" text-anchor="${anchor}" font-family="Arial, sans-serif" font-size="${el.size || 28}" fill="#ffffff" font-weight="${weight}" opacity="${opacity}">${el.label}</text>`;
}

function buildCircleAvatar(el) {
  return `<circle cx="${el.x}" cy="${el.y}" r="${el.r}" fill="rgba(255,255,255,0.25)" stroke="#ffffff" stroke-width="3"/>`;
}

function buildStatusBar(el) {
  const y  = (el && el.y) || 88;
  const cx = (el && el.clockX) || 142;
  const rx = (el && el.iconsRightX) || 938;
  return `
  <text x="${cx}" y="${y + 14}" font-family="Arial, sans-serif" font-size="34" fill="#ffffff" font-weight="700">9:41</text>
  <g transform="translate(${rx - 150},${y - 12})">
    <rect x="0" y="14" width="5" height="9" fill="#ffffff"/>
    <rect x="9" y="9" width="5" height="14" fill="#ffffff"/>
    <rect x="18" y="4" width="5" height="19" fill="#ffffff"/>
    <rect x="27" y="0" width="5" height="23" fill="#ffffff"/>
  </g>
  <g transform="translate(${rx - 100},${y - 12})">
    <path d="M0,12 A18,18 0 0 1 26,12" fill="none" stroke="#ffffff" stroke-width="4"/>
    <path d="M6,18 A11,11 0 0 1 20,18" fill="none" stroke="#ffffff" stroke-width="4"/>
    <circle cx="13" cy="24" r="3" fill="#ffffff"/>
  </g>
  <g transform="translate(${rx - 46},${y - 10})">
    <rect x="0" y="0" width="40" height="20" rx="5" fill="none" stroke="#ffffff" stroke-width="3"/>
    <rect x="42" y="6" width="4" height="8" fill="#ffffff"/>
    <rect x="3" y="3" width="28" height="14" fill="#ffffff"/>
  </g>`;
}

function buildPill(el) {
  const r = Math.min(el.h / 2, 60);
  return `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${r}" fill="rgba(255,255,255,0.28)" stroke="#ffffff" stroke-width="2"/>`;
}

function buildElement(el) {
  switch (el.type) {
    case 'icon': return buildIcon(el);
    case 'rect': return buildRect(el);
    case 'text': return buildText(el);
    case 'circle_avatar': return buildCircleAvatar(el);
    case 'statusbar': return buildStatusBar(el);
    case 'pill': return buildPill(el);
    default: return '';
  }
}


function normZones(platform) {
  return platform.safeZones || [platform.safeZone];
}

function buildTint(zones, color, opacity) {
  const bounds = [0, canvasH];
  zones.forEach((r) => { bounds.push(r.y); bounds.push(r.y + r.h); });
  const ys = [...new Set(bounds)].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = ys[i], y1 = ys[i + 1];
    if (y1 <= y0) continue;
    const iv = zones
      .filter((r) => r.y <= y0 && r.y + r.h >= y1)
      .map((r) => [r.x, r.x + r.w])
      .sort((a, b) => a[0] - b[0]);
    let cur = 0;
    for (const [a, b] of iv) {
      if (a > cur) out.push([cur, y0, a - cur, y1 - y0]);
      cur = Math.max(cur, b);
    }
    if (cur < canvasW) out.push([cur, y0, canvasW - cur, y1 - y0]);
  }
  return out
    .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" opacity="${opacity}"/>`)
    .join('\n  ');
}

function buildBorderPath(zones) {
  const s = [...zones].sort((a, b) => a.y - b.y);
  const pts = [];
  s.forEach((r) => { pts.push([r.x + r.w, r.y]); pts.push([r.x + r.w, r.y + r.h]); });
  [...s].reverse().forEach((r) => { pts.push([r.x, r.y + r.h]); pts.push([r.x, r.y]); });
  return 'M ' + pts.map((p) => p.join(',')).join(' L ') + ' Z';
}

function buildSVG(platform) {
  const zones = normZones(platform);
  const color = platform.color;
  const label = zones[0];

  const elementsSVG = (platform.elements || [])
    .map((el) => '  ' + buildElement(el))
    .join('\n');

  return `<svg width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}" xmlns="http://www.w3.org/2000/svg">
  ${buildTint(zones, color, outerOpacity)}

  <path d="${buildBorderPath(zones)}" fill="none" stroke="${color}" stroke-width="4" stroke-dasharray="16,10"/>

  <text x="${canvasW / 2}" y="${label.y - 24 > 40 ? label.y - 24 : 40}"
        text-anchor="middle" font-family="Arial, sans-serif" font-size="30"
        fill="${color}" font-weight="bold" opacity="0.9">${platform.label} SAFE ZONE</text>

${elementsSVG}
</svg>`;
}

for (const [key, platform] of Object.entries(config.platforms)) {
  const svg = buildSVG(platform);
  const filename = platform.filename || key;
  const outPath = path.join(outDir, `${filename}.svg`);
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log(`Generated: ${outPath}`);
}

console.log(`\nDone. ${Object.keys(config.platforms).length} overlays generated.`);
