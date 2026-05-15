// app.js — local preview hydration
// Loaded by any site/*.html page for local live preview.
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

function getCommentNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
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
          `<div class="tile-domain">${tile.domain || ''}</div>` +
        `</div>`
    );
    return el;
}

function buildSectionEl(sec, secTiles, statusMap) {
    if (!secTiles.length) return null;
    const secEl = document.createElement('div');
    secEl.className = 'section';
    secEl.innerHTML = `<div class="section-header">${sec.title}</div><div class="tile-grid"></div>`;
    secEl.querySelector('.tile-grid').append(...secTiles.map(t => renderTile(t, statusMap)));
    return secEl;
}

async function loadTiles() {
    const { sections, tiles, statuses = [] } = await fetch('tiles.json').then(r => r.json());
    const statusMap = Object.fromEntries(statuses.map(s => [s.id, s]));

    const comments = getCommentNodes(document.body);
    for (const comment of comments) {
        const tag = comment.nodeValue.trim();

        if (tag === 'FILTERS') {
            const frag = document.createDocumentFragment();
            statuses.forEach(s => {
                const btn = document.createElement('button');
                btn.className   = 'filter-btn';
                btn.textContent = s.label;
                btn.onclick     = function() { filter(s.id, this); };
                frag.appendChild(btn);
            });
            comment.replaceWith(frag);

        } else if (tag === 'SECTIONS') {
            const frag = document.createDocumentFragment();
            sections
                .filter(sec => sec.visible !== false && !sec.featured)
                .forEach(sec => {
                    const secTiles = tiles.filter(t => String(t.section) === String(sec.id) && t.visible !== false);
                    const el = buildSectionEl(sec, secTiles, statusMap);
                    if (el) frag.appendChild(el);
                });
            comment.replaceWith(frag);

        } else if (tag === 'FEATURED') {
            const sec = sections.find(s => s.featured && s.visible !== false);
            if (sec) {
                const secTiles = tiles
                    .filter(t => t.visible !== false && t.featured > 0)
                    .sort((a, b) => a.featured - b.featured);
                const el = buildSectionEl(sec, secTiles, statusMap);
                if (el) comment.replaceWith(el);
                else comment.replaceWith(document.createDocumentFragment());
            } else {
                comment.replaceWith(document.createDocumentFragment());
            }

        } else if (tag.startsWith('SECTION:')) {
            const id  = tag.slice('SECTION:'.length);
            const sec = sections.find(s => String(s.id) === id && s.visible !== false);
            if (sec) {
                const secTiles = sec.featured
                    ? tiles.filter(t => t.visible !== false && t.featured > 0).sort((a, b) => a.featured - b.featured)
                    : tiles.filter(t => String(t.section) === String(sec.id) && t.visible !== false);
                const el = buildSectionEl(sec, secTiles, statusMap);
                if (el) comment.replaceWith(el);
                else comment.replaceWith(document.createDocumentFragment());
            } else {
                comment.replaceWith(document.createDocumentFragment());
            }
        }
    }
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
        '{{SITE_ICON}}':        site.icon        ?? '',
        '{{SITE_FOOTER}}':      site.footer      ?? '',
    };
    function sub(str) {
        for (const [k, v] of Object.entries(TOKENS)) str = str.split(k).join(v);
        return str;
    }

    document.title = sub(document.title);

    document.querySelectorAll('meta[content]').forEach(m => { m.content = sub(m.content); });

    const logoImg  = document.querySelector('#logo-wrap img');
    const logoText = document.getElementById('logo-text');
    if (logoImg && site.logo) {
        logoImg.style.display = '';
        logoImg.alt = site.title ?? '';
        if (logoText) logoText.style.display = 'none';
        logoImg.src = site.logo;
    }

    const iconLink = document.querySelector('link[rel="icon"]');
    if (iconLink && site.icon) iconLink.href = site.icon;

    const footer = document.getElementById('footer');
    if (footer) footer.innerHTML = sub(footer.innerHTML);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => { if (n.nodeValue.includes('{{')) n.nodeValue = sub(n.nodeValue); });
}

loadSite();
loadTiles();
