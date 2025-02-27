import React, { useState, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css'; // 引入新的CSS文件

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsVisible, setLogsVisible] = useState(false);
  const [fileName, setFileName] = useState(''); // 添加文件名状态
  const fileInputRef = useRef(null); // 添加引用
  const [helpVisible, setHelpVisible] = useState(false); // 添加帮助按钮状态

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert('请上传一个文件');
      return;
    }
    if (file.size > 15 * 1024 * 1024) { // 文件大小限制为15MB
      alert('文件大小不能超过15MB');
      return;
    }
    setFileName(file.name); // 存储文件名
    clearData();

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileContent = event.target.result;
      const damageInfo = parseDamageInfo(fileContent);

      // 过滤并处理我方阵容
      const allies = {};
      Object.values(damageInfo.characters)
        .filter(character => character.actorId >= 1000)
        .forEach(character => {
          if (allies[character.charName]) {
            allies[character.charName] += character.damage;
          } else {
            allies[character.charName] = character.damage;
          }
        });

      // 将我方阵容按伤害量降序排序
      const sortedAllies = Object.entries(allies).sort((a, b) => b[1] - a[1]);

      // 过滤并处理BOSS列表
      const bosses = Object.values(damageInfo.characters)
        .filter(character => character.bossId !== null)
        .map(character => ({
          bossId: character.bossId,
          actorId: character.actorId,
          charName: character.charName,
          damage: character.damage,
        }))
        .sort((a, b) => a.bossId - b.bossId); // 按bossId升序排序

      // 计算总伤害
      const totalAllyDamage = Object.values(allies).reduce((sum, damage) => sum + damage, 0);
      const totalBossDamage = bosses.reduce((sum, boss) => sum + boss.damage, 0);

      setResult({ sortedAllies, bosses, totalAllyDamage, totalBossDamage, totalDamage: damageInfo.totalDamage });
    };
    reader.readAsText(file);
  };

  const clearData = () => {
    setFile(null);
    setResult(null);
    setLogs([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // 重置文件输入控件
    }
  };

  const logMessage = (message) => {
    console.log(message);
    setLogs((prevLogs) => [...prevLogs, message]);
  };

  const parseDamageInfo = (content) => {
    const damageInfo = {
      totalDamage: 0,
      characters: {},
      boss: {
        curName: null,
        curActorId: null,
        curHp: 0,
        bossCounter: 1, // 添加boss计数器
      },
    };

    let currentActor = null;
    let currentAction = null;

    const calculateDamage = (damageInfo, currentActor, damage, currentAction, changeBoss=false) => {
      damageInfo.characters[currentActor].damage += damage;
      damageInfo.totalDamage += damage;
      logMessage(`角色 ${damageInfo.characters[currentActor].charName} 使用 ${currentAction}，${damageInfo.boss.curActorId}${damageInfo.boss.curName} 受到了 ${damage} 伤害` + (changeBoss ? `, 换面时总伤害 ${damageInfo.totalDamage}` : ``));
    };

    const lines = content.split('\n');
    lines.forEach((line) => {
      if (line.startsWith('--CHR beforeCmdExec ')) {
        const actorId = parseInt(line.match(/actorId:(\d+)/)[1], 10);
        const charName = line.match(/charName:([^ ]+)/)[1];

        if (actorId > 0) {
          if (!damageInfo.characters[actorId]) {
            damageInfo.characters[actorId] = {
              actorId,
              charName,
              damage: 0,
              bossId: null, // 初始化bossId为null
            };
          }
        } 
        if (actorId < 1000) {
          const curHp = parseInt(line.match(/curHp:(\d+)/)[1], 10);
          if (actorId === damageInfo.boss.curActorId || curHp >= 150000) {
            if (currentActor && currentActor in damageInfo.characters) {
              const damage = damageInfo.boss.curHp;
              calculateDamage(damageInfo, currentActor, damage, currentAction, true);
            }
            damageInfo.boss.curName = charName;
            damageInfo.boss.curActorId = actorId;
            damageInfo.boss.curHp = curHp;
            damageInfo.characters[actorId].bossId = damageInfo.boss.bossCounter++; // 设置bossId并递增计数器
          }
        }
      } else if (line.startsWith('--CMD actorId:')) {
        currentActor = parseInt(line.match(/actorId:(\d+)/)[1], 10);
        const actionMatch = line.match(/\(([^ ]+)\)/);
        currentAction = actionMatch && actionMatch.length > 1 ? actionMatch[1] : null;
      } else if (line.startsWith('--CHR actorId:')) {
        const actorId = parseInt(line.match(/actorId:(\d+)/)[1], 10);
        const curHp = parseInt(line.match(/curHp:(\d+)/)[1], 10);
        if (actorId === damageInfo.boss.curActorId && currentActor) {
          if (currentActor in damageInfo.characters) {
            const damage = damageInfo.boss.curHp - curHp;
            if (damage > 0) {
              calculateDamage(damageInfo, currentActor, damage, currentAction);
            }
            currentActor = null;
            currentAction = null;
          } else {
            logMessage(`未找到角色 ${currentActor}`);
          }
        }
      } else if (line.startsWith('--Turn:')) {
        const currectTurn = parseInt(line.match(/--Turn:(\d+)/)[1], 10);
        logMessage(`——当前回合 ${currectTurn}——`);
      }
    });

    return damageInfo;
  };

  return (
    <div className="container mt-5">
      <h1 className="text-center mb-4">《天地劫：幽城再临》PC端首领战伤害统计工具</h1>
      <form onSubmit={handleSubmit} className="mb-4 d-flex justify-content-between align-items-center">
        <div className="form-group">
          <input type="file" className="form-control-file" onChange={handleFileChange} ref={fileInputRef} />
          <button type="submit" className="btn btn-primary">上传</button>
          <button type="button" className="btn btn-secondary ml-2" onClick={clearData}>清除</button>
        </div>
        <button type="button" className="btn btn-info" onClick={() => setHelpVisible(!helpVisible)}>
          {helpVisible ? '隐藏帮助' : '显示帮助'}
        </button>
      </form>
      {helpVisible && (
        <div className="mb-4 p-3 border rounded bg-light">
          <h2>使用方法</h2>
          <ol>
            <li><strong>战斗结束后关闭游戏客户端。</strong></li>
            <li><strong>找到手游的数据存储路径：</strong>
              <ul>
                <li>路径示例：<code>C:\Users\your_username\AppData\LocalLow\紫龙游戏\天地劫：幽城再临\Config</code></li>
              </ul>
            </li>
            <li><strong>找到最后一个 `.bl` 格式的文件，大小约 1~5MB：</strong>
              <ul>
                <li>文件示例：<code>9834750923847561982_11223344(9876543210)_20250227_123456.bl</code></li>
              </ul>
            </li>
            <li><strong>选择此文件上传，获取统计数据。</strong></li>
          </ol>
          <h2>其他事项</h2>
          <ul>
            <li>上传的文件不能大于15MB。</li>
            <li>统计出生时血量大于150,000的单位作为敌方BOSS单位，统计actorId&gt;1000的单位作为我方单位，因此可能会有误判。</li>
            <li>回合数可能有误判，有些生成的文件怪怪的。</li>
          </ul>
          <h2>代码仓库</h2>
          <p>查看代码仓库，请访问 <a href="https://github.com/ITX351/tdj_act" target="_blank" rel="noreferrer">ITX351 GitHub</a></p>
        </div>
      )}
      {result && (
        <div>
          <h2 className="mb-4">统计结果</h2>
          <p>当前加载文件: {fileName}</p>
          <div className="row">
            <div className="col-md-6 mb-4">
              <h3>我方阵容</h3>
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>角色名</th>
                    <th>伤害</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sortedAllies.map(([charName, damage]) => (
                    <tr key={charName}>
                      <td>{charName}</td>
                      <td>{damage}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>总伤害</td>
                    <td>{result.totalAllyDamage}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="col-md-6 mb-4">
              <h3>BOSS列表</h3>
              <table className="table table-striped">
                <thead>
                  <tr>
                    {/* <th>Actor ID</th> */}
                    <th>角色名</th>
                    <th>受到伤害</th>
                  </tr>
                </thead>
                <tbody>
                  {result.bosses.map(boss => (
                    <tr key={boss.actorId}>
                      {/* <td>{boss.actorId}</td> */}
                      <td>{boss.charName}</td>
                      <td>{boss.damage}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>总承伤</td>
                    <td>{result.totalBossDamage}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div className="mb-4">
            <h3>总伤害</h3>
            <p>{result.totalDamage}</p>
          </div>
        </div>
      )}
      {logs.length > 0 && (
        <div>
          <h2>日志</h2>
          <button className="btn btn-link" onClick={() => setLogsVisible(!logsVisible)}>
            {logsVisible ? '折叠' : '展开'}
          </button>
          {logsVisible && <pre className="bg-light p-3">{logs.join('\n')}</pre>}
        </div>
      )}
    </div>
  );
}

export default App;