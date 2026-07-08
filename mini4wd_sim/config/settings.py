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

    "accounts",
    "menu",
    "game",
    "rankings",
    "garage",
    "rooms",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
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

if REDIS_HOST:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [(REDIS_HOST, REDIS_PORT)],
            },
        },
    }
else:
    # Redis未設定時の開発用フォールバック（本番では必ずRedisを使用すること）
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