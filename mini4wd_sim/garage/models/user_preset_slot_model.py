"""garage/models/user_preset_slot_model.py ── user_preset_slotテーブル（3章・v1.3追加、9-8参照）"""
from django.conf import settings
from django.db import models


class UserPresetSlot(models.Model):
    """
    設計書3章【user_preset_slot】ユーザーのプリセット枠所持管理（中間テーブル）。
    プリセット1〜4は初期状態から全員が使用可能。5枠目以降はここにレコードが
    存在するかどうかで開放判定を行う（9-8参照）。価格は一律150,000 en。
    """
    PRICE_EN = 150_000

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="preset_slots")
    preset_number = models.IntegerField(help_text="開放したプリセット番号（5以降）")
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_preset_slot"
        unique_together = ("user", "preset_number")
        verbose_name = "プリセット枠"
        verbose_name_plural = "プリセット枠"

    def __str__(self):
        return f"{self.user.name} - preset#{self.preset_number}"

    @staticmethod
    def is_unlocked(user, preset_number: int) -> bool:
        """プリセット1〜4は常に解放済み。5以降はuser_preset_slotの存在で判定する。"""
        if preset_number <= 4:
            return True
        return UserPresetSlot.objects.filter(user=user, preset_number=preset_number).exists()
