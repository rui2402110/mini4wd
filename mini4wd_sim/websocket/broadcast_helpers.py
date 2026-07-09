"""
websocket/broadcast_helpers.py ── room_state のブロードキャストをroom_consumer/race_consumer
どちらからでも呼べるようにした共通関数。

race_consumer.handle_race_result_report がレース終了後にBotリストをクリアした際、
待機中の部屋プレビュー（room_consumer側）にも変化を反映させるために使用する。
"""
from asgiref.sync import async_to_sync

from game.race_setup_builder import build_car_configs
from websocket.state_store import get_store


def broadcast_room_state(channel_layer, room):
    store = get_store()
    room_id = str(room.room_id)
    members = list(store.smembers(room_id))
    ready_map = store.hgetall(room_id)
    bots = store.get_bots(room_id)
    bets = store.get_bets(room_id)

    if room.host_user_id is not None:
        ready_map[str(room.host_user_id)] = True

    state = {
        "members": members,
        "bots": bots,
        "ready_map": ready_map,
        "bets": bets,
        "status": room.status,
        "host_user_id": room.host_user_id,
        "car_configs": build_car_configs(room, store),
    }
    async_to_sync(channel_layer.group_send)(
        f"room_{room_id}", {"type": "ws_send", "payload": {"type": "room_state", "payload": state}}
    )
