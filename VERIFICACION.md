# Verificación de la entrega

Fecha: 23 de octubre de 2026, zona America/El_Salvador.

- [x] Backend Express y frontend React conectados mediante API.
- [x] PostgreSQL de producción con `pg`, consultas parametrizadas y migraciones transaccionales.
- [x] Importes `NUMERIC(14,2)` y cálculos con Decimal.js.
- [x] Login bcrypt, JWT en cookie httpOnly, SameSite Strict y Secure en producción.
- [x] Sesiones revocables, comprobación del origen, Helmet y límites de solicitudes.
- [x] Validaciones de montos, fechas, IDs y operaciones de inversión.
- [x] Gastos, ingresos, edición, eliminación, filtros y paginación.
- [x] Cuentas, transferencias, categorías, presupuestos y recurrencias.
- [x] Compra/venta, comisiones, costo promedio, resultados y seguimiento de acciones.
- [x] Metas con asignaciones de saldo, cobertura de emergencia y referencia 50/30/20.
- [x] Noticias con caché, consejos por reglas, chat opcional, lecciones y calculadoras.
- [x] Exportación completa, importación de movimientos y borrado protegido por contraseña.
- [x] Tema claro/oscuro, navegación móvil y estados de carga, vacío y error.
- [x] Revisión de imports, rutas, entorno, SQL y manejo de errores.
- [x] Siete pruebas automatizadas pasan con Node 20.19.5: cálculos, flujo de API y tolerancia a fallos del mercado.
- [x] Frontend compilado correctamente con Node 20.19.5.
- [x] Auditoría de dependencias de producción: cero vulnerabilidades conocidas en la revisión.
- [x] Login y navegación comprobados en navegador; registro de gasto ficticio actualizó los totales.
- [x] Blueprint de Render, ejemplo de entorno, generador de hash, datos opcionales y guía de respaldos incluidos.

## Límites de lo verificado

Las pruebas SQL usan PostgreSQL embebido con PGlite; producción utiliza `pg`. No se ha conectado un PostgreSQL gestionado de Render ni se ha publicado el servicio. Las respuestas de Finnhub se simulan en las pruebas de caché, horario y fallos; las llamadas reales de Finnhub y Anthropic requieren claves personales. Estos puntos quedan documentados y no se presentan como integraciones verificadas en vivo.

La demostración de `preview:demo` utiliza datos ficticios en memoria y pierde los cambios al detenerse. La configuración de producción no activa ese modo. Para usar datos reales sigue el README y conecta PostgreSQL.

Node 20 se conserva por el requisito original; ya terminó su soporte oficial. El README explica esta limitación y las restricciones de los servicios gratuitos de Render, incluida la suspensión del servidor y la expiración de la base de datos.
