/**
 * FF Logs GraphQL API 交互逻辑
 */

const API = {
    async query(queryStr) {
        const token = Auth.getToken();
        if (!token) throw new Error('未登录');

        try {
            const response = await axios.post(CONFIG.API_ENDPOINT, {
                query: queryStr
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.errors) {
                throw new Error(response.data.errors[0].message);
            }

            return response.data.data;
        } catch (error) {
            console.error('API 请求失败:', error);
            throw error;
        }
    },

    // 获取 Report 的基本信息和战斗列表
    async getReportFights(reportCode) {
        const query = `
        query {
            reportData {
                report(code: "${reportCode}") {
                    title
                    startTime
                    masterData(translate: false) {
                        actors {
                            id
                            name
                            type
                            subType
                            petOwner
                        }
                        abilities {
                            gameID
                            name
                            type
                        }
                    }
                    fights(translate: false) {
                        id
                        name
                        startTime
                        endTime
                        fightPercentage
                        kill
                    }
                }
            }
        }`;
        
        const data = await this.query(query);
        return data.reportData.report;
    },

    // 获取特定战斗的伤害事件
    async getDamageEvents(reportCode, fightId, startTime, endTime) {
        let allEvents = [];
        let nextTimestamp = startTime;
        let hasMore = true;

        // 限制最大循环次数防止死循环
        let loopCount = 0;
        const MAX_LOOPS = 500; 

        while (hasMore && loopCount < MAX_LOOPS) {
            loopCount++;
            // 这里的 startTime 和 endTime 是相对于 Report 开始的绝对时间戳
            const query = `
            query {
                reportData {
                    report(code: "${reportCode}") {
                        events(
                            fightIDs: [${fightId}],
                            startTime: ${nextTimestamp},
                            endTime: ${endTime},
                            dataType: DamageTaken,
                            limit: 10000,
                            translate: false
                        ) {
                            data
                            nextPageTimestamp
                        }
                    }
                }
            }`;

            const data = await this.query(query);
            const eventsData = data.reportData.report.events;
            
            if (eventsData.data && eventsData.data.length > 0) {
                allEvents = allEvents.concat(eventsData.data);
            }

            if (eventsData.nextPageTimestamp && eventsData.nextPageTimestamp < endTime) {
                nextTimestamp = eventsData.nextPageTimestamp;
            } else {
                hasMore = false;
            }
            
            // 通知 UI 更新进度 (可选)
            if (window.updateLog) {
                window.updateLog(`已获取 ${allEvents.length} 条事件...`);
            }
        }

        return allEvents;
    }
};