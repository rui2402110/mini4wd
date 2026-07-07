"""
game/views/race_view.py ── レース画面表示

race_consumer.send_race_setup() がRoom.current_race_setupへ保存した
race_seed・car_configs・is_host情報をもとに、race.html を描画する。
これにより、ゲームロジック自体（data.js/game.js等）を書き換えることなく、
サーバー側で決定した車体構成をそのままクライアントへ渡せる。
"""
import json

from django.contrib.auth.decorators import login_required
from django.http import Http404
from django.shortcuts import render

from rooms.models.room_model import Room


@login_required
def race_view(request, room_id):
    try:
        room = Room.objects.get(room_id=room_id)
    except Room.DoesNotExist:
        raise Http404("部屋が見つかりません。")

    setup = room.current_race_setup or {}
    is_host = (room.host_user_id == request.user.user_id)

    context = {
        "room": room,
        "race_setup_json": json.dumps(setup, ensure_ascii=False),
        "is_host_json": json.dumps(is_host),
        "room_id": room_id,
    }
    return render(request, "game/race.html", context)
