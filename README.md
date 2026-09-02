# Antai Mineral Mark

Capacitación CBAM y preparación de evidencia industrial trazable para
proveedores mineros. Antofagasta, Chile.

Este repositorio tiene la portada pública, la marca y el sistema
comercial completo:

**CRM → cotización → correo → pago.** Un contacto entra (por la agenda o a
mano), se le cotiza, la cotización sale por correo con su enlace, el
cliente la acepta y avisa cuando transfiere, y Antai confirma el pago
contra la cuenta. Cada paso queda en la bitácora del contacto.

La **agenda** de formación alimenta el CRM: quien se inscribe a una
actividad entra como contacto en el mismo movimiento.

---

## Lo que Antai hace, y lo que no

Antai **capacita** en CBAM y **prepara evidencia** para que un tercero la
use. Antai **no verifica ni certifica** declaraciones CBAM: verificar
exige acreditación bajo ISO 17029 / 14065 y una separación de roles que
está en construcción.

Esa distinción no es una precaución de abogado — es la regla que ordena el
copy de la portada y cualquier material que salga de acá. Prometer
verificación hoy significa que el primer cliente la va a exigir mañana.

---

## Levantarlo

Hace falta Node 22+ y PostgreSQL 14+.

```bash
cp .env.example backend/.env      # y completar
cd backend && npm install
npm run migrate                   # crea el esquema
ADMIN_EMAIL=tu@correo.cl ADMIN_PASSWORD='una-clave-de-12-o-mas' npm run seed
npm start                         # :3001

cd ../frontend && npm install
npm run dev                       # :5173, con proxy de /api al backend
```

En producción, `npm run build` en el frontend y el backend sirve el
`dist/` resultante desde el mismo origen — sin CORS y sin segundo
servidor web.

Después del seed, **borrar `ADMIN_PASSWORD` del `.env`**: una clave escrita
en un archivo dejó de ser secreta. La cuenta nace obligada a cambiarla.

---

## Cómo está armado

```
backend/
  src/services/agenda.js   funciones PURAS — toda la regla de cupos
  src/routes/publico.js    ver la agenda, tomar y soltar una fecha
  src/routes/admin.js      panel: crear fechas, asistencia, CSV
  src/lib/migrate.js       migrador CON REGISTRO
frontend/
  src/componentes/LogoAntai.jsx   la marca, en SVG
  src/paginas/Landing.jsx         la portada
```

### Seis decisiones que conviene conocer antes de tocar nada

**1. `cupo` NULL significa SIN LÍMITE. No cero.**
Un evento sin tope tiene `cupo = NULL`, y `cuposDisponibles()` devuelve
`null` — no `0`. Devolver cero «por comodidad» cerraría la inscripción de
todos los eventos abiertos. La distinción está sostenida por el CHECK del
esquema, por la función pura y por dos tests.

**2. El cupo se toma con la fila del evento bloqueada.**
`POST /api/eventos/:id/reservar` abre transacción y hace
`SELECT … FOR UPDATE` sobre el evento antes de contar. Sin eso, dos
personas tomando el último cupo entran las dos. Hay dos tests: uno prueba
que el candado bloquea de verdad, otro que la ruta no lo pierda.

*Nota para quien escriba tests acá:* el primer intento fue lanzar diez
`fetch` simultáneos, y pasaba igual con y sin el `FOR UPDATE`. Un test que
pasa con el bug adentro es peor que no tenerlo.

**3. La plata va en pesos enteros, y el IVA se redondea una sola vez.**
`BIGINT` en la base, `Math.round` en un único lugar de
`services/cotizacion.js`. Tres líneas de 33.333 tienen que dar el mismo
IVA que una de 99.999, y hay un test que lo exige. Los totales se
**guardan**, no se recalculan al leer: una cotización enviada es una
oferta y tiene que seguir diciendo lo mismo si mañana cambia un precio.

**4. Solo los pagos CONFIRMADOS bajan el saldo.**
Un pago «pendiente» es alguien diciendo que pagó. El tablero muestra
cobrado y por-confirmar en columnas separadas: sumarlos sería anotar como
ingreso un depósito que nadie vio en la cuenta.

**5. El vencimiento se mide en hora de Chile, no del servidor.**
Un VPS corre en UTC. La primera versión usaba la zona local del proceso, y
una cotización válida «hasta el 30» vencía a las 21:00 hora chilena —tres
horas todos los días en que el cliente veía «vencida» un documento
vigente—. `finDelDiaEnChile()` ancla el cálculo a `America/Santiago`,
incluido el cambio de hora.

**6. El migrador lleva registro desde el commit inicial.**
Cada `.sql` se aplica una vez, en su transacción, con su fila y su sha256.
Si alguien edita una migración ya aplicada, el arranque **avisa** — y no la
re-ejecuta. Una migración aplicada no se reescribe: se hace una nueva.

---

## Verificación

```bash
cd backend && npm test        # 49 tests: puros, rutas y migrador
cd frontend && npm run build
```

Los tests de rutas necesitan la base; los puros y los del migrador corren
en cualquier parte, también con `NODE_ENV=production`.
