// ══════════════════════════════════════════════════════════════════
//  rode_view.js ── レース場の表示ロジック（3Dシーン / コース描画 / カメラ演出）
//  ・renderer・scene・camera の初期化、ライト、地面、コースメッシュ、縁取りライン、
//    スタートライン、実況カメラの切り替え演出（SHOTS）を担当。
//  ・依存: THREE.js, course.js（trackXZ / trackTangent / lanePos / TOTAL_PTS / CORNER_MAP等）
//  ・rankings/garage 側は別途、自前の簡易シーンを持つため本ファイルには依存しない。
// ══════════════════════════════════════════════════════════════════
'use strict';

        // ── THREE.JS 初期化 ──
        const canvas = document.getElementById('threeCanvas');
        const container = document.getElementById('canvas-container');

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setClearColor(0x08080e);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x08080e, 0.005);
        const camera = new THREE.PerspectiveCamera(50, 3, 0.1, 400);


        // ── fxCanvas（パーティクル描画用の2Dオーバーレイ） ── containerの直後に初期化（onResizeより前）
        // 実体の粒子データ(particles配列)や描画処理は particle.js が持つが、
        // canvas自体はシーン初期化の一部としてここで用意する。
        const fxCanvas = document.getElementById('fx-canvas');
        const fxCtx = fxCanvas.getContext('2d');

        function onResize() {
            const w = container.clientWidth, h = container.clientHeight;
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            // fxCanvasも同期リサイズ
            fxCanvas.width = w; fxCanvas.height = h;
        }
        onResize();
        window.addEventListener('resize', onResize);

        scene.add(new THREE.AmbientLight(0x102018, 1.6));
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        sunLight.position.set(20, 50, 15);
        sunLight.castShadow = true;
        sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -200;
        sunLight.shadow.camera.right = sunLight.shadow.camera.top = 200;
        sunLight.shadow.camera.far = 240;
        sunLight.shadow.mapSize.set(2048, 2048);
        scene.add(sunLight);

        const ground = new THREE.Mesh(new THREE.PlaneGeometry(380, 320), new THREE.MeshLambertMaterial({ color: 0x07070c }));
        ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
        const gridH = new THREE.GridHelper(380, 76, 0x0d0d1a, 0x0d0d1a); gridH.position.y = 0.005; scene.add(gridH);

        const TRACK_W = 9.5;
        function buildTrackMesh() {
            const verts = [], idxs = [];
            const N = TOTAL_PTS;
            for (let i = 0; i < N; i++) {
                const t = i / N;
                const [x, z] = trackXZ(t);
                const [tx, tz] = trackTangent(t);
                const nx = tz, nz = -tx;
                const hw = TRACK_W / 2;
                verts.push(x + nx * hw, 0.06, z + nz * hw, x - nx * hw, 0.06, z - nz * hw);
                if (i < N - 1) {
                    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
                    idxs.push(a, b, c, b, d, c);
                }
            }
            idxs.push((N - 1) * 2, (N - 1) * 2 + 1, 0, (N - 1) * 2 + 1, 1, 0);
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
            geo.setIndex(idxs); geo.computeVertexNormals();

            const meshMain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x1a1a2c }));
            meshMain.receiveShadow = true;
            return meshMain;
        }
        scene.add(buildTrackMesh());

        (function buildCornerOverlay() {
            const pts = [];
            for (let i = 0; i < TOTAL_PTS; i++) {
                if (CORNER_MAP[i] < CORNER_THRESHOLD) {
                    const t = i / TOTAL_PTS;
                    const [x, z] = trackXZ(t);
                    const [tx, tz] = trackTangent(t);
                    const nx = tz, nz = -tx;
                    const hw = TRACK_W / 2 - 0.3;
                    pts.push(new THREE.Vector3(x + nx * hw, 0.10, z + nz * hw));
                    pts.push(new THREE.Vector3(x - nx * hw, 0.10, z - nz * hw));
                }
            }
            if (pts.length > 2) {
                const geo = new THREE.BufferGeometry().setFromPoints(pts);
                const mat = new THREE.LineBasicMaterial({ color: 0xff660015 });
                scene.add(new THREE.LineSegments(geo, mat));
            }
        })();

        function addEdgeLine(side, color) {
            const pts = [];
            for (let i = 0; i <= TOTAL_PTS; i++) {
                const t = i / TOTAL_PTS;
                const [x, z] = trackXZ(t);
                const [tx, tz] = trackTangent(t);
                const s = side * TRACK_W / 2;
                pts.push(new THREE.Vector3(x + tz * s, 0.13, z - tx * s));
            }
            scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color })));
        }
        addEdgeLine(1, 0x00ff8820);
        addEdgeLine(-1, 0x0099ff20);

        (function () {
            const [sx, sz] = trackXZ(0);
            const [tx, tz] = trackTangent(0);
            for (let i = 0; i < 6; i++) {
                const off = (i - 2.5) * (TRACK_W / 6);
                const m = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_W / 6, 0.55), new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xffffff : 0x111111 }));
                m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(tx, tz);
                m.position.set(sx + tz * off, 0.14, sz - tx * off); scene.add(m);
            }
        })();

        // ── カメラシステム v2.6 ──
        // 【変更点】
        // ・固定ショットの高度を上げて複数車体が画角に入りやすくした
        // ・WEST/EASTセクションは広角俯瞰に変更（STEADY vs EARLYの入れ替えが見える）
        // ・chaseターゲットを「トップ固定」から「2位チェイス枠」へ交互に切り替え
        const SHOTS = [
            { s: 0.00, e: 0.15, label: 'HOME STRAIGHT', pos: new THREE.Vector3(0, 16, -68), look: new THREE.Vector3(-10, 0, -44), lerp: 0.04, chase: false },
            { s: 0.15, e: 0.40, label: 'WEST SECTION', pos: new THREE.Vector3(-88, 42, 0), look: new THREE.Vector3(-60, 0, 0), lerp: 0.03, chase: false },
            { s: 0.40, e: 0.65, label: 'BACK STRETCH', pos: new THREE.Vector3(0, 22, 68), look: new THREE.Vector3(0, 0, 0), lerp: 0.04, chase: true, flash: true, chaseRank: 0 },
            { s: 0.65, e: 0.85, label: 'EAST SECTION', pos: new THREE.Vector3(88, 42, 0), look: new THREE.Vector3(60, 0, 0), lerp: 0.03, chase: false },
            { s: 0.85, e: 1.00, label: 'FINAL APPROACH', pos: new THREE.Vector3(44, 12, -52), look: new THREE.Vector3(0, 0, -44), lerp: 0.05, chase: true, chaseRank: 1 },
        ];

        // ── ファイナルストレッチ専用カメラ ──
        // 要件: 5ラップ目が4割進んだ時点で「位置固定（ゴール前）・1位に中心を合わせる」モードに切り替える。
        // 座標はHOME STRAIGHT（ゴール前ストレート）と同じ視点を流用し、ブレない固定アングルにしている。
        // 見た目を調整したい場合はここの座標(X, Y, Z)を変更してください。
        const FINAL_CAM_POS = new THREE.Vector3(0, 16, -68);

        // カメラが追いかける順位（ラップ進行で動的に変わる）
        // Lap1-2: 2位(STEADY)を追う, Lap3: トップ, Lap4-5: 激戦中の2位を追う
        function getCameraTargetRank(rankings) {
            // chaseRankはショット定義に埋め込む (0=トップ, 1=2位)
            // ここでは rankings を返すだけ、ショット側で参照
            return rankings;
        }

        const camCur = { pos: new THREE.Vector3(0, 18, -75), look: new THREE.Vector3(0, 0, -44), shot: null };
        const camLabelEl = document.getElementById('cam-label');
        let camLabelTimer = null;

        function showCamLabel(txt) {
            camLabelEl.textContent = txt; camLabelEl.style.opacity = '1';
            if (camLabelTimer) clearTimeout(camLabelTimer);
            camLabelTimer = setTimeout(() => { camLabelEl.style.opacity = '0'; }, 1800);
        }

        const flashEl = document.getElementById('zoom-flash');
        function doFlash(col, ms) {
            flashEl.style.boxShadow = `inset 0 0 50px ${col}`;
            flashEl.style.border = `2px solid ${col}`;
            setTimeout(() => { flashEl.style.boxShadow = 'none'; flashEl.style.border = '0px solid transparent'; }, ms);
        }

        function updateCamera(rankings) {
            if (!rankings || rankings.length === 0) return;

            // 1位と2位（いなければ1位）のデータを取得
            const lead = rankings[0];
            const second = rankings[1] || rankings[0];

            // 1位と2位の実際の3D空間上の座標を計算
            const pos1 = lanePos(lead.t, lead.laneOff);
            const pos2 = lanePos(second.t, second.laneOff);

            // 【グループフォーカス】2台の中間地点（重心）を計算
            const midPoint = new THREE.Vector3().addVectors(pos1, pos2).multiplyScalar(0.5);
            // 2台の間の直線距離
            const carDistance = pos1.distanceTo(pos2);

            // 現在のラップ進行度からショットを判定
            const t = ((lead.t % 1) + 1) % 1;

            // ★ ファイナルストレッチ判定
            // lap は内部的に0始まり（lap=4 が「5ラップ目（最終ラップ）を走行中」を意味する）。
            // 「5ラップ目 === 4」を「lap===5」と誤判定していたため、ほぼ発火しないバグがあった。
            // 要件: 5ラップ目の進行度が4割(0.4)に達したら発動する。
            const isFinalStretch = (lead.lap === TOTAL_LAPS - 1 && t >= 0.4) && !lead.finished;

            let shot = SHOTS[0];
            if (isFinalStretch) {
                // ファイナルラップ専用の仮想ショットを定義
                shot = { label: 'FINAL SHOWDOWN', lerp: 0.05, flash: false };
            } else {
                for (const s of SHOTS) { if (t >= s.s && t < s.e) { shot = s; break; } }
            }

            if (shot !== camCur.shot) {
                camCur.shot = shot; showCamLabel(shot.label);
                if (shot.flash) doFlash('#ffffff18', 300);
            }

            let tgtPos = new THREE.Vector3();
            let tgtLook = new THREE.Vector3();

            if (isFinalStretch) {
                // ─── ファイナルストレッチ：位置固定（ゴール前）・1位に中心を合わせる ───

                // ① 位置を固定 (ホームストレート・ゴール前を見渡せる位置)
                // ※ コースの見た目に応じて座標 (X, Y, Z) を微調整してください。
                tgtPos.copy(FINAL_CAM_POS);

                // ② 一位に中心を合わせる
                tgtLook.copy(pos1);

            } else if (shot.chase) {
                // ─── チェイスモード: 真後ろではなく斜め上（クォータービュー）から並走 ───
                const rank = (shot.chaseRank !== undefined) ? shot.chaseRank : 0;
                let target = lead;
                if (rank === 1) {
                    const lateInRace = rankings.find(c => c.typKey === 'LATE' && !c.finished);
                    target = (lead.lap >= 4 && lateInRace) ? lateInRace : second;
                }

                const carPos = lanePos(target.t, target.laneOff);
                const [tx, tz] = trackTangent(target.t); // 進行方向のベクトル

                // 法線ベクトル（マシンの真横を向くベクトル）を簡易計算
                const nx = -tz;
                const nz = tx;

                // 真後ろではなく、「後ろに10下げ、横に4ずらし、上に5上げる」ことで斜め上からのアングルにする
                tgtPos.set(
                    carPos.x - tx * 10 + nx * 4,
                    carPos.y + 5,
                    carPos.z - tz * 10 + nz * 4
                );

                // 注視点はマシンそのもの
                tgtLook.copy(carPos);

            } else {
                // ─── 固定カメラモード: カメラ位置は固定、首振りでトップ集団を追尾 ───
                tgtPos.copy(shot.pos);
                // 元の shot.look（固定値）を無視し、2台の中間地点（midPoint）を常に睨みつけさせる
                tgtLook.copy(midPoint);
            }

            // スムースなカメラ移動
            camCur.pos.lerp(tgtPos, shot.lerp);
            camCur.look.lerp(tgtLook, shot.lerp);

            camera.position.copy(camCur.pos);
            camera.lookAt(camCur.look);
        }
