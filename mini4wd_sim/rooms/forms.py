"""rooms/forms.py ── 部屋作成フォーム"""
from django import forms


class RoomCreateForm(forms.Form):
    room_name = forms.CharField(max_length=64, label="部屋名")
    password = forms.CharField(
        max_length=64, required=False,
        label="パスワード（設定すると入室時にパスワードが必要になります）",
    )
