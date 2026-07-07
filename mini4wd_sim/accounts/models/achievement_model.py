"""accounts/models/achievement_model.py ── achievementテーブル（3章）"""
from django.conf import settings
from django.db import models


class Achievement(models.Model):
    """設計書3章【achievement】ゲームをこなすことで得られる実績テーブル"""

    GRADE_BRONZE = "BRONZE"
    GRADE_SILVER = "SILVER"
    GRADE_GOLD = "GOLD"
    GRADE_CHOICES = [
        (GRADE_BRONZE, "銅"),
        (GRADE_SILVER, "銀"),
        (GRADE_GOLD, "金"),
    ]

    achievement_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="achievements",
        verbose_name="ユーザー",
    )
    # 実績の種類を識別するコード（例: "WIN_10_RACES"）。同一ユーザー内で一意。
    achievement_key = models.CharField(max_length=64)
    grade = models.CharField(max_length=10, choices=GRADE_CHOICES, default=GRADE_BRONZE)
    en = models.IntegerField(default=0, verbose_name="達成時に付与されるen")
    achieve_bool = models.BooleanField(default=False, verbose_name="達成済みかどうか")
    achieved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "achievement"
        unique_together = ("user", "achievement_key")
        verbose_name = "実績"
        verbose_name_plural = "実績"

    def __str__(self):
        return f"{self.user.name} - {self.achievement_key} ({self.get_grade_display()})"
