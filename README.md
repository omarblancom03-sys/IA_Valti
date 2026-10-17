# IA monótona vs. IA no-monótona

Animación interactiva para el tema **2.7 · Conocimiento no-monótono y otras lógicas**.
Dos inteligencias artificiales reciben exactamente la misma información y razonan en vivo:

- **IA monótona** (azul, cristal geodésico rígido): solo acumula conclusiones. Ante una excepción se
  contradice y su núcleo estalla (*ex falso quodlibet*); ante información incompleta se paraliza.
- **IA no-monótona** (magenta, red orgánica): trata sus conclusiones como provisionales y las retira
  cuando aparece evidencia en contra.

## Cómo iniciarla

Requiere **Node.js 18 o superior**. No hace falta `npm install`: no usa dependencias.

```bash
npm start
```

También puedes hacer doble clic en **`Iniciar animación.bat`**. El navegador se abre solo en
`http://localhost:3000`. Si el puerto está ocupado, el servidor usa el siguiente libre.
Funciona sin internet, así que se puede proyectar en clase sin conexión.

> No abras `public/index.html` con doble clic: el razonamiento lo calcula el servidor de Node.js.

## Controles

| Tecla | Acción |
| --- | --- |
| `→` `Espacio` `Clic` `Av Pág` | Siguiente paso (si hay una animación en curso, la termina) |
| `←` `Re Pág` | Paso anterior |
| `1` … `8` | Ir a una escena |
| `A` | Reproducción automática |
| `L` | Laboratorio (modo libre) |
| `M` | Sonido (apagado por defecto) |
| `F` | Pantalla completa |
| `H` | Ayuda |
| `Inicio` | Volver a la portada |

Los clickers de presentación funcionan porque envían `Av Pág` / `Re Pág`.

## Escenas

1. **Portada.** Dos formas de pensar.
2. **¿Por qué «monótona»?** La curva de conclusiones solo sube en una IA; en la otra también baja.
3. **Lógica por defecto** (Reiter): Tweety es un ave → vuela… hasta que resulta ser un pingüino.
4. **Circunscripción** (McCarthy): el bote. La monótona se paraliza con infinitos «¿y si…?»; la
   no-monótona minimiza lo anormal (`Ab = ∅`).
5. **Lógica autoepistémica** (Moore): «si el examen hubiera cambiado de fecha, yo lo sabría».
6. **Negación por fallo** (Clark): una base de conocimiento estilo Prolog con hipótesis de mundo cerrado.
7. **Razonamiento basado en argumentos** (Dung): grafo de argumentos que se atacan (¿el correo es spam?).
8. **Conclusión.**

En el **laboratorio** (`L`) eliges cualquiera de los cinco métodos, agregas hechos (incluso animales
nuevos) y ves cómo responde cada IA.

## Qué hace Node.js

`server.js` sirve la página y expone el motor de razonamiento:

| Ruta | Descripción |
| --- | --- |
| `GET /api/presentacion` | Escenas con los estados de ambas IAs ya calculados por los motores |
| `GET /api/mundos` | Mundos disponibles para el laboratorio |
| `POST /api/razonar` | `{ mundo, hechos[], nombres{} }` → razonamiento de las dos IAs |
| `GET /api/salud` | Latido del motor (indicador «Motor Node.js» arriba a la derecha) |

Los motores (`motor/`) hacen razonamiento lógico real: no reproducen respuestas escritas a mano.

- `logica.js`: unificación y encadenamiento hacia adelante con negación estratificada.
- `motores.js`: la IA monótona (deducción clásica y detección de contradicciones) y los cinco motores
  no-monótonos: extensiones de Reiter, circunscripción (minimización de `Ab`), expansiones estables
  autoepistémicas, negación por fallo finito y semántica fundamentada de Dung.
- `mundos.js`: hechos, reglas y textos de cada escena.
- `presentacion.js`: guion y narración.

## Estructura

```
server.js            servidor HTTP sin dependencias
motor/               motores de razonamiento
public/index.html    escenario 1920×1080 que se escala a cualquier pantalla
public/css/          estilos (neón holográfico)
public/js/           cerebros 3D en canvas, efectos, paneles, director y laboratorio
public/fuentes/      Exo 2 y JetBrains Mono (licencia OFL)
```
