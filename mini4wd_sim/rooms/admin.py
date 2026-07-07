"""rooms/admin.py"""
from django.contrib import admin

from .models.room_model import Room


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("room_id", "room_name", "host_user", "is_public", "status", "created_at")
    list_filter = ("status", "is_public")
    search_fields = ("room_name", "room_id")
