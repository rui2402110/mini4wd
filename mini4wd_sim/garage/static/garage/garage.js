// ══════════════════════════════════════════════════════════════════
//  garage.js ── カスタマイズガレージ画面専用ロジック
//  ・ガレージ用3D空間（ライト・背景・回転台座）の初期化
//  ・マウスドラッグでのマシン回転（カメラ/回転処理）
//  ・名前入力（ランダムボタン）、タイプ選択、カラー選択ボタンのクリックイベント処理
//  ・スキル編成（メイン/サブ1/サブ2）とプリセット機能
//  ・依存: data.js（SKILLS_DATA/CAR_DEFS/NAMES_DATA/COLOR_PRESETS等）,
//         car_view.js（buildPattern/buildCarMesh）
// ══════════════════════════════════════════════════════════════════
'use strict';

        // 現在の選択カラー・スキル構成(機体タイプごとに保持)
        // mainSkill: 常時全力で発動するメインスキル / subSkill1・subSkill2: 効果-50%のサブスキル(v2.9仕様)
        const carState = {
            ESCAPE: { body: CAR_DEFS.ESCAPE.body, accent: CAR_DEFS.ESCAPE.accent, mark: CAR_DEFS.ESCAPE.mark, mainSkill: 'boost_lap5', subSkill1: 'low_friction', subSkill2: 'mud_trap' },
            BALANCED: { body: CAR_DEFS.BALANCED.body, accent: CAR_DEFS.BALANCED.accent, mark: CAR_DEFS.BALANCED.mark, mainSkill: 'never_motor', subSkill1: 'stable_tire', subSkill2: 'tuned_form' },
            CLOSER: { body: CAR_DEFS.CLOSER.body, accent: CAR_DEFS.CLOSER.accent, mark: CAR_DEFS.CLOSER.mark, mainSkill: 'reversal_motor', subSkill1: 'comeback_boost', subSkill2: 'dynamo_gear' },
        };

        let currentType = 'ESCAPE';

        // ── THREE.JS 初期化 ──
        const canvas = document.getElementById('threeCanvas');
        const viewport = document.getElementById('viewport');

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

        // ライト
        scene.add(new THREE.AmbientLight(0x202028, 1.8));
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
        keyLight.position.set(6, 9, 6);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0x4a6fff, 0.4);
        rimLight.position.set(-6, 3, -6);
        scene.add(rimLight);

        // プラットフォーム
        const platform = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.08, 48), new THREE.MeshLambertMaterial({ color: 0x14141c }));
        platform.position.y = -0.04; platform.receiveShadow = true; scene.add(platform);
        const platformRing = new THREE.Mesh(new THREE.RingGeometry(2.45, 2.58, 64), new THREE.MeshBasicMaterial({ color: 0x222a22, side: THREE.DoubleSide }));
        platformRing.rotation.x = -Math.PI / 2; platformRing.position.y = 0.001; scene.add(platformRing);
        const gridH = new THREE.GridHelper(40, 40, 0x0d0d1a, 0x0d0d1a); gridH.position.y = -0.08; scene.add(gridH);

        // ── buildPattern / buildCarMesh は car_view.js（車体表示の共通ファイル）を利用 ──

        let carMesh = null;
        let rotY = 0.4;

        function rebuildCar() {
            if (carMesh) { scene.remove(carMesh); }
            const def = CAR_DEFS[currentType];
            const st = carState[currentType];
            carMesh = buildCarMesh(st.body, st.accent, 0xdddddd, def.pattern, st.mark);
            carMesh.rotation.y = rotY;
            scene.add(carMesh);

            const nameInput = document.getElementById('machineNameInput');
            const currentName = nameInput.value || "NO NAME";

            document.getElementById('carLabelName').textContent = currentName;
            document.getElementById('carLabelName').style.color = '#' + st.accent.toString(16).padStart(6, '0');
            document.getElementById('carLabelName').style.textShadow = '0 0 18px #' + st.accent.toString(16).padStart(6, '0') + '80';
        }

        // ── UIイベント: 名前変更機能（日本語入力不可） ──
        const machineNameInput = document.getElementById('machineNameInput');
        const btnRandomName = document.getElementById('btnRandomName');

        machineNameInput.addEventListener('input', (e) => {
            // ASCII印刷可能文字（半角英数字・スペース・記号）以外を強制除去
            let filteredValue = e.target.value.replace(/[^ -~]/g, '');
            e.target.value = filteredValue;
            rebuildCar();
        });

        btnRandomName.addEventListener('click', () => {
            const randomIndex = Math.floor(Math.random() * NAMES_DATA.length);
            machineNameInput.value = NAMES_DATA[randomIndex];
            rebuildCar();
        });

        // ── UIイベント: 車体作戦タイプ選択 ──
        const btnEscape = document.getElementById('btnEscape');
        const btnBalanced = document.getElementById('btnBalanced');
        const btnCloser = document.getElementById('btnCloser');
        const strategyDesc = document.getElementById('strategyDesc');

        function selectMachine(type) {
            currentType = type;
            btnEscape.classList.toggle('active', type === 'ESCAPE');
            btnBalanced.classList.toggle('active', type === 'BALANCED');
            btnCloser.classList.toggle('active', type === 'CLOSER');
            
            const def = CAR_DEFS[type];
            const st = carState[type];

            [btnEscape, btnBalanced, btnCloser].forEach(btn => {
                const bType = btn.getAttribute('data-type');
                if(bType === type) {
                    btn.style.borderColor = hex(st.accent);
                    btn.style.color = hex(st.accent);
                } else {
                    btn.style.borderColor = '#333';
                    btn.style.color = '#777';
                }
            });

            // 説明文のアップデート
            strategyDesc.innerHTML = `<span>${def.desc}</span>`;

            renderSwatches();
            refreshSkillSelects();
            rebuildCar();
        }
        btnEscape.addEventListener('click', () => selectMachine('ESCAPE'));
        btnBalanced.addEventListener('click', () => selectMachine('BALANCED'));
        btnCloser.addEventListener('click', () => selectMachine('CLOSER'));

        // ── UIイベント: 組み込みスキル初期化（メイン1 + サブ2の v2.9 編成） ──
        const SKILL_SLOTS = [
            { key: 'mainSkill', select: document.getElementById('skillSelectMain'), desc: document.getElementById('skillDescMain') },
            { key: 'subSkill1', select: document.getElementById('skillSelectSub1'), desc: document.getElementById('skillDescSub1') },
            { key: 'subSkill2', select: document.getElementById('skillSelectSub2'), desc: document.getElementById('skillDescSub2') },
        ];

        function getSkillById(id) { return SKILLS_DATA.find(s => s.id === id) || null; }

        function updateSkillDesc(slot, id) {
            const sk = getSkillById(id);
            slot.desc.innerHTML = sk ? `<div><strong>効果:</strong> ${sk.effect}</div><div class="flavor-text">"${sk.flavor}"</div>` : '';
        }

        // メイン/サブ1/サブ2で同じスキルが重複しないよう、選択肢を都度絞り込んで再構築する
        function refreshSkillSelects() {
            const st = carState[currentType];

            SKILL_SLOTS.forEach(slot => {
                const otherIds = SKILL_SLOTS.filter(s => s !== slot).map(s => st[s.key]);
                const currentVal = st[slot.key];

                slot.select.innerHTML = '';
                SKILLS_DATA.forEach(skill => {
                    if (otherIds.includes(skill.id) && skill.id !== currentVal) return; // 他スロットで使用中はスキップ
                    const opt = document.createElement('option');
                    opt.value = skill.id;
                    opt.textContent = skill.name;
                    slot.select.appendChild(opt);
                });

                // 現在値が選べなくなっていたら先頭の候補にフォールバック
                if (![...slot.select.options].some(o => o.value === currentVal)) {
                    st[slot.key] = slot.select.options[0] ? slot.select.options[0].value : null;
                }
                slot.select.value = st[slot.key];
                updateSkillDesc(slot, st[slot.key]);
            });
        }

        function initSkills() {
            SKILL_SLOTS.forEach(slot => {
                slot.select.addEventListener('change', (e) => {
                    carState[currentType][slot.key] = e.target.value;
                    refreshSkillSelects(); // 他スロットの重複を再チェック
                });
            });
            refreshSkillSelects();
        }

        // ── 現在の構成を取得/反映するヘルパー（保存・装備・プリセット呼び出しで使用） ──
        // ※プリセット枠のUIはgarage_online.js側のモーダルに移管したため、
        //   プリセットの保存先データ自体はサーバー（DB）で管理する。
        function getCurrentCarData() {
            const st = carState[currentType];
            return {
                name: machineNameInput.value || "NO NAME",
                type: currentType,
                body: st.body,
                accent: st.accent,
                mark: st.mark,
                mainSkill: st.mainSkill,
                subSkill1: st.subSkill1,
                subSkill2: st.subSkill2,
            };
        }

        function applyCarData(data) {
            if (!data) return;
            machineNameInput.value = data.name;
            carState[data.type].body = data.body;
            carState[data.type].accent = data.accent;
            carState[data.type].mark = data.mark;
            carState[data.type].mainSkill = data.mainSkill;
            carState[data.type].subSkill1 = data.subSkill1;
            carState[data.type].subSkill2 = data.subSkill2;
            selectMachine(data.type);
        }

        // ── UIイベント: カラースウォッチ生成 ──
        function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }

        function renderSwatches() {
            const st = carState[currentType];

            const bodyWrap = document.getElementById('swatchBody');
            bodyWrap.innerHTML = '';
            COLOR1_PRESETS.forEach(c => {
                const el = document.createElement('div');
                el.className = 'swatch' + (c === st.body ? ' active' : '');
                el.style.background = hex(c);
                el.addEventListener('click', () => {
                    carState[currentType].body = c;
                    renderSwatches();
                    rebuildCar();
                });
                bodyWrap.appendChild(el);
            });

            const accentWrap = document.getElementById('swatchAccent');
            accentWrap.innerHTML = '';
            COLOR2_PRESETS.forEach(c => {
                const el = document.createElement('div');
                el.className = 'swatch' + (c === st.accent ? ' active' : '');
                el.style.background = hex(c);
                el.addEventListener('click', () => {
                    carState[currentType].accent = c;
                    // 色が変わったらタイプ選択ボタンの発光色も追従させる
                    const activeBtn = document.querySelector('.machine-btn.active');
                    if(activeBtn) {
                        activeBtn.style.borderColor = hex(c);
                        activeBtn.style.color = hex(c);
                    }
                    renderSwatches();
                    rebuildCar();
                });
                accentWrap.appendChild(el);
            });

            const markWrap = document.getElementById('swatchMark');
            markWrap.innerHTML = '';
            COLOR3_PRESETS.forEach(c => {
                const el = document.createElement('div');
                el.className = 'swatch' + (c === st.mark ? ' active' : '');
                el.style.background = hex(c);
                el.addEventListener('click', () => {
                    carState[currentType].mark = c;
                    renderSwatches();
                    rebuildCar();
                });
                markWrap.appendChild(el);
            });
        }

        // ── ドラッグで回転 / 非ドラッグ時は自動でゆっくり回転 ──
        let dragging = false, lastX = 0, autoSpin = true;
        canvas.addEventListener('pointerdown', e => { dragging = true; autoSpin = false; lastX = e.clientX; });
        window.addEventListener('pointerup', () => { dragging = false; });
        window.addEventListener('pointermove', e => {
            if (!dragging) return;
            const dx = e.clientX - lastX; lastX = e.clientX;
            rotY += dx * 0.01;
            if (carMesh) carMesh.rotation.y = rotY;
        });
        canvas.addEventListener('dblclick', () => { autoSpin = true; });

        // ── 戻るボタン ──
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = '/menu/';
        });

        // ── 初期化 ──
        initSkills();
        selectMachine('ESCAPE');

        // ── メインループ ──
        let lastTS = null;
        function animate(ts) {
            requestAnimationFrame(animate);
            if (lastTS === null) lastTS = ts;
            const dt = Math.min((ts - lastTS) / 1000, 0.05);
            lastTS = ts;

            if (autoSpin && carMesh) {
                rotY += dt * 0.35;
                carMesh.rotation.y = rotY;
            }

            renderer.render(scene, camera);
        }
        animate(0);
