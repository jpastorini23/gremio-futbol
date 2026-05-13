# El Gremio Fútbol — Dashboard

Sitio estático para ver resultados, goleadores y MVPs del gremio.
Vos editás `data.json` desde GitHub y el dashboard se actualiza solo en 30s.

---

## Archivos

- `index.html` — la página
- `style.css` — estilos
- `app.js` — lógica del dashboard
- `data.json` — **EL ÚNICO ARCHIVO QUE TENÉS QUE EDITAR**

---

## Cómo poner el sitio online (una sola vez, 10 minutos)

### 1. Crear cuenta de GitHub
- Entrá a https://github.com/signup
- Usá un email tuyo, elegí un usuario (ej: `juancruzpastorini`)
- Verificá el mail

### 2. Crear el repositorio
- Una vez logueado, arriba a la derecha clic en `+` → `New repository`
- Nombre: `gremio-futbol`
- Dejalo en **Public**
- Marcá "Add a README file"
- Clic en `Create repository`

### 3. Subir los archivos
- Adentro del repo recién creado, clic en `Add file` → `Upload files`
- Arrastrá los 4 archivos de la carpeta `gremio-futbol`: `index.html`, `style.css`, `app.js`, `data.json`
- Abajo escribí "primera versión" y clic en `Commit changes`

### 4. Deployar gratis en Vercel
- Entrá a https://vercel.com/signup
- Clic en `Continue with GitHub` (te autoriza)
- En el dashboard de Vercel, clic en `Add New...` → `Project`
- Te aparece tu repo `gremio-futbol`, clic en `Import`
- Dejá todo por default y clic en `Deploy`
- Esperá 30 segundos. Te da un link tipo: `https://gremio-futbol.vercel.app`

**Listo, ese es el link que compartís al grupo.**

---

## Cómo cargar un partido nuevo

1. Entrá a tu repo en github.com → clic en `data.json`
2. Arriba a la derecha, clic en el iconito de lápiz (Edit)
3. Copiá un bloque de partido existente y editalo. Formato:

```json
{
  "date": "2026-05-22",
  "claros": ["Juan", "Pedro", "Luis", "Mateo", "Tomas"],
  "oscuros": ["Diego", "Nico", "Santi", "Facu", "Agus"],
  "goals": {
    "Juan": 2,
    "Pedro": 1,
    "Diego": 3
  },
  "mvp": "Diego",
  "notes": ""
}
```

4. Abajo clic en `Commit changes`
5. Vercel redeploya solo. En 30 segundos el dashboard tiene el partido nuevo.

### Reglas del data.json

- **date**: formato `YYYY-MM-DD` (año-mes-día)
- **claros / oscuros**: array con los nombres tal cual aparecen en `players`
- **goals**: solo poné los que metieron goles, los demás se asume 0. El resultado del partido se calcula solo sumando.
- **mvp**: nombre exacto. Si no hubo MVP esa fecha, poné `""` (string vacío).
- **notes**: opcional. Por ahora no se muestra, queda para vos.
- Los nombres tienen que ser **idénticos** a los del array `players`. Si querés agregar a alguien nuevo, primero metelo en `players` arriba.

### Agregar un jugador nuevo

En el bloque `players` de arriba, sumalo a la lista:

```json
"players": [
  "Juan", "Pedro", ..., "Joaco", "Tobi"
]
```

---

## Fotos de los jugadores

Las fotos son **opcionales** — si no hay foto, se muestra un círculo de color con las iniciales del nombre. Para agregar fotos:

1. En el repo en GitHub, clic en `Add file` → `Upload files`
2. **Importante:** arriba dice "gremio-futbol /". Al lado del nombre del archivo en la barra (o en el nombre del archivo a subir), escribí `img/Tincho.jpg` (la barra `/` crea la carpeta).
   - O subí el archivo primero y después editá el nombre poniéndole `img/` adelante
3. El archivo se tiene que llamar **exacto** como el jugador. Si en `players` figura `Tincho`, la foto va como `Tincho.jpg` (respetando mayúsculas/minúsculas).
4. Formato: **JPG o PNG**, cuadrada (recomendado 200x200 píxeles para que pese poco)
5. Commit changes

Si subiste mal el nombre o el formato, simplemente reemplazá el archivo con el correcto desde la misma carpeta `img/` del repo.

---

## Lógica de stats

- **Goles del jugador**: lo que pusiste en `goals`
- **Goles recibidos del jugador**: los goles que metió el equipo rival en cada partido que jugó (sumados)
- **MVPs**: cantidad de veces que aparece su nombre en `mvp`
- **Win Rate**: % de partidos ganados (su equipo metió más goles)
- En el podio de "menos goles recibidos" solo aparecen jugadores con 2+ partidos (para no premiar al que jugó una sola fecha)

---

## Para previsualizar local antes de subir

Desde la carpeta del proyecto:

```
cd gremio-futbol
python3 -m http.server 8000
```

Y abrí http://localhost:8000 en el browser.

(No alcanza con abrir el `index.html` directo — el navegador bloquea el `fetch` del JSON sin un servidor.)
