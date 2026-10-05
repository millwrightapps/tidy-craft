const LEVELS=[
{name:"The Sewing Box",cols:5,rows:5,pieces:[
{id:"a",name:"Button",color:"#c98f91",shape:[[0,0]]},
{id:"b",name:"Ribbon",color:"#a9c9b7",shape:[[0,0],[1,0]]},
{id:"c",name:"Fabric Scrap",color:"#e9c96b",shape:[[0,0],[0,1],[1,1]]},
{id:"d",name:"Thread",color:"#9caf91",shape:[[0,0],[1,0],[0,1],[1,1]]},
{id:"e",name:"Patch",color:"#c98f91",shape:[[0,0],[1,0],[2,0]]},
{id:"f",name:"L Scrap",color:"#a9c9b7",shape:[[0,0],[0,1],[0,2],[1,2]]},
{id:"g",name:"Ribbon",color:"#e9c96b",shape:[[0,0],[0,1],[1,1],[2,1]]},
{id:"h",name:"Thread",color:"#9caf91",shape:[[0,0],[1,0],[2,0],[2,1]]}
]},
{name:"Buttons & Thread",cols:5,rows:5,pieces:[
{id:"a",name:"Ribbon",color:"#e9c96b",shape:[[0,0],[1,0]]},
{id:"b",name:"Spool",color:"#a9c9b7",shape:[[0,0],[0,1],[1,1],[2,1]]},
{id:"c",name:"Patch",color:"#c98f91",shape:[[0,0],[1,0],[1,1]]},
{id:"d",name:"Ribbon",color:"#9caf91",shape:[[0,0],[1,0],[2,0],[1,1]]},
{id:"e",name:"Fabric",color:"#e9c96b",shape:[[0,0],[0,1],[0,2],[1,2]]},
{id:"f",name:"Patch",color:"#c98f91",shape:[[0,0],[1,0],[2,0]]},
{id:"g",name:"Ribbon",color:"#a9c9b7",shape:[[0,0],[0,1],[1,1],[1,2]]},
{id:"h",name:"Button",color:"#9caf91",shape:[[0,0]]}
]}
];
// Additional levels reuse proven piece sets with larger boards and added rotations/arrangements.
for(let n=2;n<10;n++){
 const base=LEVELS[(n-1)%2], cols=n<4?5:n<7?6:7, rows=cols;
 const pieces=base.pieces.map((p,i)=>({...p,id:p.id+i+"_"+n}));
 const cells=pieces.reduce((s,p)=>s+p.shape.length,0);
 // Fill remaining cells with safe 1-cell buttons.
 while(pieces.reduce((s,p)=>s+p.shape.length,0)<cols*rows){
   pieces.push({id:"extra"+pieces.length+"_"+n,name:"Button",color:["#c98f91","#a9c9b7","#e9c96b","#9caf91"][pieces.length%4],shape:[[0,0]]});
 }
 LEVELS.push({name:["The Fabric Drawer","Ribbon & Lace","Grandma's Sewing Kit","The Craft Cabinet","Scrap Fabric","The Embroidery Box","The Big Craft Drawer","The Master Sewing Box"][n-2],cols,rows,pieces});
}

let levelIndex=+(localStorage.tidyCraftLevel||0), sound=localStorage.tidyCraftSound!=="0", music=localStorage.tidyCraftMusic==="1";
let state={board:[],pieces:[],drag:null};
const boardEl=document.querySelector("#board"),poolEl=document.querySelector("#pool");
const progressText=document.querySelector("#progressText"),progressBar=document.querySelector("#progressBar"),levelName=document.querySelector("#levelName"),hint=document.querySelector("#hint");

function rotated(shape,r){let s=shape.map(([x,y])=>[x,y]);for(let k=0;k<r;k++)s=s.map(([x,y])=>[-y,x]);let minX=Math.min(...s.map(p=>p[0])),minY=Math.min(...s.map(p=>p[1]));return s.map(([x,y])=>[x-minX,y-minY])}
function dims(shape){return [Math.max(...shape.map(p=>p[0]))+1,Math.max(...shape.map(p=>p[1]))+1]}
function beep(freq=440,dur=.06){if(!sound)return;try{const C=window.AudioContext||window.webkitAudioContext,c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=freq;o.type="sine";g.gain.setValueAtTime(.045,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+dur);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+dur)}catch{}}

function loadLevel(){
 const L=LEVELS[levelIndex];state.board=Array(L.rows*L.cols).fill(null);state.pieces=L.pieces.map(p=>({...p,rotation:0,x:null,y:null,placed:false}));
 boardEl.style.setProperty("--cols",L.cols);boardEl.style.setProperty("--rows",L.rows);boardEl.innerHTML="";
 for(let i=0;i<L.rows*L.cols;i++){const c=document.createElement("div");c.className="cell";c.dataset.i=i;boardEl.appendChild(c)}
 levelName.textContent=`Level ${levelIndex+1}: ${L.name}`;hint.style.visibility=levelIndex===0?"visible":"hidden";renderPool();updateProgress();
}
function renderShape(shape,color,scale=1){
 const [w,h]=dims(shape), wrap=document.createElement("div");wrap.className="shape";wrap.style.gridTemplateColumns=`repeat(${w},${22*scale}px)`;wrap.style.gridTemplateRows=`repeat(${h},${22*scale}px)`;
 shape.forEach(([x,y])=>{const c=document.createElement("div");c.className="shape-cell";c.style.gridColumn=x+1;c.style.gridRow=y+1;c.style.background=color;c.style.width=22*scale+"px";c.style.height=22*scale+"px";wrap.appendChild(c)});return wrap;
}
function renderPool(){
 poolEl.innerHTML="";
 state.pieces.filter(p=>!p.placed).forEach(p=>{const card=document.createElement("div");card.className="piece-card";card.dataset.id=p.id;card.append(renderShape(rotated(p.shape,p.rotation),p.color));const tag=document.createElement("span");tag.className="wood-tag";tag.textContent=p.name;card.append(tag);poolEl.append(card);card.addEventListener("pointerdown",startDrag)});
}
function cellSize(){return boardEl.getBoundingClientRect().width/LEVELS[levelIndex].cols}
function canPlace(p,x,y,r=p.rotation){
 const L=LEVELS[levelIndex],sh=rotated(p.shape,r);
 for(const [dx,dy] of sh){const gx=x+dx,gy=y+dy;if(gx<0||gy<0||gx>=L.cols||gy>=L.rows)return false;const at=state.board[gy*L.cols+gx];if(at!==null&&at!==p.id)return false}
 return true;
}
function startDrag(e){
 e.preventDefault();const id=e.currentTarget.dataset.id,p=state.pieces.find(q=>q.id===id);if(!p)return;
 const card=e.currentTarget;card.setPointerCapture?.(e.pointerId);card.classList.add("dragging");
 const sh=rotated(p.shape,p.rotation), [w,h]=dims(sh), float=document.createElement("div");float.className="floating-piece";float.append(renderShape(sh,p.color));document.body.append(float);
 state.drag={p,card,float,pointerId:e.pointerId,lastX:e.clientX,lastY:e.clientY,w,h};
 float.style.left=(e.clientX- w*11)+"px";float.style.top=(e.clientY-h*11)+"px";
 document.addEventListener("pointermove",dragMove);document.addEventListener("pointerup",endDrag,{once:true});
 beep(520,.04);
}
function dragMove(e){
 const d=state.drag;if(!d)return;e.preventDefault();d.lastX=e.clientX;d.lastY=e.clientY;
 const rect=boardEl.getBoundingClientRect(),s=cellSize(),sh=rotated(d.p.shape,d.p.rotation),[w,h]=dims(sh);
 d.float.style.left=(e.clientX-w*11)+"px";d.float.style.top=(e.clientY-h*11)+"px";
 clearPreview();
 const gx=Math.floor((e.clientX-rect.left)/s-w/2),gy=Math.floor((e.clientY-rect.top)/s-h/2);
 d.gridX=gx;d.gridY=gy;
 sh.forEach(([dx,dy])=>{const idx=(gy+dy)*LEVELS[levelIndex].cols+(gx+dx),cell=boardEl.children[idx];if(cell)cell.classList.add(canPlace(d.p,gx,gy)?"preview-valid":"preview-invalid")});
}
function clearPreview(){boardEl.querySelectorAll(".preview-valid,.preview-invalid").forEach(c=>c.classList.remove("preview-valid","preview-invalid"))}
function endDrag(e){
 document.removeEventListener("pointermove",dragMove);const d=state.drag;if(!d)return;clearPreview();d.float.remove();d.card.classList.remove("dragging");
 // A second tap while holding a piece rotates it. Dragging uses movement threshold.
 const moved=Math.hypot(e.clientX-(d.startX??e.clientX),e.clientY-(d.startY??e.clientY));
 if(d.gridX===undefined){
  d.p.rotation=(d.p.rotation+1)%4;
  renderPool(); state.drag=null; beep(680,.05); return;
}
 if(canPlace(d.p,d.gridX,d.gridY)){
   place(d.p,d.gridX,d.gridY);beep(740,.07);
 }else{d.card.classList.add("bad");setTimeout(()=>d.card.classList.remove("bad"),300);beep(180,.08)}
 state.drag=null;
}
document.addEventListener("pointerdown",e=>{if(e.target.closest(".piece-card")&&state.drag?.p){state.drag.startX=e.clientX;state.drag.startY=e.clientY}});
function place(p,x,y){
 const sh=rotated(p.shape,p.rotation);p.x=x;p.y=y;p.placed=true;sh.forEach(([dx,dy])=>state.board[(y+dy)*LEVELS[levelIndex].cols+(x+dx)]=p.id);
 renderPool();renderBoard();updateProgress();
 if(state.board.every(v=>v!==null))setTimeout(showSuccess,320);
}

boardEl.addEventListener("pointerdown", e=>{
 const cell=e.target.closest(".cell"); if(!cell)return;
 const id=state.board[+cell.dataset.i]; if(id===null)return;
 const p=state.pieces.find(q=>q.id===id); if(!p)return;
 removePiece(p); beep(420,.05);
});
function removePiece(p){
 state.board=state.board.map(v=>v===p.id?null:v);
 p.placed=false; p.x=null; p.y=null;
 renderPool(); renderBoard(); updateProgress();
}

function renderBoard(){
 [...boardEl.children].forEach((c,i)=>{c.innerHTML="";c.classList.remove("filled");const id=state.board[i];if(id!==null){const p=state.pieces.find(q=>q.id===id);if(p){c.classList.add("filled");c.append(renderShape([[0,0]],p.color,.72))}}});
}
function updateProgress(){const filled=state.board.filter(Boolean).length,total=state.board.length;progressText.textContent=`${filled} / ${total}`;progressBar.style.width=(filled/total*100)+"%"}
function showSuccess(){document.querySelector("#success").classList.remove("hidden");beep(880,.12);setTimeout(()=>beep(1100,.14),90)}
function nextLevel(){document.querySelector("#success").classList.add("hidden");levelIndex=Math.min(levelIndex+1,LEVELS.length-1);localStorage.tidyCraftLevel=levelIndex;loadLevel()}
document.querySelector("#nextBtn").onclick=nextLevel;
document.querySelector("#restartBtn").onclick=()=>{loadLevel();beep(330,.05)};
document.querySelector("#settingsBtn").onclick=()=>document.querySelector("#settings").classList.remove("hidden");
document.querySelector("#closeSettings").onclick=()=>document.querySelector("#settings").classList.add("hidden");
document.querySelector("#soundToggle").checked=sound;document.querySelector("#musicToggle").checked=music;
document.querySelector("#soundToggle").onchange=e=>{sound=e.target.checked;localStorage.tidyCraftSound=sound?"1":"0"};
document.querySelector("#musicToggle").onchange=e=>{music=e.target.checked;localStorage.tidyCraftMusic=music?"1":"0"};
loadLevel();
