import { useState, useEffect, useRef, useCallback } from "react";

const LS = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const getApiKey = () => localStorage.getItem("finanzapp_apikey") || "";
const saveApiKey = (k) => localStorage.setItem("finanzapp_apikey", k);

// ── Supabase sync ─────────────────────────────────────────────────────────────
const SB_URL = "https://jtegidrmrptgeuzdcuat.supabase.co";
const SB_KEY = "sb_publishable_9A_GiUz4UqTvQcooRzCd7w_7XzN3zuT";
const SB_HDR = { "Content-Type":"application/json", "apikey":SB_KEY, "Authorization":`Bearer ${SB_KEY}` };

async function sbLoad() {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/finanzapp_data?id=eq.main&select=data`, {headers:SB_HDR});
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0]?.data || null;
  } catch { return null; }
}

async function sbSave(data) {
  try {
    await fetch(`${SB_URL}/rest/v1/finanzapp_data?id=eq.main`, {
      method: "PATCH",
      headers: { ...SB_HDR, "Prefer":"return=minimal" },
      body: JSON.stringify({ data, updated_at: new Date().toISOString() }),
    });
  } catch {}
}

// Parse Spanish number format: "1.034,89" → 1034.89
function parseSpanishNumber(val) {
  if (val === null || val === undefined || val === "") return NaN;
  let s = String(val).trim();
  // Replace Unicode minus sign (U+2212 −) and non-breaking spaces with standard chars
  s = s.replace(/\u2212/g, "-").replace(/\u00a0/g, "").replace(/\u00b7/g, "");
  // Remove thousand separators (.) but only when followed by 3 digits
  s = s.replace(/\.(\d{3})/g, "$1").replace(",", ".");
  return parseFloat(s);
}

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
    { id: "san1", fuente: "Santander", label: "Gastos Santander 1", grupos: [
      { id: "san-g1", label: "Alimentación Supermercado", items: [{id:"san-i1",label:"Supermercados"},{id:"san-i2",label:"Pescadería"},{id:"san-i3",label:"Bofrost"}] },
      { id: "san-g2", label: "Seguros", items: [{id:"san-i4",label:"Seguro de Decesos"},{id:"san-i5",label:"Seguro Móviles"}] },
      { id: "san-g3", label: "Vehículos", items: [{id:"san-i6",label:"Combustible"},{id:"san-i7",label:"Revisión / Taller"},{id:"san-i8",label:"ITV"},{id:"san-i9",label:"Peaje Autopista"}] },
      { id: "san-g4", label: "Telefonía y TV", items: [{id:"san-i10",label:"Telefonía + TV"},{id:"san-i11",label:"Spotify"},{id:"san-i12",label:"Netflix"},{id:"san-i13",label:"iCloud"},{id:"san-i14",label:"Dropbox"}] },
      { id: "san-g5", label: "Suministros", items: [{id:"san-i15",label:"Gas Natural"},{id:"san-i16",label:"Zona Azul (e-Park)"}] },
      { id: "san-g6", label: "Hogar y Comunidad", items: [{id:"san-i17",label:"Alarma (Prosegur)"},{id:"san-i18",label:"Gimnasio"},{id:"san-i19",label:"Peluquería y Estética"},{id:"san-i20",label:"Comunidad Santander"}] },
      { id: "san-g7", label: "Otros Santander", items: [{id:"san-i21",label:"Antivirus"},{id:"san-i22",label:"Otros Gastos Santander"}] },
    ]},
    { id: "san2", fuente: "Santander Ahorro", label: "Gastos Santander 2", grupos: [
      { id: "san2-g1", label: "Gastos Santander 2", items: [{id:"san2-i1",label:"Otros Gastos Santander 2"}] },
    ]},
    { id: "bbva-tp", fuente: "BBVA Tarjeta Prepago", label: "Gastos BBVA Tarjeta Prepago", grupos: [
      { id: "bbva-tp-g1", label: "Gastos Tarjeta Prepago", items: [{id:"bbva-tp-i1",label:"Otros Gastos Tarjeta Prepago"}] },
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

const SOURCES = ["Efectivo", "Efectivo Ahorro", "Santander", "Santander Ahorro", "BBVA", "BBVA Tarjeta Prepago"];
const IMPORT_SOURCES = ["Efectivo", "Efectivo Ahorro", "Santander", "Santander Ahorro", "BBVA", "BBVA Tarjeta Prepago"]; // sources that accept file imports
const BANK_SOURCES = ["Efectivo", "Santander", "Santander Ahorro", "BBVA", "BBVA Tarjeta Prepago"]; // main bank accounts for dashboard saldo
const AHORRO_SOURCES = ["Efectivo Ahorro"]; // savings accounts
const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTHS_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const uid = () => Math.random().toString(36).slice(2, 9);
const fmtDate = (iso) => {
  if (!iso || iso.length < 10) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`; // DD/MM/YY
};
const today = () => new Date().toISOString().slice(0, 10);
const currentYM = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const fmt = (n) => {
  if (n===null||n===undefined||isNaN(n)) return "—";
  const abs = Math.abs(Number(n));
  const sign = n < 0 ? "-" : "";
  // Manual formatting: thousands dot, decimal comma, € symbol
  const parts = abs.toFixed(2).split(".");
  const int = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return sign + int + "," + parts[1] + " €";
};



// ── Clasificación Fijos vs Variables ─────────────────────────────────────────
const GASTOS_FIJOS = new Set([
  "Préstamo de la Casa","Seguro de la Casa","Seguro Médico Sanitas",
  "Seguro de Vida Hipoteca","Seguro del Vehículo","Seguro de Decesos","Seguro Móviles",
  "Alarma (Prosegur)","Telefonía + TV","Gas Natural","Electricidad","Agua",
  "Comunidad Santander","Plan de Pensiones","Impuestos Municipales","Sueldo Limpieza",
  "Spotify","Netflix","iCloud","Dropbox","Antivirus","Zona Azul (e-Park)",
  "Hip Hop / Danza","Clases de Inglés","Otras Clases","Clases / Academia",
]);

// Get all expense items classified as fixed or variable
function getConsolidatedGastos(structure) {
  const allItems = structure.gastos.flatMap(f => f.grupos.flatMap(g => g.items));
  const fijos = allItems.filter(i => GASTOS_FIJOS.has(i.label)).sort((a,b)=>a.label.localeCompare(b.label,"es"));
  const variables = allItems.filter(i => !GASTOS_FIJOS.has(i.label)).sort((a,b)=>a.label.localeCompare(b.label,"es"));
  return { fijos, variables };
}

// ── Export to Excel ───────────────────────────────────────────────────────────
async function exportToExcel(data, headers, filename) {
  const { utils, writeFile } = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  const ws = utils.aoa_to_sheet([headers, ...data]);
  // Auto column widths
  const colWidths = headers.map((h,i) => ({
    wch: Math.max(h.length, ...data.map(r => String(r[i]||"").length).slice(0,100)) + 2
  }));
  ws["!cols"] = colWidths;
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Datos");
  writeFile(wb, filename);
}

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
    if (rule.exact ? desc===kw : desc.includes(kw)) return { category: rule.category, source: rule.source==="Todas"?null:rule.source };
  }
  return null;
}

function parseExcelDate(val) {
  if (!val) return today();
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{5}$/.test(s)) { const d=new Date(Math.round((parseInt(s)-25569)*86400*1000)); return d.toISOString().slice(0,10); }
  return today();
}

// ── AI ────────────────────────────────────────────────────────────────────────
async function classifyWithAI(transactions, structure, rules) {
  const items = getAllItems(structure);
  const catList = items.map((c,i)=>`${i}:${c.label}(${c.fuente})`).join(", ");
  const rulesHint = rules.length > 0
    ? `\nReglas de clasificación definidas por el usuario (aplícalas con prioridad):\n${rules.map(r=>`- Si contiene "${r.keyword}" → "${r.category}" (${r.source==="Todas"?"todas las cuentas":r.source})`).join("\n")}`
    : "";
  const prompt = `Eres asistente de finanzas personales español. Clasifica cada transacción bancaria en la subcategoría más adecuada de esta lista:\n${catList}${rulesHint}\n\nResponde SOLO con JSON array sin markdown: [{"id":"tx_id","catIndex":número}]\n\nTransacciones:\n${transactions.map(t=>`id:${t.id}|"${t.description}"|${t.amount}€`).join("\n")}`;
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
    const amount=parseSpanishNumber(p[2]);
    if(isNaN(amount)||!p[1]) return null;
    return {date:p[0]||today(),description:p[1],amount};
  }).filter(Boolean);
}


// ── AI bulk classification suggestion ────────────────────────────────────────
async function suggestBulkGroups(unclassified, structure) {
  const items = getAllItems(structure);
  const catList = items.map((c,i)=>`${i}:${c.label}(${c.fuente})`).join(", ");
  // Group by normalized description first
  const groups = {};
  unclassified.forEach(tx => {
    const key = tx.description.trim().toUpperCase().slice(0,40);
    if(!groups[key]) groups[key] = {key, description: tx.description, txIds: [], sample: tx};
    groups[key].txIds.push(tx.id);
  });
  const groupList = Object.values(groups).slice(0, 30); // max 30 groups
  if(!groupList.length) return [];

  const prompt = `Eres asistente de finanzas personales español. Para cada grupo de transacciones bancarias, sugiere la categoría más adecuada de esta lista:\n${catList}\n\nResponde SOLO con JSON array sin markdown: [{"key":"descripcion","catIndex":número}]\n\nGrupos:\n${groupList.map(g=>`key:"${g.key}"|ejemplo:"${g.description}"|cantidad:${g.txIds.length}`).join("\n")}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers:{"Content-Type":"application/json","x-api-key":getApiKey(),"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})
  });
  const data = await resp.json();
  const text = (data.content||[]).map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();
  try {
    const suggestions = JSON.parse(text);
    const items2 = getAllItems(structure);
    return groupList.map(g => {
      const sug = suggestions.find(s=>s.key===g.key);
      return {
        ...g,
        suggestedCatIndex: sug?.catIndex??null,
        suggestedCat: sug?.catIndex!=null ? items2[sug.catIndex] : null,
      };
    });
  } catch { return groupList; }
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&family=Playfair+Display:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#f0f4f8;--s1:#ffffff;--s2:#e8edf2;--s3:#dde3ea;
  --border:#c8d0da;--border2:#b0bbc8;
  --text:#111827;--muted:#4b5563;--hint:#9ca3af;
  --green:#15803d;--green-bg:#dcfce7;
  --red:#b91c1c;--red-bg:#fee2e2;
  --blue:#1d4ed8;--blue-bg:#dbeafe;
  --amber:#92400e;--amber-bg:#fef3c7;
  --accent:#1d4ed8;--accent-light:#dbeafe;
  --san:#0369a1;--san-bg:#e0f2fe;--san2:#3730a3;--san2-bg:#e0e7ff;
  --bbva:#065f46;--bbva-bg:#d1fae5;
  --ef:#92400e;--ef-bg:#fef3c7;
  --r:10px;--ff:'Figtree',sans-serif;--fd:'Playfair Display',serif;
}
body{background:var(--bg);color:var(--text);font-family:var(--ff);font-size:14px;line-height:1.5}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px}
.app{min-height:100vh;display:flex;flex-direction:column}

.hdr{background:var(--accent);padding:12px 22px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;gap:10px;flex-wrap:wrap;box-shadow:0 2px 8px rgba(29,78,216,.3)}
.hdr-icon{width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;flex-shrink:0}
.hdr-name{font-family:var(--fd);font-size:18px;color:#fff}.hdr-sub{font-size:11px;color:rgba(255,255,255,.7)}
.hdr-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}

.src-tabs{display:flex;gap:2px;background:rgba(255,255,255,.15);padding:3px;border-radius:9px}
.src-tab{padding:5px 12px;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;color:rgba(255,255,255,.7);border:none;background:transparent;transition:all .15s;font-family:var(--ff)}
.src-tab.active{background:#fff;color:var(--accent)}
.src-tab.dark{color:var(--muted);background:var(--s2)}.src-tab.dark.active{background:var(--accent);color:#fff}

.nav{background:var(--s1);border-bottom:2px solid var(--border);padding:0 22px;display:flex;gap:0;overflow-x:auto;box-shadow:0 1px 3px rgba(0,0,0,.06);position:sticky;top:57px;z-index:49}
.nb{padding:11px 16px;font-size:13px;font-weight:500;color:var(--muted);background:transparent;border:none;border-bottom:3px solid transparent;margin-bottom:-2px;cursor:pointer;white-space:nowrap;transition:all .15s;font-family:var(--ff)}
.nb:hover{color:var(--text);background:var(--bg)}
.nb.active{color:var(--accent);border-bottom-color:var(--accent);background:var(--accent-light)}

.main{flex:1;padding:20px 22px;max-width:1300px;margin:0 auto;width:100%}
@media(max-width:640px){.main{padding:12px}}

.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
@media(max-width:800px){.kpi-row{grid-template-columns:repeat(2,1fr)}}@media(max-width:400px){.kpi-row{grid-template-columns:1fr}}
.kpi{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.06);border-left:4px solid var(--border2)}
.kpi.kpi-green{border-left-color:var(--green)}.kpi.kpi-red{border-left-color:var(--red)}.kpi.kpi-blue{border-left-color:var(--blue)}.kpi.kpi-amber{border-left-color:#d97706}
.kpi-label{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:5px;font-weight:600}
.kpi-val{font-family:var(--fd);font-size:22px;font-weight:500}
.kpi-val.g{color:var(--green)}.kpi-val.r{color:var(--red)}.kpi-val.b{color:var(--blue)}
.kpi-sub{font-size:11px;color:var(--hint);margin-top:3px}

.card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.card-title{font-family:var(--fd);font-size:15px;margin-bottom:13px;color:var(--text)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:700px){.grid2{grid-template-columns:1fr}}

.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid transparent;font-family:var(--ff);transition:all .15s}
.btn-p{background:var(--accent);color:#fff;border-color:var(--accent)}.btn-p:hover{background:#1e40af}
.btn-o{background:var(--s1);color:var(--text);border-color:var(--border)}.btn-o:hover{background:var(--s2)}
.btn-d{background:var(--s1);color:var(--red);border-color:var(--red)}.btn-d:hover{background:var(--red-bg)}
.btn-g{background:var(--s1);color:var(--green);border-color:var(--green)}.btn-g:hover{background:var(--green-bg)}
.btn-sm{padding:5px 10px;font-size:12px}.btn:disabled{opacity:.4;cursor:not-allowed}

.sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px}
.sh-title{font-family:var(--fd);font-size:16px;color:var(--text)}
.fg{display:flex;align-items:center;gap:7px;flex-wrap:wrap}

/* Transaction table */
.tx-table{width:100%;border-collapse:collapse}
.tx-table th{padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;background:var(--s2);border-bottom:2px solid var(--border);white-space:nowrap}
.tx-table th.right{text-align:right}
.tx-table td{padding:9px 12px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle}
.tx-table tr:hover td{background:var(--accent-light)}
.tx-desc-cell{max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.tx-amt-cell{text-align:right;font-family:var(--fd);font-size:14px;white-space:nowrap}
.tx-amt-cell.g{color:var(--green)}.tx-amt-cell.r{color:var(--red)}
.cat-select{background:var(--accent-light);border:1px solid var(--blue);color:var(--blue);border-radius:20px;padding:2px 8px;font-size:11px;font-weight:500;cursor:pointer;outline:none;font-family:var(--ff);max-width:180px}
.cat-select:hover{background:var(--accent);color:#fff}
.no-cat{background:var(--s2);border:1px dashed var(--border2);color:var(--muted);border-radius:20px;padding:2px 8px;font-size:11px;cursor:pointer;outline:none;font-family:var(--ff)}

.src-chip{display:inline-block;font-size:10px;padding:2px 7px;border-radius:20px;font-weight:600;white-space:nowrap}
.src-ef{background:var(--ef-bg);color:var(--ef)}.src-ef-ah{background:#f3e8ff;color:#7e22ce}.src-san{background:var(--san-bg);color:var(--san)}.src-san2{background:#e0e7ff;color:#3730a3}.src-bbva{background:var(--bbva-bg);color:var(--bbva)}.src-bbva-tp{background:#ccfbf1;color:#0f766e}.src-ahorro{background:#fce7f3;color:#9d174d}
.ai-chip{display:inline-block;font-size:10px;padding:2px 6px;border-radius:20px;background:var(--blue-bg);color:var(--blue);font-weight:500}
.rule-chip{display:inline-block;font-size:10px;padding:2px 6px;border-radius:20px;background:var(--green-bg);color:var(--green);font-weight:500}
.batch-chip{display:inline-block;font-size:10px;padding:2px 7px;border-radius:20px;background:var(--amber-bg);color:var(--amber);font-weight:500}

.field{display:flex;flex-direction:column;gap:5px}
.field label{font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.field input,.field select{background:var(--s2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 11px;font-family:var(--ff);font-size:13px;outline:none;transition:border-color .15s}
.field input:focus,.field select:focus{border-color:var(--accent);background:#fff}.field select option{background:#fff}.full{grid-column:1/-1}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}@media(max-width:480px){.form-grid{grid-template-columns:1fr}}

.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:100;padding:14px}
.modal{background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:22px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)}
.modal-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
.modal-title{font-family:var(--fd);font-size:18px}
.modal-x{background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;line-height:1;padding:2px;border-radius:4px}.modal-x:hover{background:var(--s2);color:var(--text)}
.divider{height:1px;background:var(--border);margin:13px 0}

.drop-zone{border:2px dashed var(--border2);border-radius:var(--r);padding:28px;text-align:center;cursor:pointer;transition:all .2s;background:var(--s2)}
.drop-zone:hover,.drop-zone.drag{border-color:var(--accent);background:var(--accent-light)}

.bbar{height:7px;background:var(--s2);border-radius:4px;overflow:hidden;border:1px solid var(--border)}
.bbar-fill{height:100%;border-radius:4px;transition:width .4s ease}

.cmp-wrap{overflow-x:auto}
.cmp-table{width:100%;border-collapse:collapse;font-size:12px}
.cmp-table th{padding:8px 12px;text-align:right;font-weight:600;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid var(--border);white-space:nowrap;background:var(--s2)}
.cmp-table th:first-child{text-align:left;width:35%}
.cmp-table td{padding:7px 12px;text-align:right;border-bottom:1px solid var(--border);color:var(--text)}
.cmp-table td:first-child{text-align:left}
.cmp-table tr.frow td{background:#dbeafe;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:9px 12px;color:#1e3a8a}
.cmp-table tr.grow td{background:var(--s2);font-weight:600;font-size:11px;color:var(--muted);padding:6px 12px}
.cmp-table tr.subtotal td{background:#eff6ff;font-weight:700;border-top:2px solid var(--border2)}
.cmp-table tr:hover:not(.frow):not(.grow):not(.subtotal) td{background:#f0f7ff}
.over{color:var(--red)!important;font-weight:600}.under{color:var(--green)!important;font-weight:600}.neutral{color:var(--hint)!important}

.empty{text-align:center;padding:40px 14px;color:var(--muted)}
.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.toast{position:fixed;bottom:20px;right:20px;z-index:300;background:#111827;color:#f9fafb;border-radius:10px;padding:11px 16px;font-size:13px;display:flex;align-items:center;gap:8px;animation:up .2s ease;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:360px}
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.sbar{background:var(--s1);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 12px;font-size:13px;font-family:var(--ff);outline:none;flex:1;min-width:150px}
.sbar:focus{border-color:var(--accent)}
.msel{background:var(--s1);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 11px;font-size:13px;font-family:var(--ff);outline:none;cursor:pointer}
.msel option{background:#fff}
.msel-hdr{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:8px;padding:6px 11px;font-size:13px;font-family:var(--ff);outline:none;cursor:pointer}
.msel-hdr option{background:var(--accent);color:#fff}

.acc-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--s2);border-radius:8px;cursor:pointer;border:1px solid var(--border);user-select:none;margin-bottom:4px;transition:background .12s}
.acc-hdr:hover{background:var(--s3)}
.acc-body{background:var(--s1);border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;padding:6px 0;margin-bottom:10px}
.editable-row{display:flex;align-items:center;gap:6px;padding:6px 10px;border-top:1px solid var(--border)}
.editable-row:hover{background:var(--s2)}
.inline-input{background:#fff;border:1px solid var(--accent);color:var(--text);font-family:var(--ff);font-size:13px;padding:2px 6px;outline:none;flex:1;min-width:80px;border-radius:5px}

.rule-row{display:flex;align-items:center;gap:8px;padding:9px 13px;border-radius:8px;border:1px solid var(--border);margin-bottom:6px;background:var(--s1)}
.rule-row:hover{background:var(--s2)}
.period-tabs{display:flex;gap:2px;background:var(--s2);padding:3px;border-radius:9px;border:1px solid var(--border)}
.period-tab{padding:5px 13px;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;color:var(--muted);border:none;background:transparent;font-family:var(--ff);transition:all .15s}
.period-tab.active{background:var(--accent);color:#fff}
.badge{display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 8px;border-radius:20px;font-weight:600}
.badge-blue{background:var(--blue-bg);color:var(--blue)}.badge-green{background:var(--green-bg);color:var(--green)}.badge-gray{background:var(--s2);color:var(--muted);border:1px solid var(--border)}
.progress-bar{height:10px;border-radius:5px;overflow:hidden;background:var(--s2);border:1px solid var(--border)}
.progress-fill{height:100%;border-radius:5px;transition:width .4s}
.classifying-banner{background:var(--blue-bg);border:1px solid #93c5fd;border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:13px;color:var(--blue)}
`;

// ── APP ───────────────────────────────────────────────────────────────────────

// ── Shared period selector component ─────────────────────────────────────────
function MonthOpts() {
  return Array.from({length:28},(_,i)=>{
    const d=new Date(); d.setMonth(d.getMonth()-i);
    const v=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    return <option key={v} value={v}>{MONTHS_FULL[d.getMonth()]} {d.getFullYear()}</option>;
  });
}

function PeriodSelector({selMonth,setSelMonth,periodMode,setPeriodMode,rangeFrom,setRangeFrom,rangeTo,setRangeTo,dark=false}) {
  const tabCls = dark ? "src-tab" : "period-tab";
  const tabsCls = dark ? "src-tabs" : "period-tabs";
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
      <div className={tabsCls} style={dark?{}:{}}>
        {[["month","Mes"],["year","Año"],["range","Período"]].map(([v,l])=>(
          <button key={v} className={`${tabCls}${periodMode===v?" active":""}`} onClick={()=>setPeriodMode(v)}>{l}</button>
        ))}
      </div>
      {periodMode==="month" && (
        <select className={dark?"msel-hdr":"msel"} value={selMonth} onChange={e=>setSelMonth(e.target.value)}>
          <MonthOpts/>
        </select>
      )}
      {periodMode==="year" && (
        <select className={dark?"msel-hdr":"msel"} value={selMonth.slice(0,4)+"-01"} onChange={e=>setSelMonth(e.target.value)}>
          {Array.from({length:5},(_,i)=>{const y=new Date().getFullYear()-i;return<option key={y} value={`${y}-01`}>{y}</option>;})}
        </select>
      )}
      {periodMode==="range" && <>
        <span style={{fontSize:12,color:dark?"rgba(255,255,255,.7)":"var(--muted)"}}>Desde</span>
        <select className={dark?"msel-hdr":"msel"} value={rangeFrom} onChange={e=>setRangeFrom(e.target.value)}><MonthOpts/></select>
        <span style={{fontSize:12,color:dark?"rgba(255,255,255,.7)":"var(--muted)"}}>hasta</span>
        <select className={dark?"msel-hdr":"msel"} value={rangeTo} onChange={e=>setRangeTo(e.target.value)}><MonthOpts/></select>
      </>}
    </div>
  );
}

export default function App() {
  const [tab,setTab]=useState("dashboard");
  const [source,setSource]=useState("Todos");
  const [transactions,setTransactions]=useState(()=>LS.get("fin_txs",[]));
  const [budgets,setBudgets]=useState(()=>LS.get("fin_budgets",{}));
  const [structure,setStructure]=useState(()=>LS.get("fin_structure",DEFAULT_STRUCTURE));
  const [rules,setRules]=useState(()=>LS.get("fin_rules",[]));
  const [batches,setBatches]=useState(()=>LS.get("fin_batches",[]));
  const [saldosIniciales,setSaldosIniciales]=useState(()=>LS.get("fin_saldos",{}));
  const [ahorro,setAhorro]=useState(()=>LS.get("fin_ahorro",{pensionMar:0,pensionSalva:0,fondo:[]}));
  const [syncStatus,setSyncStatus]=useState("idle"); // idle | saving | saved | error
  const sbSaveTimer=useRef(null);
  const isRemoteLoad=useRef(false);
  const [selMonth,setSelMonth]=useState(currentYM);
  // Shared period filter (used by Dashboard, Movimientos, Presupuestos, Ppto vs Real)
  const [periodMode,setPeriodMode]=useState("range");
  const [rangeFrom,setRangeFrom]=useState("2025-01");
  const [rangeTo,setRangeTo]=useState(currentYM);
  const [modal,setModal]=useState(null);
  const [splitTx,setSplitTx]=useState(null);
  const [editTx,setEditTx]=useState(null);
  const [toast,setToast]=useState(null);
  const [classifying,setClassifying]=useState(false);
  const [classifyProgress,setClassifyProgress]=useState(0);
  const [showApiModal,setShowApiModal]=useState(!getApiKey());

  // Load from Supabase on mount — only overrides local if remote has actual data
  useEffect(()=>{
    sbLoad().then(remote=>{
      // Only load from remote if it has transactions (not empty/fresh DB)
      if(!remote || !remote.transactions || remote.transactions.length===0) return;
      isRemoteLoad.current=true;
      if(remote.transactions) setTransactions(remote.transactions);
      if(remote.budgets) setBudgets(remote.budgets);
      if(remote.structure) setStructure(remote.structure);
      if(remote.rules) setRules(remote.rules);
      if(remote.batches) setBatches(remote.batches);
      if(remote.saldosIniciales) setSaldosIniciales(remote.saldosIniciales);
      if(remote.ahorro) setAhorro(remote.ahorro);
      if(remote.apiKey) saveApiKey(remote.apiKey);
      setSyncStatus("saved");
    });
  },[]);

  // Debounced save to Supabase + immediate save to localStorage
  const triggerSave=useCallback((key,val,all)=>{
    LS.set(key,val);
    if(isRemoteLoad.current===true) isRemoteLoad.current=false;
    if(sbSaveTimer.current) clearTimeout(sbSaveTimer.current);
    setSyncStatus("saving");
    sbSaveTimer.current=setTimeout(()=>{
      sbSave(all()).then(()=>setSyncStatus("saved")).catch(()=>setSyncStatus("error"));
    },2000);
  },[]);

  const getAllData=useCallback(()=>({
    transactions,budgets,structure,rules,batches,saldosIniciales,ahorro,
    apiKey: getApiKey()
  }),[transactions,budgets,structure,rules,batches,saldosIniciales,ahorro]);

  useEffect(()=>{if(!isRemoteLoad.current)triggerSave("fin_txs",transactions,getAllData);},[transactions]);
  // Update rangeTo to last month with transactions
  useEffect(()=>{
    if(transactions.length===0) return;
    const months=transactions.map(t=>t.date?.slice(0,7)).filter(Boolean).sort();
    const lastMonth=months[months.length-1];
    if(lastMonth) setRangeTo(lastMonth);
  },[transactions]);
  useEffect(()=>{if(!isRemoteLoad.current)triggerSave("fin_budgets",budgets,getAllData);},[budgets]);
  useEffect(()=>{if(!isRemoteLoad.current)triggerSave("fin_structure",structure,getAllData);},[structure]);
  useEffect(()=>{if(!isRemoteLoad.current)triggerSave("fin_rules",rules,getAllData);},[rules]);
  useEffect(()=>{if(!isRemoteLoad.current)triggerSave("fin_batches",batches,getAllData);},[batches]);
  useEffect(()=>{if(!isRemoteLoad.current)triggerSave("fin_saldos",saldosIniciales,getAllData);},[saldosIniciales]);
  useEffect(()=>{if(!isRemoteLoad.current)triggerSave("fin_ahorro",ahorro,getAllData);},[ahorro]);

  const showToast=(msg,icon="✓")=>{setToast({msg,icon});setTimeout(()=>setToast(null),4000);};

  const applyRulesToTx=useCallback((tx)=>{
    const match=applyRules(tx.description,rules);
    if(match) return {...tx,category:match.category,source:tx.source||(match.source||tx.source),ruleClassified:true,aiClassified:false};
    return tx;
  },[rules]);

  // Compute active months based on period mode
  const getActiveMonths = () => {
    const [y,m] = selMonth.split("-");
    if(periodMode==="month") return [selMonth];
    if(periodMode==="year") return Array.from({length:12},(_,i)=>`${y}-${String(i+1).padStart(2,"0")}`);
    const months=[];const[fy,fm]=rangeFrom.split("-").map(Number);const[ty,tm]=rangeTo.split("-").map(Number);
    let cy=fy,cm=fm;
    while((cy<ty||(cy===ty&&cm<=tm))&&months.length<36){months.push(`${cy}-${String(cm).padStart(2,"0")}`);cm++;if(cm>12){cm=1;cy++;}}
    return months;
  };
  const activeMonths = getActiveMonths();
  const periodLabel = (() => { const [y,m]=selMonth.split("-"); return periodMode==="month"?`${MONTHS_FULL[parseInt(m)-1]} ${y}`:periodMode==="year"?`Año ${y}`:`${rangeFrom} → ${rangeTo}`; })();
  const filteredTxs=transactions.filter(t=>activeMonths.includes(t.date?.slice(0,7))&&(source==="Todos"||t.source===source));
  const income=filteredTxs.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const expense=filteredTxs.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);

  // Auto-classify a batch of transactions with AI
  const autoClassifyBatch=async(txIds,allTxs,currentRules,currentStructure)=>{
    if(!getApiKey()) return allTxs;
    const toClassify=allTxs.filter(t=>txIds.includes(t.id)&&!t.category);
    if(!toClassify.length) return allTxs;
    setClassifying(true);setClassifyProgress(0);
    try{
      // Process in chunks of 30
      const chunks=[];for(let i=0;i<toClassify.length;i+=30)chunks.push(toClassify.slice(i,i+30));
      let classified={};
      for(let i=0;i<chunks.length;i++){
        const res=await classifyWithAI(chunks[i],currentStructure,currentRules);
        const allItems=getAllItems(currentStructure);
        res.forEach(r=>{if(allItems[r.catIndex])classified[r.id]={category:allItems[r.catIndex].label,fuente:allItems[r.catIndex].fuente};});
        setClassifyProgress(Math.round((i+1)/chunks.length*100));
      }
      return allTxs.map(t=>{
        if(classified[t.id]) return{...t,category:classified[t.id].category,source:t.source||classified[t.id].fuente,aiClassified:true,ruleClassified:false};
        return t;
      });
    }catch(e){showToast("Error en clasificación IA: "+e.message,"✕");return allTxs;}
    finally{setClassifying(false);setClassifyProgress(0);}
  };

  const importTxs=async(txs,batchLabel)=>{
    // Apply rules first
    const withIds=txs.map(t=>({...t,id:uid()}));
    const withRules=withIds.map(t=>applyRulesToTx(t));
    const batchId=uid();
    const batchedTxs=withRules.map(t=>({...t,batchId}));

    // Add batch record
    const batchRecord={id:batchId,label:batchLabel,date:today(),count:txs.length};
    setBatches(p=>[batchRecord,...p]);

    // Save transactions
    const allTxs=[...batchedTxs,...transactions];
    setTransactions(allTxs);

    const ruleCount=batchedTxs.filter(t=>t.ruleClassified).length;
    showToast(`${txs.length} importadas · ${ruleCount} clasificadas por reglas · Clasificando con IA...`,"⚡");
    setTab("transactions");

    // Auto-classify with AI the ones without category
    if(getApiKey()){
      const txIds=batchedTxs.map(t=>t.id);
      const classified=await autoClassifyBatch(txIds,allTxs,rules,structure);
      setTransactions(classified);
      const aiCount=classified.filter(t=>txIds.includes(t.id)&&t.aiClassified).length;
      showToast(`Clasificación completada: ${aiCount} con IA, ${ruleCount} por reglas`,"✦");
    }
  };

  const deleteBatch=(batchId)=>{
    setTransactions(p=>p.filter(t=>t.batchId!==batchId));
    setBatches(p=>p.filter(b=>b.id!==batchId));
    showToast("Importación eliminada","🗑");
  };

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
            showToast(`Regla aprendida: "${keyword}" → ${tx.category}`,"⚡");
            return;
          }
        }
      }catch{}
    }
    showToast("Guardado");setModal(null);setEditTx(null);
  };

  const updateTxCategory=async(txId,newCategory,learnFromChange)=>{
    const tx=transactions.find(t=>t.id===txId);
    if(!tx) return;
    const updated={...tx,category:newCategory,aiClassified:false,ruleClassified:false};
    setTransactions(p=>p.map(t=>t.id===txId?updated:t));
    if(learnFromChange&&newCategory&&tx.description){
      try{
        const keyword=await extractKeyword(tx.description);
        if(keyword&&keyword.length>2){
          const exists=rules.some(r=>r.keyword.toLowerCase()===keyword.toLowerCase());
          if(!exists){
            setRules(prev=>[{id:uid(),keyword,category:newCategory,source:tx.source||"Efectivo",exact:false,auto:true},...prev]);
            showToast(`Regla aprendida: "${keyword}" → ${newCategory}`,"⚡");
          }
        }
      }catch{}
    }
  };

  const deleteTx=(id)=>{setTransactions(p=>p.filter(t=>t.id!==id));showToast("Eliminado","🗑");setModal(null);setEditTx(null);};



  return(
    <>
      <style>{CSS}</style>
      {showApiModal&&<ApiKeyModal onSave={(k)=>{saveApiKey(k);setShowApiModal(false);sbSave({...getAllData(),apiKey:k});}}/>}
      <div className="app">
        <header className="hdr">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div className="hdr-icon">€</div>
            <div>
              <div className="hdr-name">FinanzApp</div>
              <div className="hdr-sub" style={{display:"flex",alignItems:"center",gap:5}}>
                Gastos domésticos
                <span style={{fontSize:10,opacity:.8}}>
                  {syncStatus==="saving"&&"⟳ Guardando..."}
                  {syncStatus==="saved"&&"✓ Sync"}
                  {syncStatus==="error"&&"✕ Error sync"}
                </span>
              </div>
            </div>
          </div>
          <div className="hdr-right">
            <div className="src-tabs">
              {["Todos",...SOURCES].map(s=><button key={s} className={`src-tab${source===s?" active":""}`} onClick={()=>setSource(s)}>{s}</button>)}
            </div>
            <PeriodSelector dark selMonth={selMonth} setSelMonth={setSelMonth} periodMode={periodMode} setPeriodMode={setPeriodMode} rangeFrom={rangeFrom} setRangeFrom={setRangeFrom} rangeTo={rangeTo} setRangeTo={setRangeTo}/>
            <button className="btn btn-sm" style={{background:"rgba(255,255,255,.2)",color:"#fff",border:"1px solid rgba(255,255,255,.3)"}} onClick={()=>setShowApiModal(true)}>⚙ API Key</button>
          </div>
        </header>
        <nav className="nav">
          {[["dashboard","📊 Resumen"],["transactions","💳 Movimientos"],["bulk","🔖 Clasificar en bloque"],["comparison","📋 Ppto. vs Real"],["budgets","🎯 Presupuestos"],["ahorro","💰 Ahorro"],["rules","⚡ Criterios IA"],["structure","🗂 Estructura"],["import","📤 Importar"]].map(([id,l])=>(
            <button key={id} className={`nb${tab===id?" active":""}`} onClick={()=>setTab(id)}>{l}</button>
          ))}
        </nav>
        <main className="main">
          {classifying&&<div className="classifying-banner"><span className="spin">⟳</span><span>Clasificando con IA... {classifyProgress}%</span><div style={{flex:1}}><div className="progress-bar"><div className="progress-fill" style={{width:`${classifyProgress}%`,background:"var(--blue)"}}/></div></div></div>}
          {tab==="dashboard"&&<Dashboard filteredTxs={filteredTxs} income={income} expense={expense} source={source} selMonth={selMonth} periodLabel={periodLabel} transactions={transactions} saldosIniciales={saldosIniciales} ahorro={ahorro} activeMonths={activeMonths} structure={structure} setTab={setTab}/>}
          {tab==="transactions"&&<Transactions filteredTxs={filteredTxs} source={source} periodLabel={periodLabel} structure={structure} onAdd={()=>setModal("add")} onEdit={tx=>{setEditTx(tx);setModal("tx");}} onSplit={tx=>{setSplitTx(tx);setModal("split");}} onUpdateCategory={updateTxCategory}/>}
          {tab==="comparison"&&<Comparison transactions={transactions} budgets={budgets} selMonth={selMonth} periodMode={periodMode} activeMonths={activeMonths} periodLabel={periodLabel} source={source} structure={structure}/>}
          {tab==="budgets"&&<Budgets budgets={budgets} setBudgets={setBudgets} selMonth={selMonth} periodMode={periodMode} activeMonths={activeMonths} periodLabel={periodLabel} monthTxs={transactions.filter(t=>activeMonths.includes(t.date?.slice(0,7)))} showToast={showToast} structure={structure}/>}
          {tab==="ahorro"&&<Ahorro ahorro={ahorro} setAhorro={setAhorro} saldosIniciales={saldosIniciales} setSaldosIniciales={setSaldosIniciales} transactions={transactions} activeMonths={activeMonths} showToast={showToast}/>}
          {tab==="bulk"&&<BulkClassify transactions={transactions} setTransactions={setTransactions} structure={structure} rules={rules} setRules={setRules} showToast={showToast}/>}
          {tab==="rules"&&<Rules rules={rules} setRules={setRules} structure={structure} showToast={showToast}/>}
          {tab==="structure"&&<StructureEditor structure={structure} setStructure={setStructure} showToast={showToast}/>}
          {tab==="import"&&<Import onImport={importTxs} showToast={showToast} batches={batches} onDeleteBatch={deleteBatch} transactions={transactions} onEditTx={tx=>{setEditTx(tx);setModal("tx");}} onSplitTx={tx=>{setSplitTx(tx);setModal("split");}} structure={structure}/>}
        </main>
      </div>
      {modal==="add"&&<TxModal structure={structure} onClose={()=>setModal(null)} onSave={addTx}/>}
      {modal==="split"&&splitTx&&<SplitModal tx={splitTx} structure={structure} onClose={()=>{setModal(null);setSplitTx(null);}} onSave={(newTxs)=>{setTransactions(p=>[...newTxs.map(t=>({...t,id:uid()})),...p.filter(t=>t.id!==splitTx.id)]);showToast(`Movimiento dividido en ${newTxs.length} partidas`);setModal(null);setSplitTx(null);}}/>}
      {modal==="tx"&&editTx&&<TxModal tx={editTx} structure={structure} onClose={()=>{setModal(null);setEditTx(null);}} onSave={(tx,learn)=>updateTx(tx,learn)} onDelete={()=>deleteTx(editTx.id)}/>}
      {toast&&<div className="toast"><span>{toast.icon}</span>{toast.msg}</div>}
    </>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({filteredTxs,income,expense,source,selMonth,periodLabel,transactions,saldosIniciales,ahorro,activeMonths,structure,setTab}){
  const balance=income-expense;
  const [y,m]=selMonth.split("-");

  const srcBreakdown=IMPORT_SOURCES.map(s=>({name:s,exp:transactions.filter(t=>activeMonths.includes(t.date?.slice(0,7))&&t.source===s&&t.amount<0).reduce((a,t)=>a+Math.abs(t.amount),0),inc:transactions.filter(t=>activeMonths.includes(t.date?.slice(0,7))&&t.source===s&&t.amount>0).reduce((a,t)=>a+t.amount,0)}));
  const maxSrc=Math.max(1,...srcBreakdown.map(s=>s.exp));
  const EXCLUDED_CATS=new Set(["Traspasos","Traspaso","No categorizable"]);
  const byCat={};filteredTxs.filter(t=>t.amount<0&&t.category&&!EXCLUDED_CATS.has(t.category)).forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+Math.abs(t.amount);});
  const topCats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const totalCatExp=topCats.reduce((s,[,v])=>s+v,0);
  const srcColor=(s)=>({"Efectivo":"var(--ef)","Efectivo Ahorro":"#7e22ce","Santander":"var(--san)","Santander Ahorro":"var(--san2)","BBVA":"var(--bbva)","BBVA Tarjeta Prepago":"#0f766e","Ahorro":"#9d174d"})[s]||"var(--muted)";
  const srcBg=(s)=>({"Efectivo":"var(--ef-bg)","Efectivo Ahorro":"#f3e8ff","Santander":"var(--san-bg)","Santander Ahorro":"var(--san2-bg)","BBVA":"var(--bbva-bg)","BBVA Tarjeta Prepago":"#ccfbf1","Ahorro":"#fce7f3"})[s]||"var(--s2)";
  return(
    <div>
      <div style={{marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div style={{fontFamily:"var(--fd)",fontSize:16,color:"var(--text)"}}>{periodLabel}</div>
        <div style={{fontSize:12,color:"var(--muted)"}}>{filteredTxs.length} movimientos en el período</div>
      </div>
      <div className="kpi-row">
        <div className="kpi kpi-green"><div className="kpi-label">Ingresos</div><div className="kpi-val g">{fmt(income)}</div><div className="kpi-sub">{filteredTxs.filter(t=>t.amount>0).length} movimientos</div></div>
        <div className="kpi kpi-red"><div className="kpi-label">Gastos</div><div className="kpi-val r">{fmt(expense)}</div><div className="kpi-sub">{filteredTxs.filter(t=>t.amount<0).length} movimientos</div></div>
        <div className="kpi kpi-blue"><div className="kpi-label">Balance</div><div className={`kpi-val ${balance>=0?"g":"r"}`}>{fmt(balance)}</div><div className="kpi-sub">{balance>=0?"Mes positivo ✓":"Mes en déficit"}</div></div>
        <div className="kpi kpi-amber"><div className="kpi-label">Sin clasificar</div><div className="kpi-val b">{filteredTxs.filter(t=>!t.category).length}</div><div className="kpi-sub">de {filteredTxs.length} movimientos</div></div>
      </div>
      <div className="grid2" style={{marginBottom:14}}>
        <div className="card">
          <div className="card-title">Resumen del período — {periodLabel}</div>
          {(()=>{
            const {fijos,variables}=getConsolidatedGastos(structure);
            const allIngresos=structure.ingresos.flatMap(g=>g.items);
            const EXCL=new Set(["Traspasos","Traspaso","No categorizable"]);
            // Income category labels
            const ingCatLabels=new Set(allIngresos.map(i=>i.label));
            // Gastos: negative amounts, or positive amounts in expense categories (reembolsos = menor gasto)
            // Ingresos: only amounts classified in income categories
            const calcCat=(items,isIncome=false)=>items.map(item=>{
              let amt;
              if(isIncome){
                // Income: sum all transactions (positive) in this income category
                amt=filteredTxs.filter(t=>t.category===item.label&&t.amount>0).reduce((s,t)=>s+t.amount,0);
              } else {
                // Expense: net = expenses minus reimbursements in same category
                const exp=filteredTxs.filter(t=>t.category===item.label&&t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
                const reimb=filteredTxs.filter(t=>t.category===item.label&&t.amount>0&&!ingCatLabels.has(t.category)).reduce((s,t)=>s+t.amount,0);
                amt=Math.max(0,exp-reimb);
              }
              return{label:item.label,amt};
            }).filter(i=>i.amt>0).sort((a,b)=>b.amt-a.amt);
            const fijosTotals=calcCat(fijos);
            const varTotals=calcCat(variables);
            const ingTotals=calcCat(allIngresos,true);
            // Totals: fijos and variables net of reimbursements, ingresos only from income categories
            const totalFijos=fijosTotals.reduce((s,i)=>s+i.amt,0);
            const totalVar=varTotals.reduce((s,i)=>s+i.amt,0);
            const totalIng=ingTotals.reduce((s,i)=>s+i.amt,0);
            const saldo=totalIng-totalFijos-totalVar;
            const Section=({title,items,total,color,isIncome=false,maxItems=999})=>items.length===0?null:(
              <div style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,paddingBottom:4,borderBottom:"1px solid var(--border)"}}>
                  <span style={{fontSize:12,fontWeight:700,color,textTransform:"uppercase",letterSpacing:".06em"}}>{title}</span>
                  <span style={{fontSize:13,fontWeight:700,color}}>{fmt(total)}</span>
                </div>
                {items.slice(0,maxItems).map(i=>(
                  <div key={i.label} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3,paddingLeft:8}}>
                    <span style={{color:"var(--muted)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"65%"}}>{i.label}</span>
                    <span style={{fontWeight:500,color:isIncome?"var(--green)":"var(--text)"}}>{fmt(i.amt)}</span>
                  </div>
                ))}
                {items.length>maxItems&&<div style={{fontSize:11,color:"var(--hint)",paddingLeft:8}}>…y {items.length-maxItems} más</div>}
              </div>
            );
            // Sin clasificar: movimientos sin categoría o con categoría vacía
            const sinClasif=filteredTxs.filter(t=>!t.category||t.category==="");
            const netSinClasif=sinClasif.reduce((s,t)=>s+t.amount,0);
            // Traspasos netos en el período
            const TRASPASO_CATS=new Set(["Traspasos","Traspaso"]);
            const netTraspasos=filteredTxs.filter(t=>TRASPASO_CATS.has(t.category)).reduce((s,t)=>s+t.amount,0);
            // Validación: saldo + traspasos debería = totalDisponible - totalSaldosIni
            // totalDisponible se calcula sobre TODOS los movimientos históricos (no solo filteredTxs)
            const totalSaldosIni=BANK_SOURCES.reduce((a,s)=>a+(saldosIniciales[s]||0),0);
            const totalDisponibleCalc=BANK_SOURCES.reduce((a,s)=>{
              const ini=saldosIniciales[s]||0;
              const inc=transactions.filter(t=>t.source===s&&t.amount>0).reduce((x,t)=>x+t.amount,0);
              const exp=transactions.filter(t=>t.source===s&&t.amount<0).reduce((x,t)=>x+Math.abs(t.amount),0);
              return a+ini+inc-exp;
            },0);
            const saldoEsperado=totalDisponibleCalc-totalSaldosIni;
            const diferencia=saldoEsperado-(saldo+netTraspasos);
            return(<>
              <Section title="Ingresos" items={ingTotals} total={totalIng} color="var(--green)" isIncome/>
              <Section title="Gastos fijos" items={fijosTotals} total={totalFijos} color="var(--blue)"/>
              <Section title="Gastos variables" items={varTotals} total={totalVar} color="var(--red)"/>
              {netTraspasos!==0&&(
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4,paddingLeft:8}}>
                  <span style={{color:"var(--muted)"}}>Traspasos (neto)</span>
                  <span style={{fontWeight:500}}>{netTraspasos>=0?"+":""}{fmt(netTraspasos)}</span>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:"2px solid var(--border)",marginTop:4}}>
                <span style={{fontWeight:700,fontSize:13}}>Saldo del período</span>
                <span style={{fontFamily:"var(--fd)",fontSize:17,fontWeight:700,color:saldo>=0?"var(--green)":"var(--red)"}}>{fmt(saldo)}</span>
              </div>
              {totalSaldosIni!==0&&(
                <div style={{fontSize:11,marginTop:6,padding:"6px 8px",background:"var(--s2)",borderRadius:6,border:"1px solid var(--border)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{color:"var(--muted)"}}>Saldo esperado (disp. − ini.)</span>
                    <span style={{fontWeight:600}}>{fmt(saldoEsperado)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:Math.abs(diferencia)<0.05?"var(--green)":"var(--amber)"}}>
                      {Math.abs(diferencia)<0.05?"✓ Cuadra":"⚠ Diferencia"}
                      {sinClasif.length>0?` (${sinClasif.length} sin clasificar)`:""}
                    </span>
                    <span style={{fontWeight:600,color:Math.abs(diferencia)<0.05?"var(--green)":"var(--amber)"}}>
                      {Math.abs(diferencia)<0.05?"":fmt(diferencia)}
                    </span>
                  </div>
                </div>
              )}
            </>);
          })()}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="card">
            <div className="card-title">Disponibilidad por cuenta</div>
            {(()=>{
              const saldos=BANK_SOURCES.map(s=>{
                const saldoInicial=saldosIniciales[s]||0;
                const movInc=transactions.filter(t=>t.source===s&&t.amount>0).reduce((a,t)=>a+t.amount,0);
                const movExp=transactions.filter(t=>t.source===s&&t.amount<0).reduce((a,t)=>a+Math.abs(t.amount),0);
                return{s,saldoInicial,movInc,movExp,saldoActual:saldoInicial+movInc-movExp};
              });
              const totalDisponible=saldos.reduce((a,x)=>a+x.saldoActual,0);
              return(<>
                {saldos.map(({s,saldoInicial,movInc,movExp,saldoActual},i)=>(
                  <div key={s} style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"center"}}>
                      <span style={{fontSize:13,fontWeight:600,color:srcColor(s),background:srcBg(s),padding:"2px 9px",borderRadius:20}}>{s}</span>
                      <span style={{fontWeight:700,fontSize:14,color:saldoActual>=0?"var(--green)":"var(--red)"}}>{fmt(saldoActual)}</span>
                    </div>
                    {saldosIniciales[s]!==undefined&&<div style={{fontSize:11,color:"var(--muted)",display:"flex",gap:12}}>
                      <span>Inicial: {fmt(saldoInicial)}</span>
                      <span style={{color:"var(--green)"}}>+{fmt(movInc)}</span>
                      <span style={{color:"var(--red)"}}>-{fmt(movExp)}</span>
                    </div>}
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"2px solid var(--border)",paddingTop:10,marginTop:4}}>
                  <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>Total disponible</span>
                  <span style={{fontFamily:"var(--fd)",fontSize:18,fontWeight:700,color:totalDisponible>=0?"var(--green)":"var(--red)"}}>{fmt(totalDisponible)}</span>
                </div>
              </>);
            })()}
            {ahorro&&<div style={{marginTop:14,paddingTop:12,borderTop:"1px solid var(--border)"}}>
              <div style={{fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Ahorro</div>
              {(()=>{
                const efAhSaldo=(saldosIniciales["Efectivo Ahorro"]||0)+transactions.filter(t=>t.source==="Efectivo Ahorro"&&t.amount>0).reduce((a,t)=>a+t.amount,0)-transactions.filter(t=>t.source==="Efectivo Ahorro"&&t.amount<0).reduce((a,t)=>a+Math.abs(t.amount),0);
                return efAhSaldo!==0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                  <span style={{color:"#7e22ce",fontWeight:600}}>Efectivo Ahorro</span>
                  <span style={{fontWeight:600,color:efAhSaldo>=0?"var(--green)":"var(--red)"}}>{fmt(efAhSaldo)}</span>
                </div>;
              })()}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                <span>Plan Pensiones Mar</span><span style={{fontWeight:600}}>{fmt(ahorro.pensionMar||0)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                <span>Plan Pensiones Salva</span><span style={{fontWeight:600}}>{fmt(ahorro.pensionSalva||0)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}>
                <span>Fondo Inversión Salva</span>
                <span style={{fontWeight:600}}>{ahorro.fondo?.length>0?fmt(ahorro.fondo[0].valor):fmt(0)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,borderTop:"1px solid var(--border)",paddingTop:6}}>
                <span>Total Ahorro</span>
                <span style={{color:"var(--green)"}}>{fmt((saldosIniciales["Efectivo Ahorro"]||0)+transactions.filter(t=>t.source==="Efectivo Ahorro"&&t.amount>0).reduce((a,t)=>a+t.amount,0)-transactions.filter(t=>t.source==="Efectivo Ahorro"&&t.amount<0).reduce((a,t)=>a+Math.abs(t.amount),0)+(ahorro.pensionMar||0)+(ahorro.pensionSalva||0)+(ahorro.fondo?.length>0?ahorro.fondo[0].valor:0))}</span>
              </div>
            </div>}
          </div>
          {topCats.length>0&&<div className="card">
            <div className="card-title">Top categorías del período</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {topCats.map(([cat,amt])=>{const pct=totalCatExp>0?Math.round(amt/totalCatExp*100):0;return(<div key={cat} style={{background:"var(--s2)",borderRadius:8,padding:"8px 10px",border:"1px solid var(--border)"}}><div style={{fontSize:12,fontWeight:600,marginBottom:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:"var(--text)"}}>{cat}</div><div className="bbar" style={{marginBottom:4}}><div className="bbar-fill" style={{width:`${pct}%`,background:"var(--red)"}}/></div><div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--muted)"}}><span style={{color:"var(--red)",fontWeight:600}}>{fmt(amt)}</span><span>{pct}%</span></div></div>);})}
            </div>
          </div>}
        </div>
      </div>
      <div className="card" style={{marginBottom:14}}>
        <div className="sh"><div className="card-title" style={{marginBottom:0}}>Últimos movimientos</div><button className="btn btn-o btn-sm" onClick={()=>setTab("transactions")}>Ver todos →</button></div>
        {filteredTxs.length===0?<div className="empty">Sin movimientos este mes</div>
          :<table className="tx-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Cuenta</th><th className="right">Importe</th></tr></thead><tbody>{filteredTxs.slice(0,8).map(t=><MiniTxRow key={t.id} tx={t}/>)}</tbody></table>}
      </div>
    </div>
  );
}

function MiniTxRow({tx}){
  const isIncome=tx.amount>0;
  const srcClass=({"Efectivo":"src-ef","Efectivo Ahorro":"src-ef-ah","Santander":"src-san","Santander Ahorro":"src-san2","BBVA":"src-bbva","BBVA Tarjeta Prepago":"src-bbva-tp","Ahorro":"src-ahorro"})[tx.source]||"src-ef";
  return(
    <tr>
      <td style={{color:"var(--muted)",fontSize:12,whiteSpace:"nowrap"}}>{fmtDate(tx.date)}</td>
      <td className="tx-desc-cell">{tx.description}</td>
      <td>{tx.source&&<span className={`src-chip ${srcClass}`}>{tx.source}</span>}</td>
      <td className={`tx-amt-cell ${isIncome?"g":"r"}`}>{isIncome?"+":"-"}{fmt(Math.abs(tx.amount))}</td>
    </tr>
  );
}

// ── MOVIMIENTOS ───────────────────────────────────────────────────────────────
function Transactions({filteredTxs,source,periodLabel,structure,onAdd,onEdit,onSplit,onUpdateCategory}){
  const [search,setSearch]=useState("");
  const [filterType,setFilterType]=useState("all");
  const [filterSrc,setFilterSrc]=useState("Todos");
  const [sortBy,setSortBy]=useState("date");
  const [sortDir,setSortDir]=useState("desc"); // asc | desc
  const allItems=getAllItems(structure);

  const toggleSort=(field)=>{
    if(sortBy===field) setSortDir(d=>d==="desc"?"asc":"desc");
    else{setSortBy(field);setSortDir("desc");}
  };

  const shown=filteredTxs
    .filter(t=>filterType==="all"||(filterType==="income"?t.amount>0:t.amount<0))
    .filter(t=>filterSrc==="Todos"||t.source===filterSrc)
    .filter(t=>!search||t.description?.toLowerCase().includes(search.toLowerCase())||t.category?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{
      let cmp=0;
      if(sortBy==="date") cmp=a.date?.localeCompare(b.date)||0;
      else cmp=Math.abs(a.amount)-Math.abs(b.amount);
      return sortDir==="desc"?-cmp:cmp;
    });

  const srcClass=(s)=>({"Efectivo":"src-ef","Efectivo Ahorro":"src-ef-ah","Santander":"src-san","Santander Ahorro":"src-san2","BBVA":"src-bbva","BBVA Tarjeta Prepago":"src-bbva-tp","Ahorro":"src-ahorro"})[s]||"src-ef";
  const sortIcon=(field)=>sortBy===field?(sortDir==="desc"?"↓":"↑"):"↕";

  return(
    <div>
      <div className="sh">
        <div className="sh-title">Movimientos · {periodLabel}{source!=="Todos"?` · ${source}`:""}</div>
        <div className="fg">
          <button className="btn btn-o btn-sm" onClick={async()=>{
            const rows=shown.map(t=>[fmtDate(t.date),t.description,t.source||"",t.category||"Sin clasificar",t.amount>=0?"+"+fmt(t.amount):fmt(t.amount),t.notes||""]);
            await exportToExcel(rows,["Fecha","Concepto","Cuenta","Categoría","Importe","Notas"],`movimientos_${periodLabel.replace(/ /g,"_")}.xlsx`);
          }}>📥 Exportar Excel</button>
          <button className="btn btn-p btn-sm" onClick={onAdd}>+ Añadir manual</button>
        </div>
      </div>
      <div className="fg" style={{marginBottom:8}}>
        <input className="sbar" placeholder="🔍 Buscar concepto o categoría..." value={search} onChange={e=>setSearch(e.target.value)}/>
        {[["all","Todos"],["income","Ingresos"],["expense","Gastos"]].map(([v,l])=><button key={v} className={`btn btn-sm ${filterType===v?"btn-p":"btn-o"}`} onClick={()=>setFilterType(v)}>{l}</button>)}
      </div>
      <div className="fg" style={{marginBottom:12}}>
        <span style={{fontSize:12,color:"var(--muted)",fontWeight:600}}>Cuenta:</span>
        {["Todos",...SOURCES].map(s=><button key={s} className={`btn btn-sm ${filterSrc===s?"btn-p":"btn-o"}`} style={{padding:"4px 10px",fontSize:11}} onClick={()=>setFilterSrc(s)}>{s}</button>)}
      </div>
      {shown.length===0?<div className="empty card">Sin resultados</div>:
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table className="tx-table">
              <thead><tr>
                <th style={{cursor:"pointer"}} onClick={()=>toggleSort("date")}>Fecha {sortIcon("date")}</th>
                <th>Concepto</th><th>Cuenta</th>
                <th>Clasificación <span style={{fontWeight:400,fontSize:10}}>(clic para editar)</span></th>
                <th className="right" style={{cursor:"pointer"}} onClick={()=>toggleSort("amount")}>Importe {sortIcon("amount")}</th><th></th>
              </tr></thead>
              <tbody>
                {shown.map(tx=>{
                  const isIncome=tx.amount>0;
                  const srcCls=({"Efectivo":"src-ef","Efectivo Ahorro":"src-ef-ah","Santander":"src-san","Santander Ahorro":"src-san2","BBVA":"src-bbva","BBVA Tarjeta Prepago":"src-bbva-tp","Ahorro":"src-ahorro"})[tx.source]||"src-ef";
                  const availCats=[...structure.gastos.flatMap(f=>f.grupos.flatMap(g=>g.items)),...structure.ingresos.flatMap(g=>g.items)];
                  return(
                    <tr key={tx.id}>
                      <td style={{color:"var(--muted)",fontSize:12,whiteSpace:"nowrap"}}>{fmtDate(tx.date)}</td>
                      <td className="tx-desc-cell" style={{maxWidth:220}} title={tx.description}>{tx.description}</td>
                      <td>{tx.source&&<span className={`src-chip ${srcCls}`}>{tx.source}</span>}</td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                          <select
                            className={tx.category?"cat-select":"no-cat"}
                            value={tx.category||""}
                            onChange={e=>onUpdateCategory(tx.id,e.target.value,true)}
                          >
                            <option value="">Sin clasificar</option>
                            <optgroup label="── Gastos ──" style={{color:"var(--muted)"}}/>
                            {[...structure.gastos.flatMap(f=>f.grupos.flatMap(g=>g.items))].sort((a,b)=>a.label.localeCompare(b.label,"es")).map(c=><option key={c.id} value={c.label}>{c.label}</option>)}
                            <optgroup label="── Ingresos ──" style={{color:"var(--muted)"}}/>
                            {[...structure.ingresos.flatMap(g=>g.items)].sort((a,b)=>a.label.localeCompare(b.label,"es")).map(c=><option key={c.id} value={c.label}>{c.label}</option>)}
                          </select>
                          {tx.aiClassified&&<span className="ai-chip">✦ IA</span>}
                          {tx.ruleClassified&&<span className="rule-chip">⚡ Regla</span>}
                        </div>
                      </td>
                      <td className={`tx-amt-cell ${isIncome?"g":"r"}`}>{isIncome?"+":"-"}{fmt(Math.abs(tx.amount))}</td>
                      <td><div style={{display:"flex",gap:4}}>
                        <button className="btn btn-o btn-sm" style={{padding:"3px 8px",fontSize:11}} onClick={()=>onEdit(tx)} title="Editar">✎</button>
                        <button className="btn btn-o btn-sm" style={{padding:"3px 8px",fontSize:11}} onClick={()=>onSplit(tx)} title="Dividir">⊕</button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  );
}

// ── COMPARATIVA ───────────────────────────────────────────────────────────────
function Comparison({transactions,budgets,selMonth,periodMode,activeMonths,periodLabel,source,structure}){
  const exportComparison=async()=>{
    const {fijos,variables}=getConsolidatedGastos(structure);
    const allIngresos=structure.ingresos.flatMap(g=>g.items);
    const getBudgetExp=(label)=>{
      if(periodMode==="month") return budgets[label]?.[selMonth]??budgets[label]?.["*"]??null;
      const m=budgets[label]?.["*"]??null; return m!==null?m*activeMonths.length:null;
    };
    const realExp=(label,isIncome=false)=>transactions.filter(t=>activeMonths.includes(t.date?.slice(0,7))&&t.category===label&&(isIncome?t.amount>0:t.amount<0)).reduce((s,t)=>s+Math.abs(t.amount),0);
    const rows=[];
    [["Gastos Fijos",fijos,false],["Gastos Variables",variables,false],["Ingresos",allIngresos,true]].forEach(([bloque,items,isInc])=>{
      rows.push([bloque,"","","","",""]);
      items.forEach(item=>{
        const b=getBudgetExp(item.label); const r=realExp(item.label,isInc);
        if(b!==null||r>0) rows.push(["",item.label,b!=null?b:"",r>0?r:"",b!=null&&r>0?r-b:""]);
      });
    });
    await exportToExcel(rows,["Bloque","Partida","Presupuesto","Real","Diferencia"],`presupuesto_vs_real_${periodLabel.replace(/ /g,"_")}.xlsx`);
  };
  const [viewSrc,setViewSrc]=useState("Todos");
  useEffect(()=>{if(source!=="Todos")setViewSrc(source);},[source]);
  const getBudget=(label)=>{
    if(periodMode==="month") return budgets[label]?.[selMonth]??budgets[label]?.["*"]??null;
    const monthly=budgets[label]?.["*"]??null;
    return monthly!==null?monthly*activeMonths.length:null;
  };
  const [y,m]=selMonth.split("-");
  const realForCat=(label,isIncome=false)=>
    transactions.filter(t=>activeMonths.includes(t.date?.slice(0,7))&&t.category===label&&(viewSrc==="Todos"||t.source===viewSrc)&&(isIncome?t.amount>0:t.amount<0))
      .reduce((s,t)=>s+Math.abs(t.amount),0);

  const DiffCell=({budget,real,incomeDir=false})=>{
    if(budget===null||budget===0) return<td className="neutral">—</td>;
    const diff=real-budget;const isOver=incomeDir?diff<0:diff>0;
    return<td className={isOver?"over":diff===0?"neutral":"under"}>{diff>=0?"+":""}{fmt(diff)}</td>;
  };
  const PctBar=({budget,real})=>{
    if(!budget||budget===0) return<td>—</td>;
    const pct=Math.min(150,Math.round(real/budget*100));const over=real>budget;
    return<td><div style={{display:"flex",alignItems:"center",gap:5}}><div className="bbar" style={{width:55,display:"inline-block",flexShrink:0}}><div className="bbar-fill" style={{width:`${Math.min(100,pct)}%`,background:over?"var(--red)":"var(--green)"}}/></div><span style={{fontSize:11,color:over?"var(--red)":"var(--muted)",fontWeight:over?600:400}}>{pct}%</span></div></td>;
  };



  const {fijos,variables}=getConsolidatedGastos(structure);
  const allIngresos=structure.ingresos.flatMap(g=>g.items);

  const renderBlock=(title,items,isIncome=false,color="var(--blue)")=>{
    const blockReal=items.reduce((s,i)=>s+realForCat(i.label,isIncome),0);
    const blockBudget=items.reduce((s,i)=>{const b=getBudget(i.label);return b!==null?s+b:s;},0);
    return(<>
      <tr className="frow"><td colSpan={5} style={{color}}>{title}</td></tr>
      {items.map(item=>{
        const b=getBudget(item.label);const r=realForCat(item.label,isIncome);
        if(b===null&&r===0) return null;
        return(<tr key={item.id}>
          <td style={{paddingLeft:20,fontSize:12}}>{item.label}</td>
          <td style={{color:"var(--muted)"}}>{b!==null?fmt(b):"—"}</td>
          <td style={{color:r>0?(isIncome?"var(--green)":"var(--red)"):"var(--hint)",fontWeight:r>0?600:400}}>{r>0?fmt(r):"—"}</td>
          <DiffCell budget={b} real={r} incomeDir={isIncome}/>
          <PctBar budget={b} real={r}/>
        </tr>);
      })}
      <tr className="subtotal">
        <td style={{paddingLeft:12}}>TOTAL {title.toUpperCase()}</td>
        <td style={{color:"var(--muted)"}}>{blockBudget>0?fmt(blockBudget):"—"}</td>
        <td style={{color:isIncome?"var(--green)":"var(--red)",fontWeight:700}}>{blockReal>0?fmt(blockReal):"—"}</td>
        <DiffCell budget={blockBudget>0?blockBudget:null} real={blockReal} incomeDir={isIncome}/>
        <PctBar budget={blockBudget>0?blockBudget:null} real={blockReal}/>
      </tr>
    </>);
  };

  return(
    <div>
      <div className="sh">
        <div className="sh-title">Presupuesto vs Real — {periodLabel}</div>
        <div className="fg">
          <button className="btn btn-o btn-sm" onClick={exportComparison}>📥 Exportar Excel</button>
        </div>
      </div>
      <div style={{fontSize:12,color:"var(--muted)",marginBottom:10,padding:"8px 12px",background:"var(--accent-light)",borderRadius:8,border:"1px solid #93c5fd"}}>
        ℹ La columna <strong>Ejecución</strong> muestra el % del presupuesto consumido. En verde si estás dentro, en rojo si lo has superado.
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div className="cmp-wrap">
          <table className="cmp-table">
            <thead><tr><th style={{textAlign:"left"}}>Partida</th><th>Presupuesto</th><th>Real</th><th>Diferencia</th><th>Ejecución</th></tr></thead>
            <tbody>
              {renderBlock("Gastos Fijos",fijos,false,"#1d4ed8")}
              {renderBlock("Gastos Variables",variables,false,"var(--red)")}
              {renderBlock("Ingresos",allIngresos,true,"var(--green)")}
              {(()=>{
                const totalFijosReal=fijos.reduce((s,i)=>s+realForCat(i.label),0);
                const totalVarReal=variables.reduce((s,i)=>s+realForCat(i.label),0);
                const totalIngReal=allIngresos.reduce((s,i)=>s+realForCat(i.label,true),0);
                const saldo=totalIngReal-totalFijosReal-totalVarReal;
                return(<tr style={{background:"#f0fdf4"}}>
                  <td colSpan={2} style={{fontWeight:700,fontSize:13,paddingLeft:12}}>SALDO DEL PERÍODO</td>
                  <td colSpan={3} style={{textAlign:"right",fontFamily:"var(--fd)",fontSize:16,fontWeight:700,color:saldo>=0?"var(--green)":"var(--red)"}}>{fmt(saldo)}</td>
                </tr>);
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Budgets({budgets,setBudgets,selMonth,periodMode,activeMonths,periodLabel,monthTxs,showToast,structure}){
  const [local,setLocal]=useState(()=>JSON.parse(JSON.stringify(budgets)));
  const [mode,setMode]=useState("monthly");const [open,setOpen]=useState(null);
  const setVal=(label,val)=>{setLocal(prev=>{const key=mode==="annual"?"*":selMonth;if(!val||val===""){const next={...prev};if(next[label]){const{[key]:_,...rest}=next[label];next[label]=rest;if(!Object.keys(next[label]).length)delete next[label];}return next;}return{...prev,[label]:{...(prev[label]||{}),[key]:parseFloat(val)}};});};
  const getVal=(label)=>{const e=local[label];if(!e)return"";const key=mode==="annual"?"*":selMonth;return e[key]??e["*"]??"";}
  const save=()=>{setBudgets(local);showToast("Presupuestos guardados");};
  const renderSection=(title,grupos,color)=>{const isOpen=open===title;return(<div key={title}><div className="acc-hdr" onClick={()=>setOpen(isOpen?null:title)}><span style={{fontWeight:600,fontSize:13,color}}>{title}</span><span style={{color:"var(--hint)",fontSize:11}}>{isOpen?"▲":"▼"}</span></div>{isOpen&&<div className="acc-body">{grupos.map(g=>(<div key={g.id}><div style={{padding:"6px 14px",fontSize:11,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".07em",background:"var(--s2)"}}>{g.label}</div>{g.items.map(item=>{const real=monthTxs.filter(t=>t.category===item.label).reduce((s,t)=>s+Math.abs(t.amount),0);return(<div key={item.id} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 14px 7px 24px",borderBottom:"1px solid var(--border)"}}><span style={{flex:1,fontSize:13,color:"var(--text)",fontWeight:500}}>{item.label}</span>{real>0&&<span style={{fontSize:11,color:"var(--red)",fontWeight:600}}>Real: {fmt(real)}</span>}<input type="number" min="0" step="10" value={getVal(item.label)} onChange={e=>setVal(item.label,e.target.value)} placeholder="—" style={{width:100,background:"#fff",border:"1px solid var(--border)",color:"var(--text)",borderRadius:7,padding:"5px 9px",fontSize:13,fontFamily:"var(--ff)",outline:"none",textAlign:"right"}}/><span style={{fontSize:11,color:"var(--hint)",width:12}}>€</span></div>);})}</div>))}</div>}</div>);};
  return(<div><div className="sh"><div className="sh-title">Presupuestos</div><div className="fg"><div className="period-tabs"><button className={`period-tab${mode==="monthly"?" active":""}`} onClick={()=>setMode("monthly")}>Este mes</button><button className={`period-tab${mode==="annual"?" active":""}`} onClick={()=>setMode("annual")}>Todos los meses</button></div><button className="btn btn-p" onClick={save}>💾 Guardar</button></div></div><div style={{fontSize:12,color:"var(--muted)",marginBottom:13,padding:"8px 12px",background:"var(--accent-light)",borderRadius:8,border:"1px solid #93c5fd"}}>{mode==="annual"?"Los valores anuales se aplican a todos los meses. Puedes sobreescribirlos mes a mes.":"Presupuesto específico para "+MONTHS_FULL[parseInt(selMonth.split("-")[1])-1]+" "+selMonth.split("-")[0]+"."}</div>{(()=>{
    const {fijos,variables}=getConsolidatedGastos(structure);
    const fijoGrupo={id:"fijos-virtual",label:"Gastos Fijos",items:fijos};
    const varGrupo={id:"vars-virtual",label:"Gastos Variables",items:variables};
    return(<>
      {renderSection("Gastos Fijos",[fijoGrupo],"#1d4ed8")}
      {renderSection("Gastos Variables",[varGrupo],"var(--red)")}
      {renderSection("Ingresos",structure.ingresos,"var(--green)")}
    </>);
  })()}<div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}><button className="btn btn-p" onClick={save}>💾 Guardar presupuestos</button></div></div>);
}

// ── CRITERIOS ─────────────────────────────────────────────────────────────────
function Rules({rules,setRules,structure,showToast}){
  const [newKw,setNewKw]=useState("");const [newCat,setNewCat]=useState("");const [newSrc,setNewSrc]=useState("Todas");const [newExact,setNewExact]=useState(false);
  const allItems=getAllItems(structure);
  const addRule=()=>{if(!newKw||!newCat)return;setRules(p=>[{id:uid(),keyword:newKw.trim(),category:newCat,source:newSrc,exact:newExact,auto:false},...p]);setNewKw("");setNewCat("");showToast("Regla añadida");};
  const deleteRule=(id)=>{setRules(p=>p.filter(r=>r.id!==id));showToast("Regla eliminada","🗑");};
  return(
    <div>
      <div className="sh"><div className="sh-title">Criterios de clasificación</div><div style={{fontSize:12,color:"var(--muted)"}}>{rules.length} reglas · se aplican antes y junto a la IA</div></div>
      <div className="card" style={{marginBottom:14}}>
        <div className="card-title">Nueva regla</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div className="field"><label>Si el extracto contiene</label><input value={newKw} onChange={e=>setNewKw(e.target.value)} placeholder="Ej: MERCADONA" onKeyDown={e=>e.key==="Enter"&&addRule()}/></div>
          <div className="field"><label>Asignar a categoría</label><select value={newCat} onChange={e=>setNewCat(e.target.value)}><option value="">Seleccionar...</option>{allItems.map(i=><option key={i.id} value={i.label}>{i.label} ({i.fuente})</option>)}</select></div>
          <div className="field"><label>Cuenta</label><select value={newSrc} onChange={e=>setNewSrc(e.target.value)}><option value="Todas">Todas las cuentas</option>{SOURCES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <div className="field"><label>Tipo</label><div className="period-tabs" style={{marginTop:2}}><button className={`period-tab${!newExact?" active":""}`} onClick={()=>setNewExact(false)}>Fragmento</button><button className={`period-tab${newExact?" active":""}`} onClick={()=>setNewExact(true)}>Exacta</button></div></div>
        </div>
        <button className="btn btn-p btn-sm" onClick={addRule} disabled={!newKw||!newCat}>+ Añadir regla</button>
      </div>
      {rules.length===0?<div className="empty card">Sin reglas. Añade una arriba, o corrige clasificaciones en Movimientos para que la app aprenda.</div>:
        <div className="card">{rules.map(r=>(
          <div key={r.id} className="rule-row">
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                <span style={{fontWeight:700,fontSize:13,fontFamily:"monospace",background:"var(--s2)",padding:"2px 8px",borderRadius:6,border:"1px solid var(--border)"}}>{r.keyword}</span>
                <span style={{fontSize:13,color:"var(--muted)"}}>→</span>
                <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{r.category}</span>
                <span className={`badge ${r.exact?"badge-blue":"badge-gray"}`}>{r.exact?"Exacta":"Fragmento"}</span>
                {r.auto&&<span className="badge badge-green">⚡ Auto-aprendida</span>}
              </div>
              <div style={{fontSize:11,color:"var(--muted)"}}>Cuenta: {r.source==="Todas"?"Todas las cuentas":r.source}</div>
            </div>
            <button className="btn btn-d btn-sm" onClick={()=>deleteRule(r.id)}>✕ Eliminar</button>
          </div>
        ))}</div>}
    </div>
  );
}

// ── ESTRUCTURA ────────────────────────────────────────────────────────────────
function StructureEditor({structure,setStructure,showToast}){
  const [editingId,setEditingId]=useState(null);const [editVal,setEditVal]=useState("");const [open,setOpen]=useState(null);
  const save=(newStr)=>{setStructure(newStr);showToast("Estructura guardada");};
  const renameItem=(path,newLabel)=>{if(!newLabel.trim()){setEditingId(null);return;}const next=JSON.parse(JSON.stringify(structure));if(path.type==="bloque"){const b=next.gastos.find(f=>f.id===path.bid);if(b)b.label=newLabel;}else if(path.type==="grupo"){const b=next.gastos.find(f=>f.id===path.bid);const grupos=b?b.grupos:next.ingresos;const g=grupos.find(g=>g.id===path.gid);if(g)g.label=newLabel;}else if(path.type==="item"){const allG=[...next.gastos.flatMap(f=>f.grupos),...next.ingresos];const g=allG.find(g=>g.id===path.gid);if(g){const item=g.items.find(i=>i.id===path.iid);if(item)item.label=newLabel;}}save(next);setEditingId(null);};
  const deleteItem=(path)=>{const next=JSON.parse(JSON.stringify(structure));if(path.type==="bloque")next.gastos=next.gastos.filter(f=>f.id!==path.bid);else if(path.type==="grupo"){const b=next.gastos.find(f=>f.id===path.bid);if(b)b.grupos=b.grupos.filter(g=>g.id!==path.gid);else next.ingresos=next.ingresos.filter(g=>g.id!==path.gid);}else if(path.type==="item"){const allG=[...next.gastos.flatMap(f=>f.grupos),...next.ingresos];const g=allG.find(g=>g.id===path.gid);if(g)g.items=g.items.filter(i=>i.id!==path.iid);}save(next);};
  const addToGroup=(gid,label)=>{if(!label.trim())return;const next=JSON.parse(JSON.stringify(structure));const allG=[...next.gastos.flatMap(f=>f.grupos),...next.ingresos];const g=allG.find(g=>g.id===gid);if(g)g.items.push({id:uid(),label:label.trim()});save(next);};
  const addGroup=(bid,label,isIng=false)=>{if(!label.trim())return;const next=JSON.parse(JSON.stringify(structure));if(isIng)next.ingresos.push({id:uid(),label:label.trim(),items:[]});else{const b=next.gastos.find(f=>f.id===bid);if(b)b.grupos.push({id:uid(),label:label.trim(),items:[]});}save(next);};
  const IE=({id,val,path})=>{if(editingId===id)return<input className="inline-input" value={editVal} autoFocus onChange={e=>setEditVal(e.target.value)} onBlur={()=>renameItem(path,editVal)} onKeyDown={e=>{if(e.key==="Enter")renameItem(path,editVal);if(e.key==="Escape")setEditingId(null);}}/>;return<span style={{fontSize:13,flex:1,cursor:"text",color:"var(--text)",fontWeight:500}} onDoubleClick={()=>{setEditingId(id);setEditVal(val);}}>{val} <span style={{fontSize:10,color:"var(--hint)"}}>✎</span></span>;};
  const AddLine=({placeholder,onAdd})=>{const[v,setV]=useState("");return<div style={{display:"flex",gap:5,padding:"6px 10px"}}><input value={v} onChange={e=>setV(e.target.value)} placeholder={placeholder} onKeyDown={e=>{if(e.key==="Enter"&&v.trim()){onAdd(v.trim());setV("");}}} style={{flex:1,background:"var(--s2)",border:"1px dashed var(--border2)",color:"var(--text)",borderRadius:6,padding:"4px 9px",fontSize:12,fontFamily:"var(--ff)",outline:"none"}}/><button className="btn btn-g btn-sm" onClick={()=>{if(v.trim()){onAdd(v.trim());setV("");}}}>+ Añadir</button></div>;};
  const renderBloque=(fuente)=>{const isOpen=open===fuente.id;const fColor=({"Efectivo":"var(--ef)","Efectivo Ahorro":"#7e22ce","Santander":"var(--san)","Santander Ahorro":"var(--san2)","BBVA":"var(--bbva)","BBVA Tarjeta Prepago":"#0f766e"})[fuente.fuente]||"var(--muted)";const fBg=({"Efectivo":"var(--ef-bg)","Efectivo Ahorro":"#f3e8ff","Santander":"var(--san-bg)","Santander Ahorro":"var(--san2-bg)","BBVA":"var(--bbva-bg)","BBVA Tarjeta Prepago":"#ccfbf1"})[fuente.fuente]||"var(--s2)";return(<div key={fuente.id} style={{marginBottom:8}}><div className="acc-hdr"><div style={{flex:1,display:"flex",alignItems:"center",gap:8}} onClick={()=>setOpen(isOpen?null:fuente.id)}><IE id={`b-${fuente.id}`} val={fuente.label} path={{type:"bloque",bid:fuente.id}}/><span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:fBg,color:fColor,fontWeight:600}}>{fuente.fuente}</span></div><button className="btn btn-d btn-sm" style={{padding:"2px 7px",marginLeft:4}} onClick={()=>deleteItem({type:"bloque",bid:fuente.id})}>✕</button><span style={{color:"var(--hint)",fontSize:11,marginLeft:6}} onClick={()=>setOpen(isOpen?null:fuente.id)}>{isOpen?"▲":"▼"}</span></div>{isOpen&&<div className="acc-body">{fuente.grupos.map(g=>(<div key={g.id} style={{margin:"6px 10px",border:"1px solid var(--border)",borderRadius:8,overflow:"hidden"}}><div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",background:"var(--s2)"}}><IE id={`g-${g.id}`} val={g.label} path={{type:"grupo",bid:fuente.id,gid:g.id}}/><button className="btn btn-d btn-sm" style={{padding:"2px 7px",fontSize:11}} onClick={()=>deleteItem({type:"grupo",bid:fuente.id,gid:g.id})}>✕</button></div>{g.items.map(item=>(<div key={item.id} className="editable-row" style={{paddingLeft:22}}><IE id={`i-${item.id}`} val={item.label} path={{type:"item",gid:g.id,iid:item.id}}/><button className="btn btn-d btn-sm" style={{padding:"1px 6px",fontSize:11,opacity:.6}} onClick={()=>deleteItem({type:"item",gid:g.id,iid:item.id})}>✕</button></div>))}<AddLine placeholder="+ Nueva partida (Enter para añadir)..." onAdd={label=>addToGroup(g.id,label)}/></div>))}<AddLine placeholder="+ Nuevo grupo..." onAdd={label=>addGroup(fuente.id,label)}/></div>}</div>);};
  const allItems=structure.gastos.flatMap(f=>f.grupos.flatMap(g=>g.items));
  const {fijos:fijoItems,variables:varItems}=getConsolidatedGastos(structure);

  const renderFlatBlock=(title,items,color,isFijo)=>{
    const isOpen=open===title;
    return(<div style={{marginBottom:8}}>
      <div className="acc-hdr" onClick={()=>setOpen(isOpen?null:title)}>
        <span style={{fontWeight:600,fontSize:13,color}}>{title}</span>
        <span style={{fontSize:11,color:"var(--muted)",marginRight:8}}>{items.length} partidas</span>
        <span style={{color:"var(--hint)",fontSize:11}}>{isOpen?"▲":"▼"}</span>
      </div>
      {isOpen&&<div className="acc-body">
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:4,padding:"8px 10px"}}>
          {items.map(item=>(
            <div key={item.id} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 8px",border:"1px solid var(--border)",borderRadius:7,background:"var(--s1)"}}>
              {editingId===`flat-${item.id}`
                ?<input className="inline-input" value={editVal} autoFocus style={{flex:1,fontSize:12}}
                    onChange={e=>setEditVal(e.target.value)}
                    onBlur={()=>{if(editVal.trim()){const next=JSON.parse(JSON.stringify(structure));const allG=next.gastos.flatMap(f=>f.grupos);const g=allG.find(g=>g.items.some(i=>i.id===item.id));if(g){const it=g.items.find(i=>i.id===item.id);if(it){if(GASTOS_FIJOS.has(it.label)){GASTOS_FIJOS.delete(it.label);GASTOS_FIJOS.add(editVal.trim());}it.label=editVal.trim();}}save(next);}setEditingId(null);}}
                    onKeyDown={e=>{if(e.key==="Escape")setEditingId(null);}}
                  />
                :<span style={{flex:1,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"text"}}
                    title="Doble clic para renombrar"
                    onDoubleClick={()=>{setEditingId(`flat-${item.id}`);setEditVal(item.label);}}
                  >{item.label} <span style={{fontSize:10,color:"var(--hint)"}}>✎</span></span>
              }
              <button className="btn btn-o btn-sm" style={{padding:"1px 6px",fontSize:10,flexShrink:0}}
                title={isFijo?"Mover a Variables":"Mover a Fijos"}
                onClick={()=>{if(isFijo)GASTOS_FIJOS.delete(item.label);else GASTOS_FIJOS.add(item.label);save(JSON.parse(JSON.stringify(structure)));showToast(`"${item.label}" → ${isFijo?"Variables":"Fijos"}`);}}
              >{isFijo?"→ Var":"→ Fijo"}</button>
              <button className="btn btn-d btn-sm" style={{padding:"1px 5px",fontSize:10,opacity:.5}}
                onClick={()=>{const next=JSON.parse(JSON.stringify(structure));const allG=next.gastos.flatMap(f=>f.grupos);allG.forEach(g=>{g.items=g.items.filter(i=>i.id!==item.id);});GASTOS_FIJOS.delete(item.label);save(next);}}
              >✕</button>
            </div>
          ))}
        </div>
        <div style={{padding:"6px 10px",borderTop:"1px solid var(--border)",marginTop:4}}>
          <AddLine placeholder={`+ Nueva partida en ${title}...`} onAdd={label=>{
            if(isFijo) GASTOS_FIJOS.add(label);
            const next=JSON.parse(JSON.stringify(structure));
            const firstGrupo=next.gastos[0]?.grupos[0];
            if(firstGrupo) firstGrupo.items.push({id:uid(),label});
            save(next);
          }}/>
        </div>
      </div>}
    </div>);
  };

  const renderIngresosBlock=()=>{
    const isOpen=open==="ing";
    const allIng=structure.ingresos.flatMap(g=>g.items).sort((a,b)=>a.label.localeCompare(b.label,'es'));
    return(<div style={{marginBottom:8}}>
      <div className="acc-hdr" onClick={()=>setOpen(isOpen?null:"ing")}>
        <span style={{fontWeight:600,fontSize:13,color:"var(--green)"}}>Ingresos</span>
        <span style={{fontSize:11,color:"var(--muted)",marginRight:8}}>{allIng.length} partidas</span>
        <span style={{color:"var(--hint)",fontSize:11}}>{isOpen?"▲":"▼"}</span>
      </div>
      {isOpen&&<div className="acc-body">
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:4,padding:"8px 10px"}}>
          {allIng.map(item=>(
            <div key={item.id} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 8px",border:"1px solid var(--border)",borderRadius:7,background:"var(--s1)"}}>
              {editingId===`ing-${item.id}`
                ?<input className="inline-input" value={editVal} autoFocus style={{flex:1,fontSize:12}}
                    onChange={e=>setEditVal(e.target.value)}
                    onBlur={()=>{if(editVal.trim()){const next=JSON.parse(JSON.stringify(structure));next.ingresos.forEach(g=>{const it=g.items.find(i=>i.id===item.id);if(it)it.label=editVal.trim();});save(next);}setEditingId(null);}}
                    onKeyDown={e=>{if(e.key==="Escape")setEditingId(null);}}
                  />
                :<span style={{flex:1,fontSize:12,cursor:"text"}} title="Doble clic para renombrar"
                    onDoubleClick={()=>{setEditingId(`ing-${item.id}`);setEditVal(item.label);}}
                  >{item.label} <span style={{fontSize:10,color:"var(--hint)"}}>✎</span></span>
              }
              <button className="btn btn-d btn-sm" style={{padding:"1px 5px",fontSize:10,opacity:.6}} onClick={()=>{
                const next=JSON.parse(JSON.stringify(structure));
                next.ingresos=next.ingresos.map(g=>({...g,items:g.items.filter(i=>i.id!==item.id)}));
                save(next);
              }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{padding:"6px 10px",borderTop:"1px solid var(--border)",marginTop:4}}>
          <AddLine placeholder="+ Nueva partida de ingreso..." onAdd={label=>{
            const next=JSON.parse(JSON.stringify(structure));
            if(!next.ingresos[0]) next.ingresos.push({id:uid(),label:"Otros Ingresos",items:[]});
            next.ingresos[0].items.push({id:uid(),label});
            save(next);
          }}/>
        </div>
      </div>}
    </div>);
  };

  return(<div>
    <div className="sh">
      <div className="sh-title">Estructura de categorías</div>
      <div style={{fontSize:12,color:"var(--muted)"}}>Clic para expandir · → para mover entre bloques · Enter para añadir</div>
    </div>
    {renderFlatBlock("Gastos Fijos",fijoItems,"#1d4ed8",true)}
    {renderFlatBlock("Gastos Variables",varItems,"var(--red)",false)}
    {renderIngresosBlock()}
  </div>);
}

function NewBloqueForm({onAdd}){const [label,setLabel]=useState("");const [fuente,setFuente]=useState("Efectivo");return(<div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}><div className="field" style={{flex:1}}><label>Nombre del bloque</label><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Ej: Gastos Empresa"/></div><div className="field"><label>Cuenta</label><select value={fuente} onChange={e=>setFuente(e.target.value)}>{SOURCES.map(s=><option key={s} value={s}>{s}</option>)}</select></div><button className="btn btn-p" onClick={()=>{if(label.trim()){onAdd(label.trim(),fuente);setLabel("");}}}>Crear bloque</button></div>);}

// ── IMPORTAR ──────────────────────────────────────────────────────────────────

// ── BATCH LIST ────────────────────────────────────────────────────────────────
function BatchList({batches,transactions,onDeleteBatch,onEditTx,onSplitTx,structure}){
  const [openBatch,setOpenBatch]=useState(null);
  const [search,setSearch]=useState("");
  const srcClass=(s)=>({"Efectivo":"src-ef","Efectivo Ahorro":"src-ef-ah","Santander":"src-san","Santander Ahorro":"src-san2","BBVA":"src-bbva","BBVA Tarjeta Prepago":"src-bbva-tp"})[s]||"src-ef";

  return(<>
    {batches.map(b=>{
      const batchTxs=transactions.filter(t=>t.batchId===b.id);
      const isOpen=openBatch===b.id;
      const filtered=batchTxs.filter(t=>!search||t.description?.toLowerCase().includes(search.toLowerCase())||t.category?.toLowerCase().includes(search.toLowerCase()));
      return(
        <div key={b.id} style={{borderBottom:"1px solid var(--border)",paddingBottom:isOpen?12:0,marginBottom:isOpen?8:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",cursor:"pointer"}} onClick={()=>setOpenBatch(isOpen?null:b.id)}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600}}>{b.label}</div>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{b.date} · {b.count} movimientos</div>
            </div>
            <button className="btn btn-o btn-sm" onClick={e=>{e.stopPropagation();setOpenBatch(isOpen?null:b.id);}}>
              {isOpen?"▲ Cerrar":"▼ Ver movimientos"}
            </button>
            <button className="btn btn-d btn-sm" onClick={e=>{e.stopPropagation();if(window.confirm(`¿Eliminar esta importación y sus ${b.count} movimientos?`))onDeleteBatch(b.id);}}>🗑 Eliminar</button>
          </div>
          {isOpen&&<div style={{marginTop:6}}>
            <input className="sbar" placeholder="🔍 Buscar en esta importación..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:10,width:"100%",boxSizing:"border-box"}}/>
            <div style={{overflowX:"auto",maxHeight:420,overflowY:"auto"}}>
              <table className="tx-table">
                <thead><tr>
                  <th>Fecha</th><th>Concepto</th><th>Cuenta</th>
                  <th>Categoría</th>
                  <th className="right">Importe</th>
                  <th className="right">Saldo</th><th></th>
                </tr></thead>
                <tbody>
                  {filtered.map(tx=>{
                    const isIncome=tx.amount>0;
                    const allGastos=structure.gastos.flatMap(f=>f.grupos.flatMap(g=>g.items));
                    const allIngresos=structure.ingresos.flatMap(g=>g.items);
                    return(
                      <tr key={tx.id}>
                        <td style={{color:"var(--muted)",fontSize:12,whiteSpace:"nowrap"}}>{fmtDate(tx.date)}</td>
                        <td className="tx-desc-cell" style={{maxWidth:200}} title={tx.description}>{tx.description}</td>
                        <td>{tx.source&&<span className={`src-chip ${srcClass(tx.source)}`}>{tx.source}</span>}</td>
                        <td style={{fontSize:12,color:tx.category?"var(--text)":"var(--muted)"}}>{tx.category||"Sin clasificar"}</td>
                        <td className={`tx-amt-cell ${isIncome?"g":"r"}`}>{isIncome?"+":"-"}{fmt(Math.abs(tx.amount))}</td>
                        <td style={{textAlign:"right",fontFamily:"var(--fd)",fontSize:12,color:"var(--muted)",whiteSpace:"nowrap"}}>{tx.saldo!=null?fmt(tx.saldo):"—"}</td>
                        <td>
                          <div style={{display:"flex",gap:3}}>
                            <button className="btn btn-o btn-sm" style={{padding:"3px 7px",fontSize:11}} onClick={()=>onEditTx(tx)} title="Editar">✎</button>
                            <button className="btn btn-o btn-sm" style={{padding:"3px 7px",fontSize:11}} onClick={()=>onSplitTx(tx)} title="Dividir">⊕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length===0&&<div className="empty">Sin resultados</div>}
            <div style={{fontSize:11,color:"var(--muted)",marginTop:8,textAlign:"right"}}>
              {filtered.length} de {batchTxs.length} movimientos
            </div>
          </div>}
        </div>
      );
    })}
  </>);
}

// ─── File parser (outside component - no closure issues) ───────────────────
async function parseImportFile(file, src) {
  const ext=file.name.split(".").pop().toLowerCase();
  console.log("parseImportFile: name=",file.name,"src=",src,"ext=",ext);
  let raw=[];
  if(ext==="csv"){
    raw=parseCSV(await file.text());
  } else if(ext==="pdf"){
    const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
    raw=await extractPDF(b64);
  } else if(ext==="xlsx"||ext==="xls"){
    const{read,utils}=await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
    const wb=read(await file.arrayBuffer());
    const ws=wb.Sheets[wb.SheetNames[0]];
    const isBBVATP=src==="BBVA Tarjeta Prepago";
    const isBBVA=src==="BBVA";
    console.log("parseImportFile xlsx: isBBVATP=",isBBVATP,"isBBVA=",isBBVA);
    if(isBBVA||isBBVATP){
      const rowsR=utils.sheet_to_json(ws,{header:1,raw:true});
      const rowsS=utils.sheet_to_json(ws,{header:1,raw:false});
      let dataStart=5;
      for(let i=0;i<Math.min(rowsS.length,10);i++){
        if(rowsS[i]&&rowsS[i].some(c=>String(c||"").toLowerCase().includes("concepto"))){dataStart=i+1;break;}
      }
      console.log("BBVA dataStart=",dataStart,"first data row raw=",JSON.stringify(rowsR[dataStart]));
      raw=rowsR.slice(dataStart).map((r,idx)=>{
        if(!r) return null;
        const rs=rowsS[dataStart+idx]||[];
        if(isBBVATP){
          // Col A vacía pero SheetJS la incluye (null) cuando otras filas tienen datos en esa col
          // r[0]=null(colA), r[1]=Fecha, r[2]=Concepto, r[3]=Movimiento, r[4]=Importe
          if(!rs[1]) return null;
          const date=parseExcelDate(rs[1]);
          const c1=String(r[2]||"").trim();
          const c2=String(r[3]||"").trim();
          const description=c2&&c2!==c1&&c2!=="No categorizable"?`${c1} - ${c2}`:c1;
          const amount=typeof r[4]==="number"?r[4]:parseFloat(String(r[4]).replace(",","."));
          if(!description||isNaN(amount)) return null;
          return{date,description,amount};
        } else {
          // BBVA cuenta corriente
          if(!rs[1]) return null;
          const date=parseExcelDate(rs[1]);
          const c1=String(r[2]||"").trim();
          const c2=String(r[3]||"").trim();
          const description=c2&&c2!==c1?`${c1} - ${c2}`:c1;
          const amount=typeof r[4]==="number"?r[4]:parseFloat(r[4]);
          const saldo=typeof r[6]==="number"?r[6]:(r[6]?parseFloat(r[6]):null);
          if(!description||isNaN(amount)) return null;
          return{date,description,amount,...(saldo!==null&&!isNaN(saldo)?{saldo}:{})};
        }
      }).filter(Boolean);
    } else {
      // Santander / Efectivo
      const rows=utils.sheet_to_json(ws,{header:1,raw:false});
      let dataStart=1;
      for(let i=0;i<Math.min(rows.length,10);i++){
        if(rows[i]&&rows[i].some(c=>String(c||"").toLowerCase().includes("concepto"))){dataStart=i+1;break;}
      }
      raw=rows.slice(dataStart).map(r=>{
        if(!r||r.length<4||!r[0]) return null;
        const date=parseExcelDate(r[0]);
        const description=String(r[2]||"").trim();
        const amount=parseSpanishNumber(r[3]);
        const saldo=r[4]?parseSpanishNumber(r[4]):null;
        if(isNaN(amount)||!description) return null;
        return{date,description,amount,...(saldo!==null&&!isNaN(saldo)?{saldo}:{})};
      }).filter(Boolean);
    }
  } else {
    throw new Error("Formato no soportado: usa PDF, CSV o Excel");
  }
  return raw;
}

function Import({onImport,showToast,batches,onDeleteBatch,transactions,onEditTx,onSplitTx,structure}){
  const [dragging,setDragging]=useState(false);
  const [processing,setProcessing]=useState(false);
  const [preview,setPreview]=useState([]);
  const [previewSrc,setPreviewSrc]=useState("Santander");
  const previewSrcRef=useRef("Santander");
  const fileRef=useRef();

  const handleFile=async(file)=>{
    const src=previewSrcRef.current;
    console.log("handleFile src=",src,"file=",file.name);
    setProcessing(true);setPreview([]);
    try{
      const raw=await parseImportFile(file,src);
      setPreview(raw);
      if(raw.length>0) showToast(`${raw.length} movimientos listos para importar`,"📋");
      else showToast("No se encontraron movimientos en el archivo","✕");
    }catch(e){
      showToast("Error al leer el archivo: "+e.message,"✕");
      console.error("Import error:",e);
    }
    setProcessing(false);
  };

  const confirm=()=>{
    const src=previewSrcRef.current;
    const label=`${src} · ${new Date().toLocaleDateString("es-ES")} · ${preview.length} mov.`;
    onImport(preview.map(t=>({...t,source:src})),label);
    setPreview([]);
  };


  return(
    <div>
      <div className="sh"><div className="sh-title">Importar extracto bancario</div></div>

      <div className="card" style={{marginBottom:14}}>
        <div className="card-title">Nuevo extracto</div>
        <div className="fg" style={{marginBottom:13}}>
          <span style={{fontSize:13,fontWeight:600}}>Cuenta:</span>
          <div className="period-tabs">{IMPORT_SOURCES.map(s=><button key={s} className={`period-tab${previewSrc===s?" active":""}`} onClick={()=>{setPreviewSrc(s);previewSrcRef.current=s;}}>{s}</button>)}</div>
        </div>
        <div className={`drop-zone${dragging?" drag":""}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);}} onClick={()=>fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".csv,.pdf,.xlsx,.xls" style={{display:"none"}} onChange={e=>e.target.files[0]&&handleFile(e.target.files[0])}/>
          {processing?<><div style={{fontSize:32,marginBottom:10}} className="spin">⟳</div><div style={{fontSize:13,fontWeight:500}}>Leyendo archivo...</div></>
            :<><div style={{fontSize:32,marginBottom:10}}>📤</div><div style={{fontSize:14,fontWeight:600,marginBottom:4}}>Arrastra el extracto aquí o haz clic</div><div style={{fontSize:12,color:"var(--muted)"}}>PDF · CSV · Excel (.xlsx) — Extracto de: {previewSrc}</div><div style={{fontSize:11,color:"var(--hint)",marginTop:6}}>Formato Santander: col A=Fecha, C=Concepto, D=Importe</div></>}
        </div>
      </div>

      {preview.length>0&&(
        <div className="card" style={{marginBottom:14}}>
          <div className="sh">
            <div><div className="card-title" style={{marginBottom:2}}>Vista previa — {preview.length} movimientos · {previewSrc}</div><div style={{fontSize:12,color:"var(--muted)"}}>Al importar se clasificarán automáticamente con IA</div></div>
            <div className="fg"><button className="btn btn-o btn-sm" onClick={()=>setPreview([])}>Cancelar</button><button className="btn btn-p" onClick={confirm}>⚡ Importar y clasificar →</button></div>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="tx-table">
              <thead><tr><th>Fecha</th><th>Concepto</th><th className="right">Importe</th></tr></thead>
              <tbody>
                {preview.slice(0,30).map((t,i)=>(
                  <tr key={i}>
                    <td style={{color:"var(--muted)",fontSize:12,whiteSpace:"nowrap"}}>{fmtDate(t.date)}</td>
                    <td style={{maxWidth:300,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.description}</td>
                    <td className={`tx-amt-cell ${t.amount>=0?"g":"r"}`}>{t.amount>=0?"+":"-"}{fmt(Math.abs(t.amount))}</td>
                  </tr>
                ))}
                {preview.length>30&&<tr><td colSpan={3} style={{textAlign:"center",padding:10,color:"var(--muted)",fontSize:12}}>…y {preview.length-30} más</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch history */}
      {batches.length>0&&(
        <div className="card">
          <div className="card-title">Importaciones realizadas</div>
          <BatchList batches={batches} transactions={transactions} onDeleteBatch={onDeleteBatch} onEditTx={onEditTx} onSplitTx={onSplitTx} structure={structure}/>
        </div>
      )}
    </div>
  );
}

// ── MODAL TRANSACCIÓN ─────────────────────────────────────────────────────────
function TxModal({tx,structure,onClose,onSave,onDelete}){
  const isEdit=!!tx;
  const [form,setForm]=useState({date:tx?.date||today(),description:tx?.description||"",amount:tx?Math.abs(tx.amount):"",type:tx?(tx.amount>=0?"ingreso":"gasto"):"gasto",source:tx?.source||"Efectivo",category:tx?.category||"",notes:tx?.notes||""});
  const [learn,setLearn]=useState(true);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const origCat=tx?.category;
  const allGastos=structure.gastos.flatMap(f=>f.grupos.flatMap(g=>g.items)); const allIngresos=structure.ingresos.flatMap(g=>g.items);
  const handleSave=()=>{if(!form.description||!form.amount)return;const amt=parseFloat(form.amount);const changed=isEdit&&form.category!==origCat;onSave({...(tx||{}),...form,amount:form.type==="ingreso"?Math.abs(amt):-Math.abs(amt),aiClassified:false,ruleClassified:false},changed&&learn);};
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-hdr"><div className="modal-title">{isEdit?"Editar movimiento":"Nuevo movimiento"}</div><button className="modal-x" onClick={onClose}>✕</button></div>
        <div className="fg" style={{marginBottom:15}}>{[["gasto","💳 Gasto"],["ingreso","💰 Ingreso"]].map(([v,l])=><button key={v} className={`btn btn-sm ${form.type===v?"btn-p":"btn-o"}`} style={{flex:1}} onClick={()=>set("type",v)}>{l}</button>)}</div>
        <div className="form-grid">
          <div className="field full"><label>Descripción *</label><input value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Ej: Supermercado Mercadona"/></div>
          <div className="field"><label>Importe (€) *</label><input type="number" min="0" step="0.01" value={form.amount} onChange={e=>set("amount",e.target.value)} placeholder="0.00"/></div>
          <div className="field"><label>Fecha</label><input type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></div>
          <div className="field"><label>Cuenta</label><select value={form.source} onChange={e=>set("source",e.target.value)}>{SOURCES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <div className="field"><label>Categoría</label><select value={form.category} onChange={e=>set("category",e.target.value)}><option value="">Sin categoría</option>
                <optgroup label="Gastos">{[...allGastos].sort((a,b)=>a.label.localeCompare(b.label,"es")).map(c=><option key={c.id} value={c.label}>{c.label}</option>)}</optgroup>
                <optgroup label="Ingresos">{[...allIngresos].sort((a,b)=>a.label.localeCompare(b.label,"es")).map(c=><option key={c.id} value={c.label}>{c.label}</option>)}</optgroup></select></div>
          <div className="field full"><label>Notas</label><input value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Opcional..."/></div>
        </div>
        {isEdit&&form.category&&form.category!==origCat&&(
          <div style={{marginTop:10,padding:"10px 13px",background:"var(--accent-light)",borderRadius:8,border:"1px solid #93c5fd",display:"flex",alignItems:"center",gap:8}}>
            <input type="checkbox" id="learn" checked={learn} onChange={e=>setLearn(e.target.checked)}/>
            <label htmlFor="learn" style={{fontSize:12,color:"var(--blue)",cursor:"pointer",fontWeight:500}}>⚡ Aprender: crear regla automática para clasificar movimientos similares como "{form.category}"</label>
          </div>
        )}
        <div className="divider"/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>{isEdit&&onDelete&&<button className="btn btn-d btn-sm" onClick={()=>{if(window.confirm("¿Eliminar este movimiento?"))onDelete();}}>🗑 Eliminar</button>}</div>
          <div className="fg"><button className="btn btn-o" onClick={onClose}>Cancelar</button><button className="btn btn-p" onClick={handleSave} disabled={!form.description||!form.amount}>{isEdit?"💾 Guardar":"+ Añadir"}</button></div>
        </div>
      </div>
    </div>
  );
}


// ── AHORRO ────────────────────────────────────────────────────────────────────
function Ahorro({ahorro,setAhorro,saldosIniciales,setSaldosIniciales,transactions,activeMonths,showToast}){
  const [newFondoVal,setNewFondoVal]=useState("");
  const [newFondoDate,setNewFondoDate]=useState(today());
  const [newFondoNota,setNewFondoNota]=useState("");

  const savePension=(key,val)=>{
    setAhorro(p=>({...p,[key]:parseFloat(val)||0}));
    showToast("Guardado");
  };

  const addFondoEntry=()=>{
    if(!newFondoVal) return;
    const entry={id:uid(),date:newFondoDate,valor:parseSpanishNumber(newFondoVal),nota:newFondoNota};
    // Insert sorted by date descending
    setAhorro(p=>({...p,fondo:[entry,...(p.fondo||[])].sort((a,b)=>b.date.localeCompare(a.date))}));
    setNewFondoVal("");setNewFondoNota("");
    showToast("Valoración añadida");
  };

  const deleteFondoEntry=(id)=>{
    setAhorro(p=>({...p,fondo:(p.fondo||[]).filter(e=>e.id!==id)}));
    showToast("Eliminada","🗑");
  };

  const totalAhorro=(ahorro.pensionMar||0)+(ahorro.pensionSalva||0)+(ahorro.fondo?.length>0?ahorro.fondo[0].valor:0);

  return(
    <div>
      <div className="sh"><div className="sh-title">Ahorro y disponibilidad</div></div>

      {/* Saldos iniciales */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-title">Saldos iniciales por cuenta</div>
        <div style={{fontSize:12,color:"var(--muted)",marginBottom:14,padding:"8px 12px",background:"var(--accent-light)",borderRadius:8,border:"1px solid #93c5fd"}}>
          Introduce el saldo inicial de cada cuenta. El saldo actual se calcula automáticamente sumando los movimientos importados.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
          {IMPORT_SOURCES.map(s=>{
            const saldoInicial=saldosIniciales[s]||0;
            const movInc=transactions.filter(t=>t.source===s&&t.amount>0).reduce((a,t)=>a+t.amount,0);
            const movExp=transactions.filter(t=>t.source===s&&t.amount<0).reduce((a,t)=>a+Math.abs(t.amount),0);
            const saldoActual=saldoInicial+movInc-movExp;
            return(
              <div key={s} style={{background:"var(--s2)",borderRadius:9,padding:"12px 14px",border:"1px solid var(--border)"}}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:8,color:"var(--text)"}}>{s}</div>
                <div className="field" style={{marginBottom:8}}>
                  <label>Saldo inicial (€)</label>
                  <input type="text" inputMode="decimal"
                    key={`${s}-${saldosIniciales[s]}`}
                    defaultValue={saldosIniciales[s]!=null?new Intl.NumberFormat("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2}).format(saldosIniciales[s]):""}
                    placeholder="0,00"
                    onBlur={e=>{
                      const v=parseSpanishNumber(e.target.value);
                      if(!isNaN(v)){
                        setSaldosIniciales(p=>({...p,[s]:v}));
                        e.target.value=new Intl.NumberFormat("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
                        showToast(`Saldo inicial ${s} guardado`);
                      }
                    }}
                    style={{background:"#fff",border:"1px solid var(--border)",color:"var(--text)",borderRadius:7,padding:"6px 9px",fontSize:13,fontFamily:"var(--ff)",outline:"none",textAlign:"right"}}
                  />
                </div>
                <div style={{fontSize:11,color:"var(--muted)",display:"flex",flexDirection:"column",gap:2}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span>Ingresos:</span><span style={{color:"var(--green)",fontWeight:600}}>+{fmt(movInc)}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span>Gastos:</span><span style={{color:"var(--red)",fontWeight:600}}>-{fmt(movExp)}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,borderTop:"1px solid var(--border)",paddingTop:4,marginTop:2}}>
                    <span>Saldo actual:</span>
                    <span style={{color:saldoActual>=0?"var(--green)":"var(--red)",fontSize:13}}>{fmt(saldoActual)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Planes de pensiones */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-title">Planes de pensiones</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {[["pensionMar","Plan de Pensiones Mar"],["pensionSalva","Plan de Pensiones Salva"]].map(([key,label])=>(
            <div key={key} style={{background:"var(--s2)",borderRadius:9,padding:"12px 14px",border:"1px solid var(--border)"}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{label}</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input type="number" step="0.01"
                  defaultValue={ahorro[key]||""}
                  placeholder="Valor actual..."
                  onBlur={e=>savePension(key,e.target.value)}
                  style={{flex:1,background:"#fff",border:"1px solid var(--border)",color:"var(--text)",borderRadius:7,padding:"8px 10px",fontSize:14,fontFamily:"var(--ff)",outline:"none",textAlign:"right",fontWeight:600}}
                />
                <span style={{fontSize:12,color:"var(--muted)"}}>€</span>
              </div>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:6}}>Actualiza cuando recibas el extracto del plan</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fondo de inversión */}
      <div className="card">
        <div className="sh">
          <div className="card-title" style={{marginBottom:0}}>Fondo de Inversión Salva</div>
          {ahorro.fondo?.length>0&&<div style={{fontFamily:"var(--fd)",fontSize:18,color:"var(--green)",fontWeight:700}}>{fmt(ahorro.fondo[0].valor)}</div>}
        </div>

        {/* Nueva valoración */}
        <div style={{background:"var(--s2)",borderRadius:9,padding:"12px 14px",border:"1px solid var(--border)",marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Añadir valoración</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr auto",gap:8,alignItems:"end"}}>
            <div className="field">
              <label>Fecha</label>
              <input type="date" value={newFondoDate} onChange={e=>setNewFondoDate(e.target.value)}/>
            </div>
            <div className="field">
              <label>Valor (€)</label>
              <input type="text" inputMode="decimal" value={newFondoVal} onChange={e=>setNewFondoVal(e.target.value)} placeholder="0,00" onKeyDown={e=>e.key==="Enter"&&addFondoEntry()}/>
            </div>
            <div className="field">
              <label>Nota (opcional)</label>
              <input value={newFondoNota} onChange={e=>setNewFondoNota(e.target.value)} placeholder="Ej: Extracto trimestral"/>
            </div>
            <button className="btn btn-p" onClick={addFondoEntry} disabled={!newFondoVal}>+ Añadir</button>
          </div>
        </div>

        {/* Historial */}
        {(!ahorro.fondo||ahorro.fondo.length===0)
          ?<div className="empty">Sin valoraciones registradas aún</div>
          :<div style={{overflowX:"auto"}}>
            <table className="tx-table">
              <thead><tr><th>Fecha</th><th>Nota</th><th className="right">Valor</th><th className="right">Variación</th><th></th></tr></thead>
              <tbody>
                {(ahorro.fondo||[]).map((e,i)=>{
                  const prev=ahorro.fondo[i+1];
                  const diff=prev?e.valor-prev.valor:null;
                  return(
                    <tr key={e.id}>
                      <td style={{color:"var(--muted)",whiteSpace:"nowrap"}}>{fmtDate(e.date)}</td>
                      <td style={{color:"var(--muted)",fontSize:12}}>{e.nota||"—"}</td>
                      <td style={{textAlign:"right",fontFamily:"var(--fd)",fontWeight:600}}>{fmt(e.valor)}</td>
                      <td style={{textAlign:"right",fontSize:12,color:diff===null?"var(--hint)":diff>=0?"var(--green)":"var(--red)",fontWeight:600}}>
                        {diff===null?"—":diff>=0?"+"+fmt(diff):fmt(diff)}
                      </td>
                      <td><button className="btn btn-d btn-sm" style={{padding:"2px 7px"}} onClick={()=>deleteFondoEntry(e.id)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        }

        {/* Resumen total ahorro */}
        <div style={{marginTop:16,padding:"12px 14px",background:"var(--green-bg)",borderRadius:9,border:"1px solid #bbf7d0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:600,color:"var(--green)"}}>Total Ahorro consolidado</span>
          <span style={{fontFamily:"var(--fd)",fontSize:20,fontWeight:700,color:"var(--green)"}}>{fmt(totalAhorro)}</span>
        </div>
      </div>
    </div>
  );
}


// ── CLASIFICACIÓN EN BLOQUE ───────────────────────────────────────────────────
function BulkClassify({transactions,setTransactions,structure,rules,setRules,showToast}){
  const [groups,setGroups]=useState([]);
  const [loading,setLoading]=useState(false);
  const [applying,setApplying]=useState({});
  const allItems=getAllItems(structure);
  const unclassified=transactions.filter(t=>!t.category);

  const loadSuggestions=async()=>{
    if(!unclassified.length){showToast("No hay movimientos sin clasificar","ℹ");return;}
    if(!getApiKey()){showToast("Configura tu API key para usar IA","ℹ");return;}
    setLoading(true);
    try{
      const result=await suggestBulkGroups(unclassified,structure);
      setGroups(result);
    }catch(e){showToast("Error: "+e.message,"✕");}
    setLoading(false);
  };

  const applyGroup=(group,catLabel,createRule)=>{
    setApplying(p=>({...p,[group.key]:true}));
    setTransactions(p=>p.map(t=>
      group.txIds.includes(t.id)?{...t,category:catLabel,aiClassified:true,ruleClassified:false}:t
    ));
    if(createRule&&catLabel){
      const keyword=group.key.slice(0,30).trim();
      const src=unclassified.find(t=>group.txIds.includes(t.id))?.source||"Efectivo";
      const exists=rules.some(r=>r.keyword.toLowerCase()===keyword.toLowerCase());
      if(!exists) setRules(p=>[{id:Math.random().toString(36).slice(2,9),keyword,category:catLabel,source:src,exact:false,auto:true},...p]);
    }
    setGroups(p=>p.filter(g=>g.key!==group.key));
    showToast(`${group.txIds.length} movimientos clasificados como "${catLabel}"`);
    setApplying(p=>({...p,[group.key]:false}));
  };

  const skipGroup=(key)=>setGroups(p=>p.filter(g=>g.key!==key));

  return(
    <div>
      <div className="sh">
        <div className="sh-title">Clasificación en bloque</div>
        <div className="fg">
          <span style={{fontSize:12,color:"var(--muted)"}}>{unclassified.length} movimientos sin clasificar</span>
          <button className="btn btn-p" onClick={loadSuggestions} disabled={loading||!unclassified.length}>
            {loading?<span className="spin">⟳</span>:"✦"} {groups.length?`Recargar sugerencias`:`Analizar con IA`}
          </button>
        </div>
      </div>

      {!groups.length&&!loading&&(
        <div className="card">
          <div style={{textAlign:"center",padding:"32px 0",color:"var(--muted)"}}>
            <div style={{fontSize:32,marginBottom:10}}>🔖</div>
            <div style={{fontSize:14,marginBottom:8}}>La IA agrupará los movimientos sin clasificar por concepto similar y sugerirá una categoría para cada grupo.</div>
            <div style={{fontSize:12}}>Puedes confirmar, cambiar la categoría o ignorar cada grupo.</div>
          </div>
        </div>
      )}

      {groups.map(group=>{
        const sugCat=group.suggestedCat;
        return(
          <div key={group.key} className="card" style={{marginBottom:10}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>{group.description}</div>
                <div style={{fontSize:12,color:"var(--muted)",marginBottom:8}}>{group.txIds.length} movimiento{group.txIds.length!==1?"s":""}</div>
                {sugCat&&<div style={{display:"inline-flex",alignItems:"center",gap:6,background:"var(--accent-light)",border:"1px solid #93c5fd",borderRadius:8,padding:"4px 10px",fontSize:12,color:"var(--blue)",marginBottom:8}}>
                  <span>✦ IA sugiere:</span><strong>{sugCat.label}</strong><span style={{color:"var(--muted)"}}>({sugCat.fuente})</span>
                </div>}
                <GroupCatSelector allItems={allItems} suggestedIdx={group.suggestedCatIndex}
                  onApply={(catLabel,createRule)=>applyGroup(group,catLabel,createRule)}
                  onSkip={()=>skipGroup(group.key)}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GroupCatSelector({allItems,suggestedIdx,onApply,onSkip}){
  const [sel,setSel]=useState(suggestedIdx!=null?suggestedIdx:"");
  const [createRule,setCreateRule]=useState(true);
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:4}}>
      <select value={sel} onChange={e=>setSel(e.target.value)}
        style={{background:"var(--s2)",border:"1px solid var(--border)",color:"var(--text)",borderRadius:8,padding:"6px 10px",fontSize:12,fontFamily:"var(--ff)",outline:"none",minWidth:200}}>
        <option value="">Seleccionar categoría...</option>
        <optgroup label="Gastos">{[...allItems.filter(i=>i.fuente!=="Ingresos")].sort((a,b)=>a.label.localeCompare(b.label,"es")).map(c=><option key={c.id} value={allItems.indexOf(c)}>{c.label} ({c.fuente})</option>)}</optgroup>
        <optgroup label="Ingresos">{[...allItems.filter(i=>i.fuente==="Ingresos")].sort((a,b)=>a.label.localeCompare(b.label,"es")).map(c=><option key={c.id} value={allItems.indexOf(c)}>{c.label}</option>)}</optgroup>
      </select>
      <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"var(--muted)",cursor:"pointer"}}>
        <input type="checkbox" checked={createRule} onChange={e=>setCreateRule(e.target.checked)}/>
        Crear regla
      </label>
      <button className="btn btn-p btn-sm" disabled={sel===""} onClick={()=>{const cat=allItems[parseInt(sel)];if(cat)onApply(cat.label,createRule);}}>
        ✓ Aplicar
      </button>
      <button className="btn btn-o btn-sm" onClick={onSkip}>Ignorar</button>
    </div>
  );
}

// ── DIVIDIR MOVIMIENTO ────────────────────────────────────────────────────────
function SplitModal({tx,structure,onClose,onSave}){
  const totalAbs=Math.abs(tx.amount);
  const isIncome=tx.amount>0;
  const [parts,setParts]=useState([
    {id:1,description:tx.description,category:tx.category||"",amount:String(totalAbs.toFixed(2)).replace(".",",")},
    {id:2,description:tx.description,category:"",amount:""},
  ]);
  const allGastos=structure.gastos.flatMap(f=>f.grupos.flatMap(g=>g.items));
  const allIngresos=structure.ingresos.flatMap(g=>g.items);

  const setPartField=(id,field,val)=>setParts(p=>p.map(pt=>pt.id===id?{...pt,[field]:val}:pt));
  const addPart=()=>setParts(p=>[...p,{id:Date.now(),description:tx.description,category:"",amount:""}]);
  const removePart=(id)=>setParts(p=>p.filter(pt=>pt.id!==id));

  const parsedParts=parts.map(pt=>({...pt,amountNum:parseSpanishNumber(pt.amount)||0}));
  const sumParts=parsedParts.reduce((s,pt)=>s+pt.amountNum,0);
  const diff=Math.round((totalAbs-sumParts)*100)/100;
  const isValid=Math.abs(diff)<0.01&&parts.every(pt=>pt.description&&parseSpanishNumber(pt.amount)>0);

  const handleSave=()=>{
    const newTxs=parsedParts.map(pt=>({
      ...tx, id:undefined,
      description:pt.description,
      category:pt.category||"",
      amount:isIncome?pt.amountNum:-pt.amountNum,
      aiClassified:false,ruleClassified:false,
      splitFrom:tx.id,
    }));
    onSave(newTxs);
  };

  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:620}}>
        <div className="modal-hdr">
          <div className="modal-title">Dividir movimiento</div>
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>

        <div style={{background:"var(--s2)",borderRadius:8,padding:"10px 13px",marginBottom:16,fontSize:13}}>
          <div style={{fontWeight:600,marginBottom:2}}>{tx.description}</div>
          <div style={{color:"var(--muted)",fontSize:12}}>{fmtDate(tx.date)} · {tx.source} · <span style={{fontWeight:700,color:isIncome?"var(--green)":"var(--red)"}}>{fmt(tx.amount)}</span></div>
        </div>

        {parts.map((pt,i)=>(
          <div key={pt.id} style={{border:"1px solid var(--border)",borderRadius:9,padding:"12px 14px",marginBottom:10,background:"var(--s1)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,alignItems:"center"}}>
              <span style={{fontSize:12,fontWeight:600,color:"var(--muted)"}}>Partida {i+1}</span>
              {parts.length>2&&<button className="btn btn-d btn-sm" style={{padding:"2px 7px"}} onClick={()=>removePart(pt.id)}>✕</button>}
            </div>
            <div className="form-grid">
              <div className="field full">
                <label>Descripción</label>
                <input value={pt.description} onChange={e=>setPartField(pt.id,"description",e.target.value)} placeholder="Descripción..."/>
              </div>
              <div className="field">
                <label>Importe (€)</label>
                <input type="text" inputMode="decimal" value={pt.amount} onChange={e=>setPartField(pt.id,"amount",e.target.value)} placeholder="0,00"/>
              </div>
              <div className="field">
                <label>Categoría</label>
                <select value={pt.category} onChange={e=>setPartField(pt.id,"category",e.target.value)}>
                  <option value="">Sin categoría</option>
                  <optgroup label="Gastos">{[...allGastos].sort((a,b)=>a.label.localeCompare(b.label,"es")).map(c=><option key={c.id} value={c.label}>{c.label}</option>)}</optgroup>
                  <optgroup label="Ingresos">{[...allIngresos].sort((a,b)=>a.label.localeCompare(b.label,"es")).map(c=><option key={c.id} value={c.label}>{c.label}</option>)}</optgroup>
                </select>
              </div>
            </div>
          </div>
        ))}

        <button className="btn btn-o btn-sm" onClick={addPart} style={{marginBottom:14}}>+ Añadir partida</button>

        <div style={{background:Math.abs(diff)<0.01?"var(--green-bg)":"var(--red-bg)",borderRadius:8,padding:"9px 13px",marginBottom:14,display:"flex",justifyContent:"space-between",fontSize:13}}>
          <span>Total asignado: <strong>{fmt(sumParts)}</strong></span>
          <span>Original: <strong>{fmt(totalAbs)}</strong></span>
          <span style={{fontWeight:700,color:Math.abs(diff)<0.01?"var(--green)":"var(--red)"}}>
            {Math.abs(diff)<0.01?"✓ Cuadra":`Diferencia: ${fmt(diff)}`}
          </span>
        </div>

        <div className="divider"/>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
          <button className="btn btn-o" onClick={onClose}>Cancelar</button>
          <button className="btn btn-p" onClick={handleSave} disabled={!isValid}>
            ⊕ Dividir en {parts.length} partidas
          </button>
        </div>
      </div>
    </div>
  );
}

// ── API KEY MODAL ─────────────────────────────────────────────────────────────
function ApiKeyModal({onSave}){
  const [key,setKey]=useState(getApiKey());const [show,setShow]=useState(false);const isNew=!getApiKey();
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}}>
      <div style={{background:"var(--s1)",border:"1px solid var(--border)",borderRadius:14,padding:26,width:"100%",maxWidth:460,boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{fontFamily:"var(--fd)",fontSize:22,marginBottom:6,color:"var(--text)"}}>{isNew?"Bienvenido a FinanzApp 👋":"Configurar API Key"}</div>
        {isNew&&<p style={{fontSize:13,color:"var(--muted)",marginBottom:18,lineHeight:1.7}}>Para usar la <strong>clasificación automática con IA</strong> necesitas una API key de Anthropic.<br/>Consíguela en <strong style={{color:"var(--accent)"}}>console.anthropic.com</strong> — 5$ de crédito dura meses con el uso normal.</p>}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:"var(--muted)",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em",fontWeight:600}}>Tu API Key</div>
          <div style={{display:"flex",gap:8}}>
            <input type={show?"text":"password"} value={key} onChange={e=>setKey(e.target.value)} placeholder="sk-ant-api03-..." style={{flex:1,background:"var(--s2)",border:"1px solid var(--border)",color:"var(--text)",borderRadius:8,padding:"10px 12px",fontFamily:"monospace",fontSize:12,outline:"none"}}/>
            <button className="btn btn-o btn-sm" onClick={()=>setShow(s=>!s)}>{show?"Ocultar":"Ver"}</button>
          </div>
        </div>
        <div style={{fontSize:11,color:"var(--hint)",marginBottom:18,lineHeight:1.6,padding:"8px 12px",background:"var(--s2)",borderRadius:6}}>🔒 La key se guarda solo en este navegador. Solo se envía a la API de Anthropic para clasificar transacciones.</div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
          {!isNew&&<button className="btn btn-o" onClick={()=>onSave(getApiKey())}>Cancelar</button>}
          <button className="btn btn-p" onClick={()=>key.startsWith("sk-")&&onSave(key)} disabled={!key.startsWith("sk-")}>{isNew?"Empezar →":"Guardar"}</button>
        </div>
        {isNew&&<div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)",textAlign:"center"}}><button className="btn btn-o btn-sm" onClick={()=>onSave("")} style={{fontSize:11,color:"var(--muted)"}}>Continuar sin IA (clasificación manual)</button></div>}
      </div>
    </div>
  );
}
