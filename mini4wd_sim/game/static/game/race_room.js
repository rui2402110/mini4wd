// ══════════════════════════════════════════════════════════════════
//  race_room.js ── ロビー統合ブリッジ（改修要件1〜3）
//  ・room_consumer(ws/room/...)へ常時接続し、入退室・準備完了・Bot・賭け金・
//    チャットを管理する（ロビー画面は廃止し、すべてrace.html内で完結させる）。
//  ・race_starting を受け取ったら race_consumer(ws/race/...) へ接続し、
//    race_setup(最終確定した車体構成・race_seed)を受け取った時点で
//    doActualStartRace() を呼び出してレースを開始する。
//  ・待機中も room_state の car_configs を使って rebuildCars() を呼び、
//    コース上に各メンバー/Botの使用中車体を並べて表示する。
//  ・game.js の後に読み込むこと（RaceCar/CARS/CAR_CONFIGS/PLAYERS/scene/
//    doActualStartRace/resetRace/buildPlayerListDOM/renderPlayerStats/
//    updateHUDRankOrder/getRankings/addComment はすべて素のグローバル識別子
//    として参照できる。クラシックscriptは同一の字句スコープを共有するため）。
// ══════════════════════════════════════════════════════════════════
'use strict';

(function () {
    const ROOM_ID = window.__ROOM_ID__;
    const MY_USER_ID = window.__MY_USER_ID__;
    const MY_USER_NAME = window.__MY_USER_NAME__;
    if (!ROOM_ID) return;

    let isHost = !!window.__IS_HOST__;
    let iAmReady = false;
    let raceStarted = false;
    let lastCarConfigs = null; // 差分検知用（同じ内容ならrebuildCarsを呼ばない）
    let lastMemberKey = '';
    let latestRoomState = null; // レース終了後5秒遅延リセット時に使う直近のroom_state

    const LANE_OFFSETS = [3.6, -1.2, 1.2, -3.6];

    function hexToInt(hex, fallback) {
        if (typeof hex === 'number') return hex;
        if (typeof hex !== 'string') return fallback;
        return parseInt(hex.replace('#', ''), 16) || fallback;
    }

    function getCookie(name) {
        const m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
        return m ? decodeURIComponent(m[1]) : null;
    }
    const CSRF_TOKEN = getCookie('csrftoken');

    // ══════════════════════════════════════════════════════════════
    //  CARS / PLAYERS の再構築（コース上への車体スポーン。改修要件3）
    // ══════════════════════════════════════════════════════════════
    function configsKey(carConfigs) {
        // 改修要件1: participant_idだけでなく色・スキル・タイプも含めることで、
        // 同じメンバー構成のままカスタム(プリセット切替)された場合も
        // 確実にrebuildCarsが走るようにする。
        return JSON.stringify((carConfigs || []).map(c => [
            c.participant_id, c.car_name, c.color_1, c.color_2, c.color_3,
            c.main_skill, c.sub_skill_1, c.sub_skill_2, c.car_type,
        ]));
    }

    function toRaceCarConfigs(rawConfigs, myParticipantId) {
        return rawConfigs.map((c, i) => ({
            id: i + 1,
            name: c.car_name || c.display_name || `CAR${i + 1}`,
            bodyCol: hexToInt(c.color_1, 0x888888),
            accentCol: hexToInt(c.color_2, 0xffffff),
            stripeCol: hexToInt(c.color_3, 0xdddddd),
            laneOff: LANE_OFFSETS[i] !== undefined ? LANE_OFFSETS[i] : 0,
            baseSpd: 0.002200,
            trailCol: hexToInt(c.color_2, 0xffffff),
            type: c.car_type || 'STEADY',
            markCol: null,
            mainSkill: c.main_skill || null,
            subSkills: [c.sub_skill_1, c.sub_skill_2].filter(Boolean),
            randomSkills: [null, null],
            participantId: c.participant_id,
            displayName: c.display_name || c.car_name,
            isBot: !!c.is_bot,
            rate: (c.rate !== undefined && c.rate !== null) ? c.rate : null,
        }));
    }

    function clearSceneCars() {
        if (typeof CARS === 'undefined') return;
        CARS.forEach(car => {
            if (car.mesh) scene.remove(car.mesh);
            if (car.trail && car.trail.pts) scene.remove(car.trail.pts);
        });
        const hud = document.getElementById('hud-rankings');
        if (hud) hud.innerHTML = '';
        const speedInd = document.getElementById('speed-indicator');
        if (speedInd) speedInd.innerHTML = '';
        CARS.length = 0;
    }

    function rebuildCars(rawConfigs, bets, interactive) {
        if (typeof RaceCar === 'undefined' || typeof CARS === 'undefined') return;
        if (interactive === undefined) interactive = true;

        const newConfigs = toRaceCarConfigs(rawConfigs, MY_USER_ID);
        clearSceneCars();

        CAR_CONFIGS.length = 0;
        newConfigs.forEach(c => CAR_CONFIGS.push(c));

        const myCfg = newConfigs.find(c => c.participantId === MY_USER_ID);
        PLAYER_CAR_ID = myCfg ? myCfg.id : (newConfigs[0] ? newConfigs[0].id : null);

        newConfigs.forEach((cfg, i) => CARS.push(new RaceCar(cfg, i)));
        if (typeof playerCarRef !== 'undefined') {
            playerCarRef = CARS.find(c => c.id === PLAYER_CAR_ID);
        }

        // 改修要件4: 新規生成した車体はコンストラクタ時点ではmesh.positionが
        // 未設定（原点=画面中央付近）のままなので、initPos()でコースのスタート
        // 地点(t=0のlanePos)へ明示的に配置する。
        if (typeof initPos === 'function') initPos();

        PLAYERS.length = 0;
        newConfigs.forEach(c => {
            PLAYERS.push({
                id: c.id,
                carId: c.id,
                participantId: c.participantId,
                name: c.isBot ? `${c.name} (BOT)` : c.name,
                rate: (c.rate !== null && c.rate !== undefined) ? c.rate : '-',
                wins: 0,
                bet: (bets && bets[String(c.participantId)]) || 100,
                isUser: c.participantId === MY_USER_ID,
            });
        });

        if (typeof buildPlayerListDOM === 'function') buildPlayerListDOM();
        if (typeof renderPlayerStats === 'function') renderPlayerStats();
        attachBetSync();

        if (typeof updateHUDRankOrder === 'function' && typeof getRankings === 'function') {
            updateHUDRankOrder(getRankings());
        }

        if (!interactive) return; // 改修要件6: レース中はBot追加/削除UIを一切出さない

        // Botの車体パネルにホスト専用の削除ボタンを付与
        if (isHost) {
            newConfigs.forEach(c => {
                if (!c.isBot) return;
                const panel = document.getElementById(`panel-${c.id}`);
                if (!panel || panel.querySelector('.bot-remove-btn')) return;
                const btn = document.createElement('button');
                btn.className = 'bot-remove-btn';
                btn.textContent = '× Bot削除';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    sendRoom('remove_bot', { bot_id: c.participantId });
                });
                panel.appendChild(btn);
            });
        }

        renderEmptySlots(newConfigs.length);
    }

    // 空き枠に「Bot追加」ボタンを表示する（改修要件3: メンバー一覧にBot追加ボタン）
    function renderEmptySlots(currentCount) {
        const hud = document.getElementById('hud-rankings');
        if (!hud) return;
        const remaining = 4 - currentCount;
        for (let i = 0; i < remaining; i++) {
            const slot = document.createElement('div');
            slot.className = 'car-panel empty-slot';
            if (isHost) {
                slot.innerHTML = `<button class="add-bot-btn"><i class="fa-solid fa-robot"></i> + Bot追加</button>`;
                slot.querySelector('.add-bot-btn').addEventListener('click', () => sendRoom('add_bot', {}));
            } else {
                slot.innerHTML = `<span class="empty-slot-label">空き枠</span>`;
            }
            hud.appendChild(slot);
        }
    }

    // 賭け金入力の変更をサーバーへ同期する（デモ同様、数値入力方式。改修要件3）
    function attachBetSync() {
        const me = PLAYERS.find(p => p.isUser);
        if (!me) return;
        const el = document.getElementById(`bet-input-${me.id}`);
        if (!el || el.dataset.roomSyncAttached) return;
        el.dataset.roomSyncAttached = '1';
        const commit = () => {
            let v = parseInt(el.value, 10);
            if (isNaN(v)) v = 100;
            v = Math.max(100, Math.min(1000, v));
            el.value = v;
            sendRoom('place_bet', { amount: v });
        };
        el.addEventListener('change', commit);
        el.addEventListener('blur', commit);
    }

    // ══════════════════════════════════════════════════════════════
    //  準備完了 / レース開始ボタン（改修要件3: リセットボタンの位置に配置）
    // ══════════════════════════════════════════════════════════════
    const readyStartBtn = document.getElementById('startBtn');

    function updateReadyStartButton(state) {
        if (!readyStartBtn || raceStarted) return;
        readyStartBtn.disabled = false;
        if (isHost) {
            readyStartBtn.innerHTML = 'レース開始 <i class="fa-solid fa-play"></i>';
            readyStartBtn.classList.add('host-start');
        } else {
            iAmReady = !!(state.ready_map && state.ready_map[String(MY_USER_ID)]);
            readyStartBtn.innerHTML = iAmReady ? '準備完了 <i class="fa-solid fa-check" style="color:#00ff88"></i>' : '準備完了にする';
            readyStartBtn.classList.toggle('is-ready', iAmReady);
        }
    }

    if (readyStartBtn) {
        readyStartBtn.addEventListener('click', () => {
            if (raceStarted) return;
            if (isHost) {
                sendRoom('request_start', {});
            } else {
                iAmReady = !iAmReady;
                sendRoom('ready_toggle', { ready: iAmReady });
            }
        });
    }

    // ══════════════════════════════════════════════════════════════
    //  カスタムボタン（改修要件3: AJAXでプリセット1〜5のポップアップ）
    // ══════════════════════════════════════════════════════════════
    function openPresetPopup() {
        fetch('/garage/api/presets/')
            .then(r => r.json())
            .then(data => showPresetPopup(data))
            .catch(() => showToast('プリセットの取得に失敗しました。', 'error'));
    }

    function showPresetPopup(data) {
        const overlay = document.createElement('div');
        overlay.id = 'racePresetOverlay';
        const unlocked = data.unlocked || [1, 2, 3, 4];
        let itemsHtml = '';
        for (let n = 1; n <= 5; n++) {
            const car = data.presets ? data.presets[n] : null;
            const locked = !unlocked.includes(n);
            itemsHtml += `
                <button class="preset-pick-btn${locked ? ' locked' : ''}${car ? ' filled' : ''}" data-n="${n}" ${locked || !car ? 'disabled' : ''}>
                    <div class="pn">PRESET ${n}</div>
                    <div class="pname">${car ? car.car_name : (locked ? 'ロック中' : '未登録')}</div>
                </button>`;
        }
        overlay.innerHTML = `
            <div id="racePresetModal">
                <h3>使用する車体を選択</h3>
                <div id="racePresetGrid">${itemsHtml}</div>
                <button class="btn alt" id="racePresetClose">閉じる</button>
            </div>`;
        document.body.appendChild(overlay);

        overlay.querySelectorAll('.preset-pick-btn:not(:disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                const n = Number(btn.dataset.n);
                fetch('/garage/api/equip/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF_TOKEN },
                    body: JSON.stringify({ preset_number: n }),
                })
                    .then(r => r.json())
                    .then(res => {
                        if (!res.ok) { showToast('変更に失敗しました: ' + res.error, 'error'); return; }
                        sendRoom('car_updated', {});
                        overlay.remove();
                    })
                    .catch(() => showToast('通信エラーが発生しました。', 'error'));
            });
        });
        document.getElementById('racePresetClose').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    const boardBtn = document.getElementById('boardBtn');
    if (boardBtn) {
        boardBtn.addEventListener('click', openPresetPopup);
    }

    // ══════════════════════════════════════════════════════════════
    //  退出ボタン（改修要件3-3: CUSTOMボタンの隣に配置し、部屋検索画面へ戻る）
    // ══════════════════════════════════════════════════════════════
    const leaveBtn = document.getElementById('leaveBtn');
    if (leaveBtn) {
        leaveBtn.addEventListener('click', () => {
            if (leaveBtn.disabled) return;
            roomIntentionalClose = true;
            sendRoom('leave_room', {});
            window.location.href = '/rooms/';
        });
    }

    // 改修要件6-4: レース中はCUSTOM/退出ボタンを無効化する
    function setActionButtonsDisabled(disabled) {
        if (boardBtn) boardBtn.disabled = disabled;
        if (leaveBtn) leaveBtn.disabled = disabled;
    }

    // ══════════════════════════════════════════════════════════════
    //  チャット（room_consumer経由に統一）
    // ══════════════════════════════════════════════════════════════
    function wireChat() {
        const chatSend = document.getElementById('chat-send');
        const chatInput = document.getElementById('chat-input');
        if (!chatSend || !chatInput) return;
        const send = () => {
            const txt = chatInput.value.trim();
            if (!txt) return;
            sendRoom('chat_message', { text: txt });
            chatInput.value = '';
        };
        chatSend.addEventListener('click', send);
        chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    }

    // ══════════════════════════════════════════════════════════════
    //  room_consumer 接続（常時接続。改修要件1・2: ロビー廃止しrace.html内で完結）
    //  改修要件5: 予期しない切断時は指数バックオフで自動再接続する。
    // ══════════════════════════════════════════════════════════════
    const proto = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    let roomWS = null;
    let raceWS = null;
    let roomIntentionalClose = false;
    let roomReconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 6;

    function sendRoom(type, payload) {
        if (roomWS && roomWS.readyState === WebSocket.OPEN) roomWS.send(JSON.stringify({ type, payload: payload || {} }));
    }

    function connectRoomSocket() {
        roomWS = new WebSocket(`${proto}${window.location.host}/ws/room/${ROOM_ID}/`);

        roomWS.addEventListener('open', () => {
            roomReconnectAttempts = 0;
            wireChat();
            if (roomReconnectAttempts === 0 && document.getElementById('statusLine')) {
                // no-op placeholder（現状status表示要素は無いが将来の拡張用）
            }
        });

        roomWS.addEventListener('message', (ev) => {
            let msg;
            try { msg = JSON.parse(ev.data); } catch (e) { return; }
            const { type, payload } = msg;

            if (type === 'room_state') {
                isHost = payload.host_user_id === MY_USER_ID;
                latestRoomState = payload;
                if (!raceStarted) {
                    const memberKey = configsKey(payload.car_configs);
                    if (memberKey !== lastMemberKey) {
                        lastMemberKey = memberKey;
                        rebuildCars(payload.car_configs, payload.bets, true);
                    }
                    updateReadyStartButton(payload);
                }
            } else if (type === 'host_changed') {
                isHost = payload.new_host_user_id === MY_USER_ID;
                if (typeof addComment === 'function') addComment('<i class="fa-solid fa-crown" style="color:#ffd700"></i> ホストが変更されました。', 'system');
            } else if (type === 'race_starting') {
                if (typeof addComment === 'function') addComment(`<i class="fa-solid fa-flag-checkered"></i> まもなくレースが開始されます...`, 'system');
                if (readyStartBtn) readyStartBtn.disabled = true;
                connectRaceSocket();
            } else if (type === 'chat_broadcast') {
                if (typeof addComment === 'function') addComment(`<i class="fa-solid fa-user"></i> ${payload.name}: ${payload.text}`, 'player');
            } else if (type === 'bet_updated') {
                // 改修要件6-3: 他プレイヤーの賭け金変更を自分の画面にも即時反映する。
                // 全体再構築(rebuildCars)は不要で、対象プレイヤーのbet値とDOM表示だけ更新すればよい。
                if (typeof PLAYERS !== 'undefined') {
                    const p = PLAYERS.find(pl => pl.participantId === payload.user_id);
                    if (p) {
                        p.bet = payload.amount;
                        const el = document.getElementById(`pl-bet-${p.id}`);
                        if (el) el.textContent = payload.amount;
                    }
                }
                if (latestRoomState && latestRoomState.bets) {
                    latestRoomState.bets[String(payload.user_id)] = payload.amount;
                }
            } else if (type === 'error') {
                showToast(payload.message || 'エラーが発生しました。', 'error');
            }
        });

        roomWS.addEventListener('close', () => {
            if (roomIntentionalClose) return;
            scheduleRoomReconnect();
        });
    }

    function scheduleRoomReconnect() {
        if (roomReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            showToast('サーバーとの接続が切断されました。ページを再読み込みしてください。', 'error');
            return;
        }
        roomReconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(1.7, roomReconnectAttempts - 1), 8000);
        showToast(`接続が切断されました。再接続を試みています... (${roomReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, 'error');
        setTimeout(connectRoomSocket, delay);
    }

    connectRoomSocket();
    setInterval(() => sendRoom('ping', {}), 10000);

    window.addEventListener('beforeunload', () => { roomIntentionalClose = true; });

    // ══════════════════════════════════════════════════════════════
    //  race_consumer 接続（race_starting受信時のみ。改修要件2・3）
    // ══════════════════════════════════════════════════════════════
    function connectRaceSocket() {
        if (raceWS) return;
        raceWS = new WebSocket(`${proto}${window.location.host}/ws/race/${ROOM_ID}/`);
        let reported = false;
        let raceConcludedNormally = false;

        raceWS.addEventListener('message', (ev) => {
            let msg;
            try { msg = JSON.parse(ev.data); } catch (e) { return; }
            const { type, payload } = msg;

            if (type === 'race_setup') {
                raceStarted = true;
                isHost = !!payload.is_host;
                window.__RACE_SEED__ = payload.race_seed;
                // 改修要件5-1: 全クライアントで同じ乱数列を使うため、車体を再構築する前に
                // 必ずシードを確定させる（assignRandomSkills()等がこの後に走る）。
                if (typeof setRaceRandomSeed === 'function') setRaceRandomSeed(payload.race_seed);
                rebuildCars(payload.car_configs, payload.bets, false); // 改修要件6: レース中はBot操作UIを出さない
                if (readyStartBtn) readyStartBtn.style.display = 'none';
                setActionButtonsDisabled(true); // 改修要件6-4: レース中はCUSTOM/退出を無効化
                // 改修要件1: レース開始時点で賭け金が徴収されるため、表示中のENにも即座に反映する
                if (payload.bet_charges && payload.bet_charges[String(MY_USER_ID)] !== undefined) {
                    const enEl = document.getElementById('myEnValue');
                    if (enEl) {
                        const cur = parseInt(enEl.textContent, 10) || 0;
                        enEl.textContent = Math.max(0, cur - payload.bet_charges[String(MY_USER_ID)]);
                    }
                }
                if (typeof doActualStartRace === 'function') doActualStartRace();
                pollFinish();
            } else if (type === 'race_finished') {
                raceConcludedNormally = true;
                // 改修要件6-2: 生の参加者ID(pid)ではなく、CAR_CONFIGSから引いた車名を表示する
                const nameForPid = (pid) => {
                    if (typeof CAR_CONFIGS === 'undefined') return String(pid);
                    const cfg = CAR_CONFIGS.find(c => c.participantId === pid || String(c.participantId) === String(pid));
                    return cfg ? cfg.name : String(pid);
                };
                if (typeof addComment === 'function') {
                    let txt = '<i class="fa-solid fa-satellite-dish"></i> サーバーが結果を確定しました:<br>';
                    (payload.rankings || []).forEach((pid, i) => {
                        txt += `&nbsp;&nbsp;${i + 1}位: <strong>${nameForPid(pid)}</strong>`;
                        if (payload.rate_changes && payload.rate_changes[pid] !== undefined) {
                            const d = payload.rate_changes[pid];
                            txt += ` (レート${d >= 0 ? '+' : ''}${d})`;
                        }
                        if (payload.bet_settlement && payload.bet_settlement[pid] !== undefined) {
                            txt += ` [払戻${payload.bet_settlement[pid]}en]`;
                        }
                        txt += '<br>';
                    });
                    addComment(txt, 'finish');
                    addComment('⏱ 5秒後に次のレースの準備画面へ戻ります...', 'system');
                }
                // 改修要件2: 自分への払戻があれば、画面上部のEN表示にも即時反映する
                if (payload.bet_settlement && payload.bet_settlement[MY_USER_ID] !== undefined) {
                    const enEl = document.getElementById('myEnValue');
                    if (enEl) {
                        const cur = parseInt(enEl.textContent, 10) || 0;
                        enEl.textContent = cur + payload.bet_settlement[MY_USER_ID];
                    }
                }
                // 改修要件2: 結果画面を5秒間表示してから、次のレースへシームレスに移行する
                setTimeout(() => {
                    raceStarted = false;
                    if (typeof resetRace === 'function') resetRace();
                    if (readyStartBtn) { readyStartBtn.style.display = ''; readyStartBtn.disabled = false; }
                    setActionButtonsDisabled(false); // 改修要件6-4
                    lastMemberKey = '';
                    if (latestRoomState) {
                        rebuildCars(latestRoomState.car_configs, latestRoomState.bets, true);
                        lastMemberKey = configsKey(latestRoomState.car_configs);
                        updateReadyStartButton(latestRoomState);
                    }
                }, 5000);
            } else if (type === 'race_error') {
                raceConcludedNormally = true;
                if (typeof addComment === 'function') addComment(`<i class="fa-solid fa-triangle-exclamation"></i> ${payload.message || 'レースが無効になりました。'}`, 'warning');
                raceStarted = false;
                if (readyStartBtn) { readyStartBtn.style.display = ''; readyStartBtn.disabled = false; }
                setActionButtonsDisabled(false); // 改修要件6-4
                if (typeof resetRace === 'function') resetRace();
                if (latestRoomState) {
                    lastMemberKey = configsKey(latestRoomState.car_configs);
                    rebuildCars(latestRoomState.car_configs, latestRoomState.bets, true);
                    updateReadyStartButton(latestRoomState);
                }
            }
        });

        raceWS.addEventListener('close', () => {
            raceWS = null;
            // 改修要件5: race_finished/race_error を既に受け取っている場合はサーバー側の
            // 正常なクローズなので再接続しない。レース中に予期せず切れた場合のみリトライする。
            if (raceStarted && !raceConcludedNormally) {
                scheduleRaceReconnect();
            }
        });

        function scheduleRaceReconnect(attempt) {
            attempt = attempt || 1;
            if (attempt > MAX_RECONNECT_ATTEMPTS) {
                showToast('レースサーバーとの接続が回復しません。ページを再読み込みしてください。', 'error');
                return;
            }
            const delay = Math.min(1000 * Math.pow(1.7, attempt - 1), 8000);
            showToast(`レース中に接続が切れました。再接続しています... (${attempt}/${MAX_RECONNECT_ATTEMPTS})`, 'error');
            setTimeout(() => {
                if (raceConcludedNormally) return; // 待っている間に正常終了していれば何もしない
                connectRaceSocket(attempt + 1);
            }, delay);
        }

        function pollFinish() {
            if (reported) return;
            try {
                if (typeof raceState !== 'undefined' && raceState === 'finished' && typeof CARS !== 'undefined') {
                    reported = true;
                    if (isHost) {
                        const rankings = [...CARS].sort((a, b) => (b.lap + b.t) - (a.lap + a.t));
                        const final_ranking = rankings.map(c => {
                            const cfg = CAR_CONFIGS.find(cc => cc.id === c.id);
                            return cfg ? cfg.participantId : String(c.id);
                        });
                        const lap_times = {};
                        const race_time = {};
                        CARS.forEach(c => {
                            const cfg = CAR_CONFIGS.find(cc => cc.id === c.id);
                            const pid = cfg ? cfg.participantId : String(c.id);
                            lap_times[pid] = c.lapTimes || [];
                            race_time[pid] = c.finishTime || (typeof raceTime !== 'undefined' ? raceTime : 0);
                        });
                        if (raceWS && raceWS.readyState === WebSocket.OPEN) {
                            raceWS.send(JSON.stringify({
                                type: 'race_result_report',
                                payload: { room_id: ROOM_ID, race_seed: window.__RACE_SEED__, final_ranking, lap_times, race_time },
                            }));
                        }
                    }
                    return;
                }
            } catch (e) { /* 読み込み初期段階は無視 */ }
            requestAnimationFrame(pollFinish);
        }
    }
})();
