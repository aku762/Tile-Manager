# Changelog

## 2026-05-23

### Site schema: artistName, alternateName, logo

Three additions to the `MusicGroup` (or configured type) schema generated in `{{SITE_SCHEMA}}`:

- **`artistName`** — new `site.json` field that controls `schema.name` directly. Previously the schema name came from `title` with no way to decouple them. Leave blank to emit an empty name (no silent fallback).
- **`alternateName`** — array of aliases/stage names. Emits `schema.alternateName` for Knowledge Graph disambiguation.
- **`logo`** — `site.logo` was already a `site.json` field but was never emitted into the schema. Now maps to `schema.logo` using the same `site.url + '/' + site.logo` pattern as `schema.image`.

---

### SEO improvements to tile output

Three changes to `buildTile()` in `build.js`:

- **Image alt text** is now keyword-dense: `"Track Name — Category — Artist"` instead of just the name
- **Tile name is now a crawlable link** for audio tiles (`<a class="tile-name-link">`) — gives search engines the actual track title as anchor text pointing to the track page. Styled to look like plain text (no underline until hover). Doesn't apply to no-audio tiles whose whole tile is already an `<a>`.
- **MORE link gets a `title` attribute** with the track title for additional context

---

## 2026-05-22

### SPA navigation extended to track pages

Audio now persists when navigating to and from track pages (MORE links and back). Previously the router skipped any URL deeper than the root (`tracks/slug/` was a hard navigation that killed playback).

Three changes to `player.js`:
- Removed the depth restriction that blocked SPA navigation to `tracks/` URLs
- Moved `history.pushState` to before the DOM swap so relative image/audio URLs in new content resolve against the correct location
- `window._siteRoot` is now recalculated on each SPA navigation (based on URL depth) so player bar thumbnails stay correct

Track template gets `<div id="main">` wrapping the swappable content, which also activates the SPA click and popstate listeners when a track page is loaded directly. Site `#hero` (logo/tagline) is hidden when entering a track page and restored on return.

---

### Extract audio/player code to player.js

All audio, player bar, and SPA routing code moved from an inline `<script>` block in `site/index.html` into a standalone `site/player.js`. The file is copied to `dist/` at build time and loaded via `<script src="player.js">` on root pages and `<script src="../../player.js">` on track pages.

`window._siteRoot` (set inline before the script tag) tells the player where to resolve image paths — `''` on root pages, `'../../'` on track pages.

Track page template (`site/templates/track.html`) now includes the player bar HTML and loads the shared `player.js` directly; `build.js` no longer extracts an inline script block from `index.html`.

---

### Persistent bottom player bar + SPA routing

The audio player is now a fixed bar at the bottom of the screen — thumbnail, track name, artist, play/pause, scrubber, time. It slides up on first play and stays visible while navigating between pages.

Internal page navigation (nav links, same-directory `.html` pages) is intercepted and handled via `fetch` + `#main` swap — the page updates without a reload so audio never interrupts. Back and forward buttons work normally via `history.pushState` / `popstate`. Deep links (`tracks/slug/`) fall through to normal navigation since they have a different page structure.

The tile inline players still work as before. After a page swap, the tile play button refs are cleared (their DOM nodes are gone) but `_aud` keeps playing and the bar stays live.

---

### iOS PWA meta tags

Four Apple-specific tags added to `site/index.html`:
- `apple-touch-icon` — homescreen icon iOS uses (points at `site.icon`; 180×180 ideal)
- `apple-mobile-web-app-capable` — enables full-screen standalone mode when launched from homescreen
- `apple-mobile-web-app-title` — label under the icon, resolves to `shortName` in `site.json` (or first word of title)
- `apple-mobile-web-app-status-bar-style: black-translucent` — status bar overlays the page so the dark background bleeds to the top edge

`{{SITE_SHORT_NAME}}` token added to `build.js` and `app.js`.

---

### Web App Manifest — PWA installability

Build now generates `dist/manifest.json` from `site.json`. With HTTPS and this manifest in place, Chrome/Edge show an install prompt and iOS Safari supports Add to Homescreen — the site runs in standalone mode with no browser chrome, its own splash screen, and an app icon.

**What's generated:** `name`, `short_name` (first word of title, or override with `shortName` in `site.json`), `description`, `start_url: "/"`, `display: "standalone"`, `background_color`/`theme_color` (default `#0d0f12`, override with `themeColor` in `site.json`), and an `icons` entry from `site.icon`.

**`<head>` additions:** `<link rel="manifest">` and `<meta name="theme-color">` added to `site/index.html`. Theme color sets the browser chrome tint on Android while on the regular web.

For a proper install badge, provide a 192×192 or 512×512 PNG as your site icon. The `sizes: "any"` fallback works but dedicated PWA-sized icons get better treatment on some platforms.

---

### `<!--SECTION:ID-->` bypasses section visibility

Explicitly targeting a section with `<!--SECTION:ID-->` now renders it regardless of its `visible` flag. `<!--SECTIONS-->` still only outputs visible sections. This makes "hidden" mean "off the front page" rather than "off the site" — hide a section to keep it out of the bulk render, then pull it into a dedicated subpage with `<!--SECTION:ID-->`.

---

### Slug tiles without audio are fully clickable

Event/show/content tiles that have a slug but no audio now render as a full `<a>` to their track page — the whole tile is the click target. The `MORE →` footer link remains as a signal that there's more content. Only tiles with both audio and a slug stay as `<div>` (audio controls own the surface).

---

## 2026-05-21

### Switch to marked for markdown rendering

Replaced the custom `renderMarkdown()` function with the `marked` library. Now supports the full CommonMark spec — code blocks (` ``` `), inline code, lists, blockquotes, tables, images, and everything else. The custom renderer only handled headings, paragraphs, bold, italic, and links.

---

### Sitemap generation

`dist/sitemap.xml` is now generated at build time when `url` is set in `site.json`. Includes the homepage and all visible HTML pages at `priority 0.7`, and all slug-based track pages at `priority 0.8`. Uses today's date as `<lastmod>`. Skipped silently if `site.url` is empty.

---

### Remove mute button

Mute is a system-level concern — every device, OS, browser, and keyboard already handles it. Adding a 24th mute button to the UI was noise. Removed from tile player, track page player, and dead `audioMute()` function cleaned up.

---

### Share button — slug-only, always shares homepage hash

- Share button (↗) now only appears on tiles with a slug — slug is the signal that a tile has a shareable page
- Share URL always points to `site.com/#slug` so recipients land on the homepage at that tile, not an out-link or subpage
- Removed share button from non-slug link tiles — the domain label is sufficient as a destination cue

---

## 2026-05-20 (3)

### Slug tile UX — click surface separation

Slug tiles (audio + track page) previously wrapped the entire tile in an `<a>`, causing image taps, audio controls, and the share button to fight with page navigation.

- Slug tiles now render as `<div>` — no accidental navigation from image taps or audio controls
- `MORE →` link added to the tile footer (lower-right) pointing to the track page. If `domain` is set on the tile it shows as `DOMAIN →`; otherwise `MORE →`. Styled with the same blue pulse as the share button.
- Share button moved inline immediately after the tile name — reads as `TITLE ↗` with no right-justification gap
- Share button now calls `event.stopPropagation()` so it can't bubble to a parent `<a>` on link tiles
- Share URL for slug tiles updated from hash (`#slug`) to the real track page URL (`/tracks/slug/`)

---

## 2026-05-20 (2)

### Site-level schema token

- `{{SITE_SCHEMA}}` token added to `site/index.html` — replaced at build time with a `<script type="application/ld+json">` block generated from `site.json` fields.
- Set `schemaType` (e.g. `"MusicGroup"`) in `site.json` to enable. Leave empty and nothing is injected.
- `sameAs` array in `site.json` feeds into the schema — list official external profile URLs (Spotify, SoundCloud, MusicBrainz, etc.) to link your entity to Google's knowledge graph.
- `app.js` resolves the token to an empty string on local preview — schema is build-only.
- `genre` (array) and `foundingLocation` (string → `Place` object) added as optional `site.json` fields — both read by the schema generator. Google uses these to disambiguate artists.

---

## 2026-05-20

### Track page polish, schema, and slug wiring

**Admin:**
- Slug field now auto-fills and locks the Link URL field to `tracks/{slug}/` — entering a slug is all you need, no manual URL entry.

**Track pages:**
- `MusicRecording` JSON-LD schema injected into every track page `<head>` at build time — title, URL, description, image, `byArtist` (`MusicGroup`), `inAlbum` (`MusicAlbum`), `audio` (`AudioObject`). Set `url` in `site.json` for fully qualified URLs.
- Asset paths changed from `/`-prefixed to relative (`../../style.css`, `../../images/wide/...`) — fixes loading when opened locally via file://; production behavior unchanged.
- Hero image capped at 900px (matches player width), centered, `1.5rem` top gap from the nav bar, `10px` rounded corners.
- Track page tiles on the index now open in the same tab — slug presence is the signal for internal navigation.

**Bug fixes:**
- Audio play/mute buttons were purple — `var(--accent)` was never defined after the color scheme refactor. Fixed to `var(--blue)`.
- Audio controls enlarged: more padding, bigger buttons (`0.85rem`), taller scrubber bar (`4px`), larger timestamp (`0.58rem`).

---

## 2026-05-19 (7)

### Per-track generated pages

Build now generates a static HTML page for every tile that has a `slug` field, output to `dist/tracks/<slug>/index.html` (serves as `/tracks/<slug>/`).

- **`site/templates/track.html`** — new template file. Uses `{{TRACK_TITLE}}`, `{{TRACK_CAT}}`, `{{TRACK_DESC}}`, `{{TRACK_IMAGE}}`, `{{TRACK_SLUG}}`, `{{TRACK_META}}` tokens plus comment tags `<!--TRACK_HERO-->`, `<!--TRACK_PLAYER-->`, `<!--TRACK_SCRIPTS-->` replaced at build time. Full OG/Twitter meta with `og:type music.song`.
- **`core/build.js`** — added `renderInline()`, `renderMarkdown()`, and `buildTrackPages()`. Track pages inherit the audio player JS by extracting the inline `<script>` block from `site/index.html` at build time (no duplication). Markdown content loaded from `site/content/tracks/<slug>.md` if present.
- **`site/style.css`** — track page CSS: `.track-back-bar`, `.track-hero` (full-width image), `.track-main` (900px max-width), `.track-player-wrap` (styled audio bar), `.track-details`, `.track-title` (fluid clamp), `.track-content` typography.
- Build log now reports track page count: `Built dist/ — X tiles across Y sections, Z track pages`.

---

## 2026-05-19 (6)

### Share button

Share button (↗) added to the tile footer on any tile that has something to share:

- **Audio tile with slug** — shares `site.com/#slug` via the native share sheet on mobile (`navigator.share()`), copies to clipboard on desktop with a ✓ confirmation.
- **Non-audio tile with href** — same behavior using the tile's link URL.
- Tiles with neither a slug nor an href get no button.
- Button sits in the footer after the domain, in a new `.tile-footer-right` wrapper that keeps domain and share together on the right side.
- **Note:** when slugs become real URLs the share URL construction in `shareTrack()` will need updating — tracked in IDEAS.md.

---

## 2026-05-19 (5)

### Source folder restructure and per-format batch converters

- Moved `site/source/` to project root as `source/` — it was never part of the served or built site, so it doesn't belong under `site/`.
- Renamed `source/tiles/` → `source/wide/` to match the image folder convention.
- Each image format now has its own subfolder with a dedicated `convert-tiles.bat`:
  - `source/wide/` → `site/images/wide/` — 900px wide WebP (unchanged behavior)
  - `source/square/` → `site/images/square/` — 512×512 WebP, center-cropped
  - `source/portrait/` → `site/images/portrait/` — 1080×1920 WebP, center-cropped
- All bat files output directly into the correct `site/images/` subfolder and create it if missing.

---

## 2026-05-19 (4)

### Copy tile (yes, finally)

You can now copy a tile. COPY button in the action row opens a modal with the tile name pre-filled and a section dropdown — rename it, pick a destination, done. Featured status resets on copy since the star is earned, not inherited. This feature should have existed on day one and we're not talking about it.

---

## 2026-05-19 (3)

### Bug fix: featured order lost on tile edit

Editing any featured tile in the admin modal would silently drop its `featured` order number on save — the tile would vanish from the featured section and the remaining tiles would need to be re-starred and re-sorted manually. Root cause: `saveTile()` built a fresh tile object from form fields only, and `featured` was never included. Fixed by preserving `featured` from the existing tile on save, the same way `visible` and `showImage` are handled.

---

## 2026-05-19 (2)

### Hash routing and slug field

- Added `slug` field to tiles — short URL-safe string (e.g. `minimal-effort`).
- On play, the URL updates to `site.com/#slug` via `history.replaceState` so the link is always shareable without polluting browser history.
- On page load, the hash is read, the matching tile is scrolled into view, and playback starts automatically. On iOS, autoplay may be blocked by the browser until the user taps — the scroll still happens.
- `slug` field added to the audio section of the tile edit modal alongside track title.
- `app.js` calls `initHashRouting()` after tiles are hydrated for live preview; the built `dist/` calls it directly since tiles are already in the HTML.
- Added `preload="metadata"` when creating Audio objects — browser fetches duration without buffering the full file.

---

## 2026-05-19

### Media Session API, audio metadata, image folder structure

- Added `artist` and `album` optional fields to tiles — feed the OS lock screen card and future JSON-LD.
- Media Session API wired into `audioPlay()`: title, artist, album, and artwork update per track so iOS/Android lock screen and Control Center show the right info.
- Lock screen prev/next buttons work via `_audioGetAdjacent()` — same dedup logic as auto-advance.
- Artwork fallback priority: `images/square/filename` tried first (512×512 ideal for lock screen), falls back to `images/wide/filename` automatically — no field needed, just drop whichever sizes you have.
- Image folder convention: `images/tiles/` renamed to `images/wide/`. Two new sibling folders: `images/square/` and `images/portrait/`. Same filename across all three — the folder determines the format, not the tile data.
- `convert-tiles.bat` output updated to `images/wide/`.
- Admin modal: image, audio, artist, album grouped below a separator line at the bottom of the tile form.
- Auto image naming (`suggestImage`) removed — it was mangling tile names on rename.
- Scrubber handle: was invisible due to undefined `--accent` CSS variable. Fixed to `--blue` with a double-layer glow.

---

## 2026-05-17

### Audio tiles
- Added `audio` field to tiles — accepts a relative path (e.g. `audio/track.mp3`) or a full URL.
- Audio player renders inline in the tile: play/pause button, scrubber bar with handle dot, timestamp, and mute button.
- **Compact tile mode:** player bar appears above `.tile-cat` as a standalone row.
- **Image tile mode:** slim frosted player bar overlaid at the bottom of the image with `backdrop-filter: blur`.
- Clicking the image or gradient placeholder toggles play/pause (clicking the overlay controls themselves is not intercepted).
- Only one track plays at a time — starting a new tile pauses the previous one.
- Auto-advance: when a track ends, playback moves to the next `.tile-audio` element in DOM order. Stops at the last track.
- Player JS is inline in `site/index.html` so it is present in both local preview and the built `dist/` output.
- `core/admin.html` gains an **Audio** field in the tile edit modal.
- `core/build.js` and `core/app.js` both generate the player HTML for tiles with an `audio` field.

---

## 2026-05-15

### Copy JSON to clipboard
- Added **COPY JSON** button to the admin toolbar alongside EXPORT JSON.
- Copies the full `tiles.json` content to the clipboard in one click — useful on mobile where file downloads are awkward.
- Falls back with a toast if the Clipboard API is unavailable.

---

### Tile stacking and image control
- Consecutive imageless tiles (up to 2) are automatically grouped into a `.tile-stack` wrapper, occupying one grid cell with tiles splitting the height equally via `flex: 1`.
- Lone compact tiles outside a stack snap to their natural height (`align-self: start`) instead of stretching to match a tall neighbor.
- Mobile single-column: `.tile-stack` becomes `display: contents` so tiles flow normally.
- Added `showImage` field — default `false`. Toggle via the thumbnail in the admin tile list. When on, renders the image area (real image or gradient placeholder if no file set). When off, tile is compact and eligible for stacking.
- Added `expand` field — default `false`. Checkbox in the tile edit modal. Marks a tile as intentionally tall: always gets its own grid cell, never stacks, gradient placeholder suppressed even if `showImage` is on. Ignored on tiles with a real image.
- `showImage` and `expand` are mutually exclusive — turning on the thumbnail clears expand; checking expand clears showImage on save.
- Admin thumbnail column now shows the site favicon for tiles with a domain, or a styled initial for tiles without. Thumbnails are dimmed and greyscale when `showImage` is off. Clicking the thumbnail toggles `showImage`.
- Export only writes `showImage: true` and `expand: true` to JSON — omitted when false.

---

### showImage toggle
- Added `showImage` boolean field to tiles. Default is `false` — tiles render compact with no image area unless explicitly enabled.
- When `showImage: true`, the `.tile-img-wrap` is rendered. If the image file is missing, the gradient placeholder shows instead of hiding the space.
- Admin: tile thumbnail in the row list is now clickable — click to toggle `showImage` on/off. Thumbnail dims with greyscale when off. Tooltip shows current state.
- Export only writes `showImage: true` to JSON — omitted when false, keeping the file clean.

---

## 2026-05-14

### Simplified tile images
- Dropped the `webp600/` and `webp900/` subdirectory approach. Tile images are now served directly from `images/tiles/` with the full filename including extension stored in `tiles.json`.
- Any format works — `.webp`, `.jpg`, `.gif`, `.png` — just drop the file and reference it by full name.
- `<picture>` / `<source>` / `srcset` complexity removed from both `build.js` and `app.js`.
- `convert-tiles.bat` updated to output a single 900px webp directly into `images/tiles/` instead of `webp600/` and `webp900/` subdirectories.
- Admin image suggest function now defaults to `.webp`.
- `site/source/` folder is now tracked in the repo — the bat file and example source image are useful reference for anyone setting up their own site.

---

### Section tags
- `build.js` now processes all `*.html` files in `site/` (not just `index.html`), substituting `{{SITE_*}}` tokens and section comment tags in every page.
- Four comment placeholders supported:
  - `<!--SECTIONS-->` — renders all visible non-featured sections
  - `<!--FEATURED-->` — renders the featured section (tiles sorted by `featured` order)
  - `<!--SECTION:ID-->` — renders one specific section by its ID
  - `<!--FILTERS-->` — renders the status filter buttons
- All tags are optional; any tag absent from a page is silently skipped.
- `app.js` is now file-independent — it uses a `NodeFilter.SHOW_COMMENT` TreeWalker to locate and replace the same four comment tags at runtime for local preview. No dependency on specific container element IDs.
- `site/index.html` updated to use `<!--FEATURED-->` and `<!--SECTIONS-->` directly, removing the `<div id="sections-container">` wrapper.

---

## 2026-05-13

### SITE_ICON token
- Added `{{SITE_ICON}}` token to the site config system, following the same pattern as `{{SITE_LOGO}}` and `{{SITE_OG}}`.
- `site/index.html` now includes `<link rel="icon" href="{{SITE_ICON}}">` — replaced at build time by `build.js`.
- `app.js` substitutes the token in the TOKENS map and also sets `iconLink.href` directly for the local preview, since the generic text-node walker doesn't cover `<link href>` attributes.
- `site/site.json` gains an `icon` field; default value is `images/icon.png`.
- README token table updated.

---

### Tile visibility
- Added `visible` field to tiles. Set `false` to hide a tile from the built site and local preview without deleting it.
- Admin tile rows get a **HIDE / SHOW** toggle button. Hidden rows display with an orange left border, background tint, and strikethrough on the tile name.
- `build.js` and `app.js` both filter out hidden tiles.

### Section visibility
- Added `visible` field to sections. Same behavior as tile visibility — hidden sections are excluded from the built site and local preview.
- Admin sections tab gets a **HIDE / SHOW** toggle per section.
- Section dropdown in the tile edit modal appends `[HIDDEN]` to hidden section names, and shows an orange warning when a tile's assigned section is hidden.
- Tiles tab gains a **SHOW HIDDEN** toolbar button that reveals tiles from hidden sections in the all-sections view. The button is hidden when a specific section filter is active.
- Section column in the tile list appends `[HIDDEN]` to hidden section names when SHOW HIDDEN is active.

### Featured section
- Any section can be marked `featured: true` in `tiles.json`. That section renders tiles by their `featured` order number rather than by section assignment — tiles from any section can appear in it.
- Tiles gain an optional `featured` field (positive integer = featured order, absent/0 = not featured).
- Admin tile rows get a star toggle (☆ / ★). Clicking ☆ features the tile at the next available position; clicking ★ removes it and compacts the remaining order numbers.
- Selecting the featured section in the admin toolbar filter shows starred tiles in order with drag-to-reorder that updates `featured` numbers.
- The featured section cannot be deleted — only hidden. It shows a `FEATURED` badge in the sections tab.
- `build.js` and `app.js` handle featured section rendering automatically.

## 2026-05-12

### Dynamic statuses
- Statuses are now fully user-defined in `tiles.json` — id, label, and hex color.
- Admin gains a **Statuses** tab: add, edit, delete status entries with a color picker.
- The public site filter bar is generated from whatever statuses exist in `tiles.json`.
- Deleting a status that is still referenced by tiles shows a blocking error.
