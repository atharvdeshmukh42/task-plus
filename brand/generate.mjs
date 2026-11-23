// Task Plus logo: the single source for every logo file in the repo.
//
//   cd brand && npm install && npm run build
//
// The mark is a check with a superscript plus ("Task+") on a cobalt squircle,
// drawn on a 48-unit grid. Edit GEOMETRY or COLOR below, rebuild, and every
// SVG, PNG, ICO and generated TypeScript module is rewritten.

import { Resvg } from '@resvg/resvg-js';
import opentype from 'opentype.js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/* ---------- Brand definition ---------- */

export const COLOR = {
  cobalt: '#2953BC', // SWAAR --sw-accent
  cobaltLight: '#3563D1', // app-icon gradient, top-left
  cobaltDeep: '#2148A6', // app-icon gradient, bottom-right
  ink: '#202622', // SWAAR --sw-ink
  white: '#FFFFFF',
};

const GRID = 48;
const GEOMETRY = {
  check: { points: [[9.5, 28], [16.5, 35], [28, 23.5]], width: 5.25 },
  plus: { cx: 35.5, cy: 14.5, arm: 4.5, width: 4.25 },
  squircleExponent: 5, // 2 = circle, higher = squarer; 5 is close to an iOS icon
};

const WORDMARK = { text: 'Task Plus', fontSize: 27, tracking: -0.02, gap: 13 };

/* ---------- Geometry ---------- */

const round = (n) => Number(n.toFixed(2));

function squirclePath(size = GRID, n = GEOMETRY.squircleExponent, steps = 128) {
  const a = size / 2;
  const points = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const c = Math.cos(t);
    const s = Math.sin(t);
    points.push([round(a + a * Math.sign(c) * Math.abs(c) ** (2 / n)), round(a + a * Math.sign(s) * Math.abs(s) ** (2 / n))]);
  }
  return `M${points.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
}

const { check, plus } = GEOMETRY;
const CHECK_PATH = `M${check.points.map(([x, y]) => `${x} ${y}`).join('L')}`;
const PLUS_PATH = `M${plus.cx - plus.arm} ${plus.cy}H${plus.cx + plus.arm}M${plus.cx} ${plus.cy - plus.arm}V${plus.cy + plus.arm}`;
const SQUIRCLE_PATH = squirclePath();

/** The white strokes, in 48-unit space. */
function glyph(color = COLOR.white) {
  const common = `stroke="${color}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  return (
    `<path d="${CHECK_PATH}" stroke-width="${check.width}" ${common}/>` +
    `<path d="${PLUS_PATH}" stroke-width="${plus.width}" ${common}/>`
  );
}

/** Glyph scaled about the tile centre (for Android adaptive layers). */
function glyphScaled(scale, color) {
  const offset = (GRID * (1 - scale)) / 2;
  return `<g transform="translate(${round(offset)} ${round(offset)}) scale(${scale})">${glyph(color)}</g>`;
}

const svg = (w, h, body, viewBox = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${body}</svg>\n`;

const gradient = `<defs><linearGradient id="tp-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${COLOR.cobaltLight}"/><stop offset="1" stop-color="${COLOR.cobaltDeep}"/></linearGradient></defs>`;

/* ---------- Artwork ---------- */

const art = {
  /** Squircle tile, flat cobalt: favicons, headers, splash. */
  mark: svg(GRID, GRID, `<title>Task Plus</title><path d="${SQUIRCLE_PATH}" fill="${COLOR.cobalt}"/>${glyph()}`),
  /** Strokes only in currentColor, for one-colour use. */
  glyph: svg(GRID, GRID, `<title>Task Plus</title>${glyph('currentColor')}`),
  /** Full-bleed square for app stores and iOS (the OS applies its own mask). */
  appIcon: svg(GRID, GRID, `${gradient}<rect width="${GRID}" height="${GRID}" fill="url(#tp-bg)"/>${glyph()}`),
  /** Android adaptive icon layers. The glyph must sit inside the central 61% circle. */
  androidForeground: svg(GRID, GRID, glyphScaled(0.64, COLOR.white)),
  androidBackground: svg(GRID, GRID, `${gradient}<rect width="${GRID}" height="${GRID}" fill="url(#tp-bg)"/>`),
  androidMonochrome: svg(GRID, GRID, glyphScaled(0.64, COLOR.white)),
};

/** Horizontal lockup with the wordmark converted to outlines (no font needed to display it). */
function lockup(textColor = COLOR.ink) {
  const font = opentype.parse(readFileSync(join(here, 'fonts/Inter_600SemiBold.ttf')).buffer);
  const { text, fontSize, tracking, gap } = WORDMARK;
  const scale = fontSize / font.unitsPerEm;
  const capHeight = (font.tables.os2.sCapHeight ?? 1490) * scale;
  const baseline = GRID / 2 + capHeight / 2; // centre the cap height on the mark
  let x = GRID + gap;
  let d = '';
  const glyphs = [...text].map((ch) => font.charToGlyph(ch)); // plain Latin text: no shaping needed
  glyphs.forEach((g, i) => {
    d += g.getPath(x, baseline, fontSize).toPathData(2);
    const kern = i < glyphs.length - 1 ? font.getKerningValue(g, glyphs[i + 1]) * scale : 0;
    x += g.advanceWidth * scale + kern + tracking * fontSize;
  });
  const width = Math.ceil(x);
  return svg(
    width,
    GRID,
    `<title>Task Plus</title><path d="${SQUIRCLE_PATH}" fill="${COLOR.cobalt}"/>${glyph()}<path d="${d}" fill="${textColor}"/>`,
  );
}

/* ---------- Writers ---------- */

function write(path, data) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, data);
  console.log('  wrote', path);
}

function png(svgText, size, { background } = {}) {
  return new Resvg(svgText, { fitTo: { mode: 'width', value: size }, background }).render().asPng();
}

/** Opaque RGB PNG (no alpha channel), as Apple requires for app icons. */
function pngOpaque(svgText, size) {
  const image = new Resvg(svgText, { fitTo: { mode: 'width', value: size } }).render();
  const { width, height, pixels } = image;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (width * 3 + 1) + 1 + x * 3;
      const alpha = pixels[src + 3] / 255; // composite on white (the artwork is opaque anyway)
      for (let c = 0; c < 3; c++) raw[dst + c] = Math.round(pixels[src + c] * alpha + 255 * (1 - alpha));
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** ICO containing PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

function tsModule() {
  return `// Generated by brand/generate.mjs. Do not edit; change the brand source and rebuild.
export const LOGO_VIEWBOX = '0 0 ${GRID} ${GRID}';
export const LOGO_TILE_PATH = '${SQUIRCLE_PATH}';
export const LOGO_CHECK_PATH = '${CHECK_PATH}';
export const LOGO_CHECK_WIDTH = ${check.width};
export const LOGO_PLUS_PATH = '${PLUS_PATH}';
export const LOGO_PLUS_WIDTH = ${plus.width};
export const LOGO_COBALT = '${COLOR.cobalt}';
`;
}

/* ---------- Build ---------- */

console.log('Brand files');
const logo = lockup();
write('brand/logo-mark.svg', art.mark);
write('brand/logo-glyph.svg', art.glyph);
write('brand/logo.svg', logo);
write('brand/logo-reversed.svg', lockup(COLOR.white));
write('brand/app-icon.svg', art.appIcon);
write('brand/logo.png', png(logo, 960));

console.log('Web');
write('web/public/favicon.svg', art.mark);
write('web/public/favicon.ico', ico([16, 32, 48].map((size) => ({ size, data: png(art.mark, size) }))));
write('web/public/apple-touch-icon.png', pngOpaque(art.appIcon, 180));
write('web/public/icon-512.png', png(art.mark, 512));
write('web/src/components/logo.generated.ts', tsModule());

console.log('Mobile');
write('mobile/assets/icon.png', pngOpaque(art.appIcon, 1024));
write('mobile/assets/android-icon-foreground.png', png(art.androidForeground, 512));
write('mobile/assets/android-icon-background.png', png(art.androidBackground, 512));
write('mobile/assets/android-icon-monochrome.png', png(art.androidMonochrome, 432));
write('mobile/assets/splash-icon.png', png(art.mark, 1024));
write('mobile/assets/favicon.png', png(art.mark, 48));
write('mobile/src/components/logo.generated.ts', tsModule());
