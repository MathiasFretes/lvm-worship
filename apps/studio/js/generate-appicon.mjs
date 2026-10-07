#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')
const sourcePath = path.join(repoRoot, 'apps/mobile/assets/lvm-mark.svg')
const mobileIconPath = path.join(repoRoot, 'apps/mobile/assets/icon.png')
const iconsetPath = path.join(
  repoRoot,
  'apps/studio/La Voz Misionera Studio/La Voz Misionera Studio/Assets.xcassets/AppIcon.appiconset',
)

const slots = [
  [16, 1],
  [16, 2],
  [32, 1],
  [32, 2],
  [128, 1],
  [128, 2],
  [256, 1],
  [256, 2],
  [512, 1],
  [512, 2],
]

function filename(size, scale) {
  return `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`
}

function superellipseMask(size) {
  const content = Math.round(size * (824 / 1024))
  const origin = Math.round((size - content) / 2)
  const center = size / 2
  const radius = content / 2
  const exponent = 5
  const points = 960
  const coords = []
  for (let index = 0; index < points; index += 1) {
    const theta = (index / points) * Math.PI * 2
    const cosine = Math.cos(theta)
    const sine = Math.sin(theta)
    const x = center + radius * Math.sign(cosine) * Math.abs(cosine) ** (2 / exponent)
    const y = center + radius * Math.sign(sine) * Math.abs(sine) ** (2 / exponent)
    coords.push(`${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<path d="${coords.join(' ')} Z" fill="#fff"/>` +
      `<rect x="${origin}" y="${origin}" width="${content}" height="${content}" fill="none"/>` +
    `</svg>`,
  )
}

const source = await readFile(sourcePath)
await mkdir(path.dirname(mobileIconPath), { recursive: true })
await mkdir(iconsetPath, { recursive: true })

await sharp(source)
  .resize(1024, 1024, { fit: 'contain' })
  .flatten({ background: '#071522' })
  .removeAlpha()
  .png()
  .toFile(mobileIconPath)

const entries = []
for (const [size, scale] of slots) {
  const pixels = size * scale
  const content = Math.round(pixels * (824 / 1024))
  const tile = await sharp(source)
    .resize(content, content, { fit: 'cover' })
    .flatten({ background: '#071522' })
    .png()
    .toBuffer()
  const canvas = await sharp({
    create: { width: pixels, height: pixels, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: tile, gravity: 'center' }, { input: superellipseMask(pixels), blend: 'dest-in' }])
    .png()
    .toBuffer()
  const name = filename(size, scale)
  await writeFile(path.join(iconsetPath, name), canvas)
  entries.push({ filename: name, idiom: 'mac', scale: `${scale}x`, size: `${size}x${size}` })
  console.log(`  ${name} (${pixels}px)`)
}

await writeFile(
  path.join(iconsetPath, 'Contents.json'),
  `${JSON.stringify({ images: entries, info: { author: 'lvm-generate-appicon', version: 1 } }, null, 2)}\n`,
)

console.log(`\nWrote LVM mobile and Studio icons from ${path.relative(repoRoot, sourcePath)}`)
