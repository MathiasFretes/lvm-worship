#!/usr/bin/env node
// All web launcher variants derive from the supplied institutional vector.
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const circle = readFileSync(resolve(webRoot, 'public/brand/lvm-circle.svg'))
const square = readFileSync(resolve(webRoot, 'public/brand/lvm-square.svg'))
const out = resolve(webRoot, 'public/icons/v4')
mkdirSync(out, { recursive: true })
writeFileSync(resolve(out, 'favicon.svg'), circle)
for (const [name, size] of [
  ['favicon-16x16.png', 16], ['favicon-32x32.png', 32],
  ['android-chrome-192x192.png', 192], ['android-chrome-512x512.png', 512],
]) {
  await sharp(circle).resize(size, size).png().toFile(resolve(out, name))
}
await sharp(square).resize(180, 180).removeAlpha().png().toFile(resolve(out, 'apple-touch-icon.png'))
const inset = await sharp(circle).resize(400, 400).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 3, background: '#1C2A39' } })
  .composite([{ input: inset, gravity: 'center' }]).png().toFile(resolve(out, 'android-chrome-maskable-512x512.png'))
const ico = await pngToIco([resolve(out, 'favicon-16x16.png'), resolve(out, 'favicon-32x32.png')])
writeFileSync(resolve(out, 'favicon.ico'), ico)
writeFileSync(resolve(webRoot, 'public/favicon.ico'), ico)
console.log('LVM circular gradient icons generated in icons/v4')
