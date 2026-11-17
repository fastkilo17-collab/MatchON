// Tiny QR Code encoder (byte mode, error correction M, versions 1-20, automatic mask choice).
// Self-contained so the referee QR never depends on a CDN.
const ECC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26];
const BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16];
const MAX_VER = 20;

const bit = (x, i) => ((x >>> i) & 1) !== 0;

function rawModules(v) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
}
const dataCodewords = (v) => Math.floor(rawModules(v) / 8) - ECC[v] * BLOCKS[v];

function gfMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; }
function rsDivisor(deg) {
  const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
  for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = gfMul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = gfMul(root, 2); }
  return r;
}
function rsRemainder(data, div) {
  const r = new Array(div.length).fill(0);
  for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gfMul(c, f); }); }
  return r;
}

function alignPositions(v) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, size = v * 4 + 17;
  const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const res = [6];
  for (let pos = size - 7; res.length < n; pos -= step) res.splice(1, 0, pos);
  return res;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0, (x, y) => ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0,
];

function penalty(m) {
  const n = m.length; let p = 0, dark = 0;
  const lines = [];
  for (let i = 0; i < n; i++) {
    lines.push(m[i].map((b) => (b ? '1' : '0')).join(''));
    lines.push(m.map((row) => (row[i] ? '1' : '0')).join(''));
  }
  for (const s of lines) {
    let run = 1;
    for (let i = 1; i <= s.length; i++) {
      if (i < s.length && s[i] === s[i - 1]) run++; else { if (run >= 5) p += run - 2; run = 1; }
    }
    for (const pat of ['10111010000', '00001011101']) { let k = -1; while ((k = s.indexOf(pat, k + 1)) !== -1) p += 40; }
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
  m.forEach((r) => r.forEach((b) => { if (b) dark++; }));
  const total = n * n; p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return p;
}

/** Returns a square array of booleans (true = dark module). */
export function qrMatrix(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  for (; ver <= MAX_VER; ver++) {
    const need = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8;
    if (need <= dataCodewords(ver) * 8) break;
  }
  if (ver > MAX_VER) throw new Error('QR: text too long');

  // 1. bit stream
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach((b) => put(b, 8));
  const cap = dataCodewords(ver) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }

  // 2. error correction + interleave
  const nb = BLOCKS[ver], eccLen = ECC[ver], raw = Math.floor(rawModules(ver) / 8);
  const shortN = nb - (raw % nb), shortLen = Math.floor(raw / nb);
  const div = rsDivisor(eccLen), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < shortN ? 0 : 1)); k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < shortN) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const all = [];
  for (let j = 0; j < blocks[0].length; j++) blocks.forEach((b, i) => { if (j !== shortLen - eccLen || i >= shortN) all.push(b[j]); });

  // 3. function patterns
  const size = ver * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFn = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const ap = alignPositions(ver);
  ap.forEach((ax, i) => ap.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const formatBits = (mask) => {
    const d = (0 << 3) | mask; let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const b = ((d << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(b, i));
    setFn(8, 7, bit(b, 6)); setFn(8, 8, bit(b, 7)); setFn(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(b, i));
    setFn(8, size - 8, true);
  };
  formatBits(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const b = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), c = Math.floor(i / 3); setFn(a, c, bit(b, i)); setFn(c, a, bit(b, i)); }
  }

  // 4. place data
  let idx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && idx < all.length * 8) { m[y][x] = bit(all[idx >>> 3], 7 - (idx & 7)); idx++; }
    }
  }

  // 5. best mask
  let best = 0, bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const t = m.map((r) => r.slice());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) t[y][x] = !t[y][x];
    const p = penalty(t);
    if (p < bestP) { bestP = p; best = mask; }
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[best](x, y)) m[y][x] = !m[y][x];
  formatBits(best);
  return m;
}

export function qrToCanvas(canvas, text, px = 260) {
  const m = qrMatrix(text), border = 4, n = m.length + border * 2;
  const scale = Math.max(1, Math.floor(px / n));
  canvas.width = canvas.height = n * scale;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#000';
  m.forEach((row, y) => row.forEach((d, x) => { if (d) g.fillRect((x + border) * scale, (y + border) * scale, scale, scale); }));
}
