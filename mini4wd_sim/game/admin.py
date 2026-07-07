"""game/admin.py"""
from django.contrib import admin

from .models.car_skills_model import CarSkill
from .models.car_type_model import CarType
from .models.result_model import Result

@admin.register(CarType)
class CarTypeAdmin(admin.ModelAdmin):
    list_display = ("id", "label", "color", "pattern")


@admin.register(CarSkill)
class CarSkillAdmin(admin.ModelAdmin):
    list_display = ("skill_id", "name", "trigger", "passive", "price")
    search_fields = ("skill_id", "name")


@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):
    list_display = ("result_id", "room", "race_seed", "reported_by", "created_at")
    readonly_fields = [f.name for f in Result._meta.fields]
