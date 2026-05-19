// app.js — local preview hydration
// Loaded by any site/*.html page for local live preview.
// build.js strips this script tag from the output; in dist/ all tokens
// are substituted and tiles are pre-rendered statically.
//

function getCommentNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
}

function renderTile(tile, statusMap) {
    const s  = statusMap[tile.status] || { label: tile.status.toUpperCase(), color: '#9aa8b3' };
    const el = document.createElement(tile.href ? 'a' : 'div');
    el.className      = `tile${!tile.showImage && !tile.expand ? ' tile-compact' : ''}${tile.expand ? ' tile-expand' : ''}`;
    el.dataset.status = tile.status;
    if (tile.href) { el.href = tile.href; el.target = '_blank'; el.rel = 'noopener'; }

    const showImg = tile.showImage && !(tile.expand && !tile.image);
    const audioHTML = tile.audio
        ? `<div class="tile-audio${showImg ? ' tile-audio-overlay' : ''}" data-src="${tile.audio}" data-name="${tile.name}" data-artist="${tile.artist || ''}" data-album="${tile.album || ''}" data-image="${tile.image || ''}"><button class="audio-btn" onclick="audioPlay(this)">▶</button><div class="audio-bar" onclick="audioSeek(event,this)"><div class="audio-prog"></div></div><span class="audio-time">0:00</span><button class="audio-btn" onclick="audioMute(this)">🔊</button></div>`
        : '';

    if (showImg) {
        const wrap = document.createElement('div');
        wrap.className = 'tile-img-wrap' + (tile.audio ? ' tile-img-audio' : '');
        if (tile.audio) wrap.onclick = function(e) { audioImgPlay(e, wrap); };
        if (tile.image) {
            const img = document.createElement('img');
            img.src      = `images/wide/${tile.image}`;
            img.alt      = tile.name;
            img.loading  = 'lazy';
            img.decoding = 'async';
            img.onerror  = function() { this.style.display = 'none'; };
            wrap.appendChild(img);
        }
        if (audioHTML) wrap.insertAdjacentHTML('beforeend', audioHTML);
        el.appendChild(wrap);
    } else if (audioHTML) {
        el.insertAdjacentHTML('beforeend', audioHTML);
    }
    el.insertAdjacentHTML('beforeend', `<div class="tile-cat">${tile.cat}</div>`);

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

function stackTileEls(tileData, els) {
    const result = [];
    let i = 0;
    while (i < tileData.length) {
        if (!tileData[i].showImage && !tileData[i].expand) {
            const group = [];
            while (i < tileData.length && !tileData[i].showImage && !tileData[i].expand && group.length < 2) {
                group.push(els[i++]);
            }
            if (group.length > 1) {
                const stack = document.createElement('div');
                stack.className = 'tile-stack';
                group.forEach(el => stack.appendChild(el));
                result.push(stack);
            } else {
                result.push(group[0]);
            }
        } else {
            result.push(els[i++]);
        }
    }
    return result;
}

function buildSectionEl(sec, secTiles, statusMap) {
    if (!secTiles.length) return null;
    const secEl = document.createElement('div');
    secEl.className = 'section';
    secEl.innerHTML = `<div class="section-header">${sec.title}</div><div class="tile-grid"></div>`;
    const els = stackTileEls(secTiles, secTiles.map(t => renderTile(t, statusMap)));
    secEl.querySelector('.tile-grid').append(...els);
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
