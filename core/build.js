'use strict';

const fs     = require('fs');
const path   = require('path');
const marked = require('marked');

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

function tileHref(tile) {
    if (!tile.slug) return null;
    if (tile.type === 'buy')  return `buy/${tile.slug}/`;
    if (tile.type === 'info') return `${tile.slug}/`;
    return `tracks/${tile.slug}/`;
}

function buildFilters(statuses) {
    return statuses.map(s =>
        `<button class="filter-btn" onclick="filter('${attr(s.id)}', this)">${text(s.label)}</button>`
    ).join('\n            ');
}

function buildTile(tile, statusMap) {
    const s    = statusMap[tile.status] || { label: tile.status.toUpperCase(), color: '#9aa8b3' };
    const hasAudio    = !!tile.audio;
    const slugHref    = tileHref(tile);
    const slugNoAudio = slugHref && !hasAudio;
    const isCatalog   = tile.type === 'catalog';
    const isExternal  = !slugHref && !isCatalog && tile.href;

    const tag  = (isExternal || slugNoAudio || (isCatalog && tile.href)) ? 'a' : 'div';
    const link = slugNoAudio
        ? ` href="${attr(slugHref)}"`
        : isCatalog && tile.href
        ? ` href="${attr(tile.href)}"`
        : isExternal
        ? ` href="${attr(tile.href)}" target="_blank" rel="noopener"`
        : '';

    const showImg = tile.showImage && !(tile.expand && !tile.image);
    const audioBar = tile.audio
        ? `<div class="tile-audio${showImg ? ' tile-audio-overlay' : ''}" data-src="${attr(tile.audio)}" data-name="${attr(tile.name)}" data-track="${attr(tile.track || '')}" data-slug="${attr(tile.slug || '')}" data-artist="${attr(tile.artist || '')}" data-album="${attr(tile.album || '')}" data-image="${attr(tile.image || '')}"><button class="audio-btn" onclick="audioPlay(this)">▶</button><div class="audio-bar" onclick="audioSeek(event,this)"><div class="audio-prog"></div></div><span class="audio-time">0:00</span></div>`
        : '';
    const imgAlt = attr([tile.track || tile.name, tile.cat, tile.artist].filter(Boolean).join(' — '));
    const imgWrap = showImg
        ? `\n            <div class="tile-img-wrap${tile.audio ? ' tile-img-audio' : ''}"${tile.audio ? ' onclick="audioImgPlay(event,this)"' : ''}>${tile.image ? `<img src="images/wide/${attr(tile.image)}" alt="${imgAlt}" loading="lazy" decoding="async" onerror="this.style.display='none'">` : ''}${audioBar}</div>`
        : '';

    const favicon = tile.domain
        ? `<img class="tile-favicon" src="https://www.google.com/s2/favicons?domain=${attr(tile.domain.split('·')[0].trim())}&amp;sz=64" alt="" loading="lazy"> `
        : '';

    const isTrackTile = !tile.type || tile.type === 'link';
    const shareBtn = (tile.slug && isTrackTile)
        ? `<button class="share-btn" data-slug="${attr(tile.slug)}" data-title="${attr(tile.track || tile.name)}" onclick="event.stopPropagation();shareTrack(this)">↗</button>`
        : '';

    const trackLabel  = attr(tile.track || tile.name);
    const effectiveHref = slugHref || (isCatalog ? tile.href : null);
    const domainSlot  = isCatalog && tile.catalogRef
        ? `<button class="tile-play-btn" data-catalog="${attr(tile.catalogRef)}" onclick="event.stopPropagation();event.preventDefault();var c=window._catalog;c&&c[this.dataset.catalog]&&playCatalogTrack(c[this.dataset.catalog])" title="Play">▶</button>`
        : effectiveHref
        ? hasAudio
            ? `<a class="tile-more" href="${attr(effectiveHref)}" title="${trackLabel}">${tile.domain || 'MORE'} →</a>`
            : `<span class="tile-more">${tile.domain || 'MORE'} →</span>`
        : `<div class="tile-domain">${tile.domain || ''}</div>`;

    const nameText = (hasAudio && slugHref)
        ? `<a class="tile-name-link" href="${attr(slugHref)}">${text(tile.track || tile.name)}</a>`
        : text(tile.name);

    const priceSlot = (tile.type === 'buy' && tile.price)
        ? `<div class="tile-price">${text(tile.price)}</div>`
        : '';

    const tileClass = `tile${!tile.showImage && !tile.expand ? ' tile-compact' : ''}${tile.expand ? ' tile-expand' : ''}`;

    return `
        <${tag} class="${tileClass}" data-status="${attr(tile.status)}"${link}>${imgWrap}${!showImg && audioBar ? `\n            ${audioBar}` : ''}
            <div class="tile-cat">${tile.cat}</div>
            <div class="tile-name">${favicon}${nameText}${shareBtn}</div>
            <div class="tile-desc">${tile.desc}</div>
            <div class="tile-footer">
                <div class="status">
                    <div class="dot" style="background:${s.color}"></div>
                    <span style="color:${s.color};opacity:0.85">${s.label}</span>
                </div>
                ${priceSlot}${domainSlot}
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

function buildFeatured(sections, tiles, statusMap) {
    const sec = sections.find(s => s.featured && s.visible !== false);
    if (!sec) return '';
    const secTileData = tiles.filter(t => t.visible !== false && t.featured > 0).sort((a, b) => a.featured - b.featured);
    const secTiles = stackTiles(secTileData, secTileData.map(t => buildTile(t, statusMap)));
    return buildSectionHtml(sec, secTiles);
}

function buildSingleSection(id, sections, tiles, statusMap) {
    const sec = sections.find(s => String(s.id) === String(id));
    if (!sec) return '';
    if (sec.featured) return buildFeatured(sections, tiles, statusMap);
    const secTileData = tiles.filter(t => String(t.section) === String(id) && t.visible !== false);
    const secTiles = stackTiles(secTileData, secTileData.map(t => buildTile(t, statusMap)));
    return buildSectionHtml(sec, secTiles);
}

// ── Catalog helpers ───────────────────────────────────────────────────────

const RELEASE_PRIORITY = { lp: 5, album: 5, compilation: 4, ep: 3, single: 2, mix: 1 };

function pickPrimaryRelease(slug, releases) {
    const candidates = (releases || []).filter(r => (r.tracks || []).includes(slug));
    if (!candidates.length) return null;
    return candidates.reduce((best, r) => {
        const p  = RELEASE_PRIORITY[(r.type || '').toLowerCase()] || 0;
        const bp = RELEASE_PRIORITY[(best.type || '').toLowerCase()] || 0;
        return p > bp ? r : best;
    });
}

// ── Catalog data injection ────────────────────────────────────────────────
// Returns an inline <script> that sets window._catalog, window._playlists,
// window._jingles, and window._sitePlayer as available.
function buildCatalogScript(catalogBySlug, effectivePlaylists, jingleById, sitePlayer) {
    const parts = [];
    if (catalogBySlug) {
        parts.push(`window._catalog=${JSON.stringify(catalogBySlug)}`);
        parts.push(`window._playlists=${JSON.stringify(effectivePlaylists)}`);
    }
    if (jingleById && Object.keys(jingleById).length > 0)
        parts.push(`window._jingles=${JSON.stringify(jingleById)}`);
    if (sitePlayer)
        parts.push(`window._sitePlayer=${JSON.stringify(sitePlayer)}`);
    if (!parts.length) return '';
    return `<script>${parts.join(';')};</script>`;
}

// Injects catalog data just before the window._siteRoot script tag.
// Both index.html and track.html have <script>window._siteRoot as their last script setup line.
function injectCatalogScript(tmpl, catalogScript) {
    if (!catalogScript) return tmpl;
    return tmpl.replace('<script>window._siteRoot', catalogScript + '\n<script>window._siteRoot');
}

function processTemplate(template, site, data, statusMap, catalogScript) {
    template = template
        .split('\n')
        .filter(l => !l.includes('local-preview:') && !l.includes('../core/app.js'))
        .join('\n');

    let siteSchema = '';
    if (site.schemaType) {
        const schema = {
            '@context': 'https://schema.org',
            '@type':    site.schemaType,
            'name':     site.artistName || '',
            'url':      site.url   ?? '',
        };
        if (site.description) schema.description = site.description;
        if (site.og)          schema.image        = site.url ? `${site.url}/${site.og}` : site.og;
        if (site.logo)        schema.logo         = site.url ? `${site.url}/${site.logo}` : site.logo;
        if (Array.isArray(site.sameAs) && site.sameAs.length)              schema.sameAs         = site.sameAs;
        if (Array.isArray(site.alternateName) && site.alternateName.length) schema.alternateName = site.alternateName;
        if (Array.isArray(site.genre)  && site.genre.length)               schema.genre          = site.genre;
        if (site.foundingLocation)                                          schema.foundingLocation = { '@type': 'Place', 'name': site.foundingLocation };
        siteSchema = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n    </script>`;
    }

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
        '{{SITE_THEME_COLOR}}': site.themeColor  ?? '#0d0f12',
        '{{SITE_SHORT_NAME}}':  site.shortName   || (site.title ?? '').split(' ')[0] || '',
    };
    for (const [token, value] of Object.entries(tokens)) {
        template = template.split(token).join(value);
    }

    const statuses = data.statuses || [];
    template = template.replace('<!--FILTERS-->',  buildFilters(statuses));
    template = template.replace('<!--SECTIONS-->', buildSections(data.sections, data.tiles, statusMap));
    template = template.replace('<!--FEATURED-->',  buildFeatured(data.sections, data.tiles, statusMap));
    template = template.replace(/<!--SECTION:([a-zA-Z0-9_]+)-->/g, (_, id) =>
        buildSingleSection(id, data.sections, data.tiles, statusMap)
    );

    return injectCatalogScript(template, catalogScript);
}

function renderMarkdown(md) {
    if (!md || !md.trim()) return '';
    md = md.replace(/^---[\s\S]*?---\s*\n/, '');
    return marked.parse(md.trim());
}

// ── Track pages from catalog.json ─────────────────────────────────────────
function buildCatalogTrackPages(catalogData, site, catalogScript) {
    if (!catalogData || !Array.isArray(catalogData.tracks)) return 0;

    const templatePath = path.join(SITE, 'templates', 'track.html');
    if (!fs.existsSync(templatePath)) return 0;
    const templateSrc = fs.readFileSync(templatePath, 'utf8');

    const entries = catalogData.tracks.filter(t => t.slug && t.visible !== false);
    let count = 0;

    for (const entry of entries) {
        let tmpl = templateSrc;

        const siteTokens = {
            '{{SITE_TITLE}}':  site.title  ?? '',
            '{{SITE_URL}}':    site.url    ?? '',
            '{{SITE_ICON}}':   site.icon   ?? '',
            '{{SITE_FOOTER}}': site.footer ?? '',
        };
        for (const [token, value] of Object.entries(siteTokens)) {
            tmpl = tmpl.split(token).join(value);
        }

        const metaParts = [entry.artist, entry.album].filter(Boolean);
        const trackTokens = {
            '{{TRACK_TITLE}}': entry.title || '',
            '{{TRACK_CAT}}':   entry.cat   || '',
            '{{TRACK_DESC}}':  entry.desc  || '',
            '{{TRACK_IMAGE}}': entry.image || '',
            '{{TRACK_SLUG}}':  entry.slug  || '',
            '{{TRACK_META}}':  metaParts.join(' · '),
        };
        for (const [token, value] of Object.entries(trackTokens)) {
            tmpl = tmpl.split(token).join(value);
        }

        const schema = {
            '@context': 'https://schema.org',
            '@type':    'MusicRecording',
            'name':     entry.title || '',
            'url':      `${site.url}/tracks/${entry.slug}/`,
        };
        if (entry.desc)  schema.description = entry.desc;
        if (entry.image) schema.image       = `${site.url}/images/wide/${entry.image}`;
        if (entry.artist) schema.byArtist   = { '@type': 'MusicGroup', 'name': entry.artist };
        const primaryRelease  = pickPrimaryRelease(entry.slug, catalogData.releases || []);
        const inAlbumName     = primaryRelease ? primaryRelease.title : (entry.album || null);
        const recordLabelName = primaryRelease && primaryRelease.label ? primaryRelease.label : null;
        if (inAlbumName)      schema.inAlbum     = { '@type': 'MusicAlbum', 'name': inAlbumName };
        if (recordLabelName)  schema.recordLabel = { '@type': 'Organization', 'name': recordLabelName };
        if (entry.audio)      schema.audio       = { '@type': 'AudioObject', 'contentUrl': entry.audio.startsWith('http') ? entry.audio : `${site.url}/${entry.audio}` };
        if (entry.duration) {
            const d = String(entry.duration);
            if (d.includes(':')) {
                const [m, s] = d.split(':');
                schema.duration = `PT${m}M${String(s || 0).padStart(2, '0')}S`;
            } else if (!isNaN(Number(d))) {
                const sec = Number(d);
                schema.duration = `PT${Math.floor(sec / 60)}M${sec % 60}S`;
            }
        }
        if (entry.releaseDate) schema.datePublished = entry.releaseDate;
        if (Array.isArray(entry.genre) && entry.genre.length) schema.genre = entry.genre;
        tmpl = tmpl.replace('{{TRACK_SCHEMA}}', `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n    </script>`);

        const heroHtml = entry.image
            ? `<div class="track-hero"><img src="../../images/wide/${attr(entry.image)}" alt="${attr(entry.title || '')}" decoding="async"></div>`
            : '';
        tmpl = tmpl.replace('<!--TRACK_HERO-->', heroHtml);

        const playerHtml = entry.audio
            ? `<div class="tile-audio track-play" data-src="${attr(entry.audio)}" data-name="${attr(entry.title || '')}" data-track="${attr(entry.title || '')}" data-slug="${attr(entry.slug)}" data-artist="${attr(entry.artist || '')}" data-album="${attr(entry.album || '')}" data-image="${attr(entry.image || '')}"><button class="audio-btn track-play-btn" onclick="audioPlay(this)">▶</button></div>`
            : '';
        tmpl = tmpl.replace('<!--TRACK_PLAYER-->', playerHtml);

        const mdPath    = path.join(SITE, 'content', 'tracks', `${entry.slug}.md`);
        const mdContent = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
        const rendered  = renderMarkdown(mdContent);
        tmpl = tmpl.replace('{{TRACK_CONTENT}}', rendered ? `<div class="track-content">${rendered}</div>` : '');

        tmpl = injectCatalogScript(tmpl, catalogScript);

        const outDir = path.join(DIST, 'tracks', entry.slug);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), tmpl, 'utf8');
        count++;
    }

    return count;
}

// ── Track pages from tiles.json (legacy / migration period) ───────────────
// skipSlugs: set of slugs already generated from catalog — avoids duplicate pages.
function buildTrackPages(data, site, statusMap, skipSlugs, catalogScript) {
    const templatePath = path.join(SITE, 'templates', 'track.html');
    if (!fs.existsSync(templatePath)) return 0;
    const templateSrc = fs.readFileSync(templatePath, 'utf8');

    const slugTiles = data.tiles.filter(t => t.slug && t.visible !== false && !skipSlugs.has(t.slug) && (!t.type || t.type === 'link'));
    let count = 0;

    for (const tile of slugTiles) {
        let tmpl = templateSrc;

        const siteTokens = {
            '{{SITE_TITLE}}':   site.title   ?? '',
            '{{SITE_URL}}':     site.url     ?? '',
            '{{SITE_ICON}}':    site.icon    ?? '',
            '{{SITE_FOOTER}}':  site.footer  ?? '',
        };
        for (const [token, value] of Object.entries(siteTokens)) {
            tmpl = tmpl.split(token).join(value);
        }

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

        const heroHtml = tile.image
            ? `<div class="track-hero"><img src="../../images/wide/${attr(tile.image)}" alt="${attr(trackTitle)}" decoding="async"></div>`
            : '';
        tmpl = tmpl.replace('<!--TRACK_HERO-->', heroHtml);

        const playerHtml = tile.audio
            ? `<div class="tile-audio" data-src="${attr(tile.audio)}" data-name="${attr(tile.name)}" data-track="${attr(tile.track || '')}" data-slug="${attr(tile.slug)}" data-artist="${attr(tile.artist || '')}" data-album="${attr(tile.album || '')}" data-image="${attr(tile.image || '')}"><button class="audio-btn" onclick="audioPlay(this)">▶</button><div class="audio-bar" onclick="audioSeek(event,this)"><div class="audio-prog"></div></div><span class="audio-time">0:00</span></div>`
            : '';
        tmpl = tmpl.replace('<!--TRACK_PLAYER-->', playerHtml);

        const mdPath    = path.join(SITE, 'content', 'tracks', `${tile.slug}.md`);
        const mdContent = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
        const rendered  = renderMarkdown(mdContent);
        tmpl = tmpl.replace('{{TRACK_CONTENT}}', rendered ? `<div class="track-content">${rendered}</div>` : '');

        tmpl = injectCatalogScript(tmpl, catalogScript);

        const outDir = path.join(DIST, 'tracks', tile.slug);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), tmpl, 'utf8');
        count++;
    }

    return count;
}

// ── Buy pages from tiles with type:"buy" ─────────────────────────────────
function buildBuyPages(data, site, catalogScript) {
    const templatePath = path.join(SITE, 'templates', 'buy.html');
    if (!fs.existsSync(templatePath)) return 0;
    const templateSrc = fs.readFileSync(templatePath, 'utf8');

    const buyTiles = data.tiles.filter(t => t.type === 'buy' && t.slug && t.visible !== false);
    let count = 0;

    for (const tile of buyTiles) {
        let tmpl = templateSrc;

        const siteTokens = {
            '{{SITE_TITLE}}':  site.title  ?? '',
            '{{SITE_URL}}':    site.url    ?? '',
            '{{SITE_ICON}}':   site.icon   ?? '',
            '{{SITE_FOOTER}}': site.footer ?? '',
        };
        for (const [token, value] of Object.entries(siteTokens)) {
            tmpl = tmpl.split(token).join(value);
        }

        const buyTokens = {
            '{{BUY_TITLE}}': tile.name  || '',
            '{{BUY_CAT}}':   tile.cat   || '',
            '{{BUY_DESC}}':  tile.desc  || '',
            '{{BUY_PRICE}}': tile.price || '',
            '{{BUY_SLUG}}':  tile.slug  || '',
        };
        for (const [token, value] of Object.entries(buyTokens)) {
            tmpl = tmpl.split(token).join(value);
        }

        const schema = {
            '@context': 'https://schema.org',
            '@type':    'Product',
            'name':     tile.name || '',
            'url':      `${site.url}/buy/${tile.slug}/`,
        };
        if (tile.desc)  schema.description = tile.desc;
        if (tile.image) schema.image = `${site.url}/images/wide/${tile.image}`;
        if (tile.price) schema.offers = { '@type': 'Offer', 'price': tile.price.replace(/[^0-9.]/g, ''), 'priceCurrency': 'USD' };
        tmpl = tmpl.replace('{{BUY_SCHEMA}}', `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n    </script>`);

        const heroHtml = tile.image
            ? `<div class="track-hero"><img src="../../images/wide/${attr(tile.image)}" alt="${attr(tile.name || '')}" decoding="async"></div>`
            : '';
        tmpl = tmpl.replace('<!--BUY_HERO-->', heroHtml);

        const mdPath    = path.join(SITE, 'content', 'buy', `${tile.slug}.md`);
        const mdContent = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
        const rendered  = renderMarkdown(mdContent);
        tmpl = tmpl.replace('{{BUY_CONTENT}}', rendered ? `<div class="track-content">${rendered}</div>` : '');

        tmpl = injectCatalogScript(tmpl, catalogScript);

        const outDir = path.join(DIST, 'buy', tile.slug);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), tmpl, 'utf8');
        count++;
    }

    return count;
}

// ── Info pages from tiles with type:"info" ────────────────────────────────
// slug is directory-based: "events/rave-2026" → dist/events/rave-2026/index.html
function buildInfoPages(data, site, catalogScript) {
    const templatePath = path.join(SITE, 'templates', 'info.html');
    if (!fs.existsSync(templatePath)) return 0;
    const templateSrc = fs.readFileSync(templatePath, 'utf8');

    const infoTiles = data.tiles.filter(t => t.type === 'info' && t.slug && t.visible !== false);
    let count = 0;

    for (const tile of infoTiles) {
        let tmpl = templateSrc;

        const depth      = tile.slug.split('/').length;
        const rootPrefix = '../'.repeat(depth);

        const siteTokens = {
            '{{SITE_TITLE}}':  site.title  ?? '',
            '{{SITE_URL}}':    site.url    ?? '',
            '{{SITE_ICON}}':   site.icon   ?? '',
            '{{SITE_FOOTER}}': site.footer ?? '',
            '{{ROOT}}':        rootPrefix,
        };
        for (const [token, value] of Object.entries(siteTokens)) {
            tmpl = tmpl.split(token).join(value);
        }

        const infoTokens = {
            '{{INFO_TITLE}}': tile.name || '',
            '{{INFO_CAT}}':   tile.cat  || '',
            '{{INFO_DESC}}':  tile.desc || '',
            '{{INFO_SLUG}}':  tile.slug || '',
        };
        for (const [token, value] of Object.entries(infoTokens)) {
            tmpl = tmpl.split(token).join(value);
        }

        const schema = {
            '@context': 'https://schema.org',
            '@type':    'Article',
            'name':     tile.name || '',
            'url':      `${site.url}/${tile.slug}/`,
        };
        if (tile.desc) schema.description = tile.desc;
        tmpl = tmpl.replace('{{INFO_SCHEMA}}', `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n    </script>`);

        const heroHtml = tile.image
            ? `<div class="track-hero"><img src="${rootPrefix}images/wide/${attr(tile.image)}" alt="${attr(tile.name || '')}" decoding="async"></div>`
            : '';
        tmpl = tmpl.replace('<!--INFO_HERO-->', heroHtml);

        const mdPath    = path.join(SITE, 'content', ...tile.slug.split('/')) + '.md';
        const mdContent = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
        const rendered  = renderMarkdown(mdContent);
        tmpl = tmpl.replace('{{INFO_CONTENT}}', rendered ? `<div class="track-content">${rendered}</div>` : '');

        tmpl = injectCatalogScript(tmpl, catalogScript);

        const outDir = path.join(DIST, ...tile.slug.split('/'));
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

// Optional catalog — if absent, player falls back to DOM-driven playlist
const catalogPath   = path.join(SITE, 'catalog.json');
const playlistsPath = path.join(SITE, 'playlists.json');
const catalogData   = fs.existsSync(catalogPath)   ? JSON.parse(fs.readFileSync(catalogPath,   'utf8')) : null;
const playlistsData = fs.existsSync(playlistsPath) ? JSON.parse(fs.readFileSync(playlistsPath, 'utf8')) : null;

const jingleById = {};
const jinglesArr = (playlistsData && Array.isArray(playlistsData.jingles)) ? playlistsData.jingles : [];
for (const j of jinglesArr) {
    if (j.id) jingleById[j.id] = j;
}

// Build catalog lookup keyed by slug
const catalogBySlug = {};
if (catalogData && Array.isArray(catalogData.tracks)) {
    for (const entry of catalogData.tracks) {
        if (entry.slug) catalogBySlug[entry.slug] = entry;
    }
}

// Synthesize default playlist from all playable catalog tracks when no playlists.json
let effectivePlaylists = null;
if (catalogData) {
    if (playlistsData) {
        effectivePlaylists = playlistsData;
    } else {
        effectivePlaylists = {
            default: 'all',
            playlists: [{
                id:     'all',
                title:  'All Tracks',
                tracks: (catalogData.tracks || [])
                    .filter(t => t.audio && t.visible !== false)
                    .map(t => t.slug),
            }],
        };
    }
}

const catalogScript = buildCatalogScript(
    catalogData ? catalogBySlug : null,
    effectivePlaylists,
    Object.keys(jingleById).length ? jingleById : null,
    site.player || null
);

// ── Process all HTML files in site/ ─────────────────────────────────────
fs.mkdirSync(DIST, { recursive: true });

const htmlFiles = fs.readdirSync(SITE).filter(f => f.endsWith('.html'));
for (const file of htmlFiles) {
    const template = fs.readFileSync(path.join(SITE, file), 'utf8');
    fs.writeFileSync(path.join(DIST, file), processTemplate(template, site, data, statusMap, catalogScript), 'utf8');
}

// ── Copy assets ──────────────────────────────────────────────────────────
fs.copyFileSync(path.join(SITE, 'style.css'),  path.join(DIST, 'style.css'));
fs.copyFileSync(path.join(SITE, 'player.js'),  path.join(DIST, 'player.js'));
fs.copyFileSync(path.join(SITE, 'tiles.json'), path.join(DIST, 'tiles.json'));
const siteImages = path.join(SITE, 'images');
if (fs.existsSync(siteImages)) copyDir(siteImages, path.join(DIST, 'images'));

// Core engine files
fs.copyFileSync(path.join(CORE, 'admin.html'), path.join(DIST, 'admin.html'));
fs.copyFileSync(path.join(CORE, 'admin.css'),  path.join(DIST, 'admin.css'));
fs.copyFileSync(path.join(CORE, 'admin.js'),   path.join(DIST, 'admin.js'));
fs.copyFileSync(path.join(CORE, 'app.js'),     path.join(DIST, 'app.js'));

// ── Track / Buy / Info pages ─────────────────────────────────────────────
const catalogTrackCount = buildCatalogTrackPages(catalogData, site, catalogScript);
const catalogSlugs = new Set(
    catalogData ? (catalogData.tracks || []).filter(t => t.slug && t.visible !== false).map(t => t.slug) : []
);
const tileTrackCount = buildTrackPages(data, site, statusMap, catalogSlugs, catalogScript);
const buyCount        = buildBuyPages(data, site, catalogScript);
const infoCount       = buildInfoPages(data, site, catalogScript);

// ── Sitemap ──────────────────────────────────────────────────────────────
if (site.url) {
    const base    = site.url.replace(/\/$/, '');
    const today   = new Date().toISOString().slice(0, 10);

    const catSlugs  = catalogData ? (catalogData.tracks || []).filter(t => t.slug && t.visible !== false).map(t => t.slug) : [];
    const trackSlugs = [...new Set([
        ...catSlugs,
        ...data.tiles.filter(t => t.slug && t.visible !== false && (!t.type || t.type === 'link')).map(t => t.slug),
    ])];
    const buySlugs  = data.tiles.filter(t => t.type === 'buy'  && t.slug && t.visible !== false).map(t => t.slug);
    const infoSlugs = data.tiles.filter(t => t.type === 'info' && t.slug && t.visible !== false).map(t => t.slug);
    const pages     = htmlFiles.filter(f => f !== 'admin.html').map(f => f === 'index.html' ? '' : f.replace(/\.html$/, '/'));

    const urls = [
        ...pages.map(p => ({ loc: `${base}/${p}`,          priority: p === '' ? '1.0' : '0.7' })),
        ...trackSlugs.map(s => ({ loc: `${base}/tracks/${s}/`, priority: '0.8' })),
        ...buySlugs.map(s =>   ({ loc: `${base}/buy/${s}/`,    priority: '0.7' })),
        ...infoSlugs.map(s =>  ({ loc: `${base}/${s}/`,        priority: '0.7' })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
        urls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')
    }\n</urlset>`;

    fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml, 'utf8');
}

// ── Web App Manifest ─────────────────────────────────────────────────────
const manifest = {
    name:             site.title       ?? '',
    short_name:       site.shortName   || (site.title ?? '').split(' ')[0] || '',
    description:      site.description ?? '',
    start_url:        '/',
    display:          'standalone',
    background_color: site.themeColor  ?? '#0d0f12',
    theme_color:      site.themeColor  ?? '#0d0f12',
    icons: [],
};
if (site.icon) {
    manifest.icons.push({ src: site.icon, sizes: 'any', type: 'image/png', purpose: 'any maskable' });
}
fs.writeFileSync(path.join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

const parts = [`${data.tiles.length} tiles across ${data.sections.length} sections`];
if (catalogTrackCount) parts.push(`catalog: ${(catalogData.tracks || []).length} tracks (${catalogTrackCount} pages)`);
if (tileTrackCount)    parts.push(`${tileTrackCount} tile track pages`);
if (buyCount)          parts.push(`${buyCount} buy pages`);
if (infoCount)         parts.push(`${infoCount} info pages`);
if (site.url)          parts.push('sitemap.xml');
parts.push('manifest.json');
console.log('Built dist/ — ' + parts.join(', '));
