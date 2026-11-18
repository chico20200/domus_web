/**
 * Un texto largo por secciones numeradas: políticas de uso (HU022) y acuerdo de
 * confidencialidad (HU021). Cada sección tiene un título, párrafos y, si hace falta, una
 * lista de puntos.
 */

export interface SeccionTexto {
  titulo: string
  parrafos: string[]
  puntos?: string[]
}

export function TextoSecciones({ secciones }: { secciones: SeccionTexto[] }) {
  return (
    <div className="flex flex-col gap-6">
      {secciones.map((s, i) => (
        <section key={s.titulo} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-primary">
            {i + 1}. {s.titulo}
          </h3>
          {s.parrafos.map((p) => (
            <p key={p} className="text-sm text-secondary">
              {p}
            </p>
          ))}
          {s.puntos && (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-secondary">
              {s.puntos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
