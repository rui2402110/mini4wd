"""garage/models/car_model.py ── carテーブル（3章）"""
from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models

halfwidth_car_name_validator = RegexValidator(
    regex=r"^[A-Za-z0-9_\-\.]{1,32}$",
    message="車名は半角英数字・記号(_-.)のみ、32字以下で入力してください。",
)


class Car(models.Model):
    """
    設計書3章【car】ユーザーが登録している車のテーブル。
    preset_number: 1〜4は初期解放済み、5以降はuser_preset_slotで購入判定、
                   99は「現在使用中の車体」を表す特別値（9-5参照）。
    """
    CURRENT_PRESET_NUMBER = 99

    car_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cars",
        verbose_name="所有ユーザー",
    )
    preset_number = models.IntegerField(help_text="1〜4:初期プリセット / 5以降:購入制 / 99:現在使用中")
    car_name = models.CharField(max_length=32, validators=[halfwidth_car_name_validator])

    color_1 = models.ForeignKey("garage.CarColor", on_delete=models.PROTECT, related_name="+", verbose_name="ボディカラー")
    color_2 = models.ForeignKey("garage.CarColor", on_delete=models.PROTECT, related_name="+", verbose_name="アクセントカラー")
    color_3 = models.ForeignKey("garage.CarColor", on_delete=models.PROTECT, related_name="+", verbose_name="マークカラー")

    main_skill = models.ForeignKey("game.CarSkill", on_delete=models.PROTECT, related_name="+", verbose_name="メインスキル")
    sub_skill_1 = models.ForeignKey("game.CarSkill", on_delete=models.PROTECT, related_name="+", null=True, blank=True, verbose_name="サブスキル1")
    sub_skill_2 = models.ForeignKey("game.CarSkill", on_delete=models.PROTECT, related_name="+", null=True, blank=True, verbose_name="サブスキル2")

    car_type = models.ForeignKey("game.CarType", on_delete=models.PROTECT, related_name="cars", verbose_name="戦略タイプ")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "car"
        unique_together = ("user", "preset_number")
        verbose_name = "車体"
        verbose_name_plural = "車体"

    def __str__(self):
        return f"{self.car_name} ({self.user.name} #{self.preset_number})"

    @property
    def is_current(self):
        return self.preset_number == self.CURRENT_PRESET_NUMBER
