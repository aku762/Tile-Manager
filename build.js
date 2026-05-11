'use strict';

const fs   = require('fs');
const path = require('path');

// ── Tile image breakpoints ───────────────────────────────────────────────
// These MUST match the .tile-grid media queries in style.css.
// The browser uses TILE_SIZES to pick the right WebP file at load time.
// If you update the grid breakpoints in style.css, change these too,
// then re-run `npm run build` so the new sizes land in index.html.
//
//   style.css reference:
//     @media (max-width: 1120px) → 2 columns → each tile ≈ 50vw
//     @media (max-width: 560px)  → 1 column  → each tile ≈ 100vw
//     default                    → 3 columns  → each tile ≈ 33vw
const TILE_BP_SINGLE = 560;
const TILE_BP_DOUBLE = 1120;
const TILE_SIZES     = `(max-width: ${TILE_BP_SINGLE}px) 100vw, (max-width: ${TILE_BP_DOUBLE}px) 50vw, 33vw`;

const STATUS_MAP = {
    live:     { dot: 'dot-live',     cls: 'status-live',     label: 'LIVE'     },
    building: { dot: 'dot-building', cls: 'status-building', label: 'BUILDING' },
    sale:     { dot: 'dot-sale',     cls: 'status-sale',     label: 'FOR SALE' },
    roadmap:  { dot: 'dot-roadmap',  cls: 'status-roadmap',  label: 'ROADMAP'  },
};

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

function buildTile(tile) {
    const s    = STATUS_MAP[tile.status] || STATUS_MAP.roadmap;
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

    // tile.desc and tile.cat are stored as raw HTML in tiles.json (same as app.js behaviour)
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
                    <div class="dot ${s.dot}"></div>
                    <span class="${s.cls}">${s.label}</span>
                </div>
                <div class="tile-domain">${tile.domain || ''}</div>
            </div>
        </${tag}>`;
}

function buildSections(sections, tiles) {
    return sections
        .map(sec => {
            const secTiles = tiles.filter(t => String(t.section) === String(sec.id));
            if (!secTiles.length) return '';
            return `
    <div class="section">
        <div class="section-header">${sec.title}</div>
        <div class="tile-grid">${secTiles.map(buildTile).join('')}
        </div>
    </div>`;
        })
        .join('\n');
}

const root     = __dirname;
const data     = JSON.parse(fs.readFileSync(path.join(root, 'tiles.json'), 'utf8'));
const template = fs.readFileSync(path.join(root, 'index.template.html'), 'utf8');

if (!template.includes('<!--SECTIONS-->')) {
    console.error('Error: <!--SECTIONS--> placeholder not found in index.template.html');
    process.exit(1);
}

const html = template.replace('<!--SECTIONS-->', buildSections(data.sections, data.tiles));
fs.writeFileSync(path.join(root, 'index.html'), html, 'utf8');
console.log(`Built index.html — ${data.tiles.length} tiles across ${data.sections.length} sections`);
