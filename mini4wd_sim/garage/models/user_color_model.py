"""garage/models/user_color_model.py ── user_colorテーブル（3章）"""
from django.conf import settings
from django.db import models


class UserColor(models.Model):
    """設計書3章【user_color】ユーザーのカラー所持管理（中間テーブル）"""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_colors")
    color = models.ForeignKey("garage.CarColor", on_delete=models.CASCADE, related_name="owned_by")
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_color"
        unique_together = ("user", "color")
        verbose_name = "所持カラー"
        verbose_name_plural = "所持カラー"

    def __str__(self):
        return f"{self.user.name} - {self.color}"
