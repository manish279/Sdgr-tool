import { useState, useCallback, useMemo } from "react";

// SDGR SCORING TOOL v1.1 — © 2026 ODC Markets (Manish Malik). All rights reserved.

const ALTITUDE_BANDS = [
  { label: "Very Low (200-400 km)", densityFactor: 0.3 },
  { label: "Low (400-600 km)", densityFactor: 0.6 },
  { label: "Medium (600-800 km)", densityFactor: 0.85 },
  { label: "High Risk (800-1000 km)", densityFactor: 1.0 },
  { label: "Very High (1000-1200 km)", densityFactor: 0.95 },
  { label: "Sun-Sync (1200-2000 km)", densityFactor: 0.7 },
];
const PROPULSION_TYPES = [
  { label: "Active ion/electric", factor: 0.15 },
  { label: "Chemical bipropellant", factor: 0.25 },
  { label: "Chemical monopropellant", factor: 0.35 },
  { label: "Cold gas only", factor: 0.6 },
  { label: "Drag sail planned", factor: 0.5 },
  { label: "No propulsion", factor: 1.0 },
];
const SHIELDING_OPTIONS = [
  { label: "Whipple shield (enhanced)", factor: 0.4 },
  { label: "Whipple shield (standard)", factor: 0.6 },
  { label: "Basic aluminum hull", factor: 0.85 },
  { label: "No dedicated shielding", factor: 1.0 },
];

function calc(p, scod) {
  const a = ALTITUDE_BANDS[p.alt], pr = PROPULSION_TYPES[p.prop], sh = SHIELDING_OPTIONS[p.shield];
  const life = Math.min((parseFloat(p.life)||5)/25,1), con = Math.log10(Math.max(parseInt(p.con)||1,1))/Math.log10(10000);
  const pass = p.pass?0.5:1, track = p.track?0.7:1, ca = p.ca?0.5:1;
  const dy = parseFloat(p.deorbit)||25, deo = dy<=5?0.3:dy<=10?0.5:dy<=25?0.8:1;
  const area = Math.min((parseFloat(p.area)||1)/50,1), mass = Math.min((parseFloat(p.mass)||100)/5000,1);
  const raw = a.densityFactor*0.2+pr.factor*0.12+sh.factor*0.08+life*0.1+con*0.1+pass*0.08+track*0.05+ca*0.1+deo*0.1+area*0.04+mass*0.03;
  const score = Math.round(raw*100), cs = Math.max(parseInt(p.con)||1,1);
  const ext = Math.round(score*scod*cs*0.0001), fee = Math.round(ext/cs);
  let g,gc,gl;
  if(score<=20){g="A+";gc="#10B981";gl="Excellent — minimal debris risk";}
  else if(score<=35){g="A";gc="#34D399";gl="Good — low debris generation risk";}
  else if(score<=50){g="B";gc="#F59E0B";gl="Moderate — some mitigation recommended";}
  else if(score<=65){g="C";gc="#F97316";gl="Elevated — significant mitigation needed";}
  else if(score<=80){g="D";gc="#EF4444";gl="High — major debris risk contributor";}
  else{g="F";gc="#DC2626";gl="Critical — unsustainable orbital practice";}
  const comps = [
    {n:"Orbital Altitude",v:Math.round(a.densityFactor*100),w:"20%"},{n:"Propulsion System",v:Math.round(pr.factor*100),w:"12%"},
    {n:"Collision Avoidance",v:Math.round(ca*100),w:"10%"},{n:"Deorbit Compliance",v:Math.round(deo*100),w:"10%"},
    {n:"Design Lifetime",v:Math.round(life*100),w:"10%"},{n:"Constellation Size",v:Math.round(con*100),w:"10%"},
    {n:"Shielding",v:Math.round(sh.factor*100),w:"8%"},{n:"Passivation",v:Math.round(pass*100),w:"8%"},
    {n:"Trackability",v:Math.round(track*100),w:"5%"},{n:"Cross-Section",v:Math.round(area*100),w:"4%"},
    {n:"Mass",v:Math.round(mass*100),w:"3%"},
  ];
  const recs = [];
  if(score>60) recs.push({l:"Critical",c:"#EF4444",bg:"#1a0a0a",t:"Upgrade propulsion for active deorbit capability. Current configuration poses significant cascade risk."});
  if(score>40) recs.push({l:"Warning",c:"#F59E0B",bg:"#1a1400",t:"Reduce post-mission deorbit time below 5 years. ESA Zero Debris Charter will require this by 2030."});
  if(!p.ca) recs.push({l:"Advisory",c:"#F97316",bg:"#1a0f00",t:"Enable active collision avoidance — could reduce SDGR score by 10+ points."});
  if(!p.pass) recs.push({l:"Advisory",c:"#F97316",bg:"#1a0f00",t:"Implement end-of-life passivation to prevent post-mission breakup events."});
  if(score<=35) recs.push({l:"Excellent",c:"#10B981",bg:"#0a1a0a",t:"Strong debris sustainability practices. Qualifies for reduced ODC fees under OSF."});
  return {score,g,gc,gl,ext,fee,comps,recs,cs};
}

function exportPDF(r,p,scod){
  const al=ALTITUDE_BANDS[p.alt],pr=PROPULSION_TYPES[p.prop],sh=SHIELDING_OPTIONS[p.shield],d=new Date().toISOString().split("T")[0];
  const rows=r.comps.map(c=>{const b="█".repeat(Math.round(c.v/5))+"░".repeat(20-Math.round(c.v/5));return`<tr><td style="padding:5px 10px;border-bottom:1px solid #1e3a5f;color:#94a3b8;font-size:11px;">${c.n}</td><td style="padding:5px 8px;border-bottom:1px solid #1e3a5f;color:#e2e8f0;font-family:monospace;font-size:11px;">${c.v}%</td><td style="padding:5px 8px;border-bottom:1px solid #1e3a5f;color:#64748b;font-size:10px;">${c.w}</td><td style="padding:5px 8px;border-bottom:1px solid #1e3a5f;font-family:monospace;font-size:9px;color:${c.v<=30?'#10B981':c.v<=60?'#F59E0B':'#EF4444'};letter-spacing:-1px;">${b}</td></tr>`;}).join("");
  const rhtml=r.recs.map(x=>`<div style="padding:8px 12px;margin-bottom:6px;background:${x.bg};border-left:3px solid ${x.c};border-radius:0 6px 6px 0;font-size:11px;color:#cbd5e1;"><strong style="color:${x.c};">${x.l}:</strong> ${x.t}</div>`).join("");
  const h=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>SDGR Report</title><style>@page{size:A4;margin:0;}body{margin:0;padding:0;background:#060d1b;color:#e2e8f0;font-family:'Segoe UI',system-ui,sans-serif;}.p{width:210mm;min-height:297mm;padding:20mm 18mm;box-sizing:border-box;background:#060d1b;}</style></head><body><div class="p">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><div style="width:8px;height:8px;border-radius:50%;background:#00B4D8;box-shadow:0 0 8px #00B4D8;"></div><span style="font-size:11px;color:#00B4D8;letter-spacing:3px;font-family:monospace;">ODC MARKETS</span></div>
<h1 style="font-size:24px;margin:6px 0 2px;color:#f1f5f9;">SDGR Scoring Report</h1>
<div style="font-size:11px;color:#475569;margin-bottom:20px;">Generated ${d} — v1.1 — Malik (2026) OSF + Bongers & Torres (2026) SCOD</div>
<div style="border:1px solid ${r.gc}44;border-radius:10px;padding:18px;margin-bottom:16px;background:#0b1426;">
<div style="display:flex;align-items:center;gap:20px;">
<div style="text-align:center;min-width:100px;"><div style="font-size:56px;font-weight:bold;color:${r.gc};font-family:monospace;">${r.g}</div><div style="font-size:20px;color:#94a3b8;font-family:monospace;">${r.score}/100</div></div>
<div style="flex:1;"><div style="font-size:14px;color:${r.gc};font-weight:600;margin-bottom:10px;">${r.gl}</div>
<div style="display:flex;gap:12px;flex-wrap:wrap;">
<div style="flex:1;background:#060d1b;border-radius:6px;padding:10px;text-align:center;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Fleet Externality</div><div style="font-size:18px;font-weight:bold;color:#F59E0B;font-family:monospace;">$${r.ext.toLocaleString()}</div><div style="font-size:8px;color:#475569;">${r.cs} sat${r.cs>1?'s':''} / year</div></div>
<div style="flex:1;background:#060d1b;border-radius:6px;padding:10px;text-align:center;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">ODC Fee / Sat</div><div style="font-size:18px;font-weight:bold;color:#00B4D8;font-family:monospace;">$${r.fee.toLocaleString()}</div><div style="font-size:8px;color:#475569;">Per satellite / year</div></div>
<div style="flex:1;background:#060d1b;border-radius:6px;padding:10px;text-align:center;"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">SCOD Used</div><div style="font-size:18px;font-weight:bold;color:#94a3b8;font-family:monospace;">$${scod.toLocaleString()}</div><div style="font-size:8px;color:#475569;">Per debris >1cm</div></div>
</div></div></div></div>
<div style="display:flex;gap:12px;margin-bottom:16px;">
<div style="flex:1;background:#0b1426;border:1px solid #132744;border-radius:8px;padding:14px;">
<div style="font-size:10px;color:#00B4D8;letter-spacing:2px;font-family:monospace;margin-bottom:10px;">PARAMETERS</div>
<div style="font-size:11px;color:#94a3b8;line-height:1.9;">
Altitude: ${al.label}<br/>Propulsion: ${pr.label}<br/>Shielding: ${sh.label}<br/>
Life: ${p.life}yr | Deorbit: ${p.deorbit}yr | Fleet: ${p.con} sat(s)<br/>
Mass: ${p.mass}kg | Area: ${p.area}m² | Pass: ${p.pass?"Y":"N"} | Track: ${p.track?"Y":"N"} | CA: ${p.ca?"Y":"N"}
</div></div>
<div style="flex:1.2;background:#0b1426;border:1px solid #132744;border-radius:8px;padding:14px;">
<div style="font-size:10px;color:#00B4D8;letter-spacing:2px;font-family:monospace;margin-bottom:10px;">RISK BREAKDOWN</div>
<table style="width:100%;border-collapse:collapse;">${rows}</table>
</div></div>
${rhtml?`<div style="background:#0b1426;border:1px solid #132744;border-radius:8px;padding:14px;margin-bottom:16px;"><div style="font-size:10px;color:#00B4D8;letter-spacing:2px;font-family:monospace;margin-bottom:10px;">RECOMMENDATIONS</div>${rhtml}</div>`:""}
<div style="border-top:1px solid #132744;padding-top:12px;display:flex;justify-content:space-between;font-size:9px;color:#334155;">
<div>© 2026 ODC Markets (Manish Malik) — Free Evaluation</div><div>SSRN: 6562481 | github.com/manish279/odc-markets</div>
</div></div></body></html>`;
  const w=window.open("","_blank");if(w){w.document.write(h);w.document.close();setTimeout(()=>w.print(),600);}
}

function Gauge({score,grade,gc}){
  const ang=(score/100)*180,rad=(ang-90)*(Math.PI/180),nx=150+100*Math.cos(rad),ny=150+100*Math.sin(rad);
  return(<svg viewBox="0 0 300 180" style={{width:"100%",maxWidth:340}}>
    <defs><linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#10B981"/><stop offset="35%" stopColor="#F59E0B"/><stop offset="65%" stopColor="#F97316"/><stop offset="100%" stopColor="#EF4444"/></linearGradient></defs>
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
    <div style={{flex:1,background:"#0f1d32",borderRadius:4,height:16,overflow:"hidden"}}><div style={{width:`${v}%`,height:"100%",background:c,borderRadius:4,transition:"width 0.8s cubic-bezier(0.22,1,0.36,1)"}}/></div>
    <div style={{width:36,fontSize:12,color:"#64748b",textAlign:"right",fontFamily:"monospace"}}>{w}</div>
  </div>);}

const sel={width:"100%",padding:"10px 12px",background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:6,color:"#e2e8f0",fontSize:14,outline:"none",cursor:"pointer"};
const inp={flex:1,padding:"10px 12px",background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:6,color:"#e2e8f0",fontSize:14,fontFamily:"monospace",outline:"none"};

export default function App(){
  const [p,setP]=useState({alt:3,prop:0,shield:1,life:"7",con:"1",pass:true,track:true,ca:true,deorbit:"5",area:"4",mass:"500"});
  const [scod,setScod]=useState(84200);
  const [show,setShow]=useState(false);
  const [anim,setAnim]=useState(false);
  const u=useCallback((k,v)=>{setP(x=>({...x,[k]:v}));setShow(false);setAnim(false);},[]);
  const r=useMemo(()=>calc(p,scod),[p,scod]);
  const go=()=>{setShow(true);setAnim(false);setTimeout(()=>setAnim(true),50);};

  const L=({label,children,hint})=>(<div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,color:"#64748b",marginBottom:4,letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}</label>{children}{hint&&<div style={{fontSize:11,color:"#475569",marginTop:2}}>{hint}</div>}</div>);
  const T=({on,set,label})=>(<label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:8}}>
    <div onClick={()=>set(!on)} style={{width:40,height:22,borderRadius:11,background:on?"#00B4D8":"#1e3a5f",position:"relative",transition:"background 0.3s",cursor:"pointer"}}><div style={{width:16,height:16,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:on?21:3,transition:"left 0.3s"}}/></div>
    <span style={{fontSize:13,color:"#cbd5e1"}}>{label}</span></label>);

  return(<div style={{minHeight:"100vh",background:"#060d1b",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#e2e8f0"}}>
    <div style={{background:"linear-gradient(180deg,#0b1a30,#060d1b)",borderBottom:"1px solid #0f2744",padding:"24px 32px"}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}><div style={{width:10,height:10,borderRadius:"50%",background:"#00B4D8",boxShadow:"0 0 12px #00B4D8"}}/><span style={{fontSize:13,color:"#00B4D8",fontFamily:"monospace",letterSpacing:"0.15em"}}>ODC MARKETS</span></div>
        <h1 style={{fontSize:28,fontWeight:700,margin:"8px 0 4px",color:"#f1f5f9",letterSpacing:"-0.02em"}}>SDGR Scoring Tool</h1>
        <p style={{fontSize:14,color:"#64748b",margin:0,maxWidth:650}}>Space Debris Generation Risk assessment. Based on the Orbital Sustainability Framework. Free v1.1</p>
      </div></div>
    <div style={{maxWidth:1100,margin:"0 auto",padding:"32px",display:"flex",gap:32,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 440px",minWidth:320}}>
        <div style={{background:"#0b1426",border:"1px solid #132744",borderRadius:12,padding:24}}>
          <h2 style={{fontSize:15,color:"#00B4D8",margin:"0 0 20px",fontFamily:"monospace",letterSpacing:"0.1em"}}>SATELLITE PARAMETERS</h2>
          <L label="Operating Altitude" hint="Higher altitudes = greater debris density"><select value={p.alt} onChange={e=>u("alt",+e.target.value)} style={sel}>{ALTITUDE_BANDS.map((o,i)=><option key={i} value={i}>{o.label}</option>)}</select></L>
          <L label="Propulsion System" hint="Deorbit capability is critical"><select value={p.prop} onChange={e=>u("prop",+e.target.value)} style={sel}>{PROPULSION_TYPES.map((o,i)=><option key={i} value={i}>{o.label}</option>)}</select></L>
          <L label="Debris Shielding"><select value={p.shield} onChange={e=>u("shield",+e.target.value)} style={sel}>{SHIELDING_OPTIONS.map((o,i)=><option key={i} value={i}>{o.label}</option>)}</select></L>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            <div style={{flex:"1 1 120px"}}><L label="Design Life"><div style={{display:"flex",alignItems:"center",gap:8}}><input type="number" value={p.life} onChange={e=>u("life",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b"}}>yrs</span></div></L></div>
            <div style={{flex:"1 1 120px"}}><L label="Deorbit Time"><div style={{display:"flex",alignItems:"center",gap:8}}><input type="number" value={p.deorbit} onChange={e=>u("deorbit",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b"}}>yrs</span></div></L></div>
          </div>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            <div style={{flex:"1 1 120px"}}><L label="Constellation Size"><div style={{display:"flex",alignItems:"center",gap:8}}><input type="number" value={p.con} onChange={e=>u("con",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b"}}>sats</span></div></L></div>
            <div style={{flex:"1 1 120px"}}><L label="Satellite Mass"><div style={{display:"flex",alignItems:"center",gap:8}}><input type="number" value={p.mass} onChange={e=>u("mass",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b"}}>kg</span></div></L></div>
          </div>
          <L label="Cross-Sectional Area"><div style={{display:"flex",alignItems:"center",gap:8}}><input type="number" value={p.area} onChange={e=>u("area",e.target.value)} style={inp}/><span style={{fontSize:12,color:"#64748b"}}>m²</span></div></L>
          <div style={{marginTop:8}}>
            <T on={p.pass} set={v=>u("pass",v)} label="End-of-life passivation plan"/>
            <T on={p.track} set={v=>u("track",v)} label="SSA-trackable (radar reflector / transponder)"/>
            <T on={p.ca} set={v=>u("ca",v)} label="Active collision avoidance capability"/>
          </div>
          <div style={{marginTop:20,padding:16,background:"#060d1b",borderRadius:8,border:"1px solid #1e3a5f"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:12,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.05em"}}>SCOD Sensitivity</span>
              <span style={{fontSize:16,fontWeight:700,color:"#F59E0B",fontFamily:"monospace"}}>${scod.toLocaleString()}</span>
            </div>
            <input type="range" min={20000} max={200000} step={1000} value={scod} onChange={e=>setScod(+e.target.value)} style={{width:"100%",accentColor:"#00B4D8",cursor:"pointer"}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#475569",marginTop:4}}>
              <span>$20K (conservative)</span><span style={{color:"#F59E0B"}}>$84.2K (Bongers 2026)</span><span>$200K (high)</span>
            </div>
            <div style={{fontSize:10,color:"#334155",marginTop:6}}>Social Cost of Orbital Debris per piece &gt;1cm. Adjust to test fee sensitivity.</div>
          </div>
          <button onClick={go} style={{width:"100%",padding:"14px 24px",marginTop:20,background:"linear-gradient(135deg,#00B4D8,#0891B2)",border:"none",borderRadius:8,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",letterSpacing:"0.08em",boxShadow:"0 4px 20px rgba(0,180,216,0.3)",transition:"transform 0.2s,box-shadow 0.2s"}}
            onMouseEnter={e=>{e.target.style.transform="translateY(-1px)";e.target.style.boxShadow="0 6px 28px rgba(0,180,216,0.45)";}}
            onMouseLeave={e=>{e.target.style.transform="translateY(0)";e.target.style.boxShadow="0 4px 20px rgba(0,180,216,0.3)";}}>CALCULATE SDGR SCORE</button>
        </div></div>
      <div style={{flex:"1 1 440px",minWidth:320}}>
        {show?(<div style={{opacity:anim?1:0,transform:anim?"translateY(0)":"translateY(20px)",transition:"all 0.6s cubic-bezier(0.22,1,0.36,1)"}}>
          <div style={{background:"#0b1426",border:`1px solid ${r.gc}33`,borderRadius:12,padding:24,marginBottom:20,boxShadow:`0 0 40px ${r.gc}11`}}>
            <div style={{textAlign:"center",marginBottom:8}}><Gauge score={r.score} grade={r.g} gc={r.gc}/></div>
            <div style={{textAlign:"center",fontSize:14,color:r.gc,fontWeight:500,marginBottom:16}}>{r.gl}</div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {[{l:"Fleet Externality",v:`$${r.ext.toLocaleString()}`,c:"#F59E0B",s:`${r.cs} sat${r.cs>1?"s":""} / year`},
                {l:"ODC Fee / Sat",v:`$${r.fee.toLocaleString()}`,c:"#00B4D8",s:"Per satellite / year"},
                {l:"SCOD Used",v:`$${scod.toLocaleString()}`,c:"#94a3b8",s:"Per debris >1cm"}].map((x,i)=>(
                <div key={i} style={{flex:"1 1 100px",background:"#060d1b",borderRadius:8,padding:14,textAlign:"center"}}>
                  <div style={{fontSize:10,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4,fontFamily:"monospace"}}>{x.l}</div>
                  <div style={{fontSize:20,fontWeight:700,color:x.c,fontFamily:"monospace"}}>{x.v}</div>
                  <div style={{fontSize:9,color:"#475569",marginTop:2}}>{x.s}</div>
                </div>))}
            </div></div>
          <div style={{background:"#0b1426",border:"1px solid #132744",borderRadius:12,padding:24,marginBottom:20}}>
            <h3 style={{fontSize:13,color:"#00B4D8",margin:"0 0 16px",fontFamily:"monospace",letterSpacing:"0.1em"}}>RISK COMPONENT BREAKDOWN</h3>
            {r.comps.map((c,i)=><Bar key={i} n={c.n} v={c.v} w={c.w}/>)}
          </div>
          {r.recs.length>0&&<div style={{background:"#0b1426",border:"1px solid #132744",borderRadius:12,padding:24,marginBottom:20}}>
            <h3 style={{fontSize:13,color:"#00B4D8",margin:"0 0 12px",fontFamily:"monospace",letterSpacing:"0.1em"}}>RECOMMENDATIONS</h3>
            {r.recs.map((x,i)=><div key={i} style={{margin:"0 0 8px",padding:"10px 14px",background:x.bg,borderLeft:`3px solid ${x.c}`,borderRadius:"0 6px 6px 0",fontSize:13,color:"#94a3b8"}}><strong style={{color:x.c,textTransform:"uppercase"}}>{x.l}:</strong> {x.t}</div>)}
          </div>}
          <button onClick={()=>exportPDF(r,p,scod)} style={{width:"100%",padding:"12px 24px",background:"transparent",border:"1px solid #00B4D8",borderRadius:8,color:"#00B4D8",fontSize:14,fontWeight:600,cursor:"pointer",letterSpacing:"0.06em",transition:"all 0.2s"}}
            onMouseEnter={e=>{e.target.style.background="#00B4D811";}} onMouseLeave={e=>{e.target.style.background="transparent";}}>EXPORT PDF REPORT</button>
          <div style={{textAlign:"center",fontSize:10,color:"#1e293b",marginTop:12}}>Free evaluation — detailed compliance reports with commercial license</div>
        </div>):(
          <div style={{background:"#0b1426",border:"1px solid #132744",borderRadius:12,padding:48,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:400}}>
            <div style={{fontSize:48,marginBottom:16,opacity:0.15}}>◎</div>
            <div style={{fontSize:16,color:"#334155",fontWeight:500}}>Configure parameters and calculate</div>
            <div style={{fontSize:13,color:"#1e293b",marginTop:8}}>SDGR score, risk breakdown, and PDF report</div>
          </div>)}
      </div></div>
    <div style={{borderTop:"1px solid #0f2744",padding:"20px 32px",marginTop:40,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
      <div style={{fontSize:11,color:"#334155",fontFamily:"monospace"}}>© 2026 ODC Markets (Manish Malik) — SDGR Tool v1.1</div>
      <div style={{fontSize:11,color:"#334155"}}>SSRN: 6562481 — Malik (2026) OSF + Bongers & Torres (2026) SCOD</div>
    </div></div>);
}
