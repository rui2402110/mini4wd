"""accounts/views/logout_view.py ── ログアウト処理"""
from django.contrib.auth import logout as auth_logout
from django.shortcuts import render


def logout_view(request):
    if request.method == "POST":
        auth_logout(request)
        return render(request, "accounts/logout.html")
    # GETでも確認なしでログアウトさせる簡易実装（確認UIはmenu.js側のモーダルで担保する想定）
    auth_logout(request)
    return render(request, "accounts/logout.html")
