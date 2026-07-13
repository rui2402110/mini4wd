"""
myroom/stats_service.py ── 戦績(8)・統計(9)画面で使う集計ロジック

Result.play_member（着順に並んだparticipant_id配列）に自分のuser_idが
含まれるレコードを「自分が参加したレース」として扱う。
JSONFieldへのDB側contains検索はバックエンドによって挙動が割れるため、
（学内コンテスト規模のデータ量を前提に）Python側でフィルタする。
"""
from game.models.result_model import Result


def _my_rank_in_result(result, user_id):
    try:
        return result.play_member.index(user_id) + 1
    except (ValueError, AttributeError):
        return None


def get_user_race_rows(user, limit=None):
    """
    自分が参加した全レースを新しい順に並べ、1件ごとに自分視点の情報を付与して返す。
    戻り値の各要素: {result, rank, total_players, rate_delta, bet_charge, bet_payout,
                     net_en, car_name, car_type, main_skill, is_win}
    """
    qs = Result.objects.select_related("room").order_by("-created_at")
    rows = []
    for result in qs.iterator():
        rank = _my_rank_in_result(result, user.user_id)
        if rank is None:
            continue
        snapshot = (result.car_snapshot or {}).get(str(user.user_id), {})
        rate_delta = (result.rate or {}).get(str(user.user_id), 0)
        bet_charge = (result.bet_charges or {}).get(str(user.user_id), 0)
        bet_payout = (result.bet or {}).get(str(user.user_id), 0)
        rows.append({
            "result": result,
            "rank": rank,
            "total_players": len(result.play_member),
            "rate_delta": rate_delta,
            "bet_charge": bet_charge,
            "bet_payout": bet_payout,
            "net_en": bet_payout - bet_charge,
            "car_name": snapshot.get("car_name"),
            "car_type": snapshot.get("car_type"),
            "main_skill": snapshot.get("main_skill"),
            "is_win": rank == 1,
        })
        if limit and len(rows) >= limit:
            break
    return rows


def summarize(rows):
    """戦績サマリー（生涯 or 直近N戦）を集計する"""
    total = len(rows)
    if total == 0:
        return {
            "total": 0, "wins": 0, "win_rate": 0, "avg_rank": 0,
            "total_rate_delta": 0, "total_net_en": 0,
        }
    wins = sum(1 for r in rows if r["is_win"])
    avg_rank = sum(r["rank"] for r in rows) / total
    total_rate_delta = sum(r["rate_delta"] for r in rows)
    total_net_en = sum(r["net_en"] for r in rows)
    return {
        "total": total,
        "wins": wins,
        "win_rate": round(wins / total * 100, 1),
        "avg_rank": round(avg_rank, 2),
        "total_rate_delta": total_rate_delta,
        "total_net_en": total_net_en,
    }


CAR_TYPE_LABELS = {"EARLY": "逃げ切り", "STEADY": "中盤重視", "LATE": "追い込み"}


def build_stats(rows, skills_lookup, user):
    """統計画面用データ（よく使うスキル/タイプ/車、円グラフ、折れ線グラフ材料）を作る"""
    from collections import Counter

    skill_counter = Counter()
    type_counter = Counter()
    car_name_counter = Counter()

    for r in rows:
        if r["main_skill"]:
            skill_counter[r["main_skill"]] += 1
        if r["car_type"]:
            type_counter[r["car_type"]] += 1
        if r["car_name"]:
            car_name_counter[r["car_name"]] += 1

    most_skill = skill_counter.most_common(1)
    most_type = type_counter.most_common(1)
    most_car = car_name_counter.most_common(1)

    skill_pie = [
        {"label": skills_lookup.get(k, k), "value": v}
        for k, v in skill_counter.most_common(8)
    ]
    type_pie = [
        {"label": CAR_TYPE_LABELS.get(k, k), "value": v}
        for k, v in type_counter.most_common()
    ]

    # 折れ線グラフ用: 古い順に並べ替えて累積させる
    chrono = list(reversed(rows))
    rate_series = []
    en_series = []
    cum_rate = user.rate - sum(r["rate_delta"] for r in rows)  # レース前の推定初期レートまで遡る
    cum_en = 0
    for r in chrono:
        cum_rate += r["rate_delta"]
        cum_en += r["net_en"]
        rate_series.append(cum_rate)
        en_series.append(cum_en)

    return {
        "most_skill": skills_lookup.get(most_skill[0][0], most_skill[0][0]) if most_skill else None,
        "most_type": CAR_TYPE_LABELS.get(most_type[0][0], most_type[0][0]) if most_type else None,
        "most_car": most_car[0][0] if most_car else None,
        "skill_pie": skill_pie,
        "type_pie": type_pie,
        "rate_series": rate_series,
        "en_series": en_series,
    }
