/* ============================================================
   El Gremio Fútbol — Rediseño · data real + render + interacciones
   ============================================================ */

/* ---------- helpers ---------- */
function initials(name){
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || '').slice(0, 2).toUpperCase();
}
function avColor(name){
  let h = 0; for (const c of name) h = (h*31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 42% 38%), hsl(${(h+40)%360} 46% 24%))`;
}
function av(name, size){
  const onerror = `onerror="this.remove()"`;
  const onload = `onload="this.parentElement.classList.add('is-clickable')"`;
  return `<span class="av" data-size="${size}" data-name="${name}" style="background:${avColor(name)}" title="${name}">${initials(name)}<img src="img/${name}.png" alt="" ${onload} ${onerror}></span>`;
}
function el(html){
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function formatShort(iso){
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
}
function formatLong(d){
  const s = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- data ---------- */
let DATA = null;
let STATS = null;

async function loadData(){
  const res = await fetch('data.json?t=' + Date.now());
  if (!res.ok) throw new Error('No pude cargar data.json');
  return res.json();
}

function computePlayerStats(data){
  const regulars = new Set(data.players);
  const allNames = new Set(data.players);
  for (const m of data.matches){
    [...m.claros, ...m.oscuros].forEach(p => allNames.add(p));
    if (m.mvp) allNames.add(m.mvp);
    if (m.goleador) allNames.add(m.goleador);
  }

  const stats = {};
  for (const p of allNames){
    stats[p] = {
      name: p, isGuest: !regulars.has(p),
      played: 0, wins: 0, losses: 0, draws: 0,
      mvps: 0, lastMvpDate: '',
      goleadorCount: 0, lastGoleadorDate: '',
      matches: []
    };
  }

  for (const m of data.matches){
    const all = [...m.claros.map(p => ['claros', p]), ...m.oscuros.map(p => ['oscuros', p])];
    for (const [team, p] of all){
      if (!stats[p]) continue;
      const outcome = m.winner === 'draw' ? 'draw' : (m.winner === team ? 'win' : 'loss');
      stats[p].played++;
      if (outcome === 'win') stats[p].wins++;
      else if (outcome === 'loss') stats[p].losses++;
      else stats[p].draws++;
      if (m.mvp === p){ stats[p].mvps++; if (m.date > stats[p].lastMvpDate) stats[p].lastMvpDate = m.date; }
      if (m.goleador === p){ stats[p].goleadorCount++; if (m.date > stats[p].lastGoleadorDate) stats[p].lastGoleadorDate = m.date; }
      stats[p].matches.push({ date: m.date, team, outcome, mvp: m.mvp === p, goleador: m.goleador === p });
    }
  }
  return stats;
}

function computeStreak(matches){
  if (!matches.length) return { type: 'none', count: 0, emoji: '', label: 'Sin partidos' };
  const sorted = [...matches].sort((a, b) => b.date.localeCompare(a.date));
  const recent = sorted[0].outcome;
  let count = 0;
  for (const m of sorted){ if (m.outcome === recent) count++; else break; }
  const meta = {
    win:  { emoji: '🔥', label: count === 1 ? 'Ganó último' : 'Racha ganadora' },
    loss: { emoji: '❄️', label: count === 1 ? 'Perdió último' : 'Racha perdedora' },
    draw: { emoji: '🤝', label: count === 1 ? 'Empató último' : 'Racha de empates' },
  }[recent] || { emoji: '', label: 'Sin racha' };
  return { type: recent, count, emoji: meta.emoji, label: meta.label };
}

function computeNextMatch(data){
  if (!data.matches.length) return null;
  const lastIso = [...data.matches].map(m => m.date).sort().pop();
  const next = new Date(lastIso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 14);
  while (next < today) next.setDate(next.getDate() + 14);
  const diffDays = Math.round((next - today) / 86400000);
  return { date: next, diffDays };
}

function diffFromToday(iso){
  const date = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return { date, diffDays: Math.round((date - today) / 86400000) };
}

/* ============================================================
   RENDER
   ============================================================ */
function renderStatstrip(data){
  const total = data.matches.length;
  const cw = data.matches.filter(m => m.winner === 'claros').length;
  const ow = data.matches.filter(m => m.winner === 'oscuros').length;
  const dr = data.matches.filter(m => m.winner === 'draw').length;
  const pls = data.players.length;
  const stats = [
    { v: total, l: 'Partidos' },
    { v: cw, l: 'Wins Claros' },
    { v: ow, l: 'Wins Oscuros' },
    { v: dr, l: 'Empates' },
    { v: pls, l: 'Jugadores' }
  ];
  document.getElementById('statstrip').innerHTML = stats.map(s =>
    `<div class="stat"><div class="num" data-to="${s.v}">0</div><div class="lbl">${s.l}</div></div>`
  ).join('');
}

function renderSpotlights(stats){
  const arr = Object.values(stats).filter(s => !s.isGuest);

  const topMvp = arr.filter(s => s.mvps > 0)
    .sort((a, b) => b.mvps - a.mvps || b.lastMvpDate.localeCompare(a.lastMvpDate))[0];
  const topGol = arr.filter(s => s.goleadorCount > 0)
    .sort((a, b) => b.goleadorCount - a.goleadorCount || b.lastGoleadorDate.localeCompare(a.lastGoleadorDate))[0];

  const figEl = document.getElementById('spot-fig');
  if (topMvp){
    const subParts = [`${topMvp.mvps} MVP${topMvp.mvps > 1 ? 's' : ''}`];
    if (topMvp.losses === 0 && topMvp.played > 0) subParts.push('invicto');
    figEl.innerHTML = av(topMvp.name, 'lg') +
      `<div class="meta"><div class="role">★ Figura del torneo</div><div class="who">${topMvp.name}</div><div class="sub">${subParts.join(' · ')}</div></div>`;
  } else {
    figEl.innerHTML = `<div class="meta"><div class="role">★ Figura del torneo</div><div class="who">—</div><div class="sub">Todavía sin MVP</div></div>`;
  }

  const golEl = document.getElementById('spot-gol');
  if (topGol){
    const sub = topGol.goleadorCount === 1 ? 'Goleador en 1 partido' : `Goleador en ${topGol.goleadorCount} partidos`;
    golEl.innerHTML = av(topGol.name, 'lg') +
      `<div class="meta"><div class="role">⚽ Goleador del torneo</div><div class="who">${topGol.name}</div><div class="sub">${sub}</div></div>`;
  } else {
    golEl.innerHTML = `<div class="meta"><div class="role">⚽ Goleador del torneo</div><div class="who">—</div><div class="sub">Sin goleador del torneo</div></div>`;
  }
}

function renderHeroNote(){
  document.getElementById('hero-note').innerHTML =
    `<span class="star">★</span> Figura del torneo <em>para los que saben de fútbol</em>: ${av('Juancho', 'xs')} <b>Juancho</b>`;
}

function renderCountdowns(data){
  const cards = [];
  const next = computeNextMatch(data);
  if (next){
    cards.push(countdownCard({
      cls: 'green',
      label: '<span class="live-dot"></span>Próximo partido',
      date: formatLong(next.date),
      micro: 'Jueves cada 15 días',
      diffDays: next.diffDays
    }));
  }
  if (Array.isArray(data.events)){
    for (const ev of data.events){
      const info = diffFromToday(ev.date);
      if (info.diffDays < 0) continue;
      cards.push(countdownCard({
        cls: ev.accent === 'gold' ? 'gold' : 'green',
        label: ev.label,
        date: formatLong(info.date),
        micro: ev.subtitle || '',
        diffDays: info.diffDays
      }));
    }
  }
  document.getElementById('countdowns').innerHTML = cards.join('');
}
function countdownCard({ cls, label, date, micro, diffDays }){
  const value = diffDays === 0 ? 'HOY' : diffDays;
  const unit = diffDays === 0 ? '' : `<div class="u">${diffDays === 1 ? 'día' : 'días'}</div>`;
  return `
    <div class="count ${cls}" data-rise>
      <div>
        <div class="lbl">${label}</div>
        <div class="date">${date}</div>
        ${micro ? `<div class="micro">${micro}</div>` : ''}
      </div>
      <div class="days"><div class="n">${value}</div>${unit}</div>
    </div>`;
}

function renderOpinions(data){
  const wrap = document.getElementById('opinions');
  const opinions = Array.isArray(data.manualHighlights) ? data.manualHighlights : [];
  wrap.innerHTML = '';
  opinions.forEach((o, i) => {
    wrap.appendChild(el(`
      <article class="op" data-rise style="--i:${i % 4}">
        <div class="op-top"><span class="op-emoji">${o.icon || '✨'}</span><span class="op-title">${o.title || ''}</span></div>
        <div class="op-who">${av(o.player, 'sm')}<span class="name">${o.player}</span></div>
        <p class="op-quote">${o.text || ''}</p>
      </article>`));
  });
}

function renderGallery(data){
  const wrap = document.getElementById('gallery');
  wrap.innerHTML = '';
  const items = [];
  for (const m of [...data.matches].sort((a, b) => b.date.localeCompare(a.date))){
    if (!Array.isArray(m.photos)) continue;
    for (const photo of m.photos){
      items.push({ photo, date: m.date, where: m.stadium || '' });
    }
  }
  if (!items.length){
    wrap.innerHTML = `<div class="empty" style="margin:0"><span class="em">📸</span>Sin fotos todavía</div>`;
    return;
  }
  galleryPhotos = items.map(i => ({ url: i.photo, caption: `${formatShort(i.date)}${i.where ? ' · ' + i.where : ''}` }));
  items.forEach((it, i) => {
    wrap.appendChild(el(`
      <button class="shot" data-gallery-idx="${i}" aria-label="Abrir foto">
        <div class="ph" style="background-image:url('${it.photo}')"></div>
        <span class="cap">${formatShort(it.date)}<br><span class="where">📍 ${it.where || 'Sin sede'}</span></span>
      </button>`));
  });
}

function podiumRows(list, kind){
  if (!list.length) return '';
  const medals = ['g', 's', 'b'];
  return list.map((r, i) => {
    const rk = i < 3 ? medals[i] : 'n';
    const val = kind === 'pts'
      ? `<div class="pval ppct">${r.value}%<span class="pj">${r.pj} PJ</span></div>`
      : `<div class="pval">${r.value}</div>`;
    return `<div class="prow"><span class="rank ${rk}">${i + 1}</span>${av(r.name, 'sm')}<span class="pname">${r.name}${r.isGuest ? ' <span class="guest-tag">inv</span>' : ''}</span>${val}</div>`;
  }).join('');
}

function renderPodiums(stats){
  const arr = Object.values(stats);

  const mvps = arr.filter(s => s.mvps > 0)
    .sort((a, b) => b.mvps - a.mvps)
    .slice(0, 5)
    .map(s => ({ name: s.name, value: s.mvps, isGuest: s.isGuest }));
  const mvpEl = document.getElementById('pod-mvp');
  mvpEl.innerHTML = mvps.length
    ? podiumRows(mvps, 'n')
    : `<div class="empty"><span class="em">★</span>Todavía sin MVPs</div>`;

  const gols = arr.filter(s => s.goleadorCount > 0)
    .sort((a, b) => b.goleadorCount - a.goleadorCount)
    .slice(0, 5)
    .map(s => ({ name: s.name, value: s.goleadorCount, isGuest: s.isGuest }));
  const golEl = document.getElementById('pod-gol');
  if (!gols.length){
    golEl.innerHTML = `<div class="empty"><span class="em">⚽</span>Sin goleadores cargados</div>`;
  } else if (gols.length === 1){
    golEl.innerHTML = podiumRows(gols, 'n') +
      `<div class="empty"><span class="em">⚽</span>Todavía nadie repitió como goleador</div>`;
  } else {
    golEl.innerHTML = podiumRows(gols, 'n');
  }

  const pts = arr.filter(s => s.played >= 2)
    .map(s => {
      const points = s.wins * 3 + s.draws;
      const max = s.played * 3;
      const pct = max ? Math.round((points / max) * 100) : 0;
      return { name: s.name, value: pct, pj: s.played, isGuest: s.isGuest };
    })
    .sort((a, b) => b.value - a.value || b.pj - a.pj)
    .slice(0, 5);
  const ptsEl = document.getElementById('pod-pts');
  ptsEl.innerHTML = pts.length
    ? podiumRows(pts, 'pts')
    : `<div class="empty"><span class="em">🏆</span>Faltan partidos para calcular</div>`;
}

function renderMatches(data){
  const wrap = document.getElementById('matches');
  wrap.innerHTML = '';
  const matches = [...data.matches].sort((a, b) => b.date.localeCompare(a.date));
  if (!matches.length){
    wrap.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="em">⚽</span>Todavía no se cargaron partidos.</div>`;
    return;
  }
  matches.forEach(m => {
    const team = (arr, kind, isGuestFn) => `
      <div class="team ${kind === 'oscuros' ? 'oscuros-team' : ''}">
        <div class="tlbl ${kind}"><span class="dot"></span>${kind}</div>
        ${arr.map(p => `<div class="player">${av(p, 'xs')}<span>${p}</span>${isGuestFn(p) ? '<span class="guest-tag">inv</span>' : ''}</div>`).join('')}
      </div>`;
    const isGuest = p => STATS[p] && STATS[p].isGuest;

    const resultText = m.winner === 'claros' ? 'Ganó Claros'
                     : m.winner === 'oscuros' ? 'Ganó Oscuros'
                     : 'Empate';
    const resultCls = m.winner === 'draw' ? 'draw' : 'win';

    const gol = m.goleador
      ? `<div class="award gol">${av(m.goleador, 'sm')}<div><div class="k">Goleador</div><div class="v">${m.goleador}</div></div></div>`
      : `<div class="award empty-award">Sin goleador · fue empate</div>`;
    const mvp = m.mvp
      ? `<div class="award mvp">${av(m.mvp, 'sm')}<div><div class="k">MVP</div><div class="v">${m.mvp}</div></div></div>`
      : '';

    const photos = Array.isArray(m.photos) ? m.photos : [];
    const matchPhotosKey = m.date;
    matchPhotos[matchPhotosKey] = photos.map(url => ({ url, caption: `${formatShort(m.date)}${m.stadium ? ' · ' + m.stadium : ''}` }));
    const shots = photos.length
      ? `<div class="match-shots">${photos.map((url, i) => `<button class="ph" data-match-photos="${matchPhotosKey}" data-match-photo-idx="${i}" aria-label="Ver foto" style="background-image:url('${url}')"></button>`).join('')}</div>`
      : '';

    wrap.appendChild(el(`
      <article class="match" data-rise>
        <div class="match-head">
          <div>
            <div class="dt">${formatShort(m.date)}</div>
            <div class="venue">📍 ${m.stadium || 'Sin sede'} ${m.stadium ? 'Stadium' : ''}</div>
          </div>
          <span class="result ${resultCls}">${resultText}</span>
        </div>
        <div class="teams">${team(m.claros, 'claros', isGuest)}${team(m.oscuros, 'oscuros', isGuest)}</div>
        <div class="awards">${gol}${mvp}</div>
        ${shots}
      </article>`));
  });
}

/* ---------- player panel ---------- */
function renderPlayerSelect(data, stats){
  const sel = document.getElementById('player-select');
  const sorted = Object.values(stats).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  sel.innerHTML = '<option value="">Elegí un jugador…</option>' +
    sorted.map(s => `<option value="${s.name}">${s.name}${s.isGuest ? ' (invitado)' : ''}</option>`).join('');
  sel.addEventListener('change', () => renderPlayerPanel(sel.value, stats));
  renderPlayerPanel('', stats);
}
function renderPlayerPanel(name, stats){
  const panel = document.getElementById('player-panel');
  if (!name){
    panel.innerHTML = `<div class="pp-empty"><span class="em">⚽</span>Elegí un jugador del menú para ver sus stats y su historial partido a partido.</div>`;
    return;
  }
  const s = stats[name];
  if (!s){
    panel.innerHTML = `<div class="pp-empty"><span class="em">❔</span>Jugador no encontrado.</div>`;
    return;
  }
  if (s.played === 0){
    panel.innerHTML = `
      <div class="pp-head">${av(s.name, 'lg')}<div><div class="who">${s.name}${s.isGuest ? ' <span class="guest">invitado</span>' : ''}</div><div class="pj">Sin partidos todavía</div></div></div>
      <div class="pp-empty"><span class="em">📭</span>Este jugador todavía no jugó ningún partido.</div>`;
    return;
  }
  const points = s.wins * 3 + s.draws;
  const max = s.played * 3;
  const pct = max ? Math.round((points / max) * 100) : 0;
  const streak = computeStreak(s.matches);
  const tiles = [
    { n: s.played, l: 'Partidos' },
    { n: `${s.wins}-${s.draws}-${s.losses}`, l: 'G · E · P' },
    { n: `${pct}%`, l: `% puntos (${points}/${max})`, good: pct >= 50, bad: pct <= 30 && s.played >= 2 },
    { n: `${streak.emoji} ${streak.count}`, l: streak.label, good: streak.type === 'win', bad: streak.type === 'loss' },
    { n: s.mvps, l: s.mvps === 1 ? 'MVP' : 'MVPs', good: s.mvps > 0 },
    { n: s.goleadorCount, l: 'Goleador', good: s.goleadorCount > 0 }
  ];
  const sortedMatches = [...s.matches].sort((a, b) => b.date.localeCompare(a.date));
  const teamLabel = t => t === 'claros' ? 'Claros' : 'Oscuros';
  const resultLabel = o => o === 'win' ? 'Ganó' : o === 'loss' ? 'Perdió' : 'Empate';
  panel.innerHTML = `
    <div class="pp-head">${av(s.name, 'lg')}<div><div class="who">${s.name}${s.isGuest ? ' <span class="guest">invitado</span>' : ''}</div><div class="pj">${s.played} ${s.played === 1 ? 'partido jugado' : 'partidos jugados'}</div></div></div>
    <div class="tiles">
      ${tiles.map(t => `<div class="tile ${t.good ? 'good' : ''}${t.bad ? ' bad' : ''}"><div class="tn">${t.n}</div><div class="tl">${t.l}</div></div>`).join('')}
    </div>
    <div class="p2p">
      <div class="p2p-lbl">Partido a partido</div>
      ${sortedMatches.map(m => `
        <div class="p2p-row">
          <span class="pdate">${formatShort(m.date)}</span>
          <span class="pteam">${teamLabel(m.team)}${m.mvp ? ' · ★ MVP' : ''}${m.goleador ? ' · ⚽ Goleador' : ''}</span>
          <span class="pres ${m.outcome}">${resultLabel(m.outcome)}</span>
        </div>`).join('')}
    </div>`;
}

/* ============================================================
   COUNT-UP, REVEAL, LIGHTBOX
   ============================================================ */
function countUp(el){
  const end = +el.dataset.to, dur = 1000, t0 = performance.now();
  function tick(t){
    const p = Math.min((t - t0) / dur, 1);
    el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function initReveal(){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.querySelectorAll('[data-rise]').forEach(e => e.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries, obs) => entries.forEach(e => {
    if (e.isIntersecting){
      e.target.classList.add('in');
      if (e.target.id === 'statstrip') e.target.querySelectorAll('.num[data-to]').forEach(countUp);
      obs.unobserve(e.target);
    }
  }), { threshold: 0.15 });
  document.querySelectorAll('[data-rise]').forEach(e => io.observe(e));
}

/* ---------- lightbox ---------- */
let lbState = { photos: [], index: 0 };
let galleryPhotos = [];
let matchPhotos = {};

function openLightbox(photos, index){
  if (!photos || !photos.length) return;
  lbState.photos = photos;
  lbState.index = index || 0;
  updateLightbox();
  document.getElementById('lb').classList.add('open');
}
function closeLightbox(){ document.getElementById('lb').classList.remove('open'); }
function navLightbox(dir){
  const n = lbState.photos.length;
  lbState.index = (lbState.index + dir + n) % n;
  updateLightbox();
}
function updateLightbox(){
  const p = lbState.photos[lbState.index];
  document.getElementById('lb-img').src = p.url;
  document.getElementById('lb-cap').textContent = p.caption || '';
  document.getElementById('lb-counter').textContent = lbState.photos.length > 1 ? `${lbState.index + 1} / ${lbState.photos.length}` : '';
  document.getElementById('lb-prev').style.display = lbState.photos.length > 1 ? '' : 'none';
  document.getElementById('lb-next').style.display = lbState.photos.length > 1 ? '' : 'none';
}

/* ---------- music player (YouTube IFrame API) ---------- */
let ytPlayer = null;
let ytReady = false;

function setupMusicPlayer(){
  if (window.YT && window.YT.Player){ createYtPlayer(); return; }
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => { if (prev) prev(); createYtPlayer(); };
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}
function createYtPlayer(){
  ytPlayer = new YT.Player('yt-mount', {
    videoId: 'ijnujobdJ4c',
    width: '1', height: '1',
    playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
    events: {
      onReady: () => { ytReady = true; updatePlayBtn(false); },
      onStateChange: (e) => {
        const playing = e.data === YT.PlayerState.PLAYING;
        document.getElementById('player-pill').classList.toggle('playing', playing);
        updatePlayBtn(playing);
      }
    }
  });
}
function updatePlayBtn(playing){
  const btn = document.getElementById('pp-btn');
  if (!btn) return;
  btn.innerHTML = playing
    ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
    : '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
}

/* ---------- click delegation ---------- */
function initClickDelegation(){
  document.addEventListener('click', (e) => {
    // music
    if (e.target.closest('#pp-btn')){
      if (!ytReady || !ytPlayer) return;
      const state = ytPlayer.getPlayerState();
      if (state === 1) ytPlayer.pauseVideo();
      else { if (state === 0) ytPlayer.seekTo(0); ytPlayer.playVideo(); }
      return;
    }
    // gallery thumb
    const shot = e.target.closest('[data-gallery-idx]');
    if (shot){
      openLightbox(galleryPhotos, +shot.dataset.galleryIdx);
      return;
    }
    // match photo thumb
    const matchPh = e.target.closest('[data-match-photos]');
    if (matchPh){
      const key = matchPh.dataset.matchPhotos;
      const idx = +matchPh.dataset.matchPhotoIdx;
      openLightbox(matchPhotos[key] || [], idx);
      return;
    }
    // avatar clickable
    const av = e.target.closest('.av.is-clickable');
    if (av){
      const img = av.querySelector('img');
      if (img && img.src){
        openLightbox([{ url: img.src, caption: av.dataset.name || '' }], 0);
      }
      return;
    }
    // lightbox controls
    if (e.target.closest('#lb-close')){ closeLightbox(); return; }
    if (e.target.closest('#lb-prev')){ navLightbox(-1); return; }
    if (e.target.closest('#lb-next')){ navLightbox(1); return; }
    if (e.target.id === 'lb'){ closeLightbox(); return; }
  });

  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('lb').classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navLightbox(-1);
    if (e.key === 'ArrowRight') navLightbox(1);
  });
}

/* ============================================================
   BOOT
   ============================================================ */
async function init(){
  try {
    DATA = await loadData();
    STATS = computePlayerStats(DATA);

    renderStatstrip(DATA);
    renderSpotlights(STATS);
    renderHeroNote();
    renderCountdowns(DATA);
    renderOpinions(DATA);
    renderGallery(DATA);
    renderPodiums(STATS);
    renderMatches(DATA);
    renderPlayerSelect(DATA, STATS);

    initReveal();
    initClickDelegation();
  } catch (e) {
    document.querySelector('.wrap').innerHTML =
      `<div class="empty" style="margin:80px auto; max-width:400px"><span class="em">⚠️</span>Error cargando los datos: ${e.message}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  setupMusicPlayer();
});
