// src/lib/importacion/contexto.ts
import { ciclosService } from "../../api/ciclos.service"
import { sociosService } from "../../api/socios.service"
import { ahorrosService } from "../../api/ahorros.service"
import { fondosService } from "../../api/fondos.service"
import { hoyISO } from "../format"
import type { ModuloImportacion } from "./modulos"
import type { Contexto } from "./validar"

/** Lo que hace falta saber de la caja para validar un archivo de un módulo (T21) */
export async function cargarContexto(cajaId: string, modulo: ModuloImportacion): Promise<Contexto> {
  const [ciclos, socios, cuentas, fondos] = await Promise.all([
    ciclosService.getCiclos(cajaId),
    sociosService.getSocios(cajaId),
    modulo === "ahorros" ? ahorrosService.getCuentas(cajaId) : null,
    modulo === "fondos" ? fondosService.getFondos(cajaId) : null,
  ])
  return {
    hoy: hoyISO(),
    fundacion: ciclos.configurado ? (ciclos.config?.fecha_fundacion ?? null) : null,
    ciclos: ciclos.ciclos.map(({ numero, inicio, fin, cerrado }) => ({
      numero,
      inicio,
      fin,
      cerrado,
    })),
    socios: socios.socios.map(({ id, cedula, nombre, apellido, fecha_ingreso, activo }) => ({
      id,
      cedula,
      nombre,
      apellido,
      fecha_ingreso,
      activo,
    })),
    cuentas: cuentas?.cuentas.map(({ id, socio_id, saldo, estado }) => ({
      id,
      socio_id,
      saldo: Number(saldo),
      estado,
    })),
    fondos: fondos?.fondos.map(({ id, nombre, saldo, activo }) => ({
      id,
      nombre,
      saldo: Number(saldo),
      activo,
    })),
  }
}
