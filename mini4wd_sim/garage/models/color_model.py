"""garage/models/color_model.py ── car_colorテーブル（3章）"""
from django.db import models


class CarColor(models.Model):
    """設計書3章【car_color】カラーのマスターテーブル。価格は一律75,000 en。"""

    COLOR_TYPE_CHOICES = [
        ("COLOR1", "ボディカラー"),
        ("COLOR2", "アクセントカラー"),
        ("COLOR3", "マークカラー"),
    ]

    color_id = models.BigAutoField(primary_key=True)
    color_code = models.CharField(max_length=7, help_text="例: #FF0000")
    color_type = models.CharField(max_length=10, choices=COLOR_TYPE_CHOICES)
    price = models.IntegerField(default=75_000)

    class Meta:
        db_table = "car_color"
        unique_together = ("color_code", "color_type")
        verbose_name = "カラー"
        verbose_name_plural = "カラー"

    def __str__(self):
        return f"{self.color_type}:{self.color_code}"
