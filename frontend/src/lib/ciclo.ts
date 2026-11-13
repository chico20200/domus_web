// src/lib/ciclo.ts
// Opciones del periodo de una caja, comunes a Configuración y al asistente de creación.
import type { SelectOption } from "../components/SelectField"

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

export const OPCIONES_MES: SelectOption[] = MESES.map((nombre, i) => ({
  value: String(i + 1),
  label: nombre,
}))

export const DURACIONES: SelectOption[] = [
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses (un año)" },
  { value: "24", label: "24 meses (dos años)" },
]

/** Textos de ayuda de los tres campos del periodo (§8, "Ciclo de la caja") */
export const AYUDA_CICLO = {
  fundacion: "Puede ser anterior a la fecha en que la caja se registró en DOMUS.",
  mesInicio: "Si eliges abril, cada ciclo va de abril a marzo del año siguiente.",
  duracion:
    "Es el tiempo entre dos cortes de cuentas. Al cerrarse un ciclo se reparten los intereses entre los socios.",
}
