"""
myroom/management/commands/seed_achievements.py ── 実績マスターデータ投入バッチ

`python manage.py seed_achievements` で実行する。
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from myroom.models.achievement_master_model import AchievementMaster
from myroom.models.achievement_tier_model import AchievementTier

EN_BRONZE, EN_SILVER, EN_GOLD = 30_000, 100_000, 1_000_000

# (achievement_key, name, category, metric, description, sort_order, (bronze, silver, gold))
ACHIEVEMENTS = [
    (
        "TOTAL_WINS", "累計勝利数", AchievementMaster.CATEGORY_RACE, "win_count",
        "暇人カウント。暇つぶしにすら本気になれない奴がいつ本気を出せるというのか。",
        10, (10, 100, 10000),
    ),
    (
        "WINS_EARLY", "逃げ切り型勝利数", AchievementMaster.CATEGORY_RACE, "win_count_early",
        "アグレッシブで勝利に貪欲な者に与える実績。こだわりの戦い方は生き様を表す。",
        20, (5, 50, 10000),
    ),
    (
        "WINS_STEADY", "中盤重視型勝利数", AchievementMaster.CATEGORY_RACE, "win_count_steady",
        "安定した勝利を求め、ペース配分に優れたものの持つ実績。こだわりの戦い方は生き様を表す。",
        30, (5, 50, 10000),
    ),
    (
        "WINS_LATE", "追い込み型勝利数", AchievementMaster.CATEGORY_RACE, "win_count_late",
        "窮地からの大逆転を追い求め、誰よりも手に汗を握りこんだ者に与える実績。こだわりの戦い方は生き様を表す。",
        40, (5, 50, 10000),
    ),
    (
        "RANK34_COUNT", "3〜4位数", AchievementMaster.CATEGORY_RACE, "rank34_count",
        "顔に泥のついた者に与える実績。誰よりも探求したという思い出の証。",
        50, (1, 100, 10000),
    ),
    (
        "SHOP_COLOR_PCT", "ショップカラー購入数", AchievementMaster.CATEGORY_GARAGE, "colors_owned_pct",
        "誰よりも自己表現にこだわった者に与える実績。洒落た人間であれ。",
        60, (5, 50, 100),
    ),
    (
        "SHOP_SKILL_PCT", "ショップスキル購入数", AchievementMaster.CATEGORY_GARAGE, "skills_owned_pct",
        "誰よりも最強を追い求めた者に与える実績。全てを自分の眼で確認することの強さを知る者。",
        70, (5, 50, 100),
    ),
    (
        "RATE_REACHED", "レート達成数", AchievementMaster.CATEGORY_RACE, "rate",
        "誰よりも勝ち抜いた者に与える実績。勝ち続けることは強者の証。",
        80, (1550, 2000, 9000),
    ),
    (
        "EN_HOLDING", "ENの所持実績", AchievementMaster.CATEGORY_ECONOMY, "en_holding",
        "誰よりも勝負強い者に与える実績。相手から金を引き吊り出せ。",
        90, (1500, 1_000_000, 999_999_999),
    ),
    # ── 独断で追加した実績 ──
    (
        "RACES_PLAYED", "累計参加数", AchievementMaster.CATEGORY_RACE, "races_played",
        "とにかく走った証。初陣から千戦錬磨まで、積み重ねた周回数がお前の歴史だ。",
        5, (1, 50, 1000),
    ),
]


class Command(BaseCommand):
    help = "実績マスターデータ（achievement_master / achievement_tier）を投入する（改修要件10）"

    @transaction.atomic
    def handle(self, *args, **options):
        created_master = 0
        created_tier = 0
        for key, name, category, metric, description, sort_order, (bronze, silver, gold) in ACHIEVEMENTS:
            master, created = AchievementMaster.objects.update_or_create(
                achievement_key=key,
                defaults={
                    "name": name, "category": category, "metric": metric,
                    "description": description, "sort_order": sort_order,
                },
            )
            created_master += int(created)

            for grade, threshold, en_reward in (
                (AchievementTier.GRADE_BRONZE, bronze, EN_BRONZE),
                (AchievementTier.GRADE_SILVER, silver, EN_SILVER),
                (AchievementTier.GRADE_GOLD, gold, EN_GOLD),
            ):
                _, created = AchievementTier.objects.update_or_create(
                    achievement=master, grade=grade,
                    defaults={"threshold": threshold, "en_reward": en_reward},
                )
                created_tier += int(created)

        self.stdout.write(self.style.SUCCESS(
            f"実績マスターデータ投入完了: achievements(+{created_master}) / tiers(+{created_tier})"
        ))
