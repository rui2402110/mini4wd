"""myroom/views/myroom_view.py ── マイルームのハブ画面（改修要件7・8）"""
import json

from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from garage.models.car_model import Car


@login_required
def myroom_view(request):
    user = request.user
    current_car = user.car or Car.objects.filter(user=user, preset_number=Car.CURRENT_PRESET_NUMBER).first()
    preview_car = None
    if current_car is not None:
        preview_car = {
            "car_name": current_car.car_name,
            "color_1": current_car.color_1.color_code,
            "color_2": current_car.color_2.color_code,
            "color_3": current_car.color_3.color_code,
            "pattern": current_car.car_type.pattern,
            "mark_color": current_car.car_type.mark_color,
        }
    return render(request, "myroom/myroom.html", {
        "preview_car_json": json.dumps(preview_car, ensure_ascii=False),
    })
