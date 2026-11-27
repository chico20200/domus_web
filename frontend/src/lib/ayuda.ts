// src/lib/ayuda.ts
import type { TextoAyuda } from "../components/InfoTip"

/**
 * Los once textos de ayuda de las especificaciones §8, uno por concepto, para `InfoTip`.
 *
 * BORRADOR: están escritos a partir de §8 y de lo que hace el código hoy. Deben coincidir
 * con el Marco Teórico del documento de TIC, que no está en el repositorio; ver ESTADO.md.
 * Cada texto se usa en todos los lugares donde aparece su concepto, así que corregirlo
 * aquí lo corrige en todas las pantallas.
 */

export type ConceptoAyuda =
  | "crearCaja"
  | "cicloCaja"
  | "codigoInvitacion"
  | "crearSocio"
  | "abrirCuenta"
  | "crearCredito"
  | "aprobarCredito"
  | "abonoPrepago"
  | "distribucionIntereses"
  | "estadoCuenta"
  | "rolMembresia"

export const AYUDA: Record<ConceptoAyuda, TextoAyuda> = {
  crearCaja: {
    titulo: "Crear una caja",
    que: "Una caja en DOMUS representa una organización real: la caja de ahorro de un barrio, una asociación o un grupo de familias. Sus datos quedan separados de los de cualquier otra caja.",
    pasa: "La caja se crea con su periodo y tú quedas como su coordinador: configuras la caja, invitas a los demás miembros y decides el rol de cada uno.",
    necesitas:
      "El nombre de la organización, para qué existe, su fecha de fundación y cada cuánto hace el corte de cuentas.",
  },
  cicloCaja: {
    titulo: "Ciclo de la caja",
    que: "Es el periodo entre dos cortes de cuentas. Si el ciclo dura 12 meses y empieza en abril, va de abril a marzo del año siguiente.",
    pasa: "Al cerrarse un ciclo se reparten entre los socios los intereses que pagaron los créditos durante ese periodo, y empieza el siguiente.",
    necesitas:
      "La fecha de fundación de la caja, que puede ser anterior a su registro en DOMUS, el mes en que empieza cada ciclo y cuántos meses dura.",
  },
  codigoInvitacion: {
    titulo: "Código de invitación",
    que: "Es la forma de entrar a una caja que ya existe. Lo genera el coordinador de esa caja desde su Configuración.",
    pasa: "Quien lo usa entra a la caja con el rol que el coordinador eligió al generarlo. El código sirve una sola vez y vence a los 7 días.",
    necesitas:
      "Para generarlo, ser coordinador de la caja. Para usarlo, tener una cuenta en DOMUS y el código que te dieron.",
  },
  crearSocio: {
    titulo: "Registrar un socio",
    que: "La ficha de socio es el registro contable de una persona dentro de la caja: a su nombre se abren las cuentas de ahorro y se otorgan los créditos.",
    pasa: "La registra el coordinador o el tesorero, porque no todos los socios tienen teléfono o computadora. Si el socio crea después una cuenta en DOMUS con el mismo correo, la ficha se vincula sola y puede ver sus ahorros.",
    necesitas:
      "Nombre, apellido, cédula y fecha de ingreso del socio. El correo es opcional y solo sirve para el vínculo.",
  },
  abrirCuenta: {
    titulo: "Abrir una cuenta de ahorro",
    que: "Es la libreta de un socio dentro de esta caja: en ella se registran sus depósitos y retiros y se lleva su saldo.",
    pasa: "La cuenta empieza con saldo cero y queda lista para registrar depósitos. Un socio puede tener más de una cuenta.",
    necesitas: "Que el socio tenga su ficha registrada en la caja.",
  },
  crearCredito: {
    titulo: "Solicitar un crédito",
    que: "Es un préstamo de la caja a uno de sus socios. Solo se otorga entre socios de la misma caja, con el dinero que ahorran todos.",
    pasa: "La solicitud queda pendiente hasta que se apruebe. El plazo es el número de meses para devolverlo: el monto con su interés se divide en cuotas mensuales iguales, cada una con una parte de capital y una de interés. Esa es la tabla de amortización.",
    necesitas:
      "La ficha del socio, el monto, la tasa de interés anual que cobra la caja y el plazo en meses.",
  },
  aprobarCredito: {
    titulo: "Aprobar un crédito",
    que: "Es el paso que convierte la solicitud en un préstamo entregado.",
    pasa: "Se registra el desembolso con la fecha de hoy y se fijan las fechas de las cuotas: cada una vence el último día de su mes. Desde ese momento el crédito no se puede editar.",
    necesitas: "Revisar el monto, la tasa y el plazo, y tener el dinero para entregarlo al socio.",
  },
  abonoPrepago: {
    titulo: "Formas de pago",
    que: "Cada cuota tiene una parte de capital, que devuelve lo prestado, y una de interés, que es lo que gana la caja.",
    pasa: "El pago completo cubre las dos partes de la cuota. Solo interés deja el capital pendiente y solo capital deja el interés pendiente: la cuota no queda pagada hasta cubrir ambas. El pago adelantado entrega capital de más: se aplica desde la última cuota hacia atrás, y las cuotas que cubre enteras ya no cobran interés.",
    necesitas: "Que el crédito esté aprobado y tenga cuotas por pagar.",
  },
  distribucionIntereses: {
    titulo: "Distribución de intereses",
    que: "Es el reparto entre los socios de los intereses que la caja cobró por sus créditos. El coordinador elige en Configuración cómo se reparte cada ciclo: distribución equitativa o diferenciada.",
    pasa: "Equitativa: el interés de cada mes se divide en partes iguales entre los socios activos de ese mes. Diferenciada: cada mes el interés se divide para el ahorro total de la caja, y a cada socio le corresponde esa tasa sobre su saldo. En los dos, cada socio recibe su parte redondeada hacia abajo al centavo; los centavos que sobran se pasan a Fondos de caja cuando el ciclo cierra.",
    necesitas:
      "El periodo de la caja configurado, y depósitos y pagos de interés registrados en el ciclo.",
  },
  estadoCuenta: {
    titulo: "Estado de la cuenta",
    que: "Es la situación de tu cuenta de usuario en DOMUS, distinta de las cuentas de ahorro.",
    pasa: "Pendiente: falta confirmar el correo. Activa: perteneces al menos a una caja. Inactiva: aún no perteneces a ninguna caja o saliste de todas. Bloqueada: la administración de DOMUS la deshabilitó y el motivo se muestra junto al estado.",
    necesitas:
      "Para activarla, confirmar tu correo y crear una caja o unirte a una. Si está bloqueada, escribir a la administración de DOMUS.",
  },
  rolMembresia: {
    titulo: "Rol y membresía",
    que: "Ser miembro de una caja es tener acceso a ella. El rol dice qué puedes hacer ahí: socio consulta sus ahorros, créditos y solicitudes sin modificarlos, tesorero registra la operación y coordinador además configura la caja.",
    pasa: "El rol es de cada caja: la misma cuenta puede ser coordinador en una caja y socio en otra. Lo asigna el coordinador con el código de invitación y puede cambiarlo después.",
    necesitas: "Un código de invitación, o crear la caja, que te deja como coordinador.",
  },
}
