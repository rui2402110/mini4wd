// ══════════════════════════════════════════════════════════════════
//  commentary.js ── 実況ロジック
//  ・実況コメントフィード、順位表示(HUD)更新、観戦チャットのUIロジックを担当。
//  ・依存: data.js（TOTAL_LAPS）, game.js（CARS/getRankings、関数内参照のみ）
// ══════════════════════════════════════════════════════════════════
'use strict';

        // ══════════════════════════════════════════════════════════════════
        //  実況システム
        // ══════════════════════════════════════════════════════════════════
        const commFeed = document.getElementById('commentary-feed');

        function addComment(text, cls = 'system') {
            const now = new Date();
            const ts = now.getMinutes().toString().padStart(2, '0') + ':' + now.getSeconds().toString().padStart(2, '0');
            const msg = document.createElement('div');
            msg.className = `comm-msg ${cls}`;
            msg.innerHTML = `<div class="comm-time">${ts}</div>${text}`;
            commFeed.appendChild(msg);
            commFeed.scrollTop = commFeed.scrollHeight;
            while (commFeed.children.length > 50) commFeed.removeChild(commFeed.firstChild);
        }

        function getRankings() {
            return [...CARS].sort((a, b) => {
                const ta = a.lap + a.t, tb = b.lap + b.t;
                return tb - ta;
            });
        }

        // ── HUDサイドバーのパネルを順位順に並び替える ──
        // rankings (getRankingsの戻り値) の順にDOM要素を並べ直し、各パネルに順位バッジを表示する。
        // appendChild は既存ノードを移動させるだけなので、毎フレーム呼んでも要素は再生成されない。
        let lastRankOrder = '';
        function updateHUDRankOrder(rankings) {
            // 順位が前回から変わっていなければDOM操作をスキップ（負荷軽減）
            const orderKey = rankings.map(c => c.id).join(',');
            if (orderKey === lastRankOrder) {
                // 順位は変わらなくても初回・リセット時はバッジ更新のため通す
            } else {
                const container = document.getElementById('hud-rankings');
                rankings.forEach(car => {
                    if (car.domPanel) container.appendChild(car.domPanel);
                });
                lastRankOrder = orderKey;
            }
            rankings.forEach((car, i) => {
                if (!car.domRank) return;
                const rank = i + 1;
                car.domRank.textContent = rank;
                car.domRank.className = 'rank-badge' + (rank <= 3 ? ` rank-${rank}` : '');
            });
        }

        const commFlags = {
            lap3Announced: false,
            lap4BoostAnnounced: new Set(),
            battWarnDone: new Set(),
            battEcoDone: new Set(),
        };

        function checkCommentary(raceTime) {
            const rankings = getRankings();

            if (!commFlags.lap3Announced) {
                const allPast3 = CARS.every(c => c.lap >= 3 || c.finished);
                if (allPast3) {
                    commFlags.lap3Announced = true;
                    let txt = '<i class="fa-solid fa-flag-checkered"></i> 3ラップ終了！現在の順位:<br>';
                    rankings.forEach((c, i) => {
                        txt += `&nbsp;&nbsp;${i + 1}位: <strong style="color:${c.accentHex}">${c.name}</strong><br>`;
                    });
                    addComment(txt, 'lap');
                }
            }

            CARS.forEach(c => {
                if (c.typKey === 'LATE' && c.lap >= 4 && !commFlags.lap4BoostAnnounced.has(c.id)) {
                    commFlags.lap4BoostAnnounced.add(c.id);
                    addComment(`<i class="fa-solid fa-bolt"></i> <strong style="color:${c.accentHex}">${c.name}</strong> がバッテリー全開放！後半追い上げ開始！`, 'boost');
                    doFlash('#ff00ff22', 400);
                }
            });

            CARS.forEach(c => {
                if (c.battery <= 20 && !commFlags.battWarnDone.has(c.id) && !c.finished && c.battery > 10) {
                    commFlags.battWarnDone.add(c.id);
                    addComment(`<i class="fa-solid fa-triangle-exclamation"></i> <strong style="color:${c.accentHex}">${c.name}</strong> のバッテリー残量が20%を切った！`, 'warning');
                }

                // 節約モード移行アナウンス（前半型のみ）
                if (c.battery <= ECO_BATTERY_THRESHOLD && !commFlags.battEcoDone.has(c.id) && !c.finished && c.battery > 0 && c.typKey === 'EARLY') {
                    commFlags.battEcoDone.add(c.id);
                    addComment(`<i class="fa-solid fa-car-battery"></i> <strong style="color:${c.accentHex}">${c.name}</strong> が残量10%！強制節約モードへ移行し逃げ切りを図る！`, 'warning');
                }
            });
        }

        // ── チャット送受信は race_room.js（WebSocket経由）に一本化した。
        //    以前はここでローカルにコメントを追加してから入力欄をクリアしていたが、
        //    race_room.js側の送信ハンドラより先にクリアしてしまい、サーバーに
        //    メッセージが届かない不具合があったため撤去した（改修要件1）。
