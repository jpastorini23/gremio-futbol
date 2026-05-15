async function loadData() {
  const res = await fetch('data.json?t=' + Date.now());
  if (!res.ok) throw new Error('No pude cargar data.json');
  return res.json();
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 32%)`;
}

function avatar(name, size = 'sm') {
  const color = avatarColor(name);
  const fallback = `onerror="if(this.dataset.tried){this.remove()}else{this.dataset.tried=1;this.src='img/${name}.png'}"`;
  const success = `onload="this.parentElement.classList.add('avatar-clickable')"`;
  return `<span class="avatar avatar-${size}" data-initials="${initials(name)}" data-name="${name}" style="background:${color}"><img src="img/${name}.jpg" alt="" ${fallback} ${success}></span>`;
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatLongDate(d) {
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function computeNextMatch(data) {
  if (!data.matches.length) return null;
  const lastIso = [...data.matches].map(m => m.date).sort().pop();
  const next = new Date(lastIso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + 14);
  while (next < today) next.setDate(next.getDate() + 14);
  const diffDays = Math.round((next - today) / (1000 * 60 * 60 * 24));
  return { date: next, diffDays };
}

function generateHighlights(data, stats) {
  const arr = Object.values(stats).filter(s => s.played > 0 && !s.isGuest);
  const facts = [];
  const used = new Set();

  const pushFact = (f) => {
    if (used.has(f.player + f.kind)) return;
    used.add(f.player + f.kind);
    facts.push(f);
  };

  if (Array.isArray(data.manualHighlights)) {
    for (const m of data.manualHighlights) {
      pushFact({
        kind: 'manual-' + (m.title || m.player || ''),
        icon: m.icon || '✨',
        accent: m.accent || 'gold',
        title: m.title || '',
        player: m.player || '',
        text: m.text || ''
      });
    }
  }

  for (const s of arr) {
    const streak = computeStreak(s.matches);
    const last = [...s.matches].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (streak.type === 'win' && last.mvp) {
      pushFact({
        kind: 'hot-mvp',
        icon: '🔥',
        accent: 'green',
        title: 'En racha',
        player: s.name,
        text: streak.count > 1
          ? `Ganó ${streak.count} al hilo y fue figura en el último`
          : 'Ganó el último y fue elegido figura del partido'
      });
    }
  }

  const debutWinners = arr.filter(s => s.played === 1 && s.wins === 1);
  for (const s of debutWinners.slice(0, 1)) {
    pushFact({
      kind: 'debut',
      icon: '🚀',
      accent: 'green',
      title: 'Debutó y la rompió',
      player: s.name,
      text: 'Jugó su primer partido y ganó'
    });
  }

  const topGol = arr.filter(s => s.goleadorCount > 0).sort((a, b) => b.goleadorCount - a.goleadorCount)[0];
  if (topGol) {
    pushFact({
      kind: 'killer',
      icon: '⚽',
      accent: 'green',
      title: 'Killer del gol',
      player: topGol.name,
      text: topGol.goleadorCount === 1 ? 'Goleador del último partido' : `${topGol.goleadorCount} veces goleador del partido`
    });
  }

  const topMvp = arr.filter(s => s.mvps > 0).sort((a, b) => b.mvps - a.mvps)[0];
  if (topMvp && topMvp.mvps >= 2) {
    pushFact({
      kind: 'mvp-king',
      icon: '⭐',
      accent: 'gold',
      title: 'Figura repetida',
      player: topMvp.name,
      text: `${topMvp.mvps} veces elegido figura del partido`
    });
  }

  const losingStreaks = arr.map(s => ({ s, st: computeStreak(s.matches) })).filter(x => x.st.type === 'loss');
  losingStreaks.sort((a, b) => b.st.count - a.st.count || b.s.losses - a.s.losses);
  const cold = losingStreaks[0];
  if (cold) {
    pushFact({
      kind: 'cold',
      icon: '❄️',
      accent: 'red',
      title: 'Pichichi en sequía',
      player: cold.s.name,
      text: cold.st.count > 1 ? `${cold.st.count} derrotas al hilo` : 'Perdió el último partido'
    });
  }

  const ptsArr = arr.filter(s => s.played >= 2).map(s => {
    const pts = s.wins * 3 + s.draws;
    const max = s.played * 3;
    return { s, pts, max, pct: max ? (pts / max) * 100 : 0 };
  }).sort((a, b) => b.pct - a.pct || b.s.played - a.s.played);
  const topPts = ptsArr[0];
  if (topPts && topPts.pct >= 60) {
    pushFact({
      kind: 'points-king',
      icon: '📈',
      accent: 'green',
      title: 'Manija de puntos',
      player: topPts.s.name,
      text: `${Math.round(topPts.pct)}% de puntos posibles (${topPts.pts}/${topPts.max})`
    });
  }
  const bottomPts = ptsArr[ptsArr.length - 1];
  if (bottomPts && bottomPts !== topPts && bottomPts.pct <= 40) {
    pushFact({
      kind: 'points-bottom',
      icon: '🥶',
      accent: 'red',
      title: 'Le cuesta sumar',
      player: bottomPts.s.name,
      text: `Solo ${Math.round(bottomPts.pct)}% de puntos posibles`
    });
  }

  const sinAlegrias = arr.filter(s => s.played >= 2 && s.wins === 0 && s.mvps === 0 && s.goleadorCount === 0);
  if (sinAlegrias.length) {
    const candidate = sinAlegrias.sort((a, b) => b.played - a.played)[0];
    pushFact({
      kind: 'sin-alegrias',
      icon: '😶',
      accent: 'red',
      title: 'Sin alegrías',
      player: candidate.name,
      text: `${candidate.played} partidos sin ganar, sin MVP, sin goles`
    });
  }

  const sinMvp = arr.filter(s => s.played >= 2 && s.mvps === 0);
  if (sinMvp.length) {
    const candidate = sinMvp.sort((a, b) => b.played - a.played)[0];
    if (!facts.some(f => f.player === candidate.name)) {
      pushFact({
        kind: 'sin-mvp',
        icon: '🫥',
        accent: 'red',
        title: 'Le huye al MVP',
        player: candidate.name,
        text: `${candidate.played} partidos jugados y todavía sin ser figura`
      });
    }
  }

  return facts.slice(0, 6);
}

function renderHighlights(data, stats) {
  const el = document.getElementById('highlights');
  const facts = generateHighlights(data, stats);
  if (!facts.length) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <h2 class="section-title highlights-title">Highlights</h2>
    <div class="highlights-grid">
      ${facts.map(f => `
        <div class="fact-card fact-${f.accent}">
          <div class="fact-icon">${f.icon}</div>
          <div class="fact-body">
            <span class="fact-title">${f.title}</span>
            <div class="fact-player-row">
              ${avatar(f.player, 'sm')}
              <span class="fact-player">${f.player}</span>
            </div>
            <span class="fact-text">${f.text}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderNextMatch(data) {
  const el = document.getElementById('next-match');
  const info = computeNextMatch(data);
  if (!info) { el.innerHTML = ''; return; }

  const { date, diffDays } = info;
  let countdown;
  if (diffDays === 0) countdown = '<span class="countdown-value">HOY</span>';
  else if (diffDays === 1) countdown = '<span class="countdown-value">1</span><span class="countdown-unit">día</span>';
  else countdown = `<span class="countdown-value">${diffDays}</span><span class="countdown-unit">días</span>`;

  const dateStr = formatLongDate(date);
  const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  el.innerHTML = `
    <div class="next-match-card">
      <div class="next-match-pulse"></div>
      <div class="next-match-info">
        <span class="next-match-label">Próximo partido</span>
        <span class="next-match-date">${dateCapitalized}</span>
      </div>
      <div class="next-match-countdown">${countdown}</div>
    </div>
  `;
}

function computePlayerStats(data) {
  const regulars = new Set(data.players);
  const allNames = new Set(data.players);
  for (const m of data.matches) {
    [...m.claros, ...m.oscuros].forEach(p => allNames.add(p));
    if (m.mvp) allNames.add(m.mvp);
    if (m.goleador) allNames.add(m.goleador);
  }

  const stats = {};
  for (const p of allNames) {
    stats[p] = {
      name: p,
      isGuest: !regulars.has(p),
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      mvps: 0,
      lastMvpDate: '',
      goleadorCount: 0,
      lastGoleadorDate: '',
      matches: []
    };
  }

  for (const m of data.matches) {
    const all = [...m.claros.map(p => ['claros', p]), ...m.oscuros.map(p => ['oscuros', p])];

    for (const [team, p] of all) {
      if (!stats[p]) continue;
      const outcome = m.winner === 'draw' ? 'draw' : (m.winner === team ? 'win' : 'loss');

      stats[p].played++;
      if (outcome === 'win') stats[p].wins++;
      else if (outcome === 'loss') stats[p].losses++;
      else stats[p].draws++;

      if (m.mvp === p) {
        stats[p].mvps++;
        if (m.date > stats[p].lastMvpDate) stats[p].lastMvpDate = m.date;
      }
      if (m.goleador === p) {
        stats[p].goleadorCount++;
        if (m.date > stats[p].lastGoleadorDate) stats[p].lastGoleadorDate = m.date;
      }

      stats[p].matches.push({
        date: m.date,
        team,
        outcome,
        mvp: m.mvp === p,
        goleador: m.goleador === p
      });
    }
  }

  return stats;
}

function renderHeroStats(data) {
  const total = data.matches.length;
  const clarosWins = data.matches.filter(m => m.winner === 'claros').length;
  const oscurosWins = data.matches.filter(m => m.winner === 'oscuros').length;
  const draws = data.matches.filter(m => m.winner === 'draw').length;
  const players = data.players.length;

  const stats = [
    { value: total, label: 'Partidos' },
    { value: clarosWins, label: 'Wins Claros' },
    { value: oscurosWins, label: 'Wins Oscuros' },
    { value: draws, label: 'Empates' },
    { value: players, label: 'Jugadores' },
  ];

  document.getElementById('hero-stats').innerHTML = stats.map(s => `
    <div class="hero-stat"><div class="hero-stat-value" data-target="${s.value}">0</div><div class="hero-stat-label">${s.label}</div></div>
  `).join('');

  document.querySelectorAll('.hero-stat-value').forEach(el => animateNumber(el, +el.dataset.target));
}

function computeStreak(matches) {
  if (!matches.length) return { type: 'none', count: 0, icon: '', label: 'Sin partidos' };
  const sorted = [...matches].sort((a, b) => b.date.localeCompare(a.date));
  const recent = sorted[0].outcome;
  let count = 0;
  for (const m of sorted) {
    if (m.outcome === recent) count++;
    else break;
  }
  const meta = {
    win: { icon: '🔥', label: count === 1 ? 'Ganó último' : 'Racha ganadora' },
    loss: { icon: '❄️', label: count === 1 ? 'Perdió último' : 'Racha perdedora' },
    draw: { icon: '🤝', label: count === 1 ? 'Empató último' : 'Racha de empates' },
  }[recent] || { icon: '', label: 'Sin racha' };
  return { type: recent, count, icon: meta.icon + ' ', label: meta.label };
}

function animateNumber(el, target, duration = 900) {
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderGallery(data) {
  const strip = document.getElementById('gallery-strip');
  const all = [];
  const sorted = [...data.matches].sort((a, b) => b.date.localeCompare(a.date));
  for (const m of sorted) {
    if (!Array.isArray(m.photos)) continue;
    for (const photo of m.photos) {
      all.push({ photo, date: m.date, stadium: m.stadium || '' });
    }
  }

  if (!all.length) {
    strip.innerHTML = '<div class="empty">Sin fotos todavía</div>';
    return;
  }

  strip.dataset.photos = JSON.stringify(all.map(a => a.photo));
  strip.innerHTML = all.map((p, i) => `
    <button class="gallery-item" data-index="${i}" aria-label="Abrir foto">
      <img src="${p.photo}" alt="" loading="lazy">
      <span class="gallery-item-label">${formatDate(p.date)}${p.stadium ? ' · ' + p.stadium : ''}</span>
    </button>
  `).join('');
}

function renderHeroNote() {
  document.getElementById('hero-note').innerHTML = `
    <span>★ Figura del torneo <em>para los que saben de fútbol</em>:</span>
    ${avatar('Juancho', 'md')}
    <strong>Juancho</strong>
  `;
}

function renderSpotlights(stats) {
  const arr = Object.values(stats).filter(s => !s.isGuest);

  const topMvp = arr
    .filter(s => s.mvps > 0)
    .sort((a, b) => b.mvps - a.mvps || b.lastMvpDate.localeCompare(a.lastMvpDate))[0];
  const topGoleador = arr
    .filter(s => s.goleadorCount > 0)
    .sort((a, b) => b.goleadorCount - a.goleadorCount || b.lastGoleadorDate.localeCompare(a.lastGoleadorDate))[0];

  document.getElementById('spotlight-mvp').innerHTML = renderSpotlight('Figura del torneo', topMvp, topMvp ? `${topMvp.mvps} MVP${topMvp.mvps > 1 ? 's' : ''}` : null);
  document.getElementById('spotlight-goleador').innerHTML = renderSpotlight('Goleador del torneo', topGoleador, topGoleador ? `${topGoleador.goleadorCount} partido${topGoleador.goleadorCount > 1 ? 's' : ''}` : null);
}

function renderSpotlight(label, player, sub) {
  if (!player) {
    return `
      <div class="avatar avatar-xl" data-initials="?" style="background:#243029"></div>
      <span class="spotlight-label">${label}</span>
      <span class="spotlight-empty">Sin datos</span>
    `;
  }
  return `
    ${avatar(player.name, 'xl')}
    <span class="spotlight-label">${label}</span>
    <span class="spotlight-name">${player.name}</span>
    <span class="spotlight-label">${sub}</span>
  `;
}

const podiumState = {};

function renderPodium(id, items, opts = {}) {
  podiumState[id] = { items, opts };
  const el = document.getElementById(id);
  if (!items.length) {
    el.innerHTML = '<li class="empty">Sin datos todavía</li>';
    return;
  }
  const expanded = !!opts.expanded;
  const visible = expanded ? items : items.slice(0, 5);

  let html = visible.map((it, i) => `
    <li class="podium-item rank-${i + 1}">
      <span class="podium-rank">${i + 1}</span>
      ${avatar(it.name, 'sm')}
      <span class="podium-name">${it.name}${it.isGuest ? ' <span class="guest-tag">inv</span>' : ''}</span>
      <span class="podium-value">${it.value}${it.sub ? `<span class="podium-sub">${it.sub}</span>` : ''}</span>
    </li>
  `).join('');

  if (opts.expandable && items.length > 5) {
    html += `<li class="podium-expand">
      <button class="podium-expand-btn" data-target="${id}">
        ${expanded ? '▲ Ver menos' : `▼ Ver todos (${items.length})`}
      </button>
    </li>`;
  }
  el.innerHTML = html;
}

function togglePodium(id) {
  const state = podiumState[id];
  if (!state) return;
  state.opts.expanded = !state.opts.expanded;
  renderPodium(id, state.items, state.opts);
}

function renderPodiums(stats) {
  const arr = Object.values(stats);

  const mvps = arr
    .filter(s => s.mvps > 0)
    .sort((a, b) => b.mvps - a.mvps)
    .slice(0, 5)
    .map(s => ({ name: s.name, value: s.mvps, isGuest: s.isGuest }));
  renderPodium('top-mvps', mvps);

  const goleadores = arr
    .filter(s => s.goleadorCount > 0)
    .sort((a, b) => b.goleadorCount - a.goleadorCount)
    .slice(0, 5)
    .map(s => ({ name: s.name, value: s.goleadorCount, isGuest: s.isGuest }));
  renderPodium('top-goleadores', goleadores);

  const pointsPct = arr
    .filter(s => s.played >= 2)
    .map(s => {
      const points = s.wins * 3 + s.draws;
      const max = s.played * 3;
      const pct = max ? Math.round((points / max) * 100) : 0;
      return { name: s.name, value: pct, isGuest: s.isGuest, played: s.played, points, max };
    })
    .sort((a, b) => b.value - a.value || b.played - a.played)
    .map(s => ({
      name: s.name,
      value: s.value + '%',
      sub: `${s.played} PJ`,
      isGuest: s.isGuest
    }));
  renderPodium('top-winrate', pointsPct, { expandable: true });
}

function renderPlayerFilter(data, stats) {
  const select = document.getElementById('player-filter');
  const sorted = Object.values(stats).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  select.innerHTML = '<option value="">Elegí un jugador…</option>' + sorted.map(s =>
    `<option value="${s.name}">${s.name}${s.isGuest ? ' (invitado)' : ''}</option>`
  ).join('');

  const update = () => renderPlayerView(stats[select.value]);
  select.addEventListener('change', update);
  update();
}

function renderPlayerView(s) {
  const heroEl = document.getElementById('player-hero');
  const statsEl = document.getElementById('player-stats');
  const historyEl = document.getElementById('player-history');

  if (!s) {
    heroEl.innerHTML = '<div class="player-prompt">Elegí un jugador del menú para ver sus stats y su historial partido a partido.</div>';
    statsEl.innerHTML = '';
    historyEl.innerHTML = '';
    return;
  }

  heroEl.innerHTML = `
    ${avatar(s.name, 'lg')}
    <div class="player-hero-info">
      <h3>${s.name}${s.isGuest ? ' <span class="guest-tag">invitado</span>' : ''}</h3>
      <p>${s.played === 0 ? 'Sin partidos jugados' : `${s.played} ${s.played === 1 ? 'partido jugado' : 'partidos jugados'}`}</p>
    </div>
  `;

  if (s.played === 0) {
    statsEl.innerHTML = '<div class="empty" style="grid-column:1/-1">Este jugador todavía no jugó ningún partido.</div>';
    historyEl.innerHTML = '';
    return;
  }

  const points = s.wins * 3 + s.draws;
  const maxPoints = s.played * 3;
  const pointsPct = maxPoints ? Math.round((points / maxPoints) * 100) : 0;
  const streak = computeStreak(s.matches);

  statsEl.innerHTML = `
    <div class="stat-tile"><div class="stat-tile-value">${s.played}</div><div class="stat-tile-label">Partidos</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${s.wins}-${s.draws}-${s.losses}</div><div class="stat-tile-label">G - E - P</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${pointsPct}%</div><div class="stat-tile-label">% Puntos (${points}/${maxPoints})</div></div>
    <div class="stat-tile streak-${streak.type}"><div class="stat-tile-value">${streak.icon}${streak.count}</div><div class="stat-tile-label">${streak.label}</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${s.mvps}</div><div class="stat-tile-label">MVPs</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${s.goleadorCount}</div><div class="stat-tile-label">Goleador</div></div>
  `;

  const sorted = [...s.matches].sort((a, b) => b.date.localeCompare(a.date));
  historyEl.innerHTML = `
    <div class="history-title">Partido a partido</div>
    ${sorted.map(m => `
      <div class="history-row">
        <span class="history-date">${formatDate(m.date)}</span>
        <span class="history-team team-${m.team}">${m.team === 'claros' ? 'Claros' : 'Oscuros'}</span>
        <span class="history-result ${m.outcome}">${m.outcome === 'win' ? 'Ganó' : m.outcome === 'loss' ? 'Perdió' : 'Empate'}</span>
        <span class="history-badge">
          ${m.goleador ? `<span class="badge goleador">Goleador</span>` : ''}
          ${m.mvp ? `<span class="badge mvp">MVP</span>` : ''}
        </span>
      </div>
    `).join('')}
  `;
}

function renderMatches(data) {
  const grid = document.getElementById('matches-grid');
  const sorted = [...data.matches].sort((a, b) => b.date.localeCompare(a.date));

  if (!sorted.length) {
    grid.innerHTML = '<div class="empty">Todavía no se cargaron partidos.</div>';
    return;
  }

  grid.innerHTML = sorted.map(m => {
    const badgeText = m.winner === 'draw' ? 'Empate' : `Ganó ${m.winner === 'claros' ? 'Claros' : 'Oscuros'}`;

    const renderRoster = team => `
      <div class="roster">
        <div class="roster-header">${m.winner === team ? '<span class="winner-dot"></span>' : ''}${team === 'claros' ? 'Claros' : 'Oscuros'}</div>
        <ul class="roster-list">
          ${m[team].map(p => `<li class="roster-player">
            <span class="roster-name">${avatar(p, 'xs')}<span>${p}</span></span>
          </li>`).join('')}
        </ul>
      </div>
    `;

    const photos = Array.isArray(m.photos) ? m.photos : [];
    const photosHtml = photos.length ? `
      <div class="match-photos" data-photos='${JSON.stringify(photos).replace(/'/g, '&#39;')}'>
        ${photos.map((src, i) => `<img class="match-thumb" src="${src}" alt="" data-index="${i}">`).join('')}
      </div>
    ` : '';

    return `
      <div class="match-card">
        <div class="match-head">
          <div class="match-meta">
            <span class="match-date">${formatDate(m.date)}</span>
            ${m.stadium ? `<span class="match-stadium">📍 ${m.stadium} Stadium</span>` : ''}
          </div>
          <span class="match-result-badge ${m.winner}">${badgeText}</span>
        </div>
        <div class="match-rosters">
          ${renderRoster('claros')}
          ${renderRoster('oscuros')}
        </div>
        <div class="match-highlights">
          ${m.goleador ? `
            <div class="highlight-block goleador">
              ${avatar(m.goleador, 'md')}
              <div class="mvp-info">
                <span class="highlight-label">Goleador</span>
                <span class="highlight-name">${m.goleador}</span>
              </div>
            </div>
          ` : '<div></div>'}
          ${m.mvp ? `
            <div class="highlight-block mvp">
              ${avatar(m.mvp, 'md')}
              <div class="mvp-info">
                <span class="highlight-label">MVP</span>
                <span class="highlight-name">${m.mvp}</span>
              </div>
            </div>
          ` : '<div></div>'}
        </div>
        ${photosHtml}
      </div>
    `;
  }).join('');
}

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCounter = document.getElementById('lightbox-counter');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');
let lightboxGallery = [];
let lightboxIndex = 0;

function showLightboxAt(idx) {
  lightboxIndex = (idx + lightboxGallery.length) % lightboxGallery.length;
  lightboxImg.src = lightboxGallery[lightboxIndex];
  lightboxCounter.textContent = lightboxGallery.length > 1 ? `${lightboxIndex + 1} / ${lightboxGallery.length}` : '';
}

function openLightbox(photos, index) {
  lightboxGallery = photos;
  showLightboxAt(index);
  lightboxPrev.style.display = photos.length > 1 ? '' : 'none';
  lightboxNext.style.display = photos.length > 1 ? '' : 'none';
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
}

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
lightboxPrev.addEventListener('click', () => showLightboxAt(lightboxIndex - 1));
lightboxNext.addEventListener('click', () => showLightboxAt(lightboxIndex + 1));
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  else if (e.key === 'ArrowLeft') showLightboxAt(lightboxIndex - 1);
  else if (e.key === 'ArrowRight') showLightboxAt(lightboxIndex + 1);
});

document.addEventListener('click', (e) => {
  const expandBtn = e.target.closest('.podium-expand-btn');
  if (expandBtn) {
    togglePodium(expandBtn.dataset.target);
    return;
  }
  if (e.target.classList.contains('match-thumb')) {
    const container = e.target.closest('.match-photos');
    const photos = JSON.parse(container.dataset.photos);
    const index = parseInt(e.target.dataset.index, 10);
    openLightbox(photos, index);
    return;
  }
  const galleryItem = e.target.closest('.gallery-item');
  if (galleryItem) {
    const strip = document.getElementById('gallery-strip');
    const photos = JSON.parse(strip.dataset.photos || '[]');
    const index = parseInt(galleryItem.dataset.index, 10);
    if (photos.length) openLightbox(photos, index);
    return;
  }
  const av = e.target.closest('.avatar.avatar-clickable');
  if (av) {
    const img = av.querySelector('img');
    if (img && img.src) openLightbox([img.src], 0);
  }
});

async function init() {
  try {
    const data = await loadData();
    const stats = computePlayerStats(data);
    renderHeroStats(data);
    renderHeroNote();
    renderSpotlights(stats);
    renderNextMatch(data);
    renderHighlights(data, stats);
    renderGallery(data);
    renderPodiums(stats);
    renderPlayerFilter(data, stats);
    renderMatches(data);
  } catch (e) {
    document.querySelector('.container').innerHTML = `<div class="empty">Error cargando los datos: ${e.message}</div>`;
  }
}

init();
