/* ============================================================================
   COLEGIO-UI 1.1.0 — Biblioteca compartida de los widgets de Grist
   ----------------------------------------------------------------------------
   Uso básico:
     const ui = ColegioUI.iniciar({
       clave: "notasUno",              // prefijo para recordar preferencias
       contenedor: "#app",             // contenido del widget
       zoom: { anchoBase: 1000 },      // false para no mostrar el zoom
       gris: true,                     // casilla «Escala de grises»
       impresion: { tamano: "letter", orientacion: "portrait", margen: "12mm" },
       filtros: [ ... ],               // ver README
       acciones: [ ... ],              // botones adicionales
       imprimir: true                  // botón «Imprimir»
     });

   Este archivo no contiene datos ni direcciones del Colegio: cada widget
   entrega su propia configuración (por ejemplo, la carpeta de fotos).
   ============================================================================ */
(function (global) {
  "use strict";

  const VERSION = "1.1.0";

  /* ==========================================================================
     UTILIDADES
     ========================================================================== */
  const util = {};

  /** Escapa texto para insertarlo en HTML. */
  util.esc = t => String(t ?? "").replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /** Comparador alfabético en español, con números naturales (1.º < 2.º < 10.º). */
  util.coll = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
  util.comparar = (a, b) => util.coll.compare(String(a ?? ""), String(b ?? ""));

  /** Convierte cualquier valor de Grist en texto (listas incluidas). */
  util.texto = v => Array.isArray(v)
    ? v.filter(x => x !== "L").join(", ")
    : (v === null || v === undefined ? "" : String(v).trim());

  /** Indica si un valor de Grist está vacío. */
  util.vacio = v => v === null || v === undefined || v === "" ||
    (Array.isArray(v) && v.length <= 1);

  /** Número para ordenar; los valores vacíos van al final. */
  util.numOrden = v => {
    const n = Number(v);
    return (v !== null && v !== "" && isFinite(n)) ? n : Infinity;
  };

  /** Obtiene el id de una referencia: número, ["R", tabla, id], {rowId} o "Tabla[id]". */
  util.idRef = v => {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "number") return v > 0 ? v : 0;
    if (Array.isArray(v)) return (v[0] === "R" || v[0] === "r") ? Number(v[2]) || 0 : 0;
    if (typeof v === "object") return Number(v.rowId ?? v.id) || 0;
    const m = String(v).match(/\[(\d+)\]\s*$/) || String(v).match(/^\s*(\d+)\s*$/);
    return m ? Number(m[1]) : 0;
  };

  /** Indica si una referencia está vacía (Grist envía 0 para una referencia vacía). */
  util.sinRef = v => util.idRef(v) === 0;

  /** Convierte datos por columnas (fetchTable) en una lista de filas. */
  util.filas = datos => {
    const claves = Object.keys(datos || {});
    if (!claves.length) return [];
    const total = datos[claves[0]].length;
    const filas = new Array(total);
    for (let i = 0; i < total; i++) {
      const fila = {};
      claves.forEach(k => { fila[k] = datos[k][i]; });
      filas[i] = fila;
    }
    return filas;
  };

  /** Lee una tabla completa como lista de filas (requiere acceso completo). */
  util.leerTabla = async nombre => util.filas(await global.grist.docApi.fetchTable(nombre));

  /** Fecha en formato local: segundos, milisegundos, texto ISO o Date. */
  util.fecha = (valor, opciones) => {
    if (valor === null || valor === undefined || valor === "") return "–";
    let ms = valor;
    if (typeof valor === "string") ms = new Date(valor).getTime();
    else if (typeof valor === "number") ms = valor < 1e12 ? valor * 1000 : valor;
    else if (valor instanceof Date) ms = valor.getTime();
    if (isNaN(ms)) return "–";
    return new Date(ms).toLocaleDateString("es-PY", Object.assign(
      { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }, opciones || {}));
  };

  /**
   * Fecha de hoy en la hora local del equipo (no en UTC).
   * util.hoy() → "19/11/2026"; util.hoy({ day: "numeric", month: "long", year: "numeric" }) → "19 de noviembre de 2026"
   */
  util.hoy = opciones => new Date().toLocaleDateString("es-PY", opciones || undefined);

  /** Número con separador de miles (cédulas: 7.719.076). */
  util.cedula = v => (v === null || v === undefined || v === "" || isNaN(Number(v)))
    ? "–" : Number(v).toLocaleString("de-DE");

  /** Número con decimales fijos en formato local (3,5). */
  util.numero = (v, decimales = 1) => (v === null || v === undefined || v === "" || isNaN(Number(v)))
    ? "–" : Number(v).toLocaleString("es-PY", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

  /** Imagen de reemplazo cuando no hay foto. */
  util.FOTO_VACIA = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100">' +
    '<rect width="80" height="100" fill="#f3f6f9"/>' +
    '<circle cx="40" cy="38" r="16" fill="#d7dee6"/>' +
    '<path d="M12 96c2-20 14-30 28-30s26 10 28 30z" fill="#d7dee6"/></svg>');

  /**
   * Dirección de la foto en una carpeta compartida de Nextcloud.
   * fuente = { base: "https://nextcloud.ejemplo", token: "…", extension: "jpg", ancho: 200, alto: 250 }
   */
  util.foto = (fuente, nombre) => {
    if (!fuente || !fuente.base || !fuente.token || util.vacio(nombre)) return util.FOTO_VACIA;
    const ext = fuente.extension || "jpg";
    const ancho = fuente.ancho || 200, alto = fuente.alto || 250;
    return `${String(fuente.base).replace(/\/+$/, "")}/apps/files_sharing/publicpreview/` +
      `${encodeURIComponent(fuente.token)}?file=/${encodeURIComponent(String(nombre).trim())}.${ext}` +
      `&x=${ancho}&y=${alto}&a=true`;
  };

  /** Etiqueta <img> con reemplazo automático si la foto no carga. */
  util.htmlFoto = (fuente, nombre, tamano = "mediana", alt = "Foto") =>
    `<img class="cu-foto cu-foto--${tamano}" src="${util.esc(util.foto(fuente, nombre))}" ` +
    `alt="${util.esc(alt)}" loading="lazy" onerror="this.onerror=null;this.src=ColegioUI.util.FOTO_VACIA">`;

  /** Valor de nota: vacío en gris, valores resaltados con una insignia. */
  util.celdaNota = (v, resaltar = n => Number(n) === 1, tipo = "alerta") => {
    if (util.vacio(v)) return `<span class="cu-vacio">–</span>`;
    const t = util.esc(util.texto(v));
    return resaltar(v) ? `<span class="cu-insignia cu-insignia--${tipo}">${t}</span>` : t;
  };

  /** Plural simple: plural(3, "estudiante") → "3 estudiantes". */
  util.plural = (n, singular, plural) => `${n} ${n === 1 ? singular : (plural || singular + "s")}`;

  /** Retrasa una función hasta que el usuario deja de escribir. */
  util.retrasar = (fn, ms = 200) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  /* ==========================================================================
     PREFERENCIAS (localStorage, con tolerancia a errores)
     ========================================================================== */
  function leerPref(clave, porDefecto) {
    try {
      const v = localStorage.getItem(clave);
      return v === null ? porDefecto : JSON.parse(v);
    } catch (e) { return porDefecto; }
  }
  function guardarPref(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento */ }
  }

  /* ==========================================================================
     CREACIÓN DE ELEMENTOS
     ========================================================================== */
  function crear(etiqueta, clase, html) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (html !== undefined) el.innerHTML = html;
    return el;
  }

  function boton(texto, clase, titulo) {
    const b = crear("button", "cu-boton" + (clase ? " " + clase : ""));
    b.type = "button";
    b.textContent = texto;
    if (titulo) b.title = titulo;
    return b;
  }

  function campo(etiqueta) {
    const c = crear("div", "cu-campo");
    if (etiqueta) c.appendChild(crear("span", "cu-etiqueta", util.esc(etiqueta)));
    return c;
  }

  /** Normaliza opciones: ["A", "B"] o [{ valor, texto }]. */
  const normalizar = lista => (lista || []).map(o =>
    (o !== null && typeof o === "object") ? { valor: String(o.valor), texto: o.texto ?? o.valor }
                                          : { valor: String(o), texto: o });

  /* ==========================================================================
     FILTROS
     Cada filtro devuelve un control con:
       .valor              valor actual (lectura y escritura)
       .opciones(lista)    reemplaza las opciones (select y segmentado)
       .mostrar(sí/no)     muestra u oculta el filtro
       .elemento           nodo HTML del filtro
     ========================================================================== */
  function crearFiltro(def, prefijo) {
    const claveMem = def.recordar ? `${prefijo}.filtro.${def.id}` : null;
    const inicial = claveMem ? leerPref(claveMem, def.valor) : def.valor;
    const avisar = v => {
      if (claveMem) guardarPref(claveMem, v);
      if (typeof def.alCambiar === "function") def.alCambiar(v);
    };

    let control;
    switch (def.tipo) {

      case "select": {
        const c = campo(def.etiqueta);
        const sel = crear("select", "cu-select");
        sel.setAttribute("aria-label", def.etiqueta || def.id);
        c.appendChild(sel);
        let actual = inicial ?? "";
        const dibujarOpciones = (lista, todos) => {
          const ops = normalizar(lista);
          const textoTodos = todos !== undefined ? todos : def.todos;
          sel.innerHTML = (textoTodos ? `<option value="">${util.esc(textoTodos)}</option>` : "") +
            ops.map(o => `<option value="${util.esc(o.valor)}">${util.esc(o.texto)}</option>`).join("");
          sel.value = ops.some(o => o.valor === String(actual)) ? String(actual) : (textoTodos ? "" : (ops[0]?.valor ?? ""));
          actual = sel.value;
          return actual;
        };
        dibujarOpciones(def.opciones);
        sel.addEventListener("change", () => { actual = sel.value; avisar(actual); });
        control = {
          elemento: c,
          get valor() { return sel.value; },
          set valor(v) { actual = v ?? ""; sel.value = actual; },
          opciones: dibujarOpciones
        };
        break;
      }

      case "busqueda": {
        const c = campo(def.etiqueta);
        const inp = crear("input", "cu-busqueda");
        inp.type = "search";
        inp.placeholder = def.marcador || "Escriba para buscar";
        inp.setAttribute("aria-label", def.etiqueta || "Buscar");
        inp.value = inicial || "";
        c.appendChild(inp);
        inp.addEventListener("input", util.retrasar(() => avisar(inp.value.trim()), def.espera ?? 200));
        control = {
          elemento: c,
          get valor() { return inp.value.trim(); },
          set valor(v) { inp.value = v ?? ""; }
        };
        break;
      }

      case "check": {
        const lbl = crear("label", "cu-check");
        const inp = crear("input");
        inp.type = "checkbox";
        inp.checked = !!inicial;
        lbl.appendChild(inp);
        lbl.appendChild(document.createTextNode(" " + (def.etiqueta || "")));
        inp.addEventListener("change", () => avisar(inp.checked));
        control = {
          elemento: lbl,
          get valor() { return inp.checked; },
          set valor(v) { inp.checked = !!v; }
        };
        break;
      }

      case "segmentado": {
        const c = campo(def.etiqueta);
        const grupo = crear("div", "cu-segmentado");
        grupo.setAttribute("role", "group");
        grupo.setAttribute("aria-label", def.etiqueta || def.id);
        c.appendChild(grupo);
        let actual = inicial;
        let ocultas = new Set();
        let ops = [];
        const marcar = () => {
          const visibles = [...grupo.children].filter(b => !b.hidden);
          [...grupo.children].forEach(b => {
            const activo = b.dataset.valor === String(actual);
            b.classList.toggle("cu-boton--activo", activo);
            b.setAttribute("aria-pressed", activo ? "true" : "false");
            b.classList.toggle("cu-primero", b === visibles[0]);
            b.classList.toggle("cu-ultimo", b === visibles[visibles.length - 1]);
          });
        };
        const dibujarOpciones = lista => {
          ops = normalizar(lista);
          grupo.innerHTML = "";
          ops.forEach(o => {
            const b = boton(o.texto);
            b.dataset.valor = o.valor;
            b.hidden = ocultas.has(o.valor);
            b.addEventListener("click", () => { actual = o.valor; marcar(); avisar(actual); });
            grupo.appendChild(b);
          });
          if (!ops.some(o => o.valor === String(actual) && !ocultas.has(o.valor))) {
            actual = ops.find(o => !ocultas.has(o.valor))?.valor;
          }
          marcar();
        };
        dibujarOpciones(def.opciones);
        control = {
          elemento: c,
          get valor() { return actual; },
          set valor(v) { actual = String(v); marcar(); },
          opciones: dibujarOpciones,
          /** Oculta o muestra una opción (por ejemplo, «Docente» si no hay columna). */
          ocultarOpcion(valor, ocultar = true, { avisar: conAviso = true } = {}) {
            ocultar ? ocultas.add(String(valor)) : ocultas.delete(String(valor));
            const b = grupo.querySelector(`[data-valor="${CSS.escape(String(valor))}"]`);
            if (b) b.hidden = ocultar;
            const cambia = ocultar && String(actual) === String(valor);
            if (cambia) actual = ops.find(o => !ocultas.has(o.valor))?.valor;
            marcar();
            // Si se ocultó la opción activa, se guarda el nuevo valor y se avisa al widget
            if (cambia) {
              if (claveMem) guardarPref(claveMem, actual);
              if (conAviso && typeof def.alCambiar === "function") def.alCambiar(actual);
            }
          }
        };
        break;
      }

      case "personalizado": {
        const c = campo(def.etiqueta);
        if (typeof def.elemento === "string") c.insertAdjacentHTML("beforeend", def.elemento);
        else if (def.elemento instanceof Node) c.appendChild(def.elemento);
        control = { elemento: c, valor: undefined };
        break;
      }

      default:
        console.warn(`ColegioUI: tipo de filtro desconocido «${def.tipo}».`);
        return null;
    }

    // El valor asignado desde el código también se recuerda (recordar: true)
    const desc = Object.getOwnPropertyDescriptor(control, "valor");
    if (desc && desc.set) {
      Object.defineProperty(control, "valor", {
        enumerable: true, configurable: true,
        get: desc.get,
        set(v) { desc.set.call(control, v); if (claveMem) guardarPref(claveMem, desc.get.call(control)); }
      });
    }

    /** Cambia el valor desde el código, lo guarda y, salvo { avisar: false }, llama a alCambiar. */
    control.fijar = (v, { avisar: conAviso = true } = {}) => {
      control.valor = v;
      if (conAviso && typeof def.alCambiar === "function") def.alCambiar(control.valor);
      return control.valor;
    };

    control.mostrar = (visible = true) => { control.elemento.hidden = !visible; };
    if (def.oculto) control.mostrar(false);
    return control;
  }

  /* ==========================================================================
     ZOOM DE PANTALLA
     - Automático por defecto: adapta el contenido al ancho del panel
     - A− / A+ para ajuste manual; «Ajustar» vuelve al modo automático
     - Se recuerda la última elección; la impresión siempre usa 100 %
     ========================================================================== */
  function crearZoom(cfg, prefijo) {
    const opc = Object.assign({ anchoBase: 1000, auto: true, min: 0.3, max: 2, minAuto: 0.5, maxAuto: 1.5, paso: 0.1 }, cfg);
    const clave = `${prefijo}.zoom`;
    let estado = leerPref(clave, { auto: opc.auto, valor: 1 });
    if (!estado || typeof estado.valor !== "number") estado = { auto: opc.auto, valor: 1 };

    const grupo = crear("div", "cu-zoom-grupo");
    grupo.setAttribute("role", "group");
    grupo.setAttribute("aria-label", "Zoom de pantalla");
    const menos = boton("A−", "", "Reducir");
    const salida = crear("output", "", "100 %");
    const mas = boton("A+", "", "Ampliar");
    const ajustar = boton("Ajustar", "", "Ajustar al ancho del panel");
    grupo.append(menos, salida, mas, ajustar);

    const redondear = v => Math.round(v * 20) / 20;
    const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

    function aplicar() {
      if (estado.auto) {
        const ancho = typeof opc.anchoBase === "function" ? opc.anchoBase() : opc.anchoBase;
        estado.valor = redondear(limitar((window.innerWidth - 10) / ancho, opc.minAuto, opc.maxAuto));
      }
      document.documentElement.style.setProperty("--cu-zoom", estado.valor);
      salida.textContent = Math.round(estado.valor * 100) + " %";
      ajustar.classList.toggle("cu-boton--activo", estado.auto);
      ajustar.setAttribute("aria-pressed", estado.auto ? "true" : "false");
      guardarPref(clave, estado);
    }
    function cambiar(paso) {
      estado.auto = false;
      estado.valor = redondear(limitar(estado.valor + paso, opc.min, opc.max));
      aplicar();
    }

    menos.addEventListener("click", () => cambiar(-opc.paso));
    mas.addEventListener("click", () => cambiar(opc.paso));
    ajustar.addEventListener("click", () => { estado.auto = true; aplicar(); });
    window.addEventListener("resize", () => { if (estado.auto) aplicar(); });
    aplicar();

    return {
      elemento: grupo,
      aplicar,
      get valor() { return estado.valor; },
      set valor(v) { estado.auto = false; estado.valor = redondear(limitar(Number(v) || 1, opc.min, opc.max)); aplicar(); },
      automatico() { estado.auto = true; aplicar(); }
    };
  }

  /* ==========================================================================
     TAMAÑO DE PÁGINA PARA IMPRIMIR (carta por defecto)
     ========================================================================== */
  function definirPagina(impresion) {
    const opc = Object.assign({ tamano: "letter", orientacion: "portrait", margen: "12mm 12mm 14mm" }, impresion);
    let estilo = document.getElementById("cu-estilo-pagina");
    if (!estilo) {
      estilo = document.createElement("style");
      estilo.id = "cu-estilo-pagina";
      document.head.appendChild(estilo);
    }
    estilo.textContent = `@page { size: ${opc.tamano} ${opc.orientacion}; margin: ${opc.margen}; }`;
  }

  /* ==========================================================================
     PANTALLA DE CARGA Y MENSAJES
     ========================================================================== */
  /** Muestra una pantalla de carga; devuelve una función que la cierra. */
  function cargando(titulo = "Cargando…", detalle = "") {
    const capa = crear("div", "cu-cargando",
      `<b>${util.esc(titulo)}</b>${detalle ? `<span>${util.esc(detalle)}</span>` : ""}`);
    capa.setAttribute("role", "status");
    document.body.appendChild(capa);
    return () => capa.remove();
  }

  /** Escribe un mensaje en un elemento; texto vacío lo oculta. */
  function mensaje(elemento, texto, tipo) {
    const el = typeof elemento === "string" ? document.querySelector(elemento) : elemento;
    if (!el) return;
    el.classList.add("cu-mensaje");
    el.classList.toggle("cu-mensaje--alerta", tipo === "alerta");
    el.textContent = texto || "";
    el.hidden = !texto;
  }

  /* ==========================================================================
     VERIFICACIÓN DE VERSIÓN
     ColegioUI.requiere("1.1") comprueba que la versión cargada sea 1.x y al
     menos 1.1. Si no lo es, muestra un aviso en pantalla y detiene el widget.
     ========================================================================== */
  function requiere(minima) {
    const [maj, min = 0] = String(minima).split(".").map(Number);
    const [vMaj, vMin] = VERSION.split(".").map(Number);
    if (vMaj === maj && vMin >= min) return true;
    const texto = `Este widget necesita colegio-ui ${maj}.${min} o posterior (versión ${maj}.x), ` +
      `pero se cargó la versión ${VERSION}. Revise la dirección de la biblioteca en el HTML.`;
    const aviso = crear("p", "cu-mensaje cu-mensaje--alerta");
    aviso.style.margin = "12px";
    aviso.textContent = texto;
    document.body.insertBefore(aviso, document.body.firstChild);
    throw new Error("ColegioUI: " + texto);
  }

  /* ==========================================================================
     INICIO
     ========================================================================== */
  function iniciar(config = {}) {
    const cfg = Object.assign({
      clave: "widget",
      contenedor: "#app",
      zoom: {},
      zoomEnContenedor: true,
      gris: false,
      impresion: {},
      filtros: [],
      acciones: [],
      imprimir: true
    }, config);

    document.body.classList.add("cu");
    if (cfg.acento) document.documentElement.style.setProperty("--cu-acento", cfg.acento);

    const contenedor = typeof cfg.contenedor === "string"
      ? document.querySelector(cfg.contenedor) : cfg.contenedor;
    if (contenedor) {
      contenedor.classList.add("cu-contenido");
      if (cfg.zoom !== false && cfg.zoomEnContenedor) contenedor.classList.add("cu-zoom");
    } else {
      console.warn(`ColegioUI: no se encontró el contenedor «${cfg.contenedor}».`);
    }

    definirPagina(cfg.impresion);

    // --- Barra superior ---------------------------------------------------
    const barra = crear("header", "cu-barra");
    const zonaFiltros = crear("div", "cu-filtros");
    const zonaHerr = crear("div", "cu-herramientas");
    barra.append(zonaFiltros, zonaHerr);

    const filtros = {};
    (cfg.filtros || []).forEach(def => {
      const f = crearFiltro(def, cfg.clave);
      if (!f) return;
      filtros[def.id] = f;
      zonaFiltros.appendChild(f.elemento);
    });

    let zoom = null;
    if (cfg.zoom !== false) {
      zoom = crearZoom(cfg.zoom, cfg.clave);
      zonaHerr.appendChild(zoom.elemento);
    }

    let gris = null;
    if (cfg.gris) {
      const opc = typeof cfg.gris === "object" ? cfg.gris : {};
      const lbl = crear("label", "cu-check");
      const inp = crear("input");
      inp.type = "checkbox";
      lbl.append(inp, document.createTextNode(" " + (opc.etiqueta || "Escala de grises")));
      inp.addEventListener("change", () => {
        document.documentElement.classList.toggle("cu-gris", inp.checked);
        if (typeof opc.alCambiar === "function") opc.alCambiar(inp.checked);
      });
      zonaHerr.appendChild(lbl);
      gris = {
        elemento: lbl,
        get valor() { return inp.checked; },
        set valor(v) { inp.checked = !!v; inp.dispatchEvent(new Event("change")); }
      };
    }

    const acciones = {};
    (cfg.acciones || []).forEach(a => {
      const b = boton(a.texto, a.primario ? "cu-boton--primario" : "", a.titulo);
      if (typeof a.alHacerClic === "function") b.addEventListener("click", a.alHacerClic);
      if (a.id) acciones[a.id] = b;
      zonaHerr.appendChild(b);
    });

    let botonImprimir = null;
    if (cfg.imprimir) {
      const opc = typeof cfg.imprimir === "object" ? cfg.imprimir : {};
      botonImprimir = boton(opc.texto || "Imprimir", "cu-boton--primario");
      botonImprimir.addEventListener("click", () => {
        if (typeof opc.alHacerClic === "function") opc.alHacerClic();
        else global.print();
      });
      zonaHerr.appendChild(botonImprimir);
    }

    if (!zonaFiltros.children.length && !zonaHerr.children.length) barra.hidden = true;
    document.body.insertBefore(barra, document.body.firstChild);

    return {
      version: VERSION,
      barra,
      zonaFiltros,          // para insertar filtros especiales del widget
      zonaHerramientas: zonaHerr,
      filtros,
      acciones,
      zoom,
      gris,
      botonImprimir,
      contenedor,
      /** Cambia el tamaño de página: { tamano, orientacion, margen }. */
      pagina: definirPagina,
      /** Muestra u oculta la barra completa. */
      mostrarBarra(visible = true) { barra.hidden = !visible; }
    };
  }

  /* ==========================================================================
     EXPORTACIÓN
     ========================================================================== */
  global.ColegioUI = { version: VERSION, iniciar, requiere, util, cargando, mensaje, preferencia: { leer: leerPref, guardar: guardarPref } };
})(window);
