// src/lib/politicas.ts
import type { SeccionTexto } from "../components/TextoSecciones"

/**
 * Políticas de uso y tratamiento de datos de una caja (HU022, §5.1 paso 2).
 *
 * La versión es la misma que la del backend (backend/utils/politicas.js): si el texto
 * cambia, se sube la versión en los dos lados y cada miembro vuelve a aceptarlas.
 * Alineado con HU022 del documento de TIC el 26 nov (T28).
 */
export const POLITICAS_VERSION = "2026-11-26"

export const POLITICAS: SeccionTexto[] = [
  {
    titulo: "Para qué existe DOMUS",
    parrafos: [
      "DOMUS lleva las cuentas de una caja de ahorro comunitaria: las fichas de los socios, sus cuentas de ahorro, los depósitos y retiros, los créditos con sus pagos y los reportes de cada ciclo.",
      "No es un banco: no guarda ni mueve dinero. Registra lo que la caja hace con su dinero, para que la directiva lleve las cuentas en orden y los socios puedan consultarlas.",
    ],
  },
  {
    titulo: "Qué puede hacer cada rol",
    parrafos: [
      "El rol es de cada caja: la misma cuenta puede ser coordinador en una caja y socio en otra. Cada rol puede todo lo del rol que le sigue.",
    ],
    puntos: [
      "Socio: consulta, sin modificarlos, sus cuentas de ahorro, sus créditos y sus solicitudes en esta caja.",
      "Tesorero: registra las fichas de socio, abre cuentas, registra depósitos, retiros, créditos y pagos, aprueba créditos, lleva los fondos de caja y genera los reportes.",
      "Coordinador: además configura la caja y su periodo, invita a los miembros, decide su rol y puede quitarlos.",
    ],
  },
  {
    titulo: "Qué conoce la administración del sistema",
    parrafos: [
      "Del ámbito de administración se conocen la existencia de la caja, su fecha de fundación, su ciclo vigente, el número de socios y el número de créditos registrados, además de las cuentas de usuario que entran a ella con su rol.",
      "Son conteos, no montos. Se usan para dimensionar los recursos del servidor, para restituir accesos perdidos y para bloquear una cuenta o una caja en caso de abuso.",
    ],
  },
  {
    titulo: "Lo que no sale de la caja",
    parrafos: [
      "Los montos (saldos, depósitos, retiros, créditos, pagos y fondos), las fichas de socio (nombres, cédulas, teléfonos y correos), los reportes y la distribución de intereses no salen de la caja: solo los ven sus miembros, cada uno según su rol. Ni la administración del sistema ni otra caja tienen acceso a ellos.",
      "Quien registra los datos de una persona se compromete a hacerlo con su consentimiento y a usarlos solo para las cuentas de la caja.",
    ],
  },
]
