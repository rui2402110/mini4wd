"""menu/views/menu_view.py ── メニュー画面（5-1: ショップ・ガレージ・ランキング・部屋探し・ログアウトへの導線）"""
from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def menu_view(request):
    return render(request, "menu/menu.html", {"user": request.user})
