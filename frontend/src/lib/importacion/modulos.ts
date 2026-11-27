// src/lib/importacion/modulos.ts
/**
 * Qué se importa desde Excel en cada módulo (bloque F). Una sola definición sirve para
 * armar la plantilla (T20) y para leer el archivo lleno (T21): los encabezados, el orden
 * de las columnas y sus reglas salen de aquí.
 *
 * Reglas comunes, decididas con el usuario:
 * - Se importa de todos los ciclos; cada fila cae en su ciclo por su fecha.
 * - La fecha es obligatoria. Si no se sabe, se pone una aproximada para que los cálculos
 *   salgan realistas.
 * - Los créditos entran tal como se pagaron: cada pago con su capital y su interés reales.
 * - Se importa todo el archivo o nada.
 */

export type ModuloImportacion = "socios" | "ahorros" | "creditos" | "fondos"

export type TipoColumna =
  | "texto"
  | "cedula" // texto de 10 dígitos; la plantilla la guarda como texto para no perder el 0
  | "fecha"
  | "monto" // mayor que 0, hasta dos decimales
  | "monto0" // como monto, pero acepta 0 (el interés de un pago)
  | "entero"
  | "porcentaje"
  | "lista"

export interface Columna {
  /** Nombre en la base o en el cuerpo de la importación */
  clave: string
  /** Encabezado en la hoja: lo que escribe y lee la persona */
  encabezado: string
  tipo: TipoColumna
  obligatoria: boolean
  /** Para tipo lista: los valores que acepta, como se escriben en la hoja */
  opciones?: string[]
  /** Explicación para la hoja de instrucciones */
  ayuda: string
  /** Un valor de ejemplo para la hoja de instrucciones (nunca en la hoja de datos) */
  ejemplo: string
  /** Ancho de la columna en la hoja, en caracteres */
  ancho: number
}

export interface Hoja {
  nombre: string
  /** Una línea sobre qué va en esta hoja: una fila por… */
  fila: string
  columnas: Columna[]
}

export interface DefinicionModulo {
  modulo: ModuloImportacion
  titulo: string
  /** Nombre del archivo de la plantilla, sin extensión */
  archivo: string
  /** Para qué es, en una o dos frases, arriba de las instrucciones */
  resumen: string
  hojas: Hoja[]
  /** Reglas del módulo, una por línea, para las instrucciones */
  reglas: string[]
}

const TIPOS_MOVIMIENTO = ["Depósito", "Retiro"]

const cedula: Columna = {
  clave: "cedula",
  encabezado: "Cédula",
  tipo: "cedula",
  obligatoria: true,
  ayuda:
    "Cédula del socio, 10 dígitos. Debe estar registrado en la caja o venir en la importación de Socios.",
  ejemplo: "0102030405",
  ancho: 14,
}

const fecha = (encabezado: string, ayuda: string): Columna => ({
  clave: "fecha",
  encabezado,
  tipo: "fecha",
  obligatoria: true,
  ayuda: `${ayuda} Formato día/mes/año. Si no la sabes, pon una aproximada.`,
  ejemplo: "15/03/2024",
  ancho: 14,
})

const tipoMovimiento: Columna = {
  clave: "tipo",
  encabezado: "Tipo",
  tipo: "lista",
  obligatoria: true,
  opciones: TIPOS_MOVIMIENTO,
  ayuda: "Depósito o Retiro. Elígelo de la lista.",
  ejemplo: "Depósito",
  ancho: 12,
}

const monto: Columna = {
  clave: "monto",
  encabezado: "Monto",
  tipo: "monto",
  obligatoria: true,
  ayuda: "En dólares, mayor que 0, con hasta dos decimales. Sin el signo $.",
  ejemplo: "25,00",
  ancho: 12,
}

export const MODULOS: Record<ModuloImportacion, DefinicionModulo> = {
  socios: {
    modulo: "socios",
    titulo: "Socios",
    archivo: "domus-plantilla-socios",
    resumen: "Registra de una vez a los socios de la caja con su fecha de ingreso.",
    hojas: [
      {
        nombre: "Socios",
        fila: "Una fila por socio.",
        columnas: [
          cedula,
          {
            clave: "nombre",
            encabezado: "Nombres",
            tipo: "texto",
            obligatoria: true,
            ayuda: "Nombres del socio.",
            ejemplo: "María José",
            ancho: 20,
          },
          {
            clave: "apellido",
            encabezado: "Apellidos",
            tipo: "texto",
            obligatoria: true,
            ayuda: "Apellidos del socio.",
            ejemplo: "Pérez López",
            ancho: 20,
          },
          {
            ...fecha(
              "Fecha de ingreso",
              "Día en que entró a la caja. Decide en qué ciclos participa.",
            ),
            clave: "fecha_ingreso",
          },
          {
            clave: "telefono",
            encabezado: "Teléfono",
            tipo: "texto",
            obligatoria: false,
            ayuda: "Opcional. Celular de 10 dígitos.",
            ejemplo: "0991234567",
            ancho: 14,
          },
          {
            clave: "email",
            encabezado: "Correo",
            tipo: "texto",
            obligatoria: false,
            ayuda: "Opcional.",
            ejemplo: "maria@ejemplo.com",
            ancho: 26,
          },
          {
            clave: "direccion",
            encabezado: "Dirección",
            tipo: "texto",
            obligatoria: false,
            ayuda: "Opcional.",
            ejemplo: "Barrio La Merced, calle 3",
            ancho: 30,
          },
        ],
      },
    ],
    reglas: [
      "La cédula no se puede repetir, ni en el archivo ni con un socio que ya esté en la caja.",
      "La fecha de ingreso no puede ser anterior a la fundación de la caja ni posterior a hoy.",
    ],
  },

  ahorros: {
    modulo: "ahorros",
    titulo: "Ahorros",
    archivo: "domus-plantilla-ahorros",
    resumen: "Carga los depósitos y retiros de ahorro de cada socio, con su fecha.",
    hojas: [
      {
        nombre: "Movimientos",
        fila: "Una fila por depósito o retiro.",
        columnas: [
          cedula,
          fecha("Fecha", "Día del depósito o del retiro."),
          tipoMovimiento,
          monto,
          {
            clave: "descripcion",
            encabezado: "Descripción",
            tipo: "texto",
            obligatoria: false,
            ayuda: "Opcional.",
            ejemplo: "Ahorro de marzo",
            ancho: 30,
          },
        ],
      },
    ],
    reglas: [
      "Si el socio no tiene cuenta de ahorro, se le abre una con la fecha de su primer movimiento.",
      "Los movimientos se ordenan por fecha. Un retiro no puede dejar la cuenta en negativo en ningún momento.",
      "Si la cuenta ya tiene movimientos en DOMUS, los del archivo no pueden ser de fechas anteriores al último.",
      "La fecha no puede ser anterior al ingreso del socio ni posterior a hoy.",
    ],
  },

  creditos: {
    modulo: "creditos",
    titulo: "Créditos y pagos",
    archivo: "domus-plantilla-creditos",
    resumen:
      "Carga los créditos ya desembolsados y sus pagos, tal como se pagaron: cada pago con su capital y su interés reales.",
    hojas: [
      {
        nombre: "Créditos",
        fila: "Una fila por crédito desembolsado.",
        columnas: [
          {
            clave: "referencia",
            encabezado: "N.º",
            tipo: "entero",
            obligatoria: true,
            ayuda:
              "Un número para unir el crédito con sus pagos en la hoja Pagos. Solo vale en este archivo: DOMUS le da al crédito su propio número.",
            ejemplo: "1",
            ancho: 8,
          },
          cedula,
          {
            ...monto,
            encabezado: "Monto prestado",
            ayuda: "Capital entregado al socio, en dólares, con hasta dos decimales.",
            ejemplo: "500,00",
            ancho: 16,
          },
          {
            clave: "tasa_interes",
            encabezado: "Tasa anual (%)",
            tipo: "porcentaje",
            obligatoria: true,
            ayuda:
              "Interés anual en porcentaje, de 0,01 a 100, con hasta dos decimales. Por ejemplo, 12 es el 12 % al año.",
            ejemplo: "12",
            ancho: 15,
          },
          {
            clave: "plazo_meses",
            encabezado: "Plazo (meses)",
            tipo: "entero",
            obligatoria: true,
            ayuda: "Número de cuotas mensuales, de 1 a 120.",
            ejemplo: "6",
            ancho: 14,
          },
          {
            ...fecha("Fecha de desembolso", "Día en que se entregó el dinero."),
            clave: "fecha_desembolso",
            ancho: 20,
          },
        ],
      },
      {
        nombre: "Pagos",
        fila: "Una fila por pago recibido.",
        columnas: [
          {
            clave: "referencia",
            encabezado: "N.º del crédito",
            tipo: "entero",
            obligatoria: true,
            ayuda: "El N.º que tiene el crédito en la hoja Créditos.",
            ejemplo: "1",
            ancho: 16,
          },
          fecha("Fecha", "Día del pago."),
          {
            ...monto,
            tipo: "monto0",
            clave: "capital",
            encabezado: "Capital",
            ayuda:
              "Parte del pago que fue a capital, en dólares. Puede ser 0 si solo se pagó interés.",
            ejemplo: "83,33",
          },
          {
            ...monto,
            tipo: "monto0",
            clave: "interes",
            encabezado: "Interés",
            ayuda: "Parte del pago que fue a interés, en dólares. Puede ser 0.",
            ejemplo: "5,00",
          },
        ],
      },
    ],
    reglas: [
      "Solo se importan créditos ya entregados. Las solicitudes nuevas se hacen en DOMUS.",
      "El capital pagado no puede superar el monto prestado. Si llega al monto, el crédito queda pagado.",
      "Si queda capital por pagar, el crédito sigue activo y lo que falta se cobra con la fórmula de DOMUS.",
      "El interés se toma como se cobró, aunque no coincida con la fórmula de DOMUS.",
      "La fecha de cada pago no puede ser anterior al desembolso de su crédito ni posterior a hoy.",
      "Cada pago debe tener capital o interés mayor que 0.",
    ],
  },

  fondos: {
    modulo: "fondos",
    titulo: "Fondos de caja",
    archivo: "domus-plantilla-fondos",
    resumen: "Carga los depósitos y retiros de los fondos de la caja, con su fecha.",
    hojas: [
      {
        nombre: "Movimientos",
        fila: "Una fila por depósito o retiro.",
        columnas: [
          {
            clave: "fondo",
            encabezado: "Fondo",
            tipo: "texto",
            obligatoria: true,
            ayuda: "Nombre del fondo, de 3 a 60 caracteres. Si no existe en DOMUS, se crea.",
            ejemplo: "Fondo social",
            ancho: 22,
          },
          fecha("Fecha", "Día del depósito o del retiro."),
          tipoMovimiento,
          monto,
          {
            clave: "descripcion",
            encabezado: "Descripción",
            tipo: "texto",
            obligatoria: true,
            ayuda: "De dónde viene o en qué se usó el dinero, de 3 a 200 caracteres.",
            ejemplo: "Rifa de noviembre",
            ancho: 32,
          },
        ],
      },
    ],
    reglas: [
      "Los movimientos se ordenan por fecha. Un retiro no puede dejar el fondo en negativo en ningún momento.",
      "Si el fondo ya tiene movimientos en DOMUS, los del archivo no pueden ser de fechas anteriores al último.",
      "Un fondo cerrado no recibe movimientos: ábrelo de nuevo antes de importar.",
      "La fecha no puede ser anterior a la fundación de la caja ni posterior a hoy.",
    ],
  },
}
