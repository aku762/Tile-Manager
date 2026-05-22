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
    // Slug tiles are never <a> — image and audio controls own the click surface
    const tag  = (!tile.slug && tile.href) ? 'a' : 'div';
    const link = (!tile.slug && tile.href)
        ? ` href="${attr(tile.href)}" target="_blank" rel="noopener"`
        : '';

    const showImg = tile.showImage && !(tile.expand && !tile.image);
    const audioBar = tile.audio
        ? `<div class="tile-audio${showImg ? ' tile-audio-overlay' : ''}" data-src="${attr(tile.audio)}" data-name="${attr(tile.name)}" data-track="${attr(tile.track || '')}" data-slug="${attr(tile.slug || '')}" data-artist="${attr(tile.artist || '')}" data-album="${attr(tile.album || '')}" data-image="${attr(tile.image || '')}"><button class="audio-btn" onclick="audioPlay(this)">▶</button><div class="audio-bar" onclick="audioSeek(event,this)"><div class="audio-prog"></div></div><span class="audio-time">0:00</span></div>`
        : '';
    const imgWrap = showImg
        ? `\n            <div class="tile-img-wrap${tile.audio ? ' tile-img-audio' : ''}"${tile.audio ? ' onclick="audioImgPlay(event,this)"' : ''}>${tile.image ? `<img src="images/wide/${attr(tile.image)}" alt="${attr(tile.name)}" loading="lazy" decoding="async" onerror="this.style.display='none'">` : ''}${audioBar}</div>`
        : '';

    const favicon = tile.domain
        ? `<img class="tile-favicon" src="https://www.google.com/s2/favicons?domain=${attr(tile.domain.split('·')[0].trim())}&amp;sz=64" alt="" loading="lazy"> `
        : '';

    const shareBtn = tile.slug
        ? `<button class="share-btn" data-slug="${attr(tile.slug)}" data-title="${attr(tile.track || tile.name)}" onclick="event.stopPropagation();shareTrack(this)">↗</button>`
        : '';

    const domainSlot = tile.slug
        ? `<a class="tile-more" href="tracks/${attr(tile.slug)}/">${tile.domain || 'MORE'} →</a>`
        : `<div class="tile-domain">${tile.domain || ''}</div>`;

    const tileClass = `tile${!tile.showImage && !tile.expand ? ' tile-compact' : ''}${tile.expand ? ' tile-expand' : ''}`;

    return `
        <${tag} class="${tileClass}" data-status="${attr(tile.status)}"${link}>${imgWrap}${!showImg && audioBar ? `\n            ${audioBar}` : ''}
            <div class="tile-cat">${tile.cat}</div>
            <div class="tile-name">${favicon}${text(tile.name)}${shareBtn}</div>
            <div class="tile-desc">${tile.desc}</div>
            <div class="tile-footer">
                <div class="status">
                    <div class="dot" style="background:${s.color}"></div>
                    <span style="color:${s.color};opacity:0.85">${s.label}</span>
                </div>
                ${domainSlot}
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

    // Build {{SITE_SCHEMA}} — MusicGroup (or configured type) JSON-LD
    let siteSchema = '';
    if (site.schemaType) {
        const schema = {
            '@context': 'https://schema.org',
            '@type':    site.schemaType,
            'name':     site.title ?? '',
            'url':      site.url   ?? '',
        };
        if (site.description) schema.description = site.description;
        if (site.og)          schema.image        = site.url ? `${site.url}/${site.og}` : site.og;
        if (Array.isArray(site.sameAs) && site.sameAs.length)   schema.sameAs           = site.sameAs;
        if (Array.isArray(site.genre)  && site.genre.length)    schema.genre            = site.genre;
        if (site.foundingLocation)                               schema.foundingLocation = { '@type': 'Place', 'name': site.foundingLocation };
        siteSchema = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n    </script>`;
    }

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
        '{{SITE_SCHEMA}}':      siteSchema,
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

function renderInline(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto">')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function renderMarkdown(md) {
    if (!md || !md.trim()) return '';
    md = md.replace(/^---[\s\S]*?---\s*\n/, '');
    return md.trim().split(/\n\n+/).map(p => {
        p = p.trim();
        if (!p) return '';
        if (p.startsWith('### ')) return `<h4>${renderInline(p.slice(4))}</h4>`;
        if (p.startsWith('## '))  return `<h3>${renderInline(p.slice(3))}</h3>`;
        if (p.startsWith('# '))   return `<h2>${renderInline(p.slice(2))}</h2>`;
        return `<p>${p.split('\n').map(renderInline).join('<br>')}</p>`;
    }).filter(Boolean).join('\n');
}

function buildTrackPages(data, site, statusMap) {
    const templatePath = path.join(SITE, 'templates', 'track.html');
    if (!fs.existsSync(templatePath)) return 0;
    const templateSrc = fs.readFileSync(templatePath, 'utf8');

    // Extract inline script block from site/index.html
    const indexSrc        = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
    const localPreviewIdx = indexSrc.indexOf('<!-- local-preview:');
    const scriptEnd       = indexSrc.lastIndexOf('</script>', localPreviewIdx);
    const scriptStart     = indexSrc.lastIndexOf('<script>', scriptEnd);
    const scriptBlock     = scriptStart >= 0 ? indexSrc.slice(scriptStart, scriptEnd + '</script>'.length) : '';

    const slugTiles = data.tiles.filter(t => t.slug && t.visible !== false);
    let count = 0;

    for (const tile of slugTiles) {
        let tmpl = templateSrc;

        // SITE tokens
        const siteTokens = {
            '{{SITE_TITLE}}':   site.title   ?? '',
            '{{SITE_URL}}':     site.url     ?? '',
            '{{SITE_ICON}}':    site.icon    ?? '',
            '{{SITE_FOOTER}}':  site.footer  ?? '',
        };
        for (const [token, value] of Object.entries(siteTokens)) {
            tmpl = tmpl.split(token).join(value);
        }

        // TRACK tokens
        const trackTitle = tile.track || tile.name || '';
        const metaParts  = [tile.artist, tile.album].filter(Boolean);
        const trackTokens = {
            '{{TRACK_TITLE}}':  trackTitle,
            '{{TRACK_CAT}}':    tile.cat   || '',
            '{{TRACK_DESC}}':   tile.desc  || '',
            '{{TRACK_IMAGE}}':  tile.image || '',
            '{{TRACK_SLUG}}':   tile.slug  || '',
            '{{TRACK_META}}':   metaParts.join(' · '),
        };
        for (const [token, value] of Object.entries(trackTokens)) {
            tmpl = tmpl.split(token).join(value);
        }

        // Schema.org JSON-LD
        const schema = {
            '@context': 'https://schema.org',
            '@type':    'MusicRecording',
            'name':     trackTitle,
            'url':      `${site.url}/tracks/${tile.slug}/`,
        };
        if (tile.desc)   schema.description = tile.desc;
        if (tile.image)  schema.image       = `${site.url}/images/wide/${tile.image}`;
        if (tile.artist) schema.byArtist    = { '@type': 'MusicGroup', 'name': tile.artist };
        if (tile.album)  schema.inAlbum     = { '@type': 'MusicAlbum', 'name': tile.album };
        if (tile.audio)  schema.audio       = { '@type': 'AudioObject', 'contentUrl': tile.audio.startsWith('http') ? tile.audio : `${site.url}/${tile.audio}` };
        tmpl = tmpl.replace('{{TRACK_SCHEMA}}', `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n    </script>`);

        // Hero
        const heroHtml = tile.image
            ? `<div class="track-hero"><img src="../../images/wide/${attr(tile.image)}" alt="${attr(trackTitle)}" decoding="async"></div>`
            : '';
        tmpl = tmpl.replace('<!--TRACK_HERO-->', heroHtml);

        // Player
        const playerHtml = tile.audio
            ? `<div class="tile-audio" data-src="${attr(tile.audio)}" data-name="${attr(tile.name)}" data-track="${attr(tile.track || '')}" data-slug="${attr(tile.slug)}" data-artist="${attr(tile.artist || '')}" data-album="${attr(tile.album || '')}" data-image="${attr(tile.image || '')}"><button class="audio-btn" onclick="audioPlay(this)">▶</button><div class="audio-bar" onclick="audioSeek(event,this)"><div class="audio-prog"></div></div><span class="audio-time">0:00</span></div>`
            : '';
        tmpl = tmpl.replace('<!--TRACK_PLAYER-->', playerHtml);

        // Markdown content
        const mdPath    = path.join(SITE, 'content', 'tracks', `${tile.slug}.md`);
        const mdContent = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
        const rendered  = renderMarkdown(mdContent);
        tmpl = tmpl.replace('{{TRACK_CONTENT}}', rendered ? `<div class="track-content">${rendered}</div>` : '');

        // Inline scripts
        tmpl = tmpl.replace('<!--TRACK_SCRIPTS-->', scriptBlock);

        const outDir = path.join(DIST, 'tracks', tile.slug);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), tmpl, 'utf8');
        count++;
    }

    return count;
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

const trackCount = buildTrackPages(data, site, statusMap);

// ── Sitemap ──────────────────────────────────────────────────────────────
if (site.url) {
    const base    = site.url.replace(/\/$/, '');
    const today   = new Date().toISOString().slice(0, 10);
    const slugs   = data.tiles.filter(t => t.slug && t.visible !== false).map(t => t.slug);
    const pages   = htmlFiles.filter(f => f !== 'admin.html').map(f => f === 'index.html' ? '' : f.replace(/\.html$/, '/'));

    const urls = [
        ...pages.map(p => ({ loc: `${base}/${p}`, priority: p === '' ? '1.0' : '0.7' })),
        ...slugs.map(s => ({ loc: `${base}/tracks/${s}/`, priority: '0.8' })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
        urls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')
    }\n</urlset>`;

    fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml, 'utf8');
}

console.log(`Built dist/ — ${data.tiles.length} tiles across ${data.sections.length} sections${trackCount ? `, ${trackCount} track pages` : ''}${site.url ? ', sitemap.xml' : ''}`);
