import { Button } from "./Button"
import { Modal } from "./Modal"

/**
 * Confirmación antes de una acción (especificaciones §3, ConfirmDialog).
 *
 * Las páginas no lo montan: llaman a `confirm()` de `useNotif()`, que lo abre y devuelve
 * una promesa con la respuesta.
 *
 *   const ok = await confirm({ titulo: "¿Remover miembro?",
 *     mensaje: "Perderá el acceso a esta caja.", labelOk: "Remover", peligroso: true })
 *
 * - Va sobre Modal: Escape, clic afuera y el botón Cerrar cuentan como "no".
 * - Al abrir, el foco queda en Cerrar, no en el botón que confirma: un Enter por inercia
 *   no ejecuta la acción.
 * - `peligroso` pinta el botón como destructive (HT02: el rojo solo en lo que borra o
 *   desactiva). Si no, es primary. Cancelar es ghost.
 */

export interface ConfirmOpts {
  titulo: string
  mensaje?: string
  labelOk?: string
  labelCancel?: string
  /** La acción borra o desactiva */
  peligroso?: boolean
}

interface ConfirmDialogProps extends ConfirmOpts {
  abierto: boolean
  onResponder: (ok: boolean) => void
}

export function ConfirmDialog({
  abierto,
  titulo,
  mensaje,
  labelOk = "Confirmar",
  labelCancel = "Cancelar",
  peligroso = false,
  onResponder,
}: ConfirmDialogProps) {
  return (
    <Modal
      abierto={abierto}
      onCerrar={() => onResponder(false)}
      titulo={titulo}
      descripcion={mensaje}
      acciones={
        <>
          <Button label={labelCancel} variant="ghost" onClick={() => onResponder(false)} />
          <Button
            label={labelOk}
            variant={peligroso ? "destructive" : "primary"}
            onClick={() => onResponder(true)}
          />
        </>
      }
    />
  )
}
