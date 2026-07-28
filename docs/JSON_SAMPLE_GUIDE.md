# `json_sample.txt` 数据说明

## 文件结构

该文件并非纯 JSON，而是游戏日志中的一段结构化输出：

```text
userId2BattleStatistics:<用户 ID>,[
  <单位统计对象>,
  ...
]
<JSON 之外的战斗元数据>
```

真正的 JSON 是第一个 `[` 到与之配对的 `]` 之间的数组。样例包含 13 个单位统计对象。数组前的用户 ID，以及数组后的死亡角色、回合数、场景 ID、战斗结束血量等内容都不属于 JSON。

## 单位统计对象字段

以下类型和解释依据样例内容、字段名及日志上下文整理。没有官方协议说明的字段标记为“推测”，后续遇到新样例时应再校正。

| 字段 | 类型 | 样例中的含义 |
| --- | --- | --- |
| `UseSkill` | 对象：`技能 ID -> 次数` | 各技能的使用或触发次数。键是技能 ID。 |
| `Turn2KillEnemyCount` | 对象：`回合 -> 数量` | 各回合的击杀数量；回合键看起来从 0 开始。 |
| `TurnDamageDict` | 对象：`回合 -> 伤害` | 各回合造成的总伤害；回合键看起来从 0 开始。 |
| `CharId` | 整数 | 单位/角色的配置 ID，也是连接日志中显式名称的稳定键。 |
| `ActorId` | 整数 | 战斗实例 ID；本样例的统计对象中全部为 0，因此不适合用于名称连接。 |
| `SkinId` | 整数 | 皮肤 ID；召唤物等单位通常为 0。 |
| `Star` | 整数 | 星级。 |
| `Level` | 整数 | 等级。 |
| `MasterCharId` | 整数 | 所属主单位的 `CharId`；0 表示没有主人，非 0 多见于召唤物或附属单位。 |
| `Guard` | 整数 | 护卫次数（推测）。 |
| `DoubleAttack` | 整数 | 连击/双击次数（推测）。 |
| `ChasingStrike` | 整数 | 追击次数。 |
| `AttackFast` | 整数 | 先攻次数（推测）。 |
| `Dodge` | 整数 | 闪避次数。 |
| `Critical` | 整数 | 暴击次数。 |
| `CooperateAttack` | 整数 | 协攻次数。 |
| `Damage` | 整数 | 单位造成的总伤害。 |
| `BossDamgage` | 整数 | 对首领造成的伤害。字段名中的 `Damgage` 是游戏输出中的原始拼写。 |
| `BeDamaged` | 整数 | 单位受到的总伤害。 |
| `CurTurnBeDamaged` | 整数 | 当前回合承伤的内部累计值（推测）；不等同于总承伤。 |
| `LastTurnBeDamaged` | 整数 | 上一回合承伤的内部累计值（推测）；不等同于总承伤。 |
| `Heal` | 整数 | 总治疗量。 |
| `HealNum` | 整数 | 治疗发生次数。 |
| `TreasureBoxes` | 整数 | 获取宝箱数量。 |
| `DeadTurn` | 整数 | 死亡回合；0 表示未记录死亡。 |
| `KillEnemies` | 整数 | 击杀敌人总数。 |
| `KillCharacterEnemies` | 整数 | 击杀角色类敌人的数量（推测）。 |
| `KillerId` | 整数 | 击杀该单位的单位/角色 ID；0 表示未记录，具体 ID 口径仍需更多样例确认。 |
| `MaxDamage` | 整数 | 最高单次伤害。 |
| `MaxDamageSource` | 对象或 `null` | 最高单次伤害的来源；没有有效最高伤害时可为 `null`。 |

### `MaxDamageSource` 子字段

| 字段 | 类型 | 样例中的含义 |
| --- | --- | --- |
| `m_srcType` | 整数 | 伤害来源类型枚举；样例中有效值为 1，具体枚举含义未知。 |
| `m_srcParam1` | 整数 | 伤害来源参数；当 `m_srcType` 为 1 时看起来是技能 ID。 |

## JSON 之外的同段信息

这些内容有分析价值，但不属于上述 JSON 数组，新版首版不依赖它们生成统计表。

| 输出项 | 形式 | 含义 |
| --- | --- | --- |
| `userId2BattleStatistics` 后的数字 | 单个整数 | 用户 ID。 |
| `deadAttackerCharIds` | 逗号分隔 ID（样例为单个） | 已死亡的进攻方角色 ID。 |
| `battleTurnCount` | 整数 | 战斗回合数，样例为 12。 |
| `actionCount` | 整数 | 行动数，样例为 24。 |
| `battleSceneId` | 整数 | 战斗场景 ID；样例中重复输出两次，值相同。 |
| `m_actorHpRemainWhenBattleEndInfos` | 多行记录 | 战斗结束时各实例的剩余血量信息。 |

每条结束血量记录还包含：

| 字段 | 含义 |
| --- | --- |
| `ActorId` | 本场战斗中的单位实例 ID。 |
| `CharId` | 单位配置 ID。 |
| `HpRemainPercent` | 剩余血量比例，样例显示以 10000 表示 100%。 |
| `SourceType` | 单位来源类型枚举；具体枚举含义未知。 |
| `BattleTeamType` | 战斗队伍类型；样例中我方多为 1、敌方多为 4。 |
| `HpRemainValue` | 战斗结束时剩余血量的绝对值。 |

## 新版表格采用的字段

新版只输出一张“单位战斗统计”表：

| 表格列 | 数据来源/计算 |
| --- | --- |
| 单位 | 以 `CharId` 从旧日志的 `charId/charName` 记录补齐；缺失时显示 `CharId`。 |
| 总伤害 | `Damage`；数字旁的箭头可展开 `TurnDamageDict`，查看逐回合伤害。 |
| 首领伤害 | `BossDamgage` |
| 占比 | 本单位 `BossDamgage / 所有单位 BossDamgage 合计` |
| 承伤 | `BeDamaged` |
| 治疗 | `Heal` |
| 暴击次数 | `Critical` |
| 最高单次伤害 | `MaxDamage` |

逐回合明细由 `TurnDamageDict` 生成；JSON 中从 0 开始的回合键会转换为从 1 开始的显示回合。

暂不展示技能 ID 和内部状态字段。
