// ══════════════════════════════════════════════════════════════════
//  data.js ── 設定・マスターデータ（race / garage / rankings 共通）
//  ・DOM操作やTHREE.js呼び出しは行わない、純粋なデータ定義のみのファイル。
//  ・スキル・車種タイプなどのマスターデータはここを直せば全画面に反映される。
// ══════════════════════════════════════════════════════════════════
'use strict';

        // ══════════════════════════════════════════════════════════════════
        //  スキルシステム v2.7
        //  skills.json からスキル定義を読み込み、各Carに注入する
        // ══════════════════════════════════════════════════════════════════

        // skills.json と同内容をインライン定義（同一ファイル配信のため）
        //
        // ■ v2.9 スキルシステム
        //   1レース = メインスキル1(組み込み/常時全力) + サブスキル2(組み込み/効果-50%)
        //             + ランダムスキル2(レース開始時抽選/全力) の計5スキル
        //   サブスキルの効果減衰は skillPower(carId, skillId) で実行時に0.5倍される。
        //   （閾値・持続時間・ゾーン個数など「発動条件/タイミング」に関わる数値は減衰対象外、
        //     速度・バッテリーへの増減幅など「効果の強さ」に関わる数値のみ-50%される）
        const SKILLS_DATA = [
            // ── 既存スキル ──
            { id: "boost_lap5", name: "追い込みブースト", effect: "5ラップ目に速度+36%", flavor: "違法。爆走しよう。", trigger: "lap5_start", passive: false, params: { lap5SpeedBonus: 0.36 } },
            { id: "low_friction", name: "低摩擦タイヤ", effect: "コーナー減速を15%→1%に抑える", flavor: "違法。コーナーで差をつけよう。", trigger: "passive", passive: true, params: { cornerReduction: 0.001 } },
            { id: "mud_trap", name: "イカサマ重馬場", effect: "他車の各レーンに泥ゾーン×8、通過-40%減速+バッテリー5%消費", flavor: "違法。戦いは始まる前から始まっている。", trigger: "race_start", passive: false, params: { mudSlowdown: 0.40, mudCount: 5, battDrain: 8 } },
            { id: "illegal_batt", name: "違法バッテリー", effect: "残量5%以下で100%回復（1回）", flavor: "違法。エリクサーと違って勝手に消費される。", trigger: "battery_low", passive: false, params: { threshold: 5, recover: 100 } },
            { id: "tuned_form", name: "改造フォルム", effect: "全ラップ速度+10%", flavor: "違法。ヤスリで削ってお手入れしよう。", trigger: "passive", passive: true, params: { speedBonus: 0.1 } },
            { id: "reversal_motor", name: "逆転モーター", effect: "3位以下で4ラップ通過時、バッテリー+15%・速度+60%", flavor: "違法。適度に手を抜いて逆転を狙おう。", trigger: "lap4_rank3plus", passive: false, params: { battRecover: 15, speedBoost: 0.60, duration: 18 } },
            { id: "winning_motor", name: "勝ち越しモーター", effect: "2位以上で4ラップ通過時、他車-速度40%・バッテリー-25%", flavor: "違法。負けたくないという邪な気持ち。", trigger: "lap4_rank2minus", passive: false, params: { targetSpeedDebuff: 0.40, targetBattDebuff: 25 } },
            { id: "big_motor", name: "ビッグモーター", effect: "2・3位で4ラップ通過時、バッテリー+15%・速度大幅増", flavor: "違法。除草剤は街路樹に撒いてはいけない。", trigger: "lap4_rank2or3", passive: false, params: { battRecover: 15, speedBoost: 0.50, drainMult: 2.0, duration: 25 } },
            { id: "stable_tire", name: "安定タイヤ", effect: "ランダム減速幅を極小に抑制", flavor: "違法ではないがこれから違法になる可能性が高い。", trigger: "passive", passive: true, params: { noiseAmp: 0.00005 } },

            // ── 新規スキル v2.9 ──
            { id: "wifi_jamming", name: "無線ジャミング", effect: "3ラップ目開始時、自分より順位の高い車体の速度を50%下げる", flavor: "違法。その強すぎる電波は法律上でも違法。", trigger: "lap3_start", passive: false, params: { speedDebuff: 0.50, duration: 6 } },
            { id: "dynamo_gear", name: "魔改造ダイナモギア", effect: "バッテリー10%以下で発動。1秒間に5%回復。15秒持続。", flavor: "違法。車に発電機がついていて非常にエコ。", trigger: "battery_low", passive: false, params: { threshold: 10, regenPerSec: 0.05, duration: 15 } },
            { id: "forced_overclock", name: "強制オーバークロック", effect: "レース開始時、自分以外の速度が18%上昇、バッテリーを50%減少", flavor: "違法。車体を破壊する可能性があり、最悪。", trigger: "race_start", passive: false, params: { targetSpeedBuff: 0.18, targetBattDrain: 50 } },
            { id: "poison_sprinkler", name: "劇物散布スプリンクラー", effect: "2ラップ目開始時、他のコースに毒ゾーンを3か所生成。踏むと速度-30%・バッテリー-5%", flavor: "違法。戦いは始まると始まる。", trigger: "lap2_start", passive: false, params: { mudSlowdown: 0.60, battDrain: 10, mudCount: 3 } },
            { id: "brake_accel_pedal", name: "ブレーキ&アクセルペダル", effect: "①バッテリー10%以下で自身速度-50%・バッテリー100%回復(1回) ②5ラップ目到達で速度+25%(1回)", flavor: "違法。ミニ四駆で踏むタイミングがあるかは知らないが、安全運転を心がけよう。", trigger: "compound", passive: false, params: { threshold: 10, selfSpeedDebuff: 0.50, debuffDuration: 3, battRecover: 100, lap5SpeedBonus: 0.25, boostDuration: 10 } },
            { id: "leaky_battery", name: "液漏れバッテリー", effect: "バッテリー50%以下で発動。35%回復し、他のコースに毒ゾーンを1か所生成", flavor: "違法。ゴミはゴミ箱へ。", trigger: "battery_low", passive: false, params: { threshold: 50, battRecover: 35, mudSlowdown: 0.60, battDrain: 10, mudCount: 1 } },
            { id: "freeze_spray", name: "路面凍結スプレー", effect: "レース開始時、全員のコースに凍結ゾーン3か所生成。バッテリー50%以上で踏むと速度+20%・バッテリー-5%、50%以下だと速度-80%", flavor: "違法。スタッドレスを履こう。", trigger: "race_start", passive: false, params: { zoneCount: 3, threshold: 50, speedBonusHigh: 0.20, battDrainHigh: 5, speedPenaltyLow: 0.80 } },
            { id: "offroad_tire", name: "悪路走行タイヤ", effect: "ゾーン系スキルの影響を速度85%・バッテリー100%軽減", flavor: "違法。冬のお出かけはこれで決まり。", trigger: "passive", passive: true, params: { speedReduction: 0.85, battReduction: 1.00 } },
            { id: "comeback_boost", name: "逆転ブースト", effect: "ラップ数が他車と1周以上離れたら発動。速度+80%", flavor: "違法。まだ負けてはいない。", trigger: "passive", passive: true, params: { lapGap: 1, speedBoost: 0.80 } },
            { id: "self_destruct_emp", name: "自爆EMP", effect: "5ラップ目開始時、自分含む全車の速度を-95%", flavor: "違法。おもちゃは大切に使おう。", trigger: "lap5_start", passive: false, params: { speedDebuff: 0.95, duration: 8 } },
            { id: "poison_chihuahua", name: "毒チワワレーサー", effect: "レース開始時、自分以外のコースに毒ゾーンを1か所生成", flavor: "違法。チワワなら仕方ないか......", trigger: "race_start", passive: false, params: { mudSlowdown: 0.60, battDrain: 10, mudCount: 1 } },
            { id: "never_motor", name: "ネバーモーター", effect: "速度ダウンを受けた際、速度+9%", flavor: "違法。ネバーギブアップ。", trigger: "passive", passive: true, params: { speedBoost: 0.09, duration: 4, cooldown: 5 } },
            { id: "parallel_motor", name: "並走モーター", effect: "1ラップに一度、他車の速度上昇と同じ速度上昇を自分にも付与", flavor: "違法。一緒に走ろう。", trigger: "passive", passive: true, params: { } },
        ];


        // ── スキル検索ヘルパー（全画面共通） ──
        function getSkill(id) { return SKILLS_DATA.find(s => s.id === id) || null; }

        // ══════════════════════════════════════════════════════════════════
        //  タイプ定義
        // ══════════════════════════════════════════════════════════════════
        const CAR_TYPES = {
            EARLY: {
                label: '前半逃げ切り型',
                color: '#ff6633',
                pattern: 'lightning',
                markCol: 0xffe34d,
                speedScale: [1.080, 1.075, 1.065, 1.010, 0.990],
                batteryScale: [1.80, 1.70, 1.50, 0.90, 0.70],
            },
            STEADY: {
                label: '中盤重視型',
                color: '#33aaff',
                pattern: 'arrow',
                markCol: 0x33bfff,
                speedScale: [1.000, 1.005, 1.010, 1.015, 1.005],
                batteryScale: [1.00, 1.00, 1.00, 1.00, 1.00],
            },
            LATE: {
                label: '後半追い上げ型',
                color: '#ff00ff',
                pattern: 'flame',
                markCol: 0xff5522,
                speedScale: [0.910, 0.920, 0.940, 1.150, 1.170],
                batteryScale: [0.40, 0.45, 0.50, 2.10, 2.30],
            },
        };

        // ── エントリーマシン定義 v2.9 ──
        // ■ スキル設計（5スキル制）
        //   mainSkill    : 組み込みメインスキル。常に全力(power=1.0)で発動し、HUDでは常時公開。
        //   subSkills    : 組み込みサブスキル×2。効果が-50%(power=0.5)される。
        //                   レース前HUDでは「???」表示。カウントダウン終了と同時に判明する。
        //   randomSkills : レース開始時にランダム抽選されるスキル×2(全力/power=1.0)。
        //                   mainSkill/subSkillsと被らないよう assignRandomSkills() で抽選される。
        //                   こちらもカウントダウン終了と同時に判明する。
        //
        // ══════════════════════════════════════════════════════════════════
        //  決定論的な乱数生成器（改修要件5-1参照）
        //  ・ランダムスキル抽選やコーナーのノイズ変動など、レース結果を左右する
        //    乱数はすべてこの seededRandom() 経由で取得する。
        //  ・race_room.js が race_setup 受信時に setRaceRandomSeed(race_seed) を
        //    呼び出し、全クライアントが同じ乱数列で同じ計算をするようにする。
        //  ・パーティクルの見た目など、結果に影響しない演出用の乱数は
        //    従来どおり Math.random() のままでよい（同期不要）。
        // ══════════════════════════════════════════════════════════════════
        function createSeededRng(seed) {
            let a = seed >>> 0;
            return function () {
                a |= 0; a = (a + 0x6D2B79F5) | 0;
                let t = Math.imul(a ^ (a >>> 15), 1 | a);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        }
        let seededRandom = Math.random; // race_setup未受信時（オフライン単体動作等）のフォールバック
        function setRaceRandomSeed(seed) {
            seededRandom = createSeededRng(Number(seed) || 1);
        }

        //   設定可能なスキルID一覧は SKILLS_DATA を参照。
        //
        //   ── オンライン統合について ──
        //   race.htmlは常時オンライン対戦専用ページであり、CAR_CONFIGS/PLAYERSは
        //   room_consumer(ws/room/...)のroom_state・race_consumer(ws/race/...)の
        //   race_setupから配信される実データで race_room.js が構築する
        //   （game/static/game/race_room.js の rebuildCars 参照）。
        //   そのためここではデモ用の固定値は持たず、空配列で初期化する。
        const CAR_CONFIGS = [];


        // ── レースルール ──
        const TOTAL_LAPS = 5;

        // ══════════════════════════════════════════════════════════════════
        //  プレイヤー / 賭け・レートシステム
        // ══════════════════════════════════════════════════════════════════
        //  ・PLAYER_CAR_IDはrace_room.jsが room_state 受信のたびに再設定する
        //    （letで宣言し、別スクリプトタグから再代入できるようにしている）。
        //  ・PLAYERSも同様にrace_room.jsが実データで構築するため空配列で初期化する。
        let PLAYER_CAR_ID = null;

        const PLAYERS = [];

        // レート変動・賭け金払戻の倍率テーブル（参加人数ごと）。
        // websocket/race_consumer.py が使う game/rate_calculator.py・game/bet_calculator.py の
        // ルールと同じ値にしてある（これはあくまで結果発表演出用のローカル計算であり、
        // 実際のレート・en反映はサーバー側の確定結果に基づく）。
        const RATE_DELTA_TABLES = {
            2: [5, -5],
            3: [10, 0, -10],
            4: [15, 5, -5, -15],
        };
        const PAYOUT_RATIO_TABLES = {
            2: [0.90, 0],           // 残り10%は手数料として消滅
            3: [0.80, 0.10, 0],     // 残り10%は手数料として消滅
            4: [0.75, 0.15, 0, 0],  // 残り10%は手数料として消滅
        };

        // ── names.json 相当のデータ（ランダム命名用・garage.js で使用） ──
        const NAMES_DATA = [
            "HAPPY-TURN", "BLACK-BIRD", "DEATH-13", "NEW-YEAR", "RED-EYES",
            "THUNDER", "DRAGON-3", "ANGAS", "POWER-BEETLE", "D.X.", "BEETROOTSOUP"
        ];


        // ── 車体作戦タイプ マスターデータ（garage.js で使用。CAR_TYPESとは別に、ガレージ画面の3タイプ選択用の詳細情報を持つ） ──
        const CAR_DEFS = {
            ESCAPE: {
                name: '前半逃げ切り型',
                pattern: 'lightning',
                body: 0x006e40,
                accent: 0x00ee77,
                mark: 0xffe34d,
                desc: '序盤から一気に電力を投入してリードを広げる。バッテリーが10%まで低下すると、自動で省電力モードへ切り替わり後半の失速を賢く回避するアグレッシブな戦略。'
            },
            BALANCED: {
                name: '中盤重視型',
                pattern: 'arrow',
                body: 0x003d80,
                accent: 0xff7700,
                mark: 0x33bfff,
                desc: 'レース全行程を通じてバッテリーを均等かつ計画的に消費する。ペースの乱れが極めて少なく、あらゆるコース状況に対応可能な抜群の安定感を誇る戦略。'
            },
            CLOSER: {
                name: '後半追い上げ型',
                pattern: 'flame',
                body: 0xcd5c5c,
                accent: 0xff1493,
                mark: 0xff5522,
                desc: '終盤まで電力を温存して牙を研ぎ、ラストスパート突入と同時にエネルギーを高速消費。ファイナルラップで前方を一気に抜き去るドラマチックな大逆転戦略。'
            },
        };


        // ── カラー選択肢（garage.js で使用） ──
        const COLOR1_PRESETS = [0x006e40, 0x003d80, 0xcd5c5c, 0x3a005c, 0xdddddd, 0x111111, 0xff7700, 0x886600, 0x224422, 0x551111, 0x0c2a4a, 0x555555];
        const COLOR2_PRESETS = [0x00ee77, 0xff7700, 0xff1493, 0xbd00ff, 0xffffff, 0x00ccff, 0xffdd00, 0xff3333, 0x33ff33, 0xff66cc, 0x66aaff, 0xaaaaaa];
        const COLOR3_PRESETS = [0xffe34d, 0x33bfff, 0xff5522, 0xffffff, 0x00ff88, 0xff2266, 0xbd00ff, 0x66aaff, 0xffaa00, 0x22ffcc, 0xff66cc, 0xaaaaaa];


        // ══════════════════════════════════════════════════════════════════
        //  ランキング ダミーデータ（rankings.js で使用・12件）
        //  ※本実装ではサーバーから取得予定。現状はデモ用固定値。
        //  skill: メインスキル(★) / subSkills: サブスキル×2(▽、効果-50%)
        // ══════════════════════════════════════════════════════════════════
        const RANKING_DATA = [
            { isUser: true, name: "THUNDER-X", player: "player1(YOU)", rate: 2540, type: 'EARLY', bodyCol: 0x006e40, accentCol: 0x00ee77, stripeCol: 0xdddddd, skill: 'winning_motor', subSkills: ['leaky_battery', 'poison_chihuahua'] },
            { isUser: false, name: "FALCON", player: "razor_02", rate: 2480, type: 'STEADY', bodyCol: 0x003d80, accentCol: 0xff7700, stripeCol: 0xeeeeee, skill: 'big_motor', subSkills: ['never_motor', 'mud_trap'] },
            { isUser: false, name: "FIREFOX", player: "circuit_king", rate: 2415, type: 'LATE', bodyCol: 0xcd5c5c, accentCol: 0xff1493, stripeCol: 0xffd700, skill: 'reversal_motor', subSkills: ['forced_overclock', 'comeback_boost'] },
            { isUser: false, name: "SHADOW", player: "night_owl", rate: 2390, type: 'EARLY', bodyCol: 0x3a005c, accentCol: 0xbd00ff, stripeCol: 0x111111, skill: 'boost_lap5', subSkills: ['dynamo_gear', 'wifi_jamming'] },
            { isUser: false, name: "VIPER", player: "mini4wd_max", rate: 2350, type: 'LATE', bodyCol: 0x551111, accentCol: 0xff3333, stripeCol: 0xaaaaaa, skill: 'illegal_batt', subSkills: ['freeze_spray', 'self_destruct_emp'] },
            { isUser: false, name: "MUSTANG", player: "proto_racer", rate: 2290, type: 'STEADY', bodyCol: 0x886600, accentCol: 0xffdd00, stripeCol: 0x222222, skill: 'stable_tire', subSkills: ['offroad_tire', 'parallel_motor'] },
            { isUser: false, name: "COBRA", player: "turbo_dash", rate: 2255, type: 'EARLY', bodyCol: 0x224422, accentCol: 0x33ff33, stripeCol: 0xdddddd, skill: 'tuned_form', subSkills: ['poison_sprinkler', 'brake_accel_pedal'] },
            { isUser: false, name: "RAPTOR", player: "ace_driver", rate: 2200, type: 'LATE', bodyCol: 0x0c2a4a, accentCol: 0x66aaff, stripeCol: 0xffffff, skill: 'low_friction', subSkills: ['comeback_boost', 'never_motor'] },
            { isUser: false, name: "PHANTOM", player: "ghost_lap", rate: 2140, type: 'STEADY', bodyCol: 0x111111, accentCol: 0xaaaaaa, stripeCol: 0xff3333, skill: 'mud_trap', subSkills: ['leaky_battery', 'dynamo_gear'] },
            { isUser: false, name: "TORNADO", player: "wind_chaser", rate: 2085, type: 'EARLY', bodyCol: 0xdddddd, accentCol: 0x00ccff, stripeCol: 0x003d80, skill: 'boost_lap5', subSkills: ['wifi_jamming', 'poison_chihuahua'] },
            { isUser: false, name: "BULLET", player: "quick_silver", rate: 2020, type: 'LATE', bodyCol: 0x3a005c, accentCol: 0xff66cc, stripeCol: 0x111111, skill: 'reversal_motor', subSkills: ['forced_overclock', 'freeze_spray'] },
            { isUser: false, name: "COMET", player: "star_dust", rate: 1955, type: 'STEADY', bodyCol: 0x003d80, accentCol: 0x00ee77, stripeCol: 0xeeeeee, skill: 'big_motor', subSkills: ['offroad_tire', 'poison_sprinkler'] },
        ];