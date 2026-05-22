// player.js — shared audio player, persistent bar, and SPA routing
// Loaded by index.html and track pages via <script src>.
// window._siteRoot must be set before loading: '' for root pages, '../../' for track pages.

function filter(status, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tile').forEach(tile => {
        if (status === 'all' || tile.dataset.status === status) tile.removeAttribute('data-hidden');
        else tile.setAttribute('data-hidden', 'true');
    });
}

let _aud = null, _audBtn = null, _audWrap = null, _sessionReady = false;

function _fmtTime(s) {
    s = Math.floor(s || 0);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// ── Bottom player bar ─────────────────────────────────────────────────────
function _playerBarShow(wrap) {
    const base = window._siteRoot || '';
    const img  = wrap.dataset.image;
    const el   = document.getElementById('player-img');
    if (el) { el.src = img ? base + 'images/wide/' + img : ''; el.style.display = img ? '' : 'none'; }
    const t = document.getElementById('player-track');
    const a = document.getElementById('player-artist');
    if (t) t.textContent = wrap.dataset.track  || wrap.dataset.name || '';
    if (a) a.textContent = wrap.dataset.artist || '';
    const bar = document.getElementById('player-bar');
    if (bar) bar.classList.add('active');
    document.body.classList.add('has-player');
}

function playerToggle() {
    if (!_aud) return;
    const btn = document.getElementById('player-btn');
    if (_aud.paused) {
        _aud.play().then(() => {
            if (btn) btn.textContent = '⏸';
            if (_audBtn) _audBtn.textContent = '⏸';
        }).catch(() => {});
    } else {
        _aud.pause();
        if (btn) btn.textContent = '▶';
        if (_audBtn) _audBtn.textContent = '▶';
    }
}

function playerSeek(e, bar) {
    if (!_aud || !_aud.duration) return;
    const rect = bar.getBoundingClientRect();
    _aud.currentTime = ((e.clientX - rect.left) / rect.width) * _aud.duration;
}

// Deduplicate by data-src (featured tiles appear in both the featured and sections blocks)
// dir: +1 = next, -1 = previous
function _audioGetAdjacent(dir) {
    if (!_audWrap) return null;
    const seen = new Set();
    const unique = Array.from(document.querySelectorAll('.tile-audio')).filter(el => {
        if (seen.has(el.dataset.src)) return false;
        seen.add(el.dataset.src); return true;
    });
    const idx = unique.findIndex(el => el.dataset.src === _audWrap.dataset.src);
    return unique[idx + dir] || null;
}

function audioPlay(btn) {
    const wrap = btn.closest('.tile-audio');
    const src  = wrap.dataset.src;
    if (_audBtn && _audBtn !== btn) {
        _aud.pause();
        _audBtn.textContent = '▶';
    }
    if (!_aud || _audWrap !== wrap) {
        if (_aud) _aud.pause();
        _aud         = new Audio(src);
        _aud.preload = 'metadata';
        _audWrap     = wrap;
        _playerBarShow(wrap);
        _aud.ontimeupdate = function() {
            const pct     = (_aud.currentTime / _aud.duration * 100) || 0;
            const timeStr = _fmtTime(_aud.currentTime) + ' / ' + _fmtTime(_aud.duration);
            const prog = wrap.querySelector('.audio-prog');
            const time = wrap.querySelector('.audio-time');
            if (prog) prog.style.width = pct + '%';
            if (time) time.textContent = timeStr;
            const bp = document.getElementById('player-prog');
            const bt = document.getElementById('player-time');
            if (bp) bp.style.width = pct + '%';
            if (bt) bt.textContent = timeStr;
            if ('mediaSession' in navigator && isFinite(_aud.duration) && _aud.duration > 0) {
                navigator.mediaSession.setPositionState({ duration: _aud.duration, playbackRate: 1, position: _aud.currentTime });
            }
        };
        let _advancing = false;
        _aud.onended = function() {
            if (_advancing) return;
            _advancing = true;
            if (_audBtn) _audBtn.textContent = '▶';
            const prog = wrap.querySelector('.audio-prog');
            const time = wrap.querySelector('.audio-time');
            if (prog) prog.style.width = '0%';
            if (time) time.textContent = '0:00';
            const bp = document.getElementById('player-prog');
            const bt = document.getElementById('player-time');
            if (bp) bp.style.width = '0%';
            const next = _audioGetAdjacent(1);
            if (next) {
                audioPlay(next.querySelector('.audio-btn'));
            } else {
                _aud = null; _audBtn = null; _audWrap = null;
                const pBtn = document.getElementById('player-btn');
                if (pBtn) pBtn.textContent = '▶';
                if (bt) bt.textContent = '0:00';
            }
            setTimeout(() => { _advancing = false; }, 500);
        };
        if ('mediaSession' in navigator) {
            const base = window._siteRoot || '';
            const img  = wrap.dataset.image;
            const artwork = img ? [
                { src: new URL(base + 'images/square/' + img, location.href).href, sizes: '512x512' }
            ] : [];
            navigator.mediaSession.metadata = new MediaMetadata({
                title:   wrap.dataset.track  || wrap.dataset.name || '',
                artist:  wrap.dataset.artist || '',
                album:   wrap.dataset.album  || '',
                artwork
            });
            if (!_sessionReady) {
                _sessionReady = true;
                navigator.mediaSession.setActionHandler('play',  () => { if (_aud) { _aud.play();  if (_audBtn) _audBtn.textContent = '⏸'; const b = document.getElementById('player-btn'); if (b) b.textContent = '⏸'; }});
                navigator.mediaSession.setActionHandler('pause', () => { if (_aud) { _aud.pause(); if (_audBtn) _audBtn.textContent = '▶'; const b = document.getElementById('player-btn'); if (b) b.textContent = '▶'; }});
                navigator.mediaSession.setActionHandler('nexttrack',     () => { const n = _audioGetAdjacent(1);  if (n) audioPlay(n.querySelector('.audio-btn')); });
                navigator.mediaSession.setActionHandler('previoustrack', () => {
                    const p = _audioGetAdjacent(-1);
                    if (p) audioPlay(p.querySelector('.audio-btn'));
                    else if (_aud) _aud.currentTime = 0;
                });
                navigator.mediaSession.setActionHandler('seekto', (d) => {
                    if (_aud && d.seekTime !== undefined) _aud.currentTime = d.seekTime;
                });
            }
        }
    }
    if (_aud.paused) {
        _aud.play().then(() => {
            btn.textContent = '⏸';
            const pBtn = document.getElementById('player-btn');
            if (pBtn) pBtn.textContent = '⏸';
        }).catch(() => {
            _aud = null; _audBtn = null; _audWrap = null;
        });
        if (wrap.dataset.slug) history.replaceState(null, '', '#' + wrap.dataset.slug);
    } else {
        _aud.pause();
        btn.textContent = '▶';
        const pBtn = document.getElementById('player-btn');
        if (pBtn) pBtn.textContent = '▶';
    }
    _audBtn = btn;
}

function initHashRouting() {
    const slug = location.hash.slice(1);
    if (!slug) return;
    const target = document.querySelector('.tile-audio[data-slug="' + CSS.escape(slug) + '"]');
    if (!target) return;
    const tile = target.closest('.tile');
    if (tile) tile.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => audioPlay(target.querySelector('.audio-btn')), 400);
}

function initDurations() {
    const seen = new Set();
    document.querySelectorAll('.tile-audio').forEach(wrap => {
        if (seen.has(wrap.dataset.src)) return;
        seen.add(wrap.dataset.src);
        const probe = new Audio();
        probe.preload = 'metadata';
        probe.onloadedmetadata = function() {
            const dur = '0:00 / ' + _fmtTime(probe.duration);
            document.querySelectorAll('.tile-audio[data-src="' + CSS.escape(wrap.dataset.src) + '"] .audio-time')
                .forEach(el => el.textContent = dur);
        };
        probe.src = wrap.dataset.src;
    });
}

function audioSeek(e, bar) {
    if (!_aud || !_aud.duration) return;
    const rect = bar.getBoundingClientRect();
    _aud.currentTime = ((e.clientX - rect.left) / rect.width) * _aud.duration;
}

function shareTrack(btn) {
    const url = location.origin + '/#' + btn.dataset.slug;
    const title = btn.dataset.title || document.title;
    if (navigator.share) {
        navigator.share({ title, url }).catch(() => {});
    } else {
        navigator.clipboard.writeText(url).then(() => {
            const orig = btn.textContent;
            btn.textContent = '✓';
            setTimeout(() => { btn.textContent = orig; }, 1500);
        }).catch(() => {});
    }
}

function audioImgPlay(e, wrap) {
    if (e.target.closest('.tile-audio')) return;
    e.preventDefault();
    e.stopPropagation();
    const btn = wrap.querySelector('.audio-btn');
    if (btn) audioPlay(btn);
}

// ── SPA routing ───────────────────────────────────────────────────────────
// Only active on pages that have a #main container to swap into.
async function navigate(href, push) {
    if (push === undefined) push = true;
    const currentMain = document.getElementById('main');
    if (!currentMain) { location.href = href; return; }
    try {
        const res = await fetch(href);
        if (!res.ok) { location.href = href; return; }
        const html    = await res.text();
        const doc     = new DOMParser().parseFromString(html, 'text/html');
        const newMain = doc.getElementById('main');
        if (!newMain) { location.href = href; return; }
        currentMain.replaceWith(newMain);
        document.title = doc.title;
        window.scrollTo(0, 0);
        // Stale tile refs cleared; _aud keeps playing into the bar
        _audBtn = null; _audWrap = null;
        // Nav active state
        const dest = new URL(href, location.origin).pathname;
        document.querySelectorAll('nav a[href], #nav-links a[href]').forEach(a => {
            try { a.toggleAttribute('aria-current', new URL(a.href, location.origin).pathname === dest); } catch {}
        });
        if (push) history.pushState({ spa: true }, '', href);
        initDurations();
        // Note: intentionally NOT calling initHashRouting here.
        // The hash in the URL is a playback bookmark written by history.replaceState,
        // not an intent to restart audio on every back-navigation.
    } catch {
        location.href = href;
    }
}

if (document.getElementById('main')) {
    document.addEventListener('click', function(e) {
        const a = e.target.closest('a[href]');
        if (!a || a.target === '_blank') return;
        try {
            const url = new URL(a.href, location.origin);
            if (url.origin !== location.origin) return;
            if (url.pathname === location.pathname && url.hash) return;
            // Only SPA-navigate root-level pages; deeper paths (tracks/) navigate normally
            if (url.pathname.split('/').filter(Boolean).length > 1) return;
            e.preventDefault();
            navigate(a.href);
        } catch {}
    });

    window.addEventListener('popstate', function() {
        navigate(location.href, false);
    });
}

initHashRouting();
initDurations();
