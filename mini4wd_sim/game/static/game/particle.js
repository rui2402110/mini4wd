// ══════════════════════════════════════════════════════════════════
//  particle.js ── スキルなどのパーティクル表示ロジック（2Dキャンバスオーバーレイ）
//  ・ブースト/ダメージ/凍結などの視覚エフェクトの生成・更新・描画を担当。
//  ・依存: rode_view.js（fxCanvas/fxCtx）, course.js は不要（画面座標はcamera投影で算出）
// ══════════════════════════════════════════════════════════════════
'use strict';


        // パーティクル実体配列（fxCanvas/fxCtx自体は rode_view.js で初期化済み）
        const particles = [];

        // ══════════════════════════════════════════════════════════════════
        //  パーティクルシステム (2D canvas overlay)
        // ══════════════════════════════════════════════════════════════════
        //
        // ■ パーティクルを大きくしたい場合はここを編集してください ■
        //
        //   PARTICLE_SIZE_MIN / PARTICLE_SIZE_MAX
        //     → 通常パーティクル（炎・回復・水しぶき等）の大きさの範囲
        //   PARTICLE_SIZE_WHITE
        //     → 低摩擦タイヤ用の白い小パーティクルの大きさ
        //   HAZE_SIZE_MIN / HAZE_SIZE_MAX
        //     → 勝ち越しモーターのもや（spawnTargetHaze）の大きさ
        //
        //   数値を大きくするほど円が大きく描画されます。
        //   例: PARTICLE_SIZE_MIN を 2 → 5、MAX を 5 → 10 にすると倍くらいの見た目になります。
        //
        const PARTICLE_SIZE_MIN = 4;   // 通常パーティクルの最小サイズ(px)
        const PARTICLE_SIZE_MAX = 15;   // 通常パーティクルの最大サイズ(px) ※ MIN + ランダム幅
        const PARTICLE_SIZE_WHITE = 7;   // 低摩擦タイヤ(white)用の固定サイズ(px)
        const HAZE_SIZE_MIN = 7;   // 勝ち越しモーターのもやの最小サイズ(px)
        const HAZE_SIZE_MAX = 15;  // 勝ち越しモーターのもやの最大サイズ(px) ※ MIN + ランダム幅

        // 車のワールド座標を画面上の2D座標(fxCanvas用)に変換する
        function getScreenPos(car) {
            const pos = lanePos(car.t, car.laneOff).clone();
            pos.project(camera); // 3D→正規化スクリーン座標(-1〜1)に変換
            return {
                x: (pos.x * 0.5 + 0.5) * fxCanvas.width,   // -1〜1 → 0〜canvas幅
                y: (-pos.y * 0.5 + 0.5) * fxCanvas.height, // -1〜1 → 0〜canvas高さ（Y反転）
            };
        }

        // スキル発動時の演出パーティクルを生成する
        // car  : 発生源の車
        // type : 'flame'(炎) | 'green_plus'(回復) | 'blue_water'(水しぶき) | 'white'(低摩擦タイヤ)
        //      | 'blue_circle'(無線ジャミング) | 'smoke'(強制オーバークロック等の煙)
        //      | 'purple'(毒/劇物系ゾーン) | 'red_hit'(悪路走行タイヤの軽減演出) | 'explosion'(自爆EMP)
        //      | 'yellow'(並走モーター)
        function spawnParticles(car, type) {
            const sp = getScreenPos(car);
            const count = (type === 'white' || type === 'red_hit') ? 2 : 8; // 一度に発生させる粒の数
            for (let i = 0; i < count; i++) {
                let col, vx, vy, life, size;
                vx = (Math.random() - 0.5) * 3;   // 横方向の初速（左右ランダム）
                vy = -Math.random() * 3 - 1;      // 縦方向の初速（上向きに飛び出す）
                life = 0.4 + Math.random() * 0.4; // 寿命(秒) 0.4〜0.8秒でランダム

                // ── パーティクルの大きさ ──
                // white/red_hit は固定サイズ、それ以外はMIN〜MAXの範囲でランダム
                size = (type === 'white' || type === 'red_hit')
                    ? PARTICLE_SIZE_WHITE
                    : PARTICLE_SIZE_MIN + Math.random() * (PARTICLE_SIZE_MAX - PARTICLE_SIZE_MIN);

                switch (type) {
                    case 'flame': col = `hsl(${20 + Math.random() * 30},100%,60%)`; break;      // オレンジ〜赤の炎色
                    case 'green_plus': col = '#00ff88'; break;                                    // 回復の緑
                    case 'blue_water': col = '#44aaff'; break;                                    // 水しぶきの水色
                    case 'blue_circle': col = '#3399ff'; break;                                   // 無線ジャミングの青い円
                    case 'smoke': col = `hsl(0,0%,${55 + Math.random() * 20}%)`; break;            // オーバークロックの煙(グレー)
                    case 'purple': col = '#aa33ee'; break;                                        // 毒/劇物系ゾーン
                    case 'red_hit': col = '#ff3333'; break;                                       // 悪路走行タイヤ軽減演出
                    case 'explosion': col = `hsl(${Math.random() * 30},100%,55%)`; break;          // 自爆EMP
                    case 'yellow': col = '#ffdd33'; break;                                        // 並走モーター
                    default: col = '#ffffff'; // white等
                }
                particles.push({ x: sp.x, y: sp.y, vx, vy, life, maxLife: life, col, size });
            }
        }

        // 勝ち越しモーター発動時、ターゲットにかける「もや」エフェクト
        function spawnTargetHaze(car) {
            const sp = getScreenPos(car);
            for (let i = 0; i < 12; i++) { // もやの粒の数
                particles.push({
                    x: sp.x + (Math.random() - 0.5) * 30, // 車の周囲にランダムに散らす(横30px範囲)
                    y: sp.y + (Math.random() - 0.5) * 30, // 車の周囲にランダムに散らす(縦30px範囲)
                    vx: (Math.random() - 0.5) * 1.5,      // 横方向にゆっくり漂う
                    vy: -Math.random() * 1.5,             // 上方向にゆっくり漂う
                    life: 0.8 + Math.random() * 0.5,      // 寿命(秒) 0.8〜1.3秒
                    maxLife: 1.3,
                    col: '#ff4400', // もやの色（赤オレンジ）
                    // ── もやの大きさ ── HAZE_SIZE_MIN〜HAZE_SIZE_MAXの範囲でランダム
                    size: HAZE_SIZE_MIN + Math.random() * (HAZE_SIZE_MAX - HAZE_SIZE_MIN),
                });
            }
        }

        // 毎フレーム呼ばれる、パーティクルの移動・消滅・描画処理
        function updateParticles(dt) {
            fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height); // 前フレームの描画をクリア
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx; // 横移動
                p.y += p.vy; // 縦移動
                p.vy += 0.08; // 重力（だんだん下に落ちる）
                p.life -= dt;
                if (p.life <= 0) { particles.splice(i, 1); continue; } // 寿命が尽きたら削除

                const alpha = p.life / p.maxLife; // 寿命が減るほど薄く（フェードアウト）
                fxCtx.globalAlpha = alpha * 0.85;
                fxCtx.fillStyle = p.col;
                fxCtx.beginPath();
                // ── 実際に円として描画される半径 ── p.size(生成時に決めた大きさ) × alpha(残り寿命で縮小)
                fxCtx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
                fxCtx.fill();
            }
            fxCtx.globalAlpha = 1;
        }
