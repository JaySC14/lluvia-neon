# lluvia-neon

Tema para la pestaña **Code** de la app de escritorio de Claude: detrás de la conversación se ve una ciudad actual de noche bajo una tormenta. Tiene rayos, lluvia en capas, letreros de neón, metro elevado, tránsito, calle mojada con reflejos y gotas sobre el vidrio. Los paneles de la app se esmerilan en oscuro para que el texto se siga leyendo.

## Requisitos

- La pestaña Code de la app de escritorio de Claude. La terminal no dibuja fondos.
- Una versión de Claude Code que soporte fondos de tema (`Backdrop` en `$.theme.set`). Las versiones viejas cargan el mod pero no dibujan nada.
- Una cuenta que permita mods.

## Instalación

Desde la terminal, en el prompt de una sesión de Claude Code:

```
/plugin install lluvia-neon --marketplace JaySC14/lluvia-neon
```

Responder `y` para agregar el marketplace y elegir el alcance (usuario).

Desde una shell:

```bash
claude plugin install lluvia-neon --marketplace JaySC14/lluvia-neon
```

En la app de escritorio: **+** junto al cuadro del prompt → **Plugins** → **Add marketplace** con `JaySC14/lluvia-neon` → **Add plugin**.

Después de instalarlo, abrí una sesión nueva en la pestaña Code: el tema se aplica al iniciar la sesión.

## Uso

| Comando | Qué hace |
| --- | --- |
| `/lluvia` | Tormenta completa (por defecto): rayos, trueno y toda la ciudad en movimiento |
| `/lluvia calma` | Llovizna, sin rayos ni patrulla, con el neón fijo: para concentrarse |
| `/lluvia quieto` | La misma escena sin animación, para diagnosticar o ahorrar recursos |
| `/lluvia apagar` | Quita el fondo y vuelve al aspecto normal de la app |

Si el fondo no aparece, `/lluvia` dice por qué (por ejemplo, que esa vista no dibuja fondos).

## Cómo funciona

- `hooks/escena.ts` arma el SVG con funciones puras y un generador con semilla fija: la misma variante da siempre el mismo dibujo. Las animaciones son SMIL, porque el fondo se dibuja en un frame sin scripts.
- `hooks/register.tsx`:
  - Pone el tema al iniciar la sesión con `$.theme.set` y registra `/lluvia`.
  - Dibuja el fondo en `ui.render` sobre `Backdrop`.
  - La app pausa los frames ocultos y eso congela las animaciones. Para recuperarlas, el fondo se vuelve a dibujar al abrir la sesión, cuando se suma otra ventana, al usar `/lluvia` y cada 10 minutos. Cada vez que se redibuja, las animaciones arrancan de cero.
- El SVG tiene que quedar por debajo de 131 072 caracteres, que es el límite del elemento `Svg`. Hay una prueba que lo controla.

## Desarrollo

```bash
claude plugin validate .
claude plugin test .
```

Para probarlo sin instalar, abrí Claude Code con `claude --plugin-dir <carpeta del mod>`.

## Notas

- La escena está pensada en 680×440 y se escala para cubrir la ventana. En pantallas muy anchas o muy altas se recortan los bordes.
- La tormenta es la variante más pesada. Si notás la app lenta, usá `/lluvia calma` o `/lluvia quieto`.

## Licencia

MIT, ver [LICENSE](LICENSE).
