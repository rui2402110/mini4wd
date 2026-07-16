#!/bin/sh
# docker/entrypoint.sh ── コンテナ起動時に毎回実行される初期化スクリプト
#
# migrate / collectstatic / seed_* はすべて「何度実行しても安全」
# （冪等）な処理のため、コンテナ再起動のたびに自動実行してよい設計にしている。
#   - migrate            : 未適用分だけ適用される
#   - collectstatic      : 差分のみコピーされる
#   - seed_master_data   : update_or_create のため重複投入されない
#   - seed_achievements  : 同上
set -e

echo "[entrypoint] マイグレーションを適用します..."
python manage.py migrate --noinput

echo "[entrypoint] 静的ファイルを収集します..."
python manage.py collectstatic --noinput

echo "[entrypoint] マスターデータを投入します..."
python manage.py seed_master_data
python manage.py seed_achievements

echo "[entrypoint] Daphne (ASGIサーバー) を起動します..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
