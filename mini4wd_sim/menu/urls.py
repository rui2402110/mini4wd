"""menu/urls.py"""
from django.urls import path

from menu.views import menu_view

app_name = "menu"

urlpatterns = [
    path("", menu_view, name="index"),
]
