(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const canvas = $("pitch");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const menu = $("menu"), gameScreen = $("gameScreen"), resultScreen = $("resultScreen");
  const keys = new Set();
  let home = [], away = [], ball, scoreHome = 0, scoreAway = 0;
  let active = 0, duration = 120, timeLeft = 120, lastTime = 0;
  let running = false, paused = false, matchOver = false, goalPause = 0;
  let selectedTeam = "blue", soundOn = true, audioCtx = null;
  let messageTimer = 0;

  const teamInfo = {
    blue: { name: "DTECH UNITED", shirt: "#1688ed", trim: "#b8e7ff", badge: "D" },
    red: { name: "LIONS FC", shirt: "#e34e59", trim: "#ffd1d1", badge: "L" },
    green: { name: "EMERALD CITY", shirt: "#12a879", trim: "#c4ffe5", badge: "E" }
  };
  const formations = [
    [ {x:160,y:310}, {x:350,y:150}, {x:350,y:310}, {x:350,y:470}, {x:80,y:310} ],
    [ {x:840,y:310}, {x:650,y:150}, {x:650,y:310}, {x:650,y:470}, {x:920,y:310} ]
  ];

  function beep(freq=440, length=.12, type="sine") {
    if (!soundOn) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = type; osc.frequency.value = freq; gain.gain.setValueAtTime(.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + length);
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + length);
    } catch (_) {}
  }
  function setStatus(text, seconds=2.5) { $("statusText").textContent = text; messageTimer = seconds; }
  function makePlayer(team, index, x, y) {
    return { team, index, x, y, homeX:x, homeY:y, vx:0, vy:0, r:15, speed:team===0?190:170, hasBall:false };
  }
  function resetPositions() {
    home = formations[0].map((p,i)=>makePlayer(0,i,p.x,p.y));
    away = formations[1].map((p,i)=>makePlayer(1,i,p.x,p.y));
    ball = {x:W/2,y:H/2,vx:0,vy:0,r:8,lastTouch:0};
    active = 2; home[active].x = 430; home[active].y = 310;
    home[0].x = 175; home[0].y = 310;
    away[0].x = 825; away[0].y = 310;
    giveBallTo(home[active]);
  }
  function giveBallTo(player) {
    if (!player) return;
    [...home,...away].forEach(p=>p.hasBall=false);
    player.hasBall=true; ball.x=player.x+(player.team===0?17:-17); ball.y=player.y; ball.vx=0; ball.vy=0; ball.lastTouch=player.team;
  }
  function startMatch() {
    selectedTeam = $("teamSelect").value;
    duration = Number($("durationSelect").value); timeLeft=duration;
    scoreHome=0; scoreAway=0; paused=false; matchOver=false; goalPause=0;
    resetPositions();
    $("homeName").textContent=teamInfo[selectedTeam].name;
    $("homeBadge").textContent=teamInfo[selectedTeam].badge;
    $("homeBadge").style.background=teamInfo[selectedTeam].shirt;
    updateScore(); updateClock();
    menu.classList.add("hidden"); resultScreen.classList.add("hidden"); gameScreen.classList.remove("hidden");
    setStatus("Kick-off! Move your player and attack.",4);
    running=true; lastTime=performance.now(); requestAnimationFrame(loop);
  }
  function updateScore(){ $("homeScore").textContent=scoreHome; $("awayScore").textContent=scoreAway; }
  function updateClock(){ const s=Math.max(0,Math.ceil(timeLeft)); $("matchClock").textContent=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function norm(x,y){const m=Math.hypot(x,y)||1;return [x/m,y/m];}
  function movePlayer(p,dx,dy,dt,sprint=false) {
    const [nx,ny]=norm(dx,dy); const moving=!!(dx||dy);
    const speed=p.speed*(sprint?1.38:1);
    p.vx=moving?nx*speed:0; p.vy=moving?ny*speed:0;
    p.x=clamp(p.x+p.vx*dt,30,W-30); p.y=clamp(p.y+p.vy*dt,30,H-30);
  }
  function shoot(player) {
    if (!player.hasBall || goalPause>0) return;
    let dx=0,dy=0;
    if(keys.has("arrowup")||keys.has("w"))dy=-.35;
    if(keys.has("arrowdown")||keys.has("s"))dy=.35;
    if(keys.has("arrowleft")||keys.has("a"))dx=-.35;
    if(keys.has("arrowright")||keys.has("d"))dx=.35;
    if(!dx&&!dy)dx=1;
    const [nx,ny]=norm(dx,dy);
    [...home,...away].forEach(p=>p.hasBall=false);
    ball.x=player.x+nx*22; ball.y=player.y+ny*22;
    ball.vx=nx*510; ball.vy=ny*510; ball.lastTouch=player.team;
    beep(240,.16,"triangle"); setStatus("Shot taken!",1.2);
  }
  function switchPlayer(){
    const candidates=home.map((p,i)=>({p,i})).filter(o=>o.i!==active);
    candidates.sort((a,b)=>Math.hypot(a.p.x-ball.x,a.p.y-ball.y)-Math.hypot(b.p.x-ball.x,b.p.y-ball.y));
    if(candidates.length){active=candidates[0].i;setStatus(`You control player ${active+1}.`,1.2);}
  }
  function nearest(players,x,y){return players.reduce((best,p)=>!best||Math.hypot(p.x-x,p.y-y)<Math.hypot(best.x-x,best.y-y)?p:best,null);}
  function updateAI(dt) {
    const carrier=home.find(p=>p.hasBall);
    away.forEach((p,i)=>{
      let tx=p.homeX,ty=p.homeY;
      if(ball.x>W*.42 || (carrier && Math.hypot(p.x-ball.x,p.y-ball.y)<250)){tx=ball.x+(i===0?35:0);ty=ball.y+(i-2)*16;}
      if(p.hasBall){tx=ball.x-95;ty=H/2+(ball.y-H/2)*.5;}
      const dx=tx-p.x,dy=ty-p.y;
      movePlayer(p,Math.abs(dx)>8?dx:0,Math.abs(dy)>8?dy:0,dt,false);
    });
    // CPU ball carrier makes decisions and shoots toward the home goal.
    const cpuCarrier=away.find(p=>p.hasBall);
    if(cpuCarrier){
      const d=Math.hypot(cpuCarrier.x-115,cpuCarrier.y-H/2);
      if(d<250 && Math.random()<.018){const [nx,ny]=norm(-1,(H/2-cpuCarrier.y)*.002);[...home,...away].forEach(p=>p.hasBall=false);ball.x=cpuCarrier.x-20;ball.y=cpuCarrier.y;ball.vx=nx*420;ball.vy=ny*420;ball.lastTouch=1;beep(220,.1);}
      else movePlayer(cpuCarrier,-1,(H/2-cpuCarrier.y)*.002,dt);
    }
  }
  function updateBall(dt) {
    const carrier=[...home,...away].find(p=>p.hasBall);
    if(carrier){ball.x=carrier.x+(carrier.team===0?17:-17);ball.y=carrier.y;return;}
    ball.x+=ball.vx*dt; ball.y+=ball.vy*dt;
    const friction=Math.pow(.986,dt*60);ball.vx*=friction;ball.vy*=friction;
    if(ball.y<19){ball.y=19;ball.vy=Math.abs(ball.vy)*.72;beep(150,.05);}
    if(ball.y>H-19){ball.y=H-19;ball.vy=-Math.abs(ball.vy)*.72;beep(150,.05);}
    // Goal openings are between y=245 and y=375.
    if(ball.x<12){
      if(ball.y>245&&ball.y<375){scoreAway++;goalScored(1);return;}
      ball.x=12;ball.vx=Math.abs(ball.vx)*.72;
    }
    if(ball.x>W-12){
      if(ball.y>245&&ball.y<375){scoreHome++;goalScored(0);return;}
      ball.x=W-12;ball.vx=-Math.abs(ball.vx)*.72;
    }
    const close=nearest([...home,...away],ball.x,ball.y);
    if(close && Math.hypot(close.x-ball.x,close.y-ball.y)<close.r+ball.r+2){
      const isHome=close.team===0;
      const canTake=isHome ? close.index===active || !home.some(p=>p.hasBall) : true;
      if(canTake && Math.hypot(ball.vx,ball.vy)<360){giveBallTo(close);if(close.team===0)setStatus("You have the ball!",1);}
    }
    // Tackling / interception when a player gets close to the ball.
    [...home,...away].forEach(p=>{
      if(!p.hasBall && Math.hypot(p.x-ball.x,p.y-ball.y)<p.r+ball.r+3 && Math.hypot(ball.vx,ball.vy)<250){
        if(p.team===0 && p.index!==active && home.some(h=>h.hasBall))return;
        giveBallTo(p);
      }
    });
  }
  function goalScored(team) {
    updateScore();goalPause=2.0;beep(660,.25,"sine");setTimeout(()=>beep(880,.35,"sine"),170);
    $("goalFlash").classList.remove("hidden");$("goalFlash").textContent="GOAL!";
    setStatus(team===0?`${teamInfo[selectedTeam].name} SCORE!`:"CPU ALL-STARS SCORE!",2);
    setTimeout(()=>$("goalFlash").classList.add("hidden"),1200);
    resetPositions();
  }
  function update(dt) {
    if(paused||matchOver)return;
    if(goalPause>0){goalPause-=dt;return;}
    timeLeft-=dt;if(timeLeft<=0){timeLeft=0;finishMatch();return;}updateClock();
    if(messageTimer>0){messageTimer-=dt;}
    const p=home[active];
    let dx=0,dy=0;
    if(keys.has("arrowleft")||keys.has("a"))dx--;
    if(keys.has("arrowright")||keys.has("d"))dx++;
    if(keys.has("arrowup")||keys.has("w"))dy--;
    if(keys.has("arrowdown")||keys.has("s"))dy++;
    movePlayer(p,dx,dy,dt,keys.has("shift"));
    // Other home players reposition and support the attack.
    home.forEach((mate,i)=>{if(i===active)return;let tx=mate.homeX,ty=mate.homeY;if(ball.x>W*.48){tx=Math.max(190,mate.homeX+65);ty=mate.homeY+(ball.y-H/2)*.13;}movePlayer(mate,tx-mate.x,ty-mate.y,dt,false);});
    updateAI(dt);updateBall(dt);
    // If the selected player is far from play, Q gives control of a closer teammate.
    if(keys.has(" "))shoot(p);
  }
  function drawPitch() {
    ctx.clearRect(0,0,W,H);
    for(let i=0;i<10;i++){ctx.fillStyle=i%2?"#19834a":"#1b8b4e";ctx.fillRect(i*W/10,0,W/10,H);}
    ctx.strokeStyle="#e7fff0d9";ctx.lineWidth=3;
    ctx.strokeRect(18,18,W-36,H-36);
    ctx.beginPath();ctx.moveTo(W/2,18);ctx.lineTo(W/2,H-18);ctx.stroke();
    ctx.beginPath();ctx.arc(W/2,H/2,83,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="#e7fff0";ctx.beginPath();ctx.arc(W/2,H/2,4,0,Math.PI*2);ctx.fill();
    // Penalty areas and goal boxes.
    ctx.strokeRect(18,190,145,240);ctx.strokeRect(18,245,58,130);
    ctx.strokeRect(W-163,190,145,240);ctx.strokeRect(W-76,245,58,130);
    ctx.fillStyle="#dfffee";ctx.fillRect(0,245,13,130);ctx.fillRect(W-13,245,13,130);
    ctx.strokeStyle="#ffffff80";ctx.lineWidth=2;ctx.strokeRect(0,245,13,130);ctx.strokeRect(W-13,245,13,130);
    ctx.fillStyle="#ffffff20";ctx.beginPath();ctx.arc(120,H/2,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(W-120,H/2,3,0,Math.PI*2);ctx.fill();
  }
  function drawPlayer(p) {
    ctx.save();ctx.translate(p.x,p.y);
    ctx.fillStyle="#06140e55";ctx.beginPath();ctx.ellipse(2,13,14,7,0,0,Math.PI*2);ctx.fill();
    const colour=p.team===0?teamInfo[selectedTeam].shirt:"#e64b55";
    ctx.fillStyle=colour;ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fill();
    ctx.lineWidth=3;ctx.strokeStyle=p.team===0?teamInfo[selectedTeam].trim:"#ffd6d6";ctx.stroke();
    ctx.fillStyle="#fff";ctx.font="bold 11px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(String(p.index+1),0,1);
    if(p.team===0&&p.index===active){ctx.strokeStyle="#fff36b";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,21,0,Math.PI*2);ctx.stroke();ctx.fillStyle="#fff36b";ctx.beginPath();ctx.moveTo(-5,-27);ctx.lineTo(5,-27);ctx.lineTo(0,-20);ctx.fill();}
    if(p.hasBall){ctx.strokeStyle="#ffffffaa";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  function drawBall(){ctx.save();ctx.translate(ball.x,ball.y);ctx.fillStyle="#06140d66";ctx.beginPath();ctx.ellipse(2,7,9,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(0,0,ball.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#263238";ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle="#263238";for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.arc(Math.cos(a)*4,Math.sin(a)*4,2,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function draw() {
    drawPitch();[...home,...away].sort((a,b)=>a.y-b.y).forEach(drawPlayer);drawBall();
    if(paused){ctx.fillStyle="#061522b8";ctx.fillRect(0,0,W,H);ctx.fillStyle="#fff";ctx.font="900 56px Arial";ctx.textAlign="center";ctx.fillText("PAUSED",W/2,H/2);}
  }
  function loop(now) {
    if(!running)return;const dt=Math.min((now-lastTime)/1000,.04);lastTime=now;
    update(dt);draw();
    if(!matchOver)requestAnimationFrame(loop);
  }
  function finishMatch() {
    matchOver=true;running=false;
    $("finalHome").textContent=scoreHome;$("finalAway").textContent=scoreAway;
    const title=scoreHome>scoreAway?"YOU WIN!":scoreHome<scoreAway?"MATCH LOST":"IT'S A DRAW!";
    $("resultTitle").textContent=title;
    $("resultMessage").textContent=scoreHome>scoreAway?"Excellent performance. You defeated the CPU.":scoreHome<scoreAway?"The CPU got the better of you this time. Try again!":"A balanced match. Can you win the rematch?";
    resultScreen.classList.remove("hidden");
  }
  function showMenu(){running=false;gameScreen.classList.add("hidden");resultScreen.classList.add("hidden");menu.classList.remove("hidden");}
  $("startBtn").addEventListener("click",startMatch);
  $("playAgainBtn").addEventListener("click",startMatch);
  $("restartBtn").addEventListener("click",startMatch);
  $("menuBtn").addEventListener("click",showMenu);
  $("resultMenuBtn").addEventListener("click",showMenu);
  $("pauseBtn").addEventListener("click",()=>{paused=!paused;$("pauseBtn").textContent=paused?"▶ Resume":"Ⅱ Pause";});
  $("soundBtn").addEventListener("click",()=>{soundOn=!soundOn;$("soundBtn").textContent=soundOn?"🔊 Sound: On":"🔇 Sound: Off";});
  window.addEventListener("keydown",e=>{
    const k=e.key.toLowerCase();
    if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();
    if(k==="q"&&!e.repeat&&running&&!paused)switchPlayer();
    if(k===" "&&!e.repeat&&running&&!paused)shoot(home[active]);
    keys.add(k);
  });
  window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur",()=>keys.clear());
  // Draw an attractive pitch preview before the first kick-off.
  drawPitch();
})();
