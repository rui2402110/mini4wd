"""
menu/views/menu_view.py ── メニュー画面（5-1: ショップ・ガレージ・ランキング・部屋探し・ログアウトへの導線）

改修要件4-4: ログインボーナスの判定・付与はこの画面に遷移したタイミングで行う
（最終ログイン日時が「今日」でなければ付与し、last_login_atを現在時刻に更新する）。
以前はログイン画面側で行っていたが、メニュー画面側に一本化した。
"""
from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from accounts.login_bonus import check_and_grant_login_bonus


@login_required
def menu_view(request):
    bonus_en = check_and_grant_login_bonus(request.user)
    return render(request, "menu/menu.html", {"user": request.user, "bonus_en": bonus_en})
