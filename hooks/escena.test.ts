import { expect, test } from 'claude-code/testing'

import { escena, LIMITE_SVG, sinAnimacion, type Variante } from './escena'
import { elegir } from './register'

const VARIANTES: Variante[] = ['tormenta', 'calma', 'quieto']

test('cada variante entra en el límite del elemento Svg', () => {
  for (const v of VARIANTES) {
    const svg = escena(v)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg.length).toBeLessThan(LIMITE_SVG)
  }
})

test('el SVG no lleva scripts, manejadores ni referencias externas', () => {
  for (const v of VARIANTES) {
    const svg = escena(v)
    expect(/<script|\son[a-z]+=|href=|foreignObject/i.test(svg)).toBe(false)
  }
})

test('la escena es determinista', () => {
  expect(escena('tormenta')).toBe(escena('tormenta'))
})

test('calma no tiene rayos y quieto no tiene animaciones', () => {
  expect(escena('tormenta').includes('#f1eeff')).toBe(true)
  expect(escena('calma').includes('#f1eeff')).toBe(false)
  expect(/<animate/.test(escena('quieto'))).toBe(false)
  expect(sinAnimacion('<g><animate a="1"/><animateTransform b="2"/></g>')).toBe('<g></g>')
})

test('el argumento del comando elige la variante', () => {
  expect(elegir('')).toBe('tormenta')
  expect(elegir('  Calma ')).toBe('calma')
  expect(elegir('quieto')).toBe('quieto')
  expect(elegir('off')).toBe('apagar')
  expect(elegir('niebla')).toBe(null)
})
