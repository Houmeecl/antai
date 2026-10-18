# POS Turista (Flutter, Android)

App Android para un punto de venta con cobro a turistas, envío de dinero y tienda,
integrada con la API de [dLocal Go](https://docs.dlocalgo.com/integration-api).
Por defecto funciona en **modo simulado**: no necesita claves ni red.

## Qué incluye

| Pestaña | Qué hace |
| --- | --- |
| **Caja** | Ventas del día, cobro normal y cobro a turista (conversión de moneda e IVA exento en hospedaje). Métodos: tarjeta (checkout de dLocal Go), código QR y 4 cuotas. |
| **Enviar** | Cotiza el envío, aplica las reglas de KYC y crea el payout en dLocal Go. |
| **Tienda** | Catálogo, carrito, moneda a elección y pago con tarjeta guardada o checkout de dLocal Go. |
| **Tarjetas** | Registro de tarjetas con token (solo simulado). |

El icono de terminal de la barra superior abre el registro de llamadas a la API.

## Flujos y endpoints

Pago con tarjeta (documentado por dLocal Go):

1. `POST /v1/payments` crea el pago (`PENDING`) y devuelve `redirect_url`.
2. El cliente paga en el checkout de dLocal Go.
3. dLocal avisa con `POST notification_url`; el cuerpo trae solo `payment_id`.
4. `GET /v1/payments/:id` entrega el estado final (`PAID`, `REJECTED`, `CANCELLED`, `EXPIRED`).

Envío de dinero:

1. API propia: cotización (`/api/v1/transfers/quote`) y KYC (`/api/v1/kyc/verify`).
2. API propia: `POST /api/v1/transfers` con el `quote_id`; valida vigencia y KYC.
3. dLocal Go: `POST /v1/payouts` (Chile: `CL`, `CLP`, RUT, código de banco, `B2C` o `B2B`).
4. dLocal Go: `GET /v1/payouts/:id` hasta `COMPLETED`.

Tipos de cambio: `GET /v1/currency-exchanges` (siempre USD → moneda).

### Qué es simulado y qué es supuesto

- `lib/data/backend.dart` es la API propia del comercio (resumen, cotización turista,
  QR, cotización y KYC de envíos). Sus rutas y campos son **supuestos**: reemplázala
  por tu servidor.
- El registro de tarjetas con token (`tokenizeCard`) y el pago con token **no están
  documentados** por dLocal Go; solo existen en el modo simulado.
- La exención de IVA y los tipos de cambio son valores de ejemplo. Valida la normativa
  vigente con el SII.
- No se verifica la firma de las notificaciones (HMAC-SHA256 con la clave secreta);
  eso corresponde a tu servidor.

## Ejecutar

```sh
flutter pub get
flutter run                 # modo simulado
flutter test                # pruebas de lógica y de pantallas
```

### Con el sandbox real de dLocal Go

```sh
flutter run \
  --dart-define=USE_MOCK=false \
  --dart-define=DLOCAL_API_KEY=... \
  --dart-define=DLOCAL_SECRET_KEY=... \
  --dart-define=NOTIFICATION_URL=https://tu-servidor.example/notifications
```

Las claves quedan dentro del APK y se pueden extraer. Úsalas solo en sandbox. En
producción, las llamadas a dLocal Go deben salir desde tu servidor y la app debe
hablar solo con él.

En modo real el checkout se abre en el navegador y la app consulta el estado cada 3 s
(sin servidor que reciba la notificación).

### Compilar el APK

```sh
flutter build apk --release
```

Requiere el SDK de Android. Para publicar, configura la firma de la app y cambia el
`applicationId` (`cl.pos.pos_turista`) en `android/app/build.gradle.kts`.

## Estructura

```
lib/
  main.dart            navegación (4 pestañas) y tema
  app_state.dart       estado global (carrito, tarjetas, servicios)
  core/                formato de montos, validación de tarjetas, widgets comunes
  data/                modelos, cliente dLocal Go (real y simulado), API propia simulada
  screens/             caja, monto, método, checkout, QR, envío, tienda, tarjetas, comprobante
test/                  pruebas de lógica y de pantallas
```

No ingreses tarjetas reales en el modo simulado: usa las tarjetas de prueba de dLocal Go
(`4111 1111 1111 1111` aprueba; `5555 5555 5555 4444`, `4000 0566 5566 5556` y
`5120 3501 0006 4537` rechazan).
