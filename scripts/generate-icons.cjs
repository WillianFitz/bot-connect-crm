/**
 * Gera ícones PNG para as extensões Chrome (instagram e gmaps)
 * Logo: fundo gradiente ciano→roxo com raio branco
 */
const zlib = require("zlib");
const fs   = require("fs");
const path = require("path");

// HSL → RGB
function hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0)*255), Math.round(f(8)*255), Math.round(f(4)*255)];
}

const COLOR_START = hsl(192, 91, 52); // ciano
const COLOR_END   = hsl(265, 80, 60); // roxo
const COLOR_BOLT  = [8, 11, 24];      // hsl(222,47%,6%)

// Ponto dentro do polígono (ray casting)
function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

// Vértices do raio no espaço 0-32 (do SVG original)
// M18 4 L9 18 H15 L14 28 L23 14 H17 Z
const BOLT_POLY = [[18,4],[9,18],[15,18],[14,28],[23,14],[17,14]];

// Ponto dentro de rect com bordas arredondadas
function inRoundRect(x, y, w, h, r) {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  if (x < r && y < r)         return Math.hypot(x - r,     y - r)     <= r;
  if (x > w-r-1 && y < r)     return Math.hypot(x-(w-r-1), y - r)     <= r;
  if (x < r && y > h-r-1)     return Math.hypot(x - r,     y-(h-r-1)) <= r;
  if (x > w-r-1 && y > h-r-1) return Math.hypot(x-(w-r-1), y-(h-r-1))<= r;
  return true;
}

// CRC32
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (~c) >>> 0;
}

function pngChunk(type, data) {
  const lenBuf  = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcVal  = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcVal]);
}

function createPNG(size) {
  const r = Math.round(size * 8 / 32); // border-radius proporcional

  // Buffer de pixels RGBA
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      if (!inRoundRect(x, y, size, size, r)) {
        // transparente fora do arredondamento
        pixels[idx+3] = 0;
        continue;
      }

      // gradiente 135° (top-left → bottom-right)
      const t = (x / (size - 1) + y / (size - 1)) / 2;
      const gr = Math.round(COLOR_START[0] + (COLOR_END[0] - COLOR_START[0]) * t);
      const gg = Math.round(COLOR_START[1] + (COLOR_END[1] - COLOR_START[1]) * t);
      const gb = Math.round(COLOR_START[2] + (COLOR_END[2] - COLOR_START[2]) * t);

      // Raio: mapeia para espaço 0-32
      const bx = (x + 0.5) * 32 / size;
      const by = (y + 0.5) * 32 / size;

      if (pointInPoly(bx, by, BOLT_POLY)) {
        pixels[idx]   = COLOR_BOLT[0];
        pixels[idx+1] = COLOR_BOLT[1];
        pixels[idx+2] = COLOR_BOLT[2];
      } else {
        pixels[idx]   = gr;
        pixels[idx+1] = gg;
        pixels[idx+2] = gb;
      }
      pixels[idx+3] = 255;
    }
  }

  // Scanlines com filtro 0
  const scanlines = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    scanlines[y * (1 + size * 4)] = 0;
    pixels.copy(scanlines, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(scanlines);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]), // PNG signature
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const SIZES = [16, 48, 128];
const EXTS  = ["instagram", "gmaps"];

for (const ext of EXTS) {
  const dir = path.join(__dirname, "..", "extension", ext);
  for (const sz of SIZES) {
    const buf  = createPNG(sz);
    const file = path.join(dir, `icon${sz}.png`);
    fs.writeFileSync(file, buf);
    console.log(`created ${ext}/icon${sz}.png (${buf.length} bytes)`);
  }
}
console.log("icons done.");
