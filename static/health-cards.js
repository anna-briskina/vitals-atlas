/* Health cards: Parts 1 to 3 of the design team's health-caution.html (2026-11-15), the chart, the measure
   definitions and the rules, copied as they are. Changes are marked CHANGED or ADDED:
   - icons are inline SVG (static/icons.js) instead of the Material Symbols font, so the app works offline;
   - the data is set per person with setCrewData() instead of read once from window.CREW_DATA;
   - one measure is added: the wearable ECG's ST segment (scenario S2).
   Demo data; health wording and thresholds are mock. Design guidance, not medical advice. */
(function(){
/* ===== PART 1. THE CHART =====
   The agreed chart (docs/chart-weight-and-axis-research.md, sections 1 to 9), copied unchanged; only the stale ring is added.
   chart(cfg, W) returns an aria-hidden picture W pixels wide; the card's hidden sentence carries the data for screen readers.
   Marks: green circle #2baa50 within the usual range, caution yellow diamond #f1c21b outside it, red square #da1e28 past
   a medical limit, each with a black rim and a white halo; usual-range lines dashed; plan, fever and cut-off lines long-dashed;
   a dark cyan strip under a day with no reading. */
const NS="http://www.w3.org/2000/svg";
function el(tag,attrs,parent,text){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(text!==undefined)e.textContent=text;if(parent)parent.appendChild(e);return e;}
const MARKS={dataW:2.5,mR:6,mHalo:8,mRim:1.5,sqH:5.5,sqHalo:4,usualW:1.5,usualDash:"6 5",refW:1.5,refDash:"16 6",baseline:1.5,barEdge:1,green:"#2baa50"};
const COL={y:"#f1c21b",r:"#da1e28"}, DC="#005f7f", GRID="#d0d0d0";
const SP={key:30, group:50, dir:27, toPlot:24, line:22, panelGap:44, panelName:34};
const poly=p=>p.map(q=>q[0].toFixed(1)+","+q[1].toFixed(1)).join(" ");
/* Text with every number set in DM Mono (class "n"); a minus sign for negatives. */
function txt(svg,attrs,s){const t=el("text",attrs,svg);String(s).split(/(-?\d+(?:\.\d+)?)/).forEach((part,i)=>{if(!part)return;
  const sp=el("tspan",i%2?{class:"n"}:{},t);sp.textContent=part.replace(/^-/,"−");});return t;}
/* The stale ring (design decision 129; docs/chart-markings-research.md, section 15): solid dark cyan, 2 pixels, with a
   white gap, round a point that keeps its own colour and shape. keyPoint draws the same point in the key row. */
function staleRing(svg,x,y){el("circle",{cx:x,cy:y,r:15,fill:"#fff"},svg);el("circle",{cx:x,cy:y,r:14,fill:"none",stroke:DC,"stroke-width":2},svg);}
function keyPoint(svg,s,cx,cy,M,fill){
  if(s==="g"){el("circle",{cx:cx,cy:cy,r:M.mR,fill:fill(s),stroke:"#000","stroke-width":M.mRim},svg);return;}
  const h=M.sqH,d=h*Math.SQRT2,p=s==="y"?[[cx,cy-d],[cx+d,cy],[cx,cy+d],[cx-d,cy]]:[[cx-h,cy-h],[cx+h,cy-h],[cx+h,cy+h],[cx-h,cy+h]];
  el("polygon",{points:poly(p),fill:fill(s),stroke:"#000","stroke-width":M.mRim,"stroke-linejoin":"round"},svg);}
function chart(cfg,W,over){
  const M=Object.assign({},MARKS,over||{}), fill=s=>s==="g"?M.green:COL[s];
  const ml=cfg.ml||72, mr=cfg.mr||118, pw=W-ml-mr, n=cfg.xLabels.length, slot=pw/n, x=i=>ml+slot*(i+0.5);
  const svg=el("svg",{width:W,"aria-hidden":"true"});
  const key=cfg.key||[]; let tb=22; const ky=tb+SP.key; if(key.length)tb=ky;
  const U=tb+SP.group-(key.length?0:16);
  el("text",{x:0,y:22,"font-weight":600},svg,cfg.title);
  el("text",{x:0,y:U},svg,cfg.unit);
  let kx=0;key.forEach(K=>{let tx=kx+30;if(K.g==="strip"){el("rect",{x:kx,y:ky-10,width:24,height:8,fill:DC},svg);tx=kx+32;}
    if(K.g==="ring"){staleRing(svg,kx+15,ky-6);keyPoint(svg,K.s||"g",kx+15,ky-6,M,fill);tx=kx+38;}
    el("text",{x:tx,y:ky,"font-weight":K.bold?600:400},svg,K.t);kx=tx+K.t.length*10.5+24;});
  const gx=ml+pw+8;   /* right gutter: direct labels */
  const label=(yy,lines,bold)=>(Array.isArray(lines)?lines:[lines]).forEach((s,k)=>txt(svg,{x:gx,y:yy+6+k*SP.line,"font-weight":bold?600:400},s));
  const panels=cfg.panels||[cfg];
  let top=U+(cfg.dir?SP.dir:0)+SP.toPlot, pb=0, first=null;
  panels.forEach((P,pi)=>{
    if(pi)top+=SP.panelGap;
    if(P.name){if(pi===0)top+=12;el("text",{x:0,y:top,"font-weight":600},svg,P.name);top+=SP.panelName;}
    const ph=P.ph||120, mt=top, y=v=>mt+ph*(1-(v-P.yMin)/(P.yMax-P.yMin));
    if(pi===0)first={mt:mt};
    const ticks=P.yCat?P.yCat.map((_,i)=>i):P.yTicks;
    ticks.forEach((t,i)=>{el("line",{x1:ml,x2:ml+pw,y1:y(t),y2:y(t),stroke:GRID,"stroke-width":1},svg);
      if(P.yCat)el("text",{x:ml-10,y:y(t)+6,"text-anchor":"end"},svg,P.yCat[i]);
      else txt(svg,{x:ml-10,y:y(t)+6,"text-anchor":"end"},P.tickFmt?P.tickFmt(t):t);});
    const usualLine=v=>el("line",{x1:ml,x2:ml+pw,y1:y(v),y2:y(v),stroke:"#000","stroke-width":M.usualW,"stroke-dasharray":M.usualDash},svg);
    const refLine=v=>el("line",{x1:ml,x2:ml+pw,y1:y(v),y2:y(v),stroke:"#000","stroke-width":M.refW,"stroke-dasharray":M.refDash},svg);
    const refs=()=>{
      const allUsual=(P.usual||[]).concat(P.series2&&P.series2.usual||[]);
      allUsual.forEach(usualLine);
      if(P.groups){P.groups.forEach(G=>{const a=y(G.hi),b=y(G.lo),mid=(a+b)/2;   /* a bracket ties a group's name to its two limits */
          el("path",{d:`M${gx} ${a}H${gx+6}V${b}H${gx}`,fill:"none",stroke:"#000","stroke-width":1.5},svg);
          txt(svg,{x:gx+14,y:mid-4,"font-weight":600},G.name);txt(svg,{x:gx+14,y:mid+18},G.text);});}
      else allUsual.forEach(v=>label(y(v),P.usualText&&P.usualText[v]||("Usual "+v)));
      (P.lines||[]).forEach(L=>{refLine(L.y);label(y(L.y),L.text);});
      (P.gut||[]).forEach(G=>txt(svg,{x:gx,y:y(G.y)+G.dy,"font-weight":600},G.t));};
    const st=(S,i)=>(S.states?S.states[i]:"g")||"g";
    if(P.bars){refsAfter();}
    else{refs();
      const series=S=>{let d="";S.values.forEach((v,i)=>{if(v===null)return;d+=(i===0||S.values[i-1]===null?"M":"L")+x(i)+" "+y(v)+" ";});
        el("path",{d:d,fill:"none",stroke:"#000","stroke-width":M.dataW,"stroke-linejoin":"round","stroke-linecap":"round"},svg);
        S.values.forEach((v,i)=>{if(i>0&&v!==null&&S.values[i-1]!==null&&st(S,i)==="r"&&st(S,i-1)==="r")
          el("line",{x1:x(i-1),y1:y(S.values[i-1]),x2:x(i),y2:y(v),stroke:COL.r,"stroke-width":M.dataW,"stroke-linecap":"round"},svg);});
        S.values.forEach((v,i)=>{if(v===null)return;const s=st(S,i),cx=x(i),cy=y(v);
          if(S.staleIndex===i)staleRing(svg,cx,cy);   /* a stale reading keeps its colour and shape; a dark cyan ring goes round it */
          if(s==="g"){el("circle",{cx:cx,cy:cy,r:M.mHalo,fill:"#fff"},svg);el("circle",{cx:cx,cy:cy,r:M.mR,fill:fill(s),stroke:"#000","stroke-width":M.mRim},svg);return;}
          const h=M.sqH,d=h*Math.SQRT2,p=s==="y"?[[cx,cy-d],[cx+d,cy],[cx,cy+d],[cx-d,cy]]:[[cx-h,cy-h],[cx+h,cy-h],[cx+h,cy+h],[cx-h,cy+h]];
          el("polygon",{points:poly(p),fill:"#fff",stroke:"#fff","stroke-width":M.sqHalo,"stroke-linejoin":"round"},svg);
          el("polygon",{points:poly(p),fill:fill(s),stroke:"#000","stroke-width":M.mRim,"stroke-linejoin":"round"},svg);});};
      series(P);if(P.series2)series(P.series2);}
    function refsAfter(){const bw=slot*0.5;
      P.values.forEach((v,i)=>{if(v===null)return;el("rect",{x:x(i)-bw/2,y:y(v),width:bw,height:y(P.yMin)-y(v),fill:fill(st(P,i)),stroke:"#000","stroke-width":M.barEdge},svg);});
      el("line",{x1:ml,x2:ml+pw,y1:y(P.yMin),y2:y(P.yMin),stroke:"#000","stroke-width":M.baseline},svg);
      refs();}
    pb=mt+ph;top=pb;});
  if(cfg.dir){el("text",{x:ml-10,y:first.mt-SP.toPlot,"text-anchor":"end","font-weight":600},svg,cfg.dir.top);
    el("text",{x:ml-10,y:pb+40,"text-anchor":"end","font-weight":600},svg,cfg.dir.bottom);}
  const vals=panels[0].values, hasGap=vals.includes(null), rowY=pb+46, xt=pb+(hasGap?82:56);
  cfg.xLabels.forEach((l,i)=>{const last=i===n-1&&String(l).length>2;   /* a word as the last label ("Today", "Last night") starts just left of its day and runs into the free gutter, clear of the "1" */
    txt(svg,{x:last?x(i)-14:x(i),y:pb+26,"text-anchor":last?"start":"middle"},l);});
  el("text",{x:ml+pw/2,y:xt,"text-anchor":"middle"},svg,cfg.xTitle);
  let i0=0;while(i0<n){if(vals[i0]===null){let j=i0;while(j+1<n&&vals[j+1]===null)j++;
      if(!(cfg.pendingLast&&j===n-1))el("rect",{x:ml+slot*i0+3,y:rowY-4,width:slot*(j+1-i0)-6,height:8,fill:DC},svg);i0=j+1;}else i0++;}
  const H=xt+10;svg.setAttribute("height",H);svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  return svg;
}

/* ===== PART 2. MEASURE DEFINITIONS =====
   What is fixed for each measure whatever the data says: its name, how its value is written, and its chart with a
   FIXED axis (never fitted to the week's readings; docs/chart-weight-and-axis-research.md).
   kind:  "sensor" (read by a device), "entry" (the person enters it), "test" (the person takes a test).
   form:  "number", "duration" (minutes, written as hours and minutes), "pressure" (systolic over diastolic),
          "step" (a step on a scale), "word" (one word of a scale).
   The cards are drawn in this order. */
const one=v=>v.toFixed(1);
const MOOD=["Very low","Low","Okay","Good","Very good"], STRESS=["Very high","High","Some","Low","None"];
const DEFS=[
 /* ADDED by the app team: scenario S2's screening signal, the wearable ECG's ST segment (crew/heart.py). */
 {id:"stShift",name:"Heart rhythm (wearable ECG)",kind:"sensor",form:"number",decimals:1,unit:"millimetres ST shift",srName:"ST segment shift",
  chart:{unit:"millimetres ST shift",mr:118,ph:150,yMin:-0.5,yMax:1.5,yTicks:[-0.5,0,0.5,1,1.5],tickFmt:one}},
 {id:"heartRate",name:"Heart rate",kind:"sensor",form:"number",unit:"beats per minute",
  chart:{unit:"beats per minute",mr:100,ph:160,yMin:50,yMax:80,yTicks:[50,60,70,80]}},
 {id:"exercise",name:"Exercise",kind:"sensor",form:"duration",unit:"minutes",note:"so far today",
  chart:{unit:"hours",ph:150,yMin:0,yMax:3,yTicks:[0,1,2,3],bars:true}},
 {id:"bloodPressure",name:"Blood pressure",kind:"sensor",form:"pressure",unit:"millimetres of mercury",
  chart:{unit:"millimetres of mercury",mr:118,panels:[
    {name:"Systolic",part:"systolic",ph:150,yMin:90,yMax:140,yTicks:[90,100,110,120,130,140]},
    {name:"Diastolic",part:"diastolic",ph:120,yMin:50,yMax:90,yTicks:[50,60,70,80,90]}]}},
 {id:"hydration",name:"Hydration",kind:"entry",form:"step",unit:"urine colour step, 1 palest to 8 darkest",steps:8,note:"urine colour",srName:"Urine colour step",
  chart:{unit:"step 1 palest to step 8 darkest",mr:170,ph:175,yMin:1,yMax:8,yTicks:[1,2,3,4,5,6,7,8],dir:{top:"Worse",bottom:"Better"}}},
 {id:"bodyTemperature",name:"Body temperature",kind:"sensor",form:"number",decimals:1,unit:"degrees Celsius",lineName:"Fever",
  chart:{unit:"degrees Celsius",mr:124,ph:150,yMin:36,yMax:38.5,yTicks:[36,36.5,37,37.5,38,38.5],tickFmt:one}},
 {id:"reactionTime",name:"Reaction time",kind:"test",form:"number",unit:"milliseconds",note:"average of the last test",srName:"Reaction test average",
  chart:{unit:"average, milliseconds",mr:176,ph:150,yMin:200,yMax:350,yTicks:[200,250,300,350],dir:{top:"Worse",bottom:"Better"}}},
 {id:"sleep",name:"Sleep",kind:"sensor",form:"duration",unit:"minutes",note:"last night",nights:true,
  chart:{unit:"hours",mr:140,ph:180,yMin:0,yMax:10,yTicks:[0,2,4,6,8,10],bars:true}},
 {id:"mood",name:"Mood",kind:"entry",form:"word",unit:"word",scale:MOOD,
  chart:{unit:"your answer each day",ml:120,yMin:0,yMax:4,yCat:MOOD,dir:{top:"Better",bottom:"Worse"}}},
 {id:"stress",name:"Stress",kind:"entry",form:"word",unit:"word",scale:STRESS,
  chart:{unit:"your answer each day",ml:120,yMin:0,yMax:4,yCat:STRESS,dir:{top:"Better",bottom:"Worse"}}}
];

/* ===== PART 3. THE RULES =====
   Pure functions: data in, a description of the card out. Nothing here touches the page.
   Sources: the pill colour rule (docs/pill-colour-rule-research.md; docs/decisions-mockups.md, "The pill colour
   rule"); the reading against the usual range, option 6 (docs/reading-range-clarity-research.md); the card template
   and its states (docs/card-template-research.md, sections 2 and 4); the chart markings for stale and missing
   readings (docs/chart-markings-research.md, section 15). */
let D=null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const NUM=n=>'<span class="num">'+n+'</span>';
const SR=s=>'<span class="sr">'+s+'</span>';
const IC=(name,fill)=>window.ICONS.svg(name,fill);   /* CHANGED: inline SVG icons, so the app works offline */
const numify=s=>esc(s).replace(/\d+(?:\.\d+)?/g,NUM);          /* every number in the number typeface */
const two=n=>String(n).padStart(2,"0");
const pl=(n,w)=>w+(n===1?"":"s");
const has=v=>v!==null&&v!==undefined;

/* Times. "319/03:11:00" is day 319 of the year at 03:11:00, shown in NASA's form "GMT 319/03:11:00"
   (NASA-STD-3001 Volume 2 Appendix F F.6.1 e and f); a screen reader hears it spelled out. */
function toSec(t){const m=/^(\d{1,3})\/(\d\d):(\d\d):(\d\d)$/.exec(t||"");return m?+m[1]*86400+ +m[2]*3600+ +m[3]*60+ +m[4]:null;}
function clockParts(sec){const d=Math.floor(sec/86400),r=sec%86400;return {day:d,time:two(Math.floor(r/3600))+":"+two(Math.floor(r%3600/60))+":"+two(r%60)};}
const timeShown=sec=>{const p=clockParts(sec);return "GMT "+p.day+"/"+p.time;};
const timeSaid=sec=>{const p=clockParts(sec);return "Greenwich Mean Time, day "+p.day+", "+p.time;};
const timeHTML=sec=>'<span class="num" aria-hidden="true">'+timeShown(sec)+'</span>'+SR(timeSaid(sec));
let NOW0=null, TODAY=null;   /* CHANGED: set by setCrewData() for each person's data */
function setCrewData(d){D=d;NOW0=d?toSec(d.clock):null;TODAY=NOW0===null?null:Math.floor(NOW0/86400);}
const readingSec=r=>r.time?toSec(r.day+"/"+r.time):(r.day===TODAY?NOW0:r.day*86400+86399);

/* Durations are held in minutes and written as hours and minutes. */
function durParts(min){min=Math.round(min);return {h:Math.floor(min/60),m:min%60};}
function durText(min){const d=durParts(min),a=[];if(d.h)a.push(d.h+" "+pl(d.h,"hour"));if(d.m||!d.h)a.push(d.m+" "+pl(d.m,"minute"));return a.join(" ");}
function durHTML(min,big){const d=durParts(min),a=[];
  const p=(n,w)=>big?'<span class="big num">'+n+'</span> <span class="u">'+pl(n,w)+'</span>':NUM(n)+" "+pl(n,w);
  if(d.h)a.push(p(d.h,"hour"));if(d.m||!d.h)a.push(p(d.m,"minute"));return a.join(" ");}
const fmtNum=(def,v)=>def.decimals?Number(v).toFixed(def.decimals):String(Math.round(v*1000)/1000);
const ageWords=(n,nights)=>n===1?(nights?"the night before last":"yesterday"):n+(nights?" nights ago":" days ago");

/* RULE, the pill colour rule, for one number:
     at or past a medical limit                       "r"  red, always with an emergency alert
     outside the personal usual range, below a limit  "y"  yellow, with the side (above or below)
     within the personal usual range                  "g"  green
     no usual range yet                               "n"
   Size alone sets the colour. Time never turns a pill red. Direction never sets the colour. Thresholds are mock. */
function sizeState(v,range,limit){
  const off=range?(v>range.high?v-range.high:v<range.low?range.low-v:0):0;
  if(limit&&has(limit.high)&&v>=limit.high)return {s:"r",side:"above",amount:off};
  if(limit&&has(limit.low)&&v<=limit.low)return {s:"r",side:"below",amount:off};
  if(!range)return {s:"n"};
  if(v>range.high)return {s:"y",side:"above",amount:off};
  if(v<range.low)return {s:"y",side:"below",amount:off};
  return {s:"g"};
}
const RANK={g:0,n:0,y:1,r:2};
/* The state of one reading. Blood pressure has two numbers; the reading takes the higher state of the two.
   A measure with no agreed rule (exercise, hydration, mood, stress) takes "stateSetByHand" from the data for its
   newest reading; its earlier readings are drawn green. */
function readingState(def,m,value,newest){
  if(!has(value))return null;
  if(m.stateSetByHand||def.form==="step"||def.form==="word"||(!("usualRange" in m)&&!m.medicalLimit)){
    const h=newest?(m.stateSetByHand||"within"):"within";
    return h==="within"?{s:"g",parts:[],byHand:true}:{s:"y",side:h,parts:[],byHand:true};}
  if(def.form==="pressure"){
    const parts=["systolic","diastolic"].map(k=>Object.assign({label:k==="systolic"?"Systolic":"Diastolic"},
      sizeState(value[k],m.usualRange&&m.usualRange[k],m.medicalLimit&&m.medicalLimit[k])));
    const worst=parts.reduce((a,b)=>RANK[b.s]>RANK[a.s]?b:a);
    return {s:worst.s,side:worst.side,parts:parts};}
  const p=Object.assign({label:""},sizeState(value,m.usualRange,m.medicalLimit));
  return {s:p.s,side:p.side,parts:[p]};
}

/* RULE, everything a card needs, worked out from one measure's data. */
function cardModel(def,m){
  const R=m.readings,n=R.length;
  let li=-1;R.forEach((r,i)=>{if(has(r.value))li=i;});
  const latest=li>=0?R[li]:null;
  /* Not yet entered: an entry or a test with nothing today. The gap that runs up to today is "not yet", not missing. */
  const pending=def.kind!=="sensor"&&!has(R[n-1].value);
  let firstPending=n;if(pending){firstPending=n-1;while(firstPending>0&&!has(R[firstPending-1].value))firstPending--;}
  /* Missing: any other day with no value. */
  const gaps=R.map((r,i)=>!has(r.value)&&i<firstPending);
  /* Stale: the newest reading is older than the measure's time limit at the clock time
     (docs/ux-06f-behaviour-and-states.md, states table, row "Stale": "No new valid reading within the item's agreed time"). */
  const ageMin=latest?(NOW0-readingSec(latest))/60:null;
  const stale=!!(latest&&def.kind==="sensor"&&has(m.staleAfterMinutes)&&ageMin>m.staleAfterMinutes);
  const states=R.map((r,i)=>readingState(def,m,r.value,i===li));
  return {def:def,m:m,R:R,li:li,latest:latest,daysAgo:latest?TODAY-latest.day:null,pending:pending,gaps:gaps,
    missing:gaps.some(Boolean),stale:stale,states:states,st:latest?states[li]:null,
    inCaution:!!(D.caution&&(D.caution.measures||[]).includes(def.id))};
}

/* RULE, the pills, top right, in a fixed order: the range pill, the caution tag, then the entry or data-age pill. */
function pillsHTML(M){const def=M.def,st=M.st,a=[];
  if(st){
    if(st.s==="g")a.push('<span class="chip green">'+IC("check_circle",true)+'Within usual range</span>');
    else if(st.s==="y")a.push('<span class="chip yellow">'+IC(st.side==="above"?"arrow_upward":"arrow_downward")+(st.side==="above"?"Above":"Below")+' usual range</span>');
    else if(st.s==="r")a.push('<span class="chip red2">'+IC("report",true)+(st.side==="above"?"Above":"Below")+' medical limit</span>');
    else a.push('<span class="chip entry">'+IC("hourglass_top")+'No usual range yet</span>');   /* PROPOSAL, mock words */
  }
  if(M.inCaution)a.push('<span class="chip linkchip">'+IC("link")+'In this caution</span>');
  if(def.kind!=="sensor"){const w=def.kind==="test"?"Test":"Entry",wl=w.toLowerCase();
    a.push(M.pending?'<span class="chip none">'+IC("pending")+'No '+wl+' yet today</span>':'<span class="chip entry">'+IC("task_alt")+w+' done today</span>');}
  if(M.stale)a.push('<span class="chip stale">'+IC("schedule")+'Stale</span>');                    /* PROPOSAL, placement */
  return a.join("");
}

/* RULE, the trend line. The direction and the words come from the data ("trend"): no rule is agreed for them yet. */
const TREND_MARK={up:[[3,19],[12,13],[21,5]],down:[[3,5],[12,11],[21,19]],flat:[[3,12],[12,12],[21,12]]};
function trendHTML(M){const t=M.m.trend;if(!t||!t.words||!M.st||M.st.s==="n")return "";
  const pts=TREND_MARK[t.direction]||TREND_MARK.flat;
  return '<p class="trend '+(TREND_MARK[t.direction]?t.direction:"flat")+'"><svg class="tg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><polyline points="'+pts.map(p=>p.join(",")).join(" ")+'" fill="none" stroke="#000" stroke-width="2" stroke-linejoin="round"/><g fill="#000">'+pts.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="2.5"/>').join("")+'</g></svg><span>'+SR(esc(M.def.name)+": ")+numify(t.words)+'</span></p>';
}

/* RULE, the reading: the newest value, never labelled "Last reading"; then, only when needed, what kind of value it
   is or how old it is, after a comma. A stale reading gives its time in NASA's form. */
function readingHTML(M){const def=M.def,r=M.latest;
  if(!r)return '<p class="first"><span class="val"><span class="word">No reading yet</span></span></p>';
  const v=r.value,notes=[];
  if(def.kind==="entry"){if(def.note)notes.push(esc(def.note));if(M.daysAgo>0)notes.push("entered "+ageWords(M.daysAgo));}
  else if(def.kind==="test")notes.push(M.daysAgo>0?"average of the test "+ageWords(M.daysAgo):esc(def.note));
  else if(M.stale||M.daysAgo>0)notes.push(r.time?"measured "+timeHTML(readingSec(r)):ageWords(M.daysAgo,def.nights));
  else if(def.note)notes.push(esc(def.note));
  const note=notes.length?', <span class="note">'+notes.join(", ")+'</span>':"";
  let val;
  if(def.form==="duration")val=durHTML(v,true);
  else if(def.form==="pressure")val='<span class="big num">'+v.systolic+'</span> <span class="u">over</span> <span class="big num">'+v.diastolic+'</span> <span class="u ul">'+esc(def.unit)+'</span>';
  else if(def.form==="step")val='<span class="word">Step '+NUM(v)+'</span> <span class="u">of '+NUM(def.steps)+'</span>';
  else if(def.form==="word")val='<span class="word">'+esc(v)+'</span>';
  else val='<span class="big num">'+fmtNum(def,v)+'</span> <span class="u">'+esc(def.unit)+'</span>';
  return '<p class="first"><span class="val">'+val+note+'</span></p>';
}

/* RULE, the amount (option 6): one line for each number outside its usual range, with the pill's own icon.
   No line when nothing is outside. The unit is said once, on the reading's line; a screen reader hears it here too. */
function amountHTML(M){const def=M.def,st=M.st;if(!st)return "";
  return st.parts.filter(p=>(p.s==="y"||p.s==="r")&&p.amount>0).map(p=>{
    const icon=p.s==="r"?IC("report",true):IC(p.side==="above"?"arrow_upward":"arrow_downward");
    const amt=def.form==="duration"?durHTML(p.amount):NUM(fmtNum(def,p.amount))+SR(" "+esc(def.unit));
    return '<p class="amt'+(p.s==="r"?" red":"")+'">'+icon+'<span>'+(p.label?p.label+" ":"")+amt+' '+p.side+' your usual range</span></p>';}).join("");
}

/* RULE, the reference sentence: what the reading is measured against. Every card has one. */
function referenceHTML(M){const def=M.def,m=M.m,u=m.usualRange;
  if(has(m.plan))return '<p class="range">Your plan is '+durHTML(m.plan)+' a day.</p>';
  if(def.form==="step")return '<p class="range">Under-hydration is likely above step '+NUM(m.publishedLine)+'.</p>';
  if(def.form==="word")return '<p class="range">Your usual is '+esc(m.usual)+'.</p>';
  if(!u){const need=m.usualRangeAfterDays,got=m.daysOfReadings;                                   /* PROPOSAL, mock words */
    return '<p class="range">'+(has(need)&&has(got)?'Your usual range is set after '+NUM(need)+' days of readings. You have '+NUM(got)+'.':'Your usual range is not set yet.')+'</p>';}
  if(def.form==="pressure")return '<p class="range">Your usual range is '+NUM(u.systolic.low)+' to '+NUM(u.systolic.high)+' over '+NUM(u.diastolic.low)+' to '+NUM(u.diastolic.high)+SR(" "+esc(def.unit))+'.</p>';
  if(def.form==="duration")return '<p class="range">Your usual range is '+durHTML(u.low)+' to '+durHTML(u.high)+'.</p>';
  return '<p class="range">Your usual range is '+NUM(fmtNum(def,u.low))+' to '+NUM(fmtNum(def,u.high))+SR(" "+esc(def.unit))+'.</p>';
}

/* RULE, the hidden sentence that carries the chart's values for screen readers (WCAG 1.1.1). */
function listWords(a){return a.length>1?a.slice(0,-1).join(", ")+" and "+a[a.length-1]:a[0]||"";}
function chartSentence(M){const def=M.def,m=M.m,R=M.R,n=R.length,per=def.nights?"nights":"days";
  const gapWord=def.kind==="sensor"?"no reading":def.kind==="test"?"no test":"no entry";
  const text=v=>def.form==="duration"&&def.nights?durText(v):def.form==="number"?fmtNum(def,v):String(v);
  const upTo=M.pending?R.findIndex((r,i)=>!has(r.value)&&!M.gaps[i]):n;
  const items=(f)=>R.slice(0,upTo).map(r=>has(r.value)?f(r.value):gapWord);
  const tailPending=M.pending?", and "+gapWord+" yet today":"";
  const head=(def.srName||def.name)+", last "+n+" "+per+", oldest first";
  const out=M.states.map(s=>s&&(s.s==="y"||s.s==="r"));
  /* how the week sits against the usual range */
  function against(rangeWords){
    const count=out.filter(Boolean).length;
    if(!count)return "All within your usual range"+rangeWords;
    let k=0;while(k<n&&out[n-1-k])k++;
    const side=M.st&&M.st.side;
    if(k===count&&side&&M.states.slice(n-k).every(s=>s.side===side))
      return (k===1?(def.nights?"Last night is ":"Today is "):"The last "+k+" "+per+" are ")+side+" your usual range"+rangeWords;
    return count+" of the "+n+" "+per+" are outside your usual range"+rangeWords;}
  let s;
  if(def.form==="pressure"){const u=m.usualRange;
    const part=k=>listWords(items(v=>String(v[k])));
    s=head+". Systolic: "+part("systolic")+" "+def.unit+(u?"; usual range "+u.systolic.low+" to "+u.systolic.high:"")+". Diastolic: "+part("diastolic")+(u?"; usual range "+u.diastolic.low+" to "+u.diastolic.high:"")+". "+(u?against("")+".":"No usual range yet.");}
  else if(def.form==="word")s=head+": "+(M.pending?items(text).join(", ")+tailPending:listWords(items(text)))+".";
  else if(def.form==="step")s=head+": "+listWords(items(text))+tailPending+", on a scale from 1, palest, to "+def.steps+", darkest. Under-hydration is likely above step "+m.publishedLine+".";
  else{const u=m.usualRange,isDur=def.form==="duration";
    const list=listWords(items(text))+tailPending, unit=isDur&&def.nights?"":" "+def.unit;
    let tail;
    if(has(m.plan))tail="The plan is "+durText(m.plan)+" a day.";
    else if(!u)tail="No usual range yet.";
    else{tail=against(" of "+(isDur?durText(u.low)+" to "+durText(u.high):fmtNum(def,u.low)+" to "+fmtNum(def,u.high)));
      if(has(m.publishedLine)&&def.lineName&&!out.some(Boolean)&&R.every(r=>!has(r.value)||r.value<m.publishedLine))tail+=", and below the "+def.lineName.toLowerCase()+" line of "+fmtNum(def,m.publishedLine);
      tail+=".";}
    s=head+": "+list+unit+". "+tail;}
  if(M.st&&M.st.s==="r")s+=" The newest reading is "+M.st.side+" the medical limit.";
  if(M.stale)s+=" The newest reading is stale: measured "+timeSaid(readingSec(M.latest))+".";
  return s;
}

/* RULE, the chart: the measure's fixed chart, with this data's values; a mark coloured and shaped by its own
   reading's state (green circle, yellow diamond, red square); the usual-range lines; a cyan ring on a stale reading;
   a cyan strip under a missing day. If a reading falls outside the fixed axis, the axis grows by whole steps so the
   reading is never drawn off the plot (no rule is agreed for this case). */
function chartConfig(M){const def=M.def,m=M.m,R=M.R,n=R.length,c=def.chart,u=m.usualRange;
  const sc=def.form==="duration"?1/60:1;
  const cfg=Object.assign({},c,{title:"Last "+n+" "+(def.nights?"nights":"days"),xTitle:(def.nights?"Nights":"Days")+" ago",
    xLabels:R.map((r,i)=>i===n-1?(def.nights?"Last night":"Today"):String(TODAY-r.day))});
  const stOf=(i,part)=>{const s=M.states[i];if(!s)return "g";const p=part?s.parts.find(q=>q.label.toLowerCase()===part):s;return p.s==="n"?"g":p.s;};
  const fit=P=>{if(P.yCat)return P;const step=P.yTicks[1]-P.yTicks[0],vs=P.values.filter(has);P.yTicks=P.yTicks.slice();
    while(vs.length&&Math.max(...vs)>P.yMax){P.yMax+=step;P.yTicks.push(P.yMax);}
    while(vs.length&&Math.min(...vs)<P.yMin){P.yMin-=step;P.yTicks.unshift(P.yMin);}
    /* a grown axis keeps at most 7 tick labels, so they never overlap: the step doubles until they fit */
    let st2=step;while(P.yTicks.length>7){st2*=2;const t=[];for(let v=P.yMin;v<P.yMax+st2;v+=st2)t.push(Math.round(v*1000)/1000);P.yTicks=t;P.yMax=t[t.length-1];}return P;};
  const key=[];
  if(M.stale&&!c.bars)key.push({g:"ring",s:stOf(M.li),t:"Stale reading"});
  if(M.missing)key.push({g:"strip",t:def.kind==="sensor"?"No reading":def.kind==="test"?"No test":"No entry",bold:true});
  if(key.length)cfg.key=key;
  if(M.pending)cfg.pendingLast=true;
  if(c.panels){
    cfg.panels=c.panels.map(P=>fit(Object.assign({},P,{values:R.map(r=>has(r.value)?r.value[P.part]:null),states:R.map((r,i)=>stOf(i,P.part)),
      usual:u&&u[P.part]?[u[P.part].low,u[P.part].high]:[],staleIndex:M.stale?M.li:-1})));
    return cfg;}
  cfg.values=R.map(r=>!has(r.value)?null:def.form==="word"?def.scale.indexOf(r.value):r.value*sc);
  cfg.states=R.map((r,i)=>stOf(i));
  cfg.staleIndex=M.stale&&!c.bars?M.li:-1;
  if(u&&has(u.low)){cfg.usual=[u.low*sc,u.high*sc];cfg.usualText={};
    [u.low,u.high].forEach(v=>{if(def.form==="duration"){const d=durParts(v);cfg.usualText[v*sc]=d.m&&d.h?["Usual "+d.h+" "+pl(d.h,"hour"),d.m+" "+pl(d.m,"minute")]:"Usual "+durText(v);}
      else cfg.usualText[v]="Usual "+fmtNum(def,v);});}
  if(has(m.plan))cfg.lines=[{y:m.plan*sc,text:"Plan "+durText(m.plan)}];
  if(def.form==="step"&&has(m.publishedLine)){cfg.lines=[{y:m.publishedLine,text:"Step "+m.publishedLine}];
    cfg.gut=[{y:m.publishedLine,dy:-44,t:"Under-hydration"},{y:m.publishedLine,dy:-22,t:"likely"}];}
  if(def.lineName&&has(m.publishedLine))cfg.lines=[{y:m.publishedLine,text:def.lineName+" "+fmtNum(def,m.publishedLine)}];
  if(def.id==="reactionTime"&&u)cfg.gut=[{y:u.high,dy:-22,t:"Slower than usual"},{y:u.low,dy:34,t:"Faster than usual"}];
  return fit(cfg);
}

/* RULE, the checks run on loading. They write to the browser console only, never to the screen, and the result is
   also kept in window.CREW_DATA_CHECK = {errors:[...], warnings:[...]}. */
function checkData(){const E=[],W=[];
  if(!D){E.push("No data: crew-data.js did not load or does not set window.CREW_DATA.");return {errors:E,warnings:W};}
  if(NOW0===null)E.push('clock must look like "319/03:11:00" (day of the year, a slash, the time).');
  const c=D.caution;
  if(!c)E.push("caution is missing: this page draws the caution state only.");
  else{if(toSec(c.raised)===null||toSec(c.answerBy)===null)E.push('caution.raised and caution.answerBy must look like "319/03:13:00".');
    (c.measures||[]).forEach(id=>{if(!DEFS.some(d=>d.id===id))E.push('caution.measures names "'+id+'", which is not a measure. Known: '+DEFS.map(d=>d.id).join(", ")+".");});}
  let anyStale=false,anyMissing=false;
  DEFS.forEach(def=>{const m=D.measures&&D.measures[def.id],at=def.name+": ";
    if(!m){E.push(at+'measures.'+def.id+' is missing.');return;}
    if(m.unit!==def.unit)E.push(at+'unit is "'+m.unit+'" but this page expects "'+def.unit+'". Convert the values; do not only rename the unit.');
    if(m.source!=="demo"&&m.source!=="real")W.push(at+'source should be "demo" or "real".');
    const R=m.readings;
    if(!Array.isArray(R)||R.length!==7){E.push(at+"readings must hold exactly 7 days, oldest first.");return;}
    R.forEach((r,i)=>{if(r.day!==TODAY-(6-i))E.push(at+"reading "+(i+1)+" has day "+r.day+"; expected "+(TODAY-(6-i))+" (7 days in a row, ending on the clock's day).");
      if(r.time&&toSec(r.day+"/"+r.time)===null)E.push(at+'reading '+(i+1)+' has time "'+r.time+'"; it must look like "03:10:00".');
      if(!has(r.value))return;
      if(def.form==="pressure"){if(typeof r.value.systolic!=="number"||typeof r.value.diastolic!=="number")E.push(at+"reading "+(i+1)+" must be {systolic: number, diastolic: number}.");}
      else if(def.form==="word"){if(!def.scale.includes(r.value))E.push(at+'reading '+(i+1)+' is "'+r.value+'"; it must be one of: '+def.scale.join(", ")+".");}
      else if(typeof r.value!=="number")E.push(at+"reading "+(i+1)+" must be a number or null.");});
    if(def.form==="word"&&!def.scale.includes(m.usual))E.push(at+'usual must be one of: '+def.scale.join(", ")+".");
    if((def.form==="step"||def.form==="word"||has(m.plan))&&!["within","above","below"].includes(m.stateSetByHand))E.push(at+'stateSetByHand must be "within", "above" or "below" (no rule is agreed for this measure yet).');
    if(E.length)return;
    const M=cardModel(def,m);
    if(M.stale)anyStale=true;if(M.missing||(def.kind==="sensor"&&!has(R[6].value)))anyMissing=true;
    if(M.st&&M.st.s==="r"&&!(c&&/emergency/i.test(c.class)))W.push(at+"the newest reading is past its mock medical limit, so its pill is red. The rule says a red pill always comes with an emergency alert, and this data holds none. This page draws the caution state only.");
    if(M.inCaution&&M.st&&M.st.s==="g")W.push(at+"is named in caution.measures but its newest reading is within its usual range.");
  });
  if(!E.length){
    if(!anyStale)W.push('Data coverage: this data set has no stale reading. Include at least one, from the real data set or mocked and labelled: give a measure that has "staleAfterMinutes" a newest reading older than that.');
    if(!anyMissing)W.push("Data coverage: this data set has no missing reading. Include at least one, from the real data set or mocked and labelled: set one day's value to null.");}
  return {errors:E,warnings:W};
}

window.HC={setCrewData,DEFS,cardModel,chartConfig,chart,pillsHTML,trendHTML,readingHTML,amountHTML,referenceHTML,
  chartSentence,checkData,timeHTML,timeShown,timeSaid,toSec,IC,NUM,numify,esc};
})();
