"""myroom/urls.py"""
from django.urls import path

from myroom import views

app_name = "myroom"

urlpatterns = [
    path("", views.myroom_view, name="index"),
    path("results/", views.results_view, name="results"),
    path("stats/", views.stats_view, name="stats"),
    path("achievements/", views.achievements_view, name="achievements"),
]
