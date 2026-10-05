const LEVELS=[
{name:"The Sewing Box",cols:5,rows:5,pieces:[
{id:"a",name:"Button",color:"#c98f91",shape:[[0,0]]},
{id:"b",name:"Ribbon",color:"#a9c9b7",shape:[[0,0],[1,0]]},
{id:"c",name:"Fabric Scrap",color:"#e9c96b",shape:[[0,0],[0,1],[1,1]]},
{id:"d",name:"Thread",color:"#9caf91",shape:[[0,0],[1,0],[0,1],[1,1]]},
{id:"e",name:"Scissors",color:"#c98f91",shape:[[0,0],[1,0],[2,0]]},
{id:"f",name:"Measuring Tape",color:"#a9c9b7",shape:[[0,0],[0,1],[0,2],[1,2]]},
{id:"g",name:"Fabric Scrap",color:"#e9c96b",shape:[[0,0],[0,1],[1,1],[2,1]]},
{id:"h",name:"Thread Spool",color:"#9caf91",shape:[[0,0],[1,0],[2,0],[2,1]]}
]},
{name:"Buttons & Thread",cols:5,rows:5,pieces:[
{id:"a",name:"Ribbon",color:"#e9c96b",shape:[[0,0],[1,0]]},
{id:"b",name:"Spool",color:"#a9c9b7",shape:[[0,0],[0,1],[1,1],[2,1]]},
{id:"c",name:"Patch",color:"#c98f91",shape:[[0,0],[1,0],[1,1]]},
{id:"d",name:"Scissors",color:"#9caf91",shape:[[0,0],[1,0],[2,0],[1,1]]},
{id:"e",name:"Measuring Tape",color:"#e9c96b",shape:[[0,0],[0,1],[0,2],[1,2]]},
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
let state={board:[],pieces:[],drag:null,selectedId:null};
let boardArtLayer;
const rotateBtn=document.querySelector("#rotateBtn");
const boardEl=document.querySelector("#board"),poolEl=document.querySelector("#pool");
const progressText=document.querySelector("#progressText"),progressBar=document.querySelector("#progressBar"),levelName=document.querySelector("#levelName"),hint=document.querySelector("#hint");

function rotated(shape,r){let s=shape.map(([x,y])=>[x,y]);for(let k=0;k<r;k++)s=s.map(([x,y])=>[-y,x]);let minX=Math.min(...s.map(p=>p[0])),minY=Math.min(...s.map(p=>p[1]));return s.map(([x,y])=>[x-minX,y-minY])}
function dims(shape){return [Math.max(...shape.map(p=>p[0]))+1,Math.max(...shape.map(p=>p[1]))+1]}
function beep(freq=440,dur=.06){if(!sound)return;try{const C=window.AudioContext||window.webkitAudioContext,c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=freq;o.type="sine";g.gain.setValueAtTime(.045,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+dur);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+dur)}catch{}}

function loadLevel(){
 state.selectedId=null;
 const L=LEVELS[levelIndex];state.board=Array(L.rows*L.cols).fill(null);state.pieces=L.pieces.map(p=>({...p,kind:p.kind||kindFromName(p.name),rotation:0,x:null,y:null,placed:false}));
 boardEl.style.setProperty("--cols",L.cols);boardEl.style.setProperty("--rows",L.rows);boardEl.innerHTML="";
 for(let i=0;i<L.rows*L.cols;i++){const c=document.createElement("div");c.className="cell";c.dataset.i=i;boardEl.appendChild(c)}
 boardArtLayer=document.createElement("div");boardArtLayer.className="board-art-layer";boardEl.appendChild(boardArtLayer);
 levelName.textContent=`Level ${levelIndex+1}: ${L.name}`;hint.style.visibility=levelIndex===0?"visible":"hidden";renderPool();updateProgress();
}
function kindFromName(name){const n=name.toLowerCase();if(n.includes("scissor"))return "scissors";if(n.includes("spool")||n.includes("thread"))return "spool";if(n.includes("button"))return "button";if(n.includes("tape"))return "tape";if(n.includes("ribbon"))return "ribbon";if(n.includes("fabric")||n.includes("scrap")||n.includes("patch"))return "fabric";return "button"}
function craftArt(kind,color,rotation=0){
 const art=document.createElement("svg");art.classList.add("craft-art");art.setAttribute("viewBox","0 0 100 100");art.setAttribute("aria-hidden","true");art.style.transform=`rotate(${rotation*90}deg)`;
 const drawings={
 button:`<circle cx="50" cy="50" r="34" fill="${color}" stroke="#6f5143" stroke-width="6"/><circle cx="41" cy="42" r="5" fill="#fff3df"/><circle cx="59" cy="42" r="5" fill="#fff3df"/><circle cx="41" cy="59" r="5" fill="#fff3df"/><circle cx="59" cy="59" r="5" fill="#fff3df"/>`,
 spool:`<path d="M27 18h46l-8 14v36l8 14H27l8-14V32z" fill="#f3d9b5" stroke="#76533e" stroke-width="5" stroke-linejoin="round"/><path d="M35 32h30M35 40h30M35 48h30M35 56h30M35 64h30" stroke="${color}" stroke-width="7" stroke-linecap="round"/><path d="M73 23c14 5 9 14 2 17" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`,
 scissors:`<circle cx="28" cy="70" r="14" fill="none" stroke="${color}" stroke-width="9"/><circle cx="28" cy="34" r="14" fill="none" stroke="${color}" stroke-width="9"/><path d="m39 43 45 43M39 61 84 14" stroke="#78604b" stroke-width="8" stroke-linecap="round"/><circle cx="39" cy="52" r="6" fill="#d8b987" stroke="#78604b" stroke-width="3"/>`,
 tape:`<circle cx="50" cy="52" r="34" fill="${color}" stroke="#76533e" stroke-width="5"/><circle cx="50" cy="52" r="15" fill="#f7ead5" stroke="#76533e" stroke-width="4"/><path d="M20 37h13M18 47h10M18 58h12M22 69h11M68 37h12M72 47h10M71 58h11M67 69h11" stroke="#fff7e9" stroke-width="4" stroke-linecap="round"/><path d="M66 80q12 8 20-1" fill="none" stroke="#76533e" stroke-width="4"/>`,
 ribbon:`<path d="M50 52 18 22q-10-8-11 4-2 25 40 32L12 82q-8 8 2 11 24 4 39-33l37 28q8 6 9-5 2-24-43-31l36-23q8-8-2-11-24-4-40 34z" fill="${color}" stroke="#76533e" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="53" r="9" fill="#e4bd72" stroke="#76533e" stroke-width="3"/>`,
 fabric:`<path d="m18 24 20-7 11 9 17-8 18 15-7 14 8 16-11 20-18-6-15 8-14-14-13-3 5-19-7-11z" fill="${color}" stroke="#76533e" stroke-width="5" stroke-linejoin="round"/><path d="m27 30 42 42m-7-49L23 70" stroke="#fff4df" stroke-width="3" stroke-dasharray="4 5"/>`
 };
 art.innerHTML=drawings[kind]||drawings.button;return art;
}
function renderShape(shape,color,scale=1,kind="button",rotation=0){
 const [w,h]=dims(shape), wrap=document.createElement("div");wrap.className="shape";wrap.style.gridTemplateColumns=`repeat(${w},${22*scale}px)`;wrap.style.gridTemplateRows=`repeat(${h},${22*scale}px)`;
 shape.forEach(([x,y])=>{const c=document.createElement("div");c.className="shape-cell";c.style.gridColumn=x+1;c.style.gridRow=y+1;c.style.background=color;c.style.width=22*scale+"px";c.style.height=22*scale+"px";wrap.appendChild(c)});wrap.append(craftArt(kind,color,rotation));return wrap;
}
function renderPool(){
 poolEl.innerHTML="";
 state.pieces.filter(p=>!p.placed).forEach(p=>{const card=document.createElement("div");card.className="piece-card";card.dataset.id=p.id;if(p.id===state.selectedId)card.classList.add("selected");card.setAttribute("aria-label",`${p.name}. Click to rotate, drag to place.`);card.append(renderShape(rotated(p.shape,p.rotation),p.color,1,p.kind,p.rotation));const tag=document.createElement("span");tag.className="wood-tag";tag.textContent=p.name;card.append(tag);poolEl.append(card);card.addEventListener("pointerdown",startDrag);card.addEventListener("contextmenu",e=>{e.preventDefault();state.selectedId=p.id;rotateSelected()})});
 updateRotateButton();
}
function updateRotateButton(){const selected=state.pieces.find(p=>p.id===state.selectedId&&!p.placed);rotateBtn.disabled=!selected;rotateBtn.setAttribute("aria-label",selected?`Rotate ${selected.name} clockwise`:"Select a craft piece to rotate")}
function selectPiece(p){state.selectedId=p.id;renderPool()}
function rotateSelected(){const p=state.pieces.find(q=>q.id===state.selectedId&&!q.placed);if(!p)return;p.rotation=(p.rotation+1)%4;renderPool();beep(680,.05)}

poolEl.addEventListener("contextmenu",e=>{if(e.target.closest(".piece-card"))e.preventDefault()});
document.addEventListener("keydown",e=>{if(e.key.toLowerCase()==="r"&&!e.repeat&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){e.preventDefault();rotateSelected()}});
function cellSize(){return boardEl.getBoundingClientRect().width/LEVELS[levelIndex].cols}
function canPlace(p,x,y,r=p.rotation){
 const L=LEVELS[levelIndex],sh=rotated(p.shape,r);
 for(const [dx,dy] of sh){const gx=x+dx,gy=y+dy;if(gx<0||gy<0||gx>=L.cols||gy>=L.rows)return false;const at=state.board[gy*L.cols+gx];if(at!==null&&at!==p.id)return false}
 return true;
}
function startDrag(e){
 e.preventDefault();const id=e.currentTarget.dataset.id,p=state.pieces.find(q=>q.id===id);if(!p)return;
 if(e.button===2){state.selectedId=p.id;return}
 state.selectedId=p.id;updateRotateButton();
 const card=e.currentTarget;card.classList.add("selected");card.setPointerCapture?.(e.pointerId);card.classList.add("dragging");
 const sh=rotated(p.shape,p.rotation), [w,h]=dims(sh), float=document.createElement("div");float.className="floating-piece";float.append(renderShape(sh,p.color,1,p.kind,p.rotation));document.body.append(float);
 state.drag={p,card,float,pointerId:e.pointerId,lastX:e.clientX,lastY:e.clientY,startX:e.clientX,startY:e.clientY,w,h};
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
 sh.forEach(([dx,dy])=>{const idx=(gy+dy)*LEVELS[levelIndex].cols+(gx+dx),cell=boardEl.querySelector(`[data-i="${idx}"]`);if(cell)cell.classList.add(canPlace(d.p,gx,gy)?"preview-valid":"preview-invalid")});
}
function clearPreview(){boardEl.querySelectorAll(".preview-valid,.preview-invalid").forEach(c=>c.classList.remove("preview-valid","preview-invalid"))}
function endDrag(e){
 document.removeEventListener("pointermove",dragMove);const d=state.drag;if(!d)return;clearPreview();d.float.remove();d.card.classList.remove("dragging");
 const moved=Math.hypot(e.clientX-d.startX,e.clientY-d.startY);
 if(moved<8){state.selectedId=d.p.id;d.p.rotation=(d.p.rotation+1)%4;renderPool();state.drag=null;beep(680,.05);return}
 if(d.gridX!==undefined&&canPlace(d.p,d.gridX,d.gridY)){
   place(d.p,d.gridX,d.gridY);beep(740,.07);
 }else{d.card.classList.add("bad");setTimeout(()=>d.card.classList.remove("bad"),300);beep(180,.08)}
 state.drag=null;
}

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
 [...boardEl.querySelectorAll(".cell")].forEach((c,i)=>{c.innerHTML="";c.classList.remove("filled");const id=state.board[i];if(id!==null){const p=state.pieces.find(q=>q.id===id);if(p)c.classList.add("filled")}});
 boardArtLayer.innerHTML="";
 state.pieces.filter(p=>p.placed).forEach(p=>{const [w,h]=dims(rotated(p.shape,p.rotation)),visual=document.createElement("div");visual.className="board-piece-art";visual.style.gridColumn=`${p.x+1} / span ${w}`;visual.style.gridRow=`${p.y+1} / span ${h}`;visual.append(craftArt(p.kind,p.color,p.rotation));boardArtLayer.append(visual)});
}
function updateProgress(){const filled=state.board.filter(Boolean).length,total=state.board.length;progressText.textContent=`${filled} / ${total}`;progressBar.style.width=(filled/total*100)+"%"}
function showSuccess(){document.querySelector("#success").classList.remove("hidden");beep(880,.12);setTimeout(()=>beep(1100,.14),90)}
function nextLevel(){document.querySelector("#success").classList.add("hidden");levelIndex=Math.min(levelIndex+1,LEVELS.length-1);localStorage.tidyCraftLevel=levelIndex;loadLevel()}
document.querySelector("#nextBtn").onclick=nextLevel;
document.querySelector("#rotateBtn").addEventListener("click",rotateSelected);
document.querySelector("#restartBtn").onclick=()=>{loadLevel();beep(330,.05)};
document.querySelector("#settingsBtn").onclick=()=>document.querySelector("#settings").classList.remove("hidden");
document.querySelector("#closeSettings").onclick=()=>document.querySelector("#settings").classList.add("hidden");
document.querySelector("#soundToggle").checked=sound;document.querySelector("#musicToggle").checked=music;
document.querySelector("#soundToggle").onchange=e=>{sound=e.target.checked;localStorage.tidyCraftSound=sound?"1":"0"};
document.querySelector("#musicToggle").onchange=e=>{music=e.target.checked;localStorage.tidyCraftMusic=music?"1":"0"};
loadLevel();
