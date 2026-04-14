import { useState, useCallback, useMemo } from "react";

// ODC MARKETS PLATFORM v2.0 — © 2026 ODC Markets (Manish Malik). All rights reserved.
// SDGR Scoring + Trajectory Optimizer + Reentry Risk

// ==================== CONSTANTS ====================
const MU=3.986004418e14,RE=6371e3,G0=9.80665,BASE_SCOD=84200,NASA_THRESH=1e-4,WORLD_POP=8.1e9,EARTH_AREA=5.1e14;
const ALT=[{label:"Very Low (200-400 km)",df:0.3},{label:"Low (400-600 km)",df:0.6},{label:"Medium (600-800 km)",df:0.85},{label:"High Risk (800-1000 km)",df:1.0},{label:"Very High (1000-1200 km)",df:0.95},{label:"Sun-Sync (1200-2000 km)",df:0.7}];
const PROP=[{label:"Active ion/electric",f:0.15,isp:1600},{label:"Chemical bipropellant",f:0.25,isp:310},{label:"Chemical monopropellant",f:0.35,isp:220},{label:"Cold gas only",f:0.6,isp:70},{label:"Drag sail planned",f:0.5,isp:0},{label:"No propulsion",f:1.0,isp:0}];
const SHIELD=[{label:"Whipple shield (enhanced)",f:0.4},{label:"Whipple shield (standard)",f:0.6},{label:"Basic aluminum hull",f:0.85},{label:"No dedicated shielding",f:1.0}];
const sel={width:"100%",padding:"10px 12px",background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:6,color:"#e2e8f0",fontSize:14,outline:"none",cursor:"pointer"};
const inp={flex:1,padding:"10px 12px",background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:6,color:"#e2e8f0",fontSize:14,fontFamily:"monospace",outline:"none"};

// ==================== SDGR CALCULATOR ====================
function calcSDGR(p,scod){
  const a=ALT[p.alt],pr=PROP[p.prop],sh=SHIELD[p.shield];
  const life=Math.min((parseFloat(p.life)||5)/25,1),con=Math.log10(Math.max(parseInt(p.con)||1,1))/Math.log10(10000);
  const pass=p.pass?0.5:1,track=p.track?0.7:1,ca=p.ca?0.5:1;
  const dy=parseFloat(p.deorbit)||25,deo=dy<=5?0.3:dy<=10?0.5:dy<=25?0.8:1;
  const area=Math.min((parseFloat(p.area)||1)/50,1),mass=Math.min((parseFloat(p.mass)||100)/5000,1);
  const raw=a.df*0.2+pr.f*0.12+sh.f*0.08+life*0.1+con*0.1+pass*0.08+track*0.05+ca*0.1+deo*0.1+area*0.04+mass*0.03;
  const score=Math.round(raw*100),cs=Math.max(parseInt(p.con)||1,1);
  const ext=Math.round(score*scod*cs*0.0001),fee=Math.round(ext/cs);
  let g,gc,gl;
  if(score<=20){g="A+";gc="#10B981";gl="Excellent — minimal debris risk";}
  else if(score<=35){g="A";gc="#34D399";gl="Good — low debris generation risk";}
  else if(score<=50){g="B";gc="#F59E0B";gl="Moderate — some mitigation recommended";}
  else if(score<=65){g="C";gc="#F97316";gl="Elevated — significant mitigation needed";}
  else if(score<=80){g="D";gc="#EF4444";gl="High — major debris risk contributor";}
  else{g="F";gc="#DC2626";gl="Critical — unsustainable orbital practice";}
  const comps=[{n:"Orbital Altitude",v:Math.round(a.df*100),w:"20%"},{n:"Propulsion",v:Math.round(pr.f*100),w:"12%"},{n:"Collision Avoidance",v:Math.round(ca*100),w:"10%"},{n:"Deorbit Compliance",v:Math.round(deo*100),w:"10%"},{n:"Design Lifetime",v:Math.round(life*100),w:"10%"},{n:"Constellation",v:Math.round(con*100),w:"10%"},{n:"Shielding",v:Math.round(sh.f*100),w:"8%"},{n:"Passivation",v:Math.round(pass*100),w:"8%"},{n:"Trackability",v:Math.round(track*100),w:"5%"},{n:"Cross-Section",v:Math.round(area*100),w:"4%"},{n:"Mass",v:Math.round(mass*100),w:"3%"}];
  const recs=[];
  if(score>60)recs.push({l:"Critical",c:"#EF4444",bg:"#1a0a0a",t:"Upgrade propulsion for active deorbit. Current config poses cascade risk."});
  if(score>40)recs.push({l:"Warning",c:"#F59E0B",bg:"#1a1400",t:"Reduce deorbit time below 5 years. ESA Zero Debris Charter requires this by 2030."});
  if(!p.ca)recs.push({l:"Advisory",c:"#F97316",bg:"#1a0f00",t:"Enable collision avoidance — reduces SDGR by 10+ points."});
  if(score<=35)recs.push({l:"Excellent",c:"#10B981",bg:"#0a1a0a",t:"Strong sustainability practices. Qualifies for reduced ODC fees."});
  return{score,g,gc,gl,ext,fee,comps,recs,cs};
}

// ==================== TRAJECTORY CALCULATOR ====================
function calcTrajectory(t){
  const altM=parseFloat(t.alt)*1000,r0=RE+altM,massKg=parseFloat(t.mass)||500,areaM2=parseFloat(t.area)||4;
  const incDeg=parseFloat(t.inc)||53,ispS=parseFloat(t.isp)||0,fuelKg=parseFloat(t.fuel)||0;
  const v0=Math.sqrt(MU/r0),period=2*Math.PI*Math.sqrt(r0**3/MU)/60;
  
  // Available delta-v
  const totalMass=massKg+fuelKg;
  const availDV=ispS>0&&fuelKg>0?ispS*G0*Math.log(totalMass/massKg):0;
  
  // Direct deorbit delta-v (Hohmann to 50km perigee)
  const rDeorbit=RE+50e3,aTransfer=(r0+rDeorbit)/2;
  const v1c=Math.sqrt(MU/r0),v1t=Math.sqrt(MU*(2/r0-1/aTransfer));
  const dv1=Math.abs(v1t-v1c);
  const v2c=Math.sqrt(MU/rDeorbit),v2t=Math.sqrt(MU*(2/rDeorbit-1/aTransfer));
  const dv2=Math.abs(v2c-v2t);
  const dvTotal=dv1+dv2;
  const controlled=availDV>=dvTotal*0.8;
  
  // Natural decay estimate
  const hScales=[{h:100e3,s:8500},{h:200e3,s:27000},{h:400e3,s:37000},{h:600e3,s:45000},{h:800e3,s:54000},{h:1e10,s:65000}];
  const hs=hScales.find(x=>altM<x.h)?.s||65000;
  const rho=1.225*Math.exp(-altM/hs),beta=massKg/(2.2*areaM2);
  const decayYears=rho>1e-20?(beta*hs/(rho*v0*r0))/(365.25*24*3600):999;
  
  // Reentry risk (DAS-equivalent)
  const numComps=Math.max(Math.floor(massKg/5),3);
  const survFrac=massKg>1000?0.20:massKg<10?0.05:0.15;
  const numSurv=Math.max(Math.floor(numComps*survFrac),1);
  const avgFragArea=0.05*Math.sqrt(massKg/100);
  const personR=Math.sqrt(0.36/Math.PI);
  let totalCA=0;
  for(let i=0;i<numSurv;i++){const fa=avgFragArea*(0.5+Math.random()*0.5);totalCA+=Math.PI*(Math.sqrt(fa/Math.PI)+personR)**2;}
  const popDens=WORLD_POP/EARTH_AREA;
  const incFactor=incDeg<30?1.3:incDeg<60?1.1:incDeg<80?0.9:0.7;
  const casualtyRisk=totalCA*popDens*incFactor;
  const nasaCompliant=casualtyRisk<NASA_THRESH;
  const safetyMargin=((NASA_THRESH-casualtyRisk)/NASA_THRESH)*100;
  
  // Fuel used for controlled deorbit
  let fuelUsed=0;
  if(ispS>0&&dvTotal>0){const ratio=dvTotal/(ispS*G0);fuelUsed=ratio<10?massKg*(1-Math.exp(-ratio)):fuelKg;}
  
  // Optimal deorbit scenarios
  const scenarios=[];
  const maxDelay=Math.min(decayYears*365.25,parseFloat(t.maxDays)||3650);
  const minDelay=parseFloat(t.minDays)||0;
  for(let d=minDelay;d<=maxDelay;d+=Math.max((maxDelay-minDelay)/15,1)){
    const yrs=d/365.25;
    const extCost=Math.round(BASE_SCOD*(parseFloat(t.alt)/800)*0.01*yrs);
    const insCost=Math.round(massKg*100*(1+yrs*0.1)*Math.max(yrs,0.5));
    const fCost=Math.round(fuelUsed*50000);
    const rev=Math.round(d*(parseFloat(t.dailyRev)||500));
    const total=extCost+insCost+fCost;
    const net=rev-total;
    scenarios.push({d:Math.round(d),yrs:Math.round(yrs*100)/100,ext:extCost,ins:insCost,fc:fCost,total,rev,net,ctrl:controlled});
  }
  const optimal=scenarios.length>0?scenarios.reduce((a,b)=>b.net>a.net?b:a,scenarios[0]):null;
  
  return{
    orbit:{alt:parseFloat(t.alt),v0:Math.round(v0),period:Math.round(period*10)/10,r0:Math.round(r0/1000)},
    dv:{available:Math.round(availDV*100)/100,required:Math.round(dvTotal*100)/100,controlled,fuelUsed:Math.round(fuelUsed*100)/100},
    decay:{years:Math.round(decayYears*100)/100,days:Math.round(decayYears*365.25)},
    reentry:{casualtyArea:Math.round(totalCA*10000)/10000,survivors:numSurv,risk:casualtyRisk,inverseRisk:Math.round(1/Math.max(casualtyRisk,1e-10)),compliant:nasaCompliant,margin:Math.round(safetyMargin*10)/10},
    scenarios,optimal,
  };
}

// ==================== PDF EXPORT ====================
function exportPDF(r,p,scod,tab){
  // Reuse existing PDF logic for SDGR tab
  const al=ALT[p.alt],pr=PROP[p.prop],sh=SHIELD[p.shield],d=new Date().toISOString().split("T")[0];
  const rows=r.comps.map(c=>`<tr><td style="padding:5px 10px;border-bottom:1px solid #1e3a5f;color:#94a3b8;font-size:11px;">${c.n}</td><td style="padding:5px;border-bottom:1px solid #1e3a5f;color:#e2e8f0;font-family:monospace;font-size:11px;">${c.v}%</td><td style="padding:5px;border-bottom:1px solid #1e3a5f;color:#64748b;font-size:10px;">${c.w}</td></tr>`).join("");
  const h=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>SDGR Report</title><style>@page{size:A4;margin:0;}body{margin:0;padding:20mm 18mm;background:#060d1b;color:#e2e8f0;font-family:system-ui,sans-serif;}</style></head><body>
<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;"><div style="width:8px;height:8px;border-radius:50%;background:#00B4D8;"></div><span style="font-size:11px;color:#00B4D8;letter-spacing:3px;font-family:monospace;">ODC MARKETS</span></div>
<h1 style="font-size:24px;margin:0 0 4px;color:#f1f5f9;">SDGR Scoring Report</h1>
<div style="font-size:11px;color:#475569;margin-bottom:20px;">${d} — v2.0 — Malik (2026) OSF + Bongers & Torres (2026) SCOD</div>
<div style="border:1px solid ${r.gc}44;border-radius:10px;padding:18px;margin-bottom:16px;background:#0b1426;">
<div style="font-size:56px;font-weight:bold;color:${r.gc};font-family:monospace;text-align:center;">${r.g} <span style="font-size:24px;color:#94a3b8;">${r.score}/100</span></div>
<div style="text-align:center;font-size:14px;color:${r.gc};margin:8px 0 16px;">${r.gl}</div>
<div style="display:flex;gap:12px;"><div style="flex:1;background:#060d1b;border-radius:6px;padding:10px;text-align:center;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;">Fleet Externality</div><div style="font-size:18px;font-weight:bold;color:#F59E0B;font-family:monospace;">$${r.ext.toLocaleString()}</div></div>
<div style="flex:1;background:#060d1b;border-radius:6px;padding:10px;text-align:center;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;">ODC Fee/Sat</div><div style="font-size:18px;font-weight:bold;color:#00B4D8;font-family:monospace;">$${r.fee.toLocaleString()}</div></div>
<div style="flex:1;background:#060d1b;border-radius:6px;padding:10px;text-align:center;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;">SCOD</div><div style="font-size:18px;font-weight:bold;color:#94a3b8;font-family:monospace;">$${scod.toLocaleString()}</div></div></div></div>
<div style="background:#0b1426;border:1px solid #132744;border-radius:8px;padding:14px;margin-bottom:16px;"><div style="font-size:10px;color:#00B4D8;letter-spacing:2px;font-family:monospace;margin-bottom:10px;">RISK BREAKDOWN</div><table style="width:100%;border-collapse:collapse;">${rows}</table></div>
<div style="border-top:1px solid #132744;padding-top:12px;font-size:9px;color:#334155;display:flex;justify-content:space-between;"><div>© 2026 ODC Markets</div><div>SSRN: 6562481</div></div></body></html>`;
  const w=window.open("","_blank");if(w){w.document.write(h);w.document.close();setTimeout(()=>w.print(),600);}
}

// ==================== UI COMPONENTS ====================
function Gauge({score,grade,gc}){
  const ang=(score/100)*180,rad=(ang-90)*(Math.PI/180),nx=150+100*Math.cos(rad),ny=150+100*Math.sin(rad);
  return(<svg viewBox="0 0 300 180" style={{width:"100%",maxWidth:320}}>
    <defs><linearGradient id="gg" x1="0%" y2="0%"><stop offset="0%" stopColor="#10B981"/><stop offset="35%" stopColor="#F59E0B"/><stop offset="65%" stopColor="#F97316"/><stop offset="100%" stopColor="#EF4444"/></linearGradient></defs>
    <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="#1a2744" strokeWidth="24" strokeLinecap="round"/>
    <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="url(#gg)" strokeWidth="20" strokeLinecap="round"/>
    <line x1="150" y1="150" x2={nx} y2={ny} stroke={gc} strokeWidth="3" strokeLinecap="round"/><circle cx="150" cy="150" r="8" fill={gc}/>
    <text x="150" y="125" textAnchor="middle" fill={gc} fontSize="48" fontWeight="bold" fontFamily="monospace">{grade}</text>
    <text x="150" y="170" textAnchor="middle" fill="#94a3b8" fontSize="14">SDGR {score}/100</text>
  </svg>);
}
function Bar({n,v,w}){const c=v<=30?"#10B981":v<=60?"#F59E0B":v<=80?"#F97316":"#EF4444";return(
  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
    <div style={{width:140,fontSize:12,color:"#94a3b8"}}>{n}</div>
    <div style={{flex:1,background:"#0f1d32",borderRadius:4,height:16,overflow:"hidden"}}><div style={{width:`${v}%`,height:"100%",background:c,borderRadius:4,transition:"width 0.8s"}}/></div>
    <div style={{width:36,fontSize:12,color:"#64748b",textAlign:"right",fontFamily:"monospace"}}>{w}</div>
  </div>);}
const L=({label,children,hint})=>(<div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,color:"#64748b",marginBottom:4,letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}</label>{children}{hint&&<div style={{fontSize:11,color:"#475569",marginTop:2}}>{hint}</div>}</div>);
const T=({on,set,label})=>(<label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:8}}>
  <div onClick={()=>set(!on)} style={{width:40,height:22,borderRadius:11,background:on?"#00B4D8":"#1e3a5f",position:"relative",transition:"background 0.3s",cursor:"pointer"}}><div style={{width:16,height:16,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:on?21:3,transition:"left 0.3s"}}/></div>
  <span style={{fontSize:13,color:"#cbd5e1"}}>{label}</span></label>);
const Stat=({label,value,color,sub})=>(<div style={{flex:"1 1 100px",background:"#060d1b",borderRadius:8,padding:14,textAlign:"center"}}>
  <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4,fontFamily:"monospace"}}>{label}</div>
  <div style={{fontSize:20,fontWeight:700,color,fontFamily:"monospace"}}>{value}</div>
  {sub&&<div style={{fontSize:9,color:"#475569",marginTop:2}}>{sub}</div>}
</div>);

// ==================== SDGR TAB ====================
function SDGRTab(){
  const[p,setP]=useState({alt:3,prop:0,shield:1,life:"7",con:"1",pass:true,track:true,ca:true,deorbit:"5",area:"4",mass:"500"});
  const[scod,setScod]=useState(84200);const[show,setShow]=useState(false);const[anim,setAnim]=useState(false);
  const u=useCallback((k,v)=>{setP(x=>({...x,[k]:v}));setShow(false);setAnim(false);},[]);
  const r=useMemo(()=>calcSDGR(p,scod),[p,scod]);
  const go=()=>{setShow(true);setAnim(false);setTimeout(()=>setAnim(true),50);};
  return(<div style={{display:"flex",gap:32,flexWrap:"wrap"}}>
    <div style={{flex:"1 1 440px",minWidth:320}}><div style={{background:"#0b1426",border:"1px solid #132744",borderRadius:12,padding:24}}>
      <h2 style={{fontSize:15,color:"#00B4D8",margin:"0 0 20px",fontFamily:"monospace",letterSpacing:"0.1em"}}>SATELLITE PARAMETERS</h2>
      <L label="Altitude"><select value={p.alt} onChange={e=>u("alt",+e.target.value)} style={sel}>{ALT.map((o,i)=><option key={i} value={i}>{o.label}</option>)}</select></L>
      <L label="Propulsion"><select value={p.prop} onChange={e=>u("prop",+e.target.value)} style={sel}>{PROP.map((o,i)=><option key={i} value={i}>{o.label}</option>)}</select></L>
      <L label="Shielding"><select value={p.shield} onChange={e=>u("shield",+e.target.value)} style={sel}>{SHIELD.map((o,i)=><option key={i} value={i}>{o.label}</option>)}</select></L>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        <div style={{flex:"1 1 120px"}}><L label="Design Life"><div style={{display:"flex",gap:8}}><input type="number" value={p.life} onChange={e=>u("life",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b",alignSelf:"center"}}>yrs</span></div></L></div>
        <div style={{flex:"1 1 120px"}}><L label="Deorbit Time"><div style={{display:"flex",gap:8}}><input type="number" value={p.deorbit} onChange={e=>u("deorbit",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b",alignSelf:"center"}}>yrs</span></div></L></div>
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        <div style={{flex:"1 1 120px"}}><L label="Constellation"><div style={{display:"flex",gap:8}}><input type="number" value={p.con} onChange={e=>u("con",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b",alignSelf:"center"}}>sats</span></div></L></div>
        <div style={{flex:"1 1 120px"}}><L label="Mass"><div style={{display:"flex",gap:8}}><input type="number" value={p.mass} onChange={e=>u("mass",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b",alignSelf:"center"}}>kg</span></div></L></div>
      </div>
      <L label="Cross-Section"><div style={{display:"flex",gap:8}}><input type="number" value={p.area} onChange={e=>u("area",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b",alignSelf:"center"}}>m²</span></div></L>
      <T on={p.pass} set={v=>u("pass",v)} label="Passivation plan"/><T on={p.track} set={v=>u("track",v)} label="SSA-trackable"/><T on={p.ca} set={v=>u("ca",v)} label="Collision avoidance"/>
      <div style={{marginTop:16,padding:14,background:"#060d1b",borderRadius:8,border:"1px solid #1e3a5f"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:11,color:"#64748b",textTransform:"uppercase"}}>SCOD Sensitivity</span><span style={{fontSize:15,fontWeight:700,color:"#F59E0B",fontFamily:"monospace"}}>${scod.toLocaleString()}</span></div>
        <input type="range" min={20000} max={200000} step={1000} value={scod} onChange={e=>setScod(+e.target.value)} style={{width:"100%",accentColor:"#00B4D8"}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#475569",marginTop:3}}><span>$20K</span><span style={{color:"#F59E0B"}}>$84.2K</span><span>$200K</span></div>
      </div>
      <button onClick={go} style={{width:"100%",padding:"14px",marginTop:16,background:"linear-gradient(135deg,#00B4D8,#0891B2)",border:"none",borderRadius:8,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",letterSpacing:"0.08em",boxShadow:"0 4px 20px rgba(0,180,216,0.3)"}}>CALCULATE SDGR SCORE</button>
    </div></div>
    <div style={{flex:"1 1 440px",minWidth:320}}>
      {show?(<div style={{opacity:anim?1:0,transform:anim?"translateY(0)":"translateY(20px)",transition:"all 0.6s"}}>
        <div style={{background:"#0b1426",border:`1px solid ${r.gc}33`,borderRadius:12,padding:24,marginBottom:20}}>
          <div style={{textAlign:"center"}}><Gauge score={r.score} grade={r.g} gc={r.gc}/></div>
          <div style={{textAlign:"center",fontSize:14,color:r.gc,fontWeight:500,margin:"8px 0 16px"}}>{r.gl}</div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <Stat label="Fleet Externality" value={`$${r.ext.toLocaleString()}`} color="#F59E0B" sub={`${r.cs} sat${r.cs>1?"s":""}/yr`}/>
            <Stat label="ODC Fee/Sat" value={`$${r.fee.toLocaleString()}`} color="#00B4D8" sub="Per satellite/year"/>
            <Stat label="SCOD" value={`$${scod.toLocaleString()}`} color="#94a3b8" sub="Per debris >1cm"/>
          </div></div>
        <div style={{background:"#0b1426",border:"1px solid #132744",borderRadius:12,padding:24,marginBottom:20}}>
          <h3 style={{fontSize:13,color:"#00B4D8",margin:"0 0 16px",fontFamily:"monospace"}}>RISK BREAKDOWN</h3>
          {r.comps.map((c,i)=><Bar key={i} n={c.n} v={c.v} w={c.w}/>)}</div>
        {r.recs.length>0&&<div style={{background:"#0b1426",border:"1px solid #132744",borderRadius:12,padding:24,marginBottom:20}}>
          {r.recs.map((x,i)=><div key={i} style={{margin:"0 0 8px",padding:"10px 14px",background:x.bg,borderLeft:`3px solid ${x.c}`,borderRadius:"0 6px 6px 0",fontSize:13,color:"#94a3b8"}}><strong style={{color:x.c}}>{x.l}:</strong> {x.t}</div>)}</div>}
        <button onClick={()=>exportPDF(r,p,scod)} style={{width:"100%",padding:"12px",background:"transparent",border:"1px solid #00B4D8",borderRadius:8,color:"#00B4D8",fontSize:14,fontWeight:600,cursor:"pointer"}}>EXPORT PDF REPORT</button>
      </div>):(<div style={{background:"#0b1426",border:"1px solid #132744",borderRadius:12,padding:48,textAlign:"center",minHeight:400,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:48,opacity:0.15}}>◎</div><div style={{fontSize:16,color:"#334155",marginTop:16}}>Configure and calculate</div></div>)}
    </div></div>);
}

// ==================== TRAJECTORY TAB ====================
function TrajectoryTab(){
  const[t,setT]=useState({alt:"550",mass:"500",area:"4",inc:"53",isp:"1600",fuel:"15",minDays:"0",maxDays:"3650",dailyRev:"500"});
  const[show,setShow]=useState(false);const[anim,setAnim]=useState(false);const[result,setResult]=useState(null);
  const ut=useCallback((k,v)=>{setT(x=>({...x,[k]:v}));setShow(false);setAnim(false);},[]);
  const go=()=>{setResult(calcTrajectory(t));setShow(true);setAnim(false);setTimeout(()=>setAnim(true),50);};
  const r=result;
  return(<div style={{display:"flex",gap:32,flexWrap:"wrap"}}>
    <div style={{flex:"1 1 440px",minWidth:320}}><div style={{background:"#0b1426",border:"1px solid #132744",borderRadius:12,padding:24}}>
      <h2 style={{fontSize:15,color:"#F59E0B",margin:"0 0 20px",fontFamily:"monospace",letterSpacing:"0.1em"}}>ORBIT & SPACECRAFT</h2>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        <div style={{flex:"1 1 120px"}}><L label="Altitude"><div style={{display:"flex",gap:8}}><input type="number" value={t.alt} onChange={e=>ut("alt",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b",alignSelf:"center"}}>km</span></div></L></div>
        <div style={{flex:"1 1 120px"}}><L label="Inclination"><div style={{display:"flex",gap:8}}><input type="number" value={t.inc} onChange={e=>ut("inc",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b",alignSelf:"center"}}>deg</span></div></L></div>
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        <div style={{flex:"1 1 120px"}}><L label="Dry Mass"><div style={{display:"flex",gap:8}}><input type="number" value={t.mass} onChange={e=>ut("mass",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b",alignSelf:"center"}}>kg</span></div></L></div>
        <div style={{flex:"1 1 120px"}}><L label="Cross-Section"><div style={{display:"flex",gap:8}}><input type="number" value={t.area} onChange={e=>ut("area",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b",alignSelf:"center"}}>m²</span></div></L></div>
      </div>
      <h2 style={{fontSize:15,color:"#F59E0B",margin:"20px 0 16px",fontFamily:"monospace",letterSpacing:"0.1em"}}>PROPULSION</h2>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        <div style={{flex:"1 1 120px"}}><L label="Specific Impulse"><div style={{display:"flex",gap:8}}><input type="number" value={t.isp} onChange={e=>ut("isp",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b",alignSelf:"center"}}>s</span></div></L></div>
        <div style={{flex:"1 1 120px"}}><L label="Fuel Mass"><div style={{display:"flex",gap:8}}><input type="number" value={t.fuel} onChange={e=>ut("fuel",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b",alignSelf:"center"}}>kg</span></div></L></div>
      </div>
      <h2 style={{fontSize:15,color:"#F59E0B",margin:"20px 0 16px",fontFamily:"monospace",letterSpacing:"0.1em"}}>MISSION ECONOMICS</h2>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        <div style={{flex:"1 1 120px"}}><L label="Min Mission"><div style={{display:"flex",gap:8}}><input type="number" value={t.minDays} onChange={e=>ut("minDays",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b",alignSelf:"center"}}>days</span></div></L></div>
        <div style={{flex:"1 1 120px"}}><L label="Daily Revenue"><div style={{display:"flex",gap:8}}><input type="number" value={t.dailyRev} onChange={e=>ut("dailyRev",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b",alignSelf:"center"}}>$/d</span></div></L></div>
      </div>
      <button onClick={go} style={{width:"100%",padding:"14px",marginTop:16,background:"linear-gradient(135deg,#F59E0B,#D97706)",border:"none",borderRadius:8,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",letterSpacing:"0.08em",boxShadow:"0 4px 20px rgba(245,158,11,0.3)"}}>OPTIMIZE TRAJECTORY</button>
    </div></div>
    <div style={{flex:"1 1 440px",minWidth:320}}>
      {show&&r?(<div style={{opacity:anim?1:0,transform:anim?"translateY(0)":"translateY(20px)",transition:"all 0.6s"}}>
        {/* Orbital Mechanics */}
        <div style={{background:"#0b1426",border:"1px solid #132744",borderRadius:12,padding:24,marginBottom:20}}>
          <h3 style={{fontSize:13,color:"#F59E0B",margin:"0 0 16px",fontFamily:"monospace"}}>ORBITAL MECHANICS</h3>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <Stat label="Orbital Velocity" value={`${r.orbit.v0} m/s`} color="#00B4D8"/>
            <Stat label="Period" value={`${r.orbit.period} min`} color="#00B4D8"/>
            <Stat label="Natural Decay" value={r.decay.years>100?"∞":`${r.decay.years} yr`} color="#F97316"/>
          </div></div>
        {/* Delta-V */}
        <div style={{background:"#0b1426",border:"1px solid #132744",borderRadius:12,padding:24,marginBottom:20}}>
          <h3 style={{fontSize:13,color:"#F59E0B",margin:"0 0 16px",fontFamily:"monospace"}}>DELTA-V ANALYSIS</h3>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <Stat label="Available ΔV" value={`${r.dv.available} m/s`} color="#10B981"/>
            <Stat label="Required ΔV" value={`${r.dv.required} m/s`} color={r.dv.controlled?"#10B981":"#EF4444"}/>
            <Stat label="Controlled" value={r.dv.controlled?"YES":"NO"} color={r.dv.controlled?"#10B981":"#EF4444"}/>
          </div></div>
        {/* Reentry Risk */}
        <div style={{background:"#0b1426",border:`1px solid ${r.reentry.compliant?"#10B98133":"#EF444433"}`,borderRadius:12,padding:24,marginBottom:20}}>
          <h3 style={{fontSize:13,color:r.reentry.compliant?"#10B981":"#EF4444",margin:"0 0 16px",fontFamily:"monospace"}}>REENTRY RISK — {r.reentry.compliant?"NASA COMPLIANT ✓":"NON-COMPLIANT ✗"}</h3>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <Stat label="Casualty Risk" value={`1:${r.reentry.inverseRisk.toLocaleString()}`} color={r.reentry.compliant?"#10B981":"#EF4444"} sub="NASA threshold: 1:10,000"/>
            <Stat label="Casualty Area" value={`${r.reentry.casualtyArea} m²`} color="#94a3b8"/>
            <Stat label="Safety Margin" value={`${r.reentry.margin}%`} color={r.reentry.margin>0?"#10B981":"#EF4444"}/>
          </div></div>
        {/* Optimal Plan */}
        {r.optimal&&<div style={{background:"#0b1426",border:"1px solid #F59E0B33",borderRadius:12,padding:24,marginBottom:20}}>
          <h3 style={{fontSize:13,color:"#F59E0B",margin:"0 0 16px",fontFamily:"monospace"}}>OPTIMAL DEORBIT PLAN</h3>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
            <Stat label="Optimal Delay" value={`${r.optimal.d} days`} color="#F59E0B" sub={`${r.optimal.yrs} years`}/>
            <Stat label="Net Value" value={`$${r.optimal.net.toLocaleString()}`} color={r.optimal.net>=0?"#10B981":"#EF4444"}/>
            <Stat label="Total Cost" value={`$${r.optimal.total.toLocaleString()}`} color="#94a3b8"/>
          </div>
          {/* Scenario table */}
          <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>TOP SCENARIOS BY NET VALUE</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{color:"#64748b"}}>
                <th style={{padding:"6px 8px",textAlign:"left",borderBottom:"1px solid #1e3a5f"}}>Delay</th>
                <th style={{padding:"6px 8px",textAlign:"right",borderBottom:"1px solid #1e3a5f"}}>Revenue</th>
                <th style={{padding:"6px 8px",textAlign:"right",borderBottom:"1px solid #1e3a5f"}}>Cost</th>
                <th style={{padding:"6px 8px",textAlign:"right",borderBottom:"1px solid #1e3a5f"}}>Net</th>
              </tr></thead>
              <tbody>{[...r.scenarios].sort((a,b)=>b.net-a.net).slice(0,5).map((s,i)=>(
                <tr key={i} style={{color:s.d===r.optimal.d?"#F59E0B":"#94a3b8"}}>
                  <td style={{padding:"6px 8px",borderBottom:"1px solid #0f1d32"}}>{s.d}d ({s.yrs}yr)</td>
                  <td style={{padding:"6px 8px",textAlign:"right",borderBottom:"1px solid #0f1d32",color:"#10B981"}}>${s.rev.toLocaleString()}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",borderBottom:"1px solid #0f1d32",color:"#EF4444"}}>${s.total.toLocaleString()}</td>
                  <td style={{padding:"6px 8px",textAlign:"right",borderBottom:"1px solid #0f1d32",fontWeight:700,color:s.net>=0?"#10B981":"#EF4444"}}>${s.net.toLocaleString()}</td>
                </tr>))}</tbody>
            </table></div>
        </div>}
      </div>):(<div style={{background:"#0b1426",border:"1px solid #132744",borderRadius:12,padding:48,textAlign:"center",minHeight:400,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:48,opacity:0.15}}>⟳</div><div style={{fontSize:16,color:"#334155",marginTop:16}}>Enter orbital parameters to optimize</div></div>)}
    </div></div>);
}

// ==================== MAIN APP WITH TABS ====================
export default function App(){
  const[tab,setTab]=useState("sdgr");
  const tabStyle=(t)=>({padding:"10px 24px",fontSize:14,fontWeight:tab===t?700:400,color:tab===t?"#fff":"#64748b",background:tab===t?(t==="sdgr"?"#0891B2":"#D97706"):"transparent",border:"none",borderRadius:"8px 8px 0 0",cursor:"pointer",transition:"all 0.2s",letterSpacing:"0.05em"});
  return(<div style={{minHeight:"100vh",background:"#060d1b",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#e2e8f0"}}>
    {/* Header */}
    <div style={{background:"linear-gradient(180deg,#0b1a30,#060d1b)",borderBottom:"1px solid #0f2744",padding:"24px 32px"}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}><div style={{width:10,height:10,borderRadius:"50%",background:"#00B4D8",boxShadow:"0 0 12px #00B4D8"}}/><span style={{fontSize:13,color:"#00B4D8",fontFamily:"monospace",letterSpacing:"0.15em"}}>ODC MARKETS</span></div>
        <h1 style={{fontSize:28,fontWeight:700,margin:"8px 0 4px",color:"#f1f5f9"}}>Orbital Sustainability Platform</h1>
        <p style={{fontSize:14,color:"#64748b",margin:0}}>SDGR Scoring + Trajectory Optimization + Reentry Risk — Free v2.0</p>
      </div></div>
    {/* Tabs */}
    <div style={{maxWidth:1100,margin:"0 auto",padding:"16px 32px 0"}}>
      <button onClick={()=>setTab("sdgr")} style={tabStyle("sdgr")}>SDGR SCORING</button>
      <button onClick={()=>setTab("traj")} style={tabStyle("traj")}>TRAJECTORY OPTIMIZER</button>
    </div>
    {/* Content */}
    <div style={{maxWidth:1100,margin:"0 auto",padding:"0 32px 32px"}}>{tab==="sdgr"?<SDGRTab/>:<TrajectoryTab/>}</div>
    {/* Footer */}
    <div style={{borderTop:"1px solid #0f2744",padding:"20px 32px",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
      <div style={{fontSize:11,color:"#334155",fontFamily:"monospace"}}>© 2026 ODC Markets (Manish Malik) — Platform v2.0</div>
      <div style={{fontSize:11,color:"#334155"}}>SSRN: 6562481 | github.com/manish279/odc-markets</div>
    </div></div>);
}
