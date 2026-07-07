"""accounts/forms.py ── ログイン・新規作成共用フォーム（5-1: パスワードのみ認証）"""
from django import forms

from .models.user_model import validate_halfwidth_name


class LoginForm(forms.Form):
    """
    パスワードのみでの認証フォーム。
    未登録の名前が入力された場合は、accounts/views/login_view.py 側で新規作成する。
    """
    name = forms.CharField(
        max_length=32,
        validators=[validate_halfwidth_name],
        widget=forms.TextInput(attrs={"placeholder": "半角英数字のユーザー名", "autocomplete": "username"}),
        label="ユーザー名",
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={"autocomplete": "current-password"}),
        label="パスワード",
    )
