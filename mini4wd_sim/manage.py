#!/usr/bin/env python
"""ミニ四駆シミュレーター - Django管理コマンド エントリポイント"""
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Djangoをインポートできませんでした。仮想環境がアクティブか、"
            "requirements.txt の内容がインストールされているか確認してください。"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
