# Feature Ideas

Unordered backlog of future directions. Not commitments — just things worth remembering.

---

## Groups

A named alias for a set of sections, placed in a page with a single comment tag.

**Problem it solves:** Once you have many sections and multiple HTML pages, hand-placing `<!--SECTION:1--><!--SECTION:3--><!--SECTION:9-->` is tedious and the admin has no visibility into which sections live on which page.

**Idea:** Add a `groups` array to `tiles.json`:
```json
"groups": [
  { "id": "projects", "label": "Projects", "sections": [3, 4, 9] }
]
```
Then any page can use `<!--GROUP:projects-->` instead of listing sections individually. The admin gets a Groups tab where you assign sections to groups via drag-and-drop.

**Key question:** Should a section be allowed in multiple groups? Probably yes — a "Latest Work" section could appear in both a homepage group and a portfolio group without duplicating data.

**Backwards compatible:** `<!--SECTIONS-->`, `<!--SECTION:ID-->`, `<!--FEATURED-->` all still work. Groups are additive.

---

## Pages

A `pages` array in `tiles.json` and a `site/pages/` folder. Each file in `site/pages/` is a named page — some have comment tags and tokens that get processed, some are finished pages that pass through untouched. The build doesn't care which is which; it just walks the tags and copies the result to `dist/`.

```json
"pages": [
  { "id": "index",    "file": "index.html",    "sections": ["1", "2"] },
  { "id": "projects", "file": "projects.html", "sections": ["3", "4"] },
  { "id": "calendar", "file": "calendar.html" }
]
```

`calendar.html` has no tags and no section assignments — it's just a finished page that needs to exist in the output. `projects.html` has `<!--SECTIONS-->` and gets tiles injected. Same mechanism, the file decides what processing happens.

**Admin — Pages tab:** lists all pages, lets you add/remove files from the pool, and for pages with section assignments lets you manage which sections appear. Importing a page is just copying an HTML file into `site/pages/` and registering it. No template concept — they're just pages.

**Note:** the current comment-tag walker in `build.js` and `app.js` is already the right primitive for this — not a detour, just an earlier layer of the same system.

---

## Tile types and detail pages

Currently all tiles are links (`href`). A `type` field on the tile would unlock richer behaviors — the tile card stays the same but the action on click changes.

**Proposed types:**
- `link` — current default, opens `href` in a new tab
- `modal` — opens a detail overlay in-page (image gallery, description, metadata)
- `video` — modal with an embedded video player
- `audio` — modal with an audio player
- `page` — auto-generates a full HTML detail page for this tile at build time

**Auto-generated detail pages (`type: "page"`):** `build.js` looks for a `<tilename>.md` file alongside the tile image in `site/source/tiles/`. If found, it renders a detail page (e.g. `dist/tiles/my-project.html`) from the tile's data and the markdown content. The tile card links to that generated page instead of an external URL. This feeds directly into the Pages system — detail pages are just another output of the build.

**Asset convention:**
```
site/source/tiles/
  my-project.webp     ← tile image
  my-project.md       ← detail page content (optional)
```

**Recursive tiles:** a detail page can itself contain `<!--SECTIONS-->` tags, rendering its own set of tiles. click a tile, land on a page, that page has more tiles. navigate a tree of content just by clicking, the whole way down. the data model already supports it — detail pages are just pages, and pages can have any tags. infinite depth, same build primitive.

*Tiles all the way down.*

**Why this matters:** it turns tile-manager into a lightweight content system — portfolio pieces, project writeups, audio/video showcases — all sourced from JSON + markdown + assets, no CMS needed.

---

## Slot Machine

A `<!--SLOT_MACHINE-->` tag that drops in a special widget: 3 tiles spin and lock on random picks from your library. A "feeling lucky" discovery feature for when you have a large tile collection and don't know what to open next.

Aesthetic: slot machine columns with favicons instead of cherries. Spin button to re-roll. Could also work as a tile type in the grid.

---

## Admin: inline tile preview

Show a small visual preview of the tile card (image, name, status dot) inside the admin tile list row, rather than just text fields. Makes it easier to spot the right tile when you have many.

---

## Admin: bulk actions

Select multiple tiles via checkboxes and apply an action to all of them at once — hide, show, change section, change status, delete.

---

## Search / filter in admin

A text input in the admin toolbar that filters the tile list by name, description, or domain in real time. Useful once tile count gets large.

---

## Known issues / things to address

### Mixed image/no-image tile height in multi-column grid

Tiles without images are compact and look great in single-column (mobile) — but in a multi-column layout they sit next to image tiles and stretch to match their height, leaving a large empty space where the image would be. A previous version filled that space with a CSS gradient which just looked like wasted real estate.

**Fix:** keep the algorithm dead simple — consecutive imageless tiles (up to 3) get wrapped in a single grid cell and stack vertically inside it. No reordering, no bin-packing. The user controls the visual outcome by arranging tiles in the admin and adding images where they want them. If the order produces gaps, they fix it by reordering or adding an image.

`build.js` detects runs of consecutive imageless tiles, caps the group at 3, wraps them in a `.tile-stack` container, and the grid treats the container as one cell. Runs longer than 3 start a new group.

**Constraint:** mobile single-column stays untouched — stacking only applies at 2+ columns via CSS media query on `.tile-stack`.

**Companion feature — image toggle:** add a `showImage` boolean field to tiles. When `false`, the tile renders as imageless even if an `image` filename is set — the asset stays in the JSON so it can be re-enabled anytime. Lets you tune layout without deleting image references: if one large image tile is hanging alone at the end of a row, flip `showImage: false` and it compacts into a stack with the preceding imageless tile. Admin gets a toggle button alongside the existing hide/show.
