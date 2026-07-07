"""
accounts/models/user_model.py ── userテーブル（3章）

・パスワードのみでの認証（5-1）を実現するため、AbstractBaseUserを継承し、
  USERNAME_FIELD に name（半角英数字のみ・32字以下）を使用する。
・未登録の名前でログインを試みた場合は自動で新規作成する仕様（5-1）のため、
  実際の「新規作成 or 既存パスワード照合」判定は accounts/views/login_view.py 側で行う。
"""
import re

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models

NAME_RE = re.compile(r"^[A-Za-z0-9_\-]{1,32}$")


def validate_halfwidth_name(value: str) -> None:
    """半角英数字（と一部記号）のみ・32字以下であることを検証する"""
    if not NAME_RE.match(value):
        raise ValidationError("ユーザー名は半角英数字・記号(_-)のみ、32字以下で入力してください。")


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, name, password, **extra_fields):
        if not name:
            raise ValueError("nameは必須です。")
        validate_halfwidth_name(name)
        user = self.model(name=name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, name, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(name, password, **extra_fields)

    def create_superuser(self, name, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self._create_user(name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """設計書3章【user】ユーザーテーブル"""

    user_id = models.BigAutoField(primary_key=True)
    name = models.CharField(
        max_length=32,
        unique=True,
        validators=[validate_halfwidth_name],
        help_text="半角英数字のみ、32字以下",
    )

    # 現在装備中の車体（garage.Car, preset_number=99 のレコードを指す運用）
    car = models.ForeignKey(
        "garage.Car",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="equipped_by_users",
        verbose_name="現在装備中の車体",
    )
    # プロフィールに表示する実績（任意）
    achievement = models.ForeignKey(
        "accounts.Achievement",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="featured_by_users",
        verbose_name="表示中の実績",
    )

    rate = models.IntegerField(default=1500, verbose_name="レート")
    en = models.BigIntegerField(default=0, verbose_name="ゲーム内通貨")
    tickets = models.IntegerField(default=0, verbose_name="購入チケット数")

    last_login_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="最終ログイン日時（ログインボーナス判定用）",
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "name"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "user"
        verbose_name = "ユーザー"
        verbose_name_plural = "ユーザー"

    def __str__(self):
        return self.name

    @property
    def pk_for_api(self):
        return self.user_id
