"""myroom/admin.py"""
from django.contrib import admin

from .models.achievement_master_model import AchievementMaster
from .models.achievement_tier_model import AchievementTier
from .models.user_achievement_progress_model import UserAchievementProgress
from .models.user_achievement_unlock_model import UserAchievementUnlock


class AchievementTierInline(admin.TabularInline):
    model = AchievementTier
    extra = 0


@admin.register(AchievementMaster)
class AchievementMasterAdmin(admin.ModelAdmin):
    list_display = ("achievement_key", "name", "category", "metric", "sort_order")
    list_filter = ("category",)
    inlines = [AchievementTierInline]


@admin.register(UserAchievementProgress)
class UserAchievementProgressAdmin(admin.ModelAdmin):
    list_display = ("user", "achievement", "current_value", "updated_at")
    search_fields = ("user__name",)


@admin.register(UserAchievementUnlock)
class UserAchievementUnlockAdmin(admin.ModelAdmin):
    list_display = ("user", "tier", "achieved_at", "en_granted")
    search_fields = ("user__name",)
