// myroom/static/myroom/stats.js ── 統計画面のグラフ描画（改修要件9）
'use strict';
(function () {
    const DATA = window.__STATS_DATA__;
    if (!DATA || typeof Chart === 'undefined') return;

    const NEON_COLORS = ['#00ff88', '#0099ff', '#ffdd33', '#ff5566', '#bd00ff', '#ff9933', '#33ffee', '#ff66cc'];

    Chart.defaults.color = '#889';
    Chart.defaults.borderColor = '#223';
    Chart.defaults.font.family = "'Courier New', monospace";

    function makePie(canvasId, entries) {
        const el = document.getElementById(canvasId);
        if (!el || !entries || entries.length === 0) return;
        new Chart(el, {
            type: 'doughnut',
            data: {
                labels: entries.map(e => e.label),
                datasets: [{
                    data: entries.map(e => e.value),
                    backgroundColor: entries.map((_, i) => NEON_COLORS[i % NEON_COLORS.length]),
                    borderColor: '#08080e',
                    borderWidth: 2,
                }],
            },
            options: {
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 10 } } } },
            },
        });
    }

    function makeLine(canvasId, series, color, label) {
        const el = document.getElementById(canvasId);
        if (!el || !series || series.length === 0) return;
        new Chart(el, {
            type: 'line',
            data: {
                labels: series.map((_, i) => i + 1),
                datasets: [{
                    label,
                    data: series,
                    borderColor: color,
                    backgroundColor: color + '22',
                    fill: true,
                    tension: 0.25,
                    pointRadius: 2,
                }],
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    x: { title: { display: true, text: '試合数', color: '#556' }, grid: { color: '#1a1a24' } },
                    y: { grid: { color: '#1a1a24' } },
                },
            },
        });
    }

    makePie('skillPieChart', DATA.skill_pie);
    makePie('typePieChart', DATA.type_pie);
    makeLine('rateLineChart', DATA.rate_series, '#0099ff', 'レート');
    makeLine('enLineChart', DATA.en_series, '#ffdd33', 'EN収支累積');
})();
