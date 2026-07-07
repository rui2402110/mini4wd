"""accounts/views/index_view.py ── トップページ（未ログイン時のエントリーポイント）"""
from django.shortcuts import redirect, render


def index_view(request):
    if request.user.is_authenticated:
        return redirect("menu:index")
    return render(request, "accounts/index.html")
