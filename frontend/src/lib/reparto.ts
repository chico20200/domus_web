// src/lib/reparto.ts
import type { TipoReparto } from "../api/ciclos.types"

/** Nombre y explicación de cada tipo, con las palabras de las especificaciones */
export const TIPO_REPARTO: Record<TipoReparto, { etiqueta: string; explicacion: string }> = {
  equitativa: {
    etiqueta: "Distribución equitativa",
    explicacion:
      "El interés de cada mes se divide en partes iguales entre los socios activos de ese mes. Quien entra a mitad del ciclo recibe desde el mes en que ingresó.",
  },
  diferenciada: {
    etiqueta: "Distribución diferenciada",
    explicacion:
      "El interés de cada mes se reparte según el ahorro de cada socio: más ahorro y por más tiempo, más interés.",
  },
}
