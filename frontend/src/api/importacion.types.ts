// src/api/importacion.types.ts
// Respuesta de POST /cajas/:cajaId/importar/:modulo (T22). Con simular la base hace la
// importación y la deshace: son los números que quedarían de verdad.

export interface CuentaImportada {
  socio: string
  numero_cuenta: string
  nueva: boolean
  movimientos: number
  saldo_antes: number
  saldo_despues: number
}

export interface FondoImportado {
  fondo: string
  nuevo: boolean
  movimientos: number
  saldo_antes: number
  saldo_despues: number
}

export interface CreditoImportadoResultado {
  /** El N.º del archivo */
  referencia: number
  /** El número que DOMUS le da */
  numero: number
  socio: string
  monto: number
  estado: "activo" | "pagado"
  pagos: number
  capital_pagado: number
  interes_pagado: number
  interes_condonado: number
  saldo_pendiente: number
}

export type ResultadoImportacion = { simulado: boolean } & (
  | { socios: number }
  | { cuentas: CuentaImportada[] }
  | { fondos: FondoImportado[] }
  | { creditos: CreditoImportadoResultado[] }
)
