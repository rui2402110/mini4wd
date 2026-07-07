"""
game/management/commands/seed_master_data.py ── マスターデータ投入バッチ

data.js（SKILLS_DATA / CAR_TYPES / COLOR*_PRESETS）と同内容を
car_skills / car_type / car_color テーブルへ投入する。
`python manage.py seed_master_data` で実行する。
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from game.models.car_skills_model import CarSkill
from game.models.car_type_model import CarType
from garage.models.color_model import CarColor

SKILLS_DATA = [
    {"id": "boost_lap5", "name": "追い込みブースト", "effect": "5ラップ目に速度+36%", "flavor": "違法。爆走しよう。", "trigger": "lap5_start", "passive": False, "params": {"lap5SpeedBonus": 0.36}},
    {"id": "low_friction", "name": "低摩擦タイヤ", "effect": "コーナー減速を15%→1%に抑える", "flavor": "違法。コーナーで差をつけよう。", "trigger": "passive", "passive": True, "params": {"cornerReduction": 0.001}},
    {"id": "mud_trap", "name": "イカサマ重馬場", "effect": "他車の各レーンに泥ゾーン×8、通過-40%減速+バッテリー5%消費", "flavor": "違法。戦いは始まる前から始まっている。", "trigger": "race_start", "passive": False, "params": {"mudSlowdown": 0.40, "mudCount": 5, "battDrain": 8}},
    {"id": "illegal_batt", "name": "違法バッテリー", "effect": "残量5%以下で100%回復（1回）", "flavor": "違法。エリクサーと違って勝手に消費される。", "trigger": "battery_low", "passive": False, "params": {"threshold": 5, "recover": 100}},
    {"id": "tuned_form", "name": "改造フォルム", "effect": "全ラップ速度+10%", "flavor": "違法。ヤスリで削ってお手入れしよう。", "trigger": "passive", "passive": True, "params": {"speedBonus": 0.1}},
    {"id": "reversal_motor", "name": "逆転モーター", "effect": "3位以下で4ラップ通過時、バッテリー+15%・速度+60%", "flavor": "違法。適度に手を抜いて逆転を狙おう。", "trigger": "lap4_rank3plus", "passive": False, "params": {"battRecover": 15, "speedBoost": 0.60, "duration": 18}},
    {"id": "winning_motor", "name": "勝ち越しモーター", "effect": "2位以上で4ラップ通過時、他車-速度40%・バッテリー-25%", "flavor": "違法。負けたくないという邪な気持ち。", "trigger": "lap4_rank2minus", "passive": False, "params": {"targetSpeedDebuff": 0.40, "targetBattDebuff": 25}},
    {"id": "big_motor", "name": "ビッグモーター", "effect": "2・3位で4ラップ通過時、バッテリー+15%・速度大幅増", "flavor": "違法。除草剤は街路樹に撒いてはいけない。", "trigger": "lap4_rank2or3", "passive": False, "params": {"battRecover": 15, "speedBoost": 0.50, "drainMult": 2.0, "duration": 25}},
    {"id": "stable_tire", "name": "安定タイヤ", "effect": "ランダム減速幅を極小に抑制", "flavor": "違法ではないがこれから違法になる可能性が高い。", "trigger": "passive", "passive": True, "params": {"noiseAmp": 0.00005}},
    {"id": "wifi_jamming", "name": "無線ジャミング", "effect": "3ラップ目開始時、自分より順位の高い車体の速度を50%下げる", "flavor": "違法。その強すぎる電波は法律上でも違法。", "trigger": "lap3_start", "passive": False, "params": {"speedDebuff": 0.50, "duration": 6}},
    {"id": "dynamo_gear", "name": "魔改造ダイナモギア", "effect": "バッテリー10%以下で発動。1秒間に5%回復。15秒持続。", "flavor": "違法。車に発電機がついていて非常にエコ。", "trigger": "battery_low", "passive": False, "params": {"threshold": 10, "regenPerSec": 0.05, "duration": 15}},
    {"id": "forced_overclock", "name": "強制オーバークロック", "effect": "レース開始時、自分以外の速度が18%上昇、バッテリーを50%減少", "flavor": "違法。車体を破壊する可能性があり、最悪。", "trigger": "race_start", "passive": False, "params": {"targetSpeedBuff": 0.18, "targetBattDrain": 50}},
    {"id": "poison_sprinkler", "name": "劇物散布スプリンクラー", "effect": "2ラップ目開始時、他のコースに毒ゾーンを3か所生成。踏むと速度-30%・バッテリー-5%", "flavor": "違法。戦いは始まると始まる。", "trigger": "lap2_start", "passive": False, "params": {"mudSlowdown": 0.60, "battDrain": 10, "mudCount": 3}},
    {"id": "brake_accel_pedal", "name": "ブレーキ&アクセルペダル", "effect": "①バッテリー10%以下で自身速度-50%・バッテリー100%回復(1回) ②5ラップ目到達で速度+25%(1回)", "flavor": "違法。ミニ四駆で踏むタイミングがあるかは知らないが、安全運転を心がけよう。", "trigger": "compound", "passive": False, "params": {"threshold": 10, "selfSpeedDebuff": 0.50, "debuffDuration": 3, "battRecover": 100, "lap5SpeedBonus": 0.25, "boostDuration": 10}},
    {"id": "leaky_battery", "name": "液漏れバッテリー", "effect": "バッテリー50%以下で発動。35%回復し、他のコースに毒ゾーンを1か所生成", "flavor": "違法。ゴミはゴミ箱へ。", "trigger": "battery_low", "passive": False, "params": {"threshold": 50, "battRecover": 35, "mudSlowdown": 0.60, "battDrain": 10, "mudCount": 1}},
    {"id": "freeze_spray", "name": "路面凍結スプレー", "effect": "レース開始時、全員のコースに凍結ゾーン3か所生成。バッテリー50%以上で踏むと速度+20%・バッテリー-5%、50%以下だと速度-80%", "flavor": "違法。スタッドレスを履こう。", "trigger": "race_start", "passive": False, "params": {"zoneCount": 3, "threshold": 50, "speedBonusHigh": 0.20, "battDrainHigh": 5, "speedPenaltyLow": 0.80}},
    {"id": "offroad_tire", "name": "悪路走行タイヤ", "effect": "ゾーン系スキルの影響を速度85%・バッテリー100%軽減", "flavor": "違法。冬のお出かけはこれで決まり。", "trigger": "passive", "passive": True, "params": {"speedReduction": 0.85, "battReduction": 1.00}},
    {"id": "comeback_boost", "name": "逆転ブースト", "effect": "ラップ数が他車と1周以上離れたら発動。速度+80%", "flavor": "違法。まだ負けてはいない。", "trigger": "passive", "passive": True, "params": {"lapGap": 1, "speedBoost": 0.80}},
    {"id": "self_destruct_emp", "name": "自爆EMP", "effect": "5ラップ目開始時、自分含む全車の速度を-95%", "flavor": "違法。おもちゃは大切に使おう。", "trigger": "lap5_start", "passive": False, "params": {"speedDebuff": 0.95, "duration": 8}},
    {"id": "poison_chihuahua", "name": "毒チワワレーサー", "effect": "レース開始時、自分以外のコースに毒ゾーンを1か所生成", "flavor": "違法。チワワなら仕方ないか......", "trigger": "race_start", "passive": False, "params": {"mudSlowdown": 0.60, "battDrain": 10, "mudCount": 1}},
    {"id": "never_motor", "name": "ネバーモーター", "effect": "速度ダウンを受けた際、速度+9%", "flavor": "違法。ネバーギブアップ。", "trigger": "passive", "passive": True, "params": {"speedBoost": 0.09, "duration": 4, "cooldown": 5}},
    {"id": "parallel_motor", "name": "並走モーター", "effect": "1ラップに一度、他車の速度上昇と同じ速度上昇を自分にも付与", "flavor": "違法。一緒に走ろう。", "trigger": "passive", "passive": True, "params": {}},
]

CAR_TYPES = {
    "EARLY": {"label": "前半逃げ切り型", "color": "#ff6633", "pattern": "lightning", "mark_color": 0xffe34d,
               "speed_scale": [1.080, 1.075, 1.065, 1.010, 0.990], "battery_scale": [1.80, 1.70, 1.50, 0.90, 0.70]},
    "STEADY": {"label": "中盤重視型", "color": "#33aaff", "pattern": "arrow", "mark_color": 0x33bfff,
               "speed_scale": [1.000, 1.005, 1.010, 1.015, 1.005], "battery_scale": [1.00, 1.00, 1.00, 1.00, 1.00]},
    "LATE": {"label": "後半追い上げ型", "color": "#ff00ff", "pattern": "flame", "mark_color": 0xff5522,
             "speed_scale": [0.910, 0.920, 0.940, 1.150, 1.170], "battery_scale": [0.40, 0.45, 0.50, 2.10, 2.30]},
}

COLOR1_PRESETS = [0x006e40, 0x003d80, 0xcd5c5c, 0x3a005c, 0xdddddd, 0x111111, 0xff7700, 0x886600, 0x224422, 0x551111, 0x0c2a4a, 0x555555]
COLOR2_PRESETS = [0x00ee77, 0xff7700, 0xff1493, 0xbd00ff, 0xffffff, 0x00ccff, 0xffdd00, 0xff3333, 0x33ff33, 0xff66cc, 0x66aaff, 0xaaaaaa]
COLOR3_PRESETS = [0xffe34d, 0x33bfff, 0xff5522, 0xffffff, 0x00ff88, 0xff2266, 0xbd00ff, 0x66aaff, 0xffaa00, 0x22ffcc, 0xff66cc, 0xaaaaaa]


def _to_hex(i):
    return "#{:06x}".format(i)


class Command(BaseCommand):
    help = "スキル・車種タイプ・カラーのマスターデータを投入する（data.jsの内容と同期）"

    @transaction.atomic
    def handle(self, *args, **options):
        created_skills = 0
        for s in SKILLS_DATA:
            _, created = CarSkill.objects.update_or_create(
                skill_id=s["id"],
                defaults={
                    "name": s["name"],
                    "effect": s["effect"],
                    "flavor": s["flavor"],
                    "trigger": s["trigger"],
                    "passive": s["passive"],
                    "params": s["params"],
                    "price": 15_000,
                },
            )
            created_skills += int(created)

        created_types = 0
        for type_id, t in CAR_TYPES.items():
            _, created = CarType.objects.update_or_create(
                id=type_id,
                defaults={
                    "label": t["label"],
                    "color": t["color"],
                    "pattern": t["pattern"],
                    "mark_color": t["mark_color"],
                    "speed_scale": t["speed_scale"],
                    "battery_scale": t["battery_scale"],
                },
            )
            created_types += int(created)

        created_colors = 0
        for color_type, presets in (("COLOR1", COLOR1_PRESETS), ("COLOR2", COLOR2_PRESETS), ("COLOR3", COLOR3_PRESETS)):
            for i in presets:
                _, created = CarColor.objects.update_or_create(
                    color_code=_to_hex(i),
                    color_type=color_type,
                    defaults={"price": 75_000},
                )
                created_colors += int(created)

        self.stdout.write(self.style.SUCCESS(
            f"マスターデータ投入完了: skills(+{created_skills}) / types(+{created_types}) / colors(+{created_colors})"
        ))
