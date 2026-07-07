// ══════════════════════════════════════════════════════════════════
//  garage_online.js ── ガレージ画面のサーバー連携ブリッジ
//  ・garage.js（既存のUIロジック）の後に読み込むこと。
//  ・所持していないカラー/スキルをCOLOR*_PRESETS/SKILLS_DATAから除外して再描画し、
//    savePreset/loadPreset をラップしてサーバーへの保存・装備リクエストを行う。
//  ・garage.js側の関数・変数はいずれもトップレベルの let/const/function 宣言のため、
//    別スクリプトタグからも同一グローバル字句スコープとして参照・再代入できる
//    （クラシックscriptの仕様を利用したノンインベーシブな統合）。
// ══════════════════════════════════════════════════════════════════
'use strict';

(function () {
    const STATE = window.__GARAGE_STATE__;
    if (!STATE) return;

    function getCookie(name) {
        const m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
        return m ? decodeURIComponent(m[1]) : null;
    }
    const CSRF_TOKEN = getCookie('csrftoken');

    function postJSON(url, body) {
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF_TOKEN },
            body: JSON.stringify(body),
        }).then(r => r.json());
    }

    function hexToInt(hex) { return parseInt(hex.replace('#', ''), 16); }
    function intToHex(n) { return '#' + n.toString(16).padStart(6, '0'); }

    // ── 所持していないカラー/スキルを除外する ──
    if (typeof COLOR1_PRESETS !== 'undefined' && STATE.owned_colors.COLOR1.length) {
        const owned = STATE.owned_colors.COLOR1.map(hexToInt);
        COLOR1_PRESETS.length = 0; owned.forEach(c => COLOR1_PRESETS.push(c));
    }
    if (typeof COLOR2_PRESETS !== 'undefined' && STATE.owned_colors.COLOR2.length) {
        const owned = STATE.owned_colors.COLOR2.map(hexToInt);
        COLOR2_PRESETS.length = 0; owned.forEach(c => COLOR2_PRESETS.push(c));
    }
    if (typeof COLOR3_PRESETS !== 'undefined' && STATE.owned_colors.COLOR3.length) {
        const owned = STATE.owned_colors.COLOR3.map(hexToInt);
        COLOR3_PRESETS.length = 0; owned.forEach(c => COLOR3_PRESETS.push(c));
    }
    if (typeof SKILLS_DATA !== 'undefined' && STATE.owned_skill_ids.length) {
        const ownedSet = new Set(STATE.owned_skill_ids);
        const filtered = SKILLS_DATA.filter(s => ownedSet.has(s.id));
        SKILLS_DATA.length = 0; filtered.forEach(s => SKILLS_DATA.push(s));
    }

    // ── プリセットロック判定をサーバーの開放状況に合わせる ──
    if (typeof PRESET_MAX !== 'undefined') {
        window.__UNLOCKED_PRESETS__ = STATE.unlocked_presets || [1, 2, 3, 4];
    }

    // 再描画（garage.js初期化時点では所持データ未反映だったため、ここで反映後に再描画する）
    if (typeof refreshSkillSelects === 'function') refreshSkillSelects();
    if (typeof renderSwatches === 'function') renderSwatches();

    // ── サーバー保存済みプリセットをロードしてUIに反映 ──
    if (typeof presets !== 'undefined' && STATE.cars) {
        Object.keys(STATE.cars).forEach(presetNumStr => {
            const presetNum = Number(presetNumStr);
            if (presetNum === STATE.current_preset_number) return; // 99(現在使用中)はプリセット欄には出さない
            const car = STATE.cars[presetNumStr];
            if (!car || presetNum < 1 || presetNum > PRESET_MAX) return;
            presets[presetNum - 1] = {
                name: car.car_name,
                type: car.car_type,
                body: hexToInt(car.color_1),
                accent: hexToInt(car.color_2),
                mark: hexToInt(car.color_3),
                mainSkill: car.main_skill,
                subSkill1: car.sub_skill_1,
                subSkill2: car.sub_skill_2,
            };
        });
        if (typeof renderPresets === 'function') renderPresets();
    }

    // ── savePreset / loadPreset をラップしてサーバーへ反映 ──
    if (typeof savePreset === 'function') {
        const originalSave = savePreset;
        savePreset = function (i) {
            originalSave(i);
            const data = (typeof presets !== 'undefined') ? presets[i] : null;
            if (!data) return;
            postJSON('/garage/api/save/', {
                preset_number: i + 1,
                car_name: data.name,
                color_1: intToHex(data.body),
                color_2: intToHex(data.accent),
                color_3: intToHex(data.mark),
                main_skill: data.mainSkill,
                sub_skill_1: data.subSkill1,
                sub_skill_2: data.subSkill2,
                car_type: data.type,
            }).then(res => { if (!res.ok) alert('保存に失敗しました: ' + res.error); });
        };
    }

    if (typeof loadPreset === 'function') {
        const originalLoad = loadPreset;
        loadPreset = function (i) {
            originalLoad(i);
            postJSON('/garage/api/equip/', { preset_number: i + 1 })
                .then(res => { if (!res.ok) alert('装備に失敗しました: ' + res.error); });
        };
    }

    if (typeof clearPreset === 'function') {
        const originalClear = clearPreset;
        clearPreset = function (i) {
            originalClear(i);
            postJSON('/garage/api/delete/', { preset_number: i + 1 });
        };
    }
})();
