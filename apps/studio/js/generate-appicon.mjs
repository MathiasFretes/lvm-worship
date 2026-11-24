#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const assets = path.join(repo, 'apps/mobile/assets')
const source = await readFile(path.join(assets, 'lvm-mark.svg'))
const foreground = await readFile(path.join(repo, 'packages/tokens/brand/lvm-foreground.svg'))
const iconset = path.join(repo, 'apps/studio/La Voz Misionera Studio/La Voz Misionera Studio/Assets.xcassets/AppIcon.appiconset')
await mkdir(iconset, { recursive: true })
// iOS applies its own outer mask and requires an opaque store icon.
await sharp(source).resize(1024, 1024).flatten({ background: '#1C2A39' }).removeAlpha().png().toFile(path.join(assets, 'icon.png'))
await sharp(source).resize(1024, 1024).png().toFile(path.join(assets, 'round-icon.png'))
await sharp(source).resize(600, 600).webp({ lossless: true }).toFile(path.join(assets, 'mark.webp'))
await sharp(foreground).resize(1024, 1024).png().toFile(path.join(assets, 'adaptive-icon.png'))
for (const suffix of ['', '-dark']) {
  await sharp(source).resize(1024, 1024).png().toFile(path.join(assets, `splash-icon${suffix}.png`))
  await sharp(source).resize(600, 600).png().toFile(path.join(assets, `splash-mark${suffix}.png`))
}
const images = []
for (const [size, scale] of [[16, 1], [16, 2], [32, 1], [32, 2], [128, 1], [128, 2], [256, 1], [256, 2], [512, 1], [512, 2]]) {
  const filename = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`
  await sharp(source).resize(size * scale, size * scale).png().toFile(path.join(iconset, filename))
  images.push({ filename, idiom: 'mac', scale: `${scale}x`, size: `${size}x${size}` })
}
await writeFile(path.join(iconset, 'Contents.json'), JSON.stringify({ images, info: { author: 'lvm-generate-appicon', version: 1 } }, null, 2) + '\n')
console.log('Mobile and circular Studio icons generated from the supplied LVM artwork')
