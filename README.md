# Slowfolk

A banjo practice room for learning by ear. Paste a YouTube video link, select a phrase, slow it down, and leave a pause between repeats to play it yourself.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Signed-out practice works without configuration. `npm run build` produces a static site in `dist/`; `npm run preview` serves that build. Optional Google sign-in and cloud saving use Firebase Authentication and Cloud Firestore directly from the browser.

## Google sign-in and Firebase setup

1. Create a Firebase project in the [Firebase console](https://console.firebase.google.com/) or use an existing one. This integration needs Authentication and Firestore only; it does not require Firebase Storage, Cloud Functions, or a billing upgrade. You can start on the Spark plan.
2. Register a **Web app** under Project settings → Your apps. Firebase Hosting is optional; this site can still live on S3.
3. Copy `.env.example` to `.env.local` and fill in the web app's `apiKey`, `authDomain`, `projectId`, and `appId` values. These public client identifiers are embedded into the built site. Never put service account keys, private keys, or AWS credentials in a `VITE_` variable.
4. Under **Authentication → Sign-in method**, enable **Google** and select the support email. Under **Authentication → Settings → Authorized domains**, add `localhost`, `127.0.0.1` if used, and your actual deployed hostname (without a protocol or path). Use HTTPS for the deployed app, for example CloudFront in front of S3.
5. Create the **default Cloud Firestore database**, Standard edition, in production mode. Choose a suitable region. Publish the contents of **`firestore.rules`** in its Rules tab, or use the CLI commands below after checking the target project ID:

   ```sh
   npx firebase login
   npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
   ```

6. Restart the dev server after changing `.env.local`. For deployment, run `npm run build` with the real configuration present and upload `dist/`. Environment variables are build-time values; changing S3 settings alone will not change Firebase configuration.

These steps follow Firebase's [Google sign-in documentation](https://firebase.google.com/docs/auth/web/google-signin) and [Firestore access rules guidance](https://firebase.google.com/docs/firestore/security/rules-conditions). Missing configuration leaves local practice available and explains setup when Sign in is opened. Incomplete configuration is reported. Rules deny access unless the authenticated UID owns the document and submitted fields pass validation; the public API key is not the authorization boundary.

After signing in, **My account** shows cloud status and an explicit **Copy local data to this account** action. Signing in alone does not upload guest data. The import copies browser phrases, saved YouTube tunes, and completed scores, skips IDs already in the account, and leaves local originals in place. Account preferences start separately. Imports larger than 400 records use multiple batches; retrying a partially completed import skips already copied records.

The app syncs:

| Data                                                        | Firestore path                     |
| ----------------------------------------------------------- | ---------------------------------- |
| Saved loops and their playback settings                     | `users/{uid}/loops/{id}`           |
| YouTube tunes saved using **Save tune**                     | `users/{uid}/links/{videoId}`      |
| Completed ear-training rounds                               | `users/{uid}/scores/{id}`          |
| Speed, repeat gap, focus, volume, looping, and game options | `users/{uid}/settings/preferences` |

Each record is saved separately, so adding a phrase on one device does not overwrite another device's collection. Settings updates merge changed fields and are debounced to avoid a write for every slider movement. Completed scores are personal practice records, not a tamper-proof leaderboard. Current playback position, unfinished rounds, uploaded audio, and local recording drafts are not synced. Account changes pause playback and reset the practice screen to keep sessions separate. Signing out restores the browser's guest library and preferences.

The cloud cache is memory-only; account records are not copied into guest localStorage or IndexedDB. Firebase remembers the login in the browser, so sign out on a shared device. While offline, cloud changes can remain pending: keep the tab open until **Saved to your account** appears. Signing out waits for pending writes; reconnect first if a save is waiting. Reloading or closing while offline can lose unacknowledged changes. Cloud errors and usage-limit failures are shown in the app; **Retry connection** reloads subscriptions. It does not silently re-create a failed phrase or score.

For local Firebase testing, install Java 21+ and run:

```sh
npm run test:firebase
```

This starts Auth and Firestore emulators, validates ownership and field rules, runs browser tests, then stops the test services. Set `CHROMIUM_PATH` to an installed Chromium executable if needed. To explore manually, run `npm run emulators` and, in another terminal, `npm run dev -- --mode emulator`. `.env.emulator` contains only fake `demo-slowfolk` settings; the emulator code is development-only and rejects non-demo project IDs. The test command supplies its own configuration so it never uses a real Firebase project. Do not use emulator mode for a deployment build.

## Practice controls

- Paste a YouTube watch, short, live, or share URL. The video must allow embedding and be playable in your region/browser.
- Drag across the timeline to select a phrase. Drag A/B, edit their timestamps, or focus a handle and use the arrow keys for 0.1-second adjustments.
- Set playback to 0.25×, 0.5×, 0.75×, or 1×. Unsupported YouTube rates are disabled. Slowing playback preserves pitch.
- Set a 0–60 second pause between repeats. Press pause to cancel the countdown.
- Save phrases with their boundaries, speed, and pause. Signed-out phrases stay in this browser; signed-in phrases sync to your account. Use **Save tune** on a loaded YouTube video to keep its link in the saved library. Practice-room audio uploads are temporary; select the same file to reuse its phrases.
- Keyboard: Space plays/pauses, R returns to A, L toggles looping, `[` sets A, `]` sets B, left/right seek one second, and `?` opens help. Click outside the YouTube iframe before using page shortcuts.

The app starts with an original synthesized G-major plucked-string roll, so the controls can be tried immediately. This is a practice sample, not a recorded banjo performance.

## Banjo ear training

The games load a shared catalog from **`public/recordings/catalog.json`**, with permanent audio files in **`public/recordings/audio/`**. These are ordinary site assets, available to every visitor after deployment. The catalog starts empty until your recordings are added; the practice-room demo is not used as labeled training material.

- **Name that roll:** identify the picking pattern. Labels, filenames, key, and tempo remain hidden until the answer is checked.
- **Roll + chord:** identify both the roll and the chord relative to the key (I, ii, iii, IV, V, vi, vii°). Both must be correct for a point. The key is supplied, with a tonic reference button; this is not an absolute-pitch test.
- **Find the note:** identify a single note in a supplied major key, answering with either scale degrees (1–7) or note names. Octave is ignored.

Label each recording with its type and major key. Roll recordings also need a roll name and, for the harder game, a chord label. Tempo is optional and describes the **recorded** BPM; game playback uses the original speed and pitch. Note recordings need a scale degree, with the corresponding note name shown in the editor. Common roll names are suggested, and custom names are supported.

Use short clips containing one complete roll pattern or one note, without spoken answers. Supported audio formats depend on the browser; MP3 and WAV are good choices. Each clip must be at most 25 MB and 90 seconds. Listen to the preview and verify its labels before saving. The app does not infer labels from the sound.

Two different roll types unlock the roll game; two different scale degrees unlock the note game. The harder roll game additionally requires recordings on two or more chords. For a useful challenge, record **each roll on several chords**, rather than associating one roll exclusively with one chord. Add separate takes at different speeds and in different keys. Each round balances answer categories, with randomized questions and takes; short libraries reuse recordings. Key and recorded-tempo filters narrow the available clips.

Rounds have 5, 10, or 20 questions. Listen before choosing an answer, replay freely, check the answer, and continue. The results show correct answers and offer a round containing just the missed questions. Completed round scores are saved; ending an unfinished round discards that round.

This version supports the twelve major keys, their diatonic chords, and their seven scale degrees. Minor keys and chromatic notes are not yet included. The optional tonic reference is a synthesized sine tone in standard A=440 tuning, not a banjo sample.

**Site recordings are permanent assets, not browser uploads.** Clearing browser storage does not remove them. Signed-out scores and unfinished recording drafts use IndexedDB; signed-in scores use Firestore. The games still play site recordings when browser storage is unavailable.

## Adding permanent recordings

The recording editor is an authoring tool, not an upload service. It can be used locally before publishing the static site:

1. Open **Ear training → Recording library → Add draft recording**.
2. Select a clip, label it, preview it, and choose **Save draft**. Existing recordings from the original browser-only library are preserved here as drafts.
3. Optionally enable **Preview my local drafts in games** to try them. Drafts are excluded from the shared game library by default.
4. Choose **Export draft bundle**. The downloaded `slowfolk-recordings.json` contains both audio and labels.
5. From the project directory, import the downloaded bundle:

   ```sh
   npm run recordings:import -- /path/to/slowfolk-recordings.json
   npm run build
   ```

The importer extracts audio into `public/recordings/audio/` and adds entries to `public/recordings/catalog.json`. IDs are stable; importing the same draft again updates its labels rather than duplicating it. Audio filenames contain a content hash, so changed audio receives a new URL. Existing recordings not in the bundle are kept. The importer validates the entire bundle before writing and updates the catalog atomically. It does not deploy anything or require AWS credentials.

Keep the catalog and audio files with the project (commit both when the project is in Git). `npm run build` checks all catalog entries and fails if a referenced audio file is missing or empty, then copies everything into `dist/recordings/`. You can also run `npm run recordings:check` directly. To relabel permanent recordings, edit their catalog metadata or reimport the same draft. To retire a recording, remove its catalog entry; unused audio can be cleaned up separately after deployment.

You can also add files and catalog entries directly, without the editor. A minimal catalog looks like this (the audio file must actually exist):

```json
{
  "version": 1,
  "recordings": [
    {
      "id": "forward-g-80-i",
      "title": "Forward roll in G, 80 BPM, I chord",
      "kind": "roll",
      "roll": "Forward roll",
      "key": "G",
      "chord": "I",
      "bpm": 80,
      "duration": 3.2,
      "src": "audio/forward-g-80-i.wav"
    }
  ]
}
```

For single notes, use `"kind": "note"` and `"degree": "1"` through `"7"` instead of `roll` and `chord`. Keys use the spelling in the editor, including `♭` and `♯`. Audio paths must be local filenames under `audio/`. Keep your source recordings: clearing browser storage removes drafts that have not been exported, while permanent site assets remain intact.

## Hosting on S3

The production site is entirely static. **Deploy the contents of `dist/` together**, including `index.html`, `assets/`, and `recordings/`. No custom backend or AWS credential runs in the browser. Optional Firebase Authentication and Firestore provide account services independently of S3. The recording import script runs on your computer before the build, not in S3. Recording catalog requests and audio playback use files served from the same site.

Set the site's index document to `index.html`. Navigation uses React state rather than URL routes, so no SPA route rewrites are required. Catalog responses should use `application/json`; serve audio using its appropriate audio content type. Revalidate `index.html` and `recordings/catalog.json` when deploying changes; content-hashed application and imported audio assets can be cached longer.

S3 supports this static hosting model. For HTTPS, use CloudFront in front of the bucket; S3 website endpoints themselves do not support HTTPS. Hosting setup and deployment are intentionally separate from this app change. See [AWS's S3 static website documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html).

Personal scores stay in the visitor's browser when signed out and sync with Firebase when signed in. Browser-local draft uploads never alter the public site. YouTube playback and Google Fonts still connect to their respective services.

## Audio focus and limitations

YouTube's official IFrame API exposes playback and seeking, but not the audio samples. YouTube therefore uses a selection timeline, not a fabricated waveform, and audio EQ is only available for uploaded files. The app does not download or extract YouTube audio.

For local recordings, Web Audio reduces low frequencies and adds presence around 2.4 kHz. This can make picking clearer, but **does not isolate the banjo** from overlapping instruments. True source separation would need a separate audio-processing service/model and access to a recording. A real waveform is computed locally when the browser supports decoding the file.

YouTube loop boundaries are best-effort: its seek/buffering behavior is not sample accurate. Looping and countdowns work best while the tab is visible; browsers may throttle background timers. Network and embedding restrictions can prevent a video from playing, and the app reports these failures.

Practice-room uploads and authoring drafts stay on your device. Published training recordings are served as site assets. YouTube connects to YouTube when a video is loaded. Fonts are loaded from Google Fonts with system fallbacks.

## Checks

```sh
npm test
npm run build
npx playwright install chromium
# With the dev server running on port 5173:
npm run test:browser
```

Set `TEST_URL` if the server uses another port. Set `CHROMIUM_PATH` to use an existing Chromium executable.

Browser checks cover actual local audio playback, loop/reply timing, pause cancellation, zero-gap looping, uploads, keyboard selection, saved phrases, mobile overflow, and YouTube control integration using an API fixture. Training checks cover recording import/edit/delete and persistence, hidden answer labels, roll/chord grading, note-name and scale-degree answers, missed-question review, completed-score persistence, and pausing the practice player when entering a game. Static-catalog checks cover playback without browser storage, draft exclusion, audio export, and HTTP-compatible IDs. Unit checks cover major-scale spelling, labels, filters, round balancing, grading, catalog paths, audio extraction, idempotent imports, and missing-file build validation. The YouTube fixture does not verify live YouTube availability.

Built with React, Vite, Web Audio, the YouTube IFrame Player API, Firebase, and Lucide icons. No custom server or embedded secrets.
