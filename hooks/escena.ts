/**
 * Arma el SVG de la escena: ciudad actual de noche bajo una tormenta, con rayos y neón.
 *
 * Todo sale de funciones puras sobre un generador con semilla fija, así la escena es
 * siempre la misma. El fondo se dibuja en un frame sin scripts, así que las animaciones
 * son declarativas: se escriben como SMIL y `aCss` las entrega como CSS.
 */

/** Límite de caracteres que acepta el elemento `Svg` de la app. */
export const LIMITE_SVG = 131072

type Opciones = {
  /** Rayos y el resplandor de las nubes. */
  rayos: boolean
  /** Multiplica la cantidad de gotas de cada capa de lluvia del SVG. */
  lluvia: number
  /** Patrulla, peatones y gotas que bajan por el vidrio. */
  extras: boolean
  /** Parpadeo de letreros. */
  parpadeo: boolean
  /** Cielo de arriba abajo y el resplandor del horizonte. */
  cielo: readonly [string, string, string, string]
  /**
   * La lluvia la dibuja la placa de video (`lluvia-gpu.ts`): el SVG va sin lluvia y con las
   * capas grandes quietas, para redibujar solo lo chico que se mueve.
   */
  gpu?: boolean
}

/**
 * Movimiento lento de una capa que cruza toda la pantalla (nubes, niebla). Con la placa de
 * video se omite: apenas se nota y obligaría a redibujar toda la escena en cada cuadro.
 */
const deriva = (o: Opciones, values: string, dur: number) => (o.gpu ? '' : mover(values, dur))

const TORMENTA: Opciones = { rayos: true, lluvia: 1, extras: true, parpadeo: true, cielo: ['#010103', '#06060c', '#140c18', '#ff3fa4'] }

/**
 * Margen dibujado fuera de los 680×440: la escena se ajusta entera a la ventana
 * y lo que sobra a los costados o arriba muestra este margen en vez de recortar.
 * 210 a cada lado cubre hasta 21:9; hacia arriba llega a ventanas verticales.
 */
const B = 210
const ANCHO = 680 + 2 * B

/** Cómo se ajusta el SVG a la ventana. */
export const AJUSTE = 'xMidYMax meet'

const NEON = ['#ff3fa4', '#2ee6ff', '#b84dff', '#ff5a36', '#3dff9e']
const LUZ = ['#e8d9b0', '#e8d9b0', '#f2e6c8', '#bcd3ff', '#d6e2f5']

/** Generador de Park-Miller: determinista, sin depender de Math.random. */
const crearRng = (semilla: number) => {
  let s = semilla
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** Redondea a un decimal: cada carácter cuenta contra el límite del SVG. */
const n = (v: number) => Math.round(v * 10) / 10

const anim = (attr: string, values: string, dur: number, extra = '') =>
  `<animate attributeName="${attr}" values="${values}" dur="${n(dur)}s" repeatCount="indefinite"${extra}/>`

const mover = (values: string, dur: number, extra = '') =>
  `<animateTransform attributeName="transform" type="translate" values="${values}" dur="${n(dur)}s" repeatCount="indefinite"${extra}/>`

/**
 * Agranda o achica desde el origen del elemento (dibujarlo centrado en 0,0). Más barato que
 * animar `rx`, `ry` o `cy`, que obligan a recalcular la forma en cada cuadro.
 */
const escalar = (values: string, dur: number, extra = '') =>
  `<animateTransform attributeName="transform" type="scale" values="${values}" dur="${n(dur)}s" repeatCount="indefinite"${extra}/>`

/**
 * Instantes de un ciclo como fracción, a cuatro decimales: los cambios de luz necesitan
 * tramos de decenas de milisegundos, que `n` (un decimal) borraría y volvería saltos.
 */
const t4 = (...ts: number[]) => ts.map(t => Math.round(t * 1e4) / 1e4).join(';')

/**
 * Cuántos segundos dura como mínimo cada subida o bajada de luz. La app congela una escena
 * que destella, así que la luz nunca salta: sube y baja en tramos de este largo o más.
 */
const RAMPA = 0.12

/**
 * Resplandor de un rayo: sube, rebota una vez y se apaga despacio. `pico` es la opacidad
 * máxima; en capas grandes tiene que quedar baja para no contar como destello.
 */
const destello = (pico: number, en: number, dur: number) => {
  const p = RAMPA / dur
  return anim(
    'opacity',
    `0;0;${pico};${n(pico * 0.5)};${n(pico * 0.8)};0;0`,
    dur,
    ` keyTimes="${t4(0, en, en + p, en + 2 * p, en + 3 * p, en + 8 * p, 1)}"`,
  )
}

/** Un letrero que falla: baja un poco la luz y vuelve, sin apagarse del todo. */
const parpadeo = (dur: number, en: number) => {
  const p = RAMPA / dur
  return anim('opacity', '1;1;.45;1;.7;1;1', dur, ` keyTimes="${t4(0, en, en + p, en + 2 * p, en + 3 * p, en + 4 * p, 1)}"`)
}

const FUENTE = 'font-family="Arial,Helvetica,sans-serif" font-weight="700"'

/** Texto de neón: dos halos de trazo ancho y el núcleo claro encima. */
const textoNeon = (
  x: number, y: number, texto: string, color: string, nucleo: string,
  tam: number, espaciado = 0, ancla = 'start',
) => {
  // La fuente la hereda del <svg>; los valores por defecto no se escriben.
  const base = `x="${x}" y="${y}" font-size="${tam}"` +
    (espaciado ? ` letter-spacing="${espaciado}"` : '') + (ancla === 'start' ? '' : ` text-anchor="${ancla}"`)
  return (
    `<text ${base} fill="none" stroke="${color}" stroke-width="9" stroke-opacity=".08" stroke-linejoin="round">${texto}</text>` +
    `<text ${base} fill="none" stroke="${color}" stroke-width="4" stroke-opacity=".18" stroke-linejoin="round">${texto}</text>` +
    `<text ${base} fill="${nucleo}" stroke="${color}" stroke-width=".6">${texto}</text>`
  )
}

const marcoNeon = (x: number, y: number, w: number, h: number, color: string, rx = 2) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${color}" stroke-width="6" stroke-opacity=".12"/>` +
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${color}" stroke-width="1.2"/>`

const lineaNeon = (puntos: string, color: string, ancho = 1, extra = '') =>
  `<g${extra}><polyline points="${puntos}" fill="none" stroke="${color}" stroke-width="${ancho * 6}" stroke-opacity=".12" stroke-linejoin="round"/>` +
  `<polyline points="${puntos}" fill="none" stroke="${color}" stroke-width="${ancho}" stroke-linejoin="round"/></g>`

const defs = (o: Opciones, [c0, c1, c2, hz] = o.cielo) =>
  '<defs>' +
  `<linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset=".6" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>` +
  `<linearGradient id="hz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hz}" stop-opacity="0"/><stop offset="1" stop-color="${hz}" stop-opacity=".1"/></linearGradient>` +
  '<linearGradient id="calle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07070b"/><stop offset="1" stop-color="#020203"/></linearGradient>' +
  '<linearGradient id="cono" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe0b0" stop-opacity=".2"/><stop offset="1" stop-color="#ffe0b0" stop-opacity="0"/></linearGradient>' +
  '<linearGradient id="faroD" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#eef3ff" stop-opacity=".28"/><stop offset="1" stop-color="#eef3ff" stop-opacity="0"/></linearGradient>' +
  '<linearGradient id="faroI" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#eef3ff" stop-opacity=".28"/><stop offset="1" stop-color="#eef3ff" stop-opacity="0"/></linearGradient>' +
  '<linearGradient id="niebla" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3050" stop-opacity="0"/><stop offset=".5" stop-color="#3a3050" stop-opacity=".18"/><stop offset="1" stop-color="#3a3050" stop-opacity="0"/></linearGradient>' +
  // Lluvia del margen: un mosaico que se desplaza un módulo por ciclo, sin costura. Con la placa
  // de video no va, porque su animación seguiría corriendo aunque nadie la use.
  (o.gpu
    ? ''
    : '<pattern id="ll" width="36" height="120" patternUnits="userSpaceOnUse"><path d="M30 10l-4.2 14M12 52l-6 20M24 86l-4.2 14" stroke="#9aa4bd" stroke-width="1.1" opacity=".3"/>' +
      '<animateTransform attributeName="patternTransform" type="translate" values="0,0;-36,120" dur=".2s" repeatCount="indefinite"/></pattern>') +
  '</defs>'

const rayo = (d: string, ramas: string[], en: number, dur: number) =>
  `<g fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="0">` +
  `<path d="${d}" stroke="#8a6cff" stroke-width="8" opacity=".3"/>` +
  `<path d="${d}" stroke="#f1eeff" stroke-width="2"/>` +
  ramas.map(r => `<path d="${r}" stroke="#d2ccf5" stroke-width="1"/>`).join('') +
  // El rayo se enciende, titila una vez sin apagarse y se desvanece: nunca salta de golpe.
  anim('opacity', '0;0;1;.45;1;0;0', dur, ` keyTimes="${t4(0, en, en + RAMPA / dur, en + (2 * RAMPA) / dur, en + (3 * RAMPA) / dur, en + (7 * RAMPA) / dur, 1)}"`) +
  '</g>'

/** Cielo, nubes, rayos y el avión. */
const cielo = (o: Opciones) => {
  let s = `<rect x="${-B}" y="-1200" width="${ANCHO}" height="1192" fill="${o.cielo[0]}"/><rect x="${-B}" y="-10" width="${ANCHO}" height="460" fill="url(#cielo)"/>`
  // El cielo apenas se aclara: la luz fuerte queda en el rayo y en las nubes de alrededor.
  // Con la placa de video, esta luz y la de las nubes las pone el shader: tapan mucho y obligarían
  // a redibujar toda la escena mientras dura el rayo. Los rayos, finos, quedan en el SVG.
  if (o.rayos && !o.gpu) s +=`<rect x="${-B}" y="-1200" width="${ANCHO}" height="1530" fill="#7f88b8" opacity="0">${destello(0.16, 0.58, 7)}</rect>`
  s +=
    '<g fill="#08080d"><ellipse cx="90" cy="40" rx="140" ry="40"/><ellipse cx="300" cy="25" rx="170" ry="38"/><ellipse cx="540" cy="45" rx="190" ry="44"/>' +
    '<ellipse cx="-130" cy="50" rx="150" ry="40"/><ellipse cx="800" cy="35" rx="160" ry="42"/><ellipse cx="200" cy="-90" rx="260" ry="50"/><ellipse cx="560" cy="-180" rx="240" ry="46"/>' +
    deriva(o, '0,0;-25,0;0,0', 40) + '</g>' +
    '<g fill="#0e0d16"><ellipse cx="200" cy="72" rx="120" ry="26"/><ellipse cx="450" cy="80" rx="150" ry="24"/><ellipse cx="640" cy="66" rx="90" ry="22"/><ellipse cx="20" cy="82" rx="80" ry="18"/>' +
    deriva(o, '0,0;20,0;0,0', 30) + '</g>' +
    `<ellipse cx="340" cy="96" rx="340" ry="18" fill="${o.cielo[3]}" opacity=".05"/>`
  if (o.rayos) {
    if (!o.gpu)
      s +=
        `<g fill="#a9b4e0" opacity="0"><ellipse cx="420" cy="86" rx="130" ry="14"/><ellipse cx="470" cy="62" rx="80" ry="10"/>${destello(0.35, 0.58, 7)}</g>` +
        `<g fill="#a9b4e0" opacity="0"><ellipse cx="140" cy="72" rx="110" ry="12"/>${destello(0.3, 0.3, 11)}</g>`
    s +=
      rayo('M455 82 L438 120 L452 124 L425 175 L440 178 L410 240', ['M438 120 L415 140 L405 165 L392 172', 'M425 175 L455 200 L462 222', 'M452 124 L478 132 L490 150'], 0.58, 7) +
      rayo('M150 77 L162 105 L148 108 L170 150 L158 152 L176 190', ['M162 105 L182 118 L188 134'], 0.3, 11)
  }
  s +=
    '<g transform="translate(400,110)"><circle r="1.2" fill="#fff">' +
    anim('opacity', '1;0;0;1', 1.4, ' keyTimes="0;.1;.9;1"') +
    '</circle><circle cx="-6" r="1" fill="#ff3030">' + anim('opacity', '0;1;0', 1) + '</circle>' +
    mover(`${680 + B},124;${-B},90`, 52) + '</g>' +
    `<rect x="${-B}" y="200" width="${ANCHO}" height="130" fill="url(#hz)"/>`
  return s
}

type Edificio = { x: number; w: number; top: number; inclinado: boolean }

/** Skyline lejano y la fila media de rascacielos con sus tiras LED. */
const ciudad = (r: () => number, o: Opciones) => {
  const al = <T,>(lista: T[]) => lista[Math.floor(r() * lista.length)] as T
  let s = ''
  for (let x = -5; x < 680;) {
    const w = 18 + r() * 30, h = 70 + r() * 120
    s += `<rect x="${n(x)}" y="${n(330 - h)}" width="${n(w)}" height="${n(h)}" fill="#0b0b11"/>`
    for (let wy = 330 - h + 6; wy < 325; wy += 6)
      for (let wx = x + 3; wx < x + w - 3; wx += 4)
        if (r() < 0.05) s += `<rect x="${n(wx)}" y="${n(wy)}" width="2" height="1.5" fill="${r() < 0.15 ? al(NEON) : '#3a3a48'}" opacity=".6"/>`
    if (h > 150) s += `<circle cx="${n(x + w / 2)}" cy="${n(329 - h)}" r="1.1" fill="#ff2b2b">${anim('opacity', '1;.1;1', 2.6, ` begin="${n(r() * 2)}s"`)}</circle>`
    x += w + r() * 4
  }
  s += `<rect x="${-B}" y="230" width="${ANCHO}" height="60" fill="url(#niebla)">${deriva(o, '0,0;0,-6;0,0', 12)}</rect>`

  const medios: Edificio[] = []
  for (let x = 92; x < 566;) {
    const w = 34 + r() * 44, h = 110 + r() * 160, top = 330 - h, inclinado = r() < 0.3
    medios.push({ x, w, top, inclinado })
    const techo = inclinado ? top + 14 : top + 4
    s += inclinado
      ? `<path d="M${n(x)} ${n(top + 14)} L${n(x + w)} ${n(top)} L${n(x + w)} 330 L${n(x)} 330 Z" fill="#07070b"/>`
      : `<rect x="${n(x)}" y="${n(top)}" width="${n(w)}" height="${n(h)}" fill="#07070b"/>`
    s += `<rect x="${n(x + w - 4)}" y="${n(top)}" width="4" height="${n(h)}" fill="#0c0c12"/>`
    let mullones = ''
    for (let mx = x + 5; mx < x + w - 4; mx += 5) mullones += `M${n(mx)} ${n(techo)}V330`
    s += `<path d="${mullones}" stroke="#10111a" stroke-width=".5"/>`
    if (!inclinado && r() < 0.6) s += `<rect x="${n(x + w * 0.3)}" y="${n(top - 6)}" width="${n(w * 0.4)}" height="6" fill="#0a0a0f"/>`
    s += `<circle cx="${n(x + w / 2)}" cy="${n(inclinado ? top + 2 : top - 7)}" r="1.5" fill="#ff2b2b">${anim('opacity', '1;.05;1', 2.4, ` begin="${n(r() * 2)}s"`)}</circle>`
    for (let wy = top + (inclinado ? 20 : 10); wy < 280; wy += 6) {
      if (r() > 0.22) continue
      const a = r() * w * 0.5, b = a + 6 + r() * w * 0.45
      s += `<rect x="${n(x + 3 + a)}" y="${n(wy)}" width="${n(Math.max(2, Math.min(b, w - 7) - a))}" height="2.2" fill="${al(LUZ)}" opacity="${n(0.18 + r() * 0.4)}"/>`
    }
    if (r() < 0.55) {
      const lado = r() < 0.5 ? x : x + w
      const y0 = inclinado && lado === x ? top + 14 : top
      s += lineaNeon(`${n(lado)},${n(y0)} ${n(lado)},330`, al(NEON), 0.8)
        .replace('</g>', (o.parpadeo ? anim('opacity', '.9;.3;.9', 3 + r() * 4) : '') + '</g>')
    }
    x += w + 2 + r() * 8
  }

  // Corona del más alto: cambia de color de a poco, como las fachadas LED.
  const alto = medios.filter(b => !b.inclinado).sort((a, b) => a.top - b.top)[0]
  if (alto) {
    const { x, w, top } = alto
    const pts = `${n(x)},${n(top + 18)} ${n(x + w * 0.25)},${n(top + 6)} ${n(x + w * 0.5)},${n(top + 18)} ${n(x + w * 0.75)},${n(top + 6)} ${n(x + w)},${n(top + 18)}`
    const ciclo = anim('stroke', '#b84dff;#ff3fa4;#2ee6ff;#b84dff', 9)
    s +=
      `<polyline points="${pts}" fill="none" stroke="#b84dff" stroke-width="6" stroke-opacity=".12">${ciclo}</polyline>` +
      `<polyline points="${pts}" fill="none" stroke="#b84dff" stroke-width="1">${ciclo}</polyline>` +
      lineaNeon(`${n(x)},${n(top + 26)} ${n(x + w)},${n(top + 26)}`, '#2ee6ff', 0.8)
  }
  // Lejos del letrero BAR del frente (x 70–90) para que no se encimen.
  const segundo = medios.find(b => b.x + b.w / 2 > 150 && b.x < 280 && !b.inclinado && b !== alto)
  if (segundo)
    s += `<g>${textoNeon(n(segundo.x + segundo.w / 2), n(segundo.top - 4), 'PLAZA', '#ff5a36', '#ffd9c8', 11, 2, 'middle')}${o.parpadeo ? parpadeo(6, 0.55) : ''}</g>`
  return s
}

/** Grúa, cartel digital y metro elevado. */
const estructuras = () => {
  let s =
    '<g stroke="#1b1c26" fill="none" stroke-width="1.4">' +
    '<path d="M300 330V118M296 330V118M250 118H380"/>' +
    '<path d="M296 130 L300 124 M296 150 L300 144 M296 170 L300 164 M296 190 L300 184 M296 210 L300 204 M296 230 L300 224 M296 250 L300 244" stroke-width=".6"/>' +
    '<path d="M298 104 L250 118 M298 104 L380 118" stroke-width=".7"/><path d="M298 104V118"/>' +
    '<rect x="252" y="118" width="12" height="7" fill="#101119" stroke="none"/>' +
    `<line x1="352" y1="118" x2="352" y2="168" stroke-width=".5">${anim('y2', '168;190;168', 20)}</line>` +
    `<circle cx="298" cy="104" r="1.8" fill="#ff2b2b" stroke="none">${anim('opacity', '1;.1;1', 2)}</circle>` +
    `<circle cx="380" cy="118" r="1.4" fill="#ff2b2b" stroke="none">${anim('opacity', '1;.1;1', 2, ' begin="1s"')}</circle>` +
    '</g>'

  // Cartel digital: rota tres avisos cada 15 segundos.
  const fondo = '#0d1a33;#0d1a33;#2a0d1a;#2a0d1a;#0f2418;#0f2418;#0d1a33'
  const aviso = (texto: string, color: string, valores: string, tiempos: string, tam: number) =>
    `<text x="418" y="194" font-size="${tam}" letter-spacing="1.5" text-anchor="middle" fill="${color}" opacity="${valores.startsWith('1') ? 1 : 0}">${texto}${anim('opacity', valores, 15, ` keyTimes="${tiempos}"`)}</text>`
  s +=
    marcoNeon(364, 170, 108, 38, '#ff7cc4', 1) +
    `<rect x="368" y="174" width="100" height="30" fill="#0d1a33">${anim('fill', fondo, 15, ' keyTimes="0;.3;.33;.63;.66;.97;1"')}</rect>` +
    aviso('NOCHE 24/7', '#e9eef8', '1;1;0;0;1', '0;.3;.33;.97;1', 13) +
    aviso('OFERTAS', '#ffd6e2', '0;0;1;1;0;0', '0;.3;.33;.63;.66;1', 12) +
    aviso('ABIERTO 22 H', '#d2f5dc', '0;0;1;1;0', '0;.63;.66;.97;1', 11) +
    '<path d="M380 208V232M456 208V232" stroke="#15161e" stroke-width="2"/>'

  s +=
    '<rect x="0" y="283" width="680" height="5" fill="#0c0c12"/><rect x="0" y="288" width="680" height=".8" fill="#2ee6ff" opacity=".35"/>' +
    '<g fill="#0a0a10"><rect x="120" y="288" width="6" height="42"/><rect x="230" y="288" width="6" height="42"/><rect x="340" y="288" width="6" height="42"/><rect x="450" y="288" width="6" height="42"/></g>'
  let tren = ''
  for (let c = 0; c < 5; c++) {
    const cx = c * 48
    tren += `<rect x="${cx}" y="271" width="45" height="12" rx="2" fill="#0e0f15" stroke="#22242e" stroke-width=".5"/>`
    for (let k = 0; k < 5; k++) tren += `<rect x="${cx + 4 + k * 8}" y="274" width="6" height="4" fill="#e9f0ff" opacity=".55"/>`
    tren += `<rect x="${cx}" y="281" width="45" height=".8" fill="#2ee6ff" opacity=".8"/>`
  }
  tren += '<rect x="238" y="276" width="3" height="2" fill="#fff"/><polygon points="241,275 300,268 300,288 241,280" fill="url(#faroD)"/>'
  s += `<g transform="translate(200,0)">${tren}${mover('-300,0;900,0;900,0', 22, ' keyTimes="0;.5;1"')}</g>`
  return s
}

/** Los dos edificios del frente con sus letreros. */
const frente = (r: () => number, o: Opciones) => {
  const al = <T,>(lista: T[]) => lista[Math.floor(r() * lista.length)] as T
  const titila = (dur: number, en: number) => (o.parpadeo ? parpadeo(dur, en) : '')
  let s =
    '<path d="M0 118H95V330H0Z" fill="#040406"/><rect x="0" y="112" width="95" height="6" fill="#0a0a0f"/>' +
    '<path d="M560 92H680V330H560Z" fill="#040406"/>' +
    '<g fill="#0a0a10"><rect x="636" y="66" width="22" height="20" rx="2"/><rect x="638" y="86" width="2" height="6"/><rect x="654" y="86" width="2" height="6"/></g>' +
    '<rect x="596" y="72" width="22" height="20" fill="#08080c"/>' +
    '<line x1="607" y1="72" x2="607" y2="44" stroke="#15161e" stroke-width="2"/>' +
    `<circle cx="607" cy="44" r="2.4" fill="#ff2b2b">${anim('opacity', '1;.05;1', 2.4)}</circle>`

  for (let i = 0; i < 6; i++) {
    const y = 140 + i * 26
    s += `<rect x="6" y="${y}" width="40" height="1.5" fill="#1a1b24"/><path d="M6 ${y - 8}H46M6 ${y - 8}V${y}M16 ${y - 8}V${y}M26 ${y - 8}V${y}M36 ${y - 8}V${y}M46 ${y - 8}V${y}" stroke="#14151d" stroke-width=".5"/>`
    if (i < 5) s += `<line x1="${i % 2 ? 12 : 40}" y1="${y}" x2="${i % 2 ? 40 : 12}" y2="${y + 26}" stroke="#1a1b24"/>`
    s += `<rect x="${10 + (i % 2) * 18}" y="${y - 6}" width="6" height="5" fill="${al(LUZ)}" opacity=".3"/>`
  }
  for (const [ax, ay] of [[60, 250], [66, 214], [570, 150], [648, 188], [574, 240]] as const)
    s += `<rect x="${ax}" y="${ay}" width="12" height="8" fill="#101119" stroke="#1d1e28" stroke-width=".5"/><circle cx="${ax + 6}" cy="${ay + 4}" r="2.5" fill="none" stroke="#1d1e28" stroke-width=".6"/>`
  for (let wy = 126; wy < 290; wy += 8)
    if (r() < 0.22) s += `<rect x="${n(52 + r() * 24)}" y="${wy}" width="${n(8 + r() * 18)}" height="2.5" fill="${al(LUZ)}" opacity=".25"/>`
  for (let wy = 100; wy < 240; wy += 8)
    if (r() < 0.25) s += `<rect x="${n(566 + r() * 40)}" y="${wy}" width="${n(8 + r() * 20)}" height="2.5" fill="${al(LUZ)}" opacity=".25"/>`

  s += `<g>${textoNeon(12, 108, 'HOTEL', '#ffb347', '#fff0d6', 14, 5)}${titila(7, 0.3)}</g>`
  s += `<g>${marcoNeon(70, 126, 20, 62, '#ff3fa4', 3)}${['B', 'A', 'R'].map((c, i) => textoNeon(80, 145 + i * 18, c, '#ff3fa4', '#ffd6ec', 13, 0, 'middle')).join('')}${titila(5, 0.7)}</g>`
  const cruz = 'M76 196h6v5h5v6h-5v5h-6v-5h-5v-6h5Z'
  s += `<g><path d="${cruz}" fill="none" stroke="#3dff9e" stroke-width="6" stroke-opacity=".15"/><path d="${cruz}" fill="#3dff9e" opacity=".9"/>${o.parpadeo ? anim('opacity', '1;1;.4;1', 3, ' keyTimes="0;.7;.75;1"') : ''}</g>`
  s += '<rect x="4" y="300" width="88" height="30" fill="#3dff9e" opacity=".07"/><rect x="4" y="300" width="88" height="30" fill="none" stroke="#16301f" stroke-width=".8"/>'
  for (let i = 0; i < 4; i++) s += `<rect x="${10 + i * 20}" y="308" width="12" height="18" fill="#0a1a10" opacity=".9"/>`
  s += textoNeon(48, 296, 'FARMACIA', '#3dff9e', '#d6ffe8', 9, 2, 'middle')

  s += marcoNeon(636, 108, 26, 104, '#2ee6ff') + ['C', 'I', 'N', 'E'].map((c, i) => textoNeon(649, 130 + i * 23, c, '#2ee6ff', '#dcfbff', 15, 0, 'middle')).join('')
  // Bombillas de marquesina: se encienden en tres turnos para que parezcan correr.
  // Una de cada dos titila y las otras quedan prendidas: a esa distancia se sigue leyendo como
  // marquesina, con la mitad de animaciones.
  for (let i = 0; i < 14; i++)
    for (const [j, bx] of [[0, 633], [1, 665]] as const)
      s += `<circle cx="${bx}" cy="${n(111 + i * 7.3)}" r="1.2" fill="#ffd38a"${(i + j) % 2 ? ' opacity=".75"/>' : `>${anim('opacity', '1;.15;.15;1', 1.2, ` keyTimes="0;.33;.95;1" begin="${n(((i + j * 7) % 3) * 0.4)}s"`)}</circle>`}`
  s += marcoNeon(572, 248, 52, 22, '#b84dff', 11) + textoNeon(598, 263, 'BAR · 2X1', '#b84dff', '#efdcff', 9, 1, 'middle')

  s += '<rect x="572" y="292" width="92" height="38" fill="#120f0a"/><rect x="572" y="292" width="92" height="38" fill="#ffb347" opacity=".14"/>'
  for (let i = 0; i < 6; i++) s += `<rect x="${574 + i * 15}" y="286" width="15" height="6" fill="${i % 2 ? '#3a1a10' : '#1a0d08'}"/>`
  s += textoNeon(618, 282, 'CAFÉ · 24 H', '#ffb347', '#fff0d6', 10, 3, 'middle')
  s += `<g>${marcoNeon(580, 300, 30, 12, '#ff3030', 6)}${textoNeon(595, 309, 'OPEN', '#ff3030', '#ffdada', 8, 1, 'middle')}${o.parpadeo ? anim('opacity', '1;1;.25;1;1', 2.5, ` keyTimes="${t4(0, 0.6, 0.66, 0.74, 1)}"`) : ''}</g>`
  s += '<rect x="620" y="302" width="38" height="22" fill="#0c0805" stroke="#2a1a10" stroke-width=".5"/><circle cx="632" cy="316" r="3" fill="#2a1a10"/><circle cx="646" cy="316" r="3" fill="#2a1a10"/>'
  return s
}

/**
 * Edificios del margen, a los lados del frente. Usan su propio generador para no
 * mover nada del dibujo central, que sale del generador principal.
 */
const bordes = (o: Opciones) => {
  const r = crearRng(7)
  let s = ''
  for (const [desde, hasta] of [[-B, 0], [680, 680 + B]] as const) {
    for (let x = desde; x < hasta;) {
      const w = Math.min(50 + r() * 50, hasta - x), top = 70 + r() * 90
      s += `<rect x="${n(x)}" y="${n(top)}" width="${n(w)}" height="${n(330 - top)}" fill="#050508" stroke="#0e0e16" stroke-width=".6"/>`
      let filas = ''
      for (let y = top + 12; y < 322; y += 9) if (r() < 0.35) filas += `M${n(x + 5)} ${n(y)}H${n(x + w - 5)}`
      s += `<path d="${filas}" stroke="${LUZ[Math.floor(r() * 5)]}" stroke-width="2.5" stroke-dasharray="3 6" opacity=".18"/>`
      x += w
    }
  }
  s += `<g>${marcoNeon(-150, 236, 96, 26, '#2ee6ff', 4)}${textoNeon(-102, 254, 'HOSTAL', '#2ee6ff', '#dcfbff', 11, 3, 'middle')}${o.parpadeo ? parpadeo(6, 0.5) : ''}</g>` +
    textoNeon(782, 220, 'DISCO', '#ff3fa4', '#ffd6ec', 15, 4, 'middle')
  return s
}

/** Gotas que caen de cables y letreros, con salida escalonada. */
const goteo = (r: () => number, x: number, y: number, color: string, piso = 332) => {
  const d = n(0.9 + r() * 1.5), b = n(r() * 3)
  return (
    `<ellipse cx="${n(x)}" cy="${n(y)}" rx=".9" ry="1.4" fill="${color}" opacity="0">` +
    mover(`0,0;0,0;0,${n(piso - y)}`, d, ` keyTimes="0;.5;1" begin="${b}s"`) +
    anim('opacity', '0;.85;.85;0', d, ` keyTimes="0;.3;.95;1" begin="${b}s"`) +
    '</ellipse>'
  )
}

/** Calle mojada: reflejos, charcos, faroles, parada, semáforo y vapor. */
const calle = (r: () => number) => {
  const al = <T,>(lista: T[]) => lista[Math.floor(r() * lista.length)] as T
  let s =
    '<path d="M95 175 Q330 215 560 168M95 190 Q330 232 560 184" fill="none" stroke="#0e0e14"/>'
  // Se dibuja una de cada dos gotas. Las demás se sortean igual, sin dibujarse, para que el
  // generador avance lo mismo y no cambie de lugar nada de lo que se arma después.
  for (let i = 0; i < 10; i++) {
    const t = r(), y = 175 + Math.sin(t * Math.PI) * 38 + (r() < 0.5 ? 15 : 0)
    const gota = goteo(r, 95 + t * 465, y, '#aab3c8', 330)
    if (i % 2 === 0) s += gota
  }
  const desdeLetreros = [[72, 188, '#ff9fd3'], [88, 188, '#ff9fd3'], [640, 212, '#9ff8ff'], [658, 212, '#9ff8ff'], [590, 270, '#d59bff'], [420, 208, '#ff9fd3']] as const
  desdeLetreros.forEach(([x, y, c], i) => {
    const gota = goteo(r, x, y, c)
    if (i % 2 === 0) s += gota
  })

  // Acera (330–348), cordón (348–353) y calzada (353–440): tonos y bordes distintos para leerlos de un vistazo.
  const [x0, x1] = [-B, 680 + B]
  s +=
    `<rect x="${x0}" y="330" width="${ANCHO}" height="18" fill="#15151d"/>` +
    `<path d="M${x0} 339H${x1}${Array.from({ length: 47 }, (_, i) => `M${(i - 9) * 24} 330V348`).join('')}" stroke="#0a0a10" stroke-width=".6"/>` +
    '<rect x="4" y="330" width="88" height="18" fill="#3dff9e" opacity=".07"/><rect x="572" y="330" width="92" height="18" fill="#ffb347" opacity=".09"/>' +
    '<ellipse cx="224" cy="341" rx="26" ry="5" fill="#ffe0b0" opacity=".1"/><ellipse cx="456" cy="341" rx="26" ry="5" fill="#ffe0b0" opacity=".1"/>' +
    `<rect x="${x0}" y="348" width="${ANCHO}" height="1" fill="#55586a" opacity=".7"/><rect x="${x0}" y="349" width="${ANCHO}" height="4" fill="#050507"/>` +
    `<rect x="${x0}" y="353" width="${ANCHO}" height="87" fill="url(#calle)"/>`
  // Silueta invertida del frente: el reflejo barato del asfalto mojado.
  s += '<g opacity=".18"><path d="M0 353H95V440H0Z" fill="#0a0a12"/><path d="M560 353H680V440H560Z" fill="#0a0a12"/></g>'
  for (let i = 0; i < 22; i++) s += `<rect x="${n(r() * 680)}" y="${n(356 + r() * 82)}" width="${n(40 + r() * 160)}" height="1" fill="#000" opacity=".7"/>`
  // Demarcación: borde blanco, doble línea amarilla al centro y paso de cebra junto al semáforo.
  s +=
    `<path d="M${x0} 357H${x1}M${x0} 435H${x1}" stroke="#d8dbe6" stroke-width=".8" opacity=".3"/>` +
    `<path d="M${x0} 394.5H${x1}M${x0} 397.5H${x1}" stroke="#e0a830" stroke-width="1" opacity=".5"/>` +
    `<g fill="#d8dbe6" opacity=".22">${Array.from({ length: 8 }, (_, i) => `<rect x="512" y="${361 + i * 9.4}" width="56" height="4.5"/>`).join('')}</g>`
  const reflejos: [string, number, number][] = [
    ['#ffb347', 50, 3], ['#ff3fa4', 80, 5], ['#3dff9e', 48, 4], ['#2ee6ff', 649, 6], ['#b84dff', 598, 4],
    ['#ffb347', 618, 5], ['#ff3030', 595, 3], ['#fff1dc', 224, 3], ['#fff1dc', 456, 3], ['#2ee6ff', 168, 4], ['#ff7cc4', 418, 4],
  ]
  for (const [c, cx, k] of reflejos) {
    for (let i = 0; i < k; i++) {
      const w = 6 + r() * 16
      s += `<rect x="${n(cx - w / 2 + (r() * 10 - 5))}" y="${n(358 + i * (75 / k) + r() * 5)}" width="${n(w)}" height="${n(1.3 + r() * 1.2)}" rx=".6" fill="${c}" opacity="${n(0.25 + r() * 0.3)}">` +
        mover(`0,0;${n(r() * 6 - 3)},0;0,0`, 1.2 + r() * 2) + '</rect>'
    }
    s += `<rect x="${cx - 1}" y="354" width="2" height="60" fill="${c}" opacity=".12"/>`
  }
  for (const [cx, cy, rx, ry] of [[90, 374, 40, 5], [260, 412, 55, 6], [440, 372, 44, 5], [380, 428, 50, 4]] as const)
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#0a0a12" opacity=".7" stroke="#2a2c3a" stroke-width=".4"/>` +
      // El brillo del charco respira a lo ancho: escala en x desde su centro, sin recalcular la elipse.
      `<g transform="translate(${cx} ${cy})"><ellipse rx="${n(rx * 0.6)}" ry="${n(ry * 0.35)}" fill="${al(NEON)}" opacity=".12">${escalar('.83 1;1.17 1;.83 1', 3)}</ellipse></g>`

  s +=
    '<path d="M210 344V248H224M470 344V252H456" fill="none" stroke="#101118" stroke-width="2.5"/>' +
    '<rect x="219" y="249" width="10" height="2" fill="#fff1dc"/><polygon points="219,251 229,251 254,344 194,344" fill="url(#cono)"/>' +
    `<rect x="451" y="253" width="10" height="2" fill="#fff1dc">${anim('opacity', '1;1;.3;1;.5;1', 9, ' keyTimes="0;.8;.82;.84;.86;1"')}</rect>` +
    '<polygon points="451,255 461,255 486,344 426,344" fill="url(#cono)"/>'

  // La parada baja a la acera.
  s +=
    '<g transform="translate(0,14)"><rect x="120" y="296" width="62" height="3" fill="#14151d"/><path d="M122.7 299V332M178.7 299V332" stroke="#14151d" stroke-width="1.5"/>' +
    '<rect x="124" y="300" width="54" height="30" fill="#9fd8ff" opacity=".04"/>' +
    `<rect x="160" y="302" width="16" height="26" fill="#2ee6ff" opacity=".55">${anim('fill', '#2ee6ff;#ff3fa4;#2ee6ff', 8)}</rect>` +
    '<rect x="156" y="302" width="24" height="26" fill="#2ee6ff" opacity=".08"/><rect x="128" y="318" width="24" height="2" fill="#14151d"/>' +
    '<rect x="136" y="310" width="5" height="20" rx="2" fill="#020203"/><circle cx="138.5" cy="307" r="2.6" fill="#020203"/><rect x="140" y="312" width="3" height="4" fill="#bcd3ff" opacity=".8"/></g>'

  const semaforo = (cy: number, color: string, valores: string, tiempos: string, inicial: number) =>
    `<circle cx="540" cy="${cy}" r="2.6" fill="${color}" opacity="${inicial}">${anim('opacity', valores, 10, ` keyTimes="${tiempos}" calcMode="discrete"`)}</circle>`
  s +=
    '<line x1="540" y1="345" x2="540" y2="282" stroke="#101118" stroke-width="2.5"/><rect x="534" y="270" width="12" height="30" rx="2" fill="#06060a" stroke="#1b1c26" stroke-width=".6"/>' +
    semaforo(276, '#ff2b2b', '1;0;0;1', '0;.45;.95;1', 1) +
    semaforo(285, '#ffb21f', '0;0;1;0', '0;.45;.6;1', 0) +
    semaforo(294, '#1fe07a', '0;1;0;0', '0;.6;.95;1', 0) +
    `<rect x="528" y="355" width="24" height="40" fill="#ff2b2b" opacity=".1">${anim('fill', '#ff2b2b;#1fe07a;#ffb21f;#ff2b2b', 10, ' keyTimes="0;.45;.6;.95" calcMode="discrete"')}</rect>`

  s += '<ellipse cx="330" cy="384" rx="16" ry="3" fill="#08080c" stroke="#1b1c26" stroke-width=".6"/>'
  for (let i = 0; i < 7; i++) {
    const b = ` begin="${n(i * 0.65)}s"`
    // El vapor sube (el grupo) y se abre (la elipse, centrada en el origen del grupo).
    s += `<g transform="translate(330 382)">${mover('330,382;330,315', 4.5, b)}` +
      `<ellipse rx="26" ry="12" fill="#9a8cb8" opacity="0" transform="scale(.23 .33)">` +
      escalar('.23 .33;1 1', 4.5, b) + anim('opacity', '0;.16;0', 4.5, b) + '</ellipse></g>'
  }
  return s
}

/**
 * Dónde está un vehículo en el instante cero de su recorrido animado.
 * Es su posición fija: si la app muestra la escena sin animar, quedan repartidos como en movimiento.
 */
const enCamino = (desde: number, hasta: number, dur: number, inicio: number) =>
  desde + (hasta - desde) * ((((-inicio % dur) + dur) % dur) / dur)

type TipoAuto = 'sedan' | 'taxi' | 'patrulla' | 'suv' | 'deportivo' | 'pickup' | 'compacto'
type Vehiculo = { y: number; dir: 1 | -1; dur: number; inicio: number; color: string; tipo: TipoAuto }

const vehiculo = ({ y, dir, dur, inicio, color, tipo }: Vehiculo) => {
  const L = tipo === 'compacto' ? 28 : tipo === 'suv' ? 36 : tipo === 'deportivo' ? 38 : tipo === 'pickup' ? 40 : 34
  const H = tipo === 'suv' ? 12 : tipo === 'deportivo' ? 6 : 9
  const t = y - H
  const p = (f: number) => n(L * f)
  const vidrio = (d: string) => `<path d="${d}" fill="#1a1e2a" opacity=".85"/>`
  // Se dibuja mirando a la derecha; el carril contrario lo espeja.
  let s = ''
  if (tipo === 'deportivo') {
    s +=
      `<ellipse cx="${p(0.5)}" cy="${y + 3}" rx="${p(0.6)}" ry="3" fill="#2ee6ff" opacity=".15"/><rect x="3" y="${y + 0.5}" width="${L - 6}" height="1.2" fill="#2ee6ff" opacity=".8"/>` +
      `<path d="M0 ${y - 1}V${t}L${p(0.3)} ${t - 1}L${p(0.45)} ${t - 6}H${p(0.68)}L${p(0.92)} ${t}L${L} ${t + 2}V${y - 1}Z" fill="${color}"/>` +
      vidrio(`M${p(0.47)} ${t - 5}H${p(0.66)}L${p(0.84)} ${t - 0.5}H${p(0.4)}Z`) +
      `<path d="M0 ${t}L-2 ${t - 2}H3Z" fill="${color}"/>`
  } else {
    s += `<rect x="0" y="${t}" width="${L}" height="${H}" rx="${tipo === 'suv' ? 2 : 3}" fill="${color}"/>`
    if (tipo === 'suv')
      s += `<path d="M${p(0.06)} ${t}L${p(0.1)} ${t - 6}H${p(0.78)}L${p(0.9)} ${t}Z" fill="${color}"/>` +
        vidrio(`M${p(0.12)} ${t - 5}H${p(0.76)}L${p(0.84)} ${t - 0.5}H${p(0.12)}Z`) +
        `<path d="M${p(0.12)} ${t - 6.5}H${p(0.72)}" stroke="#3a3c48"/>`
    else if (tipo === 'pickup')
      s += `<path d="M${p(0.5)} ${t}L${p(0.55)} ${t - 6}H${p(0.76)}L${p(0.88)} ${t}Z" fill="${color}"/>` +
        vidrio(`M${p(0.57)} ${t - 5}H${p(0.74)}L${p(0.83)} ${t}H${p(0.55)}Z`) +
        `<rect x="0" y="${t - 2}" width="${p(0.48)}" height="2" fill="${color}"/>`
    else if (tipo === 'compacto')
      s += `<path d="M${p(0.1)} ${t}L${p(0.16)} ${t - 6}H${p(0.72)}L${p(0.88)} ${t}Z" fill="${color}"/>` +
        vidrio(`M${p(0.19)} ${t - 5}H${p(0.46)}V${t}H${p(0.15)}Z`) + vidrio(`M${p(0.5)} ${t - 5}H${p(0.7)}L${p(0.83)} ${t}H${p(0.5)}Z`)
    else
      s += `<path d="M${p(0.22)} ${t}L${p(0.32)} ${t - 6}H${p(0.7)}L${p(0.8)} ${t}Z" fill="${color}"/>` +
        vidrio(`M${p(0.35)} ${t - 5}H${p(0.67)}L${p(0.75)} ${t}H${p(0.28)}Z`)
  }
  if (tipo === 'taxi')
    s += `<rect x="${p(0.42) - 2}" y="${t - 11}" width="12" height="7" fill="#ffd23a" opacity=".15"/><rect x="${p(0.42)}" y="${t - 9}" width="8" height="3" fill="#ffd23a"/>`
  if (tipo === 'patrulla') {
    // Las luces se pasan de azul a rojo de forma pareja: un parpadeo rápido haría congelar la escena.
    const alterna = (a: string, b: string) => anim('fill', `${a};${b};${a}`, 1.4)
    s +=
      `<rect x="${p(0.38)}" y="${t - 8}" width="5" height="2.5" fill="#2b6bff">${anim('opacity', '1;.2;1', 1.4)}</rect>` +
      `<rect x="${p(0.38) + 5}" y="${t - 8}" width="5" height="2.5" fill="#ff2020">${anim('opacity', '.2;1;.2', 1.4)}</rect>` +
      `<ellipse cx="${p(0.45)}" cy="${t - 7}" rx="30" ry="12" fill="#2b6bff" opacity=".12">${alterna('#2b6bff', '#ff2020')}</ellipse>` +
      `<rect x="0" y="${y + 4}" width="${L}" height="18" fill="#2b6bff" opacity=".12">${alterna('#2b6bff', '#ff2020')}</rect>`
  }
  const r = tipo === 'suv' ? 3.6 : tipo === 'deportivo' ? 2.8 : 3
  const luz = tipo === 'deportivo' ? t + 1 : t + 2
  s +=
    `<circle cx="${p(0.18)}" cy="${y}" r="${r}" fill="#000"/><circle cx="${p(0.82)}" cy="${y}" r="${r}" fill="#000"/>` +
    `<rect x="${L - 2}" y="${luz}" width="2" height="2" fill="#fff"/>` +
    `<polygon points="${L},${luz - 1} ${L + 90},${luz - 10} ${L + 90},${y + 6} ${L},${luz + 3}" fill="url(#faroD)"/>` +
    `<rect x="0" y="${luz}" width="2" height="${tipo === 'deportivo' ? 1.5 : 3}" fill="#ff2020"/>` +
    `<rect x="${L - 6}" y="${y + 4}" width="4" height="22" fill="#fff" opacity=".14"/><rect x="0" y="${y + 4}" width="3" height="20" fill="#ff2020" opacity=".22"/>`
  // Entran y salen fuera del margen; la duración crece con el tramo para no cambiar la velocidad.
  const [a, b] = dir > 0 ? [-140 - B, 820 + B] : [820 + B, -140 - B]
  const t0 = dur * (960 + 2 * B) / 960
  const base = enCamino(a, b, t0, inicio)
  const cuerpo = dir > 0 ? s : `<g transform="translate(${L},0) scale(-1,1)">${s}</g>`
  return `<g transform="translate(${n(base)},0)">${cuerpo}${mover(`${a},0;${b},0`, t0, ` begin="${inicio}s"`)}</g>`
}

/**
 * Moto deportiva: carenado, cola alta y piloto agachado sobre el tanque.
 * Se dibuja mirando a la derecha y se espeja para el carril contrario.
 */
const moto = (y: number, dir: 1 | -1, dur: number, inicio: number, casco: string) => {
  const w = y - 3.5
  const m =
    `<g stroke="#2a2c38" stroke-width=".9"><circle cx="2" cy="${w}" r="3.5" fill="#000"/><circle cx="21" cy="${w}" r="3.5" fill="#000"/></g>` +
    `<circle cx="2" cy="${w}" r="1.2" fill="#3a3c48"/><circle cx="21" cy="${w}" r="1.2" fill="#3a3c48"/>` +
    `<path d="M2 ${w}L9 ${y - 6}M21 ${w}L18 ${y - 11}" stroke="#2a2c38" stroke-width="1.4"/>` +
    `<path d="M-2 ${y - 12}L6 ${y - 10}L10 ${y - 6}L16 ${y - 6}L21 ${y - 9}L20 ${y - 12}L16 ${y - 15}L11 ${y - 11}L5 ${y - 12.5}Z" fill="#121318"/>` +
    `<path d="M16 ${y - 15}L20 ${y - 12}L18 ${y - 17}Z" fill="#9fb6d0" opacity=".35"/>` +
    `<path d="M-1 ${y - 11.5}L6 ${y - 9.5}L10 ${y - 7.5}H16L20 ${y - 9.5}" fill="none" stroke="${casco}" stroke-width=".8"/>` +
    `<path d="M8 ${y - 12}L14 ${y - 16}L18 ${y - 13}M8 ${y - 12}L12 ${y - 8}L9 ${y - 6}" fill="none" stroke="#08080c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="15.5" cy="${y - 18}" r="2.7" fill="${casco}"/><path d="M16 ${y - 19}h2.4v1.4h-2.4Z" fill="#dff6ff" opacity=".85"/>` +
    `<rect x="20" y="${y - 11.5}" width="1.8" height="1.4" fill="#fff"/><polygon points="21.8,${y - 11.5} 85,${y - 19} 85,${y - 2} 21.8,${y - 10}" fill="url(#faroD)"/>` +
    `<rect x="-2.5" y="${y - 12.5}" width="1.6" height="1.2" fill="#ff2020"/>` +
    `<rect x="17" y="${y + 3}" width="3" height="16" fill="#fff" opacity=".12"/><rect x="-2" y="${y + 3}" width="2" height="14" fill="${casco}" opacity=".18"/>`
  const [a, b] = dir > 0 ? [-60 - B, 760 + B] : [760 + B, -60 - B]
  const t0 = dur * (820 + 2 * B) / 820
  const base = enCamino(a, b, t0, inicio)
  return `<g transform="translate(${n(base)},0)">${dir > 0 ? m : `<g transform="scale(-1,1)">${m}</g>`}` +
    mover(`${a},0;${b},0`, t0, ` begin="${inicio}s"`) + '</g>'
}

const transito = (o: Opciones) => {
  const autos: Vehiculo[] = [
    { y: 384, dir: 1, dur: 9, inicio: 0, color: '#14151c', tipo: 'sedan' },
    { y: 384, dir: 1, dur: 9, inicio: -4.5, color: '#c9a21a', tipo: 'taxi' },
    { y: 384, dir: 1, dur: 13, inicio: -9, color: '#23262c', tipo: 'pickup' },
    { y: 426, dir: -1, dur: 11, inicio: -2, color: '#1b1d24', tipo: 'suv' },
    { y: 426, dir: -1, dur: 7, inicio: -4, color: '#7a0f1e', tipo: 'deportivo' },
    { y: 426, dir: -1, dur: 14, inicio: -9, color: '#2a3140', tipo: 'compacto' },
  ]
  if (o.extras) autos.push({ y: 426, dir: -1, dur: 30, inicio: -6, color: '#0d0f16', tipo: 'patrulla' })
  const motos =
    moto(384, 1, 6, -2, '#ff3fa4') + moto(426, -1, 7, -5, '#2ee6ff') +
    (o.extras ? moto(384, 1, 8, -6.5, '#ffb347') : '')
  return autos.map(vehiculo).join('') + motos
}

const peatones = (o: Opciones) => {
  if (!o.extras) return ''
  const lista: [number, number, number, number, string][] = [
    // Los peatones van por la acera, nunca por la calzada.
    // Cruzan la acera de punta a punta, margen incluido, sin aparecer a la vista.
    [-20 - B, 700 + B, 344, 70, '#ff3fa4'], [700 + B, -20 - B, 346, 79, '#2ee6ff'], [-20 - B, 700 + B, 342, 91, '#2a2c38'],
  ]
  // La posición fija es la del instante cero: sin animación quedan repartidos.
  return lista.map(([a, b, y, dur, c], i) =>
    `<g transform="translate(${n(enCamino(a, b, dur, -i * 13 - 20))},0)">` +
    `<rect x="-2.5" y="${y - 14}" width="5" height="14" rx="2" fill="#020203"/><circle cx="0" cy="${y - 16}" r="2.5" fill="#020203"/>` +
    `<line x1="0" y1="${y - 16}" x2="0" y2="${y - 24}" stroke="#020203" stroke-width=".8"/>` +
    `<path d="M-10 ${y - 23}Q0 ${y - 34} 10 ${y - 23}Z" fill="#07070a" stroke="${c}" stroke-width=".8" stroke-opacity=".8"/>` +
    `<rect x="-7" y="${y + 2}" width="14" height="1" fill="${c}" opacity=".25"/>` +
    mover(`${a},0;${b},0`, dur, ` begin="${-i * 13 - 20}s"`) + '</g>',
  ).join('')
}

/** Tres capas de lluvia que se repiten sin costura, más la que toma color del neón. */
const lluvia = (r: () => number, o: Opciones) => {
  let s = ''
  const capas: [number, number, number, number, number][] = [[90, 0.16, 0.9, 14, 1], [70, 0.26, 0.65, 20, 1.1], [42, 0.42, 0.45, 28, 1.5]]
  for (const [cant, op, dur, largo, ancho] of capas) {
    let d = ''
    for (let i = 0; i < Math.round(cant * o.lluvia); i++) {
      const x0 = r() * 820, y0 = r() * 440
      for (const off of [0, -440]) d += `M${n(x0)} ${n(y0 + off)}l${n(-largo * 0.3)} ${largo}`
    }
    // Con la placa de video las gotas se sortean igual, para no mover el resto del dibujo, pero no se dibujan.
    if (!o.gpu) s += `<path d="${d}" stroke="#9aa4bd" stroke-width="${ancho}" opacity="${op}" stroke-linecap="round">${mover('0,0;-132,440', dur)}</path>`
  }
  for (const [cx, cy, c] of [[40, 130, '#ff3fa4'], [600, 200, '#2ee6ff'], [620, 300, '#ffb347']] as const) {
    let d = ''
    for (let i = 0; i < 14; i++) d += `M${n(cx - 25 + r() * 50)} ${n(cy - 40 + r() * 80)}l-4 14`
    s += `<path d="${d}" stroke="${c}" stroke-linecap="round" opacity="0">${mover('0,-30;-12,30', 0.5)}${anim('opacity', '0;.55;0', 0.5)}</path>`
  }
  for (let i = 0; i < 24; i++) {
    const d = n(1 + r() * 1.2), b = ` begin="${n(r() * 2)}s"`
    // La onda se dibuja a su tamaño final y se agranda desde chica: el mismo anillo, sin recalcular la forma.
    const cx = n(r() * 680), cy = n(338 + r() * 95)
    // Una de cada dos salpicaduras: el color se sortea igual para no mover el resto del dibujo.
    const color = r() < 0.35 ? NEON[Math.floor(r() * 5)] : '#8d96ad'
    if (i % 2) continue
    s += `<g transform="translate(${cx} ${cy})"><ellipse rx="12" ry="3.5" fill="none" stroke="${color}" stroke-width=".7" opacity=".6" transform="scale(.08 .11)">` +
      escalar('.08 .11;1 1', d, b) + anim('opacity', '.6;0', d, b) + '</ellipse></g>'
  }
  return s
}

/**
 * Gotas del vidrio en el margen, para que en pantallas anchas el vidrio siga parejo. Con su
 * propio generador, así el vidrio central queda igual.
 */
const vidrioMargen = (o: Opciones) => {
  const r = crearRng(11)
  let s = ''
  for (const desde of [-B, 680]) {
    for (let i = 0; i < 12; i++) {
      const cx = desde + r() * B, cy = r() * 440, rr = 0.6 + r() * 2.4
      s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rr)}" fill="#dfe4f0" fill-opacity=".04" stroke="#dfe4f0" stroke-opacity=".15" stroke-width=".5"/>` +
        `<circle cx="${n(cx - rr * 0.35)}" cy="${n(cy - rr * 0.35)}" r="${n(rr * 0.25)}" fill="#fff" opacity=".25"/>`
    }
    if (!o.extras) continue
    for (let i = 0; i < 3; i++) {
      // Se sortean las tres para que el generador avance igual; una que resbala por lado alcanza,
      // porque el margen se ve poco y solo en pantallas anchas.
      const cx = desde + 10 + r() * (B - 20), y0 = -20 - r() * 60, rr = 1.8 + r() * 1.6
      const dx = n(r() * 10 - 5), dur = 5 + r() * 6, begin = n(-r() * 8)
      if (i > 0) continue
      s += `<g>` +
        `<line x1="${n(cx)}" y1="${n(y0 - 40)}" x2="${n(cx)}" y2="${n(y0)}" stroke="#dfe4f0" stroke-opacity=".08" stroke-width="${n(rr * 0.9)}" stroke-linecap="round"/>` +
        `<ellipse cx="${n(cx)}" cy="${n(y0)}" rx="${n(rr)}" ry="${n(rr * 1.25)}" fill="#dfe4f0" fill-opacity=".06" stroke="#dfe4f0" stroke-opacity=".3" stroke-width=".6"/>` +
        mover(`0,0;${dx},520`, dur, ` begin="${begin}s"`) + '</g>'
    }
  }
  return s
}

/** Gotas pegadas al vidrio y algunas que bajan dejando rastro. */
const vidrio = (r: () => number, o: Opciones) => {
  let s = ''
  for (let i = 0; i < 40; i++) {
    const cx = r() * 680, cy = r() * 440, rr = 0.6 + r() * 2.4
    s += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rr)}" fill="#dfe4f0" fill-opacity=".04" stroke="#dfe4f0" stroke-opacity=".15" stroke-width=".5"/>` +
      `<circle cx="${n(cx - rr * 0.35)}" cy="${n(cy - rr * 0.35)}" r="${n(rr * 0.25)}" fill="#fff" opacity=".25"/>`
  }
  if (!o.extras) return s
  for (let i = 0; i < 9; i++) {
    // Todo se sortea antes de decidir si se dibuja, para que el generador avance siempre igual.
    const cx = 20 + r() * 640, y0 = -20 - r() * 60, rr = 1.8 + r() * 1.6
    const dx = n(r() * 10 - 5), dur = 5 + r() * 6, begin = n(-r() * 8)
    // Bajan cuatro de las nueve: se siguen viendo gotas resbalando, con menos animaciones.
    if (i % 2) continue
    s += `<g>` +
      `<line x1="${n(cx)}" y1="${n(y0 - 40)}" x2="${n(cx)}" y2="${n(y0)}" stroke="#dfe4f0" stroke-opacity=".08" stroke-width="${n(rr * 0.9)}" stroke-linecap="round"/>` +
      `<ellipse cx="${n(cx)}" cy="${n(y0)}" rx="${n(rr)}" ry="${n(rr * 1.25)}" fill="#dfe4f0" fill-opacity=".06" stroke="#dfe4f0" stroke-opacity=".3" stroke-width=".6"/>` +
      `<circle cx="${n(cx - rr * 0.35)}" cy="${n(y0 - rr * 0.4)}" r="${n(rr * 0.3)}" fill="#fff" opacity=".4"/>` +
      mover(`0,0;${dx},520`, dur, ` begin="${begin}s"`) + '</g>'
  }
  return s
}

/**
 * Pasa las animaciones SMIL a CSS dentro de un `<style>`: cada recorrido se escribe una sola vez
 * como `@keyframes` y cada combinación de recorrido, duración y demora, como una clase.
 *
 * El dibujo se sigue armando con `<animate>` porque así se lee junto al elemento que anima;
 * esta pasada solo cambia cómo se entrega. Lo que CSS no cubre igual queda en SMIL: el
 * `patternTransform` de la lluvia del margen y las que no se repiten para siempre.
 */
export const aCss = (svg: string): string => {
  /** Recorrido → nombre del `@keyframes`. Dos recorridos iguales comparten nombre. */
  const marcos = new Map<string, string>()
  const clases = new Map<string, string>()
  const tokens = svg.match(/<[^>]*>|[^<]+/g) ?? []
  const pila: { i: number; anims: string[] }[] = []
  const conAnim: { i: number; anims: string[] }[] = []

  const marco = (prop: string, valores: string[], tiempos: number[], tipo = 'translate') => {
    const px = (v: string) => (Number(v) === 0 ? '0' : `${v}px`)
    const unidad = (v: string) => {
      if (prop === 'transform') {
        const [x = '0', y] = v.split(/[ ,]+/)
        // `scale` sin y escala parejo, como en SMIL; `translate` sin y no se mueve en vertical.
        return tipo === 'scale' ? `scale(${x},${y ?? x})` : `translate(${px(x)},${px(y ?? '0')})`
      }
      return prop === 'opacity' || prop === 'fill' ? v : px(v)
    }
    // Varios puntos en el mismo instante son un salto en SMIL: se llega al primero y desde ahí
    // vale el último. CSS los fundiría en uno, así que el último va una décima de punto después.
    const puntos: [number, string][] = []
    for (let k = 0; k < valores.length; k++) {
      let fin = k
      while (fin + 1 < valores.length && tiempos[fin + 1] === tiempos[k]) fin++
      const p = n(tiempos[k]! * 100)
      puntos.push([p, unidad(valores[k]!)])
      if (fin > k) puntos.push([n(Math.min(p + 0.1, 100)), unidad(valores[fin]!)])
      k = fin
    }
    // Con cada instante ya único, los puntos con el mismo valor van en una sola regla (`0%,59%{...}`).
    const porValor = new Map<string, string[]>()
    for (const [p, u] of puntos) porValor.set(u, [...(porValor.get(u) ?? []), `${p}%`])
    // El tipo de salto va en la animación, no en el recorrido: el mismo recorrido sirve para los dos.
    const cuerpo = [...porValor].map(([u, ps]) => `${ps.join(',')}{${prop}:${u}}`).join('')
    let nombre = marcos.get(cuerpo)
    if (!nombre) marcos.set(cuerpo, (nombre = `k${marcos.size}`))
    return nombre
  }

  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t]!
    if (tok.startsWith('</')) {
      const cerrado = pila.pop()
      if (cerrado?.anims.length) conAnim.push(cerrado)
      continue
    }
    if (!tok.startsWith('<')) continue
    if (/^<animate(Transform)?\b/.test(tok)) {
      const a = Object.fromEntries([...tok.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]])) as Record<string, string>
      const esTraslado = tok.startsWith('<animateTransform') && a.attributeName === 'transform' && (a.type === 'translate' || a.type === 'scale')
      const convertible = a.repeatCount === 'indefinite' && !a.fill && (esTraslado || !tok.startsWith('<animateTransform'))
      const padre = pila[pila.length - 1]
      if (!convertible || !padre || !a.values || !a.dur) continue
      const valores = a.values.split(';')
      const tiempos = a.keyTimes ? a.keyTimes.split(';').map(Number) : valores.map((_, k) => (valores.length > 1 ? k / (valores.length - 1) : 0))
      const discreto = a.calcMode === 'discrete'
      // Discreto en SMIL reparte el ciclo en partes iguales; en CSS, el salto va al principio de cada tramo.
      const tiemposCss = discreto && !a.keyTimes ? valores.map((_, k) => k / valores.length) : tiempos
      const nombre = marco(esTraslado ? 'transform' : a.attributeName!, valores, tiemposCss, a.type)
      padre.anims.push(`${nombre} ${a.dur}${discreto ? ' steps(1,end)' : ' linear'}${a.begin ? ` ${a.begin}` : ''} infinite`)
      tokens[t] = ''
      continue
    }
    if (!tok.endsWith('/>')) pila.push({ i: t, anims: [] })
  }

  // Todo va en clases dentro del `<style>`: es lo que la app garantiza que dibuja; un `style=`
  // suelto en cada elemento ahorraría poco y podría no pasar su limpieza.
  for (const { i, anims } of conAnim) {
    const clave = anims.join(',')
    let nombre = clases.get(clave)
    if (!nombre) clases.set(clave, (nombre = `c${clases.size}`))
    tokens[i] = tokens[i]!.replace(/>$/, ` class="${nombre}">`)
  }

  const estilo =
    '<style>' +
    [...marcos].map(([cuerpo, nombre]) => `@keyframes ${nombre}{${cuerpo}}`).join('') +
    [...clases].map(([anims, nombre]) => `.${nombre}{animation:${anims}}`).join('') +
    '</style>'
  return tokens.join('').replace(/^(<svg[^>]*>)/, `$1${estilo}`)
}

/**
 * Devuelve el SVG completo de la tormenta.
 *
 * @param gpu sin lluvia y con las capas grandes quietas, para dibujar debajo de `lluvia-gpu.ts`
 * @returns el documento `<svg>`, por debajo de {@link LIMITE_SVG}
 */
export const escena = (gpu = false): string => {
  const o = { ...TORMENTA, gpu }
  const r = crearRng(23)
  const cuerpo =
    '<g>' +
    cielo(o) + ciudad(r, o) + estructuras() + frente(r, o) + bordes(o) + calle(r) +
    transito(o) + peatones(o) + lluvia(r, o) +
    // La lluvia del margen rodea la central sin pisarla; con la placa de video, la dibuja el shader.
    (o.gpu ? '' : `<path d="M${-B} -1200H${680 + B}V440H680V0H0V440H${-B}Z" fill="url(#ll)" opacity="${o.lluvia}"/>`) +
    `<rect x="${-B}" y="290" width="${ANCHO}" height="80" fill="url(#niebla)" opacity=".8">${deriva(o, '-20,0;20,0;-20,0', 25)}</rect>` +
    '</g>' + vidrio(r, o) + vidrioMargen(o)
  // `meet` muestra siempre la escena entera; anclada abajo, la calle nunca se corta y lo que sobra es margen.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 440" preserveAspectRatio="${AJUSTE}" ${FUENTE}>` +
    defs(o) + cuerpo + '</svg>'
  return aCss(svg)
}
