// src/lib/confidencialidad.ts
import type { SeccionTexto } from "../components/TextoSecciones"

/**
 * Acuerdo de confidencialidad del panel de administración del sistema (HU021, HU-S03).
 *
 * La versión es la misma que la del backend (backend/utils/confidencialidad.js): si el
 * texto cambia, se sube la versión en los dos lados y cada administrador vuelve a aceptarlo.
 * BORRADOR: el texto debe coincidir con el documento de TIC; ver ESTADO.md.
 */
export const ACUERDO_VERSION = "2026-11-17"

export const ACUERDO: SeccionTexto[] = [
  {
    titulo: "Para qué es el panel",
    parrafos: [
      "El panel de administración sirve para dar soporte a las cajas que usan DOMUS y para bloquear una cuenta de usuario cuando se usa para abusar del sistema o de otras personas.",
    ],
  },
  {
    titulo: "Qué información vas a ver",
    parrafos: [
      "El nombre de cada caja, las cuentas de usuario que la usan con su estado, y cuántos socios y créditos tiene cada caja.",
      "El panel no muestra montos, saldos, movimientos ni los datos personales de los socios, y no da acceso a las cajas.",
    ],
  },
  {
    titulo: "A qué te comprometes",
    parrafos: [],
    puntos: [
      "Usar esta información solo para dar soporte y para proteger el sistema.",
      "No copiarla, compartirla ni comentarla con nadie fuera de la administración de DOMUS.",
      "No intentar ver los datos financieros o personales de una caja por otros medios.",
      "Bloquear una cuenta solo con un motivo real, y escribirlo: cada bloqueo y cada restablecimiento quedan en la bitácora con tu nombre, la fecha y el motivo.",
      "Avisar al resto de la administración si notas un acceso indebido o una fuga de información.",
    ],
  },
  {
    titulo: "Si no se cumple",
    parrafos: [
      "Quien incumpla este acuerdo deja de ser administrador de DOMUS, sin perjuicio de las responsabilidades legales por el tratamiento indebido de datos personales.",
    ],
  },
]
