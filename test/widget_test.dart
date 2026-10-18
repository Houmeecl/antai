import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_turista/app_state.dart';
import 'package:pos_turista/data/backend.dart';
import 'package:pos_turista/data/dlocal_api.dart';
import 'package:pos_turista/core/format.dart';
import 'package:pos_turista/main.dart';

AppState _state() {
  final log = ApiLog();
  final fx = Fx();
  return AppState(
    log: log,
    backend: MockBackend(log, fx, latency: Duration.zero),
    dlocal: MockDlocal(log, latency: Duration.zero),
  );
}

void _bigScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.6;
  addTearDown(tester.view.reset);
}

void main() {
  testWidgets('la caja muestra las ventas del día y navega entre pestañas', (
    tester,
  ) async {
    _bigScreen(tester);
    await tester.pumpWidget(PosApp(state: _state()));
    await tester.pumpAndSettle();
    expect(find.text('Ventas de hoy'), findsOneWidget);
    expect(find.text(r'$61.400'), findsOneWidget);

    await tester.tap(find.text('Tienda'));
    await tester.pumpAndSettle();
    expect(find.text('Chile para llevar'), findsOneWidget);

    await tester.tap(find.text('Tarjetas'));
    await tester.pumpAndSettle();
    expect(find.text('Todavía no tienes tarjetas guardadas.'), findsOneWidget);
  });

  testWidgets('cobro con QR hasta el comprobante', (tester) async {
    _bigScreen(tester);
    await tester.pumpWidget(PosApp(state: _state()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cobrar'));
    await tester.pumpAndSettle();
    for (final k in ['2', '5', '00', '0']) {
      await tester.tap(find.byKey(ValueKey('key-$k')));
    }
    await tester.pump();
    expect(find.text('25.000'), findsWidgets);
    await tester.tap(find.text('Continuar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Código QR'));
    await tester.pump();
    await tester.tap(find.textContaining('Cobrar \$25.000'));
    await tester.pumpAndSettle();
    expect(find.text('Simular pago del cliente'), findsOneWidget);
    await tester.tap(find.text('Simular pago del cliente'));
    await tester.pumpAndSettle();
    expect(find.text('Pago aprobado'), findsOneWidget);
    await tester.tap(find.text('Volver al inicio'));
    await tester.pumpAndSettle();
    expect(find.text(r'$86.400'), findsOneWidget);
  });

  testWidgets(
    'envío con KYC: cotiza, verifica identidad, confirma y recibe payout',
    (tester) async {
      _bigScreen(tester);
      await tester.pumpWidget(PosApp(state: _state()));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Enviar'));
      await tester.pumpAndSettle();
      for (final k in ['8', '00', '00', '0']) {
        await tester.tap(find.byKey(ValueKey('key-$k')));
      }
      await tester.pump();
      await tester.tap(find.text('Cotizar envío'));
      await tester.pumpAndSettle();
      expect(find.text('Verificar identidad (KYC)'), findsOneWidget);
      await tester.tap(find.text('Verificar identidad (KYC)'));
      await tester.pumpAndSettle();
      expect(find.text('Confirmar envío'), findsOneWidget);
      await tester.tap(find.text('Confirmar envío'));
      await tester.pumpAndSettle();
      expect(find.text('Envío en proceso'), findsOneWidget);
      await tester.tap(find.text('Simular notificación de dLocal Go'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Simular notificación de dLocal Go'));
      await tester.pumpAndSettle();
      expect(find.text('Dinero enviado'), findsOneWidget);
    },
  );
}
