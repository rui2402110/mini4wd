"""myroom/views/stats_view.py ── 統計画面（改修要件9）"""
import json

from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from game.models.car_skills_model import CarSkill
from myroom.stats_service import build_stats, get_user_race_rows


@login_required
def stats_view(request):
    rows = get_user_race_rows(request.user)
    skills_lookup = dict(CarSkill.objects.values_list("skill_id", "name"))
    stats = build_stats(rows, skills_lookup, request.user)

    return render(request, "myroom/stats.html", {
        "stats": stats,
        "stats_json": json.dumps(stats, ensure_ascii=False),
        "has_data": len(rows) > 0,
    })
