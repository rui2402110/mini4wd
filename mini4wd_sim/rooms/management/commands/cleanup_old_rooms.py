"""
rooms/management/commands/cleanup_old_rooms.py ── 部屋の自動削除バッチ（9-1参照）

・毎日23:00にcronから実行することを想定。
・作成から ROOM_STALE_HOURS 時間以上経過した「待機中」の部屋を削除する。
・レース中の部屋はホストの結果報告 or タイムアウト処理（race_consumer側）に委ねるため対象外。
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from rooms.models.room_model import Room


class Command(BaseCommand):
    help = "作成から一定時間が経過した待機中の部屋を自動削除する（9-1参照）"

    def handle(self, *args, **options):
        hours = getattr(settings, "ROOM_STALE_HOURS", 6)
        threshold = timezone.now() - timedelta(hours=hours)

        stale_rooms = Room.objects.filter(status=Room.STATUS_WAITING, created_at__lt=threshold)
        count = stale_rooms.count()
        stale_rooms.delete()

        self.stdout.write(self.style.SUCCESS(f"{count}件の古い待機部屋を削除しました（しきい値: {hours}時間）。"))
