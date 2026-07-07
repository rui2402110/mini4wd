"""
game/bot_factory.py ── Bot車体データ生成ロジック（5-5・9-2参照）

・あくまで「車体設定データを作るだけ」の処理であり、実際にそのBotを走らせる計算は
  各クライアントのgame.jsが行う（6章参照）。DBには保存しない。
"""
import random

from accounts.models.user_model import User
from garage.models.car_model import Car


def create_bot_car(bot_name: str) -> dict:
    """
    9-2の手順:
      1. rankingsのレート上位10件（rate降順）からランダムに1ユーザーの
         現在装備車体(preset_number=99)を取得する。
      2. car_name・color_1〜3・main_skill・sub_skill_1〜2・car_typeをそのままコピーし、
         一時的な車体設定データ（メモリ上のdict）として生成する。
      3. car_nameはそのままの名前を使う（UI側でBOTバッジにより区別する）。
      4. race_setupのcar_configsに含めて配信する（本関数はdictを返すのみ）。
    """
    top_users = list(
        User.objects.filter(car__isnull=False).order_by("-rate")[:10]
    )
    if not top_users:
        # 上位データが無い場合のフォールバック（初期状態等）
        return _fallback_bot_car(bot_name)

    src_user = random.choice(top_users)
    car = Car.objects.filter(user=src_user, preset_number=99).first()
    if car is None:
        return _fallback_bot_car(bot_name)

    return {
        "bot_id": bot_name,
        "is_bot": True,
        "car_name": car.car_name,
        "color_1": car.color_1.color_code if car.color_1 else "#ffffff",
        "color_2": car.color_2.color_code if car.color_2 else "#ffffff",
        "color_3": car.color_3.color_code if car.color_3 else "#ffffff",
        "main_skill": car.main_skill_id,
        "sub_skill_1": car.sub_skill_1_id,
        "sub_skill_2": car.sub_skill_2_id,
        "car_type": car.car_type_id,
    }


def _fallback_bot_car(bot_name: str) -> dict:
    """マスターデータ未投入時などの保険用フォールバックBot車体"""
    return {
        "bot_id": bot_name,
        "is_bot": True,
        "car_name": bot_name.upper(),
        "color_1": "#555555",
        "color_2": "#aaaaaa",
        "color_3": "#ffffff",
        "main_skill": "stable_tire",
        "sub_skill_1": "tuned_form",
        "sub_skill_2": "low_friction",
        "car_type": "STEADY",
    }


def remove_all_bots(room):
    """レース終了後のBot一括削除（Botは部屋のBotリストに一時的に保持されているだけなので単純にクリアする）"""
    room.bot_list = []
    room.save(update_fields=["bot_list"])
