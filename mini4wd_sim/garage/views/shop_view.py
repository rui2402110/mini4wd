"""
garage/views/shop_view.py ── ショップ画面（5-3・9-6・9-8参照）

固定価格:
  カラー: 75,000 en / スキル: 15,000 en / プリセット枠(5枠目以降): 150,000 en
購入は「まとめ買い・オールオアナッシング」方式（9-6）:
  カート内の合計金額がenを超える場合は1件も購入せず全体を失敗させる。
"""
import json

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

from game.models.car_skills_model import CarSkill
from game.models.car_type_model import CarType
from garage.models.car_model import Car
from garage.models.color_model import CarColor
from garage.models.user_color_model import UserColor
from garage.models.user_preset_slot_model import UserPresetSlot
from garage.models.user_skill_model import UserSkill


@login_required
def shop_view(request):
    user = request.user
    owned_color_codes = set(CarColor.objects.filter(owned_by__user=user).values_list("color_id", flat=True))
    owned_skill_ids = set(UserSkill.objects.filter(user=user).values_list("skill_id", flat=True))
    unlocked_presets = set(UserPresetSlot.objects.filter(user=user).values_list("preset_number", flat=True))

    colors = [
        {"color_id": c.color_id, "color_code": c.color_code, "color_type": c.color_type, "price": c.price, "owned": c.color_id in owned_color_codes}
        for c in CarColor.objects.all().order_by("color_type", "color_id")
    ]
    skills = [
        {"skill_id": s.skill_id, "name": s.name, "effect": s.effect, "price": s.price, "owned": s.skill_id in owned_skill_ids}
        for s in CarSkill.objects.all().order_by("skill_id")
    ]
    # プリセット枠は5番目から購入可能（無制限に増やせるが、UIでは次の1枠のみ提示する）
    next_preset_number = 5
    while next_preset_number in unlocked_presets:
        next_preset_number += 1

    # ── 左側3Dプレビュー用: 現在装備中の車体情報（改修要件5） ──
    current_car = user.car or Car.objects.filter(user=user, preset_number=Car.CURRENT_PRESET_NUMBER).first()
    preview_car = None
    if current_car is not None:
        preview_car = {
            "car_name": current_car.car_name,
            "color_1": current_car.color_1.color_code,
            "color_2": current_car.color_2.color_code,
            "color_3": current_car.color_3.color_code,
            "car_type": current_car.car_type_id,
            "pattern": current_car.car_type.pattern,
            "mark_color": current_car.car_type.mark_color,
        }

    shop_state = {
        "colors": colors,
        "skills": skills,
        "next_preset_number": next_preset_number,
        "preset_slot_price": settings.PRESET_SLOT_PRICE_EN,
        "color_price": settings.COLOR_PRICE_EN,
        "skill_price": settings.SKILL_PRICE_EN,
        "user_en": user.en,
        "preview_car": preview_car,
    }
    return render(request, "garage/shop.html", {"shop_state_json": json.dumps(shop_state, ensure_ascii=False)})


@login_required
@require_POST
def api_purchase(request):
    """
    まとめ買い・オールオアナッシング方式（9-6参照）。
    body: {"colors": [color_id, ...], "skills": [skill_id, ...], "preset_slot": true/false}
    """
    user = request.user
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"ok": False, "error": "不正なリクエストです。"}, status=400)

    color_ids = data.get("colors", []) or []
    skill_ids = data.get("skills", []) or []
    want_preset_slot = bool(data.get("preset_slot", False))

    colors = list(CarColor.objects.filter(color_id__in=color_ids))
    skills = list(CarSkill.objects.filter(skill_id__in=skill_ids))

    already_owned_colors = set(UserColor.objects.filter(user=user, color__in=colors).values_list("color_id", flat=True))
    already_owned_skills = set(UserSkill.objects.filter(user=user, skill__in=skills).values_list("skill_id", flat=True))

    new_colors = [c for c in colors if c.color_id not in already_owned_colors]
    new_skills = [s for s in skills if s.skill_id not in already_owned_skills]

    total = sum(c.price for c in new_colors) + sum(s.price for s in new_skills)
    next_preset_number = None
    if want_preset_slot:
        unlocked = set(UserPresetSlot.objects.filter(user=user).values_list("preset_number", flat=True))
        next_preset_number = 5
        while next_preset_number in unlocked:
            next_preset_number += 1
        total += UserPresetSlot.PRICE_EN

    if total <= 0:
        return JsonResponse({"ok": False, "error": "購入対象がありません（すでに所持している可能性があります）。"}, status=400)

    if user.en < total:
        return JsonResponse({"ok": False, "error": f"enが不足しています（必要:{total} / 所持:{user.en}）。", "required": total}, status=402)

    with transaction.atomic():
        user.en -= total
        user.save(update_fields=["en"])
        for c in new_colors:
            UserColor.objects.get_or_create(user=user, color=c)
        for s in new_skills:
            UserSkill.objects.get_or_create(user=user, skill=s)
        if want_preset_slot and next_preset_number is not None:
            UserPresetSlot.objects.get_or_create(user=user, preset_number=next_preset_number)

    return JsonResponse({"ok": True, "spent": total, "remaining_en": user.en})
