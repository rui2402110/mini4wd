"""
config/settings.py ── ミニ四駆シミュレーター Django設定

設計書2章（技術スタック）:
  ・バックエンド: Django
  ・リアルタイム通信: Django Channels (WebSocket) + Redis (channels_redis)
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _env_bool(key, default=False):
    val = os.environ.get(key)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-secret-key")
DEBUG = _env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = [
    h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",") if h.strip()
]

# ── アプリケーション定義 ──
INSTALLED_APPS = [
    # daphneを先頭に置くことで、開発用の `manage.py runserver` が
    # WSGIではなくASGI(config.asgi.application)経由で起動し、
    # WebSocket(/ws/...)もあわせて捌けるようになる。
    "daphne",

    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "channels",
    "axes",

    "accounts",
    "menu",
    "game",
    "rankings",
    "garage",
    "rooms",
    "myroom",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "axes.middleware.AxesMiddleware",  # 必ずMIDDLEWAREの最後に置く（django-axesの要件）
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ── データベース ──
# 学内コンテスト規模を想定し、開発既定値はSQLite。本番はPostgreSQL等への差し替えを推奨。
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# ── カスタムユーザーモデル（3章 user テーブル準拠） ──
AUTH_USER_MODEL = "accounts.User"

# ── django-axes（改修要件3: ログイン総当たり対策。学内コンテスト規模を踏まえ緩めに設定） ──
# axesのbackendを先頭に置くことで、ロックアウト判定 → 通常認証 の順で処理される。
# ModelBackendはUSERNAME_FIELD="name"を自動的に認識するため、カスタムbackendは不要。
AUTHENTICATION_BACKENDS = [
    "axes.backends.AxesStandaloneBackend",
    "django.contrib.auth.backends.ModelBackend",
]
AXES_FAILURE_LIMIT = 10          # 通常のデフォルト(3)より緩め
AXES_COOLOFF_TIME = 0.5          # ロック解除までの時間(時間単位) = 30分
AXES_RESET_ON_SUCCESS = True     # ログイン成功で失敗カウントをリセット
AXES_LOCKOUT_TEMPLATE = None     # デフォルトの簡易ロック画面を使用
AXES_VERBOSE = False
AXES_USERNAME_FORM_FIELD = "name"  # カスタムUserモデルのUSERNAME_FIELD/ログインフォームに合わせる
AXES_USERNAME_CALLABLE = None

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 4}},
]

LANGUAGE_CODE = "ja"
TIME_ZONE = "Asia/Tokyo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = []  # 各アプリの static/ ディレクトリは APP_DIRS 経由で自動収集される
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGIN_URL = "accounts:login"
LOGIN_REDIRECT_URL = "menu:index"
LOGOUT_REDIRECT_URL = "accounts:index"

# ── Django Channels / Redis (5章・7章・9-7参照) ──
REDIS_HOST = os.environ.get("REDIS_HOST")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))


def _redis_reachable(host, port, timeout=0.2):
    """
    実際にRedisへTCP接続できるかを軽く確認する。
    channels_redisがインストール済みでもRedisプロセス自体が起動していない
    開発環境（Windowsでよく起きる）では接続エラーで落ちてしまうため、
    起動時に一度だけ疎通確認し、ダメならInMemoryへフォールバックする。
    """
    import socket

    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


# REDIS_HOSTが設定されていても、(a) channels_redisが未インストール、
# (b) Redisプロセス自体が起動していない、のいずれかの場合はInvalidChannelLayerError /
# ConnectionErrorで落ちてしまう。実際にimportでき、かつ接続できる場合のみ使用する。
try:
    import channels_redis  # noqa: F401
    _CHANNELS_REDIS_AVAILABLE = True
except ImportError:
    _CHANNELS_REDIS_AVAILABLE = False

_USE_REDIS = bool(REDIS_HOST) and _CHANNELS_REDIS_AVAILABLE and _redis_reachable(REDIS_HOST, REDIS_PORT)

if _USE_REDIS:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [(REDIS_HOST, REDIS_PORT)],
            },
        },
    }
else:
    if REDIS_HOST and not _CHANNELS_REDIS_AVAILABLE:
        print(
            "[config.settings] 警告: REDIS_HOSTが設定されていますが channels_redis が"
            " インストールされていないため、InMemoryChannelLayerにフォールバックします。"
            " `pip install channels_redis` を実行してください。"
        )
    elif REDIS_HOST:
        print(
            f"[config.settings] 警告: {REDIS_HOST}:{REDIS_PORT} のRedisに接続できないため、"
            " InMemoryChannelLayerにフォールバックします。"
            " Redisを使う場合はRedisサーバーを起動するか、.envのREDIS_HOSTを空にしてください。"
        )
    # Redis未設定 or 未インストール or 未起動時の開発用フォールバック
    # （本番では必ずRedis + channels_redisを使用すること）
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    }

# ── アプリ固有設定（9章の各仕様に対応） ──
LOGIN_BONUS_EN = int(os.environ.get("LOGIN_BONUS_EN", "1000"))
RACE_REPORT_TIMEOUT_SEC = int(os.environ.get("RACE_REPORT_TIMEOUT_SEC", "120"))
ROOM_STALE_HOURS = int(os.environ.get("ROOM_STALE_HOURS", "6"))

# 5-3・9-6・9-8で参照する固定価格
COLOR_PRICE_EN = 75_000
SKILL_PRICE_EN = 15_000
PRESET_SLOT_PRICE_EN = 150_000
