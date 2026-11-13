// src/lib/politicas.ts

/**
 * Políticas de uso y tratamiento de datos de una caja (HU022, §5.1 paso 2).
 *
 * La versión es la misma que la del backend (backend/utils/politicas.js): si el texto
 * cambia, se sube la versión en los dos lados y cada miembro vuelve a aceptarlas.
 * BORRADOR: el texto debe coincidir con el documento de TIC; ver ESTADO.md.
 */
export const POLITICAS_VERSION = "2026-11-13"

export interface SeccionPolitica {
  titulo: string
  parrafos: string[]
  puntos?: string[]
}

export const POLITICAS: SeccionPolitica[] = [
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
      "Socio: consulta sus cuentas de ahorro en esta caja.",
      "Tesorero: registra las fichas de socio, abre cuentas, registra depósitos, retiros, créditos y pagos, aprueba créditos y genera los reportes.",
      "Coordinador: además configura la caja y su periodo, invita a los miembros, decide su rol y puede quitarlos.",
    ],
  },
  {
    titulo: "Qué conoce la administración del sistema",
    parrafos: [
      "Quienes administran DOMUS ven el nombre de cada caja, las cuentas de usuario que la usan y cuántos socios y créditos tiene. Lo necesitan para dar soporte y para bloquear una cuenta en caso de abuso.",
      "No ven montos, saldos, movimientos ni los datos personales de los socios.",
    ],
  },
  {
    titulo: "Lo que no sale de la caja",
    parrafos: [
      "Las fichas de los socios (nombres, cédulas, teléfonos y correos), los saldos, los movimientos, los créditos y los pagos solo los ven los miembros de esta caja, cada uno según su rol. Ninguna otra caja tiene acceso a ellos.",
      "Quien registra los datos de una persona se compromete a hacerlo con su consentimiento y a usarlos solo para las cuentas de la caja.",
    ],
  },
]
