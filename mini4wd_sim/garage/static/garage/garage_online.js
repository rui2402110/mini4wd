// ══════════════════════════════════════════════════════════════════
//  garage_online.js ── ガレージ画面のサーバー連携ブリッジ（改修要件3対応版）
//  ・garage.js（既存のUIロジック）の後に読み込むこと。
//  ・所持していないカラー/スキルをCOLOR*_PRESETS/SKILLS_DATAから除外して再描画する。
//  ・SAVEボタン：現在の編集内容をそのまま「現在使用中(99)」として保存・装備し、
//    続けてプリセット1〜5への追加登録を行うかどうかのポップアップを出す。
//  ・CALL PRESETボタン：同じポップアップUIでプリセットを選び、ガレージの
//    表示内容をそのプリセットの内容に置き換える（呼び出すだけで即装備はしない）。
// ══════════════════════════════════════════════════════════════════
'use strict';

(function () {
    const STATE = window.__GARAGE_STATE__;
    if (!STATE) return;

    const TYPE_CLIENT_TO_SERVER = { ESCAPE: 'EARLY', BALANCED: 'STEADY', CLOSER: 'LATE' };
    const TYPE_SERVER_TO_CLIENT = { EARLY: 'ESCAPE', STEADY: 'BALANCED', LATE: 'CLOSER' };

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
    if (typeof refreshSkillSelects === 'function') refreshSkillSelects();
    if (typeof renderSwatches === 'function') renderSwatches();

    // ── 現在使用中(99)の車体があれば、初期表示をそれに合わせる ──
    const currentCar = STATE.cars ? STATE.cars[String(STATE.current_preset_number)] : null;
    if (currentCar && typeof applyCarData === 'function') {
        applyCarData({
            name: currentCar.car_name,
            type: TYPE_SERVER_TO_CLIENT[currentCar.car_type] || 'ESCAPE',
            body: hexToInt(currentCar.color_1),
            accent: hexToInt(currentCar.color_2),
            mark: hexToInt(currentCar.color_3),
            mainSkill: currentCar.main_skill,
            subSkill1: currentCar.sub_skill_1,
            subSkill2: currentCar.sub_skill_2,
        });
    }

    // ══════════════════════════════════════════════════════════════
    //  プリセット登録/呼び出し 共用モーダル
    // ══════════════════════════════════════════════════════════════
    const overlay = document.getElementById('presetModalOverlay');
    const modalTitle = document.getElementById('presetModalTitle');
    const modalDesc = document.getElementById('presetModalDesc');
    const slotButtonsWrap = document.getElementById('presetSlotButtons');
    const confirmBtn = document.getElementById('presetModalConfirm');
    const cancelBtn = document.getElementById('presetModalCancel');

    let mode = 'register'; // 'register' | 'call'
    let selectedSlot = null;

    function openModal(newMode) {
        mode = newMode;
        selectedSlot = null;
        modalTitle.textContent = mode === 'register' ? 'プリセットに登録' : 'プリセットを呼び出す';
        modalDesc.textContent = mode === 'register'
            ? '登録したいプリセット番号を選んで「登録する」を押してください。'
            : '呼び出したいプリセット番号を選んで「呼び出す」を押してください。';
        confirmBtn.textContent = mode === 'register' ? '登録する' : '呼び出す';
        renderSlotButtons();
        overlay.classList.add('open');
    }
    function closeModal() { overlay.classList.remove('open'); }

    function renderSlotButtons() {
        slotButtonsWrap.innerHTML = '';
        for (let num = 1; num <= 5; num++) {
            const unlocked = (STATE.unlocked_presets || [1, 2, 3, 4]).includes(num);
            const carData = STATE.cars ? STATE.cars[String(num)] : null;
            const btn = document.createElement('div');
            btn.className = 'preset-slot-btn' + (carData ? ' filled' : '') + (!unlocked ? ' locked' : '');
            btn.innerHTML = `${num}<span class="slot-name">${!unlocked ? '未開放' : (carData ? carData.car_name : '空き')}</span>`;
            if (unlocked && !(mode === 'call' && !carData)) {
                btn.addEventListener('click', () => {
                    selectedSlot = num;
                    slotButtonsWrap.querySelectorAll('.preset-slot-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                });
            }
            slotButtonsWrap.appendChild(btn);
        }
    }

    document.getElementById('btnSaveGarage').addEventListener('click', () => {
        const data = getCurrentCarData();
        postJSON('/garage/api/save-current/', {
            car_name: data.name,
            color_1: intToHex(data.body),
            color_2: intToHex(data.accent),
            color_3: intToHex(data.mark),
            main_skill: data.mainSkill,
            sub_skill_1: data.subSkill1,
            sub_skill_2: data.subSkill2,
            car_type: TYPE_CLIENT_TO_SERVER[data.type] || 'STEADY',
        }).then(res => {
            if (!res.ok) { alert('保存に失敗しました: ' + res.error); return; }
            STATE.cars[String(STATE.current_preset_number)] = {
                car_name: data.name, color_1: intToHex(data.body), color_2: intToHex(data.accent), color_3: intToHex(data.mark),
                main_skill: data.mainSkill, sub_skill_1: data.subSkill1, sub_skill_2: data.subSkill2,
                car_type: TYPE_CLIENT_TO_SERVER[data.type] || 'STEADY',
            };
            openModal('register');
        });
    });

    document.getElementById('btnCallPreset').addEventListener('click', () => openModal('call'));
    cancelBtn.addEventListener('click', closeModal);

    confirmBtn.addEventListener('click', () => {
        if (selectedSlot === null) { closeModal(); return; }

        if (mode === 'register') {
            const data = getCurrentCarData();
            postJSON('/garage/api/save/', {
                preset_number: selectedSlot,
                car_name: data.name,
                color_1: intToHex(data.body),
                color_2: intToHex(data.accent),
                color_3: intToHex(data.mark),
                main_skill: data.mainSkill,
                sub_skill_1: data.subSkill1,
                sub_skill_2: data.subSkill2,
                car_type: TYPE_CLIENT_TO_SERVER[data.type] || 'STEADY',
            }).then(res => {
                if (!res.ok) { alert('プリセット登録に失敗しました: ' + res.error); return; }
                STATE.cars[String(selectedSlot)] = {
                    car_name: data.name, color_1: intToHex(data.body), color_2: intToHex(data.accent), color_3: intToHex(data.mark),
                    main_skill: data.mainSkill, sub_skill_1: data.subSkill1, sub_skill_2: data.subSkill2,
                    car_type: TYPE_CLIENT_TO_SERVER[data.type] || 'STEADY',
                };
                closeModal();
            });
        } else {
            const carData = STATE.cars[String(selectedSlot)];
            if (carData && typeof applyCarData === 'function') {
                applyCarData({
                    name: carData.car_name,
                    type: TYPE_SERVER_TO_CLIENT[carData.car_type] || 'ESCAPE',
                    body: hexToInt(carData.color_1),
                    accent: hexToInt(carData.color_2),
                    mark: hexToInt(carData.color_3),
                    mainSkill: carData.main_skill,
                    subSkill1: carData.sub_skill_1,
                    subSkill2: carData.sub_skill_2,
                });
            }
            closeModal();
        }
    });
})();
