// 作品鑑賞帳 ホーム画面アプリ版の画面プログラム。Apps Script の Client.gs と同じ中身（直したら両方に反映する）
// ===== 作品鑑賞帳: 画面（ブラウザ側）のプログラム =====
// このファイルの clientMain() の中身は、サーバーでは実行されない。Index.html（殻）が getClientJs()（Core.gs）経由で
// この関数のソース文字列を受け取り、利用者のブラウザで実行する。だから中身は「ブラウザのJavaScript」として書く
// （document や google.script.run が使える。Apps Script のサーバー用の関数は直接は呼べず、rpc("関数名", ...) 経由で呼ぶ）。
// 注意: 関数の外にコードを足さないこと。足した分は画面には届かない。
function clientMain() {

// ===== うちのAI作品帳 =====
// データはすべてスプレッドシート「作品鑑賞帳 - データベース」にある（Apps Script 経由で読み書き）。
//   works/*          作品（status: watched / queue / following / waiting / dropped）
//   profile/taste    好み（traits[]: 好みの傾向、learned[]: AIが学んだこと）
const app = document.getElementById("app");
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const $ = s => document.querySelector(s);
const now = () => new Date().toISOString();
const isEnter = e => e.key === "Enter" && !e.isComposing && e.keyCode !== 229;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const KINDS = [["anime", "アニメ"], ["drama", "ドラマ"], ["movie", "映画"], ["manga", "漫画"], ["book", "本"], ["other", "その他"]];
const KL = Object.fromEntries(KINDS);
const STATUS = [["watched", "見た・読んだ"], ["queue", "観たい・読みたい"], ["following", "追いかけ中"], ["waiting", "リリース待ち"], ["dropped", "中断"]];
const SL = Object.fromEntries(STATUS);
// 作品名をタップするとブラウザの新しいタブで検索する
const KW = { anime: "アニメ", drama: "ドラマ", movie: "映画", manga: "漫画", book: "本" };
const searchUrl = (t, k) => "https://www.google.com/search?q=" + encodeURIComponent(t + (KW[k] ? " " + KW[k] : ""));
const fmUrl = (t, k) => `https://filmarks.com/search/${k === "drama" ? "dramas" : k === "movie" ? "movies" : "animes"}?q=${encodeURIComponent(t)}`;
const fmTag = (t, k, s) => s != null && s !== "" ? `<a class="ext fm" href="${esc(fmUrl(t, k))}" target="_blank" rel="noopener noreferrer">Filmarks ★${Number(s).toFixed(1)}</a>` : "";
// 見る場所のリンク: Netflix → Hulu → TVer → ABEMA の優先順で、見られるサービスのうち1つだけ出す。ただし他より早く見られるサービス（first）があれば、それを優先する。
//   avail: ["netflix","hulu","tver","abema"] の見られるサービス、first: 最速のサービス、links: {netflix,hulu,tver} 作品ページのURL（無ければサービス内の検索ページ）
const SVC = {
  netflix: { label: "Netflix", url: t => "https://www.netflix.com/search?q=" + encodeURIComponent(t) },
  hulu: { label: "Hulu", url: t => "https://www.hulu.jp/search?q=" + encodeURIComponent(t) },
  tver: { label: "TVer", url: t => "https://tver.jp/search/" + encodeURIComponent(t) },
  abema: { label: "ABEMA", url: t => "https://abema.tv/search?q=" + encodeURIComponent(t) }
};
const SVC_ORDER = ["netflix", "hulu", "tver", "abema"];
const cleanQ = t => String(t || "").replace(/[【\[（(][^】\]）)]*[】\]）)]/g, "").trim() || String(t || "");
function availOf(e) { if (Array.isArray(e.avail) && e.avail.length) return e.avail; const s = String(e.service || ""); return SVC_ORDER.filter(k => new RegExp(SVC[k].label, "i").test(s)); }
function pickSvc(e) { const av = availOf(e); if (e.first && av.includes(e.first)) return e.first; return SVC_ORDER.find(k => av.includes(k)) || null; }
function watchLink(e) {
  const k = pickSvc(e); if (!k) return "";
  const href = (e.links && e.links[k]) || SVC[k].url(cleanQ(e.title));
  return `<a class="watch" href="${esc(href)}" target="_blank" rel="noopener noreferrer">▶ ${SVC[k].label}で見る</a>${e.first === k && availOf(e).length > 1 ? `<span class="fastb">最速</span>` : ""}`;
}
const whenText = e => { const k = pickSvc(e), w = k && e.when && e.when[k]; return w ? `<span class="whenb">${esc(w)}</span>` : ""; };
const tlink = (t, k) => `<a class="ext" href="${esc(searchUrl(t, k))}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`;
const num = v => { const n = parseFloat(v); return isNaN(n) ? null : Math.round(Math.min(5, Math.max(0, n)) * 10) / 10; };
const TABS = [["", "追いかけ"], ["rec", "記録"], ["queue", "観たい"], ["chat", "相談"]];
// 下のタブのアイコン（線画）
const TAB_ICON = {
  "": `<rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M10.5 8.5v5l4-2.5Z"/><path d="M8 20h8"/>`,
  rec: `<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z"/>`,
  queue: `<path d="M6.5 3.5h11v17L12 16.5l-5.5 4Z"/>`,
  taste: `<path d="M12 20s-7-4.4-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.6 12 20 12 20Z"/>`,
  chat: `<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16.1A2.5 2.5 0 0 1 4 13.5Z"/>`
};
const tabsHtml = a => `<nav class="tabs">${TABS.map(([h, l]) => `<button type="button" data-tab="${h}" ${a === h ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${TAB_ICON[h]}</svg><span>${l}</span></button>`).join("")}</nav>`;
const bindTabs = () => { app.querySelectorAll(".tabs button").forEach(b => b.onclick = () => { location.hash = b.dataset.tab; }); const rb = $("#refreshBtn"); if (rb) rb.onclick = runRefresh; };
// 右上に「自動更新」の日時（毎日の自動確認で最後に更新した日時）を出す
function syncHtml() {
  const t = refreshInfo && Date.parse(refreshInfo.lastRunAt || "");
  if (!t) return `<span class="syncd stale" id="syncd">自動更新 未実施</span>`;
  const d = new Date(t), sod = x => { const y = new Date(x); y.setHours(0, 0, 0, 0); return y.getTime(); };
  const diff = Math.round((sod(Date.now()) - sod(t)) / 864e5);
  const day = diff <= 0 ? "今日" : diff === 1 ? "昨日" : `${d.getMonth() + 1}/${d.getDate()}（${diff}日前）`;
  return `<span class="syncd ${diff >= 2 ? "stale" : ""}" id="syncd" title="最新話・★を最後に確認した日時">自動更新 ${day} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}</span>`;
}
// タイトルは出さない（2026-10-19）。タブは画面の下に固定。作品数などの要約と「自動更新」「今すぐ更新」を1行に
const header = (sub, tab) => `${tabsHtml(tab)}<div class="subrow"><p class="sub" id="sub">${sub}</p>${syncHtml()}<button class="rbtn" id="refreshBtn" type="button">今すぐ更新</button></div>`;

// ===== データ購読 =====
let dbState = "loading", services = [], picks = [], chats = [], works = [], taste = null, loaded = false, daily = {}, cands = [], refreshInfo = null, loadError = "", lastLoad = 0, sheetUrl = "";
// サーバー（Apps Script）を呼ぶ（2026-11-21〜）。Googleの画面のときは google.script.run.api、ホーム画面アプリ（GitHub Pages）のときは
// データ窓口のデプロイ（アクセス＝全員）に fetch。どちらも鍵（この端末に保存）を付ける。持ち主のGoogleアカウントで開いたGoogleの画面は鍵なしでも動く
const API_URL = "https://script.google.com/macros/s/AKfycbzT8vz9fuMAfUW4HlNVZVqgSEvYYHUL-PLqhCF61BriHY4ZE_0CXWe2Gi5BeGYIsaH9ng/exec";
const inGAS = typeof google !== "undefined" && google.script && google.script.run;
const apiKey = () => { try { return localStorage.getItem("sakuhinKey") || ""; } catch (e) { return ""; } };
function keyGate(msg) {
  const d = document.createElement("div");
  d.innerHTML = `<form style="position:fixed;inset:0;z-index:9999;background:#f3f4fb;display:grid;place-content:center;gap:12px;padding:24px;font:15px -apple-system,sans-serif;text-align:center"><b style="font-size:1.2rem">作品鑑賞帳</b><span>${msg || "鍵（合言葉）を入れてください。最初の1回だけです。"}</span><input name="k" autocomplete="off" autocapitalize="off" spellcheck="false" style="font-size:16px;padding:10px 12px;border:1.5px solid #bbb;border-radius:12px;text-align:center" placeholder="xxxx-xxxx-xxxx-xxxx"><button style="font-size:16px;padding:10px;border:0;border-radius:12px;background:#444;color:#fff">開く</button></form>`;
  d.querySelector("form").addEventListener("submit", e => { e.preventDefault(); const v = d.querySelector("input").value.trim(); if (!v) return; try { localStorage.setItem("sakuhinKey", v); } catch (x) {} location.reload(); });
  document.body.appendChild(d);
}
let keyAsked = false;
const keyErr = e => { if (/KEY/.test(String((e && e.message) || e)) && !keyAsked) { keyAsked = true; try { localStorage.removeItem("sakuhinKey"); } catch (x) {} keyGate(apiKey() ? "鍵がちがいます。もう一度入れてください。" : ""); } throw e; };
const rpc = (fn, ...args) => (inGAS
  ? new Promise((resolve, reject) => {
      try { google.script.run.withSuccessHandler(resolve).withFailureHandler(e => reject(new Error((e && e.message) || String(e)))).api(fn, apiKey(), args); }
      catch (e) { reject(e); }
    })
  : fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ fn, key: apiKey(), args }) })
      .then(r => r.json()).then(j => { if (!j.ok) throw new Error(j.error); return j.r; })
).catch(keyErr);
if (!inGAS && !apiKey()) keyGate();
const clean = o => JSON.parse(JSON.stringify(o === undefined ? null : o));
// 以前の db（claude.use("db")）と同じ使い方ができる小さな入れ物。変更は手元の状態に即反映し、シートにも書く
const db = {
  collection(name) {
    return {
      async add(doc) {
        if (name !== "works") throw new Error("unsupported");
        const id = await rpc("addWork", clean(doc)); works.push({ id, ...doc }); refresh(); return { id };
      }
    };
  },
  doc(path) {
    const [col, id] = path.split("/");
    return {
      async update(patch) {
        if (col !== "works") throw new Error("unsupported");
        const w = works.find(x => x.id === id); if (w) Object.assign(w, patch);
        refresh(); await rpc("updateWork", id, clean(patch));
      },
      async set(data) {
        if (col === "works") { const i = works.findIndex(x => x.id === id); if (i >= 0) works[i] = { id, ...data }; else works.push({ id, ...data }); await rpc("setWork", id, clean(data)); refresh(); }
        else if (col === "trash") await rpc("setTrash", id, clean(data));
        else if (col === "daily") { daily[id] = { id, day: id, items: data.items || [] }; refresh(); await rpc("saveDay", id, clean(data.items || [])); }
        else if (col === "profile") { taste = { ...data }; refresh(); await rpc("saveTaste", clean(data)); }
        else throw new Error("unsupported");
      },
      async delete() {
        if (col === "works") { works = works.filter(x => x.id !== id); refresh(); await rpc("removeWork", id); }
        else if (col === "trash") await rpc("removeTrash", id);
        else if (col === "dailyCandidates") { cands = cands.filter(x => x.id !== id); refresh(); await rpc("removeCand", id); }
        else throw new Error("unsupported");
      },
      async get() { const d = col === "trash" ? await rpc("getTrash", id) : null; return { exists: !!d, data: () => d }; }
    };
  }
};
async function reloadAll() {
  try {
    const d = await rpc("loadAll");
    works = d.works || []; daily = d.daily || {}; cands = d.cands || []; taste = d.taste || {}; services = d.services || []; picks = d.picks || []; chats = d.chats || []; sheetUrl = d.sheetUrl || ""; refreshInfo = d.refreshInfo && d.refreshInfo.lastRunAt ? d.refreshInfo : null;
    loaded = true; dbState = "ready"; lastLoad = Date.now();
  } catch (e) { if (!loaded) { dbState = "off"; loadError = e.message || ""; } }
  refresh();
}
reloadAll();
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - lastLoad > 60000) reloadAll(); });
// 右上の「今すぐ更新」: サーバーで最新話・★を取り直す（毎朝の自動更新と同じ処理）
let refreshing = false;
async function runRefresh() {
  const rb = $("#refreshBtn"); if (!rb || refreshing) return;
  refreshing = true; rb.disabled = true; rb.textContent = "更新中…";
  try { const r = await rpc("refreshNow"); await reloadAll(); const b = $("#refreshBtn"); if (b) { b.textContent = "更新しました"; b.title = r.summary || ""; } }
  catch (e) { const b = $("#refreshBtn"); if (b) b.textContent = "失敗"; }
  setTimeout(() => { refreshing = false; const b = $("#refreshBtn"); if (b) { b.disabled = false; b.textContent = "今すぐ更新"; } }, 3000);
}
const loadingHtml = () => dbState === "off"
  ? `<p class="msg">データを読み込めませんでした。Googleにログインした状態で開き直してください。${esc(loadError)}</p>`
  : `<p class="note">読み込んでいます…</p>`;

// ===== ルーター =====
let view = "follow", detailId = null, detailBuilt = false, chatId = null;
function parseHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith("w-")) { view = "detail"; detailId = h.slice(2); }
  else if (h.startsWith("chat-")) { view = "chat"; chatId = h.slice(5); detailId = null; }
  else if (h === "taste") { view = "chat"; chatId = "taste"; detailId = null; }
  else { detailId = null; view = { "": "follow", follow: "follow", rec: "watched", queue: "queue", chat: "chats" }[h] || "follow"; }
}
function renderView() {
  detailBuilt = false; formDirty = false; if (view !== "watched" && view !== "queue") openCard = null;
  ({ watched: () => renderList("watched"), queue: () => renderList("queue"), follow: renderFollow, chats: renderChatList, chat: renderChat, detail: renderDetail })[view]();
  if (view !== "chat" && view !== "follow") scTo(0);
}
function refresh() {
  const sd = $("#syncd"); if (sd) sd.outerHTML = syncHtml();
  if (view === "watched" || view === "queue") { if (!(openCard && formDirty)) drawList(); }   // 入力中は、データ更新で入力を消さない
  else if (view === "follow") { if (!formDirty) drawFollow(); }
  else if (view === "chats") drawChatList();
  else if (view === "chat") { const c = chats.find(x => x.id === chatId); if (c && c.kind === "taste") drawTaste(); else if (c && c.kind === "services") drawServices(); }
  else if (view === "detail" && !detailBuilt) renderDetail();
}
window.addEventListener("hashchange", () => { parseHash(); renderView(); });

// ===== 一覧 =====
let F = Object.assign({ kind: "all", q: "", sort: "score", qsort: "aff", qstatus: "queue" }, store.get("filt") || {});
let shown = 60;
const scoreOf = (w, st) => st === "watched" ? w.rating : w.avg;
const SORTS = {
  score: st => (a, b) => (scoreOf(b, st) ?? -1) - (scoreOf(a, st) ?? -1) || String(a.title).localeCompare(String(b.title), "ja"),
  new: () => (a, b) => String(b.finishedAt || b.createdAt || "").localeCompare(String(a.finishedAt || a.createdAt || "")) || (b.order || 0) - (a.order || 0),
  title: () => (a, b) => String(a.title).localeCompare(String(b.title), "ja")
};
// 好みに近い順（観たい）: 参考スコア・種類ごとの自分の平均★・見た作品と同じシリーズか・好みの傾向のキーワードから点を付ける（AIは呼ばず、この画面の中で計算）
const gramsOf = t => {
  const s = normT(t).replace(/[・、。！？!?\-～〜:：「」『』()（）\[\]【】'"“”.,&＆]/g, "");
  if (s.length < 4) return s ? [s] : [];
  const g = new Set(); for (let i = 0; i + 4 <= s.length; i++) g.add(s.slice(i, i + 4)); return [...g];
};
function buildAffinity() {
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const watched = works.filter(w => w.status === "watched"), rated = watched.filter(w => w.rating != null), all = mean(rated.map(w => w.rating));
  const kindAdj = {};
  KINDS.forEach(([k]) => { const r = rated.filter(w => w.kind === k); kindAdj[k] = r.length >= 5 ? Math.max(-1, Math.min(1, mean(r.map(w => w.rating)) - all)) : 0; });
  const df = new Map(); works.forEach(w => gramsOf(w.title).forEach(g => df.set(g, (df.get(g) || 0) + 1)));
  const idx = new Map();
  watched.forEach((w, i) => { const wt = w.rating != null ? w.rating - 3.5 : 0.3; gramsOf(w.title).forEach(g => { if ((df.get(g) || 0) > 12) return; if (!idx.has(g)) idx.set(g, []); idx.get(g).push([i, wt]); }); });
  const tr = (Array.isArray(taste?.traits) ? taste.traits : []).map(t => ({
    dis: t.kind === "dislike",
    toks: String(t.text || "").replace(/[★☆][\d.\-]+/g, "").replace(/（[^）]*）|\([^)]*\)/g, "").replace(/全\d+期|全部|全て|など|＋/g, "・").split(/[・、,，／/\s]+/).map(normT).filter(x => x.length >= 3 && !/^(第\d+\S?|シーズン\d+|season\d+)$/i.test(x))
  }));
  return w => {
    let s = ((w.avg ?? 3.5) - 3.5) * 2 + (kindAdj[w.kind] || 0);
    const best = new Map();
    gramsOf(w.title).forEach(g => (idx.get(g) || []).forEach(([i, wt]) => { if (!best.has(i) || Math.abs(wt) > Math.abs(best.get(i))) best.set(i, wt); }));
    const top = [...best.values()].sort((a, b) => Math.abs(b) - Math.abs(a)).slice(0, 2);
    s += Math.max(-3, Math.min(3, top.reduce((x, y) => x + y, 0) * 1.2));
    const t = normT(w.title);
    tr.forEach(x => { if (x.toks.some(k => t.includes(k))) s += x.dis ? -1.2 : 1.5; });
    return s;
  };
}
function cardHtml(w, st, badge) {
  const bits = [];
  if (w.creator) bits.push(esc(w.creator));
  if (w.period) bits.push(esc(w.period));
  if (w.service) bits.push(esc(w.service));
  let score = "";
  if (w.status === "watched") score = w.rating != null ? `<div class="score"><b>${w.rating.toFixed(1)}</b><small>★</small></div>` : `<div class="score avg"><b>–</b><small>未採点</small></div>`;
  else if (w.avg != null) score = `<div class="score avg"><b>${w.avg.toFixed(1)}</b><small>平均</small></div>`;
  let extra = "";
  if (w.progress) extra += `<p class="snip">${esc(w.progress)}</p>`;
  else if (w.waitFor) extra += `<p class="snip">待っているもの: ${esc(w.waitFor)}${w.dueDate ? `（${esc(w.dueDate)}）` : ""}</p>`;
  else if (w.note) extra += `<p class="snip">${esc(w.note)}</p>`;
  const due = dueBadge(w);
  return `<div class="cardw"><button class="card ${openCard === w.id ? "open" : ""}" type="button" data-id="${esc(w.id)}">
    <div class="cmain"><div class="cline"><span class="kb k-${esc(w.kind)}">${KL[w.kind] || "その他"}</span>${badge || ""}${due}${(w.tags || []).slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
    <h3>${esc(w.title)}</h3>${bits.length ? `<div class="meta">${bits.join(" ・ ")}</div>` : ""}${extra}</div>${score}</button>${openCard === w.id ? `<div class="cdetail"><div class="cline"><a class="ext" href="${esc(searchUrl(w.title, w.kind))}" target="_blank" rel="noopener noreferrer">ネットで検索</a>${watchLink(w)}</div>${detailFormHtml(w)}</div>` : ""}</div>`;
}
function dueBadge(w) {
  if (!w.deadline || w.status === "watched" || w.status === "dropped") return "";
  const d = Math.ceil((Date.parse(w.deadline + "T00:00:00") - Date.now()) / 864e5);
  if (isNaN(d)) return "";
  return d < 0 ? `<span class="due late">配信終了 ${-d}日前</span>` : `<span class="due ${d <= 7 ? "late" : ""}">終了まで${d}日</span>`;
}
// 作品をタップすると、その場で広がって入力できる（別の画面には移動しない）。もう一度タップすると、その作品を起点に閉じる。同時に開くのは1つだけ
let openCard = null;
function bindCards(box) {
  box.querySelectorAll(".card").forEach(b => b.onclick = () => {
    const id = b.dataset.id, find = () => box.querySelector('.card[data-id="' + id + '"]'), top0 = b.getBoundingClientRect().top;
    openCard = openCard === id ? null : id; formDirty = false;
    drawList(); keepPos(find, top0);
  });
  const w = works.find(x => x.id === openCard); if (w && box.querySelector("#dform")) bindDetailForm(w, () => { openCard = null; drawList(); });
}
function addFormHtml(statusOpts, defStatus) {
  return `<details class="addbox" id="addBox"><summary>＋ 作品を追加</summary>
    <form id="addForm"><input name="title" placeholder="作品名" required autocomplete="off">
      <select name="kind" aria-label="種類">${KINDS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
      <select name="status" aria-label="状態">${statusOpts.map(s => `<option value="${s}" ${s === defStatus ? "selected" : ""}>${SL[s]}</option>`).join("")}</select>
      <button class="btn" type="submit">追加する</button></form></details>`;
}
function bindAdd(after) {
  const f = $("#addForm"); if (!f) return;
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(f), title = String(fd.get("title") || "").trim();
    if (!title || !db) return;
    const same = works.find(w => w.title === title && w.kind === fd.get("kind"));
    if (same) { location.hash = "w-" + same.id; return; }
    try {
      const doc = newWork({ title, kind: String(fd.get("kind")), status: String(fd.get("status")) });
      const ref = await db.collection("works").add(doc);
      f.reset(); if (after) after(ref.id);
    } catch { const m = $("#addMsg"); if (m) m.textContent = "保存できませんでした。もう一度試してください。"; }
  });
}
const nextOrder = () => works.reduce((m, w) => Math.max(m, w.order || 0), 0) + 1;
function newWork(o) {
  return { title: "", kind: "other", status: "queue", rating: null, avg: null, note: "", memo: "", tags: [], service: "", period: "", progress: "", creator: "", waitFor: "", dueDate: "", deadline: "", checkedAt: "", source: "app", order: nextOrder(), createdAt: now(), updatedAt: now(), ...o };
}

function renderList(st) {
  const isW = st === "watched";
  app.innerHTML = header("", isW ? "rec" : "queue") +
    (isW ? "" : `<div class="chips" id="stChips"></div>`) + `<div class="chips" id="kindChips"></div>
     <div class="row"><input class="input" id="q" type="search" placeholder="タイトル・タグ・感想で探す" value="${esc(F.q)}" autocomplete="off">
       <select class="input" id="sort" aria-label="並び順">${isW ? "" : `<option value="aff">好みに近い順</option>`}<option value="score">${isW ? "★が高い順" : "平均スコア順"}</option><option value="new">新しい順</option><option value="title">五十音順</option></select></div>
     ${addFormHtml(isW ? ["watched", "queue"] : ["queue", "watched"], st)}
     <p class="msg" id="addMsg"></p>
     <div id="listBox"></div>`;
  bindTabs();
  $("#sort").value = isW ? F.sort : F.qsort;
  $("#q").oninput = e => { F.q = e.target.value; shown = 60; store.set("filt", { ...F, q: "" }); drawList(); };
  $("#sort").onchange = e => { if (isW) F.sort = e.target.value; else F.qsort = e.target.value; store.set("filt", { ...F, q: "" }); drawList(); };
  bindAdd(id => { $("#addBox").open = false; });
  drawList();
}
function drawList() {
  const box = $("#listBox"); if (!box) return;
  if (!loaded) { box.innerHTML = loadingHtml(); return; }
  const st = view, lst = st === "queue" ? (F.qstatus || "queue") : "watched";
  const all = works.filter(w => w.status === lst);
  if (st === "queue") {
    $("#stChips").innerHTML = [["queue", "観たい"], ["waiting", "リリース待ち"], ["dropped", "中断"]].map(([k, l]) => `<button class="fchip" type="button" data-st="${k}" aria-pressed="${lst === k}">${l}<small>${works.filter(w => w.status === k).length}</small></button>`).join("");
    $("#stChips").querySelectorAll(".fchip").forEach(b => b.onclick = () => { F.qstatus = b.dataset.st; F.kind = "all"; shown = 60; store.set("filt", { ...F, q: "" }); drawList(); });
  }
  const counts = {}; all.forEach(w => counts[w.kind] = (counts[w.kind] || 0) + 1);
  if (F.kind !== "all" && !counts[F.kind]) F.kind = "all";
  $("#kindChips").innerHTML = [["all", "すべて", all.length], ...KINDS.filter(([k]) => counts[k]).map(([k, l]) => [k, l, counts[k]])]
    .map(([k, l, n]) => `<button class="fchip" type="button" data-k="${k}" aria-pressed="${F.kind === k}">${l}<small>${n}</small></button>`).join("");
  $("#kindChips").querySelectorAll(".fchip").forEach(b => b.onclick = () => { F.kind = b.dataset.k; shown = 60; store.set("filt", { ...F, q: "" }); drawList(); });
  let arr = all.filter(w => F.kind === "all" || w.kind === F.kind);
  const q = F.q.trim().toLowerCase();
  if (q) arr = arr.filter(w => [w.title, (w.tags || []).join(" "), w.note, w.memo, w.creator].join(" ").toLowerCase().includes(q));
  let badges = null;
  if (st === "queue" && lst === "queue" && F.qsort === "aff") {
    const f = buildAffinity(), sc = new Map(all.map(w => [w.id, f(w)]));
    const rank = new Map([...all].sort((a, b) => sc.get(b.id) - sc.get(a.id)).map((w, i) => [w.id, i]));
    arr.sort((a, b) => sc.get(b.id) - sc.get(a.id) || String(a.title).localeCompare(String(b.title), "ja"));
    badges = new Map(); all.forEach(w => { const r = rank.get(w.id); if (r < Math.max(5, Math.round(all.length * .1))) badges.set(w.id, `<span class="match">相性◎</span>`); else if (r < Math.round(all.length * .35)) badges.set(w.id, `<span class="match m2">相性○</span>`); });
  } else arr.sort(SORTS[st === "queue" && F.qsort !== "aff" ? F.qsort : F.sort](st === "queue" ? "queue" : st));
  const rated = all.filter(w => w.rating != null);
  $("#sub").textContent = st === "watched"
    ? `${all.length}作品を記録${rated.length ? `・平均★${(rated.reduce((s, w) => s + w.rating, 0) / rated.length).toFixed(2)}` : ""}`
    : `${all.length}作品が${{ queue: "順番待ち", waiting: "リリース待ち", dropped: "中断" }[lst] || ""}`;
  if (!all.length) { box.innerHTML = `<p class="empty">${st === "watched" ? "まだ記録がありません。上の「作品を追加」から入れるか、「相談」タブで見終わった作品を伝えてください。" : "観たい作品はありません。「相談」タブでおすすめを頼むと、ここに積めます。"}</p>`; return; }
  if (!arr.length) { box.innerHTML = `<p class="empty">条件に合う作品がありません。</p>`; return; }
  box.innerHTML = `<div class="list">${arr.slice(0, shown).map(w => cardHtml(w, st, badges && badges.get(w.id))).join("")}</div>` +
    (arr.length > shown ? `<div class="row" style="justify-content:center;margin-top:10px"><button class="btn ghost more" type="button" id="more">残り${arr.length - shown}件を表示</button></div>` : "");
  bindCards(box);
  const m = $("#more"); if (m) m.onclick = () => { shown += 60; drawList(); };
}

// ===== 毎日の夜8時（曜日ごとに、その日の夜8時までに更新されているNetflix・Hulu・TVerの毎週配信作品。1日に複数OK） =====
//   daily/<mon..sun>: { day, items: [{ workId, title, kind, service, airNote, ep(見終わった話数), total(最終話), finalDate(最終回の配信日), checkedAt }] }
//   dailyCandidates/*: { day, title, kind, service, airNote, total, finalDate, why, checkedAt }（選ぶのは追いかけタブ。「これにする」で選んで「確定する」で枠に入る）
const DAYS = [["mon", "月"], ["tue", "火"], ["wed", "水"], ["thu", "木"], ["fri", "金"], ["sat", "土"], ["sun", "日"]];
const DL = Object.fromEntries(DAYS);
const todayKey = () => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
const STATE_LABEL = { empty: "未設定", done: "最終話まで見ました", final: "最終回を迎えました", near: "最終回が近い", ok: "" };
// 旧形式（1枠1作品: title などが直接入っている）も読めるようにする
const itemsOf = s => Array.isArray(s?.items) ? s.items : (s && s.title ? [{ workId: s.workId || "", title: s.title, kind: s.kind, service: s.service, airNote: s.airNote, ep: s.ep, total: s.total, finalDate: s.finalDate, checkedAt: s.checkedAt }] : []);
// 見たボタンは「スタンプ」。最新話まで見たら灰色になり、新しい話が出る（最新話が進む）と元の色に戻る。もう一度押すと取り消せる。
//   latest=最新話（毎朝の自動更新）、seenEp=スタンプした話数（旧 ep）、seenAt=スタンプした日時
const seenEpOf = s => Number(s.seenEp ?? s.ep) || 0;
const startOfCycle = day => { const idx = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }[day]; const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() - idx + 7) % 7)); return d.getTime(); };
function isSeen(day, s) {
  const latest = Number(s.latest) || 0;
  if (latest) return seenEpOf(s) >= latest;
  return !!s.seenAt && Date.parse(s.seenAt) >= startOfCycle(day);   // 最新話が未確認のときは、その曜日の更新日以降にスタンプしたかで見る
}
const latestText = s => s.latest
  ? `最新 第${esc(s.latest)}話${s.total ? `／全${esc(s.total)}話` : ""}${s.latestAt ? `（${esc(String(s.latestAt).slice(5, 10).replace("-", "/"))}確認）` : ""}`
  : `最新話は未確認${s.total ? `／全${esc(s.total)}話` : ""}`;
function itemState(s) {
  const total = Number(s.total) || 0, latest = Number(s.latest) || 0, seen = seenEpOf(s);
  if (total && seen >= total) return "done";
  if (total && latest >= total) return "final";
  const d = s.finalDate ? Math.ceil((Date.parse(s.finalDate + "T00:00:00") - Date.now()) / 864e5) : null;
  if ((total && latest && total - latest <= 1) || (total && !latest && total - seen <= 1) || (d !== null && !isNaN(d) && d <= 14)) return "near";
  return "ok";
}
function dayState(k) {
  const its = itemsOf(daily[k]); if (!its.length) return "empty";
  const st = its.map(itemState);
  return st.includes("done") ? "done" : st.includes("final") ? "final" : st.includes("near") ? "near" : "ok";
}
const needAlert = () => DAYS.filter(([k]) => dayState(k) !== "ok");
const ALERT_TEXT = "最終回が近い・終わった・未設定の曜日があります。下の候補から選べます。";
let picked = new Set(store.get("daily-picked") || []);
const savePicked = () => store.set("daily-picked", [...picked]);
// 候補の開閉: 自分で閉じたら、次に開いても閉じたまま。閉じたあとに新しい候補が増えたら、また開く（閉じた時点の候補のidを控えておく）
const candState = store.get("daily-cand") || {};
// 「最新まで見た」の開閉: 初期は閉じる。開いたら、描き直しても開いたまま（曜日ごとに覚える）
const seenState = store.get("daily-seenf") || {};
// 追いかけタブを開いたとき（最初・ほかのタブから戻ったとき）、今日の曜日の行へスクロールする。データが入って行の高さが変わる間は合わせ直し、ユーザーが自分でスクロールしたら止める
const LOOP_COPIES = 5, LOOP_MID = 2;   // 曜日の一覧を5つ並べ、真ん中（3つ目）を見る
let scrollUntil = 0, userScrolled = false, firstDraw = false;
// 画面を動かしている要素を探す。CSSで html と body の両方に overflow-x:hidden を付けているため、body 自身が縦スクロールの要素になる（window.scrollY は常に0）。
// 変わっても動くよう、実際にスクロールできる方を使う。
function scEl() { const b = document.body, d = document.scrollingElement || document.documentElement; return (b.scrollHeight > b.clientHeight + 2 && b.scrollHeight - b.clientHeight > d.scrollHeight - d.clientHeight) ? b : d; }
function scY() { return scEl().scrollTop; }
function scTo(y) { scEl().scrollTop = y; }
let anchorGen = 0, formDirty = false, savedMark = { id: "", t: 0 };
const justSaved = id => savedMark.id === id && Date.now() - savedMark.t < 4000;   // formDirty: 入力フォーム（評価・作品の詳細）に未保存の入力があるあいだは、データ更新による描き直しをしない
// 開閉などで高さが変わっても、押した場所が画面の同じ位置に残るようにする。find() は、描き直したあとの押した要素を返す
function keepPos(find, top0) {
  const gen = ++anchorGen, fix = () => {
    if (gen !== anchorGen) return;
    const e = find(); if (!e) return;
    const dy = e.getBoundingClientRect().top - top0; if (Math.abs(dy) > 1) scTo(scY() + dy);
  };
  fix(); [60, 200, 450].forEach(t => setTimeout(fix, t));
}
// 曜日の一覧を描き直すとき、画面の上のほうに見えている要素を覚えておき、描き直したあと同じ位置に戻す（見たを押して作品が移動したときなど、画面がずれないように）
const akId = el => { const cp = el.closest(".dcopy"); return (cp ? cp.dataset.copy : "") + "|" + el.dataset.ak; };
function takeAnchors(box) {
  const lb = $("#limBar"), stk = lb ? lb.getBoundingClientRect().bottom : 0, H = window.innerHeight, out = [];
  for (const el of box.querySelectorAll("[data-ak]")) { const top = el.getBoundingClientRect().top; if (top >= stk && top < H) { out.push({ id: akId(el), top }); if (out.length >= 4) break; } }
  return out;
}
function restoreAnchors(box, list) {
  if (!list || !list.length) return;
  const map = new Map(); box.querySelectorAll("[data-ak]").forEach(el => map.set(akId(el), el));
  for (const a of list) { const el = map.get(a.id); if (!el || !el.getClientRects().length) continue; const dy = el.getBoundingClientRect().top - a.top; if (Math.abs(dy) > 1) scTo(scY() + dy); return; }
}
["wheel", "touchmove", "keydown"].forEach(ev => window.addEventListener(ev, () => { userScrolled = true; anchorGen++; }, { passive: true }));
function scrollToToday(box) { if (userScrolled || Date.now() > scrollUntil) return; const el = box.querySelectorAll(".drow.today")[LOOP_MID] || box.querySelector(".drow.today"); if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "start" })); }
const saveDay = (day, items) => db.doc("daily/" + day).set({ day, items, updatedAt: now() });
async function toggleSeen(day, i) {
  if (!db) return;
  const items = itemsOf(daily[day]).map(x => ({ ...x })), it = items[i]; if (!it) return;
  const total = Number(it.total) || 0, latest = Number(it.latest) || 0, was = isSeen(day, it);
  if (!was) { it.prevSeenEp = seenEpOf(it); it.prevSeenAt = it.seenAt || ""; it.seenEp = latest || Math.min(seenEpOf(it) + 1, total || 9999); it.seenAt = now(); }
  else { it.seenEp = Number(it.prevSeenEp) || 0; it.seenAt = it.prevSeenAt || ""; }
  delete it.ep;
  await saveDay(day, items);
  if (it.workId) {
    const se = seenEpOf(it), patch = { progress: se ? `第${se}話まで` : "第1話から", updatedAt: now() };
    if (total && se >= total) { patch.status = "watched"; patch.progress = ""; patch.finishedAt = now(); patch.period = today().slice(0, 7); }
    else if (was) patch.status = "following";
    await db.doc("works/" + it.workId).update(patch).catch(() => {});
  }
}
// 最新話が分かっている作品は「◯／◯話 見た」。見た=1話ずつ進める、数字をタップ=テンキーで直接直す（押し間違いの修正用）。最新話まで進むとグレー
async function setSeenEp(day, i, n) {
  if (!db) return;
  const items = itemsOf(daily[day]).map(x => ({ ...x })), it = items[i]; if (!it) return;
  const total = Number(it.total) || 0, latest = Number(it.latest) || 0;
  n = Math.max(0, Math.floor(n)); if (latest) n = Math.min(n, latest); if (total) n = Math.min(n, total);
  if (n === seenEpOf(it)) return;
  it.prevSeenEp = seenEpOf(it); it.prevSeenAt = it.seenAt || ""; it.seenEp = n; it.seenAt = now(); delete it.ep;
  await saveDay(day, items);
  if (it.workId) {
    const w = works.find(x => x.id === it.workId), patch = { progress: n ? `第${n}話まで` : "第1話から", updatedAt: now() };
    if (total && n >= total) { patch.status = "watched"; patch.progress = ""; patch.finishedAt = now(); patch.period = today().slice(0, 7); }
    else if (w && w.status === "watched") patch.status = "following";
    await db.doc("works/" + it.workId).update(patch).catch(() => {});
  }
}
// 契約中（Hulu・Netflix・Disney+・YouTubeプレミアム）で見られず、TVer（・ABEMA）の見逃し配信だけの作品は、見逃すと見られない
const svcActive = x => !x.until || x.until >= today();
const missable = s => {
  const av = availOf(s); if (!av.length) return false;
  const paid = services.filter(x => x.type === "paid" && svcActive(x));
  if (paid.length) {
    if (av.some(k => paid.some(x => x.key === k))) return false;
    if (paid.some(x => x.name && String(s.service || "").includes(x.name))) return false;
    return true;
  }
  return av.every(k => k === "tver" || k === "abema") && !/Disney|ディズニー|YouTube|ユーチューブ/i.test(String(s.service || ""));
};
let editKey = "";
// 視聴可能話数（分母）の編集: editLatestKey=入力中の枠、latestAsk=確認待ちの変更 {key, n}
let editLatestKey = "", latestAsk = null;
// アニメで、最新話がアプリで確認できない（最新話が未設定、または確認日が7日以上前）もの。赤い細い枠で囲み、「最新まで見た」には移さない
const staleDays = (s, is) => Number(s.latest) && s.latestAt && is !== "final" && is !== "done" ? Math.floor((Date.now() - Date.parse(s.latestAt + "T00:00:00")) / 864e5) : 0;
const isUnsure = (s, is) => s.kind === "anime" && is !== "final" && is !== "done" && (!Number(s.latest) || staleDays(s, is) >= 7);
async function setLatest(day, i, n) {
  if (!db) return;
  const items = itemsOf(daily[day]).map(x => ({ ...x })), it = items[i]; if (!it) return;
  it.latest = n; it.latestAt = today(); delete it.ep;
  await saveDay(day, items);
}
// 追いかけの1行のルール。常に出す: 作品名・話数カウンター・見たボタン・見る場所（1つ）・最新話・★・注意タグ（見逃し注意／最終回が近い など）。
// タップで広げて出す: 放送の説明・配信時刻・最終回の日・確認日・ネットで検索・作品のページ・枠から外す
function actHtml(k, i, s, seen, copy = LOOP_MID) {
  const latest = Number(s.latest) || 0, se = seenEpOf(s), key = k + ":" + i;
  const lin = ph => `<span>／<input class="numin lin" type="number" inputmode="numeric" pattern="[0-9]*" min="1" value="${latest || ""}" placeholder="${ph}" data-el="${key}" aria-label="視聴可能話数">話</span>`;
  if (!latest) return `<div class="prog">${editLatestKey === key && copy === LOOP_MID ? lin("話数") : ""}<button class="btn ${seen ? "seenbtn" : ""}" type="button" data-w="${key}" aria-pressed="${seen}">${seen ? "✓ 見た" : "見た"}</button></div>`;
  const num = editKey === key && copy === LOOP_MID
    ? `<input class="numin" type="number" inputmode="numeric" pattern="[0-9]*" min="0" max="${latest}" value="${se}" data-e="${key}" aria-label="見た話数">`
    : `<button class="numb" type="button" data-n="${key}" aria-label="見た話数を直す">${se}</button>`;
  const den = editLatestKey === key && copy === LOOP_MID ? lin("") : `<button class="denb" type="button" data-dl="${key}" aria-label="視聴可能話数を直す">／${latest}話</button>`;
  return `<div class="prog">${num}${den}<button class="btn ${seen ? "seenbtn" : ""}" type="button" data-p="${key}" ${seen ? "disabled" : ""}>${seen ? "✓" : "見た"}</button></div>`;
}
const rmHtml = (k, i) => `<button class="linkbtn" type="button" data-x="${k}:${i}">枠から外す</button>`;
const openRows = new Set();
const watchChip = e => { const k = pickSvc(e); if (!k) return ""; const href = (e.links && e.links[k]) || SVC[k].url(cleanQ(e.title)); return `<a class="watch" href="${esc(href)}" target="_blank" rel="noopener noreferrer">▶ ${SVC[k].label}</a>`; };
async function removeItem(day, i) {
  const it = itemsOf(daily[day])[i];
  await saveDay(day, itemsOf(daily[day]).filter((_, j) => j !== i));
  const w = it && it.workId && works.find(x => x.id === it.workId);
  if (w && w.status === "following") await db.doc("works/" + w.id).update({ status: "queue", updatedAt: now() }).catch(() => {});   // 枠から外したら、観たいに戻す
}
async function confirmPicks(day) {
  const cs = cands.filter(c => c.day === day && picked.has(c.id)); if (!cs.length || !db) return;
  const items = itemsOf(daily[day]).map(x => ({ ...x }));
  for (const c of cs) {
    if (items.some(x => normT(x.title) === normT(c.title))) continue;
    const w = works.find(x => normT(x.title) === normT(c.title)); let workId = w ? w.id : "";
    if (!w) { const ref = await db.collection("works").add(newWork({ title: c.title, kind: c.kind || "anime", status: "following", service: c.service || "", progress: "第1話から", memo: c.why || "", avg: c.filmarks ?? null, source: "daily" })); workId = ref.id; }
    else await db.doc("works/" + w.id).update({ status: "following", service: w.service || c.service || "", progress: w.progress || "第1話から", ...(w.avg == null && c.filmarks != null ? { avg: c.filmarks } : {}), updatedAt: now() });
    items.push({ workId, title: c.title, kind: c.kind || "anime", service: c.service || "", airNote: c.airNote || "", ep: 0, total: Number(c.total) || null, finalDate: c.finalDate || "", checkedAt: c.checkedAt || "", filmarks: c.filmarks ?? null, latest: c.latest ?? null, latestAt: c.latestAt || "" });
  }
  await saveDay(day, items);
  for (const c of cs) { await db.doc("dailyCandidates/" + c.id).delete().catch(() => {}); picked.delete(c.id); }
  savePicked();
}
function refreshWarn() {
  const t = refreshInfo && Date.parse(refreshInfo.lastRunAt || "");
  if (!t) return `<p class="note">最新話は、毎朝5時ごろに自動で確認して更新されます（まだ一度も実行されていません。右上の「今すぐ更新」でも更新できます）。</p>`;
  return Date.now() - t >= 2 * 864e5 ? `<p class="note">2日以上確認されていません。右上の「今すぐ更新」を押してください。</p>` : "";
}
const itemMeta = s => `${esc(s.service || "")}${s.airNote ? " ・ " + esc(s.airNote) : ""}${s.filmarks != null ? " ・ " + fmTag(s.title, s.kind, s.filmarks) : ""}`;
function drawTonight() {
  const el = $("#tonight"); if (!el) return;
  if (!loaded) { el.innerHTML = ""; return; }
  const k = todayKey(), its = itemsOf(daily[k]), link = `<a href="#follow">追いかけタブ</a>`;
  const rows = its.map((s, i) => { const st = itemState(s), seen = isSeen(k, s);
    const msg = st === "done" ? `最終話まで見ました。${link}で次の作品を選んでください。` : `${esc(s.service || "")} ・ ${latestText(s)}${st === "final" ? " ・ 最終回を迎えました" : st === "near" ? " ・ 最終回が近い" : ""}`;
    return `<div class="trow ${seen ? "seen" : ""}"><div class="tmain"><b>${tlink(s.title, s.kind)}</b><span class="meta">${msg}</span>${watchLink(s) ? `<span class="meta">${watchLink(s)}${whenText(s)}</span>` : ""}</div><button class="btn ${seen ? "seenbtn" : ""}" type="button" data-t="${i}" aria-pressed="${seen}">${seen ? "✓ 見た" : "見た"}</button></div>`; }).join("");
  const others = needAlert().filter(([d]) => d !== k);
  el.innerHTML = `<section class="tonight"><h3>今夜（${DL[k]}曜）夜8時</h3>${its.length ? rows : `<p class="note">今夜の作品が未設定です。${link}で選んでください。</p>`}${others.length ? `<p class="dnote">${others.map(([d]) => DL[d]).join("・")}曜に、最終回が近い・最終回を迎えた・終わった・未設定の枠があります。${link}を見てください。</p>` : ""}</section>`;
  el.querySelectorAll("[data-t]").forEach(b => b.onclick = () => toggleSeen(k, +b.dataset.t).catch(() => {}));
}
// 観たいリストの作品のうち、契約中の有料サービスで見放題のもの（サービス名のリスト）
const paidSvcs = w => otherSvcs(w, { name: "" });
// 候補に出す「観たいリストの見放題」3作品。その日のうちは同じ作品（全曜日に同じ3作品）。枠に入れたり、見放題でなくなったら、別の作品に入れ替える
function randPicks() {
  if (!loaded) return [];
  const inDaily = w => DAYS.some(([d]) => itemsOf(daily[d]).some(x => x.workId === w.id || normT(x.title) === normT(w.title)));
  const pool = works.filter(w => w.status === "queue" && (w.kind === "anime" || w.kind === "drama") && paidSvcs(w).length && !inDaily(w));
  const rp = store.get("daily-rand") || {}, t = today();
  let ids = rp.date === t && Array.isArray(rp.ids) ? rp.ids.filter(id => pool.some(w => w.id === id)) : [];
  const rest = pool.filter(w => !ids.includes(w.id));
  while (ids.length < 3 && rest.length) ids.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0].id);
  if (rp.date !== t || JSON.stringify(rp.ids) !== JSON.stringify(ids)) store.set("daily-rand", { date: t, ids });
  return ids.map(id => pool.find(w => w.id === id)).filter(Boolean);
}
async function addFromQueue(day, id) {
  const w = works.find(x => x.id === id); if (!w || !db) return;
  const items = itemsOf(daily[day]).map(x => ({ ...x }));
  if (!items.some(x => x.workId === id || normT(x.title) === normT(w.title))) items.push({ workId: w.id, title: w.title, kind: w.kind, service: paidSvcs(w)[0] || w.service || "", airNote: "", ep: 0, total: null, finalDate: "", checkedAt: "", filmarks: w.avg ?? null, latest: null, latestAt: "" });
  await saveDay(day, items);
  await db.doc("works/" + id).update({ status: "following", progress: w.progress || "第1話から", updatedAt: now() });
}
function drawDaily() {
  const box = $("#dailyBox"); if (!box) return;
  if (!loaded) { box.innerHTML = ""; return; }
  const tk = todayKey(), al = needAlert();
  const anchors = (!firstDraw && (userScrolled || Date.now() > scrollUntil)) ? takeAnchors(box) : null;
  const rnd = randPicks();
  const rowsOf = copy => DAYS.map(([k, l]) => {
    const its = itemsOf(daily[k]), st = dayState(k), cs = cands.filter(c => c.day === k && !its.some(x => normT(x.title) === normT(c.title)));
    const rows = its.map((s, i) => { const is = itemState(s), unsure = isUnsure(s, is), seen = isSeen(k, s) && !unsure, miss = !seen && missable(s), key = normT(s.title), open = openRows.has(key);
      const latestShort = Number(s.latest) ? `最新${esc(s.latest)}話${s.total ? "/全" + esc(s.total) : ""}` : "最新未確認";
      const wk = s.workId && works.find(x => x.id === s.workId), done = is === "done" || (wk && wk.status === "watched"), rateOn = !!(wk && done);
      const stale = staleDays(s, is), ask = latestAsk && latestAsk.key === k + ":" + i ? latestAsk : null;
      const tags = `${stale >= 7 ? `<span class="dstate stale">話数は${esc(String(s.latestAt).slice(5, 10).replace("-", "/"))}時点</span>` : ""}${rateOn && wk.rating == null ? `<span class="dstate near">★をつける</span>` : ""}${miss ? `<span class="dstate near">見逃し注意</span>` : ""}${is === "ok" ? "" : `<span class="dstate ${is}">${STATE_LABEL[is]}</span>`}`;
      const rateForm = rateOn ? `<div class="ratef" data-rf="${esc(wk.id)}"><div class="rrow"><label>★ <input class="rin" type="number" inputmode="decimal" step="0.1" min="0" max="5" value="${wk.rating ?? ""}" placeholder="0〜5"></label><input class="rnote" value="${esc(wk.note)}" placeholder="ひとこと" autocomplete="off"></div><textarea class="rmemo" placeholder="感想・メモ">${esc(wk.memo)}</textarea><div class="rrow"><button class="btn" type="button" data-rs="${esc(wk.id)}">評価を保存</button><span class="ok rok">${justSaved(wk.id) ? "保存しました" : ""}</span></div></div>` : "";
      const more = open ? `<div class="dmore"><span class="meta">${itemMeta(s)}</span>${watchLink(s) ? `<span class="meta">${watchLink(s)}${whenText(s)}</span>` : ""}<span class="meta">${latestText(s)}${s.finalDate ? ` ・ 最終回 ${esc(s.finalDate)}` : ""} ・ <button class="linkbtn" type="button" data-dl="${k}:${i}">視聴可能話数を${Number(s.latest) ? "変更" : "設定"}</button></span>${unsure ? `<span class="meta" style="color:var(--alert)">最新話をアプリで確認できていません。配信サイトを見て、視聴可能話数（／◯話）を実際の数に直してください。</span>` : ""}${miss ? `<span class="meta" style="color:var(--butter-ink)">TVerの見逃し配信のみ。契約中のサービスでは見られません</span>` : ""}<span class="meta"><a class="ext" href="${esc(searchUrl(s.title, s.kind))}" target="_blank" rel="noopener noreferrer">ネットで検索</a>${s.workId ? ` ・ <a class="ext" href="#w-${esc(s.workId)}">作品のページ</a>` : ""} ・ ${rmHtml(k, i)}</span>${rateForm}</div>` : "";
      return { seen, html: `<div class="dline ${seen ? "seen" : miss ? "miss" : ""} ${unsure ? "unsure" : ""} ${open ? "open" : ""}" data-ak="l:${k}:${esc(key)}"><div class="dtop"><button class="dtitle" type="button" data-tg="${esc(key)}">${esc(s.title)}<span class="chev">${open ? "▲" : "▼"}</span></button>${actHtml(k, i, s, seen, copy)}</div><div class="dsub">${watchChip(s)}<span>${latestShort}</span>${s.filmarks != null ? `<span class="fmv">★${Number(s.filmarks).toFixed(1)}</span>` : ""}${tags}</div>${more}${ask ? `<div class="lask"><span>視聴可能話数を変更しようとしています、正しいですか？（${Number(s.latest) ? esc(s.latest) + "話" : "未設定"} → ${ask.n}話）</span><div class="rrow"><button class="btn" type="button" data-ly="${k}:${i}">はい、変更する</button><button class="btn ghost" type="button" data-ln="${k}:${i}">やめる</button></div></div>` : ""}</div>` }; });
    const seenRows = rows.filter(r => r.seen), items = its.length
      ? rows.filter(r => !r.seen).map(r => r.html).join("") + (seenRows.length ? `<details class="seenf" data-sf="${k}" data-ak="s:${k}" ${seenState[k] ? "open" : ""}><summary>最新まで見た（${seenRows.length}件）</summary>${seenRows.map(r => r.html).join("")}</details>` : "")
      : `<div class="dline"><div class="dmain"><span class="dstate empty">${STATE_LABEL.empty}</span></div></div>`;
    const sel = cs.filter(c => picked.has(c.id)).length, rec = candState[k], candOpen = rec ? (rec.open || cs.some(c => !(rec.ids || []).includes(c.id))) : st !== "ok";
    const rhtml = rnd.length ? `<div class="subh">観たいリストから（見放題）</div>${rnd.map(w => { const rk = "r:" + w.id, op = openRows.has(rk), sv = paidSvcs(w);
      return `<div class="cand rnd ${op ? "open" : ""}" data-ak="n:${k}:${esc(w.id)}"><div class="dtop"><button class="dtitle" type="button" data-tg="${esc(rk)}">${esc(w.title)}<span class="chev">${op ? "▲" : "▼"}</span></button><button class="btn" type="button" data-rw="${k}:${esc(w.id)}">この曜日に見る</button></div><div class="dsub"><span class="rtag">${esc(sv.join("・"))}で見放題</span><span>${esc(KL[w.kind] || "")}</span>${w.avg != null ? `<span class="fmv">★${Number(w.avg).toFixed(1)}</span>` : ""}</div>${op ? `<div class="dmore"><span class="meta">${esc(w.service || "")}${w.note ? " ・ " + esc(w.note) : ""}</span><span class="meta"><a class="ext" href="${esc(searchUrl(w.title, w.kind))}" target="_blank" rel="noopener noreferrer">ネットで検索</a> ・ <a class="ext" href="#w-${esc(w.id)}">作品のページ</a></span></div>` : ""}</div>`; }).join("")}` : "";
    const pick = (cs.length || rnd.length)
      ? `<details class="cands" data-d="${k}" data-ak="d:${k}" ${candOpen ? "open" : ""}><summary>候補（${cs.length + rnd.length}件）${sel ? ` ・ 選択中 ${sel}件` : ""}</summary>${rhtml}${cs.length && rnd.length ? `<div class="subh">AIのおすすめ</div>` : ""}${cs.map(c => { const ck = "c:" + c.id, op = openRows.has(ck);
        return `<div class="cand ${op ? "open" : ""}"><div class="dtop"><button class="dtitle" type="button" data-tg="${esc(ck)}">${esc(c.title)}<span class="chev">${op ? "▲" : "▼"}</span></button><button class="btn ${picked.has(c.id) ? "" : "ghost"}" type="button" data-c="${esc(c.id)}" aria-pressed="${picked.has(c.id)}">${picked.has(c.id) ? "選択中 ✓" : "これにする"}</button></div><div class="dsub">${watchChip(c)}<span>${esc(KL[c.kind] || "")}</span>${c.filmarks != null ? `<span class="fmv">★${Number(c.filmarks).toFixed(1)}</span>` : ""}</div>${op ? `<div class="dmore"><span class="meta">${esc(c.service || "")}${c.airNote ? " ・ " + esc(c.airNote) : ""}${c.total ? ` ・ 全${esc(c.total)}話` : ""}</span>${watchLink(c) ? `<span class="meta">${watchLink(c)}${whenText(c)}</span>` : ""}${c.why ? `<span class="meta">${esc(c.why)}</span>` : ""}<span class="meta"><a class="ext" href="${esc(searchUrl(c.title, c.kind))}" target="_blank" rel="noopener noreferrer">ネットで検索</a></span></div>` : ""}</div>`; }).join("")}${cs.length ? `<button class="btn" type="button" data-ok="${k}" ${sel ? "" : "disabled"}>${sel ? `この${sel}件で確定する` : "選んでから確定する"}</button><span class="note">「これにする」は何件でも選べます。確定するまで候補は消えません。</span>` : ""}</details>`
      : `<p class="note">この曜日の候補はありません。</p>`;
    return `<div class="drow ${k === tk ? "today" : ""}" data-ak="r:${k}"><div class="dday">${l}</div><div class="dbody">${items}${pick}</div></div>`;
  }).join("");
  box.innerHTML = `<section class="sec"><h3>毎日の夜8時</h3>${refreshWarn()}${al.length ? `<p class="dalert">${ALERT_TEXT}（対象: ${al.map(([k]) => DL[k]).join("・")}）</p>` : ""}<div class="dlist" id="dloop">${Array.from({ length: LOOP_COPIES }, (_, c) => c).map(c => `<div class="dcopy" data-copy="${c}">${rowsOf(c)}</div>`).join("")}</div></section>`;
  box.querySelectorAll("[data-tg]").forEach(b => b.onclick = () => {
    // 押した作品名の画面上の位置を覚えておき、描き直したあと、同じ位置に同じ作品名が来るようにスクロールを合わせる（作品名を起点に開閉する）
    const k = b.dataset.tg, all = () => Array.from(box.querySelectorAll("[data-tg]")).filter(x => x.dataset.tg === k), idx = all().indexOf(b), top0 = b.getBoundingClientRect().top;
    if (openRows.has(k)) openRows.delete(k); else openRows.add(k);
    userScrolled = true;   // 今日の位置へ戻す処理を止める
    drawDaily();
    keepPos(() => all()[idx], top0);
  });
  restoreAnchors(box, anchors);
  box.oninput = e => { if (e.target.closest && e.target.closest(".ratef")) formDirty = true; };
  box.querySelectorAll("[data-rs]").forEach(b => b.onclick = async () => {
    const f = b.closest(".ratef"), id = b.dataset.rs, w = works.find(x => x.id === id); if (!f || !w || !db) return;
    const ok = f.querySelector(".rok"); b.disabled = true;
    const patch = { rating: num(f.querySelector(".rin").value), note: f.querySelector(".rnote").value.trim(), memo: f.querySelector(".rmemo").value, updatedAt: now() };
    if (w.status !== "watched") { patch.status = "watched"; patch.progress = ""; patch.finishedAt = now(); patch.period = today().slice(0, 7); }
    try { await db.doc("works/" + id).update(patch); formDirty = false; savedMark = { id, t: Date.now() }; ok.textContent = "保存しました"; } catch { ok.textContent = "保存できませんでした"; }
    b.disabled = false;
  });
  box.querySelectorAll("[data-rw]").forEach(b => b.onclick = async () => {
    const [d, id] = b.dataset.rw.split(":"); b.disabled = true; b.textContent = "追加中…";
    try { await addFromQueue(d, id); } catch { b.disabled = false; b.textContent = "失敗。もう一度"; }
  });
  box.querySelectorAll("[data-w]").forEach(b => b.onclick = () => { const [d, i] = b.dataset.w.split(":"); toggleSeen(d, +i).catch(() => {}); });
  box.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { const [d, i] = b.dataset.p.split(":"), s = itemsOf(daily[d])[+i]; if (s) setSeenEp(d, +i, seenEpOf(s) + 1).catch(() => {}); });
  box.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { editKey = b.dataset.n; drawDaily(); });
  const ein = box.querySelector("[data-e]");
  if (ein) {
    const done = ok => { if (editKey !== ein.dataset.e) return; editKey = ""; const [d, i] = ein.dataset.e.split(":"), v = parseInt(ein.value, 10); if (ok && !isNaN(v)) setSeenEp(d, +i, v).catch(() => {}); drawDaily(); };
    ein.onkeydown = e => { if (isEnter(e)) done(true); else if (e.key === "Escape") done(false); };
    ein.onblur = () => done(true);
    ein.focus(); ein.select();
  }
  box.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => { editLatestKey = b.dataset.dl; latestAsk = null; editKey = ""; userScrolled = true; drawDaily(); });
  const lin = box.querySelector("[data-el]");
  if (lin) {
    const fin = ok => {
      if (editLatestKey !== lin.dataset.el) return; const key = editLatestKey; editLatestKey = "";
      const [d, i] = key.split(":"), v = parseInt(lin.value, 10), cur = Number((itemsOf(daily[d])[+i] || {}).latest) || 0;
      if (ok && !isNaN(v) && v > 0 && v !== cur) latestAsk = { key, n: v };   // すぐには変えず、確認を出す
      drawDaily();
    };
    lin.onkeydown = e => { if (isEnter(e)) fin(true); else if (e.key === "Escape") fin(false); };
    lin.onblur = () => fin(true);
    lin.focus(); lin.select();
  }
  box.querySelectorAll("[data-ly]").forEach(b => b.onclick = async () => {
    const a = latestAsk; if (!a || a.key !== b.dataset.ly) return; const [d, i] = a.key.split(":"); b.disabled = true;
    try { await setLatest(d, +i, a.n); latestAsk = null; } catch { b.disabled = false; b.textContent = "失敗。もう一度"; return; }
    drawDaily();
  });
  box.querySelectorAll("[data-ln]").forEach(b => b.onclick = () => { latestAsk = null; drawDaily(); });
  box.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { const id = b.dataset.c; if (picked.has(id)) picked.delete(id); else picked.add(id); savePicked(); drawDaily(); });
  box.querySelectorAll("[data-ok]").forEach(b => b.onclick = () => { b.disabled = true; confirmPicks(b.dataset.ok).catch(() => { b.disabled = false; }); });
  if (firstDraw) { firstDraw = false; scrollUntil = Date.now() + 3000; userScrolled = false; }
  setupLoop(); scrollToToday(box); setTimeout(loopRecenter, 150);   // 念のため、真ん中のコピーの外（＝上に動かせない一番上など）にいたら戻す
  box.querySelectorAll("details[data-d] > summary").forEach(sm => sm.addEventListener("click", e => {
    e.preventDefault();
    const d = sm.parentElement, k = d.dataset.d, open = !d.open, its = itemsOf(daily[k]);
    const sums = () => Array.from(box.querySelectorAll('details[data-d="' + k + '"] > summary')), idx = sums().indexOf(sm), top0 = sm.getBoundingClientRect().top;
    candState[k] = { open, ids: cands.filter(c => c.day === k && !its.some(x => normT(x.title) === normT(c.title))).map(c => c.id) };
    store.set("daily-cand", candState);
    box.querySelectorAll('details[data-d="' + k + '"]').forEach(x => { x.open = open; });   // 5つのコピーをそろえる
    keepPos(() => sums()[idx], top0);   // 折りたたみの見出しを起点に開閉する
  }));
  box.querySelectorAll("details[data-sf] > summary").forEach(sm => sm.addEventListener("click", e => {
    e.preventDefault();
    const d = sm.parentElement, k = d.dataset.sf, open = !d.open;
    const sums = () => Array.from(box.querySelectorAll('details[data-sf="' + k + '"] > summary')), idx = sums().indexOf(sm), top0 = sm.getBoundingClientRect().top;
    if (open) seenState[k] = true; else delete seenState[k];
    store.set("daily-seenf", seenState);
    box.querySelectorAll('details[data-sf="' + k + '"]').forEach(x => { x.open = open; });   // 5つのコピーをそろえる
    keepPos(() => sums()[idx], top0);
  }));
  box.querySelectorAll("[data-x]").forEach(b => b.onclick = async () => {
    if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "本当に外す"; setTimeout(() => { if (b.isConnected) { b.classList.remove("armed"); b.textContent = "枠から外す"; } }, 3500); return; }
    const [d, i] = b.dataset.x.split(":"); try { await removeItem(d, +i); } catch { b.textContent = "失敗"; }
  });
}

// 曜日の一覧を5つ並べて、真ん中のコピーを見る。スクロールが止まったら、見た目が同じ位置（真ん中のコピーの中）へ静かに戻す。
// 動かしているあいだは触らない（iPhoneは、指で動かしている最中に位置を飛ばすと、そこで動かなくなるため）。
// 勢いよく動かして端のコピーまで来てしまったときだけ、すぐ戻す
let loopBound = false;
function loopGeom() {
  const cs = document.querySelectorAll("#dloop .dcopy"); if (cs.length !== LOOP_COPIES) return null;
  const top = el => el.getBoundingClientRect().top + scY(), a = top(cs[0]), H = top(cs[1]) - a;
  return H < 200 ? null : { a, H, mid: top(cs[LOOP_MID]), end: a + H * LOOP_COPIES };
}
function loopRecenter() {
  if (view !== "follow") return; const g = loopGeom(); if (!g) return;
  const y = scY(); if (y >= g.mid && y < g.mid + g.H) return;
  scTo(y - Math.floor((y - g.mid) / g.H) * g.H);
}
function setupLoop() {
  if (loopBound) return; loopBound = true;
  let timer = 0;
  window.addEventListener("scroll", () => {
    if (view !== "follow") return;
    clearTimeout(timer); timer = setTimeout(loopRecenter, 160);
    const g = loopGeom(); if (g && (scY() < g.a + 200 || scY() + window.innerHeight > g.end - 200)) loopRecenter();
  }, { passive: true, capture: true });   // body が動く場合、scrollイベントは window まで届かないので、捕まえる側（capture）で受ける
}
// 期間限定配信（上に固定）: 自分で入れた「配信終了日」がある作品と、AIが調べた期間限定配信のおすすめ
function limItems() {
  const t = today();
  const own = works.filter(w => w.deadline && w.status !== "watched" && w.status !== "dropped").map(w => ({ title: w.title, kind: w.kind, until: w.deadline, service: w.service || "", id: w.id, ai: false }))
    .filter(x => { const d = Math.ceil((Date.parse(x.until + "T00:00:00") - Date.now()) / 864e5); return !isNaN(d) && d >= -3 && d <= 60; });
  const ai = (picks || []).filter(x => !x.until || x.until >= t).map(x => ({ title: x.title, kind: x.kind, until: x.until || "", service: x.service || "", why: x.why || "", url: x.url || "", ai: true }));
  return own.concat(ai.filter(a => !own.some(o => sameTitle(o.title, a.title))));
}
// 期限つきの契約（例: U-NEXT 〜11/12）。その配信サイトで見放題の「観たい」作品（Filmarksの配信情報。毎朝、少しずつ調べる）を出す
const SVC_ALIAS = { "disney+": ["ディズニープラス"] };
// その作品が、x 以外の「契約中の有料サービス」で見られるときの、サービス名のリスト（Filmarksの配信情報による）
function otherSvcs(w, x) {
  const vods = String(w.vod || "").split(/[、,]/).map(normT).filter(Boolean);
  const own = normT((w.service || "") + " " + (w.note || ""));   // 自分で書いた「見られる場所」「メモ」。Filmarksより優先して、載っていれば見られるものとして扱う
  return services.filter(s => s.type === "paid" && s.name !== x.name && svcActive(s)).filter(s => {
    const names = [normT(s.name)].concat((SVC_ALIAS[normT(s.name)] || []).map(normT));
    return vods.some(v => names.some(n => v.includes(n) || n.includes(v))) || names.some(n => own.includes(n));
  }).map(s => s.name);
}
function svcTitles(x) {
  const n = normT(x.name), f = buildAffinity();
  return works.filter(w => w.status === "queue" && String(w.vod || "").split(/[、,]/).some(v => { const m = normT(v); return m && (m.includes(n) || n.includes(m)); }))
    .map(w => ({ w, others: otherSvcs(w, x) })).sort((a, b) => (a.others.length ? 1 : 0) - (b.others.length ? 1 : 0) || f(b.w) - f(a.w));
}
const svcLeft = x => Math.ceil((Date.parse(x.until + "T00:00:00") - Date.now()) / 864e5);
let limOpen = -1;
function drawLim() {
  const el = $("#limBar"); if (!el) return;
  const md0 = u => `${Number(u.slice(5, 7))}/${Number(u.slice(8, 10))}`;
  const sl = loaded ? services.map((x, i) => [x, i]).filter(([x]) => x.until && x.until >= today() && svcLeft(x) <= 60) : [];
  const items = loaded ? limItems() : [];
  const md = u => u ? ` ${Number(u.slice(5, 7))}/${Number(u.slice(8, 10))}まで` : "";
  const chipOf = (w, others) => `<a class="limc" href="#w-${esc(w.id)}"><b>${esc(w.title)}</b><small>${esc(KL[w.kind] || "")}${w.avg != null ? " ・★" + w.avg.toFixed(1) : ""}${others.length ? " ・" + esc(others.join("・")) + "でも" : ""}</small></a>`;
  const panel = limOpen >= 0 && services[limOpen] ? (() => { const x = services[limOpen], ts = svcTitles(x), only = ts.filter(t => !t.others.length);
    return `<div class="limpanel"><b>${esc(x.name)}（〜${md0(x.until)}）でしか見られない「観たい」作品</b>${only.length ? `<div class="limrow2">${only.map(t => chipOf(t.w, t.others)).join("")}</div>` : `<span class="note">${ts.length ? "ありません（見られる作品は、契約中の他のサービスでも見られます）" : "まだ見つかっていません（毎朝、観たい作品の配信先を少しずつ調べています）"}</span>`}<span class="note">Filmarksの配信情報です（実際より遅れていることがあります）。他のサービスで見られると分かった作品は、作品のページの「見られる場所」にサービス名（例: Netflix）を入れると、ここから外れます。見放題かどうかは、配信サイトで確認してください。</span></div>`; })() : "";
  el.innerHTML = `<span class="limh">期間限定</span>` + sl.map(([x, i]) => `<button class="limc svc ${limOpen === i ? "on" : ""}" type="button" data-svc="${i}"><b>${esc(x.name)} 〜${md0(x.until)}</b><small>契約あと${svcLeft(x)}日 ・ ここでしか見られない観たい${svcTitles(x).filter(t => !t.others.length).length}件</small></button>`).join("") + (items.length
    ? `<div class="limrow">${items.map(x => `<a class="limc ${x.ai ? "ai" : ""}" href="${esc(x.id ? "#w-" + x.id : (x.url || searchUrl(x.title, x.kind)))}" ${x.id ? "" : 'target="_blank" rel="noopener noreferrer"'} title="${esc(x.why || "")}"><b>${esc(x.title)}</b><small>${esc(x.service)}${esc(md(x.until))}${x.ai ? " ・AI調べ" : ""}</small></a>`).join("")}</div>`
    : (sl.length ? "" : `<span class="limn">作品の「配信終了日」を入れると、ここに出ます（相談で「◯◯が◯/◯まで」と伝えてもOK）</span>`)) + panel;
  el.querySelectorAll("[data-svc]").forEach(b => b.onclick = () => { limOpen = limOpen === +b.dataset.svc ? -1 : +b.dataset.svc; drawLim(); });
}

// ===== 追いかけ（曜日ごとの毎週の作品。月〜日をぐるぐる） =====
function renderFollow() {
  app.innerHTML = header("曜日ごとの毎週の作品", "") + `<div class="limbar" id="limBar"></div><div id="dailyBox"></div>`;
  bindTabs();
  const sr = app.querySelector(".subrow"); if (sr) { sr.classList.add("stk"); const lb = $("#limBar"); if (lb) lb.style.top = sr.offsetHeight + "px"; }
  scrollUntil = 0; userScrolled = false; firstDraw = true;   // 今日の位置への移動は、データが入って最初に描いた時点から3秒間（読み込みが遅くても間に合うように）
  drawFollow();
}
function drawFollow() {
  drawLim(); drawDaily();
  const sub = $("#sub"); if (sub) sub.textContent = `${DAYS.reduce((n, [k]) => n + itemsOf(daily[k]).length, 0)}作品を毎週追いかけ中`;
}

// ===== 作品のページ =====
function renderDetail() {
  const w = works.find(x => x.id === detailId);
  if (!loaded) { app.innerHTML = `<button class="back" type="button" id="back">← 一覧へ</button>${loadingHtml()}`; $("#back").onclick = backToList; return; }
  if (!w) { app.innerHTML = `<button class="back" type="button" id="back">← 一覧へ</button><p class="empty">この作品は見つかりませんでした。</p>`; $("#back").onclick = backToList; return; }
  detailBuilt = true;
  app.innerHTML = `
    <button class="back" type="button" id="back">← 一覧へ</button>
    <div class="cline"><span class="kb k-${esc(w.kind)}" id="kbadge">${KL[w.kind] || "その他"}</span><span class="src">${esc(SL[w.status] || "")}</span><a class="ext" href="${esc(searchUrl(w.title, w.kind))}" target="_blank" rel="noopener noreferrer">ネットで検索</a>${watchLink(w)}</div>
    ${detailFormHtml(w)}`;
  $("#back").onclick = backToList;
  bindDetailForm(w, backToList);
}

function detailFormHtml(w) {
  const opt = (arr, cur) => arr.map(([v, l]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`).join("");
  return `
    <form class="panel" id="dform" autocomplete="off">
      <div class="field wide"><label for="f_title">作品名</label><input id="f_title" value="${esc(w.title)}" required></div>
      <div class="grid2">
        <div class="field"><label for="f_kind">種類</label><select id="f_kind">${opt(KINDS, w.kind)}</select></div>
        <div class="field"><label for="f_status">状態</label><select id="f_status">${opt(STATUS, w.status)}</select></div>
        <div class="field"><label for="f_rating">★（自分の点数 0〜5）</label><input id="f_rating" type="number" inputmode="decimal" step="0.1" min="0" max="5" value="${w.rating ?? ""}" placeholder="例: 4.2"></div>
        <div class="field"><label for="f_avg">参考スコア（Filmarks平均など）</label><input id="f_avg" type="number" inputmode="decimal" step="0.1" min="0" max="5" value="${w.avg ?? ""}"></div>
        <div class="field"><label for="f_creator">著者・監督など</label><input id="f_creator" value="${esc(w.creator)}"></div>
        <div class="field"><label for="f_service">見られる場所</label><input id="f_service" value="${esc(w.service)}" placeholder="例: Hulu"></div>
        <div class="field" data-for="watched"><label for="f_period">見た・読んだ時期</label><input id="f_period" value="${esc(w.period)}" placeholder="例: 2026-07"></div>
        <div class="field" data-for="following"><label for="f_progress">現在地</label><input id="f_progress" value="${esc(w.progress)}" placeholder="例: 第17話まで"></div>
        <div class="field" data-for="waiting"><label for="f_waitFor">待っているもの</label><input id="f_waitFor" value="${esc(w.waitFor)}" placeholder="例: 第2期"></div>
        <div class="field" data-for="waiting"><label for="f_dueDate">予定日</label><input id="f_dueDate" type="date" value="${esc(w.dueDate)}"></div>
        <div class="field" data-for="waiting"><label for="f_checkedAt">予定日を確認した日</label><input id="f_checkedAt" type="date" value="${esc(w.checkedAt)}"></div>
        <div class="field" data-for="queue following waiting"><label for="f_deadline">配信終了日</label><input id="f_deadline" type="date" value="${esc(w.deadline)}"></div>
      </div>
      <div class="field wide"><label for="f_note">一言</label><input id="f_note" value="${esc(w.note)}" placeholder="ひとことで言うと"></div>
      <div class="field wide"><label for="f_tags">好みタグ（、で区切る）</label><input id="f_tags" value="${esc((w.tags || []).join("、"))}" placeholder="例: 泣ける、スポ根"></div>
      <div class="field wide"><label for="f_memo">感想・メモ</label><textarea id="f_memo">${esc(w.memo)}</textarea></div>
      <div class="actions">
        <button class="btn full" type="submit">保存する</button>
        <button class="btn ghost" type="button" id="finish">見終わった状態にする</button>
        <button class="btn danger" type="button" id="del">削除</button>
      </div>
      <span class="ok" id="saved" role="status">${justSaved(w.id) ? "保存しました" : ""}</span>
      <span class="src">${esc(w.id)} ・ 出所: ${esc(w.source || "app")}</span>
    </form>`;
}
function bindDetailForm(w, onGone) {
  const root = $("#dform"); if (!root) return;
  root.addEventListener("input", () => { formDirty = true; });
  const syncFields = () => {
    const s = $("#f_status").value;
    root.querySelectorAll("[data-for]").forEach(el => { el.hidden = !el.dataset.for.split(" ").includes(s); });
    $("#finish").hidden = s === "watched";
    const kb = $("#kbadge"); if (kb) { kb.className = "kb k-" + $("#f_kind").value; kb.textContent = KL[$("#f_kind").value]; }
  };
  $("#f_status").onchange = syncFields; $("#f_kind").onchange = syncFields; syncFields();
  $("#finish").onclick = () => { $("#f_status").value = "watched"; if (!$("#f_period").value) $("#f_period").value = today().slice(0, 7); syncFields(); $("#f_rating").focus(); };
  $("#dform").addEventListener("submit", async e => {
    e.preventDefault();
    const tags = $("#f_tags").value.split(/[、,，]/).map(t => t.trim()).filter(Boolean);
    const patch = {
      title: $("#f_title").value.trim() || w.title, kind: $("#f_kind").value, status: $("#f_status").value,
      rating: num($("#f_rating").value), avg: num($("#f_avg").value),
      creator: $("#f_creator").value.trim(), service: $("#f_service").value.trim(), period: $("#f_period").value.trim(),
      progress: $("#f_progress").value.trim(), waitFor: $("#f_waitFor").value.trim(), dueDate: $("#f_dueDate").value, checkedAt: $("#f_checkedAt").value, deadline: $("#f_deadline").value,
      note: $("#f_note").value.trim(), tags, memo: $("#f_memo").value, updatedAt: now()
    };
    if (patch.status === "watched" && w.status !== "watched") patch.finishedAt = now();
    const el = $("#saved");
    try { await db.doc("works/" + w.id).update(patch); formDirty = false; savedMark = { id: w.id, t: Date.now() }; el.textContent = "保存しました"; setTimeout(() => { if (el.isConnected) el.textContent = ""; }, 2500); }
    catch { el.textContent = "保存できませんでした。もう一度試してください。"; }
  });
  const del = $("#del");
  del.onclick = async () => {
    if (!del.classList.contains("armed")) { del.classList.add("armed"); del.textContent = "本当に削除する"; setTimeout(() => { if (del.isConnected) { del.classList.remove("armed"); del.textContent = "削除"; } }, 4000); return; }
    try { await db.doc("works/" + w.id).delete(); formDirty = false; onGone(); } catch { del.textContent = "削除できませんでした"; }
  };
}
function backToList() {
  const w = works.find(x => x.id === detailId);
  location.hash = w ? ({ watched: "rec", queue: "queue", following: "", waiting: "", dropped: "" }[w.status] ?? "") : "";
}

// ===== 好み（相談タブの固定チャット「好みの分析」の上に出す） =====
const saveTaste = async patch => { await db.doc("profile/taste").set({ ...(taste || {}), ...patch, updatedAt: now() }); };
function drawTaste() {
  const box = $("#tasteBox"); if (!box) return;
  if (taste === null) { box.innerHTML = loadingHtml(); return; }
  const traits = Array.isArray(taste.traits) ? taste.traits : [], learned = Array.isArray(taste.learned) ? taste.learned : [];
  const li = (t, i, key) => `<li><span class="${t.kind === "dislike" ? "dis" : "lik"}">${t.kind === "dislike" ? "苦手" : "好き"}</span><div><div class="tl">${esc(t.label || "")}</div></div><button class="x" type="button" data-key="${key}" data-i="${i}">削除</button><div class="tt">${esc(t.text)}</div></li>`;
  const watched = works.filter(w => w.status === "watched");
  const rows = KINDS.map(([k, l]) => {
    const ws = watched.filter(w => w.kind === k); if (!ws.length) return "";
    const r = ws.filter(w => w.rating != null);
    return `<tr><td>${l}</td><td>${ws.length}</td><td>${r.length ? (r.reduce((s, w) => s + w.rating, 0) / r.length).toFixed(2) : "–"}</td><td>${works.filter(w => w.status === "queue" && w.kind === k).length}</td></tr>`;
  }).join("");
  box.innerHTML = `
    <section class="panel"><h3>好みの傾向</h3>
      ${traits.length ? `<ul class="traits">${traits.map((t, i) => li(t, i, "traits")).join("")}</ul>` : `<p class="empty">まだ傾向がありません。下のフォームか「相談」タブで足せます。</p>`}
      <form class="row" id="tForm" style="align-items:stretch">
        <input class="input" name="label" placeholder="見出し（例: ラブコメ）" style="flex:1 1 9em">
        <select class="input" name="kind" aria-label="好きか苦手か"><option value="like">好き</option><option value="dislike">苦手</option></select>
        <input class="input" name="text" placeholder="具体的に（例: かぐや様・五等分の花嫁）" required style="flex:1 1 100%">
        <button class="btn" type="submit" style="flex:1 1 100%">傾向を追加</button></form>
    </section>
    <section class="panel" id="recBox"></section>
    <section class="panel"><h3>AIが学んだこと</h3>
      ${learned.length ? `<ul class="traits">${learned.map((t, i) => `<li><span class="lik">${esc(t.date || "")}</span><div class="tl" style="font-weight:400">${esc(t.text)}</div><button class="x" type="button" data-key="learned" data-i="${i}">削除</button></li>`).join("")}</ul>` : `<p class="note">見終わった感想から分かったことを、同意のうえでここに足します。</p>`}
    </section>
    <section class="panel"><h3>記録の集計</h3>
      <div class="tblwrap"><table class="stat"><thead><tr><th>種類</th><th>見た</th><th>平均★</th><th>観たい</th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="note">記録がありません</td></tr>`}</tbody></table></div>
    </section>`;
  box.querySelectorAll(".x").forEach(b => b.onclick = async () => {
    if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "本当に削除"; setTimeout(() => { if (b.isConnected) { b.classList.remove("armed"); b.textContent = "削除"; } }, 3500); return; }
    const key = b.dataset.key, arr = (taste[key] || []).filter((_, i) => i !== +b.dataset.i);
    try { await saveTaste({ [key]: arr }); } catch { b.textContent = "失敗"; }
  });
  $("#tForm").addEventListener("submit", async e => {
    e.preventDefault(); const fd = new FormData(e.target), text = String(fd.get("text") || "").trim(); if (!text) return;
    try { await saveTaste({ traits: [...traits, { label: String(fd.get("label") || "").trim(), text, kind: String(fd.get("kind")) }] }); } catch {}
  });
  drawRecs();
}

// ===== 好みに合うおすすめ（好みタブ。タイトルだけ出す。タップ→確認→「観たい」に登録） =====
// AI（相談タブと同じ）が、好みの傾向と高評価の作品から「まだ作品帳にない作品」を選ぶ。結果はこの端末に残し、「別のおすすめ」で入れ替える。
let recs = store.get("recs") || { at: "", items: [] }, recSel = null, recBusy = false, recMsg = "", recTried = false, recAdding = false;
const saveRecs = () => store.set("recs", recs);
const sameTitle = (a, b) => { const x = normT(a), y = normT(b); return x === y || (Math.min(x.length, y.length) >= 5 && (x.includes(y) || y.includes(x))); };
async function genRecs() {
  if (recBusy || !sample || !loaded) return;
  recBusy = true; recMsg = ""; drawRecs();
  try {
    const t = taste || {};
    const traits = (t.traits || []).map(x => `- [${x.kind === "dislike" ? "苦手" : "好き"}] ${x.label ? x.label + "：" : ""}${x.text}`).join("\n") || "（なし）";
    const rated = works.filter(w => w.status === "watched" && w.rating != null);
    const hi = rated.filter(w => w.rating >= 4.3).sort((a, b) => b.rating - a.rating).slice(0, 50).map(w => `${KL[w.kind]}|${w.title}|★${w.rating}`).join("\n") || "（なし）";
    const lo = rated.filter(w => w.rating <= 3).slice(0, 15).map(w => `${KL[w.kind]}|${w.title}|★${w.rating}`).join("\n") || "（なし）";
    const seen = store.get("recs-seen") || [];
    const have = works.map(w => w.title).concat(seen).join("、");
    const res = await sample([{ role: "user", content: `あなたは作品のおすすめを選ぶアシスタントです。下の好みと高評価の作品をもとに、この人がハマりそうな「まだ作品帳にない」作品を12件選んでください。
条件:
- 種類は anime / drama / movie / manga / book のどれか。日本で知られている実在の作品だけ。作品名は正式名称で。
- 【除外】にある作品、およびその続編・同じシリーズは出さない。苦手な傾向や評価の低かった作品に近いものも出さない。
- 好みの強い種類を多めにしてよいが、1種類に偏りすぎない。
- 出力は1行に1作品、「種類|作品名」の形だけ。説明・番号・前置きは書かない。

【好みの傾向】
${traits}

【高評価の作品（種類|作品名|★）】
${hi}

【評価が低かった作品】
${lo}

【除外（すでに作品帳にある作品・前に出した作品）】
${have}` }], {});
    const items = [];
    String(res.text || "").split("\n").forEach(line => {
      const m = line.match(/^[\s\-*・\d.)）]*(anime|drama|movie|manga|book)\s*[|｜]\s*(.+?)\s*$/i); if (!m) return;
      const title = m[2].replace(/^[「『]|[」』]$/g, "").trim(), kind = m[1].toLowerCase();
      if (!title || works.some(w => sameTitle(w.title, title)) || seen.some(s => sameTitle(s, title)) || items.some(x => sameTitle(x.title, title))) return;
      items.push({ title, kind });
    });
    const shown = items.slice(0, 10);
    if (!shown.length) recMsg = "おすすめを作れませんでした。もう一度「別のおすすめ」を押してください。";
    else { recs = { at: now(), items: shown }; saveRecs(); store.set("recs-seen", seen.concat(shown.map(x => x.title)).slice(-80)); recSel = null; }
  } catch (e) { recMsg = e?.code === "no_key" ? "GeminiのAPIキーが未設定です（設定が終わるとおすすめが出ます）。" : e?.code === "rate_limited" ? "AIの無料枠の上限に達しました。しばらくしてから試してください。" : "おすすめを作れませんでした。もう一度試してください。" + (e?.message ? "（" + String(e.message).slice(0, 80) + "）" : ""); }
  recBusy = false; drawRecs();
}
function drawRecs() {
  const el = $("#recBox"); if (!el) return;
  if (!recs.items.length && !recBusy && !recTried && sampleState === "ready" && loaded) { recTried = true; genRecs(); return; }
  const sel = recSel && recs.items.find(x => x.title === recSel), canGen = !recBusy && sampleState === "ready" && loaded;
  el.innerHTML = `<div class="rechead"><h3>好みに合いそうな作品</h3><button class="linkbtn" type="button" id="recMore" ${canGen ? "" : "disabled"}>${recBusy ? "考え中…" : "別のおすすめ"}</button></div>` +
    (recs.items.length ? `<div class="recs">${recs.items.map(x => `<button type="button" class="rec ${sel && sel.title === x.title ? "on" : ""}" data-t="${esc(x.title)}">${esc(x.title)}</button>`).join("")}</div>`
      : `<p class="note">${recBusy ? "好みと高評価の作品から選んでいます…（最大1分ほどかかります）" : sampleState === "off" ? "AIを呼び出せません。" : "「別のおすすめ」を押すと出ます。"}</p>`) +
    (sel ? `<div class="recask"><div><b>${esc(sel.title)}</b> <span class="meta">${esc(KL[sel.kind] || "")}</span></div><p>この作品を見たいリストに登録しますか？</p><div class="row"><button class="btn" type="button" id="recYes" ${recAdding ? "disabled" : ""}>登録する</button><button class="btn ghost" type="button" id="recNo">やめる</button></div></div>` : "") +
    (recMsg ? `<p class="${recMsg.endsWith("登録しました。") ? "ok" : "msg"}">${esc(recMsg)}</p>` : "");
  el.querySelectorAll(".rec").forEach(b => b.onclick = () => { recSel = recSel === b.dataset.t ? null : b.dataset.t; recMsg = ""; drawRecs(); });
  const more = $("#recMore"); if (more) more.onclick = () => genRecs();
  const no = $("#recNo"); if (no) no.onclick = () => { recSel = null; drawRecs(); };
  const yes = $("#recYes"); if (yes) yes.onclick = async () => {
    if (!sel || !db || recAdding) return;
    recAdding = true; drawRecs();
    try {
      if (!works.some(w => sameTitle(w.title, sel.title))) await db.collection("works").add(newWork({ title: sel.title, kind: sel.kind, status: "queue", source: "おすすめ" }));
      recs.items = recs.items.filter(x => x.title !== sel.title); saveRecs(); recSel = null; recMsg = `「${sel.title}」を観たいに登録しました。`;
    } catch { recMsg = "登録できませんでした。もう一度試してください。"; }
    recAdding = false; drawRecs();
  };
}

// ===== 相談（チャット） =====
// 毎回、作品ログ・好み・追いかけ状況をまとめて渡す（AIは会話をまたいで記憶しないため）。
let sampleState = "ready";
// Gemini（キーはサーバー側。画面には出ない）。以前の sample(messages, { tools, signal }) と同じ呼び方で使える
const toGeminiSchema = x => {
  if (!x || typeof x !== "object") return x;
  const o = {};
  for (const [k, v] of Object.entries(x)) {
    if (k === "type") o.type = String(v).toUpperCase();
    else if (k === "properties") o.properties = Object.fromEntries(Object.entries(v).map(([a, b]) => [a, toGeminiSchema(b)]));
    else if (k === "items") o.items = toGeminiSchema(v);
    else if (k === "description" || k === "enum" || k === "required") o[k] = v;
  }
  return o;
};
async function sample(messages, opts = {}) {
  const tools = opts.tools || [];
  const decl = tools.map(t => ({ name: t.name, description: t.description, parameters: toGeminiSchema(t.inputSchema) }));
  const contents = [];
  messages.forEach(m => {   // 同じ役割が続くときは1つにまとめる
    const role = m.role === "assistant" ? "model" : "user", last = contents[contents.length - 1];
    if (last && last.role === role && last.parts.every(p => p.text !== undefined)) last.parts.push({ text: "\n\n" + m.content }); else contents.push({ role, parts: [{ text: m.content }] });
  });
  for (let step = 0; step < 6; step++) {
    if (opts.signal && opts.signal.aborted) throw Object.assign(new Error("cancelled"), { code: "cancelled" });
    const r = await rpc("geminiStep", contents, decl);
    if (opts.signal && opts.signal.aborted) throw Object.assign(new Error("cancelled"), { code: "cancelled" });
    if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
    const parts = r.parts || [], calls = parts.filter(p => p.functionCall);
    contents.push({ role: "model", parts });
    if (!calls.length) return { text: parts.map(p => p.text || "").join(""), truncated: r.finishReason === "MAX_TOKENS" };
    const out = [];
    for (const c of calls) {
      const t = tools.find(x => x.name === c.functionCall.name); let resp;
      try { resp = t ? await t.execute(c.functionCall.args || {}) : { error: "unknown tool" }; } catch (e) { resp = { error: String(e.message || e) }; }
      out.push({ functionResponse: { name: c.functionCall.name, response: resp } });
    }
    contents.push({ role: "user", parts: out });
  }
  return { text: "（操作が多かったため、途中で止めました。もう一度伝えてください）" };
}
// チャットは1つずつ別々に保存する（chats: { id, title, kind(taste/services/free), updatedAt, turns, log }）。「好みの分析」「視聴できる配信サイト」は固定
let turns = [], chatLog = [], chatBusy = false, chatCtl = null, chatDraft = "";
const PIN = { taste: { title: "好みの分析", sub: "好みの傾向を見る・分析する・おすすめを出す", icon: "♥" }, services: { title: "視聴できる配信サイト", sub: "契約中・無料の配信サイトを管理。無料のおすすめも追加", icon: "▶" } };
function getChat(id) {
  let c = chats.find(x => x.id === id);
  if (!c) { c = { id, title: PIN[id] ? PIN[id].title : "新規相談", kind: PIN[id] ? id : "free", updatedAt: "", turns: [], log: [] }; chats.push(c); }
  return c;
}
function packChat(c) {
  const o = { id: c.id, title: c.title, kind: c.kind, updatedAt: c.updatedAt, turns: (c.turns || []).slice(-16).map(t => ({ ...t, content: String(t.content || "").slice(0, 1500) })), log: (c.log || []).slice(-24).map(m => ({ ...m, text: String(m.text || "").slice(0, 1500) })) };
  while (JSON.stringify(o).length > 45000 && (o.log.length > 4 || o.turns.length > 4)) { if (o.log.length > 4) o.log.shift(); if (o.turns.length > 4) o.turns.shift(); }
  return o;
}
let saveTimer = 0;
const saveChat = () => {
  const c = chats.find(x => x.id === chatId); if (!c) return;
  c.turns = turns; c.log = chatLog; c.updatedAt = now();
  if (c.kind === "free" && c.title === "新規相談" && turns[0]) c.title = String(turns[0].content).replace(/\s+/g, " ").slice(0, 24);
  clearTimeout(saveTimer); const snap = clean(packChat(c)); saveTimer = setTimeout(() => rpc("saveChat", snap).catch(() => {}), 600);
};

const RULES = `あなたは、この家庭専用のAI作品アシスタントです。スマホの作品帳アプリの「相談」画面で、ユーザーと日本語で話します。
アニメ・ドラマ・映画・漫画・本の「次に何を見る／読むか」を決めたり、追いかけ中の作品の状況を思い出したりするのを手伝います。
後ろに【作品データ】（見終わった作品と★、観たい作品、追いかけ中・リリース待ち・配信終了の作品、好みの傾向）を付けます。必ずそれを根拠にしてください。記憶や一般論から始めません。

## 「作品セッション」「次に見るもの」と言われたとき
リマインドを次の4種類の順に確認して、短く報告する。該当がなければその種類は飛ばす。
1. 追いかけ中: 各作品の現在地を伝え、続きを見るよう促す。
2. リリース待ち: 予定日が近い／過ぎているものを挙げる。「確認した日」が古いものは、最新の公開予定日をあなたは調べられないので、画面右上の「今すぐ更新」を押すよう案内する。
3. 配信終了・見逃し: 終了日が近いものを挙げる。
4. 積みの消化: 観たい作品から、好みの傾向に合うものを数件挙げる。
そのあと、おすすめを出す。

## おすすめの出し方
- 根拠は、★4.5以上の高評価作品と【好みの傾向】。なぜ薦めるか（どの見た作品と何が近いか）を必ず1行添える。
- まず「観たい」の中から薦める。合うものが無いときだけ、新規の作品を提案する（新規を出すときは作品名と種類だけを短く）。
- ★3.0以下や「苦手」の傾向に近い作品は避ける。
- ネタバレは出さない。あらすじは公式の紹介文程度。追いかけ中の作品は「次の区切り」以外の展開に触れない。
- あなたはネット検索はできない。新作・最新話・配信状況・公開日は分からないので、推測で言わず、画面右上の「今すぐ更新」を押すよう案内する。

## 記録の更新
- ユーザーが「見る／読む」と決めた作品 → add_work（status=queue）。
- 「見始めた」→ update_work（status=following、現在地）。
- 「見終わった／読み終わった」→ ★（0〜5、0.1刻み。Filmarksの点数に合わせてよい）を言われていなければ聞き、update_work（status=watched、rating、一言）。観たいや追いかけ中に無い作品は add_work で status=watched にして追加する。
- ユーザーが明言したときだけ書き込む。あいまいなら先に確認する。同じ作品が既にあるときは update_work を使う（idは【作品データ】にある）。
- ユーザーが「◯◯が◯月◯日まで配信」のように期間限定配信を教えてくれたら、update_work（作品帳に無ければ add_work）の deadline に YYYY-MM-DD で入れる。追いかけタブの上の「期間限定」に出る。\n- 感想から一般化できる好みの傾向があれば1〜2行で提案し、ユーザーが同意したら add_taste で保存する。同意前に保存しない。

## 毎日の夜8時リスト
- 【作品データ】の「毎日の夜8時」は、曜日ごとに、その日の夜8時までに更新されているNetflix・Hulu・TVerの毎週配信作品を決めたリスト（1日に複数あってよい）。「今夜は何を見る？」と聞かれたら、今日の曜日の作品と次の話数を答える。
- 最終回が近い・最終話まで見た・未設定の曜日があれば知らせる。「次の候補」が登録されていれば、好みの傾向に沿って1つ薦め、「追いかけタブの『これにする』で決められる」と案内する。
- TVerの候補は、放送直後に配信される。夜に放送されるドラマは、翌日の夜8時に見る前提で曜日を決めてある（候補の説明に「→ ◯曜の夜に見られる」と書いてある）。
- 候補が無いときは、あなたはネット検索ができないので、画面右上の「今すぐ更新」を押すよう案内する（候補は自動では増えない。ユーザーが作品を追加する）。配信曜日・話数・最終回の日は推測で言わない。

- 作品の「最新 第N話」は、毎朝の自動更新（Filmarks・AniListから取得）が更新する値。「未確認」のときは話数を推測せず、「話数の数字をタップして直接直せます。右上の『今すぐ更新』でも取り直せます」と案内する。「視聴済み／未視聴」は、見たボタンのスタンプ（最新話まで見たか）。

## 作品名のタップ
- 返事の中の作品名は必ず [[作品名]] の形で書く（画面で青文字のボタンになり、タップすると「〇〇について教えて。どこで見られる？」が届く）。作品名以外には [[ ]] を使わない。
- 「〇〇について教えて。どこで見られる？」と聞かれたら、短く次の順で答える。
  1. 種類と、公式紹介文レベルのひとこと（ネタバレなし）。作品帳に★・一言・参考スコアがあれば添える。
  2. 見られる場所: 【作品データ】の見られる場所（service）に書いてあればそれを伝える。無いときは、配信状況はあなたには確認できないと正直に言い、「普段使っているNetflixやHuluの検索で探すのが早い」と案内する。推測で配信先を断定しない。
  3. 「見終わったら、★（0〜5）と一言を教えてくださいね。作品帳に記録します」と伝える。
  4. まだ作品帳に無い作品なら「観たいに入れますか？」と聞く（同意したら add_work）。

## 重複の整理（削除）
- 同じ作品が2件あるとき（同名・表記ゆれ・観たいと見たの二重登録）は、まず2件のid・状態・★・一言を見せて、どちらを残すか提案する。基本は、★や一言が入っている方を残す。
- 残す方に足りない情報（★・参考スコア・一言・メモ）は update_work で移してから、ユーザーが「消して」「それでいい」と明言したときだけ delete_work で消す。同意なしに消さない。消した作品は画面の「元に戻す」で戻せると伝える。
- シリーズの別シーズン・別巻、映画と本のように別の媒体は重複ではない。

返事は短く、スマホで読みやすく。見出しは使わず、太字（**）と箇条書き（- ）程度にする。`;

const KIND_RULES = {
  free: "",
  taste: `

## このチャットは「好みの分析」
- 【作品データ】の見た作品の★、好みの傾向、AIが学んだことを根拠に、この人の好みを分析する。「何が好きか」「苦手か」「最近の変化」を、根拠の作品名つきで短く述べる。
- 新しく分かった傾向は1〜2行で提案し、ユーザーが同意したら add_taste で保存する。同意前に保存しない。
- 好みに合う作品を薦めるときは、作品名を [[ ]] で書く（タップで観たいに登録できる）。`,
  services: `

## このチャットは「視聴できる配信サイト」
- 【作品データ】の「利用している配信サイト」が、このユーザーが使えるサービス。有料会員（paid）は契約中、free は無料で使えるもの、rec は無料のおすすめ（まだ使っていない）。
- ユーザーが頼んだとき、無料で見られる配信サイトやおすすめの無料サービス（例: TVer、ABEMA、Prime Videoの無料枠、YouTubeの公式無料配信、GYAO!のような終了済みでないもの）を、好みに合う理由つきで薦め、add_service（type=rec）で追加する。実在して今も使えるものだけ。サービスの配信作品・配信期間は、あなたには調べられないので、推測で断定しない。
- 契約の変更（解約・追加）をユーザーが言ったときは add_service / remove_service で更新する。「◯月◯日まで契約」のような期限は until に入れる。\n- 期限つきの契約（例: U-NEXT 〜11/12）があるときは、【作品データ】の「期限つきの配信サイトで見放題の観たい作品」から、期限までに見る候補を、好みに合う理由つきで薦める。`
};
const byScore = (a, b) => (b.rating ?? -1) - (a.rating ?? -1);
function buildContext() {
  const sec = s => works.filter(w => w.status === s);
  const watched = sec("watched").sort(byScore);
  const line = w => `${w.id}|${KL[w.kind] || ""}|${w.title}|${w.rating != null ? "★" + w.rating : "未採点"}${w.note ? "|" + w.note : ""}${w.service ? "|見られる場所: " + w.service : ""}`;
  const q = sec("queue").sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  const t = taste || {};
  const traits = (t.traits || []).map(x => `- [${x.kind === "dislike" ? "苦手" : "好き"}] ${x.label ? x.label + "：" : ""}${x.text}`).join("\n") || "（まだなし）";
  const learned = (t.learned || []).map(x => `- ${x.text}（${x.date || ""}）`).join("\n") || "（まだなし）";
  return `【作品データ】（${today()} 時点）
■好みの傾向
${traits}
■AIが学んだこと
${learned}
■利用している配信サイト（paid=契約中の有料, free=無料, rec=無料のおすすめ）
${services.map(x => `${x.type}|${x.name}${x.until ? "|〜" + x.until + (svcActive(x) ? "" : "（終了済み）") : ""}${x.note ? "|" + x.note : ""}`).join("\n") || "（まだ登録なし）"}
■期限つきの配信サイトで見放題の「観たい」作品（Filmarks調べ。契約の期限までに見る候補）
${services.filter(x => x.until && svcActive(x)).map(x => `${x.name}（〜${x.until}）: ${svcTitles(x).map(w => w.title).join("、") || "まだ調べていない"}`).join("\n") || "（なし）"}
■追いかけ中
${sec("following").map(w => `${w.id}|${KL[w.kind]}|${w.title}|現在地: ${w.progress || "未記入"}${w.service ? "|" + w.service : ""}${w.memo ? "|" + w.memo : ""}`).join("\n") || "（なし）"}
■リリース待ち
${sec("waiting").map(w => `${w.id}|${KL[w.kind]}|${w.title}|待っているもの: ${w.waitFor || "未記入"}|予定日: ${w.dueDate || "未定"}|確認日: ${w.checkedAt || "未確認"}`).join("\n") || "（なし）"}
■配信終了・見逃し注意
${works.filter(w => w.deadline && w.status !== "watched" && w.status !== "dropped").map(w => `${w.id}|${KL[w.kind]}|${w.title}|${w.service || ""}|終了日: ${w.deadline}`).join("\n") || "（なし）"}
■中断・合わなかった
${sec("dropped").map(w => `${w.id}|${KL[w.kind]}|${w.title}${w.memo ? "|" + w.memo : ""}`).join("\n") || "（なし）"}
■毎日の夜8時（曜日ごとの配信作品。今日は${DL[todayKey()]}曜）
${DAYS.map(([k, l]) => { const its = itemsOf(daily[k]); return its.length ? its.map(s => { const st = itemState(s); return `${l}|${s.title}|${s.service || ""}|最新 ${s.latest ? "第" + s.latest + "話" : "未確認"}${s.total ? "/全" + s.total + "話" : ""}|${isSeen(k, s) ? "視聴済み" : "未視聴"}${s.finalDate ? "|最終回 " + s.finalDate : ""}${s.filmarks != null ? "|Filmarks★" + s.filmarks : ""}${availOf(s).length ? "|見る場所: " + availOf(s).map(k => SVC[k].label).join("・") : ""}${STATE_LABEL[st] ? "|" + STATE_LABEL[st] : ""}`; }).join("\n") : `${l}|未設定`; }).join("\n")}
■次の候補（選ぶのは追いかけタブの「これにする」→「確定する」）
${cands.map(c => `${DL[c.day] || c.day}|${c.title}|${KL[c.kind] || ""}|${c.service || ""}|${c.airNote || ""}${c.total ? "|全" + c.total + "話" : ""}${c.filmarks != null ? "|Filmarks★" + c.filmarks : ""}${availOf(c).length ? "|見る場所: " + availOf(c).map(k => SVC[k].label).join("・") : ""}${c.why ? "|" + c.why : ""}`).join("\n") || "（なし）"}
■観たい・読みたい（${q.length}件。id|種類|作品名|参考スコア）
${q.map(w => `${w.id}|${KL[w.kind]}|${w.title}|${w.avg != null ? w.avg : "-"}${w.service ? "|見られる場所: " + w.service : ""}`).join("\n") || "（なし）"}
■見た・読んだ（${watched.length}件、★の高い順。id|種類|作品名|★|一言）
${watched.map(line).join("\n") || "（なし）"}`;
}
function logLine(text, workId, undoId) { chatLog.push({ kind: "log", text, workId, undoId }); saveChat(); drawChatLog(); }
const normT = s => String(s || "").replace(/\s+/g, "").toLowerCase();
const strArr = v => Array.isArray(v) ? v.map(String).filter(Boolean) : [];
const KIND_ENUM = KINDS.map(k => k[0]), STATUS_ENUM = STATUS.map(s => s[0]);
const WORK_PROPS = {
  kind: { type: "string", enum: KIND_ENUM, description: "anime/drama/movie/manga/book/other" },
  status: { type: "string", enum: STATUS_ENUM, description: "watched=見た・読んだ, queue=観たい, following=追いかけ中, waiting=リリース待ち, dropped=中断" },
  rating: { type: "number", description: "自分の★ 0〜5（0.1刻み）" }, avg: { type: "number", description: "参考スコア（Filmarks平均など）" },
  note: { type: "string", description: "一言" }, memo: { type: "string", description: "感想・メモ" }, tags: { type: "array", items: { type: "string" } },
  service: { type: "string" }, creator: { type: "string" }, period: { type: "string", description: "見た時期 例: 2026-10" },
  progress: { type: "string", description: "追いかけ中の現在地 例: 第17話まで" }, waitFor: { type: "string" }, dueDate: { type: "string", description: "YYYY-MM-DD" }, deadline: { type: "string", description: "配信終了日 YYYY-MM-DD" }
};
function pickPatch(i) {
  const p = {};
  for (const k of ["title", "note", "memo", "service", "creator", "period", "progress", "waitFor", "dueDate", "deadline"]) if (i[k] !== undefined) p[k] = String(i[k]);
  if (KIND_ENUM.includes(i.kind)) p.kind = i.kind;
  if (STATUS_ENUM.includes(i.status)) p.status = i.status;
  if (i.rating !== undefined) p.rating = num(i.rating);
  if (i.avg !== undefined) p.avg = num(i.avg);
  if (i.tags !== undefined) p.tags = strArr(i.tags);
  return p;
}
const TOOLS = [
  {
    name: "add_work", description: "作品を作品帳に追加する。同じ作品名がすでにあれば追加せず、そのidを返す（その場合は update_work を使う）。",
    inputSchema: { type: "object", properties: { title: { type: "string" }, ...WORK_PROPS }, required: ["title", "kind", "status"] },
    async execute(i) {
      const title = String(i.title || "").trim(); if (!title) throw new Error("作品名が空です");
      const same = works.find(w => normT(w.title) === normT(title));
      if (same) return { exists: true, id: same.id, status: same.status };
      const doc = newWork({ ...pickPatch(i), title, source: "作品帳AI" });
      if (doc.status === "watched") { doc.finishedAt = now(); if (!doc.period) doc.period = today().slice(0, 7); }
      const ref = await db.collection("works").add(doc);
      logLine(`追加しました: ${title}（${SL[doc.status]}）`, ref.id);
      return { saved: true, id: ref.id };
    }
  },
  {
    name: "update_work", description: "作品帳の作品1件を更新する（状態の変更、★、一言、現在地など）。idは【作品データ】にある。",
    inputSchema: { type: "object", properties: { work_id: { type: "string" }, ...WORK_PROPS, title: { type: "string" } }, required: ["work_id"] },
    async execute(i) {
      const w = works.find(x => x.id === String(i.work_id)); if (!w) throw new Error("そのidの作品はありません");
      const patch = { ...pickPatch(i), updatedAt: now() };
      if (patch.status === "watched" && w.status !== "watched") { patch.finishedAt = now(); if (!patch.period && !w.period) patch.period = today().slice(0, 7); }
      await db.doc("works/" + w.id).update(patch);
      logLine(`更新しました: ${patch.title || w.title}${patch.status ? "（" + SL[patch.status] + "）" : ""}${patch.rating != null ? " ★" + patch.rating : ""}`, w.id);
      return { ok: true };
    }
  },
  {
    name: "delete_work", description: "作品帳から作品を1件削除する（重複や誤登録の整理用）。ユーザーが「消して」「その案でいい」などと明確に同意した後だけ使う。削除前の内容はゴミ箱（trash）に控えが残り、チャットの「元に戻す」で復元できる。残す方の作品に移したい情報（★・一言・メモなど）は、先に update_work で移しておく。状態の変更には使わない。",
    inputSchema: { type: "object", properties: { work_id: { type: "string" }, reason: { type: "string", description: "例: 同じ作品の重複（残す方: w102）" } }, required: ["work_id", "reason"] },
    async execute(i) {
      const w = works.find(x => x.id === String(i.work_id)); if (!w) throw new Error("そのidの作品はありません");
      const copy = { ...w }; delete copy.id;
      await db.doc("trash/" + w.id).set({ ...copy, deletedAt: now(), deleteReason: String(i.reason || "") });
      await db.doc("works/" + w.id).delete();
      logLine(`削除しました: ${w.title}（${SL[w.status] || ""}）`, null, w.id);
      return { deleted: true, id: w.id, title: w.title };
    }
  },
  {
    name: "add_taste", description: "「AIが学んだこと」に好みの傾向を1件追加する。ユーザーが同意した後だけ使う。",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    async execute(i) {
      const text = String(i.text || "").trim(); if (!text) throw new Error("空です");
      await saveTaste({ learned: [...(Array.isArray(taste?.learned) ? taste.learned : []), { text, date: today() }] });
      logLine("好みに追加: " + text); return { ok: true };
    }
  },
  {
    name: "add_service", description: "視聴できる配信サイトの一覧に1件追加する（契約中の有料・無料・無料のおすすめ）。同じ名前があれば種類・期限・メモを更新する。契約の期限（いつまで契約しているか）が分かるときは until に YYYY-MM-DD で入れる。ユーザーが頼んだとき、または同意したときだけ使う。",
    inputSchema: { type: "object", properties: { name: { type: "string" }, type: { type: "string", enum: ["paid", "free", "rec"], description: "paid=契約中の有料, free=無料で使っている, rec=無料のおすすめ（まだ使っていない）" }, note: { type: "string", description: "どんな作品が見られるか、無料の条件など" }, until: { type: "string", description: "契約・無料期間の最終日 YYYY-MM-DD（無いときは空）" } }, required: ["name", "type"] },
    async execute(i) {
      const name = String(i.name || "").trim(); if (!name) throw new Error("名前が空です");
      const type = ["paid", "free", "rec"].includes(i.type) ? i.type : "rec", note = String(i.note || ""), until = /^\d{4}-\d{2}-\d{2}$/.test(String(i.until || "")) ? String(i.until) : "";
      const ex = services.find(x => normT(x.name) === normT(name));
      if (ex) { ex.type = type; if (note) ex.note = note; if (until) ex.until = until; } else services.push({ name, type, key: "", note, until, addedAt: today() });
      await saveServicesList(); logLine(`配信サイトに追加: ${name}（${{ paid: "契約中", free: "無料", rec: "無料のおすすめ" }[type]}）`); return { ok: true };
    }
  },
  {
    name: "remove_service", description: "視聴できる配信サイトの一覧から1件消す。ユーザーが「やめた」「消して」と明言したときだけ使う。",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    async execute(i) {
      const name = String(i.name || "").trim(), n = services.length;
      services = services.filter(x => normT(x.name) !== normT(name)); if (services.length === n) throw new Error("その名前の配信サイトはありません");
      await saveServicesList(); logLine("配信サイトから削除: " + name); return { ok: true };
    }
  }
];
const saveServicesList = async () => { refresh(); await rpc("saveServices", clean(services)); };
// 返事の中の作品名（[[作品名]]、または作品帳にある作品名の太字）は、タップできる青文字のボタンにする
const unesc = s => s.replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
const wkBtn = x => `<button type="button" class="wk" data-t="${x}">${x}</button>`;
const mdLite = t => esc(t)
  .replace(/\[\[(.+?)\]\]/g, (m, x) => wkBtn(x))
  .replace(/\*\*(.+?)\*\*/g, (m, x) => works.some(w => normT(w.title) === normT(unesc(x))) ? wkBtn(x) : `<strong>${x}</strong>`)
  .replace(/^#{1,6}\s*/gm, "");
// 相談の一覧: 固定の2つ（好みの分析・視聴できる配信サイト）と、ふつうの相談
function renderChatList() {
  app.innerHTML = header("チャット", "chat") + `<div class="clist" id="clist"></div><a class="btn ghost" id="sheetLink" href="${esc(sheetUrl)}" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none;margin-top:14px">データのスプレッドシートを開く ↗</a>`;
  bindTabs(); drawChatList();
}
function drawChatList() {
  const el = $("#clist"); if (!el) return;
  const paid = services.filter(x => x.type === "paid").map(x => x.name), free = services.filter(x => x.type !== "paid").map(x => x.name);
  const pinMeta = { taste: PIN.taste.sub, services: `契約中: ${paid.join("・") || "未登録"}${free.length ? " ／ 無料: " + free.join("・") : ""}` };
  const frees = chats.filter(c => c.kind === "free" && ((c.log || []).length || (c.turns || []).length)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const d = u => { const t = Date.parse(u); if (isNaN(t)) return ""; const x = new Date(t); return `${x.getMonth() + 1}/${x.getDate()}`; };
  el.innerHTML = ["taste", "services"].map(k => `<button class="citem pin" type="button" data-go="${k}"><span class="cico">${PIN[k].icon}</span><span class="ctx"><b>${PIN[k].title}</b><span class="meta">${esc(pinMeta[k])}</span></span></button>`).join("") +
    `<button class="btn newc" type="button" id="newC">＋ 新規相談</button>` +
    (frees.length ? `<h3 class="chead">これまでの相談</h3>` : `<p class="note">「新規相談」で、次に見るものや記録の相談を別のチャットとして始められます。</p>`) +
    frees.map(c => { const last = [...(c.log || [])].reverse().find(m => m.kind === "ai" || m.kind === "me"); return `<div class="citem"><button class="ctx2" type="button" data-go="${esc(c.id)}"><b>${esc(c.title)}</b><span class="meta">${esc(d(c.updatedAt))} ・ ${esc(String(last ? last.text : "").replace(/\s+/g, " ").slice(0, 40))}</span></button><button class="linkbtn" type="button" data-del="${esc(c.id)}">削除</button></div>`; }).join("");
  el.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { location.hash = "chat-" + b.dataset.go; });
  $("#newC").onclick = () => { location.hash = "chat-c" + Date.now().toString(36); };
  el.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "本当に削除"; setTimeout(() => { if (b.isConnected) { b.classList.remove("armed"); b.textContent = "削除"; } }, 3500); return; }
    const id = b.dataset.del; chats = chats.filter(x => x.id !== id); drawChatList(); rpc("removeChat", id).catch(() => {});
  });
}
const startersFor = kind => ({
  taste: ["私の好みを分析して", "最近見た作品から、傾向の変化を教えて", "好みに合う新作を教えて"],
  services: ["無料で見られる配信サイトのおすすめを調べて追加して", "今の契約で足りない配信はある？", "TVerやABEMAで見られるおすすめは？"],
  free: ["作品セッションをしたい", "今夜、1本見るなら？", "見終わった作品を記録したい", "積みの中から今の気分で選んで"]
})[kind] || [];
// 配信サイトの管理（手で追加・削除。AIにも頼める）
function drawServices() {
  const box = $("#svcBox"); if (!box) return;
  const grp = (t, l) => { const xs = services.map((x, i) => [x, i]).filter(([x]) => x.type === t); return `<div class="svcg"><b class="svct">${l}</b>${xs.length ? `<div class="svcrow">${xs.map(([x, i]) => `<span class="svcchip ${t} ${x.until && !svcActive(x) ? "exp" : ""}" title="${esc(x.note || "")}">${esc(x.name)}${x.until ? `<small>${svcActive(x) ? "〜" + Number(x.until.slice(5, 7)) + "/" + Number(x.until.slice(8, 10)) : "終了"}</small>` : ""}<button type="button" data-sx="${i}" aria-label="削除">×</button></span>`).join("")}</div>` : `<span class="note">なし</span>`}</div>`; };
  box.innerHTML = grp("paid", "契約中（有料）") + grp("free", "無料で使っている") + grp("rec", "おすすめ（無料・これから）") +
    `<form class="row" id="svcForm"><input class="input" name="name" placeholder="配信サイト名（例: U-NEXT）" required style="flex:1 1 9em"><select class="input" name="type"><option value="paid">契約中（有料）</option><option value="free">無料</option><option value="rec">おすすめ</option></select><label class="note" style="display:flex;gap:6px;align-items:center">いつまで（任意）<input class="input" type="date" name="until"></label><button class="btn" type="submit">追加</button></form>`;
  box.querySelectorAll("[data-sx]").forEach(b => b.onclick = () => { services.splice(+b.dataset.sx, 1); saveServicesList().catch(() => {}); });
  $("#svcForm").addEventListener("submit", e => {
    e.preventDefault(); const fd = new FormData(e.target), name = String(fd.get("name") || "").trim(); if (!name) return;
    const until = String(fd.get("until") || ""), ex = services.find(x => normT(x.name) === normT(name)); if (ex) { ex.type = String(fd.get("type")); ex.until = until; } else services.push({ name, type: String(fd.get("type")), key: "", note: "", until, addedAt: today() });
    saveServicesList().catch(() => {});
  });
}
function renderChat() {
  const c = getChat(chatId); turns = c.turns || (c.turns = []); chatLog = c.log || (c.log = []);
  app.innerHTML = `<form class="composer topbar" id="composer"><textarea id="chatInput" rows="1" placeholder="${c.kind === "taste" ? "例: 私の好みを分析して" : c.kind === "services" ? "例: 無料のおすすめを追加して" : "例: 作品セッションをしたい"}"></textarea><button class="btn" type="submit" id="sendBtn">送信</button></form>` + header("", "chat") + `
    <div class="chat-head"><button class="linkbtn" type="button" id="backList">← 一覧</button><b class="ctitle">${esc(c.title)}</b><button class="linkbtn" type="button" id="newChat">この会話を消す</button></div>` +
    (c.kind === "taste" ? `<details class="fold" id="tasteFold" ${store.get("tasteFold") === "closed" ? "" : "open"}><summary>好みの傾向とおすすめ</summary><div id="tasteBox" style="display:grid;gap:12px"></div></details>` : "") +
    (c.kind === "services" ? `<details class="fold" open><summary>登録している配信サイト</summary><div id="svcBox"></div></details>` : "") +
    `<div class="chat" id="chatLog"></div><div class="starters" id="starters"></div>`;
  bindTabs();
  const fold = $("#tasteFold"); if (fold) fold.addEventListener("toggle", () => store.set("tasteFold", fold.open ? "open" : "closed"));
  const input = $("#chatInput"), grow = () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 150) + "px"; };
  input.oninput = grow;
  if (chatDraft) { input.value = chatDraft; chatDraft = ""; setTimeout(() => { input.focus(); grow(); }, 50); }
  $("#composer").addEventListener("submit", e => { e.preventDefault(); if (chatBusy) chatCtl?.abort(); else send(input.value); });
  input.onkeydown = e => { if (isEnter(e) && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(input.value); } };
  $("#backList").onclick = () => { location.hash = "chat"; };
  $("#newChat").onclick = () => { if (chatBusy) return; turns = []; chatLog = []; saveChat(); drawChatLog(); };
  if (c.kind === "taste") drawTaste(); if (c.kind === "services") drawServices();
  drawChatLog(); scTo(document.body.scrollHeight);
}
function drawChatLog(streamText) {
  const el = $("#chatLog"); if (!el) return;
  const starters = $("#starters"), sb = $("#sendBtn"); if (sb) sb.textContent = chatBusy ? "停止" : "送信";
  if (sampleState === "off") { el.innerHTML = `<p class="msg">AIを呼び出せません。</p>`; if (starters) starters.innerHTML = ""; return; }
  el.innerHTML = chatLog.map(m => {
    if (m.kind === "log") return `<div class="bubble log">${esc(m.text)}${m.workId ? ` <a href="#w-${esc(m.workId)}">開く</a>` : ""}${m.undoId && !m.undone ? ` <button class="linkbtn" type="button" data-undo="${esc(m.undoId)}">元に戻す</button>` : ""}</div>`;
    if (m.kind === "err") return `<div class="bubble err">${esc(m.text)}</div>`;
    return `<div class="bubble ${m.kind}">${m.kind === "ai" ? mdLite(m.text) : esc(m.text)}</div>`;
  }).join("") + (chatBusy ? (streamText ? `<div class="bubble ai">${mdLite(streamText)}</div>` : `<div class="thinking">考えています…（作品ログと好みを確認中。最大1分ほどかかります）</div>`) : "");
  el.querySelectorAll(".wk").forEach(b => b.onclick = () => send(`「${b.dataset.t}」について教えて。どこで見られる？`));
  el.querySelectorAll("[data-undo]").forEach(b => b.onclick = async () => {
    const id = b.dataset.undo; b.disabled = true;
    try {
      const s = await db.doc("trash/" + id).get(); if (!s.exists) throw new Error("none");
      const d = { ...s.data() }; delete d.deletedAt; delete d.deleteReason;
      await db.doc("works/" + id).set(d); await db.doc("trash/" + id).delete();
      chatLog.forEach(m => { if (m.undoId === id) m.undone = true; });
      chatLog.push({ kind: "log", text: "元に戻しました" }); saveChat(); drawChatLog();
    } catch { b.disabled = false; chatLog.push({ kind: "err", text: "元に戻せませんでした。" }); saveChat(); drawChatLog(); }
  });
  if (starters) {
    starters.innerHTML = chatBusy || chatLog.length ? "" : startersFor((chats.find(x => x.id === chatId) || {}).kind || "free").map(t => `<button type="button">${t}</button>`).join("");
    starters.querySelectorAll("button").forEach(b => b.onclick = () => send(b.textContent));
  }
}
async function send(text) {
  text = String(text || "").trim();
  if (!text || chatBusy || !sample || dbState !== "ready") return;
  const input = $("#chatInput"); if (input) { input.value = ""; input.style.height = "auto"; }
  chatLog.push({ kind: "me", text }); turns.push({ role: "user", content: text });
  chatBusy = true; chatCtl = new AbortController(); saveChat(); drawChatLog(); scTo(document.body.scrollHeight);
  let last = "";
  try {
    const res = await sample([{ role: "user", content: RULES + (KIND_RULES[(chats.find(x => x.id === chatId) || {}).kind || "free"] || "") + "\n\n" + buildContext() + "\n\n（ここから会話）" }, ...turns.slice(-20)], {
      signal: chatCtl.signal, tools: TOOLS
    });
    turns.push({ role: "assistant", content: res.text }); chatLog.push({ kind: "ai", text: res.text });
    if (res.truncated) chatLog.push({ kind: "err", text: "返事が途中で切れました。「続けて」と送ってください。" });
  } catch (e) {
    const partial = e?.text || last;
    if (partial) { turns.push({ role: "assistant", content: partial }); chatLog.push({ kind: "ai", text: partial }); }
    const msgs = {
      cancelled: "停止しました。", no_key: "GeminiのAPIキーがまだ設定されていません。設定が終わると使えます。", bad_key: "GeminiのAPIキーが正しくないか、使えない状態です。設定を確認してください。", bad_model: "Geminiのモデル名が合っていません。設定（GEMINI_MODEL）を確認してください。", not_granted: "AIの利用が許可されていません。",
      rate_limited: "AIの無料枠の上限に達しました。しばらくしてから送ってください。", session_expired: "ログインが切れました。ページを開き直してください。",
      refused: "この内容には答えられませんでした。言い方を変えて送ってください。"
    };
    chatLog.push({ kind: "err", text: msgs[e?.code] || ("通信に失敗しました。もう一度送ってください。" + (e?.message ? "（" + String(e.message).slice(0, 90) + "）" : "")) });
    
  }
  chatBusy = false; chatCtl = null; saveChat(); drawChatLog(); scTo(document.body.scrollHeight);
}

parseHash(); renderView();
}

clientMain();
