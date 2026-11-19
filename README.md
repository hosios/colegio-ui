# colegio-ui

Biblioteca compartida de estilos y funciones para los widgets personalizados de Grist del Colegio. Ofrece una barra superior común (filtros, zoom, escala de grises, acciones e impresión), la paleta azul marino y los componentes de tablas, grupos, insignias, mensajes y fotos.

Este repositorio es público. No incluya datos de estudiantes, tokens ni direcciones internas: cada widget entrega esa configuración por su cuenta.

## Incluir la biblioteca en un widget

```html
<script src="https://docs.getgrist.com/grist-plugin-api.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/hosios/colegio-ui@1/colegio-ui.css">
<script src="https://cdn.jsdelivr.net/gh/hosios/colegio-ui@1/colegio-ui.js"></script>
```

Con `@1`, el widget recibe automáticamente todas las versiones 1.x. Una versión 2.0.0 solo se aplica cuando el widget cambia a `@2`.

## Iniciar la barra superior

```js
const ui = ColegioUI.iniciar({
  clave: "notasUno",          // prefijo único para recordar preferencias
  contenedor: "#app",         // elemento con el contenido del widget
  acento: "#214478",          // opcional; azul marino por defecto
  zoom: { anchoBase: 1000 },  // ancho de diseño en px; false para ocultar el zoom
  zoomEnContenedor: true,     // false si el widget aplica .cu-zoom a sus propios elementos
  gris: true,                 // casilla «Escala de grises»; o { etiqueta: "Borrador", alCambiar(activo) {} }
  impresion: { tamano: "letter", orientacion: "portrait", margen: "12mm 12mm 14mm" },
  filtros: [ /* ver abajo */ ],
  acciones: [ { id: "curso", texto: "Imprimir curso", alHacerClic: imprimirCurso } ],
  imprimir: true              // o { texto: "Imprimir", alHacerClic: fn }, o false
});
```

`iniciar` devuelve un objeto con `filtros`, `acciones`, `zoom`, `gris`, `botonImprimir`, `zonaFiltros` (para insertar controles especiales), `pagina(opciones)` y `mostrarBarra(visible)`.

### Zoom

El zoom es automático por defecto: adapta el contenido al ancho del panel según `anchoBase`. A− y A+ lo ajustan a mano y «Ajustar» vuelve al modo automático. La impresión siempre usa 100 %. Opciones: `anchoBase` (número o función), `auto`, `min`, `max`, `minAuto`, `maxAuto`, `paso`.

### Escala de grises

La casilla agrega la clase `cu-gris` al elemento `<html>`. El contenedor se muestra e imprime en grises, y el CSS del widget puede reaccionar a esa clase (por ejemplo, `.cu-gris .firma { display: block; }`).

## Filtros

Todos los filtros aceptan `id`, `etiqueta`, `valor` (inicial), `recordar` (guarda la última elección), `oculto` y `alCambiar(valor)`.

| Tipo | Opciones propias | Métodos |
|---|---|---|
| `select` | `opciones` (lista de textos o `{ valor, texto }`), `todos` (texto de la opción vacía) | `opciones(lista, todos)` |
| `busqueda` | `marcador`, `espera` (ms) | |
| `check` | | |
| `segmentado` | `opciones` | `opciones(lista)`, `ocultarOpcion(valor, ocultar)` |
| `personalizado` | `elemento` (nodo o HTML) | |

Cada filtro expone `valor` (lectura y escritura), `mostrar(visible)` y `elemento`.

```js
ui.filtros.curso.opciones(["6.º grado", "7.º grado"]);
ui.filtros.vista.ocultarOpcion("docente", !mapeo.Docente);
ui.filtros.sinPadres.mostrar(!!mapeo.TipoCarga);
```

## Utilidades (`ColegioUI.util`)

| Función | Uso |
|---|---|
| `esc(texto)` | Escapa texto para HTML |
| `coll`, `comparar(a, b)` | Orden alfabético en español con números naturales |
| `texto(v)`, `vacio(v)`, `numOrden(v)` | Lectura de valores de Grist |
| `idRef(v)` | Id de una referencia en cualquier formato |
| `filas(datos)`, `leerTabla(nombre)` | Datos por columnas → lista de filas |
| `fecha(v)`, `cedula(v)`, `numero(v, decimales)` | Formatos locales |
| `foto(fuente, nombre)`, `htmlFoto(fuente, nombre, tamaño, alt)`, `FOTO_VACIA` | Fotos de Nextcloud con reemplazo |
| `celdaNota(v, resaltar, tipo)` | Nota con insignia (por defecto, resalta el 1) |
| `plural(n, singular, plural)` | «3 estudiantes» |
| `retrasar(fn, ms)` | Espera a que el usuario deje de escribir |

`fuente` es `{ base, token, extension, ancho, alto }` y la define cada widget.

Otras funciones: `ColegioUI.cargando(titulo, detalle)` devuelve una función que cierra la pantalla de carga, y `ColegioUI.mensaje(elemento, texto, "alerta")` muestra u oculta un mensaje.

## Clases CSS

| Clase | Uso |
|---|---|
| `cu-pagina` | Márgenes estándar del contenido |
| `cu-titulo`, `cu-subtitulo` | Encabezado |
| `cu-resumen` (con `cu-alerta`) | Cifras destacadas |
| `cu-grupo` | Sección con título de borde izquierdo |
| `cu-tabla`, `cu-num`, `cu-nota`, `cu-centro`, `cu-fuerte`, `cu-inicio`, `cu-orden` | Tablas |
| `cu-insignia` (`--alerta`, `--exito`, `--acento`) | Valores destacados |
| `cu-vacio`, `cu-detalle` (`--alerta`) | Textos secundarios |
| `cu-mensaje` (`--alerta`) | Mensajes y avisos |
| `cu-foto` (`--chica`, `--mediana`, `--grande`) | Fotos |
| `cu-boton` (`--primario`, `--activo`), `cu-select`, `cu-check` | Controles fuera de la barra |
| `cu-zoom`, `cu-no-imprimir` | Zoom de pantalla y elementos que no se imprimen |

Variables principales: `--cu-tinta`, `--cu-suave`, `--cu-linea`, `--cu-banda`, `--cu-marino`, `--cu-marino-claro`, `--cu-acento`, `--cu-alerta`, `--cu-exito` y `--cu-fuente`.

## Versiones

Use `v1.0.1` para correcciones, `v1.1.0` para funciones nuevas compatibles y `v2.0.0` para cambios que obligan a modificar widgets. Después de publicar una versión, jsDelivr puede tardar algunas horas en actualizar `@1`; para aplicarla de inmediato, abra la misma dirección con `purge.jsdelivr.net` en lugar de `cdn.jsdelivr.net`.
