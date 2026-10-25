# Working on Slowfolk

Slowfolk helps people learn banjo by ear: YouTube/local-audio practice with
phrase loops, plus listening games using recorded banjo samples. See README.md
for setup, recording authoring, Firebase, and deployment details. Keep this file
short and update it when architecture or workflows change; don't use it as a
session log.

## Code map

- React + Vite, JavaScript/JSX, plain CSS, Lucide icons. No custom backend.
- `src/main.jsx`: practice screen, saved phrases, inline editing, navigation.
- `src/usePlayer.js`: YouTube iframe and local-audio playback, A/B loops,
  playback speed, and the pause between repeats.
- `src/routes.js`, `src/useLocation.js`: URL parsing and browser history.
  Practice URLs are `/pr/<video-id>` and `/pr/<video-id>/<phrase-id>`;
  library and games are `/saved` and `/training`.
- `src/training/`: listening games and recording library. `useListening.js`
  decodes clips with Web Audio and loops buffers without a media-player seek.
- `src/account/`: optional Google sign-in, Firebase sync, guest persistence.
  `firestore.rules` enforces ownership and the allowed record fields.
- `public/recordings/`: permanent catalog and content-hashed audio assets.
- `infra/`, `scripts/deploy.mjs`: Terraform and static-site deployment.

## Behavior to preserve

- Opening a saved phrase loads its values into the existing practice panel.
  Save changes updates the same ID; Save as new phrase creates another ID.
  Group phrases by video ID, not title. Deletion needs confirmation.
- Direct links must work on refresh and with Back/Forward. Wait for the account
  library before resolving private phrase IDs. A phrase URL is a bookmark into
  the current user's library, not a public share. Missing phrases still allow
  video playback. Local files cannot be restored by a URL on another device.
- Guest data stays in localStorage/IndexedDB. Cloud data belongs to the signed-in
  user. Do not automatically import guest data or copy cloud records into guest
  storage. Account changes must stop playback and clear private UI state.
- YouTube uses the official iframe API. Banjo Focus is EQ for local audio;
  it cannot isolate banjo from a YouTube mix.
- Keep original WAV masters outside the deployed assets. Import web copies
  with accurate musical labels; don't guess tempo, chord, or roll labels.
  Recording drafts are browser-local until explicitly imported into the repo.

## Development and verification

- Use the npm lockfile (`npm ci` on a fresh checkout). Match existing code style;
  Prettier is installed. Avoid unrelated formatting or dependency changes.
- `npm run dev` starts Vite; `npm run build` checks the recording catalog and
  creates `dist/`. Stop temporary servers you started when finished.
- `npm test` runs the Node tests. Browser tests require a running Vite server:
  `TEST_URL=http://127.0.0.1:5174 npm run test:browser` (use its actual port).
  `CHROMIUM_PATH` can select an installed browser; alternatively install one
  with `npx playwright install chromium`. `PLAYWRIGHT_BROWSERS_PATH` supports a
  custom cache directory and must match for installation and test execution.
- The browser test named `unconfigured sign-in` expects Firebase config to be
  absent. If testing against a server using real `.env.local` config, exclude
  that test or use a separate server with the Firebase variables explicitly
  empty. Do not overwrite the developer's `.env.local` to change a test fixture.
- `npm run test:firebase` starts its own server and local Auth/Firestore
  emulators, runs rules and account browser tests, and shuts them down. It
  requires Java 21+ and uses the fake `demo-slowfolk` project.
- Use `tests/helpers/youtube.js` for deterministic iframe behavior in browser
  tests. Cover refresh/history and delayed account loading when changing routes.
- Run checks relevant to the change. For app releases, build and verify the
  affected browser flows; use Firebase emulator tests for account/data changes.

## Deployment

- Production: https://banjo.jamesianburns.com, private S3 behind CloudFront.
  AWS profile is `personal`; targets are in `infra/deployment.json`.
- Terraform requires >=1.10 and <2. Check the executable version first. The
  npm scripts accept `TERRAFORM_BIN`; use the same executable for direct
  Terraform commands. Do not change a user's global Terraform selection.
- `npm run infra:init` initializes the shared S3 state on a fresh checkout.
  For infrastructure changes, inspect a saved Terraform plan before applying.
  `infra/route-request.js` rewrites application paths to `/index.html`; preserve
  normal errors for missing scripts/audio. Update route tests with route changes.
- When deployment is requested, apply necessary infrastructure changes first,
  then `npm run deploy`. It checks the AWS account and Firebase build config,
  uploads assets before HTML, and waits for CloudFront invalidation.
- Verify the live release: direct-route HTTP responses and refresh, catalog and
  audio availability, and representative playback. Missing assets must not
  return the HTML app. Report the pushed commit and deployment status clearly.
- Keep `.env.local`, credentials, Terraform state/plans, `.terraform/`, and
  generated build/test artifacts out of Git. Commit the provider lockfile,
  catalog, and published audio. Never put private credentials in `VITE_` vars.
- Deployment is not implicit in every code edit. If a user requests push and/or
  deployment, complete that authorized workflow without asking again.
