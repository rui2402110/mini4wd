"""rooms/models/room_model.py ── roomテーブル（3章）"""
import uuid

from django.conf import settings
from django.db import models


def generate_room_id() -> str:
    return uuid.uuid4().hex


class Room(models.Model):
    """
    設計書3章【room】部屋管理テーブル。
    リアルタイムな一時ステータス（入室者・準備完了状態）はRedisで管理する（5-4・9-7参照）ため、
    このモデルは「永続化すべき部屋の基本情報」のみを持つ。
    bot_list / current_race_setup は実運用上DB永続化が必須ではないが、
    ホスト権威方式でのrace_setup受け渡しを簡潔にするためJSONFieldとして保持する。
    """
    STATUS_WAITING = "WAITING"
    STATUS_RACING = "RACING"
    STATUS_CHOICES = [
        (STATUS_WAITING, "待機中"),
        (STATUS_RACING, "レース中"),
    ]

    room_id = models.CharField(max_length=36, primary_key=True, default=generate_room_id, editable=False)
    host_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="hosted_rooms",
        verbose_name="ホストユーザー",
    )
    room_name = models.CharField(max_length=64)
    is_public = models.BooleanField(default=True)
    password = models.CharField(max_length=64, null=True, blank=True, help_text="パス付き部屋用（null許容）")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_WAITING)
    created_at = models.DateTimeField(auto_now_add=True)

    # ── 実装補助フィールド（「その他必要ファイル」範囲での追加。DB上必須ではない） ──
    bot_list = models.JSONField(default=list, blank=True, help_text='現在のBotリスト（例: ["Bot1","Bot2"]）')
    current_race_setup = models.JSONField(
        null=True, blank=True,
        help_text="race_consumer.send_race_setup()が生成した race_seed/car_configs/参加者対応表",
    )

    class Meta:
        db_table = "room"
        verbose_name = "部屋"
        verbose_name_plural = "部屋"

    def __str__(self):
        return f"{self.room_name} ({self.room_id})"

    @property
    def has_password(self):
        return bool(self.password)
