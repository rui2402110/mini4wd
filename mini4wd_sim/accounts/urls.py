"""accounts/urls.py"""
from django.urls import path

from accounts import views

app_name = "accounts"

urlpatterns = [
    path("", views.index_view, name="index"),
    path("login/", views.login_view, name="login"),
    path("signin/", views.signin_view, name="signin"),
    path("logout/", views.logout_view, name="logout"),
]
