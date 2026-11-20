import { expect, test } from 'claude-code/testing'

import { aCss, escena, LIMITE_SVG } from './escena'
import { elegir } from './register'

test('la escena entra en el límite del elemento Svg, con y sin lluvia', () => {
  for (const svg of [escena(), escena(true)]) {
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    // Al dibujar se suma el grupo con el contador de recargas.
    expect(svg.length + 64).toBeLessThan(LIMITE_SVG)
  }
})

test('la escena se ve entera y anclada abajo en cualquier proporción', () => {
  const svg = escena()
  expect(svg.includes('viewBox="0 0 680 440"')).toBe(true)
  expect(svg.includes('preserveAspectRatio="xMidYMax meet"')).toBe(true)
})

test('el SVG no lleva scripts, manejadores, referencias externas ni imágenes', () => {
  for (const s of [escena(), escena(true)]) expect(/<script|\son[a-z]+=|href=|foreignObject|<image/i.test(s)).toBe(false)
})

test('las animaciones van en clases CSS; solo la lluvia del margen sigue en SMIL', () => {
  const svg = escena()
  expect(svg.includes('<style>@keyframes')).toBe(true)
  expect(svg.match(/<animate/g)?.length).toBe(1)
  expect(svg.includes('attributeName="patternTransform"')).toBe(true)
  expect(svg.includes('style="')).toBe(false)
})

test('aCss respeta los saltos de SMIL, comparte recorridos y escala', () => {
  const svg = aCss(
    '<svg><g><animate attributeName="opacity" values="0;1;0" keyTimes="0;.5;.5" dur="2s" repeatCount="indefinite"/></g>' +
      '<rect><animateTransform attributeName="transform" type="translate" values="0,0;10,0" dur="1s" begin="-1s" repeatCount="indefinite"/></rect>' +
      '<rect><animateTransform attributeName="transform" type="translate" values="0,0;10,0" dur="3s" repeatCount="indefinite"/></rect></svg>',
  )
  // El salto en .5 llega a 1 y sigue desde 0, una décima de punto después.
  expect(svg.includes('@keyframes k0{0%,50.1%{opacity:0}50%{opacity:1}}')).toBe(true)
  expect(svg.includes('@keyframes k1{0%{transform:translate(0,0)}100%{transform:translate(10px,0)}}')).toBe(true)
  expect(svg.includes('{animation:k1 1s linear -1s infinite}')).toBe(true)
  expect(svg.includes('{animation:k1 3s linear infinite}')).toBe(true)
  expect(svg.includes('<animate')).toBe(false)
  expect(aCss('<svg><g><animateTransform attributeName="transform" type="scale" values=".1 .2;1 1" dur="2s" repeatCount="indefinite"/></g></svg>'))
    .toContain('@keyframes k0{0%{transform:scale(.1,.2)}100%{transform:scale(1,1)}}')
})

test('nada destella: la luz grande nunca cambia de golpe', () => {
  // La app congela la escena si destella. Una capa que tapa todo cambia de opacidad en tramos de 0,1 s
  // o más, y ninguna llega a una opacidad que aclare la pantalla de golpe.
  const svg = escena()
  const marcos = Object.fromEntries([...svg.matchAll(/@keyframes (k\d+)\{((?:[^{}]*\{[^}]*\})*)\}/g)].map(m => [m[1], m[2]]))
  let revisadas = 0
  for (const m of svg.matchAll(/<(?:rect|g)\b[^>]*width="(\d+)"[^>]*height="(\d+)"[^>]*class="(c\d+)"/g)) {
    if (Number(m[1]) < 600 || Number(m[2]) < 400) continue
    const clase = svg.match(new RegExp(`\\.${m[3]}\\{animation:([^}]*)\\}`))![1]!
    for (const a of clase.split(',')) {
      const [k, dur] = a.trim().split(' ')
      const cuerpo = marcos[k!]!
      if (!cuerpo.includes('opacity')) continue
      revisadas++
      const pcts = [...cuerpo.matchAll(/([\d.]+)%/g)].map(x => Number(x[1])).sort((x, y) => x - y)
      for (let i = 1; i < pcts.length; i++) expect((pcts[i]! - pcts[i - 1]!) / 100 * parseFloat(dur!)).toBeGreaterThan(0.099)
      for (const o of cuerpo.matchAll(/opacity:([\d.]+)/g)) expect(Number(o[1])).toBeLessThan(0.2)
    }
  }
  // El resplandor del cielo es una de esas capas: si la prueba no la encuentra, no está probando nada.
  expect(revisadas).toBeGreaterThan(0)
})

test('ninguna animación recalcula formas: solo mueve, escala, cambia opacidad o color', () => {
  expect(/\{(rx|ry|cx|cy|r|width|height):/.test(escena())).toBe(false)
})

test('debajo del shader la escena va sin lluvia y sin capas grandes en movimiento', () => {
  const gpu = escena(true), normal = escena()
  expect(gpu.includes('stroke="#9aa4bd"')).toBe(false)
  expect(gpu.includes('id="ll"')).toBe(false)
  expect(gpu.includes('<animate')).toBe(false)
  expect(normal.includes('stroke="#9aa4bd"')).toBe(true)
  expect(gpu.length).toBeLessThan(normal.length)
  // Lo que no es lluvia queda igual: mismos letreros, autos, edificios y rayos.
  expect(gpu.includes('NOCHE 24/7')).toBe(true)
  expect(gpu.includes('#f1eeff')).toBe(true)
  // La luz grande del rayo (cielo y nubes) la pone el shader, no el SVG.
  expect(gpu.includes('fill="#7f88b8"')).toBe(false)
  expect(gpu.includes('fill="#a9b4e0"')).toBe(false)
  expect(normal.includes('fill="#7f88b8"')).toBe(true)
})

test('la escena es determinista y tiene rayos', () => {
  expect(escena()).toBe(escena())
  expect(escena().includes('#f1eeff')).toBe(true)
})

test('el argumento del comando prende o apaga', () => {
  expect(elegir('')).toBe('prender')
  expect(elegir('  ')).toBe('prender')
  expect(elegir('apagar')).toBe('apagar')
  expect(elegir('OFF')).toBe('apagar')
  expect(elegir('calma')).toBe(null)
})
