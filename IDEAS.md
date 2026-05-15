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

Opt-in page generation via a `pages` array in `tiles.json`. If a page definition exists, `build.js` auto-generates that HTML file. If a hand-authored HTML file exists in `site/`, it gets processed as-is with its comment tags. Both outputs land in `dist/` from the same build step — no conflict.

```json
"pages": [
  { "id": "projects", "file": "projects.html", "sections": ["3", "4"] }
]
```

**Hybrid model:** your homepage and a projects page could be auto-generated while other pages are hand-authored — maybe one uses `<!--FEATURED-->` and a custom hero block, another just gets its sections injected via `<!--SECTION:ID-->`. You opt in per page.

**The actual answer — templates:** every page is a template. The distinction between hand-authored and auto-generated disappears — you write a template once (e.g. `site/templates/default.html`, `site/templates/projects.html`) and the page definition in `tiles.json` points to it with a section assignment. Bespoke layouts get their own template, generic pages share one. Same tag-walking mechanism handles both.

```json
"pages": [
  { "id": "index",    "template": "default.html",  "sections": ["1", "2"] },
  { "id": "projects", "template": "projects.html", "sections": ["3", "4"] },
  { "id": "links",    "template": "default.html",  "sections": ["5"] }
]
```

Admin could eventually show a template picker per page — whatever `.html` files exist in `site/templates/` appear as options. Data and presentation fully separated.

**Note:** the current comment-tag walker in `build.js` and `app.js` is already the right primitive for this — not a detour, just an earlier layer of the same system.

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
