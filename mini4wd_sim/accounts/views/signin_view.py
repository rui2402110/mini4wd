"""
accounts/views/signin_view.py ── 新規アカウント作成完了画面

login_view.py で名前が未登録だった場合に自動作成された直後、ここへ遷移し、
新規作成された旨とログインボーナス獲得（あれば）を案内する。
"""
from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def signin_view(request):
    bonus = request.session.pop("login_bonus_en", 0)
    is_new_account = request.session.pop("is_new_account", False)
    return render(
        request,
        "accounts/signin.html",
        {
            "user": request.user,
            "bonus_en": bonus,
            "is_new_account": is_new_account,
        },
    )
