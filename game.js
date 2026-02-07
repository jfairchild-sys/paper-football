const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const lfcLogo = new Image();
lfcLogo.src = "https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/1200px-Liverpool_FC.svg.png";

const FRICTION = 0.95; 
const BALL_SIZE = 22;
const PUSH_STRENGTH = 0.25;

let score = { player1: 0, player2: 0 };
let currentTurn = Math.random() < 0.5 ? "Liverpool" : "Visitors";
let ball = { x: 400, y: 250, vx: 0, vy: 0, angle: 0 };
let stealFeedback = { display: false, status: "", timer: 0 };
let goalAnim = { active: false, timer: 0, text: "" };

// NEW HALF LOGIC
let matchSeconds = 300; 
let stoppageSeconds = 0;
let currentHalf = 1;
let gameActive = true;
let lastMoveTime = Date.now();
let isDragging = false;
let startX, startY;

function logPlay(msg) {
    const box = document.getElementById('commentary');
    box.innerText = msg.toUpperCase();
    box.style.color = (msg.includes("GOAL") || msg.includes("SAVE")) ? "#f1c40f" : "#2ecc71";
}

function updateClock() {
    if (!gameActive) return;
    if (matchSeconds > 0) matchSeconds -= (1/60);
    else {
        if (stoppageSeconds > 0) {
            document.getElementById('stoppage-display').style.visibility = "visible";
            stoppageSeconds -= (1/60);
        } else {
            handleHalfEnd();
        }
    }
    let m = Math.floor(Math.max(0, matchSeconds) / 60);
    let s = Math.floor(Math.max(0, matchSeconds) % 60);
    document.getElementById('match-clock').innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    document.getElementById('stoppage-time').innerText = Math.ceil(stoppageSeconds);
}

function handleHalfEnd() {
    gameActive = false;
    if (currentHalf === 1) {
        document.getElementById('ht-lfc').innerText = score.player1;
        document.getElementById('ht-vis').innerText = score.player2;
        document.getElementById('ht-summary').style.display = "block";
        logPlay("HALF TIME! CLICK TO START 2ND HALF");
        setTimeout(() => { if(confirm("Start 2nd Half?")) startSecondHalf(); }, 500);
    } else {
        logPlay("FULL TIME!");
        alert(`Match Ended! LFC ${score.player1} - ${score.player2} Visitors`);
    }
}

function startSecondHalf() {
    currentHalf = 2; matchSeconds = 300; stoppageSeconds = 0;
    document.getElementById('stoppage-display').style.visibility = "hidden";
    document.getElementById('half-indicator').innerText = "2ND HALF";
    gameActive = true; resetBall(); logPlay("2nd Half Kick-off!");
}

function resetBall(out = false) {
    if (out) {
        currentTurn = (currentTurn === "Liverpool") ? "Visitors" : "Liverpool";
        ball.x = 100 + Math.random() * 600; ball.y = 100 + Math.random() * 300;
    } else {
        ball.x = 400; ball.y = 250;
    }
    ball.vx = 0; ball.vy = 0; lastMoveTime = Date.now();
}

function handleSteal() {
    let taken = (Date.now() - lastMoveTime) / 1000;
    if (taken > 2) stoppageSeconds += (taken - 2);
    let roll = Math.floor(Math.random() * 100) + 1;
    let dist = (currentTurn === "Liverpool") ? (800 - ball.x) : ball.x;
    let thresh = dist < 150 ? 40 : (dist < 250 ? 60 : 80);
    if (roll > thresh) {
        currentTurn = (currentTurn === "Liverpool") ? "Visitors" : "Liverpool";
        stealFeedback = { display: true, status: "STOLEN!", timer: 60 };
        logPlay("INTERCEPTED!");
    } else {
        stealFeedback = { display: true, status: "SAFE", timer: 60 };
    }
    lastMoveTime = Date.now();
}

function checkScoring() {
    if (Math.abs(ball.vx) < 0.8 && Math.abs(ball.vy) < 0.8) {
        let inL = (ball.x < 120 && ball.y > 120 && ball.y < 380);
        let inR = (ball.x > 680 && ball.y > 120 && ball.y < 380);
        if (inL || inR) {
            if (Math.random() < 0.5) { // 50% Scoring Chance
                let team = inL ? "Visitors" : "Liverpool";
                if (inL) { score.player2++; document.getElementById('visitor-score').innerText = score.player2; currentTurn = "Liverpool"; }
                else { score.player1++; document.getElementById('lfc-score').innerText = score.player1; currentTurn = "Visitors"; }
                goalAnim = { active: true, timer: 120, text: team };
                logPlay("GOAL!"); resetBall();
            } else {
                let def = inL ? "Liverpool" : "Visitors";
                logPlay("BIG SAVE!"); currentTurn = def; ball.vx = inL ? 15 : -15;
            }
        }
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
    // Ball
    ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ball.angle);
    ctx.beginPath(); ctx.moveTo(0,-22); ctx.lineTo(22,22); ctx.lineTo(-22,22); ctx.closePath();
    ctx.fillStyle="white"; ctx.fill(); ctx.strokeStyle=(currentTurn==="Liverpool"?"#f1c40f":"#333"); ctx.stroke(); ctx.restore();
    // Goal Flash
    if(goalAnim.active){
        ctx.fillStyle = (Math.floor(goalAnim.timer/15)%2===0) ? "#C8102E" : "white";
        ctx.font="bold 80px Arial"; ctx.textAlign="center"; ctx.fillText("GOAL!", 400, 200);
        ctx.font="bold 30px Arial"; ctx.fillText(goalAnim.text.toUpperCase(), 400, 250);
        goalAnim.timer--; if(goalAnim.timer<=0) goalAnim.active=false;
    }
}

function loop() {
    updateClock();
    ball.x+=ball.vx; ball.y+=ball.vy; ball.vx*=FRICTION; ball.vy*=FRICTION;
    if(ball.x<0||ball.x>800||ball.y<0||ball.y>500) resetBall(true);
    ball.angle += (Math.abs(ball.vx)+Math.abs(ball.vy))*0.05;
    checkScoring(); draw(); requestAnimationFrame(loop);
}

canvas.addEventListener('mousedown', (e) => {
    if(!gameActive) return;
    const r = canvas.getBoundingClientRect();
    startX = e.clientX - r.left; startY = e.clientY - r.top;
    if(Math.hypot(startX-ball.x, startY-ball.y)<40) isDragging=true;
});

window.addEventListener('mouseup', (e) => {
    if(!isDragging) return;
    const r = canvas.getBoundingClientRect();
    let vx = (e.clientX-r.left-startX)*0.25, vy = (e.clientY-r.top-startY)*0.25;
    if((currentTurn==="Liverpool"&&vx<0)||(currentTurn==="Visitors"&&vx>0)){ logPlay("MUST MOVE FORWARD!"); isDragging=false; return; }
    ball.vx=vx; ball.vy=vy; isDragging=false; handleSteal();
});

loop();
