// ══════════════════════════════════════════════════════════════════
//  skills.js ── スキルのロジック（v2.9: メイン1 + サブ2 + ランダム2 = 5スキル制）
//  ・スキルの発動条件判定・効果適用・状態管理を一手に担当。
//  ・依存: data.js（SKILLS_DATA/getSkill/CAR_CONFIGS）, course.js, physics.js（addTimedEffect等、
//         関数内参照のみ）, rode_view.js（spawnSlowZone等）, particle.js（spawnParticles）,
//         commentary.js（addComment）※いずれも呼び出しは実行時（フレーム内）のみなので、
//         スクリプトの読み込み順序そのものには依存しない。
// ══════════════════════════════════════════════════════════════════
'use strict';


        // 並走モーター用: 他車の速度バフ発動を記録するイベントログ（1ラップ分参照される）
        const boostEventLog = [];
        function announceBoost(car, magnitude, elapsed) {
            boostEventLog.push({ carId: car.id, lap: car.lap, magnitude, elapsed });
            // ログが際限なく伸びないよう直近30件のみ保持
            if (boostEventLog.length > 30) boostEventLog.shift();
        }

        // ── スキルシステム v2.9（メイン1 + サブ2 + ランダム2 = 5スキル制）──

        // 指定した車体にとって、そのスキルIDが main/sub/random のどの役割かを返す（未所持ならnull）
        function getCarSkillRole(carId, skillId) {
            const cfg = CAR_CONFIGS.find(c => c.id === carId);
            if (!cfg || !skillId) return null;
            if (cfg.mainSkill === skillId) return 'main';
            if (cfg.subSkills && cfg.subSkills.includes(skillId)) return 'sub';
            if (cfg.randomSkills && cfg.randomSkills.includes(skillId)) return 'random';
            return null;
        }

        // サブスキルは効果-50%（power=0.5）。メイン・ランダムは全力（power=1.0）。
        function skillPower(carId, skillId) {
            return getCarSkillRole(carId, skillId) === 'sub' ? 0.5 : 1.0;
        }

        // 実行中の有効スキル一覧（mainSkill + subSkills + 確定済みrandomSkills）
        function getCarSkills(carId) {
            const cfg = CAR_CONFIGS.find(c => c.id === carId);
            if (!cfg) return [];
            const ids = [];
            if (cfg.mainSkill) ids.push(cfg.mainSkill);
            (cfg.subSkills || []).forEach(id => { if (id) ids.push(id); });
            (cfg.randomSkills || []).forEach(id => { if (id) ids.push(id); });
            return ids.map(id => getSkill(id)).filter(Boolean);
        }
        function carHasSkill(car, skillId) {
            return getCarSkills(car.id).some(s => s.id === skillId);
        }

        // ランダムスキル抽選（レース開始時に呼ぶ）
        // mainSkill・subSkillsと被らないよう、重複なしで2つ割り当てる
        const ALL_SKILL_IDS = SKILLS_DATA.map(s => s.id);
        function assignRandomSkills() {
            CAR_CONFIGS.forEach(cfg => {
                const owned = new Set([cfg.mainSkill, ...(cfg.subSkills || [])]);
                const pool = ALL_SKILL_IDS.filter(id => !owned.has(id));
                // Fisher-Yatesで先頭2つを抽選
                for (let i = pool.length - 1; i > 0; i--) {
                    const j = Math.floor(seededRandom() * (i + 1));
                    [pool[i], pool[j]] = [pool[j], pool[i]];
                }
                cfg.randomSkills = [pool[0] || null, pool[1] || null];
            });
        }
        // リセット時はrandomSkillsをクリア
        function clearRandomSkills() {
            CAR_CONFIGS.forEach(cfg => { cfg.randomSkills = [null, null]; });
        }
        // 各車のスキル実行時ステート初期値（v2.9: 新スキル群のフラグ/タイマーを含む）
        function createInitialSkillState() {
            return {
                // 既存スキル用フラグ
                lap5BoostActive: false,
                illegalBattUsed: false,
                reversalDone: false,
                winningDone: false,
                bigMotorDone: false,
                boostTimer: 0,        // 汎用ブーストタイマー（秒）
                boostSpeedMult: 1.0,  // ブースト中の速度倍率
                boostDrainMult: 1.0,  // ブースト中のバッテリー消費倍率
                externalSpeedDebuff: 1.0, // 勝ち越しモーター等による速度デバフ（乗算・持続）
                externalSpeedBuff: 1.0,   // 強制オーバークロック等による速度バフ（乗算・レース中持続）

                // v2.9 新スキル用
                effects: [],              // 期限付き効果 [{mult, expiresAt}]（無線ジャミング/ネバーモーター/ペダル等）
                jamUsed: false,           // 無線ジャミング（3ラップ目開始）
                sprinklerUsed: false,     // 劇物散布スプリンクラー（2ラップ目開始）
                empUsed: false,           // 自爆EMP（5ラップ目開始）
                pedalDebuffUsed: false,   // ブレーキ&アクセルペダル効果①
                pedalBoostUsed: false,    // ブレーキ&アクセルペダル効果②
                leakyUsed: false,         // 液漏れバッテリー
                dynamoUsed: false,        // 魔改造ダイナモギア（発動済みフラグ）
                dynamoActiveUntil: 0,     // 魔改造ダイナモギア（回復持続の終了時刻）
                neverMotorCooldownUntil: 0, // ネバーモーターの再発動クールダウン終了時刻
                parallelUsedLap: -1,      // 並走モーターを使用済みのラップ番号
            };
        }
        // ══════════════════════════════════════════════════════════════════
        //  スキル発動処理
        // ══════════════════════════════════════════════════════════════════
        function fireSkill(car, skillId, rankings, elapsed) {
            const sk = getSkill(skillId);
            if (!sk) return;
            const p = sk.params;
            const ss = car.skillState;
            const power = skillPower(car.id, skillId); // メイン/ランダム=1.0, サブ=0.5
            const carName = `<strong style="color:${car.accentHex}">${car.name}</strong>`;
            const rank = rankings.findIndex(c => c.id === car.id) + 1; // 1-based

            switch (skillId) {
                // ══ 既存スキル（サブ選出時は-50%スケーリング）══
                case 'boost_lap5':
                    if (car.lap >= 4 && !ss.lap5BoostActive) {
                        ss.lap5BoostActive = true;
                        const bonus = p.lap5SpeedBonus * power;
                        ss.boostSpeedMult = Math.max(ss.boostSpeedMult, 1 + bonus);
                        ss.boostTimer = 999; // 最終ラップ中ずっと
                        car.flashBadge(skillId);
                        spawnParticles(car, 'flame');
                        announceBoost(car, bonus, elapsed);
                        addComment(`<i class="fa-solid fa-fire" style="color:#ff6633"></i> ${carName} が追い込みブースト発動！5ラップ目に全力加速！`, 'boost');
                        doFlash('#ff440022', 350);
                    }
                    break;

                case 'illegal_batt':
                    if (car.battery <= p.threshold && !ss.illegalBattUsed && car.battery > 0) {
                        ss.illegalBattUsed = true;
                        const recover = p.recover * power;
                        car.battery = Math.min(100, car.battery + recover);
                        car.flashBadge(skillId);
                        spawnParticles(car, 'green_plus');
                        addComment(`<i class="fa-solid fa-heart" style="color:#33dd66"></i> ${carName} の違法バッテリーが起動！バッテリーが${recover.toFixed(0)}%回復した！`, 'boost');
                    }
                    break;

                case 'reversal_motor':
                    if (car.lap >= 4 && rank >= 3 && !ss.reversalDone) {
                        ss.reversalDone = true;
                        const speedBoost = p.speedBoost * power;
                        car.battery = Math.min(100, car.battery + p.battRecover * power);
                        ss.boostSpeedMult = Math.max(ss.boostSpeedMult, 1 + speedBoost);
                        ss.boostTimer = p.duration;
                        car.flashBadge(skillId);
                        spawnParticles(car, 'green_plus');
                        spawnParticles(car, 'flame');
                        announceBoost(car, speedBoost, elapsed);
                        addComment(`<i class="fa-solid fa-bolt"></i> ${carName} の逆転モーター発動！3位以下からの大逆転劇が始まる！`, 'boost');
                        doFlash('#ffee0018', 300);
                    }
                    break;

                case 'winning_motor':
                    if (car.lap >= 4 && rank <= 2 && !ss.winningDone) {
                        ss.winningDone = true;
                        car.flashBadge(skillId);
                        CARS.forEach(target => {
                            if (target.id === car.id) return;
                            target.skillState.externalSpeedDebuff *= (1 - p.targetSpeedDebuff * power);
                            target.battery = Math.max(0, target.battery - p.targetBattDebuff * power);
                            spawnTargetHaze(target);
                        });
                        addComment(`<i class="fa-solid fa-skull" style="color:#cc44ff"></i> ${carName} の勝ち越しモーター発動！他車に速度低下とバッテリー消耗を付与！`, 'warning');
                    }
                    break;

                case 'big_motor':
                    if (car.lap >= 4 && rank >= 2 && rank <= 3 && !ss.bigMotorDone) {
                        ss.bigMotorDone = true;
                        const speedBoost = p.speedBoost * power;
                        car.battery = Math.min(100, car.battery + p.battRecover * power);
                        ss.boostSpeedMult = Math.max(ss.boostSpeedMult, 1 + speedBoost);
                        ss.boostDrainMult = 1 + (p.drainMult - 1) * power;
                        ss.boostTimer = p.duration;
                        car.flashBadge(skillId);
                        spawnParticles(car, 'blue_water');
                        announceBoost(car, speedBoost, elapsed);
                        addComment(`<i class="fa-solid fa-droplet" style="color:#44aaff"></i> ${carName} のビッグモーター発動！大出力でバッテリーを急速消費しながら加速！`, 'boost');
                        doFlash('#0088ff18', 350);
                    }
                    break;

                case 'mud_trap':
                case 'poison_chihuahua':
                case 'freeze_spray':
                case 'forced_overclock':
                    // race_start でセットアップ済み(triggerRaceStartSkills)。毎フレームの発動チェックは不要
                    break;

                // ══ 新規スキル v2.9 ══
                case 'wifi_jamming':
                    // 3ラップ目開始時、自分より順位の高い(自分より前を走る)車体の速度を下げる
                    if (car.lap >= 2 && !ss.jamUsed) {
                        ss.jamUsed = true;
                        const ownIdx = rankings.findIndex(c => c.id === car.id);
                        const targets = ownIdx > 0 ? rankings.slice(0, ownIdx) : [];
                        targets.forEach(target => {
                            addTimedEffect(target, 1 - p.speedDebuff * power, p.duration, elapsed);
                            spawnParticles(target, 'blue_circle');
                        });
                        car.flashBadge(skillId);
                        spawnParticles(car, 'blue_circle');
                        addComment(`<i class="fa-solid fa-satellite-dish"></i> ${carName} の無線ジャミング発動！前方の車体を電波妨害！`, 'warning');
                    }
                    break;

                case 'poison_sprinkler':
                    // 2ラップ目開始時、他車のコースに毒ゾーンを1か所生成
                    if (car.lap >= 1 && !ss.sprinklerUsed) {
                        ss.sprinklerUsed = true;
                        spawnSlowZone('poison', car, 'poison_sprinkler', CARS.filter(c => c.id !== car.id), p.mudCount);
                        car.flashBadge(skillId);
                        spawnParticles(car, 'purple');
                        addComment(`<i class="fa-solid fa-skull-crossbones"></i> ${carName} の劇物散布スプリンクラー発動！コース上に毒ゾーンを散布！`, 'warning');
                    }
                    break;

                case 'self_destruct_emp':
                    // 5ラップ目開始時、自分含む全車の速度を一時的に大幅ダウン
                    if (car.lap >= 4 && !ss.empUsed) {
                        ss.empUsed = true;
                        CARS.forEach(target => {
                            addTimedEffect(target, 1 - p.speedDebuff * power, p.duration, elapsed);
                        });
                        car.flashBadge(skillId);
                        spawnParticles(car, 'explosion');
                        addComment(`<i class="fa-solid fa-bomb" style="color:#ff5533"></i> ${carName} の自爆EMP発動！全車の速度が一瞬ガクッと落ちた！`, 'warning');
                        doFlash('#ff220022', 400);
                    }
                    break;

                case 'brake_accel_pedal':
                    // 効果①: バッテリー10%以下で自身速度ダウン + バッテリー全回復（1回）
                    if (car.battery <= p.threshold && car.battery > 0 && !ss.pedalDebuffUsed) {
                        ss.pedalDebuffUsed = true;
                        addTimedEffect(car, 1 - p.selfSpeedDebuff * power, p.debuffDuration, elapsed);
                        car.battery = Math.min(100, car.battery + p.battRecover * power);
                        car.flashBadge(skillId);
                        spawnParticles(car, 'green_plus');
                        addComment(`<i class="fa-solid fa-circle-check" style="color:#33dd66"></i> ${carName} のブレーキ&アクセルペダル(ブレーキ)発動！減速と引き換えにバッテリー満タン！`, 'boost');
                    }
                    // 効果②: 5ラップ目到達で速度アップ（1回）
                    if (car.lap >= 4 && !ss.pedalBoostUsed) {
                        ss.pedalBoostUsed = true;
                        const bonus = p.lap5SpeedBonus * power;
                        addTimedEffect(car, 1 + bonus, p.boostDuration, elapsed);
                        car.flashBadge(skillId);
                        spawnParticles(car, 'blue_water');
                        announceBoost(car, bonus, elapsed);
                        addComment(`<i class="fa-solid fa-circle-info" style="color:#3399ff"></i> ${carName} のブレーキ&アクセルペダル(アクセル)発動！ラストスパート！`, 'boost');
                    }
                    break;

                case 'leaky_battery':
                    // バッテリー50%以下で発動。回復 + 他車のコースに毒ゾーン生成（1回）
                    if (car.battery <= p.threshold && !ss.leakyUsed) {
                        ss.leakyUsed = true;
                        car.battery = Math.min(100, car.battery + p.battRecover * power);
                        spawnSlowZone('poison', car, 'leaky_battery', CARS.filter(c => c.id !== car.id), p.mudCount);
                        car.flashBadge(skillId);
                        spawnParticles(car, 'green_plus');
                        spawnParticles(car, 'purple');
                        addComment(`<i class="fa-solid fa-car-battery"></i> ${carName} の液漏れバッテリー発動！バッテリーが回復し、漏れた液が毒ゾーンに！`, 'boost');
                    }
                    break;

                case 'parallel_motor':
                    // 1ラップに一度、直近で他車が得た速度バフを自分にも付与
                    if (ss.parallelUsedLap !== car.lap) {
                        const ev = boostEventLog.find(e => e.carId !== car.id && e.lap === car.lap && (elapsed - e.elapsed) < 4);
                        if (ev) {
                            ss.parallelUsedLap = car.lap;
                            addTimedEffect(car, 1 + ev.magnitude * power, 5, elapsed);
                            car.flashBadge(skillId);
                            spawnParticles(car, 'yellow');
                            addComment(`<i class="fa-solid fa-circle-exclamation" style="color:#ffdd33"></i> ${carName} の並走モーター発動！他車の加速に便乗！`, 'boost');
                        }
                    }
                    break;
            }
        }

        // ── Lap通過時のスキルチェック ──
        function onLapCross(car, rankings, elapsed) {
            getCarSkills(car.id).forEach(sk => {
                if (!sk.passive) fireSkill(car, sk.id, rankings, elapsed);
            });
        }

        // ── 毎フレームのスキルチェック（条件発動・持続効果）──
        function checkFrameSkills(car, rankings, elapsed) {
            getCarSkills(car.id).forEach(sk => {
                switch (sk.id) {
                    case 'illegal_batt':
                    case 'boost_lap5':
                    case 'reversal_motor':
                    case 'winning_motor':
                    case 'big_motor':
                    case 'wifi_jamming':
                    case 'poison_sprinkler':
                    case 'self_destruct_emp':
                    case 'brake_accel_pedal':
                    case 'leaky_battery':
                    case 'parallel_motor':
                        fireSkill(car, sk.id, rankings, elapsed);
                        break;
                }
            });
            // パッシブ: 安定タイヤ・低摩擦タイヤ・改造フォルム・悪路走行タイヤ・逆転ブースト・ネバーモーター
            //          ・魔改造ダイナモギア(持続部分) → いずれも updateCarPhysics で直接参照
        }
