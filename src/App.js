import React, { useRef, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const MAX_TOTAL_FILE_SIZE = 100 * 1024 * 1024;
const LOG_FILE_NAME_PATTERN = /^(\d+)_(\d+)\((\d+)\)_(\d{8})_(\d{6})\.bl$/i;
const STATISTICS_MARKER = 'userId2BattleStatistics:';
const numberFormatter = new Intl.NumberFormat('zh-CN');

export const groupLogFiles = (files) => {
  const groups = new Map();
  Array.from(files).forEach((file) => {
    const match = file.name.match(LOG_FILE_NAME_PATTERN);
    const key = match ? `${match[1]}_${match[2]}(${match[3]})` : `legacy:${file.name}`;
    if (!groups.has(key)) {
      groups.set(key, { key, battleId: match?.[3] || file.name, files: [] });
    }
    groups.get(key).files.push({ file, timestamp: match ? `${match[4]}${match[5]}` : '' });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      files: group.files
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.file.name.localeCompare(b.file.name))
        .map(({ file }) => file),
    }))
    .sort((a, b) => b.files.length - a.files.length || a.key.localeCompare(b.key));
};

export const extractBattleStatistics = (content) => {
  const markerIndex = content.lastIndexOf(STATISTICS_MARKER);
  const start = content.indexOf('[', markerIndex);
  if (markerIndex < 0 || start < 0) throw new Error('未找到游戏内置伤害统计');

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < content.length; i += 1) {
    const char = content[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === '[') {
      depth += 1;
    } else if (char === ']' && --depth === 0) {
      const records = JSON.parse(content.slice(start, i + 1));
      if (!Array.isArray(records)) throw new Error('伤害统计格式不正确');
      return records;
    }
  }
  throw new Error('伤害统计内容不完整');
};

export const extractCharacterNames = (content) => {
  const names = new Map();
  for (const match of content.matchAll(/charId:(\d+)[^\r\n]*?charName:([^\s]+)/g)) {
    names.set(Number(match[1]), match[2]);
  }
  return names;
};

export const buildStatisticsRows = (records, names) => {
  const totalBossDamage = records.reduce((sum, record) => sum + (record.BossDamgage || 0), 0);
  return records
    .map((record) => {
      const name = names.get(record.CharId) || `未知单位（${record.CharId}）`;
      const masterName = record.MasterCharId
        ? names.get(record.MasterCharId) || `CharId ${record.MasterCharId}`
        : null;
      return {
        ...record,
        name: masterName ? `${name}（${masterName}所属）` : name,
        bossDamageShare: totalBossDamage ? (record.BossDamgage || 0) / totalBossDamage : 0,
      };
    })
    .sort((a, b) =>
      (b.BossDamgage || 0) - (a.BossDamgage || 0)
      || (b.Damage || 0) - (a.Damage || 0)
      || a.CharId - b.CharId
    );
};

const formatNumber = (value) => numberFormatter.format(value || 0);
const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;

export const getTurnDamageEntries = (turnDamage = {}) =>
  Object.entries(turnDamage)
    .map(([turn, damage]) => [Number(turn) + 1, damage])
    .sort(([turnA], [turnB]) => turnA - turnB);

const TurnDamageDetails = ({ turnDamage }) => {
  const entries = getTurnDamageEntries(turnDamage);
  if (!entries.length) return null;

  return (
    <details className="turn-damage-details">
      <summary aria-label="查看每回合伤害" title="查看每回合伤害">▸</summary>
      <div className="turn-damage-popover">
        <strong>每回合伤害</strong>
        {entries.map(([turn, damage]) => (
          <div className="turn-damage-row" key={turn}>
            <span>第 {turn} 回合</span>
            <span>{formatNumber(damage)}</span>
          </div>
        ))}
      </div>
    </details>
  );
};

function App() {
  const [groups, setGroups] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [result, setResult] = useState(null);
  const [helpVisible, setHelpVisible] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const nextGroups = groupLogFiles(event.target.files);
    setGroups(nextGroups);
    setSelectedKey(nextGroups[0]?.key || '');
    setResult(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const group = groups.find(({ key }) => key === selectedKey);
    if (!group) return alert('请选择战斗记录文件');
    if (group.files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_FILE_SIZE) {
      return alert('所选战斗的文件总大小不能超过 100MB');
    }

    try {
      const content = (await Promise.all(group.files.map((file) => file.text()))).join('\n');
      const rows = buildStatisticsRows(
        extractBattleStatistics(content),
        extractCharacterNames(content),
      );
      setResult({
        label: `${group.key}（${group.files.length} 个文件）`,
        rows,
        totals: {
          Damage: rows.reduce((sum, row) => sum + (row.Damage || 0), 0),
          BossDamgage: rows.reduce((sum, row) => sum + (row.BossDamgage || 0), 0),
          BeDamaged: rows.reduce((sum, row) => sum + (row.BeDamaged || 0), 0),
          Heal: rows.reduce((sum, row) => sum + (row.Heal || 0), 0),
        },
      });
    } catch (error) {
      console.error(error);
      alert(`${error.message || '文件读取失败'}，请确认已选择战斗结束时生成的记录。`);
    }
  };

  const clearData = () => {
    setGroups([]);
    setSelectedKey('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="container py-5">
      <h1 className="text-center mb-4">《天地劫：幽城再临》PC 端战斗统计工具</h1>
      <form onSubmit={handleSubmit} className="mb-4 d-flex flex-wrap gap-2 align-items-center">
        <input
          type="file"
          multiple
          accept=".bl,.txt"
          className="form-control statistics-file-input"
          onChange={handleFileChange}
          ref={fileInputRef}
        />
        {groups.length > 0 && (
          <select
            className="form-select statistics-battle-select"
            aria-label="选择战斗"
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
          >
            {groups.map((group) => (
              <option key={group.key} value={group.key}>
                战斗 {group.battleId}（{group.files.length} 个文件）
              </option>
            ))}
          </select>
        )}
        <button type="submit" className="btn btn-primary">分析</button>
        <button type="button" className="btn btn-secondary" onClick={clearData}>清除</button>
        <button type="button" className="btn btn-info ms-auto" onClick={() => setHelpVisible(!helpVisible)}>
          {helpVisible ? '隐藏帮助' : '显示帮助'}
        </button>
      </form>

      {helpVisible && (
        <div className="mb-4 p-3 border rounded bg-light">
          <h2>使用方法</h2>
          <ol>
            <li>战斗结束后关闭游戏客户端。</li>
            <li>
              在 <code>C:\Users\你的用户名\AppData\LocalLow\紫龙游戏\天地劫：幽城再临\Config</code>
              中找到本次战斗生成的全部 <code>.bl</code> 文件。
            </li>
            <li>
              文件名示例：
              <code>9834750923847561982_11223344(9876543210)_20250227_123456.bl</code>。
              括号内的 <code>9876543210</code> 是战斗 ID。
            </li>
            <li>
              请找到所有括号内战斗 ID 相同的文件，并在文件选择窗口中一次性全部选中。
            </li>
            <li>工具会按战斗 ID 自动分组，并按文件名中的时间排序；选择目标战斗后点击“分析”。</li>
            <li>文件只在浏览器本地处理，不会上传到服务器。</li>
          </ol>
          <p className="mb-0">
            新版直接读取游戏输出的 <code>userId2BattleStatistics</code> 汇总数据。
            单位名称仍从日志的 <code>charId/charName</code> 提取；缺失时显示 CharId。
          </p>
          <h2>更新笔记</h2>
          <ul>
            <li>0.3：直接读取游戏内置统计，以清晰的单表展示结果。</li>
            <li>0.2：修复 BOSS 换面时跨面伤害漏算的问题，并增加换面血量输入。</li>
            <li>0.1：第一版发布，支持从战斗记录中统计首领战伤害。</li>
          </ul>
          <h2>代码仓库</h2>
          <p>
            查看源代码或反馈问题，请访问{' '}
            <a href="https://github.com/ITX351/tdj_act" target="_blank" rel="noreferrer">
              ITX351 GitHub
            </a>
          </p>
          <p className="mb-0 text-muted">by ITX351</p>
        </div>
      )}

      {result && (
        <section>
          <h2 className="mb-2">单位战斗统计</h2>
          <p className="text-muted">当前加载：{result.label}</p>
          <div className="table-responsive">
            <table className="table table-striped table-hover align-middle">
              <thead>
                <tr>
                  <th>单位</th>
                  <th className="text-end">总伤害</th>
                  <th className="text-end">首领伤害</th>
                  <th className="text-end">占比</th>
                  <th className="text-end">承伤</th>
                  <th className="text-end">治疗</th>
                  <th className="text-end">暴击次数</th>
                  <th className="text-end">最高单次伤害</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={`${row.CharId}-${row.MasterCharId}`}>
                    <td>{row.name}</td>
                    <td className="text-end">
                      {formatNumber(row.Damage)}
                      <TurnDamageDetails turnDamage={row.TurnDamageDict} />
                    </td>
                    <td className="text-end">{formatNumber(row.BossDamgage)}</td>
                    <td className="text-end">{formatPercent(row.bossDamageShare)}</td>
                    <td className="text-end">{formatNumber(row.BeDamaged)}</td>
                    <td className="text-end">{formatNumber(row.Heal)}</td>
                    <td className="text-end">{formatNumber(row.Critical)}</td>
                    <td className="text-end">{formatNumber(row.MaxDamage)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="table-dark">
                  <th>合计</th>
                  <th className="text-end">{formatNumber(result.totals.Damage)}</th>
                  <th className="text-end">{formatNumber(result.totals.BossDamgage)}</th>
                  <th className="text-end">{result.totals.BossDamgage ? '100.0%' : '0.0%'}</th>
                  <th className="text-end">{formatNumber(result.totals.BeDamaged)}</th>
                  <th className="text-end">{formatNumber(result.totals.Heal)}</th>
                  <th />
                  <th />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
