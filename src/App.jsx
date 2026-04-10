import { useState, useEffect, useRef } from "react";

// Storage (localStorage)
const storage = {
  get: (key) => { try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, val); } catch {} },
};
const getApiKey = () => localStorage.getItem("finanzapp_apikey") || "";
const saveApiKey = (k) => localStorage.setItem("finanzapp_apikey", k);


const SOURCES = ["Efectivo", "Santander", "BBVA"];

const STRUCTURE = {
  gastos: [
    {
      fuente: "Efectivo", label: "Gastos Efectivo",
      grupos: [
        { label: "Alimentación y Otros", items: ["Frutería, Pescadería y Carnicería", "Otros Gastos Alimentación"] },
        { label: "Trabajos de Limpieza", items: ["Sueldo Limpieza"] },
        { label: "Ropa", items: ["Ropa y Calzado"] },
        { label: "Otros Gastos Efectivo", items: ["Clases / Academia", "Regalos", "Celebraciones", "Ocio", "Viajes y Vacaciones", "Lavado Coches", "Campamentos", "Pagas Hijos", "Leña", "Peluquería", "Farmacia", "Lotería", "Otros Gastos Efectivo"] },
      ],
    },
    {
      fuente: "Santander", label: "Gastos Santander",
      grupos: [
        { label: "Alimentación Supermercado", items: ["Supermercados", "Pescadería", "Bofrost"] },
        { label: "Seguros", items: ["Seguro de Decesos", "Seguro Móviles"] },
        { label: "Vehículos", items: ["Combustible", "Revisión / Taller", "ITV", "Peaje Autopista"] },
        { label: "Telefonía y TV", items: ["Telefonía + TV", "Spotify", "Netflix", "iCloud", "Dropbox"] },
        { label: "Suministros", items: ["Gas Natural", "Zona Azul (e-Park)"] },
        { label: "Hogar y Comunidad", items: ["Alarma (Prosegur)", "Gimnasio", "Peluquería y Estética", "Comunidad Santander"] },
        { label: "Otros Santander", items: ["Antivirus", "Otros Gastos Santander"] },
      ],
    },
    {
      fuente: "BBVA", label: "Gastos BBVA",
      grupos: [
        { label: "Vivienda", items: ["Préstamo de la Casa", "Seguro de la Casa"] },
        { label: "Seguros BBVA", items: ["Seguro Médico Sanitas", "Seguro de Vida Hipoteca", "Seguro del Vehículo"] },
        { label: "Educación", items: ["Hip Hop / Danza", "Clases de Inglés", "Otras Clases"] },
        { label: "Suministros BBVA", items: ["Electricidad", "Agua"] },
        { label: "Inversión", items: ["Plan de Pensiones", "Impuestos Municipales"] },
        { label: "Otros BBVA", items: ["Otros Gastos BBVA"] },
      ],
    },
  ],
  ingresos: [
    { label: "Ingresos por Nóminas", items: ["Nómina Base", "Productividad / Guardia", "Pagas Extras"] },
    { label: "Otros Ingresos", items: ["Devolución Hacienda", "Otros Ingresos"] },
  ],
};

const ALL_SUBCATS = [
  ...STRUCTURE.gastos.flatMap(f => f.grupos.flatMap(g => g.items.map(i => ({ label: i, fuente: f.fuente, tipo: "gasto" })))),
  ...STRUCTURE.ingresos.flatMap(g => g.items.map(i => ({ label: i, fuente: "Ingresos", tipo: "ingreso" }))),
];

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTHS_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const fmt = (n, compact = false) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (compact && Math.abs(n) >= 1000) return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const currentYM = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };

async function classifyWithAI(transactions) {
  const catList = ALL_SUBCATS.map((c, i) => `${i}:${c.label}(${c.fuente})`).join(", ");
  const prompt = `Eres asistente de finanzas personales español. Clasifica cada transacción en la subcategoría más adecuada:\n${catList}\n\nResponde SOLO con JSON array sin markdown: [{"id":"tx_id","catIndex":número}]\n\nTransacciones:\n${transactions.map(t => `id:${t.id}|"${t.description}"|${t.amount}€`).join("\n")}`;
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json", "x-api-key": getApiKey(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await resp.json();
  const text = (data.content || []).map(b => b.text || "").join("").replace(/```json|```/g, "").trim();
  try { return JSON.parse(text); } catch { return []; }
}

async function extractPDF(base64) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json", "x-api-key": getApiKey(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
      { type: "text", text: 'Extrae TODAS las transacciones bancarias. Responde SOLO con JSON array sin markdown:\n[{"date":"YYYY-MM-DD","description":"texto","amount":número}]\nGastos=negativo, Ingresos=positivo.' }
    ]}] }),
  });
  const data = await resp.json();
  const text = (data.content || []).map(b => b.text || "").join("").replace(/```json|```/g, "").trim();
  try { return JSON.parse(text); } catch { return []; }
}

function parseCSV(text) {
  return text.trim().split(/\r?\n/).slice(1).map(line => {
    const p = line.split(/[;,]/).map(s => s.replace(/"/g, "").trim());
    if (p.length < 3) return null;
    const amount = parseFloat(p[2].replace(",", ".").replace(/[^0-9.-]/g, ""));
    if (isNaN(amount) || !p[1]) return null;
    return { date: p[0] || today(), description: p[1], amount };
  }).filter(Boolean);
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600&family=Playfair+Display:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0f1210;--s1:#161a18;--s2:#1c211f;--s3:#232a27;--border:#2c3330;--border2:#3a4541;--text:#dde8e2;--muted:#7a9088;--hint:#4a5e58;--green:#6fcf97;--red:#eb8c7a;--yellow:#f2c94c;--blue:#74b9e8;--accent2:#3d8b5e;--r:12px;--ff:'Figtree',sans-serif;--fd:'Playfair Display',serif}
body{background:var(--bg);color:var(--text);font-family:var(--ff);font-size:14px;line-height:1.5}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}
.app{min-height:100vh;display:flex;flex-direction:column}
.hdr{background:var(--s1);border-bottom:1px solid var(--border);padding:12px 22px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;gap:10px;flex-wrap:wrap}
.hdr-icon{width:32px;height:32px;border-radius:8px;background:var(--accent2);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;font-weight:600;color:#0a1510}
.hdr-name{font-family:var(--fd);font-size:18px}.hdr-sub{font-size:11px;color:var(--muted)}
.hdr-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.src-tabs{display:flex;gap:3px;background:var(--s2);padding:3px;border-radius:9px;border:1px solid var(--border)}
.src-tab{padding:5px 11px;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;color:var(--muted);border:none;background:transparent;transition:all .15s;font-family:var(--ff)}
.src-tab.active{background:var(--s3);color:var(--text);border:1px solid var(--border2)}
.nav{background:var(--s1);border-bottom:1px solid var(--border);padding:0 22px;display:flex;gap:2px;overflow-x:auto}
.nb{padding:10px 15px;font-size:13px;font-weight:500;color:var(--muted);background:transparent;border:none;border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;transition:all .15s;font-family:var(--ff)}
.nb:hover{color:var(--text)}.nb.active{color:var(--green);border-bottom-color:var(--green)}
.main{flex:1;padding:18px 22px;max-width:1300px;margin:0 auto;width:100%}
@media(max-width:640px){.main{padding:12px}}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
@media(max-width:800px){.kpi-row{grid-template-columns:repeat(2,1fr)}}
@media(max-width:400px){.kpi-row{grid-template-columns:1fr}}
.kpi{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:13px 15px}
.kpi-label{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:5px}
.kpi-val{font-family:var(--fd);font-size:21px}.kpi-val.g{color:var(--green)}.kpi-val.r{color:var(--red)}.kpi-val.y{color:var(--yellow)}.kpi-val.b{color:var(--blue)}
.kpi-sub{font-size:11px;color:var(--hint);margin-top:2px}
.card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:15px}
.card-title{font-family:var(--fd);font-size:15px;margin-bottom:12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:13px}
@media(max-width:700px){.grid2{grid-template-columns:1fr}}
.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid transparent;font-family:var(--ff);transition:all .15s}
.btn-p{background:var(--accent2);color:#0a1510;border-color:var(--accent2)}.btn-p:hover{background:#4aac74}
.btn-o{background:transparent;color:var(--text);border-color:var(--border)}.btn-o:hover{background:var(--s2)}
.btn-d{background:transparent;color:var(--red);border-color:var(--red)}.btn-d:hover{background:rgba(235,140,122,.1)}
.btn-sm{padding:5px 10px;font-size:12px}.btn:disabled{opacity:.4;cursor:not-allowed}
.sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;flex-wrap:wrap;gap:8px}
.sh-title{font-family:var(--fd);font-size:15px}
.fg{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.tx-list{display:flex;flex-direction:column;gap:1px}
.tx-row{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;cursor:pointer;border:1px solid transparent;transition:background .12s}
.tx-row:hover{background:var(--s2);border-color:var(--border)}
.tx-pill{font-size:10px;padding:2px 7px;border-radius:20px;background:var(--s3);color:var(--muted);border:1px solid var(--border);white-space:nowrap;flex-shrink:0}
.tx-src{font-size:10px;padding:2px 6px;border-radius:20px;border:1px solid var(--border2);color:var(--muted);flex-shrink:0}
.tx-desc{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.tx-meta{font-size:11px;color:var(--muted);display:flex;gap:5px;align-items:center;margin-top:2px}
.tx-amt{font-family:var(--fd);font-size:14px;text-align:right;flex-shrink:0}
.tx-amt.g{color:var(--green)}.tx-amt.r{color:var(--red)}
.ai-pill{font-size:10px;padding:2px 6px;border-radius:20px;background:rgba(111,207,151,.12);color:var(--green);border:1px solid rgba(111,207,151,.2)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}
@media(max-width:480px){.form-grid{grid-template-columns:1fr}}
.field{display:flex;flex-direction:column;gap:5px}
.field label{font-size:11px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.06em}
.field input,.field select{background:var(--s2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 11px;font-family:var(--ff);font-size:13px;outline:none;transition:border-color .15s}
.field input:focus,.field select:focus{border-color:var(--accent2)}
.field select option{background:var(--s2)}.full{grid-column:1/-1}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100;padding:14px}
.modal{background:var(--s1);border:1px solid var(--border2);border-radius:15px;padding:22px;width:100%;max-width:530px;max-height:90vh;overflow-y:auto}
.modal-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
.modal-title{font-family:var(--fd);font-size:18px}
.modal-x{background:none;border:none;color:var(--muted);font-size:17px;cursor:pointer;line-height:1;padding:2px}.modal-x:hover{color:var(--text)}
.divider{height:1px;background:var(--border);margin:13px 0}
.drop-zone{border:2px dashed var(--border);border-radius:var(--r);padding:28px;text-align:center;cursor:pointer;transition:all .2s}
.drop-zone:hover,.drop-zone.drag{border-color:var(--accent2);background:rgba(111,207,151,.04)}
.bbar{height:6px;background:var(--s2);border-radius:4px;overflow:hidden}
.bbar-fill{height:100%;border-radius:4px;transition:width .4s ease}
.cmp-wrap{overflow-x:auto}
.cmp-table{width:100%;border-collapse:collapse;font-size:12px}
.cmp-table th{padding:7px 10px;text-align:right;font-weight:500;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border);white-space:nowrap}
.cmp-table th:first-child{text-align:left;width:38%}
.cmp-table td{padding:7px 10px;text-align:right;border-bottom:1px solid var(--border);color:var(--text)}
.cmp-table td:first-child{text-align:left}
.cmp-table tr.frow td{background:var(--s2);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:9px 10px}
.cmp-table tr.grow td{background:var(--s3);font-weight:500;font-size:11px;color:var(--muted);padding:6px 10px}
.cmp-table tr.subtotal td{background:var(--s2);font-weight:600;border-top:1px solid var(--border2)}
.cmp-table tr:hover:not(.frow):not(.grow):not(.subtotal) td{background:rgba(255,255,255,.02)}
.over{color:var(--red)!important}.under{color:var(--green)!important}.neutral{color:var(--hint)!important}
.empty{text-align:center;padding:36px 14px;color:var(--muted)}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.toast{position:fixed;bottom:18px;right:18px;z-index:200;background:var(--s2);border:1px solid var(--border2);border-radius:10px;padding:10px 14px;font-size:13px;display:flex;align-items:center;gap:7px;animation:up .2s ease;box-shadow:0 8px 24px rgba(0,0,0,.4)}
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.sbar{background:var(--s2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 11px;font-size:13px;font-family:var(--ff);outline:none;flex:1;min-width:150px}
.sbar:focus{border-color:var(--accent2)}
.msel{background:var(--s2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 11px;font-size:13px;font-family:var(--ff);outline:none;cursor:pointer}
.msel option{background:var(--s2)}
.acc-hdr{display:flex;align-items:center;justify-content:space-between;padding:9px 13px;background:var(--s2);border-radius:8px;cursor:pointer;border:1px solid var(--border);user-select:none;margin-bottom:6px}
.acc-body{background:var(--s1);border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;padding:6px 0;margin-bottom:10px}
`;

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [source, setSource] = useState("Todos");
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [selMonth, setSelMonth] = useState(currentYM);
  const [modal, setModal] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [toast, setToast] = useState(null);
  const [classifying, setClassifying] = useState(false);

  const [apiKey, setApiKeyState] = useState(getApiKey);
  const [showApiModal, setShowApiModal] = useState(!getApiKey());

  useEffect(() => {
    try {
      const raw = localStorage.getItem("finanzas_v3");
      if (raw) { const d = JSON.parse(raw); if (d.transactions) setTransactions(d.transactions); if (d.budgets) setBudgets(d.budgets); }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("finanzas_v3", JSON.stringify({ transactions, budgets })); } catch {}
  }, [transactions, budgets]);

  const showToast = (msg, icon = "✓") => { setToast({ msg, icon }); setTimeout(() => setToast(null), 3000); };

  const filteredTxs = transactions.filter(t => t.date?.startsWith(selMonth) && (source === "Todos" || t.source === source));
  const income = filteredTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = filteredTxs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const addTx = (tx) => { setTransactions(p => [{ ...tx, id: uid() }, ...p]); showToast("Añadido"); setModal(null); };
  const updateTx = (tx) => { setTransactions(p => p.map(t => t.id === tx.id ? tx : t)); showToast("Guardado"); setModal(null); setEditTx(null); };
  const deleteTx = (id) => { setTransactions(p => p.filter(t => t.id !== id)); showToast("Eliminado", "🗑"); setModal(null); setEditTx(null); };

  const classifyAll = async () => {
    const uncat = transactions.filter(t => !t.category);
    if (!uncat.length) { showToast("Todas clasificadas", "ℹ"); return; }
    setClassifying(true);
    try {
      const res = await classifyWithAI(uncat.slice(0, 40));
      const map = Object.fromEntries(res.map(r => [r.id, r.catIndex]));
      setTransactions(p => p.map(t => {
        if (map[t.id] !== undefined) {
          const cat = ALL_SUBCATS[map[t.id]];
          return { ...t, category: cat?.label || t.category, source: t.source || cat?.fuente || "Efectivo", aiClassified: true };
        }
        return t;
      }));
      showToast(`${res.length} clasificadas con IA`);
    } catch { showToast("Error IA", "✕"); }
    setClassifying(false);
  };

  return (
    <>
      <style>{CSS}</style>
      {showApiModal && (
        <ApiKeyModal
          onSave={(key) => { saveApiKey(key); setApiKeyState(key); setShowApiModal(false); }}
        />
      )}
      <div className="app">
        <header className="hdr">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="hdr-icon">€</div>
            <div><div className="hdr-name">FinanzApp</div><div className="hdr-sub">Gastos domésticos</div></div>
          </div>
          <div className="hdr-right">
            <div className="src-tabs">
              {["Todos", ...SOURCES].map(s => <button key={s} className={`src-tab${source === s ? " active" : ""}`} onClick={() => setSource(s)}>{s}</button>)}
            </div>
            <button className="btn btn-o btn-sm" onClick={() => setShowApiModal(true)} title="Configurar API Key">⚙ API Key</button>
            <select className="msel" value={selMonth} onChange={e => setSelMonth(e.target.value)}>
              {Array.from({ length: 14 }, (_, i) => {
                const d = new Date(); d.setMonth(d.getMonth() - i);
                const v = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
                return <option key={v} value={v}>{MONTHS_FULL[d.getMonth()]} {d.getFullYear()}</option>;
              })}
            </select>
          </div>
        </header>

        <nav className="nav">
          {[["dashboard","Resumen"],["transactions","Movimientos"],["comparison","Presupuesto vs Real"],["budgets","Presupuestos"],["import","Importar"]].map(([id, l]) => (
            <button key={id} className={`nb${tab === id ? " active" : ""}`} onClick={() => setTab(id)}>{l}</button>
          ))}
        </nav>

        <main className="main">
          {tab === "dashboard" && <Dashboard filteredTxs={filteredTxs} income={income} expense={expense} source={source} selMonth={selMonth} transactions={transactions} setTab={setTab} />}
          {tab === "transactions" && <Transactions filteredTxs={filteredTxs} source={source} onAdd={() => setModal("add")} onEdit={tx => { setEditTx(tx); setModal("tx"); }} classifying={classifying} onClassify={classifyAll} />}
          {tab === "comparison" && <Comparison transactions={transactions} budgets={budgets} selMonth={selMonth} source={source} />}
          {tab === "budgets" && <Budgets budgets={budgets} setBudgets={setBudgets} selMonth={selMonth} monthTxs={transactions.filter(t => t.date?.startsWith(selMonth))} showToast={showToast} />}
          {tab === "import" && <Import onImport={txs => { setTransactions(p => [...txs.map(t => ({ ...t, id: uid() })), ...p]); showToast(`${txs.length} importadas`); setTab("transactions"); }} showToast={showToast} />}
        </main>
      </div>

      {modal === "add" && <TxModal onClose={() => setModal(null)} onSave={addTx} />}
      {modal === "tx" && editTx && <TxModal tx={editTx} onClose={() => { setModal(null); setEditTx(null); }} onSave={updateTx} onDelete={() => deleteTx(editTx.id)} />}
      {toast && <div className="toast"><span>{toast.icon}</span>{toast.msg}</div>}
    </>
  );
}

function TxRow({ tx, onClick }) {
  const isIncome = tx.amount > 0;
  return (
    <div className="tx-row" onClick={onClick}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tx-desc">{tx.description}</div>
        <div className="tx-meta">
          {tx.date}
          {tx.source && <span className="tx-src">{tx.source}</span>}
          {tx.aiClassified && <span className="ai-pill">✦ IA</span>}
        </div>
      </div>
      {tx.category && <span className="tx-pill">{tx.category}</span>}
      <div className={`tx-amt ${isIncome ? "g" : "r"}`}>{isIncome ? "+" : "-"}{fmt(Math.abs(tx.amount), true)}</div>
    </div>
  );
}

function Dashboard({ filteredTxs, income, expense, source, selMonth, transactions, setTab }) {
  const balance = income - expense;
  const [y, m] = selMonth.split("-");
  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(parseInt(y), parseInt(m) - 1 - (5 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });
  const trendMax = Math.max(1, ...months6.flatMap(mo => {
    const mTxs = transactions.filter(t => t.date?.startsWith(mo) && (source === "Todos" || t.source === source));
    return [mTxs.filter(t => t.amount > 0).reduce((s,t) => s+t.amount, 0), mTxs.filter(t => t.amount < 0).reduce((s,t) => s+Math.abs(t.amount), 0)];
  }));

  const srcBreakdown = SOURCES.map(s => ({ name: s, exp: transactions.filter(t => t.date?.startsWith(selMonth) && t.source === s && t.amount < 0).reduce((a,t) => a+Math.abs(t.amount), 0) }));
  const maxSrc = Math.max(1, ...srcBreakdown.map(s => s.exp));

  const byCat = {};
  filteredTxs.filter(t => t.amount < 0 && t.category).forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + Math.abs(t.amount); });
  const topCats = Object.entries(byCat).sort((a,b) => b[1]-a[1]).slice(0, 6);
  const totalCatExp = topCats.reduce((s,[,v]) => s+v, 0);

  return (
    <div>
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-label">Ingresos</div><div className="kpi-val g">{fmt(income, true)}</div><div className="kpi-sub">{filteredTxs.filter(t=>t.amount>0).length} mov.</div></div>
        <div className="kpi"><div className="kpi-label">Gastos</div><div className="kpi-val r">{fmt(expense, true)}</div><div className="kpi-sub">{filteredTxs.filter(t=>t.amount<0).length} mov.</div></div>
        <div className="kpi"><div className="kpi-label">Balance</div><div className={`kpi-val ${balance >= 0 ? "g" : "r"}`}>{fmt(balance, true)}</div><div className="kpi-sub">{balance >= 0 ? "Mes positivo" : "Mes en déficit"}</div></div>
        <div className="kpi"><div className="kpi-label">Movimientos</div><div className="kpi-val b">{filteredTxs.length}</div><div className="kpi-sub">{filteredTxs.filter(t=>!t.category).length} sin clasificar</div></div>
      </div>

      <div className="grid2" style={{ marginBottom: 13 }}>
        <div className="card">
          <div className="card-title">Evolución 6 meses</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:5, height:84 }}>
            {months6.map(mo => {
              const mTxs = transactions.filter(t => t.date?.startsWith(mo) && (source==="Todos"||t.source===source));
              const inc = mTxs.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
              const exp = mTxs.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
              const isCur = mo === selMonth;
              return (
                <div key={mo} style={{ flex:1, display:"flex", alignItems:"flex-end", justifyContent:"center", gap:2 }}>
                  <div style={{ width:10, borderRadius:"3px 3px 0 0", height:`${Math.round(inc/trendMax*100)}%`, background:"var(--green)", opacity: isCur?1:.45 }} />
                  <div style={{ width:10, borderRadius:"3px 3px 0 0", height:`${Math.round(exp/trendMax*100)}%`, background:"var(--red)", opacity: isCur?1:.45 }} />
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:5, marginTop:6 }}>
            {months6.map(mo => <div key={mo} style={{ flex:1, textAlign:"center", fontSize:10, color:"var(--muted)" }}>{MONTHS[parseInt(mo.split("-")[1])-1]}</div>)}
          </div>
          <div style={{ display:"flex", gap:12, marginTop:9 }}>
            {[["var(--green)","Ingresos"],["var(--red)","Gastos"]].map(([c,l]) => (
              <span key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"var(--muted)" }}>
                <span style={{ width:7, height:7, borderRadius:2, background:c, display:"inline-block" }} />{l}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Gastos por fuente</div>
          {srcBreakdown.map((s, i) => (
            <div key={s.name} style={{ marginBottom: i < srcBreakdown.length-1 ? 13 : 0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5, fontSize:13 }}>
                <span>{s.name}</span><span style={{ color:"var(--red)" }}>{fmt(s.exp, true)}</span>
              </div>
              <div className="bbar">
                <div className="bbar-fill" style={{ width:`${Math.round(s.exp/maxSrc*100)}%`, background: s.name==="Efectivo"?"var(--yellow)":s.name==="Santander"?"var(--blue)":"var(--green)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {topCats.length > 0 && (
        <div className="card" style={{ marginBottom: 13 }}>
          <div className="card-title">Top categorías del mes</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:9 }}>
            {topCats.map(([cat, amt]) => {
              const pct = totalCatExp > 0 ? Math.round(amt/totalCatExp*100) : 0;
              return (
                <div key={cat} style={{ background:"var(--s2)", borderRadius:9, padding:"9px 11px", border:"1px solid var(--border)" }}>
                  <div style={{ fontSize:12, fontWeight:500, marginBottom:6, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{cat}</div>
                  <div className="bbar" style={{ marginBottom:4 }}><div className="bbar-fill" style={{ width:`${pct}%`, background:"var(--red)" }} /></div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--muted)" }}>
                    <span style={{ color:"var(--red)" }}>{fmt(amt, true)}</span><span>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div className="sh">
          <div className="card-title" style={{ marginBottom:0 }}>Últimos movimientos</div>
          <button className="btn btn-o btn-sm" onClick={() => setTab("transactions")}>Ver todos →</button>
        </div>
        {filteredTxs.length === 0
          ? <div className="empty">Sin movimientos este mes</div>
          : <div className="tx-list">{filteredTxs.slice(0, 8).map(t => <TxRow key={t.id} tx={t} />)}</div>
        }
      </div>
    </div>
  );
}

function Transactions({ filteredTxs, source, onAdd, onEdit, classifying, onClassify }) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("date");

  const shown = filteredTxs
    .filter(t => filterType === "all" || (filterType === "income" ? t.amount > 0 : t.amount < 0))
    .filter(t => !search || t.description?.toLowerCase().includes(search.toLowerCase()) || t.category?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => sortBy === "date" ? b.date?.localeCompare(a.date) : Math.abs(b.amount)-Math.abs(a.amount));

  const uncat = filteredTxs.filter(t => !t.category).length;

  return (
    <div>
      <div className="sh">
        <div className="sh-title">Movimientos{source !== "Todos" ? ` · ${source}` : ""}</div>
        <div className="fg">
          {uncat > 0 && <button className="btn btn-o btn-sm" onClick={onClassify} disabled={classifying}>{classifying ? <span className="spin">⟳</span> : "✦"} Clasificar IA ({uncat})</button>}
          <button className="btn btn-p btn-sm" onClick={onAdd}>+ Añadir</button>
        </div>
      </div>
      <div className="fg" style={{ marginBottom:11 }}>
        <input className="sbar" placeholder="Buscar descripción o categoría..." value={search} onChange={e => setSearch(e.target.value)} />
        {[["all","Todos"],["income","Ingresos"],["expense","Gastos"]].map(([v,l]) => (
          <button key={v} className={`btn btn-sm ${filterType===v?"btn-p":"btn-o"}`} onClick={() => setFilterType(v)}>{l}</button>
        ))}
        <select className="msel" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="date">Por fecha</option><option value="amount">Por importe</option>
        </select>
      </div>
      {shown.length === 0
        ? <div className="empty card">Sin resultados</div>
        : <div className="card" style={{ padding:7 }}><div className="tx-list">{shown.map(t => <TxRow key={t.id} tx={t} onClick={() => onEdit(t)} />)}</div></div>
      }
    </div>
  );
}

function Comparison({ transactions, budgets, selMonth, source }) {
  const [viewSrc, setViewSrc] = useState("Todos");
  useEffect(() => { if (source !== "Todos") setViewSrc(source); }, [source]);

  const getBudget = (label) => budgets[label]?.[selMonth] ?? budgets[label]?.["*"] ?? null;

  const realForCat = (label, isIncome = false) =>
    transactions.filter(t => t.date?.startsWith(selMonth) && t.category === label && (viewSrc === "Todos" || t.source === viewSrc) && (isIncome ? t.amount > 0 : t.amount < 0))
      .reduce((s, t) => s + Math.abs(t.amount), 0);

  const DiffCell = ({ budget, real, incomeDir = false }) => {
    if (budget === null) return <td className="neutral">—</td>;
    const diff = real - budget;
    const isOver = incomeDir ? diff < 0 : diff > 0;
    return <td className={isOver ? "over" : diff === 0 ? "neutral" : "under"}>{diff > 0 ? "+" : ""}{fmt(diff, true)}</td>;
  };

  const PctBar = ({ budget, real }) => {
    if (!budget || budget === 0) return <td />;
    const pct = Math.min(100, Math.round(real / budget * 100));
    const over = real > budget;
    return (
      <td>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div className="bbar" style={{ width:50, display:"inline-block", flexShrink:0 }}>
            <div className="bbar-fill" style={{ width:`${pct}%`, background: over?"var(--red)":"var(--green)" }} />
          </div>
          <span style={{ fontSize:10, color:"var(--muted)" }}>{pct}%</span>
        </div>
      </td>
    );
  };

  const fuentesToShow = viewSrc === "Todos" ? STRUCTURE.gastos : STRUCTURE.gastos.filter(f => f.fuente === viewSrc);
  const [y, m] = selMonth.split("-");

  return (
    <div>
      <div className="sh">
        <div className="sh-title">Presupuesto vs Real — {MONTHS_FULL[parseInt(m)-1]} {y}</div>
        <div className="src-tabs">
          {["Todos",...SOURCES].map(s => <button key={s} className={`src-tab${viewSrc===s?" active":""}`} onClick={() => setViewSrc(s)}>{s}</button>)}
        </div>
      </div>

      <div className="card" style={{ padding:0, overflow:"hidden" }}>
        <div className="cmp-wrap">
          <table className="cmp-table">
            <thead>
              <tr>
                <th style={{ textAlign:"left" }}>Partida</th>
                <th>Presupuesto</th>
                <th>Real</th>
                <th>Diferencia</th>
                <th>Ejecución</th>
              </tr>
            </thead>
            <tbody>
              {fuentesToShow.map(fuente => {
                const fItems = fuente.grupos.flatMap(g => g.items);
                const fReal = fItems.reduce((s,i) => s + realForCat(i), 0);
                const fBudget = fItems.reduce((s,i) => { const b=getBudget(i); return b!==null?s+b:s; }, 0);
                return (
                  <>
                    <tr className="frow" key={fuente.label}>
                      <td colSpan={5} style={{ color: fuente.fuente==="Efectivo"?"var(--yellow)":fuente.fuente==="Santander"?"var(--blue)":"var(--green)" }}>{fuente.label}</td>
                    </tr>
                    {fuente.grupos.map(g => {
                      const gItems = g.items;
                      const gReal = gItems.reduce((s,i) => s+realForCat(i), 0);
                      const gBudget = gItems.reduce((s,i) => { const b=getBudget(i); return b!==null?s+b:s; }, 0);
                      return (
                        <>
                          <tr className="grow" key={g.label}>
                            <td colSpan={5} style={{ paddingLeft:14 }}>{g.label}</td>
                          </tr>
                          {gItems.map(item => {
                            const b = getBudget(item);
                            const r = realForCat(item);
                            return (
                              <tr key={item}>
                                <td style={{ paddingLeft:24, fontSize:12 }}>{item}</td>
                                <td style={{ color:"var(--muted)" }}>{b!==null?fmt(b,true):"—"}</td>
                                <td style={{ color:r>0?"var(--red)":"var(--hint)" }}>{r>0?fmt(r,true):"—"}</td>
                                <DiffCell budget={b} real={r} />
                                <PctBar budget={b} real={r} />
                              </tr>
                            );
                          })}
                          <tr className="subtotal">
                            <td style={{ paddingLeft:14 }}>Subtotal {g.label}</td>
                            <td style={{ color:"var(--muted)" }}>{gBudget>0?fmt(gBudget,true):"—"}</td>
                            <td style={{ color:gReal>0?"var(--red)":"var(--hint)" }}>{gReal>0?fmt(gReal,true):"—"}</td>
                            <DiffCell budget={gBudget>0?gBudget:null} real={gReal} />
                            <PctBar budget={gBudget>0?gBudget:null} real={gReal} />
                          </tr>
                        </>
                      );
                    })}
                    <tr className="subtotal" style={{ borderTop:"2px solid var(--border2)" }}>
                      <td style={{ paddingLeft:10 }}>TOTAL {fuente.label.toUpperCase()}</td>
                      <td style={{ color:"var(--muted)" }}>{fBudget>0?fmt(fBudget,true):"—"}</td>
                      <td style={{ color:"var(--red)" }}>{fReal>0?fmt(fReal,true):"—"}</td>
                      <DiffCell budget={fBudget>0?fBudget:null} real={fReal} />
                      <PctBar budget={fBudget>0?fBudget:null} real={fReal} />
                    </tr>
                  </>
                );
              })}

              {/* Ingresos */}
              <tr className="frow"><td colSpan={5} style={{ color:"var(--green)" }}>Ingresos</td></tr>
              {STRUCTURE.ingresos.map(g => {
                const gReal = g.items.reduce((s,i) => s+realForCat(i,true), 0);
                const gBudget = g.items.reduce((s,i) => { const b=getBudget(i); return b!==null?s+b:s; }, 0);
                return (
                  <>
                    <tr className="grow" key={g.label}><td colSpan={5} style={{ paddingLeft:14 }}>{g.label}</td></tr>
                    {g.items.map(item => {
                      const b=getBudget(item); const r=realForCat(item,true);
                      return (
                        <tr key={item}>
                          <td style={{ paddingLeft:24, fontSize:12 }}>{item}</td>
                          <td style={{ color:"var(--muted)" }}>{b!==null?fmt(b,true):"—"}</td>
                          <td style={{ color:r>0?"var(--green)":"var(--hint)" }}>{r>0?fmt(r,true):"—"}</td>
                          <DiffCell budget={b} real={r} incomeDir />
                          <PctBar budget={b} real={r} />
                        </tr>
                      );
                    })}
                    <tr className="subtotal">
                      <td style={{ paddingLeft:14 }}>Subtotal {g.label}</td>
                      <td style={{ color:"var(--muted)" }}>{gBudget>0?fmt(gBudget,true):"—"}</td>
                      <td style={{ color:"var(--green)" }}>{gReal>0?fmt(gReal,true):"—"}</td>
                      <DiffCell budget={gBudget>0?gBudget:null} real={gReal} incomeDir />
                      <PctBar budget={gBudget>0?gBudget:null} real={gReal} />
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Budgets({ budgets, setBudgets, selMonth, monthTxs, showToast }) {
  const [local, setLocal] = useState(() => JSON.parse(JSON.stringify(budgets)));
  const [mode, setMode] = useState("monthly");
  const [open, setOpen] = useState(null);

  const setVal = (label, val) => {
    setLocal(prev => {
      const key = mode === "annual" ? "*" : selMonth;
      if (!val || val === "") {
        const next = { ...prev };
        if (next[label]) { const { [key]: _, ...rest } = next[label]; next[label] = rest; if (!Object.keys(next[label]).length) delete next[label]; }
        return next;
      }
      return { ...prev, [label]: { ...(prev[label]||{}), [key]: parseFloat(val) } };
    });
  };

  const getVal = (label) => {
    const e = local[label];
    if (!e) return "";
    const key = mode === "annual" ? "*" : selMonth;
    return e[key] ?? e["*"] ?? "";
  };

  const save = () => { setBudgets(local); showToast("Presupuestos guardados"); };

  const renderSection = (title, grupos, color) => {
    const isOpen = open === title;
    return (
      <div key={title}>
        <div className="acc-hdr" onClick={() => setOpen(isOpen ? null : title)}>
          <span style={{ fontWeight:500, fontSize:13, color }}>{title}</span>
          <span style={{ color:"var(--hint)", fontSize:11 }}>{isOpen ? "▲" : "▼"}</span>
        </div>
        {isOpen && (
          <div className="acc-body">
            {grupos.map(g => (
              <div key={g.label}>
                <div style={{ padding:"5px 13px", fontSize:11, fontWeight:600, color:"var(--hint)", textTransform:"uppercase", letterSpacing:".06em" }}>{g.label}</div>
                {g.items.map(item => {
                  const real = monthTxs.filter(t => t.category === item).reduce((s,t) => s+Math.abs(t.amount), 0);
                  return (
                    <div key={item} style={{ display:"flex", alignItems:"center", gap:9, padding:"5px 13px 5px 22px" }}>
                      <span style={{ flex:1, fontSize:12 }}>{item}</span>
                      {real > 0 && <span style={{ fontSize:11, color:"var(--muted)" }}>Real: {fmt(real,true)}</span>}
                      <input type="number" min="0" step="10" value={getVal(item)} onChange={e => setVal(item, e.target.value)} placeholder="—"
                        style={{ width:95, background:"var(--s2)", border:"1px solid var(--border)", color:"var(--text)", borderRadius:7, padding:"4px 8px", fontSize:12, fontFamily:"var(--ff)", outline:"none", textAlign:"right" }} />
                      <span style={{ fontSize:11, color:"var(--hint)", width:10 }}>€</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="sh">
        <div className="sh-title">Configurar presupuestos</div>
        <div className="fg">
          <div className="src-tabs">
            <button className={`src-tab${mode==="monthly"?" active":""}`} onClick={() => setMode("monthly")}>Este mes</button>
            <button className={`src-tab${mode==="annual"?" active":""}`} onClick={() => setMode("annual")}>Todos los meses</button>
          </div>
          <button className="btn btn-p btn-sm" onClick={save}>Guardar</button>
        </div>
      </div>
      <div style={{ fontSize:12, color:"var(--muted)", marginBottom:13 }}>
        {mode==="annual" ? "Los valores anuales se aplican a todos los meses. Puedes sobreescribirlos mes a mes." : `Presupuesto específico para ${MONTHS_FULL[parseInt(selMonth.split("-")[1])-1]} ${selMonth.split("-")[0]}.`}
      </div>
      {STRUCTURE.gastos.map(f => renderSection(f.label, f.grupos, f.fuente==="Efectivo"?"var(--yellow)":f.fuente==="Santander"?"var(--blue)":"var(--green)"))}
      {renderSection("Ingresos", STRUCTURE.ingresos, "var(--green)")};
      <div style={{ display:"flex", justifyContent:"flex-end", marginTop:14 }}>
        <button className="btn btn-p" onClick={save}>Guardar presupuestos</button>
      </div>
    </div>
  );
}

function Import({ onImport, showToast }) {
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState([]);
  const [previewSrc, setPreviewSrc] = useState("Efectivo");
  const fileRef = useRef();

  const processFile = async (file) => {
    setProcessing(true); setPreview([]);
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      let raw = [];
      if (ext === "csv") {
        raw = parseCSV(await file.text());
      } else if (ext === "pdf") {
        const b64 = await new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
        raw = await extractPDF(b64);
      } else if (ext === "xlsx" || ext === "xls") {
        const { read, utils } = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
        const wb = read(await file.arrayBuffer());
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = utils.sheet_to_json(ws, { header:1 });
        raw = rows.slice(1).map(r => {
          if (r.length < 3) return null;
          const amt = parseFloat(String(r[2]).replace(",",".").replace(/[^0-9.-]/g,""));
          if (isNaN(amt)||!r[1]) return null;
          let date = String(r[0]||"");
          if (typeof r[0]==="number") { const d=new Date(Math.round((r[0]-25569)*86400*1000)); date=d.toISOString().slice(0,10); }
          return { date: date.slice(0,10)||today(), description:String(r[1]), amount:amt };
        }).filter(Boolean);
      } else { showToast("Formato no soportado","✕"); }
      setPreview(raw);
    } catch(e) { showToast("Error: "+e.message,"✕"); }
    setProcessing(false);
  };

  return (
    <div>
      <div className="sh-title" style={{ fontFamily:"var(--fd)", fontSize:15, marginBottom:13 }}>Importar extracto bancario</div>
      <div className="card" style={{ marginBottom:13 }}>
        <div className="fg" style={{ marginBottom:13 }}>
          <span style={{ fontSize:13 }}>Cuenta:</span>
          <div className="src-tabs">{SOURCES.map(s => <button key={s} className={`src-tab${previewSrc===s?" active":""}`} onClick={() => setPreviewSrc(s)}>{s}</button>)}</div>
        </div>
        <div className={`drop-zone${dragging?" drag":""}`}
          onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
          onDrop={e=>{e.preventDefault();setDragging(false);if(e.dataTransfer.files[0])processFile(e.dataTransfer.files[0]);}}
          onClick={()=>fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".csv,.pdf,.xlsx,.xls" style={{display:"none"}} onChange={e=>e.target.files[0]&&processFile(e.target.files[0])} />
          {processing
            ? <><div style={{ fontSize:28, marginBottom:8 }} className="spin">⟳</div><div style={{fontSize:13}}>Procesando con IA...</div></>
            : <><div style={{ fontSize:28, marginBottom:8 }}>↑</div><div style={{fontSize:13,marginBottom:3}}>Arrastra el extracto aquí o haz clic</div><div style={{fontSize:11,color:"var(--muted)"}}>PDF · CSV · Excel — Cuenta: {previewSrc}</div></>
          }
        </div>
      </div>

      <div className="card" style={{ marginBottom:13 }}>
        <div className="card-title">Formatos</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:9 }}>
          {[["PDF","La IA extrae automáticamente todas las líneas del extracto"],["CSV","Columnas: Fecha; Descripción; Importe"],["Excel","Columnas: Fecha | Descripción | Importe"]].map(([n,d]) => (
            <div key={n} style={{ background:"var(--s2)", borderRadius:8, padding:"10px 11px", border:"1px solid var(--border)" }}>
              <div style={{ fontWeight:600, fontSize:12, marginBottom:3 }}>{n}</div>
              <div style={{ fontSize:11, color:"var(--muted)" }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      {preview.length > 0 && (
        <div className="card">
          <div className="sh">
            <div className="card-title" style={{marginBottom:0}}>Vista previa — {preview.length} transacciones · {previewSrc}</div>
            <div className="fg">
              <button className="btn btn-o btn-sm" onClick={()=>setPreview([])}>Cancelar</button>
              <button className="btn btn-p btn-sm" onClick={()=>onImport(preview.map(t=>({...t,source:previewSrc})))}>Importar todo →</button>
            </div>
          </div>
          <div className="tx-list">
            {preview.slice(0,25).map((t,i) => (
              <div key={i} className="tx-row">
                <div style={{flex:1,minWidth:0}}><div className="tx-desc">{t.description}</div><div className="tx-meta">{t.date}</div></div>
                <div className={`tx-amt ${t.amount>=0?"g":"r"}`}>{t.amount>=0?"+":""}{fmt(t.amount,true)}</div>
              </div>
            ))}
            {preview.length>25&&<div style={{textAlign:"center",padding:9,color:"var(--muted)",fontSize:12}}>…y {preview.length-25} más</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function TxModal({ tx, onClose, onSave, onDelete }) {
  const isEdit = !!tx;
  const [form, setForm] = useState({
    date: tx?.date||today(), description: tx?.description||"", amount: tx?Math.abs(tx.amount):"",
    type: tx?(tx.amount>=0?"ingreso":"gasto"):"gasto", source: tx?.source||"Efectivo", category: tx?.category||"", notes: tx?.notes||"",
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const availableCats = form.type==="ingreso" ? STRUCTURE.ingresos.flatMap(g=>g.items) : STRUCTURE.gastos.flatMap(f=>f.grupos.flatMap(g=>g.items));
  const handleSave = () => {
    if (!form.description||!form.amount) return;
    const amt = parseFloat(form.amount);
    onSave({...(tx||{}),...form, amount: form.type==="ingreso"?Math.abs(amt):-Math.abs(amt), aiClassified:false});
  };
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-hdr"><div className="modal-title">{isEdit?"Editar movimiento":"Nuevo movimiento"}</div><button className="modal-x" onClick={onClose}>✕</button></div>
        <div className="fg" style={{marginBottom:15}}>
          {[["gasto","Gasto"],["ingreso","Ingreso"]].map(([v,l]) => <button key={v} className={`btn btn-sm ${form.type===v?"btn-p":"btn-o"}`} style={{flex:1}} onClick={()=>set("type",v)}>{l}</button>)}
        </div>
        <div className="form-grid">
          <div className="field full"><label>Descripción *</label><input value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Ej: Supermercado" /></div>
          <div className="field"><label>Importe (€) *</label><input type="number" min="0" step="0.01" value={form.amount} onChange={e=>set("amount",e.target.value)} placeholder="0.00" /></div>
          <div className="field"><label>Fecha</label><input type="date" value={form.date} onChange={e=>set("date",e.target.value)} /></div>
          <div className="field"><label>Fuente</label>
            <select value={form.source} onChange={e=>set("source",e.target.value)}>{SOURCES.map(s=><option key={s} value={s}>{s}</option>)}</select>
          </div>
          <div className="field"><label>Categoría</label>
            <select value={form.category} onChange={e=>set("category",e.target.value)}>
              <option value="">Sin categoría</option>
              {availableCats.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field full"><label>Notas</label><input value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Opcional..." /></div>
        </div>
        <div className="divider" />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>{isEdit&&onDelete&&<button className="btn btn-d btn-sm" onClick={onDelete}>Eliminar</button>}</div>
          <div className="fg">
            <button className="btn btn-o" onClick={onClose}>Cancelar</button>
            <button className="btn btn-p" onClick={handleSave} disabled={!form.description||!form.amount}>{isEdit?"Guardar":"Añadir"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── API KEY MODAL ──────────────────────────────────────────────────────────────
function ApiKeyModal({ onSave }) {
  const [key, setKey] = useState(getApiKey());
  const [show, setShow] = useState(false);
  const isNew = !getApiKey();
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:16 }}>
      <div style={{ background:"var(--s1)", border:"1px solid var(--border2)", borderRadius:15, padding:26, width:"100%", maxWidth:480 }}>
        <div style={{ fontFamily:"var(--fd)", fontSize:20, marginBottom:8 }}>
          {isNew ? "Bienvenido a FinanzApp" : "API Key de Anthropic"}
        </div>
        {isNew && <p style={{ fontSize:13, color:"var(--muted)", marginBottom:16, lineHeight:1.6 }}>
          Para usar la clasificación automática con IA necesitas una API key de Anthropic.<br/>
          Consíguela gratis en <strong style={{color:"var(--text)"}}>console.anthropic.com</strong> (5$ de crédito inicial dura meses).
        </p>}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, color:"var(--muted)", marginBottom:6, textTransform:"uppercase", letterSpacing:".06em" }}>Tu API Key</div>
          <div style={{ display:"flex", gap:8 }}>
            <input
              type={show ? "text" : "password"}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="sk-ant-api03-..."
              style={{ flex:1, background:"var(--s2)", border:"1px solid var(--border)", color:"var(--text)", borderRadius:8, padding:"9px 12px", fontFamily:"monospace", fontSize:12, outline:"none" }}
            />
            <button className="btn btn-o btn-sm" onClick={() => setShow(s => !s)}>{show ? "Ocultar" : "Ver"}</button>
          </div>
        </div>
        <div style={{ fontSize:11, color:"var(--hint)", marginBottom:18, lineHeight:1.5 }}>
          🔒 La key se guarda solo en este navegador (localStorage). Nunca se envía a ningún servidor externo salvo a la API de Anthropic para clasificar transacciones.
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          {!isNew && <button className="btn btn-o" onClick={() => onSave(getApiKey())}>Cancelar</button>}
          <button className="btn btn-p" onClick={() => key.startsWith("sk-") && onSave(key)} disabled={!key.startsWith("sk-")}>
            {isNew ? "Empezar" : "Guardar"}
          </button>
        </div>
        {isNew && (
          <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid var(--border)" }}>
            <button className="btn btn-o btn-sm" onClick={() => onSave("")} style={{ fontSize:11, color:"var(--hint)" }}>
              Continuar sin IA (clasificación manual)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
