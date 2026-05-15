# El Gremio Fútbol — Dashboard

Sitio estático para ver resultados, MVPs y goleadores del gremio.
Editamos `data.json` y el dashboard se actualiza solo en 30s.

---

## Archivos

- `index.html` — la página
- `style.css` — estilos
- `app.js` — lógica del dashboard
- `data.json` — **EL ÚNICO ARCHIVO DE DATOS**
- `img/` — fotos de jugadores (`img/Nombre.jpg` o `.png`)
- `img/matches/YYYY-MM-DD/` — fotos de cada partido

---

## Modelo de un partido

```json
{
  "date": "2026-05-15",
  "claros": ["Tincho", "Mati", "Juli", "Juani", "Fede"],
  "oscuros": ["Minu", "Mickey", "Gasti", "Juancho", "Luki"],
  "winner": "claros",
  "goleador": "Tincho",
  "mvp": "Mati",
  "photos": [
    "img/matches/2026-05-15/equipo.jpg",
    "img/matches/2026-05-15/cena.jpg"
  ],
  "notes": ""
}
```

### Reglas

- **date**: formato `YYYY-MM-DD`
- **claros / oscuros**: array con los 5 nombres
- **winner**: `"claros"`, `"oscuros"` o `"draw"` (empate)
- **goleador**: nombre del jugador que más goles metió ese partido. Si no se anotó, `""`
- **mvp**: nombre del jugador elegido figura del partido
- **photos**: array opcional con paths a las fotos del partido. Pueden ir varias.
- **notes**: opcional

### Lógica de stats

- **MVPs**: cantidad de veces que un jugador fue MVP
- **Goleador**: cantidad de veces que un jugador fue goleador del partido
- **Win rate**: % de partidos ganados (su equipo es el `winner`)
- **G - E - P**: ganados, empatados, perdidos

---

## Fotos de jugadores

Las fotos son opcionales. Si no hay foto se muestra un círculo con iniciales y color único por nombre.

- Path: `img/Tincho.jpg` o `img/Tincho.png`
- Nombre exacto al del array `players`, respetando mayúsculas
- Cuadradas idealmente (200x200), JPG o PNG

## Fotos de cada partido

Subir a una subcarpeta por fecha: `img/matches/2026-05-15/...`. Después referenciar el path completo en el array `photos` del partido. Click en miniatura → se abre lightbox a pantalla completa.

---

## Workflow para cargar un partido

Hablale a Claude. Te pide los datos (fecha, claros, oscuros, winner, goleador, MVP, opcional fotos), edita `data.json` y pushea. Vercel redeploya solo en 30s.
