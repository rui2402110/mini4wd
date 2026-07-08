// garage/static/garage/shop.js ── ショップ画面のカート選択・まとめ買いロジック（9-6参照）
'use strict';

(function () {
    const STATE = window.__SHOP_STATE__;
    const cart = { colors: new Set(), skills: new Set(), presetSlot: false };

    // ══════════════════════════════════════════════════════════════
    //  左側3Dプレビュー（改修要件5）: 現在装備中の車体を表示するだけの簡易シーン
    // ══════════════════════════════════════════════════════════════
    (function initPreview() {
        const canvas = document.getElementById('threeCanvas');
        const viewport = document.getElementById('viewport');
        if (!canvas || !viewport || typeof THREE === 'undefined') return;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setClearColor(0x08080e);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x08080e, 0.012);
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
        camera.position.set(0, 1.7, 4.6);
        camera.lookAt(0, 0.35, 0);

        function onResize() {
            const w = viewport.clientWidth, h = viewport.clientHeight;
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }
        onResize();
        window.addEventListener('resize', onResize);

        scene.add(new THREE.AmbientLight(0x202028, 1.8));
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
        keyLight.position.set(6, 9, 6);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0x4a6fff, 0.4);
        rimLight.position.set(-6, 3, -6);
        scene.add(rimLight);

        const platform = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.08, 48), new THREE.MeshLambertMaterial({ color: 0x14141c }));
        platform.position.y = -0.04; platform.receiveShadow = true; scene.add(platform);
        const gridH = new THREE.GridHelper(40, 40, 0x0d0d1a, 0x0d0d1a); gridH.position.y = -0.08; scene.add(gridH);

        function hexToInt(hex) { return parseInt((hex || '#888888').replace('#', ''), 16); }

        let carMesh = null;
        let rotY = 0.4, dragging = false, lastX = 0, autoSpin = true;

        const pc = STATE.preview_car;
        const nameEl = document.getElementById('carLabelName');
        if (pc) {
            carMesh = buildCarMesh(hexToInt(pc.color_1), hexToInt(pc.color_2), hexToInt(pc.color_3), pc.pattern, pc.mark_color);
            carMesh.rotation.y = rotY;
            scene.add(carMesh);
            if (nameEl) {
                nameEl.textContent = pc.car_name;
                nameEl.style.color = '#' + hexToInt(pc.color_2).toString(16).padStart(6, '0');
            }
        } else if (nameEl) {
            nameEl.textContent = '未装備';
        }

        canvas.addEventListener('pointerdown', e => { dragging = true; autoSpin = false; lastX = e.clientX; });
        window.addEventListener('pointerup', () => { dragging = false; });
        window.addEventListener('pointermove', e => {
            if (!dragging) return;
            const dx = e.clientX - lastX; lastX = e.clientX;
            rotY += dx * 0.01;
            if (carMesh) carMesh.rotation.y = rotY;
        });
        canvas.addEventListener('dblclick', () => { autoSpin = true; });

        let lastTS = null;
        function animate(ts) {
            requestAnimationFrame(animate);
            if (lastTS === null) lastTS = ts;
            const dt = Math.min((ts - lastTS) / 1000, 0.05);
            lastTS = ts;
            if (autoSpin && carMesh) { rotY += dt * 0.35; carMesh.rotation.y = rotY; }
            renderer.render(scene, camera);
        }
        animate(0);
    })();

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
