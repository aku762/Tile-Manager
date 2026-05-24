# Feature Ideas

Unordered backlog of future directions. Not commitments — just things worth remembering.

Shipped items live in [SHIPPED.md](SHIPPED.md).

---

## Bugs / Issues

### Track page back link always goes to index

The `← Site Name` link in `track.html` is hardcoded to `href="/"`. If the user navigated from `/mixes.html` and clicked MORE, the back link should return them to `/mixes.html`, not the homepage.

**Fix options:**
1. **SPA-side patch** — in `navigate()`, after swapping `#main`, find `.track-back` in the new content and update its `href` to the URL that was current before the pushState. Works perfectly for SPA navigations. Store the pre-navigation URL in a variable before calling `pushState`.
2. **Direct-load fallback** — for hard-loaded track pages, check `document.referrer`. If it's same-origin, use it; otherwise fall back to `/`. Combined with option 1, this covers both entry paths.
3. **`history.back()`** — simplest for SPA case, but breaks on direct loads and doesn't let the browser show a meaningful destination in the status bar on hover.

Option 1 + 2 together is the right fix. `navigate()` already has access to the current URL before pushing state — it just needs to write it to the back link's `href` after the DOM swap.

---

### Section ID collision breaks tile assignments on new section

Section IDs are sequential integers reassigned on every export based on array position. Adding a new section in the middle of the list shifts all IDs below it — any tiles already assigned to those sections silently move to the wrong section.

**Root cause:** ID encodes order. Array position in `tiles.json` already determines display order, so IDs shouldn't need to.

**Fix:**
1. **Stable section IDs** — same fix needed for tiles (see [[Single tile tag + stable tile IDs]]). IDs should be assigned once at creation and never reassigned. New sections get a timestamp-based or user-defined ID. Display order comes from array position, not ID value.
2. **`order` field** — explicit integer for controlling display order, independent of ID. Lets IDs be arbitrary stable strings.
3. **Accept section name in tile `section` field** — tiles currently reference sections by ID string. Also accepting the section's `title` as a lookup value would let you write `"section": "TRACKS"` instead of `"section": "3"`, which survives any ID renumbering. Case-insensitive match, ID takes priority if both match.

The stable ID fix is the real solution — once IDs are stable, the name-lookup is a convenience rather than a workaround.

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

### Track schema: genre and BPM fields

The `MusicRecording` schema on track pages is currently missing `genre` and tempo properties. Google uses these for richer track cards in search.

**What to add to tile JSON:**
- `genre` — string (e.g. `"Breaks"`, `"Hip-Hop"`, `"Drum & Bass"`). Already used in tile display; needs to be a first-class field rather than just part of `cat`.
- `bpm` — integer. Used in `MusicRecording` as the `tempo` property.

**Touch points:**
1. **`tiles.json`** — add `genre` and `bpm` to tile objects
2. **Admin tile modal** — add Genre (text input) and BPM (number input) fields in the add/edit modal
3. **`build.js` track schema** — emit `"genre": tile.genre` and `"tempo": tile.bpm` into the `MusicRecording` JSON-LD when present. Also pass `genre` into `byArtist` at the `MusicGroup` level if it's not already there.

Note: `tile.cat` currently blends genre with format (e.g. "AUDIO / MP3"). Once `genre` is a dedicated field it can be cleaner — cat stays as the display label, genre is the pure schema value.

---

### Portrait tile display

Wide and square formats are shipped. This is the remaining layout work for portrait-oriented images.

**Implementation idea:** an `imageFormat` field on the tile (`"wide"` default, `"portrait"`, `"square"`). The CSS aspect-ratio and grid behavior switch based on a `data-format` attribute. `object-position` could also be a tile field (`"top"`, `"center"`, `"bottom"`) for fine control over how the subject sits in the crop.

On desktop, taller tiles break grid rhythm when mixed with wide neighbors — probably `object-fit: cover` + `object-position: top` with `align-self: start`. On mobile it's the natural format — image fills the viewport width, audio player overlay at the bottom if set.

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

## Section layout types (horizontal scrolling)

Sections carry their own layout type. Instead of template-level hacks, the section object in `tiles.json` declares how it renders — and `build.js` / `app.js` both honor it automatically everywhere the section appears.

**Data model addition:**
```json
{ "id": "3", "title": "TRACKS", "layout": "horizontal", "rows": 2 }
```
- `layout`: `"vertical"` (default, current behavior) or `"horizontal"` (left-right scroll with snap)
- `rows`: number of tile rows in a horizontal strip. Default `1`. Only meaningful when `layout: "horizontal"`.

**Admin — sections editor:** when creating or editing a section, a **Layout** dropdown appears: `VERTICAL` / `HORIZONTAL`. Choosing horizontal shows a **Rows** number input (default 1). This lives in the section modal alongside the existing title field. No new tab needed.

**Build/render behavior:**
- Vertical sections: exactly as today, no change to existing output
- Horizontal sections: `.tile-grid` gets `data-layout="horizontal" data-rows="N"` attributes. CSS handles the rest — `display: grid; grid-template-rows: repeat(N, auto); grid-auto-flow: column; overflow-x: auto; scroll-snap-type: x mandatory`. Tiles get `scroll-snap-align: start`. Tile stacking (`.tile-stack`) is suppressed for horizontal sections since stacks break column flow.

**Why this is the right primitive for a single-page app:**

A single `index.html` with just `<!--SECTIONS-->` becomes fully controllable. Five sections — picks (vertical featured), tracks (horizontal 2-row), mixes (horizontal 1-row), shows (vertical), links (vertical) — renders as a complete one-page app with distinct navigation zones. No separate pages needed for the browsing experience. Separate pages still exist for SEO and deep-linking, but the homepage tells the whole story.

The section type lives in the data, not the template. Changing a section from vertical to horizontal in the admin and re-exporting updates every page it appears on simultaneously.

**Relationship to separate pages:** not mutually exclusive. Horizontal sections are for browsing and discovery on the front page. Separate pages are for SEO, shareable URLs, and deeper content. Both can coexist — the front page uses horizontal sections, and each section also has a dedicated page for search indexing.

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

## Admin improvements

### Inline tile preview

Show a small visual preview of the tile card (image, name, status dot) inside the admin tile list row, rather than just text fields. Makes it easier to spot the right tile when you have many.

---

### Bulk actions

Select multiple tiles via checkboxes and apply an action to all of them at once — hide, show, change section, change status, delete.

---

### Search / filter

A text input in the admin toolbar that filters the tile list by name, description, or domain in real time. Useful once tile count gets large.

---

## Web platform APIs

### Service Worker + offline cache

A generated `sw.js` registered on page load. Caches the HTML, CSS, JS, and all tile images on first visit so the site works offline — or on a flaky connection on the way to the gig.

**Two cache strategies:**
- **Shell (cache-first):** `index.html`, `style.css`, `player.js`, `tiles.json` — always serve from cache, refresh in background
- **Audio (network-first with fallback):** audio files are large; try network first, fall back to cached version if offline. Cache on first play.

**What build generates:** `dist/sw.js` with a cache version string derived from the build date. A new build invalidates the old cache automatically.

**Registration:** one `<script>` tag in `index.html` — `navigator.serviceWorker.register('sw.js')`. Stripped in local preview like `app.js`.

---

### Screen Wake Lock

One call: `navigator.wakeLock.request('screen')` when audio starts, release when it pauses or ends. Prevents the screen from dimming mid-set while the lock screen controls are active. Already have the hooks in `audioPlay()`.

**Implementation:** 3–4 lines in `audioPlay()` and `_aud.onended`. Acquire on play, release on pause/end/tab-hidden. Re-acquire on `visibilitychange` (required by the spec — wake lock is released automatically when tab goes to background).

Note: this is a full-screen video player feature in practice. Audio keeps playing after screen lock via Media Session anyway. Most useful for a future now-playing modal that fills the screen.

---

### Persistent nav bar

CSS `position: fixed` with `backdrop-filter: blur` — same frosted glass as the track page back bar. On mobile, bottom-fixed tab bar is more thumb-friendly than top nav (iPhone pattern). On desktop, top bar.

**Content options:**
1. **Logo + filters** — move the existing filter buttons into a sticky bar so they're always accessible while scrolling
2. **Logo + section jumps** — link to each section by anchor; sections get `id` attributes at build time from their slugs
3. **Bottom tab bar** — icons for Home / Tracks / Mixes / Shows, each a link to a page or anchor. Driven by the `nav` array idea in [[Icon tiles / navigation buttons]].

**Lowest-friction start:** just make `#filters` sticky. One CSS change, no data model needed.

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
