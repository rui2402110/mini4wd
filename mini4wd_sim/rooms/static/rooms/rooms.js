// rooms/static/rooms/rooms.js ── 部屋ロビーのWebSocketクライアント（room_consumer.py対応・改修要件4版）
'use strict';

(function () {
    const ROOM_ID = window.__ROOM_ID__;
    const MY_USER_ID = window.__MY_USER_ID__;
    const MAX_SLOTS = 4;

    const memberPanel = document.getElementById('hud-rankings');
    const playerListBody = document.getElementById('player-list-body');
    const memberCountLabel = document.getElementById('memberCountLabel');
    const raceStatus = document.getElementById('race-status');
    const readyBtn = document.getElementById('readyBtn');
    const startBtn = document.getElementById('startBtn');
    const betSlider = document.getElementById('betSlider');
    const betVal = document.getElementById('betVal');
    const chatFeed = document.getElementById('commentary-feed');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const leaveBtn = document.getElementById('leaveBtn');

    let ready = false;
    let isHost = false;

    const proto = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const ws = new WebSocket(`${proto}${window.location.host}/ws/room/${ROOM_ID}/`);

    function send(type, payload) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, payload: payload || {} }));
    }

    ws.addEventListener('open', () => { raceStatus.textContent = '対戦相手を待っています...'; });
    ws.addEventListener('close', () => { raceStatus.textContent = '接続が切断されました。'; });

    ws.addEventListener('message', (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        const { type, payload } = msg;

        if (type === 'room_state') {
            renderState(payload);
        } else if (type === 'host_changed') {
            isHost = payload.new_host_user_id === MY_USER_ID;
            startBtn.style.display = isHost ? 'inline-block' : 'none';
            if (isHost) raceStatus.textContent = 'あなたがホストになりました。';
        } else if (type === 'race_starting') {
            raceStatus.textContent = `レース開始まで ${payload.countdown} 秒...`;
            setTimeout(() => { window.location.href = `/game/race/${ROOM_ID}/`; }, (payload.countdown || 3) * 1000);
        } else if (type === 'chat_broadcast') {
            appendChat(payload.name, payload.text);
        } else if (type === 'error') {
            alert(payload.message || 'エラーが発生しました。');
        }
    });

    function renderState(state) {
        isHost = state.host_user_id === MY_USER_ID;
        startBtn.style.display = isHost ? 'inline-block' : 'none';
        readyBtn.style.display = isHost ? 'none' : 'inline-block';

        const members = state.members || [];
        memberCountLabel.textContent = `${members.length + (state.bots || []).length}/${MAX_SLOTS}`;

        // ── メンバー枠（車体パネルと同じ .car-panel を再利用したスロット表示） ──
        memberPanel.innerHTML = '';
        const slots = [];
        members.forEach(uid => slots.push({ kind: 'member', id: uid }));
        (state.bots || []).forEach(botId => slots.push({ kind: 'bot', id: botId }));
        while (slots.length < MAX_SLOTS) slots.push({ kind: 'empty' });

        slots.forEach((slot, i) => {
            const panel = document.createElement('div');
            panel.className = 'car-panel';

            if (slot.kind === 'member') {
                const uidStr = String(slot.id);
                const isMe = Number(slot.id) === MY_USER_ID;
                const isSlotHost = Number(slot.id) === state.host_user_id;
                const isReady = isSlotHost || !!state.ready_map[uidStr];
                if (isMe) panel.classList.add('own-car');
                panel.innerHTML = `
                    <div class="car-name">
                        ${isMe ? '<span class="own-car-arrow">YOU</span>' : ''}
                        ${isSlotHost ? '★ ' : ''}user#${slot.id}
                    </div>
                    <div class="car-tags-row">
                        <span class="car-type-badge" style="background:${isReady ? '#00ff8822' : '#55555522'};color:${isReady ? '#00ff88' : '#889'};border:1px solid ${isReady ? '#00ff8855' : '#555'}">${isReady ? '✓ READY' : '未準備'}</span>
                    </div>
                `;
            } else if (slot.kind === 'bot') {
                panel.innerHTML = `
                    <div class="car-name">🤖 ${slot.id}</div>
                    <div class="car-tags-row">
                        <span class="car-type-badge" style="background:#0099ff22;color:#0099ff;border:1px solid #0099ff55">BOT</span>
                        ${isHost ? `<span class="rm-bot" data-bot="${slot.id}" style="cursor:pointer; color:#ff5566; margin-left:8px;">×削除</span>` : ''}
                    </div>
                `;
            } else {
                panel.classList.add('empty-slot');
                panel.innerHTML = isHost
                    ? `<button class="add-bot-btn" style="width:100%; padding:10px; font-size:11px;">+ Bot追加</button>`
                    : `<div class="car-name" style="color:#445;">空き枠</div>`;
            }
            memberPanel.appendChild(panel);
        });

        memberPanel.querySelectorAll('.rm-bot').forEach(elm => {
            elm.addEventListener('click', () => send('remove_bot', { bot_id: elm.dataset.bot }));
        });
        memberPanel.querySelectorAll('.add-bot-btn').forEach(elm => {
            elm.addEventListener('click', () => send('add_bot', {}));
        });

        // ── プレイヤーリスト（レート欄はこの段階では取得していないため簡易表示） ──
        playerListBody.innerHTML = '';
        members.forEach(uid => {
            const uidStr = String(uid);
            const isSlotHost = Number(uid) === state.host_user_id;
            const isReady = isSlotHost || !!state.ready_map[uidStr];
            const bet = (state.bets && state.bets[uidStr]) || 100;
            const row = document.createElement('div');
            row.className = 'player-row';
            row.innerHTML = `<span>${isSlotHost ? '★' : ''}user#${uid}${Number(uid) === MY_USER_ID ? '(YOU)' : ''}</span><span>-</span><span>${isReady ? '✓' : '-'}</span><span>${bet}</span>`;
            playerListBody.appendChild(row);
        });
    }

    function appendChat(name, text) {
        const el = document.createElement('div');
        el.className = 'comm-msg system';
        el.innerHTML = `<div class="comm-time">${name}</div>${text}`;
        chatFeed.appendChild(el);
        chatFeed.scrollTop = chatFeed.scrollHeight;
    }

    readyBtn.addEventListener('click', () => {
        ready = !ready;
        readyBtn.textContent = ready ? '準備完了 ✓' : '準備完了';
        readyBtn.classList.toggle('is-ready', ready);
        send('ready_toggle', { ready });
    });

    startBtn.addEventListener('click', () => send('request_start', {}));

    betSlider.addEventListener('input', () => { betVal.textContent = betSlider.value; });
    betSlider.addEventListener('change', () => send('place_bet', { amount: Number(betSlider.value) }));

    chatSend.addEventListener('click', () => {
        const txt = chatInput.value.trim();
        if (!txt) return;
        send('chat_message', { text: txt });
        chatInput.value = '';
    });
    chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') chatSend.click(); });

    leaveBtn.addEventListener('click', () => {
        send('leave_room', {});
        window.location.href = '/rooms/';
    });

    // ── ハートビート（6-2参照） ──
    setInterval(() => send('ping', {}), 10000);
})();
