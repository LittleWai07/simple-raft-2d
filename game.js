// 木筏求生 2D - 游戏逻辑文件
// 游戏状态管理
const GameState = {
    RUNNING: 'running',
    PAUSED: 'paused',
    GAME_OVER: 'game_over',
    START_SCREEN: 'start_screen',
    PLACING: 'placing' // 新增：放置模式
};

// 游戏主对象
const Game = {
    canvas: null,
    ctx: null,
    state: GameState.START_SCREEN,
    lastTime: 0,
    deltaTime: 0,
    gameTime: 0,
    survivalTime: 0,
    difficulty: 'normal',
    
    // 游戏对象
    player: null,
    resources: [],
    raft: [],
    workstations: [],
    hooks: [],
    collectionNets: [], // 新增：物品收集网数组
    sharks: [], // 新增：鲨鱼数组
    inventory: [],
    tools: {},
    
    // 放置系统
    placingMode: {
        active: false,
        type: null, // 'raft', 'purifier', 'cookStation'
        ghostX: 0,
        ghostY: 0,
        isValid: false
    },
    
    // 游戏设置
    settings: {
        hungerRate: 0.004, // 稍微降低饥饿下降速度
        thirstRate: 0.006, // 稍微降低口渴下降速度
        oxygenConsumption: 0.2,
        oxygenRecovery: 1.0,
        waterRestore: 30,
        foodRestore: 40,
        craftingTime: 300,
        resourceSpawnRate: 0.02,
        maxResources: 15,
        dayNightCycle: 300, // 日夜循环周期（秒），5分钟一个完整循环
        nightResourceSpawnRate: 0.01 // 夜晚资源生成率降低
    },
    
    // 日夜系统
    dayNight: {
        time: 0, // 当前时间（0-1，0=午夜，0.5=正午）
        isNight: false,
        dayProgress: 0, // 0-1，表示当前日夜循环的进度
        stars: [] // 星星数组
    },
    
    // 统计数据
    stats: {
        health: 100,
        hunger: 100,
        thirst: 100,
        oxygen: 100,
        wood: 0,
        plastic: 0,
        leaf: 0,
        rope: 0, // 新增：绳子
        craftedItems: 0,
        totalResources: 0
    },
    
    // 初始化游戏
    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 设置画布尺寸
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // 初始化游戏对象
        this.initPlayer();
        this.initRaft();
        this.initInventory();
        this.initTools();
        
        // 设置默认难度为简单
        this.difficulty = 'easy';
        
        // 设置事件监听器
        this.setupEventListeners();
        
        // 开始游戏循环
        requestAnimationFrame((time) => this.gameLoop(time));
        
        console.log('游戏初始化完成');
    },
    
    // 调整画布尺寸
    resizeCanvas() {
        const container = document.getElementById('game-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    },
    
    // 初始化玩家
    initPlayer() {
        this.player = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            radius: 20,
            speed: 2.5, // 木筏上的速度稍微降低
            swimSpeed: 0.5, // 游泳时的极慢速度（几乎难以活动）
            velocity: { x: 0, y: 0 },
            color: '#e74c3c',
            isSwimming: false,
            isOnRaft: true,
            hasHook: false,
            hasFishingRod: false
        };
    },
    
    // 初始化木筏
    initRaft() {
        this.raft = [];
        const gridSize = 40;
        const centerX = Math.floor(this.canvas.width / 2 / gridSize);
        const centerY = Math.floor(this.canvas.height / 2 / gridSize);
        
        // 创建4x4初始木筏（更大）
        for (let x = centerX - 2; x <= centerX + 1; x++) {
            for (let y = centerY - 2; y <= centerY + 1; y++) {
                this.raft.push({
                    x: x * gridSize,
                    y: y * gridSize,
                    gridX: x,
                    gridY: y,
                    size: gridSize,
                    color: '#8b4513',
                    durability: 20, // 新增：木筏方块耐久度
                    maxDurability: 20
                });
            }
        }
    },
    
    // 初始化物品栏
    initInventory() {
        this.inventory = [
            { type: 'emptyCup', name: '空杯子', icon: 'glass-whiskey', count: 0, usable: false },
            { type: 'seaWaterCup', name: '海水杯', icon: 'tint', count: 0, usable: false },
            { type: 'cleanWaterCup', name: '淨水杯', icon: 'tint', count: 0, usable: true },
            { type: 'rawFish', name: '生魚', icon: 'fish', count: 0, usable: false },
            { type: 'cookedFish', name: '熟魚', icon: 'fish', count: 0, usable: true },
            // 建筑物品
            { type: 'raftPiece', name: '木筏方格', icon: 'th-large', count: 0, usable: true, isBuilding: true },
            { type: 'purifierItem', name: '淨水器', icon: 'filter', count: 0, usable: true, isBuilding: true },
            { type: 'cookStationItem', name: '烹飪站', icon: 'fire', count: 0, usable: true, isBuilding: true },
            { type: 'collectionNetItem', name: '物品收集網', icon: 'network-wired', count: 0, usable: true, isBuilding: true }
        ];
        this.updateInventoryUI();
    },
    
    // 初始化工具
    initTools() {
        this.tools = {
            hook: {
                name: '鉤子',
                durability: 20,
                maxDurability: 20,
                hasTool: true, // 玩家一开始就有一把钩子
                color: '#3498db'
            },
            fishingRod: {
                name: '釣魚竿',
                durability: 10,
                maxDurability: 10,
                hasTool: false,
                color: '#f39c12'
            }
        };
        this.updateToolsUI();
    },
    
    // 设置事件监听器
    setupEventListeners() {
        // 键盘控制
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // 鼠标控制
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        
        // 游戏控制按钮
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
        
        // 难度选择
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.difficulty = e.target.dataset.difficulty;
                this.updateDifficulty();
                this.updateDifficultyDetails();
            });
        });
        
        // 初始化难度详情显示
        this.updateDifficultyDetails();
        
        // 制作按钮
        document.querySelectorAll('.craft-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recipe = e.target.dataset.recipe;
                this.craftItem(recipe);
            });
        });
        
        // 物品栏点击
        document.getElementById('inventory-slots').addEventListener('click', (e) => {
            const slot = e.target.closest('.inventory-slot');
            if (slot) {
                const itemType = slot.dataset.item;
                this.useInventoryItem(itemType);
            }
        });
        
    },
    
    // 处理按键按下
    handleKeyDown(e) {
        // ESC键：取消放置模式
        if (e.key === 'Escape' && this.state === GameState.PLACING) {
            this.exitPlacingMode();
            this.updatePrompt('已取消放置模式。');
            return;
        }
        
        if (this.state !== GameState.RUNNING) return;
        
        // 根据是否游泳选择速度
        const currentSpeed = this.player.isSwimming ? this.player.swimSpeed : this.player.speed;
        
        switch(e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                this.player.velocity.y = -currentSpeed;
                break;
            case 's':
            case 'arrowdown':
                this.player.velocity.y = currentSpeed;
                break;
            case 'a':
            case 'arrowleft':
                this.player.velocity.x = -currentSpeed;
                break;
            case 'd':
            case 'arrowright':
                this.player.velocity.x = currentSpeed;
                break;
            case 'c':
                this.toggleCraftingMenu();
                break;
            case '1':
                this.quickAction(1);
                break;
            case '2':
                this.quickAction(2);
                break;
            case '3':
                this.quickAction(3);
                break;
            case '4':
                this.quickAction(4);
                break;
            case 'e':
                // E键触发actions面板中的第一个action（按键1）
                this.quickAction(1);
                break;
        }
    },
    
    // 处理按键释放
    handleKeyUp(e) {
        if (this.state !== GameState.RUNNING) return;
        
        switch(e.key.toLowerCase()) {
            case 'w':
            case 'arrowup':
                if (this.player.velocity.y < 0) this.player.velocity.y = 0;
                break;
            case 's':
            case 'arrowdown':
                if (this.player.velocity.y > 0) this.player.velocity.y = 0;
                break;
            case 'a':
            case 'arrowleft':
                if (this.player.velocity.x < 0) this.player.velocity.x = 0;
                break;
            case 'd':
            case 'arrowright':
                if (this.player.velocity.x > 0) this.player.velocity.x = 0;
                break;
        }
    },
    
    // 处理鼠标按下
    handleMouseDown(e) {
        if (this.state === GameState.PLACING) {
            // 放置模式：点击放置建筑
            this.placeBuilding();
            return;
        }
        
        if (this.state !== GameState.RUNNING) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // 发射钩子（添加安全检查）
        if (this.tools && this.tools.hook && this.tools.hook.hasTool && this.tools.hook.durability > 0) {
            this.shootHook(mouseX, mouseY);
        }
    },
    
    // 处理鼠标移动
    handleMouseMove(e) {
        if (this.state === GameState.PLACING) {
            // 放置模式：更新幽灵预览位置
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            this.updateGhostPreview(mouseX, mouseY);
        }
    },
    
    // 处理Canvas点击事件（显示木筏方块耐久度）
    handleCanvasClick(e) {
        if (this.state !== GameState.RUNNING) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // 检查是否点击了木筏方块
        for (const raftPiece of this.raft) {
            const dx = Math.abs(mouseX - (raftPiece.x + raftPiece.size / 2));
            const dy = Math.abs(mouseY - (raftPiece.y + raftPiece.size / 2));
            
            // 如果点击在木筏方块范围内
            if (dx < raftPiece.size / 2 && dy < raftPiece.size / 2) {
                // 显示木筏方块耐久度
                const durabilityPercent = Math.floor((raftPiece.durability / raftPiece.maxDurability) * 100);
                this.updatePrompt(`木筏方格耐久度：${raftPiece.durability}/${raftPiece.maxDurability} (${durabilityPercent}%)`);
                
                // 设置木筏方块显示耐久度标志
                raftPiece.showDurability = true;
                raftPiece.durabilityDisplayTime = 3; // 显示3秒
                
                return; // 找到点击的木筏方块后返回
            }
        }
    },
    
    // 切换制作菜单
    toggleCraftingMenu() {
        const craftingPanel = document.getElementById('crafting-panel');
        craftingPanel.classList.toggle('hidden');
        
        // 更新资源显示
        this.updateCraftingUI();
    },
    
    // 快捷操作
    quickAction(key) {
        // 获取actions面板中的所有action slots
        const actionSlots = document.querySelectorAll('.action-slot');
        
        // 查找匹配的按键
        for (const slot of actionSlots) {
            const slotKey = slot.dataset.key;
            if (slotKey === key.toString()) {
                // 找到匹配的action，执行对应的操作
                const actionId = parseInt(slot.dataset.action);
                
                // 根据actionId执行对应的操作
                switch(actionId) {
                    case 1:
                        this.getSeaWater();
                        break;
                    case 2:
                        this.purifyWater();
                        break;
                    case 3:
                        this.goFishing();
                        break;
                    case 4:
                        this.cookFish();
                        break;
                }
                return;
            }
        }
        
        // 如果没有找到匹配的action，显示提示
        this.updatePrompt(`沒有對應的快捷操作 ${key}。`);
    },
    
    // 获取海水
    getSeaWater() {
        // 检查是否有空杯子
        const emptyCup = this.inventory.find(item => item.type === 'emptyCup');
        if (!emptyCup || emptyCup.count === 0) {
            this.updatePrompt('沒有空杯子！需要先製作杯子。');
            return;
        }
        
        // 检查是否在木筏边缘
        if (!this.isAtRaftEdge()) {
            this.updatePrompt('需要到木筏邊緣才能獲取海水！');
            return;
        }
        
        // 将空杯子转换为海水杯
        emptyCup.count--;
        this.addToInventory('seaWaterCup', 1);
        this.updatePrompt('成功獲取海水！現在可以到淨水器旁淨化海水。');
    },
    
    // 净化海水
    purifyWater() {
        // 检查是否有海水杯
        const seaWaterCup = this.inventory.find(item => item.type === 'seaWaterCup');
        if (!seaWaterCup || seaWaterCup.count === 0) {
            this.updatePrompt('沒有海水杯！需要先獲取海水。');
            return;
        }
        
        // 检查是否碰到净水器（碰撞检测）
        let targetPurifier = null;
        for (const purifier of this.workstations) {
            if (purifier.type === 'purifier') {
                // 检查玩家与净水器的碰撞
                const playerLeft = this.player.x - this.player.radius;
                const playerRight = this.player.x + this.player.radius;
                const playerTop = this.player.y - this.player.radius;
                const playerBottom = this.player.y + this.player.radius;
                
                const purifierLeft = purifier.x - purifier.width / 2;
                const purifierRight = purifier.x + purifier.width / 2;
                const purifierTop = purifier.y - purifier.height / 2;
                const purifierBottom = purifier.y + purifier.height / 2;
                
                // 矩形碰撞检测
                if (playerRight > purifierLeft && 
                    playerLeft < purifierRight && 
                    playerBottom > purifierTop && 
                    playerTop < purifierBottom) {
                    targetPurifier = purifier;
                    break;
                }
            }
        }
        
        if (!targetPurifier) {
            this.updatePrompt('需要碰到淨水器才能放置海水杯進行淨化！');
            return;
        }
        
        // 开始净化
        if (targetPurifier.progress === 0) {
            targetPurifier.progress = this.settings.craftingTime;
            seaWaterCup.count--;
            targetPurifier.durability--;
            this.updatePrompt('開始淨化海水...需要等待一段時間。海水杯已消耗。');
            
            // 立即更新物品栏UI，确保海水杯不再显示
            this.updateInventoryUI();
            
            if (targetPurifier.durability <= 0) {
                this.updatePrompt('淨水器已損壞！需要建造新的淨水器。');
                // 移除损坏的净水器
                const index = this.workstations.indexOf(targetPurifier);
                if (index > -1) {
                    this.workstations.splice(index, 1);
                }
            }
        } else {
            this.updatePrompt('淨水器正在工作中，請稍候...');
        }
    },
    
    // 钓鱼
    goFishing() {
        // 检查是否有钓鱼竿（添加安全检查）
        if (!this.tools || !this.tools.fishingRod || !this.tools.fishingRod.hasTool || this.tools.fishingRod.durability <= 0) {
            this.updatePrompt('沒有可用的釣魚竿！需要先製作釣魚竿。');
            return;
        }
        
        // 检查是否在木筏边缘
        if (!this.isAtRaftEdge()) {
            this.updatePrompt('需要到木筏邊緣才能釣魚！');
            return;
        }
        
        // 检查是否已经在钓鱼中（防止重复触发）
        if (this.isFishing) {
            this.updatePrompt('正在釣魚中，請稍候...');
            return;
        }
        
        // 设置钓鱼状态
        this.isFishing = true;
        
        // 开始钓鱼
        this.tools.fishingRod.durability--;
        this.updatePrompt('開始釣魚...');
        
        // 模拟钓鱼过程
        setTimeout(() => {
            if (Math.random() > 0.3) { // 70%成功率
                this.addToInventory('rawFish', 1);
                this.updatePrompt('釣到生魚！可以到烹飪站烹飪。');
            } else {
                this.updatePrompt('這次沒有釣到魚，再試一次吧！');
            }
            
            // 更新工具UI
            this.updateToolsUI();
            
            // 重置钓鱼状态
            this.isFishing = false;
        }, 2000);
    },
    
    // 烹饪鱼
    cookFish() {
        // 检查是否有生鱼
        const rawFish = this.inventory.find(item => item.type === 'rawFish');
        if (!rawFish || rawFish.count === 0) {
            this.updatePrompt('沒有生魚！需要先釣魚。');
            return;
        }
        
        // 检查是否碰到烹饪站（碰撞检测）
        let targetCookStation = null;
        for (const cookStation of this.workstations) {
            if (cookStation.type === 'cookStation') {
                // 检查玩家与烹饪站的碰撞
                const playerLeft = this.player.x - this.player.radius;
                const playerRight = this.player.x + this.player.radius;
                const playerTop = this.player.y - this.player.radius;
                const playerBottom = this.player.y + this.player.radius;
                
                const cookStationLeft = cookStation.x - cookStation.width / 2;
                const cookStationRight = cookStation.x + cookStation.width / 2;
                const cookStationTop = cookStation.y - cookStation.height / 2;
                const cookStationBottom = cookStation.y + cookStation.height / 2;
                
                // 矩形碰撞检测
                if (playerRight > cookStationLeft && 
                    playerLeft < cookStationRight && 
                    playerBottom > cookStationTop && 
                    playerTop < cookStationBottom) {
                    targetCookStation = cookStation;
                    break;
                }
            }
        }
        
        if (!targetCookStation) {
            this.updatePrompt('需要碰到烹飪站才能放置生魚進行烹飪！');
            return;
        }
        
        // 开始烹饪
        if (targetCookStation.progress === 0) {
            targetCookStation.progress = this.settings.craftingTime;
            rawFish.count--;
            targetCookStation.durability--;
            this.updatePrompt('開始烹飪魚...需要等待一段時間。生魚已消耗。');
            
            // 立即更新物品栏UI，确保生鱼不再显示
            this.updateInventoryUI();
            
            if (targetCookStation.durability <= 0) {
                this.updatePrompt('烹飪站已損壞！需要建造新的烹飪站。');
                // 移除损坏的烹饪站
                const index = this.workstations.indexOf(targetCookStation);
                if (index > -1) {
                    this.workstations.splice(index, 1);
                }
            }
        } else {
            this.updatePrompt('烹飪站正在工作中，請稍候...');
        }
    },
    
    // 检查是否在木筏边缘
    isAtRaftEdge() {
        if (!this.player.isOnRaft) return false;
        
        // 简单实现：检查玩家是否靠近木筏边界
        const edgeThreshold = 50;
        for (const raftPiece of this.raft) {
            const dx = Math.abs(this.player.x - (raftPiece.x + raftPiece.size / 2));
            const dy = Math.abs(this.player.y - (raftPiece.y + raftPiece.size / 2));
            
            // 如果玩家靠近木筏方格的边缘
            if (dx > raftPiece.size / 2 - edgeThreshold || dy > raftPiece.size / 2 - edgeThreshold) {
                return true;
            }
        }
        return false;
    },
    
    
    // 发射钩子
    shootHook(targetX, targetY) {
        if (this.tools.hook.durability <= 0) return;
        
        // 检查是否已经有钩子存在（在钩子收回前，不能再扔出钩子）
        if (this.hooks.length > 0) {
            this.updatePrompt('鉤子尚未收回，請等待鉤子收回後再發射！');
            return;
        }
        
        // 计算方向（从玩家到鼠标位置）
        const dx = targetX - this.player.x;
        const dy = targetY - this.player.y;
        const distanceToMouse = Math.sqrt(dx * dx + dy * dy);
        
        // 计算方向单位向量
        const directionX = dx / distanceToMouse;
        const directionY = dy / distanceToMouse;
        
        // 钩子总是飞到最大距离（300像素），不受鼠标位置限制
        const maxDistance = 300;
        const finalTargetX = this.player.x + directionX * maxDistance;
        const finalTargetY = this.player.y + directionY * maxDistance;
        
        const hook = {
            x: this.player.x,
            y: this.player.y,
            targetX: finalTargetX,
            targetY: finalTargetY,
            speed: 6.5, // 稍微提高钩子速度，从5提高到6.5
            radius: 5,
            color: '#3498db',
            distance: 0,
            maxDistance: maxDistance,
            returning: false,
            hasResources: false, // 改为复数，表示可能有多个资源
            resources: [], // 存储多个资源
            durabilityUsed: false // 标记是否已经扣除耐久度
        };
        
        this.hooks.push(hook);
        // 注意：这里不扣除耐久度，只有在成功收集资源时才扣除
        this.updateToolsUI();
    },
    
    // 制作物品
    craftItem(recipe) {
        const recipes = {
            rope: { leaf: 2, result: 'rope' }, // 新增：绳子合成配方
            raft: { wood: 1, plastic: 1, rope: 1, result: 'raftPiece' }, // 修改：使用绳子
            hook: { plastic: 2, rope: 1, result: 'hook' }, // 修改：使用绳子
            cup: { plastic: 2, result: 'emptyCup' },
            purifier: { plastic: 2, wood: 1, rope: 1, result: 'purifierItem' }, // 修改：使用绳子
            fishingRod: { wood: 1, rope: 1, result: 'fishingRod' }, // 修改：使用绳子
            cookStation: { wood: 2, rope: 1, result: 'cookStationItem' }, // 修改：使用绳子
            collectionNet: { rope: 6, wood: 2, result: 'collectionNetItem' } // 新增：物品收集网
        };
        
        const recipeData = recipes[recipe];
        if (!recipeData) return;
        
        // 检查资源是否足够
        if (recipeData.wood && this.stats.wood < recipeData.wood) {
            this.updatePrompt(`木頭不足！需要 ${recipeData.wood} 個，當前只有 ${this.stats.wood} 個`);
            return;
        }
        if (recipeData.plastic && this.stats.plastic < recipeData.plastic) {
            this.updatePrompt(`塑膠不足！需要 ${recipeData.plastic} 個，當前只有 ${this.stats.plastic} 個`);
            return;
        }
        if (recipeData.leaf && this.stats.leaf < recipeData.leaf) {
            this.updatePrompt(`樹葉不足！需要 ${recipeData.leaf} 個，當前只有 ${this.stats.leaf} 個`);
            return;
        }
        if (recipeData.rope && this.stats.rope < recipeData.rope) {
            this.updatePrompt(`繩子不足！需要 ${recipeData.rope} 個，當前只有 ${this.stats.rope} 個`);
            return;
        }
        
        // 消耗资源
        if (recipeData.wood) this.stats.wood -= recipeData.wood;
        if (recipeData.plastic) this.stats.plastic -= recipeData.plastic;
        if (recipeData.leaf) this.stats.leaf -= recipeData.leaf;
        if (recipeData.rope) this.stats.rope -= recipeData.rope;
        
        // 制作物品
        switch(recipeData.result) {
            case 'rope':
                this.stats.rope++;
                this.updatePrompt('成功製作繩子！');
                break;
            case 'raftPiece':
                this.addToInventory('raftPiece', 1);
                this.updatePrompt('成功製作木筏方格！已添加到物品欄中，點擊物品欄中的木筏方格可以放置。');
                break;
            case 'hook':
                this.tools.hook.hasTool = true;
                this.tools.hook.durability = this.tools.hook.maxDurability;
                this.updatePrompt('成功製作鉤子！');
                break;
            case 'emptyCup':
                this.addToInventory('emptyCup', 1);
                this.updatePrompt('成功製作杯子！');
                break;
            case 'purifierItem':
                this.addToInventory('purifierItem', 1);
                this.updatePrompt('成功製作淨水器！已添加到物品欄中，點擊物品欄中的淨水器可以放置。');
                break;
            case 'fishingRod':
                this.tools.fishingRod.hasTool = true;
                this.tools.fishingRod.durability = this.tools.fishingRod.maxDurability;
                this.updatePrompt('成功製作釣魚竿！');
                break;
            case 'cookStationItem':
                this.addToInventory('cookStationItem', 1);
                this.updatePrompt('成功製作烹飪站！已添加到物品欄中，點擊物品欄中的烹飪站可以放置。');
                break;
            case 'collectionNetItem':
                this.addToInventory('collectionNetItem', 1);
                this.updatePrompt('成功製作物品收集網！已添加到物品欄中，點擊物品欄中的收集網可以放置。');
                break;
        }
        
        this.stats.craftedItems++;
        this.updateStatsUI();
        this.updateCraftingUI();
        this.updateToolsUI();
        this.updateInventoryUI();
    },
    
    // 扩展木筏（手动放置版本）
    expandRaft(gridX, gridY) {
        const gridSize = 40;
        
        // 检查是否已经存在木筏方块
        const existingRaft = this.raft.find(piece => 
            piece.gridX === gridX && piece.gridY === gridY);
        
        if (existingRaft) {
            // 如果已经存在木筏方块，恢复其耐久度（除非已经是满耐久）
            if (existingRaft.durability < existingRaft.maxDurability) {
                existingRaft.durability = existingRaft.maxDurability;
                this.updatePrompt('成功修復木筏方格！耐久度已恢復至滿值。');
            } else {
                this.updatePrompt('木筏方格已經是滿耐久度，無法再次修復。');
            }
        } else {
            // 添加新的木筏方格
            this.raft.push({
                x: gridX * gridSize,
                y: gridY * gridSize,
                gridX: gridX,
                gridY: gridY,
                size: gridSize,
                color: '#8b4513',
                durability: 20, // 新增：木筏方块耐久度
                maxDurability: 20
            });
            
            this.updatePrompt('成功放置木筏方格！');
        }
    },
    
    // 检查连锁反应（当木筏方块被破坏时调用）
    checkChainReaction() {
        // 检查所有工作站是否在木筏之上
        for (let i = this.workstations.length - 1; i >= 0; i--) {
            const workstation = this.workstations[i];
            let isOnRaft = false;
            
            // 检查工作站是否在木筏上
            for (const raftPiece of this.raft) {
                const dx = Math.abs(workstation.x - (raftPiece.x + raftPiece.size / 2));
                const dy = Math.abs(workstation.y - (raftPiece.y + raftPiece.size / 2));
                
                if (dx < raftPiece.size / 2 && dy < raftPiece.size / 2) {
                    isOnRaft = true;
                    break;
                }
            }
            
            // 如果工作站不在木筏上，则破坏它
            if (!isOnRaft) {
                this.workstations.splice(i, 1);
                this.updatePrompt('工作站因失去木筏支撐而損壞！');
            }
        }
        
        // 检查所有收集网是否在木筏之上或与木筏相邻
        for (let i = this.collectionNets.length - 1; i >= 0; i--) {
            const net = this.collectionNets[i];
            let isSupported = false;
            
            // 检查收集网是否在木筏上
            for (const raftPiece of this.raft) {
                const dx = Math.abs(net.x - raftPiece.x);
                const dy = Math.abs(net.y - raftPiece.y);
                
                // 如果收集网与木筏方块完全对齐（网格对齐）
                if (dx < 1 && dy < 1) {
                    isSupported = true;
                    break;
                }
            }
            
            // 如果收集网不在木筏上，检查是否与木筏相邻
            if (!isSupported) {
                const gridSize = 40;
                const netGridX = Math.round(net.x / gridSize);
                const netGridY = Math.round(net.y / gridSize);
                
                const directions = [
                    { x: 0, y: -1 }, // 上
                    { x: 1, y: 0 },  // 右
                    { x: 0, y: 1 },  // 下
                    { x: -1, y: 0 }  // 左
                ];
                
                for (const dir of directions) {
                    const adjacentGridX = netGridX + dir.x;
                    const adjacentGridY = netGridY + dir.y;
                    
                    // 检查是否与木筏相邻
                    const hasAdjacentRaft = this.raft.some(piece => 
                        piece.gridX === adjacentGridX && piece.gridY === adjacentGridY);
                    
                    if (hasAdjacentRaft) {
                        isSupported = true;
                        break;
                    }
                }
            }
            
            // 如果收集网没有支撑，则破坏它
            if (!isSupported) {
                this.collectionNets.splice(i, 1);
                this.updatePrompt('物品收集網因失去支撐而損壞！');
            }
        }
    },
    
    // 建造工作站（手动放置版本）
    buildWorkstation(type, x, y) {
        const workstation = {
            type: type,
            x: x,
            y: y,
            width: 35, // 减小到35x35，不超过木筏方块的大小（40x40）
            height: 35,
            progress: 0,
            durability: 12, // 缩短耐久度：从15减少到12
            maxDurability: 12,
            color: type === 'purifier' ? '#3498db' : '#e74c3c'
        };
        
        this.workstations.push(workstation);
        this.updatePrompt(`成功建造 ${type === 'purifier' ? '淨水器' : '烹飪站'}！`);
    },
    
    // 建造物品收集网
    buildCollectionNet(x, y) {
        const net = {
            type: 'collectionNet',
            x: x, // 左上角X坐标（与木筏方块对齐）
            y: y, // 左上角Y坐标（与木筏方块对齐）
            width: 40, // 修改：与木筏方块大小一致（40x40）
            height: 40,
            color: '#9b59b6', // 紫色
            durability: 15, // 新增：收集网耐久度
            maxDurability: 15,
            collectedResources: [] // 存储收集到的资源
        };
        
        this.collectionNets.push(net);
        this.updatePrompt('成功建造物品收集網！如果有海上漂流物經過這個收集網，網便能卡住物品收集起來。');
    },
    
    // 使用物品栏物品
    useInventoryItem(itemType) {
        const item = this.inventory.find(item => item.type === itemType);
        if (!item || item.count === 0 || !item.usable) return;
        
        switch(itemType) {
            case 'cleanWaterCup':
                this.stats.thirst = Math.min(100, this.stats.thirst + this.settings.waterRestore);
                item.count--;
                // 水杯喝完后变回空杯子
                this.addToInventory('emptyCup', 1);
                this.updatePrompt('飲用淨水，口渴度恢復！空杯子已回收。');
                break;
            case 'cookedFish':
                this.stats.hunger = Math.min(100, this.stats.hunger + this.settings.foodRestore);
                item.count--;
                this.updatePrompt('食用熟魚，飢餓度恢復！');
                break;
            case 'raftPiece':
            case 'purifierItem':
            case 'cookStationItem':
            case 'collectionNetItem':
                // 建筑物品：进入放置模式（不立即减少物品数量）
                if (item.count > 0) {
                    let placingType = '';
                    switch(itemType) {
                        case 'raftPiece':
                            placingType = 'raft';
                            break;
                        case 'purifierItem':
                            placingType = 'purifier';
                            break;
                        case 'cookStationItem':
                            placingType = 'cookStation';
                            break;
                        case 'collectionNetItem':
                            placingType = 'collectionNet';
                            break;
                    }
                    this.startPlacingMode(placingType);
                }
                break;
        }
        
        this.updateStatsUI();
        this.updateInventoryUI();
    },
    
    // 添加到物品栏
    addToInventory(itemType, count = 1) {
        const item = this.inventory.find(item => item.type === itemType);
        if (item) {
            item.count += count;
            this.updateInventoryUI();
        }
    },
    
    // 生成资源
    spawnResource() {
        if (this.resources.length >= this.settings.maxResources) return;
        
        if (Math.random() < this.settings.resourceSpawnRate) {
            const types = ['wood', 'plastic', 'leaf'];
            const type = types[Math.floor(Math.random() * types.length)];
            
            const colors = {
                wood: '#8b4513',
                plastic: '#1abc9c',
                leaf: '#27ae60'
            };
            
            // 从屏幕边缘生成
            const side = Math.floor(Math.random() * 4);
            let x, y;
            
            switch(side) {
                case 0: // 上
                    x = Math.random() * this.canvas.width;
                    y = -20;
                    break;
                case 1: // 右
                    x = this.canvas.width + 20;
                    y = Math.random() * this.canvas.height;
                    break;
                case 2: // 下
                    x = Math.random() * this.canvas.width;
                    y = this.canvas.height + 20;
                    break;
                case 3: // 左
                    x = -20;
                    y = Math.random() * this.canvas.height;
                    break;
            }
            
            const resource = {
                x: x,
                y: y,
                radius: 15,
                type: type,
                color: colors[type],
                speed: 0.5 + Math.random() * 1.5,
                direction: Math.random() * Math.PI * 2
            };
            
            this.resources.push(resource);
        }
    },
    
    // 生成鲨鱼（确保玩家能看到鲨鱼）
    spawnShark() {
        // 限制鲨鱼数量（最多2只）
        if (this.sharks.length >= 2) return;
        
        // 游戏开始后的保护期：前10秒不生成鲨鱼
        if (this.gameTime < 10) return;
        
        // 鲨鱼生成率：每秒有30%机会生成一只鲨鱼（大幅提高生成率）
        if (Math.random() < 0.3 * this.deltaTime) {
            // 从屏幕边缘生成鲨鱼
            const side = Math.floor(Math.random() * 4);
            let x, y;
            
            switch(side) {
                case 0: // 上
                    x = Math.random() * this.canvas.width;
                    y = -50;
                    break;
                case 1: // 右
                    x = this.canvas.width + 50;
                    y = Math.random() * this.canvas.height;
                    break;
                case 2: // 下
                    x = Math.random() * this.canvas.width;
                    y = this.canvas.height + 50;
                    break;
                case 3: // 左
                    x = -50;
                    y = Math.random() * this.canvas.height;
                    break;
            }
            
            const shark = {
                x: x,
                y: y,
                radius: 25, // 鲨鱼比玩家大
                speed: 1.5, // 鲨鱼速度比玩家游泳速度快
                color: '#2c3e50', // 深灰色
                targetX: this.player.x, // 初始目标为玩家位置
                targetY: this.player.y,
                attackCooldown: 0, // 攻击玩家冷却时间
                raftAttackCooldown: 0, // 攻击木筏冷却时间（3分钟）
                damage: 10, // 每次攻击造成的伤害
                direction: 0, // 新增：鲨鱼面向方向（弧度）
                lastX: x, // 新增：上一帧的X位置
                lastY: y  // 新增：上一帧的Y位置
            };
            
            this.sharks.push(shark);
            this.updatePrompt('鯊魚出現！小心！');
        }
    },
    
    // 更新鲨鱼
    updateSharks() {
        for (let i = this.sharks.length - 1; i >= 0; i--) {
            const shark = this.sharks[i];
            
            // 更新攻击冷却时间
            if (shark.attackCooldown > 0) {
                shark.attackCooldown -= this.deltaTime;
            }
            
            // 更新攻击木筏冷却时间
            if (shark.raftAttackCooldown > 0) {
                shark.raftAttackCooldown -= this.deltaTime;
            }
            
            // 如果鲨鱼正在游走（攻击玩家后），更新游走时间
            if (shark.isFleeing) {
                shark.fleeTime -= this.deltaTime;
                if (shark.fleeTime <= 0) {
                    shark.isFleeing = false;
                }
            }
            
            // 设置鲨鱼目标
            if (shark.isFleeing) {
                // 如果鲨鱼正在游走，保持随机目标
                // 不需要更新目标，保持攻击时设置的随机目标
            } else if (!this.player.isSwimming) {
                // 如果玩家在木筏上，鲨鱼会随机游动
                // 只有当鲨鱼到达当前目标或随机概率时，才更新目标
                const dx = shark.targetX - shark.x;
                const dy = shark.targetY - shark.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 如果鲨鱼已经到达目标位置，或者随机概率，才更新目标
                if (distance < 10 || Math.random() < 0.01) {
                    shark.targetX = Math.random() * this.canvas.width;
                    shark.targetY = Math.random() * this.canvas.height;
                }
            } else {
                // 如果玩家下水，鲨鱼会慢慢游向玩家
                shark.targetX = this.player.x;
                shark.targetY = this.player.y;
            }
            
            // 计算方向
            const dx = shark.targetX - shark.x;
            const dy = shark.targetY - shark.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 移动鲨鱼
            if (distance > 0) {
                // 计算移动方向（弧度）
                shark.direction = Math.atan2(dy, dx);
                
                shark.x += (dx / distance) * shark.speed;
                shark.y += (dy / distance) * shark.speed;
            } else {
                // 当鲨鱼不移动时，保持当前方向不变
                // 不更新shark.direction
            }
            
            // 检查鲨鱼与玩家的碰撞（攻击玩家）
            // 只有当玩家下水时，鲨鱼才能攻击玩家
            if (this.player.isSwimming) {
                const playerDx = this.player.x - shark.x;
                const playerDy = this.player.y - shark.y;
                const playerDistance = Math.sqrt(playerDx * playerDx + playerDy * playerDy);
                
                if (playerDistance < this.player.radius + shark.radius && shark.attackCooldown <= 0) {
                    // 根据难度调整鲨鱼攻击伤害（提升50%）
                    let damage = 15; // 默认伤害
                    switch(this.difficulty) {
                        case 'easy':
                            damage = 12; // 简单难度：从8点提升到12点（提升50%）
                            break;
                        case 'normal':
                            damage = 15; // 普通难度：从10点提升到15点（提升50%）
                            break;
                        case 'hard':
                            damage = 22; // 困难难度：从15点提升到22点（提升约47%，取整）
                            break;
                    }
                    
                    // 鲨鱼攻击玩家
                    this.stats.health = Math.max(0, this.stats.health - damage);
                    
                    // 根据难度设置攻击冷却时间
                    let attackCooldown = 5; // 默认简单难度
                    switch(this.difficulty) {
                        case 'easy':
                            attackCooldown = 5; // 简单难度：5秒冷却时间
                            break;
                        case 'normal':
                            attackCooldown = 4; // 普通难度：4秒冷却时间
                            break;
                        case 'hard':
                            attackCooldown = 3; // 困难难度：3秒冷却时间
                            break;
                    }
                    shark.attackCooldown = attackCooldown;
                    
                    // 攻击后鲨鱼游走（设置随机目标，并标记为正在游走）
                    shark.targetX = Math.random() * this.canvas.width;
                    shark.targetY = Math.random() * this.canvas.height;
                    shark.isFleeing = true; // 标记鲨鱼正在游走
                    shark.fleeTime = 2.0; // 游走时间2秒
                    
                    this.updatePrompt(`鯊魚攻擊！生命值減少 ${damage} 點！鯊魚攻擊後游走，${attackCooldown}秒後會再次攻擊。`);
                    this.updateStatsUI();
                }
            }
            
                // 检查鲨鱼与木筏方块的碰撞（造成耐久度耗损）
                for (let j = this.raft.length - 1; j >= 0; j--) {
                    const raftPiece = this.raft[j];
                    const raftDx = Math.abs(shark.x - (raftPiece.x + raftPiece.size / 2));
                    const raftDy = Math.abs(shark.y - (raftPiece.y + raftPiece.size / 2));
                    
                    // 如果鲨鱼经过木筏方块
                    if (raftDx < raftPiece.size / 2 + shark.radius && raftDy < raftPiece.size / 2 + shark.radius) {
                        // 检查鲨鱼的攻击木筏冷却时间（根据难度调整）
                        if (shark.raftAttackCooldown <= 0) {
                                // 25%机率对木筏方块造成耐久度耗损
                                if (Math.random() < 0.25) {
                                    // 根据难度随机减少耐久度
                                    let minDamage = 1;
                                    let maxDamage = 3;
                                    
                                    switch(this.difficulty) {
                                        case 'easy':
                                            minDamage = 1;
                                            maxDamage = 3; // 1-3点
                                            break;
                                        case 'normal':
                                            minDamage = 3;
                                            maxDamage = 5; // 3-5点
                                            break;
                                        case 'hard':
                                            minDamage = 5;
                                            maxDamage = 7; // 5-7点
                                            break;
                                    }
                                    
                                    const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
                                    raftPiece.durability -= damage;
                                    
                                    // 根据难度设置冷却时间（进一步缩短）
                                    let cooldownTime = 15; // 默认简单难度
                                    switch(this.difficulty) {
                                        case 'easy':
                                            cooldownTime = 15; // 从20秒缩短到15秒
                                            break;
                                        case 'normal':
                                            cooldownTime = 10; // 从12秒缩短到10秒
                                            break;
                                        case 'hard':
                                            cooldownTime = 6; // 从8秒缩短到6秒
                                            break;
                                    }
                                    shark.raftAttackCooldown = cooldownTime;
                                    
                                    // 检查木筏方块耐久度是否归零
                                    if (raftPiece.durability <= 0) {
                                        // 木筏方块被破坏移除
                                        this.raft.splice(j, 1);
                                        this.updatePrompt('木筏方格被鯊魚破壞！');
                                        // 检查连锁反应
                                        this.checkChainReaction();
                                    } else {
                                        // 显示耐久度减少提示
                                        this.updatePrompt(`木筏方格受到攻擊！耐久度減少 ${damage} 點，當前耐久度：${raftPiece.durability}/${raftPiece.maxDurability}`);
                                    }
                                }
                        }
                    }
                }
            
            // 边界检查（如果鲨鱼移出屏幕，移除它）
            if (shark.x < -100 || shark.x > this.canvas.width + 100 ||
                shark.y < -100 || shark.y > this.canvas.height + 100) {
                this.sharks.splice(i, 1);
            }
        }
    },
    
    
    // 检查玩家是否在木筏上
    checkPlayerOnRaft() {
        this.player.isOnRaft = false;
        
        // 检查是否在木筏上
        for (const raftPiece of this.raft) {
            const dx = this.player.x - (raftPiece.x + raftPiece.size / 2);
            const dy = this.player.y - (raftPiece.y + raftPiece.size / 2);
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.player.radius + raftPiece.size / 2) {
                this.player.isOnRaft = true;
                break;
            }
        }
        
        // 如果不在木筏上，检查是否在收集网上
        if (!this.player.isOnRaft) {
            for (const net of this.collectionNets) {
                const dx = Math.abs(this.player.x - (net.x + net.width / 2));
                const dy = Math.abs(this.player.y - (net.y + net.height / 2));
                
                // 如果玩家在收集网范围内
                if (dx < net.width / 2 + this.player.radius && dy < net.height / 2 + this.player.radius) {
                    this.player.isOnRaft = true;
                    break;
                }
            }
        }
        
        // 更新游泳状态和颜色
        const wasSwimming = this.player.isSwimming;
        this.player.isSwimming = !this.player.isOnRaft;
        this.player.color = this.player.isSwimming ? '#3498db' : '#e74c3c';
        
        // 如果游泳状态发生变化，调整当前速度
        if (wasSwimming !== this.player.isSwimming) {
            this.adjustPlayerVelocity();
        }
    },
    
    // 调整玩家速度（当游泳状态变化时调用）
    adjustPlayerVelocity() {
        const currentSpeed = this.player.isSwimming ? this.player.swimSpeed : this.player.speed;
        
        // 调整当前速度方向的大小
        if (this.player.velocity.x !== 0 || this.player.velocity.y !== 0) {
            const magnitude = Math.sqrt(this.player.velocity.x * this.player.velocity.x + this.player.velocity.y * this.player.velocity.y);
            if (magnitude > 0) {
                const ratio = currentSpeed / magnitude;
                this.player.velocity.x *= ratio;
                this.player.velocity.y *= ratio;
            }
        }
    },
    
    // 更新日夜系统
    updateDayNight() {
        // 更新日夜时间（0-1循环）
        this.dayNight.time = (this.gameTime % this.settings.dayNightCycle) / this.settings.dayNightCycle;
        
        // 计算日夜进度（0=午夜，0.5=正午）
        this.dayNight.dayProgress = Math.sin(this.dayNight.time * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
        
        // 判断是否是夜晚（夜晚时间为0.25-0.75）
        this.dayNight.isNight = this.dayNight.time > 0.25 && this.dayNight.time < 0.75;
        
        // 夜晚时生成星星
        if (this.dayNight.isNight && this.dayNight.stars.length < 50 && Math.random() < 0.01) {
            this.generateStar();
        }
        
        // 更新星星位置（轻微移动）
        for (let i = this.dayNight.stars.length - 1; i >= 0; i--) {
            const star = this.dayNight.stars[i];
            star.y += star.speed * this.deltaTime;
            
            // 如果星星移出屏幕，移除它
            if (star.y > this.canvas.height + 10) {
                this.dayNight.stars.splice(i, 1);
            }
        }
    },
    
    // 生成星星
    generateStar() {
        const star = {
            x: Math.random() * this.canvas.width,
            y: -10,
            radius: Math.random() * 2 + 1,
            brightness: Math.random() * 0.5 + 0.5,
            speed: Math.random() * 20 + 10,
            twinkleSpeed: Math.random() * 2 + 1
        };
        this.dayNight.stars.push(star);
    },
    
    // 更新生存指标
    updateStats() {
        // 饥饿和口渴下降
        this.stats.hunger = Math.max(0, this.stats.hunger - this.settings.hungerRate);
        this.stats.thirst = Math.max(0, this.stats.thirst - this.settings.thirstRate);
        
        // 氧气管理
        if (this.player.isSwimming) {
            this.stats.oxygen = Math.max(0, this.stats.oxygen - this.settings.oxygenConsumption);
        } else {
            this.stats.oxygen = Math.min(100, this.stats.oxygen + this.settings.oxygenRecovery);
        }
        
        // 生命值管理
        if (this.stats.hunger <= 0 || this.stats.thirst <= 0 || this.stats.oxygen <= 0) {
            this.stats.health = Math.max(0, this.stats.health - 0.1);
        } else if (this.stats.health < 100 && this.stats.hunger >= 90 && this.stats.thirst >= 90) {
            // 只有当饥饿值和口渴值都达到90%以上时才恢复生命值
            this.stats.health = Math.min(100, this.stats.health + 0.05);
        }
        
        // 更新UI
        this.updateStatsUI();
    },
    
    // 更新资源位置
    updateResources() {
        for (let i = this.resources.length - 1; i >= 0; i--) {
            const resource = this.resources[i];
            
            // 移动资源
            resource.x += Math.cos(resource.direction) * resource.speed;
            resource.y += Math.sin(resource.direction) * resource.speed;
            
            // 检查资源是否经过收集网
            for (let j = this.collectionNets.length - 1; j >= 0; j--) {
                const net = this.collectionNets[j];
                const dx = Math.abs(resource.x - net.x);
                const dy = Math.abs(resource.y - net.y);
                
                // 如果资源在收集网范围内（增加容错范围，让资源更容易被收集）
                // 使用资源半径作为容错范围，让资源只要靠近收集网就能被收集
                const tolerance = resource.radius * 2; // 增加容错范围
                if (dx < net.width / 2 + tolerance && dy < net.height / 2 + tolerance) {
                    // 收集网收集资源，消耗耐久度
                    net.collectedResources.push(resource);
                    net.durability--;
                    this.resources.splice(i, 1);
                    this.updatePrompt(`物品收集網收集到 ${resource.type === 'wood' ? '木頭' : resource.type === 'plastic' ? '塑膠' : '樹葉'}！`);
                    
                    // 检查收集网耐久度是否归零
                    if (net.durability <= 0) {
                        // 耐久度归零，收集网损坏
                        this.destroyCollectionNet(j);
                    }
                    break; // 资源已被收集，跳出循环
                }
            }
            
            // 边界检查（如果资源还在数组中）
            if (i < this.resources.length) {
                if (resource.x < -50 || resource.x > this.canvas.width + 50 ||
                    resource.y < -50 || resource.y > this.canvas.height + 50) {
                    this.resources.splice(i, 1);
                }
            }
        }
    },
    
    // 更新钩子
    updateHooks() {
        for (let i = this.hooks.length - 1; i >= 0; i--) {
            const hook = this.hooks[i];
            
            if (hook.returning) {
                // 返回玩家
                const dx = this.player.x - hook.x;
                const dy = this.player.y - hook.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 在钩子回收时也检查与资源的碰撞
                for (let j = this.resources.length - 1; j >= 0; j--) {
                    const resource = this.resources[j];
                    const resourceDx = hook.x - resource.x;
                    const resourceDy = hook.y - resource.y;
                    const resourceDistance = Math.sqrt(resourceDx * resourceDx + resourceDy * resourceDy);
                    
                    // 增加碰撞检测的容错范围（增加5像素的容错）
                    const collisionThreshold = hook.radius + resource.radius + 5;
                    
                    if (resourceDistance < collisionThreshold) {
                        // 收集资源
                        hook.hasResources = true;
                        hook.resources.push(resource);
                        this.resources.splice(j, 1);
                    }
                }
                
                if (distance < hook.speed) {
                    // 钩子回到玩家
                    if (hook.hasResources && hook.resources.length > 0) {
                        // 只有在成功收集资源时才扣除耐久度，且只扣除一次
                        if (!hook.durabilityUsed) {
                            this.tools.hook.durability--;
                            hook.durabilityUsed = true;
                            this.updateToolsUI();
                        }
                        // 收集所有资源
                        this.collectMultipleResources(hook.resources);
                    }
                    this.hooks.splice(i, 1);
                    continue;
                }
                
                hook.x += (dx / distance) * hook.speed;
                hook.y += (dy / distance) * hook.speed;
            } else {
                // 飞向目标
                const dx = hook.targetX - hook.x;
                const dy = hook.targetY - hook.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                hook.distance += hook.speed;
                
                if (distance < hook.speed || hook.distance > hook.maxDistance) {
                    hook.returning = true;
                    continue;
                }
                
                hook.x += (dx / distance) * hook.speed;
                hook.y += (dy / distance) * hook.speed;
                
                // 检查与资源的碰撞（可以收集多个资源）
                for (let j = this.resources.length - 1; j >= 0; j--) {
                    const resource = this.resources[j];
                    const dx = hook.x - resource.x;
                    const dy = hook.y - resource.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // 增加碰撞检测的容错范围（增加5像素的容错）
                    const collisionThreshold = hook.radius + resource.radius + 5;
                    
                    if (distance < collisionThreshold) {
                        // 收集资源，但不立即返回
                        hook.hasResources = true;
                        hook.resources.push(resource);
                        this.resources.splice(j, 1);
                        // 注意：不设置hook.returning = true，让钩子继续飞行
                    }
                }
            }
        }
    },
    
    // 更新工作站
    updateWorkstations() {
        for (const workstation of this.workstations) {
            if (workstation.progress > 0) {
                workstation.progress--;
                if (workstation.progress === 0) {
                    // 工作站完成工作
                    if (workstation.type === 'purifier') {
                        this.addToInventory('cleanWaterCup', 1);
                        this.updatePrompt('淨水完成！海水杯已回收，獲得淡水杯！');
                    } else if (workstation.type === 'cookStation') {
                        this.addToInventory('cookedFish', 1);
                        this.updatePrompt('烹飪完成！');
                    }
                }
            }
        }
    },
    
    // 收集单个资源
    collectResource(resource) {
        switch(resource.type) {
            case 'wood':
                this.stats.wood++;
                break;
            case 'plastic':
                this.stats.plastic++;
                break;
            case 'leaf':
                this.stats.leaf++;
                break;
        }
        
        this.stats.totalResources++;
        this.updatePrompt(`收集到 ${resource.type === 'wood' ? '木頭' : resource.type === 'plastic' ? '塑膠' : '樹葉'}！`);
        this.updateStatsUI();
        this.updateCraftingUI();
        this.updateInventoryUI(); // 更新物品栏显示
    },
    
    // 收集多个资源
    collectMultipleResources(resources) {
        if (!resources || resources.length === 0) return;
        
        let woodCount = 0;
        let plasticCount = 0;
        let leafCount = 0;
        
        for (const resource of resources) {
            switch(resource.type) {
                case 'wood':
                    woodCount++;
                    this.stats.wood++;
                    break;
                case 'plastic':
                    plasticCount++;
                    this.stats.plastic++;
                    break;
                case 'leaf':
                    leafCount++;
                    this.stats.leaf++;
                    break;
            }
            this.stats.totalResources++;
        }
        
        // 生成收集消息
        let message = '收集到：';
        const parts = [];
        if (woodCount > 0) parts.push(`${woodCount}個木頭`);
        if (plasticCount > 0) parts.push(`${plasticCount}個塑膠`);
        if (leafCount > 0) parts.push(`${leafCount}個樹葉`);
        
        message += parts.join('、');
        message += '！';
        
        this.updatePrompt(message);
        this.updateStatsUI();
        this.updateCraftingUI();
        this.updateInventoryUI();
    },
    
    // 销毁收集网（耐久度归零时调用）
    destroyCollectionNet(index) {
        const net = this.collectionNets[index];
        
        // 返还所有收集到的物品到玩家物品栏
        if (net.collectedResources.length > 0) {
            for (const resource of net.collectedResources) {
                this.collectResource(resource);
            }
            this.updatePrompt(`物品收集網已損壞！所有收集到的物品已自動返回到玩家物品欄中。`);
        } else {
            this.updatePrompt(`物品收集網已損壞！`);
        }
        
        // 移除收集网
        this.collectionNets.splice(index, 1);
    },
    
    // 检查碰撞
    checkCollisions() {
        // 玩家与资源碰撞
        for (let i = this.resources.length - 1; i >= 0; i--) {
            const resource = this.resources[i];
            const dx = this.player.x - resource.x;
            const dy = this.player.y - resource.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.player.radius + resource.radius) {
                this.collectResource(resource);
                this.resources.splice(i, 1);
            }
        }
        
        // 玩家与收集网碰撞（取回收集到的物品）
        for (let i = this.collectionNets.length - 1; i >= 0; i--) {
            const net = this.collectionNets[i];
            const dx = Math.abs(this.player.x - net.x);
            const dy = Math.abs(this.player.y - net.y);
            
            // 如果玩家在收集网范围内
            if (dx < net.width / 2 + this.player.radius && dy < net.height / 2 + this.player.radius) {
                // 检查收集网中是否有收集到的物品
                if (net.collectedResources.length > 0) {
                    // 取回所有收集到的物品
                    for (const resource of net.collectedResources) {
                        this.collectResource(resource);
                    }
                    
                    // 清空收集网
                    net.collectedResources = [];
                    this.updatePrompt(`從物品收集網中取回所有收集到的物品！`);
                }
            }
        }
    },
    
    // 检查游戏结束
    checkGameOver() {
        if (this.stats.health <= 0) {
            this.state = GameState.GAME_OVER;
            this.showGameOverScreen();
        }
    },
    
    // 渲染游戏
    render() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 检查是否有生存指标低于30%
        const isCritical = this.stats.health < 30 || this.stats.hunger < 30 || 
                          this.stats.thirst < 30 || this.stats.oxygen < 30;
        
        // 保存当前上下文状态
        this.ctx.save();
        
        // 如果处于危险状态，应用灰阶滤镜
        if (isCritical) {
            // 计算灰阶强度（指标越低，灰阶越强）
            const healthFactor = Math.max(0, (30 - this.stats.health) / 30);
            const hungerFactor = Math.max(0, (30 - this.stats.hunger) / 30);
            const thirstFactor = Math.max(0, (30 - this.stats.thirst) / 30);
            const oxygenFactor = Math.max(0, (30 - this.stats.oxygen) / 30);
            
            // 使用最严重的指标作为灰阶强度
            const maxFactor = Math.max(healthFactor, hungerFactor, thirstFactor, oxygenFactor);
            
            // 应用灰阶滤镜（0% = 正常，100% = 完全灰阶）
            const grayscaleAmount = Math.min(100, maxFactor * 100);
            this.ctx.filter = `grayscale(${grayscaleAmount}%)`;
        }
        
        // 绘制海洋背景
        this.drawOcean();
        
        // 绘制资源（在木筏下方，从木筏底部飘过）
        this.drawResources();
        
        // 绘制鲨鱼（在木筏下方）
        this.drawSharks();
        
        // 绘制木筏
        this.drawRaft();
        
        // 绘制工作站
        this.drawWorkstations();
        
        // 绘制物品收集网
        this.drawCollectionNets();
        
        // 绘制钩子
        this.drawHooks();
        
        // 绘制玩家
        this.drawPlayer();
        
        // 绘制氧气泡泡（如果游泳）
        if (this.player.isSwimming) {
            this.drawOxygenBubbles();
        }
        
        // 绘制幽灵预览（如果在放置模式）
        this.drawGhostPreview();
        
        // 恢复上下文状态（移除滤镜）
        this.ctx.restore();
        
        // 如果处于危险状态，在屏幕边缘添加红色警告效果
        if (isCritical) {
            this.drawWarningEffect();
        }
    },
    
    // 绘制警告效果
    drawWarningEffect() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        
        // 计算警告强度（基于最严重的指标）
        const healthFactor = Math.max(0, (30 - this.stats.health) / 30);
        const hungerFactor = Math.max(0, (30 - this.stats.hunger) / 30);
        const thirstFactor = Math.max(0, (30 - this.stats.thirst) / 30);
        const oxygenFactor = Math.max(0, (30 - this.stats.oxygen) / 30);
        const maxFactor = Math.max(healthFactor, hungerFactor, thirstFactor, oxygenFactor);
        
        // 警告强度（0-1）
        const warningIntensity = maxFactor;
        
        // 只在强度较高时显示警告效果
        if (warningIntensity > 0.3) {
            // 红色边框效果
            ctx.strokeStyle = `rgba(231, 76, 60, ${0.3 + warningIntensity * 0.4})`;
            ctx.lineWidth = 10 + warningIntensity * 20;
            ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
            
            // 闪烁效果（基于游戏时间）
            const blink = Math.sin(this.gameTime * 0.01) > 0 ? 1 : 0;
            if (blink > 0) {
                // 屏幕边缘红色渐变
                const gradient = ctx.createRadialGradient(
                    canvas.width / 2, canvas.height / 2, 0,
                    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 2
                );
                gradient.addColorStop(0, 'rgba(231, 76, 60, 0)');
                gradient.addColorStop(0.8, 'rgba(231, 76, 60, 0)');
                gradient.addColorStop(1, `rgba(231, 76, 60, ${0.1 * warningIntensity})`);
                
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
    },
    
    // 绘制海洋
    drawOcean() {
        // 根据日夜时间计算海洋颜色
        const dayProgress = this.dayNight.dayProgress; // 0=午夜，1=正午
        
        // 白天颜色（蓝色）
        const dayColorTop = '#1e3c72';
        const dayColorBottom = '#2a5298';
        
        // 夜晚颜色（深蓝色/黑色）
        const nightColorTop = '#0a1931';
        const nightColorBottom = '#1a1a2e';
        
        // 根据日夜进度混合颜色（白天亮，夜晚暗）
        const colorTop = this.mixColors(dayColorTop, nightColorTop, 1 - dayProgress);
        const colorBottom = this.mixColors(dayColorBottom, nightColorBottom, 1 - dayProgress);
        
        // 海洋渐变背景
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, colorTop);
        gradient.addColorStop(1, colorBottom);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制波浪（夜晚时波浪更暗）
        const waveAlpha = 0.05 + (1 - dayProgress) * 0.05; // 白天0.1，夜晚0.05
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${waveAlpha})`;
        this.ctx.lineWidth = 2;
        
        for (let i = 0; i < 5; i++) {
            this.ctx.beginPath();
            const y = 100 + i * 80 + Math.sin(this.gameTime * 0.001 + i) * 10;
            this.ctx.moveTo(0, y);
            
            for (let x = 0; x < this.canvas.width; x += 20) {
                const waveY = y + Math.sin(x * 0.01 + this.gameTime * 0.002 + i) * 10;
                this.ctx.lineTo(x, waveY);
            }
            
            this.ctx.stroke();
        }
        
        // 绘制星星（夜晚）
        this.drawStars();
        
        // 绘制月亮（夜晚）
        this.drawMoon();
    },
    
    // 混合颜色
    mixColors(color1, color2, weight) {
        // 将颜色从十六进制转换为RGB
        const r1 = parseInt(color1.slice(1, 3), 16);
        const g1 = parseInt(color1.slice(3, 5), 16);
        const b1 = parseInt(color1.slice(5, 7), 16);
        
        const r2 = parseInt(color2.slice(1, 3), 16);
        const g2 = parseInt(color2.slice(3, 5), 16);
        const b2 = parseInt(color2.slice(5, 7), 16);
        
        // 混合颜色
        const r = Math.round(r1 * weight + r2 * (1 - weight));
        const g = Math.round(g1 * weight + g2 * (1 - weight));
        const b = Math.round(b1 * weight + b2 * (1 - weight));
        
        // 将RGB转换回十六进制
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    },
    
    // 调整颜色亮度
    adjustColorBrightness(color, brightness) {
        // 将颜色从十六进制转换为RGB
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        
        // 调整亮度
        const newR = Math.min(255, Math.max(0, Math.round(r * brightness)));
        const newG = Math.min(255, Math.max(0, Math.round(g * brightness)));
        const newB = Math.min(255, Math.max(0, Math.round(b * brightness)));
        
        // 将RGB转换回十六进制
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    },
    
    // 绘制星星
    drawStars() {
        if (!this.dayNight.isNight) return;
        
        for (const star of this.dayNight.stars) {
            // 星星闪烁效果
            const twinkle = Math.sin(this.gameTime * star.twinkleSpeed) * 0.3 + 0.7;
            const brightness = star.brightness * twinkle;
            
            this.ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            this.ctx.fill();
        }
    },
    
    // 绘制月亮
    drawMoon() {
        if (!this.dayNight.isNight) return;
        
        const ctx = this.ctx;
        const canvas = this.canvas;
        
        // 月亮位置（在天空右上角）
        const moonX = canvas.width - 100;
        const moonY = 100;
        const moonRadius = 30;
        
        // 绘制月亮
        ctx.fillStyle = '#f5f5f5';
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 月亮阴影（月相效果）
        const phase = Math.sin(this.dayNight.time * Math.PI * 2) * 0.5 + 0.5; // 0-1
        const shadowX = moonX + (phase - 0.5) * moonRadius * 1.5;
        
        ctx.fillStyle = this.mixColors('#0a1931', '#1a1a2e', 0.5);
        ctx.beginPath();
        ctx.arc(shadowX, moonY, moonRadius * 0.9, 0, Math.PI * 2);
        ctx.fill();
        
        // 月亮光晕
        const gradient = ctx.createRadialGradient(
            moonX, moonY, moonRadius,
            moonX, moonY, moonRadius * 2
        );
        gradient.addColorStop(0, 'rgba(245, 245, 245, 0.3)');
        gradient.addColorStop(1, 'rgba(245, 245, 245, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius * 2, 0, Math.PI * 2);
        ctx.fill();
    },
    
    // 绘制木筏
    drawRaft() {
        for (const raftPiece of this.raft) {
            // 根据耐久度百分比调整颜色深浅（耐久度越低，颜色越浅）
            const durabilityPercent = raftPiece.durability / raftPiece.maxDurability;
            
            // 基础颜色（深棕色）
            const baseColor = '#8b4513';
            
            // 根据耐久度调整颜色亮度（耐久度越低，颜色越浅）
            // 耐久度100%：正常亮度（1.0）
            // 耐久度50%：中等亮度（1.5）
            // 耐久度0%：很亮（2.0）
            const durabilityBrightness = 1.0 + (1.0 - durabilityPercent); // 1.0到2.0之间
            
            // 根据日夜时间调整木筏亮度（白天亮，夜晚暗）
            const dayNightBrightness = (1 - this.dayNight.dayProgress) * 0.7 + 0.3; // 白天1.0，夜晚0.3
            
            // 综合亮度（耐久度亮度 × 日夜亮度）
            const totalBrightness = durabilityBrightness * dayNightBrightness;
            
            // 调整颜色亮度
            const color = this.adjustColorBrightness(baseColor, totalBrightness);
            
            this.ctx.fillStyle = color;
            this.ctx.fillRect(raftPiece.x, raftPiece.y, raftPiece.size, raftPiece.size);
            
            // 木筏纹理（根据耐久度和日夜时间调整亮度）
            const textureBrightness = durabilityPercent * dayNightBrightness * 0.8 + 0.2; // 耐久度越低，纹理越暗
            this.ctx.strokeStyle = `rgba(93, 41, 6, ${textureBrightness})`;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(raftPiece.x, raftPiece.y, raftPiece.size, raftPiece.size);
            
            // 木筏内部线条
            this.ctx.beginPath();
            this.ctx.moveTo(raftPiece.x + raftPiece.size / 2, raftPiece.y);
            this.ctx.lineTo(raftPiece.x + raftPiece.size / 2, raftPiece.y + raftPiece.size);
            this.ctx.moveTo(raftPiece.x, raftPiece.y + raftPiece.size / 2);
            this.ctx.lineTo(raftPiece.x + raftPiece.size, raftPiece.y + raftPiece.size / 2);
            this.ctx.stroke();
            
            // 在木筏方块上显示耐久度百分比（可选，用于调试）
            // this.ctx.fillStyle = '#fff';
            // this.ctx.font = '10px Arial';
            // this.ctx.textAlign = 'center';
            // this.ctx.textBaseline = 'middle';
            // this.ctx.fillText(`${Math.floor(durabilityPercent * 100)}%`, 
            //                   raftPiece.x + raftPiece.size / 2, 
            //                   raftPiece.y + raftPiece.size / 2);
        }
    },
    
    // 绘制工作站
    drawWorkstations() {
        for (const workstation of this.workstations) {
            // 根据日夜时间调整工作站亮度（白天亮，夜晚暗）
            const brightness = (1 - this.dayNight.dayProgress) * 0.7 + 0.3; // 白天1.0，夜晚0.3
            const color = this.adjustColorBrightness(workstation.color, brightness);
            
            this.ctx.fillStyle = color;
            this.ctx.fillRect(
                workstation.x - workstation.width / 2,
                workstation.y - workstation.height / 2,
                workstation.width,
                workstation.height
            );
            
            // 工作站边框（根据日夜时间调整亮度）
            const borderBrightness = (1 - this.dayNight.dayProgress) * 0.8 + 0.2; // 白天1.0，夜晚0.2
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${borderBrightness})`;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(
                workstation.x - workstation.width / 2,
                workstation.y - workstation.height / 2,
                workstation.width,
                workstation.height
            );
            
            // 进度条
            if (workstation.progress > 0) {
                const progressWidth = (workstation.width - 10) * (1 - workstation.progress / this.settings.craftingTime);
                this.ctx.fillStyle = '#2ecc71';
                this.ctx.fillRect(
                    workstation.x - workstation.width / 2 + 5,
                    workstation.y + workstation.height / 2 + 10,
                    progressWidth,
                    5
                );
            }
            
            // 耐久条
            const durabilityWidth = (workstation.width - 10) * (workstation.durability / workstation.maxDurability);
            this.ctx.fillStyle = durabilityWidth > 0.5 ? '#2ecc71' : durabilityWidth > 0.25 ? '#f39c12' : '#e74c3c';
            this.ctx.fillRect(
                workstation.x - workstation.width / 2 + 5,
                workstation.y + workstation.height / 2 + 20,
                durabilityWidth,
                5
            );
        }
    },
    
    // 绘制物品收集网
    drawCollectionNets() {
        for (const net of this.collectionNets) {
            // 根据日夜时间调整收集网亮度（白天亮，夜晚暗）
            const brightness = (1 - this.dayNight.dayProgress) * 0.7 + 0.3; // 白天1.0，夜晚0.3
            const color = this.adjustColorBrightness(net.color, brightness);
            
            // 绘制收集网（网状结构）
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2;
            this.ctx.fillStyle = `rgba(52, 152, 219, 0.2)`;
            
            // 绘制收集网边框（使用左上角坐标，与木筏方块对齐）
            this.ctx.strokeRect(
                net.x,
                net.y,
                net.width,
                net.height
            );
            
            // 绘制网状结构
            const gridSize = 8; // 修改：网格大小调整为8（40/5=8）
            for (let i = 0; i <= net.width / gridSize; i++) {
                const x = net.x + i * gridSize;
                this.ctx.beginPath();
                this.ctx.moveTo(x, net.y);
                this.ctx.lineTo(x, net.y + net.height);
                this.ctx.stroke();
            }
            
            for (let i = 0; i <= net.height / gridSize; i++) {
                const y = net.y + i * gridSize;
                this.ctx.beginPath();
                this.ctx.moveTo(net.x, y);
                this.ctx.lineTo(net.x + net.width, y);
                this.ctx.stroke();
            }
            
            // 显示收集到的物品数量
            if (net.collectedResources.length > 0) {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.beginPath();
                this.ctx.arc(net.x + net.width / 2, net.y - 15, 12, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(net.collectedResources.length.toString(), net.x + net.width / 2, net.y - 15);
            }
            
            // 显示收集网耐久度条
            const durabilityWidth = (net.width - 10) * (net.durability / net.maxDurability);
            this.ctx.fillStyle = durabilityWidth > 0.5 ? '#2ecc71' : durabilityWidth > 0.25 ? '#f39c12' : '#e74c3c';
            this.ctx.fillRect(
                net.x + 5,
                net.y + net.height + 5,
                durabilityWidth,
                5
            );
        }
    },
    
    // 绘制资源
    drawResources() {
        for (const resource of this.resources) {
            // 根据日夜时间调整亮度（白天亮，夜晚暗）
            const brightness = (1 - this.dayNight.dayProgress) * 0.7 + 0.3; // 白天1.0，夜晚0.3
            const color = this.adjustColorBrightness(resource.color, brightness);
            
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(resource.x, resource.y, resource.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 资源边框（根据日夜时间调整亮度）
            const borderBrightness = (1 - this.dayNight.dayProgress) * 0.8 + 0.2; // 白天1.0，夜晚0.2
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${borderBrightness})`;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    },
    
    // 绘制钩子
    drawHooks() {
        for (const hook of this.hooks) {
            // 根据日夜时间调整钩子亮度（白天亮，夜晚暗）
            const brightness = (1 - this.dayNight.dayProgress) * 0.7 + 0.3; // 白天1.0，夜晚0.3
            const color = this.adjustColorBrightness(hook.color, brightness);
            
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(this.player.x, this.player.y);
            this.ctx.lineTo(hook.x, hook.y);
            this.ctx.stroke();
            
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(hook.x, hook.y, hook.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 绘制钩子携带的多个资源
            if (hook.hasResources && hook.resources.length > 0) {
                // 绘制资源堆叠效果
                const resourceCount = hook.resources.length;
                const maxResourcesToShow = 3; // 最多显示3个资源
                
                for (let i = 0; i < Math.min(resourceCount, maxResourcesToShow); i++) {
                    const resource = hook.resources[i];
                    const angle = (i * Math.PI * 2) / Math.min(resourceCount, maxResourcesToShow);
                    const offsetX = Math.cos(angle) * (hook.radius + 8);
                    const offsetY = Math.sin(angle) * (hook.radius + 8);
                    
                    // 根据日夜时间调整资源亮度（白天亮，夜晚暗）
                    const resourceBrightness = (1 - this.dayNight.dayProgress) * 0.7 + 0.3; // 白天1.0，夜晚0.3
                    const resourceColor = this.adjustColorBrightness(resource.color, resourceBrightness);
                    
                    this.ctx.fillStyle = resourceColor;
                    this.ctx.beginPath();
                    this.ctx.arc(hook.x + offsetX, hook.y + offsetY, 8, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // 资源边框（根据日夜时间调整亮度）
                    const borderBrightness = (1 - this.dayNight.dayProgress) * 0.8 + 0.2; // 白天1.0，夜晚0.2
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${borderBrightness})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();
                }
                
                // 如果资源超过3个，显示数字
                if (resourceCount > maxResourcesToShow) {
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    this.ctx.beginPath();
                    this.ctx.arc(hook.x, hook.y, hook.radius + 12, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    this.ctx.fillStyle = '#fff';
                    this.ctx.font = '10px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText(`+${resourceCount - maxResourcesToShow}`, hook.x, hook.y);
                }
            }
        }
    },
    
    // 绘制玩家
    drawPlayer() {
        // 根据日夜时间调整玩家亮度（白天亮，夜晚暗）
        const brightness = (1 - this.dayNight.dayProgress) * 0.7 + 0.3; // 白天1.0，夜晚0.3
        const playerColor = this.adjustColorBrightness(this.player.color, brightness);
        
        this.ctx.fillStyle = playerColor;
        this.ctx.beginPath();
        this.ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 玩家边框（根据日夜时间调整亮度）
        const borderBrightness = (1 - this.dayNight.dayProgress) * 0.8 + 0.2; // 白天1.0，夜晚0.2
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${borderBrightness})`;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        
        // 玩家眼睛（根据日夜时间调整亮度）
        const eyeBrightness = (1 - this.dayNight.dayProgress) * 0.9 + 0.1; // 白天1.0，夜晚0.1
        this.ctx.fillStyle = `rgba(255, 255, 255, ${eyeBrightness})`;
        this.ctx.beginPath();
        this.ctx.arc(this.player.x - 5, this.player.y - 5, 4, 0, Math.PI * 2);
        this.ctx.arc(this.player.x + 5, this.player.y - 5, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(this.player.x - 5, this.player.y - 5, 2, 0, Math.PI * 2);
        this.ctx.arc(this.player.x + 5, this.player.y - 5, 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 玩家嘴巴
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(this.player.x, this.player.y + 5, 6, 0, Math.PI);
        this.ctx.stroke();
    },
    
    // 绘制鲨鱼（根据移动方向旋转）
    drawSharks() {
        for (const shark of this.sharks) {
            // 根据日夜时间调整鲨鱼亮度（白天亮，夜晚暗）
            const brightness = (1 - this.dayNight.dayProgress) * 0.7 + 0.3; // 白天1.0，夜晚0.3
            const sharkColor = this.adjustColorBrightness(shark.color, brightness);
            
            // 保存当前上下文状态
            this.ctx.save();
            
            // 将画布原点移动到鲨鱼位置
            this.ctx.translate(shark.x, shark.y);
            
            // 根据移动方向旋转画布（使鲨鱼面向移动方向）
            // 注意：鲨鱼的默认方向是向右（x轴正方向），所以不需要额外调整
            this.ctx.rotate(shark.direction);
            
            // 绘制鲨鱼身体（现在以原点为中心）
            this.ctx.fillStyle = sharkColor;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, shark.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 鲨鱼边框（根据日夜时间调整亮度）
            const borderBrightness = (1 - this.dayNight.dayProgress) * 0.8 + 0.2; // 白天1.0，夜晚0.2
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${borderBrightness})`;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            
            // 绘制鲨鱼鳍（现在以原点为中心）
            this.ctx.fillStyle = sharkColor;
            
            // 背鳍（在鲨鱼背部）
            this.ctx.beginPath();
            this.ctx.moveTo(0, -shark.radius);
            this.ctx.lineTo(shark.radius * 0.8, -shark.radius * 1.5);
            this.ctx.lineTo(-shark.radius * 0.8, -shark.radius * 1.5);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 尾鳍（在鲨鱼尾部，面向移动方向）
            this.ctx.beginPath();
            this.ctx.moveTo(-shark.radius, 0); // 修改：尾鳍在鲨鱼尾部（与移动方向相反）
            this.ctx.lineTo(-shark.radius * 1.5, -shark.radius * 0.5);
            this.ctx.lineTo(-shark.radius * 1.5, shark.radius * 0.5);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 绘制鲨鱼眼睛（在鲨鱼头部，面向移动方向）
            const eyeBrightness = (1 - this.dayNight.dayProgress) * 0.9 + 0.1; // 白天1.0，夜晚0.1
            this.ctx.fillStyle = `rgba(255, 255, 255, ${eyeBrightness})`;
            this.ctx.beginPath();
            this.ctx.arc(shark.radius * 0.5, -shark.radius * 0.3, shark.radius * 0.3, 0, Math.PI * 2); // 修改：眼睛在鲨鱼头部（x轴正方向）
            this.ctx.fill();
            
            this.ctx.fillStyle = '#000';
            this.ctx.beginPath();
            this.ctx.arc(shark.radius * 0.5, -shark.radius * 0.3, shark.radius * 0.15, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 绘制鲨鱼嘴巴（在鲨鱼头部，面向移动方向）
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(shark.radius * 0.5, 0, shark.radius * 0.4, 0, Math.PI); // 修改：嘴巴在鲨鱼头部（x轴正方向）
            this.ctx.stroke();
            
            // 恢复上下文状态
            this.ctx.restore();
        }
    },
    
    // 绘制氧气泡泡
    drawOxygenBubbles() {
        const bubbleCount = Math.floor(this.stats.oxygen / 10);
        
        for (let i = 0; i < bubbleCount; i++) {
            const angle = this.gameTime * 0.005 + i * 0.5;
            const distance = 30 + Math.sin(this.gameTime * 0.01 + i) * 5;
            const x = this.player.x + Math.cos(angle) * distance;
            const y = this.player.y + Math.sin(angle) * distance;
            const radius = 3 + Math.sin(this.gameTime * 0.02 + i) * 1;
            
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fill();
        }
    },
    
    // 游戏主循环
    gameLoop(currentTime) {
        // 计算时间增量（以秒为单位）
        if (this.lastTime === 0) {
            this.lastTime = currentTime;
        }
        this.deltaTime = (currentTime - this.lastTime) / 1000; // 转换为秒
        this.lastTime = currentTime;
        
        // 限制deltaTime，防止游戏卡顿时的巨大跳跃
        if (this.deltaTime > 0.1) {
            this.deltaTime = 0.1;
        }
        
        // 更新游戏状态
        this.update();
        
        // 渲染游戏
        this.render();
        
        // 继续游戏循环
        requestAnimationFrame((time) => this.gameLoop(time));
    },
    
    // 开始游戏
    startGame() {
        this.state = GameState.RUNNING;
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('crafting-panel').classList.add('hidden');
        
        // 根据难度调整设置
        this.updateDifficulty();
        
        // 重置游戏时间
        this.gameTime = 0;
        this.survivalTime = 0;
        
        // 设置游戏开始时间（用于鲨鱼生成保护期）
        this.gameStartTime = 0;
        
        this.updatePrompt('遊戲開始！收集資源，擴建木筏，生存下去！');
    },
    
    // 重新开始游戏
    restartGame() {
        // 重置游戏状态
        this.state = GameState.START_SCREEN;
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('start-screen').classList.remove('hidden');
        
        // 重置统计数据
        this.stats = {
            health: 100,
            hunger: 100,
            thirst: 100,
            oxygen: 100,
            wood: 0,
            plastic: 0,
            leaf: 0,
            rope: 0, // 新增：绳子
            craftedItems: 0,
            totalResources: 0
        };
        
        // 重置游戏对象
        this.resources = [];
        this.hooks = [];
        this.workstations = [];
        this.sharks = []; // 重置鲨鱼数组
        this.gameTime = 0; // 重置游戏时间
        this.survivalTime = 0; // 重置生存时间
        this.initPlayer();
        this.initRaft();
        this.initInventory();
        this.initTools();
        
        // 更新UI
        this.updateStatsUI();
        this.updateCraftingUI();
        this.updateInventoryUI();
        this.updateToolsUI();
        
        this.updatePrompt('遊戲已重置，準備開始新的生存挑戰！');
    },
    
    // 显示游戏结束画面
    showGameOverScreen() {
        document.getElementById('game-over-screen').classList.remove('hidden');
        
        // 更新游戏统计
        const minutes = Math.floor(this.survivalTime / 60);
        const seconds = Math.floor(this.survivalTime % 60);
        document.getElementById('survival-time').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('total-resources').textContent = this.stats.totalResources;
        
        // 显示木筏方块数量（直接显示木筏数组的长度）
        const raftPieceCount = this.raft.length;
        document.getElementById('raft-size').textContent = `${raftPieceCount}`;
        
        document.getElementById('crafted-items').textContent = this.stats.craftedItems;
    },
    
    // 更新难度设置
    updateDifficulty() {
        switch(this.difficulty) {
            case 'easy':
                this.settings.hungerRate = 0.003;
                this.settings.thirstRate = 0.005;
                this.settings.oxygenConsumption = 0.075; // 减慢：从0.15减少到0.075（减少50%）
                this.settings.resourceSpawnRate = 0.035; // 提高：从0.03提高到0.035
                break;
            case 'normal':
                this.settings.hungerRate = 0.005;
                this.settings.thirstRate = 0.007;
                this.settings.oxygenConsumption = 0.1; // 减慢：从0.2减少到0.1（减少50%）
                this.settings.resourceSpawnRate = 0.025; // 提高：从0.02提高到0.025
                break;
            case 'hard':
                this.settings.hungerRate = 0.007;
                this.settings.thirstRate = 0.009;
                this.settings.oxygenConsumption = 0.125; // 减慢：从0.25减少到0.125（减少50%）
                this.settings.resourceSpawnRate = 0.018; // 提高：从0.015提高到0.018
                break;
        }
    },
    
    // 更新难度详情显示
    updateDifficultyDetails() {
        const detailsElement = document.getElementById('difficulty-details');
        if (!detailsElement) return;
        
        let title = '';
        let details = [];
        
        switch(this.difficulty) {
            case 'easy':
                title = '難度詳情：簡單';
                details = [
                    '飢餓下降速度：慢',
                    '口渴下降速度：慢',
                    '氧氣消耗速度：慢',
                    '資源生成率：高',
                    '適合新手玩家'
                ];
                break;
            case 'normal':
                title = '難度詳情：普通';
                details = [
                    '飢餓下降速度：中等',
                    '口渴下降速度：中等',
                    '氧氣消耗速度：中等',
                    '資源生成率：正常',
                    '適合有經驗的玩家'
                ];
                break;
            case 'hard':
                title = '難度詳情：困難';
                details = [
                    '飢餓下降速度：快',
                    '口渴下降速度：快',
                    '氧氣消耗速度：快',
                    '資源生成率：低',
                    '適合尋求挑戰的玩家'
                ];
                break;
        }
        
        // 更新标题
        const titleElement = detailsElement.querySelector('h4');
        if (titleElement) {
            titleElement.innerHTML = `<i class="fas fa-info-circle"></i> ${title}`;
        }
        
        // 更新详情列表
        const listElement = detailsElement.querySelector('ul');
        if (listElement) {
            listElement.innerHTML = '';
            details.forEach(detail => {
                const li = document.createElement('li');
                li.textContent = detail;
                listElement.appendChild(li);
            });
        }
    },
    
    // 更新提示文本（添加自动隐藏功能）
    updatePrompt(text) {
        const promptElement = document.getElementById('prompt-text');
        const actionPrompts = document.getElementById('action-prompts');
        
        // 更新文本
        promptElement.textContent = text;
        
        // 显示消息框
        actionPrompts.classList.remove('hidden');
        actionPrompts.style.opacity = '1';
        
        // 清除之前的定时器（如果有）
        if (this.promptTimer) {
            clearTimeout(this.promptTimer);
        }
        
        // 设置3秒后自动隐藏
        this.promptTimer = setTimeout(() => {
            actionPrompts.style.opacity = '0';
            
            // 等待淡出动画完成后隐藏
            setTimeout(() => {
                actionPrompts.classList.add('hidden');
            }, 500); // 匹配CSS过渡时间
        }, 3000); // 3秒后开始淡出
    },
    
    // 更新生存指标UI
    updateStatsUI() {
        // 更新数值
        document.getElementById('health-value').textContent = Math.floor(this.stats.health);
        document.getElementById('hunger-value').textContent = Math.floor(this.stats.hunger);
        document.getElementById('thirst-value').textContent = Math.floor(this.stats.thirst);
        document.getElementById('oxygen-value').textContent = Math.floor(this.stats.oxygen);
        
        // 更新进度条宽度（颜色由CSS固定）
        document.getElementById('health-bar').style.width = `${this.stats.health}%`;
        document.getElementById('hunger-bar').style.width = `${this.stats.hunger}%`;
        document.getElementById('thirst-bar').style.width = `${this.stats.thirst}%`;
        document.getElementById('oxygen-bar').style.width = `${this.stats.oxygen}%`;
    },
    
    // 更新进度条颜色
    updateBarColor(barId, value) {
        const bar = document.getElementById(barId);
        if (value > 50) {
            bar.style.backgroundColor = '#2ecc71'; // 绿色
        } else if (value > 25) {
            bar.style.backgroundColor = '#f39c12'; // 黄色
        } else {
            bar.style.backgroundColor = '#e74c3c'; // 红色
        }
    },
    
    // 更新制作UI
    updateCraftingUI() {
        // 注意：资源数量现在只显示在物品栏中，这里不再更新
        
        // 更新制作按钮状态
        const recipes = {
            rope: { leaf: 2 }, // 新增：绳子合成配方
            raft: { wood: 1, plastic: 1, rope: 1 }, // 修改：使用绳子
            hook: { plastic: 2, rope: 1 }, // 修改：使用绳子
            cup: { plastic: 2 },
            purifier: { plastic: 2, wood: 1, rope: 1 }, // 修改：使用绳子
            fishingRod: { wood: 1, rope: 1 }, // 修改：使用绳子
            cookStation: { wood: 2, rope: 1 }, // 修改：使用绳子
            collectionNet: { rope: 6, wood: 2 } // 新增：物品收集网
        };
        
        document.querySelectorAll('.craft-btn').forEach(btn => {
            const recipe = btn.dataset.recipe;
            const recipeData = recipes[recipe];
            let canCraft = true;
            
            if (recipeData && recipeData.wood && this.stats.wood < recipeData.wood) canCraft = false;
            if (recipeData && recipeData.plastic && this.stats.plastic < recipeData.plastic) canCraft = false;
            if (recipeData && recipeData.leaf && this.stats.leaf < recipeData.leaf) canCraft = false;
            if (recipeData && recipeData.rope && this.stats.rope < recipeData.rope) canCraft = false;
            
            btn.disabled = !canCraft;
            btn.textContent = canCraft ? '製作' : '資源不足';
        });
    },
    
    // 更新物品栏UI
    updateInventoryUI() {
        const inventorySlots = document.getElementById('inventory-slots');
        inventorySlots.innerHTML = '';
        
        // 添加资源显示到物品栏 - 只显示数量大于0的资源
        const resources = [
            { type: 'wood', name: '木頭', icon: 'tree', count: this.stats.wood },
            { type: 'plastic', name: '塑膠', icon: 'recycle', count: this.stats.plastic },
            { type: 'leaf', name: '樹葉', icon: 'leaf', count: this.stats.leaf },
            { type: 'rope', name: '繩子', icon: 'link', count: this.stats.rope } // 新增：绳子
        ];
        
        // 先显示资源（只显示数量大于0的）
        for (const resource of resources) {
            if (resource.count === 0) continue; // 跳过数量为0的资源
            
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.item = resource.type;
            
            slot.innerHTML = `
                <i class="fas fa-${resource.icon}"></i>
                <div class="slot-name">${resource.name}</div>
                <div class="slot-count">${resource.count}</div>
            `;
            
            inventorySlots.appendChild(slot);
        }
        
        // 显示工具（钩子和钓鱼竿）- 添加安全检查
        if (this.tools && this.tools.hook && this.tools.hook.hasTool && this.tools.hook.durability > 0) {
            const durabilityPercent = (this.tools.hook.durability / this.tools.hook.maxDurability) * 100;
            const durabilityColor = durabilityPercent > 50 ? '#2ecc71' : durabilityPercent > 25 ? '#f39c12' : '#e74c3c';
            
            const slot = document.createElement('div');
            slot.className = 'inventory-slot tool-slot';
            slot.dataset.item = 'hook';
            
            slot.innerHTML = `
                <i class="fas fa-anchor"></i>
                <div class="slot-name">鉤子</div>
                <div class="durability-bar">
                    <div class="durability-fill" style="width: ${durabilityPercent}%; background-color: ${durabilityColor};"></div>
                </div>
            `;
            
            inventorySlots.appendChild(slot);
        }
        
        if (this.tools && this.tools.fishingRod && this.tools.fishingRod.hasTool && this.tools.fishingRod.durability > 0) {
            const durabilityPercent = (this.tools.fishingRod.durability / this.tools.fishingRod.maxDurability) * 100;
            const durabilityColor = durabilityPercent > 50 ? '#2ecc71' : durabilityPercent > 25 ? '#f39c12' : '#e74c3c';
            
            const slot = document.createElement('div');
            slot.className = 'inventory-slot tool-slot';
            slot.dataset.item = 'fishingRod';
            
            slot.innerHTML = `
                <i class="fas fa-fish"></i>
                <div class="slot-name">釣魚竿</div>
                <div class="durability-bar">
                    <div class="durability-fill" style="width: ${durabilityPercent}%; background-color: ${durabilityColor};"></div>
                </div>
            `;
            
            inventorySlots.appendChild(slot);
        }
        
        // 然后显示物品栏物品，只显示数量大于0的
        for (const item of this.inventory) {
            // 跳过数量为0的物品
            if (item.count === 0) continue;
            
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.item = item.type;
            
            slot.innerHTML = `
                <i class="fas fa-${item.icon}"></i>
                <div class="slot-name">${item.name}</div>
                <div class="slot-count">${item.count}</div>
            `;
            
            inventorySlots.appendChild(slot);
        }
        
        // 更新制作菜单（只更新按钮状态，不更新资源数量）
        this.updateCraftingUI();
    },
    
    // 开始放置模式
    startPlacingMode(type) {
        this.state = GameState.PLACING;
        this.placingMode.active = true;
        this.placingMode.type = type;
        this.updatePrompt(`放置模式：${type === 'raft' ? '木筏方格' : type === 'purifier' ? '淨水器' : '烹飪站'}。移動滑鼠選擇位置，點擊放置。按ESC取消。`);
    },
    
    // 更新幽灵预览位置
    updateGhostPreview(mouseX, mouseY) {
        const gridSize = 40;
        
        if (this.placingMode.type === 'raft' || this.placingMode.type === 'collectionNet') {
            // 木筏方格或物品收集网：网格对齐
            const gridX = Math.round(mouseX / gridSize);
            const gridY = Math.round(mouseY / gridSize);
            this.placingMode.ghostX = gridX * gridSize;
            this.placingMode.ghostY = gridY * gridSize;
        } else {
            // 工作站：自由位置，但必须在木筏上
            this.placingMode.ghostX = mouseX;
            this.placingMode.ghostY = mouseY;
        }
        
        // 检查放置位置是否有效
        this.placingMode.isValid = this.checkPlacementValidity(
            this.placingMode.ghostX, 
            this.placingMode.ghostY, 
            this.placingMode.type
        );
    },
    
    // 检查放置位置是否有效
    checkPlacementValidity(x, y, type) {
        const gridSize = 40;
        
        if (type === 'raft' || type === 'collectionNet') {
            // 木筏方格或物品收集网：必须与现有木筏或收集网相邻，且网格对齐
            const gridX = Math.round(x / gridSize);
            const gridY = Math.round(y / gridSize);
            
            // 检查是否已经存在（木筏或收集网）
            const exists = this.raft.some(piece => 
                piece.gridX === gridX && piece.gridY === gridY);
            
            // 对于木筏类型，允许在已有木筏方块上放置（用于修复）
            if (type === 'raft' && exists) {
                return true; // 允许在已有木筏方块上放置（修复功能）
            }
            
            // 对于收集网类型，不允许在已有木筏方块上放置
            if (type === 'collectionNet' && exists) {
                return false;
            }
            
            // 检查是否与现有收集网重叠
            if (type === 'collectionNet') {
                for (const net of this.collectionNets) {
                    const netGridX = Math.round(net.x / gridSize);
                    const netGridY = Math.round(net.y / gridSize);
                    if (netGridX === gridX && netGridY === gridY) {
                        return false; // 收集网位置已存在
                    }
                }
            }
            
            // 检查是否与现有木筏或收集网相邻
            const directions = [
                { x: 0, y: -1 }, // 上
                { x: 1, y: 0 },  // 右
                { x: 0, y: 1 },  // 下
                { x: -1, y: 0 }  // 左
            ];
            
            for (const dir of directions) {
                const adjacentGridX = gridX + dir.x;
                const adjacentGridY = gridY + dir.y;
                
                // 检查是否与木筏相邻
                const hasAdjacentRaft = this.raft.some(piece => 
                    piece.gridX === adjacentGridX && piece.gridY === adjacentGridY);
                
                // 检查是否与收集网相邻（只对收集网类型）
                let hasAdjacentNet = false;
                if (type === 'collectionNet') {
                    hasAdjacentNet = this.collectionNets.some(net => {
                        const netGridX = Math.round(net.x / gridSize);
                        const netGridY = Math.round(net.y / gridSize);
                        return netGridX === adjacentGridX && netGridY === adjacentGridY;
                    });
                }
                
                if (hasAdjacentRaft || hasAdjacentNet) {
                    return true;
                }
            }
            
            return false;
        } else {
            // 工作站：必须在木筏上，且不能与其他工作站或收集网重叠
            let isOnRaft = false;
            
            // 检查是否在木筏上
            for (const raftPiece of this.raft) {
                const dx = Math.abs(x - (raftPiece.x + raftPiece.size / 2));
                const dy = Math.abs(y - (raftPiece.y + raftPiece.size / 2));
                
                if (dx < raftPiece.size / 2 && dy < raftPiece.size / 2) {
                    isOnRaft = true;
                    break;
                }
            }
            
            if (!isOnRaft) return false;
            
            // 检查是否与其他工作站重叠
            const workstationWidth = 35; // 工作站宽度
            const workstationHeight = 35; // 工作站高度
            
            for (const workstation of this.workstations) {
                // 计算两个工作站之间的距离
                const dx = Math.abs(x - workstation.x);
                const dy = Math.abs(y - workstation.y);
                
                // 如果两个工作站中心的距离小于它们的宽度/高度之和的一半，则重叠
                if (dx < (workstationWidth + workstation.width) / 2 && 
                    dy < (workstationHeight + workstation.height) / 2) {
                    return false; // 重叠，无效位置
                }
            }
            
            // 检查是否与其他收集网重叠
            const collectionNetWidth = 40; // 修改：收集网宽度与木筏方块一致（40x40）
            const collectionNetHeight = 40; // 修改：收集网高度与木筏方块一致（40x40）
            
            for (const net of this.collectionNets) {
                // 计算两个收集网之间的距离
                const dx = Math.abs(x - net.x);
                const dy = Math.abs(y - net.y);
                
                // 如果两个收集网中心的距离小于它们的宽度/高度之和的一半，则重叠
                if (dx < (collectionNetWidth + net.width) / 2 && 
                    dy < (collectionNetHeight + net.height) / 2) {
                    return false; // 重叠，无效位置
                }
            }
            
            return true; // 在木筏上且不与其他工作站或收集网重叠
        }
    },
    
    // 放置建筑
    placeBuilding() {
        if (!this.placingMode.active || !this.placingMode.isValid) {
            this.updatePrompt('無法在此位置放置！');
            // 放置失败，直接退出放置模式（不需要返还物品，因为物品数量没有减少）
            this.exitPlacingMode();
            return;
        }
        
        const x = this.placingMode.ghostX;
        const y = this.placingMode.ghostY;
        
        // 放置成功，减少物品数量
        let itemType = '';
        switch(this.placingMode.type) {
            case 'raft':
                itemType = 'raftPiece';
                const gridSize = 40;
                const gridX = Math.round(x / gridSize);
                const gridY = Math.round(y / gridSize);
                this.expandRaft(gridX, gridY);
                break;
            case 'purifier':
                itemType = 'purifierItem';
                this.buildWorkstation('purifier', x, y);
                break;
            case 'cookStation':
                itemType = 'cookStationItem';
                this.buildWorkstation('cookStation', x, y);
                break;
            case 'collectionNet':
                itemType = 'collectionNetItem';
                this.buildCollectionNet(x, y);
                break;
        }
        
        // 减少物品数量
        if (itemType) {
            const item = this.inventory.find(item => item.type === itemType);
            if (item && item.count > 0) {
                item.count--;
                this.updateInventoryUI();
            }
        }
        
        // 退出放置模式
        this.exitPlacingMode();
    },
    
    // 返还物品到物品栏（放置失败时调用）
    returnItemToInventory() {
        if (!this.placingMode.active || !this.placingMode.type) return;
        
        let itemType = '';
        let itemName = '';
        
        switch(this.placingMode.type) {
            case 'raft':
                itemType = 'raftPiece';
                itemName = '木筏方格';
                break;
            case 'purifier':
                itemType = 'purifierItem';
                itemName = '淨水器';
                break;
            case 'cookStation':
                itemType = 'cookStationItem';
                itemName = '烹飪站';
                break;
        }
        
        if (itemType) {
            this.addToInventory(itemType, 1);
            this.updatePrompt(`放置失敗，${itemName}已返回到物品欄中。`);
        }
        
        // 退出放置模式
        this.exitPlacingMode();
    },
    
    // 退出放置模式
    exitPlacingMode() {
        // 注意：现在进入放置模式时不减少物品数量，所以取消放置时也不需要返还物品
        // 只需要更新提示信息
        if (this.placingMode.active && this.placingMode.type) {
            let itemName = '';
            switch(this.placingMode.type) {
                case 'raft':
                    itemName = '木筏方格';
                    break;
                case 'purifier':
                    itemName = '淨水器';
                    break;
                case 'cookStation':
                    itemName = '烹飪站';
                    break;
            }
            
            this.updatePrompt(`已取消放置 ${itemName}。`);
        }
        
        this.state = GameState.RUNNING;
        this.placingMode.active = false;
        this.placingMode.type = null;
    },
    
    // 绘制幽灵预览
    drawGhostPreview() {
        if (!this.placingMode.active) return;
        
        const ctx = this.ctx;
        const x = this.placingMode.ghostX;
        const y = this.placingMode.ghostY;
        const isValid = this.placingMode.isValid;
        
        ctx.globalAlpha = 0.6;
        
        if (this.placingMode.type === 'raft') {
            // 绘制木筏方格预览
            ctx.fillStyle = isValid ? 'rgba(139, 69, 19, 0.6)' : 'rgba(255, 0, 0, 0.6)';
            ctx.fillRect(x, y, 40, 40);
            
            ctx.strokeStyle = isValid ? '#8b4513' : '#e74c3c';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, 40, 40);
        } else if (this.placingMode.type === 'collectionNet') {
            // 绘制物品收集网预览（使用左上角坐标，与木筏方块对齐）
            const width = 40; // 修改：与木筏方块大小一致（40x40）
            const height = 40;
            const color = '#9b59b6'; // 紫色
            
            ctx.fillStyle = isValid ? `rgba(155, 89, 182, 0.3)` : 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(x, y, width, height);
            
            ctx.strokeStyle = isValid ? color : '#e74c3c';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            
            // 绘制网状结构预览
            const gridSize = 8; // 修改：网格大小调整为8（40/5=8）
            for (let i = 0; i <= width / gridSize; i++) {
                const lineX = x + i * gridSize;
                ctx.beginPath();
                ctx.moveTo(lineX, y);
                ctx.lineTo(lineX, y + height);
                ctx.stroke();
            }
            
            for (let i = 0; i <= height / gridSize; i++) {
                const lineY = y + i * gridSize;
                ctx.beginPath();
                ctx.moveTo(x, lineY);
                ctx.lineTo(x + width, lineY);
                ctx.stroke();
            }
        } else {
            // 绘制工作站预览
            const width = 35; // 减小到35x35，匹配实际工作站大小
            const height = 35;
            const color = this.placingMode.type === 'purifier' ? '#3498db' : '#e74c3c';
            
            ctx.fillStyle = isValid ? `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.6)` : 'rgba(255, 0, 0, 0.6)';
            ctx.fillRect(x - width / 2, y - height / 2, width, height);
            
            ctx.strokeStyle = isValid ? color : '#e74c3c';
            ctx.lineWidth = 2;
            ctx.strokeRect(x - width / 2, y - height / 2, width, height);
        }
        
        ctx.globalAlpha = 1.0;
    },
    
    // 更新工具UI
    updateToolsUI() {
        // 安全检查：确保tools对象存在
        if (!this.tools) {
            console.error('tools对象未定义');
            return;
        }
        
        // 检查钩子耐久度，如果为0则移除工具
        if (this.tools.hook && this.tools.hook.hasTool && this.tools.hook.durability <= 0) {
            this.tools.hook.hasTool = false;
            this.updatePrompt('鉤子已損壞！需要製作新的鉤子。');
        }
        
        // 检查钓鱼竿耐久度，如果为0则移除工具
        if (this.tools.fishingRod && this.tools.fishingRod.hasTool && this.tools.fishingRod.durability <= 0) {
            this.tools.fishingRod.hasTool = false;
            this.updatePrompt('釣魚竿已損壞！需要製作新的釣魚竿。');
        }
        
        // 工具现在显示在物品栏中，所以只需要更新物品栏UI
        this.updateInventoryUI();
    },
    
    // 更新Actions面板
    updateActionsUI() {
        const actionsPanel = document.getElementById('actions-panel');
        const actionsSlots = document.getElementById('actions-slots');
        if (!actionsPanel || !actionsSlots) return;
        
        actionsSlots.innerHTML = '';
        
        // 定义所有可能的actions（按照优先级顺序定义）
        const actions = [
            {
                id: 2, // 净化海水 - 最高优先级
                name: '淨化海水',
                requirement: '需淨水器',
                priority: 1, // 最高优先级
                check: () => {
                    const seaWaterCup = this.inventory.find(item => item.type === 'seaWaterCup');
                    if (!seaWaterCup || seaWaterCup.count === 0) return false;
                    
                    // 检查是否碰到净水器
                    for (const purifier of this.workstations) {
                        if (purifier.type === 'purifier') {
                            // 检查玩家与净水器的碰撞
                            const playerLeft = this.player.x - this.player.radius;
                            const playerRight = this.player.x + this.player.radius;
                            const playerTop = this.player.y - this.player.radius;
                            const playerBottom = this.player.y + this.player.radius;
                            
                            const purifierLeft = purifier.x - purifier.width / 2;
                            const purifierRight = purifier.x + purifier.width / 2;
                            const purifierTop = purifier.y - purifier.height / 2;
                            const purifierBottom = purifier.y + purifier.height / 2;
                            
                            // 矩形碰撞检测
                            if (playerRight > purifierLeft && 
                                playerLeft < purifierRight && 
                                playerBottom > purifierTop && 
                                playerTop < purifierBottom) {
                                return true;
                            }
                        }
                    }
                    return false;
                },
                execute: () => this.purifyWater()
            },
            {
                id: 4, // 烹饪鱼 - 最高优先级
                name: '烹飪魚',
                requirement: '需烹飪站',
                priority: 1, // 最高优先级
                check: () => {
                    const rawFish = this.inventory.find(item => item.type === 'rawFish');
                    if (!rawFish || rawFish.count === 0) return false;
                    
                    // 检查是否碰到烹饪站
                    for (const cookStation of this.workstations) {
                        if (cookStation.type === 'cookStation') {
                            // 检查玩家与烹饪站的碰撞
                            const playerLeft = this.player.x - this.player.radius;
                            const playerRight = this.player.x + this.player.radius;
                            const playerTop = this.player.y - this.player.radius;
                            const playerBottom = this.player.y + this.player.radius;
                            
                            const cookStationLeft = cookStation.x - cookStation.width / 2;
                            const cookStationRight = cookStation.x + cookStation.width / 2;
                            const cookStationTop = cookStation.y - cookStation.height / 2;
                            const cookStationBottom = cookStation.y + cookStation.height / 2;
                            
                            // 矩形碰撞检测
                            if (playerRight > cookStationLeft && 
                                playerLeft < cookStationRight && 
                                playerBottom > cookStationTop && 
                                playerTop < cookStationBottom) {
                                return true;
                            }
                        }
                    }
                    return false;
                },
                execute: () => this.cookFish()
            },
            {
                id: 1, // 获取海水 - 中等优先级
                name: '獲取海水',
                requirement: '需空杯',
                priority: 2, // 中等优先级
                check: () => {
                    const emptyCup = this.inventory.find(item => item.type === 'emptyCup');
                    return emptyCup && emptyCup.count > 0 && this.isAtRaftEdge();
                },
                execute: () => this.getSeaWater()
            },
            {
                id: 3, // 钓鱼 - 最低优先级
                name: '釣魚',
                requirement: '需釣魚竿',
                priority: 3, // 最低优先级
                check: () => {
                    return this.tools && this.tools.fishingRod && this.tools.fishingRod.hasTool && 
                           this.tools.fishingRod.durability > 0 && this.isAtRaftEdge();
                },
                execute: () => this.goFishing()
            }
        ];
        
        // 过滤出可用的actions
        const availableActions = actions.filter(action => action.check());
        
        // 如果没有可用actions，隐藏面板
        if (availableActions.length === 0) {
            actionsPanel.classList.add('hidden');
            return;
        }
        
        // 按照优先级排序（优先级数字越小，优先级越高）
        availableActions.sort((a, b) => a.priority - b.priority);
        
        // 创建和添加可用的actions
        let actionIndex = 1; // 从1开始分配按键
        for (const action of availableActions) {
            const actionSlot = document.createElement('div');
            actionSlot.className = 'action-slot';
            actionSlot.dataset.action = action.id;
            actionSlot.dataset.key = actionIndex.toString(); // 存储动态分配的按键
            
            // 第一个action显示"1/E"，其他action只显示数字
            const keyDisplay = actionIndex === 1 ? '1/E' : actionIndex.toString();
            
            actionSlot.innerHTML = `
                <div class="action-key">${keyDisplay}</div>
                <div class="action-name">${action.name}</div>
                <div class="action-requirement">${action.requirement}</div>
            `;
            
            // 添加点击事件
            actionSlot.addEventListener('click', () => {
                action.execute();
            });
            
            actionsSlots.appendChild(actionSlot);
            actionIndex++; // 递增按键编号
        }
        
        // 显示面板
        actionsPanel.classList.remove('hidden');
    },
    
    // 在游戏更新中调用updateActionsUI
    update() {
        if (this.state !== GameState.RUNNING) return;
        
    // 更新游戏时间
    this.gameTime += this.deltaTime;
    this.survivalTime += this.deltaTime;
    
    // 更新日夜系统
    this.updateDayNight();
    
    // 更新玩家位置
    this.player.x += this.player.velocity.x;
    this.player.y += this.player.velocity.y;
    
    // 边界检查
    this.player.x = Math.max(this.player.radius, Math.min(this.canvas.width - this.player.radius, this.player.x));
    this.player.y = Math.max(this.player.radius, Math.min(this.canvas.height - this.player.radius, this.player.y));
    
    // 检查玩家是否在木筏上
    this.checkPlayerOnRaft();
    
    // 更新生存指标
    this.updateStats();
    
    // 生成资源
    this.spawnResource();
    
    // 生成鲨鱼（当玩家下水时）
    this.spawnShark();
    
    // 更新资源位置
    this.updateResources();
    
    // 更新钩子
    this.updateHooks();
    
    // 更新工作站
    this.updateWorkstations();
    
    // 更新鲨鱼
    this.updateSharks();
    
    // 更新Actions面板
    this.updateActionsUI();
    
    // 检查碰撞
    this.checkCollisions();
    
    // 检查游戏结束
    this.checkGameOver();
    }
};

// 页面加载完成后初始化游戏
window.addEventListener('DOMContentLoaded', () => {
    Game.init();
});
