"""config/urls.py ── ルートURLディスパッチャ"""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("accounts.urls")),
    path("menu/", include("menu.urls")),
    path("game/", include("game.urls")),
    path("rankings/", include("rankings.urls")),
    path("garage/", include("garage.urls")),
    path("rooms/", include("rooms.urls")),
    path("myroom/", include("myroom.urls")),
]
