"""game/urls.py"""
from django.urls import path

from game.views import race_view

app_name = "game"

urlpatterns = [
    path("race/<str:room_id>/", race_view, name="race"),
]
