// src/lib/importacion/enviar.ts
import type { Datos } from "./validar"

/**
 * Las filas revisadas, como las recibe importar_excel (migración 016). Van la cédula y el
 * nombre del fondo, no los id: la base vuelve a buscar cada cosa y a revisar todo.
 */
export function filasParaImportar(datos: Datos): unknown[] {
  switch (datos.modulo) {
    case "socios":
      return datos.socios.map((s) => ({
        fila: s.fila,
        cedula: s.cedula,
        nombre: s.nombre,
        apellido: s.apellido,
        fecha_ingreso: s.fecha_ingreso,
        telefono: s.telefono,
        email: s.email,
        direccion: s.direccion,
      }))
    case "ahorros":
      return datos.movimientos.map((m) => ({
        fila: m.fila,
        cedula: m.cedula,
        fecha: m.fecha,
        tipo: m.tipo,
        monto: m.monto,
        descripcion: m.descripcion,
      }))
    case "fondos":
      return datos.movimientos.map((m) => ({
        fila: m.fila,
        fondo: m.fondo,
        fecha: m.fecha,
        tipo: m.tipo,
        monto: m.monto,
        descripcion: m.descripcion,
      }))
    case "creditos":
      return datos.creditos.map((c) => ({
        fila: c.fila,
        referencia: c.referencia,
        cedula: c.cedula,
        monto: c.monto,
        tasa_interes: c.tasa_interes,
        plazo_meses: c.plazo_meses,
        fecha_desembolso: c.fecha_desembolso,
        pagos: c.pagos.map((p) => ({
          fila: p.fila,
          fecha: p.fecha,
          capital: p.capital,
          interes: p.interes,
        })),
      }))
  }
}
