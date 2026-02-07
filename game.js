const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- ASSETS ---
const lfcLogo = new Image();
lfcLogo.src = "https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/1200px-Liverpool_FC.svg.png";

// --- CONSTANTS & STATE ---
const FRICTION = 0.95; 
const BALL_SIZE = 22;
const PUSH_STRENGTH = 0.25;

let score = { player1: 0, player2: 0 };
let currentTurn = Math.random() < 0.5 ? "Liverpool" : "Visitors";
let ball = { x: 400, y: 250, vx: 0, vy: 0, angle: 0 };
let stealFeedback = { display: false, roll: 0, threshold: 0, timer: 0, status: "" };
let goalAnim = { active: false, timer: 0, text: "" };

// --- TIMER & MATCH STATE ---
let matchSeconds = 300; 
let stoppageSeconds = 0;
let lastMoveTime = Date.now();
let gameActive = true;

let isDragging = false;
let startX, startY;

// --- UI & LOGGING ---
function logPlay(message) {
    const box = document.getElementById('commentary');
    if (!box) return;
    box.innerText = message.toUpperCase();
    box.style.color = (message.includes("GOAL") || message.includes("SAVE")) ? "#f1c40f" : "#2ecc71";
}

function updateClock() {
    if (!gameActive) return;
    if (matchSeconds > 0) {
        matchSeconds -= (1/60);
    } else {
        if (stoppageSeconds > 0) {
            document.getElementById('stoppage-display').style.visibility = "visible";
            stoppageSeconds -= (1/60);
        } else {
            gameActive = false;
            logPlay("HALF TIME BLOWN!");
            alert("HALF TIME!");
        }
    }
    let displayMins = Math.floor(Math.max(0, matchSeconds) / 60);
    let displaySecs = Math.floor(Math.max(0, matchSeconds) % 60);
    document.getElementById('match-clock').innerText = `${displayMins.toString().padStart(2, '0')}:${displaySecs.toString().padStart(2, '0')}`;
    document.getElementById('stoppage-time').innerText = Math.ceil(Math.max(0, stoppageSeconds));
}

function updateTurnDisplay() {
    const lfcEl = document.getElementById('lfc-score');
    const visEl = document.getElementById('visitor-score');
    if(lfcEl && visEl) {
        lfcEl.parentElement.style.color = (currentTurn === "Liverpool") ? "#f1c40f" : "white";
        visEl.parentElement.style.color = (currentTurn === "Visitors") ? "#f1c40f" : "white";
    }
}

// --- GAME LOGIC ---
function resetBall(outOfBounds = false) {
    if (outOfBounds) {
        let previousTurn = currentTurn;
        currentTurn = (currentTurn === "Liverpool") ? "Visitors" : "Liverpool";
        logPlay(`${previousTurn} out of bounds! Possession to ${currentTurn}.`);
        ball.x = 100 + Math.random() * (canvas.width - 200);
        ball.y = 100 + Math.random() * (canvas.height - 200);
    } else {
        ball.x = canvas.width / 2;
        ball.y = canvas.height / 2;
    }
    ball.vx = 0;
    ball.vy = 0;
    lastMoveTime = Date.now();
    updateTurnDisplay();
}

function handleSteal() {
    let currentTime = Date.now();
    let timeTaken = (currentTime - lastMoveTime) / 1000;
    if (timeTaken > 2) stoppageSeconds += (timeTaken - 2);

    let roll = Math.floor(Math.random() * 100) + 1;
    let threshold = 80;
    let distToOpponentGoal = (currentTurn === "Liverpool") ? (canvas.width - ball.x) : ball.x;
    
    if (distToOpponentGoal < 250) threshold = 60;
    if (distToOpponentGoal < 150) threshold = 40;

    stealFeedback.roll = roll;
    stealFeedback.threshold = threshold;
    stealFeedback.display = true;
    stealFeedback.timer = 60; 

    if (roll > threshold) {
        stealFeedback.status = "STOLEN!";
        let nextTurn = (currentTurn === "Liverpool") ? "Visitors" : "Liverpool";
        logPlay(`INTERCEPTED! Possession to ${nextTurn}!`);
        currentTurn = nextTurn;
    } else {
        stealFeedback.status = "SAFE";
        logPlay(`${currentTurn} moves the ball forward...`);
    }
    lastMoveTime = Date.now();
}

function triggerGoalUI(teamName) {
    goalAnim.active = true;
    goalAnim.timer = 120;
    goalAnim.text = teamName;
}

function checkScoring() {
    if (Math.abs(ball.vx) < 0.8 && Math.abs(ball.vy) < 0.8) {
        let inLeftGoal = (ball.x < 120 && ball.y > 120 && ball.y < 380);
        let inRightGoal = (ball.x > canvas.width - 120 && ball.y > 120 && ball.y < 380);

        if (inLeftGoal || inRightGoal) {
            let goalieRoll = Math.floor(Math.random() * 100) + 1;
            if (goalieRoll <= 50) { 
                let scorer = inLeftGoal ? "Visitors" : "Liverpool";
                if (inLeftGoal) {
                    score.player2++;
                    document.getElementById('visitor-score').innerText = score.player2;
                    currentTurn = "Liverpool"; 
                } else {
                    score.player1++;
                    document.getElementById('lfc-score').innerText = score.player1;
                    currentTurn = "Visitors"; 
                }
                logPlay(`GOAL! ${scorer} have scored!`);
                triggerGoalUI(scorer);
                resetBall();
            } else {
                let defendingTeam = inLeftGoal ? "Liverpool" : "Visitors";
                logPlay(`GREAT SAVE! ${defendingTeam} keeper keeps it out!`);
                stealFeedback.status = "SAVED!";
                stealFeedback.display = true;
                stealFeedback.timer = 90;
                currentTurn = defendingTeam; 
                ball.vx = inLeftGoal ? 15 : -15; 
            }
        }
    }
}

// --- DRAWING ---
function drawPitch() {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 20); ctx.lineTo(canvas.width / 2, canvas.height - 20);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(20, 120, 100, 260); 
    ctx.fillRect(canvas.width - 120, 120, 100, 260);
    ctx.strokeRect(20, 120, 100, 260);
    ctx.strokeRect(canvas.width - 120, 120, 100, 260);
    if (lfcLogo.complete) {
        ctx.save(); ctx.globalAlpha = 0.2;
        ctx.drawImage(lfcLogo, canvas.width/2 - 75, canvas.height/2 - 100, 150, 200);
        ctx.restore();
    }
}

function drawBall() {
    ctx.save();
    ctx.translate(ball.x, ball.y); ctx.rotate(ball.angle);
    ctx.shadowBlur = 10; ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.moveTo(0, -BALL_SIZE); ctx.lineTo(BALL_SIZE, BALL_SIZE); ctx.lineTo(-BALL_SIZE, BALL_SIZE);
    ctx.closePath();
    ctx.fillStyle = "white"; ctx.fill();
    ctx.strokeStyle = (currentTurn === "Liverpool") ? "#f1c40f" : "#333";
    ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
}

function drawPossessionArrow() {
    ctx.save();
    ctx.translate(canvas.width / 2, 50);
    if (currentTurn === "Visitors") ctx.scale(-1, 1);
    ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 4; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.lineTo(20, -10);
    ctx.moveTo(30, 0); ctx.lineTo(20, 10); ctx.stroke();
    ctx.scale(currentTurn === "Visitors" ? -1 : 1, 1);
    ctx.fillStyle = "white"; ctx.font = "bold 12px Arial"; ctx.textAlign = "center";
    ctx.fillText("ATTACK DIRECTION", 0, 25);
    ctx.restore();
}

function drawStealMeter() {
    if (!stealFeedback.display) return;
    ctx.save();
    ctx.font = "bold 24px Arial"; ctx.textAlign = "center";
    ctx.fillStyle = (stealFeedback.status === "SAFE") ? "#2ecc71" : "#f1c40f";
    ctx.fillText(stealFeedback.status, ball.x, ball.y - 60);
    ctx.font = "14px Arial"; ctx.fillStyle = "white";
    ctx.fillText(`Roll: ${stealFeedback.roll} | Limit: ${stealFeedback.threshold}`, ball.x, ball.y - 40);
    ctx.restore();
    stealFeedback.timer--; if (stealFeedback.timer <= 0) stealFeedback.display = false;
}

function drawGoalFlash() {
    if (!goalAnim.active) return;
    ctx.save();
    const flash = Math.floor(goalAnim.timer / 15) % 2 === 0;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 100px Arial Black";
    ctx.fillStyle = flash ? "#C8102E" : "white";
    ctx.strokeStyle = "black"; ctx.lineWidth = 10;
    ctx.strokeText("GOAL!", canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillText("GOAL!", canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = "bold 40px Arial"; ctx.fillStyle = "white";
    ctx.strokeText(goalAnim.text.toUpperCase(), canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText(goalAnim.text.toUpperCase(), canvas.width / 2, canvas.height / 2 + 50);
    ctx.restore();
    goalAnim.timer--; if (goalAnim.timer <= 0) goalAnim.active = false;
}

function update() {
    if (!gameActive) return;
    updateClock();
    ball.x += ball.vx; ball.y += ball.vy;
    ball.vx *= FRICTION; ball.vy *= FRICTION;
    if (ball.x < 0 || ball.x > canvas.width || ball.y < 0 || ball.y > canvas.height) resetBall(true);
    if (Math.abs(ball.vx) < 0.1) ball.vx = 0;
    if (Math.abs(ball.vy) < 0.1) ball.vy = 0;
    checkScoring();
    updateTurnDisplay();
    if (Math.abs(ball.vx) + Math.abs(ball.vy) > 0.1) ball.angle += (ball.vx + ball.vy) * 0.05;
}

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPitch();
    drawPossessionArrow();
    drawBall();
    drawStealMeter();
    drawGoalFlash();
    update();
    requestAnimationFrame(loop);
}

canvas.addEventListener('mousedown', (e) => {
    if(!gameActive) return;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left; startY = e.clientY - rect.top;
    const dist = Math.hypot(startX - ball.x, startY - ball.y);
    if (dist < 40) isDragging = true;
});

window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left; const endY = e.clientY - rect.top;
    const vx = (endX - startX) * PUSH_STRENGTH; const vy = (endY - startY) * PUSH_STRENGTH;
    if ((currentTurn === "Liverpool" && vx < 0) || (currentTurn === "Visitors" && vx > 0)) {
        logPlay("ILLEGAL MOVE: MUST MOVE FORWARD!");
        isDragging = false; return;
    }
    ball.vx = vx; ball.vy = vy;
    isDragging = false; handleSteal();
});

loop();