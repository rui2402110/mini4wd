"""
myroom/achievement_service.py ── 実績の進捗更新・解除判定ロジック（改修要件10）

・進捗更新はカテゴリ別のイベント発生時に行う。
    - レース関連: websocket/race_consumer.py の handle_race_result_report から
      update_race_progress() を呼ぶ。
    - ガレージ（ショップ）関連: garage/views/shop_view.py の api_purchase から
      update_shop_progress() を呼ぶ。
・実績の解除判定・EN付与は「実績画面を開いたタイミング」でのみ行う
  （evaluate_and_grant()）。rate/en_holding は進捗テーブルを介さず、
  Userモデルの現在値をそのまま参照する（常に最新のため進捗更新が不要）。
"""
from django.db import transaction
from django.db.models import F

from myroom.models.achievement_master_model import AchievementMaster
from myroom.models.achievement_tier_model import AchievementTier
from myroom.models.user_achievement_progress_model import UserAchievementProgress
from myroom.models.user_achievement_unlock_model import UserAchievementUnlock

# rate/en_holding はUserモデルの現在値を直接参照するため、進捗テーブルを更新しない
LIVE_METRICS = {"rate", "en_holding"}


def _bump_progress(user, achievement_key, delta=1, set_value=None):
    achievement = AchievementMaster.objects.filter(achievement_key=achievement_key).first()
    if achievement is None:
        return
    progress, _ = UserAchievementProgress.objects.get_or_create(user=user, achievement=achievement, defaults={"current_value": 0})
    if set_value is not None:
        progress.current_value = set_value
    else:
        progress.current_value = F("current_value") + delta
    progress.save()


def update_race_progress(normalized_ranking, car_snapshot):
    """
    normalized_ranking: 着順に並んだparticipant_id（Botは"BotN"文字列）
    car_snapshot: {str(participant_id): {"car_type":..,"main_skill":..,"car_name":..}}
    """
    from accounts.models.user_model import User
    from game.rate_calculator import is_bot_id

    type_metric_map = {"EARLY": "WINS_EARLY", "STEADY": "WINS_STEADY", "LATE": "WINS_LATE"}

    for idx, pid in enumerate(normalized_ranking):
        if is_bot_id(pid):
            continue
        rank = idx + 1
        user = User.objects.filter(user_id=pid).first()
        if user is None:
            continue

        _bump_progress(user, "RACES_PLAYED", delta=1)

        if rank == 1:
            _bump_progress(user, "TOTAL_WINS", delta=1)
            car_type = (car_snapshot.get(str(pid)) or {}).get("car_type")
            type_key = type_metric_map.get(car_type)
            if type_key:
                _bump_progress(user, type_key, delta=1)

        if rank in (3, 4):
            _bump_progress(user, "RANK34_COUNT", delta=1)


def update_shop_progress(user):
    """ショップでの購入直後に呼び出し、所持数の"生の個数"を進捗として保存する
    （割合換算はevaluate_and_grant側で総数を使って行う）。"""
    from garage.models.user_color_model import UserColor
    from garage.models.user_skill_model import UserSkill

    owned_colors = UserColor.objects.filter(user=user).count()
    owned_skills = UserSkill.objects.filter(user=user).count()
    _bump_progress(user, "SHOP_COLOR_PCT", set_value=owned_colors)
    _bump_progress(user, "SHOP_SKILL_PCT", set_value=owned_skills)


def evaluate_and_grant(user):
    """実績画面を開いたときに呼ぶ: 未解除tierのうち条件を満たすものを一括で解除しenを付与する"""
    from garage.models.color_model import CarColor
    from garage.models.user_color_model import UserColor
    from garage.models.user_skill_model import UserSkill
    from game.models.car_skills_model import CarSkill

    progress_map = {p.achievement_id: p.current_value for p in UserAchievementProgress.objects.filter(user=user)}
    already_unlocked_tier_ids = set(UserAchievementUnlock.objects.filter(user=user).values_list("tier_id", flat=True))
    total_colors = CarColor.objects.count() or 1
    total_skills = CarSkill.objects.count() or 1
    owned_colors = UserColor.objects.filter(user=user).count()
    owned_skills = UserSkill.objects.filter(user=user).count()

    granted_tiers = []
    total_en = 0

    with transaction.atomic():
        tiers = (
            AchievementTier.objects.select_related("achievement")
            .exclude(id__in=already_unlocked_tier_ids)
            .order_by("achievement_id", "grade")
        )
        for tier in tiers:
            metric = tier.achievement.metric
            if metric == "rate":
                value = user.rate
            elif metric == "en_holding":
                value = user.en
            elif metric == "colors_owned_pct":
                value = (owned_colors / total_colors) * 100
            elif metric == "skills_owned_pct":
                value = (owned_skills / total_skills) * 100
            else:
                value = progress_map.get(tier.achievement_id, 0)

            if value >= tier.threshold:
                UserAchievementUnlock.objects.create(user=user, tier=tier, en_granted=tier.en_reward)
                granted_tiers.append(tier)
                total_en += tier.en_reward

        if total_en > 0:
            user.en = F("en") + total_en
            user.save(update_fields=["en"])
            user.refresh_from_db(fields=["en"])

    return granted_tiers


def get_achievement_board(user):
    """実績画面表示用に、定義・段階・進捗・解除状況をまとめて返す"""
    from garage.models.color_model import CarColor
    from garage.models.user_color_model import UserColor
    from garage.models.user_skill_model import UserSkill
    from game.models.car_skills_model import CarSkill

    progress_map = {p.achievement_id: p.current_value for p in UserAchievementProgress.objects.filter(user=user)}
    unlocked_tier_ids = set(UserAchievementUnlock.objects.filter(user=user).values_list("tier_id", flat=True))
    total_colors = CarColor.objects.count() or 1
    total_skills = CarSkill.objects.count() or 1
    owned_colors = UserColor.objects.filter(user=user).count()
    owned_skills = UserSkill.objects.filter(user=user).count()

    board = []
    for achievement in AchievementMaster.objects.prefetch_related("tiers").all():
        metric = achievement.metric
        if metric == "rate":
            current_value = user.rate
        elif metric == "en_holding":
            current_value = user.en
        elif metric == "colors_owned_pct":
            current_value = round((owned_colors / total_colors) * 100, 1)
        elif metric == "skills_owned_pct":
            current_value = round((owned_skills / total_skills) * 100, 1)
        else:
            current_value = progress_map.get(achievement.achievement_key, 0)

        tiers = []
        for tier in achievement.tiers.all():
            tiers.append({
                "grade": tier.grade,
                "grade_label": tier.get_grade_display(),
                "threshold": tier.threshold,
                "en_reward": tier.en_reward,
                "unlocked": tier.id in unlocked_tier_ids,
            })
        tiers.sort(key=lambda t: AchievementTier.GRADE_ORDER.get(t["grade"], 99))

        board.append({
            "key": achievement.achievement_key,
            "name": achievement.name,
            "description": achievement.description,
            "category": achievement.get_category_display(),
            "current_value": current_value,
            "tiers": tiers,
        })
    return board
