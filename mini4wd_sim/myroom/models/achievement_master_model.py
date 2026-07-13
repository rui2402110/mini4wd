"""myroom/models/achievement_master_model.py ── achievement_masterテーブル（改修要件10）"""
from django.db import models


class AchievementMaster(models.Model):
    """実績の定義（マスターデータ）。銅・銀・金の各段階は AchievementTier 側で持つ。"""

    CATEGORY_RACE = "RACE"
    CATEGORY_GARAGE = "GARAGE"
    CATEGORY_ECONOMY = "ECONOMY"
    CATEGORY_CHOICES = [
        (CATEGORY_RACE, "レース"),
        (CATEGORY_GARAGE, "ガレージ"),
        (CATEGORY_ECONOMY, "経済"),
    ]

    achievement_key = models.CharField(max_length=64, primary_key=True)
    name = models.CharField(max_length=64)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=16, choices=CATEGORY_CHOICES, default=CATEGORY_RACE)
    metric = models.CharField(
        max_length=32,
        help_text="win_count / win_count_early / win_count_steady / win_count_late / "
                   "rank34_count / races_played / colors_owned_pct / skills_owned_pct / "
                   "rate / en_holding など。進捗更新・判定ロジックがこの値で分岐する。",
    )
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = "achievement_master"
        verbose_name = "実績定義"
        verbose_name_plural = "実績定義"
        ordering = ["sort_order", "achievement_key"]

    def __str__(self):
        return f"{self.achievement_key} - {self.name}"
