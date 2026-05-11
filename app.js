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
    const icon  = document.getElementById('play-icon');
    const label = document.getElementById('play-label');
    const pause = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    const play  = '<path d="M8 5v14l11-7z"/>';
    if (audio.paused) {
        audio.play();
        icon.innerHTML  = pause;
        label.textContent = 'PAUSE';
    } else {
        audio.pause();
        icon.innerHTML  = play;
        label.textContent = 'PLAY';
    }
}

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
