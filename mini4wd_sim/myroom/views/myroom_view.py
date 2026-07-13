"""myroom/views/myroom_view.py ── マイルームのハブ画面（改修要件7）"""
from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def myroom_view(request):
    return render(request, "myroom/myroom.html")
