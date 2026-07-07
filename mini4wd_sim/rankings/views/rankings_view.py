"""rankings/views/rankings_view.py ── レートランキング画面（5-1参照）"""
import json

from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from accounts.models.user_model import User
from garage.models.car_model import Car


def _hex_to_int(code, fallback=0xffffff):
    if not code:
        return fallback
    try:
        return int(code.lstrip("#"), 16)
    except ValueError:
        return fallback


@login_required
def rankings_view(request):
    users = User.objects.order_by("-rate")[:500]
    ranking_data = []
    for u in users:
        car = u.car or Car.objects.filter(user=u, preset_number=Car.CURRENT_PRESET_NUMBER).first()
        if car is None:
            continue
        ranking_data.append({
            "name": car.car_name,
            "player": u.name,
            "type": car.car_type_id,
            "bodyCol": _hex_to_int(car.color_1.color_code, 0x888888),
            "accentCol": _hex_to_int(car.color_2.color_code, 0xffffff),
            "stripeCol": _hex_to_int(car.color_3.color_code, 0xdddddd),
            "skill": car.main_skill_id,
            "subSkills": [s for s in [car.sub_skill_1_id, car.sub_skill_2_id] if s],
            "rate": u.rate,
            "isUser": (u.user_id == request.user.user_id),
        })

    return render(request, "rankings/rankings.html", {"ranking_data_json": json.dumps(ranking_data, ensure_ascii=False)})
