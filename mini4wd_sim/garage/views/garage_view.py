"""
garage/views/garage_view.py ── ガレージ画面（5-3・9-5参照）

・GET  /garage/                 : ガレージ画面表示（所持カラー・スキル・プリセット状態を埋め込む）
・POST /garage/api/save/        : プリセットへ現在の設定を保存（新規作成 or 上書き）
・POST /garage/api/equip/       : 指定プリセットの内容を「現在使用中(99)」へコピーして装備する
・POST /garage/api/delete/      : プリセットの削除（1〜4は削除不可、5以降のみ）
"""
import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from game.models.car_skills_model import CarSkill
from game.models.car_type_model import CarType
from garage.models.car_model import Car
from garage.models.color_model import CarColor
from garage.models.user_color_model import UserColor
from garage.models.user_preset_slot_model import UserPresetSlot
from garage.models.user_skill_model import UserSkill


def _owned_colors(user, color_type):
    return list(
        CarColor.objects.filter(color_type=color_type, owned_by__user=user).values_list("color_code", flat=True)
    )


def _owned_skill_ids(user):
    return list(UserSkill.objects.filter(user=user).values_list("skill_id", flat=True))


def _unlocked_preset_numbers(user):
    """1〜4は常に解放済み。5以降はUserPresetSlotに存在するもの"""
    nums = [1, 2, 3, 4]
    nums += list(UserPresetSlot.objects.filter(user=user).values_list("preset_number", flat=True))
    return sorted(set(nums))


def _serialize_car(car):
    if car is None:
        return None
    return {
        "car_name": car.car_name,
        "color_1": car.color_1.color_code,
        "color_2": car.color_2.color_code,
        "color_3": car.color_3.color_code,
        "main_skill": car.main_skill_id,
        "sub_skill_1": car.sub_skill_1_id,
        "sub_skill_2": car.sub_skill_2_id,
        "car_type": car.car_type_id,
    }


@login_required
def garage_view(request):
    user = request.user
    cars = {c.preset_number: _serialize_car(c) for c in Car.objects.filter(user=user).select_related(
        "color_1", "color_2", "color_3", "main_skill", "sub_skill_1", "sub_skill_2", "car_type"
    )}

    state = {
        "owned_colors": {
            "COLOR1": _owned_colors(user, "COLOR1"),
            "COLOR2": _owned_colors(user, "COLOR2"),
            "COLOR3": _owned_colors(user, "COLOR3"),
        },
        "owned_skill_ids": _owned_skill_ids(user),
        "unlocked_presets": _unlocked_preset_numbers(user),
        "preset_max": 5,
        "cars": cars,
        "current_preset_number": Car.CURRENT_PRESET_NUMBER,
    }
    return render_garage(request, state)


def render_garage(request, state):
    from django.shortcuts import render
    return render(request, "garage/garage.html", {"garage_state_json": json.dumps(state, ensure_ascii=False)})


@login_required
def api_list_presets(request):
    """
    race.html の CUSTOM ボタン用ポップアップが使う軽量エンドポイント（改修要件3）。
    プリセット1〜5の内容と、開放済みプリセット番号の一覧をJSONで返す。
    """
    user = request.user
    presets = {}
    for c in Car.objects.filter(user=user, preset_number__in=[1, 2, 3, 4, 5]):
        presets[c.preset_number] = _serialize_car(c)
    return JsonResponse({
        "presets": presets,
        "unlocked": _unlocked_preset_numbers(user),
    })


@login_required
@require_POST
def api_save_current(request):
    """
    現在ガレージ画面で編集中の内容を「現在使用中(99)」の車体として直接保存・装備する（改修要件3）。
    プリセット1〜5への追加登録は、この保存が成功した後にクライアント側のポップアップから
    api_save_preset を呼び出すことで行う。
    """
    user = request.user
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"ok": False, "error": "不正なリクエストです。"}, status=400)

    ok, result = _validate_and_build_car_fields(user, data)
    if not ok:
        return JsonResponse({"ok": False, "error": result}, status=400)

    current, _ = Car.objects.update_or_create(user=user, preset_number=Car.CURRENT_PRESET_NUMBER, defaults=result)
    user.car = current
    user.save(update_fields=["car"])
    return JsonResponse({"ok": True})


@login_required
@require_POST
def api_save_preset(request):
    user = request.user
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"ok": False, "error": "不正なリクエストです。"}, status=400)

    preset_number = int(data.get("preset_number", 0))
    if preset_number < 1 or preset_number == Car.CURRENT_PRESET_NUMBER:
        return JsonResponse({"ok": False, "error": "不正なプリセット番号です。"}, status=400)
    if not UserPresetSlot.is_unlocked(user, preset_number):
        return JsonResponse({"ok": False, "error": "このプリセット枠はまだ開放されていません。"}, status=403)

    ok, result = _validate_and_build_car_fields(user, data)
    if not ok:
        return JsonResponse({"ok": False, "error": result}, status=400)

    Car.objects.update_or_create(user=user, preset_number=preset_number, defaults=result)
    return JsonResponse({"ok": True})


@login_required
@require_POST
def api_delete_preset(request):
    user = request.user
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"ok": False, "error": "不正なリクエストです。"}, status=400)

    preset_number = int(data.get("preset_number", 0))
    if preset_number <= 4:
        return JsonResponse({"ok": False, "error": "プリセット1〜4は削除できません。"}, status=400)

    Car.objects.filter(user=user, preset_number=preset_number).delete()
    return JsonResponse({"ok": True})


@login_required
@require_POST
def api_equip_preset(request):
    """指定プリセットの内容を「現在使用中(99)」の車体へコピーして装備状態にする"""
    user = request.user
    try:
        data = json.loads(request.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"ok": False, "error": "不正なリクエストです。"}, status=400)

    preset_number = int(data.get("preset_number", 0))
    src = Car.objects.filter(user=user, preset_number=preset_number).first()
    if src is None:
        return JsonResponse({"ok": False, "error": "指定のプリセットが見つかりません。"}, status=404)

    current, _ = Car.objects.update_or_create(
        user=user,
        preset_number=Car.CURRENT_PRESET_NUMBER,
        defaults={
            "car_name": src.car_name,
            "color_1": src.color_1, "color_2": src.color_2, "color_3": src.color_3,
            "main_skill": src.main_skill, "sub_skill_1": src.sub_skill_1, "sub_skill_2": src.sub_skill_2,
            "car_type": src.car_type,
        },
    )
    user.car = current
    user.save(update_fields=["car"])
    return JsonResponse({"ok": True})


def _validate_and_build_car_fields(user, data):
    """カラー/スキルの所持チェックを行い、Car.objects.update_or_create用のdefaultsを構築する"""
    car_name = str(data.get("car_name", "")).strip()[:32] or "NO NAME"

    def _color(color_hex, color_type):
        color = CarColor.objects.filter(color_code=color_hex, color_type=color_type).first()
        if color is None or not UserColor.objects.filter(user=user, color=color).exists():
            return None
        return color

    color_1 = _color(data.get("color_1"), "COLOR1")
    color_2 = _color(data.get("color_2"), "COLOR2")
    color_3 = _color(data.get("color_3"), "COLOR3")
    if not (color_1 and color_2 and color_3):
        return False, "所持していないカラーが指定されています。"

    def _skill(skill_id):
        if not skill_id:
            return None
        skill = CarSkill.objects.filter(skill_id=skill_id).first()
        if skill is None or not UserSkill.objects.filter(user=user, skill=skill).exists():
            return None, True
        return skill

    main_skill = CarSkill.objects.filter(skill_id=data.get("main_skill")).first()
    if main_skill is None or not UserSkill.objects.filter(user=user, skill=main_skill).exists():
        return False, "所持していないメインスキルが指定されています。"

    sub_skill_1 = None
    if data.get("sub_skill_1"):
        sub_skill_1 = CarSkill.objects.filter(skill_id=data.get("sub_skill_1")).first()
        if sub_skill_1 is None or not UserSkill.objects.filter(user=user, skill=sub_skill_1).exists():
            return False, "所持していないサブスキル1が指定されています。"

    sub_skill_2 = None
    if data.get("sub_skill_2"):
        sub_skill_2 = CarSkill.objects.filter(skill_id=data.get("sub_skill_2")).first()
        if sub_skill_2 is None or not UserSkill.objects.filter(user=user, skill=sub_skill_2).exists():
            return False, "所持していないサブスキル2が指定されています。"

    car_type = CarType.objects.filter(id=data.get("car_type")).first()
    if car_type is None:
        return False, "不正な車種タイプです。"

    return True, {
        "car_name": car_name,
        "color_1": color_1, "color_2": color_2, "color_3": color_3,
        "main_skill": main_skill, "sub_skill_1": sub_skill_1, "sub_skill_2": sub_skill_2,
        "car_type": car_type,
    }
