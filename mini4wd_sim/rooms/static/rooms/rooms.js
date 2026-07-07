// rooms/static/rooms/rooms.js ── 部屋ロビーのWebSocketクライアント（room_consumer.py対応）
'use strict';

(function () {
    const ROOM_ID = window.__ROOM_ID__;
    const MY_USER_ID = window.__MY_USER_ID__;
    let IS_HOST = !!window.__IS_HOST__;

    const memberList = document.getElementById('memberList');
    const botList = document.getElementById('botList');
    const readyBtn = document.getElementById('readyBtn');
    const startBtn = document.getElementById('startBtn');
    const statusLine = document.getElementById('statusLine');
    const betSlider = document.getElementById('betSlider');
    const betVal = document.getElementById('betVal');
    const addBotBtn = document.getElementById('addBotBtn');
    const chatFeed = document.getElementById('chatFeed');
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    const leaveBtn = document.getElementById('leaveBtn');

    let ready = false;
    let latestState = null;

    const proto = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const ws = new WebSocket(`${proto}${window.location.host}/ws/room/${ROOM_ID}/`);

    function send(type, payload) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, payload: payload || {} }));
    }

    ws.addEventListener('open', () => { statusLine.textContent = '接続しました。'; });
    ws.addEventListener('close', () => { statusLine.textContent = '接続が切断されました。'; });

    ws.addEventListener('message', (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        const { type, payload } = msg;

        if (type === 'room_state') {
            latestState = payload;
            IS_HOST = payload.host_user_id === MY_USER_ID;
            renderMembers(payload);
            startBtn.style.display = IS_HOST ? 'inline-block' : 'none';
        } else if (type === 'host_changed') {
            IS_HOST = payload.new_host_user_id === MY_USER_ID;
            if (IS_HOST) statusLine.textContent = 'あなたがホストになりました。';
        } else if (type === 'race_starting') {
            statusLine.textContent = `レース開始まで ${payload.countdown} 秒...`;
            setTimeout(() => { window.location.href = `/game/race/${ROOM_ID}/`; }, (payload.countdown || 3) * 1000);
        } else if (type === 'bet_updated') {
            // 自分以外の賭け金更新の可視化は簡略化のため省略（room_stateの次回更新で反映）
        } else if (type === 'chat_broadcast') {
            appendChat(payload.name, payload.text);
        } else if (type === 'error') {
            alert(payload.message || 'エラーが発生しました。');
        }
    });

    function renderMembers(state) {
        memberList.innerHTML = '';
        (state.members || []).forEach(uid => {
            const el = document.createElement('div');
            const isReady = !!state.ready_map[uid];
            el.className = 'member-item' + (isReady ? ' ready' : '');
            const bet = state.bets && state.bets[uid] ? state.bets[uid] : 100;
            el.innerHTML = `<span>user#${uid}${Number(uid) === MY_USER_ID ? ' (YOU)' : ''}${Number(uid) === state.host_user_id ? ' 👑' : ''}</span><span>${isReady ? '✓READY' : '...'} / ${bet}en</span>`;
            memberList.appendChild(el);
        });

        botList.innerHTML = '';
        (state.bots || []).forEach(botId => {
            const el = document.createElement('div');
            el.className = 'bot-item';
            el.innerHTML = `<span>${botId}</span>${IS_HOST ? '<span class="rm" data-bot="' + botId + '">×削除</span>' : ''}`;
            botList.appendChild(el);
        });
        botList.querySelectorAll('.rm').forEach(elm => {
            elm.addEventListener('click', () => send('remove_bot', { bot_id: elm.dataset.bot }));
        });
    }

    function appendChat(name, text) {
        const el = document.createElement('div');
        el.className = 'msg';
        el.innerHTML = `<span class="nm">${name}:</span> ${text}`;
        chatFeed.appendChild(el);
        chatFeed.scrollTop = chatFeed.scrollHeight;
    }

    readyBtn.addEventListener('click', () => {
        ready = !ready;
        readyBtn.textContent = ready ? '準備完了 ✓' : '準備完了';
        send('ready_toggle', { ready });
    });

    startBtn.addEventListener('click', () => send('request_start', {}));
    addBotBtn.addEventListener('click', () => send('add_bot', {}));

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
