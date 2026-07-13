"""myroom/views/achievements_view.py ── 実績画面（改修要件10）"""
from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from myroom.achievement_service import evaluate_and_grant, get_achievement_board


@login_required
def achievements_view(request):
    # 改修要件10: 実績画面を開いたタイミングで解除判定・EN付与を行う
    newly_granted = evaluate_and_grant(request.user)
    board = get_achievement_board(request.user)

    return render(request, "myroom/achievements.html", {
        "board": board,
        "newly_granted": newly_granted,
        "newly_granted_total_en": sum(t.en_reward for t in newly_granted),
    })
