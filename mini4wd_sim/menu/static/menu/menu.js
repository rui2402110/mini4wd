// menu/static/menu/menu.js ── メニュー画面のログアウト確認モーダル的な簡易処理
'use strict';
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) return;
    logoutBtn.addEventListener('click', () => {
        if (confirm('ログアウトしますか？')) {
            // logout_view はGETでもログアウトできる簡易実装
            window.location.href = '/logout/';
        }
    });
});
