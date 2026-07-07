"""
config/ws_urls.py ── WebSocketルーティングのエントリポイント

実体は websocket/routing.py で定義し、ここではそれを読み込むだけにする
（config層はプロジェクト全体の配線のみを担当する方針のため）。
"""
from websocket.routing import websocket_urlpatterns

__all__ = ["websocket_urlpatterns"]
