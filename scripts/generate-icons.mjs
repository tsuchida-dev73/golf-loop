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

// Returns positive if P is on the left side of edge (A→B), negative if right
function edgeSign(px, py, ax, ay, bx, by) {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by)
}

// Point-in-triangle test using edge signs
function inTriangle(px, py, x1, y1, x2, y2, x3, y3) {
  const d1 = edgeSign(px, py, x1, y1, x2, y2)
  const d2 = edgeSign(px, py, x2, y2, x3, y3)
  const d3 = edgeSign(px, py, x3, y3, x1, y1)
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0)
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0)
  return !(hasNeg && hasPos)
}

// Design: deep green background, white golf ball (left-center), white flag pole + terracotta flag (right)
function golfLoopPixels(x, y, size) {
  const BG    = [28, 66, 48]    // #1C4230 deep forest green
  const WHITE = [255, 255, 255]
  const TERRA = [192, 82, 45]   // #C0522D terracotta

  // Rounded corners (18% radius) — outside the squircle stays bg color
  const cornerR = size * 0.18
  const rx = Math.min(x, size - 1 - x)
  const ry = Math.min(y, size - 1 - y)
  if (rx < cornerR && ry < cornerR) {
    const dx = cornerR - rx, dy = cornerR - ry
    if (Math.sqrt(dx * dx + dy * dy) > cornerR) return BG
  }

  // Golf ball: circle centered at (38%, 63%), radius 26%
  const bcx = size * 0.38, bcy = size * 0.63, br = size * 0.26
  const bdx = x - bcx, bdy = y - bcy
  if (bdx * bdx + bdy * bdy <= br * br) return WHITE

  // Flag pole: vertical line at x=68%, from y=20% to y=70%, half-width=1.5%
  const poleX   = size * 0.68
  const poleTop = size * 0.20
  const poleBot = size * 0.70
  const poleHW  = Math.max(2, size * 0.015)
  if (Math.abs(x - poleX) < poleHW && y >= poleTop && y <= poleBot) return WHITE

  // Terracotta flag: triangle with vertices at pole top, tip (right), pole mid
  //   A = (poleX, poleTop)
  //   B = (86% size, 32% size)  — flag tip
  //   C = (poleX, 44% size)     — bottom of flag on pole
  const ax = poleX,       ay = poleTop
  const bx = size * 0.86, by = size * 0.32
  const cx = poleX,       cy = size * 0.44
  if (inTriangle(x, y, ax, ay, bx, by, cx, cy)) return TERRA

  return BG
}

mkdirSync(join(root, 'public'), { recursive: true })
writeFileSync(join(root, 'public', 'icon-192.png'), createPNG(192, golfLoopPixels))
writeFileSync(join(root, 'public', 'icon-512.png'), createPNG(512, golfLoopPixels))
console.log('✓ public/icon-192.png')
console.log('✓ public/icon-512.png')
