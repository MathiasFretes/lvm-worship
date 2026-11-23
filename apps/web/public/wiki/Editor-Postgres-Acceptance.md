# Editor: isolated PostgreSQL acceptance — 23 November 2026

Status: QA passed for the candidate; production rollout and merge are not authorized.
Worship PR #4 and Service PR #19 remain drafts.

## Exact versions

- Application build: `ba7f508f9915003e9306dd7bd627bc60de12f243`.
- Final verifier: `bb753f97c973c6e4858bc885228f48aabfdad36e`. Its only difference
  from the application-build commit is the forged-frontend-role test script;
  `apps/web/src`, shared core and tokens have no difference between these commits.
- API source/image label: `602a7781eac83a1e612d0ac37a9bfce089f9a05b`.
- API image: `sha256:f74867fb73a68b64df83f76b474e174baf875208cb9b5b33cf53afdaf0364811`.
- Migration 012 SHA-256: `dfc8d181207d0a08f6162d32162d00381585e687857d46b4fabfb5b8b972891c`.
- Production stays at `7364f3ee8ae15ca2b4fb919cdc0c1e57951fd18e`; the candidate
  fixes below have **not** been installed there. The default locale remains `en`.

## Environment and command

The compiled frontend ran at `http://127.0.0.1:4174`. All browser API calls were
forwarded to `127.0.0.1:54320`, an SSH forward to a new, loopback-only Docker API
on VPS port 4320. It used `lvm_planning_qa_20261121` and its isolated PostgREST,
never the production database or API. Unlike visual-only QA, API results were
not mocked. Login, save, approve and reject ran through the real rendered UI;
SQL independently checked persisted content and authorization outcomes.

```powershell
$env:LVM_EDITOR_FRONTEND_URL = 'http://127.0.0.1:4174'
node apps/web/scripts/verify-editor-postgres.mjs
```

The verifier refuses a dirty worktree, fixes the QA database/API targets and
creates UUID-scoped accounts/material. It requires the isolated API with Service
migration 012 and the new RPC allowlisted. No real credentials are saved or logged.
The compiled API URL is absolute; it is intercepted only in the QA browser and
forwarded into QA. The normal production browser is not altered.

## Defects found and corrected in the candidate

1. Saved songs did not immediately appear in the cached library; approval left
   the old form visible. Refresh now follows writes/review, retaining unsaved edits.
2. Retrying a proposal after losing its acknowledgement created another proposal.
   The editor now uses `mutate_editor_song` with an operation UUID and PostgreSQL
   receipts. Same command/UUID returns its prior result; changed content is 409.
3. Audit insertion was best-effort and a normal user could insert a self-attributed
   audit row with `Prefer: return=minimal`. Migration 012 revokes client audit
   writes and adds server triggers. Audit failure now rolls back the song/proposal.
4. Draft submission was multiple requests. Saving content, inserting its proposal,
   changing status and recording its operation now share a database transaction.
5. Unacknowledged text and operation IDs were lost on reload. A journal scoped by
   account and song recovers both, preserving the original expected revision.
   Conflicts keep local text and offer explicit discard/reload. Controls that can
   alter the operation are disabled during an active save.
6. Approval/rejection acknowledgement retries are now idempotent; a different
   decision returns 409. Missing/deleted targets cannot be partially approved.

## Results

The final report has 18 passing checks and no browser errors. It covers:

- Ordinary-user submission without direct publication; direct API writes and
  approvals denied; forged editor role in the frontend still denied by PostgreSQL.
- Editor publication, exact metadata/sections/chords, UI approval/rejection, library
  refresh, reload and preservation of original ChordPro.
- Private draft save/reload, cross-account read/write denial, submission, rejection
  back to draft, resubmission and atomic approval/publication link.
- Deliberately lost submission/save/approval acknowledgements and reload/retry;
  same UUID creates one result. Concurrent commands share the same receipt;
  reused UUID with changed content and stale server revisions return 409.
- Injected audit failures during save, approval and draft submission: no partial
  publication/status/proposal; pending/local content is retained.
- Revoked editor role rejects the next mutation with the existing session.

See [machine-readable report](evidence/editor-postgres-20261123.json). Local browser
captures and logs are under ignored `test-results/editor-postgres/`. No public
production test song was created.

After cleanup, QA again had 3 users, 2 pre-existing Android songs, 0 drafts and
0 editor receipts. Existing-user/song fingerprints matched before/after. Only
this run's accounts/material and fault-injection triggers were removed. The
reserved native Android fixtures were preserved.

## Automated validation and rollout dependencies

Worship: 566 tests in 97 files, clean lint/parity and full production build.
Service: 14 API unit tests plus fresh PostgreSQL migration and SQL gates for
planning, worship exchange and editor transactions. Service CI explicitly skips
`*.down.sql` while applying migrations. The release guard still rejects old main.

Before rollout, review both PRs and authorize their integration. Deploy Service
migration 012 + RPC allowlist before publishing the new Worship bundle; its editor
has no unsafe fallback to old multi-request writes. Do not deploy the bundle alone.
The legacy web can remain readable during the staged update. API native activation
and Android distribution are separate and are not included.

The backend migration includes a down script, retaining receipts/history. Revert
client and API together; do not replay baseline/historical Supabase migrations.
The provisioning script no longer reapplies migration 002 over the newer review
wrapper. Single-editor recovery was tested across reload; simultaneous local
editing in multiple tabs and storage-quota exhaustion are not certified by this
report. The broader PR module review, canonical-main integration and physical
Android gate remain open.
