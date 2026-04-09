# Informe de producto y arquitectura de la app

Fecha del análisis: 2026-03-19

## 1. Resumen ejecutivo

Esta aplicación es una plataforma SaaS centrada en la detección, priorización y comprensión de subvenciones públicas para empresas y entidades en España.

La promesa principal del producto es muy clara en toda la app: dejar de "perseguir" convocatorias manualmente y pasar a recibir oportunidades relevantes, explicadas y priorizadas según el perfil real de la entidad usuaria.

En términos prácticos, la app quiere ser un "radar de subvenciones" que:

- entiende el perfil de una entidad a partir de nombre, CIF, web y documentos;
- cruza ese perfil con una base amplia de subvenciones;
- calcula compatibilidad y explica por qué encaja cada ayuda;
- ayuda a descubrir nuevas oportunidades;
- recuerda plazos y permite guardar favoritos y alertas;
- da contexto extra con histórico de concesiones y documentación;
- añade una capa conversacional con IA para resolver dudas rápido.

Aunque el repositorio se llama `Grantify`, la marca visible en la UI es sobre todo `Grantial`, y el asistente se presenta como `Granti`.

## 2. Qué es la app y para qué sirve

La app sirve para ayudar a una empresa, pyme, startup, entidad sin ánimo de lucro o consultora a encontrar subvenciones públicas que encajen con su perfil sin tener que revisar boletines, bases y convocatorias una a una.

La metáfora de producto está muy trabajada en la landing: las subvenciones se presentan como "trenes" que pasan una vez y hay que coger a tiempo. Toda la experiencia gira en torno a estas ideas:

- llegar antes;
- enterarse de convocatorias relevantes;
- ahorrar tiempo de lectura y filtrado;
- entender rápidamente requisitos, plazos y beneficiarios;
- priorizar ayudas con sentido según la entidad concreta.

No es solo un buscador. Es una combinación de:

- discovery layer: marketplace, swipe, buscador, filtros y sugerencias;
- recommendation layer: matches automáticos y ranking personalizado;
- analysis layer: scraping de entidad, enriquecimiento de perfil y justificaciones;
- action layer: favoritos, alertas, exportes, dossiers y documentos;
- assistant layer: chat general y chat por subvención.

## 3. Público objetivo que sugiere el producto

Por el copy, las pantallas y los planes de precios, la app está orientada a varios perfiles:

- pymes y startups que quieren detectar subvenciones sin dedicar un equipo entero a ello;
- empresas con necesidad de financiación pública para digitalización, I+D, crecimiento o transformación;
- entidades sin ánimo de lucro;
- consultoras y gestorías que gestionan varias entidades;
- usuarios que valoran tanto la búsqueda como la monitorización continua.

La propia landing segmenta mentalmente el producto así:

- `Gratis`: prueba inicial y primeras recomendaciones;
- `Pro`: uso serio para una o varias entidades;
- `Premium`: multi-entidad, más volumen, más alertas y exportes más completos.

## 4. Propuesta de valor al usuario

La propuesta de valor que transmite la app se puede resumir en cinco grandes beneficios:

### 4.1 Descubrir subvenciones relevantes

El sistema no muestra solo un listado genérico; intenta ordenar y seleccionar ayudas según encaje con la entidad.

### 4.2 Ahorrar tiempo

La app evita que el usuario tenga que:

- revisar miles de convocatorias;
- leer bases completas para una primera valoración;
- decidir manualmente si una ayuda encaja o no.

### 4.3 Llegar a tiempo

El producto insiste mucho en alertas, plazos, favoritos y detección temprana.

### 4.4 Entender mejor cada oportunidad

No solo enseña la subvención; también ofrece:

- resumen;
- evaluación/justificación de compatibilidad;
- documentos a presentar;
- concesiones previas de la convocatoria;
- normativa descargable.

### 4.5 Crear un sistema operativo de subvenciones para la entidad

La parte de `Entities` sugiere que el producto quiere convertirse en el centro de operación de una entidad para trabajar subvenciones:

- perfil enriquecido;
- historial de ayudas concedidas;
- minimis;
- documentos;
- exportables;
- contexto para mejorar recomendaciones.

## 5. Recorrido principal del usuario

## 5.1 Captación

La parte pública de la app incluye:

- landing muy orientada a conversión;
- calculadora gratuita de oportunidades;
- barómetro público de subvenciones;
- casos de éxito;
- blog y newsletter;
- popup y floating CTA de WhatsApp.

La intención es atraer tráfico y convertirlo en registro.

## 5.2 Registro y activación

El usuario puede:

- registrarse;
- iniciar sesión;
- verificar email;
- recuperar contraseña.

Después aparece un onboarding breve que explica:

- cómo funciona Grantial;
- la lógica del radar;
- el swipe;
- los matches;
- que el siguiente paso real es crear una entidad.

## 5.3 Creación de entidad

Este es el corazón de la activación real.

El usuario crea una entidad aportando:

- razón social;
- CIF/NIF;
- web opcional;
- documentos opcionales.

En ese momento se dispara un pipeline en segundo plano que:

- crea la entidad;
- guarda documentos en S3;
- extrae texto de PDFs, DOCX y PPTX;
- hace scraping y enriquecimiento con OpenAI;
- actualiza el perfil de la entidad;
- lanza matching automático contra subvenciones;
- va informando del progreso;
- puede notificar un primer match fuerte antes de terminar.

## 5.4 Consumo principal del producto

Una vez existe la entidad, el usuario entra en tres grandes superficies:

- `Marketplace`: exploración amplia de subvenciones;
- `Matches`: subvenciones muy compatibles;
- `Swipe`: descubrimiento y aprendizaje por preferencias.

## 5.5 Seguimiento y operación

Después el usuario puede:

- guardar favoritos;
- guardar alertas;
- consultar detalles de una subvención;
- descargar dossier o normativa;
- revisar histórico de ayudas concedidas;
- subir documentos adicionales;
- editar el perfil de la entidad;
- usar el asistente.

## 6. Funcionalidades principales por área

## 6.1 Área pública / marketing

### Landing (`/`)

La home está muy trabajada a nivel narrativo y de marketing. Presenta:

- metáfora del tren;
- vista previa del producto;
- explicaciones paso a paso;
- secciones específicas para swipe, chat y calculadora;
- pricing;
- CTAs a registro, entidades y barómetro.

Además, la landing deja claro que el producto quiere posicionarse como radar inteligente de subvenciones.

### Calculadora (`/calculadora`)

Es una herramienta gratuita para responder 4 preguntas y estimar cuántas subvenciones podría estar perdiendo una empresa.

Objetivo principal:

- lead magnet de captación;
- demostración rápida del valor del producto;
- empujar al registro.

### Barómetro (`/barometro`)

Pantalla pública con estadísticas agregadas del universo de subvenciones:

- total rastreado;
- publicadas últimos 30 y 7 días;
- distribución por finalidad;
- distribución por región;
- beneficiarios;
- tendencia mensual;
- sectores.

Es una mezcla de contenido útil, credibilidad de producto y herramienta SEO.

### Casos de éxito (`/success-stories`)

Página de prueba social con testimonios, sectores y resultados.

### Blog + newsletter (`/blog`, `/blog/:slug`)

La app incluye:

- listado de artículos;
- vista de detalle;
- suscripción a newsletter;
- backend para CRUD y generación de posts con IA.

Esto apunta a una estrategia de contenido y captación orgánica.

### Legales

Incluye privacidad, cookies, términos y aviso legal.

## 6.2 Autenticación y seguridad básica

La app tiene:

- registro;
- login;
- refresh token;
- logout;
- verificación de email;
- forgot/reset password;
- cambio de contraseña;
- borrado de cuenta.

En backend se ve:

- JWT;
- refresh tokens persistidos;
- hashing con Argon2;
- emails transaccionales.

## 6.3 Onboarding

El onboarding es corto y pedagógico. No busca recopilar datos todavía; busca preparar mentalmente al usuario para:

- entender el valor;
- conocer swipe y matches;
- crear luego la entidad.

Es una pieza de activación, no de configuración.

## 6.4 Gestión de entidades (`/entities`)

Esta es una de las pantallas más importantes del producto.

Funciones detectadas:

- crear entidad;
- seleccionar entre varias entidades;
- editar perfil completo;
- mostrar nivel de completitud;
- descargar ficha técnica PDF;
- ver y subir documentos;
- visualizar subvenciones concedidas;
- visualizar minimis;
- ver evolución anual de ayudas;
- exportar gráfico JPG;
- usar BDNS como fuente de contexto.

Es, en la práctica, el "CRM de subvenciones" de cada entidad dentro de la plataforma.

## 6.5 Marketplace de subvenciones (`/subvenciones`)

Es la capa de exploración amplia del catálogo.

Capacidades:

- búsqueda por texto;
- sugerencias/autocompletado de títulos;
- filtros por beneficiarios, regiones, finalidades, administración convocante y tipo de ayuda;
- filtros por importe y ventana de fechas;
- orden por preferencias, match, importe o plazo;
- scroll infinito;
- navegación al detalle;
- favoritos;
- alertas guardadas;
- acceso rápido a compatibles `(+80%)`.

La lógica de negocio más interesante es que el marketplace no es solo una búsqueda textual: también puede reordenarse por señales de recomendación.

## 6.6 Matches (`/subvenciones-compatibles`)

Es la vista de alta intención.

Muestra subvenciones que superan un umbral de compatibilidad alto con la entidad actual. En backend se ve un filtro de `>= 0.8`.

Incluye:

- grid de matches;
- filtros muy parecidos a marketplace;
- badges y porcentajes de compatibilidad;
- exportación a Excel de los matches visibles;
- enlace a completar perfil si aún no hay resultados.

Esta pantalla convierte el matching en una lista accionable.

## 6.7 Swipe (`/swipe`)

Es una superficie de descubrimiento y aprendizaje.

Permite:

- marcar "interesa" / "no interesa";
- descubrir ayudas de forma más ligera;
- alimentar el sistema de preferencias;
- registrar eventos de interacción;
- abrir un modal de detalle rápido.

Desde producto, el swipe cumple dos papeles:

- discovery gamificado;
- feedback loop para mejorar recomendaciones futuras.

## 6.8 Detalle de subvención y detalle de match (`/grants/:id`, `/subvenciones-compatibles/:id`)

Estas páginas son muy ricas funcionalmente.

Muestran:

- título, match y plazo;
- resumen;
- evaluación/justificación;
- documentación a aportar;
- concesiones de la convocatoria;
- favorito;
- recomendaciones relacionadas;
- acciones tipo interesa / no interesa;
- chat específico de la subvención;
- descarga de dossier Word;
- descarga del BOE/normativa legal.

La pestaña de concesiones añade mucho valor porque responde a la pregunta: "¿A quién se la han dado antes?".

## 6.9 Perfil de usuario (`/user-profile`)

Gestiona la capa personal del usuario:

- datos personales;
- comunicaciones por teléfono/email;
- favoritos;
- alertas;
- cambio de contraseña;
- borrado de cuenta.

Es menos estratégica que `Entities`, pero importante para retención y autoservicio.

## 6.10 Asistentes conversacionales

Hay dos modelos de asistencia:

### Asistente general

Endpoint `/api/app_assistente`.

Puede responder sobre:

- subvenciones de hoy;
- finalidades;
- regiones;
- beneficiarios;
- resúmenes;
- preguntas sobre subvenciones mediante recuperación semántica.

### Chat por subvención

Endpoint `/api/grants/<id>/chat`.

Es más específico y rápido. Se apoya en:

- datos SQL de la subvención;
- chunks almacenados o fallback;
- ranking de fragmentos relevantes;
- generación de respuesta HTML.

Esto posiciona a la app no solo como catálogo sino como copiloto de análisis.

## 6.11 Favoritos y alertas

Las dos funciones están integradas en marketplace, detalle y perfil:

- favoritos para guardar ayudas interesantes;
- alertas para guardar combinaciones de filtros y reutilizarlas;
- activación/desactivación de alertas;
- eliminación;
- conteo visible.

Las alertas encajan con la promesa de "llegar antes".

## 6.12 Exportables y documentos

La app incorpora una capa operativa poco habitual en productos puramente discovery:

- export Excel de matches;
- PDF técnico de entidad;
- dossier Word de subvención;
- descarga de normativa legal/BOE;
- subida y análisis de documentos de entidad.

Esto apunta a un producto pensado para trabajar y no solo para explorar.

## 7. Arquitectura funcional y técnica

## 7.1 Frontend

Stack detectado:

- React + TypeScript + Vite;
- Tailwind + shadcn/ui;
- React Query;
- React Router;
- Framer Motion;
- componentes de UX propios para marketplace, cards, onboarding y asistentes.

Características de frontend relevantes:

- rutas públicas y protegidas;
- manejo de tokens y refresco de sesión;
- polling de procesos largos;
- infinite scroll;
- experiencia responsive;
- telemetría de eventos de recomendación.

## 7.2 Backend

Stack backend principal:

- Flask;
- PostgreSQL;
- S3;
- AWS SSM;
- OpenAI;
- BDNS;
- Milvus/Zilliz;
- SharePoint;
- hilos en background para procesos largos.

El backend hace bastante más que servir CRUD. Tiene lógica de producto real:

- autenticación;
- matching;
- búsqueda;
- scoring;
- scraping;
- exportación;
- newsletter;
- blog;
- asistentes.

## 7.3 Módulo de recomendación

El archivo `src/utils/recommendation_model.py` muestra un motor de recomendación bastante serio para este tipo de producto.

Se observan estas señales:

- embeddings de subvenciones;
- collaborative filtering;
- perfil enriquecido por preferencias y metadata de la entidad;
- scoring por similitud de contenido;
- scoring por metadata;
- frescura;
- popularidad;
- reason codes del tipo `content_similarity`, `profile_match`, `collaborative_signal`, `popular`.

También hay telemetría de eventos:

- impresión;
- apertura de detalle;
- like;
- dislike;
- favorito;
- intención/aplicación (`apply_click`).

En otras palabras: la app intenta aprender del comportamiento real del usuario, no solo de filtros declarativos.

## 7.4 Pipeline de enriquecimiento de entidad

Cuando una entidad se crea, el backend:

1. la registra en base de datos;
2. guarda archivos en S3;
3. extrae texto de documentos;
4. consulta web y otras fuentes con OpenAI;
5. normaliza un JSON de perfil;
6. actualiza la entidad;
7. lanza matching;
8. va guardando progreso;
9. puede detectar temprano un primer match fuerte.

Esto es muy importante porque explica el posicionamiento del producto: no es solo "elige filtros", sino "yo construyo tu perfil y trabajo por ti".

## 7.5 Ingesta y conocimiento de subvenciones

Además del producto de usuario, existe un pipeline de backoffice en `src/Modules/main.py` y módulos relacionados que:

- lee subvenciones desde S3/SharePoint;
- genera resúmenes;
- guarda resultados;
- ingesta chunks en Milvus;
- ejecuta matching.

También existe un webhook para n8n.

Esto indica que el sistema tiene una parte de "alimentación de catálogo" separada del frontend.

## 8. Mapa de superficies principales

| Área | Objetivo | Tipo |
| --- | --- | --- |
| Home | captación y explicación del producto | pública |
| Calculadora | lead magnet | pública |
| Barómetro | contenido + credibilidad + SEO | pública |
| Blog | contenido y captación | pública |
| Auth / reset / verify | acceso | pública |
| Onboarding | activación | protegida |
| Entities | centro operativo de la entidad | protegida |
| Marketplace | exploración amplia | protegida |
| Matches | oportunidades de alta compatibilidad | protegida |
| Swipe | descubrimiento y aprendizaje | protegida |
| Grant detail / Match detail | análisis profundo y acciones | protegida |
| User profile | autogestión del usuario | protegida |

## 9. Qué quiere ofrecer realmente al usuario

Viendo producto, copy y backend, la app quiere ofrecer algo más ambicioso que "buscar ayudas":

- un radar personalizado;
- una capa de inteligencia que filtra ruido;
- una forma de no llegar tarde a convocatorias;
- una forma de entender rápido una ayuda sin leerse todo el expediente;
- una base operativa por entidad;
- una memoria del usuario basada en preferencias, favoritos y comportamiento;
- contexto histórico de concesiones y minimis;
- herramientas de exporte para pasar de descubrir a actuar.

La app quiere cubrir tanto la fase de:

- descubrimiento;
- evaluación;
- seguimiento;
- documentación;
- operación.

## 10. Señales de madurez y diferenciadores

Las piezas que más valor diferencial aportan son:

- perfilado automático de entidad a partir de web y documentos;
- motor de recomendación híbrido;
- surface múltiple: marketplace + matches + swipe;
- detalle enriquecido con concesiones BDNS;
- chat específico por subvención;
- generación de dossier descargable;
- gestión multi-entidad;
- histórico minimis y concesiones.

Esto coloca el producto a medio camino entre:

- buscador de subvenciones;
- CRM/ops de ayudas públicas;
- copiloto IA para entender convocatorias.

## 11. Observaciones y hallazgos relevantes

Estas observaciones no invalidan el producto; simplemente ayudan a entender su estado actual:

### 11.1 Marca inconsistente

El repo y parte del código usan `Grantify`, mientras que la experiencia visible al usuario usa sobre todo `Grantial` y `Granti`.

### 11.2 Hay señales de pricing, pero no he visto billing integrado

La landing muestra planes `Gratis`, `Pro` y `Premium`, pero en el código revisado no aparece una integración clara de cobro/suscripción tipo Stripe.

Conclusión probable:

- el pricing está definido a nivel de posicionamiento/marketing;
- la lógica de facturación o no existe todavía en este repo o vive fuera de él.

### 11.3 El blog está a medio camino entre mock y feature real

Se ve un backend completo de blog, detalle dinámico por API y componentes de administración, pero:

- la página de listado del blog usa posts estáticos hardcodeados;
- no he visto la ruta de admin montada en `App.tsx`.

Conclusión probable:

- el sistema de blog existe, pero su integración frontal no está cerrada del todo.

### 11.4 El asistente general existe, pero su página dedicada no está activa

Hay una página `Assistant.tsx`, pero la ruta está comentada en `App.tsx`.

Sin embargo, la experiencia de chat sí está viva de otras formas:

- chat por subvención;
- floating assistants;
- componentes de popup.

### 11.5 Onboarding presente, pero no parece totalmente forzado

Existe soporte en `ProtectedRoute` para exigir onboarding, pero en las rutas principales protegidas normalmente se exige email verificado y no siempre onboarding completado.

Esto sugiere que:

- el onboarding existe como activación UX;
- no necesariamente como requisito duro para toda la navegación.

## 12. Archivos clave revisados para este informe

- `src/App.tsx`
- `src/pages/Home.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/GrantMarketplace.tsx`
- `src/pages/Matches.tsx`
- `src/pages/GrantSwipe.tsx`
- `src/pages/GrantDetail.tsx`
- `src/pages/MatchDetail.tsx`
- `src/pages/Entities.tsx`
- `src/pages/UserProfile.tsx`
- `src/context/AuthContext.tsx`
- `src/context/ChatContext.tsx`
- `src/components/grants/GrantDetailShell.tsx`
- `src/components/EntityCreateForm.tsx`
- `src/components/EntityDocuments.tsx`
- `src/utils/app.py`
- `src/utils/recommendation_model.py`
- `src/utils/scrapeEntidad.py`
- `src/utils/auth.py`
- `src/routes/blog_routes.py`
- `src/utils/newsletter_routes.py`
- `src/Modules/main.py`

## 13. Conclusión final

Grantial es una app de inteligencia aplicada a subvenciones públicas, con orientación clara a producto SaaS B2B/B2B2C para empresas y entidades españolas.

Su propuesta no se limita a listar ayudas: intenta construir contexto, aprender del usuario, enriquecer el perfil de la entidad y convertir una tarea pesada y manual en un flujo guiado, priorizado y accionable.

La mejor forma de describirla es esta:

> Es un radar inteligente de subvenciones con motor de matching, capa conversacional y herramientas operativas para trabajar oportunidades de financiación pública a nivel de entidad.

Si este informe se va a usar internamente, la siguiente fase natural sería convertirlo en dos documentos derivados:

- un mapa funcional por pantallas y endpoints;
- un roadmap de producto con quick wins, gaps e hipótesis de evolución.
