import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import licenseChecker from 'license-checker'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const destination = resolve(here, '../src/content/third-party-licenses.md')
const scan = promisify(licenseChecker.init)
const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('Run this generator through npm run generate:licenses')
const dependencyTree = JSON.parse(execFileSync(process.execPath, [
  npmCli, 'ls', '--omit=dev', '--all', '--json',
  '-w', '@lavozmisionera/web',
  '-w', '@lavozmisionera/mobile',
], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
const productionNames = new Set()
function visit(dependencies = {}) {
  for (const [name, entry] of Object.entries(dependencies)) {
    productionNames.add(name)
    visit(entry.dependencies)
  }
}
visit(dependencyTree.dependencies)
for (const workspace of Object.values(dependencyTree.workspaces || {})) {
  visit(workspace.dependencies)
}
const packages = await scan({ start: root })

const entries = Object.entries(packages)
  .filter(([name]) => {
    const packageName = name.slice(0, name.lastIndexOf('@'))
    return productionNames.has(packageName) && !packageName.startsWith('@lavozmisionera/')
  })
  .map(([name, metadata]) => ({
    name,
    license: Array.isArray(metadata.licenses)
      ? metadata.licenses.join(', ')
      : metadata.licenses || 'See package',
    repository: String(metadata.repository || '').replace(/^git\+/, '').replace(/\.git$/, ''),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const lines = [
  '## Open-source dependencies',
  '',
  'This list records third-party package metadata found in the installed production dependency tree. It does not cover source-code provenance, images, song rights or Scripture translations.',
  '',
  ...entries.map(({ name, license, repository }) =>
    `- **${name}** — ${license}${repository ? ` — ${repository}` : ''}`),
  '',
]

await mkdir(dirname(destination), { recursive: true })
await writeFile(destination, lines.join('\n'), 'utf8')
console.log(`Recorded ${entries.length} third-party packages.`)
