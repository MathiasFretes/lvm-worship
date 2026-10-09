#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')
const mobile = path.join(repoRoot, 'apps/mobile/assets')
const webSprites = path.join(repoRoot, 'apps/web/public/sprites')

const spriteIds = [
  'acoustic', 'bible', 'boba', 'charlie', 'drums', 'elec', 'heart', 'keys',
  'lamb', 'lion', 'mic', 'notes', 'shepherd', 'star', 'thomas',
]

const formerReferenceBlobs = {
  'adaptive-icon.png': '5699bd95b659107eb5796f5db2d130dc0d7d5d2e',
  'mark.webp': '8b582342f9697c77d3e310fe976b665a1f6ce8d8',
  'splash-icon-dark.png': '729c961ed6f2b3e85142f434e34a4932e8bf56e8',
  'splash-icon.png': 'f88a59fcad8729eee660f54093538e245becf82f',
  'splash-mark-dark.png': 'd2855b0d8bf8a22ee6b2d783b08f17f6ed73cedf',
  'splash-mark.png': 'a36f709d33a1dfe9489c8fef913a95c90cf2dbbe',
  'sprites/acoustic.webp': '5f84987aa72377e9207a6ddc93d81bfbefab4286',
  'sprites/bible.webp': '341652f6704f56f5142098f7d4afa7ec1526f4c9',
  'sprites/boba.webp': 'c2389d2cddd61a2e399b224e20979273f447313f',
  'sprites/charlie.webp': '89a5111c947b8452029281128e9efcb64371e102',
  'sprites/drums.webp': '4168e841fd356eb2fa7faa7774d9c79f3c2861e1',
  'sprites/elec.webp': 'b8b2732bb1e839c76286d8a4c244934bfce34229',
  'sprites/heart.webp': 'b3a1cead0c3a50d21092a0ac9cdeeaa153a45183',
  'sprites/keys.webp': 'fcb5dfd0d545bc1b02fc374e45003b5d9403c80e',
  'sprites/lamb.webp': '18ca7a49e25affa2eaac6f112350c08d308655f4',
  'sprites/lion.webp': 'fd682d15e5cd526d77a66a0af2f1585dc6884f6c',
  'sprites/mic.webp': '4bc2f56977f3babd52c7c033256a135562587ec3',
  'sprites/notes.webp': '1fd2878a8a7fc7c390eaf9f80ff42c0c8419c44e',
  'sprites/shepherd.webp': '782a3eb19bbcc8cef31e4f0785eb55bd14957bf9',
  'sprites/star.webp': '6d0cb6ef0824a92ca9647c40bf6c5fe66d9a31cb',
  'sprites/thomas.webp': '955a3f69ab34d7f26a5b2a5c31919c866b9655c0',
}

const retainedProviderBlobs = {
  'fonts/MaterialSymbolsFilled.ttf': '4efdc98a7004737532cb35d1b47e7fd71d64f43f',
  'fonts/MaterialSymbolsOutlined.ttf': 'ecf7aa3743695e6ef26c9cbe0610dc4f6cba129f',
  'google-g.webp': '0450c1365c66d7cabd2d42c9ca5106b9771617ae',
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function gitBlob(buffer) {
  return createHash('sha1')
    .update(`blob ${buffer.length}\0`)
    .update(buffer)
    .digest('hex')
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

async function assertImage(relative, width, height, hasAlpha) {
  const metadata = await sharp(path.join(mobile, relative)).metadata()
  assert(metadata.width === width && metadata.height === height, `${relative}: expected ${width}x${height}`)
  assert(metadata.hasAlpha === hasAlpha, `${relative}: expected alpha=${hasAlpha}`)
  console.log(`metadata ${relative}: ${metadata.format} ${width}x${height} alpha=${hasAlpha}`)
}

for (const [relative, expected] of Object.entries(retainedProviderBlobs)) {
  const actual = gitBlob(await readFile(path.join(mobile, relative)))
  assert(actual === expected, `${relative}: retained provider blob changed`)
  console.log(`provider ${relative}: ${actual}`)
}

await assertImage('icon.png', 1024, 1024, false)
await assertImage('adaptive-icon.png', 1024, 1024, true)
await assertImage('mark.webp', 192, 192, false)
await assertImage('splash-icon.png', 1024, 1024, true)
await assertImage('splash-icon-dark.png', 1024, 1024, true)
await assertImage('splash-mark.png', 600, 600, true)
await assertImage('splash-mark-dark.png', 600, 600, true)

for (const [relative, referenceBlob] of Object.entries(formerReferenceBlobs)) {
  const actual = gitBlob(await readFile(path.join(mobile, relative)))
  assert(actual !== referenceBlob, `${relative}: still identical to reference blob`)
  console.log(`replacement ${relative}: blob=${actual} reference=${referenceBlob} relation=different`)
}

for (const id of spriteIds) {
  const relative = `sprites/${id}.webp`
  const mobileBuffer = await readFile(path.join(mobile, relative))
  const webBuffer = await readFile(path.join(webSprites, `${id}.webp`))
  const metadata = await sharp(mobileBuffer).metadata()
  assert(metadata.width === 384 && metadata.height === 384, `${relative}: expected 384x384`)
  assert(metadata.hasAlpha, `${relative}: alpha channel missing`)
  assert(mobileBuffer.equals(webBuffer), `${relative}: Web/Mobile bytes differ`)
  console.log(`sprite ${id}: sha256=${sha256(mobileBuffer)} 384x384 alpha=true parity=exact`)
}

const expectedSpriteFiles = spriteIds.map((id) => `${id}.webp`).sort()
for (const directory of [path.join(mobile, 'sprites'), webSprites]) {
  const actual = (await readdir(directory)).filter((name) => name.endsWith('.webp')).sort()
  assert(JSON.stringify(actual) === JSON.stringify(expectedSpriteFiles), `${directory}: sprite id set differs`)
}

console.log('validated 3 retained provider assets and 21 replaced LVM assets')
