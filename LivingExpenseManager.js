"ui";

/* =====================================================
 * 生活费管理 App — Auto.js Pro 9.3.11
 * 专为学生设计的个人财务管理工具
 * 将每月生活费划分为"校园卡"和"活动资金"两大模块
 * 支持流水记录、余额修正、月末结转、存款贡献统计
 * ===================================================== */

// ======================== 常量与配置 ========================

var APP_NAME = "生活费管理";
var STORAGE_NAME = "living_expense_mgr_v1";
var MONTH_FORMAT = "yyyy-MM";

// 默认支出分类
var DEFAULT_CATEGORIES = {
    card: ["餐饮", "超市", "洗浴", "打印", "饮水", "其他"],
    activity: ["餐饮", "购物", "交通", "娱乐", "学习", "通讯", "医疗", "水果", "其他"],
    savings: ["提现", "其他"]  // 存款贡献的支出分类（透支冲抵类分类由系统自动写入）
};

// 收入分类（通用）
var INCOME_CATEGORIES = ["充值", "补贴", "月初初始化", "结转入账", "修正", "其他"];

// 颜色主题
var COLORS = {
    primary: "#3F51B5",
    primaryDark: "#303F9F",
    accent: "#FF5722",
    card: "#4CAF50",
    activity: "#FF9800",
    savings: "#9C27B0",
    bg: "#F5F5F5",
    white: "#FFFFFF",
    text: "#212121",
    textSec: "#757575",
    divider: "#E0E0E0",
    red: "#F44336",
    green: "#4CAF50"
};

// 饼图配色
var PIE_COLORS = [
    "#3F51B5", "#FF5722", "#4CAF50", "#FF9800", "#9C27B0",
    "#00BCD4", "#E91E63", "#8BC34A", "#FFC107", "#795548"
];

// ======================== 工具函数 ========================

/** 生成唯一ID */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

/** 获取月份键 格式 yyyy-MM */
function getMonthKey(date) {
    date = date || new Date();
    var y = date.getFullYear();
    var m = ("0" + (date.getMonth() + 1)).slice(-2);
    return y + "-" + m;
}

/** 获取当前时间戳 */
function now() {
    return Date.now();
}

/** 格式化金额（负数显示为 -¥12.00） */
function formatMoney(amount) {
    var n = Number(amount);
    if (n < 0) return "-¥" + (-n).toFixed(2);
    return "¥" + n.toFixed(2);
}

/** 格式化时间 */
function formatTime(ts) {
    var d = new Date(ts);
    var y = d.getFullYear();
    var M = ("0" + (d.getMonth() + 1)).slice(-2);
    var D = ("0" + d.getDate()).slice(-2);
    var h = ("0" + d.getHours()).slice(-2);
    var m = ("0" + d.getMinutes()).slice(-2);
    return y + "-" + M + "-" + D + " " + h + ":" + m;
}

/** 简短时间 */
function shortTime(ts) {
    var d = new Date(ts);
    var M = ("0" + (d.getMonth() + 1)).slice(-2);
    var D = ("0" + d.getDate()).slice(-2);
    var h = ("0" + d.getHours()).slice(-2);
    var m = ("0" + d.getMinutes()).slice(-2);
    return M + "-" + D + " " + h + ":" + m;
}

/** 深拷贝 */
function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/** 安全浮点运算 */
function floatAdd(a, b) {
    return Math.round((a + b) * 100) / 100;
}
function floatSub(a, b) {
    return Math.round((a - b) * 100) / 100;
}

/** 月份键偏移：yyyy-MM 加/减 delta 个月 */
function shiftMonthKey(monthKey, delta) {
    var parts = monthKey.split("-");
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]);
    month += delta;
    while (month < 1) { month += 12; year--; }
    while (month > 12) { month -= 12; year++; }
    return year + "-" + ("0" + month).slice(-2);
}

// ======================== 数据管理 ========================

var DataManager = {
    storage: null,
    data: null,

    /** 初始化数据 */
    init: function () {
        this.storage = storages.create(STORAGE_NAME);
        var saved = this.storage.get("appData", null);
        if (saved) {
            try {
                this.data = JSON.parse(saved);
            } catch (e) {
                this.data = null;
            }
        }
        if (!this.data) {
            this.data = this.createDefaultData();
        }
        // 确保结构完整
        this.ensureStructure();
    },

    /** 创建默认数据 */
    createDefaultData: function () {
        return {
            currentMonth: getMonthKey(),
            cardStandard: 1200,
            cardStandardHistory: [],
            months: {},
            customCategories: deepCopy(DEFAULT_CATEGORIES)
        };
    },

    /** 确保数据结构完整 */
    ensureStructure: function () {
        if (!this.data.months) this.data.months = {};
        if (!this.data.cardStandardHistory) this.data.cardStandardHistory = [];
        if (!this.data.customCategories) this.data.customCategories = deepCopy(DEFAULT_CATEGORIES);
        if (!this.data.currentMonth) this.data.currentMonth = getMonthKey();

        // 清理历史 bug 可能写入的重复分类（保持原有顺序）
        for (var mKey in this.data.customCategories) {
            var catList = this.data.customCategories[mKey];
            if (Object.prototype.toString.call(catList) !== "[object Array]") continue;
            var seen = {};
            var deduped = [];
            for (var di = 0; di < catList.length; di++) {
                var cname = String(catList[di]);
                if (!seen[cname]) {
                    seen[cname] = true;
                    deduped.push(catList[di]);
                }
            }
            this.data.customCategories[mKey] = deduped;
        }
    },

    /** 保存数据到持久化存储 */
    save: function () {
        this.storage.put("appData", JSON.stringify(this.data));
    },

    /** 获取当前月份键 */
    getCurrentMonth: function () {
        return this.data.currentMonth;
    },

    /** 设置当前月份 */
    setCurrentMonth: function (monthKey) {
        this.data.currentMonth = monthKey;
        this.save();
    },

    /** 修改当前月份（特殊规则，双向对称）
     *  - 当前月数据整体搬迁到目标月份（覆盖目标月已有数据）
     *  - 目标月份与原当前月之间的所有月份（含原当前月自身）全部清零（删除） */
    changeCurrentMonth: function (targetKey) {
        var cur = this.data.currentMonth;
        if (!targetKey || targetKey === cur) return false;
        var months = this.data.months;
        var keys, i;
        if (targetKey < cur) {
            // 过去的月份：先把当前月数据整体搬到目标月
            if (months[cur]) {
                months[targetKey] = months[cur];
            }
            // 清零：目标月之后 .. 原当前月（含原当前月自身，其数据已搬走）
            keys = Object.keys(months);
            for (i = 0; i < keys.length; i++) {
                var k2 = keys[i];
                if (k2 > targetKey && k2 <= cur) {
                    delete months[k2];
                }
            }
        } else {
            // 未来的月份：当前月数据整体搬到目标月
            if (months[cur]) {
                months[targetKey] = months[cur];
            }
            // 清零：原当前月 .. 目标月前一个月（含原当前月自身，其数据已搬走）
            keys = Object.keys(months);
            for (i = 0; i < keys.length; i++) {
                var k = keys[i];
                if (k >= cur && k < targetKey) {
                    delete months[k];
                }
            }
        }
        this.data.currentMonth = targetKey;
        this.save();
        return true;
    },

    /** 获取某月数据，不存在则创建 */
    getMonthData: function (monthKey) {
        monthKey = monthKey || this.data.currentMonth;
        if (!this.data.months[monthKey]) {
            this.data.months[monthKey] = {
                initialized: false,
                settled: false,
                totalBudget: 0,
                cardRecharge: 0,
                activityInitial: 0,
                cardBalance: 0,
                activityBalance: 0,
                savingsBalance: 0,
                transactions: {
                    card: [],
                    activity: [],
                    savings: []
                }
            };
        }
        return this.data.months[monthKey];
    },

    /** 只读获取某月数据（不存在时返回 null，不自动创建空月份） */
    peekMonthData: function (monthKey) {
        return this.data.months[monthKey] || null;
    },

    /** 当前月是否已初始化 */
    isCurrentMonthInitialized: function () {
        var md = this.getMonthData();
        return md.initialized;
    },

    /** 当前月是否已结转 */
    isCurrentMonthSettled: function () {
        var md = this.getMonthData();
        return md.settled;
    },

    /** 获取校园卡月标准 */
    getCardStandard: function () {
        return this.data.cardStandard || 0;
    },

    /** 修改校园卡标准（下月生效） */
    setCardStandard: function (newStandard) {
        var old = this.data.cardStandard;
        if (newStandard === old) return;
        this.data.cardStandardHistory.push({
            time: now(),
            oldStandard: old,
            newStandard: newStandard
        });
        this.data.cardStandard = newStandard;
        this.save();
    },

    /** 获取标准修改历史 */
    getCardStandardHistory: function () {
        return this.data.cardStandardHistory || [];
    },

    /** 获取上月校园卡余额 */
    getPrevMonthCardBalance: function () {
        var cur = this.data.currentMonth;
        var parts = cur.split("-");
        var year = parseInt(parts[0]);
        var month = parseInt(parts[1]);
        month--;
        if (month < 1) { month = 12; year--; }
        var prevKey = year + "-" + ("0" + month).slice(-2);
        var prevData = this.data.months[prevKey];
        if (prevData && prevData.initialized) {
            return prevData.cardBalance;
        }
        return 0;
    },

    /** 添加流水 */
    addTransaction: function (module, type, amount, category, note, timestamp) {
        var md = this.getMonthData();
        // 数据层兜底：未开启新月的月份不允许记入任何流水，
        // 避免初次使用未初始化就录入数据造成的脏数据
        if (!md.initialized) {
            toast("请先开启新月后再记账");
            return null;
        }
        var tx = {
            id: generateId(),
            type: type,         // "income" | "expense"
            amount: parseFloat(amount),
            category: category || "",
            note: note || "",
            timestamp: timestamp || now()
        };

        md.transactions[module].push(tx);

        // 更新余额
        if (type === "income") {
            if (module === "card") {
                md.cardBalance = floatAdd(md.cardBalance, tx.amount);
            } else if (module === "activity") {
                md.activityBalance = floatAdd(md.activityBalance, tx.amount);
            } else if (module === "savings") {
                md.savingsBalance = floatAdd(md.savingsBalance, tx.amount);
            }
        } else {
            if (module === "card") {
                md.cardBalance = floatSub(md.cardBalance, tx.amount);
            } else if (module === "activity") {
                md.activityBalance = floatSub(md.activityBalance, tx.amount);
            } else if (module === "savings") {
                // 存款贡献允许支出（余额可为负）
                md.savingsBalance = floatSub(md.savingsBalance, tx.amount);
            }
        }

        this.save();
        return tx;
    },

    /** 删除流水 */
    deleteTransaction: function (module, txId) {
        var md = this.getMonthData();
        var txs = md.transactions[module];
        for (var i = 0; i < txs.length; i++) {
            if (txs[i].id === txId) {
                var tx = txs[i];
                // 回滚余额
                if (tx.type === "income") {
                    if (module === "card") md.cardBalance = floatSub(md.cardBalance, tx.amount);
                    else if (module === "activity") md.activityBalance = floatSub(md.activityBalance, tx.amount);
                    else if (module === "savings") md.savingsBalance = floatSub(md.savingsBalance, tx.amount);
                } else {
                    if (module === "card") md.cardBalance = floatAdd(md.cardBalance, tx.amount);
                    else if (module === "activity") md.activityBalance = floatAdd(md.activityBalance, tx.amount);
                    else if (module === "savings") md.savingsBalance = floatAdd(md.savingsBalance, tx.amount);
                }
                txs.splice(i, 1);
                this.save();
                return true;
            }
        }
        return false;
    },

    /** 修正余额 */
    correctBalance: function (module, actualBalance, note) {
        var md = this.getMonthData();
        var currentBalance, diff, type, category;

        if (module === "card") {
            currentBalance = md.cardBalance;
        } else if (module === "activity") {
            currentBalance = md.activityBalance;
        } else if (module === "savings") {
            currentBalance = md.savingsBalance;
        }

        diff = floatSub(actualBalance, currentBalance);

        if (Math.abs(diff) < 0.01) {
            toast("余额一致，无需修正");
            return null;
        }

        if (diff > 0) {
            type = "income";
            category = "修正";
        } else {
            type = "expense";
            category = "修正";
            // 存款贡献现已允许支出，余额可为负，不再限制减少修正
        }

        var absDiff = Math.abs(diff);
        var tx = this.addTransaction(module, type, absDiff, category, note || "余额修正");
        return tx;
    },

    /** 开启新月 */
    initNewMonth: function (totalBudget, rechargeAmount) {
        var monthKey = this.data.currentMonth;
        var md = this.getMonthData(monthKey);

        if (md.initialized) {
            toast("本月已初始化");
            return false;
        }

        // 处理上月透支：先收集透支记录，稍后在新月的存款贡献中记为支出冲抵；
        // 同时把透支模块余额置0，保证下面计算上月结转余额时不带旧债。
        var prevKeyOd = this._getPrevMonthKey();
        var prevDataOd = prevKeyOd ? this.data.months[prevKeyOd] : null;
        var overdraftRecords = [];
        if (prevDataOd) {
            if (prevDataOd.cardBalance < -0.005) {
                overdraftRecords.push({
                    amount: Math.round(-prevDataOd.cardBalance * 100) / 100,
                    category: "校园卡透支冲抵",
                    note: "上月(" + prevKeyOd + ")校园卡透支冲抵"
                });
                prevDataOd.cardBalance = 0;
            }
            if (prevDataOd.activityBalance < -0.005) {
                overdraftRecords.push({
                    amount: Math.round(-prevDataOd.activityBalance * 100) / 100,
                    category: "活动资金透支冲抵",
                    note: "上月(" + prevKeyOd + ")活动资金透支冲抵"
                });
                prevDataOd.activityBalance = 0;
            }
        }

        var prevCardBalance = this.getPrevMonthCardBalance();
        var activityInitial = floatSub(totalBudget, rechargeAmount);

        // 初始化月数据
        md.initialized = true;
        md.settled = false;
        md.totalBudget = totalBudget;
        md.cardRecharge = rechargeAmount;
        md.activityInitial = activityInitial;
        md.cardBalance = floatAdd(prevCardBalance, rechargeAmount);
        md.activityBalance = activityInitial;
        md.savingsBalance = 0;
        md.transactions = { card: [], activity: [], savings: [] };

        // 生成校园卡充值流水
        if (rechargeAmount > 0) {
            md.transactions.card.push({
                id: generateId(),
                type: "income",
                amount: rechargeAmount,
                category: "充值",
                note: "月初充值",
                timestamp: now()
            });
        }

        // 生成活动资金初始化流水
        if (activityInitial > 0) {
            md.transactions.activity.push({
                id: generateId(),
                type: "income",
                amount: activityInitial,
                category: "月初初始化",
                note: "活动资金初始化",
                timestamp: now()
            });
        }

        // 继承上月存款贡献余额
        var prevKey = this._getPrevMonthKey();
        if (prevKey && this.data.months[prevKey] && this.data.months[prevKey].settled) {
            // 上月已结转，savings余额已在上月结转时更新
            // 但当前月是新月，savings需要继承累计值
            md.savingsBalance = this.data.months[prevKey].savingsBalance || 0;
            // 复制上月savings流水到新月（保持历史可查）
            // 不复制，每月独立记录，但余额累计
        }

        // 上月透支冲抵：在继承的存款贡献基础上记为支出（存款贡献余额允许为负）
        var odTotal = 0;
        for (var oi = 0; oi < overdraftRecords.length; oi++) {
            var od = overdraftRecords[oi];
            md.transactions.savings.push({
                id: generateId(),
                type: "expense",
                amount: od.amount,
                category: od.category,
                note: od.note,
                timestamp: now()
            });
            md.savingsBalance = floatSub(md.savingsBalance, od.amount);
            odTotal = floatAdd(odTotal, od.amount);
        }
        if (overdraftRecords.length > 0) {
            toast("上月透支 " + formatMoney(odTotal) + " 已从存款贡献中冲抵");
        }

        this.save();
        return true;
    },

    /** 月末结转 */
    settleMonth: function () {
        var md = this.getMonthData();
        if (!md.initialized) {
            toast("本月未初始化");
            return false;
        }
        if (md.settled) {
            toast("本月已结转");
            return false;
        }

        var activityBalance = md.activityBalance;

        // 活动资金支出记录（结转至存款贡献）
        if (activityBalance > 0) {
            md.transactions.activity.push({
                id: generateId(),
                type: "expense",
                amount: activityBalance,
                category: "结转至存款贡献",
                note: "月末结转",
                timestamp: now()
            });

            // 存款贡献收入记录
            md.transactions.savings.push({
                id: generateId(),
                type: "income",
                amount: activityBalance,
                category: "结转入账",
                note: "从活动资金结转",
                timestamp: now()
            });

            // 更新余额
            md.activityBalance = 0;
            md.savingsBalance = floatAdd(md.savingsBalance, activityBalance);
        }

        md.settled = true;
        this.save();
        return true;
    },

    /** 获取上月月份键 */
    _getPrevMonthKey: function () {
        var cur = this.data.currentMonth;
        var parts = cur.split("-");
        var year = parseInt(parts[0]);
        var month = parseInt(parts[1]);
        month--;
        if (month < 1) { month = 12; year--; }
        return year + "-" + ("0" + month).slice(-2);
    },

    /** 获取某模块的流水列表 */
    getTransactions: function (module, monthKey) {
        var md = this.getMonthData(monthKey);
        return md.transactions[module] || [];
    },

    /** 获取所有月份键（已排序） */
    getAllMonthKeys: function () {
        var keys = Object.keys(this.data.months);
        keys.sort();
        return keys;
    },

    /** 获取自定义分类（返回副本，防止调用方按引用直接改动内部数据） */
    getCategories: function (module) {
        var arr = this.data.customCategories[module] || [];
        return arr.slice();
    },

    /** 添加自定义分类 */
    addCategory: function (module, name) {
        if (!this.data.customCategories[module]) {
            this.data.customCategories[module] = [];
        }
        if (this.data.customCategories[module].indexOf(name) === -1) {
            this.data.customCategories[module].push(name);
            this.save();
        }
    }
};

// ======================== 业务逻辑 ========================

var BusinessLogic = {
    /** 计算建议充值金额 */
    calculateSuggestedRecharge: function () {
        var standard = DataManager.getCardStandard();
        var prevBalance = DataManager.getPrevMonthCardBalance();
        return Math.max(floatSub(standard, prevBalance), 0);
    },

    /** 计算活动资金初始金额 */
    calculateActivityInitial: function (totalBudget, rechargeAmount) {
        return floatSub(totalBudget, rechargeAmount);
    }
};

// ======================== UI 状态 ========================

var UIState = {
    currentTab: 0,          // 0:总览 1:流水 2:图表 3:设置
    txModule: "activity",   // 当前流水模块
    txType: "expense",      // 当前流水类型
    chartModule: "activity", // 图表模块
    chartRange: "month",    // 图表范围
    viewMonth: getMonthKey() // 展示月份（流水/图表页共用，初始化后同步为存储中的当前月）
};

// ======================== 主布局 ========================

ui.layout(
    <frame w="*" h="*">
        <vertical w="*" h="*">
            <!-- 顶部标题栏 -->
            <frame bg="{{COLORS.primary}}" w="*" h="56dp" gravity="center_vertical" padding="16dp 0dp 16dp 0dp">
                <text id="tvTitle" text="{{APP_NAME}}" textColor="white" textSize="20sp" gravity="center" w="*"/>
            </frame>

            <!-- 内容区域 -->
            <frame w="*" h="*" layout_weight="1">
                <!-- 总览页 -->
                <ScrollView id="tabOverview" w="*" h="*" visibility="visible">
                    <vertical w="*" h="*" padding="12dp">
                        <!-- 月份信息 -->
                        <card w="*" h="auto" cardCornerRadius="8dp" cardElevation="2dp" foreground="?selectableItemBackground" margin="0dp 0dp 0dp 8dp">
                            <vertical padding="16dp" w="*">
                                <text id="tvMonth" text="2026-09" textSize="16sp" textColor="{{COLORS.text}}" textStyle="bold"/>
                                <horizontal margin="0dp 4dp 0dp 0dp">
                                    <text id="tvBudget" text="生活费: ¥0" textSize="13sp" textColor="{{COLORS.textSec}}" layout_weight="1"/>
                                    <text id="tvStandard" text="标准: ¥0" textSize="13sp" textColor="{{COLORS.textSec}}" layout_weight="1"/>
                                    <text id="tvRecharge" text="充值: ¥0" textSize="13sp" textColor="{{COLORS.textSec}}" layout_weight="1"/>
                                </horizontal>
                            </vertical>
                        </card>

                        <!-- 校园卡余额卡 -->
                        <card w="*" h="auto" cardCornerRadius="8dp" cardElevation="2dp" margin="0dp 0dp 0dp 8dp">
                            <horizontal padding="16dp" w="*" gravity="center_vertical">
                                <vertical layout_weight="1">
                                    <text text="💳 校园卡" textSize="15sp" textColor="{{COLORS.card}}" textStyle="bold"/>
                                    <text id="tvCardBalance" text="¥0.00" textSize="24sp" textColor="{{COLORS.text}}" margin="0dp 4dp 0dp 0dp"/>
                                </vertical>
                                <button id="btnCardDetail" text="明细" textSize="12sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.card}}"/>
                            </horizontal>
                        </card>

                        <!-- 活动资金余额卡 -->
                        <card w="*" h="auto" cardCornerRadius="8dp" cardElevation="2dp" margin="0dp 0dp 0dp 8dp">
                            <horizontal padding="16dp" w="*" gravity="center_vertical">
                                <vertical layout_weight="1">
                                    <text text="🎯 活动资金" textSize="15sp" textColor="{{COLORS.activity}}" textStyle="bold"/>
                                    <text id="tvActivityBalance" text="¥0.00" textSize="24sp" textColor="{{COLORS.text}}" margin="0dp 4dp 0dp 0dp"/>
                                </vertical>
                                <button id="btnActivityDetail" text="明细" textSize="12sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.activity}}"/>
                            </horizontal>
                        </card>

                        <!-- 总存款贡献统计（全历史累计，无明细按钮，样式区别于其他余额卡片） -->
                        <card w="*" h="auto" cardCornerRadius="8dp" cardElevation="2dp" cardBackgroundColor="{{COLORS.savings}}" margin="0dp 0dp 0dp 8dp">
                            <vertical padding="16dp" w="*">
                                <horizontal w="*" gravity="center_vertical">
                                    <text text="🏆 总存款贡献" textSize="15sp" textColor="white" textStyle="bold" layout_weight="1"/>
                                    <text text="全历史累计" textSize="11sp" textColor="#E1BEE7"/>
                                </horizontal>
                                <text id="tvTotalSavings" text="¥0.00" textSize="28sp" textStyle="bold" textColor="white" gravity="center" margin="0dp 6dp 0dp 0dp"/>
                                <horizontal w="*" margin="0dp 6dp 0dp 0dp">
                                    <text id="tvTotalSavingsIn" text="累计存入 ¥0.00" textSize="11sp" textColor="#E1BEE7" layout_weight="1" gravity="center"/>
                                    <text id="tvTotalSavingsOut" text="累计支出 ¥0.00" textSize="11sp" textColor="#E1BEE7" layout_weight="1" gravity="center"/>
                                    <text id="tvTotalSavingsMonths" text="共 0 个月" textSize="11sp" textColor="#E1BEE7" layout_weight="1" gravity="center"/>
                                </horizontal>
                            </vertical>
                        </card>

                        <!-- 操作按钮区 -->
                        <card w="*" h="auto" cardCornerRadius="8dp" cardElevation="2dp" margin="0dp 8dp 0dp 0dp">
                            <vertical padding="12dp" w="*">
                                <horizontal w="*" gravity="center">
                                    <button id="btnNewMonth" text="📅 开启新月" layout_weight="1" textSize="13sp" margin="4dp 0dp 4dp 0dp" style="Widget.AppCompat.Button.Colored"/>
                                    <button id="btnSettle" text="📋 月末结转" layout_weight="1" textSize="13sp" margin="4dp 0dp 4dp 0dp" style="Widget.AppCompat.Button.Colored"/>
                                </horizontal>
                                <horizontal w="*" gravity="center">
                                    <button id="btnAddTx" text="✏️ 添加流水" layout_weight="1" textSize="13sp" margin="4dp 0dp 4dp 0dp" style="Widget.AppCompat.Button.Colored"/>
                                    <button id="btnCorrect" text="🔧 余额修正" layout_weight="1" textSize="13sp" margin="4dp 0dp 4dp 0dp" style="Widget.AppCompat.Button.Colored"/>
                                </horizontal>
                            </vertical>
                        </card>

                        <!-- 状态提示 -->
                        <text id="tvStatus" text="" textSize="12sp" textColor="{{COLORS.textSec}}" margin="0dp 8dp 0dp 0dp" gravity="center" w="*"/>
                    </vertical>
                </ScrollView>

                <!-- 流水页 -->
                <vertical id="tabTransactions" w="*" h="*" visibility="gone">
                    <!-- 展示月份调节 -->
                    <horizontal w="*" h="36dp" bg="{{COLORS.white}}" gravity="center_vertical" padding="4dp 0dp 4dp 0dp">
                        <button id="btnTxMonthPrev" text="◀" w="48dp" h="*" textSize="14sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.primary}}"/>
                        <text id="tvTxViewMonth" text="" layout_weight="1" gravity="center" textSize="14sp" textStyle="bold" textColor="{{COLORS.text}}"/>
                        <button id="btnTxMonthNext" text="▶" w="48dp" h="*" textSize="14sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.primary}}"/>
                    </horizontal>
                    <View w="*" h="1dp" bg="{{COLORS.divider}}"/>
                    <!-- 模块选择 Tab -->
                    <horizontal w="*" h="40dp" bg="{{COLORS.bg}}">
                        <button id="tabTxCard" text="校园卡" layout_weight="1" h="*" textSize="13sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.textSec}}"/>
                        <button id="tabTxActivity" text="活动资金" layout_weight="1" h="*" textSize="13sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.activity}}"/>
                        <button id="tabTxSavings" text="存款贡献" layout_weight="1" h="*" textSize="13sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.textSec}}"/>
                    </horizontal>
                    <View w="*" h="1dp" bg="{{COLORS.divider}}"/>
                    <!-- 收入/支出 Tab -->
                    <horizontal w="*" h="36dp">
                        <button id="tabTxIncome" text="收入" layout_weight="1" h="*" textSize="13sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.textSec}}"/>
                        <button id="tabTxExpense" text="支出" layout_weight="1" h="*" textSize="13sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.accent}}"/>
                    </horizontal>
                    <View w="*" h="1dp" bg="{{COLORS.divider}}"/>
                    <!-- 流水列表 -->
<!-- 流水列表：文本/颜色通过 {{}} 直接绑定到列表项数据（Auto.js 标准做法，
     不依赖 item_bind 回调参数，避免不同版本 holder.item 行为差异导致的空白/占位问题） -->
<list id="lvTransactions" w="*" h="*" layout_weight="1">
    <vertical w="*" h="auto" padding="12dp 8dp 12dp 8dp">
        <horizontal w="*">
            <text id="tvTxCat" text="{{tvTxCat}}" textSize="14sp" textColor="{{COLORS.text}}" layout_weight="1"/>
            <text id="tvTxAmount" text="{{tvTxAmount}}" textSize="14sp" textStyle="bold" textColor="{{_amountColor}}"/>
        </horizontal>
        <horizontal w="*" margin="0dp 2dp 0dp 0dp">
            <text id="tvTxNote" text="{{tvTxNote}}" textSize="12sp" textColor="{{COLORS.textSec}}" layout_weight="1"/>
            <text id="tvTxTime" text="{{tvTxTime}}" textSize="11sp" textColor="{{COLORS.textSec}}"/>
        </horizontal>
    </vertical>
</list>
                    <!-- 添加流水按钮 -->
                    <button id="btnAddTxFromList" text="＋ 添加流水" w="*" h="48dp" textSize="15sp" bg="{{COLORS.primary}}" textColor="white"/>
                </vertical>

                <!-- 图表页 -->
                <ScrollView id="tabCharts" w="*" h="*" visibility="gone">
                    <vertical w="*" h="*" padding="12dp">
                        <!-- 展示月份调节（配合"按月"范围使用） -->
                        <horizontal w="*" h="36dp" gravity="center_vertical" padding="4dp 0dp 4dp 0dp">
                            <button id="btnChartMonthPrev" text="◀" w="48dp" h="*" textSize="14sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.primary}}"/>
                            <text id="tvChartViewMonth" text="" layout_weight="1" gravity="center" textSize="14sp" textStyle="bold" textColor="{{COLORS.text}}"/>
                            <button id="btnChartMonthNext" text="▶" w="48dp" h="*" textSize="14sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.primary}}"/>
                        </horizontal>
                        <!-- 模块选择 -->
                        <horizontal w="*" gravity="center">
                            <button id="chartCard" text="校园卡" layout_weight="1" textSize="12sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.textSec}}"/>
                            <button id="chartActivity" text="活动资金" layout_weight="1" textSize="12sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.activity}}"/>
                        </horizontal>
                        <horizontal w="*" gravity="center">
                            <button id="chartMonth" text="按月" layout_weight="1" textSize="12sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.accent}}"/>
                            <button id="chartAll" text="全部" layout_weight="1" textSize="12sp" style="Widget.AppCompat.Button.Borderless" textColor="{{COLORS.textSec}}"/>
                        </horizontal>
                        <!-- 饼图 -->
                        <card w="*" h="auto" cardCornerRadius="8dp" cardElevation="2dp" margin="0dp 8dp 0dp 8dp">
                            <vertical w="*" h="auto" padding="8dp" gravity="center">
                                <canvas id="pieCanvas" w="280dp" h="280dp"/>
                            </vertical>
                        </card>
                        <!-- 分类统计列表 -->
                        <card w="*" h="auto" cardCornerRadius="8dp" cardElevation="2dp" margin="0dp 0dp 0dp 8dp">
                            <vertical id="chartLegend" w="*" h="auto" padding="12dp">
                                <text text="支出分类统计" textSize="14sp" textStyle="bold" textColor="{{COLORS.text}}"/>
                            </vertical>
                        </card>
                    </vertical>
                </ScrollView>

                <!-- 设置页 -->
                <ScrollView id="tabSettings" w="*" h="*" visibility="gone">
                    <vertical w="*" h="*" padding="12dp">
                        <!-- 当前月份管理 -->
                        <card w="*" h="auto" cardCornerRadius="8dp" cardElevation="2dp" margin="0dp 0dp 0dp 8dp">
                            <vertical padding="16dp" w="*">
                                <text text="当前月份管理" textSize="16sp" textStyle="bold" textColor="{{COLORS.text}}"/>
                                <horizontal w="*" margin="0dp 8dp 0dp 0dp" gravity="center_vertical">
                                    <text id="tvCurrentMonthSetting" text="当前: --" textSize="14sp" textColor="{{COLORS.textSec}}" layout_weight="1"/>
                                    <button id="btnChangeMonth" text="修改当前月份" textSize="12sp" style="Widget.AppCompat.Button.Borderless.Colored"/>
                                </horizontal>
                                <text text="注意：修改月份会把本月数据整体搬迁到目标月份，中间月份将被清零" textSize="11sp" textColor="{{COLORS.red}}" margin="0dp 4dp 0dp 0dp"/>
                            </vertical>
                        </card>

                        <!-- 校园卡月标准 -->
                        <card w="*" h="auto" cardCornerRadius="8dp" cardElevation="2dp" margin="0dp 0dp 0dp 8dp">
                            <vertical padding="16dp" w="*">
                                <text text="校园卡月标准" textSize="16sp" textStyle="bold" textColor="{{COLORS.text}}"/>
                                <horizontal w="*" margin="0dp 8dp 0dp 0dp" gravity="center_vertical">
                                    <text id="tvCurrentStandard" text="当前: ¥1200" textSize="14sp" textColor="{{COLORS.textSec}}" layout_weight="1"/>
                                    <button id="btnChangeStandard" text="修改" textSize="12sp" style="Widget.AppCompat.Button.Borderless.Colored"/>
                                </horizontal>
                                <text text="提示：修改将于下月生效" textSize="11sp" textColor="{{COLORS.accent}}" margin="0dp 4dp 0dp 0dp"/>
                            </vertical>
                        </card>

                        <!-- 自定义分类 -->
                        <card w="*" h="auto" cardCornerRadius="8dp" cardElevation="2dp" margin="0dp 0dp 0dp 8dp">
                            <vertical padding="16dp" w="*">
                                <text text="自定义分类" textSize="16sp" textStyle="bold" textColor="{{COLORS.text}}"/>
                                <horizontal margin="0dp 8dp 0dp 0dp">
                                    <button id="btnManageCatCard" text="校园卡分类" layout_weight="1" textSize="12sp" style="Widget.AppCompat.Button.Borderless.Colored" margin="0dp 0dp 4dp 0dp"/>
                                    <button id="btnManageCatActivity" text="活动资金分类" layout_weight="1" textSize="12sp" style="Widget.AppCompat.Button.Borderless.Colored" margin="4dp 0dp 0dp 0dp"/>
                                </horizontal>
                            </vertical>
                        </card>

                        <!-- 标准修改历史 -->
                        <card w="*" h="auto" cardCornerRadius="8dp" cardElevation="2dp" margin="0dp 0dp 0dp 8dp">
                            <vertical padding="16dp" w="*">
                                <text text="标准修改历史" textSize="16sp" textStyle="bold" textColor="{{COLORS.text}}"/>
                                <vertical id="standardHistoryList" w="*" h="auto" margin="0dp 8dp 0dp 0dp">
                                    <text text="暂无记录" textSize="13sp" textColor="{{COLORS.textSec}}"/>
                                </vertical>
                            </vertical>
                        </card>

                        <!-- 数据管理 -->
                        <card w="*" h="auto" cardCornerRadius="8dp" cardElevation="2dp" margin="0dp 0dp 0dp 8dp">
                            <vertical padding="16dp" w="*">
                                <text text="数据管理" textSize="16sp" textStyle="bold" textColor="{{COLORS.text}}"/>
                                <horizontal margin="0dp 8dp 0dp 0dp">
                                    <button id="btnExportData" text="导出数据" layout_weight="1" textSize="12sp" style="Widget.AppCompat.Button.Borderless.Colored" margin="0dp 0dp 4dp 0dp"/>
                                    <button id="btnImportData" text="导入数据" layout_weight="1" textSize="12sp" style="Widget.AppCompat.Button.Borderless.Colored" margin="4dp 0dp 0dp 0dp"/>
                                </horizontal>
                                <horizontal margin="0dp 4dp 0dp 0dp">
                                    <button id="btnExportCsv" text="📊 导出CSV报表" layout_weight="1" textSize="12sp" style="Widget.AppCompat.Button.Borderless.Colored" margin="0dp 0dp 4dp 0dp"/>
                                    <button id="btnClearAll" text="🗑️ 清空所有数据" layout_weight="1" textSize="12sp" style="Widget.AppCompat.Button.Borderless.Colored" textColor="{{COLORS.red}}" margin="4dp 0dp 0dp 0dp"/>
                                </horizontal>
                                <text text="数据导出到根目录「生活费导出」文件夹，每次导出前会清空该文件夹下的旧文件" textSize="11sp" textColor="{{COLORS.textSec}}" margin="0dp 6dp 0dp 0dp"/>
                            </vertical>
                        </card>

                        <!-- 关于 -->
                        <card w="*" h="auto" cardCornerRadius="8dp" cardElevation="2dp" margin="0dp 0dp 0dp 8dp">
                            <vertical padding="16dp" w="*">
                                <text text="关于" textSize="16sp" textStyle="bold" textColor="{{COLORS.text}}"/>
                                <text text="生活费管理 App v1.0" textSize="13sp" textColor="{{COLORS.textSec}}" margin="0dp 4dp 0dp 0dp"/>
                                <text text="基于 Auto.js Pro 9.3.11" textSize="13sp" textColor="{{COLORS.textSec}}" margin="0dp 2dp 0dp 0dp"/>
                            </vertical>
                        </card>
                    </vertical>
                </ScrollView>
            </frame>

            <!-- 底部导航栏 -->
            <horizontal w="*" h="52dp" bg="{{COLORS.white}}" gravity="center_vertical">
                <vertical id="nav0" w="0" h="*" layout_weight="1" gravity="center">
                    <text id="navIcon0" text="📊" textSize="18sp" gravity="center"/>
                    <text id="navLabel0" text="总览" textSize="10sp" textColor="{{COLORS.primary}}" gravity="center"/>
                </vertical>
                <vertical id="nav1" w="0" h="*" layout_weight="1" gravity="center">
                    <text id="navIcon1" text="📋" textSize="18sp" gravity="center"/>
                    <text id="navLabel1" text="流水" textSize="10sp" textColor="{{COLORS.textSec}}" gravity="center"/>
                </vertical>
                <vertical id="nav2" w="0" h="*" layout_weight="1" gravity="center">
                    <text id="navIcon2" text="📈" textSize="18sp" gravity="center"/>
                    <text id="navLabel2" text="图表" textSize="10sp" textColor="{{COLORS.textSec}}" gravity="center"/>
                </vertical>
                <vertical id="nav3" w="0" h="*" layout_weight="1" gravity="center">
                    <text id="navIcon3" text="⚙️" textSize="18sp" gravity="center"/>
                    <text id="navLabel3" text="设置" textSize="10sp" textColor="{{COLORS.textSec}}" gravity="center"/>
                </vertical>
            </horizontal>
        </vertical>
    </frame>
);
// ======================== 标签页切换 ========================

var tabIds = ["tabOverview", "tabTransactions", "tabCharts", "tabSettings"];
var navLabelIds = ["navLabel0", "navLabel1", "navLabel2", "navLabel3"];

// ======================== 流水列表事件绑定 ========================
// 说明：列表项的文本和颜色已改用模板内的 {{}} 数据绑定自动完成，
// 不再依赖 item_bind 回调里取 holder.item（该写法在部分 Auto.js 版本
// 中取不到数据，且原来整段被 try/catch 静默吞掉，导致每行都显示占位内容）。
ui.lvTransactions.on("item_click", function (item, position, view) {
    if (item && item._id) {
        showTransactionDetailDialog(UIState.txModule, item._id);
    } else {
        toast("数据错误");
    }
});


function switchTab(index) {
    UIState.currentTab = index;
    for (var i = 0; i < tabIds.length; i++) {
        ui[tabIds[i]].setVisibility(i === index ? android.view.View.VISIBLE : android.view.View.GONE);
        ui[navLabelIds[i]].setTextColor(android.graphics.Color.parseColor(i === index ? COLORS.primary : COLORS.textSec));
    }
    // 切换后刷新对应页面
    if (index === 0) renderOverview();
    else if (index === 1) renderTransactions();
    else if (index === 2) renderChart();
    else if (index === 3) renderSettings();
}

/** 更新流水/图表页的展示月份标签 */
function updateViewMonthLabels() {
    ui.tvTxViewMonth.setText(UIState.viewMonth);
    ui.tvChartViewMonth.setText(UIState.viewMonth);
}

/** 展示月份同步为当前月份（修改当前月份后调用） */
function syncViewMonth() {
    UIState.viewMonth = DataManager.getCurrentMonth();
    updateViewMonthLabels();
}

/** 展示月份前后切换 delta 个月，并刷新所在页面 */
function shiftViewMonth(delta) {
    UIState.viewMonth = shiftMonthKey(UIState.viewMonth, delta);
    updateViewMonthLabels();
    if (UIState.currentTab === 1) renderTransactions();
    else if (UIState.currentTab === 2) renderChart();
}

/** 余额透支警告：操作后将导致校园卡/活动资金余额为负时弹窗提醒。
 *  允许用户选择继续（余额可以为负）。
 *  @returns {boolean} true 表示已弹出警告（调用方应中止当前流程，等待用户确认） */
function warnIfBalanceNegative(module, newBalance, onProceed) {
    if (module !== "card" && module !== "activity" && module !== "savings") return false;
    if (newBalance >= -0.005) return false;
    var names = { card: "校园卡", activity: "活动资金", savings: "存款贡献" };
    dialogs.build({
        title: "余额透支警告",
        content: "⚠️ 此操作将使「" + names[module] + "」余额变为 " + formatMoney(newBalance) + "（透支为负）。\n确定要继续吗？",
        positive: "继续",
        negative: "取消"
    }).on("positive", function () {
        onProceed();
    }).show();
    return true;
}

// ======================== 总览页渲染 ========================

/** 统计全部月份的存款贡献：累计存入、累计支出、净额、有存款流水的月份数 */
function calcTotalSavings() {
    var totalIn = 0;
    var totalOut = 0;
    var monthCount = 0;
    var keys = DataManager.getAllMonthKeys();
    for (var i = 0; i < keys.length; i++) {
        var md = DataManager.peekMonthData(keys[i]);
        if (!md || !md.transactions) continue;
        var txs = md.transactions.savings || [];
        if (txs.length === 0) continue;
        monthCount++;
        for (var j = 0; j < txs.length; j++) {
            if (txs[j].type === "income") {
                totalIn = floatAdd(totalIn, txs[j].amount);
            } else {
                totalOut = floatAdd(totalOut, txs[j].amount);
            }
        }
    }
    return { totalIn: totalIn, totalOut: totalOut, net: floatSub(totalIn, totalOut), monthCount: monthCount };
}

function renderOverview() {
    var md = DataManager.getMonthData();
    var curMonth = DataManager.getCurrentMonth();

    ui.tvMonth.setText(curMonth + (md.initialized ? "" : " (未初始化)"));
    ui.tvBudget.setText("生活费: " + formatMoney(md.totalBudget));
    ui.tvStandard.setText("标准: " + formatMoney(DataManager.getCardStandard()));
    ui.tvRecharge.setText("充值: " + formatMoney(md.cardRecharge));

    ui.tvCardBalance.setText(formatMoney(md.cardBalance));
    ui.tvActivityBalance.setText(formatMoney(md.activityBalance));

    // 总存款贡献统计（全历史累计）
    var ts = calcTotalSavings();
    ui.tvTotalSavings.setText(formatMoney(ts.net));
    ui.tvTotalSavingsIn.setText("累计存入 " + formatMoney(ts.totalIn));
    ui.tvTotalSavingsOut.setText("累计支出 " + formatMoney(ts.totalOut));
    ui.tvTotalSavingsMonths.setText("共 " + ts.monthCount + " 个月");

    // 状态提示
    var status = "";
    if (!md.initialized) {
        status = "⚠️ 本月尚未初始化，请先开启新月";
    } else if (md.settled) {
        status = "✅ 本月已结转，可开启下月";
    } else {
        status = "📝 本月进行中";
    }
    ui.tvStatus.setText(status);
}

// ======================== 流水页渲染 ========================
function renderTransactions() {
    var module = UIState.txModule;
    var type = UIState.txType;
    // 按"展示月份"只读取数（不自动创建空月份数据）
    var md = DataManager.peekMonthData(UIState.viewMonth);
    updateViewMonthLabels();

    // 更新模块Tab高亮
    var modules = ["card", "activity", "savings"];
    var tabBtns = [ui.tabTxCard, ui.tabTxActivity, ui.tabTxSavings];
    var moduleColors = [COLORS.card, COLORS.activity, COLORS.savings];
    for (var i = 0; i < modules.length; i++) {
        tabBtns[i].setTextColor(android.graphics.Color.parseColor(
            modules[i] === module ? moduleColors[i] : COLORS.textSec
        ));
    }

    // 存款贡献现已允许记录支出，支出 Tab 始终显示
    ui.tabTxExpense.setVisibility(android.view.View.VISIBLE);

    ui.tabTxIncome.setTextColor(android.graphics.Color.parseColor(
        type === "income" ? COLORS.green : COLORS.textSec
    ));
    ui.tabTxExpense.setTextColor(android.graphics.Color.parseColor(
        type === "expense" ? COLORS.red : COLORS.textSec
    ));

    var txs = (md && md.transactions[module]) ? md.transactions[module] : [];
    var filtered = [];
    for (var i = 0; i < txs.length; i++) {
        if (txs[i].type === type) {
            filtered.push(txs[i]);
        }
    }
    filtered.sort(function (a, b) { return b.timestamp - a.timestamp; });

    var items = [];
    for (var i = 0; i < filtered.length; i++) {
        var tx = filtered[i];
        items.push({
            _id: tx.id,
            tvTxCat: tx.category || "其他",
            tvTxAmount: (tx.type === "income" ? "+" : "-") + formatMoney(tx.amount),
            tvTxNote: tx.note || "",
            tvTxTime: shortTime(tx.timestamp),
            _type: tx.type,
            // 金额颜色：收入绿、支出红，供模板中 {{_amountColor}} 绑定
            _amountColor: (tx.type === "income") ? COLORS.green : COLORS.red
        });
    }

    // 关键：设置数据源（模板里的 {{}} 表达式会自动绑定到每一项）
    ui.lvTransactions.setDataSource(items);
}

// ======================== 图表页渲染 ========================

function renderChart() {
    var module = UIState.chartModule;
    var range = UIState.chartRange;

    // 更新模块高亮
    ui.chartCard.setTextColor(android.graphics.Color.parseColor(
        module === "card" ? COLORS.card : COLORS.textSec
    ));
    ui.chartActivity.setTextColor(android.graphics.Color.parseColor(
        module === "activity" ? COLORS.activity : COLORS.textSec
    ));
    ui.chartMonth.setTextColor(android.graphics.Color.parseColor(
        range === "month" ? COLORS.accent : COLORS.textSec
    ));
    ui.chartAll.setTextColor(android.graphics.Color.parseColor(
        range === "all" ? COLORS.accent : COLORS.textSec
    ));

    // 更新展示月份标签
    updateViewMonthLabels();

    // 收集支出数据
    var categoryTotals = {};
    var totalExpense = 0;

    if (range === "month") {
        // 按"展示月份"只读取数
        var md = DataManager.peekMonthData(UIState.viewMonth);
        var txs = (md && md.transactions[module]) ? md.transactions[module] : [];
        for (var i = 0; i < txs.length; i++) {
            if (txs[i].type === "expense") {
                var cat = txs[i].category || "其他";
                categoryTotals[cat] = floatAdd(categoryTotals[cat] || 0, txs[i].amount);
                totalExpense = floatAdd(totalExpense, txs[i].amount);
            }
        }
    } else {
        // 全部月份
        var keys = DataManager.getAllMonthKeys();
        for (var k = 0; k < keys.length; k++) {
            var md = DataManager.getMonthData(keys[k]);
            var txs = md.transactions[module] || [];
            for (var i = 0; i < txs.length; i++) {
                if (txs[i].type === "expense") {
                    var cat = txs[i].category || "其他";
                    categoryTotals[cat] = floatAdd(categoryTotals[cat] || 0, txs[i].amount);
                    totalExpense = floatAdd(totalExpense, txs[i].amount);
                }
            }
        }
    }

    // 绘制饼图
    drawPieChart(categoryTotals, totalExpense);

    // 更新图例列表
    updateChartLegend(categoryTotals, totalExpense);
}

// 饼图数据与监听标记：draw 监听只允许注册一次（重复注册会触发
// TooManyListenersException: max = 10），之后通过更新数据 + invalidate 刷新
var pieChartData = { categoryTotals: {}, totalExpense: 0 };
var pieListenerRegistered = false;

function drawPieChart(categoryTotals, totalExpense) {
    pieChartData.categoryTotals = categoryTotals;
    pieChartData.totalExpense = totalExpense;

    var canvas = ui.pieCanvas;
    if (!pieListenerRegistered) {
        pieListenerRegistered = true;
        canvas.on("draw", function (c) {
            var totals = pieChartData.categoryTotals;
            var total = pieChartData.totalExpense;

            var w = c.getWidth();
            var h = c.getHeight();
            var cx = w / 2;
            var cy = h / 2;
            var r = Math.min(cx, cy) - 20;

            // 背景
            var bgPaint = new android.graphics.Paint();
            bgPaint.setColor(android.graphics.Color.parseColor(COLORS.white));
            bgPaint.setAntiAlias(true);
            c.drawCircle(cx, cy, r + 10, bgPaint);

            if (total < 0.01) {
                // 无数据
                var textPaint = new android.graphics.Paint();
                textPaint.setColor(android.graphics.Color.parseColor(COLORS.textSec));
                textPaint.setTextSize(40);
                textPaint.setAntiAlias(true);
                var tw = textPaint.measureText("暂无数据");
                c.drawText("暂无数据", cx - tw / 2, cy + 14, textPaint);
                return;
            }

            var paint = new android.graphics.Paint();
            paint.setAntiAlias(true);
            paint.setStyle(android.graphics.Paint.Style.FILL);

            // 与图例保持相同的"金额降序"，保证饼图扇区与图例颜色一一对应
            var categories = Object.keys(totals);
            categories.sort(function (a, b) { return totals[b] - totals[a]; });
            var startAngle = -90; // 从12点方向开始

            for (var i = 0; i < categories.length; i++) {
                var cat = categories[i];
                var value = totals[cat];
                var sweepAngle = (value / total) * 360;

                paint.setColor(android.graphics.Color.parseColor(
                    PIE_COLORS[i % PIE_COLORS.length]
                ));

                var rect = new android.graphics.RectF(cx - r, cy - r, cx + r, cy + r);
                c.drawArc(rect, startAngle, sweepAngle, true, paint);

                startAngle += sweepAngle;
            }

            // 中心圆（环形效果）
            var innerPaint = new android.graphics.Paint();
            innerPaint.setColor(android.graphics.Color.parseColor(COLORS.white));
            innerPaint.setAntiAlias(true);
            c.drawCircle(cx, cy, r * 0.45, innerPaint);

            // 中心文字
            var centerPaint = new android.graphics.Paint();
            centerPaint.setColor(android.graphics.Color.parseColor(COLORS.text));
            centerPaint.setTextSize(36);
            centerPaint.setAntiAlias(true);
            var totalStr = "¥" + total.toFixed(0);
            var tw2 = centerPaint.measureText(totalStr);
            c.drawText(totalStr, cx - tw2 / 2, cy + 12, centerPaint);
        });
    }
    // 数据已更新，强制重绘
    canvas.invalidate();
}

function updateChartLegend(categoryTotals, totalExpense) {
    var container = ui.chartLegend;
    // 移除旧子view（保留第一个标题text）
    while (container.getChildCount() > 1) {
        container.removeViewAt(container.getChildCount() - 1);
    }

    var categories = Object.keys(categoryTotals);
    // 按金额排序
    categories.sort(function (a, b) { return categoryTotals[b] - categoryTotals[a]; });

    for (var i = 0; i < categories.length; i++) {
        var cat = categories[i];
        var value = categoryTotals[cat];
        var pct = totalExpense > 0 ? (value / totalExpense * 100).toFixed(1) : 0;

        var row = new android.widget.LinearLayout(activity);
        row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        row.setLayoutParams(new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        ));
        row.setGravity(android.view.Gravity.CENTER_VERTICAL);
        row.setPadding(0, 8, 0, 8);

        // 色块
        var colorView = new android.view.View(activity);
        var colorParams = new android.widget.LinearLayout.LayoutParams(24, 24);
        colorParams.setMarginEnd(12);
        colorView.setLayoutParams(colorParams);
        colorView.setBackgroundColor(android.graphics.Color.parseColor(PIE_COLORS[i % PIE_COLORS.length]));
        row.addView(colorView);

        // 分类名
        var nameTv = new android.widget.TextView(activity);
        nameTv.setText(cat);
        nameTv.setTextSize(13);
        nameTv.setLayoutParams(new android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        row.addView(nameTv);

        // 金额和占比
        var amountTv = new android.widget.TextView(activity);
        amountTv.setText(formatMoney(value) + "  (" + pct + "%)");
        amountTv.setTextSize(13);
        amountTv.setTextColor(android.graphics.Color.parseColor(COLORS.textSec));
        row.addView(amountTv);

        container.addView(row);
    }

    if (categories.length === 0) {
        var emptyTv = new android.widget.TextView(activity);
        emptyTv.setText("暂无支出数据");
        emptyTv.setTextSize(13);
        emptyTv.setTextColor(android.graphics.Color.parseColor(COLORS.textSec));
        container.addView(emptyTv);
    }
}

// ======================== 设置页渲染 ========================

function renderSettings() {
    ui.tvCurrentStandard.setText("当前: " + formatMoney(DataManager.getCardStandard()));
    ui.tvCurrentMonthSetting.setText("当前: " + DataManager.getCurrentMonth());
    renderStandardHistory();
}

function renderStandardHistory() {
    var container = ui.standardHistoryList;
    container.removeAllViews();

    var history = DataManager.getCardStandardHistory();
    if (history.length === 0) {
        var tv = new android.widget.TextView(activity);
        tv.setText("暂无记录");
        tv.setTextSize(13);
        tv.setTextColor(android.graphics.Color.parseColor(COLORS.textSec));
        container.addView(tv);
        return;
    }

    // 倒序显示
    for (var i = history.length - 1; i >= 0; i--) {
        var h = history[i];
        var tv = new android.widget.TextView(activity);
        tv.setText(formatTime(h.time) + "  " + formatMoney(h.oldStandard) + " → " + formatMoney(h.newStandard));
        tv.setTextSize(12);
        tv.setTextColor(android.graphics.Color.parseColor(COLORS.textSec));
        tv.setPadding(0, 4, 0, 4);
        container.addView(tv);
    }
}

// ======================== 对话框：开启新月 ========================
function showNewMonthDialog(autoCalc) {
    var standard = DataManager.getCardStandard();
    var prevCardBalance = DataManager.getPrevMonthCardBalance();
    var suggestedRecharge = BusinessLogic.calculateSuggestedRecharge();
    var lastBudget = 0;

    var prevKey = DataManager._getPrevMonthKey();
    if (prevKey && DataManager.data.months[prevKey]) {
        lastBudget = DataManager.data.months[prevKey].totalBudget || 0;
    }

    // ---------- 动态创建布局 ----------
    var context = activity;

    // 根布局：垂直 LinearLayout
    var root = new android.widget.LinearLayout(context);
    root.setOrientation(android.widget.LinearLayout.VERTICAL);
    root.setPadding(
        android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_DIP, 20, context.getResources().getDisplayMetrics()),
        android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_DIP, 20, context.getResources().getDisplayMetrics()),
        android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_DIP, 20, context.getResources().getDisplayMetrics()),
        android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_DIP, 20, context.getResources().getDisplayMetrics())
    );
    var params = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    root.setLayoutParams(params);

    // 辅助函数：创建 TextView
    function createTextView(text, textSize, textColor, gravity, marginBottom) {
        var tv = new android.widget.TextView(context);
        tv.setText(text);
        tv.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, textSize);
        tv.setTextColor(android.graphics.Color.parseColor(textColor));
        if (gravity) tv.setGravity(gravity);
        var lp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        if (marginBottom !== undefined) {
            lp.bottomMargin = android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_DIP, marginBottom, context.getResources().getDisplayMetrics());
        }
        tv.setLayoutParams(lp);
        return tv;
    }

    // 辅助函数：创建 EditText
    function createEditText(hint, inputType, text, marginBottom) {
        var et = new android.widget.EditText(context);
        et.setHint(hint);
        et.setInputType(inputType);
        if (text) et.setText(text);
        var lp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        if (marginBottom !== undefined) {
            lp.bottomMargin = android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_DIP, marginBottom, context.getResources().getDisplayMetrics());
        }
        et.setLayoutParams(lp);
        return et;
    }

    // 标题
    var titleTv = createTextView("开启新月", 20, COLORS.text, android.view.Gravity.CENTER, 16);
    root.addView(titleTv);

    // 生活费总额标签
    var budgetLabel = createTextView("本月生活费总额", 14, COLORS.textSec, android.view.Gravity.NO_GRAVITY, 4);
    root.addView(budgetLabel);
    var inputBudget = createEditText("请输入生活费总额", android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL, (lastBudget > 0) ? String(lastBudget) : "", 12);
    root.addView(inputBudget);

    // 校园卡充值标签
    var rechargeLabel = createTextView("校园卡充值金额", 14, COLORS.textSec, android.view.Gravity.NO_GRAVITY, 4);
    root.addView(rechargeLabel);
    var inputRecharge = createEditText("建议充值: " + formatMoney(suggestedRecharge), android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL, autoCalc ? String(suggestedRecharge) : "", 8);
    root.addView(inputRecharge);

    // 活动资金初始显示
    var tvActivityCalc = createTextView("活动资金初始: ¥0.00", 14, COLORS.activity, android.view.Gravity.NO_GRAVITY, 8);
    root.addView(tvActivityCalc);

    // 上月余额信息
    var infoTv = createTextView("上月校园卡余额: " + formatMoney(prevCardBalance) + "  标准: " + formatMoney(standard), 12, COLORS.textSec, android.view.Gravity.NO_GRAVITY, 12);
    root.addView(infoTv);

    // 滑动确认提示
    var sliderLabel = createTextView("← 滑动确认 →", 13, COLORS.textSec, android.view.Gravity.CENTER, 4);
    root.addView(sliderLabel);

    // SeekBar
    var sliderConfirm = new android.widget.SeekBar(context);
    sliderConfirm.setMax(100);
    sliderConfirm.setProgress(0);
    var sliderLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    sliderLp.bottomMargin = android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_DIP, 8, context.getResources().getDisplayMetrics());
    sliderConfirm.setLayoutParams(sliderLp);
    root.addView(sliderConfirm);

    // 按钮行
    var btnRow = new android.widget.LinearLayout(context);
    btnRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
    btnRow.setGravity(android.view.Gravity.END);
    var rowLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    btnRow.setLayoutParams(rowLp);

    // 取消按钮
    var btnCancel = new android.widget.Button(context);
    btnCancel.setText("取消");
    
    var btnCancelLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    btnCancelLp.rightMargin = android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_DIP, 8, context.getResources().getDisplayMetrics());
    btnCancel.setLayoutParams(btnCancelLp);
    btnRow.addView(btnCancel);

    // 确认按钮
    var btnConfirm = new android.widget.Button(context);
    btnConfirm.setText("确认开启");
    btnConfirm.setEnabled(false);
    //btnConfirm.setBackgroundResource(android.R.attr.selectableItemBackground);
    var btnConfirmLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    btnConfirm.setLayoutParams(btnConfirmLp);
    btnRow.addView(btnConfirm);

    root.addView(btnRow);

    // ---------- 交互逻辑 ----------
    var sliderConfirmed = false;

    function updateActivityCalc() {
        var budget = parseFloat(inputBudget.getText().toString()) || 0;
        var recharge = parseFloat(inputRecharge.getText().toString()) || 0;
        var activity = floatSub(budget, recharge);
        tvActivityCalc.setText("活动资金初始: " + formatMoney(activity));
        if (activity < 0) {
            tvActivityCalc.setTextColor(android.graphics.Color.parseColor(COLORS.red));
        } else {
            tvActivityCalc.setTextColor(android.graphics.Color.parseColor(COLORS.activity));
        }
    }

    inputBudget.addTextChangedListener(new android.text.TextWatcher({
        afterTextChanged: function(editable) { updateActivityCalc(); }
    }));
    inputRecharge.addTextChangedListener(new android.text.TextWatcher({
        afterTextChanged: function(editable) { updateActivityCalc(); }
    }));

    sliderConfirm.setOnSeekBarChangeListener({
        onProgressChanged: function(seekBar, progress, fromUser) {
            sliderConfirmed = progress >= 98;
            btnConfirm.setEnabled(sliderConfirmed);
        }
    });

    // 按钮点击
    var dlg = null;
    btnCancel.setOnClickListener(function() {
        if (dlg) dlg.dismiss();
    });

    btnConfirm.setOnClickListener(function() {
        if (!sliderConfirmed) {
            toast("请先滑动滑块确认");
            return;
        }

        var budget = parseFloat(inputBudget.getText().toString()) || 0;
        var recharge = parseFloat(inputRecharge.getText().toString()) || 0;

        if (budget <= 0) {
            toast("请输入生活费总额");
            return;
        }
        if (recharge < 0) {
            toast("充值金额不能为负");
            return;
        }

        var activity = floatSub(budget, recharge);
        if (activity < 0) {
            toast("活动资金为负，请检查输入");
            return;
        }

        function proceed() {
            if (recharge > suggestedRecharge + 0.01) {
                var extra = floatSub(recharge, suggestedRecharge);
                toast("充值超过建议值" + formatMoney(extra) + "，活动资金将减少");
            }

            if (dlg) dlg.dismiss();

            var success = DataManager.initNewMonth(budget, recharge);
            if (success) {
                toast("新月已开启！");
                renderOverview();
            }
        }

        // 充值金额未填写或为0：先警告，允许返回重新输入
        if (recharge <= 0) {
            dialogs.build({
                title: "充值金额警告",
                content: "⚠️ 校园卡充值金额未填写或为 0。\n建议充值: " + formatMoney(suggestedRecharge) + "（按校园卡月标准与上月余额计算）。\n请返回填写充值金额。",
                positive: "返回填写",
                negative: "仍不充值"
            }).on("negative", function () {
                proceed();
            }).show();
            return;
        }

        proceed();
    });

    // 创建对话框
    dlg = dialogs.build({
        customView: root,
        cancelable: true
    }).show();

    // 初始计算
    updateActivityCalc();
}
// ======================== 对话框：添加流水 ========================

function showAddTransactionDialog(defaultModule) {
    var module = defaultModule || UIState.txModule;
    var md = DataManager.getMonthData();

    if (!md.initialized) {
        promptInitMonth();
        return;
    }

    var context = activity;
    var paddingDp = function(dp) {
        return android.util.TypedValue.applyDimension(
            android.util.TypedValue.COMPLEX_UNIT_DIP, dp,
            context.getResources().getDisplayMetrics()
        );
    };

    // 根布局
    var root = new android.widget.LinearLayout(context);
    root.setOrientation(android.widget.LinearLayout.VERTICAL);
    root.setPadding(paddingDp(20), paddingDp(20), paddingDp(20), paddingDp(20));
    var lp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    root.setLayoutParams(lp);

    // 标题
    var title = new android.widget.TextView(context);
    title.setText("添加流水");
    title.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 20);
    title.setTextColor(android.graphics.Color.parseColor(COLORS.text));
    title.setGravity(android.view.Gravity.CENTER);
    var titleLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    titleLp.bottomMargin = paddingDp(16);
    title.setLayoutParams(titleLp);
    root.addView(title);

    // 模块行
    var moduleRow = new android.widget.LinearLayout(context);
    moduleRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
    moduleRow.setGravity(android.view.Gravity.CENTER_VERTICAL);
    var rowLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    rowLp.bottomMargin = paddingDp(8);
    moduleRow.setLayoutParams(rowLp);

    var moduleLabel = new android.widget.TextView(context);
    moduleLabel.setText("模块：");
    moduleLabel.setTextSize(14);
    moduleLabel.setTextColor(android.graphics.Color.parseColor(COLORS.textSec));
    moduleRow.addView(moduleLabel);

    var spinnerModule = new android.widget.Spinner(context);
    var modAdapter = new android.widget.ArrayAdapter(context, android.R.layout.simple_spinner_item, ["校园卡", "活动资金", "存款贡献"]);
    modAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
    spinnerModule.setAdapter(modAdapter);
    var spinnerLp = new android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1);
    spinnerModule.setLayoutParams(spinnerLp);
    moduleRow.addView(spinnerModule);
    root.addView(moduleRow);

    // 类型行
    var typeRow = new android.widget.LinearLayout(context);
    typeRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
    typeRow.setGravity(android.view.Gravity.CENTER_VERTICAL);
    var typeRowLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    typeRowLp.bottomMargin = paddingDp(8);
    typeRow.setLayoutParams(typeRowLp);

    var typeLabel = new android.widget.TextView(context);
    typeLabel.setText("类型：");
    typeLabel.setTextSize(14);
    typeLabel.setTextColor(android.graphics.Color.parseColor(COLORS.textSec));
    typeRow.addView(typeLabel);

    var spinnerType = new android.widget.Spinner(context);
    var typeAdapter = new android.widget.ArrayAdapter(context, android.R.layout.simple_spinner_item, ["支出", "收入"]);
    typeAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
    spinnerType.setAdapter(typeAdapter);
    var typeSpinnerLp = new android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1);
    spinnerType.setLayoutParams(typeSpinnerLp);
    typeRow.addView(spinnerType);
    root.addView(typeRow);

    // 金额
    var amountLabel = new android.widget.TextView(context);
    amountLabel.setText("金额");
    amountLabel.setTextSize(14);
    amountLabel.setTextColor(android.graphics.Color.parseColor(COLORS.textSec));
    var amountLabelLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    amountLabelLp.bottomMargin = paddingDp(4);
    amountLabel.setLayoutParams(amountLabelLp);
    root.addView(amountLabel);

    var inputAmount = new android.widget.EditText(context);
    inputAmount.setHint("请输入金额");
    inputAmount.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);
    var inputLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    inputLp.bottomMargin = paddingDp(8);
    inputAmount.setLayoutParams(inputLp);
    root.addView(inputAmount);

    // 分类行
    var catRow = new android.widget.LinearLayout(context);
    catRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
    catRow.setGravity(android.view.Gravity.CENTER_VERTICAL);
    var catRowLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    catRowLp.bottomMargin = paddingDp(8);
    catRow.setLayoutParams(catRowLp);

    var catLabel = new android.widget.TextView(context);
    catLabel.setText("分类：");
    catLabel.setTextSize(14);
    catLabel.setTextColor(android.graphics.Color.parseColor(COLORS.textSec));
    catRow.addView(catLabel);

    var spinnerCategory = new android.widget.Spinner(context);
    var catAdapter = new android.widget.ArrayAdapter(context, android.R.layout.simple_spinner_item, []);
    catAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
    spinnerCategory.setAdapter(catAdapter);
    var catSpinnerLp = new android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1);
    spinnerCategory.setLayoutParams(catSpinnerLp);
    catRow.addView(spinnerCategory);
    root.addView(catRow);

    // 备注
    var noteLabel = new android.widget.TextView(context);
    noteLabel.setText("备注");
    noteLabel.setTextSize(14);
    noteLabel.setTextColor(android.graphics.Color.parseColor(COLORS.textSec));
    var noteLabelLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    noteLabelLp.bottomMargin = paddingDp(4);
    noteLabel.setLayoutParams(noteLabelLp);
    root.addView(noteLabel);

    var inputNote = new android.widget.EditText(context);
    inputNote.setHint("选填");
    inputNote.setInputType(android.text.InputType.TYPE_CLASS_TEXT);
    var inputNoteLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    inputNoteLp.bottomMargin = paddingDp(12);
    inputNote.setLayoutParams(inputNoteLp);
    root.addView(inputNote);

    // 按钮行
    var btnRow = new android.widget.LinearLayout(context);
    btnRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
    btnRow.setGravity(android.view.Gravity.END);
    var btnRowLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    btnRow.setLayoutParams(btnRowLp);

    var btnCancel = new android.widget.Button(context);
    btnCancel.setText("取消");
    //btnCancel.setBackgroundResource(android.R.attr.selectableItemBackground);
    var cancelLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    cancelLp.rightMargin = paddingDp(8);
    btnCancel.setLayoutParams(cancelLp);
    btnRow.addView(btnCancel);

    var btnConfirm = new android.widget.Button(context);
    btnConfirm.setText("确认");
    //btnConfirm.setBackgroundResource(android.R.attr.selectableItemBackground);
    btnRow.addView(btnConfirm);

    root.addView(btnRow);

    // ---------- 逻辑 ----------
    var MODULE_MAP = ["card", "activity", "savings"];
    var TYPE_MAP = ["expense", "income"];

    function updateCategories() {
        var mIdx = spinnerModule.getSelectedItemPosition();
        var tIdx = spinnerType.getSelectedItemPosition();
        var m = MODULE_MAP[mIdx];
        var t = TYPE_MAP[tIdx];

        var cats = (t === "expense") ? DataManager.getCategories(m) : INCOME_CATEGORIES;
        if (!cats || cats.length === 0) {
            // 兜底：老数据中存款贡献没有配置支出分类时使用默认分类
            cats = ["提现", "其他"];
        }
        var adapter = new android.widget.ArrayAdapter(context, android.R.layout.simple_spinner_item, cats);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinnerCategory.setAdapter(adapter);

        // 存款贡献现已支持支出，类型行始终可见
        typeRow.setVisibility(android.view.View.VISIBLE);
    }

    spinnerModule.setOnItemSelectedListener({
        onItemSelected: function() { updateCategories(); },
        onNothingSelected: function() {}
    });
    spinnerType.setOnItemSelectedListener({
        onItemSelected: function() { updateCategories(); },
        onNothingSelected: function() {}
    });

    // 初始设置选中
    var initModuleIdx = MODULE_MAP.indexOf(module);
    if (initModuleIdx >= 0) spinnerModule.setSelection(initModuleIdx);
    var isSavings = (module === "savings");
    spinnerType.setSelection(isSavings ? 1 : 0);
    updateCategories();

    var dlg = null;
    btnCancel.setOnClickListener(function() {
        if (dlg) dlg.dismiss();
    });

    btnConfirm.setOnClickListener(function() {
        var mIdx = spinnerModule.getSelectedItemPosition();
        var tIdx = spinnerType.getSelectedItemPosition();
        var m = MODULE_MAP[mIdx];
        var t = TYPE_MAP[tIdx];
        var amount = parseFloat(inputAmount.getText().toString()) || 0;
        var selectedCat = spinnerCategory.getSelectedItem();
        var category = selectedCat ? selectedCat.toString() : "其他";
        var note = inputNote.getText().toString();

        if (amount <= 0) {
            toast("请输入有效金额");
            return;
        }

        function doAdd() {
            var tx = DataManager.addTransaction(m, t, amount, category, note);
            if (tx) {
                toast("添加成功");
                if (dlg) dlg.dismiss();
                renderOverview();
                if (UIState.currentTab === 1) renderTransactions();
            }
        }

        // 支出可能导致余额透支：先警告，允许继续
        if (t === "expense") {
            var mdCheck = DataManager.getMonthData();
            var balance;
            if (m === "card") balance = mdCheck.cardBalance;
            else if (m === "activity") balance = mdCheck.activityBalance;
            else balance = mdCheck.savingsBalance;
            var newBalance = floatSub(balance, amount);
            if (warnIfBalanceNegative(m, newBalance, doAdd)) return;
        }
        doAdd();
    });

    dlg = dialogs.build({
        customView: root,
        cancelable: true
    }).show();
}

// ======================== 对话框：余额修正 ========================
function showCorrectBalanceDialog() {
    var md = DataManager.getMonthData();
    if (!md.initialized) {
        promptInitMonth();
        return;
    }

    var context = activity;

    // ---------- 创建根布局 ----------
    var root = new android.widget.LinearLayout(context);
    root.setOrientation(android.widget.LinearLayout.VERTICAL);
    var paddingDp = function(dp) {
        return android.util.TypedValue.applyDimension(
            android.util.TypedValue.COMPLEX_UNIT_DIP, dp,
            context.getResources().getDisplayMetrics()
        );
    };
    root.setPadding(paddingDp(20), paddingDp(20), paddingDp(20), paddingDp(20));

    var lp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    root.setLayoutParams(lp);

    // 辅助函数：创建 TextView
    function createTextView(text, textSize, textColor, gravity, marginBottom) {
        var tv = new android.widget.TextView(context);
        tv.setText(text);
        tv.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, textSize);
        tv.setTextColor(android.graphics.Color.parseColor(textColor));
        if (gravity) tv.setGravity(gravity);
        var lp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        if (marginBottom !== undefined) {
            lp.bottomMargin = paddingDp(marginBottom);
        }
        tv.setLayoutParams(lp);
        return tv;
    }

    // 辅助函数：创建 EditText
    function createEditText(hint, inputType, marginBottom) {
        var et = new android.widget.EditText(context);
        et.setHint(hint);
        et.setInputType(inputType);
        var lp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        if (marginBottom !== undefined) {
            lp.bottomMargin = paddingDp(marginBottom);
        }
        et.setLayoutParams(lp);
        return et;
    }

    // 标题
    var title = createTextView("余额修正", 20, COLORS.text, android.view.Gravity.CENTER, 16);
    root.addView(title);

    // 模块选择行
    var moduleRow = new android.widget.LinearLayout(context);
    moduleRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
    moduleRow.setGravity(android.view.Gravity.CENTER_VERTICAL);
    var rowLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    rowLp.bottomMargin = paddingDp(8);
    moduleRow.setLayoutParams(rowLp);

    var moduleLabel = new android.widget.TextView(context);
    moduleLabel.setText("模块：");
    moduleLabel.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 14);
    moduleLabel.setTextColor(android.graphics.Color.parseColor(COLORS.textSec));
    moduleRow.addView(moduleLabel);

    var spinner = new android.widget.Spinner(context);
    var adapter = new android.widget.ArrayAdapter(context, android.R.layout.simple_spinner_item, ["校园卡", "活动资金", "存款贡献"]);
    adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
    spinner.setAdapter(adapter);
    var spinnerLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    spinnerLp.weight = 1;
    spinner.setLayoutParams(spinnerLp);
    moduleRow.addView(spinner);
    root.addView(moduleRow);

    // 系统当前余额
    var sysLabel = createTextView("系统当前余额", 14, COLORS.textSec, android.view.Gravity.NO_GRAVITY, 4);
    root.addView(sysLabel);
    var tvSystemBalance = createTextView("¥0.00", 18, COLORS.text, android.view.Gravity.NO_GRAVITY, 8);
    root.addView(tvSystemBalance);

    // 实际余额输入
    var actualLabel = createTextView("实际余额", 14, COLORS.textSec, android.view.Gravity.NO_GRAVITY, 4);
    root.addView(actualLabel);
    var inputActual = createEditText("请输入实际余额", android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL, 8);
    root.addView(inputActual);

    // 差额显示
    var tvDiff = createTextView("差额: ¥0.00", 14, COLORS.accent, android.view.Gravity.NO_GRAVITY, 4);
    root.addView(tvDiff);

    // 备注输入
    var noteLabel = createTextView("备注", 14, COLORS.textSec, android.view.Gravity.NO_GRAVITY, 4);
    root.addView(noteLabel);
    var inputNote = createEditText("选填", android.text.InputType.TYPE_CLASS_TEXT, 12);
    root.addView(inputNote);

    // 按钮行
    var btnRow = new android.widget.LinearLayout(context);
    btnRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
    btnRow.setGravity(android.view.Gravity.END);
    var btnRowLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    btnRow.setLayoutParams(btnRowLp);

    var btnCancel = new android.widget.Button(context);
    btnCancel.setText("取消");
    //btnCancel.setBackgroundResource(android.R.attr.selectableItemBackground);
    var btnCancelLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    btnCancelLp.rightMargin = paddingDp(8);
    btnCancel.setLayoutParams(btnCancelLp);
    btnRow.addView(btnCancel);

    var btnConfirm = new android.widget.Button(context);
    btnConfirm.setText("确认修正");
    //btnConfirm.setBackgroundResource(android.R.attr.selectableItemBackground);
    btnRow.addView(btnConfirm);

    root.addView(btnRow);

    // ---------- 逻辑 ----------
    var MODULE_MAP = ["card", "activity", "savings"];

    function updateSystemBalance() {
        var mIdx = spinner.getSelectedItemPosition();
        var m = MODULE_MAP[mIdx];
        var md = DataManager.getMonthData();
        var balance = 0;
        if (m === "card") balance = md.cardBalance;
        else if (m === "activity") balance = md.activityBalance;
        else if (m === "savings") balance = md.savingsBalance;
        tvSystemBalance.setText(formatMoney(balance));
        updateDiff();
    }

    function updateDiff() {
        var mIdx = spinner.getSelectedItemPosition();
        var m = MODULE_MAP[mIdx];
        var md = DataManager.getMonthData();
        var currentBalance = 0;
        if (m === "card") currentBalance = md.cardBalance;
        else if (m === "activity") currentBalance = md.activityBalance;
        else if (m === "savings") currentBalance = md.savingsBalance;

        var actual = parseFloat(inputActual.getText().toString()) || 0;
        var diff = floatSub(actual, currentBalance);
        var msg = "差额: " + formatMoney(diff);
        if (diff > 0) msg += " (将记为收入)";
        else if (diff < 0) msg += " (将记为支出)";
        tvDiff.setText(msg);
        tvDiff.setTextColor(android.graphics.Color.parseColor(
            diff > 0 ? COLORS.green : diff < 0 ? COLORS.red : COLORS.textSec
        ));
    }

    spinner.setOnItemSelectedListener({
        onItemSelected: function() { updateSystemBalance(); },
        onNothingSelected: function() {}
    });

    inputActual.addTextChangedListener(new android.text.TextWatcher({
        afterTextChanged: function(editable) { updateDiff(); }
    }));

    var dlg = null;
    btnCancel.setOnClickListener(function() {
        if (dlg) dlg.dismiss();
    });

    btnConfirm.setOnClickListener(function() {
        var mIdx = spinner.getSelectedItemPosition();
        var m = MODULE_MAP[mIdx];
        var actual = parseFloat(inputActual.getText().toString());
        var note = inputNote.getText().toString();

        if (isNaN(actual)) {
            toast("请输入实际余额");
            return;
        }

        function doCorrect() {
            var tx = DataManager.correctBalance(m, actual, note);
            if (tx) {
                toast("修正成功");
                if (dlg) dlg.dismiss();
                renderOverview();
            }
        }

        // 修正后的实际余额为负时：先警告，允许继续
        if (warnIfBalanceNegative(m, actual, doCorrect)) return;
        doCorrect();
    });

    // 创建对话框
    dlg = dialogs.build({
        customView: root,
        cancelable: true
    }).show();

    // 初始更新
    updateSystemBalance();
}


// ======================== 对话框：流水详情/编辑/删除 ========================

function showTransactionDetailDialog(module, txId) {
    var md = DataManager.getMonthData();
    var txs = md.transactions[module] || [];
    var tx = null;
    for (var i = 0; i < txs.length; i++) {
        if (txs[i].id === txId) { tx = txs[i]; break; }
    }
    if (!tx) return;

    var moduleNames = { card: "校园卡", activity: "活动资金", savings: "存款贡献" };
    var typeNames = { income: "收入", expense: "支出" };

    dialogs.build({
        title: "流水详情",
        content: "模块: " + moduleNames[module] + "\n" +
                 "类型: " + typeNames[tx.type] + "\n" +
                 "金额: " + formatMoney(tx.amount) + "\n" +
                 "分类: " + tx.category + "\n" +
                 "备注: " + (tx.note || "无") + "\n" +
                 "时间: " + formatTime(tx.timestamp),
        positive: "删除",
        neutral: "编辑",
        negative: "关闭"
    }).on("positive", function (dlg) {
        // 确认删除
        dialogs.build({
            title: "确认删除",
            content: "确定删除这条流水记录吗？",
            positive: "删除",
            negative: "取消"
        }).on("positive", function () {
            DataManager.deleteTransaction(module, txId);
            toast("已删除");
            renderTransactions();
            renderOverview();
        }).show();
        dlg.dismiss();
    }).on("neutral", function (dlg) {
        dlg.dismiss();
        showEditTransactionDialog(module, txId);
    }).show();
}

// ======================== 对话框：编辑流水 ========================

function showEditTransactionDialog(module, txId) {
    var md = DataManager.getMonthData();
    var txs = md.transactions[module] || [];
    var tx = null;
    for (var i = 0; i < txs.length; i++) {
        if (txs[i].id === txId) { tx = txs[i]; break; }
    }
    if (!tx) {
        toast("未找到流水记录");
        return;
    }

    var context = activity;
    var paddingDp = function(dp) {
        return android.util.TypedValue.applyDimension(
            android.util.TypedValue.COMPLEX_UNIT_DIP, dp,
            context.getResources().getDisplayMetrics()
        );
    };

    // ---------- 根布局 ----------
    var root = new android.widget.LinearLayout(context);
    root.setOrientation(android.widget.LinearLayout.VERTICAL);
    root.setPadding(paddingDp(20), paddingDp(20), paddingDp(20), paddingDp(20));

    var lp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    root.setLayoutParams(lp);

    // 辅助函数：创建 TextView
    function createTextView(text, textSize, textColor, gravity, marginBottom) {
        var tv = new android.widget.TextView(context);
        tv.setText(text);
        tv.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, textSize);
        tv.setTextColor(android.graphics.Color.parseColor(textColor));
        if (gravity) tv.setGravity(gravity);
        var lp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        if (marginBottom !== undefined) {
            lp.bottomMargin = paddingDp(marginBottom);
        }
        tv.setLayoutParams(lp);
        return tv;
    }

    // 辅助函数：创建 EditText
    function createEditText(hint, inputType, text, marginBottom) {
        var et = new android.widget.EditText(context);
        et.setHint(hint);
        et.setInputType(inputType);
        if (text !== undefined && text !== null) et.setText(text);
        var lp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        if (marginBottom !== undefined) {
            lp.bottomMargin = paddingDp(marginBottom);
        }
        et.setLayoutParams(lp);
        return et;
    }

    // ---------- 构建界面 ----------
    // 标题
    var title = createTextView("编辑流水", 20, COLORS.text, android.view.Gravity.CENTER, 16);
    root.addView(title);

    // 金额
    var amountLabel = createTextView("金额", 14, COLORS.textSec, android.view.Gravity.NO_GRAVITY, 4);
    root.addView(amountLabel);
    var editAmount = createEditText("金额", android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL, String(tx.amount), 8);
    root.addView(editAmount);

    // 备注
    var noteLabel = createTextView("备注", 14, COLORS.textSec, android.view.Gravity.NO_GRAVITY, 4);
    root.addView(noteLabel);
    var editNote = createEditText("备注", android.text.InputType.TYPE_CLASS_TEXT, tx.note || "", 12);
    root.addView(editNote);

    // 按钮行
    var btnRow = new android.widget.LinearLayout(context);
    btnRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
    btnRow.setGravity(android.view.Gravity.END);
    var rowLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    btnRow.setLayoutParams(rowLp);

    var btnCancel = new android.widget.Button(context);
    btnCancel.setText("取消");
    //btnCancel.setBackgroundResource(android.R.attr.selectableItemBackground);
    var cancelLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    cancelLp.rightMargin = paddingDp(8);
    btnCancel.setLayoutParams(cancelLp);
    btnRow.addView(btnCancel);

    var btnConfirm = new android.widget.Button(context);
    btnConfirm.setText("保存");
    //btnConfirm.setBackgroundResource(android.R.attr.selectableItemBackground);
    btnRow.addView(btnConfirm);

    root.addView(btnRow);

    // ---------- 交互逻辑 ----------
    var dlg = null;
    btnCancel.setOnClickListener(function() {
        if (dlg) dlg.dismiss();
    });

    btnConfirm.setOnClickListener(function() {
        var newAmount = parseFloat(editAmount.getText().toString()) || 0;
        var newNote = editNote.getText().toString();

        if (newAmount <= 0) {
            toast("金额必须大于0");
            return;
        }

        function doEdit() {
            // 删除旧流水
            DataManager.deleteTransaction(module, txId);
            // 添加新流水（保留原类型、分类、时间戳）
            DataManager.addTransaction(module, tx.type, newAmount, tx.category, newNote, tx.timestamp);

            toast("已更新");
            if (dlg) dlg.dismiss();
            renderTransactions();
            renderOverview();
        }

        // 编辑支出可能导致余额透支：先警告，允许继续
        if (tx.type === "expense") {
            var mdEdit = DataManager.getMonthData();
            var balanceEdit;
            if (module === "card") balanceEdit = mdEdit.cardBalance;
            else if (module === "activity") balanceEdit = mdEdit.activityBalance;
            else balanceEdit = mdEdit.savingsBalance;
            // 撤销旧支出再应用新支出后的余额
            var newBalanceEdit = floatSub(floatAdd(balanceEdit, tx.amount), newAmount);
            if (warnIfBalanceNegative(module, newBalanceEdit, doEdit)) return;
        }
        doEdit();
    });

    // 显示对话框
    dlg = dialogs.build({
        customView: root,
        cancelable: true
    }).show();
}

// ======================== 对话框：修改校园卡标准 ========================

function showChangeStandardDialog() {
    var current = DataManager.getCardStandard();

    dialogs.build({
        title: "修改校园卡月标准",
        content: "当前标准: " + formatMoney(current) + "\n修改将于下月生效",
        inputHint: "请输入新标准金额",
        inputPrefill: String(current)
    }).on("input", function (value) {
        var newStandard = parseFloat(value);
        if (isNaN(newStandard) || newStandard < 0) {
            toast("请输入有效金额");
            return;
        }
        DataManager.setCardStandard(newStandard);
        toast("标准已修改，下月生效");
        renderSettings();
        renderOverview();
    }).show();
}

// ======================== 对话框：修改当前月份 ========================

function showChangeCurrentMonthDialog() {
    var curKey = DataManager.getCurrentMonth();
    var targetKey = curKey;
    var context = activity;

    var paddingDp = function(dp) {
        return android.util.TypedValue.applyDimension(
            android.util.TypedValue.COMPLEX_UNIT_DIP, dp,
            context.getResources().getDisplayMetrics()
        );
    };

    // 根布局
    var root = new android.widget.LinearLayout(context);
    root.setOrientation(android.widget.LinearLayout.VERTICAL);
    root.setPadding(paddingDp(20), paddingDp(20), paddingDp(20), paddingDp(20));
    var rootLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    root.setLayoutParams(rootLp);

    // 辅助函数：创建 TextView
    function createTextView(text, textSize, textColor, gravity, marginBottom) {
        var tv = new android.widget.TextView(context);
        tv.setText(text);
        tv.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, textSize);
        tv.setTextColor(android.graphics.Color.parseColor(textColor));
        if (gravity) tv.setGravity(gravity);
        var lp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        if (marginBottom !== undefined) lp.bottomMargin = paddingDp(marginBottom);
        tv.setLayoutParams(lp);
        return tv;
    }

    // 标题
    root.addView(createTextView("修改当前月份", 20, COLORS.text, android.view.Gravity.CENTER, 12));

    // 当前月份
    root.addView(createTextView("当前月份: " + curKey, 14, COLORS.textSec, android.view.Gravity.CENTER, 12));

    // 目标月份调节行
    var navRow = new android.widget.LinearLayout(context);
    navRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
    navRow.setGravity(android.view.Gravity.CENTER_VERTICAL);
    var navLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    navLp.bottomMargin = paddingDp(12);
    navRow.setLayoutParams(navLp);

    var btnPrev = new android.widget.Button(context);
    btnPrev.setText("◀ 上月");
    var prevLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    btnPrev.setLayoutParams(prevLp);
    navRow.addView(btnPrev);

    var tvTarget = new android.widget.TextView(context);
    tvTarget.setText(targetKey);
    tvTarget.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 18);
    tvTarget.setTextColor(android.graphics.Color.parseColor(COLORS.text));
    tvTarget.setGravity(android.view.Gravity.CENTER);
    tvTarget.setTypeface(null, android.graphics.Typeface.BOLD);
    var targetLp = new android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1);
    tvTarget.setLayoutParams(targetLp);
    navRow.addView(tvTarget);

    var btnNext = new android.widget.Button(context);
    btnNext.setText("下月 ▶");
    var nextLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    btnNext.setLayoutParams(nextLp);
    navRow.addView(btnNext);

    root.addView(navRow);

    // 红字警示（固定规则说明）
    root.addView(createTextView(
        "⚠️ 改为过去的月份：本月数据将整体搬迁到目标月份；目标月份之后至当前月份的所有月份将被清零（目标月份若已有数据会被覆盖）。",
        12, COLORS.red, null, 4));
    root.addView(createTextView(
        "⚠️ 改为未来的月份：本月数据将整体搬迁到目标月份；原当前月份至目标月份前一个月的数据将被清零（目标月份若已有数据会被覆盖）。",
        12, COLORS.red, null, 8));

    // 动态后果提示（随所选目标月份变化）
    var tvConsequence = createTextView("", 13, COLORS.accent, android.view.Gravity.CENTER, 12);
    root.addView(tvConsequence);

    function updateConsequence() {
        if (targetKey === curKey) {
            tvConsequence.setText("目标月份与当前月份相同，不会做任何改动");
            tvConsequence.setTextColor(android.graphics.Color.parseColor(COLORS.textSec));
        } else if (targetKey < curKey) {
            tvConsequence.setText("将把 " + curKey + " 的数据整体搬迁到 " + targetKey + "，中间月份清零");
            tvConsequence.setTextColor(android.graphics.Color.parseColor(COLORS.red));
        } else {
            tvConsequence.setText("将把 " + curKey + " 的数据整体搬迁到 " + targetKey + "，搬迁前月份数据清零");
            tvConsequence.setTextColor(android.graphics.Color.parseColor(COLORS.accent));
        }
    }

    btnPrev.setOnClickListener(function() {
        targetKey = shiftMonthKey(targetKey, -1);
        tvTarget.setText(targetKey);
        updateConsequence();
    });
    btnNext.setOnClickListener(function() {
        targetKey = shiftMonthKey(targetKey, 1);
        tvTarget.setText(targetKey);
        updateConsequence();
    });

    // 按钮行
    var btnRow = new android.widget.LinearLayout(context);
    btnRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
    btnRow.setGravity(android.view.Gravity.END);
    var btnRowLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    btnRow.setLayoutParams(btnRowLp);

    var btnCancel = new android.widget.Button(context);
    btnCancel.setText("取消");
    var cancelLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    cancelLp.rightMargin = paddingDp(8);
    btnCancel.setLayoutParams(cancelLp);
    btnRow.addView(btnCancel);

    var btnConfirm = new android.widget.Button(context);
    btnConfirm.setText("确认修改");
    btnRow.addView(btnConfirm);

    root.addView(btnRow);

    var dlg = null;
    btnCancel.setOnClickListener(function() {
        if (dlg) dlg.dismiss();
    });

    btnConfirm.setOnClickListener(function() {
        if (targetKey === curKey) {
            toast("目标月份与当前月份相同");
            return;
        }
        var confirmMsg;
        if (targetKey < curKey) {
            var startClear = shiftMonthKey(targetKey, 1);
            confirmMsg = "确定把当前月份改为 " + targetKey + " 吗？\n\n" + curKey + " 的数据将整体搬迁到 " + targetKey + "，\n" + startClear + " 至 " + curKey + " 的月份数据将被清零。";
        } else {
            var prevOfTarget = shiftMonthKey(targetKey, -1);
            confirmMsg = "确定把当前月份改为 " + targetKey + " 吗？\n\n" + curKey + " 的数据将整体搬迁到 " + targetKey + "，\n" + curKey + " 至 " + prevOfTarget + " 的数据将被清零。";
        }
        dialogs.build({
            title: "再次确认",
            content: confirmMsg,
            positive: "确认修改",
            negative: "取消"
        }).on("positive", function() {
            DataManager.changeCurrentMonth(targetKey);
            syncViewMonth();
            if (dlg) dlg.dismiss();
            toast("当前月份已改为 " + targetKey);
            renderOverview();
            renderSettings();
            renderTransactions();
            renderChart();
        }).show();
    });

    dlg = dialogs.build({
        customView: root,
        cancelable: true
    }).show();

    updateConsequence();
}

// ======================== 对话框：自定义分类管理 ========================

function showManageCategoriesDialog(module) {
    var moduleName = module === "card" ? "校园卡" : "活动资金";
    var cats = DataManager.getCategories(module);

    var context = activity;
    var paddingDp = function(dp) {
        return android.util.TypedValue.applyDimension(
            android.util.TypedValue.COMPLEX_UNIT_DIP, dp,
            context.getResources().getDisplayMetrics()
        );
    };

    // ---------- 根布局 ----------
    var root = new android.widget.LinearLayout(context);
    root.setOrientation(android.widget.LinearLayout.VERTICAL);
    root.setPadding(paddingDp(20), paddingDp(20), paddingDp(20), paddingDp(20));
    var lp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    root.setLayoutParams(lp);

    // 标题
    var title = new android.widget.TextView(context);
    title.setText(moduleName + " 分类管理");
    title.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 18);
    title.setTextColor(android.graphics.Color.parseColor(COLORS.text));
    title.setGravity(android.view.Gravity.CENTER);
    var titleLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    titleLp.bottomMargin = paddingDp(12);
    title.setLayoutParams(titleLp);
    root.addView(title);

    // ---------- ListView ----------
    var listView = new android.widget.ListView(context);
    var listLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.util.TypedValue.applyDimension(android.util.TypedValue.COMPLEX_UNIT_DIP, 250, context.getResources().getDisplayMetrics())
    );
    listView.setLayoutParams(listLp);

    // 适配器：使用 ArrayAdapter 显示分类名称
    var adapter = new android.widget.ArrayAdapter(context, android.R.layout.simple_list_item_1, cats);
    listView.setAdapter(adapter);

    /** 从存储重新读取最新分类，就地覆盖本地列表并刷新适配器。
     *  注意：adapter 持有 cats 数组的引用，必须就地覆盖，不能重新赋值。
     *  所有增删都只改存储这一处，再用本函数同步界面，避免双份操作导致重复/多删。 */
    function syncCategories() {
        var latest = DataManager.getCategories(module);
        cats.length = 0;
        for (var i = 0; i < latest.length; i++) {
            cats.push(latest[i]);
        }
        adapter.notifyDataSetChanged();
    }

    // 点击删除
    listView.setOnItemClickListener(new android.widget.AdapterView.OnItemClickListener({
        onItemClick: function(parent, view, position, id) {
            var catName = cats[position];
            dialogs.build({
                title: "确认删除",
                content: "确定删除分类 \"" + catName + "\" 吗？",
                positive: "删除",
                negative: "取消"
            }).on("positive", function() {
                // 只改存储这一处，再从存储同步本地列表，避免同一数组被改两次导致多删
                var list = DataManager.data.customCategories[module];
                var idx = list.indexOf(catName);
                if (idx >= 0) {
                    list.splice(idx, 1);
                    DataManager.save();
                }
                syncCategories();
                toast("已删除");
            }).show();
        }
    }));

    root.addView(listView);

    // ---------- 输入行 ----------
    var inputRow = new android.widget.LinearLayout(context);
    inputRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
    var rowLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    rowLp.topMargin = paddingDp(8);
    inputRow.setLayoutParams(rowLp);

    var editText = new android.widget.EditText(context);
    editText.setHint("新分类名称");
    var editLp = new android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1);
    editLp.rightMargin = paddingDp(8);
    editText.setLayoutParams(editLp);
    inputRow.addView(editText);

    var btnAdd = new android.widget.Button(context);
    btnAdd.setText("添加");
    //btnAdd.setBackgroundResource(android.R.attr.selectableItemBackground);
    btnAdd.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 12);
    inputRow.addView(btnAdd);

    root.addView(inputRow);

    // ---------- 按钮点击添加 ----------
    btnAdd.setOnClickListener(function() {
        var name = editText.getText().toString().trim();
        if (!name) {
            toast("请输入分类名称");
            return;
        }
        if (cats.indexOf(name) !== -1) {
            toast("该分类已存在");
            return;
        }
        // 只改存储这一处（addCategory 内部已去重），再同步本地列表
        DataManager.addCategory(module, name);
        syncCategories();
        editText.setText("");
        toast("已添加");
    });

    // ---------- 显示对话框 ----------
    var dlg = dialogs.build({
        customView: root,
        cancelable: true
    }).show();

    // 返回对话框引用（可选）
    return dlg;
}

// ======================== 数据导入导出 ========================

// ======================== 数据导入导出 ========================

/** 导出目录：根目录（内置存储）下的"生活费导出"文件夹 */
function getExportDir() {
    return files.join(files.getSdcardPath(), "生活费导出");
}

/** 导出前准备目录：不存在则创建，存在则清空其中所有文件/子目录 */
function prepareExportDir() {
    var dir = getExportDir();
    if (!files.exists(dir)) {
        files.createWithDirs(dir + "/");
        return dir;
    }
    var names = files.listDir(dir);
    for (var i = 0; i < names.length; i++) {
        var p = files.join(dir, names[i]);
        if (files.isDir(p)) {
            files.removeDir(p);
        } else {
            files.remove(p);
        }
    }
    return dir;
}

/** 导出数据（按月选择，支持全选），每月一个 生活费数据_YYYY-MM.json */
function exportData() {
    var keys = DataManager.getAllMonthKeys();
    if (keys.length === 0) {
        toast("暂无任何月份数据可导出");
        return;
    }
    var labels = ["全选"];
    for (var i = 0; i < keys.length; i++) {
        labels.push(keys[i]);
    }
    dialogs.multiChoice("选择要导出的月份（数据文件）", labels).then(function (selected) {
        if (!selected || selected.length === 0) {
            toast("未选择月份，已取消导出");
            return;
        }
        var chosen = [];
        var all = false;
        for (var s = 0; s < selected.length; s++) {
            if (selected[s] === 0) { all = true; break; }
            chosen.push(keys[selected[s] - 1]);
        }
        if (all) chosen = keys.slice();
        chosen.sort();

        // 导出前清空导出目录下的旧文件
        var dir = prepareExportDir();

        var okCount = 0;
        var failNames = [];
        for (var k = 0; k < chosen.length; k++) {
            var monthKey = chosen[k];
            var snapshot = {
                currentMonth: monthKey,
                cardStandard: DataManager.data.cardStandard,
                cardStandardHistory: DataManager.data.cardStandardHistory,
                customCategories: DataManager.data.customCategories,
                months: {}
            };
            snapshot.months[monthKey] = DataManager.data.months[monthKey];
            var fileName = "生活费数据_" + monthKey + ".json";
            var filePath = files.join(dir, fileName);
            try {
                files.write(filePath, JSON.stringify(snapshot, null, 2));
                // 回读校验：个别设备上文件会被创建但内容写入失败（如缺少"所有文件访问"权限），
                // 会留下 0 字节空文件，导入时表现为 Empty JSON string
                if (files.exists(filePath) && files.getSize(filePath) > 0) {
                    okCount++;
                } else {
                    failNames.push(fileName);
                    console.error("文件写入后为空: " + filePath);
                }
            } catch (ew) {
                failNames.push(fileName);
                console.error("文件写入失败: " + filePath + " -> " + ew);
            }
        }
        if (failNames.length > 0) {
            toast("有 " + failNames.length + " 个文件写入失败：\n" + failNames.join("\n") + "\n请检查本应用的存储权限后重新导出");
        } else {
            toast("已导出 " + okCount + " 个月的数据到：\n" + dir);
        }
    });
}

/** CSV 字段转义（含逗号/引号/换行时用双引号包裹） */
function csvEscape(v) {
    var s = String(v === undefined || v === null ? "" : v);
    if (/[",\r\n]/.test(s)) {
        s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

/** 导出 CSV 财报（勾选年月），文件名：生活费报表从_起_到_止.csv */
function exportCsvReport() {
    var keys = DataManager.getAllMonthKeys();
    if (keys.length === 0) {
        toast("暂无任何月份数据可导出");
        return;
    }
    // 默认全部勾选，用户可取消
    var defaultSel = [];
    for (var d = 0; d < keys.length; d++) defaultSel.push(d);

    dialogs.multiChoice("选择要生成报表的年月（可多选）", keys, defaultSel).then(function (selected) {
        if (!selected || selected.length === 0) {
            toast("未选择月份，已取消导出");
            return;
        }
        var chosen = [];
        for (var j = 0; j < selected.length; j++) {
            chosen.push(keys[selected[j]]);
        }
        chosen.sort();

        // 导出前清空导出目录
        var dir = prepareExportDir();

        var MODULE_NAMES = { card: "校园卡", activity: "活动资金", savings: "存款贡献" };
        var lines = [];
        var i, m, t, k2;

        // 第一部分：流水明细
        lines.push("月份,模块,类型,金额,分类,备注,时间");
        for (i = 0; i < chosen.length; i++) {
            var key = chosen[i];
            var md = DataManager.peekMonthData(key);
            if (!md || !md.transactions) continue;
            var mods = ["card", "activity", "savings"];
            for (m = 0; m < mods.length; m++) {
                var txs = md.transactions[mods[m]] || [];
                for (t = 0; t < txs.length; t++) {
                    var tx = txs[t];
                    var row = [
                        key,
                        MODULE_NAMES[mods[m]],
                        tx.type === "income" ? "收入" : "支出",
                        Number(tx.amount).toFixed(2),
                        tx.category || "",
                        tx.note || "",
                        formatTime(tx.timestamp)
                    ];
                    var escaped = [];
                    for (var e = 0; e < row.length; e++) escaped.push(csvEscape(row[e]));
                    lines.push(escaped.join(","));
                }
            }
        }

        // 第二部分：月度汇总
        lines.push("");
        lines.push("【月度汇总】");
        lines.push("月份,生活费总额,校园卡充值,活动资金初始,校园卡余额,活动资金余额,存款贡献余额,状态");
        for (k2 = 0; k2 < chosen.length; k2++) {
            var key2 = chosen[k2];
            var md2 = DataManager.peekMonthData(key2);
            if (!md2) continue;
            var status = md2.settled ? "已结转" : (md2.initialized ? "进行中" : "未初始化");
            var srow = [
                key2,
                Number(md2.totalBudget || 0).toFixed(2),
                Number(md2.cardRecharge || 0).toFixed(2),
                Number(md2.activityInitial || 0).toFixed(2),
                Number(md2.cardBalance || 0).toFixed(2),
                Number(md2.activityBalance || 0).toFixed(2),
                Number(md2.savingsBalance || 0).toFixed(2),
                status
            ];
            var sesc = [];
            for (var e2 = 0; e2 < srow.length; e2++) sesc.push(csvEscape(srow[e2]));
            lines.push(sesc.join(","));
        }

        // 加 BOM 头，保证 Excel 打开时中文不乱码
        var content = "\uFEFF" + lines.join("\r\n") + "\r\n";
        var fileName = "生活费报表从_" + chosen[0] + "_到_" + chosen[chosen.length - 1] + ".csv";
        var path = files.join(dir, fileName);
        try {
            files.write(path, content);
        } catch (ew) {
            toast("报表写入失败，请检查存储权限");
            console.error("CSV写入失败: " + path + " -> " + ew);
            return;
        }
        if (files.exists(path) && files.getSize(path) > 0) {
            toast("报表已导出：\n" + path);
        } else {
            toast("报表写入后为空，请检查存储权限后重试");
            console.error("CSV写入后为空: " + path);
        }
    });
}

function importData() {
    dialogs.build({
        title: "导入数据",
        content: "数据文件位于根目录「生活费导出」文件夹。\n导入会覆盖相同月份的数据，其他月份不受影响。",
        positive: "一键导入全部文件",
        negative: "从文件列表选择",
        neutral: "手动输入路径"
    }).on("positive", function () {
        importAllFromDir();
    }).on("negative", function () {
        pickDataFileFromList();
    }).on("neutral", function () {
        importFromManualPath();
    }).show();
}

/** 读取并解析数据文件：去掉 BOM 和首尾空白后再解析，返回 { data, error }
 *  （文件被编辑器/传输工具加过 BOM 时，直接 JSON.parse 会失败，必须先剥离） */
function parseDataFile(path) {
    var content;
    try {
        content = files.read(path);
    } catch (e) {
        return { data: null, error: "读取失败" };
    }
    if (!content) {
        var emptySize = 0;
        try { emptySize = files.getSize(path); } catch (e2) { /* 忽略 */ }
        return { data: null, error: "文件为空（" + emptySize + " 字节），请重新导出" };
    }
    content = String(content).replace(/^\uFEFF/, "").trim();
    try {
        var data = JSON.parse(content);
        if (!data || typeof data !== "object") {
            return { data: null, error: "不是有效的JSON对象" };
        }
        if (!data.months) {
            return { data: null, error: "缺少months字段" };
        }
        return { data: data, error: null };
    } catch (e) {
        return { data: null, error: String(e && e.message ? e.message : e) };
    }
}

/** 一键导入：合并导出目录下所有 .json 数据文件（每个文件含一个月） */
function importAllFromDir() {
    var dir = getExportDir();
    var list = [];
    if (files.exists(dir)) {
        list = files.listDir(dir, function (name) {
            return name.length > 5 && name.slice(-5) === ".json";
        });
        list.sort();
    }
    if (!list || list.length === 0) {
        toast("「生活费导出」文件夹中没有数据文件");
        return;
    }
    var mergedMonths = {};
    var failedFiles = [];
    for (var i = 0; i < list.length; i++) {
        var filePath = files.join(dir, list[i]);
        var parsed = parseDataFile(filePath);
        if (!parsed.data) {
            failedFiles.push(list[i] + "（" + parsed.error + "）");
            console.error("导入解析失败: " + filePath + " -> " + parsed.error);
            continue;
        }
        var ks = Object.keys(parsed.data.months);
        for (var j = 0; j < ks.length; j++) {
            mergedMonths[ks[j]] = parsed.data.months[ks[j]];
        }
    }
    var monthKeys = Object.keys(mergedMonths);
    monthKeys.sort();
    if (monthKeys.length === 0) {
        toast("没有可导入的月份数据" + (failedFiles.length > 0 ? "，失败原因：\n" + failedFiles.join("\n") : ""));
        return;
    }
    var msg = "共发现 " + list.length + " 个数据文件、" + monthKeys.length + " 个月的数据：\n" + monthKeys.join("、");
    if (failedFiles.length > 0) {
        msg += "\n以下文件解析失败已跳过：\n" + failedFiles.join("\n");
    }
    msg += "\n\n相同月份的数据将被覆盖（已结转的月份除外）。继续吗？";
    dialogs.build({
        title: "确认导入",
        content: msg,
        positive: "导入",
        negative: "取消"
    }).on("positive", function () {
        var result = mergeImportedMonths(mergedMonths);
        DataManager.ensureStructure();
        DataManager.save();
        afterImportSuccess(monthKeys, result);
    }).show();
}

/** 合并导入月份数据：原本已结转的月份不允许被导入覆盖
 *  @returns {object} { merged: 实际合并的月份, skipped: 因已结转被跳过的月份 } */
function mergeImportedMonths(importedMonths) {
    var keys = Object.keys(importedMonths);
    keys.sort();
    var merged = [];
    var skipped = [];
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var existing = DataManager.data.months[key];
        if (existing && existing.settled) {
            // 原本数据该月已结转，导入不覆盖
            skipped.push(key);
            continue;
        }
        DataManager.data.months[key] = importedMonths[key];
        merged.push(key);
    }
    return { merged: merged, skipped: skipped };
}

/** 撤销月末结转：移除结转流水对、恢复活动资金余额、状态改回未结转 */
function undoSettleMonth(md) {
    if (!md || !md.settled || !md.transactions) return;
    var actTxs = md.transactions.activity || [];
    var savTxs = md.transactions.savings || [];
    var actIdx = -1;
    var i;
    for (i = actTxs.length - 1; i >= 0; i--) {
        if (actTxs[i].category === "结转至存款贡献") { actIdx = i; break; }
    }
    if (actIdx >= 0) {
        var amount = actTxs[actIdx].amount;
        md.activityBalance = floatAdd(md.activityBalance, amount);
        md.savingsBalance = floatSub(md.savingsBalance, amount);
        actTxs.splice(actIdx, 1);
        // 移除对应的存款贡献"结转入账"收入
        for (i = savTxs.length - 1; i >= 0; i--) {
            if (savTxs[i].category === "结转入账" && savTxs[i].note === "从活动资金结转") {
                savTxs.splice(i, 1);
                break;
            }
        }
    }
    md.settled = false;
}

/** 导入成功后的统一处理：
 *  1. 更新当前月份：原当前月未初始化（如刚清空过），或导入数据含更新月份时，采用导入的最新月份
 *  2. 最新月份不得处于结转后状态（除非原本就已结转）
 *  3. 跳转到当前月份 */
function afterImportSuccess(importedKeys, mergeResult) {
    var importedSorted = importedKeys.slice();
    importedSorted.sort();
    var importedLatest = importedSorted[importedSorted.length - 1];
    var oldCur = DataManager.getCurrentMonth();
    var curMd = DataManager.peekMonthData(oldCur);
    var curIsEmpty = !curMd || !curMd.initialized;

    // 更新当前月份：原当前月是空的（未初始化），或导入数据里有更新的月份
    var monthChanged = false;
    if (importedLatest && (importedLatest > oldCur || curIsEmpty)) {
        DataManager.setCurrentMonth(importedLatest);
        monthChanged = true;
    }
    var targetKey = DataManager.getCurrentMonth();
    var undone = false;

    // 最新月份不能处于结转后的状态：仅当该月是本次导入（覆盖）进来的才被还原；
    // 原本就已结转的月份（在 skipped 里）保持原状
    if (targetKey && mergeResult.merged.indexOf(targetKey) !== -1) {
        var md = DataManager.data.months[targetKey];
        if (md && md.settled) {
            undoSettleMonth(md);
            DataManager.save();
            undone = true;
        }
    }

    var msg;
    if (mergeResult.merged.length > 0) {
        msg = "导入成功：" + mergeResult.merged.join("、");
        if (mergeResult.skipped.length > 0) {
            msg += "\n（" + mergeResult.skipped.join("、") + " 原已结转，未被覆盖）";
        }
    } else {
        msg = "导入完成：相关月份原数据均已结转，未被覆盖";
    }
    if (monthChanged) msg += "\n当前月份已更新为 " + targetKey;
    if (undone) msg += "\n最新月份的结转状态已还原，可继续记账";
    toast(msg);

    renderOverview();
    renderSettings();
    renderChart();

    // 自动跳转到当前月份并在流水页展示
    UIState.viewMonth = targetKey;
    switchTab(1);
}

/** 从导出目录的文件列表中选择数据文件导入 */
function pickDataFileFromList() {
    var dir = getExportDir();
    var list = [];
    if (files.exists(dir)) {
        list = files.listDir(dir, function (name) {
            return name.length > 5 && name.slice(-5) === ".json";
        });
        list.sort();
    }
    if (!list || list.length === 0) {
        toast("「生活费导出」文件夹中没有数据文件");
        importFromManualPath();
        return;
    }
    dialogs.select("选择要导入的数据文件", list).then(function (idx) {
        if (idx === null || idx === undefined || idx < 0) return;
        confirmAndImport(files.join(dir, list[idx]));
    });
}

/** 手动输入路径导入（兼容旧方式） */
function importFromManualPath() {
    dialogs.rawInput("请输入数据文件路径", getExportDir() + "/").then(function (path) {
        if (!path) return;
        if (!files.exists(path)) {
            toast("文件不存在");
            return;
        }
        confirmAndImport(path);
    });
}

/** 读取并校验数据文件，确认后合并导入月份 */
function confirmAndImport(path) {
    var parsed = parseDataFile(path);
    if (!parsed.data) {
        toast("文件无法导入：" + parsed.error);
        console.error("导入失败: " + path + " -> " + parsed.error);
        return;
    }
    var data = parsed.data;
    var monthKeys = Object.keys(data.months);
    monthKeys.sort();
    if (monthKeys.length === 0) {
        toast("该文件中没有月份数据");
        return;
    }
    dialogs.build({
        title: "确认导入",
        content: "文件包含 " + monthKeys.length + " 个月的数据：\n" + monthKeys.join("、") + "\n\n相同月份的数据将被覆盖（已结转的月份除外），其他月份不受影响。继续吗？",
        positive: "导入",
        negative: "取消"
    }).on("positive", function () {
        var result = mergeImportedMonths(data.months);
        DataManager.ensureStructure();
        DataManager.save();
        afterImportSuccess(monthKeys, result);
    }).show();
}

// ======================== 未开启新月引导 ========================

/** 未开启新月时的统一引导：提示并询问是否立即开启 */
function promptInitMonth() {
    dialogs.build({
        title: "尚未开启新月",
        content: "需要先开启新月才能记账，现在开启吗？",
        positive: "去开启",
        negative: "取消"
    }).on("positive", function () {
        showNewMonthDialog(false);
    }).show();
}

// ======================== 对话框：清空所有数据 ========================

function showClearAllDialog() {
    dialogs.build({
        title: "清空所有数据",
        content: "将删除所有月份的全部流水、余额和设置记录，且无法恢复。\n建议先使用「导出数据」备份。\n确定继续吗？",
        positive: "继续",
        negative: "取消"
    }).on("positive", function () {
        dialogs.build({
            title: "再次确认",
            content: "真的要清空所有数据吗？此操作不可恢复！",
            positive: "确定清空",
            negative: "取消"
        }).on("positive", function () {
            DataManager.data = DataManager.createDefaultData();
            DataManager.ensureStructure();
            DataManager.save();
            toast("已清空所有数据");
            renderOverview();
            renderSettings();
            renderTransactions();
        }).show();
    }).show();
}

// ======================== 事件绑定 ========================

// 底部导航
ui.nav0.on("click", function () { switchTab(0); });
ui.nav1.on("click", function () { switchTab(1); });
ui.nav2.on("click", function () { switchTab(2); });
ui.nav3.on("click", function () { switchTab(3); });

// 总览页按钮
ui.btnNewMonth.on("click", function () {
    var md = DataManager.getMonthData();
    if (md.initialized && !md.settled) {
        // 本月进行中，先确认
        dialogs.build({
            title: "提示",
            content: "本月尚未结转，确定要开启新月吗？",
            positive: "确定",
            negative: "取消"
        }).on("positive", function () {
            // 切换到下月
            advanceToNextMonth();
            showNewMonthDialog(false);
        }).show();
        return;
    }
    if (md.settled) {
        // 已结转，自动计算方式
        advanceToNextMonth();
        showNewMonthDialog(true);
        return;
    }
    // 未初始化
    showNewMonthDialog(false);
});

ui.btnSettle.on("click", function () { showSettleDialog(); });
ui.btnAddTx.on("click", function () { showAddTransactionDialog(); });
ui.btnCorrect.on("click", function () { showCorrectBalanceDialog(); });

// 余额卡片"明细"按钮（跳转流水页并回到当前月份）
ui.btnCardDetail.on("click", function () {
    UIState.txModule = "card";
    UIState.txType = "expense";
    syncViewMonth();
    switchTab(1);
});
ui.btnActivityDetail.on("click", function () {
    UIState.txModule = "activity";
    UIState.txType = "expense";
    syncViewMonth();
    switchTab(1);
});

// 流水页模块Tab
ui.tabTxCard.on("click", function () {
    UIState.txModule = "card";
    renderTransactions();
});
ui.tabTxActivity.on("click", function () {
    UIState.txModule = "activity";
    renderTransactions();
});
ui.tabTxSavings.on("click", function () {
    UIState.txModule = "savings";
    renderTransactions();
});

// 流水页类型Tab
ui.tabTxIncome.on("click", function () {
    UIState.txType = "income";
    renderTransactions();
});
ui.tabTxExpense.on("click", function () {
    UIState.txType = "expense";
    renderTransactions();
});

// 流水页添加按钮（仅在展示当前月份时允许添加）
ui.btnAddTxFromList.on("click", function () {
    if (UIState.viewMonth !== DataManager.getCurrentMonth()) {
        toast("当前正在查看 " + UIState.viewMonth + "，请调回当前月份再添加流水");
        return;
    }
    showAddTransactionDialog(UIState.txModule);
});

// 展示月份调节（流水/图表页共用同一个展示月份）
ui.btnTxMonthPrev.on("click", function () { shiftViewMonth(-1); });
ui.btnTxMonthNext.on("click", function () { shiftViewMonth(1); });
ui.btnChartMonthPrev.on("click", function () { shiftViewMonth(-1); });
ui.btnChartMonthNext.on("click", function () { shiftViewMonth(1); });

// 图表页按钮
ui.chartCard.on("click", function () {
    UIState.chartModule = "card";
    renderChart();
});
ui.chartActivity.on("click", function () {
    UIState.chartModule = "activity";
    renderChart();
});
ui.chartMonth.on("click", function () {
    UIState.chartRange = "month";
    renderChart();
});
ui.chartAll.on("click", function () {
    UIState.chartRange = "all";
    renderChart();
});

// 设置页按钮
ui.btnChangeMonth.on("click", function () { showChangeCurrentMonthDialog(); });
ui.btnChangeStandard.on("click", function () { showChangeStandardDialog(); });
ui.btnManageCatCard.on("click", function () { showManageCategoriesDialog("card"); });
ui.btnManageCatActivity.on("click", function () { showManageCategoriesDialog("activity"); });
ui.btnExportData.on("click", function () { exportData(); });
ui.btnImportData.on("click", function () { importData(); });
ui.btnExportCsv.on("click", function () { exportCsvReport(); });
ui.btnClearAll.on("click", function () { showClearAllDialog(); });

// ======================== 辅助函数 ========================

/** 推进到下一个月 */
function advanceToNextMonth() {
    var cur = DataManager.getCurrentMonth();
    var parts = cur.split("-");
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]);
    month++;
    if (month > 12) { month = 1; year++; }
    var nextKey = year + "-" + ("0" + month).slice(-2);
    DataManager.setCurrentMonth(nextKey);
}

// ======================== 应用初始化 ========================

// 初始化数据管理
DataManager.init();

// 展示月份与存储中的当前月同步（存储的当前月可能与系统时间不同）
UIState.viewMonth = DataManager.getCurrentMonth();
updateViewMonthLabels();

// 检查是否需要首次设置
if (!DataManager.isCurrentMonthInitialized()) {
    // 首次使用，提示开启新月
    ui.run(function () {
        toast("欢迎使用！请先开启新月");
        // 延迟弹出初始化对话框
        setTimeout(function () {
            showNewMonthDialog(false);
        }, 500);
    });
}

// 渲染首页
renderOverview();

// 设置窗口标题
activity.window.setTitle(APP_NAME);


function showSettleDialog() {
    var md = DataManager.getMonthData();

    if (!md.initialized) {
        toast("本月尚未初始化，无法结转");
        return;
    }
    if (md.settled) {
        toast("本月已结转");
        return;
    }

    var activityBalance = md.activityBalance;
    var context = activity;
    var paddingDp = function(dp) {
        return android.util.TypedValue.applyDimension(
            android.util.TypedValue.COMPLEX_UNIT_DIP, dp,
            context.getResources().getDisplayMetrics()
        );
    };

    // 根布局
    var root = new android.widget.LinearLayout(context);
    root.setOrientation(android.widget.LinearLayout.VERTICAL);
    root.setPadding(paddingDp(20), paddingDp(20), paddingDp(20), paddingDp(20));
    var lp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    root.setLayoutParams(lp);

    // 标题
    var title = new android.widget.TextView(context);
    title.setText("月末结转");
    title.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 20);
    title.setTextColor(android.graphics.Color.parseColor(COLORS.text));
    title.setGravity(android.view.Gravity.CENTER);
    var titleLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    titleLp.bottomMargin = paddingDp(16);
    title.setLayoutParams(titleLp);
    root.addView(title);

    // 余额标签
    var label = new android.widget.TextView(context);
    label.setText("当前活动资金余额");
    label.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 14);
    label.setTextColor(android.graphics.Color.parseColor(COLORS.textSec));
    var labelLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    labelLp.bottomMargin = paddingDp(4);
    label.setLayoutParams(labelLp);
    root.addView(label);

    // 余额金额
    var amountTv = new android.widget.TextView(context);
    amountTv.setText(formatMoney(activityBalance));
    amountTv.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 28);
    amountTv.setTextColor(android.graphics.Color.parseColor(COLORS.activity));
    amountTv.setGravity(android.view.Gravity.CENTER);
    var amountLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    amountLp.bottomMargin = paddingDp(12);
    amountTv.setLayoutParams(amountLp);
    root.addView(amountTv);

    // 结转说明
    var info1 = new android.widget.TextView(context);
    info1.setText("结转后，活动资金余额将清零");
    info1.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 13);
    info1.setTextColor(android.graphics.Color.parseColor(COLORS.textSec));
    info1.setGravity(android.view.Gravity.CENTER);
    var infoLp1 = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    infoLp1.bottomMargin = paddingDp(4);
    info1.setLayoutParams(infoLp1);
    root.addView(info1);

    var info2 = new android.widget.TextView(context);
    info2.setText("该金额将计入存款贡献");
    info2.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 13);
    info2.setTextColor(android.graphics.Color.parseColor(COLORS.savings));
    info2.setGravity(android.view.Gravity.CENTER);
    var infoLp2 = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    infoLp2.bottomMargin = paddingDp(16);
    info2.setLayoutParams(infoLp2);
    root.addView(info2);

    // 按钮行
    var btnRow = new android.widget.LinearLayout(context);
    btnRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
    btnRow.setGravity(android.view.Gravity.END);
    var rowLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    btnRow.setLayoutParams(rowLp);

    var btnCancel = new android.widget.Button(context);
    btnCancel.setText("取消");
    //btnCancel.setBackgroundResource(android.R.attr.selectableItemBackground);
    var cancelLp = new android.widget.LinearLayout.LayoutParams(
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
    );
    cancelLp.rightMargin = paddingDp(8);
    btnCancel.setLayoutParams(cancelLp);
    btnRow.addView(btnCancel);

    var btnConfirm = new android.widget.Button(context);
    btnConfirm.setText("确认结转");
    //btnConfirm.setBackgroundResource(android.R.attr.selectableItemBackground);
    btnRow.addView(btnConfirm);

    root.addView(btnRow);

    var dlg = null;
    btnCancel.setOnClickListener(function() {
        if (dlg) dlg.dismiss();
    });

    btnConfirm.setOnClickListener(function() {
        if (dlg) dlg.dismiss();
        var success = DataManager.settleMonth();
        if (success) {
            toast("结转成功！");
            renderOverview();
            // 询问是否立即开启下月
            dialogs.build({
                title: "结转完成",
                content: "是否立即开启下月？",
                positive: "立即开启",
                negative: "稍后手动"
            }).on("positive", function() {
                var cur = DataManager.getCurrentMonth();
                var parts = cur.split("-");
                var year = parseInt(parts[0]);
                var month = parseInt(parts[1]);
                month++;
                if (month > 12) { month = 1; year++; }
                var nextKey = year + "-" + ("0" + month).slice(-2);
                DataManager.setCurrentMonth(nextKey);
                showNewMonthDialog(true);
            }).show();
        }
    });

    dlg = dialogs.build({
        customView: root,
        cancelable: true
    }).show();
}
