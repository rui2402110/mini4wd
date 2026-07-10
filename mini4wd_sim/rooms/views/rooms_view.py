"""
rooms/views/rooms_view.py ── 部屋探し・部屋作成画面（5-4参照）

ロビー画面は設計書に存在しないため廃止（改修要件2）。作成・入室のいずれも
直接 game:race （race.html）へ遷移する。メンバー管理はrace.html内から
websocket/room_consumer.py(Redis)へ接続して行う。
"""
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render

from rooms.forms import RoomCreateForm
from rooms.models.room_model import Room


@login_required
def rooms_list_view(request):
    q = request.GET.get("q", "").strip()
    # 「非公開」はパスワードが無ければ入室できないという意味であり、一覧から
    # 隠すという意味ではない（改修要件3）。is_publicでの絞り込みは行わない。
    rooms = Room.objects.filter(status=Room.STATUS_WAITING).order_by("-created_at")
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
        rooms = Room.objects.filter(status=Room.STATUS_WAITING).order_by("-created_at")[:100]
        return render(request, "rooms/rooms.html", {"rooms": rooms, "form": form, "query": ""})

    room = Room.objects.create(
        host_user=request.user,
        room_name=form.cleaned_data["room_name"],
        password=form.cleaned_data.get("password") or None,
    )
    return redirect("game:race", room_id=room.room_id)
