// garage/static/garage/shop.js ── ショップ画面のカート選択・まとめ買いロジック（9-6参照）
'use strict';

(function () {
    const STATE = window.__SHOP_STATE__;
    const cart = { colors: new Set(), skills: new Set(), presetSlot: false };

    function getCookie(name) {
        const m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
        return m ? decodeURIComponent(m[1]) : null;
    }
    const CSRF_TOKEN = getCookie('csrftoken');

    const colorGrid = document.getElementById('colorGrid');
    const skillGrid = document.getElementById('skillGrid');
    const presetSlotGrid = document.getElementById('presetSlotGrid');
    const cartCountEl = document.getElementById('cartCount');
    const cartTotalEl = document.getElementById('cartTotal');
    const enBalanceEl = document.getElementById('enBalanceVal');
    const buyBtn = document.getElementById('buyBtn');

    let currentEn = STATE.user_en;

    function updateCartSummary() {
        const total = cart.colors.size * STATE.color_price
            + cart.skills.size * STATE.skill_price
            + (cart.presetSlot ? STATE.preset_slot_price : 0);
        const count = cart.colors.size + cart.skills.size + (cart.presetSlot ? 1 : 0);
        cartCountEl.textContent = count;
        cartTotalEl.textContent = total.toLocaleString();
        cartTotalEl.style.color = total > currentEn ? '#ff5566' : '#00ff88';
    }

    function renderColors() {
        colorGrid.innerHTML = '';
        STATE.colors.forEach(c => {
            const el = document.createElement('div');
            el.className = 'shop-item' + (c.owned ? ' owned' : '');
            el.innerHTML = `
                <div class="swatch-preview" style="background:${c.color_code}"></div>
                <div class="item-name">${c.color_type} ${c.color_code}</div>
                ${c.owned ? '<div class="owned-badge">所持済み</div>' : `<div class="item-price">${c.price.toLocaleString()} en</div>`}
            `;
            if (!c.owned) {
                el.addEventListener('click', () => {
                    if (cart.colors.has(c.color_id)) cart.colors.delete(c.color_id);
                    else cart.colors.add(c.color_id);
                    el.classList.toggle('selected');
                    updateCartSummary();
                });
            }
            colorGrid.appendChild(el);
        });
    }

    function renderSkills() {
        skillGrid.innerHTML = '';
        STATE.skills.forEach(s => {
            const el = document.createElement('div');
            el.className = 'shop-item' + (s.owned ? ' owned' : '');
            el.innerHTML = `
                <div class="item-name">${s.name}</div>
                <div style="color:#889; font-size:11px; margin-bottom:6px;">${s.effect}</div>
                ${s.owned ? '<div class="owned-badge">所持済み</div>' : `<div class="item-price">${s.price.toLocaleString()} en</div>`}
            `;
            if (!s.owned) {
                el.addEventListener('click', () => {
                    if (cart.skills.has(s.skill_id)) cart.skills.delete(s.skill_id);
                    else cart.skills.add(s.skill_id);
                    el.classList.toggle('selected');
                    updateCartSummary();
                });
            }
            skillGrid.appendChild(el);
        });
    }

    function renderPresetSlot() {
        presetSlotGrid.innerHTML = '';
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.innerHTML = `
            <div class="item-name">PRESET #${STATE.next_preset_number}</div>
            <div class="item-price">${STATE.preset_slot_price.toLocaleString()} en</div>
        `;
        el.addEventListener('click', () => {
            cart.presetSlot = !cart.presetSlot;
            el.classList.toggle('selected');
            updateCartSummary();
        });
        presetSlotGrid.appendChild(el);
    }

    buyBtn.addEventListener('click', () => {
        if (cart.colors.size === 0 && cart.skills.size === 0 && !cart.presetSlot) {
            alert('購入する項目を選択してください。');
            return;
        }
        fetch('/garage/shop/api/purchase/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF_TOKEN },
            body: JSON.stringify({
                colors: [...cart.colors],
                skills: [...cart.skills],
                preset_slot: cart.presetSlot,
            }),
        })
            .then(r => r.json())
            .then(res => {
                if (!res.ok) {
                    alert('購入に失敗しました: ' + res.error);
                    return;
                }
                alert(`購入完了！ ${res.spent.toLocaleString()} en 消費しました。`);
                window.location.reload();
            })
            .catch(() => alert('通信エラーが発生しました。'));
    });

    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = '/menu/';
    });

    enBalanceEl.textContent = currentEn.toLocaleString();
    renderColors();
    renderSkills();
    renderPresetSlot();
    updateCartSummary();
})();
