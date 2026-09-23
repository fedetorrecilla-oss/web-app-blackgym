// Static support/contact page, served directly by the backend (see hono.ts)
// so the App Store and Google Play listings can link to a stable, public
// "Support URL" without needing a separate site or hosting account.
export const SUPPORT_PAGE_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Soporte — Black Gym</title>
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
  p { margin-top: 16px; }
  a { color: #0a58ca; }
  .box {
    margin-top: 24px;
    padding: 20px;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    background: #fafafa;
  }
</style>
</head>
<body>
  <h1>Soporte de Black Gym</h1>
  <p>Black Gym es una aplicación para la gestión de un gimnasio: turnos de clases, rutinas de entrenamiento y control de pagos.</p>

  <div class="box">
    <p>¿Tenés una duda, un problema con la app o querés reportar algo? Escribinos:</p>
    <p><a href="mailto:fede.torrecilla@gmail.com">fede.torrecilla@gmail.com</a></p>
  </div>

  <p>Vas a recibir respuesta a la brevedad. Para consultas sobre privacidad de datos, podés ver también nuestra <a href="/privacy-policy">Política de Privacidad</a>.</p>
</body>
</html>
`;
