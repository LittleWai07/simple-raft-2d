const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let health = 100;
let hunger = 100;
let thirst = 100;
let oxygen = 100;
let isSwimming = false;
let inventory = {
    wood: 0,
    plastic: 0,
    leaf: 0,
    emptyCup: 0,
    seaWaterCup: 0,
    cleanWaterCup: 0,
    rawFish: 0,
    cookedFish: 0
};

let tools = {
    hook: { durability: 20, max: 20, range: 250, active: true },
    rod: { durability: 0, max: 10, active: false }
};

let fishing = {
    active: false,
    timer: 0,
    targetTime: 0,
    x: 0,
    y: 0
};

let placedStations = [];
let placementMode = null;
let gameOver = false;
let currentStation = null;

const raftBlocks = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 }
];

const blockSize = 50;
const player = {
    x: 25,
    y: 25,
    size: 20,
    speed: 3
};

let items = [];
const itemTypes = ['wood', 'plastic', 'leaf'];
const itemColors = {
    wood: '#8B4513',
    plastic: '#ADD8E6',
    leaf: '#228B22'
};

// Hook state
let hook = {
    active: false,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    targetX: 0,
    targetY: 0,
    speed: 10,
    returning: false
};

// Input handling
const keys = {};
const mouse = { x: 0, y: 0 };
window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key.toLowerCase() === 'c') {
        const crafting = document.getElementById('crafting');
        crafting.style.display = crafting.style.display === 'none' ? 'block' : 'none';
    }
    if (e.key === '1') {
        const btn = document.getElementById('btn-water-prompt');
        if (btn) action('getWater');
    }
    if (e.key === '2') {
        const btn = document.getElementById('btn-purify-prompt');
        if (btn) action('purifyWater');
    }
    if (e.key === '3') {
        const btn = document.getElementById('btn-fish-prompt');
        if (btn) action('fish');
    }
    if (e.key === '4') {
        const btn = document.getElementById('btn-cook-prompt');
        if (btn) action('cookFish');
    }
});
window.addEventListener('keyup', e => keys[e.key] = false);
window.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});
window.addEventListener('mousedown', e => {
    if (gameOver) return;

    if (placementMode) {
        placeAtMouse();
        return;
    }

    if (!hook.active && tools.hook.active && !fishing.active) {
        hook.active = true;
        hook.x = player.x;
        hook.y = player.y;
        hook.startX = player.x;
        hook.startY = player.y;
        hook.targetX = mouse.x;
        hook.targetY = mouse.y;
        hook.returning = false;
    }
});

function placeAtMouse() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    if (placementMode === 'raft') {
        // Calculate grid coordinates based on mouse
        const gx = Math.round((mouse.x - centerX) / blockSize);
        const gy = Math.round((mouse.y - centerY) / blockSize);

        // Check if already exists
        if (raftBlocks.some(b => b.x === gx && b.y === gy)) return;

        // Check if adjacent to existing raft
        const isAdjacent = raftBlocks.some(b => 
            (Math.abs(b.x - gx) === 1 && b.y === gy) || 
            (Math.abs(b.y - gy) === 1 && b.x === gx)
        );

        if (isAdjacent) {
            raftBlocks.push({ x: gx, y: gy });
            placementMode = null;
            updateInventoryUI();
        }
    } else {
        // Station placement
        raftBlocks.forEach(block => {
            const bx = centerX + block.x * blockSize - blockSize/2;
            const by = centerY + block.y * blockSize - blockSize/2;

            if (mouse.x > bx && mouse.x < bx + blockSize && mouse.y > by && mouse.y < by + blockSize) {
                if (!placedStations.some(s => s.blockX === block.x && s.blockY === block.y)) {
                    placedStations.push({
                        type: placementMode,
                        blockX: block.x,
                        blockY: block.y,
                        timer: 0,
                        durability: 15,
                        loaded: false
                    });
                    placementMode = null;
                    updateInventoryUI();
                }
            }
        });
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function spawnItem() {
    const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
    const side = Math.floor(Math.random() * 4);
    let x, y, vx, vy;

    if (side === 0) { // Top
        x = Math.random() * canvas.width;
        y = -20;
        vx = (Math.random() - 0.5) * 1;
        vy = Math.random() * 1 + 0.5;
    } else if (side === 1) { // Right
        x = canvas.width + 20;
        y = Math.random() * canvas.height;
        vx = -(Math.random() * 1 + 0.5);
        vy = (Math.random() - 0.5) * 1;
    } else if (side === 2) { // Bottom
        x = Math.random() * canvas.width;
        y = canvas.height + 20;
        vx = (Math.random() - 0.5) * 1;
        vy = -(Math.random() * 1 + 0.5);
    } else { // Left
        x = -20;
        y = Math.random() * canvas.height;
        vx = Math.random() * 1 + 0.5;
        vy = (Math.random() - 0.5) * 1;
    }

    items.push({ x, y, vx, vy, type, size: 15 });
}

function update() {
    if (gameOver) return;

    let inventoryChanged = false;

    // Update Stations
    placedStations.forEach((station, index) => {
        if (station.loaded) {
            station.timer++;
            if (station.timer > 300) {
                if (station.type === 'purifier') {
                    inventory.cleanWaterCup++;
                } else if (station.type === 'cooker') {
                    inventory.cookedFish++;
                }
                station.timer = 0;
                station.durability--;
                station.loaded = false;
                inventoryChanged = true;
            }
        }

        if (station.durability <= 0) {
            placedStations.splice(index, 1);
            inventoryChanged = true;
        }
    });

    // Player movement
    let currentSpeed = isSwimming ? player.speed * 0.3 : player.speed;
    if (fishing.active) currentSpeed = 0;

    let nextX = player.x;
    let nextY = player.y;

    if (keys['ArrowUp'] || keys['w']) nextY -= currentSpeed;
    if (keys['ArrowDown'] || keys['s']) nextY += currentSpeed;
    if (keys['ArrowLeft'] || keys['a']) nextX -= currentSpeed;
    if (keys['ArrowRight'] || keys['d']) nextX += currentSpeed;

    // Check if player is on raft
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    let onRaft = false;
    raftBlocks.forEach(block => {
        const bx = centerX + block.x * blockSize - blockSize/2;
        const by = centerY + block.y * blockSize - blockSize/2;
        if (nextX > bx - 5 && nextX < bx + blockSize + 5 && nextY > by - 5 && nextY < by + blockSize + 5) {
            onRaft = true;
        }
    });

    isSwimming = !onRaft;
    player.x = nextX;
    player.y = nextY;

    // Fishing logic
    if (fishing.active) {
        fishing.timer++;
        if (fishing.timer >= fishing.targetTime) {
            inventory.rawFish++;
            fishing.active = false;
            updateInventoryUI();
        }
    }

    // Oxygen logic
    if (isSwimming) {
        oxygen -= 0.2;
        if (oxygen <= 0) {
            health -= 0.5;
            oxygen = 0;
        }
    } else {
        oxygen = Math.min(100, oxygen + 1);
    }

    // Update Hook
    if (hook.active) {
        if (!hook.returning) {
            const dx = hook.targetX - hook.x;
            const dy = hook.targetY - hook.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Distance limit
            const distFromStart = Math.sqrt(Math.pow(hook.x - hook.startX, 2) + Math.pow(hook.y - hook.startY, 2));

            if (dist < 10 || distFromStart > tools.hook.range) {
                hook.returning = true;
            } else {
                hook.x += (dx / dist) * hook.speed;
                hook.y += (dy / dist) * hook.speed;
            }

            // Check for item collision with hook
            items.forEach((item, index) => {
                const idx = item.x - hook.x;
                const idy = item.y - hook.y;
                const idist = Math.sqrt(idx * idx + idy * idy);
                if (idist < item.size + 5) {
                    hook.returning = true;
                    item.hooked = true;
                    // Hook durability
                    tools.hook.durability--;
                    if (tools.hook.durability <= 0) {
                        tools.hook.active = false;
                    }
                    inventoryChanged = true;
                }
            });
        } else {
            const dx = player.x - hook.x;
            const dy = player.y - hook.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 10) {
                hook.active = false;
            } else {
                hook.x += (dx / dist) * hook.speed;
                hook.y += (dy / dist) * hook.speed;
            }
        }
    }

    // Update items
    items.forEach((item, index) => {
        if (item.hooked) {
            item.x = hook.x;
            item.y = hook.y;
            
            const dx = item.x - player.x;
            const dy = item.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < player.size) {
                collectItem(item, index);
            }
        } else {
            item.x += item.vx;
            item.y += item.vy;

            // Manual Collection
            const dx = item.x - player.x;
            const dy = item.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < player.size / 2 + item.size / 2) {
                collectItem(item, index);
            }
        }
    });

    // Remove off-screen items
    items = items.filter(item => 
        item.x > -50 && item.x < canvas.width + 50 &&
        item.y > -50 && item.y < canvas.height + 50
    );

    if (Math.random() < 0.02) spawnItem();

    // Survival stats
    hunger -= 0.005;
    thirst -= 0.007;
    
    if (hunger <= 0 || thirst <= 0) {
        health -= 0.05;
    } else if (hunger > 90 && thirst > 90) {
        health = Math.min(100, health + 0.02);
    }
    
    hunger = Math.max(0, hunger);
    thirst = Math.max(0, thirst);
    health = Math.max(0, health);

    if (inventoryChanged) updateInventoryUI();
    updateStatsUI();
}

function collectItem(item, index) {
    inventory[item.type]++;
    items.splice(index, 1);
    updateInventoryUI();
}

function updateStatsUI() {
    document.getElementById('health').innerText = Math.ceil(health);
    document.getElementById('hunger').innerText = Math.ceil(hunger);
    document.getElementById('thirst').innerText = Math.ceil(thirst);
    document.getElementById('oxygen').innerText = Math.ceil(oxygen);
    document.getElementById('oxygen-container').style.display = isSwimming || oxygen < 100 ? 'block' : 'none';

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    let nearEdge = false;
    currentStation = null;

    raftBlocks.forEach(block => {
        const bx = centerX + block.x * blockSize - blockSize/2;
        const by = centerY + block.y * blockSize - blockSize/2;
        
        if (player.x > bx && player.x < bx + blockSize && player.y > by && player.y < by + blockSize) {
            // Check for edge
            const neighbors = [
                {x: block.x + 1, y: block.y},
                {x: block.x - 1, y: block.y},
                {x: block.x, y: block.y + 1},
                {x: block.x, y: block.y - 1}
            ];
            if (neighbors.some(n => !raftBlocks.some(rb => rb.x === n.x && rb.y === n.y))) {
                nearEdge = true;
            }

            // Check for stations on this block
            const station = placedStations.find(s => s.blockX === block.x && s.blockY === block.y);
            if (station) {
                currentStation = station;
            }
        }
    });

    const prompts = document.getElementById('action-prompts');
    prompts.innerHTML = '';
    let showPrompts = false;

    if (nearEdge && inventory.emptyCup > 0) {
        const span = document.createElement('span');
        span.id = 'btn-water-prompt';
        span.innerText = '[1] Get Sea Water ';
        prompts.appendChild(span);
        showPrompts = true;
    }
    
    if (currentStation && currentStation.type === 'purifier' && !currentStation.loaded && inventory.seaWaterCup > 0) {
        const span = document.createElement('span');
        span.id = 'btn-purify-prompt';
        span.innerText = '[2] Purify Water ';
        prompts.appendChild(span);
        showPrompts = true;
    }

    if (nearEdge && tools.rod.active && !fishing.active) {
        const span = document.createElement('span');
        span.id = 'btn-fish-prompt';
        span.innerText = '[3] Fish ';
        prompts.appendChild(span);
        showPrompts = true;
    }

    if (currentStation && currentStation.type === 'cooker' && !currentStation.loaded && inventory.rawFish > 0) {
        const span = document.createElement('span');
        span.id = 'btn-cook-prompt';
        span.innerText = '[4] Cook Fish ';
        prompts.appendChild(span);
        showPrompts = true;
    }

    prompts.style.display = showPrompts ? 'block' : 'none';
}

function updateInventoryUI() {
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';

    // Tools
    for (const [name, tool] of Object.entries(tools)) {
        if (tool.active || tool.durability > 0) {
            const li = document.createElement('li');
            li.innerText = name.toUpperCase();
            li.style.color = tool.active ? '#fff' : '#ff4444';
            li.style.paddingBottom = '10px'; // Make room for bar

            const barContainer = document.createElement('div');
            barContainer.className = 'durability-bar-container';
            
            const bar = document.createElement('div');
            bar.className = 'durability-bar';
            const percent = (tool.durability / tool.max) * 100;
            bar.style.width = `${percent}%`;
            
            // Color based on durability
            if (percent < 25) bar.style.backgroundColor = '#ff0000';
            else if (percent < 50) bar.style.backgroundColor = '#ffff00';
            
            barContainer.appendChild(bar);
            li.appendChild(barContainer);
            list.appendChild(li);
        }
    }

    // Items
    for (const [item, count] of Object.entries(inventory)) {
        if (count > 0) {
            const li = document.createElement('li');
            let displayName = item;
            if (item === 'emptyCup') displayName = 'Empty Cup';
            if (item === 'seaWaterCup') displayName = 'Sea Water Cup';
            if (item === 'cleanWaterCup') displayName = 'Clean Water Cup';
            if (item === 'cookedFish') displayName = 'Cooked Fish (Eatable)';
            if (item === 'rawFish') displayName = 'Raw Fish (Need Cook)';
            
            li.innerText = `${displayName}: ${count}`;
            if (item === 'cleanWaterCup') {
                li.style.cursor = 'pointer';
                li.style.color = '#00ffff';
                li.style.fontWeight = 'bold';
                li.onclick = (e) => { 
                    e.stopPropagation();
                    if (inventory.cleanWaterCup > 0) { 
                        inventory.cleanWaterCup--; 
                        inventory.emptyCup++;
                        thirst = Math.min(100, thirst + 30); 
                        updateInventoryUI(); 
                    } 
                };
            }
            if (item === 'cookedFish') {
                li.style.cursor = 'pointer';
                li.style.color = '#ffa500';
                li.style.fontWeight = 'bold';
                li.onclick = (e) => { 
                    e.stopPropagation();
                    if (inventory.cookedFish > 0) { 
                        inventory.cookedFish--; 
                        hunger = Math.min(100, hunger + 40); 
                        updateInventoryUI(); 
                    } 
                };
            }
            list.appendChild(li);
        }
    }
}

function action(type) {
    if (type === 'getWater') {
        if (inventory.emptyCup > 0) {
            inventory.emptyCup--;
            inventory.seaWaterCup++;
            updateInventoryUI();
        }
    } else if (type === 'fish') {
        if (tools.rod.active && !fishing.active) {
            fishing.active = true;
            fishing.timer = 0;
            fishing.targetTime = 120 + Math.random() * 180; // 2-5 seconds
            
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const dx = player.x - centerX;
            const dy = player.y - centerY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            fishing.x = player.x + (dx/dist) * 40;
            fishing.y = player.y + (dy/dist) * 40;

            tools.rod.durability--;
            if (tools.rod.durability <= 0) tools.rod.active = false;
            updateInventoryUI();
        }
    } else if (type === 'purifyWater') {
        if (currentStation && currentStation.type === 'purifier' && !currentStation.loaded && inventory.seaWaterCup > 0) {
            inventory.seaWaterCup--;
            currentStation.loaded = true;
            updateInventoryUI();
        }
    } else if (type === 'cookFish') {
        if (currentStation && currentStation.type === 'cooker' && !currentStation.loaded && inventory.rawFish > 0) {
            inventory.rawFish--;
            currentStation.loaded = true;
            updateInventoryUI();
        }
    }
}

function craft(type) {
    if (gameOver) return;
    if (type === 'raft') {
        if (inventory.wood >= 2 && inventory.plastic >= 2) {
            inventory.wood -= 2;
            inventory.plastic -= 2;
            placementMode = 'raft';
            alert("Click next to your raft to place the new block!");
            updateInventoryUI();
        }
    } else if (type === 'hook') {
        if (inventory.plastic >= 3 && inventory.leaf >= 1) {
            inventory.plastic -= 3;
            inventory.leaf -= 1;
            tools.hook.durability = tools.hook.max;
            tools.hook.active = true;
            updateInventoryUI();
        }
    } else if (type === 'cup') {
        if (inventory.plastic >= 2) {
            inventory.plastic -= 2;
            inventory.emptyCup++;
            updateInventoryUI();
        }
    } else if (type === 'purifier') {
        if (inventory.plastic >= 3 && inventory.wood >= 2) {
            inventory.plastic -= 3;
            inventory.wood -= 2;
            placementMode = 'purifier';
            alert("Click on a raft block to place the Purifier!");
            updateInventoryUI();
        }
    } else if (type === 'rod') {
        if (inventory.wood >= 2 && inventory.leaf >= 2) {
            inventory.wood -= 2;
            inventory.leaf -= 2;
            tools.rod.durability = tools.rod.max;
            tools.rod.active = true;
            updateInventoryUI();
        }
    } else if (type === 'cooker') {
        if (inventory.wood >= 3 && inventory.plastic >= 1) {
            inventory.wood -= 3;
            inventory.plastic -= 1;
            placementMode = 'cooker';
            alert("Click on a raft block to place the Cook Station!");
            updateInventoryUI();
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Draw Raft
    ctx.fillStyle = '#D2B48C';
    raftBlocks.forEach(block => {
        ctx.fillRect(
            centerX + block.x * blockSize - blockSize/2,
            centerY + block.y * blockSize - blockSize/2,
            blockSize - 2,
            blockSize - 2
        );
    });

    // Draw Items
    items.forEach(item => {
        ctx.fillStyle = itemColors[item.type];
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.size / 2, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw Stations on Raft
    placedStations.forEach(station => {
        const sx = centerX + station.blockX * blockSize - 10;
        const sy = centerY + station.blockY * blockSize - 10;
        
        ctx.fillStyle = station.type === 'purifier' ? '#4682B4' : '#A52A2A';
        ctx.fillRect(sx, sy, 20, 20);
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.fillText(station.type === 'purifier' ? 'P' : 'C', sx + 5, sy + 15);
        
        // Progress bar
        if (station.timer > 0) {
            ctx.fillStyle = 'lime';
            ctx.fillRect(sx, sy - 5, (station.timer / 300) * 20, 3);
        }
        // Durability bar
        ctx.fillStyle = 'orange';
        ctx.fillRect(sx, sy + 22, (station.durability / 15) * 20, 2);
    });

    // Draw Placement Ghost
    if (placementMode) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        if (placementMode === 'raft') {
            const gx = Math.round((mouse.x - centerX) / blockSize);
            const gy = Math.round((mouse.y - centerY) / blockSize);
            ctx.fillRect(centerX + gx * blockSize - blockSize/2, centerY + gy * blockSize - blockSize/2, blockSize - 2, blockSize - 2);
        } else {
            ctx.fillRect(mouse.x - 10, mouse.y - 10, 20, 20);
        }
    }

    // Draw Hook
    if (hook.active) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(hook.x, hook.y);
        ctx.stroke();
        
        ctx.fillStyle = 'gray';
        ctx.beginPath();
        ctx.arc(hook.x, hook.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw Fishing Line
    if (fishing.active) {
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(fishing.x, fishing.y);
        ctx.stroke();

        // Bobber
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(fishing.x, fishing.y, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Splash effect when near completion
        if (fishing.timer > fishing.targetTime - 30) {
            ctx.strokeStyle = 'white';
            ctx.beginPath();
            ctx.arc(fishing.x, fishing.y, 5 + Math.sin(Date.now()/50)*2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // Draw Player
    ctx.fillStyle = isSwimming ? '#4682B4' : '#FF6347'; // Blueish when swimming
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw oxygen bubble if swimming
    if (isSwimming) {
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.size / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();
    }

    if (health <= 0) {
        gameOver = true;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
        ctx.font = '24px Arial';
        ctx.fillText('You survived on the raft!', canvas.width / 2, canvas.height / 2 + 50);
        return;
    }

    requestAnimationFrame(() => {
        update();
        draw();
    });
}

// Initial player position
player.x = canvas.width / 2 - blockSize / 2;
player.y = canvas.height / 2 - blockSize / 2;

updateInventoryUI();
draw();
