let state = { statuses: [], sections: [], tiles: [] };
let catalogState   = { artists: [], labels: [], releases: [], tracks: [] };
let playlistsState = { default: '', playlists: [], jingles: [] };
let dragSrcId          = null;
let catalogDragSrcSlug = null;
let plTrackDragSrc     = -1;
let activePlaylistId   = null;
let activeReleaseId    = null;
let relTrackDragSrc    = -1;
let showHiddenSections = false;
let currentFilter = '';

// ── Load / Migrate ───────────────────────────────────────────────────────
try {
    const saved = localStorage.getItem('tile_manager_admin');
    if (saved) {
        const loaded = JSON.parse(saved);
        if (!loaded.statuses) loaded.statuses = [];
        if (loaded.sections) {
            loaded.sections.forEach(s => {
                if (!s.id)               s.id      = s.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                if (!s.title)            s.title   = '';
                if (s.visible === undefined) s.visible = true;
                s.id = String(s.id);
            });
        }
        if (loaded.tiles) {
            loaded.tiles.forEach(t => {
                if (!t.id)               t.id      = Date.now().toString();
                if (!t.href)             t.href    = '';
                if (!t.image)            t.image   = '';
                if (!t.audio)            t.audio   = '';
                if (!t.track)            t.track   = '';
                if (!t.slug)             t.slug    = '';
                if (!t.artist)           t.artist  = '';
                if (!t.album)            t.album   = '';
                if (!t.domain)           t.domain  = '';
                if (!t.cat)              t.cat     = '';
                if (!t.desc)             t.desc    = '';
                if (!t.status)           t.status  = 'roadmap';
                if (t.visible === undefined)   t.visible   = true;
                if (t.showImage === undefined) t.showImage = false;
                if (t.expand === undefined)    t.expand    = false;
                t.id      = String(t.id);
                t.section = String(t.section);
            });
        }
        state = loaded;
    }
} catch(e) { console.warn('State load failed', e); }

try {
    const savedCatalog = localStorage.getItem('tile_manager_catalog');
    if (savedCatalog) {
        const loaded = JSON.parse(savedCatalog);
        if (!loaded.artists)  loaded.artists  = [];
        if (!loaded.labels)   loaded.labels   = [];
        if (!loaded.releases) loaded.releases = [];
        if (!loaded.tracks)   loaded.tracks   = [];
        catalogState = loaded;
    }
} catch(e) { console.warn('Catalog state load failed', e); }

try {
    const savedPL = localStorage.getItem('tile_manager_playlists');
    if (savedPL) {
        playlistsState = JSON.parse(savedPL);
        if (!playlistsState.playlists) playlistsState.playlists = [];
        if (!playlistsState.jingles)   playlistsState.jingles   = [];
    }
    // Migrate jingles from legacy separate key if needed
    if (!playlistsState.jingles.length) {
        const legacyJ = localStorage.getItem('tile_manager_jingles');
        if (legacyJ) {
            const lj = JSON.parse(legacyJ);
            if (Array.isArray(lj.jingles) && lj.jingles.length) {
                playlistsState.jingles = lj.jingles;
                savePlaylists();
            }
        }
    }
} catch(e) { console.warn('Playlists state load failed', e); }

function save() {
    localStorage.setItem('tile_manager_admin', JSON.stringify(state));
}

// ── Drag and Drop ────────────────────────────────────────────────────────

function onDragStart(e, id) {
    dragSrcId = String(id);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
}

function onDragOver(e) {
    e.preventDefault();
}

function onDragEnter(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drag-over');
    }
}

function onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    dragSrcId = null;
}

function onTileDrop(e, targetId) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    targetId = String(targetId);
    if (!dragSrcId || dragSrcId === targetId) { dragSrcId = null; return; }

    const featuredSec = state.sections.find(s => s.featured === true);
    if (featuredSec && currentFilter === featuredSec.id) {
        const list = state.tiles.filter(t => t.featured > 0).sort((a, b) => a.featured - b.featured);
        const srcIdx = list.findIndex(t => t.id === dragSrcId);
        let   tgtIdx = list.findIndex(t => t.id === targetId);
        if (srcIdx < 0 || tgtIdx < 0) { dragSrcId = null; return; }
        const [moved] = list.splice(srcIdx, 1);
        if (srcIdx < tgtIdx) tgtIdx--;
        list.splice(tgtIdx, 0, moved);
        list.forEach((t, i) => { t.featured = i + 1; });
        dragSrcId = null;
        save();
        renderTiles();
        return;
    }

    const srcIdx = state.tiles.findIndex(t => t.id === dragSrcId);
    let   tgtIdx = state.tiles.findIndex(t => t.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) { dragSrcId = null; return; }
    const [moved] = state.tiles.splice(srcIdx, 1);
    if (srcIdx < tgtIdx) tgtIdx--;
    state.tiles.splice(tgtIdx, 0, moved);
    dragSrcId = null;
    save();
    renderTiles();
}

function onSectionDrop(e, targetId) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    targetId = String(targetId);
    if (!dragSrcId || dragSrcId === targetId) { dragSrcId = null; return; }
    const srcIdx = state.sections.findIndex(s => s.id === dragSrcId);
    let   tgtIdx = state.sections.findIndex(s => s.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) { dragSrcId = null; return; }
    const [moved] = state.sections.splice(srcIdx, 1);
    if (srcIdx < tgtIdx) tgtIdx--;
    state.sections.splice(tgtIdx, 0, moved);
    dragSrcId = null;
    save();
    populateSectionSelects();
    renderSections();
}

function onTileDropEnd(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!dragSrcId) return;

    const featuredSec = state.sections.find(s => s.featured === true);
    if (featuredSec && currentFilter === featuredSec.id) {
        const list = state.tiles.filter(t => t.featured > 0).sort((a, b) => a.featured - b.featured);
        const srcIdx = list.findIndex(t => t.id === dragSrcId);
        if (srcIdx < 0) { dragSrcId = null; return; }
        const [moved] = list.splice(srcIdx, 1);
        list.push(moved);
        list.forEach((t, i) => { t.featured = i + 1; });
        dragSrcId = null;
        save();
        renderTiles();
        return;
    }

    const srcIdx = state.tiles.findIndex(t => t.id === dragSrcId);
    if (srcIdx < 0) { dragSrcId = null; return; }
    const [moved] = state.tiles.splice(srcIdx, 1);
    state.tiles.push(moved);
    dragSrcId = null;
    save();
    renderTiles();
}

function onSectionDropEnd(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!dragSrcId) return;
    const srcIdx = state.sections.findIndex(s => s.id === dragSrcId);
    if (srcIdx < 0) { dragSrcId = null; return; }
    const [moved] = state.sections.splice(srcIdx, 1);
    state.sections.push(moved);
    dragSrcId = null;
    save();
    populateSectionSelects();
    renderSections();
}

// ── Import / Export ──────────────────────────────────────────────────────

function importJSON() {
    document.getElementById('file-input').value = '';
    document.getElementById('file-input').click();
}

function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const loaded = JSON.parse(ev.target.result);
            if (!loaded.sections || !loaded.tiles) throw new Error('Missing sections or tiles array.');
            if (!loaded.statuses) loaded.statuses = [];
            loaded.sections.forEach(s => { s.id = String(s.id); });
            loaded.tiles.forEach(t => { t.id = String(t.id); t.section = String(t.section); });
            state = loaded;
            save();
            populateSectionSelects();
            populateStatusSelect();
            renderTiles();
            renderSections();
            renderStatuses();
            toast('Imported ' + file.name);
        } catch (err) {
            alert('Import failed: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function buildExportJSON() {
    const sections = state.sections.map(s => ({
        id: s.id, title: s.title,
        ...(s.visible === false ? { visible: false } : {}),
        ...(s.featured ? { featured: true } : {}),
    }));
    const tiles = state.tiles.map(t => ({
        id:      t.id,
        section: t.section,
        cat:     t.cat,
        name:    t.name,
        desc:    t.desc,
        status:  t.status,
        domain:  t.domain,
        href:    t.href,
        image:   t.image,
        ...(t.type && t.type !== 'link' ? { type: t.type } : {}),
        ...(t.slug  ? { slug:  t.slug  } : {}),
        ...(t.price ? { price: t.price } : {}),
        ...(t.catalogRef ? { catalogRef: t.catalogRef } : {}),
        ...(t.visible === false ? { visible: false } : {}),
        ...(t.showImage === true ? { showImage: true } : {}),
        ...(t.expand === true ? { expand: true } : {}),
        ...(t.featured > 0 ? { featured: t.featured } : {}),
    }));
    return { statuses: state.statuses, sections, tiles };
}

function exportJSON() {
    const out  = buildExportJSON();
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'tiles.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Exported tiles.json');
}

function copyJSON() {
    navigator.clipboard.writeText(JSON.stringify(buildExportJSON(), null, 2))
        .then(() => toast('JSON copied to clipboard.'))
        .catch(() => toast('Copy failed — try Export JSON instead.'));
}

// ── Render ───────────────────────────────────────────────────────────────

function populateSectionSelects() {
    const featuredSec = state.sections.find(s => s.featured === true);
    const allOpts = state.sections.map(s =>
        `<option value="${s.id}">${s.title}${s.visible === false ? ' [HIDDEN]' : ''}${s.featured ? ' ★' : ''}</option>`
    ).join('');
    const modalOpts = state.sections.filter(s => !s.featured).map(s =>
        `<option value="${s.id}">${s.title}${s.visible === false ? ' [HIDDEN]' : ''}</option>`
    ).join('');
    document.getElementById('f-section').innerHTML      = modalOpts;
    document.getElementById('filter-section').innerHTML = '<option value="">ALL SECTIONS</option>' + allOpts;
}

function toggleShowHidden() {
    showHiddenSections = !showHiddenSections;
    const btn = document.getElementById('btn-show-hidden');
    btn.classList.toggle('active', showHiddenSections);
    populateSectionSelects();
    renderTiles();
}

function checkSectionVisibility() {
    const id  = document.getElementById('f-section').value;
    const sec = state.sections.find(s => s.id === id);
    const msg = document.getElementById('f-section-hidden-hint');
    if (msg) msg.style.display = (sec && sec.visible === false) ? '' : 'none';
}

function populateStatusSelect() {
    document.getElementById('f-status').innerHTML =
        state.statuses.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
}

function renderTiles() {
    const filter        = document.getElementById('filter-section').value;
    const featuredSec   = state.sections.find(s => s.featured === true);
    const isFeaturedView = !!(featuredSec && filter === featuredSec.id);
    const sortable      = filter !== '';
    currentFilter       = filter;
    const secOrderMap   = Object.fromEntries(state.sections.map((s, i) => [s.id, i]));
    const statusMap     = Object.fromEntries(state.statuses.map(s => [s.id, s]));
    const visibleSectionIds = new Set(
        state.sections.filter(s => showHiddenSections || s.visible !== false).map(s => s.id)
    );
    const tiles = isFeaturedView
        ? state.tiles.filter(t => t.featured > 0).sort((a, b) => a.featured - b.featured)
        : filter
        ? state.tiles.filter(t => t.section === filter)
        : [...state.tiles].filter(t => visibleSectionIds.has(t.section)).sort((a, b) => (secOrderMap[a.section] ?? 999) - (secOrderMap[b.section] ?? 999));
    const secMap = Object.fromEntries(state.sections.map(s => [s.id, s.visible === false ? `${s.title} [HIDDEN]` : s.title]));
    const empty  = document.getElementById('empty-state');
    const table  = document.getElementById('tiles-table');

    const showHiddenBtn = document.getElementById('btn-show-hidden');
    if (showHiddenBtn) showHiddenBtn.style.display = filter ? 'none' : '';

    if (!tiles.length) {
        empty.classList.remove('hidden');
        table.classList.add('hidden');
        return;
    }
    empty.classList.add('hidden');
    table.classList.remove('hidden');

    const dragAttrs = (id) => sortable
        ? `draggable="true" ondragstart="onDragStart(event,'${id}')" ondragover="onDragOver(event)" ondragenter="onDragEnter(event)" ondragleave="onDragLeave(event)" ondragend="onDragEnd(event)" ondrop="onTileDrop(event,'${id}')"`
        : '';

    const sentinelRow = sortable
        ? `<tr class="drop-sentinel" ondragover="onDragOver(event)" ondragenter="onDragEnter(event)" ondragleave="onDragLeave(event)" ondrop="onTileDropEnd(event)"><td colspan="8"></td></tr>`
        : '';

    document.getElementById('tiles-tbody').innerHTML = tiles.map(t => {
        const st     = statusMap[t.status] || { label: t.status.toUpperCase(), color: '#9aa8b3' };
        const hidden = t.visible === false;
        const isFeat = t.featured > 0;
        return `
        <tr class="${hidden ? 'tile-hidden' : ''}" ${dragAttrs(t.id)}>
            <td class="${sortable ? 'drag-handle' : ''}">${sortable ? '⠿' : ''}</td>
            <td><div class="img-thumb ${t.showImage ? '' : 'img-thumb-off'} ${t.domain ? '' : 'img-thumb-initial'}" style="${t.domain ? `background-image:url('https://www.google.com/s2/favicons?domain=${t.domain.split('·')[0].trim()}&sz=64')` : ''}" onclick="toggleShowImage('${t.id}')" title="${t.showImage ? 'Image on — click to hide' : 'Image off — click to show'}">${t.domain ? '' : (t.name || '?')[0].toUpperCase()}</div></td>
            <td><button class="star-btn ${isFeat ? 'star-on' : ''}" onclick="toggleFeatured('${t.id}')">${isFeat ? '★' : '☆'}</button></td>
            <td class="name-cell">${t.name}<small>${t.cat}</small></td>
            <td class="sec-cell">${secMap[t.section] || t.section}</td>
            <td><span class="badge" style="color:${st.color};border-color:${st.color}40">${st.label}</span></td>
            <td class="domain-cell">${t.domain}</td>
            <td style="white-space:nowrap">
                <button class="btn btn-sm" onclick="openTileModal('${t.id}')">EDIT</button>
                <button class="btn btn-sm" onclick="openCopyModal('${t.id}')">COPY</button>
                <button class="btn btn-sm ${hidden ? 'btn-vis-off' : 'btn-vis'}" onclick="toggleVisible('${t.id}')">${hidden ? 'SHOW' : 'HIDE'}</button>
                <button class="btn btn-sm btn-del" onclick="deleteTile('${t.id}')">DEL</button>
            </td>
        </tr>`;
    }).join('') + sentinelRow;
}

function renderSections() {
    const sentinel = `<div class="drop-sentinel" ondragover="onDragOver(event)" ondragenter="onDragEnter(event)" ondragleave="onDragLeave(event)" ondrop="onSectionDropEnd(event)"></div>`;

    document.getElementById('sections-list').innerHTML = state.sections.map(s => {
        const count  = s.featured
            ? state.tiles.filter(t => t.featured > 0).length
            : state.tiles.filter(t => t.section === s.id).length;
        const hidden     = s.visible === false;
        const isFeatured = s.featured === true;
        const typeTag    = isFeatured ? `<span class="sec-type-tag">FEATURED</span>` : '';
        const delBtn     = isFeatured
            ? `<button class="btn btn-sm btn-del" disabled title="Cannot delete the featured section">DEL</button>`
            : `<button class="btn btn-sm btn-del" onclick="deleteSection('${s.id}')">DEL</button>`;
        return `
            <div class="section-row${hidden ? ' section-hidden' : ''}" draggable="true"
                 ondragstart="onDragStart(event,'${s.id}')"
                 ondragover="onDragOver(event)"
                 ondragenter="onDragEnter(event)"
                 ondragleave="onDragLeave(event)"
                 ondragend="onDragEnd(event)"
                 ondrop="onSectionDrop(event,'${s.id}')">
                <span class="drag-handle">⠿</span>
                <span class="sec-title">${s.title}</span>
                ${typeTag}
                <span class="sec-count">${count} tile${count !== 1 ? 's' : ''}</span>
                <button class="btn btn-sm" onclick="openSectionModal('${s.id}')">EDIT</button>
                <button class="btn btn-sm ${hidden ? 'btn-vis-off' : 'btn-vis'}" onclick="toggleSectionVisible('${s.id}')">${hidden ? 'SHOW' : 'HIDE'}</button>
                ${delBtn}
            </div>
        `;
    }).join('') + sentinel;
}

function renderStatuses() {
    document.getElementById('statuses-list').innerHTML = state.statuses.map(s => {
        const count = state.tiles.filter(t => t.status === s.id).length;
        return `
            <div class="section-row">
                <span class="status-swatch" style="background:${s.color}"></span>
                <span class="sec-title">${s.label}</span>
                <span class="status-slug">${s.id}</span>
                <span class="sec-count">${count} tile${count !== 1 ? 's' : ''}</span>
                <button class="btn btn-sm" onclick="openStatusModal('${s.id}')">EDIT</button>
                <button class="btn btn-sm btn-del" onclick="deleteStatus('${s.id}')">DEL</button>
            </div>
        `;
    }).join('');
}

// ── Tile CRUD ────────────────────────────────────────────────────────────

function openTileModal(id) {
    document.getElementById('tile-form').reset();
    if (id) {
        const t = state.tiles.find(t => t.id === id);
        document.getElementById('tile-modal-title').textContent = 'EDIT TILE';
        document.getElementById('f-id').value         = t.id;
        document.getElementById('f-type').value       = t.type      || 'link';
        document.getElementById('f-section').value    = t.section;
        document.getElementById('f-cat').value        = t.cat;
        document.getElementById('f-name').value       = t.name;
        document.getElementById('f-desc').value       = t.desc;
        document.getElementById('f-status').value     = t.status;
        document.getElementById('f-domain').value     = t.domain;
        document.getElementById('f-href').value       = t.href  || '';
        document.getElementById('f-image').value      = t.image || '';
        document.getElementById('f-slug').value       = t.slug  || '';
        document.getElementById('f-price').value      = t.price || '';
        document.getElementById('f-expand').checked   = !!t.expand;
        populateCatalogRefSelect(t.catalogRef || '');
        document.getElementById('f-catalogref').value = t.catalogRef || '';
    } else {
        document.getElementById('tile-modal-title').textContent = 'ADD TILE';
        document.getElementById('f-id').value    = '';
        document.getElementById('f-type').value  = 'link';
        document.getElementById('f-expand').checked = false;
        populateCatalogRefSelect('');
    }
    document.getElementById('tile-modal').classList.remove('hidden');
    checkSectionVisibility();
    checkTileType();
}

function saveTile(e) {
    e.preventDefault();
    const id       = document.getElementById('f-id').value;
    const existing = id ? state.tiles.find(t => t.id === id) : null;
    const type = document.getElementById('f-type').value || 'link';
    const tile = {
        id:         id || String(Date.now()),
        type,
        section:    document.getElementById('f-section').value,
        cat:        document.getElementById('f-cat').value,
        name:       document.getElementById('f-name').value,
        desc:       document.getElementById('f-desc').value,
        status:     document.getElementById('f-status').value,
        domain:     document.getElementById('f-domain').value,
        href:       document.getElementById('f-href').value,
        image:      document.getElementById('f-image').value,
        slug:       document.getElementById('f-slug').value,
        price:      document.getElementById('f-price').value,
        catalogRef: document.getElementById('f-catalogref').value,
        visible:    existing ? existing.visible  : true,
        featured:   existing ? (existing.featured || 0) : 0,
        expand:     document.getElementById('f-expand').checked,
        showImage:  document.getElementById('f-expand').checked ? false : (existing ? !!existing.showImage : false),
    };
    if (id) {
        state.tiles[state.tiles.findIndex(t => t.id === id)] = tile;
    } else {
        state.tiles.push(tile);
    }
    closeModal('tile-modal');
    save();
    renderTiles();
    toast(id ? 'Tile updated.' : 'Tile added.');
}

function toggleFeatured(id) {
    const t = state.tiles.find(t => t.id === id);
    if (!t) return;
    if (t.featured > 0) {
        const removed = t.featured;
        t.featured = 0;
        state.tiles.filter(x => x.featured > removed).forEach(x => { x.featured--; });
        toast('Removed from featured.');
    } else {
        t.featured = Math.max(0, ...state.tiles.map(x => x.featured || 0)) + 1;
        toast(`Featured at position ${t.featured}.`);
    }
    save();
    renderTiles();
}

function toggleVisible(id) {
    const t = state.tiles.find(t => t.id === id);
    if (!t) return;
    t.visible = t.visible === false;
    save();
    renderTiles();
    toast(t.visible ? 'Tile visible.' : 'Tile hidden.');
}

function toggleShowImage(id) {
    const t = state.tiles.find(t => t.id === id);
    if (!t) return;
    t.showImage = !t.showImage;
    if (t.showImage) t.expand = false;
    save();
    renderTiles();
    toast(t.showImage ? 'Image on.' : 'Image off.');
}

function deleteTile(id) {
    if (!confirm('Delete this tile?')) return;
    state.tiles = state.tiles.filter(t => t.id !== id);
    save();
    renderTiles();
    toast('Tile deleted.');
}

function openCopyModal(id) {
    const t = state.tiles.find(t => t.id === id);
    if (!t) return;
    document.getElementById('copy-src-id').value = id;
    document.getElementById('cf-name').value     = t.name;
    const sel = document.getElementById('cf-section');
    sel.innerHTML = state.sections.filter(s => !s.featured).map(s =>
        `<option value="${s.id}"${s.id === t.section ? ' selected' : ''}>${s.title}${s.visible === false ? ' [HIDDEN]' : ''}</option>`
    ).join('');
    document.getElementById('copy-modal').classList.remove('hidden');
}

function confirmCopy(e) {
    e.preventDefault();
    const id = document.getElementById('copy-src-id').value;
    const t  = state.tiles.find(t => t.id === id);
    if (!t) return;
    const copy = { ...t, id: String(Date.now()), name: document.getElementById('cf-name').value, section: document.getElementById('cf-section').value, featured: 0 };
    state.tiles.push(copy);
    closeModal('copy-modal');
    save();
    renderTiles();
    toast('Tile copied.');
}

// ── Section CRUD ─────────────────────────────────────────────────────────

function openSectionModal(id) {
    document.getElementById('section-form').reset();
    if (id) {
        const s = state.sections.find(s => s.id === id);
        document.getElementById('sec-modal-title').textContent = 'EDIT SECTION';
        document.getElementById('sf-id').value    = s.id;
        document.getElementById('sf-title').value = s.title;
    } else {
        document.getElementById('sec-modal-title').textContent = 'ADD SECTION';
        document.getElementById('sf-id').value = '';
    }
    document.getElementById('section-modal').classList.remove('hidden');
}

function saveSection(e) {
    e.preventDefault();
    const id    = document.getElementById('sf-id').value;
    const title = document.getElementById('sf-title').value;
    if (id) {
        state.sections[state.sections.findIndex(s => s.id === id)].title = title;
    } else {
        let id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (state.sections.some(s => s.id === id)) id = id + '-' + Date.now();
        state.sections.push({ id, title });
    }
    closeModal('section-modal');
    save();
    populateSectionSelects();
    renderSections();
    toast(id ? 'Section updated.' : 'Section added.');
}

function toggleSectionVisible(id) {
    const s = state.sections.find(s => s.id === id);
    if (!s) return;
    s.visible = s.visible === false;
    save();
    populateSectionSelects();
    renderSections();
    toast(s.visible ? 'Section visible.' : 'Section hidden.');
}

function deleteSection(id) {
    const sec = state.sections.find(s => s.id === id);
    if (sec && sec.featured) {
        alert('The featured section cannot be deleted. You can hide it instead.');
        return;
    }
    if (state.tiles.some(t => t.section === id)) {
        alert('Move or delete the tiles in this section first.');
        return;
    }
    if (!confirm('Delete this section?')) return;
    state.sections = state.sections.filter(s => s.id !== id);
    save();
    populateSectionSelects();
    renderSections();
    toast('Section deleted.');
}

// ── Status CRUD ──────────────────────────────────────────────────────────

function openStatusModal(id) {
    document.getElementById('status-form').reset();
    const idRow = document.getElementById('stf-id-row');
    if (id) {
        const s = state.statuses.find(s => s.id === id);
        document.getElementById('stf-modal-title').textContent  = 'EDIT STATUS';
        document.getElementById('stf-id').value                 = s.id;
        document.getElementById('stf-id-display').value         = s.id;
        document.getElementById('stf-label').value              = s.label;
        document.getElementById('stf-color').value              = s.color;
        idRow.classList.remove('hidden');
    } else {
        document.getElementById('stf-modal-title').textContent = 'ADD STATUS';
        document.getElementById('stf-id').value                = '';
        document.getElementById('stf-color').value             = '#0C9DDE';
        idRow.classList.add('hidden');
    }
    document.getElementById('status-modal').classList.remove('hidden');
}

function saveStatus(e) {
    e.preventDefault();
    const id    = document.getElementById('stf-id').value;
    const label = document.getElementById('stf-label').value.trim().toUpperCase();
    const color = document.getElementById('stf-color').value;
    if (id) {
        const idx = state.statuses.findIndex(s => s.id === id);
        if (idx >= 0) state.statuses[idx] = { id, label, color };
    } else {
        const newId = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (state.statuses.some(s => s.id === newId)) {
            alert('A status with that ID already exists.');
            return;
        }
        state.statuses.push({ id: newId, label, color });
    }
    closeModal('status-modal');
    save();
    populateStatusSelect();
    renderStatuses();
    renderTiles();
    toast(id ? 'Status updated.' : 'Status added.');
}

function deleteStatus(id) {
    const count = state.tiles.filter(t => t.status === id).length;
    if (count > 0) {
        alert(`Cannot delete: ${count} tile${count !== 1 ? 's' : ''} use this status. Update those tiles first.`);
        return;
    }
    if (!confirm('Delete this status?')) return;
    state.statuses = state.statuses.filter(s => s.id !== id);
    save();
    populateStatusSelect();
    renderStatuses();
    toast('Status deleted.');
}

// ── Helpers ──────────────────────────────────────────────────────────────

function showTab(name) {
    ['tiles', 'sections', 'statuses', 'catalog'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== name);
        document.getElementById(`tab-${t}-btn`).classList.toggle('active', t === name);
    });
    if (name === 'tiles')    renderTiles();
    if (name === 'statuses') renderStatuses();
    if (name === 'catalog')  renderCatalogTracks();
}

function checkTileType() {
    const type      = document.getElementById('f-type').value;
    const isLink    = !type || type === 'link';
    const isCatalog = type === 'catalog';
    const isBuy     = type === 'buy';
    const isInfo    = type === 'info';

    document.getElementById('f-group-catalogref').classList.toggle('hidden', !isCatalog);
    document.getElementById('f-group-slug').classList.toggle('hidden', !isBuy && !isInfo);
    document.getElementById('f-group-price').classList.toggle('hidden', !isBuy);
    document.getElementById('f-group-link-extras').classList.toggle('hidden', !isLink);

    const hintEl = document.getElementById('f-slug-hint');
    if (isBuy)       hintEl.textContent = 'Builds a sale page at buy/slug/ — link set automatically';
    else if (isInfo) hintEl.textContent = 'Builds a page at this path — use dir/slug for nested (e.g. events/rave-2026)';
    else             hintEl.textContent = 'Builds a track page — link set automatically to tracks/slug/';

    if (isCatalog) {
        populateCatalogRefSelect(document.getElementById('f-catalogref').value);
        syncCatalogRef();
    } else {
        // When switching away from catalog, seed the slug from catalogRef if slug is empty
        const slugEl   = document.getElementById('f-slug');
        const catRef   = document.getElementById('f-catalogref').value;
        if (!slugEl.value && catRef) slugEl.value = catRef;
        syncSlugHref();
    }
}

function syncCatalogRef() {
    const slug   = document.getElementById('f-catalogref').value;
    const hrefEl = document.getElementById('f-href');
    if (slug) {
        hrefEl.value    = 'tracks/' + slug + '/';
        hrefEl.readOnly = true;
        hrefEl.classList.add('input-locked');
    } else {
        hrefEl.value    = '';
        hrefEl.readOnly = false;
        hrefEl.classList.remove('input-locked');
    }
}

function populateCatalogRefSelect(selectedSlug) {
    const sel = document.getElementById('f-catalogref');
    sel.innerHTML = '<option value="">— pick a catalog entry —</option>' +
        catalogState.tracks.map(t =>
            `<option value="${t.slug}"${t.slug === selectedSlug ? ' selected' : ''}>${t.title || t.slug}${t.artist ? ' — ' + t.artist : ''}</option>`
        ).join('');
}

function syncSlugHref() {
    const type   = document.getElementById('f-type').value;
    const slug   = document.getElementById('f-slug').value.trim();
    const hrefEl = document.getElementById('f-href');
    if (slug) {
        let prefix = 'tracks/';
        if (type === 'buy')  prefix = 'buy/';
        if (type === 'info') prefix = '';
        hrefEl.value    = prefix + slug + '/';
        hrefEl.readOnly = true;
        hrefEl.classList.add('input-locked');
    } else {
        hrefEl.readOnly = false;
        hrefEl.classList.remove('input-locked');
    }
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Catalog Import / Export ──────────────────────────────────────────────

function saveCatalog() {
    localStorage.setItem('tile_manager_catalog', JSON.stringify(catalogState));
}

function importCatalog() {
    document.getElementById('catalog-file-input').value = '';
    document.getElementById('catalog-file-input').click();
}

function handleCatalogImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const loaded = JSON.parse(ev.target.result);
            if (!Array.isArray(loaded.tracks)) throw new Error('Missing tracks array.');
            if (!loaded.artists)  loaded.artists  = [];
            if (!loaded.labels)   loaded.labels   = [];
            if (!loaded.releases) loaded.releases = [];
            catalogState = loaded;
            saveCatalog();
            renderCatalogTracks();
            toast('Imported ' + file.name);
        } catch (err) {
            alert('Catalog import failed: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function buildCatalogExportJSON() {
    return {
        artists:  catalogState.artists,
        labels:   catalogState.labels,
        releases: catalogState.releases,
        tracks:   catalogState.tracks.map(t => {
            const out = { slug: t.slug };
            if (t.title)                  out.title    = t.title;
            if (t.artist)                 out.artist   = t.artist;
            if (t.bpm)                    out.bpm      = t.bpm;
            if (t.key)                    out.key      = t.key;
            if (t.duration)               out.duration = t.duration;
            if (t.album)                  out.album    = t.album;
            if (t.cat)                    out.cat      = t.cat;
            if (t.desc)                   out.desc     = t.desc;
            if (t.audio)                  out.audio    = t.audio;
            if (t.image)                  out.image    = t.image;
            if (t.genre && t.genre.length) out.genre   = t.genre;
            if (t.visible === false)       out.visible  = false;
            return out;
        }),
    };
}

function exportCatalog() {
    const out  = buildCatalogExportJSON();
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'catalog.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Exported catalog.json');
}

function copyCatalog() {
    navigator.clipboard.writeText(JSON.stringify(buildCatalogExportJSON(), null, 2))
        .then(() => toast('Catalog JSON copied to clipboard.'))
        .catch(() => toast('Copy failed — try Export instead.'));
}

// ── Catalog Render ───────────────────────────────────────────────────────

function renderCatalogTracks() {
    const tbody = document.getElementById('catalog-tracks-tbody');
    if (!tbody) return;
    if (!catalogState.tracks.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-catalog">No tracks. Import catalog.json or add tracks manually.</td></tr>`;
        return;
    }
    tbody.innerHTML = catalogState.tracks.map(t => {
        const hidden   = t.visible === false;
        const hasAudio = !!t.audio;
        const slug     = t.slug.replace(/'/g, "\\'");
        return `
        <tr class="${hidden ? 'tile-hidden' : ''}"
            draggable="true"
            ondragstart="onCatalogTrackDragStart(event,'${slug}')"
            ondragover="onDragOver(event)"
            ondragenter="onDragEnter(event)"
            ondragleave="onDragLeave(event)"
            ondragend="onDragEnd(event)"
            ondrop="onCatalogTrackDrop(event,'${slug}')">
            <td class="drag-handle">⠿</td>
            <td class="name-cell">${t.title || t.slug}<small>${t.slug}</small></td>
            <td>${t.artist || ''}</td>
            <td>${t.album  || ''}</td>
            <td>${t.cat    || ''}</td>
            <td>${hasAudio
                ? '<span class="badge" style="color:var(--blue);border-color:#0c9dde40">AUDIO</span>'
                : '<span class="badge" style="color:#9aa8b3;border-color:#9aa8b340">NONE</span>'}</td>
            <td style="white-space:nowrap">
                <button class="btn btn-sm" onclick="openCatalogTrackModal('${slug}')">EDIT</button>
                <button class="btn btn-sm ${hidden ? 'btn-vis-off' : 'btn-vis'}" onclick="toggleCatalogTrackVisible('${slug}')">${hidden ? 'SHOW' : 'HIDE'}</button>
                <button class="btn btn-sm btn-del" onclick="deleteCatalogTrack('${slug}')">DEL</button>
            </td>
        </tr>`;
    }).join('') +
    `<tr class="drop-sentinel" ondragover="onDragOver(event)" ondragenter="onDragEnter(event)" ondragleave="onDragLeave(event)" ondrop="onCatalogTrackDropEnd(event)"><td colspan="7"></td></tr>`;
}

// ── Catalog Track CRUD ───────────────────────────────────────────────────

function openCatalogTrackModal(slug) {
    document.getElementById('catalog-track-form').reset();
    document.getElementById('ct-visible').checked = true;
    const artistSel = document.getElementById('ct-artist');
    const albumSel = document.getElementById('ct-album');
    if (albumSel) {
        albumSel.innerHTML = '<option value="">— none —</option>' +
            catalogState.releases.map(r =>
                `<option value="${r.title.replace(/"/g, '&quot;')}">${r.title}</option>`
            ).join('');
    }
    if (slug) {
        const t = catalogState.tracks.find(t => t.slug === slug);
        if (!t) return;
        populateArtistSelect(artistSel, t.artist || '');
        document.getElementById('ct-modal-title').textContent = 'EDIT TRACK';
        document.getElementById('ct-orig-slug').value  = t.slug;
        document.getElementById('ct-slug').value       = t.slug;
        document.getElementById('ct-title').value      = t.title    || '';
        document.getElementById('ct-album').value      = t.album    || '';
        document.getElementById('ct-bpm').value        = t.bpm      || '';
        document.getElementById('ct-key').value        = t.key      || '';
        document.getElementById('ct-duration').value   = t.duration || '';
        document.getElementById('ct-cat').value        = t.cat      || '';
        document.getElementById('ct-desc').value       = t.desc     || '';
        document.getElementById('ct-audio').value      = t.audio    || '';
        document.getElementById('ct-image').value      = t.image    || '';
        document.getElementById('ct-visible').checked  = t.visible !== false;
    } else {
        populateArtistSelect(artistSel, '');
        document.getElementById('ct-modal-title').textContent = 'ADD TRACK';
        document.getElementById('ct-orig-slug').value = '';
    }
    document.getElementById('catalog-track-modal').classList.remove('hidden');
}

function saveCatalogTrack(e) {
    e.preventDefault();
    const origSlug = document.getElementById('ct-orig-slug').value;
    const slug = document.getElementById('ct-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) { alert('Slug is required.'); return; }
    if (!origSlug || origSlug !== slug) {
        if (catalogState.tracks.some(t => t.slug === slug)) {
            alert('A track with that slug already exists.');
            return;
        }
    }
    const track = { slug };
    const str = id => document.getElementById(id).value.trim();
    if (str('ct-title'))      track.title    = str('ct-title');
    if (str('ct-artist'))     track.artist   = str('ct-artist');
    if (str('ct-album'))      track.album    = str('ct-album');
    const bpmRaw = str('ct-bpm');
    if (bpmRaw)               track.bpm      = Number(bpmRaw);
    if (str('ct-key'))        track.key      = str('ct-key');
    if (str('ct-duration'))   track.duration = str('ct-duration');
    if (str('ct-cat'))        track.cat      = str('ct-cat');
    if (str('ct-desc'))   track.desc   = str('ct-desc');
    if (str('ct-audio'))  track.audio  = str('ct-audio');
    if (str('ct-image'))  track.image  = str('ct-image');
    if (!document.getElementById('ct-visible').checked) track.visible = false;
    if (origSlug) {
        const idx = catalogState.tracks.findIndex(t => t.slug === origSlug);
        if (idx >= 0) catalogState.tracks[idx] = track;
    } else {
        catalogState.tracks.push(track);
    }
    closeModal('catalog-track-modal');
    saveCatalog();
    renderCatalogTracks();
    toast(origSlug ? 'Track updated.' : 'Track added.');
}

function toggleCatalogTrackVisible(slug) {
    const t = catalogState.tracks.find(t => t.slug === slug);
    if (!t) return;
    t.visible = t.visible === false;
    saveCatalog();
    renderCatalogTracks();
    toast(t.visible !== false ? 'Track visible.' : 'Track hidden.');
}

function deleteCatalogTrack(slug) {
    if (!confirm('Delete this track from the catalog?')) return;
    catalogState.tracks = catalogState.tracks.filter(t => t.slug !== slug);
    saveCatalog();
    renderCatalogTracks();
    toast('Track deleted.');
}

// ── Catalog Drag and Drop ────────────────────────────────────────────────

function onCatalogTrackDragStart(e, slug) {
    catalogDragSrcSlug = slug;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
}

function onCatalogTrackDrop(e, targetSlug) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!catalogDragSrcSlug || catalogDragSrcSlug === targetSlug) { catalogDragSrcSlug = null; return; }
    const srcIdx = catalogState.tracks.findIndex(t => t.slug === catalogDragSrcSlug);
    let   tgtIdx = catalogState.tracks.findIndex(t => t.slug === targetSlug);
    if (srcIdx < 0 || tgtIdx < 0) { catalogDragSrcSlug = null; return; }
    const [moved] = catalogState.tracks.splice(srcIdx, 1);
    if (srcIdx < tgtIdx) tgtIdx--;
    catalogState.tracks.splice(tgtIdx, 0, moved);
    catalogDragSrcSlug = null;
    saveCatalog();
    renderCatalogTracks();
}

function onCatalogTrackDropEnd(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!catalogDragSrcSlug) return;
    const srcIdx = catalogState.tracks.findIndex(t => t.slug === catalogDragSrcSlug);
    if (srcIdx < 0) { catalogDragSrcSlug = null; return; }
    const [moved] = catalogState.tracks.splice(srcIdx, 1);
    catalogState.tracks.push(moved);
    catalogDragSrcSlug = null;
    saveCatalog();
    renderCatalogTracks();
}

// ── Playlist Import / Export ─────────────────────────────────────────────

function savePlaylists() {
    localStorage.setItem('tile_manager_playlists', JSON.stringify(playlistsState));
}

function importPlaylists() {
    document.getElementById('playlists-file-input').value = '';
    document.getElementById('playlists-file-input').click();
}

function handlePlaylistsImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const loaded = JSON.parse(ev.target.result);
            if (!Array.isArray(loaded.playlists)) throw new Error('Missing playlists array.');
            if (!loaded.jingles) loaded.jingles = [];
            playlistsState = loaded;
            savePlaylists();
            renderPlaylists();
            toast('Imported ' + file.name);
        } catch (err) {
            alert('Playlists import failed: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function buildPlaylistsExportJSON() {
    return {
        default:   playlistsState.default,
        playlists: playlistsState.playlists.map(p => ({ id: p.id, title: p.title, tracks: p.tracks })),
        jingles:   playlistsState.jingles,
    };
}

function exportPlaylists() {
    const out  = buildPlaylistsExportJSON();
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'playlists.json'; a.click();
    URL.revokeObjectURL(url);
    toast('Exported playlists.json');
}

function copyPlaylists() {
    navigator.clipboard.writeText(JSON.stringify(buildPlaylistsExportJSON(), null, 2))
        .then(() => toast('Playlists JSON copied.'))
        .catch(() => toast('Copy failed.'));
}

// ── Playlist Render ───────────────────────────────────────────────────────

function renderPlaylists() {
    const panel = document.getElementById('pl-list-panel');
    if (!panel) return;
    if (!playlistsState.playlists.length) {
        panel.innerHTML = '<span class="stub-msg">No playlists yet.</span>';
        return;
    }
    panel.innerHTML = playlistsState.playlists.map(p => {
        const isDefault = playlistsState.default === p.id;
        const isActive  = activePlaylistId === p.id;
        return `
        <div class="pl-list-item${isActive ? ' active' : ''}" onclick="selectPlaylist('${p.id}')">
            <span class="pl-list-title">${p.title}</span>
            ${isDefault ? '<span class="pl-default-badge">DEFAULT</span>' : ''}
            <span class="pl-list-count">${p.tracks.length}</span>
            <button class="btn btn-sm" onclick="event.stopPropagation();openPlaylistModal('${p.id}')">EDIT</button>
            <button class="btn btn-sm btn-del" onclick="event.stopPropagation();deletePlaylist('${p.id}')">DEL</button>
        </div>`;
    }).join('');
}

function selectPlaylist(id) {
    activePlaylistId = id;
    renderPlaylists();
    renderPlaylistDetail(id);
}

function renderPlaylistDetail(id) {
    const panel = document.getElementById('pl-detail-panel');
    if (!panel) return;
    const pl = playlistsState.playlists.find(p => p.id === id);
    if (!pl) return;
    const isDefault = playlistsState.default === id;

    const trackRows = pl.tracks.map((slug, i) => {
        let label;
        if (slug.startsWith('jingle:')) {
            const jId = slug.slice(7);
            const j   = playlistsState.jingles.find(j => j.id === jId);
            label = j ? `♪ ${j.title}` : `${slug} ⚠ not found`;
        } else {
            const entry = catalogState.tracks.find(t => t.slug === slug);
            label = entry
                ? (entry.artist ? `${entry.artist} — ${entry.title || slug}` : (entry.title || slug))
                : `${slug} ⚠ not in catalog`;
        }
        const esc = slug.replace(/'/g, "\\'");
        return `
        <div class="pl-track-row" draggable="true"
            ondragstart="onPLTrackDragStart(event,${i})"
            ondragover="onDragOver(event)" ondragenter="onDragEnter(event)"
            ondragleave="onDragLeave(event)" ondragend="onDragEnd(event)"
            ondrop="onPLTrackDrop(event,${i})">
            <span class="drag-handle">⠿</span>
            <span class="pl-track-name">${label}</span>
            <button class="btn btn-sm btn-del" onclick="removeTrackFromPlaylist('${id}',${i})">✕</button>
        </div>`;
    }).join('') +
    `<div class="drop-sentinel pl-drop-sentinel"
        ondragover="onDragOver(event)" ondragenter="onDragEnter(event)"
        ondragleave="onDragLeave(event)" ondrop="onPLTrackDropEnd(event)"></div>`;

    const availTracks = catalogState.tracks
        .slice()
        .sort((a, b) => {
            const aa = (a.artist || '').toLowerCase();
            const ba = (b.artist || '').toLowerCase();
            if (aa !== ba) return aa.localeCompare(ba);
            return (a.title || a.slug).toLowerCase().localeCompare((b.title || b.slug).toLowerCase());
        });
    const availJingles = playlistsState.jingles;

    const trackOpts  = availTracks.map(t => {
        const lbl = t.artist ? `${t.artist} — ${t.title || t.slug}` : (t.title || t.slug);
        return `<option value="${t.slug}">${lbl}</option>`;
    }).join('');
    const jingleOpts = availJingles.map(j =>
        `<option value="jingle:${j.id}">${j.title}</option>`
    ).join('');
    const pickerOpts = [
        trackOpts  ? `<optgroup label="TRACKS">${trackOpts}</optgroup>`   : '',
        jingleOpts ? `<optgroup label="JINGLES">${jingleOpts}</optgroup>` : '',
    ].join('');
    const hasOptions = availTracks.length + availJingles.length > 0;

    panel.innerHTML = `
    <div class="pl-detail-header">
        <span class="pl-detail-name">${pl.title}</span>
        ${isDefault
            ? '<span class="pl-default-badge">DEFAULT</span>'
            : `<button class="btn btn-sm" onclick="setDefaultPlaylist('${id}')">SET DEFAULT</button>`}
        <span class="pl-list-count">${pl.tracks.length} track${pl.tracks.length !== 1 ? 's' : ''}</span>
    </div>
    <div id="pl-track-list">${trackRows}</div>
    <div class="pl-add-row">
        <select class="pl-track-picker" ${!hasOptions ? 'disabled' : ''} onchange="addTrackFromPicker(this,'${id}')">
            <option value="">${hasOptions ? '+ add track or jingle…' : 'No tracks in catalog'}</option>
            ${pickerOpts}
        </select>
    </div>`;
}

// ── Playlist CRUD ─────────────────────────────────────────────────────────

function openPlaylistModal(id) {
    document.getElementById('playlist-form').reset();
    if (id) {
        const p = playlistsState.playlists.find(p => p.id === id);
        if (!p) return;
        document.getElementById('pl-modal-title').textContent = 'EDIT PLAYLIST';
        document.getElementById('pl-orig-id').value = p.id;
        document.getElementById('pl-title').value   = p.title;
    } else {
        document.getElementById('pl-modal-title').textContent = 'ADD PLAYLIST';
        document.getElementById('pl-orig-id').value = '';
    }
    document.getElementById('playlist-modal').classList.remove('hidden');
}

function savePlaylist(e) {
    e.preventDefault();
    const origId = document.getElementById('pl-orig-id').value;
    const title  = document.getElementById('pl-title').value.trim();
    if (origId) {
        const p = playlistsState.playlists.find(p => p.id === origId);
        if (p) p.title = title;
        toast('Playlist updated.');
    } else {
        let id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (playlistsState.playlists.some(p => p.id === id)) id = id + '-' + Date.now();
        playlistsState.playlists.push({ id, title, tracks: [] });
        if (!playlistsState.default) playlistsState.default = id;
    }
    closeModal('playlist-modal');
    savePlaylists();
    renderPlaylists();
    if (activePlaylistId) renderPlaylistDetail(activePlaylistId);
    toast(origId ? 'Playlist updated.' : 'Playlist added.');
}

function deletePlaylist(id) {
    if (!confirm('Delete this playlist?')) return;
    playlistsState.playlists = playlistsState.playlists.filter(p => p.id !== id);
    if (playlistsState.default === id)
        playlistsState.default = playlistsState.playlists.length ? playlistsState.playlists[0].id : '';
    if (activePlaylistId === id) {
        activePlaylistId = null;
        const panel = document.getElementById('pl-detail-panel');
        if (panel) panel.innerHTML = '<span class="stub-msg">Select a playlist to manage its tracks.</span>';
    }
    savePlaylists();
    renderPlaylists();
    toast('Playlist deleted.');
}

function setDefaultPlaylist(id) {
    playlistsState.default = id;
    savePlaylists();
    renderPlaylists();
    renderPlaylistDetail(id);
    toast('Default playlist set.');
}

function addTrackFromPicker(sel, playlistId) {
    const slug = sel.value;
    if (!slug) return;
    const pl = playlistsState.playlists.find(p => p.id === playlistId);
    if (!pl) { sel.value = ''; return; }
    pl.tracks.push(slug);
    sel.value = '';
    savePlaylists();
    renderPlaylists();
    renderPlaylistDetail(playlistId);
}

function removeTrackFromPlaylist(playlistId, idx) {
    const pl = playlistsState.playlists.find(p => p.id === playlistId);
    if (!pl || idx < 0 || idx >= pl.tracks.length) return;
    pl.tracks.splice(idx, 1);
    savePlaylists();
    renderPlaylists();
    renderPlaylistDetail(playlistId);
}

// ── Playlist Track Drag and Drop ──────────────────────────────────────────

function onPLTrackDragStart(e, idx) {
    plTrackDragSrc = idx;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
}

function onPLTrackDrop(e, tgtIdx) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const srcIdx = plTrackDragSrc;
    if (!activePlaylistId || srcIdx < 0 || srcIdx === tgtIdx) {
        plTrackDragSrc = -1; return;
    }
    const pl = playlistsState.playlists.find(p => p.id === activePlaylistId);
    if (!pl) { plTrackDragSrc = -1; return; }
    const [moved] = pl.tracks.splice(srcIdx, 1);
    let insertAt = tgtIdx;
    if (srcIdx < tgtIdx) insertAt--;
    pl.tracks.splice(insertAt, 0, moved);
    plTrackDragSrc = -1;
    savePlaylists();
    renderPlaylistDetail(activePlaylistId);
}

function onPLTrackDropEnd(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const srcIdx = plTrackDragSrc;
    if (!activePlaylistId || srcIdx < 0) { plTrackDragSrc = -1; return; }
    const pl = playlistsState.playlists.find(p => p.id === activePlaylistId);
    if (!pl) { plTrackDragSrc = -1; return; }
    const [moved] = pl.tracks.splice(srcIdx, 1);
    pl.tracks.push(moved);
    plTrackDragSrc = -1;
    savePlaylists();
    renderPlaylistDetail(activePlaylistId);
}

// ── Artists ───────────────────────────────────────────────────────────────

function renderArtists() {
    const tbody = document.getElementById('artists-tbody');
    if (!tbody) return;
    if (!catalogState.artists.length) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-catalog">No artists yet. Add artists here first, then assign them to tracks and releases.</td></tr>`;
        return;
    }
    tbody.innerHTML = catalogState.artists.map(a => `
    <tr>
        <td class="name-cell">${a.name}</td>
        <td class="domain-cell">${a.id}</td>
        <td>
            <button class="btn btn-sm" onclick="openArtistModal('${a.id}')">EDIT</button>
            <button class="btn btn-sm btn-del" onclick="deleteArtist('${a.id}')">DEL</button>
        </td>
    </tr>`).join('');
}

function openArtistModal(id) {
    document.getElementById('artist-form').reset();
    if (id) {
        const a = catalogState.artists.find(a => a.id === id);
        if (!a) return;
        document.getElementById('ar-modal-title').textContent = 'EDIT ARTIST';
        document.getElementById('ar-orig-id').value = a.id;
        document.getElementById('ar-name').value    = a.name;
    } else {
        document.getElementById('ar-modal-title').textContent = 'ADD ARTIST';
        document.getElementById('ar-orig-id').value = '';
    }
    document.getElementById('artist-modal').classList.remove('hidden');
}

function saveArtist(e) {
    e.preventDefault();
    const origId = document.getElementById('ar-orig-id').value;
    const name   = document.getElementById('ar-name').value.trim();
    if (origId) {
        const a = catalogState.artists.find(a => a.id === origId);
        if (a) {
            const oldName = a.name;
            a.name = name;
            // propagate rename to tracks and releases
            catalogState.tracks.forEach(t => { if (t.artist === oldName) t.artist = name; });
            catalogState.releases.forEach(r => { if (r.artist === oldName) r.artist = name; });
        }
        toast('Artist updated.');
    } else {
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (catalogState.artists.some(a => a.id === id)) return toast('Artist already exists.');
        catalogState.artists.push({ id, name });
        toast('Artist added.');
    }
    saveCatalog();
    renderArtists();
    closeModal('artist-modal');
}

function deleteArtist(id) {
    if (!confirm(`Delete artist "${id}"?`)) return;
    catalogState.artists = catalogState.artists.filter(a => a.id !== id);
    saveCatalog();
    renderArtists();
    toast('Artist deleted.');
}

// ── Releases ──────────────────────────────────────────────────────────────

function renderReleases() {
    const panel = document.getElementById('rel-list-panel');
    if (!panel) return;
    if (!catalogState.releases.length) {
        panel.innerHTML = '<span class="stub-msg" style="padding:1rem;display:block">No releases yet.</span>';
        return;
    }
    panel.innerHTML = catalogState.releases.map(r => {
        const isActive = activeReleaseId === r.id;
        const count = (r.tracks || []).length;
        return `
        <div class="pl-list-item${isActive ? ' active' : ''}" onclick="selectRelease('${r.id}')">
            <div class="pl-list-info">
                <div class="pl-list-title">${r.title}</div>
                <div class="pl-list-count">${r.artist || 'No artist'}${r.type ? ' · ' + r.type : ''}${r.release_date ? ' · ' + r.release_date : ''}</div>
                <div class="pl-list-count">${count} track${count !== 1 ? 's' : ''}</div>
            </div>
            <button class="btn btn-sm" onclick="event.stopPropagation();openReleaseModal('${r.id}')">EDIT</button>
            <button class="btn btn-sm btn-del" onclick="event.stopPropagation();deleteRelease('${r.id}')">DEL</button>
        </div>`;
    }).join('');
}

function selectRelease(id) {
    activeReleaseId = id;
    renderReleases();
    renderReleaseDetail(id);
}

function renderReleaseDetail(id) {
    const panel = document.getElementById('rel-detail-panel');
    if (!panel) return;
    const rel = catalogState.releases.find(r => r.id === id);
    if (!rel) return;
    if (!rel.tracks) rel.tracks = [];

    const trackRows = rel.tracks.map((slug, i) => {
        const entry = catalogState.tracks.find(t => t.slug === slug);
        const label = entry
            ? (entry.artist ? `${entry.artist} — ${entry.title || slug}` : (entry.title || slug))
            : `${slug} ⚠ not in catalog`;
        return `
        <div class="pl-track-row" draggable="true"
            ondragstart="onRelTrackDragStart(event,${i})"
            ondragover="onDragOver(event)" ondragenter="onDragEnter(event)"
            ondragleave="onDragLeave(event)" ondragend="onRelTrackDragEnd(event)"
            ondrop="onRelTrackDrop(event,${i})">
            <span class="drag-handle">⠿</span>
            <span class="pl-track-name">${label}</span>
            <button class="btn btn-sm btn-del" onclick="removeReleaseTrack('${id}',${i})">✕</button>
        </div>`;
    }).join('') +
    `<div class="drop-sentinel pl-drop-sentinel"
        ondragover="onDragOver(event)" ondragenter="onDragEnter(event)"
        ondragleave="onDragLeave(event)" ondrop="onRelTrackDropEnd(event)"></div>`;

    const available = catalogState.tracks
        .slice()
        .sort((a, b) => {
            const aa = (a.artist || '').toLowerCase();
            const ba = (b.artist || '').toLowerCase();
            if (aa !== ba) return aa.localeCompare(ba);
            return (a.title || a.slug).toLowerCase().localeCompare((b.title || b.slug).toLowerCase());
        });
    const pickerOpts = available.map(t => {
        const lbl = t.artist ? `${t.artist} — ${t.title || t.slug}` : (t.title || t.slug);
        return `<option value="${t.slug}">${lbl}</option>`;
    }).join('');

    panel.innerHTML = `
    <div class="pl-detail-header">
        <span class="pl-detail-name">${rel.title}</span>
        <span class="pl-list-count">${rel.tracks.length} track${rel.tracks.length !== 1 ? 's' : ''}</span>
    </div>
    <div id="rel-track-list">${trackRows}</div>
    <div class="pl-add-row">
        <select class="pl-track-picker" ${!available.length ? 'disabled' : ''} onchange="addTrackToRelease(this,'${id}')">
            <option value="">${available.length ? '+ add track…' : 'No tracks in catalog'}</option>
            ${pickerOpts}
        </select>
    </div>`;
}

function openReleaseModal(id) {
    document.getElementById('release-form').reset();
    const rel = id ? catalogState.releases.find(r => r.id === id) : null;
    populateArtistSelect(document.getElementById('rel-artist'), rel ? (rel.artist || '') : '');
    populateLabelSelect(document.getElementById('rel-label'),   rel ? (rel.label  || '') : '');
    if (id && rel) {
        document.getElementById('rel-modal-title').textContent    = 'EDIT RELEASE';
        document.getElementById('rel-orig-id').value              = rel.id;
        document.getElementById('rel-title').value                = rel.title           || '';
        document.getElementById('rel-type').value                 = rel.type            || '';
        document.getElementById('rel-cat').value                  = rel.cat             || '';
        document.getElementById('rel-release-date').value         = rel.release_date    || '';
        document.getElementById('rel-catalog-number').value       = rel.catalog_number  || '';
        document.getElementById('rel-image').value                = rel.image           || '';
        document.getElementById('rel-desc').value                 = rel.desc            || '';
    } else {
        document.getElementById('rel-modal-title').textContent = 'ADD RELEASE';
        document.getElementById('rel-orig-id').value = '';
    }
    document.getElementById('release-modal').classList.remove('hidden');
}

function saveRelease(e) {
    e.preventDefault();
    const origId         = document.getElementById('rel-orig-id').value;
    const title          = document.getElementById('rel-title').value.trim();
    const artist         = document.getElementById('rel-artist').value;
    const label          = document.getElementById('rel-label').value;
    const type           = document.getElementById('rel-type').value;
    const cat            = document.getElementById('rel-cat').value.trim();
    const release_date   = document.getElementById('rel-release-date').value.trim();
    const catalog_number = document.getElementById('rel-catalog-number').value.trim();
    const image          = document.getElementById('rel-image').value.trim();
    const desc           = document.getElementById('rel-desc').value.trim();
    if (origId) {
        const r = catalogState.releases.find(r => r.id === origId);
        if (r) {
            r.title = title; r.artist = artist; r.label = label; r.type = type;
            r.cat = cat; r.release_date = release_date; r.catalog_number = catalog_number;
            if (image) r.image = image;
            r.desc = desc;
        }
        toast('Release updated.');
    } else {
        let id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (catalogState.releases.some(r => r.id === id)) id += '-' + Date.now();
        catalogState.releases.push({ id, title, artist, label, type, cat, release_date, catalog_number, image, desc, tracks: [] });
        toast('Release added.');
    }
    saveCatalog();
    renderReleases();
    if (activeReleaseId) renderReleaseDetail(activeReleaseId);
    closeModal('release-modal');
}

function deleteRelease(id) {
    if (!confirm(`Delete release "${id}"?`)) return;
    catalogState.releases = catalogState.releases.filter(r => r.id !== id);
    if (activeReleaseId === id) {
        activeReleaseId = null;
        const panel = document.getElementById('rel-detail-panel');
        if (panel) panel.innerHTML = '<span class="stub-msg">Select a release to manage its tracks.</span>';
    }
    saveCatalog();
    renderReleases();
    toast('Release deleted.');
}

function addTrackToRelease(sel, releaseId) {
    const slug = sel.value;
    if (!slug) return;
    const r = catalogState.releases.find(r => r.id === releaseId);
    if (!r) { sel.value = ''; return; }
    if (!r.tracks) r.tracks = [];
    r.tracks.push(slug);
    // auto-set album on track if it has none yet
    const track = catalogState.tracks.find(t => t.slug === slug);
    if (track && !track.album) track.album = r.title;
    sel.value = '';
    saveCatalog();
    renderReleaseDetail(releaseId);
}

function removeReleaseTrack(releaseId, idx) {
    const r = catalogState.releases.find(r => r.id === releaseId);
    if (!r || idx < 0 || idx >= (r.tracks || []).length) return;
    r.tracks.splice(idx, 1);
    saveCatalog();
    renderReleaseDetail(releaseId);
}

function onRelTrackDragStart(e, idx) {
    relTrackDragSrc = idx;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
}

function onRelTrackDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    relTrackDragSrc = -1;
}

function onRelTrackDrop(e, tgtIdx) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const srcIdx = relTrackDragSrc;
    if (!activeReleaseId || srcIdx < 0 || srcIdx === tgtIdx) { relTrackDragSrc = -1; return; }
    const r = catalogState.releases.find(r => r.id === activeReleaseId);
    if (!r) { relTrackDragSrc = -1; return; }
    const [moved] = r.tracks.splice(srcIdx, 1);
    let insertAt = tgtIdx;
    if (srcIdx < tgtIdx) insertAt--;
    r.tracks.splice(insertAt, 0, moved);
    relTrackDragSrc = -1;
    saveCatalog();
    renderReleaseDetail(activeReleaseId);
}

function onRelTrackDropEnd(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const srcIdx = relTrackDragSrc;
    if (!activeReleaseId || srcIdx < 0) { relTrackDragSrc = -1; return; }
    const r = catalogState.releases.find(r => r.id === activeReleaseId);
    if (!r) { relTrackDragSrc = -1; return; }
    const [moved] = r.tracks.splice(srcIdx, 1);
    r.tracks.push(moved);
    relTrackDragSrc = -1;
    saveCatalog();
    renderReleaseDetail(activeReleaseId);
}

// ── Jingles I/O ───────────────────────────────────────────────────────────
// Jingles are stored inside playlists.json — use the playlists import/export.

function exportJingles() {
    const blob = new Blob([JSON.stringify(buildPlaylistsExportJSON(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'playlists.json';
    a.click();
}

function copyJingles() {
    navigator.clipboard.writeText(JSON.stringify(buildJinglesExportJSON(), null, 2))
        .then(() => toast('Jingles JSON copied.'))
        .catch(() => toast('Copy failed.'));
}

// ── Jingles Render ────────────────────────────────────────────────────────

function renderJingles() {
    const tbody = document.getElementById('jingles-tbody');
    if (!tbody) return;
    if (!playlistsState.jingles.length) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-catalog">No jingles yet. Add short audio clips to use as intros, outros, or ads in playlists.</td></tr>`;
        return;
    }
    tbody.innerHTML = playlistsState.jingles.map(j => `
    <tr>
        <td class="name-cell">${j.title}<small>${j.id}</small></td>
        <td class="domain-cell">${j.audio || '—'}</td>
        <td>
            <button class="btn btn-sm" onclick="openJingleModal('${j.id}')">EDIT</button>
            <button class="btn btn-sm btn-del" onclick="deleteJingle('${j.id}')">DEL</button>
        </td>
    </tr>`).join('');
}

// ── Jingle CRUD ───────────────────────────────────────────────────────────

function openJingleModal(id) {
    document.getElementById('jingle-form').reset();
    const idEl = document.getElementById('jg-id');
    if (id) {
        const j = playlistsState.jingles.find(j => j.id === id);
        if (!j) return;
        document.getElementById('jg-modal-title').textContent = 'EDIT JINGLE';
        document.getElementById('jg-orig-id').value = j.id;
        idEl.value    = j.id;
        idEl.readOnly = true;
        idEl.classList.add('input-locked');
        document.getElementById('jg-title').value = j.title || '';
        document.getElementById('jg-audio').value = j.audio || '';
    } else {
        document.getElementById('jg-modal-title').textContent = 'ADD JINGLE';
        document.getElementById('jg-orig-id').value = '';
        idEl.readOnly = false;
        idEl.classList.remove('input-locked');
    }
    document.getElementById('jingle-modal').classList.remove('hidden');
}

function saveJingle(e) {
    e.preventDefault();
    const origId = document.getElementById('jg-orig-id').value;
    const id     = document.getElementById('jg-id').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const title  = document.getElementById('jg-title').value.trim();
    const audio  = document.getElementById('jg-audio').value.trim();
    if (origId) {
        const j = playlistsState.jingles.find(j => j.id === origId);
        if (j) { j.title = title; j.audio = audio; }
        toast('Jingle updated.');
    } else {
        if (playlistsState.jingles.some(j => j.id === id)) return toast('ID already exists.');
        playlistsState.jingles.push({ id, title, audio });
        toast('Jingle added.');
    }
    savePlaylists();
    renderJingles();
    closeModal('jingle-modal');
}

function deleteJingle(id) {
    if (!confirm(`Delete jingle "${id}"?`)) return;
    playlistsState.jingles = playlistsState.jingles.filter(j => j.id !== id);
    const prefixed = 'jingle:' + id;
    playlistsState.playlists.forEach(p => {
        p.tracks = p.tracks.filter(s => s !== prefixed);
    });
    savePlaylists();
    renderJingles();
    if (activePlaylistId) renderPlaylistDetail(activePlaylistId);
    toast('Jingle deleted.');
}

// ── Catalog Sub-Tabs ─────────────────────────────────────────────────────

function showCatalogSubTab(name) {
    ['playlists', 'jingles', 'tracks', 'releases', 'labels', 'artists'].forEach(t => {
        document.getElementById(`catalog-sub-${t}`).classList.toggle('hidden', t !== name);
        document.getElementById(`catalog-sub-${t}-btn`).classList.toggle('active', t === name);
    });
    if (name === 'tracks')    renderCatalogTracks();
    if (name === 'playlists') renderPlaylists();
    if (name === 'jingles')   renderJingles();
    if (name === 'releases')  renderReleases();
    if (name === 'labels')    renderLabels();
    if (name === 'artists')   renderArtists();
}

function populateArtistSelect(sel, currentVal) {
    sel.innerHTML = '<option value="">— none —</option>' +
        catalogState.artists.map(a =>
            `<option value="${a.name}"${a.name === currentVal ? ' selected' : ''}>${a.name}</option>`
        ).join('');
}

function populateLabelSelect(sel, currentVal) {
    sel.innerHTML = '<option value="">— none —</option>' +
        catalogState.labels.map(l =>
            `<option value="${l.name}"${l.name === currentVal ? ' selected' : ''}>${l.name}</option>`
        ).join('');
}

// ── Labels ────────────────────────────────────────────────────────────────

function renderLabels() {
    const tbody = document.getElementById('labels-tbody');
    if (!tbody) return;
    if (!catalogState.labels.length) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-catalog">No labels yet. Add record labels here, then assign them to releases.</td></tr>`;
        return;
    }
    tbody.innerHTML = catalogState.labels.map(l => `
    <tr>
        <td class="name-cell">${l.name}</td>
        <td class="domain-cell">${l.id}</td>
        <td>
            <button class="btn btn-sm" onclick="openLabelModal('${l.id}')">EDIT</button>
            <button class="btn btn-sm btn-del" onclick="deleteLabel('${l.id}')">DEL</button>
        </td>
    </tr>`).join('');
}

function openLabelModal(id) {
    document.getElementById('label-form').reset();
    if (id) {
        const l = catalogState.labels.find(l => l.id === id);
        if (!l) return;
        document.getElementById('lbl-modal-title').textContent = 'EDIT LABEL';
        document.getElementById('lbl-orig-id').value = l.id;
        document.getElementById('lbl-name').value    = l.name;
    } else {
        document.getElementById('lbl-modal-title').textContent = 'ADD LABEL';
        document.getElementById('lbl-orig-id').value = '';
    }
    document.getElementById('label-modal').classList.remove('hidden');
}

function saveLabelFn(e) {
    e.preventDefault();
    const origId = document.getElementById('lbl-orig-id').value;
    const name   = document.getElementById('lbl-name').value.trim();
    if (origId) {
        const l = catalogState.labels.find(l => l.id === origId);
        if (l) {
            const oldName = l.name;
            l.name = name;
            catalogState.releases.forEach(r => { if (r.label === oldName) r.label = name; });
        }
        toast('Label updated.');
    } else {
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (catalogState.labels.some(l => l.id === id)) return toast('Label already exists.');
        catalogState.labels.push({ id, name });
        toast('Label added.');
    }
    saveCatalog();
    renderLabels();
    closeModal('label-modal');
}

function deleteLabel(id) {
    if (!confirm(`Delete label "${id}"?`)) return;
    catalogState.labels = catalogState.labels.filter(l => l.id !== id);
    saveCatalog();
    renderLabels();
    toast('Label deleted.');
}

// ── Init ─────────────────────────────────────────────────────────────────
populateSectionSelects();
populateStatusSelect();
renderTiles();
renderSections();
