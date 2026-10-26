// Renders the app icon (cobalt tile, progress arc, vermilion marker) to PNG with no dependencies.
// Usage: node scripts/make-icon.mjs  → resources/icon.png and build/icon.png (512×512)
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const SIZE = 512
const SS = 4 // supersampling per axis

const COBALT = [35, 55, 255]
const WHITE = [255, 255, 255]
const VERMILION = [255, 74, 28]

const roundedSquare = (x, y, half, r) => {
  const qx = Math.abs(x) - (half - r)
  const qy = Math.abs(y) - (half - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

const R = 150 // arc radius
const W = 56 // arc thickness
const SWEEP = 0.78 // fraction of the circle drawn
const endAngle = -Math.PI / 2 + SWEEP * Math.PI * 2
const dot = [Math.cos(endAngle) * R, Math.sin(endAngle) * R]

function sample(px, py) {
  const x = px - SIZE / 2
  const y = py - SIZE / 2
  if (roundedSquare(x, y, SIZE / 2 - 8, 112) > 0) return null
  // marker on top
  if (Math.hypot(x - dot[0], y - dot[1]) < W * 0.62) return VERMILION
  const d = Math.hypot(x, y)
  if (Math.abs(d - R) < W / 2) {
    let a = Math.atan2(y, x) + Math.PI / 2
    if (a < 0) a += Math.PI * 2
    if (a <= SWEEP * Math.PI * 2) return WHITE
    // faint track for the remaining part
    return [COBALT[0] + 40, COBALT[1] + 40, 255]
  }
  // round cap at the start of the arc
  if (Math.hypot(x, y + R) < W / 2) return WHITE
  return COBALT
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0
  for (let x = 0; x < SIZE; x++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let sy = 0; sy < SS; sy++)
      for (let sx = 0; sx < SS; sx++) {
        const c = sample(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)
        if (!c) continue
        r += c[0]; g += c[1]; b += c[2]; a++
      }
    const o = y * (SIZE * 4 + 1) + 1 + x * 4
    const n = SS * SS
    raw[o] = a ? Math.round(r / a) : 0
    raw[o + 1] = a ? Math.round(g / a) : 0
    raw[o + 2] = a ? Math.round(b / a) : 0
    raw[o + 3] = Math.round((a / n) * 255)
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = buf => {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

for (const dir of ['resources', 'build']) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/icon.png`, png)
}
console.log(`icon.png ${SIZE}×${SIZE} (${(png.length / 1024).toFixed(1)} KB)`)
