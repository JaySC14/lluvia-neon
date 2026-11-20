import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { escena } from './escena'
import { makeColors } from './make-colors.js'

/** Nombre de la escena: el render lo usa para saber que el fondo es nuestro. */
const ESCENA = 'lluvia-tormenta'

/**
 * Vidrio ahumado: los paneles se oscurecen sobre la escena y el texto se sigue leyendo.
 * Sin desenfoque a propósito: como el fondo se mueve en cada cuadro, la app tendría que
 * recalcularlo 60 veces por segundo sobre casi toda la ventana, y era lo que más pesaba.
 */
const VIDRIO = { blur: 0, tint: '#07060c', opacity: 0.8 }

/** La app entera en la paleta de la escena: grises violeta de noche y acentos neón. */
const { theme: COLORES, problems: PROBLEMAS } = makeColors({
  label: 'Lluvia neón',
  only: 'dark',
  roles: { accent: '#ff3fa4', danger: '#ff4d5e', success: '#3dff9e', warning: '#ffb347', pro: '#b84dff' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0b0a12',
        'surface-1': '#110f1b',
        'surface-2': '#161423',
        'surface-3': '#1b1829',
        'text-primary': '#eeebf7',
        // Algo más claros que el gris de la escena, para que lo secundario se lea sobre el neón.
        'text-secondary': '#d6d1e6',
        'text-muted': '#b7b0cc',
      },
    },
  },
})

const TEMA: ThemeSetArgs = {
  backdrop: { scene: ESCENA, glass: VIDRIO },
  overrideColorScheme: 'dark',
  colors: COLORES,
}

// La app pausa el fondo cuando no se ve o está ocupada, y no siempre lo reanuda.
// Cambiar el texto del SVG obliga a dibujar un frame nuevo, que arranca de cero.
const CADA_10_MIN = 10 * 60 * 1000
/** Desde cuántos caracteres un mensaje en borrador suele hacer que la app frene el fondo. */
const LARGO_QUE_FRENA = 200
/** Cuánto sin escribir cuenta como pausa: corto para que vuelva pronto, largo para no cortar entre palabras. */
const PAUSA_AL_ESCRIBIR = 2500
/** Cuánto esperar después de mandar un mensaje largo para redibujar, pasado el arranque de la respuesta. */
const TRAS_ENVIAR = 2000

/** Traduce lo que se escribió después de `/lluvia`: prender, apagar o `null` si no se entiende. */
export const elegir = (args: string): 'prender' | 'apagar' | null => {
  const a = args.trim().toLowerCase()
  if (a === '') return 'prender'
  if (a === 'apagar' || a === 'off') return 'apagar'
  return null
}

// Estado del módulo: una recarga del mod lo reinicia, y session.start lo vuelve a armar.
let recarga = 0
let apagado = false
let reloj: { cancel: () => void } | undefined
/** El redibujo pendiente para cuando se deja de escribir un mensaje largo. */
let pausa: { cancel: () => void } | undefined
const cache = new Map<boolean, string>()

/** La escena; con `gpu`, la versión sin lluvia que va debajo del shader. */
function svg(gpu: boolean) {
  let s = cache.get(gpu)
  if (!s) cache.set(gpu, (s = escena(gpu)))
  return s
}

/** Pone la escena y los colores; si no se dibuja, deja el motivo en el log de depuración. */
async function poner($: EngineInterface) {
  const r = await $.theme.set(TEMA)
  if (!r.isDrawn) $.ui.log(`lluvia-neon: el fondo no se dibuja (${r.reason})`, { to: 'debug' })
  return r
}

/** Pide un frame nuevo del fondo, que reinicia las animaciones pausadas. */
function recargar($: EngineInterface) {
  if (apagado) return
  recarga++
  $.ui.invalidate('ui.render')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'lluvia',
      description: 'Fondo de ciudad bajo la tormenta; /lluvia apagar lo quita',
      argumentHint: '[apagar]',
    })
    reloj ??= $.clock.every(CADA_10_MIN, () => recargar($))
    // Si se apagó, sigue apagado en las sesiones siguientes hasta que se use /lluvia.
    apagado = (await $.store.get('apagado')) === true
    if (apagado) return next(e)
    const unpainted = PROBLEMAS.find(l => l.startsWith("Desktop won't paint"))
    if (unpainted) $.ui.log(`lluvia-neon: ${unpainted}`, { to: 'debug' })
    await poner($)
    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    const r = await next(e)
    recargar($)
    return r
  })

  // Con un mensaje largo la app prioriza la caja de texto y deja el fondo quieto, shader incluido.
  // Cuando se deja de escribir un momento, un redibujo lo vuelve a arrancar sin esperar al envío.
  on('prompt.change', async ($, e, next) => {
    pausa?.cancel()
    pausa = e.text.length >= LARGO_QUE_FRENA ? $.clock.after(PAUSA_AL_ESCRIBIR, () => recargar($)) : undefined
    return next(e)
  })

  // Redibujar reconstruye la escena entera, y al mandar un mensaje la app está ocupada arrancando
  // la respuesta: hacerlo ahí traba el fondo un segundo. Un mensaje corto no frena el fondo, así
  // que no hace falta; tras uno largo, se redibuja cuando ya pasó ese arranque.
  on('prompt.submit', async ($, e, next) => {
    pausa?.cancel()
    pausa = e.text.length >= LARGO_QUE_FRENA ? $.clock.after(TRAS_ENVIAR, () => recargar($)) : undefined
    return next(e)
  }).catch(($, e, next) => next(e)) // Un fallo del fondo nunca frena un mensaje.

  on('command.run', { command: 'lluvia' }, async ($, e) => {
    const p = elegir(e.args)
    if (p === null) return { text: `No conozco «${e.args.trim()}». Usá /lluvia para prenderla o /lluvia apagar.` }
    if (p === 'apagar') {
      apagado = true
      await $.store.set('apagado', true)
      await $.theme.clear()
      return { text: 'Fondo de lluvia apagado, también en las próximas sesiones. /lluvia lo vuelve a encender.' }
    }
    apagado = false
    await $.store.set('apagado', false)
    const r = await poner($)
    recargar($)
    return {
      text: r.isDrawn
        ? 'Lluvia: tormenta sobre la ciudad.'
        : `La lluvia está prendida, pero esta vista no dibuja fondos (${r.reason}). Se ve en la pestaña Code de la app de escritorio.`,
    }
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    // Una escena de otro plugin sigue su camino.
    if (e.props.scene !== ESCENA || e.props.plugin !== 'lluvia-neon') return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    const elementos = $.ui.resolve(e)
    if (!('Svg' in elementos)) return next(e)
    const { Svg } = elementos
    // En el escritorio la lluvia la dibuja la placa de video; en el celular va en el SVG.
    const conGpu = e.surface === 'desktop' && 'Shader' in elementos
    // El grupo con el contador cambia la fuente para forzar un frame nuevo.
    const fuente = svg(conGpu).replace(/<\/svg>$/, `<g id="r${recarga}"/></svg>`)
    const ciudad = <Svg source={fuente} alt="Ciudad de noche bajo la tormenta, con letreros de neón" isInteractive />
    if (!conGpu) return ciudad
    const { Shader } = elementos
    // Si la app no puede correr el shader, muestra la ciudad sola: nunca queda en negro.
    return <Shader module="./lluvia-gpu.ts">{ciudad}</Shader>
  })
}
