"""
websocket/room_consumer.py ── ロビー（部屋）用Consumer（ws/room/<room_id>/）

7章のイベント定義・8章の関数配置に準拠。
リアルタイムかつ一時的なステータス（入室者・準備完了状態・Bot・賭け金）はRedis
（state_store.py, 9-7）で管理し、部屋の永続情報のみDB（rooms.Room）で管理する。
"""
import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer

from rooms.models.room_model import Room
from websocket.state_store import MAX_BOTS, MAX_MEMBERS, get_store


class RoomConsumer(JsonWebsocketConsumer):
    def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.group_name = f"room_{self.room_id}"
        self.user = self.scope.get("user")
        self.store = get_store()

        if self.user is None or not self.user.is_authenticated:
            self.close(code=4001)
            return

        try:
            self.room = Room.objects.get(room_id=self.room_id)
        except Room.DoesNotExist:
            self.close(code=4004)
            return

        members = self.store.smembers(self.room_id)
        if str(self.user.user_id) not in members and len(members) >= MAX_MEMBERS:
            self.accept()
            self.send_json({"type": "error", "payload": {"code": "ROOM_FULL", "message": "この部屋は満員です。"}})
            self.close(code=4003)
            return

        async_to_sync(self.channel_layer.group_add)(self.group_name, self.channel_name)
        self.accept()

        self.store.sadd(self.room_id, self.user.user_id)
        self.store.set_online(self.user.user_id)
        self.store.hset(self.room_id, self.user.user_id, False)

        self.broadcast_room_state()

    def disconnect(self, close_code):
        if not getattr(self, "user", None) or not self.user.is_authenticated:
            return

        self.store.srem(self.room_id, self.user.user_id)
        self.store.hdel(self.room_id, self.user.user_id)
        self.store.clear_online(self.user.user_id)

        async_to_sync(self.channel_layer.group_discard)(self.group_name, self.channel_name)

        # ホストが退室した場合はホスト引き継ぎ（6-2(3)参照）
        room = Room.objects.filter(room_id=self.room_id).first()
        if room and room.host_user_id == self.user.user_id:
            remaining = list(self.store.smembers(self.room_id))
            if remaining:
                new_host_id = int(remaining[0])
                room.host_user_id = new_host_id
                room.save(update_fields=["host_user"])
                async_to_sync(self.channel_layer.group_send)(
                    self.group_name,
                    {"type": "ws_send", "payload": {"type": "host_changed", "payload": {"new_host_user_id": new_host_id}}},
                )
            else:
                # 生存者がいない場合は部屋自体を破棄する対象になる
                # （実際の削除はcleanup_old_roomsバッチが9-1条件で行う。ここではRedis状態のみ掃除）
                self.store.clear_room(self.room_id)

        self.broadcast_room_state()

    def receive_json(self, content, **kwargs):
        msg_type = content.get("type")
        payload = content.get("payload", {}) or {}

        handler_map = {
            "ready_toggle": self.handle_ready_toggle,
            "add_bot": self.handle_add_bot,
            "remove_bot": self.handle_remove_bot,
            "place_bet": self.handle_place_bet,
            "request_start": self.handle_request_start,
            "chat_message": self.handle_chat_message,
            "leave_room": self.handle_leave_room,
            "car_updated": self.handle_car_updated,
            "ping": self.handle_ping,
        }
        handler = handler_map.get(msg_type)
        if handler is None:
            self.send_json({"type": "error", "payload": {"code": "UNKNOWN_TYPE", "message": f"未知のtype: {msg_type}"}})
            return
        handler(payload)

    # ── ハートビート（6-2参照） ──
    def handle_ping(self, payload):
        self.store.set_online(self.user.user_id)
        self.send_json({"type": "pong", "payload": {}})

    def handle_ready_toggle(self, payload):
        ready = bool(payload.get("ready", False))
        self.store.hset(self.room_id, self.user.user_id, ready)
        self.broadcast_room_state()

    def handle_add_bot(self, payload):
        members = self.store.smembers(self.room_id)
        bots = self.store.get_bots(self.room_id)
        if len(members) + len(bots) >= MAX_MEMBERS:
            self.send_json({"type": "error", "payload": {"code": "ROOM_FULL", "message": "レース参加枠(4)が満員のため、Botを追加できません。"}})
            return
        if len(bots) >= MAX_BOTS:
            self.send_json({"type": "error", "payload": {"code": "BOT_LIMIT", "message": "Botはこれ以上追加できません。"}})
            return

        from game.bot_factory import create_bot_car  # 遅延importで循環参照を回避

        bot_id = f"Bot{len(bots) + 1}"
        bot_car = create_bot_car(bot_id)
        bots.append(bot_id)
        self.store.set_bots(self.room_id, bots)

        room = Room.objects.get(room_id=self.room_id)
        bot_list = room.bot_list or []
        bot_list.append(bot_car)
        room.bot_list = bot_list
        room.save(update_fields=["bot_list"])

        self.broadcast_room_state()

    def handle_remove_bot(self, payload):
        room = Room.objects.get(room_id=self.room_id)
        if room.host_user_id != self.user.user_id:
            self.send_json({"type": "error", "payload": {"code": "FORBIDDEN", "message": "Botの削除はホストのみ可能です。"}})
            return

        bot_id = payload.get("bot_id")
        bots = self.store.get_bots(self.room_id)
        if bot_id in bots:
            bots.remove(bot_id)
            self.store.set_bots(self.room_id, bots)
            room.bot_list = [b for b in (room.bot_list or []) if b.get("bot_id") != bot_id]
            room.save(update_fields=["bot_list"])
        self.broadcast_room_state()

    def handle_place_bet(self, payload):
        from game.bet_calculator import clamp_bet_amount

        amount = clamp_bet_amount(payload.get("amount", 100))
        self.store.set_bet(self.room_id, self.user.user_id, amount)
        async_to_sync(self.channel_layer.group_send)(
            self.group_name,
            {"type": "ws_send", "payload": {"type": "bet_updated", "payload": {"user_id": self.user.user_id, "amount": amount}}},
        )

    def handle_request_start(self, payload):
        room = Room.objects.get(room_id=self.room_id)
        if room.host_user_id != self.user.user_id:
            self.send_json({"type": "error", "payload": {"code": "FORBIDDEN", "message": "レース開始はホストのみ実行できます。"}})
            return

        ready_map = self.store.hgetall(self.room_id)
        members = self.store.smembers(self.room_id)
        if not members:
            return
        # ホストは常時準備完了として扱う（改修要件4）
        ready_count = sum(1 for uid in members if str(uid) == str(room.host_user_id) or ready_map.get(str(uid)))
        if ready_count < len(members) * 0.5:
            self.send_json({"type": "error", "payload": {"code": "NOT_ENOUGH_READY", "message": "ホストを含め、準備完了が50%未満のため開始できません。"}})
            return

        room.status = Room.STATUS_RACING
        room.save(update_fields=["status"])

        async_to_sync(self.channel_layer.group_send)(
            self.group_name,
            {"type": "ws_send", "payload": {"type": "race_starting", "payload": {"room_id": self.room_id, "countdown": 3}}},
        )

    def handle_chat_message(self, payload):
        text = str(payload.get("text", ""))[:60]
        if not text:
            return
        import time as _time

        async_to_sync(self.channel_layer.group_send)(
            self.group_name,
            {
                "type": "ws_send",
                "payload": {
                    "type": "chat_broadcast",
                    "payload": {
                        "user_id": self.user.user_id,
                        "name": self.user.name,
                        "text": text,
                        "timestamp": _time.time(),
                    },
                },
            },
        )

    def handle_leave_room(self, payload):
        self.close(code=1000)

    def handle_car_updated(self, payload):
        """
        ガレージのカスタムボタン(AJAX)で装備車体を変更した後、クライアントから
        送られる通知。DBの最新User.carを反映するため単純に再ブロードキャストする
        （改修要件2 3参照）。
        """
        self.broadcast_room_state()

    # ── 共通ヘルパー ──
    def broadcast_room_state(self):
        room = Room.objects.filter(room_id=self.room_id).first()
        if room is None:
            return
        from websocket.broadcast_helpers import broadcast_room_state as _broadcast

        _broadcast(self.channel_layer, room)

    # ── group_send経由で受け取ったメッセージをそのままクライアントへ流す ──
    def ws_send(self, event):
        self.send_json(event["payload"])
