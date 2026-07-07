"""
accounts/login_bonus.py ── ログインボーナス判定ロジック（5-6・9-3参照）

判定基準日は「23時切り替え」。23:00〜翌22:59:59を1ゲーム日として扱う。
ログインAPI（accounts側のログイン処理）の最後に必ず check_and_grant_login_bonus を呼び出すこと。
"""
from datetime import timedelta

from django.conf import settings
from django.utils import timezone


def game_day(dt):
    """23時を1日の境界とする「ゲーム日」に変換する（9-3参照）"""
    return (dt - timedelta(hours=23)).date()


def check_and_grant_login_bonus(user) -> int:
    """
    ログインボーナスの判定・付与・last_login_at更新を行う。
    戻り値: 付与されたenの額（0の場合は付与なし）。
    フロント側は戻り値が0より大きい場合のみポップアップを表示する。
    """
    now = timezone.now()

    # 初回ログイン等でlast_login_atが未設定の場合は必ず付与する
    if user.last_login_at is None or game_day(user.last_login_at) != game_day(now):
        bonus_en = getattr(settings, "LOGIN_BONUS_EN", 1000)
        user.en += bonus_en
        user.last_login_at = now
        user.save(update_fields=["en", "last_login_at"])
        return bonus_en

    user.last_login_at = now
    user.save(update_fields=["last_login_at"])
    return 0
