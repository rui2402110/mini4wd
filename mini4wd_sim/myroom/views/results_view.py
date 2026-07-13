"""myroom/views/results_view.py ── 戦績画面（改修要件8）"""
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.shortcuts import render

from myroom.stats_service import get_user_race_rows, summarize


@login_required
def results_view(request):
    all_rows = get_user_race_rows(request.user)
    lifetime = summarize(all_rows)
    recent50 = summarize(all_rows[:50])

    page_number = request.GET.get("page", 1)
    paginator = Paginator(all_rows, 10)
    page_obj = paginator.get_page(page_number)

    return render(request, "myroom/results.html", {
        "lifetime": lifetime,
        "recent50": recent50,
        "page_obj": page_obj,
    })
