/**
 * 主应用逻辑
 */

// UI 元素引用
const UI = {
    loginSection: document.getElementById('login-section'),
    appSection: document.getElementById('app-section'),
    statusSection: document.getElementById('status-section'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    analyzeBtn: document.getElementById('analyze-btn'),
    reportUrlInput: document.getElementById('report-url'),
    fightSelect: document.getElementById('fight-select'),
    fightSelectorContainer: document.getElementById('fight-selector-container'),
    logContainer: document.getElementById('log-container'),
    debugModeCheckbox: document.getElementById('debug-mode-checkbox'),
    ignoreAutoAttackCheckbox: document.getElementById('ignore-auto-attack-checkbox'),
    mergeDotCheckbox: document.getElementById('merge-dot-checkbox'),
    mergeAoeCheckbox: document.getElementById('merge-aoe-checkbox'),
    allInOneModeCheckbox: document.getElementById('all-in-one-mode-checkbox'),
    // Custom Client ID UI
    useCustomClientIdCheckbox: document.getElementById('use-custom-client-id'),
    customClientIdInput: document.getElementById('custom-client-id'),
    customClientInputContainer: document.getElementById('custom-client-input-container'),
    helpClientIdBtn: document.getElementById('help-client-id-btn'),
    clientIdModal: document.getElementById('client-id-modal'),
    closeModalBtn: document.querySelector('.close-modal'),
    modalRedirectUri: document.getElementById('modal-redirect-uri')
};

// 全局状态
let currentReportCode = null;
let currentReportData = null;

// 初始化
async function init() {
    // 检查是否有错误返回
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('error')) {
        const error = urlParams.get('error');
        const errorDesc = urlParams.get('error_description');
        log(`登录失败: ${error} - ${errorDesc}`, true);
        // 清除 URL 参数
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }

    // 检查是否是 OAuth 回调
    if (window.location.search.includes('code=')) {
        log('正在处理登录回调...');
        const success = await Auth.handleCallback();
        if (success) {
            log('登录成功！');
            // 清除 URL 参数
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    updateAuthUI();

    // 事件绑定
    UI.loginBtn.addEventListener('click', () => {
        // 保存自定义 Client ID
        if (UI.useCustomClientIdCheckbox.checked && UI.customClientIdInput.value.trim()) {
            localStorage.setItem('fflogs_custom_client_id', UI.customClientIdInput.value.trim());
        } else {
            localStorage.removeItem('fflogs_custom_client_id');
        }
        Auth.login();
    });
    UI.logoutBtn.addEventListener('click', () => Auth.logout());
    UI.analyzeBtn.addEventListener('click', handleAnalyze);
    UI.reportUrlInput.addEventListener('change', handleUrlInput);
    
    // 自定义 Client ID UI 逻辑
    initCustomClientIdUI();
}

function initCustomClientIdUI() {
    // 恢复保存的 Client ID
    const savedClientId = localStorage.getItem('fflogs_custom_client_id');
    if (savedClientId) {
        UI.useCustomClientIdCheckbox.checked = true;
        UI.customClientIdInput.value = savedClientId;
        UI.customClientInputContainer.classList.remove('hidden');
    }

    // 切换显示
    UI.useCustomClientIdCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            UI.customClientInputContainer.classList.remove('hidden');
        } else {
            UI.customClientInputContainer.classList.add('hidden');
        }
    });

    // 模态框逻辑
    UI.helpClientIdBtn.addEventListener('click', () => {
        UI.modalRedirectUri.textContent = CONFIG.REDIRECT_URI;
        UI.clientIdModal.classList.remove('hidden');
    });

    UI.closeModalBtn.addEventListener('click', () => {
        UI.clientIdModal.classList.add('hidden');
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === UI.clientIdModal) {
            UI.clientIdModal.classList.add('hidden');
        }
    });
}



function updateAuthUI() {
    if (Auth.isAuthenticated()) {
        UI.loginSection.classList.add('hidden');
        UI.appSection.classList.remove('hidden');
    } else {
        UI.loginSection.classList.remove('hidden');
        UI.appSection.classList.add('hidden');
    }
}

function log(message, isError = false) {
    UI.statusSection.classList.remove('hidden');
    const div = document.createElement('div');
    div.className = `log-entry ${isError ? 'log-error' : ''}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    UI.logContainer.appendChild(div);
    UI.logContainer.scrollTop = UI.logContainer.scrollHeight;
}

// 暴露给 API 模块使用
window.updateLog = log;

// 解析 URL 获取 Report Code
function parseReportCode(url) {
    // 支持格式: 
    // https://www.fflogs.com/reports/a1b2c3d4e5f6
    // https://www.fflogs.com/reports/a1b2c3d4e5f6#fight=3
    try {
        const match = url.match(/reports\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

// 处理 URL 输入，自动加载战斗列表
async function handleUrlInput() {
    const url = UI.reportUrlInput.value.trim();
    if (!url) return;

    const code = parseReportCode(url);
    if (!code) {
        log('无效的 Report URL', true);
        return;
    }

    if (code === currentReportCode && currentReportData) return;

    try {
        UI.analyzeBtn.disabled = true;
        log(`正在获取 Report 信息: ${code}...`);
        
        const reportData = await API.getReportFights(code);
        currentReportCode = code;
        currentReportData = reportData;

        log(`获取成功: ${reportData.title}`);
        renderFightSelector(reportData.fights);
        
        // 尝试从 URL 自动选择战斗
        const fightMatch = url.match(/fight=([0-9]+|last)/);
        if (fightMatch) {
            const fightId = fightMatch[1];
            if (fightId === 'last') {
                UI.fightSelect.selectedIndex = UI.fightSelect.options.length - 1;
            } else {
                UI.fightSelect.value = fightId;
            }
        }

    } catch (error) {
        log(`获取 Report 失败: ${error.message}`, true);
    } finally {
        UI.analyzeBtn.disabled = false;
    }
}

function renderFightSelector(fights) {
    UI.fightSelectorContainer.classList.remove('hidden');
    UI.fightSelect.innerHTML = '';
    
    fights.forEach(fight => {
        // 过滤掉小怪战斗，通常只关心 Boss (fight.boss 不为 0 或有特定标记，这里简单展示所有)
        const option = document.createElement('option');
        option.value = fight.id;
        const duration = Math.round((fight.endTime - fight.startTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        option.textContent = `${fight.name} (${minutes}:${seconds.toString().padStart(2, '0')}) - ${fight.kill ? '击杀' : '灭团'} - ${fight.fightPercentage}%`;
        UI.fightSelect.appendChild(option);
    });
}

// 核心分析逻辑
async function handleAnalyze() {
    if (!currentReportData) {
        await handleUrlInput();
        if (!currentReportData) return;
    }

    const fightId = parseInt(UI.fightSelect.value);
    const fight = currentReportData.fights.find(f => f.id === fightId);
    
    if (!fight) {
        log('请选择一场战斗', true);
        return;
    }

    try {
        UI.analyzeBtn.disabled = true;
        log(`开始分析战斗: ${fight.name} (ID: ${fightId})`);

        // 1. 识别非玩家 Actor ID 和 技能映射
        const actors = currentReportData.masterData.actors;
        const abilities = currentReportData.masterData.abilities || [];
        
        // 1.0 筛选本场战斗的玩家
        const fightPlayerIds = new Set(fight.friendlyPlayers || []);
        const currentFightPlayers = actors.filter(a => 
            fightPlayerIds.has(a.id) && a.type === 'Player'
        ).map(a => ({
            id: a.id,
            name: a.name,
            job: a.subType
        }));
        
        // 识别坦克玩家 ID
        const tankJobs = new Set(['Paladin', 'Warrior', 'DarkKnight', 'Gunbreaker']);
        const tankPlayerIds = new Set(
            currentFightPlayers
                .filter(p => tankJobs.has(p.job))
                .map(p => p.id)
        );

        log(`本场战斗检测到 ${currentFightPlayers.length} 名玩家，其中 ${tankPlayerIds.size} 名坦克`);
        if (UI.debugModeCheckbox && UI.debugModeCheckbox.checked) {
            console.log('本场战斗玩家:', currentFightPlayers);
            console.log('坦克玩家ID:', Array.from(tankPlayerIds));
        }

        // 1.1 找出所有玩家 ID (MasterData 中的所有玩家，用于过滤)
        const playerIds = new Set(
            actors.filter(a => a.type === 'Player').map(a => a.id)
        );

        // 1.2 找出所有玩家的宠物/召唤物/放置物 ID
        // 判定标准: type 为 'Pet' 或 'LimitBreak'，或者 petOwner 是玩家
        const playerPetIds = new Set(
            actors.filter(a => {
                const isPetType = a.type === 'Pet' || a.type === 'LimitBreak';
                // API v2 中 petOwner 直接返回 ID (Int)，而不是对象
                const isOwnedByPlayer = a.petOwner && playerIds.has(a.petOwner);
                return isPetType || isOwnedByPlayer;
            }).map(a => a.id)
        );
        
        // 建立 ID 到名称的映射
        const actorMap = {};
        actors.forEach(a => actorMap[a.id] = a);

        // 建立 Ability GameID 到名称的映射
        const abilityMap = {};
        const abilityTypeMap = {};
        abilities.forEach(ab => {
            abilityMap[ab.gameID] = ab.name;
            abilityTypeMap[ab.gameID] = ab.type;
        });

        // 2. 获取伤害事件
        log('正在下载事件数据...');
        // 修改：为了获取 limitbreakupdate 事件以校准时间，我们需要获取所有类型的事件 (dataType = null)
        // 虽然这会增加下载量，但为了时间轴的精确性是必要的
        const dataType = null; 
        const events = await API.getDamageEvents(currentReportCode, fightId, fight.startTime, fight.endTime, dataType);
        log(`共获取 ${events.length} 条原始事件`);

        // 确定有效战斗开始时间
        let effectiveStartTime = fight.startTime;
        
        // 1. 尝试寻找 limitbreakupdate 事件 (通常是战斗真正的开始)
        let firstLBTime = null;
        for (const e of events) {
            if (e.type === 'limitbreakupdate') {
                if (firstLBTime === null || e.timestamp < firstLBTime) {
                    firstLBTime = e.timestamp;
                }
            }
        }

        if (firstLBTime !== null) {
            log(`[时间校准] 使用 LimitBreakUpdate。原战斗开始时间: ${fight.startTime}, LB事件时间: ${firstLBTime}, 偏移: ${firstLBTime - fight.startTime}ms`);
            effectiveStartTime = firstLBTime;
        } else {
            // 2. 如果没找到 LB Update，回退到使用第一个 Damage 事件
            let firstDamageTime = null;
            for (const e of events) {
                if (e.type === 'damage') {
                    if (firstDamageTime === null || e.timestamp < firstDamageTime) {
                        firstDamageTime = e.timestamp;
                    }
                }
            }
            if (firstDamageTime !== null) {
                log(`[时间校准] 未找到 LB Update，回退到首个伤害事件。原战斗开始时间: ${fight.startTime}, 首个伤害事件时间: ${firstDamageTime}, 偏移: ${firstDamageTime - fight.startTime}ms`);
                effectiveStartTime = firstDamageTime;
            }
        }

        // 3. 数据处理
        log('正在处理数据...');
        
        // DEBUG: 导出原始数据以便检查
        // 将原始事件数据直接导出，不做任何过滤
        const rawDataForDebug = events.map(event => {
            let abilityName = 'Unknown';
            if (event.ability && event.ability.name) {
                abilityName = event.ability.name;
            } else if (event.abilityGameID && abilityMap[event.abilityGameID]) {
                abilityName = abilityMap[event.abilityGameID];
            }

            return {
                timestamp: event.timestamp,
                type: event.type,
                sourceID: event.sourceID,
                targetID: event.targetID,
                abilityName: abilityName,
                abilityId: event.ability ? event.ability.guid : event.abilityGameID,
                amount: event.amount,
                raw: JSON.stringify(event)
            };
        });

        // DEBUG: 导出详细调试信息 (Raw Events + Master Data) - 仅在勾选 Debug 模式时执行
        if (UI.debugModeCheckbox && UI.debugModeCheckbox.checked) {
            try {
                log('正在生成调试文件 (包含 Master Data)...');
                const debugWb = XLSX.utils.book_new();
                
                // 1. Raw Events Sheet
                const wsRaw = XLSX.utils.json_to_sheet(rawDataForDebug);
                XLSX.utils.book_append_sheet(debugWb, wsRaw, "Raw Events");

                // 2. Actors Sheet
                if (actors && actors.length > 0) {
                    const wsActors = XLSX.utils.json_to_sheet(actors);
                    XLSX.utils.book_append_sheet(debugWb, wsActors, "MasterData Actors");
                }

                // 3. Abilities Sheet
                if (abilities && abilities.length > 0) {
                    const wsAbilities = XLSX.utils.json_to_sheet(abilities);
                    XLSX.utils.book_append_sheet(debugWb, wsAbilities, "MasterData Abilities");
                }

                XLSX.writeFile(debugWb, `DEBUG_FULL_${fight.name}.xlsx`);
                log(`已导出调试文件: DEBUG_FULL_${fight.name}.xlsx`);
            } catch (debugError) {
                console.error('导出调试文件失败', debugError);
                log('导出调试文件失败，请查看控制台', true);
            }
        }

        // 先过滤掉玩家和宠物的事件
        // 注意：这里不再过滤 calculateddamage，因为需要用它来做快照绑定
        let filteredEvents = events.filter(event => {
            // 如果获取了所有事件，必须过滤掉非伤害相关的事件 (保留 damage 和 calculateddamage)
            // 注意：tick 事件通常 type 也是 damage，但如果有独立的 tick type 也要考虑 (FFLogs v2 通常是 damage + tick:true)
            if (event.type !== 'damage' && event.type !== 'calculateddamage') return false;

            if (event.sourceID && playerIds.has(event.sourceID)) return false;
            if (event.sourceID && playerPetIds.has(event.sourceID)) return false;

            // 过滤 Combined DoT (FF Logs 汇总数据，会导致重复)
            let checkName = '';
            if (event.ability && event.ability.name) {
                checkName = event.ability.name;
            } else if (event.abilityGameID && abilityMap[event.abilityGameID]) {
                checkName = abilityMap[event.abilityGameID];
            }
            if (checkName === 'Combined DoTs') return false;

            // 忽略普通攻击逻辑
            if (UI.ignoreAutoAttackCheckbox && UI.ignoreAutoAttackCheckbox.checked) {
                // 检查 Game ID (通常普攻是 1)
                if (event.abilityGameID === 1) return false;

                // 检查名称
                let abilityNameEn = '';
                if (event.ability && event.ability.name) {
                    abilityNameEn = event.ability.name;
                } else if (event.abilityGameID && abilityMap[event.abilityGameID]) {
                    abilityNameEn = abilityMap[event.abilityGameID];
                }
                
                if (abilityNameEn === 'Attack' || abilityNameEn === 'Auto Attack') return false;
            }

            return true;
        });

        // --- 快照绑定逻辑 (Snapshot Binding) ---
        // 1. 建立快照索引
        // 遍历所有事件，如果是 calculateddamage，则记录下来。
        // 由于我们需要为每个 damage 事件找到其“之前”最近的一个 calculateddamage，
        // 我们可以维护一个 Map: key -> latest calculateddamage event
        const snapshotMap = new Map(); // Key: sourceID_targetID_abilityID
        
        // 2. 遍历并绑定
        // 我们需要按时间顺序遍历，这样当遇到 damage 事件时，snapshotMap 中存储的就是最近的 calculateddamage
        // 假设 events 已经是按时间排序的 (API 通常返回有序数据)
        
        // 用于存储最终用于分析的 damage 事件 (已更新时间戳)
        const boundDamageEvents = [];

        filteredEvents.forEach(event => {
            const abilityId = event.abilityGameID || (event.ability ? event.ability.guid : 0);
            const key = `${event.sourceID}_${event.targetID}_${abilityId}`;

            if (event.type === 'calculateddamage') {
                // 更新该 Key 的最新快照
                snapshotMap.set(key, event);
            } else if (event.type === 'damage') {
                // 尝试查找对应的快照
                const snapshot = snapshotMap.get(key);
                if (snapshot) {
                    // 找到快照，更新时间戳
                    // 注意：这里我们克隆一个新对象，以免修改原始数据影响调试
                    const newEvent = { ...event, timestamp: snapshot.timestamp };
                    boundDamageEvents.push(newEvent);
                } else {
                    // 没找到快照，保留原样 (或者根据需求决定是否丢弃，通常保留)
                    boundDamageEvents.push(event);
                }
            }
            // 其他类型 (如 tick) 如果需要处理可以在这里添加，目前只关注 damage
        });

        // 使用绑定后的事件列表替换 filteredEvents 进行后续处理
        filteredEvents = boundDamageEvents;
        
        // 重新按时间排序 (因为时间戳被修改了，顺序可能变了)
        filteredEvents.sort((a, b) => a.timestamp - b.timestamp);

        log(`快照绑定完成，处理 ${filteredEvents.length} 条伤害事件`);

        // 处理 DoT 合并逻辑
        if (UI.mergeDotCheckbox && UI.mergeDotCheckbox.checked) {
            log('正在合并 DoT 伤害...');
            const directEvents = [];
            const dotEvents = [];

            // 1. 分离直伤和 DoT
            filteredEvents.forEach(e => {
                if (e.tick) {
                    dotEvents.push(e);
                } else {
                    directEvents.push(e);
                }
            });

            // 2. 对 DoT 进行分组聚合
            // Key: sourceID_targetID_abilityGameID
            const dotGroups = new Map();
            
            dotEvents.forEach(e => {
                const key = `${e.sourceID}_${e.targetID}_${e.abilityGameID}`;
                if (!dotGroups.has(key)) {
                    dotGroups.set(key, []);
                }
                dotGroups.get(key).push(e);
            });

            const mergedDotEvents = [];
            const DOT_GAP_THRESHOLD = 4000; // 4秒间隔判定为新的 DoT 序列

            dotGroups.forEach((groupEvents, key) => {
                // 按时间排序
                groupEvents.sort((a, b) => a.timestamp - b.timestamp);

                let currentCluster = null;

                groupEvents.forEach(e => {
                    if (!currentCluster) {
                        currentCluster = {
                            events: [e],
                            startTime: e.timestamp,
                            lastTime: e.timestamp
                        };
                    } else {
                        if (e.timestamp - currentCluster.lastTime <= DOT_GAP_THRESHOLD) {
                            currentCluster.events.push(e);
                            currentCluster.lastTime = e.timestamp;
                        } else {
                            // 结束当前 Cluster，推入结果
                            mergedDotEvents.push(createSyntheticDotEventNew(currentCluster));
                            // 开启新 Cluster
                            currentCluster = {
                                events: [e],
                                startTime: e.timestamp,
                                lastTime: e.timestamp
                            };
                        }
                    }
                });
                // 处理最后一个 Cluster
                if (currentCluster) {
                    mergedDotEvents.push(createSyntheticDotEventNew(currentCluster));
                }
            });

            // 3. 合并回主事件流
            filteredEvents = [...directEvents, ...mergedDotEvents];
            // 重新按时间排序
            filteredEvents.sort((a, b) => a.timestamp - b.timestamp);
            
            log(`DoT 合并完成: ${dotEvents.length} 条 Tick 合并为 ${mergedDotEvents.length} 条记录`);
        }

        // 1. 预计算所有事件的原始伤害
        filteredEvents.forEach(event => {
            let raw = event.unmitigatedAmount;
            if (raw === undefined || raw === null) {
                const amt = event.amount || 0;
                const abs = event.absorbed || 0;
                const over = event.overkill || 0; // 考虑 overkill
                const mult = event.multiplier || 1;
                raw = (mult !== 0) ? (amt + abs + over) / mult : (amt + abs + over);
            }
            event.calculatedRaw = raw;
        });

        // DEBUG: 导出筛选后、合并前的事件列表 (Filtered Events)
        if (UI.debugModeCheckbox && UI.debugModeCheckbox.checked) {
            try {
                console.log(`[Debug] 战斗开始时间 (fight.startTime): ${fight.startTime}`);
                console.log(`[Debug] 有效战斗开始时间 (effectiveStartTime): ${effectiveStartTime}`);
                
                const filteredDataForDebug = filteredEvents.map(event => {
                    // 计算相对时间
                    const relativeTime = event.timestamp - effectiveStartTime;
                    const sign = relativeTime < 0 ? "-" : "";
                    const absTime = Math.abs(relativeTime);
                    const mm = Math.floor(absTime / 60000);
                    const ss = Math.floor((absTime % 60000) / 1000);
                    const ms = absTime % 1000;
                    const timeStr = `${sign}${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;

                    let abilityName = 'Unknown';
                    if (event.ability && event.ability.name) {
                        abilityName = event.ability.name;
                    } else if (event.abilityGameID && abilityMap[event.abilityGameID]) {
                        abilityName = abilityMap[event.abilityGameID];
                    }

                    return {
                        'Time': timeStr,
                        'Timestamp': event.timestamp,
                        'Ability': abilityName,
                        'Type': event.type,
                        'Amount': event.amount,
                        'Absorbed': event.absorbed,
                        'Multiplier': event.multiplier,
                        'Raw (Calc)': event.calculatedRaw
                    };
                });

                // 读取现有的调试文件 (如果存在) 或者新建一个
                // 由于之前的调试文件是在数据获取阶段生成的，这里我们最好是追加到一个新的文件或者覆盖
                // 为了简单起见，我们重新生成一个包含所有 Sheet 的调试文件，或者追加到之前的逻辑里比较困难
                // 这里选择生成一个新的补充调试文件，或者如果之前的 debugWb 对象能传递过来最好
                // 但由于之前的 debugWb 是局部变量，这里无法访问。
                // 策略：生成一个新的 Excel 文件 "DEBUG_FILTERED_Events.xlsx"
                
                const debugFilteredWb = XLSX.utils.book_new();
                const wsFiltered = XLSX.utils.json_to_sheet(filteredDataForDebug);
                XLSX.utils.book_append_sheet(debugFilteredWb, wsFiltered, "Filtered Events");
                XLSX.writeFile(debugFilteredWb, `DEBUG_FILTERED_${fight.name}.xlsx`);
                log(`已导出筛选后调试文件: DEBUG_FILTERED_${fight.name}.xlsx`);

            } catch (debugError) {
                console.error('导出筛选后调试文件失败', debugError);
            }
        }

        // 2. 初步分组 (按时间、来源、技能)
        // 修改：不再使用时间阈值，而是精确匹配时间戳 (因为已经对齐到快照时间)
        const tempGroups = []; 
        
        // 检查是否开启 AOE 合并
        const shouldMergeAoe = UI.mergeAoeCheckbox && UI.mergeAoeCheckbox.checked;

        filteredEvents.forEach(event => {
            const abilityId = event.abilityGameID || (event.ability ? event.ability.guid : 0);
            const sourceId = event.sourceID || 0;
            
            // 如果不合并 AOE，直接每个事件单独一组
            if (!shouldMergeAoe) {
                tempGroups.push({
                    timestamp: event.timestamp,
                    sourceID: sourceId,
                    abilityId: abilityId,
                    events: [event]
                });
                return;
            }

            let foundGroup = null;
            
            // 倒序查找最近的组
            // 由于时间戳完全一致，我们只需要找 timestamp 相同的组
            for (let i = tempGroups.length - 1; i >= 0; i--) {
                const group = tempGroups[i];
                if (event.timestamp === group.timestamp) {
                    if (sourceId === group.sourceID && abilityId === group.abilityId) {
                        foundGroup = group;
                        break;
                    }
                } else if (group.timestamp < event.timestamp) {
                    // 如果组的时间戳已经小于当前事件，说明后面不可能有匹配的了 (因为有序)
                    break; 
                }
            }

            if (foundGroup) {
                foundGroup.events.push(event);
            } else {
                tempGroups.push({
                    timestamp: event.timestamp,
                    sourceID: sourceId,
                    abilityId: abilityId,
                    events: [event]
                });
            }
        });

        // 3. 处理分组：拆分异常高伤害 (Outliers) 并计算中位数
        const finalGroups = [];

        tempGroups.forEach(group => {
            if (group.events.length <= 1) {
                group.representativeEvent = group.events[0];
                finalGroups.push(group);
                return;
            }

            // 按原始伤害排序
            group.events.sort((a, b) => a.calculatedRaw - b.calculatedRaw);

            // 计算中位数
            const midIndex = Math.floor(group.events.length / 2);
            const medianRaw = group.events.length % 2 !== 0 
                ? group.events[midIndex].calculatedRaw
                : (group.events[midIndex - 1].calculatedRaw + group.events[midIndex].calculatedRaw) / 2;

            // 识别离群值 (大于中位数 1.5 倍)
            const OUTLIER_THRESHOLD_RATIO = 1.5;
            
            const normalEvents = [];
            const outlierEvents = [];

            group.events.forEach(e => {
                if (medianRaw > 0 && e.calculatedRaw > medianRaw * OUTLIER_THRESHOLD_RATIO) {
                    outlierEvents.push(e);
                } else {
                    normalEvents.push(e);
                }
            });

            // 处理正常组
            if (normalEvents.length > 0) {
                const nMidIndex = Math.floor(normalEvents.length / 2);
                const repEvent = normalEvents[nMidIndex]; 
                
                finalGroups.push({
                    ...group,
                    events: normalEvents,
                    representativeEvent: repEvent
                });
            }

            // 处理离群组
            outlierEvents.forEach(e => {
                finalGroups.push({
                    timestamp: e.timestamp,
                    sourceID: group.sourceID,
                    abilityId: group.abilityId,
                    events: [e],
                    representativeEvent: e
                });
            });
        });
        
        // 重新按时间排序
        finalGroups.sort((a, b) => a.timestamp - b.timestamp);

        log(`合并前: ${filteredEvents.length} 条事件，初步分组: ${tempGroups.length}，处理离群值后: ${finalGroups.length} 条`);

        // 获取 Boss ID 集合 (仅包含 subType 为 Boss 的 NPC)
        const bossIds = new Set();
        if (fight.enemyNPCs) {
            fight.enemyNPCs.forEach(npc => {
                const actor = actorMap[npc.id];
                if (actor && actor.subType === 'Boss') {
                    bossIds.add(npc.id);
                }
            });
        }
        
        // 如果没有找到 Boss 类型的 NPC (可能是数据问题或小怪战斗)，则回退到使用所有 enemyNPCs
        if (bossIds.size === 0 && fight.enemyNPCs && fight.enemyNPCs.length > 0) {
             // 尝试匹配名字
             const fightName = fight.name;
             fight.enemyNPCs.forEach(npc => {
                 const actor = actorMap[npc.id];
                 if (actor && actor.name === fightName) {
                     bossIds.add(npc.id);
                 }
             });
             
             // 如果还是没有，且只有一个 enemyNPC，就用那个
             if (bossIds.size === 0 && fight.enemyNPCs.length === 1) {
                 bossIds.add(fight.enemyNPCs[0].id);
             }
        }

        // 扩展 Boss ID 集合：包含所有同名的 NPC
        // 很多时候 Boss 会有多个实体 ID (例如分身、转场时的不可选中目标等)，但名字相同
        const bossNames = new Set();
        bossIds.forEach(id => {
            if (actorMap[id]) {
                bossNames.add(actorMap[id].name);
            }
        });

        if (actors) {
            actors.forEach(actor => {
                if (actor.type === 'NPC' && bossNames.has(actor.name)) {
                    bossIds.add(actor.id);
                }
            });
        }

        // 将分组转换为最终数据
        const processedData = finalGroups.map(group => {
            const event = group.representativeEvent;
            
            // 计算相对时间 (毫秒)
            const relativeTime = event.timestamp - effectiveStartTime;
            
            // 格式化时间 mm:ss 或 hh:mm:ss
            const sign = relativeTime < 0 ? "-" : "";
            const absTime = Math.abs(relativeTime);
            const totalSeconds = Math.floor(absTime / 1000);
            
            // 默认模式 mm:ss
            const defaultMm = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
            const defaultSs = (totalSeconds % 60).toString().padStart(2, '0');
            let timeStr = `${sign}${defaultMm}:${defaultSs}`;

            if (UI.allInOneModeCheckbox && UI.allInOneModeCheckbox.checked) {
                // 一体机模式下使用 hh:mm:ss
                const hh = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
                const mm = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
                const ss = (totalSeconds % 60).toString().padStart(2, '0');
                timeStr = `${sign}${hh}:${mm}:${ss}`;
            }

            // 获取来源名称
            let sourceName = 'Unknown';
            if (event.sourceID && actorMap[event.sourceID]) {
                sourceName = actorMap[event.sourceID].name;
            } else if (!event.sourceID) {
                sourceName = 'Environment';
            }

            // 获取技能名称和ID
            let abilityName = 'Unknown';
            let abilityTypeId = null;
            let gameID = event.abilityGameID;
            
            // 尝试从 event.ability 获取信息
            if (event.ability) {
                if (event.ability.name) abilityName = event.ability.name;
                if (event.ability.type) abilityTypeId = event.ability.type;
                if (!gameID && event.ability.guid) gameID = event.ability.guid;
            }

            // 如果没有获取到 Type，尝试从 MasterData Map 中获取
            if ((abilityTypeId === null || abilityTypeId === undefined) && gameID && abilityTypeMap[gameID]) {
                abilityTypeId = abilityTypeMap[gameID];
            }

            // 如果没有获取到 Name，尝试从 MasterData Map 中获取
            if (abilityName === 'Unknown' && gameID && abilityMap[gameID]) {
                abilityName = abilityMap[gameID];
            } else if (abilityName === 'Unknown' && gameID) {
                abilityName = `Unknown (${gameID})`;
            }
            
            // 优先使用 API 返回的类型
            let damageType = null;
            if (abilityTypeId !== null && abilityTypeId !== undefined) {
                const typeIdNum = Number(abilityTypeId);
                
                // DEBUG: 输出调试信息
                if (UI.debugModeCheckbox && UI.debugModeCheckbox.checked) {
                    console.log(`[TypeDebug] Ability: ${abilityName}, ID: ${gameID}, RawType: ${abilityTypeId}, ParsedType: ${typeIdNum}`);
                }

                switch (typeIdNum) {
                    case 1: damageType = '物理'; break;
                    case 2: damageType = '魔法'; break;
                    case 8: damageType = '混合'; break;
                    case 32: damageType = '特殊'; break;
                    case 128: damageType = '物理'; break;
                    case 1024: damageType = '魔法'; break;
                    default: damageType = `Type ${typeIdNum}`; break;
                }
            }

            // 如果是 DoT 汇总，添加标记
            if (event.isDotSummary) {
                abilityName += ' (DoT)';
            }

            // 使用 AOE 组中的代表事件伤害
            const damage = event.amount || 0;
            
            // 使用预计算的原始伤害
            let rawDamage = event.calculatedRaw;

            // 约至千位数 (四舍五入到最近的 1000)
            rawDamage = Math.round(rawDamage / 1000) * 1000;

            const isDot = event.isDotSummary;

            // 判定是否为 Boss 来源
            const isBossSource = event.sourceID && bossIds.has(event.sourceID);
            const targetMitigation = isBossSource ? '有效' : '';

            // 判定死刑 (仅坦克受击 且 非普攻)
            let modeStr = '';
            if (UI.allInOneModeCheckbox && UI.allInOneModeCheckbox.checked) {
                // 检查该组所有事件的受击者是否都是坦克
                const targets = new Set(group.events.map(e => e.targetID));
                let allTargetsAreTanks = true;
                if (targets.size === 0) allTargetsAreTanks = false;
                
                for (const tid of targets) {
                    if (!tankPlayerIds.has(tid)) {
                        allTargetsAreTanks = false;
                        break;
                    }
                }

                // 排除普攻 (Attack / Auto Attack / 攻击)
                const isAutoAttack = abilityName === 'Attack' || abilityName === 'Auto Attack' || abilityName === '攻击';

                if (allTargetsAreTanks && !isAutoAttack) {
                    modeStr = '死刑';
                }
            }

            let result;
            if (UI.allInOneModeCheckbox && UI.allInOneModeCheckbox.checked) {
                // 一体机导入模式
                result = {
                    '时间': timeStr,
                    '技能名': abilityName,
                    '模式': modeStr,   // 原 留空列 1 改为 模式
                    '  ': '',  // 留空列 2
                    '原始伤害': isDot ? (event.dotTickRaw ? Math.round(event.dotTickRaw) : '') : rawDamage,
                    '伤害类型': damageType || '',
                    '目标减': targetMitigation,
                    '   ': '', // 留空列 3
                    '来源': sourceName,
                    '受击人数': group.events.length
                };
            } else {
                // 默认模式
                result = {
                    '时间': timeStr,
                    '来源': sourceName,
                    '技能': abilityName,
                    '伤害类型': damageType || '',
                    '直接伤害': isDot ? '' : damage,
                    '盾值吸收': isDot ? '' : (event.absorbed || 0),
                    '减伤倍率': isDot ? '' : event.multiplier,
                    '原始伤害（估算）': isDot ? '' : rawDamage,
                    '受击人数': group.events.length,
                    'DoT持续时间': event.dotDuration ? (event.dotDuration / 1000).toFixed(1) + 's' : '',
                    'DoT每跳原始': event.dotTickRaw ? Math.round(event.dotTickRaw) : '',
                    'MT': '',
                    'ST': '',
                    'H1': '',
                    'H2': '',
                    'D1': '',
                    'D2': '',
                    'D3': '',
                    'D4': ''
                };
            }
            
            return result;
        })
        // 按时间戳排序
        .sort((a, b) => {
            // 如果有时间戳字段则使用，否则需要从原始数据获取（这里 map 之后丢失了 timestamp 属性，需要注意）
            // 实际上 map 返回的新对象没有 timestamp 属性，所以上面的 sort 会失败。
            // 之前的代码 map 返回的对象里也没有 timestamp(ms)，但是 sort 用的是 a['时间戳(ms)']，这在之前的代码里似乎也不存在？
            // 等等，之前的代码里 result 并没有 '时间戳(ms)' 这个字段。
            // 让我们检查一下之前的代码。
            return 0; // 占位，下面会修复
        });
        
        // 修复排序问题：map 之前已经是排好序的 (finalGroups.sort)，所以这里其实不需要再 sort，或者应该在 map 之前 sort。
        // finalGroups 已经在上面 sort 过了：finalGroups.sort((a, b) => a.timestamp - b.timestamp);
        // 所以 map 后的数组顺序是正确的。
        // 但是之前的代码里有 .sort((a, b) => a['时间戳(ms)'] - b['时间戳(ms)']); 这行代码看起来是无效的或者错误的，因为 result 里没有这个字段。
        // 除非之前的 result 里有这个字段但我没看到。
        // 让我们再看一眼 read_file 的输出。
        // result 定义里确实没有 '时间戳(ms)'。
        // 所以之前的 sort 其实是无效的，或者比较的是 undefined - undefined = NaN，导致顺序不变（或不可预测）。
        // 既然 finalGroups 已经排好序了，我们可以直接移除这个 sort。

        log(`筛选并合并后剩余 ${processedData.length} 条技能释放事件`);

        // 4. 导出 Excel
        const isAllInOne = UI.allInOneModeCheckbox && UI.allInOneModeCheckbox.checked;
        exportToExcel(processedData, `${fight.name}_Timeline.xlsx`, isAllInOne);

    } catch (error) {
        log(`分析失败: ${error.message}`, true);
        console.error(error);
    } finally {
        UI.analyzeBtn.disabled = false;
    }
}

function exportToExcel(data, filename, isAllInOne = false) {
    log('正在生成 Excel 文件...');
    
    // 创建工作簿
    const wb = XLSX.utils.book_new();
    
    // 创建工作表
    const ws = XLSX.utils.json_to_sheet(data);
    
    // 设置列宽
    let wscols = [];
    if (isAllInOne) {
        wscols = [
            {wch: 10}, // 时间
            {wch: 30}, // 技能名
            {wch: 10}, // 模式
            {wch: 10}, // 留空2
            {wch: 15}, // 原始伤害
            {wch: 15}, // 伤害类型
            {wch: 10}, // 目标减
            {wch: 10}, // 留空3
            {wch: 20}, // 来源
            {wch: 10}  // 受击人数
        ];
    } else {
        wscols = [
            {wch: 10}, // 时间
            {wch: 20}, // 来源
            {wch: 30}, // 技能
            {wch: 15}, // 伤害类型
            {wch: 15}, // 最大伤害
            {wch: 15}, // 盾值吸收
            {wch: 10}, // 减伤倍率
            {wch: 20}, // 原始伤害（估算）
            {wch: 10}, // 受击人数
            {wch: 15}, // DoT持续时间
            {wch: 15}, // DoT每跳原始
            {wch: 8},  // MT
            {wch: 8},  // ST
            {wch: 8},  // H1
            {wch: 8},  // H2
            {wch: 8},  // D1
            {wch: 8},  // D2
            {wch: 8},  // D3
            {wch: 8}   // D4
        ];
    }
    ws['!cols'] = wscols;

    // 添加到工作簿
    XLSX.utils.book_append_sheet(wb, ws, "Timeline");
    
    // 导出下载
    XLSX.writeFile(wb, filename);
    log(`导出成功: ${filename}`);
}

// 启动应用
init();
// �����ϳɵ� DoT �¼�
function createSyntheticDotEvent(cluster) {
    const firstEvent = cluster.events[0];
    
    // ������ֵ
    let totalAmount = 0;
    let totalUnmitigated = 0;
    let totalAbsorbed = 0;
    
    cluster.events.forEach(e => {
        totalAmount += (e.amount || 0);
        totalUnmitigated += (e.unmitigatedAmount || e.amount || 0);
        totalAbsorbed += (e.absorbed || 0);
    });

    // �������¼��������ؼ������Ա��������
    return {
        ...firstEvent, // ���ƴ󲿷����� (sourceID, targetID, ability, etc.)
        timestamp: cluster.startTime, // ʹ�õ�һ����ʱ����Ϊ��ʼʱ��
        amount: totalAmount,
        unmitigatedAmount: totalUnmitigated,
        absorbed: totalAbsorbed,
        tick: false, // ���Ϊ�� tick�����ⱻ�����߼����У���ȻĿǰ�����߼����� tick��
        isDotSummary: true, // �Զ�����
        // ע�⣺multiplier ʹ�õ�һ���Ŀ���ֵ
        multiplier: firstEvent.multiplier
    };
}


// �����ϳɵ� DoT �¼� (V2)
function createSyntheticDotEventNew(cluster) {
    const firstEvent = cluster.events[0];
    
    // ������ֵ
    let totalAmount = 0;
    let totalUnmitigated = 0;
    let totalAbsorbed = 0;
    
    cluster.events.forEach(e => {
        totalAmount += (e.amount || 0);
        totalUnmitigated += (e.unmitigatedAmount || e.amount || 0);
        totalAbsorbed += (e.absorbed || 0);
    });

    // �������ʱ���ÿ��ԭʼ�˺�
    const duration = cluster.lastTime - cluster.startTime;
    const tickCount = cluster.events.length;
    // 重新计算 totalRaw 以便取平均
    let totalRaw = 0;
    cluster.events.forEach(e => {
        let raw = e.unmitigatedAmount;
        if (raw === undefined || raw === null) {
            const m = e.multiplier || 1;
            const amt = e.amount || 0;
            const abs = e.absorbed || 0;
            const over = e.overkill || 0;
            raw = (m !== 0) ? (amt + abs + over) / m : (amt + abs + over);
        }
        totalRaw += raw;
    });
    const avgRaw = tickCount > 0 ? (totalRaw / tickCount) : 0;
    const avgRawPerTick = Math.round(avgRaw / 1000) * 1000;

    // �������¼��������ؼ������Ա��������
    return {
        ...firstEvent, // ���ƴ󲿷����� (sourceID, targetID, ability, etc.)
        timestamp: cluster.startTime, // ʹ�õ�һ����ʱ����Ϊ��ʼʱ��
        amount: totalAmount,
        unmitigatedAmount: totalUnmitigated,
        absorbed: totalAbsorbed,
        tick: false, // ���Ϊ�� tick
        isDotSummary: true, // �Զ�����
        // ע�⣺multiplier ʹ�õ�һ���Ŀ���ֵ
        multiplier: firstEvent.multiplier,
        // �����ֶ�
        dotDuration: duration,
        dotTickRaw: avgRawPerTick
    };
}

