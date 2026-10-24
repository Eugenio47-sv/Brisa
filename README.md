# Brisa · Finanzas personales

Aplicación web personal en español, USD y zona horaria `America/El_Salvador`. React + Vite + Tailwind + Recharts en el frontend; Express + PostgreSQL (`pg`) en el backend. Un repositorio y un servicio web en Render. Los precios y el chat son opcionales: los registros financieros funcionan sin claves externas.

## Inicio rápido: ver la web sin configurar PostgreSQL

```sh
npm ci
npm run build
npm run preview:demo
```

Abre http://127.0.0.1:3000 e ingresa con `Brisa-Demo-2026!`.

**Este modo es solo una demostración local**: usa PostgreSQL embebido en memoria (PGlite), datos ficticios y ninguna clave externa. Escucha únicamente en tu computadora. Todo se borra al cerrar el proceso. No ingreses datos reales aquí. Los precios de ejemplo son costos de compra ficticios, no cotizaciones. Detén la demostración con Ctrl+C antes de iniciar el servidor normal.

## Usar con tus datos reales

Si tienes PostgreSQL local activo y ya creaste la base `brisa`, abre `Conectar-Brisa.cmd` desde el Explorador de archivos. El asistente pide usuario y contraseña de PostgreSQL, comprueba la conexión y permite elegir la contraseña de la web. Las contraseñas se introducen ocultas. Guarda `.env` sin imprimir secretos, aplica migraciones y abre la web en http://localhost:3001. Conserva una contraseña de Brisa existente si vuelves a ejecutarlo. Mantén abierta su terminal mientras uses la web. Este modo es para uso local y no publica la aplicación en Internet.

### 1. Requisitos

- Node.js 20.19.5, fijado en `.node-version` y `render.yaml`, de acuerdo con el stack solicitado. **Node 20 ya terminó su soporte oficial**. Antes de exponer una instalación con datos reales, conviene migrar a una versión LTS con soporte y repetir las pruebas. Las pruebas de backend pasan con Node 20.19.5 y Node 24.15.0. El frontend también compila con el runtime solicitado. Fuente: https://nodejs.org/en/about/eol
- PostgreSQL 15 o superior. Crea una base vacía llamada `brisa`; usa un usuario con permisos sobre esa base.
- Una terminal abierta en esta carpeta.

### 2. Instalar y configurar

```sh
npm ci
```

Copia `.env.example` a `.env` en la raíz. En PowerShell:

```powershell
Copy-Item .env.example .env
```

Completa `DATABASE_URL` con tus datos de PostgreSQL. Por ejemplo, `postgresql://usuario:contraseña@localhost:5432/brisa`. Codifica los caracteres especiales de usuario o contraseña para una URL. No compartas esta dirección.

Genera un secreto JWT:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Pega el resultado en `JWT_SECRET`. Genera el hash de tu contraseña:

```sh
npm run hash-password
```

Escribe una contraseña de al menos 12 caracteres. La terminal oculta la entrada; no la pases como argumento. Pega el hash completo en `APP_PASSWORD_HASH`, entre comillas simples en `.env`. bcrypt admite hasta 72 bytes de contraseña.

### 3. Ejecutar

Desarrollo (Vite y Express, con recarga):

```sh
npm run dev
```

Abre http://localhost:5173. Mantén `APP_ORIGIN=http://localhost:5173`. No uses `127.0.0.1` en este modo porque el origen debe coincidir exactamente.

Para probar el frontend compilado servido por Express, configura `APP_ORIGIN=http://localhost:3000`, deja `NODE_ENV=development`, y ejecuta:

```sh
npm run build
npm start
```

Abre http://localhost:3000. La cookie usa `httpOnly` y `sameSite=strict`; `secure` se activa en producción con HTTPS. No expongas el modo development a Internet.

Las migraciones se aplican al iniciar con transacción y bloqueo. Puedes ejecutarlas aparte sin duplicar el esquema:

```sh
npm run migrate
```

Opcionalmente, **solo en una base sin cuentas**, carga ejemplos:

```sh
npm run seed
```

### 4. Primeros pasos

1. En Ahorros, crea tus cuentas (banco, efectivo, ahorro, fondo de emergencia o tarjeta).
2. Introduce el saldo inmediatamente anterior al primer movimiento que registrarás. Una deuda de tarjeta se escribe como saldo negativo.
3. Registra gastos e ingresos con el botón `+`. Un gasto en tarjeta reduce su saldo; pagar la tarjeta es una transferencia desde el banco a la tarjeta, no un segundo gasto.
4. Define presupuestos en Gastos → Presupuestos. La alerta aparece al usar el 80 %.
5. Registra compras y ventas en Inversiones. La cuenta indicada recibe o entrega el efectivo. Para inversiones que ya tenías, reconstruye las operaciones y el saldo previo, sin sumar nuevamente su valor como efectivo.
6. Transfiere dinero a cuentas de ahorro. Las metas asignan partes de ese saldo; no crean dinero ni se suman nuevamente al patrimonio.
7. Crea una cuenta de tipo Fondo de emergencia para que su saldo cuente en la cobertura.
8. En Más → Ajustes puedes cambiar la contraseña, categorías, apariencia, saldos iniciales y exportar datos.

## Variables de entorno

| Variable            | Uso                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | Obligatoria. Conexión PostgreSQL, solo servidor.                                                                                                                                         |
| `JWT_SECRET`        | Obligatoria. Secreto aleatorio de al menos 32 caracteres.                                                                                                                                |
| `APP_PASSWORD_HASH` | Obligatoria. Hash bcrypt que inicializa la contraseña si la base está vacía.                                                                                                             |
| `FINNHUB_API_KEY`   | Opcional. Precios y noticias.                                                                                                                                                            |
| `ANTHROPIC_API_KEY` | Opcional. Habilita chat educativo.                                                                                                                                                       |
| `ANTHROPIC_MODEL`   | Por defecto `claude-sonnet-5-5`, verificado en la documentación del proveedor.                                                                                                           |
| `PORT`              | Puerto, 3000 por defecto. Render lo proporciona automáticamente.                                                                                                                         |
| `APP_ORIGIN`        | Origen exacto del frontend, sin `/` final. Obligatoriamente HTTPS en producción. En Render se usa `RENDER_EXTERNAL_URL` si se omite. Para un dominio propio, configúralo explícitamente. |
| `NODE_ENV`          | `development`, `test` o `production`. Render usa `production`.                                                                                                                           |
| `DATABASE_SSL`      | `false` por defecto para la conexión privada de Render. Usa `true` si tu proveedor requiere TLS con certificado verificable. No se desactiva la verificación de certificados.            |

La contraseña actualizada desde Ajustes se guarda en PostgreSQL y prevalece sobre el hash inicial del entorno. Cambiar `APP_PASSWORD_HASH` después no cambia la contraseña existente. Conserva acceso a tu base y un respaldo. Nunca uses variables `VITE_` para secretos.

## Finnhub

1. Crea una cuenta en https://finnhub.io/register.
2. Obtén la API key en el panel de Finnhub.
3. Configura `FINNHUB_API_KEY` únicamente en el servidor; reinicia el servicio.

Se usan los endpoints documentados `/quote`, `/stock/market-status`, `/stock/profile2`, `/news?category=general` y `/company-news`. Se refrescan cotizaciones cada 3 minutos solo cuando el estado de mercado de EE. UU. confirma apertura. El contador compartido en PostgreSQL permite como máximo 50 llamadas/minuto de esta app, dejando margen frente a las 60 indicadas para el plan gratuito. Otras aplicaciones usando tu clave comparten el cupo del proveedor. Noticias: caché de 30 minutos; sector: caché semanal. Noticias de portafolio: hasta 12 símbolos por consulta para controlar consumo.

La disponibilidad depende del mercado, símbolo, plan y permisos del proveedor. La aplicación acepta símbolos de varias acciones, pero este programador está diseñado para mercado estadounidense en USD. No calcula divisas, opciones, splits, dividendos automáticos ni ventas en corto. Para un dividendo en efectivo puedes registrar un ingreso; no forma parte del resultado de operaciones del portafolio. Si falta un precio, se muestra costo promedio con etiqueta de estimación. Si falla el estado de mercado, se conserva caché y no se asume que la bolsa está abierta. Consulta https://finnhub.io/docs/api.

## Asesor opcional

Crea una clave en https://platform.claude.com/ y establece `ANTHROPIC_API_KEY`. La API puede tener costos independientes de una suscripción de chat. El modelo predeterminado es `claude-sonnet-5-5`: https://platform.claude.com/docs/en/models/overview.

El usuario debe marcar el consentimiento visible antes de enviar el resumen agregado y los mensajes a Anthropic. No se envían contraseñas, nombres de cuentas ni notas de movimientos; sí importes, nombres de categorías, símbolos, objetivos y fechas. No escribas información sensible en el chat. El historial es temporal, limitado a los últimos intercambios, con máximo 2000 caracteres por mensaje, 1200 tokens de salida, 30 segundos de espera y 20 consultas/hora. Los consejos por reglas funcionan sin IA. Todo el contenido del asesor es educativo.

## Desplegar en Render

### 1. Subir el código a GitHub

Crea un repositorio privado en GitHub. Puedes usar GitHub Desktop: agrega esta carpeta como repositorio local, revisa los archivos y publica el repositorio. `.env`, dependencias y compilados están excluidos por `.gitignore`. Comprueba que no subes secretos, exportaciones financieras o copias de base de datos.

### 2. Crear el servicio y la base

1. Crea tu cuenta en https://render.com/ y conecta GitHub.
2. Selecciona **New → Blueprint**, el repositorio y la rama que contiene `render.yaml`.
3. Revisa los recursos antes de crearlos: el blueprint crea únicamente un servicio web gratuito. La base PostgreSQL se configura por separado; no crea una base que expire.
4. Render solicita `APP_PASSWORD_HASH`. Genera el hash localmente con `npm run hash-password` y pega el valor completo **sin comillas adicionales** en el panel de Render.
5. `JWT_SECRET` se genera automáticamente. Render solicita `DATABASE_URL`: indica una base PostgreSQL accesible desde el servidor de Render. `localhost` se refiere al propio servidor de Render, no a tu computadora. El blueprint activa TLS verificado para la conexión externa.
6. Crea los recursos. El build es `npm ci --include=dev && npm run build`; el inicio es `npm start`.
7. Cuando el servicio esté disponible, abre su URL HTTPS e inicia sesión con tu contraseña.
8. En **Environment**, agrega las claves opcionales de Finnhub y Anthropic, y vuelve a desplegar.

Alternativa manual: crea PostgreSQL primero y copia su Internal Database URL; crea después un Web Service de Node con los mismos comandos de build/inicio. Configura `DATABASE_URL`, `JWT_SECRET`, `APP_PASSWORD_HASH`, `NODE_ENV=production` y `NODE_VERSION=20.19.5`. Para dominio propio configura también `APP_ORIGIN=https://tu-dominio`.

No se ha creado ni publicado un servicio de Render desde esta entrega: requiere tu cuenta, repositorio y credenciales. El blueprint no contiene claves ni contraseñas prefijadas.

### Límites del plan gratuito

Según https://render.com/docs/free, los servicios gratuitos se suspenden tras 15 minutos sin tráfico y tardan en despertar. La base PostgreSQL gratuita **expira a los 30 días**. No la uses como almacenamiento permanente de tus finanzas sin plan de migración o actualización y respaldos.

Los trabajos de esta app viven en el proceso de Express. **Si el servicio duerme o se detiene, no se generan cotizaciones ni fotos de esos días.** Al despertar se recuperan las recurrencias pendientes de forma idempotente (hasta 500 ocurrencias por regla por ciclo) y se guarda la foto actual. No se inventan fotos históricas de días omitidos. Para capturas realmente diarias usa un servicio siempre activo. No se configura un cron externo que implique costos sin tu decisión.

### Comprobación después del despliegue

- Inicia sesión y crea una cuenta con saldo conocido.
- Registra un gasto pequeño, edítalo y bórralo; verifica los saldos.
- Transfiere entre dos cuentas y confirma que el patrimonio no cambia.
- Cierra sesión y confirma que no puedes acceder a las APIs.
- Comprueba precios/noticias con tu clave y el chat con tu cuenta Anthropic.
- Descarga un respaldo y comprueba que contiene los registros esperados.

## Respaldos y restauración

En Ajustes puedes exportar JSON completo o CSV de todas las tablas (cada fila contiene el nombre de tabla y su registro JSON). Estos archivos excluyen contraseñas y sesiones. El CSV de movimientos es una tabla convencional que puede reimportarse; importar el mismo archivo dos veces duplica registros. Usa fechas `AAAA-MM-DD`, importes con punto decimal e IDs de cuentas/categorías existentes. Máximo 2000 filas/800 KB, todo dentro de una transacción. Las celdas con prefijos de fórmula se neutralizan al exportar.

Para una copia restaurable de toda la base usa las herramientas de PostgreSQL. Define `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` y, cuando corresponda, `PGSSLMODE=require` en tu entorno; usa un archivo de contraseñas de PostgreSQL o el prompt seguro. Evita contraseñas literales en el historial de comandos.

```sh
pg_dump --format=custom --file=brisa.backup
```

Para restaurar, crea una base vacía, apunta las variables `PG*` a esa base y ejecuta:

```sh
pg_restore --no-owner --no-acl --dbname=brisa_restaurada brisa.backup
```

Prueba la restauración antes de necesitarla. Guarda copias fuera de Render y fuera del repositorio, idealmente cifradas. El respaldo SQL incluye el hash de contraseña y sesiones: protégelo y cambia `JWT_SECRET` tras restaurar. No se incluye un importador general de JSON; el mecanismo de restauración completa es PostgreSQL.

## Organización y esquema

```text
client/src/
  App.jsx                 Acceso, navegación, tema y formularios compartidos
  components.jsx          Controles accesibles y estados
  pages/                  Inicio, gastos, inversiones, ahorros y más
  styles.css              Diseño adaptable y temas
server/src/
  app.js                  HTTP, seguridad, API y frontend compilado
  config.js               Validación del entorno
  db/                     Conexión pg, migración SQL y control de versiones
  modules/                Autenticación, libro de movimientos, portafolio,
                          metas, dashboard, mercado y asesor
  lib.js                  Decimales, validaciones y cálculos
  jobs.js                 Recurrencias, cotizaciones y fotos
server/scripts/           Hash, migración, ejemplos y demostración temporal
server/tests/             Pruebas de cálculos e integración PostgreSQL
```

Tablas: `settings`, `sessions`, `accounts`, `categories`, `transactions`, `transfers`, `recurring_rules`, `budgets`, `trades`, `quote_cache`, `watchlist`, `goals`, `goal_contributions`, `snapshots`, `news_cache`, `api_calls` y `schema_migrations`.

Importes `NUMERIC(14,2)`, cantidades de acciones `NUMERIC(22,8)`. Dinero transportado como cadenas y calculado con Decimal.js; las conversiones numéricas del frontend se usan para formato y gráficas. Cada liquidación de operación redondea a centavos al afectar efectivo. Las metas asignan saldos existentes. Si retiras fondos de una cuenta comprometida con metas, aparece una alerta para corregir las asignaciones. El costo promedio incluye comisiones; las operaciones se ordenan por fecha e ID y las ventas no pueden exceder la cantidad disponible en ese momento.

Fotos: se actualiza la del día mientras el proceso esté activo; las de días anteriores no se recalculan por ediciones retroactivas. La variación del mes necesita una foto anterior al primer día del mes, y aparece sin dato hasta tenerla. El fondo de emergencia usa el promedio de los 3 meses completos anteriores, incluidos meses sin registros; con poco historial puede subestimar los gastos. La regla 50/30/20 compara necesidades, deseos y remanente; el remanente no equivale a un depósito de ahorro.

## Verificación y seguridad

```sh
npm test
npm run build
npm audit
```

Las pruebas usan PostgreSQL embebido para ejecutar las migraciones y consultas reales sin necesitar un servidor externo. No sustituyen una comprobación en el PostgreSQL gestionado de Render ni prueban la red del paquete `pg`. En producción se usa exclusivamente `pg`.

Se verifican: promedio y comisiones, ventas inválidas, precisión decimal, presupuestos, proyección, fin de mes y año bisiesto, escape CSV, migraciones repetidas, login, protección de origen, cookie httpOnly, sesiones revocadas, cuentas, edición de movimientos, transferencias, asignaciones sin saldo, presupuestos sin duplicados, recurrencias idempotentes, fotos únicas, filtros, exportación, importación, cambio de contraseña y borrado con verificación.

Controles: Helmet/CSP, origen exacto y protección CSRF por comprobación de Origin en escrituras (también login), JWT en cookie, sesiones revocables en PostgreSQL, bcrypt, límites de solicitudes y login, validación Zod y consultas parametrizadas. Los únicos fragmentos SQL compartidos son textos constantes controlados por el código, nunca valores enviados por el usuario. El limitador de login es por proceso; este despliegue personal supone una sola instancia de Render. Todas las rutas `/api` salvo login requieren sesión. No hay un endpoint de salud público.

## Dividendos

En Inversiones → Dividendos registra el importe neto recibido, el símbolo, la cuenta de destino y la fecha de cobro. Los pagos con fecha futura quedan programados: al llegar ese día (zona America/El_Salvador) se incluyen automáticamente en los saldos, los ingresos de ese mes y el rendimiento realizado. El cálculo se hace desde los registros, por lo que recargar la página o reiniciar el servidor no duplica el abono. No se suman al valor de las posiciones ni cambian el costo promedio.

Brisa no está vinculada con el bróker: no detecta ni confirma depósitos ni calcula impuestos. Registra el pago neto real o una programación confirmada y corrige su fecha o importe si cambia. No registres además el mismo pago como ingreso ordinario. Editar o eliminar un dividendo recalcula el saldo y el rendimiento actual; las fotos históricas conservan lo registrado en su día. La exportación y el borrado financiero incluyen dividendos y conservan la cuenta de acceso.

## Si algo falla

- **Falla al iniciar:** revisa que PostgreSQL sea accesible, la URL, permisos, secreto JWT y formato del hash. Los logs no imprimen secretos.
- **Origen no permitido:** `APP_ORIGIN` debe coincidir exactamente con la URL que abres, incluidos protocolo y puerto, sin barra final.
- **Login funciona local pero no en Render:** usa HTTPS, `NODE_ENV=production` y el dominio correcto. Las cookies seguras no viajan por HTTP.
- **Cuenta duplicada:** usa un nombre distinto; los nombres son únicos.
- **Categoría no se elimina:** aún tiene movimientos, presupuestos o reglas que la referencian.
- **Venta rechazada:** comprueba que las compras existan antes de la fecha de la venta y que no hayas vendido más de lo disponible.
- **CSV rechazado:** exporta una tabla de movimientos para obtener los encabezados correctos; revisa fechas, montos e IDs. No se importa ninguna fila si una falla.
- **No hay cotización:** revisa clave, símbolo, cobertura y horario. La app no fuerza consultas fuera de mercado ni inventa precios actuales.
- **Asesor no disponible:** revisa clave, acceso al modelo, saldo y límite de consultas. Los consejos por reglas siguen funcionando.
- **Pantalla vacía:** vuelve a compilar; Express necesita `client/dist`. Revisa la conexión y usa Reintentar.
- **Historial con días ausentes:** el servicio estuvo dormido o detenido. No se reconstruyen cotizaciones de días pasados.
- **Base expirada:** consulta el panel de Render y restaura tu respaldo en una base nueva o actualiza el plan dentro del plazo permitido.

## Alcance de la entrega

Se implementaron las seis fases en un repositorio local por tu autorización de completar backend y frontend. No se proporcionan saldos ficticios en producción: los ejemplos se cargan solo si ejecutas el script. El servicio publicado, las claves externas, las llamadas reales a Finnhub/Anthropic y la validación con Render quedan pendientes de tus credenciales. No se promete ausencia absoluta de errores ni se presentan como verificadas las integraciones sin claves.
