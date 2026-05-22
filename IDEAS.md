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

**Where this gets powerful:** groups effectively allow multiple independent "favorites" or "highlights" collections — not just one featured section. A `<!--GROUP:live-favorites-->` on one page and `<!--GROUP:studio-picks-->` on another, each pulling a different hand-curated mix of sections. And because subpages do recursive tag scanning, you can drop a `<!--GROUP:id-->` directly inside a story or event MD template — the rendered page gets exactly those tiles and nothing else. Curated tile sets embedded in longform content, no CMS needed.

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

## Story / blog tiles

**Partially shipped:** the slug + MD file system already handles event/show/blog-post tiles — add a slug, drop a `.md` file in `site/content/tracks/`, and a full page builds automatically. The whole tile is clickable, `MORE →` signals there's content.

**What's still missing:**

- **Style differentiation.** Right now a blog-post tile looks identical to an audio tile. A `type: "story"` field (or just the absence of `audio`) could render the tile without a border — closer to a card or article preview. Or a softer border, a different background tint. The point is the viewer should sense "this is content to read" vs "this is a link or a track."

- **Admin workflow.** Currently you add a story tile the same way as any tile — through the tile modal. A dedicated **Stories tab** (or **Posts tab**) in the admin would be cleaner: title, date, image, slug, description, and a text area for the intro. The MD file would be auto-generated from the form rather than hand-written. For now the current workflow is acceptable.

- **File-based discovery.** An alternative to JSON-driven stories: `build.js` scans `site/content/posts/*.md`, reads frontmatter (title, date, image, slug), and auto-generates both the tile and the detail page without any `tiles.json` entry. Lower overhead for frequent publishing. Tradeoff: no admin UI, no section assignment, no status.

**Recursive depth:** a detail page can contain `<!--SECTIONS-->` tags, rendering its own tile grid. Tiles all the way down. The build primitive already supports this — detail pages are just pages.

---

## Icon tiles / navigation buttons

Small square tiles for mobile-first section navigation — think iPhone homescreen icons. The idea is a row of 4 (max) at the top of a page, each representing a section or page, with an image and optional one-line label. They stack to multiple rows if there are more than 4.

**Why this instead of a hamburger menu:** menus are hidden and require a tap to reveal. Icon tiles are always visible, glanceable, and immediately actionable. On a site split across multiple pages (picks, tracks, mixes, shows, links), these become the primary nav.

**Implementation options:**

1. **CSS-only, driven by `tiles.json`** — a new tile `type: "icon"` or `size: "icon"` renders with a square aspect ratio, image fills the cell, label is one short line below. No new data structure. Section/page link goes in `href`. This is the lowest-friction path.

2. **`site.json` nav array** — a `nav` array in `site.json` with `{ label, href, image }` entries. A `<!--NAV-->` tag renders the icon row. Cleanly separated from tile data since nav is site-level, not content-level.

3. **Sections as nav** — automatically generate an icon row from the section list, linking each to a per-section page. Only works once the Pages system exists.

**Option 1 is the right starting point** — reuses the existing tile pipeline, no new admin needed, just a CSS class and a new grid layout. Build the nav array idea later if the separation matters.

---

## Horizontal scrolling sections

On mobile, rather than one long vertical scroll of all sections, each section scrolls left-to-right. The page has a short vertical list of section headers; tapping/scrolling within a section moves horizontally through its tiles.

**The problem it solves:** with 50 tiles across 5 sections on one page, the viewer scrolls past section markers and loses context. Horizontal sections give each section a defined lane — you know where you are at all times.

**Implementation:** a `"scroll": "horizontal"` flag on a section in `tiles.json`. CSS changes for that section's `.tile-grid` to `display: flex; flex-wrap: nowrap; overflow-x: auto; scroll-snap-type: x mandatory`. Tiles get `scroll-snap-align: start`. On desktop, same grid layout as now. On mobile, horizontal scroll with snap.

**Row count:** default is 1 row (single strip). A `"rows": 2` flag on the section (or as a tag parameter — `<!--SECTION:id:rows=2-->`) would wrap tiles into a 2-row grid before the horizontal scroll. Good for sections with many tiles where a single strip would be too wide. Implementation: CSS grid with `grid-template-rows: repeat(N, auto)` + `auto-flow: column` so tiles fill columns instead of rows. Keep it configurable rather than hardcoded.

**No new JS needed** — CSS scroll snap handles the UX. The tile-stacking system would need to be disabled for horizontal sections (no `.tile-stack` wrappers when `scroll: horizontal`).

**Relationship to separate pages:** horizontal sections and separate pages solve the same problem from different angles. Separate pages are better for SEO and deep-linking. Horizontal sections are better for browsing and discovery. They're not mutually exclusive — separate pages can still exist, and the front page uses horizontal sections for quick navigation.

---

## Random picks widget

A `<!--RANDOM:section-id:count-->` comment tag that `app.js` replaces at runtime with N randomly selected tiles from the given section. Since `app.js` already runs in the browser and has `tiles.json`, this needs no build step — just a new tag handler. Useful for a front page "picks" block that changes every visit without manual curation.

**Practical version:** `<!--RANDOM:tracks:3-->` drops in 3 random track tiles from the tracks section. Count defaults to 1 if omitted. Respects `visible` flags.

**Slot machine variant:** the flashier version of the same primitive — 3 columns that spin and lock. Same data, different animation. Could ship as `<!--SLOT_MACHINE-->` separately or as a flag on the same tag. Aesthetic: slot machine columns with favicons instead of cherries. Spin to re-roll.

---

## Single tile tag + stable tile IDs

A `<!--TILE:identifier-->` tag that renders one specific tile anywhere — inside a story page, a section template, or the homepage. Useful for featuring a single track or event inline with other content.

**The ID stability problem:** tile `id` values are currently reassigned sequentially on every export (`1`, `2`, `3`...). This means `id` encodes order, not identity — if tiles are reordered, all IDs shift and any hardcoded `<!--TILE:5-->` tag silently renders the wrong tile. This needs to be fixed before `<!--TILE:id-->` is useful.

**Two-part fix:**

1. **Stable IDs** — stop reassigning IDs on export. A tile's ID should be the value it was born with and never change. Array position in `tiles.json` already encodes display order, so IDs don't need to. This is a breaking change for existing exports but straightforward: on first export after the update, existing IDs are preserved rather than renumbered. Going forward, new tiles get a timestamp-based ID (already how the admin creates them) and it sticks.

2. **Slug-based lookup** — `<!--TILE:my-slug-->` as an alternative to ID-based lookup. Slugs are user-defined, stable, and meaningful. Works immediately for any tile that has one without touching the ID system. Good enough for most use cases, implement this first.

**Combined:** `<!--TILE:my-slug-->` for slug tiles now; `<!--TILE:stable-id-->` once IDs are fixed for non-slug tiles.

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
