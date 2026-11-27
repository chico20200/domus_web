// src/lib/confidencialidad.ts
import type { SeccionTexto } from "../components/TextoSecciones"

/**
 * Acuerdo de confidencialidad del panel de administración del sistema (HU021, HU-S03).
 *
 * La versión es la misma que la del backend (backend/utils/confidencialidad.js): si el
 * texto cambia, se sube la versión en los dos lados y cada administrador vuelve a aceptarlo.
 * Alineado con HU021 del documento de TIC el 26 nov (T28).
 */
export const ACUERDO_VERSION = "2026-11-26"

export const ACUERDO: SeccionTexto[] = [
  {
    titulo: "Para qué es el panel",
    parrafos: [
      "El panel de administración sirve para dar soporte a las cajas que usan DOMUS, dimensionar los recursos del servidor, restituir accesos perdidos y bloquear una cuenta de usuario o una caja cuando se usa para abusar del sistema o de otras personas.",
    ],
  },
  {
    titulo: "Qué información alcanzas",
    parrafos: [
      "De cada caja: su nombre, su estado, su fecha de fundación, su ciclo vigente y cuántos miembros, socios y créditos tiene. De cada cuenta de usuario: su correo, su estado y las cajas en las que participa, con su rol.",
    ],
  },
  {
    titulo: "Qué información no alcanzas",
    parrafos: [
      "No accedes a los montos de ahorros, créditos, pagos ni saldos, ni a las fichas de socio ni a los reportes de ninguna caja. El panel solo muestra conteos y no da acceso a las cajas.",
    ],
  },
  {
    titulo: "A qué te comprometes",
    parrafos: [],
    puntos: [
      "Usar esta información solo para dar soporte y para proteger el sistema.",
      "No divulgarla ni usarla fuera del sistema: no copiarla, compartirla ni comentarla con nadie fuera de la administración de DOMUS.",
      "No intentar ver los datos financieros o personales de una caja por otros medios.",
      "Bloquear una cuenta o una caja solo con un motivo real, y escribirlo: cada bloqueo y cada restablecimiento quedan en la bitácora con tu correo, la fecha y el motivo. Tu aceptación de este acuerdo también queda en ella, con su fecha y su versión.",
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
