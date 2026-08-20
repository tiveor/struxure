# Struxure

[![CI](https://github.com/tiveor/struxure/actions/workflows/ci.yml/badge.svg)](https://github.com/tiveor/struxure/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Motor de Analisis Estructural por Elementos Finitos (FEA) 3D con diseno integrado, ejecutado 100% en el navegador.

Struxure permite modelar, analizar y verificar estructuras tipo barra (vigas, columnas, diagonales, armaduras) sin necesidad de backend ni instalacion de software.

> **Solo para uso educativo y de anteproyecto.** Los resultados de Struxure no
> están verificados de forma independiente y no sustituyen la revisión de un
> ingeniero profesional colegiado. Se entrega sin garantía de ningún tipo —
> consulta [LICENSE](LICENSE) y [NOTICE](NOTICE).

[Read in English](README.md)

## Caracteristicas

### Modelado
- **Modelado 3D interactivo** — Crea y edita nodos, elementos, apoyos y cargas con visualizacion en tiempo real via Three.js
- **Soporte multi-material** — Acero (A992) y concreto con propiedades completas
- **Biblioteca de secciones AISC** — Base de datos de secciones W, HSS y Pipe con propiedades auto-completadas
- **8 plantillas integradas** — Viga simple, voladizo, portico, cercha Warren, arco parabolico, edificio 3D, Torre Eiffel (lattice 3D de 88 elementos) y Cristo de la Concordia (marco de estatua de 35 nodos con brazos)
- **Importacion DXF** — Arrastra archivos `.dxf` de AutoCAD para importar geometria
- **Importacion IFC (BIM)** — Arrastra archivos `.ifc` con estrategia dual: modelo analitico preferido, elementos fisicos como respaldo

### Analisis
- **Analisis estatico lineal** — Metodo directo de rigidez con elementos frame 3D (matriz 12x12)
- **Solver en Web Worker** — Analisis no-bloqueante en hilo secundario con indicador de progreso
- **Operaciones cancelables** — Cancela analisis largos en cualquier momento

### Visualizacion
- **Diagramas de fuerza 3D** — Momento (M3), cortante (V2) y axial (N) como cintas 3D con escala ajustable
- **Mapas de calor** — Elementos coloreados por ratio D/C, desplazamiento, esfuerzo axial o esfuerzo combinado (esquemas Jet, Thermal, Blue-Red)
- **Forma deformada animada** — Modos de animacion: oscilar, pulso o progresivo con control de velocidad
- **Renderizado 3D de secciones** — Alterna entre vista de alambres y secciones 3D extruidas
- **Controles de viewport** — Orbitar, panear, zoom extents y toggle de grilla

### Verificacion de Diseno
- **AISC 360 (Acero)** — Tension (Cap. D), Compresion (Cap. E), Flexion (Cap. F), Interaccion P-M (Cap. H)
- **ACI 318 (Concreto)** — Flexion en vigas (Whitney), Cortante (Vc + Vs), Columnas (diagrama P-M simplificado)
- **Visualizacion ratio D/C** — Elementos coloreados por demanda/capacidad

### Exportacion
- **JSON** — Guarda y recarga modelos estructurales completos
- **CSV** — Exporta resultados de analisis (desplazamientos, reacciones, fuerzas internas)
- **Reportes PDF** — Reportes profesionales con portada, info del proyecto, tablas, captura de pantalla y verificaciones de diseno coloreadas
- **Exportacion IFC** — Exporta modelo + resultados a formato IFC4 con IfcStructuralAnalysisModel, condiciones de borde y reacciones

## Plantillas Integradas

| Plantilla | Tipo | Descripcion |
|-----------|------|-------------|
| Simple Beam | 2D | Viga simplemente apoyada con carga central |
| Cantilever | 2D | Viga en voladizo con carga en punta |
| Portal Frame | 2D | Portico de 3 bahias y 2 pisos |
| Truss Bridge | 2D | Cercha Warren con diagonales |
| Parabolic Arch | 2D | Arco parabolico bi-articulado bajo gravedad |
| 3D Building | 3D | Marco espacial 2x2 bahias, 3 pisos con viento |
| **Eiffel Tower** | 3D | Torre lattice de 25 nodos y 88 elementos con X-bracing |
| **Cristo de la Concordia** | 3D | Marco de estatua de 35 nodos con brazos — Cochabamba, Bolivia |

## Stack

| Capa | Tecnologia |
|---|---|
| UI | React 19 + TypeScript |
| Bundler | Vite 7 |
| Estilos | Tailwind CSS 4 |
| 3D | Three.js + React Three Fiber + Drei |
| Motor FEA | TypeScript puro (hilo principal + Web Worker) |
| Algebra lineal | ml-matrix |
| Estado | Zustand |
| PDF | jsPDF + jspdf-autotable |
| BIM/IFC | web-ifc (C++ WASM) |
| Persistencia | IndexedDB (idb) |
| Analítica | Umami, opcional vía `VITE_UMAMI_ID` (respeta la privacidad, sin cookies) |

## Inicio rapido

```bash
pnpm install
pnpm dev
```

Abre `http://localhost:5173/struxure/` en tu navegador (Vite sirve la app bajo la ruta base `/struxure/` configurada en `vite.config.ts`).

Para una guia paso a paso de como crear tu primer modelo, consulta la [Guia de inicio rapido](docs/quick-start.md).

## Scripts disponibles

```bash
pnpm dev          # Servidor de desarrollo
pnpm build        # Build de produccion
pnpm typecheck    # Verificacion de tipos con tsc
pnpm test         # Ejecutar tests
pnpm test:watch   # Tests en modo watch
pnpm lint         # Linting con ESLint
pnpm preview      # Preview del build
pnpm deploy       # Build y deploy a GitHub Pages
```

## Arquitectura

```
src/
├── core/           # Motor FEA (sin dependencias de UI)
│   ├── local-stiffness.ts      # Matriz de rigidez local 12x12
│   ├── transformation.ts       # Transformacion de coordenadas 3D
│   ├── assembler.ts            # Ensamblaje de rigidez global
│   ├── boundary-conditions.ts  # Condiciones de borde
│   ├── solver.ts               # Resolucion K·u = F
│   ├── solver.worker.ts        # Web Worker para analisis no-bloqueante
│   ├── solver-manager.ts       # Inicia el Web Worker del solver; sin fallback propio (ver docs/ARCHITECTURE.md)
│   └── post-processor.ts       # Fuerzas internas y reacciones
├── data/           # Base de datos de secciones AISC
├── design/         # Verificacion de diseno
│   ├── aisc360/    # Acero: tension, compresion, flexion, combinada
│   └── aci318/     # Concreto: flexion, cortante, columnas
├── components/     # UI React
│   ├── viewport/   # Visualizacion 3D (meshes, diagramas, heatmaps)
│   ├── panels/     # Editores de modelo (nodos, elementos, materiales, secciones)
│   ├── shared/     # Dialogos (reporte, importacion IFC, progreso de analisis)
│   ├── layout/     # Sidebar, toolbar, status bar, results bar
│   ├── chat/       # Barra lateral del asistente de IA (LM Studio local o modelo en linea)
│   └── mobile/     # Visor movil y aviso de instalacion
├── store/          # Estado global (Zustand)
└── utils/          # Plantillas, exportacion, importacion DXF/IFC, color ramp, animacion
```

## Analítica

Struxure se distribuye **sin analítica habilitada**. No se envía nada desde un fork, una instancia autoalojada o un entorno de desarrollo local.

El despliegue del mantenedor en [alvarotech.dev/struxure](https://alvarotech.dev/struxure/) define `VITE_UMAMI_ID` en su entorno de compilación para habilitar [Umami](https://umami.is/) — respetuoso de la privacidad y sin cookies, sin datos personales, conforme al RGPD.

Podés habilitarlo en tu propio despliegue definiendo `VITE_UMAMI_ID` (ver [`.env.example`](./.env.example)). Si autoalojás Umami, `VITE_UMAMI_SRC` te permite apuntar a tu propia URL de script.

### Eventos registrados (cuando la analítica está habilitada)

| Evento | Descripción | Propiedades |
|-------|-------------|------------|
| `analyze` | El usuario ejecuta un analisis estructural | — |
| `template_load` | El usuario carga una plantilla integrada | `{ template }` |
| `open_file` | El usuario abre un modelo .json guardado | — |
| `results_tab` | El usuario cambia a la vista de Resultados | — |
| `results_switch` | El usuario cambia de sub-pestaña de resultados | `{ tab: shear/moment/deflection }` |
| `export_pdf` | El usuario genera un reporte PDF | — |
| `export_ifc` | El usuario exporta a formato IFC | — |
| `animation_play` | El usuario reproduce la animacion de forma deformada | — |

Todos los eventos pasan por `track()` en `src/utils/analytics.ts`, que comprueba `typeof umami` antes de llamar y absorbe cualquier error del script. La app funciona con normalidad con la analitica desactivada, con el script bloqueado o si este falla al cargar. Ojo: `umami?.track()` no seria seguro aqui — el optional chaining protege frente a un valor `null`/`undefined`, pero lanza `ReferenceError` si el binding nunca se declaro.

## Limitaciones

- Solo elementos tipo barra (frame 3D)
- Analisis estatico lineal unicamente
- ~200 nodos maximo recomendado
- Sin analisis dinamico, modal ni P-Delta
- Unidades en sistema imperial (kips, pulgadas, ksi)

Consulta [ROADMAP.md](ROADMAP.md) (en ingles) para conocer las funcionalidades planeadas y como se espera abordar estas limitaciones.

## Contribuir

Las contribuciones son bienvenidas. Empieza por [CONTRIBUTING.md](CONTRIBUTING.md).

Al participar aceptas el [Código de Conducta](CODE_OF_CONDUCT.md).

## Seguridad

Para reportar una vulnerabilidad, consulta [SECURITY.md](SECURITY.md). No abras
un issue público para problemas de seguridad.

## Autores

Construido por **Alvaro Orellana** ([alvarotech.dev](https://alvarotech.dev)) con
**Claude Code**.

## Licencia

Licenciado bajo la Apache License, Version 2.0. Consulta [LICENSE](LICENSE) y
[NOTICE](NOTICE).
