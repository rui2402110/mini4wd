// accounts/static/accounts/index_view.js ── トップページの簡易演出のみを担当
'use strict';
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('gotoLoginBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            window.location.href = btn.dataset.href;
        });
    }
});
