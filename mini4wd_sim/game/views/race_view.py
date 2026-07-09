"""
game/views/race_view.py ── レース画面表示（待機中〜レース〜結果まで、この1画面で完結する）

ロビー画面は設計書に存在しないため廃止（改修要件2）。部屋の作成/入室後は
直接この画面へ遷移し、メンバー管理はrace.html内から room_consumer(ws/room/...) へ
接続して行う。race_setup（車体構成・race_seed）はレース開始が確定した瞬間に
race_consumer(ws/race/...) からWS経由で配信されるため、ここではページに
埋め込まない（待機中に入室したメンバーにも正しく反映させるため）。
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

    is_host = (room.host_user_id == request.user.user_id)

    # パスワード付き部屋の場合、ホスト以外は一致確認が必要（?password=で照合）
    need_password = False
    if room.has_password and not is_host:
        supplied = request.GET.get("password", "")
        if supplied != room.password:
            need_password = True

    context = {
        "room": room,
        "room_id": room_id,
        "need_password": need_password,
        "is_host_json": json.dumps(is_host),
        "my_user_id_json": json.dumps(request.user.user_id),
        "my_user_name_json": json.dumps(request.user.name),
    }
    return render(request, "game/race.html", context)
