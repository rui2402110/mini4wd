// ══════════════════════════════════════════════════════════════════
//  rankings.js ── ランキング画面専用ロジック
//  ・レートランキングの並び替え・ページネーション・行描画
//  ・自分のデータを常時表示する固定枠(own-pin)
//  ・プレビュー用3D空間（回転台座・ドラッグ回転）と選択車体のプレビュー表示
//  ・依存: data.js（RANKING_DATA/CAR_TYPES/SKILLS_DATA/getSkill等）,
//         car_view.js（buildPattern/buildCarMesh）
// ══════════════════════════════════════════════════════════════════
'use strict';

        const SORTED_RANKING = [...RANKING_DATA]
            .sort((a, b) => b.rate - a.rate)
            .map((d, i) => ({ ...d, rank: i + 1 }));

        // ══════════════════════════════════════════════════════════════════
        //  ページネーション（10位刻み）
        // ══════════════════════════════════════════════════════════════════
        const PAGE_SIZE = 10;
        const TOTAL_PAGES = Math.max(1, Math.ceil(SORTED_RANKING.length / PAGE_SIZE));
        let currentPage = 1;
        let hoveredIdx = null; // SORTED_RANKING 内のインデックス

        const scrollEl = document.getElementById('ranking-scroll');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const pageIndicator = document.getElementById('pageIndicator');

        function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }

        // ランキング行1件分のHTML断片を組み立てる共通ヘルパー（通常リスト・固定枠の両方で使用）
        function buildRowInnerHTML(entry) {
            const typDef = CAR_TYPES[entry.type];
            const sk = getSkill(entry.skill);
            const rankClass = entry.rank === 1 ? 'top1' : entry.rank === 2 ? 'top2' : entry.rank === 3 ? 'top3' : '';

            return `
                <div class="rank-badge-col">
                    <span class="rank-num ${rankClass}">${entry.rank}</span>
                    ${entry.isUser ? '<span class="you-tag">YOU</span>' : ''}
                </div>
                <div class="row-main">
                    <div class="row-top">
                        <span class="car-name">${entry.name}</span>
                        <span class="type-badge" style="background:${typDef.color}22;color:${typDef.color};border:1px solid ${typDef.color}55">${typDef.label}</span>
                    </div>
                    <div class="row-bottom">
                        <span class="player-name">${entry.player}</span>
                        <span class="swatches">
                            <i style="background:${hex(entry.bodyCol)}"></i>
                            <i style="background:${hex(entry.accentCol)}"></i>
                            <i style="background:${hex(entry.stripeCol)}"></i>
                        </span>
                    </div>
                    <div class="row-skills">
                        <span class="skill-tag role-main">★ ${sk ? sk.name : '-'}</span>
                        ${(entry.subSkills || []).map(id => { const s = getSkill(id); return s ? `<span class="skill-tag role-sub">▽ ${s.name}</span>` : ''; }).join('')}
                    </div>
                </div>
                <div class="rate-col">
                    <div class="rate-val">${entry.rate}</div>
                    <div class="rate-label">RATE</div>
                </div>
            `;
        }

        function renderRankingList() {
            scrollEl.innerHTML = '';
            const start = (currentPage - 1) * PAGE_SIZE;
            const pageItems = SORTED_RANKING.slice(start, start + PAGE_SIZE);

            pageItems.forEach((entry) => {
                const idx = SORTED_RANKING.indexOf(entry);

                const row = document.createElement('div');
                row.className = 'rank-row' + (entry.isUser ? ' own-row' : '');
                row.dataset.idx = idx;
                row.innerHTML = buildRowInnerHTML(entry);

                row.addEventListener('mouseenter', () => setHovered(idx));
                row.addEventListener('mouseleave', () => setHovered(null));

                scrollEl.appendChild(row);
            });

            if (hoveredIdx === null) {
                // デフォルトは自分の車体を表示
                const ownIdx = SORTED_RANKING.findIndex(e => e.isUser);
                showPreview(ownIdx >= 0 ? ownIdx : 0);
            }

            updateRowHighlight();
        }

        // ── 自分の順位を、実際の順位・表示ページに関わらず常時確認できる固定枠 ──
        function renderOwnPin() {
            const pinEl = document.getElementById('own-pin');
            const pinWrap = document.getElementById('own-pin-wrap');
            const ownIdx = SORTED_RANKING.findIndex(e => e.isUser);

            if (ownIdx < 0) {
                pinWrap.style.display = 'none';
                return;
            }

            const entry = SORTED_RANKING[ownIdx];
            const row = document.createElement('div');
            row.className = 'rank-row own-row';
            row.dataset.idx = ownIdx;
            row.innerHTML = buildRowInnerHTML(entry);

            row.addEventListener('mouseenter', () => setHovered(ownIdx));
            row.addEventListener('mouseleave', () => setHovered(null));

            pinEl.innerHTML = '';
            pinEl.appendChild(row);
        }

        function updateRowHighlight() {
            document.querySelectorAll('.rank-row').forEach(r => {
                r.classList.toggle('hovered', Number(r.dataset.idx) === hoveredIdx);
            });
        }

        function setHovered(idx) {
            hoveredIdx = idx;
            updateRowHighlight();
            if (idx !== null) {
                showPreview(idx);
            } else {
                const ownIdx = SORTED_RANKING.findIndex(e => e.isUser);
                showPreview(ownIdx >= 0 ? ownIdx : 0);
            }
        }

        function renderPagination() {
            pageIndicator.textContent = `${currentPage} / ${TOTAL_PAGES}`;
            prevBtn.disabled = currentPage <= 1;
            nextBtn.disabled = currentPage >= TOTAL_PAGES;
        }

        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) { currentPage--; renderRankingList(); renderPagination(); }
        });
        nextBtn.addEventListener('click', () => {
            if (currentPage < TOTAL_PAGES) { currentPage++; renderRankingList(); renderPagination(); }
        });

        // ══════════════════════════════════════════════════════════════════
        //  THREE.JS プレビュー（car_view.js の buildCarMesh を利用した車体モデル）
        // ══════════════════════════════════════════════════════════════════

        const canvas = document.getElementById('threeCanvas');
        const previewPanel = document.getElementById('preview-panel');

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
            const w = previewPanel.clientWidth, h = previewPanel.clientHeight;
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
        const platformRing = new THREE.Mesh(new THREE.RingGeometry(2.45, 2.58, 64), new THREE.MeshBasicMaterial({ color: 0x222a22, side: THREE.DoubleSide }));
        platformRing.rotation.x = -Math.PI / 2; platformRing.position.y = 0.001; scene.add(platformRing);
        const gridH = new THREE.GridHelper(40, 40, 0x0d0d1a, 0x0d0d1a); gridH.position.y = -0.08; scene.add(gridH);

        // ── buildPattern / buildCarMesh は car_view.js（車体表示の共通ファイル）を利用 ──

        let carMesh = null;
        let rotY = 0.4;
        let dragging = false, lastX = 0, autoSpin = true;

        const elCarLabelName = document.getElementById('carLabelName');
        const elInfoPlayer = document.getElementById('infoPlayer');
        const elInfoType = document.getElementById('infoType');
        const elInfoSkill = document.getElementById('infoSkill');
        const elInfoSubSkills = document.getElementById('infoSubSkills');
        const elInfoRate = document.getElementById('infoRate');

        function showPreview(idx) {
            const entry = SORTED_RANKING[idx];
            if (!entry) return;
            const typDef = CAR_TYPES[entry.type];
            const sk = getSkill(entry.skill);

            if (carMesh) { scene.remove(carMesh); }
            carMesh = buildCarMesh(entry.bodyCol, entry.accentCol, entry.stripeCol, typDef.pattern);
            carMesh.rotation.y = rotY;
            scene.add(carMesh);

            elCarLabelName.textContent = entry.name;
            elCarLabelName.style.color = hex(entry.accentCol);
            elCarLabelName.style.textShadow = `0 0 18px ${hex(entry.accentCol)}80`;

            elInfoPlayer.textContent = entry.player;
            elInfoType.textContent = typDef.label;
            elInfoType.style.color = typDef.color;
            elInfoSkill.textContent = sk ? sk.name : '-';
            const subNames = (entry.subSkills || []).map(id => { const s = getSkill(id); return s ? s.name : null; }).filter(Boolean);
            elInfoSubSkills.textContent = subNames.length ? subNames.join(' / ') : '-';
            elInfoRate.textContent = `${entry.rate} (#${entry.rank})`;
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

        // ── 戻るボタン(表示のみ。実際の遷移先は別ページ実装予定) ──
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = '/menu/';
        });

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

        // ── 初期化 ──
        renderOwnPin();
        renderRankingList();
        renderPagination();
        animate(0);
