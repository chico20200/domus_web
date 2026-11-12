# DOMUS Web

- El plan de trabajo está en docs/ESPECIFICACIONES.md. Es la fuente de verdad.
- Si una skill sugiere algo que contradice las especificaciones
  (colores, escalas, nombres de variantes, nomenclatura de roles), mandan las especificaciones.
- Se trabaja una etapa a la vez (sección 12). No adelantar etapas.
- Al terminar cada tarea: compilar, correr lint y hacer commit local en la rama de la etapa.
- Cada vez que se termine una tarea, se tome una decisión o se encuentre un problema,
  actualizar ESTADO.md (tabla de tareas, decisiones, hallazgos y una línea en la bitácora).
- Antes de buscar en el código, consultar graphify-out/GRAPH_REPORT.md.

## Git

- Cada etapa se trabaja en su propia rama (`etapa-N`). Ahí se hacen todos los commits
  locales que hagan falta, al menos uno por tarea.
- Nunca hacer commits directamente en `main`.
- Nunca hacer `git push` ni nada que suba cambios a GitHub. El push lo hace el usuario.
- Fusionar una rama de etapa en `main` (`--no-ff`) solo cuando el usuario lo pida.
