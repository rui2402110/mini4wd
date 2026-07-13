# ミニ四駆シミュレーター（学内コンテスト提出作品）

設計書 ver1.3 に基づく Django + Django Channels 実装です。
物理演算・スキル発動判定・順位計算といった「ゲームロジック」はサーバー側では再実装せず、
既存資産（`game/static/game/*.js`）をそのままクライアント側で利用し、
オンライン対戦の勝敗確定は「ホスト権威（Host Authoritative）＋サーバーによる結果確定」方式を採用しています。

## 主な機能
- パスワードのみのログイン（未登録名は自動で新規作成）／ログインボーナス
- ガレージでの車体カスタマイズ（カラー・スキル・戦略タイプ・プリセット）
- ショップでのカラー／スキル／プリセット枠購入（まとめ買い・オールオアナッシング）
- 部屋（ロビー）機能：検索、Bot追加、準備完了、賭け金設定
- WebSocketによるリアルタイム部屋同期・レース進行・チャット
- レートランキング表示（3Dプレビュー付き）
- ホストクライアントの結果報告をサーバーが正として記録するレース確定フロー

## セットアップ
```bash
python -m venv venv
source venv/bin/activate  # Windowsは venv\Scripts\activate
pip install -r requirements.txt

# .env を編集（SECRET_KEY, Redis接続先など）

python manage.py migrate
python manage.py seed_master_data   # スキル/カラー/車種タイプ等のマスターデータ投入
python manage.py seed_achievements  # 実績マスターデータ投入（改修要件10）
python manage.py runserver
```

Channels（WebSocket）の実運用には Redis が必要です。開発時は
`channels_redis` の代わりに `channels.layers.InMemoryChannelLayer` を
`config/settings.py` で一時的に使うこともできます（`REDIS_HOST` 未設定時は自動でこちらにフォールバック）。

## 定期バッチ
毎日23:00に以下をcronから実行してください（9-1参照）。
```bash
python manage.py cleanup_old_rooms
```

## ディレクトリ構成
設計書4章のとおりの構成です。各Djangoアプリの役割は以下の通り。

| アプリ | 役割 |
|---|---|
| accounts | 認証（パスワードのみ）、ログインボーナス |
| menu | メニュー画面（ショップ・ガレージ・ランキング・部屋探し・ログアウトへの導線） |
| game | レース画面、3D描画資産、レート/賭け計算、Bot生成 |
| websocket | room_consumer / race_consumer（Channels Consumer） |
| rankings | レートランキング表示 |
| garage | ガレージ（カスタマイズ）・ショップ |
| rooms | 部屋検索・作成・自動削除バッチ |

## 今後の課題（10章より抜粋）
- ホスト不正（クライアント改ざん）への対策が不十分（性善説ベースの割り切り仕様）
- race_result_report の詳細な再計算・検証は未実装（race_seed一致チェックのみ）
- ホスト無応答時のタイムアウト処理は `race_consumer.start_report_timeout_timer` に
  骨組みを実装済みだが、本番運用に向けた再試験が必要
