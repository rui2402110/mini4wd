"""game/models/car_type_model.py ── car_typeテーブル（3章）"""
from django.db import models


class CarType(models.Model):
    """
    設計書3章【car_type】ミニ四駆のタイプ。
    idは 'EARLY' / 'STEADY' / 'LATE' をそのまま使う。
    speed_scale / battery_scale は物理演算用の倍率配列（ラップ毎、data.js CAR_TYPESに対応）。
    """
    id = models.CharField(max_length=16, primary_key=True)
    label = models.CharField(max_length=64)
    description = models.TextField(blank=True)
    speed_scale = models.JSONField(default=list, help_text="ラップ毎の速度倍率配列")
    battery_scale = models.JSONField(default=list, help_text="ラップ毎のバッテリー消費倍率配列")

    # 描画用の補助情報（data.js CAR_TYPESと対応させる。DB管理にすることでデータ駆動にする）
    color = models.CharField(max_length=16, default="#ffffff", help_text="UI表示色（例: #ff6633）")
    pattern = models.CharField(max_length=32, default="lightning", help_text="車体マークパターン名")
    mark_color = models.IntegerField(default=0xffffff, help_text="マーク色（0xRRGGBB整数）")

    class Meta:
        db_table = "car_type"
        verbose_name = "車種タイプ"
        verbose_name_plural = "車種タイプ"

    def __str__(self):
        return f"{self.id} - {self.label}"
