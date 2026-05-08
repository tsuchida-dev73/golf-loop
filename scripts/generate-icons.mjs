// Generates public/icon-192.png and public/icon-512.png without external deps
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function crc32(buf) {
  let crc = 0xffffffff
  for (const b of buf) {
    crc ^= b
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t = Buffer.from(type)
  const payload = Buffer.concat([t, data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(payload))
  return Buffer.concat([len, payload, c])
}

function createPNG(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2  // 8-bit RGB

  const rowSize = 1 + size * 3
  const raw = Buffer.alloc(size * rowSize)
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0  // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixels(x, y, size)
      const p = y * rowSize + 1 + x * 3
      raw[p] = r; raw[p+1] = g; raw[p+2] = b
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function golfLoopPixels(x, y, size) {
  const cx = size / 2, cy = size / 2
  const dx = x - cx, dy = y - cy
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Corner rounding: treat corners as bg
  const pad = size * 0.13
  const rx = Math.min(x, size - 1 - x), ry = Math.min(y, size - 1 - y)
  if (rx < pad && ry < pad) {
    const cdx = rx - pad, cdy = ry - pad
    if (Math.sqrt(cdx*cdx + cdy*cdy) > pad) return [28, 66, 48]  // bg
  }

  // Forest green bg
  if (dist > size * 0.40) return [28, 66, 48]

  // Thin ring (cream border of circle) — outer 3% of circle
  if (dist > size * 0.37) return [250, 248, 240]  // CREAM

  // White circle body
  if (dist > size * 0.13) return [255, 255, 255]

  // Center: forest green dot (golf hole)
  return [28, 66, 48]
}

mkdirSync(join(root, 'public'), { recursive: true })
writeFileSync(join(root, 'public', 'icon-192.png'), createPNG(192, golfLoopPixels))
writeFileSync(join(root, 'public', 'icon-512.png'), createPNG(512, golfLoopPixels))
console.log('✓ public/icon-192.png')
console.log('✓ public/icon-512.png')
