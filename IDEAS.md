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

A fully data-driven page layer — `build.js` generates HTML files from page definitions in `tiles.json`, no hand-authored HTML needed.

**Problem it solves:** Multi-page sites currently require manually creating and maintaining HTML files.

**Tradeoff:** Loses freeform HTML authoring flexibility (custom hero blocks, per-page layouts). Would need a hybrid model or template system to compensate. Groups is probably the better first step.

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
