import { useState, useEffect, useRef, useCallback } from "react";

const LS = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const getApiKey = () => localStorage.getItem("finanzapp_apikey") || "";
const saveApiKey = (k) => localStorage.setItem("finanzapp_apikey", k);

const DEFAULT_STRUCTURE = {
  gastos: [
    { id: "ef", fuente: "Efectivo", label: "Gastos Efectivo", grupos: [
      { id: "ef-g1", label: "Alimentación y Otros", items: [{id:"ef-i1",label:"Frutería, Pescadería y Carnicería"},{id:"ef-i2",label:"Otros Gastos Alimentación"}] },
      { id: "ef-g2", label: "Trabajos de Limpieza", items: [{id:"ef-i3",label:"Sueldo Limpieza"}] },
      { id: "ef-g3", label: "Ropa", items: [{id:"ef-i4",label:"Ropa y Calzado"}] },
      { id: "ef-g4", label: "Otros Gastos Efectivo", items: [
        {id:"ef-i5",label:"Clases / Academia"},{id:"ef-i6",label:"Regalos"},{id:"ef-i7",label:"Celebraciones"},
        {id:"ef-i8",label:"Ocio"},{id:"ef-i9",label:"Viajes y Vacaciones"},{id:"ef-i10",label:"Lavado Coches"},
        {id:"ef-i11",label:"Campamentos"},{id:"ef-i12",label:"Pagas Hijos"},{id:"ef-i13",label:"Leña"},
        {id:"ef-i14",label:"Peluquería"},{id:"ef-i15",label:"Farmacia"},{id:"ef-i16",label:"Lotería"},
        {id:"ef-i17",label:"Otros Gastos Efectivo"},
      ]},
    ]},
    { id: "san", fuente: "Santander", label: "Gastos Santander", grupos: [
      { id: "san-g1", label: "Alimentación Supermercado", items: [{id:"san-i1",label:"Supermercados"},{id:"san-i2",label:"Pescadería"},{id:"san-i3",label:"Bofrost"}] },
      { id: "san-g2", label: "Seguros", items: [{id:"san-i4",label:"Seguro de Decesos"},{id:"san-i5",label:"Seguro Móviles"}] },
      { id: "san-g3", label: "Vehículos", items: [{id:"san-i6",label:"Combustible"},{id:"san-i7",label:"Revisión / Taller"},{id:"san-i8",label:"ITV"},{id:"san-i9",label:"Peaje Autopista"}] },
      { id: "san-g4", label: "Telefonía y TV", items: [{id:"san-i10",label:"Telefonía + TV"},{id:"san-i11",label:"Spotify"},{id:"san-i12",label:"Netflix"},{id:"san-i13",label:"iCloud"},{id:"san-i14",label:"Dropbox"}] },
      { id: "san-g5", label: "Suministros", items: [{id:"san-i15",label:"Gas Natural"},{id:"san-i16",label:"Zona Azul (e-Park)"}] },
      { id: "san-g6", label: "Hogar y Comunidad", items: [{id:"san-i17",label:"Alarma (Prosegur)"},{id:"san-i18",label:"Gimnasio"},{id:"san-i19",label:"Peluquería y Estética"},{id:"san-i20",label:"Comunidad Santander"}] },
      { id: "san-g7", label: "Otros Santander", items: [{id:"san-i21",label:"Antivirus"},{id:"san-i22",label:"Otros Gastos Santander"}] },
    ]},
    { id: "bbva", fuente: "BBVA", label: "Gastos BBVA", grupos: [
      { id: "bbva-g1", label: "Vivienda", items: [{id:"bbva-i1",label:"Préstamo de la Casa"},{id:"bbva-i2",label:"Seguro de la Casa"}] },
      { id: "bbva-g2", label: "Seguros BBVA", items: [{id:"bbva-i3",label:"Seguro Médico Sanitas"},{id:"bbva-i4",label:"Seguro de Vida Hipoteca"},{id:"bbva-i5",label:"Seguro del Vehículo"}] },
      { id: "bbva-g3", label: "Educación", items: [{id:"bbva-i6",label:"Hip Hop / Danza"},{id:"bbva-i7",label:"Clases de Inglés"},{id:"bbva-i8",label:"Otras Clases"}] },
      { id: "bbva-g4", label: "Suministros BBVA", items: [{id:"bbva-i9",label:"Electricidad"},{id:"bbva-i10",label:"Agua"}] },
      { id: "bbva-g5", label: "Inversión", items: [{id:"bbva-i11",label:"Plan de Pensiones"},{id:"bbva-i12",label:"Impuestos Municipales"}] },
      { id: "bbva-g6", label: "Otros BBVA", items: [{id:"bbva-i13",label:"Otros Gastos BBVA"}] },
    ]},
  ],
  ingresos: [
    { id: "ing-g1", label: "Ingresos por Nóminas", items: [{id:"ing-i1",label:"Nómina Base"},{id:"ing-i2",label:"Productividad / Guardia"},{id:"ing-i3",label:"Pagas Extras"}] },
    { id: "ing-g2", label: "Otros Ingresos", items: [{id:"ing-i4",label:"Devolución Hacienda"},{id:"ing-i5",label:"Otros Ingresos"}] },
  ],
};

const SOURCES = ["Efectivo", "Santander", "BBVA"];
const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTHS_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const currentYM = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const fmt = (n, compact=false) => {
  if (n===null||n===undefined||isNaN(n)) return "—";
  if (compact && Math.abs(n)>=1000) return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n);
  return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
};

function getAllItems(structure) {
  return [
    ...structure.gastos.flatMap(f => f.grupos.flatMap(g => g.items.map(i => ({ ...i, fuente: f.fuente })))),
    ...structure.ingresos.flatMap(g => g.items.map(i => ({ ...i, fuente: "Ingresos" }))),
  ];
}

function applyRules(description, rules) {
  if (!description || !rules?.length) return null;
  const desc = description.toLowerCase();
  const sorted = [...rules].sort((a,b) => (b.exact?1:0)-(a.exact?1:0));
  for (const rule of sorted) {
    const kw = rule.keyword.toLowerCase();
    if (rule.exact ? desc===kw : desc.includes(kw)) return { category: rule.category, source: rule.source };
  }
  return null;
}

async function classifyWithAI(transactions, structure) {
  const items = getAllItems(structure);
  const catList = items.map((c,i)=>`${i}:${c.label}(${c.fuente})`).join(", ");
  const prompt = `Eres asistente de finanzas personales español. Clasifica cada transacción en la subcategoría más adecuada:\n${catList}\n\nResponde SOLO con JSON array sin markdown: [{"id":"tx_id","catIndex":número}]\n\nTransacciones:\n${transactions.map(t=>`id:${t.id}|"${t.description}"|${t.amount}€`).join("\n")}`;
  const resp = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":getApiKey(),"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
  const data = await resp.json();
  const text = (data.content||[]).map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();
  try { return JSON.parse(text); } catch { return []; }
}

async function extractKeyword(description) {
  if (!getApiKey()) return null;
  const resp = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":getApiKey(),"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:100,messages:[{role:"user",content:`De esta descripción de extracto bancario: "${description}"\nExtrae la palabra o fragmento clave más identificativo del comercio/concepto (ej: MERCADONA, ENDESA, NETFLIX). Responde SOLO con la palabra clave, sin explicación ni comillas.`}]})});
  const data = await resp.json();
  return (data.content||[]).map(b=>b.text||"").join("").trim()||null;
}

async function extractPDF(base64) {
  const resp = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":getApiKey(),"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:base64}},{type:"text",text:'Extrae TODAS las transacciones bancarias. Responde SOLO con JSON array sin markdown:\n[{"date":"YYYY-MM-DD","description":"texto","amount":número}]\nGastos=negativo, Ingresos=positivo.'}]}]})});
  const data = await resp.json();
  const text = (data.content||[]).map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();
  try { return JSON.parse(text); } catch { return []; }
}

function parseCSV(text) {
  return text.trim().split(/\r?\n/).slice(1).map(line=>{
    const p=line.split(/[;,]/).map(s=>s.replace(/"/g,"").trim());
    if(p.length<3) return null;
    const amount=parseFloat(p[2].replace(",",".").replace(/[^0-9.-]/g,""));
    if(isNaN(amount)||!p[1]) return null;
    return {date:p[0]||today(),description:p[1],amount};
  }).filter(Boolean);
}

function parseExcelDate(val) {
  if(!val) return today();
  const s=String(val).trim();
  const m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if(/^\d{5}$/.test(s)){const d=new Date(Math.round((parseInt(s)-25569)*86400*1000));return d.toISOString().slice(0,10);}
  return today();
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600&family=Playfair+Display:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#f8f9fa;--s1:#ffffff;--s2:#f1f3f5;--s3:#e9ecef;--border:#dee2e6;--border2:#ced4da;--text:#212529;--muted:#6c757d;--hint:#adb5bd;--green:#16a34a;--red:#dc2626;--yellow:#d97706;--blue:#2563eb;--accent:#2563eb;--r:12px;--ff:'Figtree',sans-serif;--fd:'Playfair Display',serif}
body{background:var(--bg);color:var(--text);font-family:var(--ff);font-size:14px;line-height:1.5}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
.app{min-height:100vh;display:flex;flex-direction:column}
.hdr{background:var(--s1);border-bottom:1px solid var(--border);padding:12px 22px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;gap:10px;flex-wrap:wrap;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.hdr-icon{width:32px;height:32px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0}
.hdr-name{font-family:var(--fd);font-size:18px}.hdr-sub{font-size:11px;color:var(--muted)}
.hdr-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.src-tabs{display:flex;gap:2px;background:var(--s2);padding:3px;border-radius:9px;border:1px solid var(--border)}
.src-tab{padding:5px 11px;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;color:var(--muted);border:none;background:transparent;transition:all .15s;font-family:var(--ff)}
.src-tab.active{background:var(--accent);color:#fff}
.nav{background:var(--s1);border-bottom:1px solid var(--border);padding:0 22px;display:flex;gap:2px;overflow-x:auto}
.nb{padding:10px 15px;font-size:13px;font-weight:500;color:var(--muted);background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;transition:all .15s;font-family:var(--ff)}
.nb:hover{color:var(--text)}.nb.active{color:var(--accent);border-bottom-color:var(--accent)}
.main{flex:1;padding:18px 22px;max-width:1300px;margin:0 auto;width:100%}
@media(max-width:640px){.main{padding:12px}}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
@media(max-width:800px){.kpi-row{grid-template-columns:repeat(2,1fr)}}@media(max-width:400px){.kpi-row{grid-template-columns:1fr}}
.kpi{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:13px 15px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.kpi-label{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:5px}
.kpi-val{font-family:var(--fd);font-size:21px}.kpi-val.g{color:var(--green)}.kpi-val.r{color:var(--red)}.kpi-val.b{color:var(--blue)}
.kpi-sub{font-size:11px;color:var(--hint);margin-top:2px}
.card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:15px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.card-title{font-family:var(--fd);font-size:15px;margin-bottom:12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:13px}@media(max-width:700px){.grid2{grid-template-columns:1fr}}
.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid transparent;font-family:var(--ff);transition:all .15s}
.btn-p{background:var(--accent);color:#fff;border-color:var(--accent)}.btn-p:hover{background:#1d4ed8}
.btn-o{background:transparent;color:var(--text);border-color:var(--border)}.btn-o:hover{background:var(--s2)}
.btn-d{background:transparent;color:var(--red);border-color:var(--red)}.btn-d:hover{background:#fef2f2}
.btn-g{background:transparent;color:var(--green);border-color:var(--green)}.btn-g:hover{background:#f0fdf4}
.btn-sm{padding:5px 10px;font-size:12px}.btn:disabled{opacity:.4;cursor:not-allowed}
.sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;flex-wrap:wrap;gap:8px}
.sh-title{font-family:var(--fd);font-size:15px}
.fg{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.tx-list{display:flex;flex-direction:column;gap:1px}
.tx-row{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;cursor:pointer;border:1px solid transparent;transition:background .12s}
.tx-row:hover{background:var(--s2);border-color:var(--border)}
.tx-pill{font-size:10px;padding:2px 7px;border-radius:20px;background:var(--s2);color:var(--muted);border:1px solid var(--border);white-space:nowrap;flex-shrink:0}
.tx-src{font-size:10px;padding:2px 6px;border-radius:20px;border:1px solid var(--border2);color:var(--muted);flex-shrink:0}
.tx-desc{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.tx-meta{font-size:11px;color:var(--muted);display:flex;gap:5px;align-items:center;margin-top:2px;flex-wrap:wrap}
.tx-amt{font-family:var(--fd);font-size:14px;text-align:right;flex-shrink:0}
.tx-amt.g{color:var(--green)}.tx-amt.r{color:var(--red)}
.ai-pill{font-size:10px;padding:2px 6px;border-radius:20px;background:#eff6ff;color:var(--blue);border:1px solid #bfdbfe}
.rule-pill{font-size:10px;padding:2px 6px;border-radius:20px;background:#f0fdf4;color:var(--green);border:1px solid #bbf7d0}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}@media(max-width:480px){.form-grid{grid-template-columns:1fr}}
.field{display:flex;flex-direction:column;gap:5px}
.field label{font-size:11px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.06em}
.field input,.field select{background:var(--s2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 11px;font-family:var(--ff);font-size:13px;outline:none;transition:border-color .15s}
.field input:focus,.field select:focus{border-color:var(--accent)}.field select option{background:#fff}.full{grid-column:1/-1}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:100;padding:14px}
.modal{background:var(--s1);border:1px solid var(--border);border-radius:15px;padding:22px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.15)}
.modal-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
.modal-title{font-family:var(--fd);font-size:18px}
.modal-x{background:none;border:none;color:var(--muted);font-size:17px;cursor:pointer;line-height:1;padding:2px}.modal-x:hover{color:var(--text)}
.divider{height:1px;background:var(--border);margin:13px 0}
.drop-zone{border:2px dashed var(--border);border-radius:var(--r);padding:28px;text-align:center;cursor:pointer;transition:all .2s}
.drop-zone:hover,.drop-zone.drag{border-color:var(--accent);background:#eff6ff}
.bbar{height:6px;background:var(--s2);border-radius:4px;overflow:hidden}
.bbar-fill{height:100%;border-radius:4px;transition:width .4s ease}
.cmp-wrap{overflow-x:auto}
.cmp-table{width:100%;border-collapse:collapse;font-size:12px}
.cmp-table th{padding:7px 10px;text-align:right;font-weight:500;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border);white-space:nowrap}
.cmp-table th:first-child{text-align:left;width:35%}
.cmp-table td{padding:7px 10px;text-align:right;border-bottom:1px solid var(--border);color:var(--text)}
.cmp-table td:first-child{text-align:left}
.cmp-table tr.frow td{background:#eff6ff;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:9px 10px;color:#1e40af}
.cmp-table tr.grow td{background:var(--s2);font-weight:500;font-size:11px;color:var(--muted);padding:6px 10px}
.cmp-table tr.subtotal td{background:#f1f5ff;font-weight:600;border-top:1px solid var(--border2)}
.cmp-table tr:hover:not(.frow):not(.grow):not(.subtotal) td{background:#fafafa}
.over{color:var(--red)!important}.under{color:var(--green)!important}.neutral{color:var(--hint)!important}
.empty{text-align:center;padding:36px 14px;color:var(--muted)}
.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.toast{position:fixed;bottom:18px;right:18px;z-index:300;background:#212529;color:#f8f9fa;border-radius:10px;padding:10px 14px;font-size:13px;display:flex;align-items:center;gap:7px;animation:up .2s ease;box-shadow:0 8px 24px rgba(0,0,0,.2)}
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.sbar{background:var(--s2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 11px;font-size:13px;font-family:var(--ff);outline:none;flex:1;min-width:150px}
.sbar:focus{border-color:var(--accent)}
.msel{background:var(--s2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 11px;font-size:13px;font-family:var(--ff);outline:none;cursor:pointer}
.msel option{background:#fff}
.acc-hdr{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;background:var(--s2);border-radius:8px;cursor:pointer;border:1px solid var(--border);user-select:none;margin-bottom:4px;transition:background .12s}
.acc-hdr:hover{background:var(--s3)}
.acc-body{background:var(--s1);border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;padding:6px 0;margin-bottom:10px}
.editable-row{display:flex;align-items:center;gap:6px;padding:5px 10px;border-top:1px solid var(--border)}
.editable-row:hover{background:var(--s2)}
.inline-input{background:transparent;border:none;border-bottom:1px solid var(--accent);color:var(--text);font-family:var(--ff);font-size:13px;padding:1px 4px;outline:none;flex:1;min-width:80px}
.rule-row{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;border:1px solid var(--border);margin-bottom:6px;background:var(--s1)}
.period-tabs{display:flex;gap:3px;background:var(--s2);padding:3px;border-radius:9px;border:1px solid var(--border)}
.period-tab{padding:5px 12px;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;color:var(--muted);border:none;background:transparent;font-family:var(--ff);transition:all .15s}
.period-tab.active{background:var(--accent);color:#fff}
.badge{display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 7px;border-radius:20px}
.badge-blue{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
.badge-green{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
.badge-gray{background:var(--s2);color:var(--muted);border:1px solid var(--border)}
`;

export default function App() {
  const [tab,setTab]=useState("dashboard");
  const [source,setSource]=useState("Todos");
  const [transactions,setTransactions]=useState(()=>LS.get("fin_txs",[]));
  const [budgets,setBudgets]=useState(()=>LS.get("fin_budgets",{}));
  const [structure,setStructure]=useState(()=>LS.get("fin_structure",DEFAULT_STRUCTURE));
  const [rules,setRules]=useState(()=>LS.get("fin_rules",[]));
  const [selMonth,setSelMonth]=useState(currentYM);
  const [modal,setModal]=useState(null);
  const [editTx,setEditTx]=useState(null);
  const [toast,setToast]=useState(null);
  const [classifying,setClassifying]=useState(false);
  const [showApiModal,setShowApiModal]=useState(!getApiKey());

  useEffect(()=>{LS.set("fin_txs",transactions);},[transactions]);
  useEffect(()=>{LS.set("fin_budgets",budgets);},[budgets]);
  useEffect(()=>{LS.set("fin_structure",structure);},[structure]);
  useEffect(()=>{LS.set("fin_rules",rules);},[rules]);

  const showToast=(msg,icon="✓")=>{setToast({msg,icon});setTimeout(()=>setToast(null),3000);};

  const applyRulesToTx=useCallback((tx)=>{
    const match=applyRules(tx.description,rules);
    if(match) return {...tx,category:match.category,source:tx.source||match.source,ruleClassified:true,aiClassified:false};
    return tx;
  },[rules]);

  const filteredTxs=transactions.filter(t=>t.date?.startsWith(selMonth)&&(source==="Todos"||t.source===source));
  const income=filteredTxs.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const expense=filteredTxs.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);

  const addTx=(tx)=>{setTransactions(p=>[applyRulesToTx({...tx,id:uid()}),...p]);showToast("Añadido");setModal(null);};

  const updateTx=async(tx,learnFromChange)=>{
    setTransactions(p=>p.map(t=>t.id===tx.id?tx:t));
    if(learnFromChange&&tx.category&&tx.description){
      try{
        const keyword=await extractKeyword(tx.description);
        if(keyword&&keyword.length>2){
          const exists=rules.some(r=>r.keyword.toLowerCase()===keyword.toLowerCase());
          if(!exists){
            const newRule={id:uid(),keyword,category:tx.category,source:tx.source||"Efectivo",exact:false,auto:true};
            setRules(prev=>[newRule,...prev]);
            showToast(`Regla aprendida: "${keyword}" → ${tx.category}`);
            return;
          }
        }
      }catch{}
    }
    showToast("Guardado");setModal(null);setEditTx(null);
  };

  const deleteTx=(id)=>{setTransactions(p=>p.filter(t=>t.id!==id));showToast("Eliminado","🗑");setModal(null);setEditTx(null);};

  const classifyAll=async()=>{
    let updated=transactions.map(t=>!t.category?applyRulesToTx(t):t);
    const stillUncat=updated.filter(t=>!t.category);
    setTransactions(updated);
    if(!stillUncat.length){showToast("Todas clasificadas");return;}
    if(!getApiKey()){showToast("Configura tu API key","ℹ");return;}
    setClassifying(true);
    try{
      const res=await classifyWithAI(stillUncat.slice(0,40),structure);
      const allItems=getAllItems(structure);
      const map=Object.fromEntries(res.map(r=>[r.id,r.catIndex]));
      setTransactions(p=>p.map(t=>{
        if(map[t.id]!==undefined){const cat=allItems[map[t.id]];return{...t,category:cat?.label||t.category,source:t.source||cat?.fuente||"Efectivo",aiClassified:true,ruleClassified:false};}
        return t;
      }));
      showToast(`${res.length} clasificadas con IA`);
    }catch{showToast("Error IA","✕");}
    setClassifying(false);
  };

  const importTxs=(txs)=>{
    const withRules=txs.map(t=>applyRulesToTx({...t,id:uid()}));
    setTransactions(p=>[...withRules,...p]);
    const auto=withRules.filter(t=>t.ruleClassified).length;
    showToast(`${txs.length} importadas${auto>0?` · ${auto} clasificadas por reglas`:""}`);
    setTab("transactions");
  };

  const MonthOpts=()=>Array.from({length:28},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-i);const v=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;return <option key={v} value={v}>{MONTHS_FULL[d.getMonth()]} {d.getFullYear()}</option>;});

  return(
    <>
      <style>{CSS}</style>
      {showApiModal&&<ApiKeyModal onSave={(k)=>{saveApiKey(k);setShowApiModal(false);}}/>}
      <div className="app">
        <header className="hdr">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div className="hdr-icon">€</div>
            <div><div className="hdr-name">FinanzApp</div><div className="hdr-sub">Gastos domésticos</div></div>
          </div>
          <div className="hdr-right">
            <div className="src-tabs">{["Todos",...SOURCES].map(s=><button key={s} className={`src-tab${source===s?" active":""}`} onClick={()=>setSource(s)}>{s}</button>)}</div>
            <select className="msel" value={selMonth} onChange={e=>setSelMonth(e.target.value)}><MonthOpts/></select>
            <button className="btn btn-o btn-sm" onClick={()=>setShowApiModal(true)}>⚙ API Key</button>
          </div>
        </header>
        <nav className="nav">
          {[["dashboard","Resumen"],["transactions","Movimientos"],["comparison","Presupuesto vs Real"],["budgets","Presupuestos"],["rules","Criterios IA"],["structure","Estructura"],["import","Importar"]].map(([id,l])=>(
            <button key={id} className={`nb${tab===id?" active":""}`} onClick={()=>setTab(id)}>{l}</button>
          ))}
        </nav>
        <main className="main">
          {tab==="dashboard"&&<Dashboard filteredTxs={filteredTxs} income={income} expense={expense} source={source} selMonth={selMonth} transactions={transactions} setTab={setTab}/>}
          {tab==="transactions"&&<Transactions filteredTxs={filteredTxs} source={source} onAdd={()=>setModal("add")} onEdit={tx=>{setEditTx(tx);setModal("tx");}} classifying={classifying} onClassify={classifyAll}/>}
          {tab==="comparison"&&<Comparison transactions={transactions} budgets={budgets} selMonth={selMonth} source={source} structure={structure}/>}
          {tab==="budgets"&&<Budgets budgets={budgets} setBudgets={setBudgets} selMonth={selMonth} monthTxs={transactions.filter(t=>t.date?.startsWith(selMonth))} showToast={showToast} structure={structure}/>}
          {tab==="rules"&&<Rules rules={rules} setRules={setRules} structure={structure} showToast={showToast}/>}
          {tab==="structure"&&<StructureEditor structure={structure} setStructure={setStructure} showToast={showToast}/>}
          {tab==="import"&&<Import onImport={importTxs} showToast={showToast}/>}
        </main>
      </div>
      {modal==="add"&&<TxModal structure={structure} onClose={()=>setModal(null)} onSave={addTx}/>}
      {modal==="tx"&&editTx&&<TxModal tx={editTx} structure={structure} onClose={()=>{setModal(null);setEditTx(null);}} onSave={(tx,learn)=>updateTx(tx,learn)} onDelete={()=>deleteTx(editTx.id)}/>}
      {toast&&<div className="toast"><span>{toast.icon}</span>{toast.msg}</div>}
    </>
  );
}

function TxRow({tx,onClick}){
  const isIncome=tx.amount>0;
  return(
    <div className="tx-row" onClick={onClick}>
      <div style={{flex:1,minWidth:0}}>
        <div className="tx-desc">{tx.description}</div>
        <div className="tx-meta">{tx.date}{tx.source&&<span className="tx-src">{tx.source}</span>}{tx.aiClassified&&<span className="ai-pill">✦ IA</span>}{tx.ruleClassified&&<span className="rule-pill">⚡ Regla</span>}</div>
      </div>
      {tx.category&&<span className="tx-pill">{tx.category}</span>}
      <div className={`tx-amt ${isIncome?"g":"r"}`}>{isIncome?"+":"-"}{fmt(Math.abs(tx.amount),true)}</div>
    </div>
  );
}

function Dashboard({filteredTxs,income,expense,source,selMonth,transactions,setTab}){
  const balance=income-expense;
  const [y,m]=selMonth.split("-");
  const months6=Array.from({length:6},(_,i)=>{const d=new Date(parseInt(y),parseInt(m)-1-(5-i),1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;});
  const trendMax=Math.max(1,...months6.flatMap(mo=>{const mTxs=transactions.filter(t=>t.date?.startsWith(mo)&&(source==="Todos"||t.source===source));return[mTxs.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0),mTxs.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0)];}));
  const srcBreakdown=SOURCES.map(s=>({name:s,exp:transactions.filter(t=>t.date?.startsWith(selMonth)&&t.source===s&&t.amount<0).reduce((a,t)=>a+Math.abs(t.amount),0)}));
  const maxSrc=Math.max(1,...srcBreakdown.map(s=>s.exp));
  const byCat={};filteredTxs.filter(t=>t.amount<0&&t.category).forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+Math.abs(t.amount);});
  const topCats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const totalCatExp=topCats.reduce((s,[,v])=>s+v,0);
  return(
    <div>
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-label">Ingresos</div><div className="kpi-val g">{fmt(income,true)}</div><div className="kpi-sub">{filteredTxs.filter(t=>t.amount>0).length} mov.</div></div>
        <div className="kpi"><div className="kpi-label">Gastos</div><div className="kpi-val r">{fmt(expense,true)}</div><div className="kpi-sub">{filteredTxs.filter(t=>t.amount<0).length} mov.</div></div>
        <div className="kpi"><div className="kpi-label">Balance</div><div className={`kpi-val ${balance>=0?"g":"r"}`}>{fmt(balance,true)}</div><div className="kpi-sub">{balance>=0?"Mes positivo":"Mes en déficit"}</div></div>
        <div className="kpi"><div className="kpi-label">Movimientos</div><div className="kpi-val b">{filteredTxs.length}</div><div className="kpi-sub">{filteredTxs.filter(t=>!t.category).length} sin clasificar</div></div>
      </div>
      <div className="grid2" style={{marginBottom:13}}>
        <div className="card">
          <div className="card-title">Evolución 6 meses</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:5,height:84}}>
            {months6.map(mo=>{const mTxs=transactions.filter(t=>t.date?.startsWith(mo)&&(source==="Todos"||t.source===source));const inc=mTxs.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);const exp=mTxs.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);return(<div key={mo} style={{flex:1,display:"flex",alignItems:"flex-end",justifyContent:"center",gap:2}}><div style={{width:10,borderRadius:"3px 3px 0 0",height:`${Math.round(inc/trendMax*100)}%`,background:"var(--green)",opacity:mo===selMonth?1:.45}}/><div style={{width:10,borderRadius:"3px 3px 0 0",height:`${Math.round(exp/trendMax*100)}%`,background:"var(--red)",opacity:mo===selMonth?1:.45}}/></div>);})}
          </div>
          <div style={{display:"flex",gap:5,marginTop:6}}>{months6.map(mo=><div key={mo} style={{flex:1,textAlign:"center",fontSize:10,color:"var(--muted)"}}>{MONTHS[parseInt(mo.split("-")[1])-1]}</div>)}</div>
          <div style={{display:"flex",gap:12,marginTop:9}}>{[["var(--green)","Ingresos"],["var(--red)","Gastos"]].map(([c,l])=><span key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"var(--muted)"}}><span style={{width:7,height:7,borderRadius:2,background:c,display:"inline-block"}}/>{l}</span>)}</div>
        </div>
        <div className="card">
          <div className="card-title">Gastos por cuenta</div>
          {srcBreakdown.map((s,i)=>(<div key={s.name} style={{marginBottom:i<srcBreakdown.length-1?12:0}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:13}}><span>{s.name}</span><span style={{color:"var(--red)"}}>{fmt(s.exp,true)}</span></div><div className="bbar"><div className="bbar-fill" style={{width:`${Math.round(s.exp/maxSrc*100)}%`,background:s.name==="Efectivo"?"var(--yellow)":s.name==="Santander"?"var(--blue)":"var(--green)"}}/></div></div>))}
        </div>
      </div>
      {topCats.length>0&&<div className="card" style={{marginBottom:13}}><div className="card-title">Top categorías</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:9}}>{topCats.map(([cat,amt])=>{const pct=totalCatExp>0?Math.round(amt/totalCatExp*100):0;return(<div key={cat} style={{background:"var(--s2)",borderRadius:9,padding:"9px 11px",border:"1px solid var(--border)"}}><div style={{fontSize:12,fontWeight:500,marginBottom:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cat}</div><div className="bbar" style={{marginBottom:4}}><div className="bbar-fill" style={{width:`${pct}%`,background:"var(--red)"}}/></div><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--muted)"}}><span style={{color:"var(--red)"}}>{fmt(amt,true)}</span><span>{pct}%</span></div></div>);})}</div></div>}
      <div className="card"><div className="sh"><div className="card-title" style={{marginBottom:0}}>Últimos movimientos</div><button className="btn btn-o btn-sm" onClick={()=>setTab("transactions")}>Ver todos →</button></div>{filteredTxs.length===0?<div className="empty">Sin movimientos este mes</div>:<div className="tx-list">{filteredTxs.slice(0,8).map(t=><TxRow key={t.id} tx={t}/>)}</div>}</div>
    </div>
  );
}

function Transactions({filteredTxs,source,onAdd,onEdit,classifying,onClassify}){
  const [search,setSearch]=useState("");const [filterType,setFilterType]=useState("all");const [sortBy,setSortBy]=useState("date");
  const shown=filteredTxs.filter(t=>filterType==="all"||(filterType==="income"?t.amount>0:t.amount<0)).filter(t=>!search||t.description?.toLowerCase().includes(search.toLowerCase())||t.category?.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sortBy==="date"?b.date?.localeCompare(a.date):Math.abs(b.amount)-Math.abs(a.amount));
  const uncat=filteredTxs.filter(t=>!t.category).length;
  return(
    <div>
      <div className="sh"><div className="sh-title">Movimientos{source!=="Todos"?` · ${source}`:""}</div><div className="fg">{uncat>0&&<button className="btn btn-o btn-sm" onClick={onClassify} disabled={classifying}>{classifying?<span className="spin">⟳</span>:"✦"} Clasificar IA ({uncat})</button>}<button className="btn btn-p btn-sm" onClick={onAdd}>+ Añadir</button></div></div>
      <div className="fg" style={{marginBottom:11}}><input className="sbar" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>{[["all","Todos"],["income","Ingresos"],["expense","Gastos"]].map(([v,l])=><button key={v} className={`btn btn-sm ${filterType===v?"btn-p":"btn-o"}`} onClick={()=>setFilterType(v)}>{l}</button>)}<select className="msel" value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="date">Por fecha</option><option value="amount">Por importe</option></select></div>
      {shown.length===0?<div className="empty card">Sin resultados</div>:<div className="card" style={{padding:7}}><div className="tx-list">{shown.map(t=><TxRow key={t.id} tx={t} onClick={()=>onEdit(t)}/>)}</div></div>}
    </div>
  );
}

function Comparison({transactions,budgets,selMonth,source,structure}){
  const [viewSrc,setViewSrc]=useState("Todos");
  const [periodMode,setPeriodMode]=useState("month");
  const [rangeFrom,setRangeFrom]=useState(selMonth);
  const [rangeTo,setRangeTo]=useState(selMonth);
  useEffect(()=>{if(source!=="Todos")setViewSrc(source);},[source]);
  const [y,m]=selMonth.split("-");
  const getMonths=()=>{
    if(periodMode==="month") return [selMonth];
    if(periodMode==="year") return Array.from({length:12},(_,i)=>`${y}-${String(i+1).padStart(2,"0")}`);
    const months=[];const[fy,fm]=rangeFrom.split("-").map(Number);const[ty,tm]=rangeTo.split("-").map(Number);let cy=fy,cm=fm;
    while((cy<ty||(cy===ty&&cm<=tm))&&months.length<36){months.push(`${cy}-${String(cm).padStart(2,"0")}`);cm++;if(cm>12){cm=1;cy++;}}
    return months;
  };
  const activeMonths=getMonths();
  const getBudget=(label)=>{
    if(periodMode==="month") return budgets[label]?.[selMonth]??budgets[label]?.["*"]??null;
    const monthly=budgets[label]?.["*"]??null;
    return monthly!==null?monthly*activeMonths.length:null;
  };
  const realForCat=(label,isIncome=false)=>transactions.filter(t=>activeMonths.includes(t.date?.slice(0,7))&&t.category===label&&(viewSrc==="Todos"||t.source===viewSrc)&&(isIncome?t.amount>0:t.amount<0)).reduce((s,t)=>s+Math.abs(t.amount),0);
  const DiffCell=({budget,real,incomeDir=false})=>{if(budget===null)return<td className="neutral">—</td>;const diff=real-budget;const isOver=incomeDir?diff<0:diff>0;return<td className={isOver?"over":diff===0?"neutral":"under"}>{diff>0?"+":""}{fmt(diff,true)}</td>;};
  const PctBar=({budget,real})=>{if(!budget||budget===0)return<td/>;const pct=Math.min(100,Math.round(real/budget*100));return<td><div style={{display:"flex",alignItems:"center",gap:4}}><div className="bbar" style={{width:50,display:"inline-block",flexShrink:0}}><div className="bbar-fill" style={{width:`${pct}%`,background:real>budget?"var(--red)":"var(--green)"}}/></div><span style={{fontSize:10,color:"var(--muted)"}}>{pct}%</span></div></td>;};
  const fuentesToShow=viewSrc==="Todos"?structure.gastos:structure.gastos.filter(f=>f.fuente===viewSrc);
  const periodLabel=periodMode==="month"?`${MONTHS_FULL[parseInt(m)-1]} ${y}`:periodMode==="year"?`Año ${y}`:`${rangeFrom} → ${rangeTo}`;
  const MonthOpts=()=>Array.from({length:28},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-i);const v=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;return<option key={v} value={v}>{MONTHS_FULL[d.getMonth()]} {d.getFullYear()}</option>;});
  return(
    <div>
      <div className="sh"><div className="sh-title">Presupuesto vs Real — {periodLabel}</div><div className="src-tabs">{["Todos",...SOURCES].map(s=><button key={s} className={`src-tab${viewSrc===s?" active":""}`} onClick={()=>setViewSrc(s)}>{s}</button>)}</div></div>
      <div className="fg" style={{marginBottom:14}}>
        <div className="period-tabs">{[["month","Mes"],["year","Año"],["range","Período"]].map(([v,l])=><button key={v} className={`period-tab${periodMode===v?" active":""}`} onClick={()=>setPeriodMode(v)}>{l}</button>)}</div>
        {periodMode==="range"&&<><span style={{fontSize:12,color:"var(--muted)"}}>Desde</span><select className="msel" value={rangeFrom} onChange={e=>setRangeFrom(e.target.value)}><MonthOpts/></select><span style={{fontSize:12,color:"var(--muted)"}}>hasta</span><select className="msel" value={rangeTo} onChange={e=>setRangeTo(e.target.value)}><MonthOpts/></select></>}
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div className="cmp-wrap">
          <table className="cmp-table">
            <thead><tr><th style={{textAlign:"left"}}>Partida</th><th>Presupuesto</th><th>Real</th><th>Diferencia</th><th>Ejecución</th></tr></thead>
            <tbody>
              {fuentesToShow.map(fuente=>{
                const fItems=fuente.grupos.flatMap(g=>g.items.map(i=>i.label));const fReal=fItems.reduce((s,i)=>s+realForCat(i),0);const fBudget=fItems.reduce((s,i)=>{const b=getBudget(i);return b!==null?s+b:s;},0);
                return(<>
                  <tr className="frow" key={fuente.id}><td colSpan={5} style={{color:fuente.fuente==="Efectivo"?"#b45309":fuente.fuente==="Santander"?"#1d4ed8":"#15803d"}}>{fuente.label}</td></tr>
                  {fuente.grupos.map(g=>{const gReal=g.items.reduce((s,i)=>s+realForCat(i.label),0);const gBudget=g.items.reduce((s,i)=>{const b=getBudget(i.label);return b!==null?s+b:s;},0);return(<>
                    <tr className="grow" key={g.id}><td colSpan={5} style={{paddingLeft:14}}>{g.label}</td></tr>
                    {g.items.map(item=>{const b=getBudget(item.label);const r=realForCat(item.label);return(<tr key={item.id}><td style={{paddingLeft:24,fontSize:12}}>{item.label}</td><td style={{color:"var(--muted)"}}>{b!==null?fmt(b,true):"—"}</td><td style={{color:r>0?"var(--red)":"var(--hint)"}}>{r>0?fmt(r,true):"—"}</td><DiffCell budget={b} real={r}/><PctBar budget={b} real={r}/></tr>);})}
                    <tr className="subtotal"><td style={{paddingLeft:14}}>Subtotal {g.label}</td><td style={{color:"var(--muted)"}}>{gBudget>0?fmt(gBudget,true):"—"}</td><td style={{color:"var(--red)"}}>{gReal>0?fmt(gReal,true):"—"}</td><DiffCell budget={gBudget>0?gBudget:null} real={gReal}/><PctBar budget={gBudget>0?gBudget:null} real={gReal}/></tr>
                  </>);})}
                  <tr className="subtotal" style={{borderTop:"2px solid var(--border2)"}}><td style={{paddingLeft:10}}>TOTAL {fuente.label.toUpperCase()}</td><td style={{color:"var(--muted)"}}>{fBudget>0?fmt(fBudget,true):"—"}</td><td style={{color:"var(--red)"}}>{fReal>0?fmt(fReal,true):"—"}</td><DiffCell budget={fBudget>0?fBudget:null} real={fReal}/><PctBar budget={fBudget>0?fBudget:null} real={fReal}/></tr>
                </>);
              })}
              <tr className="frow"><td colSpan={5} style={{color:"#15803d"}}>Ingresos</td></tr>
              {structure.ingresos.map(g=>(<>
                <tr className="grow" key={g.id}><td colSpan={5} style={{paddingLeft:14}}>{g.label}</td></tr>
                {g.items.map(item=>{const b=getBudget(item.label);const r=realForCat(item.label,true);return(<tr key={item.id}><td style={{paddingLeft:24,fontSize:12}}>{item.label}</td><td style={{color:"var(--muted)"}}>{b!==null?fmt(b,true):"—"}</td><td style={{color:r>0?"var(--green)":"var(--hint)"}}>{r>0?fmt(r,true):"—"}</td><DiffCell budget={b} real={r} incomeDir/><PctBar budget={b} real={r}/></tr>);})}
              </>))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Budgets({budgets,setBudgets,selMonth,monthTxs,showToast,structure}){
  const [local,setLocal]=useState(()=>JSON.parse(JSON.stringify(budgets)));
  const [mode,setMode]=useState("monthly");const [open,setOpen]=useState(null);
  const setVal=(label,val)=>{setLocal(prev=>{const key=mode==="annual"?"*":selMonth;if(!val||val===""){const next={...prev};if(next[label]){const{[key]:_,...rest}=next[label];next[label]=rest;if(!Object.keys(next[label]).length)delete next[label];}return next;}return{...prev,[label]:{...(prev[label]||{}),[key]:parseFloat(val)}};});};
  const getVal=(label)=>{const e=local[label];if(!e)return"";const key=mode==="annual"?"*":selMonth;return e[key]??e["*"]??"";}
  const save=()=>{setBudgets(local);showToast("Presupuestos guardados");};
  const renderSection=(title,grupos,color)=>{const isOpen=open===title;return(<div key={title}><div className="acc-hdr" onClick={()=>setOpen(isOpen?null:title)}><span style={{fontWeight:500,fontSize:13,color}}>{title}</span><span style={{color:"var(--hint)",fontSize:11}}>{isOpen?"▲":"▼"}</span></div>{isOpen&&<div className="acc-body">{grupos.map(g=>(<div key={g.id}><div style={{padding:"5px 13px",fontSize:11,fontWeight:600,color:"var(--hint)",textTransform:"uppercase",letterSpacing:".06em"}}>{g.label}</div>{g.items.map(item=>{const real=monthTxs.filter(t=>t.category===item.label).reduce((s,t)=>s+Math.abs(t.amount),0);return(<div key={item.id} style={{display:"flex",alignItems:"center",gap:9,padding:"5px 13px 5px 22px"}}><span style={{flex:1,fontSize:12}}>{item.label}</span>{real>0&&<span style={{fontSize:11,color:"var(--muted)"}}>Real: {fmt(real,true)}</span>}<input type="number" min="0" step="10" value={getVal(item.label)} onChange={e=>setVal(item.label,e.target.value)} placeholder="—" style={{width:95,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--text)",borderRadius:7,padding:"4px 8px",fontSize:12,fontFamily:"var(--ff)",outline:"none",textAlign:"right"}}/><span style={{fontSize:11,color:"var(--hint)",width:10}}>€</span></div>);})}</div>))}</div>}</div>);};
  return(<div><div className="sh"><div className="sh-title">Presupuestos</div><div className="fg"><div className="src-tabs"><button className={`src-tab${mode==="monthly"?" active":""}`} onClick={()=>setMode("monthly")}>Este mes</button><button className={`src-tab${mode==="annual"?" active":""}`} onClick={()=>setMode("annual")}>Todos los meses</button></div><button className="btn btn-p btn-sm" onClick={save}>Guardar</button></div></div>{structure.gastos.map(f=>renderSection(f.label,f.grupos,f.fuente==="Efectivo"?"#b45309":f.fuente==="Santander"?"#1d4ed8":"#15803d"))}{renderSection("Ingresos",structure.ingresos,"#15803d")}<div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}><button className="btn btn-p" onClick={save}>Guardar presupuestos</button></div></div>);
}

function Rules({rules,setRules,structure,showToast}){
  const [newKw,setNewKw]=useState("");const [newCat,setNewCat]=useState("");const [newSrc,setNewSrc]=useState("Efectivo");const [newExact,setNewExact]=useState(false);
  const allItems=getAllItems(structure);
  const addRule=()=>{if(!newKw||!newCat)return;setRules(p=>[{id:uid(),keyword:newKw.trim(),category:newCat,source:newSrc,exact:newExact,auto:false},...p]);setNewKw("");setNewCat("");showToast("Regla añadida");};
  const deleteRule=(id)=>{setRules(p=>p.filter(r=>r.id!==id));showToast("Regla eliminada","🗑");};
  return(
    <div>
      <div className="sh"><div className="sh-title">Criterios de clasificación</div><div style={{fontSize:12,color:"var(--muted)"}}>{rules.length} reglas activas · se aplican antes que la IA</div></div>
      <div className="card" style={{marginBottom:14}}>
        <div className="card-title">Nueva regla</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div className="field"><label>Si el extracto contiene</label><input value={newKw} onChange={e=>setNewKw(e.target.value)} placeholder="Ej: MERCADONA" onKeyDown={e=>e.key==="Enter"&&addRule()}/></div>
          <div className="field"><label>Asignar a categoría</label><select value={newCat} onChange={e=>setNewCat(e.target.value)}><option value="">Seleccionar...</option>{allItems.map(i=><option key={i.id} value={i.label}>{i.label} ({i.fuente})</option>)}</select></div>
          <div className="field"><label>Cuenta</label><select value={newSrc} onChange={e=>setNewSrc(e.target.value)}>{SOURCES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <div className="field"><label>Tipo de coincidencia</label><div className="src-tabs" style={{marginTop:2}}><button className={`src-tab${!newExact?" active":""}`} onClick={()=>setNewExact(false)}>Fragmento</button><button className={`src-tab${newExact?" active":""}`} onClick={()=>setNewExact(true)}>Exacta</button></div></div>
        </div>
        <button className="btn btn-p btn-sm" onClick={addRule} disabled={!newKw||!newCat}>+ Añadir regla</button>
      </div>
      {rules.length===0?<div className="empty card">Sin reglas. Añade una arriba o corrige movimientos para que la app aprenda automáticamente.</div>:
        <div className="card">{rules.map(r=>(
          <div key={r.id} className="rule-row">
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3,flexWrap:"wrap"}}>
                <span style={{fontWeight:600,fontSize:13,fontFamily:"monospace",background:"var(--s2)",padding:"1px 7px",borderRadius:5,border:"1px solid var(--border)"}}>{r.keyword}</span>
                <span style={{fontSize:12,color:"var(--muted)"}}>→</span>
                <span style={{fontSize:13,fontWeight:500}}>{r.category}</span>
                <span className={`badge ${r.exact?"badge-blue":"badge-gray"}`}>{r.exact?"Exacta":"Fragmento"}</span>
                {r.auto&&<span className="badge badge-green">⚡ Auto</span>}
              </div>
              <div style={{fontSize:11,color:"var(--muted)"}}>Cuenta: {r.source}</div>
            </div>
            <button className="btn btn-d btn-sm" onClick={()=>deleteRule(r.id)}>✕</button>
          </div>
        ))}</div>}
    </div>
  );
}

function StructureEditor({structure,setStructure,showToast}){
  const [editingId,setEditingId]=useState(null);const [editVal,setEditVal]=useState("");const [open,setOpen]=useState(null);
  const save=(newStr)=>{setStructure(newStr);showToast("Estructura guardada");};
  const renameItem=(path,newLabel)=>{
    if(!newLabel.trim()){setEditingId(null);return;}
    const next=JSON.parse(JSON.stringify(structure));
    if(path.type==="bloque"){const b=next.gastos.find(f=>f.id===path.bid);if(b)b.label=newLabel;}
    else if(path.type==="grupo"){const b=next.gastos.find(f=>f.id===path.bid);const grupos=b?b.grupos:next.ingresos;const g=grupos.find(g=>g.id===path.gid);if(g)g.label=newLabel;}
    else if(path.type==="item"){const allG=[...next.gastos.flatMap(f=>f.grupos),...next.ingresos];const g=allG.find(g=>g.id===path.gid);if(g){const item=g.items.find(i=>i.id===path.iid);if(item)item.label=newLabel;}}
    save(next);setEditingId(null);
  };
  const deleteItem=(path)=>{
    const next=JSON.parse(JSON.stringify(structure));
    if(path.type==="bloque")next.gastos=next.gastos.filter(f=>f.id!==path.bid);
    else if(path.type==="grupo"){const b=next.gastos.find(f=>f.id===path.bid);if(b)b.grupos=b.grupos.filter(g=>g.id!==path.gid);else next.ingresos=next.ingresos.filter(g=>g.id!==path.gid);}
    else if(path.type==="item"){const allG=[...next.gastos.flatMap(f=>f.grupos),...next.ingresos];const g=allG.find(g=>g.id===path.gid);if(g)g.items=g.items.filter(i=>i.id!==path.iid);}
    save(next);
  };
  const addToGroup=(gid,label,isIngresos=false)=>{
    if(!label.trim())return;
    const next=JSON.parse(JSON.stringify(structure));
    const allG=[...next.gastos.flatMap(f=>f.grupos),...next.ingresos];
    const g=allG.find(g=>g.id===gid);if(g)g.items.push({id:uid(),label:label.trim()});
    save(next);
  };
  const addGroup=(bid,label,isIngresos=false)=>{
    if(!label.trim())return;
    const next=JSON.parse(JSON.stringify(structure));
    if(isIngresos)next.ingresos.push({id:uid(),label:label.trim(),items:[]});
    else{const b=next.gastos.find(f=>f.id===bid);if(b)b.grupos.push({id:uid(),label:label.trim(),items:[]});}
    save(next);
  };

  const IE=({id,val,path})=>{
    if(editingId===id) return<input className="inline-input" value={editVal} autoFocus onChange={e=>setEditVal(e.target.value)} onBlur={()=>renameItem(path,editVal)} onKeyDown={e=>{if(e.key==="Enter")renameItem(path,editVal);if(e.key==="Escape")setEditingId(null);}}/>;
    return<span style={{fontSize:13,flex:1,cursor:"text"}} onDoubleClick={()=>{setEditingId(id);setEditVal(val);}}>{val} <span style={{fontSize:10,color:"var(--hint)",opacity:.6}}>✎</span></span>;
  };

  const AddLine=({placeholder,onAdd})=>{const[v,setV]=useState("");return<div style={{display:"flex",gap:5,padding:"4px 10px"}}><input value={v} onChange={e=>setV(e.target.value)} placeholder={placeholder} onKeyDown={e=>{if(e.key==="Enter"&&v.trim()){onAdd(v.trim());setV("");}}} style={{flex:1,background:"var(--s2)",border:"1px dashed var(--border2)",color:"var(--text)",borderRadius:6,padding:"3px 8px",fontSize:12,fontFamily:"var(--ff)",outline:"none"}}/><button className="btn btn-g btn-sm" onClick={()=>{if(v.trim()){onAdd(v.trim());setV("");}}}>+</button></div>;};

  const renderBloque=(fuente)=>{
    const isOpen=open===fuente.id;const color=fuente.fuente==="Efectivo"?"#b45309":fuente.fuente==="Santander"?"#1d4ed8":"#15803d";
    return(<div key={fuente.id} style={{marginBottom:8}}>
      <div className="acc-hdr">
        <div style={{flex:1,display:"flex",alignItems:"center",gap:8}} onClick={()=>setOpen(isOpen?null:fuente.id)}>
          <IE id={`b-${fuente.id}`} val={fuente.label} path={{type:"bloque",bid:fuente.id}}/>
          <span style={{fontSize:10,padding:"1px 7px",borderRadius:20,background:color+"22",color,border:`1px solid ${color}44`}}>{fuente.fuente}</span>
        </div>
        <button className="btn btn-d btn-sm" style={{padding:"2px 7px",marginLeft:4}} onClick={()=>deleteItem({type:"bloque",bid:fuente.id})}>✕</button>
        <span style={{color:"var(--hint)",fontSize:11,marginLeft:6}} onClick={()=>setOpen(isOpen?null:fuente.id)}>{isOpen?"▲":"▼"}</span>
      </div>
      {isOpen&&<div className="acc-body">
        {fuente.grupos.map(g=>(<div key={g.id} style={{margin:"6px 10px",border:"1px solid var(--border)",borderRadius:8,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"7px 10px",background:"var(--s2)"}}>
            <IE id={`g-${g.id}`} val={g.label} path={{type:"grupo",bid:fuente.id,gid:g.id}}/>
            <button className="btn btn-d btn-sm" style={{padding:"1px 6px",fontSize:11}} onClick={()=>deleteItem({type:"grupo",bid:fuente.id,gid:g.id})}>✕</button>
          </div>
          {g.items.map(item=>(<div key={item.id} className="editable-row" style={{paddingLeft:20}}>
            <IE id={`i-${item.id}`} val={item.label} path={{type:"item",gid:g.id,iid:item.id}}/>
            <button className="btn btn-d btn-sm" style={{padding:"1px 5px",fontSize:10,opacity:.5}} onClick={()=>deleteItem({type:"item",gid:g.id,iid:item.id})}>✕</button>
          </div>))}
          <AddLine placeholder="+ Nueva partida (Enter para añadir)..." onAdd={label=>addToGroup(g.id,label)}/>
        </div>))}
        <AddLine placeholder="+ Nuevo grupo..." onAdd={label=>addGroup(fuente.id,label)}/>
      </div>}
    </div>);
  };

  return(
    <div>
      <div className="sh"><div className="sh-title">Estructura de categorías</div><div style={{fontSize:12,color:"var(--muted)"}}>Doble clic para renombrar · ✕ para eliminar</div></div>
      {structure.gastos.map(f=>renderBloque(f))}
      <div style={{marginBottom:8}}>
        <div className="acc-hdr" onClick={()=>setOpen(open==="ing"?null:"ing")}><span style={{fontWeight:500,fontSize:13,color:"#15803d"}}>Ingresos</span><span style={{color:"var(--hint)",fontSize:11}}>{open==="ing"?"▲":"▼"}</span></div>
        {open==="ing"&&<div className="acc-body">
          {structure.ingresos.map(g=>(<div key={g.id} style={{margin:"6px 10px",border:"1px solid var(--border)",borderRadius:8,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"7px 10px",background:"var(--s2)"}}><IE id={`ig-${g.id}`} val={g.label} path={{type:"grupo",bid:"ing",gid:g.id}}/><button className="btn btn-d btn-sm" style={{padding:"1px 6px",fontSize:11}} onClick={()=>deleteItem({type:"grupo",bid:"ing",gid:g.id})}>✕</button></div>
            {g.items.map(item=>(<div key={item.id} className="editable-row" style={{paddingLeft:20}}><IE id={`ii-${item.id}`} val={item.label} path={{type:"item",gid:g.id,iid:item.id}}/><button className="btn btn-d btn-sm" style={{padding:"1px 5px",fontSize:10,opacity:.5}} onClick={()=>deleteItem({type:"item",gid:g.id,iid:item.id})}>✕</button></div>))}
            <AddLine placeholder="+ Nueva partida..." onAdd={label=>addToGroup(g.id,label)}/>
          </div>))}
          <AddLine placeholder="+ Nuevo grupo de ingresos..." onAdd={label=>addGroup(null,label,true)}/>
        </div>}
      </div>
      <div className="card" style={{marginTop:14}}>
        <div className="card-title">Añadir nuevo bloque de gastos</div>
        <NewBloqueForm onAdd={(label,fuente)=>{const next=JSON.parse(JSON.stringify(structure));next.gastos.push({id:uid(),fuente,label,grupos:[]});save(next);}}/>
      </div>
    </div>
  );
}

function NewBloqueForm({onAdd}){
  const [label,setLabel]=useState("");const [fuente,setFuente]=useState("Efectivo");
  return(<div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
    <div className="field" style={{flex:1}}><label>Nombre del bloque</label><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Ej: Gastos Empresa"/></div>
    <div className="field"><label>Cuenta</label><select value={fuente} onChange={e=>setFuente(e.target.value)}>{SOURCES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
    <button className="btn btn-p" onClick={()=>{if(label.trim()){onAdd(label.trim(),fuente);setLabel("");}}}>Crear bloque</button>
  </div>);
}

function Import({onImport,showToast}){
  const [dragging,setDragging]=useState(false);const [processing,setProcessing]=useState(false);const [preview,setPreview]=useState([]);const [previewSrc,setPreviewSrc]=useState("Efectivo");const fileRef=useRef();
  const processFile=async(file)=>{
    setProcessing(true);setPreview([]);
    try{
      const ext=file.name.split(".").pop().toLowerCase();let raw=[];
      if(ext==="csv")raw=parseCSV(await file.text());
      else if(ext==="pdf"){const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});raw=await extractPDF(b64);}
      else if(ext==="xlsx"||ext==="xls"){const{read,utils}=await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");const wb=read(await file.arrayBuffer());const ws=wb.Sheets[wb.SheetNames[0]];const rows=utils.sheet_to_json(ws,{header:1,raw:false,dateNF:"dd/mm/yyyy"});raw=rows.slice(1).map(r=>{if(r.length<3)return null;const amt=parseFloat(String(r[2]).replace(",",".").replace(/[^0-9.-]/g,""));if(isNaN(amt)||!r[1])return null;return{date:parseExcelDate(r[0]),description:String(r[1]),amount:amt};}).filter(Boolean);}
      else showToast("Formato no soportado","✕");
      setPreview(raw);
    }catch(e){showToast("Error: "+e.message,"✕");}
    setProcessing(false);
  };
  return(
    <div>
      <div className="sh-title" style={{fontFamily:"var(--fd)",fontSize:15,marginBottom:13}}>Importar extracto bancario</div>
      <div className="card" style={{marginBottom:13}}>
        <div className="fg" style={{marginBottom:13}}><span style={{fontSize:13,fontWeight:500}}>Cuenta:</span><div className="src-tabs">{SOURCES.map(s=><button key={s} className={`src-tab${previewSrc===s?" active":""}`} onClick={()=>setPreviewSrc(s)}>{s}</button>)}</div></div>
        <div className={`drop-zone${dragging?" drag":""}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(e.dataTransfer.files[0])processFile(e.dataTransfer.files[0]);}} onClick={()=>fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".csv,.pdf,.xlsx,.xls" style={{display:"none"}} onChange={e=>e.target.files[0]&&processFile(e.target.files[0])}/>
          {processing?<><div style={{fontSize:28,marginBottom:8}} className="spin">⟳</div><div style={{fontSize:13}}>Procesando...</div></>:<><div style={{fontSize:28,marginBottom:8}}>↑</div><div style={{fontSize:13,marginBottom:3}}>Arrastra el extracto aquí o haz clic</div><div style={{fontSize:11,color:"var(--muted)"}}>PDF · CSV · Excel — Cuenta: {previewSrc}</div></>}
        </div>
      </div>
      {preview.length>0&&<div className="card"><div className="sh"><div className="card-title" style={{marginBottom:0}}>Vista previa — {preview.length} transacciones · {previewSrc}</div><div className="fg"><button className="btn btn-o btn-sm" onClick={()=>setPreview([])}>Cancelar</button><button className="btn btn-p btn-sm" onClick={()=>onImport(preview.map(t=>({...t,source:previewSrc})))}>Importar →</button></div></div><div className="tx-list">{preview.slice(0,25).map((t,i)=><div key={i} className="tx-row"><div style={{flex:1,minWidth:0}}><div className="tx-desc">{t.description}</div><div className="tx-meta">{t.date}</div></div><div className={`tx-amt ${t.amount>=0?"g":"r"}`}>{t.amount>=0?"+":""}{fmt(t.amount,true)}</div></div>)}{preview.length>25&&<div style={{textAlign:"center",padding:9,color:"var(--muted)",fontSize:12}}>…y {preview.length-25} más</div>}</div></div>}
    </div>
  );
}

function TxModal({tx,structure,onClose,onSave,onDelete}){
  const isEdit=!!tx;
  const [form,setForm]=useState({date:tx?.date||today(),description:tx?.description||"",amount:tx?Math.abs(tx.amount):"",type:tx?(tx.amount>=0?"ingreso":"gasto"):"gasto",source:tx?.source||"Efectivo",category:tx?.category||"",notes:tx?.notes||""});
  const [learn,setLearn]=useState(true);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const origCat=tx?.category;
  const availableCats=form.type==="ingreso"?structure.ingresos.flatMap(g=>g.items):structure.gastos.flatMap(f=>f.grupos.flatMap(g=>g.items));
  const handleSave=()=>{if(!form.description||!form.amount)return;const amt=parseFloat(form.amount);const changed=isEdit&&form.category!==origCat;onSave({...(tx||{}),...form,amount:form.type==="ingreso"?Math.abs(amt):-Math.abs(amt),aiClassified:false,ruleClassified:false},changed&&learn);};
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-hdr"><div className="modal-title">{isEdit?"Editar movimiento":"Nuevo movimiento"}</div><button className="modal-x" onClick={onClose}>✕</button></div>
        <div className="fg" style={{marginBottom:15}}>{[["gasto","Gasto"],["ingreso","Ingreso"]].map(([v,l])=><button key={v} className={`btn btn-sm ${form.type===v?"btn-p":"btn-o"}`} style={{flex:1}} onClick={()=>set("type",v)}>{l}</button>)}</div>
        <div className="form-grid">
          <div className="field full"><label>Descripción *</label><input value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Ej: Supermercado Mercadona"/></div>
          <div className="field"><label>Importe (€) *</label><input type="number" min="0" step="0.01" value={form.amount} onChange={e=>set("amount",e.target.value)} placeholder="0.00"/></div>
          <div className="field"><label>Fecha</label><input type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></div>
          <div className="field"><label>Cuenta</label><select value={form.source} onChange={e=>set("source",e.target.value)}>{SOURCES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <div className="field"><label>Categoría</label><select value={form.category} onChange={e=>set("category",e.target.value)}><option value="">Sin categoría</option>{availableCats.map(c=><option key={c.id} value={c.label}>{c.label}</option>)}</select></div>
          <div className="field full"><label>Notas</label><input value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Opcional..."/></div>
        </div>
        {isEdit&&form.category&&form.category!==origCat&&(
          <div style={{marginTop:10,padding:"9px 12px",background:"#eff6ff",borderRadius:8,border:"1px solid #bfdbfe",display:"flex",alignItems:"center",gap:8}}>
            <input type="checkbox" id="learn" checked={learn} onChange={e=>setLearn(e.target.checked)}/>
            <label htmlFor="learn" style={{fontSize:12,color:"#1d4ed8",cursor:"pointer"}}>Aprender: crear regla automática para clasificar movimientos similares como "{form.category}"</label>
          </div>
        )}
        <div className="divider"/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>{isEdit&&onDelete&&<button className="btn btn-d btn-sm" onClick={onDelete}>Eliminar</button>}</div>
          <div className="fg"><button className="btn btn-o" onClick={onClose}>Cancelar</button><button className="btn btn-p" onClick={handleSave} disabled={!form.description||!form.amount}>{isEdit?"Guardar":"Añadir"}</button></div>
        </div>
      </div>
    </div>
  );
}

function ApiKeyModal({onSave}){
  const [key,setKey]=useState(getApiKey());const [show,setShow]=useState(false);const isNew=!getApiKey();
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}}>
      <div style={{background:"var(--s1)",border:"1px solid var(--border)",borderRadius:15,padding:26,width:"100%",maxWidth:460,boxShadow:"0 20px 60px rgba(0,0,0,.15)"}}>
        <div style={{fontFamily:"var(--fd)",fontSize:20,marginBottom:8}}>{isNew?"Bienvenido a FinanzApp":"API Key de Anthropic"}</div>
        {isNew&&<p style={{fontSize:13,color:"var(--muted)",marginBottom:16,lineHeight:1.6}}>Para usar la clasificación automática con IA necesitas una API key de Anthropic.<br/>Consíguela en <strong style={{color:"var(--text)"}}>console.anthropic.com</strong> (5$ de crédito inicial dura meses).</p>}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:"var(--muted)",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Tu API Key</div>
          <div style={{display:"flex",gap:8}}>
            <input type={show?"text":"password"} value={key} onChange={e=>setKey(e.target.value)} placeholder="sk-ant-api03-..." style={{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--text)",borderRadius:8,padding:"9px 12px",fontFamily:"monospace",fontSize:12,outline:"none"}}/>
            <button className="btn btn-o btn-sm" onClick={()=>setShow(s=>!s)}>{show?"Ocultar":"Ver"}</button>
          </div>
        </div>
        <div style={{fontSize:11,color:"var(--hint)",marginBottom:18,lineHeight:1.5}}>🔒 La key se guarda solo en este navegador. Solo se envía a la API de Anthropic.</div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
          {!isNew&&<button className="btn btn-o" onClick={()=>onSave(getApiKey())}>Cancelar</button>}
          <button className="btn btn-p" onClick={()=>key.startsWith("sk-")&&onSave(key)} disabled={!key.startsWith("sk-")}>{isNew?"Empezar":"Guardar"}</button>
        </div>
        {isNew&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)"}}><button className="btn btn-o btn-sm" onClick={()=>onSave("")} style={{fontSize:11,color:"var(--hint)"}}>Continuar sin IA (clasificación manual)</button></div>}
      </div>
    </div>
  );
}
