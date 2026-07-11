// ══════════════════════════════════════════════════════════════════
//  physics.js ── 車両の物理・挙動ロジック
//  ・速度/バッテリー/コーナー減速などの毎フレーム更新処理と、
//    泥・氷などのハザードゾーン（生成・判定・見た目のメッシュ）を担当。
//  ・依存: THREE.js, course.js（lanePos/trackTangent/CORNER_MAP等）,
//         rode_view.js（scene）, skills.js（skillPower/carHasSkill、関数内で参照のみ）
// ══════════════════════════════════════════════════════════════════
'use strict';

        // ── 泥ゾーン管理 ──
        const hazardZones = [];
        const hazardMeshes = [];

        // ══════════════════════════════════════════════════════════════════
        //  ハザードゾーンシステム v2.9（泥/毒/凍結を統合管理）
        //  type: 'mud' | 'poison' | 'freeze'
        // ══════════════════════════════════════════════════════════════════
        const ZONE_STYLES = {
            mud: { color: 0x4a3000, opacity: 0.62 },
            poison: { color: 0x9900cc, opacity: 0.58 },
            freeze: { color: 0x99e6ff, opacity: 0.5 },
        };

        function pickStraightPositions(count) {
            const straightPts = [];
            for (let i = 0; i < TOTAL_PTS; i++) {
                if (CORNER_MAP[i] >= CORNER_THRESHOLD) straightPts.push(i / TOTAL_PTS);
            }
            for (let i = straightPts.length - 1; i > 0; i--) {
                const j = Math.floor(seededRandom() * (i + 1));
                [straightPts[i], straightPts[j]] = [straightPts[j], straightPts[i]];
            }
            return straightPts.slice(0, count);
        }

        function buildHazardMesh(t, laneOff, type) {
            const style = ZONE_STYLES[type] || ZONE_STYLES.mud;
            const p = lanePos(t, laneOff);
            const geo = new THREE.PlaneGeometry(2.5, 9.0);
            const mat = new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: style.opacity });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(p.x, 0.12, p.z);
            const [tx, tz] = trackTangent(t);
            mesh.rotation.z = Math.atan2(tx, tz);
            scene.add(mesh);
            hazardMeshes.push(mesh);
        }

        function clearHazardMeshes() {
            hazardMeshes.forEach(m => scene.remove(m));
            hazardMeshes.length = 0;
            hazardZones.length = 0;
        }

        // 泥/毒ゾーン生成（対象車のレーン上に count 箇所配置）。ownerCar/skillId から power(-50%等)を算出。
        function spawnSlowZone(type, ownerCar, skillId, targetCars, count) {
            const power = ownerCar ? skillPower(ownerCar.id, skillId) : 1.0;
            const base = getSkill(skillId).params;
            const positions = pickStraightPositions(count);
            const targetIds = targetCars.map(c => c.id);
            positions.forEach(t => {
                hazardZones.push({
                    type, t, affectedCarIds: targetIds, battTaken: new Set(),
                    slowdown: base.mudSlowdown * power,
                    battDrain: base.battDrain * power,
                });
                targetCars.forEach(car => buildHazardMesh(t, car.laneOff, type));
            });
        }

        // 凍結ゾーン生成（全員のレーンに count 箇所配置）
        function spawnFreezeZone(ownerCar, skillId, targetCars, count) {
            const power = ownerCar ? skillPower(ownerCar.id, skillId) : 1.0;
            const base = getSkill(skillId).params;
            const positions = pickStraightPositions(count);
            const targetIds = targetCars.map(c => c.id);
            positions.forEach(t => {
                hazardZones.push({
                    type: 'freeze', t, affectedCarIds: targetIds, battTaken: new Set(),
                    threshold: base.threshold,
                    speedBonusHigh: base.speedBonusHigh * power,
                    battDrainHigh: base.battDrainHigh * power,
                    speedPenaltyLow: base.speedPenaltyLow * power,
                });
                targetCars.forEach(car => buildHazardMesh(t, car.laneOff, 'freeze'));
            });
        }

        // 毎フレーム呼び出し。ハザードゾーン踏破による速度倍率を返す（バッテリー消費は副作用として実行）。
        function checkHazards(car) {
            let speedMult = 1.0;
            const offroad = carHasSkill(car, 'offroad_tire');
            const offroadPower = offroad ? skillPower(car.id, 'offroad_tire') : 0;
            const offroadParams = offroad ? getSkill('offroad_tire').params : null;
            // offroad_tireの軽減率（メイン/ランダムなら85%/100%軽減、サブなら半分の42.5%/50%軽減）
            const spdReduceFactor = offroad ? (1 - offroadParams.speedReduction * offroadPower) : 1.0;
            const battReduceFactor = offroad ? (1 - offroadParams.battReduction * offroadPower) : 1.0;

            for (const zone of hazardZones) {
                if (!zone.affectedCarIds.includes(car.id)) continue;
                const diff = Math.abs(car.t - zone.t);
                const wrapped = Math.min(diff, 1 - diff);
                if (wrapped >= 0.008) continue;

                const passKey = `${car.id}-${car.lap}-${zone.t.toFixed(4)}`;
                const alreadyDrained = zone.battTaken.has(passKey);

                if (zone.type === 'mud' || zone.type === 'poison') {
                    speedMult *= (1 - zone.slowdown * spdReduceFactor);
                    if (!alreadyDrained) {
                        zone.battTaken.add(passKey);
                        car.battery = Math.max(0, car.battery - zone.battDrain * battReduceFactor);
                        if (offroad) spawnParticles(car, 'red_hit');
                    }
                } else if (zone.type === 'freeze') {
                    if (car.battery >= zone.threshold) {
                        speedMult *= (1 + zone.speedBonusHigh * spdReduceFactor);
                        if (!alreadyDrained) {
                            zone.battTaken.add(passKey);
                            car.battery = Math.max(0, car.battery - zone.battDrainHigh * battReduceFactor);
                            if (offroad) spawnParticles(car, 'red_hit');
                        }
                    } else {
                        speedMult *= (1 - zone.speedPenaltyLow * spdReduceFactor);
                        if (!alreadyDrained) {
                            zone.battTaken.add(passKey);
                            if (offroad) spawnParticles(car, 'red_hit');
                        }
                    }
                }
            }
            return speedMult;
        }

        // ══════════════════════════════════════════════════════════════════
        //  車両物理更新 v2.7 (スキル完全対応)
        // ══════════════════════════════════════════════════════════════════
        const BATT_BASE_DRAIN = 0.032;
        const ECO_BATTERY_THRESHOLD = 12.0;

        // 期限付き速度効果を1件追加する（buff: mult>1 / debuff: mult<1）
        function addTimedEffect(car, mult, durationSec, elapsed) {
            car.skillState.effects.push({ mult, expiresAt: elapsed + durationSec });
        }

        function updateCarPhysics(car, dt, elapsed, rankings) {
            if (car.finished) return;
            const ss = car.skillState;

            // ── ブーストタイマー更新（旧来のboost_lap5/reversal_motor/big_motor用）──
            if (ss.boostTimer > 0) {
                ss.boostTimer -= dt;
                if (ss.boostTimer <= 0) {
                    ss.boostTimer = 0;
                    ss.boostSpeedMult = 1.0;
                    ss.boostDrainMult = 1.0;
                }
            }

            // ── 期限付き効果(新スキル群)の集計・失効処理 ──
            ss.effects = ss.effects.filter(e => e.expiresAt > elapsed);
            let timedEffectMult = 1.0;
            let receivingSlowdownNow = false;
            ss.effects.forEach(e => {
                timedEffectMult *= e.mult;
                if (e.mult < 1.0) receivingSlowdownNow = true;
            });

            // ── ランダムノイズ ──
            car.nTimer -= dt;
            if (car.nTimer <= 0) {
                car.nTimer = 0.18 + seededRandom() * 0.35;
                // 安定タイヤ: 振れ幅激減（サブなら軽減幅も-50%）
                const stablePower = carHasSkill(car, 'stable_tire') ? skillPower(car.id, 'stable_tire') : 0;
                const NORMAL_AMP = 0.00018, STABLE_AMP = 0.00005;
                const amp = carHasSkill(car, 'stable_tire')
                    ? NORMAL_AMP - (NORMAL_AMP - STABLE_AMP) * stablePower
                    : NORMAL_AMP;
                car.nNoise = (seededRandom() - 0.5) * amp;
            }

            // ── コーナー減速 ──
            const onCorner = isCorner(car.t);
            let cornerMult = 1.0;
            if (onCorner) {
                let reduction = 0.15;
                if (carHasSkill(car, 'low_friction')) {
                    const power = skillPower(car.id, 'low_friction');
                    const base = getSkill('low_friction').params.cornerReduction;
                    reduction = 0.15 - (0.15 - base) * power; // サブなら軽減効果も半分
                    spawnParticles(car, 'white');
                }
                cornerMult = 1.0 - reduction;
            }

            // ── ハザードゾーン（泥/毒/凍結）──
            const hazardMult = checkHazards(car);
            if (hazardMult < 1.0) receivingSlowdownNow = true;

            // ── 逆転ブースト: 他車(先頭)に1周以上離されたら発動中は速度+80%(サブ-50%) ──
            let comebackMult = 1.0;
            if (carHasSkill(car, 'comeback_boost') && rankings && rankings.length) {
                const leader = rankings[0];
                const prm = getSkill('comeback_boost').params;
                if (leader.id !== car.id && (leader.lap - car.lap) >= prm.lapGap) {
                    const power = skillPower(car.id, 'comeback_boost');
                    comebackMult = 1 + prm.speedBoost * power;
                    if (Math.random() < 0.15) spawnParticles(car, 'flame');
                }
            }

            // ── ネバーモーター: 速度ダウンを受けたら+18%(サブ-50%)を数秒間付与(クールダウンあり) ──
            if (carHasSkill(car, 'never_motor') && receivingSlowdownNow) {
                if (!ss.neverMotorCooldownUntil || elapsed >= ss.neverMotorCooldownUntil) {
                    const power = skillPower(car.id, 'never_motor');
                    const prm = getSkill('never_motor').params;
                    addTimedEffect(car, 1 + prm.speedBoost * power, prm.duration, elapsed);
                    ss.neverMotorCooldownUntil = elapsed + prm.cooldown;
                    spawnParticles(car, 'flame');
                }
            }

            // ── 魔改造ダイナモギア: バッテリー10%以下で発動、5%/秒回復(サブ-50%)を持続時間中継続 ──
            if (carHasSkill(car, 'dynamo_gear')) {
                const prm = getSkill('dynamo_gear').params;
                if (!ss.dynamoUsed && car.battery <= prm.threshold && car.battery > 0) {
                    ss.dynamoUsed = true;
                    ss.dynamoActiveUntil = elapsed + prm.duration;
                    car.flashBadge('dynamo_gear');
                    addComment(`⚙️ <strong style="color:${car.accentHex}">${car.name}</strong> の魔改造ダイナモギア発動！バッテリーが持続回復し始めた！`, 'boost');
                }
                if (ss.dynamoActiveUntil && elapsed < ss.dynamoActiveUntil) {
                    const power = skillPower(car.id, 'dynamo_gear');
                    car.battery = Math.min(100, car.battery + prm.regenPerSec * 100 * power * dt);
                    if (Math.random() < 0.2) spawnParticles(car, 'green_plus');
                }
            }

            // ── バッテリー状態 ──
            let battSpeedMult = 1.0;
            let battDrainMult = 1.0;
            if (car.battery <= 0) {
                battSpeedMult = 0.78;
                battDrainMult = 0.0;
            } else if (car.battery <= ECO_BATTERY_THRESHOLD && car.typKey === 'EARLY') {
                battSpeedMult = 0.86;
                battDrainMult = 0.40;
            }

            // ── 速度スケール計算 ──
            const spdScale = car.currentSpeedScale();
            // 改造フォルム: 全ラップ+4%(サブ-50%)
            let formBonus = 0;
            if (carHasSkill(car, 'tuned_form')) {
                formBonus = getSkill('tuned_form').params.speedBonus * skillPower(car.id, 'tuned_form');
            }
            // 各種スキル・デバフの乗算
            const finalSpeed = Math.max(0.0004,
                (car.baseSpd * (spdScale + formBonus) + car.nNoise)
                * cornerMult
                * hazardMult
                * battSpeedMult
                * ss.boostSpeedMult
                * ss.externalSpeedDebuff
                * ss.externalSpeedBuff
                * timedEffectMult
                * comebackMult
            );
            car.speed = finalSpeed;

            // ── バッテリー消費 ──
            const consumeRate = BATT_BASE_DRAIN * car.currentBattScale() * battDrainMult * ss.boostDrainMult;
            if (car.battery > 0) {
                car.battery = Math.max(0, car.battery - consumeRate * dt * 60);
            }

            // ── 毎フレームスキルチェック ──
            checkFrameSkills(car, rankings, elapsed);

            // ── 安定タイヤ: ピンクトレイル ──
            if (carHasSkill(car, 'stable_tire')) {
                car.trail.pts.material.color.setHex(0xff88cc);
            }

            car.t += car.speed;

            if (car.t >= 1.0) {
                car.t -= 1.0; car.lap++;
                const lt = elapsed - car.lapStart;
                if (lt < car.bestLap) car.bestLap = lt;
                car.lapStart = elapsed;
                onLapCross(car, rankings, elapsed);   // ラップ通過スキルチェック
                if (car.lap >= TOTAL_LAPS) {
                    car.finished = true; car.lap = TOTAL_LAPS;
                    if (!winner) { winner = car; onFinish(); }
                }
            }

            car.updatePosition();
            car.wRot += car.speed * 130;
            car.mesh.userData.wheelRefs.forEach(w => { w.rotation.x = car.wRot; });
        }
