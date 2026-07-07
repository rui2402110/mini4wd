// ══════════════════════════════════════════════════════════════════
//  car_view.js ── 車体の表示ロジック
//  ・マシン3Dメッシュ（ボディ・パーツ・タイプ別マーク）の構築、
//    走行トレイル、自車インジケーター（浮遊矢印）など「車体そのものの見た目」を担当。
//  ・race.html / garage.html / rankings.html いずれからも読み込まれる共通部品。
//  ・依存: THREE.js のみ（scene への add は呼び出し側、またはグローバルのsceneを参照する
//    関数(makeTrailMesh)内でのみ行う）
// ══════════════════════════════════════════════════════════════════
'use strict';

        function buildPattern(type, markCol) {
            const group = new THREE.Group();
            if (!type) return group;

            const SIDE_Z = 0.585;  // 車体側面のZ座標（パネル面）

            // 各シェイプは「頭(先端)」をローカル原点(0,0)に置き、そこから-Y方向へ図形が伸びる。
            function lightningShape() {
                const s = new THREE.Shape();
                s.moveTo(0, 0);
                s.lineTo(-0.16, -0.17);
                s.lineTo(-0.07, -0.17);
                s.lineTo(-0.22, -0.42);
                s.lineTo(-0.03, -0.22);
                s.lineTo(-0.13, -0.22);
                s.closePath();
                return s;
            }
            function arrowShape() {
                const s = new THREE.Shape();
                s.moveTo(0, 0);
                s.lineTo(-0.13, -0.15);
                s.lineTo(-0.05, -0.15);
                s.lineTo(-0.05, -0.24);
                s.lineTo(0.05, -0.24);
                s.lineTo(0.05, -0.15);
                s.lineTo(0.13, -0.15);
                s.closePath();
                return s;
            }
            function flameShape() {
                const s = new THREE.Shape();
                s.moveTo(0, 0);
                s.bezierCurveTo(-0.10, -0.05, -0.18, -0.16, -0.12, -0.29);
                s.bezierCurveTo(-0.08, -0.22, -0.06, -0.23, -0.05, -0.32);
                s.bezierCurveTo(-0.015, -0.21, 0.015, -0.21, 0.05, -0.32);
                s.bezierCurveTo(0.06, -0.23, 0.08, -0.22, 0.12, -0.29);
                s.bezierCurveTo(0.18, -0.16, 0.10, -0.05, 0, 0);
                s.closePath();
                return s;
            }

            // マークカラーの濃淡バリエーションを作る（積層・重ね用）
            function shade(hex, amt) {
                let r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
                if (amt >= 0) {
                    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
                } else {
                    r += r * amt; g += g * amt; b += b * amt;
                }
                return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
            }

            function meshFromShape(shapeFn, color) {
                const geo = new THREE.ShapeGeometry(shapeFn());
                const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
                return new THREE.Mesh(geo, mat);
            }

            // 車体横（サイド）マーク：左右は完全に同一のジオメトリを ±Z に置くだけにする。
            // （回転でミラーすると向きが崩れるが、同じ板を裏側から見ると自然に鏡像になるため、
            //   進行方向(+X)に対して常に線対称な見た目になる）
            // scaleX：ローカルX方向（rotZ=-90°で回転させた場合は上下方向になる＝高さ）
            // scaleY：ローカルY方向（rotZ=-90°で回転させた場合は前後方向になる＝長さ）
            // rotZ：マーク自体の向き（矢印・炎は進行方向=+Xへ90度回転させる）
            function addSide(shapeFn, color, x, y, scaleX, scaleY, rotZ) {
                [1, -1].forEach(sign => {
                    const m = meshFromShape(shapeFn, color);
                    m.scale.set(scaleX, scaleY, 1);
                    if (rotZ) m.rotation.z = rotZ;
                    m.position.set(x, y, sign * SIDE_Z);
                    group.add(m);
                });
            }

            // ボンネット（フロント上面）マーク
            function addBonnet(shapeFn, color, x, z, scale, rotZ) {
                const m = meshFromShape(shapeFn, color);
                m.scale.set(scale, scale, scale);
                m.rotation.x = -Math.PI / 2;
                if (rotZ) m.rotation.z = rotZ;
                m.position.set(x, 0.205, z);
                group.add(m);
            }

            if (type === 'lightning') {
                // 逃げ切り型：稲妻×2（重ねて配置）。先端を高い位置に置き、車体ルーフを大きく超えて上に伸ばす
                addSide(lightningShape, markCol, 0.32, 1.00, 1.5, 2.5, 0);
                addSide(lightningShape, shade(markCol, 0.4), 0.20, 0.90, 1.1, 1.9, 0);
                addBonnet(lightningShape, markCol, 0.95, -0.16, 1.1, Math.PI * 0.06);
                addBonnet(lightningShape, shade(markCol, 0.4), 0.95, 0.16, 1.1, -Math.PI * 0.06);
            } else if (type === 'arrow') {
                // 中盤型：矢印の積層×3。進行方向(+X)へ90度回転させ、ノーズ側から3段に並べる。
                // 高さ方向(scaleX)を大きくして車体ルーフより大きく上に張り出させる
                const xs = [0.78, 0.30, -0.18];
                xs.forEach((x, i) => {
                    addSide(arrowShape, shade(markCol, -i * 0.16), x, 0.42, 3.0 - i * 0.35, 1.7 - i * 0.2, -Math.PI / 2);
                });
                [0, 1, 2].forEach(i => {
                    addBonnet(arrowShape, shade(markCol, -i * 0.16), 1.12 - i * 0.18, 0, 1.0 - i * 0.12, 0);
                });
            } else if (type === 'flame') {
                // 追い込み型：炎×1。進行方向(+X)へ90度回転させ、高さ方向を大きく取って上に張り出させる
                addSide(flameShape, markCol, 0.55, 0.42, 3.1, 1.5, -Math.PI / 2);
                addBonnet(flameShape, markCol, 0.95, 0, 1.4, 0);
            }

            return group;
        }

        function buildCarMesh(bodyCol, accentCol, stripeCol, pattern, markCol) {
            const g = new THREE.Group();
            const matBody = new THREE.MeshLambertMaterial({ color: bodyCol });
            const matAccent = new THREE.MeshLambertMaterial({ color: accentCol });
            const matStripe = new THREE.MeshBasicMaterial({ color: stripeCol });
            const matDark = new THREE.MeshLambertMaterial({ color: 0x111118 });
            const matChrome = new THREE.MeshLambertMaterial({ color: 0x999aaa });
            const matRubber = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
            const matGlass = new THREE.MeshLambertMaterial({ color: 0x223344, transparent: true, opacity: 0.72 });
            const matRoller = new THREE.MeshLambertMaterial({ color: 0xc6cbd6 });
            const matStay = new THREE.MeshLambertMaterial({ color: 0x4c5566 });

            const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.24, 1.16), matBody); bodyMesh.position.y = 0.12; bodyMesh.castShadow = true; g.add(bodyMesh);
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.00, 0.21, 0.92), matBody); cabin.position.set(-0.10, 0.36, 0); cabin.castShadow = true; g.add(cabin);
            const nose = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.17, 0.92), matBody); nose.position.set(1.04, 0.09, 0); nose.rotation.z = 0.22; nose.castShadow = true; g.add(nose);

            const fBump = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 1.30), matChrome); fBump.position.set(1.26, 0.06, 0); g.add(fBump);
            const rBump = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 1.30), matChrome); rBump.position.set(-1.26, 0.06, 0); g.add(rBump);

            const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 1.16), matAccent); wing.position.set(-1.04, 0.50, 0); g.add(wing);
            [-0.58, 0.58].forEach(zo => {
                const ep = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 0.06), matAccent); ep.position.set(-1.04, 0.43, zo); g.add(ep);
                const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.05), matChrome); p.position.set(-1.04, 0.36, zo); g.add(p);
                const s = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.05, 0.03), matStripe); s.position.set(0.07, 0.185, zo); g.add(s);
            });

            const fw = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.78), matGlass); fw.position.set(0.18, 0.40, 0); g.add(fw);
            const under = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.035, 1.10), matDark); under.position.y = -0.10; g.add(under);

            const wheelRefs = [];
            [0.66, -0.66].forEach(wx => {
                [-0.50, 0.50].forEach(wz => {
                    const wg = new THREE.Group(); wg.position.set(wx, -0.01, wz);
                    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.17, 18), matRubber); tire.rotation.x = Math.PI / 2; wg.add(tire);
                    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.176, 12), matAccent); rim.rotation.x = Math.PI / 2; wg.add(rim);
                    g.add(wg); wheelRefs.push(wg);
                });
            });

            [[1.06, true], [1.06, false], [-1.06, true], [-1.06, false]].forEach(([bx, frontSide]) => {
                const zEdge = 0.58, zRoller = 0.84;
                const sign = frontSide ? 1 : -1;
                const stay = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, (zRoller - zEdge) * 2 + 0.06), matStay);
                stay.position.set(bx, 0.10, sign * (zEdge + (zRoller - zEdge) / 2));
                stay.castShadow = true; g.add(stay);
                const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 8), matChrome);
                bolt.position.set(bx, 0.10, sign * (zEdge + 0.04)); g.add(bolt);
                const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.21, 16), matRoller);
                roller.position.set(bx, 0.105, sign * zRoller); roller.castShadow = true; g.add(roller);
                const rollerBand = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.04, 16), matAccent);
                rollerBand.position.set(bx, 0.105, sign * zRoller); g.add(rollerBand);
            });

            g.add(buildPattern(pattern, markCol != null ? markCol : accentCol));
            const glow = new THREE.PointLight(accentCol, 0.3, 3.4); glow.position.set(0, 0.30, 0); g.add(glow);
            g.userData.wheelRefs = wheelRefs;
            return g;
        }

        const TRAIL_N = 90;
        function makeTrailMesh(col) {
            const pos = new Float32Array(TRAIL_N * 3);
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const mat = new THREE.PointsMaterial({ color: col, size: 0.08, transparent: true, opacity: 0.45, depthWrite: false });
            const pts = new THREE.Points(geo, mat); scene.add(pts);
            return { pos, geo, pts, hist: [] };
        }

        // ── 自分の車体を示す浮遊矢印（3Dシーン内） ──
        // 車体グループの子として追加するため、車体のヨー回転に追従するが、
        // コーン形状はY軸対称なので回転しても見た目が破綻しない。
        function buildOwnIndicator() {
            const g = new THREE.Group();
            const mat = new THREE.MeshBasicMaterial({ color: 0xffee00 });
            const cone = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.46, 8), mat);
            cone.rotation.x = Math.PI; // 先端を下（車体側）に向ける
            g.add(cone);
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.30, 8), mat);
            shaft.position.y = 0.36;
            g.add(shaft);
            const glow = new THREE.PointLight(0xffee00, 0.7, 2.4);
            glow.position.y = 0.1;
            g.add(glow);
            g.position.y = 1.3;
            g.userData.baseY = 1.3;
            return g;
        }
