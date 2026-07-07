"""
accounts/signals.py ── 新規ユーザー作成時の初期付与処理

新規作成直後のユーザーがガレージで何も選べず詰んでしまわないよう、
デフォルトのカラー3色・スキル3種・初期車体(preset=1, 99)を自動生成する。
設計書に明記された挙動ではないが、5-1「新規作成」を実運用可能にするための
補助処理として実装する（garage/README的な位置づけ）。
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from accounts.models.user_model import User

DEFAULT_COLOR1_HEX = "#006e40"
DEFAULT_COLOR2_HEX = "#00ee77"
DEFAULT_COLOR3_HEX = "#ffe34d"
DEFAULT_SKILLS = ["stable_tire", "tuned_form", "low_friction"]
DEFAULT_CAR_TYPE = "STEADY"


@receiver(post_save, sender=User)
def grant_starter_resources(sender, instance, created, **kwargs):
    if not created:
        return

    # 遅延import（アプリ初期化順の都合上、モジュールトップレベルでのimportを避ける）
    from game.models.car_skills_model import CarSkill
    from game.models.car_type_model import CarType
    from garage.models.car_model import Car
    from garage.models.color_model import CarColor
    from garage.models.user_color_model import UserColor
    from garage.models.user_skill_model import UserSkill

    color1, _ = CarColor.objects.get_or_create(color_code=DEFAULT_COLOR1_HEX, color_type="COLOR1", defaults={"price": 75_000})
    color2, _ = CarColor.objects.get_or_create(color_code=DEFAULT_COLOR2_HEX, color_type="COLOR2", defaults={"price": 75_000})
    color3, _ = CarColor.objects.get_or_create(color_code=DEFAULT_COLOR3_HEX, color_type="COLOR3", defaults={"price": 75_000})
    for c in (color1, color2, color3):
        UserColor.objects.get_or_create(user=instance, color=c)

    skills = []
    for skill_id in DEFAULT_SKILLS:
        skill, _ = CarSkill.objects.get_or_create(
            skill_id=skill_id,
            defaults={"name": skill_id, "effect": "", "flavor": "", "trigger": "passive", "passive": True, "params": {}, "price": 15_000},
        )
        UserSkill.objects.get_or_create(user=instance, skill=skill)
        skills.append(skill)

    car_type, _ = CarType.objects.get_or_create(
        id=DEFAULT_CAR_TYPE,
        defaults={"label": DEFAULT_CAR_TYPE, "speed_scale": [1, 1, 1, 1, 1], "battery_scale": [1, 1, 1, 1, 1]},
    )

    main_skill = skills[0] if skills else None
    sub1 = skills[1] if len(skills) > 1 else None
    sub2 = skills[2] if len(skills) > 2 else None
    if main_skill is None:
        return  # スキルマスター未投入環境では初期車体生成をスキップ（seed_master_data未実行）

    for preset_number in (1, Car.CURRENT_PRESET_NUMBER):
        Car.objects.get_or_create(
            user=instance,
            preset_number=preset_number,
            defaults={
                "car_name": instance.name[:32] or "MY-MACHINE",
                "color_1": color1, "color_2": color2, "color_3": color3,
                "main_skill": main_skill, "sub_skill_1": sub1, "sub_skill_2": sub2,
                "car_type": car_type,
            },
        )

    current_car = Car.objects.filter(user=instance, preset_number=Car.CURRENT_PRESET_NUMBER).first()
    if current_car:
        instance.car = current_car
        instance.save(update_fields=["car"])
