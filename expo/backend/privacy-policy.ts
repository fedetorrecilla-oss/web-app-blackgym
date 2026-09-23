// Static privacy-policy page, served directly by the backend (see hono.ts)
// so both the App Store and Google Play listings can link to a stable,
// public URL without needing a separate site or hosting account.
export const PRIVACY_POLICY_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Política de Privacidad — Black Gym</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 20px 64px;
    line-height: 1.6;
    color: #1a1a1a;
    background: #ffffff;
  }
  h1 { font-size: 1.6rem; margin-bottom: 4px; }
  .updated { color: #666; font-size: 0.9rem; margin-bottom: 32px; }
  h2 { font-size: 1.15rem; margin-top: 32px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 6px; }
  a { color: #0a58ca; }
</style>
</head>
<body>
  <h1>Política de Privacidad de Black Gym</h1>
  <p class="updated">Última actualización: 21 de septiembre de 2026</p>

  <p>Black Gym es una aplicación para la gestión de un gimnasio: turnos de clases, rutinas de entrenamiento y control de pagos. Esta política explica qué información se recolecta dentro de la app, para qué se usa y cómo se protege.</p>

  <h2>Responsable de la aplicación</h2>
  <p>Federico Torrecilla — contacto: <a href="mailto:fede.torrecilla@gmail.com">fede.torrecilla@gmail.com</a></p>

  <h2>Qué información se recolecta</h2>
  <ul>
    <li><strong>Datos de alumnos:</strong> nombre, apellido y número de teléfono, cargados por el propio alumno o por el administrador del gimnasio al darse de alta.</li>
    <li><strong>Turnos y rutinas:</strong> los horarios de clase reservados y las rutinas de ejercicios asignadas a cada alumno.</li>
    <li><strong>Estado de pagos:</strong> si una cuota está marcada como pagada o pendiente, y el método (manual o MercadoPago). La app no procesa ni almacena números de tarjeta: los pagos por MercadoPago se realizan fuera de la app, en la plataforma de MercadoPago.</li>
    <li><strong>Acceso de administrador:</strong> el administrador ingresa con una contraseña propia del gimnasio para acceder a las herramientas de gestión. No se recolectan cuentas de usuario, correos electrónicos ni contraseñas de los alumnos.</li>
  </ul>

  <h2>Cómo se usa la información</h2>
  <p>Los datos se usan exclusivamente para el funcionamiento del gimnasio: organizar turnos, armar y mostrar rutinas de entrenamiento, y llevar un registro de pagos. No se usan con fines publicitarios ni se comparten con terceros para publicidad.</p>

  <h2>Dónde se almacena la información</h2>
  <p>Los datos se guardan en servicios de infraestructura en la nube (base de datos gestionada por Supabase y servidor backend en Render), que actúan únicamente como proveedores de almacenamiento y no acceden al contenido con otros fines. Parte de la información también se guarda localmente en el dispositivo para que la app funcione sin conexión.</p>

  <h2>Lo que esta app NO hace</h2>
  <ul>
    <li>No incluye publicidad ni redes de anuncios.</li>
    <li>No usa herramientas de seguimiento o analítica de terceros.</li>
    <li>No vende ni comparte información personal con terceros.</li>
  </ul>

  <h2>Derechos del usuario</h2>
  <p>Cualquier alumno o su tutor puede solicitar la corrección o eliminación de sus datos escribiendo al contacto indicado arriba.</p>

  <h2>Cambios a esta política</h2>
  <p>Esta página puede actualizarse. Se recomienda revisarla periódicamente. La fecha de la última actualización figura arriba.</p>
</body>
</html>
`;
