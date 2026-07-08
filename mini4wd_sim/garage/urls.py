"""garage/urls.py"""
from django.urls import path

from garage import views

app_name = "garage"

urlpatterns = [
    path("", views.garage_view, name="index"),
    path("api/save-current/", views.api_save_current, name="api_save_current"),
    path("api/save/", views.api_save_preset, name="api_save_preset"),
    path("api/equip/", views.api_equip_preset, name="api_equip_preset"),
    path("api/delete/", views.api_delete_preset, name="api_delete_preset"),
    path("shop/", views.shop_view, name="shop"),
    path("shop/api/purchase/", views.api_purchase, name="api_purchase"),
]
