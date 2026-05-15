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

  document.getElementById('hero-stats').innerHTML = `
    <div class="hero-stat"><div class="hero-stat-value">${total}</div><div class="hero-stat-label">Partidos</div></div>
    <div class="hero-stat"><div class="hero-stat-value">${clarosWins}</div><div class="hero-stat-label">Wins Claros</div></div>
    <div class="hero-stat"><div class="hero-stat-value">${oscurosWins}</div><div class="hero-stat-label">Wins Oscuros</div></div>
    <div class="hero-stat"><div class="hero-stat-value">${draws}</div><div class="hero-stat-label">Empates</div></div>
    <div class="hero-stat"><div class="hero-stat-value">${players}</div><div class="hero-stat-label">Jugadores</div></div>
  `;
}

function renderHeroNote() {
  document.getElementById('hero-note').innerHTML = `
    <span>★ Figura del torneo <em>para los que saben de fútbol</em>:</span>
    ${avatar('Juancho', 'sm')}
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

  statsEl.innerHTML = `
    <div class="stat-tile"><div class="stat-tile-value">${s.played}</div><div class="stat-tile-label">Partidos</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${s.wins}-${s.draws}-${s.losses}</div><div class="stat-tile-label">G - E - P</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${pointsPct}%</div><div class="stat-tile-label">% Puntos (${points}/${maxPoints})</div></div>
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
          <span class="match-date">${formatDate(m.date)}</span>
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
    renderPodiums(stats);
    renderPlayerFilter(data, stats);
    renderMatches(data);
  } catch (e) {
    document.querySelector('.container').innerHTML = `<div class="empty">Error cargando los datos: ${e.message}</div>`;
  }
}

init();
