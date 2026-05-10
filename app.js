VANTA.WAVES({
    el: "#vanta-bg",
    mouseControls: true,
    touchControls: true,
    gyroControls: false,
    minHeight: 200.00,
    minWidth: 200.00,
    scale: 1.00,
    scaleMobile: 1.00,
    color: 0x4f0088,
    shininess: 138.00,
    waveHeight: 40.00,
    waveSpeed: 0.70,
    zoom: 0.65
});

function toggleMusic() {
    const audio = document.getElementById('bg-music');
    const icon = document.getElementById('play-icon');
    const label = document.getElementById('play-label');
    const pause = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    const play = '<path d="M8 5v14l11-7z"/>';
    if (audio.paused) {
        audio.play();
        icon.innerHTML = pause;
        label.textContent = 'PAUSE';
    } else {
        audio.pause();
        icon.innerHTML = play;
        label.textContent = 'PLAY';
    }
}

// ── Tile image breakpoints ───────────────────────────────────────────────
// These values mirror the .tile-grid media queries defined in style.css.
// The browser uses TILE_SIZES to decide which WebP file to download, so if
// you ever change the grid column breakpoints in style.css you MUST update
// TILE_BP_SINGLE and TILE_BP_DOUBLE here to match, otherwise the browser
// will fetch the wrong image size for the actual rendered layout.
//
//   style.css reference:
//     @media (max-width: 1120px) → 2 columns → each tile ≈ 50vw
//     @media (max-width: 560px)  → 1 column  → each tile ≈ 100vw
//     default                    → 3 columns  → each tile ≈ 33vw
const TILE_BP_SINGLE = 560;
const TILE_BP_DOUBLE = 1120;
const TILE_SIZES = `(max-width: ${TILE_BP_SINGLE}px) 100vw, (max-width: ${TILE_BP_DOUBLE}px) 50vw, 33vw`;

const STATUS_MAP = {
    live:     { dot: 'dot-live',     cls: 'status-live',     label: 'LIVE' },
    building: { dot: 'dot-building', cls: 'status-building', label: 'BUILDING' },
    sale:     { dot: 'dot-sale',     cls: 'status-sale',     label: 'FOR SALE' },
    roadmap:  { dot: 'dot-roadmap',  cls: 'status-roadmap',  label: 'ROADMAP' },
};

function renderTile(tile) {
    const s  = STATUS_MAP[tile.status] || STATUS_MAP.roadmap;
    const el = document.createElement(tile.href ? 'a' : 'div');
    el.className    = 'tile';
    el.dataset.status = tile.status;
    if (tile.href) { el.href = tile.href; el.target = '_blank'; el.rel = 'noopener'; }

    const base = (tile.image || '').replace(/\.[^.]+$/, '');
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
        const fav = document.createElement('img');
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
          `<div class="status"><div class="dot ${s.dot}"></div><span class="${s.cls}">${s.label}</span></div>` +
          `<div class="tile-domain">${tile.domain}</div>` +
        `</div>`
    );
    return el;
}

async function loadTiles() {
    const { sections, tiles } = await fetch('tiles.json').then(r => r.json());
    const container = document.getElementById('sections-container');
    sections.forEach(sec => {
        const secTiles = tiles.filter(t => t.section === sec.id);
        if (!secTiles.length) return;
        const secEl = document.createElement('div');
        secEl.className = 'section';
        secEl.innerHTML = `<div class="section-header">${sec.title}</div><div class="tile-grid"></div>`;
        const grid = secEl.querySelector('.tile-grid');
        secTiles.forEach(t => grid.appendChild(renderTile(t)));
        container.appendChild(secEl);
    });
}

loadTiles();

function filter(status, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tile').forEach(tile => {
        if (status === 'all' || tile.dataset.status === status) {
            tile.removeAttribute('data-hidden');
        } else {
            tile.setAttribute('data-hidden', 'true');
        }
    });
}
