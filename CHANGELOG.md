# Changelog

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
