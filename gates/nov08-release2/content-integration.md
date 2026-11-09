# Release 2 content handoff

Shared D1 migration: apply `migrations/20261108_locations.sql` once before public/admin deployment. It is replay-safe and retains legacy source rows. Do not copy records into a new location personality type. `content-data-audit.json` contains the exact audited classification; the migration never classifies all directors.

## Main API wiring (owned by parent / entitlement)

Import database loaders from `./people.server`: `loadPersonalities`, `loadPersonalityDetail`, `loadTitlePeople`, `loadTitleLocations`.

- Dashboard cast array: replace direct cast SQL with `loadPersonalities(12)`.
- `getCastCrewList`: delegate `loadPersonalities()`.
- `getCastDetail`: delegate `loadPersonalityDetail(id)` (maintains legacy API privacy as well as new routes).
- `getMovie` and `getTvShow`: replace cast SQL with `loadTitlePeople(id)`; load `const locations = await loadTitleLocations('entertainment', id)`; return `locations`.
- `getVideo`: load/return `locations = await loadTitleLocations('video', id)`.
- Episode assignments: when loading episode records attach `locations = await loadTitleLocations('episode', episode.id)`, and show those for the selected episode wherever its information is shown. The admin editor can assign locations to individual episodes; the public helper supports exact typed lookup and no ID collision. If a location is assigned at show level, that remains on the show's About section.

The helper never queries users, emails or private profile data, and never selects unpublished/deleted personalities or related works. Real directors remain personalities.

## Detail wiring (parent / experience-owned files)

Replace the old `AboutPanel` implementation in `components/Detail.tsx` (which incorrectly treats every director as a location) with:

```tsx
export { TitlePeople as AboutPanel } from './TitlePeople'
```

At all existing `AboutPanel` call sites (movie/video/ShowDetail), destructure `locations = []` from loader payload and pass `<AboutPanel cast={cast} locations={locations} />`. `TitlePeople` uses `PersonalityCard` for actual people and static location cards for actual locations; there is no navigation from venues to personality biographies. Remove now-unused imports from the replaced function only if unused elsewhere.

`Personality.tsx` imports `people-locations.css` itself; no root stylesheet edit required. Home/cast routes already use the popup. `/cast/$id` remains a public share/deep-link page using the same profile rendering. No new homepage location section exists.

## Admin / verification

New route `/admin/locations` needs generated route tree refresh. All mutations require existing admin authorization; demo admins are read-only. `admin.ts` retains legacy venue mappings when existing title editors save and excludes venues from their people options. Locations are managed through the new route; typed associations support sermons/shows/teaching/videos/episodes. Personality admin renamed to Personalities and supports optional official social URLs; all are initially empty because production has no source social columns.

Run `node scripts/gate-release2-content.mjs` in main (set HALOBOX_ADMIN_ROOT only if admin path moves). Then regenerate route trees and run both TypeScript/build checks.

Required browser checks before gates L2/L3 complete: desktop + 390px + 320px portrait dialog geometry; home/detail card open; focus trapped/restored; Escape/backdrop/close; scrolling full biography/related works; share copied/manual fallback; deep link; no six venues on home or cast; title locations reflect mapping; admin create/edit/soft-delete with independent same-ID title kinds in isolated local DB; no production test rows.

Client/server boundary fix: `people.ts` exports only `createServerFn` wrappers and dynamically imports `people.server.ts` inside handlers. Public components must import only those wrappers or pure `personalityData.ts` helpers. Main API imports the server loaders from `people.server.ts`. The content gate executes both server loaders and wrappers.
