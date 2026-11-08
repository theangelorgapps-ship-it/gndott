# November 8 release verification

## Live applications

- Viewer: https://halobox.tv — Worker version `7c9dc08a-f9dc-498c-a786-34c8f046bb48`.
- Administration: https://fort.halobox.tv — Worker version `0d376449-9cef-4749-b247-5c1365794ad5`.
- Main source: `/Users/charlesfinney/Documents/Codex/Projects/New project/gndott`, branch `codex/apple-tv-experience`.
- Admin source: `/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin`, branch `main`.

Both deployed from the authorized existing working trees. No commit or Git push was performed in this release task. Existing unrelated edits were preserved.

## Domains and authentication

Both canonical login pages return HTTPS 200. Legacy Worker HTML navigation redirects 307 to its matching canonical domain, preserving the path and query. www redirects to halobox.tv. API, server-function and auth endpoints retain legacy compatibility for integrations. Canonical guest session reads return 200/null.

Google and Apple callback URLs were saved for both new domains. Apple configuration was reopened and read back after saving. Four live provider initiation requests returned official provider authorization URLs with the correct canonical callback and secure cookies. Requests from a hostile origin returned 403 in both realms. No real Google/Apple sign-in or provider consent was completed during verification.

Cloudflare reports the halobox.tv sending domain Enabled / DNS configured. The restricted `noreply@halobox.tv` EMAIL binding and user-initiated OTP/reset delivery are enabled in both workers. Cloudflare showed **0 of 200 daily messages**. No setup email, sign-in code, password-reset email or test message was sent. Live email deliverability remains untested. Existing DNS records were preserved; a pre-change DNS snapshot is stored alongside this report.

Evidence: [sender status](email-domain-enabled.png), [Apple callback readback](apple-callbacks-saved.png).

## Responsive interface

Live browser review covered 320px and 430px phone widths, 768px tablet width, and 3840×2160 desktop. No horizontal page overflow was found at the reviewed sizes.

- Library appears in the mobile header; Store is in the dock. Four distinct isometric AVIF Watch icons load successfully. The borderless Watch shelf blends with the dock and dark gradient backing.
- Primary blue endpoints pass a minimum 4.65:1 white-label contrast check.
- At a reduced 430×500 viewport with Notes focused, the compact video occupied y54–154 and the editor y270–494. At 320×350, video occupied y54–124 and editor y240–308. Typed text remained visible and the video had its own layout area.
- An 18-line note scrolled to the active final lines: scrollHeight 1232, clientHeight 202, scrollTop 1030. Done restored the normal panel. The unsaved guest draft was cleared and Notes reopened empty; no note was saved to the server.
- The gentle 34px video-to-panel gradient was reviewed above Bible on actual paused video. Notes loading status was observed. Automated checks cover shimmer, reduced motion, viewport offsets, rotation, pinch zoom exclusion, selection containment and cleanup.

These keyboard checks used desktop browser viewport reduction. **Physical iOS/Android keyboard behaviour and authenticated live-chat composition remain untested.** The corresponding full integration gates remain open; the results above do not imply native-device verification.

Screenshots:

- [Mobile Watch menu](mobile-watch-live.png)
- [Tablet Watch menu](tablet-watch-live.png)
- [4K desktop](desktop-4k-live.png)
- [Compact Notes viewport](notes-compact-viewport.png)
- [Small Notes viewport](notes-small-viewport.png)
- [Player/Bible gradient](player-bible-live.png)

## Checks and security

Both applications passed TypeScript and production builds. Relevant Better Auth/recovery, API security, playback-data, typing-viewport, player, library, live-TV playback/discussion, glass experience, subscription checkout, navigation, contrast and asset checks passed. Both production dependency advisory scans reported zero advisories at audit time.

The [security audit](../../security-audit-2026-11-08.md) records the fixed paid-stream disclosure, unverified manual rental grants, arbitrary VAST fetching, origin/CSRF gaps, recovery abuse gaps, demo-admin mutations and input/privacy issues. It also records residual risks, including CDN URL sharing and broader admin permission/audit coverage. This was not an exhaustive penetration test.

No live chat message, signup or payment was submitted. Temporary browser viewport overrides were reset. Task shell processes completed; no task dev server or watcher remains running.
