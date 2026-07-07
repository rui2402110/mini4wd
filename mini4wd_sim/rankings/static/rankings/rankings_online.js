// rankings/static/rankings/rankings_online.js ── サーバー配信のランキングデータでdata.jsのRANKING_DATAを上書き
'use strict';
(function () {
    if (!window.__RANKING_DATA__ || !Array.isArray(window.__RANKING_DATA__)) return;
    if (typeof RANKING_DATA === 'undefined') return;
    RANKING_DATA.length = 0;
    window.__RANKING_DATA__.forEach(e => RANKING_DATA.push(e));
})();
