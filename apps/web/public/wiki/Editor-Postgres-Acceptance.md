# Editor: isolated PostgreSQL acceptance — 23 November 2026

Status: QA passed for the candidate; production rollout and merge are not authorized.
Worship PR #4 and Service PR #19 remain drafts.

## Exact versions

- Application build and verifier: `7b64c2840f21465340281f0ea6bed322cd1f2967`.
- Service review UI: `83c4c5a4f96676dc0e5fa74f26fce531062a6cb5`, served as an authenticated
  `/service/song-review` preview at `http://127.0.0.1:4175`.
- API source/image label: `83c4c5a4f96676dc0e5fa74f26fce531062a6cb5`.
- API image: `sha256:da2acd7b55554a565eb98032c1ab971ed40728c594488153284c2ce00e231ae7`.
- Migration 012 SHA-256: `d2d62820ccb26351d21c22ff5f64d4d57d65f1f5012bf3b057b36badb24eca25`.
- Run ID: `c748a1e2-a666-4294-8581-c59e8e706246`. Subsequent evidence-only commits do not change the tested
  application/API source.
- Production stays at `7364f3ee8ae15ca2b4fb919cdc0c1e57951fd18e`; the candidate
  fixes below have **not** been installed there. The default locale remains `en`.

## Environment and command

The compiled Worship frontend ran at `http://127.0.0.1:4174`; the Service review
frontend ran at `http://127.0.0.1:4175/service/song-review`. All browser API calls were
forwarded to `127.0.0.1:54320`, an SSH forward to a new, loopback-only Docker API
on VPS port 4320. It used `lvm_planning_qa_20261121` and its isolated PostgREST,
never the production database or API. Unlike visual-only QA, API results were
not mocked. Login, save, approve and reject ran through the real rendered UI;
SQL independently checked persisted content and authorization outcomes.

```powershell
$env:LVM_EDITOR_FRONTEND_URL = 'http://127.0.0.1:4174'
$env:LVM_REVIEW_FRONTEND_URL = 'http://127.0.0.1:4175'
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

## Service review queue

QA found no global UI queue for new song additions. The candidate adds it in
LVM Service at `/service/song-review`, using existing navy/gold panels and form
controls. An editor can review music without receiving global administration
rights. Review requires an explicit confirmation; deletion approval remains
administrator-only. Existing song content can be compared before approving an
edit. Errors keep the decision/reason for retry. The queue is paginated and
mobile selection moves focus to the detail without horizontal overflow.

The expanded gate finds and approves a new addition in this actual Service UI,
including an injected audit failure and a lost approval acknowledgement. It also
rejects an edit from Service, preserving the published song. All API calls still
reach isolated PostgreSQL. Unit tests protect confirmations, failed-review retry,
ordinary-user denial and administrator-only deletion.

## Results

The final report has 24 passing checks and no browser errors. It covers:

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

Worship: 567 tests in 97 files, clean lint/parity and full production build.
Service: 57 UI/domain tests, 14 API unit tests plus fresh PostgreSQL migration and SQL gates for
planning, worship exchange and editor transactions. Service CI explicitly skips
`*.down.sql` while applying migrations. The release guard still rejects old main.

Before rollout, review both PRs and authorize their integration. Deploy Service
migration 012 + RPC allowlist before publishing the new Worship bundle; its editor
has no unsafe fallback to old multi-request writes. Do not deploy the bundle alone.
The legacy web can remain readable during the staged update. API native activation
and Android distribution are separate and are not included.

The backend down migration retains receipts/history and leaves editing read-only;
it revokes transactional editing/review RPCs and never restores direct table or
audit INSERT privileges. Reapply the reviewed up migration to resume editing.
Coordinate client/API versions; do not replay baseline/historical Supabase migrations.
The provisioning script no longer reapplies migration 002 over the newer review
wrapper. Single-editor recovery was tested across reload; simultaneous local
editing in multiple tabs and storage-quota exhaustion are not certified by this
report. The broader PR module review, canonical-main integration and physical
Android gate remain open.


## Three review blockers: implementation and regression evidence

1. **Direct writes:** migration 012 revokes INSERT/UPDATE/DELETE on songs,
   suggestions and private drafts for client roles, including authorized editors.
   The browser/API gate checks these denials independently of the visible UI.
   The web PPTX metadata path now uses `update_pptx` through the transactional RPC.
2. **Required revision:** every mutation of an existing song or draft requires a
   non-null matching `p_expected_updated_at`. The API gate checks missing values
   for save, suggest, delete, PPTX metadata, draft save/submit/delete. SQL additionally
   checks strictly advancing revisions within one transaction; favorite-count
   updates alone preserve the musical revision.
3. **Old proposals:** submissions capture the source revision. Approval of an
   outdated or unversioned edit/deletion returns 409 and retains the proposal.
   Service displays the current content and disables approval until an explicit,
   separately confirmed base update against the compared revision. This operation
   is audited and does not approve. A subsequent separate approval was exercised
   in the real Service UI. SQL also covers historical NULL bases and stale rebase.

Fresh PostgreSQL validation applied the schema in a disposable database, ran
planning, worship-exchange, editor-transactions and editor-revisions regressions,
then applied the real down migration, verified protected table/RPC/audit grants,
reapplied 012 and repeated editor-revisions. That disposable database was removed.
CI repeats the SQL sequence in `church-planning`; rollback SQL is never included
in the ordinary migration glob.

### Compatibility inventory and limits

Active Worship web editor save/publication, draft creation/update/deletion,
submission and presentation metadata use transactional RPCs. Service review,
rejection and explicit base update use server-validated RPCs. The old Worship
admin route still belongs in Service. The PPTX metadata test covers CAS, replay,
content preservation and administrator-only removal; it does **not** certify a
binary upload to the historical Cloudflare Worker, which is not configured for
this VPS flow. Legacy Supabase/native editor CRUD is not activated or certified
by this candidate and needs its own migration before use against these grants.
Neither native rollout nor production migration is part of this delivery.

Local QA initially found a preview-only setup error (Service assets served with
`/` instead of `/service/`); starting the preview with
`LVM_SERVICE_ASSET_BASE=/service/` fixed it. The failed run cleaned its fixtures;
the complete replacement run above passed all 24 checks.
