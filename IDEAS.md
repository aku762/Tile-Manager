# Feature Ideas

Unordered backlog of future directions. Not commitments — just things worth remembering.

---

## Export direct to GitHub repo

Push `tiles.json` straight from the admin to the GitHub repo via the GitHub Contents API — no file download, no terminal, no manual copy. Cloudflare Pages picks up the push and rebuilds automatically.

**How it works:**
1. Admin stores repo config in localStorage: GitHub PAT, owner, repo name, branch, file path
2. On push: GET the current file SHA, then PUT the new base64-encoded content with a commit message
3. Done — live site updates within seconds via Cloudflare's git webhook

**UI:**
- Gear icon in the admin toolbar opens a Repo Settings modal (one-time setup)
- "Push to Repo" button lives next to the existing Export JSON button
- Toast shows success or API error

**Auth — Cloudflare Worker + GitHub OAuth:**

localStorage PATs are per-device and a security risk on shared machines. The right solution is a tiny Cloudflare Worker that handles the OAuth flow:

1. Admin redirects to GitHub login
2. GitHub redirects back to the Worker with an auth code
3. Worker exchanges the code for an access token using the OAuth client secret (stored as a Worker environment variable — never exposed to the browser)
4. Worker sets a secure httpOnly session cookie
5. All GitHub API calls go through the Worker, which forwards them with the token

Result: any device — home PC, mobile, hotel lobby — just clicks "Login with GitHub", authorizes once, and is in. No keys to manage, session expires automatically, works everywhere.

The Worker is trivially light — a handful of OAuth redirect/callback/proxy routes. Usage would never come close to Cloudflare's free tier limits.

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

*(none currently)*

---

## Derivative projects

Ideas that use tile-manager as a foundation but may become their own repos. Preserved here until scope becomes clear — could end up as built-in tags, a separate package, or a standalone product.

### Webring

A modern federated webring protocol built on the tile-manager JSON schema. Each site publishes a `card.json` — logo, tagline, audio clip, blurb, status, link — and member sites fetch and render each other's cards as native tiles in their grid.

**Key concepts:**
- Each site is a node. Member sites list each other in their config.
- Mutual verification: your API checks if the other site lists you before rendering their card. No freeloading — both sides have to publish each other or neither shows.
- Ringmasters curate their ring manually. The protocol handles verification, not trust — trust is human.
- The prestige economy is built in: a selective ring is worth being on.
- A `<!--WEBRING:url-->` tag could render a horizontal scroller of member tiles natively in any tile-manager page.
- Rich cards replace the old "previous / next / random" banner — logo + audio + blurb + link, rendered as a first-class tile.

**Stack:** each node needs a small API (a Cloudflare Worker would do). The tile-manager JSON schema is already the card format. This might ship as a `<!--WEBRING-->` tag in tile-manager core, or as its own repo that depends on tile-manager.
