"""myroom/models/achievement_tier_model.py ── achievement_tierテーブル（改修要件10）"""
from django.db import models


class AchievementTier(models.Model):
    """実績の段階（銅・銀・金それぞれの閾値と報酬）"""

    GRADE_BRONZE = "BRONZE"
    GRADE_SILVER = "SILVER"
    GRADE_GOLD = "GOLD"
    GRADE_CHOICES = [
        (GRADE_BRONZE, "銅"),
        (GRADE_SILVER, "銀"),
        (GRADE_GOLD, "金"),
    ]
    GRADE_ORDER = {GRADE_BRONZE: 0, GRADE_SILVER: 1, GRADE_GOLD: 2}

    achievement = models.ForeignKey(
        "myroom.AchievementMaster", on_delete=models.CASCADE, related_name="tiers",
    )
    grade = models.CharField(max_length=10, choices=GRADE_CHOICES)
    threshold = models.FloatField(help_text="解除に必要な値（メトリクスにより回数・%・レート値等）")
    en_reward = models.BigIntegerField(help_text="達成時に貰えるen（銅=30000/銀=100000/金=1000000）")

    class Meta:
        db_table = "achievement_tier"
        unique_together = ("achievement", "grade")
        verbose_name = "実績段階"
        verbose_name_plural = "実績段階"

    def __str__(self):
        return f"{self.achievement_id} [{self.get_grade_display()}] >= {self.threshold}"
