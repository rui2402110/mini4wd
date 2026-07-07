"""
game/rate_calculator.py ── レート変動計算（5-5・9-4参照）

【レート変動ルール】
  4人レース: 1位+15 / 2位+5 / 3位-5 / 4位-15
  3人レース: 1位+10 / 2位+0 / 3位-10
  2人レース: 1位+5 / 2位-5
（Botがいる場合も順位判定に含めて上記ルールを適用するが、Bot自体はuserを持たないため
  レート変動テーブルには含めない）
"""

RATE_DELTA_TABLE = {
    4: [15, 5, -5, -15],
    3: [10, 0, -10],
    2: [5, -5],
}


def is_bot_id(participant_id) -> bool:
    return isinstance(participant_id, str) and participant_id.startswith("Bot")


def calc_rate_delta(rankings: list, has_bot: bool = False) -> dict:
    """
    rankings: 着順に並んだ参加者ID(user_idまたは"Bot1"等)のリスト。
    has_bot: 引数として受け取るが、実際の要否判定は各要素がBotかどうかで行う
             （シグネチャは8章の定義に合わせて維持）。
    戻り値: {user_id: レート変動量} ※Botはキーに含めない。
    """
    n = len(rankings)
    table = RATE_DELTA_TABLE.get(n)
    if table is None:
        # 5人以上、または1人以下は今回の設計では未定義。安全側に倒し変動なしとする。
        table = [0] * n

    deltas = {}
    for idx, participant_id in enumerate(rankings):
        if is_bot_id(participant_id):
            continue
        deltas[participant_id] = table[idx] if idx < len(table) else 0
    return deltas
