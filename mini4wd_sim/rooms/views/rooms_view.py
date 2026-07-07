"""
rooms/views/rooms_view.py ── 部屋探し・部屋作成・部屋ロビー画面（5-4参照）

リアルタイムな入室者・準備状態はwebsocket/room_consumer.py(Redis)側で管理するため、
本ビューはDB上の部屋一覧の検索・作成・入室可否判定のみを担当する。
"""
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from rooms.forms import RoomCreateForm
from rooms.models.room_model import Room


@login_required
def rooms_list_view(request):
    q = request.GET.get("q", "").strip()
    rooms = Room.objects.filter(status=Room.STATUS_WAITING, is_public=True).order_by("-created_at")
    if q:
        rooms = rooms.filter(room_name__icontains=q)

    form = RoomCreateForm()
    return render(request, "rooms/rooms.html", {"rooms": rooms[:100], "form": form, "query": q})


@login_required
def create_room_view(request):
    if request.method != "POST":
        return redirect("rooms:index")

    form = RoomCreateForm(request.POST)
    if not form.is_valid():
        rooms = Room.objects.filter(status=Room.STATUS_WAITING, is_public=True).order_by("-created_at")[:100]
        return render(request, "rooms/rooms.html", {"rooms": rooms, "form": form, "query": ""})

    room = Room.objects.create(
        host_user=request.user,
        room_name=form.cleaned_data["room_name"],
        is_public=form.cleaned_data["is_public"],
        password=form.cleaned_data.get("password") or None,
    )
    return redirect("rooms:lobby", room_id=room.room_id)


@login_required
def room_lobby_view(request, room_id):
    room = get_object_or_404(Room, room_id=room_id)
    if room.status == Room.STATUS_RACING:
        return redirect("game:race", room_id=room.room_id)

    if room.has_password:
        supplied = request.GET.get("password", "")
        if supplied != room.password and room.host_user_id != request.user.user_id:
            return render(request, "rooms/lobby.html", {"room": room, "need_password": True})

    return render(request, "rooms/lobby.html", {"room": room, "need_password": False})
