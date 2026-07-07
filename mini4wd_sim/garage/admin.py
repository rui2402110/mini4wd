"""garage/admin.py"""
from django.contrib import admin

from .models.car_model import Car
from .models.color_model import CarColor
from .models.user_color_model import UserColor
from .models.user_preset_slot_model import UserPresetSlot
from .models.user_skill_model import UserSkill


@admin.register(Car)
class CarAdmin(admin.ModelAdmin):
    list_display = ("car_id", "user", "preset_number", "car_name", "car_type")
    list_filter = ("car_type",)
    search_fields = ("car_name", "user__name")


@admin.register(CarColor)
class CarColorAdmin(admin.ModelAdmin):
    list_display = ("color_id", "color_code", "color_type", "price")
    list_filter = ("color_type",)


@admin.register(UserSkill)
class UserSkillAdmin(admin.ModelAdmin):
    list_display = ("user", "skill", "unlocked_at")


@admin.register(UserColor)
class UserColorAdmin(admin.ModelAdmin):
    list_display = ("user", "color", "unlocked_at")


@admin.register(UserPresetSlot)
class UserPresetSlotAdmin(admin.ModelAdmin):
    list_display = ("user", "preset_number", "unlocked_at")
