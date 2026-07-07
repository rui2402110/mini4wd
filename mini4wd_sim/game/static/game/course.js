// ══════════════════════════════════════════════════════════════════
//  course.js ── コースの数学・座標計算ロジック
//  ・コースの座標系(スプライン)、レーン位置、進行方向、コーナー判定など、
//    「レイアウトの数学」のみを扱う純粋関数群。DOM/THREE描画には関与しない
//    （THREE.Vector3 / CatmullRomCurve3 のみ利用）。
//  ・依存: THREE.js のみ
// ══════════════════════════════════════════════════════════════════
'use strict';

        // ══════════════════════════════════════════════════════════════════
        //  コース定義
        // ══════════════════════════════════════════════════════════════════
        const L_X = 60, L_Z = 44, R = 7;

        const RAW_WP = [
            [0, -L_Z],
            [-L_X + R, -L_Z],
            [-L_X + R * 0.293, -L_Z + R * 0.293],
            [-L_X, -L_Z + R],
            [-L_X, 0],
            [-L_X, L_Z - R],
            [-L_X + R * 0.293, L_Z - R * 0.293],
            [-L_X + R, L_Z],
            [0, L_Z],
            [L_X - R, L_Z],
            [L_X - R * 0.293, L_Z - R * 0.293],
            [L_X, L_Z - R],
            [L_X, 0],
            [L_X, -L_Z + R],
            [L_X - R * 0.293, -L_Z + R * 0.293],
            [L_X - R, -L_Z],
        ];

        const TOTAL_PTS = 1200;
        const WAYPOINTS_3D = RAW_WP.map(([x, z]) => new THREE.Vector3(x, 0, z));
        const trackCurve = new THREE.CatmullRomCurve3(WAYPOINTS_3D, true, 'centripetal', 0.5);
        const SPLINE = trackCurve.getSpacedPoints(TOTAL_PTS).slice(0, TOTAL_PTS).map(p => [p.x, p.z]);

        function trackXZ(t) {
            const i0 = ((Math.floor(t * TOTAL_PTS) % TOTAL_PTS) + TOTAL_PTS) % TOTAL_PTS;
            const i1 = (i0 + 1) % TOTAL_PTS;
            const f = (t * TOTAL_PTS) - Math.floor(t * TOTAL_PTS);
            const p0 = SPLINE[i0], p1 = SPLINE[i1];
            return [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f];
        }

        function trackTangent(t) {
            const eps = 2 / TOTAL_PTS;
            const a = trackXZ(((t - eps) + 1) % 1);
            const b = trackXZ((t + eps) % 1);
            const dx = b[0] - a[0], dz = b[1] - a[1];
            const len = Math.sqrt(dx * dx + dz * dz) || 1;
            return [dx / len, dz / len];
        }

        function lanePos(t, off) {
            const [x, z] = trackXZ(t);
            const [tx, tz] = trackTangent(t);
            return new THREE.Vector3(x + tz * off, 0.22, z - tx * off);
        }

        function carYaw(t) {
            const [tx, tz] = trackTangent(t);
            return Math.atan2(tx, tz) - Math.PI / 2;
        }

        // ══════════════════════════════════════════════════════════════════
        //  コーナー判定テーブル
        // ══════════════════════════════════════════════════════════════════
        const CORNER_MAP = new Float32Array(TOTAL_PTS);
        const CORNER_THRESHOLD = 0.99;
        (function buildCornerMap() {
            for (let i = 0; i < TOTAL_PTS; i++) {
                const t0 = i / TOTAL_PTS;
                const t1 = ((i + 20) % TOTAL_PTS) / TOTAL_PTS;
                const [ax, az] = trackTangent(t0);
                const [bx, bz] = trackTangent(t1);
                const dot = ax * bx + az * bz;
                CORNER_MAP[i] = dot;
            }
        })();

        function isCorner(t) {
            const i = ((Math.round(t * TOTAL_PTS) % TOTAL_PTS) + TOTAL_PTS) % TOTAL_PTS;
            return CORNER_MAP[i] < CORNER_THRESHOLD;
        }
