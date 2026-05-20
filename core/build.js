'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const CORE = path.join(ROOT, 'core');
const DIST = path.join(ROOT, 'dist');


function attr(val) {
    return String(val ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

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

    const showImg = tile.showImage && !(tile.expand && !tile.image);
    const audioBar = tile.audio
        ? `<div class="tile-audio${showImg ? ' tile-audio-overlay' : ''}" data-src="${attr(tile.audio)}" data-name="${attr(tile.name)}" data-track="${attr(tile.track || '')}" data-slug="${attr(tile.slug || '')}" data-artist="${attr(tile.artist || '')}" data-album="${attr(tile.album || '')}" data-image="${attr(tile.image || '')}"><button class="audio-btn" onclick="audioPlay(this)">▶</button><div class="audio-bar" onclick="audioSeek(event,this)"><div class="audio-prog"></div></div><span class="audio-time">0:00</span><button class="audio-btn" onclick="audioMute(this)">🔊</button></div>`
        : '';
    const imgWrap = showImg
        ? `\n            <div class="tile-img-wrap${tile.audio ? ' tile-img-audio' : ''}"${tile.audio ? ' onclick="audioImgPlay(event,this)"' : ''}>${tile.image ? `<img src="images/wide/${attr(tile.image)}" alt="${attr(tile.name)}" loading="lazy" decoding="async" onerror="this.style.display='none'">` : ''}${audioBar}</div>`
        : '';

    const favicon = tile.domain
        ? `<img class="tile-favicon" src="https://www.google.com/s2/favicons?domain=${attr(tile.domain.split('·')[0].trim())}&amp;sz=64" alt="" loading="lazy"> `
        : '';

    const tileClass = `tile${!tile.showImage && !tile.expand ? ' tile-compact' : ''}${tile.expand ? ' tile-expand' : ''}`;

    return `
        <${tag} class="${tileClass}" data-status="${attr(tile.status)}"${link}>${imgWrap}${!showImg && audioBar ? `\n            ${audioBar}` : ''}
            <div class="tile-cat">${tile.cat}</div>
            <div class="tile-name">${favicon}${text(tile.name)}${tile.slug ? `<button class="share-btn" data-slug="${attr(tile.slug)}" data-title="${attr(tile.track || tile.name)}" onclick="shareTrack(this)">↗</button>` : tile.href ? `<button class="share-btn" data-href="${attr(tile.href)}" data-title="${attr(tile.name)}" onclick="shareTrack(this)">↗</button>` : ''}</div>
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

function stackTiles(tileData, htmls) {
    const result = [];
    let i = 0;
    while (i < tileData.length) {
        if (!tileData[i].showImage && !tileData[i].expand) {
            const group = [];
            while (i < tileData.length && !tileData[i].showImage && !tileData[i].expand && group.length < 2) {
                group.push(htmls[i++]);
            }
            result.push(group.length > 1 ? `<div class="tile-stack">${group.join('')}</div>` : group[0]);
        } else {
            result.push(htmls[i++]);
        }
    }
    return result;
}

function buildSectionHtml(sec, secTiles) {
    if (!secTiles.length) return '';
    return `
    <div class="section">
        <div class="section-header">${text(sec.title)}</div>
        <div class="tile-grid">${secTiles.join('')}
        </div>
    </div>`;
}

// <!--SECTIONS--> — all visible non-featured sections
function buildSections(sections, tiles, statusMap) {
    return sections
        .filter(sec => sec.visible !== false && !sec.featured)
        .map(sec => {
            const secTileData = tiles.filter(t => String(t.section) === String(sec.id) && t.visible !== false);
            const secTiles = stackTiles(secTileData, secTileData.map(t => buildTile(t, statusMap)));
            return buildSectionHtml(sec, secTiles);
        })
        .join('\n');
}

// <!--FEATURED--> — the featured section's tiles sorted by featured order
function buildFeatured(sections, tiles, statusMap) {
    const sec = sections.find(s => s.featured && s.visible !== false);
    if (!sec) return '';
    const secTileData = tiles.filter(t => t.visible !== false && t.featured > 0).sort((a, b) => a.featured - b.featured);
    const secTiles = stackTiles(secTileData, secTileData.map(t => buildTile(t, statusMap)));
    return buildSectionHtml(sec, secTiles);
}

// <!--SECTION:ID--> — one specific section by ID
function buildSingleSection(id, sections, tiles, statusMap) {
    const sec = sections.find(s => String(s.id) === String(id) && s.visible !== false);
    if (!sec) return '';
    if (sec.featured) return buildFeatured(sections, tiles, statusMap);
    const secTileData = tiles.filter(t => String(t.section) === String(id) && t.visible !== false);
    const secTiles = stackTiles(secTileData, secTileData.map(t => buildTile(t, statusMap)));
    return buildSectionHtml(sec, secTiles);
}

function processTemplate(template, site, data, statusMap) {
    // Strip local-preview lines (marker comment + app.js script tag)
    template = template
        .split('\n')
        .filter(l => !l.includes('local-preview:') && !l.includes('../core/app.js'))
        .join('\n');

    // Substitute {{SITE_*}} tokens from site.json
    const tokens = {
        '{{SITE_TITLE}}':       site.title       ?? '',
        '{{SITE_DESCRIPTION}}': site.description ?? '',
        '{{SITE_TAGLINE}}':     site.tagline     ?? '',
        '{{SITE_URL}}':         site.url         ?? '',
        '{{SITE_LOGO}}':        site.logo        ?? '',
        '{{SITE_OG}}':          site.og          ?? '',
        '{{SITE_ICON}}':        site.icon        ?? '',
        '{{SITE_FOOTER}}':      site.footer      ?? '',
    };
    for (const [token, value] of Object.entries(tokens)) {
        template = template.split(token).join(value);
    }

    // Replace section/filter tags — all optional, silently skipped if absent
    const statuses = data.statuses || [];
    template = template.replace('<!--FILTERS-->',  buildFilters(statuses));
    template = template.replace('<!--SECTIONS-->', buildSections(data.sections, data.tiles, statusMap));
    template = template.replace('<!--FEATURED-->',  buildFeatured(data.sections, data.tiles, statusMap));
    template = template.replace(/<!--SECTION:([a-zA-Z0-9_]+)-->/g, (_, id) =>
        buildSingleSection(id, data.sections, data.tiles, statusMap)
    );

    return template;
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

const statuses  = data.statuses || [];
const statusMap = Object.fromEntries(statuses.map(s => [s.id, s]));

// ── Process all HTML files in site/ ─────────────────────────────────────
fs.mkdirSync(DIST, { recursive: true });

const htmlFiles = fs.readdirSync(SITE).filter(f => f.endsWith('.html'));
for (const file of htmlFiles) {
    const template = fs.readFileSync(path.join(SITE, file), 'utf8');
    fs.writeFileSync(path.join(DIST, file), processTemplate(template, site, data, statusMap), 'utf8');
}

// ── Copy assets ──────────────────────────────────────────────────────────
fs.copyFileSync(path.join(SITE, 'style.css'),  path.join(DIST, 'style.css'));
fs.copyFileSync(path.join(SITE, 'tiles.json'), path.join(DIST, 'tiles.json'));
const siteImages = path.join(SITE, 'images');
if (fs.existsSync(siteImages)) copyDir(siteImages, path.join(DIST, 'images'));

// Core engine files
fs.copyFileSync(path.join(CORE, 'admin.html'), path.join(DIST, 'admin.html'));
fs.copyFileSync(path.join(CORE, 'admin.css'),  path.join(DIST, 'admin.css'));
fs.copyFileSync(path.join(CORE, 'admin.js'),   path.join(DIST, 'admin.js'));
fs.copyFileSync(path.join(CORE, 'app.js'),     path.join(DIST, 'app.js'));

console.log(`Built dist/ — ${data.tiles.length} tiles across ${data.sections.length} sections`);
