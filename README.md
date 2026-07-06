# Lift Log 🏋️

A local-first workout tracker PWA for logging weight lifting on your phone.

**Live app:** https://ewasoe05.github.io/Fun/

## Features

- **Fast set logging** — weight × reps per set, with last session's numbers shown beside each set
- **Routines** — build Push/Pull/Legs-style templates that pre-load your workout
- **Rest timer** — starts when you check off a set; vibrates, beeps, and notifies when rest is up
- **Progress charts** — estimated 1RM (Epley), top set, and session volume over time per exercise
- **Strength standards** — see where each big lift lands from Untrained → Elite for your bodyweight and sex
- **Exercise library** — ~40 built-in lifts, plus online search of the free [wger.de](https://wger.de) exercise database (instructions, muscles, images, demo videos), cached for offline use
- **Profiles** — multiple people can share a device, each with fully separate data
- **Local & private** — everything is stored in your browser (IndexedDB); one-tap JSON export/import for backups (per profile)
- **Offline-capable PWA** — works in the gym with no signal once installed

## Install it on your phone

1. Open **https://ewasoe05.github.io/Fun/** in your phone's browser
2. - **iPhone (Safari):** Share button → **Add to Home Screen**
   - **Android (Chrome):** Menu (⋮) → **Add to Home screen** / **Install app**
3. Open it from your home screen — it runs fullscreen like a native app

Your workout data lives only on your device. Use **Settings → Export data** for backups.

## Development

```bash
npm install
npm run dev        # local dev server
npm run build      # type-check + production build to dist/
npm run icons      # regenerate PWA icons (needs Chromium)
```

Built with Vite + React + TypeScript, Dexie (IndexedDB), Recharts, and vite-plugin-pwa.

## Deployment

Pushes to `main` deploy automatically to GitHub Pages via `.github/workflows/deploy.yml`.
One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.

## Credits

Exercise data from [wger](https://wger.de) (CC-BY-SA). Strength standards are simplified
bodyweight-ratio tables in `src/data/strength-standards.json`.
