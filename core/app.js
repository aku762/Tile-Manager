// app.js — local preview hydration
// Loaded only by site/index.html for local live preview.
// build.js strips this script tag from the output; in dist/ all tokens
// are substituted and tiles are pre-rendered statically.
//
// Tile image breakpoints — mirror .tile-grid media queries in site/style.css.
// If breakpoints change there, update TILE_BP_SINGLE / TILE_BP_DOUBLE here
// AND in build.js, then re-run `npm run build`.
//
//   style.css reference:
//     @media (max-width: 1120px) → 2 columns → each tile ≈ 50vw
//     @media (max-width:  560px) → 1 column  → each tile ≈ 100vw
//     default                    → 3 columns  → each tile ≈ 33vw
const TILE_BP_SINGLE = 560;
const TILE_BP_DOUBLE = 1120;
const TILE_SIZES     = `(max-width: ${TILE_BP_SINGLE}px) 100vw, (max-width: ${TILE_BP_DOUBLE}px) 50vw, 33vw`;

function renderFilters(statuses) {
    const container = document.getElementById('filters');
    statuses.forEach(s => {
        const btn = document.createElement('button');
        btn.className   = 'filter-btn';
        btn.textContent = s.label;
        btn.onclick     = function() { filter(s.id, this); };
        container.appendChild(btn);
    });
}

function renderTile(tile, statusMap) {
    const s  = statusMap[tile.status] || { label: tile.status.toUpperCase(), color: '#9aa8b3' };
    const el = document.createElement(tile.href ? 'a' : 'div');
    el.className      = 'tile';
    el.dataset.status = tile.status;
    if (tile.href) { el.href = tile.href; el.target = '_blank'; el.rel = 'noopener'; }

    const base    = (tile.image || '').replace(/\.[^.]+$/, '');
    const picture = base ? `
        <picture>
            <source type="image/webp"
                srcset="images/tiles/webp600/${base}.webp 600w,
                        images/tiles/webp900/${base}.webp 900w"
                sizes="${TILE_SIZES}">
            <img src="images/tiles/${tile.image}"
                alt="${tile.name}" loading="lazy" decoding="async"
                onerror="this.closest('.tile-img-wrap').style.display='none'">
        </picture>` : '';

    el.insertAdjacentHTML('beforeend',
        `<div class="tile-img-wrap">${picture}</div>` +
        `<div class="tile-cat">${tile.cat}</div>`
    );

    const nameDiv = document.createElement('div');
    nameDiv.className = 'tile-name';
    if (tile.domain) {
        const fav     = document.createElement('img');
        fav.className = 'tile-favicon';
        fav.src       = 'https://www.google.com/s2/favicons?domain=' + tile.domain.split('·')[0].trim() + '&sz=64';
        fav.alt       = '';
        fav.loading   = 'lazy';
        nameDiv.appendChild(fav);
    }
    nameDiv.appendChild(document.createTextNode(tile.name));
    el.appendChild(nameDiv);

    el.insertAdjacentHTML('beforeend',
        `<div class="tile-desc">${tile.desc}</div>` +
        `<div class="tile-footer">` +
          `<div class="status"><div class="dot" style="background:${s.color}"></div><span style="color:${s.color};opacity:0.85">${s.label}</span></div>` +
          `<div class="tile-domain">${tile.domain}</div>` +
        `</div>`
    );
    return el;
}

async function loadTiles() {
    const { sections, tiles, statuses = [] } = await fetch('tiles.json').then(r => r.json());
    const statusMap = Object.fromEntries(statuses.map(s => [s.id, s]));
    renderFilters(statuses);
    const container = document.getElementById('sections-container');
    sections.filter(sec => sec.visible !== false).forEach(sec => {
        const secTiles = sec.featured
            ? tiles.filter(t => t.visible !== false && t.featured > 0).sort((a, b) => a.featured - b.featured)
            : tiles.filter(t => String(t.section) === String(sec.id) && t.visible !== false);
        if (!secTiles.length) return;
        const secEl = document.createElement('div');
        secEl.className = 'section';
        secEl.innerHTML = `<div class="section-header">${sec.title}</div><div class="tile-grid"></div>`;
        secEl.querySelector('.tile-grid').append(...secTiles.map(t => renderTile(t, statusMap)));
        container.appendChild(secEl);
    });
}

async function loadSite() {
    const site = await fetch('site.json').then(r => r.json()).catch(() => null);
    if (!site) return;

    const TOKENS = {
        '{{SITE_TITLE}}':       site.title       ?? '',
        '{{SITE_DESCRIPTION}}': site.description ?? '',
        '{{SITE_TAGLINE}}':     site.tagline     ?? '',
        '{{SITE_URL}}':         site.url         ?? '',
        '{{SITE_LOGO}}':        site.logo        ?? '',
        '{{SITE_OG}}':          site.og          ?? '',
        '{{SITE_FOOTER}}':      site.footer      ?? '',
    };
    function sub(str) {
        for (const [k, v] of Object.entries(TOKENS)) str = str.split(k).join(v);
        return str;
    }

    // <title>
    document.title = sub(document.title);

    // <meta content="...">
    document.querySelectorAll('meta[content]').forEach(m => { m.content = sub(m.content); });

    // Logo img — set src directly and reset display so the onerror/load cycle fires fresh
    const logoImg  = document.querySelector('#logo-wrap img');
    const logoText = document.getElementById('logo-text');
    if (logoImg && site.logo) {
        logoImg.style.display = '';
        logoImg.alt = site.title ?? '';
        if (logoText) logoText.style.display = 'none';
        logoImg.src = site.logo;
    }

    // Footer innerHTML allows HTML markup from site.json
    const footer = document.getElementById('footer');
    if (footer) footer.innerHTML = sub(footer.innerHTML);

    // All remaining text nodes (hero-sub, logo-text, any other visible tokens)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => { if (n.nodeValue.includes('{{')) n.nodeValue = sub(n.nodeValue); });
}

loadSite();
if (!document.querySelector('#sections-container .section')) {
    loadTiles();
}
