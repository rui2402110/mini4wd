"""
websocket/race_consumer.py ── レース進行用Consumer（ws/race/<room_id>/）

【方式】ホスト権威（Host Authoritative）＋サーバーによる結果確定（6章）
  1. 全員がgame:race画面へ遷移し、本Consumerへ接続する。
  2. 最初に接続した端末（実際にはホストの接続処理内）でrace_seed・car_configsを
     生成し、Room.current_race_setupへ保存 → 全員が同じ設定でクライアント側の
     物理演算（game.js）を実行する。
  3. ホストのgame.jsが完走を検知すると、race_online.js経由でrace_result_reportを送信する。
  4. サーバーはrace_seedの一致のみを検証し（10章: 詳細な再検証は今後の課題）、
     レート変動・賭け金精算を計算し、resultテーブルへ記録、全員にrace_finishedを配信する。
  5. ホストが RACE_REPORT_TIMEOUT_SEC 以内に報告しない場合はrace_errorを配信し、
     部屋をWAITING状態へ差し戻す（10章の既知の課題: 現状は簡易実装）。
"""
import random
import threading
import time

from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from django.conf import settings

from accounts.models.user_model import User
from garage.models.car_model import Car
from rooms.models.room_model import Room
from websocket.state_store import get_store

# room_id -> threading.Timer（ホスト無応答監視。プロセス内グローバル、9-1同様の簡易実装）
_pending_timeouts = {}
_timeouts_lock = threading.Lock()


class RaceConsumer(JsonWebsocketConsumer):
    def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.group_name = f"race_{self.room_id}"
        self.user = self.scope.get("user")
        self.store = get_store()

        if self.user is None or not self.user.is_authenticated:
            self.close(code=4001)
            return

        self.room = Room.objects.filter(room_id=self.room_id).first()
        if self.room is None:
            self.close(code=4004)
            return

        async_to_sync(self.channel_layer.group_add)(self.group_name, self.channel_name)
        self.accept()

        if self.room.current_race_setup is None:
            self._generate_race_setup()
            self.start_report_timeout_timer()

    def disconnect(self, close_code):
        async_to_sync(self.channel_layer.group_discard)(self.group_name, self.channel_name)

    def receive_json(self, content, **kwargs):
        msg_type = content.get("type")
        payload = content.get("payload", {}) or {}

        if msg_type == "race_result_report":
            self.handle_race_result_report(payload)
        elif msg_type == "race_chat":
            self.handle_race_chat(payload)
        else:
            self.send_json({"type": "error", "payload": {"code": "UNKNOWN_TYPE", "message": f"未知のtype: {msg_type}"}})

    # ══════════════════════════════════════════════════════════════
    #  race_setup 生成（8章 send_race_setup 相当）
    # ══════════════════════════════════════════════════════════════
    def _generate_race_setup(self):
        from game.bot_factory import create_bot_car  # 遅延importで循環参照を回避

        members = list(self.store.smembers(self.room_id))
        bots_ids = self.store.get_bots(self.room_id)
        bets = self.store.get_bets(self.room_id)

        car_configs = []
        for uid in members:
            user = User.objects.filter(user_id=int(uid)).select_related("car").first()
            if user is None:
                continue
            car = user.car or Car.objects.filter(user=user, preset_number=Car.CURRENT_PRESET_NUMBER).first()
            if car is None:
                continue
            car_configs.append({
                "participant_id": user.user_id,
                "is_bot": False,
                "car_name": car.car_name,
                "color_1": car.color_1.color_code,
                "color_2": car.color_2.color_code,
                "color_3": car.color_3.color_code,
                "main_skill": car.main_skill_id,
                "sub_skill_1": car.sub_skill_1_id,
                "sub_skill_2": car.sub_skill_2_id,
                "car_type": car.car_type_id,
            })

        for bot_id in bots_ids:
            bot_car = next((b for b in (self.room.bot_list or []) if b.get("bot_id") == bot_id), None) or create_bot_car(bot_id)
            bot_car = dict(bot_car)
            bot_car["participant_id"] = bot_id
            bot_car["is_bot"] = True
            car_configs.append(bot_car)

        race_seed = random.getrandbits(48)

        self.room.current_race_setup = {
            "race_seed": race_seed,
            "car_configs": car_configs,
            "bets": bets,
            "created_at": time.time(),
        }
        self.room.save(update_fields=["current_race_setup"])

    def start_report_timeout_timer(self):
        """ホストが RACE_REPORT_TIMEOUT_SEC 以内に結果を報告しない場合のタイムアウト監視（10章既知の課題）"""
        timeout_sec = getattr(settings, "RACE_REPORT_TIMEOUT_SEC", 120)
        room_id = self.room_id
        group_name = self.group_name
        channel_layer = self.channel_layer

        def _on_timeout():
            room = Room.objects.filter(room_id=room_id).first()
            if room is None or room.status != Room.STATUS_RACING:
                return  # 既に結果報告済み
            room.status = Room.STATUS_WAITING
            room.current_race_setup = None
            room.save(update_fields=["status", "current_race_setup"])
            async_to_sync(channel_layer.group_send)(
                group_name,
                {"type": "ws_send", "payload": {"type": "race_error", "payload": {"message": "ホストが結果を報告しなかったため、レースを無効化しました。"}}},
            )

        timer = threading.Timer(timeout_sec, _on_timeout)
        timer.daemon = True
        with _timeouts_lock:
            old = _pending_timeouts.pop(room_id, None)
            if old:
                old.cancel()
            _pending_timeouts[room_id] = timer
        timer.start()

    def _cancel_timeout_timer(self):
        with _timeouts_lock:
            timer = _pending_timeouts.pop(self.room_id, None)
            if timer:
                timer.cancel()

    # ══════════════════════════════════════════════════════════════
    #  race_result_report 受信（6-3・8章 receive_race_result_report相当）
    # ══════════════════════════════════════════════════════════════
    def handle_race_result_report(self, payload):
        from game.bet_calculator import settle_bets
        from game.models.result_model import Result
        from game.rate_calculator import calc_rate_delta, is_bot_id

        room = Room.objects.filter(room_id=self.room_id).first()
        if room is None or room.status != Room.STATUS_RACING:
            self.send_json({"type": "error", "payload": {"code": "NOT_RACING", "message": "現在レース中ではありません。"}})
            return
        if room.host_user_id != self.user.user_id:
            self.send_json({"type": "error", "payload": {"code": "FORBIDDEN", "message": "結果報告はホストのみ可能です。"}})
            return

        setup = room.current_race_setup or {}
        if setup.get("race_seed") != payload.get("race_seed"):
            # 10章記載のとおり、詳細な再計算検証は未実装。race_seed不一致のみ弾く。
            self.send_json({"type": "error", "payload": {"code": "SEED_MISMATCH", "message": "race_seedが一致しないため結果を破棄しました。"}})
            return

        self._cancel_timeout_timer()

        final_ranking = payload.get("final_ranking", [])
        # participant_id は car_configs では int(user_id) または "BotN" 文字列。JSON経由だと
        # 数値がintのまま渡ることもあるため、str/int両対応で正規化する。
        normalized_ranking = []
        for pid in final_ranking:
            if is_bot_id(pid):
                normalized_ranking.append(pid)
            else:
                try:
                    normalized_ranking.append(int(pid))
                except (TypeError, ValueError):
                    normalized_ranking.append(pid)

        is_bot_map = {pid: is_bot_id(pid) for pid in normalized_ranking}
        rate_deltas = calc_rate_delta(normalized_ranking)
        bets = setup.get("bets", {})
        bets_by_pid = {}
        for pid in normalized_ranking:
            key = str(pid)
            bets_by_pid[pid] = bets.get(key, 100)
        bet_settlement = settle_bets(normalized_ranking, bets_by_pid, is_bot_map)

        # ── DB反映 ──
        for pid, delta in rate_deltas.items():
            User.objects.filter(user_id=pid).update(rate=models_f_expr(delta))
        for pid, payout in bet_settlement.items():
            User.objects.filter(user_id=pid).update(en=models_f_expr_add(payout))

        result = Result.objects.create(
            room=room,
            play_member=normalized_ranking,
            rank=list(range(1, len(normalized_ranking) + 1)),
            car_data=[c.get("participant_id") for c in setup.get("car_configs", [])],
            bet=bet_settlement,
            rate=rate_deltas,
            race_seed=setup.get("race_seed", 0),
            reported_by=self.user,
        )

        room.status = Room.STATUS_WAITING
        room.current_race_setup = None
        room.bot_list = []
        room.save(update_fields=["status", "current_race_setup", "bot_list"])
        self.store.set_bots(self.room_id, [])

        async_to_sync(self.channel_layer.group_send)(
            self.group_name,
            {
                "type": "ws_send",
                "payload": {
                    "type": "race_finished",
                    "payload": {
                        "result_id": result.result_id,
                        "rankings": normalized_ranking,
                        "rate_changes": rate_deltas,
                        "bet_settlement": bet_settlement,
                    },
                },
            },
        )

    def handle_race_chat(self, payload):
        text = str(payload.get("text", ""))[:60]
        if not text:
            return
        async_to_sync(self.channel_layer.group_send)(
            self.group_name,
            {
                "type": "ws_send",
                "payload": {
                    "type": "race_chat_broadcast",
                    "payload": {"user_id": self.user.user_id, "name": self.user.name, "text": text},
                },
            },
        )

    def ws_send(self, event):
        self.send_json(event["payload"])


def models_f_expr(delta):
    from django.db.models import F
    return F("rate") + delta


def models_f_expr_add(amount):
    from django.db.models import F
    return F("en") + amount
