# Behavior-preserving cleanup and release

## Contract

Target: /Users/charlesfinney/Documents/Codex/Projects/New project/gndott, branch codex/apple-tv-experience, origin https://github.com/theangelorgapps-ship-it/gndott.git.
Preserve the full current working tree's user-requested design, public URLs, API signatures, auth/access rules, persistence and playback behavior. Audit skills report first; the user's explicit removal request authorizes implementing proven removals afterward. Keep tests and operational safeguards. Do not remove assets solely because static source has no reference: database/manifest references count. Do not print secrets. No new runtime packages for this cleanup.

## Ownership and leaves

1. dependency audit: all module/dependency reachability and build/config/tooling. Writes only audit-dependencies.md and dependency-GATES.md here.
2. frontend audit: components/routes/styles and pending frontend diff. Writes only audit-frontend.md and frontend-GATES.md here.
3. backend audit: server/library/data/assets and release prerequisites. Writes only audit-backend.md and backend-GATES.md here.
4. implementation: after findings are reviewed, a fresh worker applies approved cuts with explicit ownership and regression evidence.
5. integration/release: driver verifies combined changes, captures baseline/comparison evidence, commits/pushes source, deploys and verifies live.

Audits may run concurrently because they write separate reports. Implementation runs after contracts are agreed. Each leaf inventories its scope, reports ranked findings with exact measurable savings, and flags uncertainty instead of deleting a possibly used feature. Parent rechecks evidence and runs final gates.

## Status

- Started: repository identity and existing dirty work confirmed; no changes discarded.

- Audit leaves and implementation verified by parent. Cleanup removes105804 source/config bytes and1227 physical lines; all public assets retained. Actual production schema compatibility checked; release ready after migration.
