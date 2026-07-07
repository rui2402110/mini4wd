"""game/models/result_model.py ── resultテーブル（3章）"""
from django.conf import settings
from django.db import models


class Result(models.Model):
    """設計書3章【result】ゲームの記録。6-3のrace_result_reportを正として保存する。"""

    result_id = models.BigAutoField(primary_key=True)
    room = models.ForeignKey(
        "rooms.Room",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="results",
        help_text="部屋削除後も記録は残すためSET_NULL",
    )
    play_member = models.JSONField(help_text='参加者ID配列。Botの場合は"Bot1"等の名前を格納')
    rank = models.JSONField(help_text="順位を記録（play_member順 or 別途順位配列）")
    car_data = models.JSONField(help_text="順位順に車のIDを記録")
    bet = models.JSONField(help_text="順位順の賭けの受け渡し結果")
    rate = models.JSONField(help_text="レートの変動結果 {user_id: delta}")
    race_seed = models.BigIntegerField(help_text="レース開始時にサーバーが払い出した乱数シード")
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reported_results",
        help_text="この結果を報告したホストのuser_id（不正調査用）",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "result"
        verbose_name = "レース結果"
        verbose_name_plural = "レース結果"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Result#{self.result_id} ({self.created_at:%Y-%m-%d %H:%M})"
