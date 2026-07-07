"""
websocket/state_store.py ── Redis上の一時ステータス管理（5-4・9-7参照）

キー設計（9-7準拠）:
  room:{room_id}:members   ... 入室中ユーザーIDのSet
  room:{room_id}:ready     ... {user_id: bool} のHash
  room:{room_id}:bots      ... 現在のBotリスト（Bot1〜3）
  user:{user_id}:online    ... オンライン状態フラグ（TTL付き）

REDIS_HOST が未設定の開発環境では、プロセス内メモリの簡易実装へフォールバックする
（settings.py の CHANNEL_LAYERS フォールバックと対になる開発用の割り切り）。
"""
import json
import threading
import time

from django.conf import settings

try:
    import redis as redis_lib
except ImportError:  # pragma: no cover
    redis_lib = None

MAX_BOTS = 3
MAX_MEMBERS = 4
ONLINE_TTL_SEC = 30


class _InMemoryStore:
    """開発用フォールバック（Redis未接続時）。プロセス内のみ有効。"""

    def __init__(self):
        self._lock = threading.Lock()
        self._members = {}
        self._ready = {}
        self._bots = {}
        self._bets = {}
        self._online = {}  # user_id -> expire_ts

    def sadd(self, room_id, user_id):
        with self._lock:
            self._members.setdefault(room_id, set()).add(str(user_id))

    def srem(self, room_id, user_id):
        with self._lock:
            self._members.setdefault(room_id, set()).discard(str(user_id))

    def smembers(self, room_id):
        with self._lock:
            return set(self._members.get(room_id, set()))

    def hset(self, room_id, user_id, value):
        with self._lock:
            self._ready.setdefault(room_id, {})[str(user_id)] = value

    def hgetall(self, room_id):
        with self._lock:
            return dict(self._ready.get(room_id, {}))

    def hdel(self, room_id, user_id):
        with self._lock:
            self._ready.setdefault(room_id, {}).pop(str(user_id), None)

    def get_bots(self, room_id):
        with self._lock:
            return list(self._bots.get(room_id, []))

    def set_bots(self, room_id, bots):
        with self._lock:
            self._bots[room_id] = list(bots)

    def get_bets(self, room_id):
        with self._lock:
            return dict(self._bets.get(room_id, {}))

    def set_bet(self, room_id, user_id, amount):
        with self._lock:
            self._bets.setdefault(room_id, {})[str(user_id)] = amount

    def clear_room(self, room_id):
        with self._lock:
            self._members.pop(room_id, None)
            self._ready.pop(room_id, None)
            self._bots.pop(room_id, None)
            self._bets.pop(room_id, None)

    def set_online(self, user_id, ttl=ONLINE_TTL_SEC):
        with self._lock:
            self._online[str(user_id)] = time.time() + ttl

    def is_online(self, user_id):
        with self._lock:
            exp = self._online.get(str(user_id))
            return exp is not None and exp > time.time()

    def clear_online(self, user_id):
        with self._lock:
            self._online.pop(str(user_id), None)


class _RedisStore:
    """本番用: 実際のRedisバックエンド"""

    def __init__(self, host, port):
        self.r = redis_lib.Redis(host=host, port=port, decode_responses=True)

    def sadd(self, room_id, user_id):
        self.r.sadd(f"room:{room_id}:members", str(user_id))

    def srem(self, room_id, user_id):
        self.r.srem(f"room:{room_id}:members", str(user_id))

    def smembers(self, room_id):
        return self.r.smembers(f"room:{room_id}:members")

    def hset(self, room_id, user_id, value):
        self.r.hset(f"room:{room_id}:ready", str(user_id), json.dumps(value))

    def hgetall(self, room_id):
        raw = self.r.hgetall(f"room:{room_id}:ready")
        return {k: json.loads(v) for k, v in raw.items()}

    def hdel(self, room_id, user_id):
        self.r.hdel(f"room:{room_id}:ready", str(user_id))

    def get_bots(self, room_id):
        raw = self.r.get(f"room:{room_id}:bots")
        return json.loads(raw) if raw else []

    def set_bots(self, room_id, bots):
        self.r.set(f"room:{room_id}:bots", json.dumps(bots))

    def get_bets(self, room_id):
        raw = self.r.get(f"room:{room_id}:bets")
        return json.loads(raw) if raw else {}

    def set_bet(self, room_id, user_id, amount):
        bets = self.get_bets(room_id)
        bets[str(user_id)] = amount
        self.r.set(f"room:{room_id}:bets", json.dumps(bets))

    def clear_room(self, room_id):
        self.r.delete(f"room:{room_id}:members", f"room:{room_id}:ready", f"room:{room_id}:bots", f"room:{room_id}:bets")

    def set_online(self, user_id, ttl=ONLINE_TTL_SEC):
        self.r.set(f"user:{user_id}:online", "1", ex=ttl)

    def is_online(self, user_id):
        return self.r.exists(f"user:{user_id}:online") == 1

    def clear_online(self, user_id):
        self.r.delete(f"user:{user_id}:online")


_store = None


def get_store():
    global _store
    if _store is not None:
        return _store
    host = getattr(settings, "REDIS_HOST", None)
    if host and redis_lib is not None:
        _store = _RedisStore(host, settings.REDIS_PORT)
    else:
        _store = _InMemoryStore()
    return _store
