import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { test } from 'node:test'
import { checkWorshipRelease } from './check-worship-release.mjs'

test('release guard rejects rollback, divergent history and invalid or unavailable manifests', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'lvm-release-guard-'))
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    git('init')
    git('config', 'user.name', 'Release guard test')
    git('config', 'user.email', 'release-test@example.invalid')
    git('commit', '--allow-empty', '-m', 'base')
    const base = git('rev-parse', 'HEAD')
    git('commit', '--allow-empty', '-m', 'deployed')
    const deployed = git('rev-parse', 'HEAD')
    git('commit', '--allow-empty', '-m', 'candidate')
    const next = git('rev-parse', 'HEAD')
    const check = (candidate, manifest = { component: 'worship-web', commit: deployed }) => checkWorshipRelease({
      url: 'https://example.invalid', cwd, candidate,
      fetchImpl: async () => new Response(JSON.stringify(manifest)),
    })
    assert.equal((await check(next)).candidate, next)
    assert.equal((await check(deployed)).deployed, deployed)
    await assert.rejects(check(base), /Refusing regression/)
    git('checkout', '-b', 'diverged', base)
    git('commit', '--allow-empty', '-m', 'unrelated change')
    await assert.rejects(check('HEAD'), /Refusing regression/)
    await assert.rejects(check(next, { component: 'service', commit: deployed }), /Invalid Worship/)
    await assert.rejects(check(next, { component: 'worship-web', commit: 'unknown' }), /Invalid Worship/)
    await assert.rejects(check(next, { component: 'worship-web', commit: 'f'.repeat(40) }))
    await assert.rejects(checkWorshipRelease({ url: 'https://example.invalid', cwd, fetchImpl: async () => new Response('', { status: 503 }) }), /HTTP 503/)
  } finally {
    assert.ok(resolve(cwd).startsWith(resolve(tmpdir()) + sep))
    assert.ok(cwd.includes('lvm-release-guard-'))
    rmSync(cwd, { recursive: true, force: true })
  }
})
