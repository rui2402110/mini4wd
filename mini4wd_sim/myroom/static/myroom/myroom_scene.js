// ══════════════════════════════════════════════════════════════════
//  myroom_scene.js ── マイルーム背景の3Dシーン（改修要件8-1）
//  ・工具、基盤、使用中の車体を机に乗せ、奥に本棚と照明を配置し、
//    それらを少し離れた位置からゆっくり見渡すカメラワークにする。
//  ・car_view.js の buildCarMesh を流用し、装備中の車体をそのまま再現する。
// ══════════════════════════════════════════════════════════════════
'use strict';

(function () {
    const canvas = document.getElementById('myroomBgCanvas');
    const stage = document.getElementById('myroom-stage');
    if (!canvas || typeof THREE === 'undefined') return;

    function hexToInt(hex, fallback) {
        if (typeof hex !== 'string') return fallback;
        return parseInt(hex.replace('#', ''), 16) || fallback;
    }

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x08080e);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x08080e, 0.028);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

    function onResize() {
        const w = stage.clientWidth, h = stage.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);

    // ── ライティング ──
    scene.add(new THREE.AmbientLight(0x1a1a28, 1.4));
    const moonLight = new THREE.DirectionalLight(0x4a6fff, 0.35);
    moonLight.position.set(-8, 10, -6);
    scene.add(moonLight);

    // デスクランプ（暖色の点光源。工房らしい雰囲気の主光源）
    const lampLight = new THREE.PointLight(0xffcc77, 2.2, 14, 2);
    lampLight.position.set(2.6, 3.1, 1.6);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.set(1024, 1024);
    scene.add(lampLight);

    // ══════════════════════════════════════════════════════════════
    //  床・背面壁
    // ══════════════════════════════════════════════════════════════
    const matFloor = new THREE.MeshLambertMaterial({ color: 0x0a0a12 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), matFloor);
    floor.rotation.x = -Math.PI / 2; floor.position.y = -3.02; floor.receiveShadow = true;
    scene.add(floor);

    const matWall = new THREE.MeshLambertMaterial({ color: 0x0d0d16 });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), matWall);
    backWall.position.set(0, 6, -6.4); scene.add(backWall);

    // ══════════════════════════════════════════════════════════════
    //  机
    // ══════════════════════════════════════════════════════════════
    const matDeskTop = new THREE.MeshLambertMaterial({ color: 0x3a2a1c });
    const matDeskLeg = new THREE.MeshLambertMaterial({ color: 0x241a10 });

    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.22, 4.6), matDeskTop);
    deskTop.position.set(0, -0.11, 0.4);
    deskTop.castShadow = true; deskTop.receiveShadow = true;
    scene.add(deskTop);

    [[-4.4, -1.7], [4.4, -1.7], [-4.4, 2.5], [4.4, 2.5]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.9, 0.26), matDeskLeg);
        leg.position.set(x, -1.55, z); leg.castShadow = true;
        scene.add(leg);
    });

    // ══════════════════════════════════════════════════════════════
    //  基盤（回路基板）: 緑の板 + 小さなチップ/LED群
    // ══════════════════════════════════════════════════════════════
    (function buildCircuitBoard() {
        const g = new THREE.Group();
        const matBoard = new THREE.MeshLambertMaterial({ color: 0x0f4d2e });
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 1.2), matBoard);
        board.castShadow = true; board.receiveShadow = true;
        g.add(board);

        const chipColors = [0xc0c0c0, 0x333333, 0xffd700, 0x2266ff, 0xff3333];
        for (let i = 0; i < 10; i++) {
            const w = 0.08 + Math.random() * 0.14;
            const chip = new THREE.Mesh(
                new THREE.BoxGeometry(w, 0.05 + Math.random() * 0.05, w * 0.8),
                new THREE.MeshLambertMaterial({ color: chipColors[i % chipColors.length] })
            );
            chip.position.set((Math.random() - 0.5) * 1.3, 0.05, (Math.random() - 0.5) * 0.9);
            chip.castShadow = true;
            g.add(chip);
        }
        for (let i = 0; i < 4; i++) {
            const line = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.01, 0.02), new THREE.MeshBasicMaterial({ color: 0x66ffcc }));
            line.position.set(0, 0.03, -0.5 + i * 0.3);
            g.add(line);
        }

        g.position.set(2.9, 0.02, 1.3);
        g.rotation.y = -0.15;
        scene.add(g);
    })();

    // ══════════════════════════════════════════════════════════════
    //  工具（レンチ・ドライバー）
    // ══════════════════════════════════════════════════════════════
    (function buildTools() {
        const matTool = new THREE.MeshLambertMaterial({ color: 0x8a8f9a });
        const matHandle = new THREE.MeshLambertMaterial({ color: 0xdd2222 });

        const wrench = new THREE.Group();
        const wrenchBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.14), matTool);
        wrenchBar.castShadow = true;
        wrench.add(wrenchBar);
        const wrenchHead = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 12), matTool);
        wrenchHead.position.set(0.6, 0, 0);
        wrenchHead.castShadow = true;
        wrench.add(wrenchHead);
        wrench.position.set(-3.0, 0.06, 1.5);
        wrench.rotation.y = 0.5;
        scene.add(wrench);

        const driver = new THREE.Group();
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 10), matHandle);
        grip.rotation.z = Math.PI / 2; grip.position.x = -0.35;
        grip.castShadow = true;
        driver.add(grip);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), matTool);
        shaft.rotation.z = Math.PI / 2; shaft.position.x = 0.05;
        shaft.castShadow = true;
        driver.add(shaft);
        driver.position.set(-2.4, 0.09, 1.9);
        driver.rotation.y = -0.3;
        scene.add(driver);

        for (let i = 0; i < 6; i++) {
            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 6), matTool);
            bolt.position.set(-3.4 + Math.random() * 1.0, 0.03, 0.7 + Math.random() * 0.6);
            bolt.castShadow = true;
            scene.add(bolt);
        }
    })();

    // ══════════════════════════════════════════════════════════════
    //  装備中の車体（car_view.js の buildCarMesh を流用）
    // ══════════════════════════════════════════════════════════════
    const PC = window.__PREVIEW_CAR__;
    if (PC && typeof buildCarMesh === 'function') {
        const carMesh = buildCarMesh(
            hexToInt(PC.color_1, 0x888888),
            hexToInt(PC.color_2, 0xffffff),
            hexToInt(PC.color_3, 0xdddddd),
            PC.pattern,
            PC.mark_color
        );
        carMesh.scale.set(0.62, 0.62, 0.62);
        carMesh.position.set(-0.2, 0.02, -0.5);
        carMesh.rotation.y = 0.55;
        carMesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
        scene.add(carMesh);

        let carRotT = 0;
        window.__myroomCarSpin = (dt) => {
            carRotT += dt;
            carMesh.rotation.y = 0.55 + Math.sin(carRotT * 0.25) * 0.35;
        };
    }

    (function buildLamp() {
        const matLamp = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const matShade = new THREE.MeshLambertMaterial({ color: 0xffdd99, emissive: 0x553300, emissiveIntensity: 0.6 });
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.06, 12), matLamp);
        base.position.set(2.6, -0.05, 1.6);
        scene.add(base);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 8), matLamp);
        pole.position.set(2.6, 1.25, 1.6);
        scene.add(pole);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8), matLamp);
        arm.position.set(2.9, 2.5, 1.5); arm.rotation.z = Math.PI / 2.6;
        scene.add(arm);
        const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.42, 16, 1, true), matShade);
        shade.position.set(2.62, 3.05, 1.58); shade.rotation.x = Math.PI;
        scene.add(shade);
    })();

    // ══════════════════════════════════════════════════════════════
    //  本棚（奥に配置。棚板+本の集合）
    // ══════════════════════════════════════════════════════════════
    (function buildBookshelf() {
        const g = new THREE.Group();
        const matWood = new THREE.MeshLambertMaterial({ color: 0x2a1c10 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 0.9), matWood);
        frame.castShadow = true; frame.receiveShadow = true;
        g.add(frame);

        const bookColors = [0x00ff88, 0x0099ff, 0xffdd33, 0xff5566, 0xbd00ff, 0xff9933, 0x33ffee];
        for (let shelf = 0; shelf < 3; shelf++) {
            const shelfY = -1.4 + shelf * 1.4;
            const shelfPlane = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.06, 0.8), new THREE.MeshLambertMaterial({ color: 0x1a1108 }));
            shelfPlane.position.set(0, shelfY, 0.05);
            g.add(shelfPlane);

            let x = -2.3;
            while (x < 2.2) {
                const w = 0.12 + Math.random() * 0.16;
                const h = 0.55 + Math.random() * 0.35;
                const book = new THREE.Mesh(
                    new THREE.BoxGeometry(w, h, 0.55),
                    new THREE.MeshLambertMaterial({ color: bookColors[Math.floor(Math.random() * bookColors.length)] })
                );
                book.position.set(x, shelfY + 0.06 + h / 2, 0.05);
                book.rotation.y = (Math.random() - 0.5) * 0.06;
                book.castShadow = true;
                g.add(book);
                x += w + 0.03;
            }
        }
        g.position.set(-1.5, 3.1, -5.6);
        scene.add(g);
    })();

    // ══════════════════════════════════════════════════════════════
    //  カメラワーク: 少し離れた位置からゆっくり見渡す（改修要件8-1）
    // ══════════════════════════════════════════════════════════════
    let t0 = null;
    function animate(ts) {
        requestAnimationFrame(animate);
        if (t0 === null) t0 = ts;
        const elapsed = (ts - t0) / 1000;
        const dt = Math.min(elapsed - (animate._last || 0), 0.05);
        animate._last = elapsed;

        const angle = 0.35 + Math.sin(elapsed * 0.06) * 0.45;
        const radius = 10.5;
        camera.position.set(Math.sin(angle) * radius, 4.6 + Math.sin(elapsed * 0.05) * 0.4, Math.cos(angle) * radius - 1);
        camera.lookAt(0, 0.6, -0.5);

        if (window.__myroomCarSpin) window.__myroomCarSpin(dt);

        renderer.render(scene, camera);
    }

    onResize();
    requestAnimationFrame(animate);
})();
