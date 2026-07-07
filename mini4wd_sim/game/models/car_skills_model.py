"""game/models/car_skills_model.py ── car_skillsテーブル（3章）"""
from django.db import models


class CarSkill(models.Model):
    """
    設計書3章【car_skills】スキルのマスターテーブル。
    params にはskills.js/data.jsのSKILLS_DATA相当の具体的パラメータをJSONで保持する。
    価格は一律15,000 en（9-6・5-3参照）。
    """
    skill_id = models.CharField(max_length=64, primary_key=True, help_text="例: boost_lap5")
    name = models.CharField(max_length=64)
    effect = models.TextField(help_text="効果の説明文")
    flavor = models.TextField(blank=True, help_text="フレーバー文章")
    trigger = models.CharField(max_length=64, help_text="発動条件（例: lap5_start, passive, race_start等）")
    passive = models.BooleanField(default=False)
    params = models.JSONField(default=dict, help_text="具体的な効果と数値")
    price = models.IntegerField(default=15_000)

    class Meta:
        db_table = "car_skills"
        verbose_name = "スキル"
        verbose_name_plural = "スキル"

    def __str__(self):
        return f"{self.skill_id} - {self.name}"
