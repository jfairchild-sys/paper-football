const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const lfcLogo = new Image();
lfcLogo.src = "https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/1200px-Liverpool_FC.svg.png";

// --- AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    if (type === 'whistle' || type === 'whistle-long') {
        const duration = type === 'whistle-long' ? 2.0 : 0.5;
        const lfo = audioCtx.createOscillator(); 
        const lfoGain = audioCtx.createGain();
        osc1.type = 'sine'; osc2.type = 'sine';
        osc1.frequency.setValueAtTime(2500, audioCtx.currentTime); 
        osc2.frequency.setValueAtTime(2515, audioCtx.currentTime); 
        lfo.frequency.value = 30; lfoGain.gain.value = 50; 
        lfo.connect(lfoGain); lfoGain.connect(osc1.frequency); lfoGain.connect(osc2.frequency);
        osc1.connect(gain); osc2.connect(gain); gain.connect(audioCtx.destination);
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime + (duration - 0.1));
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        lfo.start(); osc1.start(); osc2.start();
        osc1.stop(audioCtx.currentTime + duration); osc2.stop(audioCtx.currentTime + duration);
    } else if (type === 'flick') {
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc1.connect(gain); gain.connect(audioCtx.destination);
        osc1.start(); osc1.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'goal') {
        const bufferSize = audioCtx.sampleRate * 2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.setValueAtTime(1500, audioCtx.currentTime);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.2, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2);
        noise.connect(filter); filter.connect(g); g.connect(audioCtx.destination);
        noise.start();
    }
}

// --- STATE & ROSTERS ---
const FRICTION = 0.95; 
let visitorTeamName = "Visitors";
let score = { player1: 0, player2: 0 };
let currentTurn = "Liverpool"; 
let ball = { x: 400, y: 250, vx: 0, vy: 0, angle: 0 };
let stealFeedback = { display: false, status: "", timer: 0 };
let goalAnim = { active: false, timer: 0, text: "" };
let matchSeconds = 10; 
let stoppageSeconds = 0;
let currentHalf = 1;
let gameActive = false; 
let isFoulPause = false;
let isGoldenGoal = false;
let goalScored = false;
let lastMoveTime = Date.now();
let lastX = 0, lastY = 0, lastTime = 0;

const lfcRoster = ["Salah", "Van Dijk", "Alisson", "Mac Allister", "Alexander-Arnold"];
const keeperMap = {
    "Liverpool": ["Alisson", "Becker", "Alisson the Brick Wall!"],
    "Aston Villa": ["Emiliano Martínez"], "Man City": ["Ederson"],
    "Man United": ["André Onana"], "Arsenal": ["David Raya"], "Chelsea": ["Robert Sánchez"]
};

// --- CORE FUNCTIONS ---
function startGame(team) {
    visitorTeamName = team;
    document.getElementById('vis-name-label').innerText = team.toUpperCase();
    document.getElementById('team-select-overlay').style.display = "none";
    gameActive = true;
    currentTurn = Math.random() < 0.5 ? "Liverpool" : visitorTeamName;
    playSound('whistle');
    logPlay(`Kick-off! ${currentTurn} starts.`);
    loop();
}

function updateClock() {
    if (!gameActive || isGoldenGoal) return;
    if (matchSeconds > 0) matchSeconds -= (1/60);
    else {
        if (stoppageSeconds > 0) {
            document.getElementById('stoppage-display').style.visibility = "visible";
            stoppageSeconds -= (1/60);
        } else handleHalfEnd();
    }
    const clockEl = document.getElementById('match-clock');
    if (clockEl) {
        let m = Math.floor(Math.max(0, matchSeconds) / 60);
        let s = Math.floor(Math.max(0, matchSeconds) % 60);
        clockEl.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }
}

function logPlay(msg) {
    const box = document.getElementById('commentary');
    if (box) box.innerText = msg.toUpperCase();
}

function handleSteal() {
    playSound('flick');
    let taken = (Date.now() - lastMoveTime) / 1000;
    if (taken > 2) stoppageSeconds += (taken - 2);
    let roll = Math.floor(Math.random() * 100) + 1;
    let dist = (currentTurn === "Liverpool") ? (800 - ball.x) : ball.x;
    let thresh = dist < 150 ? 40 : (dist < 250 ? 60 : 80);

    if (roll > thresh) {
        let foulRoll = Math.floor(Math.random() * 100) + 1;
        if (foulRoll <= 55) handleFoul(foulRoll);
        else {
            currentTurn = (currentTurn === "Liverpool") ? visitorTeamName : "Liverpool";
            stealFeedback = { display: true, status: "STOLEN!", timer: 60 };
            logPlay(`${currentTurn} win it back!`);
        }
    } else {
        stealFeedback = { display: true, status: "SAFE", timer: 60 };
    }
    lastMoveTime = Date.now();
}

function handleFoul(roll) {
    let type = ""; let isPenalty = false; isFoulPause = true;
    if (roll <= 5) { type = "RED CARD!"; isPenalty = true; playSound('whistle'); }
    else if (roll <= 25) type = "YELLOW CARD!";
    else type = "FOUL!";
    if (ball.x < 120 || ball.x > 680) isPenalty = true;
    if (isPenalty) { logPlay(`${type} - PENALTY KICK!`); setupPenaltyKick(); }
    else { logPlay(`${type} - FREE FLICK.`); ball.vx = 0; ball.vy = 0; setTimeout(() => { isFoulPause = false; }, 1000); }
    stealFeedback = { display: true, status: type, timer: 120 };
}

function setupPenaltyKick() {
    ball.vx = 0; ball.vy = 0;
    setTimeout(() => {
        ball.y = 250; ball.x = (currentTurn === "Liverpool") ? 650 : 150; 
        logPlay("PENALTY SPOT: SWIPE TO SCORE!"); isFoulPause = false; 
    }, 1500);
}

function checkScoring() {
    if (goalScored) return;
    let inL = (ball.x < 120 && ball.y > 120 && ball.y < 380);
    let inR = (ball.x > 680 && ball.y > 120 && ball.y < 380);
        
    if (inL || inR) {
        if (Math.random() < 0.5) { 
            goalScored = true; playSound('goal');
            let team = inL ? visitorTeamName : "Liverpool";
            if (inL) { score.player2++; document.getElementById('visitor-score').innerText = score.player2; }
            else { score.player1++; document.getElementById('lfc-score').innerText = score.player1; }
            
            goalAnim = { active: true, timer: 120, text: team };
            logPlay(`GOAL FOR ${team.toUpperCase()}!`);
            if (isGoldenGoal) {
                setTimeout(() => { isGoldenGoal = false; finishMatch(); goalScored = false; }, 2000);
            } else {
                setTimeout(() => { currentTurn = inL ? "Liverpool" : visitorTeamName; resetBall(); goalScored = false; }, 2000);
            }
        } else {
            let defTeam = inL ? "Liverpool" : visitorTeamName;
            let names = keeperMap[defTeam] || ["The Keeper"];
            logPlay(`SAVE BY ${names[Math.floor(Math.random()*names.length)].toUpperCase()}!`);
            stealFeedback = { display: true, status: "SAVED!", timer: 60 };
            ball.vx = inL ? 18 : -18; ball.vy = (Math.random() - 0.5) * 10;
            currentTurn = defTeam;
        }
    }
}

function resetBall(out = false) {
    if (out) currentTurn = (currentTurn === "Liverpool") ? visitorTeamName : "Liverpool";
    ball.x = 400; ball.y = 250; ball.vx = 0; ball.vy = 0;
}

function handleHalfEnd() {
    if (currentHalf === 1) {
        gameActive = false;
        document.getElementById('ht-lfc').innerText = score.player1;
        document.getElementById('ht-vis').innerText = score.player2;
        document.getElementById('ht-summary').style.display = "block";
        logPlay("HALF TIME!");
        setTimeout(() => { if(confirm("Start 2nd Half?")) startSecondHalf(); }, 1000);
    } else {
        if (score.player1 === score.player2) triggerGoldenGoal();
        else finishMatch();
    }
}

function triggerGoldenGoal() {
    isGoldenGoal = true;
    logPlay("GOLDEN GOAL! NEXT SCORE WINS!");
    playSound('whistle-long');
}

function finishMatch() {
    gameActive = false;
    playSound('whistle');
    setTimeout(() => playSound('whistle'), 700);
    setTimeout(() => playSound('whistle-long'), 1400);
    setTimeout(showTrophyLift, 2000);
}

function startSecondHalf() {
    currentHalf = 2; matchSeconds = 10; stoppageSeconds = 0;
    document.getElementById('stoppage-display').style.visibility = "hidden";
    document.getElementById('half-indicator').innerText = "2ND HALF";
    gameActive = true; resetBall(); playSound('whistle');
    requestAnimationFrame(loop);
}

function showTrophyLift() {
    const winner = score.player1 > score.player2 ? "LIVERPOOL" : visitorTeamName.toUpperCase();
    const overlay = document.createElement('div');
    overlay.style = "position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(200,16,46,0.95); display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:500; color:white; font-family:'Arial Black'; text-align:center;";
    overlay.innerHTML = `<h1 style="font-size:4em; color:#f1c40f;">CHAMPIONS!</h1><div style="font-size:100px;">🏆</div><h2>${winner}</h2><p>${score.player1} - ${score.player2}</p><button onclick="location.reload()" style="margin-top:40px; padding:20px 40px; background:#f1c40f; color:#C8102E; border:none; font-size:1.5em; cursor:pointer; border-radius:10px;">PLAY AGAIN</button>`;
    document.body.appendChild(overlay);
    for(let i=0; i<3; i++) setTimeout(() => playSound('goal'), i * 800);
}

function draw() {
    ctx.clearRect(0,0,800,500);
    ctx.strokeStyle="white"; ctx.lineWidth=4; ctx.strokeRect(20,20,760,460);
    ctx.beginPath(); ctx.moveTo(400,20); ctx.lineTo(400,480); ctx.stroke();
    ctx.beginPath(); ctx.arc(400,250,70,0,Math.PI*2); ctx.stroke();
    
    // Goals
    ctx.fillStyle = (currentTurn === visitorTeamName) ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(20, 120, 100, 260); ctx.strokeRect(20, 120, 100, 260);
    ctx.fillStyle = (currentTurn === "Liverpool") ? "rgba(241, 196, 15, 0.2)" : "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(680, 120, 100, 260); ctx.strokeRect(680, 120, 100, 260);

    if(lfcLogo.complete){ctx.globalAlpha=0.15; ctx.drawImage(lfcLogo,325,150,150,200); ctx.globalAlpha=1;}
    
    // Possession Arrow
    ctx.save(); ctx.translate(400, 50); if (currentTurn === visitorTeamName) ctx.scale(-1, 1);
    ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(40, 0); ctx.lineTo(25, -15); ctx.moveTo(40, 0); ctx.lineTo(25, 15); ctx.stroke(); ctx.restore();

    // Ball
    ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ball.angle);
    ctx.beginPath(); ctx.moveTo(0,-22); ctx.lineTo(22,22); ctx.lineTo(-22,22); ctx.closePath();
    ctx.fillStyle="white"; ctx.fill(); ctx.strokeStyle=(currentTurn==="Liverpool"?"#f1c40f":"#333"); ctx.lineWidth=3; ctx.stroke(); ctx.restore();

    if (isGoldenGoal) {
        ctx.fillStyle = "#f1c40f"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center"; ctx.fillText("✨ GOLDEN GOAL ✨", 400, 30);
    }

    if (stealFeedback.display) {
        ctx.save(); if(stealFeedback.status.includes("CARD")) {
            ctx.fillStyle = stealFeedback.status.includes("RED") ? "red" : "yellow";
            ctx.fillRect(720, 40, 40, 60); ctx.strokeRect(720, 40, 40, 60);
        }
        ctx.fillStyle = "white"; ctx.font = "bold 24px Arial"; ctx.textAlign = "center";
        ctx.fillText(stealFeedback.status, ball.x, ball.y - 60); ctx.restore();
        stealFeedback.timer--; if (stealFeedback.timer <= 0) stealFeedback.display = false;
    }

    if(goalAnim.active){
        ctx.save(); const flash = Math.floor(goalAnim.timer/15)%2===0;
        ctx.fillStyle = flash ? "#C8102E" : "white"; ctx.font="bold 80px Arial"; ctx.textAlign="center"; ctx.fillText("GOAL!", 400, 250); ctx.restore();
        goalAnim.timer--; if(goalAnim.timer <= 0) goalAnim.active = false;
    }
}

function loop() {
    if (!gameActive) return;
    updateClock();
    ball.x+=ball.vx; ball.y+=ball.vy; ball.vx*=FRICTION; ball.vy*=FRICTION;
    if(ball.x<0||ball.x>800||ball.y<0||ball.y>500) resetBall(true);
    checkScoring(); draw(); requestAnimationFrame(loop);
}

canvas.addEventListener('mousemove', (e) => {
    if (!gameActive || isFoulPause) return;
    const r = canvas.getBoundingClientRect();
    const currX = e.clientX - r.left, currY = e.clientY - r.top, currTime = Date.now();
    const dist = Math.hypot(currX - ball.x, currY - ball.y);
    if (dist < 45 && (Math.abs(ball.vx) + Math.abs(ball.vy) < 0.5)) {
        const timeDiff = (currTime - lastTime) / 1000;
        if (timeDiff > 0) {
            let vx = (currX - lastX) / (timeDiff * 150), vy = (currY - lastY) / (timeDiff * 150);
            const isLfcTurn = (currentTurn === "Liverpool" && vx > 2);
            const isVisTurn = (currentTurn === visitorTeamName && vx < -2);
            if (isLfcTurn || isVisTurn) { ball.vx = vx; ball.vy = vy; handleSteal(); }
        }
    }
    lastX = currX; lastY = currY; lastTime = currTime;
});
