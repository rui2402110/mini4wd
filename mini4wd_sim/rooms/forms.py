"""rooms/forms.py ── 部屋作成フォーム"""
from django import forms


class RoomCreateForm(forms.Form):
    room_name = forms.CharField(max_length=64, label="部屋名")
    is_public = forms.BooleanField(required=False, initial=True, label="公開部屋にする")
    password = forms.CharField(max_length=64, required=False, label="パスワード（非公開の場合）")
