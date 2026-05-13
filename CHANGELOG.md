# Changelog

## 2026-05-13

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
