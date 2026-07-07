"""
game/bet_calculator.py ── 賭け金精算計算（5-5・9-4参照）

【賭け金分配ルール（10%は手数料として消滅）】
  賭け金は初期値100、最大1000まで設定可能。
  4人参加: 1位75% / 2位15% の払い戻し
  3人参加: 1位80% / 2位10% の払い戻し
  2人参加: 1位90% の払い戻し（2位への配当なし）

Bot入賞分の配当はシステム回収（is_botがTrueの参加者には払い戻ししない）。
"""

PAYOUT_RATIO_TABLE = {
    4: [0.75, 0.15, 0.0, 0.0],
    3: [0.80, 0.10, 0.0],
    2: [0.90, 0.0],
}

BET_MIN = 100
BET_MAX = 1000


def settle_bets(rankings: list, bets: dict, is_bot: dict) -> dict:
    """
    rankings: 着順に並んだ参加者IDのリスト（人間・Bot問わず）。
    bets: {participant_id: 賭け金額}
    is_bot: {participant_id: bool} Botかどうか
    戻り値: {user_id: 払い戻し額} ※Botはキーに含めない（システム回収として除外）。

    賭け金総額から算出した各順位の払い戻し額を計算する。
    10%は手数料として消滅し、誰にも渡さない。
    Bot入賞分の配当はシステム回収として扱う（＝そのままプールに残し、誰にも配らない）。
    """
    n = len(rankings)
    ratios = PAYOUT_RATIO_TABLE.get(n)
    if ratios is None:
        ratios = [0.0] * n

    total_pool = sum(bets.get(pid, 0) for pid in rankings)

    payouts = {}
    for idx, participant_id in enumerate(rankings):
        ratio = ratios[idx] if idx < len(ratios) else 0.0
        if ratio <= 0:
            continue
        amount = int(total_pool * ratio)
        if is_bot.get(participant_id, False):
            # Bot入賞分の配当はシステムに回収（誰にも配らない）
            continue
        payouts[participant_id] = amount

    return payouts


def clamp_bet_amount(amount: int) -> int:
    """賭け金は100〜1000の範囲にクランプする"""
    return max(BET_MIN, min(BET_MAX, int(amount)))
