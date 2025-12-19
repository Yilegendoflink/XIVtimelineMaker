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
    showEnglishCheckbox: document.getElementById('show-english-checkbox')
};

// 存储从 CSV 加载的翻译数据
let csvAbilityTranslations = {};
let csvActorTranslations = {};

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
    UI.loginBtn.addEventListener('click', () => Auth.login());
    UI.logoutBtn.addEventListener('click', () => Auth.logout());
    UI.analyzeBtn.addEventListener('click', handleAnalyze);
    UI.reportUrlInput.addEventListener('change', handleUrlInput);
    
    // 自动加载翻译文件
    loadTranslationFiles();
}

// 解析 CSV 文件
function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
        // 简单的 CSV 解析，处理逗号分隔
        const parts = line.split(',').map(part => part.trim());
        return parts;
    });
}

// 自动加载本地翻译文件
async function loadTranslationFiles() {
    let abilityCount = 0;
    let actorCount = 0;
    let errors = [];

    // 加载技能翻译
    try {
        const response = await fetch('ability_translations.csv');
        if (response.ok) {
            const text = await response.text();
            const rows = parseCSV(text);
            
            csvAbilityTranslations = {};
            rows.forEach(row => {
                if (row.length >= 2) {
                    const englishName = row[0];
                    const chineseName = row[1];
                    const type = row[2] || null;
                    
                    csvAbilityTranslations[englishName] = {
                        name: chineseName,
                        type: type
                    };
                    abilityCount++;
                }
            });
        } else {
            errors.push('技能翻译文件未找到');
        }
    } catch (error) {
        errors.push(`技能翻译: ${error.message}`);
    }

    // 加载敌人翻译
    try {
        const response = await fetch('actor_translations.csv');
        if (response.ok) {
            const text = await response.text();
            const rows = parseCSV(text);
            
            csvActorTranslations = {};
            rows.forEach(row => {
                if (row.length >= 2) {
                    const englishName = row[0];
                    const chineseName = row[1];
                    csvActorTranslations[englishName] = chineseName;
                    actorCount++;
                }
            });
        } else {
            errors.push('敌人翻译文件未找到');
        }
    } catch (error) {
        errors.push(`敌人翻译: ${error.message}`);
    }

    // 静默加载，仅在控制台输出（可选）
    console.log(`翻译文件加载完成: ${abilityCount} 条技能, ${actorCount} 条敌人`);
    if (errors.length > 0) {
        console.warn('翻译文件加载警告:', errors);
    }
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
        
        // 1.1 找出所有玩家 ID
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
        abilities.forEach(ab => abilityMap[ab.gameID] = ab.name);

        // 2. 获取伤害事件
        log('正在下载伤害数据...');
        const events = await API.getDamageEvents(currentReportCode, fightId, fight.startTime, fight.endTime);
        log(`共获取 ${events.length} 条原始事件`);

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

        // 先过滤掉玩家和宠物的事件，以及非 damage 类型的事件
        const filteredEvents = events.filter(event => {
            // 只保留 'damage' 类型，排除 'calculateddamage' 避免重复
            if (event.type !== 'damage') return false;
            
            if (event.sourceID && playerIds.has(event.sourceID)) return false;
            if (event.sourceID && playerPetIds.has(event.sourceID)) return false;
            return true;
        });

        // 按照时间戳、来源、技能分组，用于合并 AOE
        // AOE 判定：时间戳差异 < 1000ms (1秒), sourceID 相同, abilityGameID 相同
        const aoeGroups = new Map();
        const AOE_TIME_THRESHOLD = 1000; // 毫秒 (1秒)

        filteredEvents.forEach(event => {
            const abilityId = event.abilityGameID || (event.ability ? event.ability.guid : 0);
            const sourceId = event.sourceID || 0;
            
            // 查找是否有匹配的 AOE 组
            let foundGroup = false;
            for (const [key, group] of aoeGroups.entries()) {
                const timeDiff = Math.abs(event.timestamp - group.timestamp);
                if (timeDiff <= AOE_TIME_THRESHOLD && 
                    sourceId === group.sourceID && 
                    abilityId === group.abilityId) {
                    // 找到匹配的 AOE 组，更新最大伤害和时间戳范围
                    group.events.push(event);
                    group.maxDamage = Math.max(group.maxDamage, event.amount || 0);
                    // 更新时间戳为最早的时间
                    group.timestamp = Math.min(group.timestamp, event.timestamp);
                    foundGroup = true;
                    break;
                }
            }
            
            // 如果没找到匹配的组，创建新组
            if (!foundGroup) {
                const groupKey = `${event.timestamp}_${sourceId}_${abilityId}_${aoeGroups.size}`;
                aoeGroups.set(groupKey, {
                    timestamp: event.timestamp,
                    sourceID: sourceId,
                    abilityId: abilityId,
                    events: [event],
                    maxDamage: event.amount || 0,
                    representativeEvent: event
                });
            }
        });

        log(`合并前: ${filteredEvents.length} 条事件，合并后: ${aoeGroups.size} 条`);

        // 将分组转换为最终数据
        const processedData = Array.from(aoeGroups.values()).map(group => {
            const event = group.representativeEvent;
            
            // 计算相对时间 (毫秒)
            const relativeTime = event.timestamp - fight.startTime;
            
            // 格式化时间 mm:ss
            const totalSeconds = Math.floor(relativeTime / 1000);
            const mm = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
            const ss = (totalSeconds % 60).toString().padStart(2, '0');
            const timeStr = `${mm}:${ss}`;

            // 获取来源名称
            let sourceNameEn = 'Unknown';
            if (event.sourceID && actorMap[event.sourceID]) {
                sourceNameEn = actorMap[event.sourceID].name;
            } else if (!event.sourceID) {
                sourceNameEn = 'Environment';
            }
            const sourceName = translateActor(sourceNameEn);

            // 获取技能名称
            let abilityNameEn = 'Unknown';
            if (event.ability && event.ability.name) {
                abilityNameEn = event.ability.name;
            } else if (event.abilityGameID && abilityMap[event.abilityGameID]) {
                abilityNameEn = abilityMap[event.abilityGameID];
            } else if (event.abilityGameID) {
                abilityNameEn = `Unknown (${event.abilityGameID})`;
            }
            const abilityTranslation = translateAbility(abilityNameEn);
            const abilityName = abilityTranslation.name;
            const damageType = abilityTranslation.type;

            // 使用 AOE 组中的最大伤害
            const damage = group.maxDamage;

            // 根据选项决定是否显示英文原名
            const showEnglish = UI.showEnglishCheckbox && UI.showEnglishCheckbox.checked;
            
            const result = {
                '时间': timeStr,
                '来源': showEnglish ? sourceNameEn : sourceName,
                '技能': showEnglish ? abilityNameEn : abilityName,
                '伤害类型': damageType || '',
                '最大伤害': damage,
                '受击人数': group.events.length
            };
            
            return result;
        })
        // 按时间戳排序
        .sort((a, b) => a['时间戳(ms)'] - b['时间戳(ms)']);

        log(`筛选并合并后剩余 ${processedData.length} 条技能释放事件`);

        // 4. 导出 Excel
        exportToExcel(processedData, `${fight.name}_Timeline.xlsx`);

    } catch (error) {
        log(`分析失败: ${error.message}`, true);
        console.error(error);
    } finally {
        UI.analyzeBtn.disabled = false;
    }
}

function exportToExcel(data, filename) {
    log('正在生成 Excel 文件...');
    
    // 创建工作簿
    const wb = XLSX.utils.book_new();
    
    // 创建工作表
    const ws = XLSX.utils.json_to_sheet(data);
    
    // 设置列宽
    const wscols = [
        {wch: 10}, // 时间
        {wch: 15}, // 时间戳
        {wch: 20}, // 来源
        {wch: 30}, // 技能
        {wch: 15}, // 伤害
        {wch: 15}  // 伤害约
    ];
    ws['!cols'] = wscols;

    // 添加到工作簿
    XLSX.utils.book_append_sheet(wb, ws, "Timeline");
    
    // 导出下载
    XLSX.writeFile(wb, filename);
    log(`导出成功: ${filename}`);
}

// 启动应用
init();