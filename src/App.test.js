import { groupLogFiles } from './App';

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
