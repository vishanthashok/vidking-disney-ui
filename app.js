// Credora Demo Dashboard (no dependencies) + Netlify scoring demo integration

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const state = {
  range: 7,
  data: []
};

/* --------------------------
   Formatting helpers
-------------------------- */
function pad(n){ return String(n).padStart(2, "0"); }

function formatDate(d){
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function fmtInt(n){
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPct(x){
  const safe = Number.isFinite(x) ? x : 0;
  return `${safe.toFixed(2)}%`;
}

function pctChange(curr, prev){
  if (!Number.isFinite(curr)) curr = 0;
  if (!Number.isFinite(prev) || prev <= 0) return 100;
  return ((curr - prev) / prev) * 100;
}

function setDelta(el, value){
  if (!el) return;
  const rounded = Math.abs(value) < 0.01 ? 0 : value;
  el.classList.remove("up","down");
  el.classList.add(rounded >= 0 ? "up" : "down");
  el.textContent = `${rounded >= 0 ? "▲" : "▼"} ${Math.abs(rounded).toFixed(1)}%`;
}

/* --------------------------
   Demo data generation
-------------------------- */
function randomAround(base, variance){
  const delta = (Math.random() * 2 - 1) * variance;
  return Math.max(0, Math.round(base + delta));
}

// Generates sample daily data for N days
function generateData(days){
  const out = [];
  const now = new Date();

  // base curves (so it looks like growth)
  let visitsBase = 220;
  let signupsBase = 18;
  let leadsBase = 2;

  for (let i = days - 1; i >= 0; i--){
    const d = new Date(now);
    d.setDate(now.getDate() - i);

    // gentle growth
    visitsBase *= 1.018;
    signupsBase *= 1.025;

    const visits = randomAround(visitsBase, 40);
    const signups = randomAround(signupsBase, 6);
    const leads = randomAround(leadsBase + (i % 6 === 0 ? 1 : 0), 2);

    const conversion = visits > 0 ? (signups / visits) * 100 : 0;

    out.push({
      date: formatDate(d),
      visits,
      signups,
      leads,
      conversion
    });
  }

  return out;
}

/* --------------------------
   Chart drawing (Canvas)
-------------------------- */
function drawChart(canvas, seriesA, seriesB){
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  // Clear
  ctx.clearRect(0,0,W,H);

  // Scale with padding
  const padX = 48;
  const padY = 28;

  const maxY = Math.max(
    ...seriesA.map(d => d.y),
    ...seriesB.map(d => d.y)
  );

  const minY = 0;

  const xStep = (W - padX*2) / (seriesA.length - 1 || 1);
  const yScale = (H - padY*2) / (maxY - minY || 1);

  // Background grid
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;

  const gridLines = 4;
  for (let i=0;i<=gridLines;i++){
    const y = padY + ((H - padY*2) * i / gridLines);
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
  }
  ctx.restore();

  // Helper to map points
  const toXY = (i, yVal) => {
    const x = padX + i * xStep;
    const y = H - padY - ((yVal - minY) * yScale);
    return {x,y};
  };

  // Axis labels (right-aligned minimal)
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "12px Inter, system-ui";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i=0;i<=gridLines;i++){
    const value = Math.round(maxY - (maxY * i / gridLines));
    const y = padY + ((H - padY*2) * i / gridLines);
    ctx.fillText(String(value), padX - 10, y);
  }
  ctx.restore();

  // Line function
  function plot(series, stroke){
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.6;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Glow
    ctx.shadowColor = stroke;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    series.forEach((p, i) => {
      const {x,y} = toXY(i, p.y);
      if (i === 0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    });
    ctx.stroke();

    // Points
    ctx.shadowBlur = 0;
    ctx.fillStyle = stroke;
    series.forEach((p, i) => {
      const {x,y} = toXY(i, p.y);
      ctx.beginPath();
      ctx.arc(x, y, 3.3, 0, Math.PI*2);
      ctx.fill();
    });

    ctx.restore();
  }

  // Colors match legend CSS vibe
  plot(seriesA, "rgba(34,211,238,0.95)");   // visits
  plot(seriesB, "rgba(124,92,255,0.95)");   // waitlist
}

/* --------------------------
   Table + KPI calculations
-------------------------- */
function updateTable(rows){
  const tbody = $("#tableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  rows.slice().reverse().forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td class="num">${fmtInt(r.visits)}</td>
      <td class="num">${fmtInt(r.signups)}</td>
      <td class="num">${fmtInt(r.leads)}</td>
      <td class="num">${fmtPct(r.conversion)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function sum(arr, key){
  return arr.reduce((acc, x) => acc + (x[key] || 0), 0);
}

function updateKPIs(range){
  const data = state.data.slice(-range);
  const prev = state.data.slice(-(range*2), -range);

  const signups = sum(data, "signups");
  const visits  = sum(data, "visits");
  const leads   = sum(data, "leads");
  const conv    = visits > 0 ? (signups / visits) * 100 : 0;

  const signupsPrev = sum(prev, "signups");
  const visitsPrev  = sum(prev, "visits");
  const leadsPrev   = sum(prev, "leads");
  const convPrev    = visitsPrev > 0 ? (signupsPrev / visitsPrev) * 100 : 0;

  const elSignups = $("#kpiSignups");
  const elVisits  = $("#kpiVisits");
  const elLeads   = $("#kpiLeads");
  const elConv    = $("#kpiConversion");

  if (elSignups) elSignups.textContent = fmtInt(signups);
  if (elVisits)  elVisits.textContent  = fmtInt(visits);
  if (elLeads)   elLeads.textContent   = fmtInt(leads);
  if (elConv)    elConv.textContent    = fmtPct(conv);

  setDelta($("#deltaSignups"), pctChange(signups, signupsPrev));
  setDelta($("#deltaVisits"), pctChange(visits, visitsPrev));
  setDelta($("#deltaLeads"), pctChange(leads, leadsPrev));
  setDelta($("#deltaConversion"), pctChange(conv, convPrev));
}

function updateChart(range){
  const canvas = $("#chart");
  if (!canvas) return;

  const data = state.data.slice(-range);
  if (data.length === 0) return;

  const maxVisits  = Math.max(...data.map(d => d.visits));
  const maxSignups = Math.max(...data.map(d => d.signups));

  // Put them on roughly comparable scale by normalizing signups up to visits range
  const scale = maxSignups > 0 ? (maxVisits / maxSignups) : 1;

  const seriesVisits   = data.map(d => ({ x: d.date, y: d.visits }));
  const seriesWaitlist = data.map(d => ({ x: d.date, y: Math.round(d.signups * scale) }));

  drawChart(canvas, seriesVisits, seriesWaitlist);
}

function setLastUpdated(){
  const el = $("#lastUpdated");
  if (!el) return;

  const d = new Date();
  const t = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  el.textContent = `${formatDate(d)} ${t}`;
}

function setRange(range){
  state.range = range;
  updateKPIs(range);
  updateChart(range);
  updateTable(state.data.slice(-range));
  setLastUpdated();
}

/* --------------------------
   Netlify scorer integration
-------------------------- */
async function getDemoScore(features) {
  const res = await fetch("/.netlify/functions/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(features)
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Score request failed");
  }
  return await res.json();
}

function renderScoreResult(result){
  const out = $("#scoreOut");
  if (!out) return;

  const reasonList = Array.isArray(result.reasonCodes)
    ? result.reasonCodes.map(code => `<li><code>${code}</code></li>`).join("")
    : "";

  const attrs = result.attributes || {};
  const attrRows = Object.entries(attrs).map(([k,v]) => {
    const pct = Math.round((Number(v) || 0) * 100);
    return `
      <div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-top:1px solid rgba(255,255,255,.10)">
        <span style="color:rgba(255,255,255,.70);font-size:12px;text-transform:capitalize">${k.replaceAll("_"," ")}</span>
        <strong style="font-size:12px">${pct}%</strong>
      </div>
    `;
  }).join("");

  out.innerHTML = `
    <div style="padding:14px">
      <h3 style="margin:0 0 6px; font-size:16px">
        Credora Score: <span style="font-size:22px">${result.score}</span>
        <span style="color:rgba(255,255,255,.70); font-weight:600">(${result.score_band})</span>
      </h3>
      <p style="margin:0 0 10px; color:rgba(255,255,255,.70); font-size:12px">${result.disclaimer || ""}</p>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px">
        <div style="border:1px solid rgba(255,255,255,.10); background:rgba(0,0,0,.12); border-radius:16px; padding:12px">
          <div style="font-weight:800; font-size:13px; margin-bottom:6px">Risk attributes (demo)</div>
          ${attrRows || `<div style="color:rgba(255,255,255,.70);font-size:12px">No attributes</div>`}
        </div>

        <div style="border:1px solid rgba(255,255,255,.10); background:rgba(0,0,0,.12); border-radius:16px; padding:12px">
          <div style="font-weight:800; font-size:13px; margin-bottom:6px">Reason codes</div>
          ${reasonList ? `<ul style="margin:0; padding-left:18px; color:rgba(255,255,255,.75); font-size:12px">${reasonList}</ul>`
                       : `<div style="color:rgba(255,255,255,.70);font-size:12px">No reason codes</div>`}
        </div>
      </div>

      <details style="margin-top:10px">
        <summary style="cursor:pointer; color:rgba(255,255,255,.70); font-size:12px">Raw response</summary>
        <pre style="margin:10px 0 0; white-space:pre-wrap; background:rgba(0,0,0,.18); border:1px solid rgba(255,255,255,.10); padding:10px; border-radius:12px; overflow:auto">${escapeHtml(JSON.stringify(result, null, 2))}</pre>
      </details>
    </div>
  `;
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function wireGenerateScore(){
  const btn = $("#generateBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const out = $("#scoreOut");
    try {
      if (out) {
        out.innerHTML = `<div style="padding:14px;color:rgba(255,255,255,.70)">Generating demo score…</div>`;
      }

      // Example demo inputs (replace with your form values)
      const features = {
        bank_monthly_income: 5200,
        bank_monthly_spend: 4100,
        bank_balance_volatility: 0.28,
        utilities_on_time_rate: 0.92,
        remittance_consistency: 0.70,
        country_group: "global"
      };

      const result = await getDemoScore(features);
      renderScoreResult(result);
    } catch (err) {
      if (out) out.textContent = "Error: " + (err?.message || String(err));
    }
  });
}

/* --------------------------
   UI wiring
-------------------------- */
function wireUI(){
  // Range selector
  $$(".seg").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".seg").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      setRange(Number(btn.dataset.range));
    });
  });

  // Refresh button
  const refresh = $("#refreshBtn");
  if (refresh) {
    refresh.addEventListener("click", () => {
      // regenerate data so it feels like a refresh
      state.data = generateData(60);
      setRange(state.range);

      // small status pulse
      const pill = $("#statusPill");
      if (pill?.animate) {
        pill.animate(
          [{ transform: "translateY(0)" }, { transform: "translateY(-2px)" }, { transform: "translateY(0)" }],
          { duration: 320, easing: "ease-out" }
        );
      }
    });
  }

  // Generate score button (Netlify function)
  wireGenerateScore();
}

/* --------------------------
   Init
-------------------------- */
function init(){
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  state.data = generateData(60);
  wireUI();
  setRange(state.range);
}

init();
