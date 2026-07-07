"""garage/models/user_skill_model.py ── user_skillテーブル（3章）"""
from django.conf import settings
from django.db import models


class UserSkill(models.Model):
    """設計書3章【user_skill】ユーザーのスキル所持管理（中間テーブル）"""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_skills")
    skill = models.ForeignKey("game.CarSkill", on_delete=models.CASCADE, related_name="owned_by")
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_skill"
        unique_together = ("user", "skill")
        verbose_name = "所持スキル"
        verbose_name_plural = "所持スキル"

    def __str__(self):
        return f"{self.user.name} - {self.skill.name}"
