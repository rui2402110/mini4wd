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

    function makeLine(canvasId, series, color, label, seekId, seekLabelId) {
        const el = document.getElementById(canvasId);
        if (!el || !series || series.length === 0) return;

        const WINDOW_SIZE = 20;
        const seekEl = document.getElementById(seekId);
        const seekLabelEl = document.getElementById(seekLabelId);
        const total = series.length;
        const hasOverflow = total > WINDOW_SIZE;

        function windowSlice(startIdx) {
            const s = Math.max(0, Math.min(startIdx, total - WINDOW_SIZE));
            const end = hasOverflow ? s + WINDOW_SIZE : total;
            return { data: series.slice(s, end), start: s, end };
        }

        const initialStart = hasOverflow ? total - WINDOW_SIZE : 0; // 初期表示は直近分
        const { data: initialData, start, end } = windowSlice(initialStart);

        const chart = new Chart(el, {
            type: 'line',
            data: {
                labels: initialData.map((_, i) => start + i + 1),
                datasets: [{
                    label,
                    data: initialData,
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

        function updateSeekLabel(s, e) {
            if (!seekLabelEl) return;
            seekLabelEl.textContent = hasOverflow ? `${s + 1}〜${e} / ${total}戦` : `全${total}戦`;
        }
        updateSeekLabel(start, end);

        if (seekEl) {
            if (!hasOverflow) {
                seekEl.disabled = true;
                seekEl.max = 0;
            } else {
                seekEl.max = total - WINDOW_SIZE;
                seekEl.value = initialStart;
                seekEl.addEventListener('input', () => {
                    const { data, start: s, end: e } = windowSlice(Number(seekEl.value));
                    chart.data.labels = data.map((_, i) => s + i + 1);
                    chart.data.datasets[0].data = data;
                    chart.update();
                    updateSeekLabel(s, e);
                });
            }
        }
    }

    makePie('skillPieChart', DATA.skill_pie);
    makePie('typePieChart', DATA.type_pie);
    makeLine('rateLineChart', DATA.rate_series, '#0099ff', 'レート', 'rateSeek', 'rateSeekLabel');
    makeLine('enLineChart', DATA.en_series, '#ffdd33', 'EN収支累積', 'enSeek', 'enSeekLabel');
})();
