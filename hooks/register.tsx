import type { EngineInterface, Register } from 'claude-code'

import { escena, type Variante } from './escena'

/** Cada variante es un fondo con su propio id, así el render sabe cuál dibujar. */
const FONDOS: Record<Variante, string> = {
  tormenta: 'lluvia-tormenta',
  calma: 'lluvia-calma',
  quieto: 'lluvia-quieto',
}

const DESCRIPCION: Record<Variante, string> = {
  tormenta: 'tormenta con rayos y la ciudad en movimiento',
  calma: 'llovizna, sin rayos y con el neón fijo',
  quieto: 'la escena sin animación',
}

/** Vidrio oscuro: los paneles se esmerilan sobre la escena y el texto se sigue leyendo. */
const VIDRIO = { blur: 14, tint: '#07060c', opacity: 0.55 }

// El app pausa los frames ocultos o en vista dividida y SMIL se congela con ellos.
// Cambiar el texto del SVG obliga a dibujar un frame nuevo, que arranca de cero.
const CADA_10_MIN = 10 * 60 * 1000

/**
 * Traduce lo que se escribió después de `/lluvia` a una variante, `apagar` o `null` si no se entiende.
 */
export const elegir = (args: string): Variante | 'apagar' | null => {
  const a = args.trim().toLowerCase()
  if (a === '' || a === 'tormenta') return 'tormenta'
  if (a === 'calma') return 'calma'
  if (a === 'quieto') return 'quieto'
  if (a === 'apagar' || a === 'off') return 'apagar'
  return null
}

// Estado del módulo: una recarga del mod lo reinicia, y session.start lo vuelve a armar.
let recarga = 0
let reloj: { cancel: () => void } | undefined
const cache = new Map<Variante, string>()

function svg(v: Variante) {
  let s = cache.get(v)
  if (!s) cache.set(v, (s = escena(v)))
  return s
}

// Desde 2.1.324 el fondo se nombra con `scene`; las versiones anteriores usan `id` y rechazan lo que no conocen.
type ArgsTema = Parameters<EngineInterface['theme']['set']>[0]

async function ponerTema($: EngineInterface, v: Variante) {
  try {
    return await $.theme.set({ backdrop: { scene: FONDOS[v], glass: VIDRIO, overrideColorScheme: 'dark' } } as unknown as ArgsTema)
  } catch {
    // Versión anterior a 2.1.324: el mismo fondo con los nombres viejos.
    return await $.theme.set({ backdrop: { id: FONDOS[v], glass: VIDRIO, colorScheme: 'dark' } } as unknown as ArgsTema)
  }
}

/** Pone el fondo de la variante con el vidrio oscuro; si no se dibuja, deja el motivo en el log de depuración. */
async function poner($: EngineInterface, v: Variante) {
  const r = await ponerTema($, v)
  if (!r.isDrawn) $.ui.log(`lluvia-neon: el fondo no se dibuja (${r.reason})`, { to: 'debug' })
  return r
}

/** Pide un frame nuevo del fondo, que reinicia las animaciones pausadas. */
function recargar($: EngineInterface) {
  recarga++
  $.ui.invalidate('ui.render')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'lluvia',
      description: 'Fondo de ciudad bajo la lluvia: tormenta, calma, quieto o apagar',
      argumentHint: '[tormenta|calma|quieto|apagar]',
    })
    await poner($, 'tormenta')
    reloj ??= $.clock.every(CADA_10_MIN, () => recargar($))
    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    const r = await next(e)
    recargar($)
    return r
  })

  on('command.run', { command: 'lluvia' }, async ($, e) => {
    const v = elegir(e.args)
    if (v === null)
      return { text: `No conozco «${e.args.trim()}». Opciones: tormenta, calma, quieto o apagar.` }
    if (v === 'apagar') {
      await $.theme.clear()
      return { text: 'Fondo de lluvia apagado. /lluvia lo vuelve a encender.' }
    }
    const r = await poner($, v)
    recargar($)
    return {
      text: r.isDrawn
        ? `Lluvia: ${DESCRIPCION[v]}.`
        : `Lluvia: ${DESCRIPCION[v]}, pero esta vista no dibuja fondos (${r.reason}). Se ve en la pestaña Code de la app de escritorio.`,
    }
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    const p = e.props as { scene?: string; id?: string; plugin: string }
    const nombre = p.scene ?? p.id
    const v = (Object.keys(FONDOS) as Variante[]).find(k => FONDOS[k] === nombre)
    // Un fondo de otro plugin, o uno que no es nuestro, sigue su camino.
    if (!v || p.plugin !== 'lluvia-neon') return next(e)
    const elementos = $.ui.resolve(e)
    // Solo las superficies que dibujan fondos traen `Svg`.
    if (!('Svg' in elementos)) return next(e)
    const { Svg } = elementos
    // El grupo vacío con el contador cambia la fuente para forzar un frame nuevo.
    const fuente = svg(v).replace('</svg>', `<g id="r${recarga}"/></svg>`)
    return <Svg source={fuente} alt="Ciudad de noche bajo la lluvia, con rayos y letreros de neón" isInteractive />
  })
}
