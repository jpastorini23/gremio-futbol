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
  return `<span class="avatar avatar-${size}" data-initials="${initials(name)}" style="background:${color}"><img src="img/${name}.jpg" alt="" ${fallback}></span>`;
}

function teamGoals(match, team) {
  return match[team].reduce((sum, p) => sum + (match.goals[p] || 0), 0);
}

function matchResult(match) {
  const c = teamGoals(match, 'claros');
  const o = teamGoals(match, 'oscuros');
  return { claros: c, oscuros: o, winner: c > o ? 'claros' : c < o ? 'oscuros' : 'draw' };
}

function computePlayerStats(data) {
  const regulars = new Set(data.players);
  const allNames = new Set(data.players);
  for (const m of data.matches) {
    [...m.claros, ...m.oscuros].forEach(p => allNames.add(p));
  }

  const stats = {};
  for (const p of allNames) {
    stats[p] = {
      name: p,
      isGuest: !regulars.has(p),
      played: 0,
      goals: 0,
      conceded: 0,
      mvps: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      matches: []
    };
  }

  for (const m of data.matches) {
    const r = matchResult(m);
    const all = [...m.claros.map(p => ['claros', p]), ...m.oscuros.map(p => ['oscuros', p])];

    for (const [team, p] of all) {
      if (!stats[p]) continue;
      const opp = team === 'claros' ? 'oscuros' : 'claros';
      const goalsFor = r[team];
      const goalsAgainst = r[opp];
      const outcome = r.winner === 'draw' ? 'draw' : (r.winner === team ? 'win' : 'loss');

      stats[p].played++;
      stats[p].goals += (m.goals[p] || 0);
      stats[p].conceded += goalsAgainst;
      if (m.mvp === p) stats[p].mvps++;
      if (outcome === 'win') stats[p].wins++;
      else if (outcome === 'loss') stats[p].losses++;
      else stats[p].draws++;

      stats[p].matches.push({
        date: m.date,
        team,
        outcome,
        goalsFor,
        goalsAgainst,
        playerGoals: m.goals[p] || 0,
        mvp: m.mvp === p
      });
    }
  }

  return stats;
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' });
}

function renderHeroStats(data, stats) {
  const totalMatches = data.matches.length;
  const totalGoals = data.matches.reduce((s, m) => s + Object.values(m.goals).reduce((a, b) => a + b, 0), 0);
  const totalPlayers = data.players.length;
  const avg = totalMatches ? (totalGoals / totalMatches).toFixed(1) : '0';

  const el = document.getElementById('hero-stats');
  el.innerHTML = `
    <div class="hero-stat"><div class="hero-stat-value">${totalMatches}</div><div class="hero-stat-label">Partidos</div></div>
    <div class="hero-stat"><div class="hero-stat-value">${totalGoals}</div><div class="hero-stat-label">Goles totales</div></div>
    <div class="hero-stat"><div class="hero-stat-value">${avg}</div><div class="hero-stat-label">Goles/partido</div></div>
    <div class="hero-stat"><div class="hero-stat-value">${totalPlayers}</div><div class="hero-stat-label">Jugadores</div></div>
  `;
}

function renderPodium(id, items, valueLabel) {
  const el = document.getElementById(id);
  if (!items.length) {
    el.innerHTML = '<li class="empty">Sin datos todavía</li>';
    return;
  }
  el.innerHTML = items.map((it, i) => `
    <li class="podium-item rank-${i + 1}">
      <span class="podium-rank">${i + 1}</span>
      ${avatar(it.name, 'sm')}
      <span class="podium-name">${it.name}${it.isGuest ? ' <span class="guest-tag">inv</span>' : ''}</span>
      <span class="podium-value">${it.value}</span>
    </li>
  `).join('');
}

function renderPodiums(stats) {
  const arr = Object.values(stats);

  const scorers = arr
    .filter(s => s.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 5)
    .map(s => ({ name: s.name, value: s.goals, isGuest: s.isGuest }));
  renderPodium('top-scorers', scorers);

  const conceded = arr
    .filter(s => s.played >= 2)
    .sort((a, b) => (a.conceded / a.played) - (b.conceded / b.played))
    .slice(0, 5)
    .map(s => ({ name: s.name, value: (s.conceded / s.played).toFixed(1), isGuest: s.isGuest }));
  renderPodium('least-conceded', conceded);

  const mvps = arr
    .filter(s => s.mvps > 0)
    .sort((a, b) => b.mvps - a.mvps)
    .slice(0, 5)
    .map(s => ({ name: s.name, value: s.mvps, isGuest: s.isGuest }));
  renderPodium('top-mvps', mvps);
}

function renderPlayerFilter(data, stats) {
  const select = document.getElementById('player-filter');
  const sorted = Object.values(stats).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  select.innerHTML = sorted.map(s =>
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
    heroEl.innerHTML = '';
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

  const winRate = s.played ? Math.round((s.wins / s.played) * 100) : 0;
  const gpm = s.played ? (s.goals / s.played).toFixed(1) : '0';
  const gam = s.played ? (s.conceded / s.played).toFixed(1) : '0';

  statsEl.innerHTML = `
    <div class="stat-tile"><div class="stat-tile-value">${s.played}</div><div class="stat-tile-label">Partidos</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${s.goals}</div><div class="stat-tile-label">Goles</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${gpm}</div><div class="stat-tile-label">Goles/PJ</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${s.conceded}</div><div class="stat-tile-label">G. Recibidos</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${gam}</div><div class="stat-tile-label">GR/PJ</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${s.mvps}</div><div class="stat-tile-label">MVPs</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${winRate}%</div><div class="stat-tile-label">Win Rate</div></div>
    <div class="stat-tile"><div class="stat-tile-value">${s.wins}-${s.draws}-${s.losses}</div><div class="stat-tile-label">G - E - P</div></div>
  `;

  const sorted = [...s.matches].sort((a, b) => b.date.localeCompare(a.date));
  historyEl.innerHTML = `
    <div class="history-title">Partido a partido</div>
    ${sorted.map(m => `
      <div class="history-row">
        <span class="history-date">${formatDate(m.date)}</span>
        <span class="history-team team-${m.team}">${m.team === 'claros' ? 'Claros' : 'Oscuros'}</span>
        <span class="history-result ${m.outcome === 'win' ? 'win' : m.outcome === 'loss' ? 'loss' : 'draw'}">${m.goalsFor}-${m.goalsAgainst}</span>
        <span class="history-badge">
          ${m.playerGoals > 0 ? `<span class="badge goals">${m.playerGoals} ${m.playerGoals === 1 ? 'gol' : 'goles'}</span>` : ''}
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
    const r = matchResult(m);
    const renderRoster = team => `
      <ul class="roster-list">
        ${m[team].map(p => {
          const g = m.goals[p] || 0;
          return `<li class="roster-player ${g > 0 ? 'scorer' : ''}">
            <span class="roster-name">${avatar(p, 'xs')}<span>${p}</span></span>${g > 0 ? `<span class="roster-goals">${g}</span>` : ''}
          </li>`;
        }).join('')}
      </ul>
    `;

    return `
      <div class="match-card">
        <div class="match-date">${formatDate(m.date)}</div>
        <div class="match-score">
          <div class="team-side ${r.winner === 'claros' ? 'winner' : ''}">
            <div class="team-name">Claros</div>
            <div class="team-score">${r.claros}</div>
          </div>
          <div class="score-divider">vs</div>
          <div class="team-side ${r.winner === 'oscuros' ? 'winner' : ''}">
            <div class="team-name">Oscuros</div>
            <div class="team-score">${r.oscuros}</div>
          </div>
        </div>
        <div class="match-rosters">
          <div class="roster">
            <div class="roster-header">Claros</div>
            ${renderRoster('claros')}
          </div>
          <div class="roster">
            <div class="roster-header">Oscuros</div>
            ${renderRoster('oscuros')}
          </div>
        </div>
        ${m.mvp ? `<div class="match-mvp">
          ${avatar(m.mvp, 'md')}
          <div class="mvp-info">
            <span class="mvp-label">MVP</span>
            <span class="mvp-name">${m.mvp}</span>
          </div>
        </div>` : ''}
      </div>
    `;
  }).join('');
}

async function init() {
  try {
    const data = await loadData();
    const stats = computePlayerStats(data);
    renderHeroStats(data, stats);
    renderPodiums(stats);
    renderPlayerFilter(data, stats);
    renderMatches(data);
  } catch (e) {
    document.querySelector('.container').innerHTML = `<div class="empty">Error cargando los datos: ${e.message}</div>`;
  }
}

init();
