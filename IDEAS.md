# Feature Ideas

Unordered backlog of future directions. Not commitments — just things worth remembering.

Shipped items live in [SHIPPED.md](SHIPPED.md).

---

## Project direction — Catalog Manager

The project is evolving toward something best described as a **catalog manager**: a tool for publishing any kind of organized collection as a static site. The name "tile-manager" describes the implementation; "Catalog Manager" describes what it's actually for.

The music features (track pages, MusicGroup/MusicRecording schema, Media Session API, lock screen artwork, BPM/genre fields) are the most developed expression of the system — but they're all additive. A site that doesn't use them ignores them. The underlying tile → section → build pipeline is already domain-agnostic.

**Use cases the system already handles or is heading toward:**

| Site type | Relevant features |
|---|---|
| DJ / producer | Track pages, audio player, MusicGroup schema, Media Session, lock screen art |
| Band / label | Same as above + Releases, MusicAlbum schema |
| General resale site | Buy tiles, sold/available status |
| Podcast | Audio tiles (no track pages needed), episode slugs for SEO |
| General store | Buy tiles, image tiles, link tiles |
| Portfolio / links page | Link tiles, info tiles, section layout |
| Event / show calendar | Info tiles, date fields, slug pages |

**Design principle going forward:** music-specific features are opt-in via configuration. A non-music site never sees them. The admin should eventually reflect this — onboarding asks what kind of site you're building and surfaces the relevant field groups.

---

## Buy / for-sale tiles — PayPal integration

The `buy` tile type and page generation are shipped. What's still missing is payment integration.

**Data fields to add to the buy tile modal:**
```json
{
  "paypalId": "ABCDEF123",
  "buyMode": "buynow"
}
```

- `paypalId` — hosted button ID from PayPal's button generator (simplest, no SDK)
- `buyMode` — `"buynow"` or `"cart"`

**Two integration approaches:**

1. **Hosted buttons (simplest)** — generate in PayPal's dashboard, copy the button ID. Build renders a standard PayPal form. No JS SDK, works everywhere.
2. **PayPal JS SDK (modern)** — load `sdk.js?client-id=...`, render Smart Payment Buttons into a `<div>`. Better UX, customizable. Requires `client-id` in `site.json`.

**`site.json` addition:** `paypalClientId` — site-level PayPal identity so individual tiles don't each embed credentials.

---

## Player bugs

### Player bar goes dead after track ends (no next track)

When a track ends with no next track in the catalog or DOM, `_aud`, `_audBtn`, `_audWrap`, and `_currentTrack` are all nulled out. The player bar stays visible but clicking play silently does nothing.

**Fix:** keep enough state to restart. When `onended` fires with no next track, preserve `_currentTrack` (don't null it) so the bar's play button can restart from the beginning rather than failing silently.

---

### Track page player out of sync with bar

Navigate to a track page while that track is playing — the track page `.tile-audio` shows ▶ while the bar shows ⏸. Clicking the track page player starts a second Audio object (two streams playing).

**Fix:** after every `navigate()` DOM swap, scan the new `#main` for a `.tile-audio` whose `data-src` matches `_currentTrack.src`. If found, re-attach `_audWrap`/`_audBtn` and set the button text to ⏸.

---

## Smart URL enrichment

Paste a URL into the admin tile modal and auto-populate fields. Domain determines the enrichment path.

**Discogs** (no proxy needed):
- Parse release ID from URL → `GET api.discogs.com/releases/{id}` (works directly from browser with `User-Agent`)
- Fills: name, artist, cat, desc, image
- Rate limit: 60/min unauthenticated; token stored in admin settings unlocks more

**eBay** (requires a proxy for auth):
- Parse item ID → Cloudflare Worker holds OAuth credentials, returns sanitized tile data
- Fills: name, price, image, desc

**Other:** Bandcamp (JSON-LD in page via Worker), Spotify (client credentials via Worker), generic oEmbed for YouTube/SoundCloud/Vimeo.

**Fallback:** pre-fill `href` + extract domain; user fills the rest manually.

**Admin settings panel:** "Integrations" section for Discogs token and API keys, stored in localStorage.

---

## Export direct to GitHub repo

Push `tiles.json` (and other JSONs) straight from the admin to the GitHub repo via the GitHub Contents API — no file download, no terminal. Cloudflare Pages picks up the push and rebuilds automatically.

**How it works:**
1. Admin stores repo config in localStorage: GitHub PAT, owner, repo name, branch, file path
2. On push: GET the current file SHA → PUT new base64-encoded content with a commit message

**Auth — Cloudflare Worker + GitHub OAuth:** Worker handles the OAuth flow (exchanges auth code for token using client secret stored as env var, never in browser), sets a secure httpOnly session cookie. Any device can log in with "Login with GitHub" without managing keys.

---

## Groups

A named alias for a set of sections, placed in a page with a single comment tag.

**Problem:** once you have many sections and multiple HTML pages, hand-placing `<!--SECTION:1--><!--SECTION:3--><!--SECTION:9-->` is tedious and the admin has no visibility into which sections appear on which page.

**Idea:** `groups` array in `tiles.json`:
```json
"groups": [
  { "id": "projects", "sections": ["3", "4", "9"] }
]
```
Then `<!--GROUP:projects-->` replaces individual section tags. Admin gets a Groups tab for drag-assigning sections to groups. A section can belong to multiple groups. Backwards compatible — existing tags still work.

---

## Pages

A `pages` array in `tiles.json` and `site/pages/` folder. Each file is registered. Build processes comment tags and copies to `dist/`. A Pages tab in the admin lists all pages and section assignments. Files without tags pass through untouched.

---

## Story / blog tiles

**Partially shipped:** slug + `.md` file in `site/content/tracks/` already builds a full detail page. What's still missing:

- **Style differentiation** — an info tile looks identical to an audio tile. A `type: "info"` specific style (softer border, different background tint) would signal "content to read" vs "track or link."
- **Admin workflow** — a dedicated Posts/Stories tab with title/date/slug/desc form that auto-generates the `.md` file, rather than using the generic tile modal.
- **File-based discovery** — `build.js` scans `site/content/posts/*.md` for frontmatter and auto-generates tiles + pages. No `tiles.json` entry needed; tradeoff is no section assignment or status control.

---

## Icon tiles / navigation buttons

Small square tiles for mobile-first section navigation — row of up to 4, each with an image and one-line label.

**Best option:** `type: "icon"` renders with a square aspect ratio, image fills, label below, `href` is the destination. Reuses tile pipeline, no new data structure.

---

## Section layout types (horizontal scrolling)

Sections declare their own layout in `tiles.json`:

```json
{ "id": "3", "title": "TRACKS", "layout": "horizontal", "rows": 2 }
```

Admin section modal gets a Layout dropdown. Build emits `data-layout="horizontal" data-rows="N"` on `.tile-grid`. CSS handles scroll snap. Tile stacking suppressed for horizontal sections.

A single `index.html` with `<!--SECTIONS-->` becomes a full one-page app — picks (vertical), tracks (horizontal 2-row), mixes (horizontal 1-row), shows (vertical) — with distinct browsing zones and no separate pages needed for the primary experience.

---

## Random picks widget

`<!--RANDOM:section-id:count-->` replaced at runtime by `app.js` with N random tiles from the section. No build step. Respects `visible` flags.

**Slot machine variant:** 3 columns that spin and lock. Same data, different animation.

---

## Single tile tag

`<!--TILE:slug-->` renders one specific tile anywhere — inside a story page, section template, or homepage. Useful for featuring a single track inline with other content. (Stable IDs are already shipped — the underlying requirement is met.)

---

## Admin improvements

- **Inline tile preview / card grid view** — toggle between the current list view and a card grid showing tiles as they appear on the site
- **Bulk actions** — checkboxes to hide/show/move/delete multiple tiles at once
- **Search / filter** — text input filtering the tile list by name, description, or domain in real time

---

## Web platform APIs

### Service Worker + offline cache

Generated `sw.js`. Shell (`index.html`, CSS, JS, JSON) cache-first; audio files network-first with cache fallback. Cache version derived from build date invalidates automatically on rebuild.

### Screen Wake Lock

`navigator.wakeLock.request('screen')` on play, release on pause/end. Prevents screen dimming mid-set. 3–4 lines in `audioPlay()` and `_aud.onended`. Re-acquire on `visibilitychange` (required by spec — lock releases when tab goes to background).

### Persistent nav bar

`position: fixed` with `backdrop-filter: blur`. Options: sticky filters bar (one CSS change, lowest friction), section jump anchors, or bottom tab bar for mobile driven by a `nav` array in `site.json`.

---

## Derivative projects

### Webring

A federated webring protocol built on the tile-manager JSON schema. Each site publishes a `card.json` — logo, tagline, audio clip, blurb, status, link — and member sites render each other's cards as native tiles.

Key concepts: mutual verification (both sides must list each other, or neither shows), ringmaster curation, `<!--WEBRING:url-->` tag for native rendering, rich cards (logo + audio + blurb) replace old previous/next banners. Each node needs a small Cloudflare Worker API.
