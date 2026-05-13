'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const CORE = path.join(ROOT, 'core');
const DIST = path.join(ROOT, 'dist');

// ── Tile image breakpoints ───────────────────────────────────────────────
// These MUST match the .tile-grid media queries in site/style.css.
// If you update the grid breakpoints, change these constants too,
// then re-run `npm run build` so the correct sizes land in dist/index.html.
//
//   style.css reference:
//     @media (max-width: 1120px) → 2 columns → each tile ≈ 50vw
//     @media (max-width:  560px) → 1 column  → each tile ≈ 100vw
//     default                    → 3 columns  → each tile ≈ 33vw
const TILE_BP_SINGLE = 560;
const TILE_BP_DOUBLE = 1120;
const TILE_SIZES     = `(max-width: ${TILE_BP_SINGLE}px) 100vw, (max-width: ${TILE_BP_DOUBLE}px) 50vw, 33vw`;

// Escape a value for use inside an HTML attribute (href, src, alt, etc.)
function attr(val) {
    return String(val ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// Escape a value for use as visible text content
function text(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function buildFilters(statuses) {
    return statuses.map(s =>
        `<button class="filter-btn" onclick="filter('${attr(s.id)}', this)">${text(s.label)}</button>`
    ).join('\n            ');
}

function buildTile(tile, statusMap) {
    const s    = statusMap[tile.status] || { label: tile.status.toUpperCase(), color: '#9aa8b3' };
    const tag  = tile.href ? 'a' : 'div';
    const link = tile.href
        ? ` href="${attr(tile.href)}" target="_blank" rel="noopener"`
        : '';

    const base    = (tile.image || '').replace(/\.[^.]+$/, '');
    const picture = base ? `<picture>
                <source type="image/webp"
                    srcset="images/tiles/webp600/${attr(base)}.webp 600w,
                            images/tiles/webp900/${attr(base)}.webp 900w"
                    sizes="${TILE_SIZES}">
                <img src="images/tiles/${attr(tile.image)}"
                    alt="${attr(tile.name)}" loading="lazy" decoding="async"
                    onerror="this.closest('.tile-img-wrap').style.display='none'">
            </picture>` : '';

    const favicon = tile.domain
        ? `<img class="tile-favicon" src="https://www.google.com/s2/favicons?domain=${attr(tile.domain.split('·')[0].trim())}&amp;sz=64" alt="" loading="lazy"> `
        : '';

    return `
        <${tag} class="tile" data-status="${attr(tile.status)}"${link}>
            <div class="tile-img-wrap">${picture}</div>
            <div class="tile-cat">${tile.cat}</div>
            <div class="tile-name">${favicon}${text(tile.name)}</div>
            <div class="tile-desc">${tile.desc}</div>
            <div class="tile-footer">
                <div class="status">
                    <div class="dot" style="background:${s.color}"></div>
                    <span style="color:${s.color};opacity:0.85">${s.label}</span>
                </div>
                <div class="tile-domain">${tile.domain || ''}</div>
            </div>
        </${tag}>`;
}

function buildSections(sections, tiles, statusMap) {
    return sections
        .map(sec => {
            const secTiles = tiles.filter(t => String(t.section) === String(sec.id));
            if (!secTiles.length) return '';
            return `
    <div class="section">
        <div class="section-header">${sec.title}</div>
        <div class="tile-grid">${secTiles.map(t => buildTile(t, statusMap)).join('')}
        </div>
    </div>`;
        })
        .join('\n');
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(s, d);
        else fs.copyFileSync(s, d);
    }
}

// ── Read inputs ──────────────────────────────────────────────────────────
const site = JSON.parse(fs.readFileSync(path.join(SITE, 'site.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(path.join(SITE, 'tiles.json'), 'utf8'));
let template = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');

if (!template.includes('<!--SECTIONS-->')) {
    console.error('Error: <!--SECTIONS--> placeholder not found in site/index.html');
    process.exit(1);
}
if (!template.includes('<!--FILTERS-->')) {
    console.error('Error: <!--FILTERS--> placeholder not found in site/index.html');
    process.exit(1);
}

// ── Strip local-preview lines (marker comment + app.js script tag) ────────
template = template
    .split('\n')
    .filter(l => !l.includes('local-preview:') && !l.includes('../core/app.js'))
    .join('\n');

// ── Substitute {{SITE_*}} tokens from site.json ──────────────────────────
const tokens = {
    '{{SITE_TITLE}}':       site.title       ?? '',
    '{{SITE_DESCRIPTION}}': site.description ?? '',
    '{{SITE_TAGLINE}}':     site.tagline     ?? '',
    '{{SITE_URL}}':         site.url         ?? '',
    '{{SITE_LOGO}}':        site.logo        ?? '',
    '{{SITE_OG}}':          site.og          ?? '',
    '{{SITE_FOOTER}}':      site.footer      ?? '',
};
for (const [token, value] of Object.entries(tokens)) {
    template = template.split(token).join(value);
}

// ── Inject pre-rendered filters and sections ─────────────────────────────
const statuses  = data.statuses || [];
const statusMap = Object.fromEntries(statuses.map(s => [s.id, s]));
const html = template
    .replace('<!--FILTERS-->',  buildFilters(statuses))
    .replace('<!--SECTIONS-->', buildSections(data.sections, data.tiles, statusMap));

// ── Write dist/ ──────────────────────────────────────────────────────────
fs.mkdirSync(DIST, { recursive: true });

// Generated site
fs.writeFileSync(path.join(DIST, 'index.html'), html, 'utf8');

// Site assets (style + tiles data for app.js fallback + images)
fs.copyFileSync(path.join(SITE, 'style.css'),  path.join(DIST, 'style.css'));
fs.copyFileSync(path.join(SITE, 'tiles.json'), path.join(DIST, 'tiles.json'));
const siteImages = path.join(SITE, 'images');
if (fs.existsSync(siteImages)) copyDir(siteImages, path.join(DIST, 'images'));

// Core engine files (admin panel + local preview fallback)
fs.copyFileSync(path.join(CORE, 'admin.html'), path.join(DIST, 'admin.html'));
fs.copyFileSync(path.join(CORE, 'admin.css'),  path.join(DIST, 'admin.css'));
fs.copyFileSync(path.join(CORE, 'admin.js'),   path.join(DIST, 'admin.js'));
fs.copyFileSync(path.join(CORE, 'app.js'),     path.join(DIST, 'app.js'));

console.log(`Built dist/ — ${data.tiles.length} tiles across ${data.sections.length} sections`);
