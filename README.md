# TikTokraft Live

Panel local para convertir regalos de TikTok LIVE en comandos de Minecraft. Usa [ServerTap](https://github.com/servertap-io/servertap) en un servidor Bukkit/Spigot/Paper y `tiktok-live-connector` para escuchar el directo.

> Esta es una aplicación independiente, no una copia ni está afiliada a TikFinity o TikTok. La conexión de TikTok usa una API no oficial; TikTok puede cambiarla o limitarla en cualquier momento.

## Qué incluye

- Panel web en español con estados de Minecraft y TikTok LIVE.
- Clave de ServerTap guardada en el equipo donde corre el panel; nunca se entrega al navegador una vez guardada.
- Envío de comandos por la consola WebSocket de ServerTap, con cola y límite de velocidad.
- Mapeo de regalos por nombre o, preferiblemente, ID.
- Variables en los comandos: `{usuario}`, `{apodo}`, `{regalo}`, `{regalo_id}`, `{cantidad}`.
- Gestión correcta de regalos en racha: espera el final de la racha y expone su cantidad con `{cantidad}`; así evita acciones duplicadas.
- Simulador de regalos y registro de actividad.

## Requisitos

- Node.js 20 o superior.
- Un servidor Minecraft Java con Bukkit, Spigot o Paper.
- El plugin ServerTap instalado en `plugins/` y un TikTok LIVE activo.

## Instalar ServerTap

1. Descarga el JAR más reciente de ServerTap desde sus [releases](https://github.com/servertap-io/servertap/releases/latest) y cópialo en la carpeta `plugins/` de tu servidor Minecraft.
2. Inicia el servidor una vez para que cree `plugins/ServerTap/config.yml`.
3. En ese archivo activa la autenticación y asigna una clave larga:

```yml
useKeyAuth: true
key: pega-aqui-una-clave-larga-y-aleatoria
```

4. Reinicia Minecraft. Por defecto ServerTap escucha en el puerto TCP `4567`. Confirma que funciona visitando `http://127.0.0.1:4567/swagger` desde la misma máquina.

Si el panel y Minecraft están en máquinas distintas, permite en el firewall del equipo de Minecraft el puerto TCP de ServerTap (normalmente `4567`) **solo desde la IP privada del equipo que ejecuta este panel**, o usa una VPN. No abras ni redirijas ese puerto a Internet: quien controle esa API puede ejecutar comandos de administrador en el servidor. Para una conexión remota usa TLS cuando sea posible.

## Iniciar el panel

En esta carpeta ejecuta:

```powershell
npm install
npm start
```

Después abre [http://127.0.0.1:3180](http://127.0.0.1:3180). El servidor web se enlaza a `127.0.0.1` por defecto para que el panel no quede publicado en la red.

En **Conexión**, escribe:

- Tu usuario de TikTok, sin `@` (por ejemplo `mi_canal`).
- La IP o dominio de ServerTap y su puerto (por ejemplo `192.168.1.50` y `4567`). Si el servidor está en el mismo equipo, usa `127.0.0.1` y `4567`.
- El protocolo: HTTP normal o HTTPS si configuraste TLS en ServerTap.
- La misma clave configurada en ServerTap.

En la tarjeta **TikTok LIVE**, indica el usuario que esté transmitiendo y tu **Euler Stream API Key**. La app usa el WebSocket Cloud oficial de Euler (`wss://ws.eulerstream.com`), compatible con el plan Community que incluye 2.500 solicitudes al día y 25 conexiones Cloud WebSocket. Créala desde el [Dashboard de Euler Stream](https://www.eulerstream.com/docs/api/quickstart). La clave se guarda únicamente en `data/settings.json` del equipo y queda oculta al volver a abrir el panel. Guarda/conecta primero Minecraft y después TikTok LIVE.

## Persistencia gratuita en Render con Supabase

Los servicios gratuitos de Render no conservan archivos tras reiniciarse. Para mantener permanentemente las acciones y la configuración sin usar un disco de Render:

1. Crea un proyecto gratuito en [Supabase](https://supabase.com/).
2. Abre **SQL Editor**, pega y ejecuta el contenido completo y actualizado de `supabase/schema.sql`. Además de la configuración, crea el historial permanente de **Usuario y Puntos** y sus transacciones manuales.
3. En Render, en **Environment**, añade `SUPABASE_URL` con la URL del proyecto y `SUPABASE_SECRET_KEY` con su clave secreta.
4. Redespliega el servicio.

Para habilitar **Usuario y Puntos** en un proyecto que no tenía esta función, ejecuta en este orden `supabase/user-points.sql` y luego `supabase/manual-transactions.sql` en SQL Editor. El primero crea el historial base y el segundo las transacciones manuales.

La clave secreta se usa solamente en el servidor: nunca se envía al navegador. Al primer arranque con Supabase, la aplicación migra automáticamente la configuración local existente si la encuentra. Sin esas dos variables, la aplicación conserva el almacenamiento local de siempre.

## Espacios multiusuario

Ejecuta `supabase/multiuser.sql` una vez en Supabase antes de desplegar la versión multiusuario. TikTokraft Live usa las cuentas de **Supabase Auth** con email y contraseña: la primera cuenta que se registre reclama la configuración y los puntos históricos de la instalación anterior; cada cuenta posterior empieza con un espacio privado. Los enlaces de overlays ahora incorporan un token aleatorio de su propietario, por lo que debes copiar nuevamente las URLs en OBS.

Si la primera cuenta se creó antes de una actualización del schema y no muestra sus acciones antiguas, vuelve a ejecutar `supabase/multiuser.sql`: su reparación solo copia los mappings antiguos al workspace del propietario cuando ese workspace no tiene ninguno.

En **Authentication → Providers → Email** de Supabase, deja habilitado el proveedor Email. Si mantienes activada la confirmación de email, cada persona debe confirmar su correo antes de iniciar sesión.

En **Authentication → URL Configuration** configura **Site URL** como `https://tiktokraft.loroland.pro` y añade esa misma URL en **Redirect URLs**. En Render configura también `APP_URL` con esa URL pública; si no se establece, la aplicación usa `RENDER_EXTERNAL_URL` cuando Render la proporciona.

### Cuentas gratis, Pro y administración

Todas las personas pueden crear una cuenta con email y contraseña. Las cuentas nuevas comienzan en el plan **Gratis**, que permite recorrer el panel en modo de solo lectura. Crear acciones o solicitudes, guardar configuraciones y conectar TikTok LIVE o ServerTap requiere el plan **Pro**. El rol **Administrador** incluye Pro y además abre las herramientas administrativas.

Para habilitar la asignación de planes desde el panel, ejecuta el contenido actualizado de `supabase/roles.sql` en Supabase SQL Editor. Después, en **Administración → Roles**, asigna `PRO` al correo de la cuenta que haya adquirido el plan. Quitar ese rol devuelve la cuenta al plan Gratis.

### Activación automática con Wompi Colombia

El enlace reutilizable de Nequi Negocios (`checkout.nequi.wompi.co/l/...`) no identifica de forma segura qué cuenta de TikTokraft inició el pago. Hasta configurar la integración, el botón **Pago Colombia** conserva ese enlace y la activación sigue siendo manual.

Para habilitar la activación automática, primero confirma que el comercio de [Wompi](https://comercios.wompi.co/) que ofrece las llaves de integración liquida los pagos a la cuenta de destino correcta; **no supongas que comparte la configuración del enlace creado en Nequi Negocios**. En Supabase SQL Editor ejecuta `supabase/pro-payments.sql` después de `supabase/roles.sql`. En Render añade `APP_URL=https://tiktokraft.loroland.pro` y cuatro variables del mismo comercio Wompi de producción: `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` y `WOMPI_PRIVATE_KEY`. Nunca compartas las llaves secretas por chat ni las incluyas en el código. En el dashboard de Wompi configura la URL de eventos `https://tiktokraft.loroland.pro/api/payments/wompi/webhook` para `transaction.updated`.

Con todo configurado, el botón crea una referencia única asociada al ID de la cuenta iniciada, abre Checkout Web por **$90.000 COP** y espera el evento firmado de Wompi. El servidor consulta además la transacción con la llave privada: solo `APPROVED` por la referencia, monto y moneda correctos asigna Pro; la redirección del navegador nunca concede acceso. Tras volver del checkout, la página consulta la confirmación y se actualiza. Los pagos realizados con el enlace viejo siguen requiriendo verificación manual. Prueba primero el flujo completo sin cobrar dinero real en un entorno separado; la aplicación de producción solo acepta llaves y eventos de producción para evitar que pagos de prueba activen cuentas reales.

Para autorizar la conexión a TikTok LIVE, ejecuta `supabase/admin.sql` y agrega el correo de una cuenta registrada en **Administración → Autorización**. El servidor comprueba el ID de esa cuenta al conectar; escribir el nombre de TikTok de otra persona no concede acceso. Las autorizaciones antiguas basadas únicamente en nombres de TikTok no se migran automáticamente: vuelve a agregar por correo a cada persona que deba conservar el acceso.

El formulario de registro usa `SUPABASE_PUBLISHABLE_KEY` o `SUPABASE_ANON_KEY` si existe; si no, mantiene compatibilidad con `SUPABASE_SECRET_KEY`. Los permisos Pro siempre se verifican en el servidor y no dependen de que un botón esté oculto o deshabilitado en el navegador.

## Crear acciones

Añade una acción para cada regalo. Lo más fiable es indicar el ID del regalo, pues el nombre puede variar por idioma. Puedes dejar el ID vacío si prefieres comparar por nombre.

Ejemplos:

| Regalo | Comando | Efecto |
| --- | --- | --- |
| Rosa | `say Gracias {usuario} por {cantidad} {regalo}!` | Muestra un agradecimiento. |
| Corazón | `effect give @a minecraft:speed 10 1 true` | Da velocidad a todos 10 s. |
| TikTok | `summon minecraft:lightning_bolt ~ ~ ~` | Invoca un rayo en la posición de ejecución. |

Prueba cada regla desde el icono `▷` antes de iniciar el directo. Los comandos se ejecutan con los permisos de la consola del servidor: crea reglas cuidadosas y no permitas acceso no confiable al panel.

## Desarrollo

```powershell
npm run dev
npm run check
```

Sin Supabase, la configuración se escribe en `data/settings.json`, que está excluida de Git porque puede contener la clave de ServerTap.
