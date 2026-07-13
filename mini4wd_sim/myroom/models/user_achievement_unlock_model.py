"""myroom/models/user_achievement_unlock_model.py ── user_achievement_unlockテーブル（改修要件10）"""
from django.conf import settings
from django.db import models


class UserAchievementUnlock(models.Model):
    """ユーザーの実績達成履歴。達成時に付与されたenをスナップショットとして保持することで、
    後からen_rewardの設定を変更しても過去の記録・収支と矛盾しないようにする。"""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="achievement_unlocks")
    tier = models.ForeignKey("myroom.AchievementTier", on_delete=models.CASCADE, related_name="unlocks")
    achieved_at = models.DateTimeField(auto_now_add=True)
    en_granted = models.BigIntegerField(default=0)

    class Meta:
        db_table = "user_achievement_unlock"
        unique_together = ("user", "tier")
        verbose_name = "実績達成履歴"
        verbose_name_plural = "実績達成履歴"
        ordering = ["-achieved_at"]

    def __str__(self):
        return f"{self.user.name} - {self.tier} ({self.achieved_at:%Y-%m-%d})"
