import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  subtotalItem, totales, estadoVigente, puedeAceptar, saldo, estadoCobro,
  pesos, folioDe, validarCotizacion, validarItem, cotizacionPublica, TASA_IVA,
} from '../src/services/cotizacion.js';
import { aplicar, marcasSinResolver } from '../src/services/correo.js';
import { normalizarRut, resumenEmbudo, validarContacto, posicionEmbudo } from '../src/services/crm.js';

// ============================================================
// La plata. Es lo que más caro sale equivocado.
// ============================================================

test('todo sale en pesos enteros, sin decimales flotando', () => {
  // 3 × 33.333 = 99.999 exacto. Con floats esto es donde aparecen los
  // 99998.99999999999.
  assert.equal(subtotalItem({ cantidad: 3, precio_unitario: 33333 }), 99999);
  // Cantidad decimal (media jornada) sí se admite; el resultado no.
  assert.equal(subtotalItem({ cantidad: 0.5, precio_unitario: 450001 }), 225001);
  assert.equal(Number.isInteger(subtotalItem({ cantidad: 1.37, precio_unitario: 999999 })), true);
});

test('una línea inválida vale 0 y no contamina el total', () => {
  for (const malo of [{ cantidad: 0, precio_unitario: 100 }, { cantidad: -1, precio_unitario: 100 },
    { cantidad: 'x', precio_unitario: 100 }, { cantidad: 1, precio_unitario: -5 }, null]) {
    assert.equal(subtotalItem(malo), 0);
  }
});

test('el IVA se redondea UNA vez, sobre el neto', () => {
  // Si se redondeara por línea, tres líneas de 33.333 darían un IVA
  // distinto que una de 99.999. Tiene que dar lo mismo.
  const porLinea = totales([
    { cantidad: 1, precio_unitario: 33333 },
    { cantidad: 1, precio_unitario: 33333 },
    { cantidad: 1, precio_unitario: 33333 },
  ]);
  const junto = totales([{ cantidad: 1, precio_unitario: 99999 }]);
  assert.equal(porLinea.neto, junto.neto);
  assert.equal(porLinea.iva, junto.iva);
  assert.equal(porLinea.total, junto.total);

  // Y el total cuadra siempre.
  assert.equal(porLinea.neto + porLinea.iva, porLinea.total);
});

test('la tasa viaja con la cotización, no es una constante global', () => {
  // Una cotización vieja tiene que seguir cuadrando si mañana cambia el
  // IVA. Por eso `totales` recibe la tasa.
  assert.equal(totales([{ cantidad: 1, precio_unitario: 1000 }], 19).total, 1190);
  assert.equal(totales([{ cantidad: 1, precio_unitario: 1000 }], 0).total, 1000);
  assert.equal(totales([{ cantidad: 1, precio_unitario: 1000 }], 21).total, 1210);
  assert.equal(TASA_IVA, 19);
});

test('el vencimiento se mide en hora de CHILE, no del servidor', () => {
  // ESTE TEST ATRAPÓ UN BUG REAL. La primera versión usaba la zona local
  // del proceso. En un VPS —que corre en UTC— una cotización válida
  // «hasta el 30» vencía a las 21:00 hora chilena: tres horas todos los
  // días en que el cliente veía «vencida» un documento que estaba vigente.
  const base = { estado: 'enviada', valida_hasta: '2026-09-30' };

  // 30 de septiembre, 23:00 en Chile: VIGENTE, falta una hora.
  assert.equal(estadoVigente(base, new Date('2026-09-30T23:00:00-03:00')), 'enviada');
  // 30 de septiembre, 23:59:59 en Chile: todavía vigente, al filo.
  assert.equal(estadoVigente(base, new Date('2026-09-30T23:59:59-03:00')), 'enviada');
  // 1 de octubre, 00:01 en Chile: vencida.
  assert.equal(estadoVigente(base, new Date('2026-10-01T00:01:00-03:00')), 'vencida');

  // En INVIERNO chileno el desfase es -04:00. Si el cálculo tuviera el
  // desfase fijo, este caso fallaría.
  const invierno = { estado: 'enviada', valida_hasta: '2026-07-15' };
  assert.equal(estadoVigente(invierno, new Date('2026-07-15T23:30:00-04:00')), 'enviada');
  assert.equal(estadoVigente(invierno, new Date('2026-07-16T00:30:00-04:00')), 'vencida');

  // Lo ya decidido NO vence porque pasó una fecha.
  assert.equal(estadoVigente({ ...base, estado: 'aceptada' }, new Date('2027-01-01')), 'aceptada');
  assert.equal(estadoVigente({ ...base, estado: 'rechazada' }, new Date('2027-01-01')), 'rechazada');
  // Sin fecha de validez no vence nunca.
  assert.equal(estadoVigente({ estado: 'enviada', valida_hasta: null }, new Date('2030-01-01')), 'enviada');
});

test('la fecha de validez llega como Date desde la base, no como texto', () => {
  // BUG REAL. `pg` devuelve las columnas DATE como objetos Date. La
  // primera versión hacía String(fecha).slice(0,10), que sobre un Date da
  // «Tue Sep 22» y produce NaN: CADA cotización con fecha de validez
  // respondía 500. Se cayó en el primer E2E.
  const comoDate = { estado: 'enviada', valida_hasta: new Date(Date.UTC(2026, 8, 30)) };
  const comoTexto = { estado: 'enviada', valida_hasta: '2026-09-30' };
  const momento = new Date('2026-09-30T23:00:00-03:00');
  assert.equal(estadoVigente(comoDate, momento), estadoVigente(comoTexto, momento));
  assert.equal(estadoVigente(comoDate, momento), 'enviada');
  assert.equal(estadoVigente(comoDate, new Date('2026-10-02T12:00:00-03:00')), 'vencida');
});

test('una fecha ilegible NO vence la cotización', () => {
  // Un problema de formato nuestro no puede quitarle al cliente un
  // documento que está vigente.
  assert.equal(estadoVigente({ estado: 'enviada', valida_hasta: 'cualquier cosa' }, new Date()), 'enviada');
});

test('un borrador responde como inexistente en el enlace público', () => {
  const borrador = puedeAceptar({ estado: 'borrador' });
  const inexistente = puedeAceptar(null);
  assert.equal(borrador.puede, false);
  assert.equal(borrador.motivo, inexistente.motivo);
});

test('SOLO los pagos confirmados bajan el saldo', () => {
  // Un pago «pendiente» es alguien diciendo que pagó. Contarlo sería
  // dar por cobrado lo que nadie vio en la cuenta.
  const cot = { total: 1000000 };
  const s = saldo(cot, [
    { estado: 'confirmado', monto: 400000 },
    { estado: 'pendiente', monto: 600000 },
    { estado: 'anulado', monto: 999999 },
  ]);
  assert.equal(s.pagado, 400000);
  assert.equal(s.saldo, 600000);
  assert.equal(s.por_confirmar, 600000);
  assert.equal(s.saldada, false);
  assert.equal(estadoCobro(cot, [{ estado: 'confirmado', monto: 400000 }]), 'abonada');
});

test('pagar de más se DICE, no se esconde', () => {
  const s = saldo({ total: 100000 }, [{ estado: 'confirmado', monto: 150000 }]);
  assert.equal(s.saldo, 0, 'el saldo nunca es negativo');
  assert.equal(s.a_favor, 50000, 'un pago de más tiene que quedar a la vista para devolverlo');
  assert.equal(s.saldada, true);
});

test('el formato de pesos es uno solo en todo el sistema', () => {
  assert.equal(pesos(1490000), '$1.490.000');
  assert.equal(pesos(0), '$0');
  assert.equal(pesos(null), '$0');
});

test('el folio se arma con ceros a la izquierda', () => {
  assert.equal(folioDe(2026, 1), 'COT-2026-0001');
  assert.equal(folioDe(2026, 137), 'COT-2026-0137');
});

test('una cotización sin líneas se rechaza', () => {
  const v = validarCotizacion({ titulo: 'Algo', items: [] });
  assert.equal(v.ok, false);
  assert.match(v.error, /sin líneas/);
});

test('un precio con decimales se rechaza: el peso no los tiene', () => {
  const v = validarItem({ descripcion: 'x', cantidad: 1, precio_unitario: 1000.5 });
  assert.equal(v.ok, false);
  assert.match(v.error, /entero/);
});

test('cotizacionPublica no filtra lo interno', () => {
  const salida = cotizacionPublica(
    { folio: 'COT-2026-0001', titulo: 'x', estado: 'enviada', neto: 100, iva: 19, total: 119,
      tasa_iva: 19, token: 'SECRETO', contacto_id: 'uuid-interno', aceptada_ip: '1.2.3.4',
      cliente_nombre: 'A', cliente_email: 'a@b.cl' },
    [], []
  );
  assert.equal(salida.token, undefined, 'el token no puede salir en el cuerpo');
  assert.equal(salida.contacto_id, undefined);
  assert.equal(salida.aceptada_ip, undefined, 'la IP es constancia, no dato para mostrar');
  // El correo del cliente tampoco: quien abre el enlace ya sabe quién es.
  assert.equal(salida.cliente_email, undefined);
});

// ============================================================
// Plantillas de correo
// ============================================================

test('la plantilla reemplaza texto y NADA más', () => {
  assert.equal(aplicar('Hola {{nombre}}, van {{n}}', { nombre: 'Ana', n: 3 }), 'Hola Ana, van 3');
  // null es «a propósito vacío»; undefined deja la marca para delatarla.
  assert.equal(aplicar('a{{x}}b', { x: null }), 'ab');
  assert.equal(aplicar('a{{x}}b', {}), 'a{{x}}b');
});

test('una plantilla NO puede ejecutar nada', () => {
  // El valor se inserta literal. Si esto se evaluara, editar una
  // plantilla desde el panel sería ejecutar código en el servidor.
  const salida = aplicar('{{x}}', { x: '${process.exit(1)}' });
  assert.equal(salida, '${process.exit(1)}');
});

test('las marcas sin resolver se detectan para poder avisar', () => {
  assert.deepEqual(marcasSinResolver('Hola {{nombre}} y {{otro}}'), ['{{nombre}}', '{{otro}}']);
  assert.deepEqual(marcasSinResolver('sin marcas'), []);
});

// ============================================================
// CRM
// ============================================================

test('el RUT se normaliza sin validar el dígito', () => {
  assert.equal(normalizarRut('76.520.943-9'), '765209439');
  assert.equal(normalizarRut('12345678-k'), '12345678K');
  assert.equal(normalizarRut(''), null);
});

test('marcar «perdido» exige decir por qué', () => {
  const sinMotivo = validarContacto({ nombre: 'Ana', email: 'a@b.cl', estado: 'perdido' });
  assert.equal(sinMotivo.ok, false);
  assert.match(sinMotivo.error, /por qué/);

  const conMotivo = validarContacto({ nombre: 'Ana', email: 'a@b.cl', estado: 'perdido', motivo_perdida: 'Precio' });
  assert.equal(conMotivo.ok, true);
});

test('el embudo cuenta las etapas vacías en CERO, no las omite', () => {
  // Una columna que desaparece por estar vacía hace creer que la etapa
  // no existe.
  const r = resumenEmbudo([{ estado: 'nuevo' }, { estado: 'cliente' }, { estado: 'perdido' }]);
  assert.equal(r.conteo.reunion, 0);
  assert.equal(r.conteo.cotizado, 0);
  assert.equal(r.total, 3);
  assert.equal(r.activos, 2, 'los perdidos no cuentan como activos');
  assert.equal(r.perdidos, 1);
});

test('«perdido» no tiene posición en el embudo: es salida lateral', () => {
  assert.equal(posicionEmbudo('nuevo'), 0);
  assert.equal(posicionEmbudo('cliente'), 4);
  assert.equal(posicionEmbudo('perdido'), null);
});
