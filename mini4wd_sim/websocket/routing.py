"""websocket/routing.py ── 本アプリのWebSocketルーティング定義（config/ws_urls.pyから読み込まれる）"""
from django.urls import re_path

from websocket.race_consumer import RaceConsumer
from websocket.room_consumer import RoomConsumer

websocket_urlpatterns = [
    re_path(r"^ws/room/(?P<room_id>[\w-]+)/$", RoomConsumer.as_asgi()),
    re_path(r"^ws/race/(?P<room_id>[\w-]+)/$", RaceConsumer.as_asgi()),
]
