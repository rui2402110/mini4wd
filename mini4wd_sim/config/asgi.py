"""
config/asgi.py ── ASGIエントリポイント

HTTPは通常のDjangoビューへ、WebSocketは config/ws_urls.py 経由で
websocket/room_consumer.py・websocket/race_consumer.py へルーティングする。
"""
import os

import django
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

django_asgi_app = get_asgi_application()

from config import ws_urls  # noqa: E402  (django.setup()の後にimportする必要がある)

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AuthMiddlewareStack(URLRouter(ws_urls.websocket_urlpatterns)),
    }
)
