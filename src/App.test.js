import {
  buildStatisticsRows,
  extractBattleStatistics,
  extractCharacterNames,
  getTurnDamageEntries,
  groupLogFiles,
} from './App';
import { readFileSync } from 'fs';

test('groups new log fragments and treats a legacy filename as its battle id', () => {
  const files = [
    { name: '1_22(333)_20260728_143940.bl', size: 1 },
    { name: '1_22(444)_20260728_135129.bl', size: 1 },
    { name: '1_22(333)_20260728_135147.bl', size: 1 },
    { name: 'notes.txt', size: 1 },
  ];

  const groups = groupLogFiles(files);

  expect(groups).toHaveLength(3);
  expect(groups[0].battleId).toBe('333');
  expect(groups[0].files.map((file) => file.name)).toEqual([
    '1_22(333)_20260728_135147.bl',
    '1_22(333)_20260728_143940.bl',
  ]);
  expect(groups.find((group) => group.battleId === 'notes.txt').files).toEqual([files[3]]);
});

test('reads the last built-in statistics block and joins character names', () => {
  const content = [
    'userId2BattleStatistics:1,[{"CharId":1,"Damage":1}]',
    '--CHR beforeCmdExec actorId:1001 charId:100107300 charName:波旬尉迟良 teamId:1 CHR--',
    'userId2BattleStatistics:1,[{"CharId":100107300,"MasterCharId":0,"Damage":120,"BossDamgage":100}]',
    'battleTurnCount:1',
  ].join('\n');

  const records = extractBattleStatistics(content);
  const rows = buildStatisticsRows(records, extractCharacterNames(content));

  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    name: '波旬尉迟良',
    Damage: 120,
    BossDamgage: 100,
    bossDamageShare: 1,
  });
});

test('reads every record in json_sample.txt', () => {
  const content = readFileSync('sample260728/json_sample.txt', 'utf8');
  const records = extractBattleStatistics(content);

  expect(records).toHaveLength(13);
  expect(records.reduce((sum, record) => sum + record.Damage, 0)).toBe(10515978);
  expect(records.reduce((sum, record) => sum + record.BossDamgage, 0)).toBe(10491740);
});

test('converts zero-based turn damage to sorted display turns', () => {
  expect(getTurnDamageEntries({ 10: 225402, 0: 179018, 2: 266159 })).toEqual([
    [1, 179018],
    [3, 266159],
    [11, 225402],
  ]);
});
