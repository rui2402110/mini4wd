"""
accounts/views/login_view.py ── パスワードのみでの認証（5-1）

・登録済みの名前 → パスワード照合してログイン。
・未登録の名前   → その場で新規作成し、そのままログインさせる（signin_view.pyの
                   completed画面へ遷移し、新規作成された旨を案内する）。
・ログイン成功時は必ず accounts/login_bonus.py の check_and_grant_login_bonus を呼ぶ（5-1・9-3）。
"""
from django.contrib.auth import login as auth_login
from django.shortcuts import redirect, render
from django.utils import timezone
from datetime import timedelta

from accounts.forms import LoginForm
from accounts.login_bonus import check_and_grant_login_bonus
from accounts.models.user_model import User


def login_view(request):
    if request.user.is_authenticated:
        return redirect("menu:index")

    form = LoginForm(request.POST or None)
    error = None
    is_new_account = False

    if request.method == "POST" and form.is_valid():
        name = form.cleaned_data["name"]
        password = form.cleaned_data["password"]

        try:
            user = User.objects.get(name=name)
        except User.DoesNotExist:
            user = None

        if user is None:
            # 未登録名 → 新規作成（5-1）。last_login_atは「作成日時-24時間」で初期化し、
            # 初回ログイン時に必ずログインボーナスが発生するようにする。
            user = User.objects.create_user(name=name, password=password)
            user.last_login_at = timezone.now() - timedelta(hours=24)
            user.save(update_fields=["last_login_at"])
            is_new_account = True
        else:
            if not user.check_password(password):
                error = "パスワードが正しくありません。"
                user = None

        if user is not None:
            auth_login(request, user)
            bonus = check_and_grant_login_bonus(user)
            request.session["login_bonus_en"] = bonus
            request.session["is_new_account"] = is_new_account
            if is_new_account:
                return redirect("accounts:signin")
            return redirect("menu:index")

    return render(request, "accounts/login.html", {"form": form, "error": error})
