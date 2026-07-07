// ══════════════════════════════════════════════════════════════════
//  race_online.js ── オンライン対戦統合ブリッジ（v1.3 ホスト権威方式）
//  ・data.js が読み込まれた直後・course.js等より前に読み込むこと。
//  ・game.js/physics.js/skills.js等の「ゲームロジック本体」は一切書き換えず、
//    data.js が公開する CAR_CONFIGS / PLAYERS / PLAYER_CAR_ID を
//    サーバーから配信された race_setup の内容で「配列の中身だけ」上書きする。
//    （constでも配列/オブジェクトの中身は変更できるため、game.js側の
//    `const CARS = CAR_CONFIGS.map(...)` はこのファイルの後で実行されれば
//    上書き後の内容を正しく参照する）
//  ・レース終了検知後、ホストのみ race_result_report を送信する（6章）。
// ══════════════════════════════════════════════════════════════════
'use strict';

(function () {
    const RACE_SETUP = window.__RACE_SETUP__ || null;
    const ROOM_ID = window.__ROOM_ID__ || null;
    const IS_HOST = !!(RACE_SETUP && RACE_SETUP.is_host);
    const MY_PARTICIPANT_ID = RACE_SETUP ? RACE_SETUP.my_participant_id : null;

    function hexToInt(hex, fallback) {
        if (typeof hex === 'number') return hex;
        if (typeof hex !== 'string') return fallback;
        return parseInt(hex.replace('#', ''), 16) || fallback;
    }

    // ── data.js の CAR_CONFIGS / PLAYERS をサーバー配信内容で上書き ──
    if (RACE_SETUP && Array.isArray(RACE_SETUP.car_configs) && RACE_SETUP.car_configs.length > 0) {
        const LANE_OFFSETS = [3.6, -1.2, 1.2, -3.6];
        const newConfigs = RACE_SETUP.car_configs.map((c, i) => ({
            id: i + 1,
            name: c.car_name || c.name || `CAR${i + 1}`,
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
            participantId: c.participant_id, // user_idまたは"Bot1"等
            isBot: !!c.is_bot,
        }));

        if (typeof CAR_CONFIGS !== 'undefined') {
            CAR_CONFIGS.length = 0;
            newConfigs.forEach(c => CAR_CONFIGS.push(c));
        }

        // 自分の車体IDを判定してPLAYER_CAR_IDを上書き（data.js側はletではなくconstだが、
        // グローバルスクリプト間の変数はwindow経由の別名で扱う）
        const myCfg = newConfigs.find(c => c.participantId === MY_PARTICIPANT_ID);
        window.__MY_CAR_ID__ = myCfg ? myCfg.id : (newConfigs[0] ? newConfigs[0].id : 1);
        if (typeof PLAYER_CAR_ID !== 'undefined') {
            try { PLAYER_CAR_ID = window.__MY_CAR_ID__; } catch (e) { /* constの場合は無視。下記PLAYERSで代替 */ }
        }

        if (typeof PLAYERS !== 'undefined') {
            PLAYERS.length = 0;
            newConfigs.forEach(c => {
                PLAYERS.push({
                    id: c.id,
                    carId: c.id,
                    name: c.isBot ? `${c.name} (BOT)` : c.name,
                    rate: 1500,
                    wins: 0,
                    bet: (RACE_SETUP.bets && RACE_SETUP.bets[c.participantId]) || 100,
                    isUser: c.participantId === MY_PARTICIPANT_ID,
                });
            });
        }
    }

    if (!ROOM_ID) return; // race_setupが無い＝オフラインデモ実行のため、以降のWS接続は行わない

    // ── WebSocket接続（race_consumer） ──
    const proto = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const ws = new WebSocket(`${proto}${window.location.host}/ws/race/${ROOM_ID}/`);
    let reported = false;

    ws.addEventListener('message', (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        const { type, payload } = msg;

        if (type === 'race_finished') {
            // サーバー確定結果を最終結果として表示に反映する（6-1・9-4参照）。
            // 画面演出は既存のfinish-bannerを使い、確定結果のみ補足表示する。
            if (typeof addComment === 'function') {
                let txt = '📡 サーバーが結果を確定しました:<br>';
                (payload.rankings || []).forEach((pid, i) => {
                    txt += `&nbsp;&nbsp;${i + 1}位: <strong>${pid}</strong>`;
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
            }
        } else if (type === 'race_error') {
            if (typeof addComment === 'function') {
                addComment(`⚠️ ${payload.message || 'レースが無効になりました。'}`, 'warning');
            }
            setTimeout(() => { window.location.href = '/rooms/'; }, 3000);
        } else if (type === 'race_chat_broadcast') {
            if (typeof addComment === 'function') {
                addComment(`👤 ${payload.name}: ${payload.text}`, 'player');
            }
        }
    });

    // ── チャット送信をWSにも流す（commentary.jsのsendChatをラップ） ──
    document.addEventListener('DOMContentLoaded', () => {
        const chatSend = document.getElementById('chat-send');
        const chatInput = document.getElementById('chat-input');
        if (!chatSend || !chatInput) return;
        const sendToServer = () => {
            const txt = chatInput.value.trim();
            if (!txt || ws.readyState !== WebSocket.OPEN) return;
            ws.send(JSON.stringify({ type: 'race_chat', payload: { text: txt } }));
        };
        chatSend.addEventListener('click', sendToServer);
        chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendToServer(); });
    });

    // ── レース終了検知 → ホストのみ結果報告（6-3フォーマット） ──
    function pollFinish() {
        if (reported) return;
        try {
            if (typeof raceState !== 'undefined' && raceState === 'finished' && typeof CARS !== 'undefined') {
                reported = true;
                if (IS_HOST) {
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
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'race_result_report',
                            payload: {
                                room_id: ROOM_ID,
                                race_seed: RACE_SETUP.race_seed,
                                final_ranking,
                                lap_times,
                                race_time,
                            },
                        }));
                    }
                }
            }
        } catch (e) {
            // raceState/CARSがまだ定義されていない読み込み初期段階は無視する
        }
        requestAnimationFrame(pollFinish);
    }
    requestAnimationFrame(pollFinish);
})();
