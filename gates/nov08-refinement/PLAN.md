# November 8 refinements

Current repository: gndott, branch codex/apple-tv-experience, remote https://github.com/theangelorgapps-ship-it/gndott.git. Preserve current live design and backend contracts.

## Ownership contracts
- Catalogue leaf: Catalogue.tsx, catalogueFilters.ts, catalogue.ts; listing routes sermons/shows/movies/tv-shows/videos and route references EXCEPT __root.tsx; shop.tsx/shop.index.tsx/store.css; new filter components/styles/tests. Do not edit api.ts, root, player, global refinements.css.
- Auth leaf: authentication backend modules, auth portions of api.ts, login/register and new auth UI/style, OAuth routes, auth migration/tests/docs. Preserve user IDs, passwords, profile/subscriptions; no implicit enabling of disabled users. Provider secrets never printed. Ask root for live provider setup.
- Player/chat leaf: ImmersivePlayer, LiveDiscussion, liveTv backend and own migration, liquid-glass-navbar new component, own stylesheet/tests. Use supplied Nimbus design safely, existing admin moderation retained.
- Media leaf (dispatch after a slot opens): image processing/media routes, AVIF inventory/conversion script, references mapping and prune verification. No original deletion before verified converted bytes and updated references.
- Integration root: __root.tsx, refinements.css, route type generation, shared glass/choice picker, blue tokens, tests/browser verification/release.

No leaf commits, deploys, installs packages or alters another owner's files without coordination. Workers are not alone and must preserve others' edits. New migrations named uniquely. No credentials in logs. No fake success/provider buttons.

## Status log
- Started: contracts and acceptance ledgers created before edits.

## Final acceptance mapping
- Catalogue: round filter toggle, category chips and category/upload-year/date sort controls on all requested listing types; shared store controls.
- Navigation: canonical /sermons and /shows plus compatible legacy redirects, transparent header on scroll, Watch submenu and embossed dock.
- Reader/player: Nimbus full-width information tabs, glass Bible choices with gray selected rows, rounded settings, non-overlapping mobile panels and one-click playback.
- Live chat: compact sheet/feed, pinned official messages, real emoji posts, collapse/reopen, account-scoped block/unblock and existing report/admin controls.
- Visual: royal pastel accent, filled store category images, button order history and clean scrolling gutters.
- Authentication: branded responsive login, preserved migrated password/ID/profile/subscription access, verified provider flow implementation. Real Google/Apple activation remains an explicit external configuration handoff.
- Media: all 557 bundled images and 831 owned R2 originals converted and backed up; guarded rewrite/verify/prune; external store AVIF compatibility separately verified.
- Release: production migrations/deploy, responsive checks, scoped commit/push and temporary process/worker cleanup.
