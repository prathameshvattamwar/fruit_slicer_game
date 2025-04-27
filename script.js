const canvas = document.getElementById('fruitCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const livesDisplay = document.getElementById('lives');
const highScoreDisplay = document.getElementById('high-score');
const startOverlay = document.getElementById('start-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const finalScoreDisplay = document.getElementById('final-score');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');

let score = 0;
let lives = 3;
let highScore = localStorage.getItem('fruitSlicerHighScore') || 0;
let gameRunning = false;
let isGameOver = false;
let animationFrameId;
let items = [];
let particles = [];
let spawnInterval;
let lastSpawnTime = 0;
let minSpawnDelay = 900;
let maxSpawnDelay = 2000;

let isSlicing = false;
let sliceTrail = [];
const MAX_TRAIL_LENGTH = 15;
const SLICE_DETECTION_POINTS = 4;

const itemTypes = [
    { type: 'fruit', emoji: '🍎', radius: 30, particles: ['💧', '✨'] },
    { type: 'fruit', emoji: '🍊', radius: 32, particles: ['💧', '✨'] },
    { type: 'fruit', emoji: '🍉', radius: 35, particles: ['💧', '✨'] },
    { type: 'fruit', emoji: '🍓', radius: 28, particles: ['💧', '✨'] },
    { type: 'fruit', emoji: '🥝', radius: 30, particles: ['💧', '✨'] },
    { type: 'fruit', emoji: '🍌', radius: 33, particles: ['💧', '✨'] },
    { type: 'bomb', emoji: '💣', radius: 28, particles: ['💥', '🔥'] }
];

function resizeCanvas() {
    const parentWrapper = canvas.parentElement;
    const style = getComputedStyle(parentWrapper);
    const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    let targetWidth = parentWrapper.clientWidth - paddingX;

    const aspectRatio = 16 / 10;
    targetWidth = Math.max(300, targetWidth);

    canvas.width = targetWidth;
    canvas.height = targetWidth / aspectRatio;

    const maxHeight = window.innerHeight * 0.75;
    if (canvas.height > maxHeight) {
        canvas.height = maxHeight;
        canvas.width = canvas.height * aspectRatio;
    }

    items.forEach(item => {
        const typeData = itemTypes.find(t => t.emoji === item.emoji);
        if (typeData) {
            item.radius = typeData.radius * (canvas.width / 800);
            item.fontSize = item.radius * 2.2;
            item.velocityX = item.baseVelocityX * (canvas.width / 800);
        }
    });

    particles.forEach(p => {
        p.scaleFactor = canvas.width / 800;
        p.fontSize = p.baseFontSize * p.scaleFactor;
    });
}

class Item {
    constructor(x, y, itemData, velocityX, velocityY) {
        this.x = x;
        this.y = y;
        this.itemData = itemData;
        this.emoji = itemData.emoji;
        this.radius = itemData.radius * (canvas.width / 800);
        this.baseVelocityX = velocityX;
        this.velocityX = this.baseVelocityX * (canvas.width / 800);
        this.velocityY = velocityY * (canvas.width / 800);
        this.gravity = 0.04 + Math.random() * 0.025;
        this.isSliced = false;
        this.type = itemData.type;
        this.alpha = 1;
        this.fontSize = this.radius * 2.2;
    }

    update() {
        if (!this.isSliced) {
            this.velocityY += this.gravity * (canvas.width / 800);
            let nextX = this.x + this.velocityX;
            this.y += this.velocityY;

            // Bounce off side walls
            if (nextX - this.radius < 0 || nextX + this.radius > canvas.width) {
                this.velocityX *= -1; // Reverse horizontal direction
                // Clamp position to prevent sticking outside bounds
                if (nextX - this.radius < 0) {
                    this.x = this.radius;
                } else {
                    this.x = canvas.width - this.radius;
                }
            } else {
                this.x = nextX; // Update x position normally
            }

        } else {
            this.alpha -= 0.04;
        }
    }

    draw() {
        if (this.alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.translate(this.x, this.y);
        ctx.font = `${this.fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 0, 0);
        ctx.restore();
    }

    slice() {
        if (this.isSliced) return;
        this.isSliced = true;
        createParticles(this.x, this.y, this.itemData);
    }
}

class Particle {
    constructor(x, y, emoji) {
        this.x = x;
        this.y = y;
        this.emoji = emoji;
        this.scaleFactor = canvas.width / 800;
        this.baseFontSize = 15 + Math.random() * 10;
        this.fontSize = this.baseFontSize * this.scaleFactor;
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        this.velocityX = Math.cos(angle) * speed * this.scaleFactor;
        this.velocityY = Math.sin(angle) * speed * this.scaleFactor - (1 * this.scaleFactor);
        this.gravity = 0.05 + Math.random() * 0.03;
        this.alpha = 1;
        this.life = 0.6 + Math.random() * 0.6;
        this.decay = 1 / this.life;
    }

    update(deltaTime) {
        this.velocityY += this.gravity * this.scaleFactor;
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.alpha -= this.decay * deltaTime;
        this.fontSize = this.baseFontSize * this.scaleFactor * Math.max(0, this.alpha);
    }

    draw() {
        if (this.alpha <= 0 || this.fontSize <= 1) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.font = `${Math.max(1, this.fontSize)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, this.x, this.y);
        ctx.restore();
    }
}

function createParticles(x, y, itemData) {
    const particleCount = itemData.type === 'bomb' ? 15 : 8;
    const particleEmojis = itemData.particles || ['✨'];
    for (let i = 0; i < particleCount; i++) {
        const emoji = particleEmojis[Math.floor(Math.random() * particleEmojis.length)];
        particles.push(new Particle(x, y, emoji));
    }
}

function spawnItem() {
    const typeIndex = Math.floor(Math.random() * itemTypes.length);
    let itemData = { ...itemTypes[typeIndex] };

    const bombChance = 0.15 + Math.min(0.15, score * 0.005);
    if (itemData.type !== 'bomb' && Math.random() < bombChance) {
        const bombData = itemTypes.find(item => item.type === 'bomb');
        if (bombData) {
             itemData = { ...bombData };
        }
    }

    const currentRadius = itemData.radius * (canvas.width / 800);
    const sideMargin = currentRadius * 1.5;
    const x = sideMargin + Math.random() * (canvas.width - sideMargin * 2);
    const y = -currentRadius * 2;

    const baseSideSpeed = 0.5 + Math.random() * 1.5;
    const velocityX = (Math.random() < 0.5 ? -1 : 1) * baseSideSpeed;
    const velocityY = 0.5 + Math.random() * 1;

    items.push(new Item(x, y, itemData, velocityX, velocityY));
    scheduleNextSpawn();
}

function scheduleNextSpawn() {
     if (!gameRunning || isGameOver) return;
     const scoreFactor = 1 - Math.min(0.6, score * 0.005);
     const currentMinDelay = Math.max(300, minSpawnDelay * scoreFactor);
     const currentMaxDelay = Math.max(800, maxSpawnDelay * scoreFactor);
     const delay = currentMinDelay + Math.random() * (currentMaxDelay - currentMinDelay);
     spawnInterval = setTimeout(spawnItem, delay);
}

function updateGameInfo() {
    scoreDisplay.textContent = score;
    livesDisplay.textContent = lives;
    highScoreDisplay.textContent = highScore;
}

function checkSliceCollision(item) {
    if (item.isSliced || sliceTrail.length < 2) return false;
    const checkLength = Math.min(sliceTrail.length, SLICE_DETECTION_POINTS);
    for (let i = sliceTrail.length - 1; i >= sliceTrail.length - checkLength && i > 0; i--) {
        const point = sliceTrail[i];
        const dx = item.x - point.x;
        const dy = item.y - point.y;
        if (dx * dx + dy * dy < item.radius * item.radius * 1.5) {
            return true;
        }
    }
    return false;
}

function handleSlice(item) {
    item.slice();

    if (item.type === 'fruit') {
        score++;
    } else if (item.type === 'bomb') {
        lives--;
        if (lives <= 0) {
            gameOver();
        }
    }
}

function drawSliceTrail() {
    if (sliceTrail.length < 2) return;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 5 * (canvas.width / 800);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(sliceTrail[0].x, sliceTrail[0].y);
    for (let i = 1; i < sliceTrail.length; i++) {
        ctx.lineTo(sliceTrail[i].x, sliceTrail[i].y);
    }
    ctx.stroke();
}

let lastTimestamp = 0;
function gameLoop(timestamp) {
    if (isGameOver) return;

    const deltaTime = (timestamp - lastTimestamp) / 1000 || 0;
    lastTimestamp = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let itemsToRemoveIndexes = [];
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.update();
        item.draw();

        if (isSlicing && !item.isSliced && checkSliceCollision(item)) {
             handleSlice(item);
             if (isGameOver) break;
         }

        if (item.y > canvas.height + item.radius * 2 || item.alpha <= 0) {
            if (!item.isSliced && item.type === 'fruit' && item.y > canvas.height + item.radius * 2) {
                lives--;
                if (lives <= 0) {
                    gameOver();
                    break;
                }
            }
            itemsToRemoveIndexes.push(i);
        }
    }

    if (isGameOver) return;

    items = items.filter((_, index) => !itemsToRemoveIndexes.includes(index));

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(deltaTime);
        particles[i].draw();
        if (particles[i].alpha <= 0) {
            particles.splice(i, 1);
        }
    }

    drawSliceTrail();
    updateGameInfo();

    animationFrameId = requestAnimationFrame(gameLoop);
}

function startGame() {
    score = 0;
    lives = 3;
    items = [];
    particles = [];
    sliceTrail = [];
    isGameOver = false;
    gameRunning = true;
    isSlicing = false;
    minSpawnDelay = 900;
    maxSpawnDelay = 2000;
    lastTimestamp = 0;

    updateGameInfo();
    startOverlay.style.display = 'none';
    gameOverOverlay.style.display = 'none';
    canvas.style.cursor = 'crosshair';

    cancelAnimationFrame(animationFrameId);
    clearTimeout(spawnInterval);

    scheduleNextSpawn();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    if (isGameOver) return;
    isGameOver = true;
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);
    clearTimeout(spawnInterval);
    canvas.style.cursor = 'default';

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('fruitSlicerHighScore', highScore);
    }

    finalScoreDisplay.textContent = score;
    gameOverOverlay.style.display = 'flex';
}

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
    };
}

function getTouchPos(evt) {
     const rect = canvas.getBoundingClientRect();
     const scaleX = canvas.width / rect.width;
     const scaleY = canvas.height / rect.height;
     const touch = evt.touches[0];
     return {
         x: (touch.clientX - rect.left) * scaleX,
         y: (touch.clientY - rect.top) * scaleY
     };
}

function handlePointerDown(pos) {
     if (!gameRunning || isGameOver) return;
     isSlicing = true;
     sliceTrail = [pos];
}

function handlePointerMove(pos) {
     if (!isSlicing || !gameRunning || isGameOver) return;
     sliceTrail.push(pos);
     if (sliceTrail.length > MAX_TRAIL_LENGTH) {
         sliceTrail.shift();
     }
}

function handlePointerUp() {
     if (!isSlicing) return;
     isSlicing = false;
     setTimeout(() => {
         if (!isSlicing) {
             sliceTrail = [];
         }
     }, 100);
}

window.addEventListener('resize', resizeCanvas);
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
canvas.addEventListener('mousedown', (e) => handlePointerDown(getMousePos(e)));
canvas.addEventListener('mousemove', (e) => { if(isSlicing) handlePointerMove(getMousePos(e)); });
canvas.addEventListener('mouseup', handlePointerUp);
canvas.addEventListener('mouseleave', handlePointerUp);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handlePointerDown(getTouchPos(e)); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if(isSlicing) handlePointerMove(getTouchPos(e)); }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); handlePointerUp(); });
canvas.addEventListener('touchcancel', (e) => { e.preventDefault(); handlePointerUp(); });

resizeCanvas();
updateGameInfo();
startOverlay.style.display = 'flex';