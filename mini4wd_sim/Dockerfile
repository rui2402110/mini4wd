# Dockerfile ── ミニ四駆シミュレーター 本番用アプリイメージ（デプロイ要件3）
#
# プロジェクトルート（manage.pyがある場所）に配置し、
# `docker compose build` のビルドコンテキストをプロジェクトルートにしてビルドする。
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# sqlite3コマンド等、最低限のビルド依存のみ導入
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x docker/entrypoint.sh \
    && mkdir -p /app/data /app/staticfiles

EXPOSE 8000

ENTRYPOINT ["docker/entrypoint.sh"]
