"""accounts/admin.py"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models.achievement_model import Achievement
from .models.user_model import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    model = User
    list_display = ("user_id", "name", "rate", "en", "tickets", "is_staff")
    list_display_links = ("name",)
    search_fields = ("name",)
    ordering = ("user_id",)
    fieldsets = (
        (None, {"fields": ("name", "password")}),
        ("ゲームデータ", {"fields": ("car", "achievement", "rate", "en", "tickets", "last_login_at")}),
        ("権限", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("name", "password1", "password2")}),
    )


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ("achievement_id", "user", "achievement_key", "grade", "en", "achieve_bool")
    list_filter = ("grade", "achieve_bool")
