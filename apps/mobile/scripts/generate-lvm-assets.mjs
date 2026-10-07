#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../..')
const mobileAssets = path.join(repoRoot, 'apps/mobile/assets')
const webSprites = path.join(repoRoot, 'apps/web/public/sprites')
const sourcePath = path.join(mobileAssets, 'lvm-mark.svg')

const spriteSpecs = [
  ['acoustic', '#133A5C', '#F6B94A', guitar],
  ['bible', '#303B72', '#75C9FF', bible],
  ['boba', '#5B315E', '#F09CC2', boba],
  ['charlie', '#124C4D', '#79E1C5', dove],
  ['drums', '#573329', '#FF9B61', drums],
  ['elec', '#222F63', '#8AA4FF', electricGuitar],
  ['heart', '#632D45', '#FF88A7', heart],
  ['keys', '#263E55', '#A8D9FF', keyboard],
  ['lamb', '#3F4660', '#E9E6DC', lamb],
  ['lion', '#593A1E', '#FFC45E', lion],
  ['mic', '#34315D', '#B7A8FF', microphone],
  ['notes', '#183E55', '#66D5EB', notes],
  ['shepherd', '#3E4930', '#C7D98A', shepherd],
  ['star', '#44395F', '#FFD76B', star],
  ['thomas', '#234557', '#71D2DC', compass],
]

const commonStroke = 'stroke="#F8FCFF" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"'

function guitar(accent) {
  return `<g ${commonStroke} fill="none"><circle cx="180" cy="224" r="72" fill="${accent}" fill-opacity=".32"/><circle cx="194" cy="207" r="18"/><path d="M226 173 310 89M276 123l30 30M151 281l58-58"/></g>`
}

function bible(accent) {
  return `<g ${commonStroke} fill="${accent}" fill-opacity=".25"><path d="M68 112q74-22 116 30v156q-42-52-116-30zM316 112q-74-22-116 30v156q42-52 116-30z"/><path d="M192 155v70M165 181h54" fill="none"/></g>`
}

function boba(accent) {
  return `<g ${commonStroke} fill="none"><path d="m117 118 18 181h114l18-181z" fill="${accent}" fill-opacity=".28"/><path d="M107 118h170M221 118l38-66"/><circle cx="162" cy="244" r="12" fill="#F8FCFF"/><circle cx="211" cy="264" r="12" fill="#F8FCFF"/><circle cx="230" cy="214" r="12" fill="#F8FCFF"/></g>`
}

function dove(accent) {
  return `<path d="M73 224q78 12 114-73 26 43 78 32l44-17-25 43q-42 71-139 61-45-5-72-46z" fill="${accent}" fill-opacity=".35" ${commonStroke}/><path d="M187 151q-5-47 39-65 5 49 39 97M107 238q54-4 80-45" fill="none" ${commonStroke}/>`
}

function drums(accent) {
  return `<g ${commonStroke} fill="none"><ellipse cx="192" cy="157" rx="101" ry="42" fill="${accent}" fill-opacity=".3"/><path d="M91 157v90c0 24 45 43 101 43s101-19 101-43v-90M91 210c0 24 45 43 101 43s101-19 101-43M125 84l142 96M259 78 122 180"/></g>`
}

function electricGuitar(accent) {
  return `<g ${commonStroke} fill="none"><path d="M101 247q24-54 70-46l73-94 38 29-69 96q17 41-34 68-47 25-78-53z" fill="${accent}" fill-opacity=".32"/><path d="m244 107 35-38 32 24-29 43M157 241l89-118"/><circle cx="157" cy="241" r="13" fill="#F8FCFF"/></g>`
}

function heart(accent) {
  return `<path d="M192 306 85 204q-42-44-5-91 42-51 112 10 70-61 112-10 37 47-5 91z" fill="${accent}" fill-opacity=".42" ${commonStroke}/><path d="M111 177h48l22-43 27 86 22-43h43" fill="none" ${commonStroke}/>`
}

function keyboard(accent) {
  return `<g ${commonStroke}><rect x="55" y="112" width="274" height="166" rx="25" fill="${accent}" fill-opacity=".25"/><path d="M111 113v165M166 113v165M221 113v165M276 113v165"/><path d="M94 113v91h34v-91M149 113v91h34v-91M259 113v91h34v-91" fill="#F8FCFF"/></g>`
}

function lamb(accent) {
  return `<g ${commonStroke}><path d="M110 263q-51-18-30-70-30-46 21-68 4-57 62-44 38-38 76 1 56-4 54 53 46 29 12 70 15 52-41 59z" fill="${accent}" fill-opacity=".36"/><path d="M137 202q55 43 110 0M158 180v2M226 180v2" fill="none"/><path d="M130 118 88 91M254 118l42-27" fill="none"/></g>`
}

function lion(accent) {
  return `<g ${commonStroke}><path d="m192 58 35 26 43-4 17 40 38 22-9 42 20 39-30 32-2 44-43 7-29 33-40-18-40 18-29-33-43-7-2-44-30-32 20-39-9-42 38-22 17-40 43 4z" fill="${accent}" fill-opacity=".34"/><circle cx="192" cy="198" r="84" fill="none"/><path d="M157 185v2M227 185v2M168 230q24 20 48 0M192 205v20" fill="none"/></g>`
}

function microphone(accent) {
  return `<g ${commonStroke} fill="none"><rect x="139" y="61" width="106" height="174" rx="53" fill="${accent}" fill-opacity=".32"/><path d="M102 187q0 90 90 90t90-90M192 277v55M143 332h98M139 130h106M139 177h106"/></g>`
}

function notes(accent) {
  return `<g ${commonStroke} fill="${accent}" fill-opacity=".38"><path d="M158 266V103l139-28v159"/><ellipse cx="119" cy="275" rx="44" ry="34"/><ellipse cx="258" cy="243" rx="44" ry="34"/><path d="m158 144 139-28" fill="none"/></g>`
}

function shepherd(accent) {
  return `<g ${commonStroke} fill="none"><path d="M159 321 222 87q13-48 57-30 43 18 23 62-12 26-42 18" /><path d="M87 321 151 87" stroke="${accent}"/><path d="m72 166 97 26M112 95l97 26"/></g>`
}

function star(accent) {
  return `<path d="m192 57 41 83 91 13-66 64 16 91-82-43-82 43 16-91-66-64 91-13z" fill="${accent}" fill-opacity=".48" ${commonStroke}/><circle cx="192" cy="191" r="34" fill="none" ${commonStroke}/>`
}

function compass(accent) {
  return `<g ${commonStroke}><circle cx="192" cy="192" r="126" fill="${accent}" fill-opacity=".22"/><path d="m235 116-24 98-82 54 31-95z" fill="${accent}" fill-opacity=".52"/><circle cx="192" cy="192" r="13" fill="#F8FCFF"/><path d="M192 66v25M318 192h-25M192 318v-25M66 192h25"/></g>`
}

function spriteSvg(id, background, accent, artwork) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="384" height="384" viewBox="0 0 384 384">
  <defs>
    <radialGradient id="bg-${id}" cx="30%" cy="20%" r="88%">
      <stop stop-color="${accent}" stop-opacity=".34"/>
      <stop offset=".46" stop-color="${background}"/>
      <stop offset="1" stop-color="#081722"/>
    </radialGradient>
    <clipPath id="disc-${id}"><circle cx="192" cy="192" r="180"/></clipPath>
  </defs>
  <g clip-path="url(#disc-${id})">
    <circle cx="192" cy="192" r="180" fill="url(#bg-${id})"/>
    <path d="M-8 297Q98 224 201 296T405 278V405H-8Z" fill="${accent}" opacity=".11"/>
    <path d="M54 91c-18 31-27 64-27 99M88 70c-25 39-38 79-38 123" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round" opacity=".56"/>
    ${artwork(accent)}
  </g>
  <circle cx="192" cy="192" r="179" fill="none" stroke="${accent}" stroke-width="3" opacity=".72"/>
</svg>`)
}

function transparentMarkSvg(source) {
  return source.replace(/<rect width="1024" height="1024" rx="224" fill="url\(#bg\)"\/>\s*/, '')
}

async function writeGeneratedFile(target, contents) {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      await writeFile(target, contents)
      return
    } catch (error) {
      const transient = error?.code === 'UNKNOWN' || error?.code === 'EBUSY' || error?.code === 'EPERM'
      if (!transient || attempt === 12) throw error
      await new Promise((resolve) => setTimeout(resolve, attempt * 100))
    }
  }
}

async function writePng(input, target, { size, transparent = false }) {
  const pipeline = sharp(input).resize(size, size, { fit: 'contain' })
  if (!transparent) pipeline.flatten({ background: '#071522' }).removeAlpha()
  await pipeline.png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(target)
}

await mkdir(path.join(mobileAssets, 'sprites'), { recursive: true })
await mkdir(webSprites, { recursive: true })

const source = await readFile(sourcePath, 'utf8')
const transparentSource = Buffer.from(transparentMarkSvg(source))

await writePng(Buffer.from(source), path.join(mobileAssets, 'icon.png'), { size: 1024 })
await writePng(transparentSource, path.join(mobileAssets, 'adaptive-icon.png'), { size: 1024, transparent: true })
await writePng(transparentSource, path.join(mobileAssets, 'splash-icon.png'), { size: 1024, transparent: true })
await writePng(transparentSource, path.join(mobileAssets, 'splash-icon-dark.png'), { size: 1024, transparent: true })
await writePng(transparentSource, path.join(mobileAssets, 'splash-mark.png'), { size: 600, transparent: true })
await writePng(transparentSource, path.join(mobileAssets, 'splash-mark-dark.png'), { size: 600, transparent: true })

await sharp(Buffer.from(source))
  .resize(192, 192, { fit: 'contain' })
  .flatten({ background: '#071522' })
  .removeAlpha()
  .webp({ quality: 90, effort: 6, smartSubsample: true })
  .toFile(path.join(mobileAssets, 'mark.webp'))

for (const [id, background, accent, artwork] of spriteSpecs) {
  const output = await sharp(spriteSvg(id, background, accent, artwork))
    .webp({ quality: 88, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toBuffer()
  await Promise.all([
    writeGeneratedFile(path.join(mobileAssets, 'sprites', `${id}.webp`), output),
    writeGeneratedFile(path.join(webSprites, `${id}.webp`), output),
  ])
  console.log(`generated ${id}.webp`)
}

console.log('generated LVM identity assets from apps/mobile/assets/lvm-mark.svg')
