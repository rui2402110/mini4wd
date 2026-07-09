"""rooms/urls.py"""
from django.urls import path

from rooms import views

app_name = "rooms"

urlpatterns = [
    path("", views.rooms_list_view, name="index"),
    path("create/", views.create_room_view, name="create"),
]
