# ミニ四駆シミュレーター ─ デプロイ用README（本番環境）

このREADMEは、開発・テスト環境用の `readme.md` とは別に、
AWS EC2上への本番デプロイ専用にまとめたものです。

## システム構成

```
インターネット
    │  (80/443)
    ▼
┌─────────────┐
│  Nginx        │  ← リバースプロキシ / 静的ファイル配信 / HTTPS終端
└──────┬──────┘
       │ (proxy_pass, WebSocketアップグレード対応)
       ▼
┌─────────────┐      ┌──────────┐
│  Daphne (ASGI) │◄────►│  Redis     │  ← Channelsのチャンネルレイヤー
│  = Djangoアプリ │      └──────────┘
└──────┬──────┘
       │
       ▼
  SQLite3 (Dockerボリュームで永続化)
```

- **ドメイン**: `mini4wdsim.duckdns.org`（DuckDNS DDNS）
- **サーバー**: AWS EC2（Elastic IP: `3.218.32.232`）
- **HTTPS**: Let's Encrypt（certbotコンテナが自動更新）

## このZIPに含まれるもの

システム本体のソースコードは別途管理されているため、このZIPには
**デプロイに必要なインフラ定義ファイルと、既存ソースへの変更差分のみ**が
含まれています。

| ファイル | 役割 |
|---|---|
| `Dockerfile` | Django/Daphneアプリのコンテナイメージ定義 |
| `compose.yaml` | web/redis/nginx/certbot の4サービス構成 |
| `docker/entrypoint.sh` | コンテナ起動時のmigrate/collectstatic/マスターデータ投入 |
| `docker/nginx/conf.d/app.conf` | 本番用Nginx設定（HTTPS） |
| `docker/nginx/conf.d-bootstrap/app.conf` | 初回証明書取得前に使う一時設定（HTTPのみ） |
| `.env.production.example` | 本番用環境変数テンプレート |
| `config/settings.py` | 本番向けに追加設定を行った差し替え版 |
| `デプロイ手順書.txt` | 初回デプロイの実行手順（上から順に実行） |
| `デプロイ後手順書.txt` | 運用引き継ぎ用（cronジョブ・バックアップ等） |
| `変更内容まとめ.txt` | ソースコードへの変更点一覧と変更理由 |

## クイックスタート

詳細は `デプロイ手順書.txt` を参照してください。概要のみ:

```bash
# 1. ソースコード配置後、このZIPの中身を上書きコピー
# 2. 環境変数の準備
cp .env.production.example .env
nano .env   # DJANGO_SECRET_KEY等を書き換える

# 3. HTTP専用設定でまず起動（bootstrap）
cp docker/nginx/conf.d-bootstrap/app.conf docker/nginx/conf.d/app.conf
docker compose build
docker compose up -d redis web nginx

# 4. 証明書取得
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d mini4wdsim.duckdns.org --email you@example.com --agree-tos --no-eff-email

# 5. HTTPS設定に切り替え、certbotの自動更新サービスを起動
#    （元のdocker/nginx/conf.d/app.conf に戻したうえで）
docker compose up -d certbot
docker compose restart nginx
```

## 環境変数の設計方針（デプロイ要件2）

`SECRET_KEY` や `ALLOWED_HOSTS` などの機密・環境依存情報は、
これまでと同様に **`settings.py` に直接書かず、`.env` から
`python-dotenv` 経由で読み込む設計を維持**しています。

本番用に追加した環境変数（`config/settings.py`側の対応箇所も参照）:

| 変数名 | 用途 |
|---|---|
| `DB_PATH` | SQLiteファイルの実体パス（Dockerボリューム上のパスを指す） |
| `DJANGO_BEHIND_HTTPS_PROXY` | NginxがHTTPSで終端している構成であることをDjangoに伝える |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | リバースプロキシ配下でのCSRF検証のための信頼済みオリジン |

`.env` ファイル自体はGit管理・ZIP配布のいずれにも含めないでください
（`.env.production.example` はプレースホルダーのみのテンプレートです）。

## データベースについて

要件に従い、本番でも **SQLite3をそのまま継続使用**しています。
`sqlite_data` という名前付きDockerボリュームにDBファイルを永続化しており、
`docker compose down`（ボリュームを消さない通常の停止）や
イメージの再ビルドではデータは消えません。
バックアップ手順は `デプロイ後手順書.txt` を参照してください。

## 既知の制約

- SQLiteは同時書き込みに弱いため、アクセスが増えてきた場合はPostgreSQL等への
  移行を検討してください（`DATABASES` の `ENGINE` を差し替えるだけで移行できる
  よう、アプリ側は素のDjango ORMのみで実装されています）。
- `HSTS`（Strict-Transport-Security）は今回のデプロイでは有効化していません。
  常時HTTPS運用が安定してから、`config/settings.py` に
  `SECURE_HSTS_SECONDS` 等を追加することを推奨します。
