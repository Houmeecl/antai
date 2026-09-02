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

| Estado | Plazo |
|---|---|
| Actividad futura o reciente | Mientras se administra |
| Actividad pasada | 24 meses, para la constancia de participación |
| Reserva cancelada | 6 meses, para no perder el rastro de por qué se liberó |

Pasado el plazo se anonimiza —se conserva el conteo, se borra la
identidad—. **Todavía no hay una tarea automática que lo haga: por ahora
es manual, y esto lo deja escrito para que no se olvide.**

## Derechos

Acceso, rectificación, cancelación y oposición escribiendo a
**hola@antai.cl**. Quien reserva puede además soltar su cupo por sí mismo
con el enlace de su correo, sin escribirle a nadie.
