let state = { statuses: [], sections: [], tiles: [] };
let dragSrcId = null;
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
    const sectionIdMap = new Map();
    const sections = state.sections.map((s, i) => {
        const newId = String(i + 1);
        sectionIdMap.set(s.id, newId);
        return { id: newId, title: s.title, ...(s.visible === false ? { visible: false } : {}), ...(s.featured ? { featured: true } : {}) };
    });
    const tiles = state.tiles.map((t, i) => ({
        id:      String(i + 1),
        section: sectionIdMap.get(t.section) ?? t.section,
        cat:     t.cat,
        name:    t.name,
        desc:    t.desc,
        status:  t.status,
        domain:  t.domain,
        href:    t.href,
        image:   t.image,
        ...(t.audio  ? { audio:  t.audio  } : {}),
        ...(t.track  ? { track:  t.track  } : {}),
        ...(t.artist ? { artist: t.artist } : {}),
        ...(t.album  ? { album:  t.album  } : {}),
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
        document.getElementById('f-id').value      = t.id;
        document.getElementById('f-section').value = t.section;
        document.getElementById('f-cat').value     = t.cat;
        document.getElementById('f-name').value    = t.name;
        document.getElementById('f-desc').value    = t.desc;
        document.getElementById('f-status').value  = t.status;
        document.getElementById('f-domain').value  = t.domain;
        document.getElementById('f-href').value    = t.href  || '';
        document.getElementById('f-image').value  = t.image || '';
        document.getElementById('f-audio').value  = t.audio  || '';
        document.getElementById('f-track').value  = t.track  || '';
        document.getElementById('f-artist').value = t.artist || '';
        document.getElementById('f-album').value  = t.album  || '';
        document.getElementById('f-expand').checked = !!t.expand;
    } else {
        document.getElementById('f-expand').checked = false;
        document.getElementById('tile-modal-title').textContent = 'ADD TILE';
        document.getElementById('f-id').value = '';
    }
    document.getElementById('tile-modal').classList.remove('hidden');
    checkSectionVisibility();
}

function saveTile(e) {
    e.preventDefault();
    const id       = document.getElementById('f-id').value;
    const existing = id ? state.tiles.find(t => t.id === id) : null;
    const tile = {
        id:      id || String(Date.now()),
        section: document.getElementById('f-section').value,
        cat:     document.getElementById('f-cat').value,
        name:    document.getElementById('f-name').value,
        desc:    document.getElementById('f-desc').value,
        status:  document.getElementById('f-status').value,
        domain:  document.getElementById('f-domain').value,
        href:    document.getElementById('f-href').value,
        image:  document.getElementById('f-image').value,
        audio:  document.getElementById('f-audio').value,
        track:  document.getElementById('f-track').value,
        artist: document.getElementById('f-artist').value,
        album:  document.getElementById('f-album').value,
        visible:   existing ? existing.visible : true,
        expand:    document.getElementById('f-expand').checked,
        showImage: document.getElementById('f-expand').checked ? false : (existing ? !!existing.showImage : false),
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
        state.sections.push({
            id:    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            title,
        });
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
    ['tiles', 'sections', 'statuses'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== name);
        document.getElementById(`tab-${t}-btn`).classList.toggle('active', t === name);
    });
    if (name === 'tiles')    renderTiles();
    if (name === 'statuses') renderStatuses();
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Init ─────────────────────────────────────────────────────────────────
populateSectionSelects();
populateStatusSelect();
renderTiles();
renderSections();
