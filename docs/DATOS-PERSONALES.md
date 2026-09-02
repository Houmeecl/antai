# Datos personales

Ley 21.719 (Chile). Este documento existe desde la primera fila guardada:
declarar el tratamiento después de tener los datos es tenerlos sin base.

## Qué se guarda

### `reservas` — quien toma una fecha

| Dato | Obligatorio | Para qué |
|---|---|---|
| Nombre | sí | Lista de asistencia; identificar a la persona en la sala |
| Correo | sí | Confirmación, aviso de cambios, enlace para soltar el cupo |
| Empresa | no | Saber a qué empresas está llegando la formación |
| Teléfono | no | Avisar un cambio de última hora |

**Finalidad:** administrar la inscripción a una actividad concreta.
**Base:** la persona los entrega para inscribirse; el formulario dice para
qué se usan antes de enviarlos.

### `contactos` e `interacciones` — el CRM

Nombre, correo, teléfono, cargo, empresa, RUT de la empresa y ciudad, más
la bitácora de lo conversado.

**Finalidad:** administrar la relación comercial — saber con quién se
habló, cuándo y en qué quedó.
**Base:** la persona los entrega en una inscripción, una reunión o un
formulario; o son datos de contacto profesional de una empresa.

Quien se inscribe a una actividad entra al CRM automáticamente. **Es un
tratamiento distinto del de la reserva** —relación comercial, no
administración de un cupo— y por eso está declarado aparte.

### `cotizaciones` y `pagos` — lo comercial

Nombre, correo, empresa y RUT copiados al emitir; monto, referencia de la
transferencia y **la IP desde la que se aceptó**.

**Finalidad:** emitir la oferta, dejar constancia de quién la aceptó y
llevar la cuenta de lo pagado.
**Base:** ejecución del contrato y obligaciones tributarias.

La IP **no se muestra en ninguna pantalla**: existe solo como constancia
de la aceptación, por si hay desacuerdo sobre quién aceptó qué.

### `correos_enviados` — la bitácora de correo

Destinatario, asunto y cuerpo de cada correo que salió.

**Finalidad:** responder «¿qué se le dijo a esta persona y cuándo?» —una
pregunta legítima del negocio y también un derecho de acceso de esa
persona—, y detectar los envíos que fallaron.

Esto **no** es un log de servidor: está bajo el control de acceso del
panel y con plazo declarado. Ningún correo del sistema lleva contraseñas.

### `usuarios` — el equipo de Antai

Correo, nombre y el **hash** de la clave. Nunca la clave.

## Qué NO se hace

- No se venden ni ceden a terceros.
- No se usan para publicidad de otra cosa sin pedirlo aparte.
- **El correo no se escribe en los registros del servidor.** Un log rotado,
  respaldado y legible por cualquiera que entre al servidor es justo donde
  no debe quedar una lista de direcciones. Se registra que se envió, no a
  quién.
- El token de cancelación **no vuelve en la respuesta HTTP**: viaja por
  correo y solo por correo, para no quedar en el historial del navegador.

## Cuánto tiempo

| Dato | Plazo |
|---|---|
| Reserva de actividad futura o reciente | Mientras se administra |
| Reserva de actividad pasada | 24 meses, para la constancia de participación |
| Reserva cancelada | 6 meses, para no perder el rastro de por qué se liberó |
| Contacto activo del CRM | Mientras dure la relación comercial |
| Contacto sin movimiento | 24 meses desde la última interacción |
| Cotizaciones y pagos | **6 años**, por obligación tributaria (Código Tributario, art. 17) |
| Bitácora de correo | 24 meses |

Pasado el plazo se anonimiza —se conserva el conteo, se borra la
identidad—. **Todavía no hay una tarea automática que lo haga: por ahora
es manual, y esto lo deja escrito para que no se olvide.**

## Derechos

Acceso, rectificación, cancelación y oposición escribiendo a
**hola@antai.cl**. Quien reserva puede además soltar su cupo por sí mismo
con el enlace de su correo, sin escribirle a nadie.
