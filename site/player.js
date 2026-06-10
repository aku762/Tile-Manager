// player.js — audio player, persistent bar, catalog-driven playlist, SPA routing
// window._siteRoot must be set before loading: '' for root pages, '../../' for track pages.
// window._catalog (keyed by slug) and window._playlists are injected by build.js.

function filter(status, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tile').forEach(tile => {
        if (status === 'all' || tile.dataset.status === status) tile.removeAttribute('data-hidden');
        else tile.setAttribute('data-hidden', 'true');
    });
}

let _aud = null, _audBtn = null, _audWrap = null, _currentTrack = null, _sessionReady = false;

function _fmtTime(s) {
    s = Math.floor(s || 0);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// ── Player bar ────────────────────────────────────────────────────────────
function _playerBarShow(track) {
    const base = window._siteRoot || '';
    const img  = track.image;

    const imgEl = document.getElementById('player-img');
    if (imgEl) {
        imgEl.src = img ? base + 'images/wide/' + img : '';
        imgEl.style.display = img ? '' : 'none';
    }

    const t = document.getElementById('player-track');
    const a = document.getElementById('player-artist');
    if (t) t.textContent = track.track || track.name || '';
    if (a) a.textContent = track.artist || '';

    const bar = document.getElementById('player-bar');
    if (bar) bar.classList.add('active');
    document.body.classList.add('has-player');

    // Click-to-navigate: if track has a slug, wire player-info and player-img to the track page
    const info  = document.getElementById('player-info');
    const slug  = track.slug;
    const linked = !!slug;
    if (imgEl)  imgEl.classList.toggle('player-img-linked', linked);
    if (info)  info.classList.toggle('player-info-linked', linked);

    if (imgEl)  imgEl.onclick  = linked ? () => navigate('/tracks/' + slug + '/') : null;
    if (info)  info.onclick   = linked ? () => navigate('/tracks/' + slug + '/') : null;
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

// ── Catalog playlist ──────────────────────────────────────────────────────
function _getPlaylistTracks() {
    const catalog   = window._catalog;
    const playlists = window._playlists;
    const jingles   = window._jingles;
    if (!catalog || !playlists) return null;
    const active = playlists.playlists.find(p => p.id === playlists.default) || playlists.playlists[0];
    if (!active) return null;
    return active.tracks.map(slug => {
        if (slug.startsWith('jingle:')) {
            const j = jingles && jingles[slug.slice(7)];
            return j ? { ...j, slug } : null;
        }
        return catalog[slug] || null;
    }).filter(Boolean);
}

// Returns catalog entry (plain object) or DOM element, or null.
// Catalog mode is preferred when window._catalog is available and current track is found in it.
function _audioGetAdjacent(dir) {
    const playlist = _getPlaylistTracks();
    if (playlist && _currentTrack) {
        const idx = playlist.findIndex(t => t.slug === _currentTrack.slug || t.audio === _currentTrack.src);
        if (idx >= 0) return playlist[idx + dir] || null;
        // current track not in catalog playlist — fall through to DOM mode
    }
    // DOM fallback
    if (!_audWrap) return null;
    const seen = new Set();
    const unique = Array.from(document.querySelectorAll('.tile-audio')).filter(el => {
        if (seen.has(el.dataset.src)) return false;
        seen.add(el.dataset.src); return true;
    });
    const idx = unique.findIndex(el => el.dataset.src === _audWrap.dataset.src);
    return unique[idx + dir] || null;
}

// ── Shared audio event setup ──────────────────────────────────────────────
// Called after _aud, _audWrap, and _currentTrack are all set.
function _setupAudioHandlers() {
    const wrap = _audWrap; // captured at setup time — may be null for catalog-direct plays

    _aud.ontimeupdate = function() {
        const pct     = (_aud.currentTime / _aud.duration * 100) || 0;
        const timeStr = _fmtTime(_aud.currentTime) + ' / ' + _fmtTime(_aud.duration);
        if (wrap) {
            const prog = wrap.querySelector('.audio-prog');
            const time = wrap.querySelector('.audio-time');
            if (prog) prog.style.width = pct + '%';
            if (time) time.textContent = timeStr;
        }
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
        if (wrap) {
            const prog = wrap.querySelector('.audio-prog');
            const time = wrap.querySelector('.audio-time');
            if (prog) prog.style.width = '0%';
            if (time) time.textContent = '0:00';
        }
        const bp = document.getElementById('player-prog');
        const bt = document.getElementById('player-time');
        if (bp) bp.style.width = '0%';
        const next = _audioGetAdjacent(1);
        if (next) {
            if (next instanceof HTMLElement) audioPlay(next.querySelector('.audio-btn'));
            else playCatalogTrack(next);
        } else {
            _aud = null; _audBtn = null; _audWrap = null; _currentTrack = null;
            const pBtn = document.getElementById('player-btn');
            if (pBtn) pBtn.textContent = '▶';
            if (bt) bt.textContent = '0:00';
        }
        setTimeout(() => { _advancing = false; }, 500);
    };

    if ('mediaSession' in navigator && _currentTrack) {
        const base    = window._siteRoot || '';
        const img     = _currentTrack.image;
        const artwork = img ? [{ src: new URL(base + 'images/square/' + img, location.href).href, sizes: '512x512' }] : [];
        navigator.mediaSession.metadata = new MediaMetadata({
            title:  _currentTrack.track  || _currentTrack.name || '',
            artist: _currentTrack.artist || '',
            album:  _currentTrack.album  || '',
            artwork
        });
        if (!_sessionReady) {
            _sessionReady = true;
            navigator.mediaSession.setActionHandler('play',  () => { if (_aud) { _aud.play();  if (_audBtn) _audBtn.textContent = '⏸'; const b = document.getElementById('player-btn'); if (b) b.textContent = '⏸'; } });
            navigator.mediaSession.setActionHandler('pause', () => { if (_aud) { _aud.pause(); if (_audBtn) _audBtn.textContent = '▶'; const b = document.getElementById('player-btn'); if (b) b.textContent = '▶'; } });
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                const n = _audioGetAdjacent(1);
                if (!n) return;
                if (n instanceof HTMLElement) audioPlay(n.querySelector('.audio-btn'));
                else playCatalogTrack(n);
            });
            navigator.mediaSession.setActionHandler('previoustrack', () => {
                const p = _audioGetAdjacent(-1);
                if (p) {
                    if (p instanceof HTMLElement) audioPlay(p.querySelector('.audio-btn'));
                    else playCatalogTrack(p);
                } else if (_aud) {
                    _aud.currentTime = 0;
                }
            });
            navigator.mediaSession.setActionHandler('seekto', (d) => {
                if (_aud && d.seekTime !== undefined) _aud.currentTime = d.seekTime;
            });
        }
    }
}

// ── Play from catalog entry (no DOM tile required) ────────────────────────
function playCatalogTrack(entry) {
    if (_aud) _aud.pause();
    if (_audBtn) { _audBtn.textContent = '▶'; _audBtn = null; }
    _audWrap = null;

    _currentTrack = {
        src:    entry.audio,
        slug:   entry.slug   || '',
        name:   entry.title  || '',
        track:  entry.title  || '',
        artist: entry.artist || '',
        album:  entry.album  || '',
        image:  entry.image  || '',
    };

    _aud = new Audio(entry.audio);
    _aud.preload = 'metadata';
    _playerBarShow(_currentTrack);
    _setupAudioHandlers();

    _aud.play().then(() => {
        const pBtn = document.getElementById('player-btn');
        if (pBtn) pBtn.textContent = '⏸';
    }).catch(() => { _aud = null; _currentTrack = null; });

    if (entry.slug) history.replaceState(null, '', '#' + entry.slug);
}

// ── Play from tile DOM element ────────────────────────────────────────────
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
        _currentTrack = {
            src:    src,
            slug:   wrap.dataset.slug   || '',
            name:   wrap.dataset.name   || '',
            track:  wrap.dataset.track  || wrap.dataset.name || '',
            artist: wrap.dataset.artist || '',
            album:  wrap.dataset.album  || '',
            image:  wrap.dataset.image  || '',
        };
        _playerBarShow(_currentTrack);
        _setupAudioHandlers();
    }
    if (_aud.paused) {
        _aud.play().then(() => {
            btn.textContent = '⏸';
            const pBtn = document.getElementById('player-btn');
            if (pBtn) pBtn.textContent = '⏸';
        }).catch(() => {
            _aud = null; _audBtn = null; _audWrap = null; _currentTrack = null;
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
    // Try DOM tile first
    const target = document.querySelector('.tile-audio[data-slug="' + CSS.escape(slug) + '"]');
    if (target) {
        const tile = target.closest('.tile');
        if (tile) tile.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => audioPlay(target.querySelector('.audio-btn')), 400);
        return;
    }
    // Catalog fallback — play without a tile in the DOM
    const entry = window._catalog && window._catalog[slug];
    if (entry && entry.audio && entry.visible !== false) {
        setTimeout(() => playCatalogTrack(entry), 400);
    }
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
        const prevHref = location.href;
        if (push) history.pushState({ spa: true }, '', href);
        const depth = new URL(href, location.origin).pathname.replace(/\/$/, '').split('/').filter(Boolean).length;
        window._siteRoot = depth > 0 ? Array(depth).fill('..').join('/') + '/' : '';
        currentMain.replaceWith(newMain);
        document.title = doc.title;
        window.scrollTo(0, 0);
        // Null stale DOM refs — _aud and _currentTrack persist for the player bar
        _audBtn = null; _audWrap = null;
        const hero = document.getElementById('hero');
        if (hero) hero.hidden = !!newMain.querySelector('.track-back-bar');
        // Point back link at wherever we came from, not hardcoded "/"
        const backLink = newMain.querySelector('.track-back');
        if (backLink) backLink.href = push ? prevHref : (document.referrer || '/');
        const dest = new URL(href, location.origin).pathname;
        document.querySelectorAll('nav a[href], #nav-links a[href]').forEach(a => {
            try { a.toggleAttribute('aria-current', new URL(a.href, location.origin).pathname === dest); } catch {}
        });
        initDurations();
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
            e.preventDefault();
            navigate(a.href);
        } catch {}
    });

    window.addEventListener('popstate', function() {
        navigate(location.href, false);
    });
}

// On direct load of a track page, point back link at same-origin referrer if available
(function() {
    const backLink = document.querySelector('.track-back');
    if (!backLink) return;
    try {
        const ref = new URL(document.referrer);
        if (ref.origin === location.origin && ref.pathname !== location.pathname) {
            backLink.href = document.referrer;
        }
    } catch {}
})();

function initAutoPlay() {
    if (!window._sitePlayer || !window._sitePlayer.autoShow) return;
    if (location.hash) return; // hash routing already handles playback
    const tracks = _getPlaylistTracks();
    if (tracks && tracks.length) setTimeout(() => playCatalogTrack(tracks[0]), 600);
}

initHashRouting();
initDurations();
initAutoPlay();
