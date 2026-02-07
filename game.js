const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const lfcLogo = new Image();
lfcLogo.src = "https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/1200px-Liverpool_FC.svg.png";

// --- AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();

if (type === 'whistle') {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const lfo = audioCtx.createOscillator(); 
        const lfoGain = audioCtx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        
        osc1.frequency.setValueAtTime(2500, audioCtx.currentTime); 
        osc2.frequency.setValueAtTime(2515, audioCtx.currentTime); 

        lfo.frequency.value = 30; 
        lfoGain.gain.value = 50; 
        lfo.connect(lfoGain);
        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2500;
        filter.Q.value = 1;

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(filter);
        filter.connect(audioCtx.destination);

        // --- UPDATED TIMING FOR 1 FULL SECOND ---
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05); // Sharp start
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime + 0.8);          // Hold for 0.8s
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.0); // Fade out by 1s

        lfo.start();
        osc1.start();
        osc2.start();
        
        osc1.stop(audioCtx.currentTime + 1.0);
        osc2.stop(audioCtx.currentTime + 1.0);
        lfo.stop(audioCtx.currentTime + 1.0);
    }else if (type === 'flick') {
        // Keeping your flick sound the same
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);

    } else if (type === 'goal') {
        // Enhanced "Crowd Roar" using a wider noise buffer
        const bufferSize = audioCtx.sampleRate * 2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1500, audioCtx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 2);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.2, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2);
        noise.connect(filter);
        filter.connect(g);
        g.connect(audioCtx.destination);
        noise.start();
    }
}

// --- CONSTANTS & STATE ---
const FRICTION = 0.95; 
const BALL_SIZE = 22;
const PUSH_STRENGTH = 0.25;

let visitorTeamName = "Visitors";
let score = { player1: 0, player2: 0 };
let currentTurn = "Liverpool"; 
let ball = { x: 400, y: 250, vx: 0, vy: 0, angle: 0 };
let stealFeedback = { display: false, status: "", timer: 0 };
let goalAnim = { active: false, timer: 0, text: "" };

const lfcRoster = ["Salah", "Van Dijk", "Ekitike", "Mac Allister", "Alexander-Arnold"];
const keeperMap = {
    "Liverpool": ["Alisson", "Becker", "Alisson the Brick Wall!"],
    "Aston Villa": ["Emiliano Martínez"],
    "Man City": ["Ederson"],
    "Man United": ["André Onana"],
    "Arsenal": ["David Raya"],
    "Chelsea": ["Robert Sánchez"]
};

const stealPhrases = ["snatches the ball away!", "with a brilliant interception!", "picks their pocket!", "wins the battle for possession!", "reads the play perfectly!"];
const movePhrases = ["drives forward!", "looks for an opening...", "threads the needle!", "advances the play.", "is looking dangerous!"];

let matchSeconds = 300; 
let stoppageSeconds = 0;
let currentHalf = 1;
let gameActive = false; 
let lastMoveTime = Date.now();
let isDragging = false;
let startX, startY;

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

function logPlay(msg) {
    const box = document.getElementById('commentary');
    if (box) {
        box.innerText = msg.toUpperCase();
        box.style.color = (msg.includes("GOAL") || msg.includes("SAVE")) ? "#f1c40f" : "#2ecc71";
    }
}

function updateClock() {
    if (!gameActive) return;
    if (matchSeconds > 0) matchSeconds -= (1/60);
    else {
        if (stoppageSeconds > 0) {
            document.getElementById('stoppage-display').style.visibility = "visible";
            stoppageSeconds -= (1/60);
        } else handleHalfEnd();
    }
    const m = Math.floor(Math.max(0, matchSeconds) / 60);
    const s = Math.floor(Math.max(0, matchSeconds) % 60);
    document.getElementById('match-clock').innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    document.getElementById('stoppage-time').innerText = Math.ceil(stoppageSeconds);
}

function handleHalfEnd() {
    gameActive = false;
    document.getElementById('ht-lfc').innerText = score.player1;
    document.getElementById('ht-vis').innerText = score.player2;
    document.getElementById('ht-summary').style.display = "block";
    if (currentHalf === 1) {
        logPlay("HALF TIME!");
        setTimeout(() => { if(confirm("Start 2nd Half?")) startSecondHalf(); }, 500);
    } else {
        logPlay("FULL TIME!");
        alert(`Final: LFC ${score.player1} - ${score.player2} ${visitorTeamName}`);
    }
}

function startSecondHalf() {
    currentHalf = 2; matchSeconds = 300; stoppageSeconds = 0;
    document.getElementById('stoppage-display').style.visibility = "hidden";
    document.getElementById('half-indicator').innerText = "2ND HALF";
    gameActive = true; resetBall(); playSound('whistle');
}

function resetBall(out = false) {
    if (out) {
        currentTurn = (currentTurn === "Liverpool") ? visitorTeamName : "Liverpool";
        ball.x = 100 + Math.random() * 600; ball.y = 100 + Math.random() * 300;
    } else {
        ball.x = 400; ball.y = 250;
    }
    ball.vx = 0; ball.vy = 0; lastMoveTime = Date.now();
    updateTurnDisplay();
}

function handleSteal() {
    playSound('flick');
    let taken = (Date.now() - lastMoveTime) / 1000;
    if (taken > 2) stoppageSeconds += (taken - 2);

    let roll = Math.floor(Math.random() * 100) + 1;
    let dist = (currentTurn === "Liverpool") ? (800 - ball.x) : ball.x;
    let thresh = dist < 150 ? 40 : (dist < 250 ? 60 : 80);

    const lfcPlayer = lfcRoster[Math.floor(Math.random() * lfcRoster.length)];

    if (roll > thresh) {
        // A steal attempt happened... let's check for a FOUL
        let foulRoll = Math.floor(Math.random() * 100) + 1;

        if (foulRoll <= 55) { // 5% Red + 20% Yellow + 30% Normal = 55% total foul chance on steals
            handleFoul(foulRoll, lfcPlayer);
        } else {
            // Clean Steal
            currentTurn = (currentTurn === "Liverpool") ? visitorTeamName : "Liverpool";
            stealFeedback = { display: true, status: "STOLEN!", timer: 60 };
            logPlay(currentTurn === "Liverpool" ? `${lfcPlayer} win it back cleanly!` : `${visitorTeamName} intercepts!`);
        }
    } else {
        // Safe play
        stealFeedback = { display: true, status: "SAFE", timer: 60 };
        logPlay(currentTurn === "Liverpool" ? `${lfcPlayer} keeps possession.` : `${visitorTeamName} moving well.`);
    }
    lastMoveTime = Date.now();
}

function handleFoul(roll, player) {
    let type = "";
    let isPenalty = false;

    if (roll <= 5) {
        type = "RED CARD! SENT OFF!";
        isPenalty = true;
        playSound('whistle'); // Extra whistle for drama
    } else if (roll <= 25) {
        type = "YELLOW CARD!";
    } else {
        type = "FOUL!";
    }

    // Check if foul happened in the penalty area
    if (ball.x < 120 || ball.x > 680) isPenalty = true;

    if (isPenalty) {
        logPlay(`${type} PENALTY GIVEN TO ${currentTurn.toUpperCase()}!`);
        setupPenaltyKick();
    } else {
        logPlay(`${type} Free flick for ${currentTurn.toUpperCase()}.`);
        ball.vx = 0; ball.vy = 0; // Stop ball for free flick
    }
    
    stealFeedback = { display: true, status: type, timer: 90 };
}

function setupPenaltyKick() {
    gameActive = false; // Pause briefly
    setTimeout(() => {
        ball.vx = 0; ball.vy = 0;
        ball.y = 250; // Center vertically
        // Place on the penalty spot
        ball.x = (currentTurn === "Liverpool") ? 650 : 150; 
        logPlay("PENALTY SPOT: TAKE YOUR SHOT!");
        gameActive = true;
    }, 1000);
}

function checkScoring() {
    if (Math.abs(ball.vx) < 0.8 && Math.abs(ball.vy) < 0.8) {
        let inL = (ball.x < 120 && ball.y > 120 && ball.y < 380);
        let inR = (ball.x > 680 && ball.y > 120 && ball.y < 380);
        if (inL || inR) {
            if (Math.random() < 0.5) { 
                playSound('goal');
                let team = inL ? visitorTeamName : "Liverpool";
                if (inL) { score.player2++; document.getElementById('visitor-score').innerText = score.player2; currentTurn = "Liverpool"; }
                else { score.player1++; document.getElementById('lfc-score').innerText = score.player1; currentTurn = visitorTeamName; }
                goalAnim = { active: true, timer: 120, text: team };
                logPlay(`GOAL FOR ${team.toUpperCase()}!`); resetBall();
            } else {
                let defTeam = inL ? "Liverpool" : visitorTeamName;
                let names = keeperMap[defTeam] || ["The Keeper"];
                let name = names[Math.floor(Math.random() * names.length)];
                logPlay(`SAVE BY ${name.toUpperCase()}!`);
                stealFeedback = { display: true, status: "SAVED!", timer: 90 };
                currentTurn = defTeam; ball.vx = inL ? 15 : -15;
            }
        }
    }
}

function updateTurnDisplay() {
    const lfcEl = document.getElementById('lfc-score');
    const visEl = document.getElementById('visitor-score');
    if(lfcEl && visEl) {
        lfcEl.parentElement.style.color = (currentTurn === "Liverpool") ? "#f1c40f" : "white";
        visEl.parentElement.style.color = (currentTurn === visitorTeamName) ? "#f1c40f" : "white";
    }
}

function draw() {
    ctx.clearRect(0,0,800,500);
    // Pitch
    ctx.strokeStyle="white"; ctx.lineWidth=4; ctx.strokeRect(20,20,760,460);
    ctx.beginPath(); ctx.moveTo(400,20); ctx.lineTo(400,480); ctx.stroke();
    ctx.beginPath(); ctx.arc(400,250,70,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,0.1)"; ctx.fillRect(20,120,100,260); ctx.fillRect(680,120,100,260);
    if(lfcLogo.complete){ctx.globalAlpha=0.2; ctx.drawImage(lfcLogo,325,150,150,200); ctx.globalAlpha=1;}
    
    // Possession Arrow
    ctx.save();
    ctx.translate(400, 50);
    if (currentTurn === visitorTeamName) ctx.scale(-1, 1);
    ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 4; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.lineTo(20, -10);
    ctx.moveTo(30, 0); ctx.lineTo(20, 10); ctx.stroke();
    ctx.restore();

    // Ball
    ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ball.angle);
    ctx.beginPath(); ctx.moveTo(0,-22); ctx.lineTo(22,22); ctx.lineTo(-22,22); ctx.closePath();
    ctx.fillStyle="white"; ctx.fill(); ctx.strokeStyle=(currentTurn==="Liverpool"?"#f1c40f":"#333"); ctx.lineWidth=3; ctx.stroke(); ctx.restore();

    // UI Feedback
    if (stealFeedback.display) {
        ctx.save(); ctx.font = "bold 24px Arial"; ctx.textAlign = "center";
        ctx.fillStyle = (stealFeedback.status === "SAFE") ? "#2ecc71" : "#f1c40f";
        ctx.fillText(stealFeedback.status, ball.x, ball.y - 60); ctx.restore();
        stealFeedback.timer--; if (stealFeedback.timer <= 0) stealFeedback.display = false;
    }
    if(goalAnim.active){
        ctx.save();
        const flash = Math.floor(goalAnim.timer/15)%2===0;
        ctx.fillStyle = flash ? "#C8102E" : "white";
        ctx.font="bold 80px Arial"; ctx.textAlign="center"; ctx.fillText("GOAL!", 400, 200);
        ctx.font="bold 30px Arial"; ctx.fillStyle="white"; ctx.fillText(goalAnim.text.toUpperCase(), 400, 250);
        ctx.restore();
        goalAnim.timer--; if(goalAnim.timer<=0) goalAnim.active=false;
    }
}

function loop() {
    if (!gameActive) return;
    updateClock();
    ball.x+=ball.vx; ball.y+=ball.vy; ball.vx*=FRICTION; ball.vy*=FRICTION;
    if(ball.x<0||ball.x>800||ball.y<0||ball.y>500) resetBall(true);
    ball.angle += (Math.abs(ball.vx)+Math.abs(ball.vy))*0.05;
    checkScoring(); updateTurnDisplay(); draw(); requestAnimationFrame(loop);
}

// --- CLICK-FREE SWIPE INPUTS ---
let lastX = 0;
let lastY = 0;
let lastTime = 0;

canvas.addEventListener('mousemove', (e) => {
    if (!gameActive) return;

    const r = canvas.getBoundingClientRect();
    const currX = e.clientX - r.left;
    const currY = e.clientY - r.top;
    const currTime = Date.now();

    // 1. Calculate the distance between the mouse and the ball
    const dist = Math.hypot(currX - ball.x, currY - ball.y);

    // 2. If the mouse is moving through the ball
    if (dist < 40 && (Math.abs(ball.vx) + Math.abs(ball.vy) < 0.5)) {
        
        // Calculate velocity based on movement since the last mouse frame
        const timeDiff = (currTime - lastTime) / 1000; // in seconds
        if (timeDiff > 0) {
            let vx = (currX - lastX) / (timeDiff * 150); 
            let vy = (currY - lastY) / (timeDiff * 150);

            // Cap the speed
            const maxSpeed = 28;
            vx = Math.max(-maxSpeed, Math.min(maxSpeed, vx));
            vy = Math.max(-maxSpeed, Math.min(maxSpeed, vy));

            // Direction Check: Only trigger if flicking the right way
            const isLfcTurn = (currentTurn === "Liverpool" && vx > 2);
            const isVisTurn = (currentTurn === visitorTeamName && vx < -2);

            if (isLfcTurn || isVisTurn) {
                ball.vx = vx;
                ball.vy = vy;
                handleSteal(); // This triggers the whistle/flick sound and turn logic
            } else if (Math.abs(vx) > 2) {
                logPlay("ILLEGAL MOVE: MUST FLICK FORWARD!");
            }
        }
    }

    // Update trackers for the next frame
    lastX = currX;
    lastY = currY;
    lastTime = currTime;
});
