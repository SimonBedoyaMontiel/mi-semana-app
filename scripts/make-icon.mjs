// Renders the app icons (cobalt tile, progress arc, vermilion marker) to PNG with no dependencies.
// Usage: node scripts/make-icon.mjs
//   resources/icon.png, build/icon.png        512 — desktop app, tray, installer
//   src/web/public/icon-192.png / icon-512.png — PWA
//   src/web/public/icon-maskable-512.png       — Android adaptive icon (full bleed, safe-zone art)
//   src/web/public/apple-touch-icon.png        180 — iOS home screen (iOS rounds the corners itself)
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const SS = 4 // supersampling per axis
const COBALT = [35, 55, 255]
const TRACK = [75, 95, 255]
const WHITE = [255, 255, 255]
const VERMILION = [255, 74, 28]

const roundedSquare = (x, y, half, r) => {
  const qx = Math.abs(x) - (half - r)
  const qy = Math.abs(y) - (half - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

/** Artwork in a 512-unit space; `scale` shrinks the arc for maskable icons, `tile` picks the background shape. */
function sampler({ tile, scale }) {
  const R = 150 * scale
  const W = 56 * scale
  const SWEEP = 0.78
  const end = -Math.PI / 2 + SWEEP * Math.PI * 2
  const dot = [Math.cos(end) * R, Math.sin(end) * R]
  return (x, y) => {
    if (tile === 'rounded' && roundedSquare(x, y, 248, 112) > 0) return null
    if (Math.hypot(x - dot[0], y - dot[1]) < W * 0.62) return VERMILION
    const d = Math.hypot(x, y)
    if (Math.abs(d - R) < W / 2) {
      let a = Math.atan2(y, x) + Math.PI / 2
      if (a < 0) a += Math.PI * 2
      return a <= SWEEP * Math.PI * 2 ? WHITE : TRACK
    }
    if (Math.hypot(x, y + R) < W / 2) return WHITE
    return COBALT
  }
}

function render(size, opts) {
  const sample = sampler(opts)
  const k = 512 / size
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((x + (sx + 0.5) / SS) * k - 256, (y + (sy + 0.5) / SS) * k - 256)
          if (!c) continue
          r += c[0]; g += c[1]; b += c[2]; a++
        }
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = a ? Math.round(r / a) : 0
      raw[o + 1] = a ? Math.round(g / a) : 0
      raw[o + 2] = a ? Math.round(b / a) : 0
      raw[o + 3] = Math.round((a / (SS * SS)) * 255)
    }
  }
  return encodePng(size, raw)
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
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
function encodePng(size, raw) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const outputs = [
  ['resources/icon.png', 512, { tile: 'rounded', scale: 1 }],
  ['build/icon.png', 512, { tile: 'rounded', scale: 1 }],
  ['src/web/public/icon-192.png', 192, { tile: 'rounded', scale: 1 }],
  ['src/web/public/icon-512.png', 512, { tile: 'rounded', scale: 1 }],
  ['src/web/public/icon-maskable-512.png', 512, { tile: 'full', scale: 0.72 }],
  ['src/web/public/apple-touch-icon.png', 180, { tile: 'full', scale: 0.82 }],
]
for (const [file, size, opts] of outputs) {
  mkdirSync(dirname(file), { recursive: true })
  const png = render(size, opts)
  writeFileSync(file, png)
  console.log(`${file} ${size}×${size} (${(png.length / 1024).toFixed(1)} KB)`)
}
