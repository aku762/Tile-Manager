# Feature Ideas

Unordered backlog of future directions. Not commitments — just things worth remembering.

---

### Share button

**Shipped:** Share button (↗) in the tile footer on any tile that has a `slug` (audio) or `href` (non-audio). Uses `navigator.share()` on mobile for the native share sheet; falls back to clipboard copy with a ✓ confirmation on desktop. Audio share URL is constructed as `location.href.split('#')[0] + '#' + slug` at click time so it works in any environment.

**Shipped:** Share URL for slug tiles now points to the real track page (`/tracks/slug/`). Slug tiles render as `<div>` with a `MORE →` footer link — the share button is inline after the tile name and the whole-tile `<a>` is gone.

---

---

### Albums

A first-class `albums` array in `tiles.json` and an **Albums** tab in the admin, modeled after the Sections tab.

**Data model:**
- `album` on a tile becomes a foreign key reference to an album `id` (same pattern as `section`). Tiles that reference an album ID appear on that album's generated page automatically.
- The album object holds: `id`, `title`, `artist`, `description`, `cover` (image filename), `releaseDate`, and a `tracks` array.
- `tracks` is an ordered list that can contain either a tile `id` reference OR a free-text entry `{ "name": "...", "artist": "..." }` — needed for DJ mixes where most tracks aren't your own productions and won't have tiles.

**Admin — Albums tab:**
- Create/edit/delete albums with a modal (title, artist, description, cover, release date)
- Tracklist builder: pick from existing tiles via a searchable checkbox list, supplement with free-text input rows for non-tile tracks
- Drag to reorder the tracklist
- Export writes the `albums` array to `tiles.json`

**Build — two album page types:**
- **Original album** (all tracks have tiles) — renders full tile cards with player, artwork, description, share button. Essentially a section page scoped to that album. Same tile layout the homepage uses.
- **Mix / compilation** — renders a simple ordered tracklist. Tile-referenced tracks get a player and link; free-text entries are listed plainly. Typically has one full-mix audio tile at the top.
- Both types get `MusicAlbum` schema injected at build time. `MusicRecording` entries inside can carry `sameAs` pointing to Spotify/MusicBrainz for tracks that exist there.

**Google rich results:**
- `MusicAlbum` schema triggers the album card treatment in search (tracklist, artist, artwork).
- `MusicPlaylist` is semantically correct for a DJ's front page catalogue but Google doesn't have a rich result template for it — use `MusicAlbum` for release pages to get the visual treatment.
- Per-track pages (`/tracks/slug/`) are needed for individual tracks to rank — album pages alone won't surface individual track searches.
- `sameAs` on `MusicRecording` entries links your schema to Google's Knowledge Graph entries for those tracks.

**Note:** the `album` string field on tiles today is only used for the Media Session lock screen card. When this ships, it becomes a reference ID. Migration: match existing string values to album IDs on first export.

---

### JSON-LD structured data

**Shipped:** `MusicRecording` JSON-LD injected into every generated track page at build time — title, URL, description, image, `byArtist`, `inAlbum`, `audio`. Requires `url` in `site.json` for fully qualified URLs.

---

## Three tile image formats: wide, portrait, square

**Shipped:** `images/wide/`, `images/square/`, `images/portrait/` folder convention. Wide is used for tile display; square is tried first for Media Session artwork, wide as fallback. Same filename across all three.

**Still to do:** portrait tile display — CSS aspect ratio and grid behavior for portrait-oriented images. See ideas above under *Vertical / portrait tile images* (now superseded by this entry).

Three canonical image shapes to design assets for:

| Format | Ratio | Use case |
|---|---|---|
| Wide | 1200×630 (current default) | Standard web tile, OG image, desktop-first layouts |
| Portrait | 9×16 or 3×4 | Mobile-first, full-bleed on single-column |
| Square | 1×1 (512×512 recommended) | Media Session API lock screen artwork, also works as a tile |

**Square is the immediate need** — Media Session API artwork on iOS/Android needs a square image. Best added as a second output from `convert-tiles.bat` alongside the wide: crop to 512×512, drop in `images/artwork/`, reference via `"artwork": "track.webp"` on the tile.

**Portrait** is the bigger layout project. On desktop, taller tiles break grid rhythm when mixed with wide neighbors — probably `object-fit: cover` + `object-position: top` with `align-self: start`. On mobile it's the natural format — image fills the viewport width, audio player overlay at the bottom if set.

**Implementation idea:** an `imageFormat` field on the tile (`"wide"` default, `"portrait"`, `"square"`). The CSS aspect-ratio and grid behavior switch based on a `data-format` attribute. `object-position` could also be a tile field (`"top"`, `"center"`, `"bottom"`) for fine control over how the subject sits in the crop.

---

## Featured tile duplication

Tiles with a `featured` order appear in both `<!--FEATURED-->` and their normal section via `<!--SECTIONS-->`. On pages with few tiles this is immediately noticeable — the same tile shows up twice. For audio auto-advance it means every track plays twice before stopping.

With section tags, the duplication is less of a problem in practice — you can use `<!--SECTION:ID-->` to place exactly the tiles you want without `<!--SECTIONS-->` pulling everything in. So this is mostly an issue on simple single-page layouts.

**Reframe:** "featured" is really just "pinned to top" — it's a position in the page, not a separate editorial concept. The tile still lives in its section; the featured block just surfaces it higher. That framing suggests the right fix isn't hiding tiles from sections, but making it easy to build a page where the pin and the section don't both appear at the same time.

**Options being considered:**

- **`showInSection` boolean on the featured section** (or `duplicateInSections: false`) — opt-out flag that suppresses featured tiles from their normal section when the featured block is present on the same page.
- **Scoped auto-advance** — audio auto-advance stays within the section the user started playing from, rather than walking all `.tile-audio` elements on the page. Naturally avoids cross-section duplicates.
- **No change** — use section tags to compose the page so the same tile never appears twice. Only a real problem on small catch-all pages.

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
