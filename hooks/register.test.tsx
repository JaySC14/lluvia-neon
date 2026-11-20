import type { CommandRunInput } from 'claude-code'
import { expect, test } from 'claude-code/testing'

// La prueba hace de persona: el origen y la presentación los pondría el motor.
const lluvia = (args: string) => ({ command: 'lluvia', args }) as CommandRunInput

const FONDO = {
  plugin: 'lluvia-neon',
  component: 'Backdrop',
  requestId: 'backdrop',
  surface: 'desktop',
  props: { scene: 'lluvia-tormenta', plugin: 'lluvia-neon', glass: false },
} as const

test('en el escritorio la lluvia va en el shader; en el celular, en el SVG', async ($, on) => {
  const dibujo = async (surface: 'desktop' | 'mobile') => {
    const ui = await $.ui.mount({ ...FONDO, surface })
    const shader = await ui.find({ type: 'Shader' })
    const fuente = String((await ui.find({ type: 'Svg' }))?.props.source ?? '')
    await ui.unmount()
    return { shader: shader !== undefined && shader !== null, lluviaEnSvg: fuente.includes('stroke="#9aa4bd"') }
  }
  expect(await dibujo('desktop')).toEqual({ shader: true, lluviaEnSvg: false })
  expect(await dibujo('mobile')).toEqual({ shader: false, lluviaEnSvg: true })
})

test('una escena de otro plugin no se toca', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>otra</Text>
  })
  const ui = await $.ui.mount({ ...FONDO, props: { ...FONDO.props, plugin: 'otro' } })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('otra')
  await ui.unmount()
})

test('apagar se recuerda: la sesión siguiente no pone el tema', async ($, on) => {
  const guardado = new Map<string, unknown>()
  const temas: unknown[] = []
  on('command.register', () => ({ value: { command: 'lluvia' } }))
  on('store.get', (_, e) => ({ value: guardado.get((e as { key: string }).key) }))
  on('store.set', (_, e) => {
    const { key, value } = e as { key: string; value: unknown }
    guardado.set(key, value)
    return { value: undefined }
  })
  on('theme.set', (_, e) => {
    temas.push(e)
    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('theme.clear', () => ({ value: { isDrawn: false, reason: 'sin tema' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(temas.length).toBe(1)

  const r = await $.command.run(lluvia('apagar'))
  expect(String((r as { text?: string }).text)).toContain('apagado')
  expect(guardado.get('apagado')).toBe(true)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(temas.length).toBe(1)

  // /lluvia la vuelve a prender, y la sesión siguiente también.
  await $.command.run(lluvia(''))
  expect(temas.length).toBe(2)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(temas.length).toBe(3)
})
