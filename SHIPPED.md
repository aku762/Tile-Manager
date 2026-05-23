# Shipped Features

Implemented ideas, preserved for reference. Active backlog is in [IDEAS.md](IDEAS.md).

---

### Share button

Share button (↗) in the tile footer on any tile that has a `slug` (audio) or `href` (non-audio). Uses `navigator.share()` on mobile for the native share sheet; falls back to clipboard copy with a ✓ confirmation on desktop. Audio share URL is constructed as `location.href.split('#')[0] + '#' + slug` at click time so it works in any environment.

Share URL for slug tiles points to the real track page (`/tracks/slug/`). Slug tiles render as `<div>` with a `MORE →` footer link — the share button is inline after the tile name and the whole-tile `<a>` is gone.

---

### Tile image formats: wide / square

`images/wide/`, `images/square/`, `images/portrait/` folder convention. Wide is used for tile display; square is tried first for Media Session artwork, wide as fallback. Same filename across all three.

| Format | Ratio | Use case |
|---|---|---|
| Wide | 1200×630 | Standard web tile, OG image |
| Square | 512×512 | Media Session API lock screen artwork |
| Portrait | 9×16 | Future portrait tile format |

---

### JSON-LD structured data

`MusicRecording` JSON-LD injected into every generated track page at build time — title, URL, description, image, `byArtist`, `inAlbum`, `audio`. Requires `url` in `site.json` for fully qualified URLs.

Site-level schema (`{{SITE_SCHEMA}}`) supports `schemaType` (e.g. `"MusicGroup"`), `artistName`, `sameAs`, `alternateName`, `genre`, `foundingLocation`, and `logo` — all driven from `site.json`. `artistName` controls `schema.name` independently of the site display title. `alternateName` emits alias names for Knowledge Graph disambiguation. `logo` maps from `site.logo` with the same URL-prefix pattern as `image`.

---

### Web App Manifest (PWA)

Build generates `dist/manifest.json` from `site.json`. With HTTPS and this manifest in place, Chrome/Edge show an install prompt and iOS Safari supports Add to Homescreen — the site runs in standalone mode with no browser chrome, its own splash screen, and an app icon.

`site.json` fields: `shortName` (PWA icon label, defaults to first word of `title`), `themeColor` (default `#0d0f12`).

iOS-specific meta tags added to `site/index.html`: `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style`.
