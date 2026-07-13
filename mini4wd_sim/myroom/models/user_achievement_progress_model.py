"""myroom/models/user_achievement_progress_model.py ── user_achievement_progressテーブル（改修要件10）"""
from django.conf import settings
from django.db import models


class UserAchievementProgress(models.Model):
    """ユーザーごとの実績進捗（現在値）。カウント系メトリクスのみここで管理し、
    rate/en_holding のようにUserテーブルの現在値をそのまま参照できるメトリクスは
    参照時に直接読み取るため、このテーブルには書き込まない（myroom/achievement_service.py参照）。"""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="achievement_progresses")
    achievement = models.ForeignKey("myroom.AchievementMaster", on_delete=models.CASCADE, related_name="progresses")
    current_value = models.FloatField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_achievement_progress"
        unique_together = ("user", "achievement")
        verbose_name = "実績進捗"
        verbose_name_plural = "実績進捗"

    def __str__(self):
        return f"{self.user.name} - {self.achievement_id}: {self.current_value}"
