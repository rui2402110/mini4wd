"""rankings/urls.py"""
from django.urls import path

from rankings.views import rankings_view

app_name = "rankings"

urlpatterns = [
    path("", rankings_view, name="index"),
]
