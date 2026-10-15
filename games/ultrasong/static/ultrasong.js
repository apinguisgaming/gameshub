"use strict";
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDur = s => s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "";
  const fmtMB = b => `${(b / 1048576).toFixed(b > 10485760 ? 0 : 1)} MB`;
  const authFetch = (url, opts = {}) => (window.GameHub ? GameHub.auth.fetch(url, opts) : fetch(url, opts));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 3500);
  }

  async function api(path, body) {
    const opts = body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    const r = await authFetch("/ultrasong" + path, opts);
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { location.href = "/?next=/ultrasong/&login=1"; throw new Error("Bitte einloggen"); }
    if (!r.ok) throw new Error(data.message || r.statusText);
    return data;
  }

  // Bestellung ablegen und auf die Antwort des PCs warten (der holt im Sekundentakt ab)
  async function order(kind, data, timeoutS = 90) {
    const { id } = await api("/api/order", { kind, data });
    const until = Date.now() + timeoutS * 1000;
    let wait = 300;
    while (Date.now() < until) {
      await sleep(wait);
      wait = Math.min(wait * 1.3, 1200);
      const r = await api(`/api/order/${id}`);
      if (r.done) { if (!r.ok) throw new Error(r.error || "Fehler am PC"); return r.data; }
    }
    throw new Error("Der PC zu Hause antwortet nicht.");
  }

  // ---------- Stand (PC, Warteschlange, fertige Songs) ----------
  let st = { pc: { online: false }, jobs: [], songs: [] }, firstState = true;

  async function refresh() {
    try {
      st = await api("/api/state");
      render();
    } catch (err) { $("#pcText").textContent = "Seite nicht erreichbar"; }
    const busy = st.jobs.some(j => ["wartet", "laeuft"].includes(j.status));
    setTimeout(refresh, document.hidden ? 8000 : busy ? 1500 : 3000);
  }

  function render() {
    const on = st.pc.online;
    $("#pc").className = "us-pc " + (on ? "on" : "off");
    $("#pcText").textContent = on ? "PC zu Hause: bereit" : "PC zu Hause: aus";
    $("#offBox").classList.toggle("hidden", on);
    $("#orderBox").classList.toggle("hidden", !on);
    $("#btnStop").hidden = !on;
    renderJobs();
    renderSongs();
    if (firstState) { firstState = false; if (on) $("#q").focus(); }
  }

  const STEPS = [["download", "Download"], ["video", "Video"], ["cover", "Cover"], ["songtext", "Songtext"],
    ["trennung", "Trennung"], ["tempo", "Tempo"], ["alignment", "Alignment"], ["noten", "Noten"]];
  const STATUS = { wartet: "wartet", laeuft: "läuft", fertig: "fertig – wird hochgeladen", fehler: "Fehler", abgebrochen: "abgebrochen" };

  function renderJobs() {
    const jobs = st.jobs.slice().reverse();
    $("#queueBox").classList.toggle("hidden", !jobs.length);
    const uploaded = new Set(st.songs.map(s => s.name.toLowerCase()));
    $("#jobs").innerHTML = jobs.map(j => {
      const cur = STEPS.findIndex(s => s[0] === j.stage);
      const steps = STEPS.map((s, k) => {
        const cls = j.status === "fertig" || k < cur ? "done" : (k === cur && j.status === "laeuft" ? "cur" : "");
        return `<div class="${cls}" title="${s[1]}"></div>`;
      }).join("");
      const dur = j.started ? Math.round((j.finished || Date.now() / 1000) - j.started) : 0;
      let state = STATUS[j.status] || j.status;
      if (j.status === "laeuft") state = `${(STEPS[cur] || [, j.stage])[1]} ${esc(j.detail || "")}`;
      if (j.status === "fehler") state = "Fehler: " + esc(j.error || "");
      if (j.status === "fertig" && uploaded.has(`${j.artist} - ${j.title}`.toLowerCase())) state = "fertig ✓ unten herunterladen";
      if (dur) state += ` · ${fmtDur(dur)}`;
      const btn = ["wartet", "laeuft"].includes(j.status) && st.pc.online
        ? `<button class="us-btn ghost small" data-cancel="${esc(j.key)}">Abbrechen</button>` : "";
      return `<div class="us-job ${esc(j.status)}"><div><div class="n">${esc(j.artist)} – ${esc(j.title)}</div>
        <div class="s">${state}</div></div><div>${btn}</div>${j.status === "wartet" ? "" : `<div class="us-steps">${steps}</div>`}</div>`;
    }).join("");
  }

  function renderSongs() {
    const songs = st.songs;
    const since = st.pc.since || 0;
    const fresh = songs.filter(s => s.created >= since - 60);
    const btnAll = $("#btnAll");
    btnAll.hidden = fresh.length < 2;
    btnAll.textContent = `↓ Alle neuen (${fresh.length})`;
    if (!songs.length) { $("#songs").innerHTML = `<div class="us-empty">Noch nichts da. Fertige Songs erscheinen hier automatisch.</div>`; return; }
    $("#songs").innerHTML = songs.map(s => `
      <div class="us-song">
        ${s.cover ? `<img src="/ultrasong/cover/${esc(s.key)}" alt="" loading="lazy">` : `<div class="ph"></div>`}
        <div><div class="n">${esc(s.name)}</div>
          <div class="m">${fmtMB(s.size)} · ${new Date(s.created * 1000).toLocaleTimeString("de", { hour: "2-digit", minute: "2-digit" })} Uhr</div></div>
        <button class="us-btn small" data-dl="${esc(s.key)}" data-name="${esc(s.name)}">↓ Herunterladen</button>
      </div>`).join("");
  }

  // Download ueber fetch (nimmt das Tab-Login mit), dann als Datei speichern
  async function download(url, filename, btn) {
    const label = btn.textContent;
    btn.disabled = true;
    try {
      const r = await authFetch(url);
      if (!r.ok) throw new Error(r.status === 404 ? "Nicht (mehr) vorhanden" : r.statusText);
      const total = +r.headers.get("Content-Length") || 0;
      const reader = r.body.getReader(), parts = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        got += value.length;
        btn.textContent = total ? `${Math.round(got / total * 100)} %` : fmtMB(got);
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(parts, { type: "application/zip" }));
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      toast("Gespeichert – jetzt in den UltraStar-Ordner „songs“ entpacken.");
    } catch (err) { toast("Download fehlgeschlagen: " + err.message); }
    finally { btn.disabled = false; btn.textContent = label; }
  }

  $("#songs").addEventListener("click", e => {
    const b = e.target.closest("[data-dl]");
    if (b) download(`/ultrasong/dl/${b.dataset.dl}`, `${b.dataset.name}.zip`, b);
  });
  $("#btnAll").addEventListener("click", e => {
    const d = new Date().toLocaleDateString("de");
    download(`/ultrasong/dl-all?seit=${(st.pc.since || 0) - 60}`, `UltraSong ${d}.zip`, e.target);
  });
  $("#jobs").addEventListener("click", async e => {
    const k = e.target.dataset.cancel;
    if (!k) return;
    e.target.disabled = true;
    try { await order("cancel", { key: k }); toast("Abgebrochen."); } catch (err) { toast(err.message); }
  });
  $("#btnStop").addEventListener("click", async () => {
    if (!confirm("Spielabend beenden? Danach kann niemand mehr bestellen, bis er am PC wieder eingeschaltet wird.")) return;
    try { await order("stop", {}); toast("Spielabend beendet."); } catch (err) { toast(err.message); }
    refresh.soon();
  });

  // ---------- Suche ----------
  const PAGE = 6;   // Treffer pro Seite, der Rest ueber „Mehr laden“
  let results = [], shown = 0;

  $("#searchForm").addEventListener("submit", async e => {
    e.preventDefault();
    const q = $("#q").value.trim();
    if (!q) return;
    $("#btnSearch").disabled = true;
    $("#hint").textContent = "Der PC zu Hause sucht auf YouTube…";
    $("#results").innerHTML = "";
    $("#btnMore").classList.add("hidden");
    try {
      results = await order("search", { q });
      shown = 0;
      $("#hint").textContent = results.length ? "Künstler und Titel kannst du vor dem Erstellen ändern." : "Keine Treffer.";
      await showMore();
    } catch (err) { $("#hint").textContent = err.message; }
    finally { $("#btnSearch").disabled = false; }
  });

  async function showMore() {
    const from = shown;
    shown = Math.min(results.length, shown + PAGE);
    $("#results").insertAdjacentHTML("beforeend", results.slice(from, shown).map((r, k) => cardHtml(r, from + k)).join(""));
    $("#btnMore").classList.toggle("hidden", shown >= results.length);
    $("#btnMore").textContent = `Mehr laden (${results.length - shown} weitere)`;
    const queue = [...Array(shown - from).keys()].map(k => from + k);   // Songtext nur fuer sichtbare Treffer
    const worker = async () => { while (queue.length) await checkLyrics(queue.shift()); };
    await Promise.all([worker(), worker()]);  // lrclib mag nicht mehr gleichzeitig
  }
  $("#btnMore").addEventListener("click", () => showMore());

  function cardHtml(r, i) {
    return `
      <div class="us-card" data-i="${i}">
        <div class="us-thumb"><img src="${esc(r.thumb)}" alt="" loading="lazy"><span class="us-dur">${fmtDur(r.duration)}</span></div>
        <div class="body">
          <div class="us-vt">${esc(r.title)}</div>
          <div class="us-fields">
            <label>Künstler<input type="text" class="f-artist" value="${esc(r.artist)}"></label>
            <label>Titel<input type="text" class="f-title" value="${esc(r.song_title)}"></label>
          </div>
          <div class="us-lyr wait">Songtext wird geprüft…</div>
          <textarea class="f-lyrics hidden" placeholder="Kein Songtext gefunden – hier einfügen (eine Zeile pro Gesangszeile)"></textarea>
          <div><button class="us-btn b-make">Erstellen</button>
            ${r.exists ? `<div class="us-exists">schon vorhanden: ${esc(r.exists)}</div>` : ""}</div>
        </div>
      </div>`;
  }

  const card = i => $(`.us-card[data-i="${i}"]`);

  async function checkLyrics(i) {
    const r = results[i], c = card(i);
    if (!c) return;
    const el = $(".us-lyr", c);
    try {
      const res = await order("lyrics", { artist: $(".f-artist", c).value, title: $(".f-title", c).value, duration: r.duration || 0 });
      r.lyrics = res;
      el.className = "us-lyr " + (res.found ? "ok" : "no");
      el.textContent = res.found ? `✓ Songtext gefunden (${res.lines} Zeilen)` : "✗ Kein Songtext gefunden – bitte einfügen";
      $(".f-lyrics", c).classList.toggle("hidden", !!res.found);
    } catch (err) { el.className = "us-lyr no"; el.textContent = err.message; }
  }

  $("#results").addEventListener("change", e => {
    if (e.target.matches(".f-artist, .f-title")) checkLyrics(+e.target.closest(".us-card").dataset.i);
  });

  $("#results").addEventListener("click", async e => {
    if (!e.target.classList.contains("b-make")) return;
    const c = e.target.closest(".us-card"), r = results[+c.dataset.i];
    const artist = $(".f-artist", c).value.trim(), title = $(".f-title", c).value.trim(), lyrics = $(".f-lyrics", c).value.trim();
    if (!artist || !title) return toast("Bitte Künstler und Titel ausfüllen.");
    if (!r.lyrics?.found && !lyrics) return toast("Ohne Songtext geht es nicht – bitte einfügen.");
    let replace = false;
    if (r.exists) {
      if (!confirm(`„${r.exists}“ gibt es am PC schon. Trotzdem neu erstellen?`)) return;
      replace = true;
    }
    e.target.disabled = true;
    e.target.textContent = "Wird bestellt…";
    try {
      await order("create", { id: r.id, artist, title, lyrics: lyrics || null, duration: r.duration || 0, replace });
      e.target.textContent = "In der Warteschlange ✓";
      toast(`„${artist} – ${title}“ ist bestellt.`);
      refresh.soon();
    } catch (err) {
      e.target.disabled = false;
      e.target.textContent = "Erstellen";
      toast(err.message);
    }
  });

  refresh.soon = () => setTimeout(() => api("/api/state").then(s => { st = s; render(); }).catch(() => {}), 1200);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh.soon(); });
  refresh();
})();
