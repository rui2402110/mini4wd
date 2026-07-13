// toast.js ── alert()の代替となる軽量トースト通知（改修要件4）
// 使い方: showToast('メッセージ', 'success' | 'error' | 'info')
//   画面遷移・リロードをまたいで表示したい場合は:
//   queueToastForNextLoad('メッセージ', 'success') → その後 location.reload() 等を行う
'use strict';
(function () {
    function ensureContainer() {
        let c = document.getElementById('toastContainer');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toastContainer';
            document.body.appendChild(c);
        }
        return c;
    }

    window.showToast = function (message, type) {
        type = type || 'info';
        const container = ensureContainer();
        const el = document.createElement('div');
        el.className = `toast-msg toast-${type}`;
        el.textContent = message;
        container.appendChild(el);
        // 少し遅らせてクラス付与することでCSSのフェードインを発火させる
        requestAnimationFrame(() => el.classList.add('show'));
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 300);
        }, 4200);
    };

    const PENDING_KEY = '__pendingToast';

    // reload()やlocation.href遷移の直前に呼ぶと、遷移後の新しいページ読み込み時に
    // トーストを表示できる（通知が表示される前にページが切り替わって消えてしまう問題を防ぐ）。
    window.queueToastForNextLoad = function (message, type) {
        try {
            sessionStorage.setItem(PENDING_KEY, JSON.stringify({ message, type: type || 'info' }));
        } catch (e) { /* sessionStorageが使えない環境では諦めて何もしない */ }
    };

    document.addEventListener('DOMContentLoaded', () => {
        try {
            const raw = sessionStorage.getItem(PENDING_KEY);
            if (!raw) return;
            sessionStorage.removeItem(PENDING_KEY);
            const { message, type } = JSON.parse(raw);
            window.showToast(message, type);
        } catch (e) { /* 壊れたデータは無視 */ }
    });
})();