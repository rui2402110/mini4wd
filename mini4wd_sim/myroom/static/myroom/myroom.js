// myroom/static/myroom/myroom.js ── マイルーム背景プレースホルダー
// three.jsでの背景演出は次回の改修要件で実装予定。
// 現時点ではCanvas 2Dで簡易的な星空風の演出だけ入れておく（軽量・依存なし）。
'use strict';
(function () {
    const canvas = document.getElementById('myroomBgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let stars = [];

    function resize() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        stars = Array.from({ length: 120 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.4 + 0.2,
            speed: Math.random() * 0.15 + 0.02,
            phase: Math.random() * Math.PI * 2,
        }));
    }
    window.addEventListener('resize', resize);
    resize();

    function frame(ts) {
        requestAnimationFrame(frame);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        stars.forEach(s => {
            const alpha = 0.3 + 0.4 * Math.sin(ts * 0.001 * s.speed + s.phase);
            ctx.fillStyle = `rgba(0, 255, 136, ${Math.max(0, alpha)})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    requestAnimationFrame(frame);
})();
