// ══════════════════════════════════════════════════════════════════
//  game.js ── レースロジック（本体オーケストレーター）
//  ・RaceCarクラス、プレイヤー/賭けシステム、レース状態遷移（開始・カウントダウン・
//    終了判定）、メインループ(animate)を担当。他の全モジュールを束ねる最上位ファイル。
//  ・依存: data.js, course.js, car_view.js, rode_view.js, physics.js, skills.js,
//         particle.js, commentary.js のすべて（読み込み順序はこの並びを想定）。
// ══════════════════════════════════════════════════════════════════
'use strict';

        // ══════════════════════════════════════════════════════════════════
        //  RaceCar クラス（1台分のレース状態・見た目・HUDバインディングを保持する本体）
        // ══════════════════════════════════════════════════════════════════
        class RaceCar {
            constructor(cfg, index) {
                this.id = cfg.id;
                this.name = cfg.name;
                this.laneOff = cfg.laneOff;
                this.baseSpd = cfg.baseSpd;
                this.accentHex = '#' + cfg.accentCol.toString(16).padStart(6, '0');
                this.typKey = cfg.type;
                this.typDef = CAR_TYPES[cfg.type];

                this.mesh = buildCarMesh(cfg.bodyCol, cfg.accentCol, cfg.stripeCol, this.typDef.pattern, cfg.markCol != null ? cfg.markCol : this.typDef.markCol);
                scene.add(this.mesh);
                this.trail = makeTrailMesh(cfg.trailCol);

                // 自分の車体（プレイヤー1 = THUNDER）の上に矢印を浮かべる
                this.ownIndicator = null;
                if (cfg.id === PLAYER_CAR_ID) {
                    this.ownIndicator = buildOwnIndicator();
                    this.mesh.add(this.ownIndicator);
                }

                this.t = 0;
                this.lap = 0;
                this.finished = false;
                this.lapStart = 0;
                this.bestLap = Infinity;
                this.speed = 0;
                this.nTimer = 0;
                this.nNoise = 0;
                this.wRot = 0;

                this.battery = 100.0;

                // ── スキル状態 ──
                this.skillState = createInitialSkillState();

                this.createHUDElement(index);
            }

            lapIndex() { return Math.min(this.lap, TOTAL_LAPS - 1); }
            currentSpeedScale() { return this.typDef.speedScale[this.lapIndex()]; }
            currentBattScale() { return this.typDef.batteryScale[this.lapIndex()]; }

            createHUDElement(index) {
                const targetContainer = document.getElementById('hud-rankings');

                const typDef = this.typDef;
                const panel = document.createElement('div');
                panel.className = 'car-panel' + (this.id === PLAYER_CAR_ID ? ' own-car' : '');
                panel.id = `panel-${this.id}`;
                panel.style.borderColor = this.accentHex + '60';
                panel.innerHTML = `
                    <div class="car-name" style="color:${this.accentHex}">${this.id === PLAYER_CAR_ID ? '<span class="own-car-arrow">▼YOU</span>' : ''}<span class="rank-badge" id="rank-${this.id}">-</span>${this.id} · ${this.name}</div>
                    <div class="car-tags-row">
                        <span class="car-type-badge" style="background:${typDef.color}22;color:${typDef.color};border:1px solid ${typDef.color}55">${typDef.label}</span>
                    </div>
                    <div class="skill-line1" id="skill-line1-${this.id}"></div>
                    <div class="skill-line2" id="skill-line2-${this.id}"></div>
                    <div class="stat-row"><span class="stat-label">LAP</span><span class="stat-value" id="lap-${this.id}">0 / 5</span></div>
                    <div class="stat-row"><span class="stat-label">TIME</span><span class="stat-value" id="time-${this.id}">--.-</span></div>
                    <div class="stat-row"><span class="stat-label">BEST</span><span class="stat-value" id="best-${this.id}">--.-</span></div>
                    <div class="lap-bar"><div class="lap-fill" id="prog-${this.id}" style="background:${this.accentHex}"></div></div>
                    <div class="battery-bar-wrap">
                        <span class="battery-icon">🔋</span>
                        <div class="battery-bar"><div class="battery-fill" id="batt-${this.id}" style="width:100%;background:#00ff88"></div></div>
                        <span class="battery-pct" id="batt-pct-${this.id}">100%</span>
                    </div>
                `;
                targetContainer.appendChild(panel);

                const gauge = document.createElement('div');
                gauge.className = 'speed-gauge';
                gauge.innerHTML = `
                    <div>${this.name}</div>
                    <div class="speed-bar"><div class="speed-fill" id="spd-${this.id}" style="background:${this.accentHex}"></div></div>
                `;
                document.getElementById('speed-indicator').appendChild(gauge);

                this.domPanel = panel;
                this.domRank = document.getElementById(`rank-${this.id}`);
                this.domLap = document.getElementById(`lap-${this.id}`);
                this.domTime = document.getElementById(`time-${this.id}`);
                this.domBest = document.getElementById(`best-${this.id}`);
                this.domProg = document.getElementById(`prog-${this.id}`);
                this.domSpd = document.getElementById(`spd-${this.id}`);
                this.domBatt = document.getElementById(`batt-${this.id}`);
                this.domBattP = document.getElementById(`batt-pct-${this.id}`);
                this.domSkillLine1 = document.getElementById(`skill-line1-${this.id}`);
                this.domSkillLine2 = document.getElementById(`skill-line2-${this.id}`);
            }

            // revealed=false : メインスキルのみ表示、サブ・ランダムは「???」
            // revealed=true  : サブ・ランダムスキルも公開（レース開始時に判明する仕様）
            updateSkillBadges(revealed = false) {
                if (!this.domSkillLine1 || !this.domSkillLine2) return;
                const cfg = CAR_CONFIGS.find(c => c.id === this.id);
                if (!cfg) return;

                // ── 1行目: メインスキル(常時公開) + サブスキル×2(レース開始で公開) ──
                let line1 = '';
                if (cfg.mainSkill) {
                    const sk = getSkill(cfg.mainSkill);
                    if (sk) line1 += `<span class="skill-badge role-main" id="badge-${this.id}-${sk.id}" title="★メイン: ${sk.effect}">★${sk.name}</span>`;
                }
                (cfg.subSkills || []).forEach(id => {
                    if (revealed) {
                        const sk = getSkill(id);
                        if (sk) line1 += `<span class="skill-badge role-sub" id="badge-${this.id}-${sk.id}" title="▽サブ(効果-50%): ${sk.effect}">▽${sk.name}</span>`;
                    } else {
                        line1 += `<span class="skill-badge sub-hidden">▽???</span>`;
                    }
                });
                this.domSkillLine1.innerHTML = line1;

                // ── 2行目: ランダムスキル×2(レース開始で公開) ──
                let line2 = '';
                (cfg.randomSkills || []).forEach(id => {
                    if (revealed && id) {
                        const sk = getSkill(id);
                        if (sk) line2 += `<span class="skill-badge role-random" id="badge-${this.id}-${sk.id}" title="🎲ランダム: ${sk.effect}">🎲${sk.name}</span>`;
                    } else {
                        line2 += `<span class="skill-badge random-hidden">🎲???</span>`;
                    }
                });
                this.domSkillLine2.innerHTML = line2;
            }

            flashBadge(skillId) {
                const el = document.getElementById(`badge-${this.id}-${skillId}`);
                if (!el) return;
                el.classList.add('triggered');
                setTimeout(() => el.classList.remove('triggered'), 900);
            }

            resetSkillState() {
                this.skillState = createInitialSkillState();
            }

            reset() {
                this.t = 0; this.lap = 0; this.finished = false;
                this.lapStart = 0; this.bestLap = Infinity;
                this.speed = 0; this.nTimer = 0; this.nNoise = 0; this.wRot = 0;
                this.battery = 100.0;
                this.trail.hist.length = 0;
                this.resetSkillState();
                this.updateHUD(0, 'idle');
            }

            updatePosition() {
                const p = lanePos(this.t, this.laneOff);
                this.mesh.position.copy(p);
                this.mesh.rotation.y = carYaw(this.t);
            }

            updateTrailPoints() {
                const p = lanePos(this.t, this.laneOff);
                this.trail.hist.unshift({ x: p.x, y: p.y - 0.07, z: p.z });
                if (this.trail.hist.length > TRAIL_N) this.trail.hist.pop();
                for (let i = 0; i < TRAIL_N; i++) {
                    const h = this.trail.hist[i] || this.trail.hist[0] || { x: p.x, y: p.y, z: p.z };
                    this.trail.pos[i * 3] = h.x;
                    this.trail.pos[i * 3 + 1] = h.y;
                    this.trail.pos[i * 3 + 2] = h.z;
                }
                this.trail.geo.attributes.position.needsUpdate = true;
            }

            updateHUD(elapsed, raceState) {
                const totalT = this.lap + this.t;
                // this.lap は内部的に0始まり（lap=0は「1周目を走行中」を意味する）。
                // そのまま表示すると実際の周回より1少なく見えるバグがあったため、表示用に+1する。
                // ゴール後（finished）はTOTAL_LAPSちょうどを表示する。
                const displayLap = this.finished ? TOTAL_LAPS : Math.min(this.lap + 1, TOTAL_LAPS);
                this.domLap.textContent = displayLap + ' / ' + TOTAL_LAPS;

                if (raceState === 'racing' || raceState === 'finished') {
                    this.domTime.textContent = (elapsed - this.lapStart).toFixed(2) + 's';
                } else {
                    this.domTime.textContent = '--.-';
                }

                this.domBest.textContent = this.bestLap < Infinity ? this.bestLap.toFixed(2) + 's' : '--.-';
                this.domProg.style.width = Math.min((totalT / TOTAL_LAPS) * 100, 100) + '%';

                const maxEstSpd = 0.0026;
                this.domSpd.style.width = Math.min((this.speed / maxEstSpd) * 100, 100) + '%';

                const bpct = Math.max(0, this.battery);
                this.domBatt.style.width = bpct + '%';
                this.domBattP.textContent = Math.ceil(bpct) + '%';

                // バッテリーゲージのカラーリング（EARLYのみ10%以下でエコカラーに変化）
                if (bpct > 40) {
                    this.domBatt.style.background = '#00ff88';
                } else if (bpct > 20) {
                    this.domBatt.style.background = '#ffaa00';
                } else if (bpct > 10) {
                    this.domBatt.style.background = '#ff3333';
                } else {
                    this.domBatt.style.background = this.typKey === 'EARLY' ? '#00ccff' : '#ff3333';
                }
            }
        }

        const CARS = CAR_CONFIGS.map((cfg, i) => new RaceCar(cfg, i));
        let playerCarRef = CARS.find(c => c.id === PLAYER_CAR_ID);

        // ── プレイヤー・賭けシステム（PLAYERS等のマスターデータは data.js） ──
        function playerColor(carId) {
            const cfg = CAR_CONFIGS.find(c => c.id === carId);
            return cfg ? '#' + cfg.accentCol.toString(16).padStart(6, '0') : '#888888';
        }

        function getPlayerByCarId(carId) {
            return PLAYERS.find(p => p.carId === carId) || null;
        }

        // プレイヤーリストDOMを構築（賭け金入力欄はプレイヤー1のみ操作可能）
        function buildPlayerListDOM() {
            const body = document.getElementById('player-list-body');
            if (!body) return;
            body.innerHTML = '';
            PLAYERS.forEach(p => {
                const col = playerColor(p.carId);
                const row = document.createElement('div');
                row.className = 'player-row' + (p.isUser ? ' own-player' : '');
                row.id = `player-row-${p.id}`;
                row.innerHTML = `
                    <div class="player-name" style="color:${col}">${p.isUser ? '<span class="own-arrow">▶</span>' : ''}${p.name}</div>
                    <div class="player-rate" id="pl-rate-${p.id}">${p.rate}</div>
                    <div class="player-wins" id="pl-wins-${p.id}">${p.wins}</div>
                    <div class="player-bet">${p.isUser
                        ? `<input type="number" id="bet-input-${p.id}" min="0" max="1000" step="10" value="${p.bet}">`
                        : `<span id="pl-bet-${p.id}">${p.bet}</span>`}</div>
                `;
                body.appendChild(row);
            });

            const userPlayer = PLAYERS.find(p => p.isUser);
            if (!userPlayer) return; // 初期ロード時点ではPLAYERSが空（race_room.js がroom_state受信後に再構築する）
            const betInput = document.getElementById(`bet-input-${userPlayer.id}`);
            if (betInput) {
                const commitBet = () => {
                    let v = parseInt(betInput.value, 10);
                    if (isNaN(v)) v = 0;
                    v = Math.max(0, Math.min(1000, v));
                    betInput.value = v;
                    userPlayer.bet = v;
                };
                betInput.addEventListener('change', commitBet);
                betInput.addEventListener('blur', commitBet);
            }
        }

        // レース中は賭け金の変更をロックする
        function setBetInputsLocked(locked) {
            PLAYERS.forEach(p => {
                if (!p.isUser) return;
                const el = document.getElementById(`bet-input-${p.id}`);
                if (el) el.disabled = locked;
            });
        }

        // レート・勝利数表示を最新の値で更新
        function renderPlayerStats() {
            PLAYERS.forEach(p => {
                const rEl = document.getElementById(`pl-rate-${p.id}`);
                const wEl = document.getElementById(`pl-wins-${p.id}`);
                if (rEl) rEl.textContent = p.rate;
                if (wEl) wEl.textContent = p.wins;
            });
        }

        // レース結果に基づき、レート変動と賭け金の払い戻しを計算・反映する
        function settleBetsAndRates(rankings) {
            const totalPot = PLAYERS.reduce((s, p) => s + p.bet, 0);
            const feeAmount = Math.round(totalPot * 0.10);
            let txt = `💰 レース精算 合計賭け金: ${totalPot}<br>`;

            rankings.forEach((car, i) => {
                const player = getPlayerByCarId(car.id);
                if (!player) return;
                const delta = RATE_DELTA_BY_RANK[i] || 0;
                player.rate = Math.max(0, player.rate + delta);
                if (i === 0) player.wins += 1;
                const payout = Math.floor(totalPot * (PAYOUT_RATIO_BY_RANK[i] || 0));
                const sign = delta >= 0 ? '+' : '';
                const rateCls = delta > 0 ? 'rate-up' : (delta < 0 ? 'rate-down' : '');
                const rateEl = document.getElementById(`pl-rate-${player.id}`);
                if (rateEl) {
                    rateEl.classList.remove('rate-up', 'rate-down');
                    if (rateCls) rateEl.classList.add(rateCls);
                }
                txt += `&nbsp;&nbsp;${i + 1}位 <strong style="color:${car.accentHex}">${player.name}</strong>：レート${sign}${delta}（→${player.rate}） / 払戻 ${payout}${payout > 0 ? '💴' : ''}<br>`;
            });

            renderPlayerStats();
            addComment(txt, 'finish');
        }
        // ── レース状態管理 ──
        let raceState = 'idle';
        let raceTime = 0;
        let cdTimer = 0;
        let winner = null;
        let lastCDVal = 3;

        const elStatus = document.getElementById('race-status');
        const elFinish = document.getElementById('finish-banner');
        const elFWin = document.getElementById('finish-winner-name');
        const elFTime = document.getElementById('finish-time');
        const elCD = document.getElementById('countdown-overlay');
        const elCDNum = document.getElementById('countdown-num');
        const elStart = document.getElementById('startBtn');
        const elReset = document.getElementById('resetBtn');

        function initPos() {
            CARS.forEach(car => { car.reset(); car.updatePosition(); });
            camCur.pos.set(0, 18, -75);
            camCur.look.set(0, 0, -44);
            camCur.shot = null;
        }

        function resetRace() {
            raceState = 'idle'; raceTime = 0; cdTimer = 0; winner = null; lastCDVal = 3;
            Object.assign(commFlags, { lap3Announced: false, lap4BoostAnnounced: new Set(), battWarnDone: new Set(), battEcoDone: new Set() });
            clearHazardMeshes();
            clearRandomSkills();
            particles.length = 0;
            CARS.forEach(car => { car.reset(); car.updateSkillBadges(false); });
            initPos();
            lastRankOrder = ''; // 強制的に並び替えさせる
            updateHUDRankOrder(getRankings());
            elStart.disabled = false; elStart.textContent = 'START';
            elFinish.classList.remove('visible'); elCD.classList.remove('visible');
            elStatus.textContent = 'READY';
            camera.position.set(0, 135, 25);
            camera.lookAt(0, 0, 0);
            setBetInputsLocked(false);
        }

        // ── ヘッダーボタンの配線は race_room.js（改修要件3のロビー統合ブリッジ）が行う。
        //    #resetBtn / #rankingBtn は撤去済み、#boardBtn はAJAXポップアップに、
        //    #startBtn は「準備完了/レース開始」ボタンとして再利用される。
        //    doActualStartRace() / resetRace() 自体はここでは呼び出さず、
        //    race_room.js からサーバーの合図(race_starting等)に応じて呼び出す。

        function doActualStartRace() {
            raceState = 'countdown'; cdTimer = 0; lastCDVal = 3;
            elStart.disabled = true; elCD.classList.add('visible');
            elCDNum.textContent = '3'; elCDNum.style.color = '#ff3333';
            elCDNum.style.textShadow = '0 0 40px #ff333388'; elCDNum.style.fontSize = '110px';

            // 賭け金確定＆入力ロック
            setBetInputsLocked(true);
            const totalPot = PLAYERS.reduce((s, p) => s + p.bet, 0);
            let betTxt = `💴 賭け金確定（合計 ${totalPot}）：`;
            PLAYERS.forEach(p => { betTxt += `${p.name}=${p.bet} `; });
            addComment(betTxt, 'system');

            // ランダムスキル抽選（この時点ではHUDは「???」のまま）
            assignRandomSkills();

            // スキルバッジ更新（未公開モード）
            CARS.forEach(car => car.updateSkillBadges(false));

            // レース開始時(race_start)発動スキルを一括処理
            triggerRaceStartSkills();
        }

        // ── race_start トリガー系スキルをまとめて発動 ──
        function triggerRaceStartSkills() {
            CARS.forEach(car => {
                const carName = `<strong style="color:${car.accentHex}">${car.name}</strong>`;

                if (carHasSkill(car, 'mud_trap')) {
                    const prm = getSkill('mud_trap').params;
                    spawnSlowZone('mud', car, 'mud_trap', CARS.filter(c => c.id !== car.id), prm.mudCount);
                    addComment(`🟤 ${carName} がイカサマ重馬場を仕込んだ！他車の直線に泥ゾーンが出現！`, 'warning');
                }

                if (carHasSkill(car, 'poison_chihuahua')) {
                    spawnSlowZone('poison', car, 'poison_chihuahua', CARS.filter(c => c.id !== car.id), 1);
                    addComment(`🐕 ${carName} の毒チワワレーサーが発動！他車のコースに毒ゾーンが出現！`, 'warning');
                }

                if (carHasSkill(car, 'freeze_spray')) {
                    const prm = getSkill('freeze_spray').params;
                    spawnFreezeZone(car, 'freeze_spray', CARS, prm.zoneCount);
                    addComment(`❄️ ${carName} の路面凍結スプレーが発動！全車のコースに凍結ゾーンが出現！`, 'warning');
                }

                if (carHasSkill(car, 'forced_overclock')) {
                    const power = skillPower(car.id, 'forced_overclock');
                    const prm = getSkill('forced_overclock').params;
                    CARS.forEach(target => {
                        if (target.id === car.id) return;
                        target.skillState.externalSpeedBuff *= (1 + prm.targetSpeedBuff * power);
                        target.battery = Math.max(0, target.battery - prm.targetBattDrain * power);
                        spawnParticles(target, 'smoke');
                    });
                    car.flashBadge('forced_overclock');
                    addComment(`⚙️ ${carName} の強制オーバークロック発動！他車全員が速度上昇と引き換えにバッテリーを消耗！`, 'warning');
                }
            });
        }
        function onFinish() {
            raceState = 'finished';
            elFWin.textContent = winner.name;
            elFWin.style.color = winner.accentHex;
            elFWin.style.textShadow = `0 0 28px ${winner.accentHex}80`;
            elFTime.textContent = 'RACE TIME : ' + raceTime.toFixed(2) + 's';
            elFTime.style.color = winner.accentHex;
            elFinish.classList.add('visible');
            elStart.disabled = false; elStart.textContent = 'START';
            elStatus.textContent = 'FINISHED';
            addComment(`🏆 レース終了！優勝: <strong style="color:${winner.accentHex}">${winner.name}</strong> (${raceTime.toFixed(2)}s)`, 'finish');

            const rankings = getRankings();
            let txt = '最終順位:<br>';
            rankings.forEach((c, i) => {
                txt += `&nbsp;&nbsp;${i + 1}位: <strong style="color:${c.accentHex}">${c.name}</strong><br>`;
            });
            addComment(txt, 'finish');

            // 賭け金の払い戻し・レート変動を精算し、次レースに向けて入力欄をアンロック
            settleBetsAndRates(rankings);
            setBetInputsLocked(false);
        }
        function updateCountdown(dt) {
            cdTimer += dt;
            if (cdTimer >= 3.3) {
                elCD.classList.remove('visible'); raceState = 'racing'; raceTime = 0;
                CARS.forEach(car => car.lapStart = 0);
                elStatus.textContent = 'RACING';

                // ── サブスキル・ランダムスキル公開（レース開始と同時に判明する仕様）──
                CARS.forEach(car => car.updateSkillBadges(true));
                let revealMsg = '🔓 サブ・ランダムスキル判明！<br>';
                CARS.forEach(car => {
                    const cfg = CAR_CONFIGS.find(c => c.id === car.id);
                    if (!cfg) return;
                    const subNames = (cfg.subSkills || []).map(id => { const s = getSkill(id); return s ? s.name : id; }).join('・');
                    const randNames = (cfg.randomSkills || []).map(id => { const s = getSkill(id); return s ? s.name : id; }).join('・');
                    revealMsg += `&nbsp;&nbsp;<strong style="color:${car.accentHex}">${car.name}</strong>：▽${subNames} / 🎲${randNames}<br>`;
                });
                addComment(revealMsg, 'boost');

                addComment('🚦 レーススタート！全車一斉に走り出した！', 'system');
                return;
            }
            if (cdTimer >= 2.7) {
                if (lastCDVal !== 0) {
                    lastCDVal = 0; elCDNum.textContent = 'GO!'; elCDNum.style.color = '#ffdd00';
                    elCDNum.style.textShadow = '0 0 40px #ffdd00bb'; elCDNum.style.fontSize = '76px'; elCDNum.style.letterSpacing = '10px';
                }
            } else {
                const v = Math.ceil(3 - cdTimer);
                if (v !== lastCDVal && v >= 1) {
                    lastCDVal = v;
                    const c = ['', '#ff3333', '#ffaa00', '#00ff88'][v];
                    elCDNum.style.color = c; elCDNum.style.textShadow = `0 0 40px ${c}99`;
                    elCDNum.textContent = v; elCDNum.style.animation = 'none';
                    void elCDNum.offsetWidth; elCDNum.style.animation = 'cpulse 0.65s ease';
                }
            }
        }

        let cornerIndicatorTimer = 0;
        const cornerEl = document.getElementById('corner-indicator');
        function updateCornerIndicator(anyCorner, dt) {
            if (anyCorner) {
                cornerEl.style.opacity = '0.7';
                cornerIndicatorTimer = 0.5;
            } else {
                cornerIndicatorTimer -= dt;
                if (cornerIndicatorTimer <= 0) cornerEl.style.opacity = '0';
            }
        }
        let lastTS = null;

        function animate(ts) {
            requestAnimationFrame(animate);
            if (lastTS === null) lastTS = ts;
            const dt = Math.min((ts - lastTS) / 1000, 0.05);
            lastTS = ts;

            if (raceState === 'countdown') updateCountdown(dt);

            if (raceState === 'racing') {
                raceTime += dt;

                let anyCorner = false;

                // 順位は毎フレーム先に計算してスキル判定に使う
                const rankings = getRankings();

                CARS.forEach(car => {
                    updateCarPhysics(car, dt, raceTime, rankings);
                    car.updateTrailPoints();
                    car.updateHUD(raceTime, raceState);
                    if (isCorner(car.t)) anyCorner = true;
                });

                updateCamera(rankings);
                updateHUDRankOrder(rankings);
                updateCornerIndicator(anyCorner, dt);
                updateParticles(dt);
                checkCommentary(raceTime);

                if (CARS.every(car => car.finished) && raceState !== 'finished') {
                    raceState = 'finished';
                }
            } else if (raceState === 'idle') {
                const a = ts * 0.00007;
                camera.position.set(Math.sin(a) * 112, 90, Math.cos(a) * 82);
                camera.lookAt(0, 0, 0);
            }

            // 自分の車体の矢印を上下にふわふわ浮遊させる
            if (playerCarRef && playerCarRef.ownIndicator) {
                const ind = playerCarRef.ownIndicator;
                ind.position.y = ind.userData.baseY + Math.sin(ts * 0.004) * 0.15;
                ind.rotation.y += 0.03;
            }

            renderer.render(scene, camera);
        }

        buildPlayerListDOM();
        renderPlayerStats();

        resetRace();
        animate(0);
