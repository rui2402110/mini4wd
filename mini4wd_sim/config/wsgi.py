"""
config/wsgi.py ── WSGIエントリポイント

通常のHTTPのみを捌く場合（runserverでの開発時など）はこちらが使われる。
WebSocket（Channels）を含めて動かす場合は config/asgi.py 経由で
daphne等のASGIサーバーから起動すること。
"""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_wsgi_application()
