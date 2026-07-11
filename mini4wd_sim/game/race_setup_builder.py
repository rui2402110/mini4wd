"""
game/race_setup_builder.py ── 部屋の参加者構成から car_configs を組み立てる共通ロジック

room_consumer.py（待機中のコース上プレビュー用ブロードキャスト）と
race_consumer.py（レース開始時に確定させるrace_setup）の両方から使う。
両者で車体データの組み立て方が食い違うと「待機中に見えていた車と実際に
走る車が違う」事故になるため、必ずこの関数を経由させること。
"""
from accounts.models.user_model import User
from garage.models.car_model import Car


def build_car_configs(room, store):
    """
    room: rooms.models.Room インスタンス
    store: websocket.state_store.get_store() が返すストレージ実装
    戻り値: car_config dictのリスト（人間メンバー→Botの順）
    """
    from game.bot_factory import create_bot_car  # 循環import回避のため遅延import

    car_configs = []

    member_ids = store.smembers(str(room.room_id))
    for uid in member_ids:
        user = User.objects.filter(user_id=int(uid)).select_related(
            "car", "car__color_1", "car__color_2", "car__color_3",
            "car__main_skill", "car__sub_skill_1", "car__sub_skill_2", "car__car_type",
        ).first()
        if user is None:
            continue
        car = user.car or Car.objects.filter(user=user, preset_number=Car.CURRENT_PRESET_NUMBER).first()
        if car is None:
            continue
        car_configs.append({
            "participant_id": user.user_id,
            "is_bot": False,
            "display_name": user.name,
            "car_name": car.car_name,
            "color_1": car.color_1.color_code,
            "color_2": car.color_2.color_code,
            "color_3": car.color_3.color_code,
            "main_skill": car.main_skill_id,
            "sub_skill_1": car.sub_skill_1_id,
            "sub_skill_2": car.sub_skill_2_id,
            "car_type": car.car_type_id,
            "rate": user.rate,
        })

    bot_ids = store.get_bots(str(room.room_id))
    for bot_id in bot_ids:
        bot_car = next((b for b in (room.bot_list or []) if b.get("bot_id") == bot_id), None) or create_bot_car(bot_id)
        bot_car = dict(bot_car)
        bot_car["participant_id"] = bot_id
        bot_car["is_bot"] = True
        bot_car.setdefault("display_name", bot_car.get("car_name", bot_id))
        car_configs.append(bot_car)

    return car_configs
