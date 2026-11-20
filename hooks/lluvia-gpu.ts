/**
 * La lluvia y la luz de los rayos, dibujadas por la placa de video encima de la escena.
 *
 * En el SVG, la lluvia y el resplandor de los rayos cubrían toda la pantalla y obligaban a
 * redibujar la ciudad entera en cada cuadro. Acá salen de una cuenta por píxel, sin redibujar
 * nada debajo. Los rayos en sí, finos, quedan en el SVG. Si la app no puede correr esto,
 * muestra la escena sola: la ciudad no depende de él.
 */
import { abs, clamp, floor, fract, max, min, picture, shader, size, step, time, vec4 } from 'claude-code/shader'

/**
 * Un número al azar estable para cada entrada, sin seno: la misma columna da siempre la misma
 * gota, y en una placa de video débil cuesta bastante menos que `fract(sin(n) * k)`.
 */
const azar = (n: number) => {
  const a = fract(n * 0.1031)
  const b = a * (a + 33.33)
  return fract(b * (b + b))
}

/**
 * Una capa de lluvia en puntos de la ventana. Las gotas caen en diagonal, como en la escena:
 * por cada punto que bajan, se corren 0,3 a la izquierda.
 *
 * @param ancho separación entre columnas de gotas
 * @param alto largo del tramo en que cae una gota antes de repetirse
 * @param largo largo del trazo de cada gota
 * @param vel puntos por segundo
 * @param semilla para que cada capa tenga sus propias columnas
 * @param grueso ancho del trazo, en puntos
 */
function capa(x: number, y: number, ancho: number, alto: number, largo: number, vel: number, semilla: number, grueso: number): number {
  // A lo largo de un trazo, x + 0,3·y no cambia: esa es la columna de la gota.
  const u = x + y * 0.3
  const col = floor(u / ancho)
  const r1 = azar(col + semilla * 101.0)
  const r2 = azar(col + semilla * 101.0 + 57.0)
  // El avance se toma módulo el tramo antes de sumar, así no pierde precisión con las horas.
  const avance = fract(time * (vel / alto) + r1) * alto
  const f = fract((y - avance) / alto) * alto
  const t = (f - r2 * (alto - largo)) / largo
  const enTrazo = step(0, t) * step(t, 1)
  // Distancia al centro del trazo, con cada columna un poco corrida para que no se vea en grilla.
  const centro = abs((fract(u / ancho) - 0.5 - (r2 - 0.5) * 0.5) * ancho)
  // Borde suave de medio punto a cada lado, para que el trazo no se vea serruchado (una rampa
  // lineal de un punto: a ese tamaño no se distingue de una curva y es más barata).
  const grosor = clamp(grueso * 0.5 + 0.5 - centro, 0, 1)
  // Más clara abajo, donde va la punta de la gota.
  return enTrazo * grosor * t
}

/** Cuánto dura como mínimo cada subida o bajada de luz: la app frena una escena que destella. */
const RAMPA = 0.12

/**
 * Brillo de un rayo en el instante `t` de su ciclo: sube, titila una vez sin apagarse y se
 * desvanece. Nunca salta de golpe: cada tramo dura `RAMPA` o más.
 */
function envolvente(t: number, en: number): number {
  const d = t - en
  const sube = clamp(d / RAMPA, 0, 1)
  const titila = 1 - 0.55 * clamp(1 - abs(d - 2 * RAMPA) / RAMPA, 0, 1)
  const baja = 1 - clamp((d - 3 * RAMPA) / (4 * RAMPA), 0, 1)
  return sube * titila * baja
}


export default shader({
  // A 30 cuadros la lluvia se sigue viendo pareja y la placa de video trabaja la mitad.
  fps: 30,
  passes: [
    picture(p => {
      const x = p.point.x, y = p.point.y

      // La lluvia: las tres capas del SVG, de la más lejana a la más cercana; unas 85, 65 y 45 gotas.
      const lluvia =
        capa(x, y, 26, 1100, 34, 1200, 1, 2.4) * 0.16 +
        capa(x, y, 34, 1100, 49, 1650, 2, 2.7) * 0.26 +
        capa(x, y, 50, 1100, 69, 2400, 3, 3.6) * 0.42

      // El punto en unidades de la escena: el SVG se ajusta entero y apoyado abajo (`xMidYMax meet`).
      const s = min(size.x / 680, size.y / 440)
      const sx = (x - (size.x - 680 * s) * 0.5) / s
      const sy = (y - (size.y - 440 * s)) / s

      // Los rayos del SVG caen cada 7 y 11 segundos; su luz sobre el cielo y las nubes va acá, al
      // mismo tiempo, porque tapa mucho y en el SVG obligaría a redibujar toda la escena.
      const eA = envolvente(fract(time / 7) * 7, 4.06)
      const eB = envolvente(fract(time / 11) * 11, 3.3)

      // Nubes iluminadas alrededor de cada rayo, como elipses de borde difuso (multiplicaciones y
      // rampas lineales: a la vista casi igual que potencias y curvas, y más baratas por píxel).
      const a1 = (sx - 420) * (1 / 130), b1 = (sy - 86) * (1 / 14)
      const a2 = (sx - 470) * (1 / 80), b2 = (sy - 62) * (1 / 10)
      const a3 = (sx - 140) * (1 / 110), b3 = (sy - 72) * (1 / 12)
      const borde = (q: number) => clamp((1 - q) * (1 / 0.6), 0, 1)
      const nubeA = max(borde(a1 * a1 + b1 * b1), borde(a2 * a2 + b2 * b2)) * eA * 0.35
      const nubeB = borde(a3 * a3 + b3 * b3) * eB * 0.3

      // El cielo apenas se aclara arriba de la calle; la luz fuerte queda en el rayo y sus nubes.
      const cielo = (eA * 0.13 + eB * 0.08) * clamp((330 - sy) * (1 / 80), 0, 1)

      // La franja del medio, donde va la conversación, se oscurece un poco para que el texto se
      // lea; los costados quedan con todo el neón. Va primero, debajo de la luz y la lluvia.
      const sombra = 0.3 * clamp(1 - abs(p.uv.x - 0.5) * (1 / 0.34), 0, 1)

      // Se suman de atrás hacia adelante, premultiplicados como pide `picture`.
      let c = vec4(0, 0, 0, sombra)
      c = vec4(c * (1 - cielo) + vec4(0.5 * cielo, 0.53 * cielo, 0.72 * cielo, cielo))
      const n = max(nubeA, nubeB)
      c = vec4(c * (1 - n) + vec4(0.66 * n, 0.71 * n, 0.88 * n, n))
      c = vec4(c * (1 - lluvia) + vec4(0.6 * lluvia, 0.64 * lluvia, 0.74 * lluvia, lluvia))
      return c
    }),
  ],
})
