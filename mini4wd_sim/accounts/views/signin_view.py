"""
accounts/views/signin_view.py ── 新規アカウント作成完了画面

login_view.py で名前が未登録だった場合に自動作成された直後、ここへ遷移し、
新規作成された旨を案内する。ログインボーナスの付与・表示はメニュー画面側で
行う（改修要件4-4）ため、ここでは扱わない。
"""
from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def signin_view(request):
    is_new_account = request.session.pop("is_new_account", False)
    return render(
        request,
        "accounts/signin.html",
        {
            "user": request.user,
            "is_new_account": is_new_account,
        },
    )
