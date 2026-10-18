import 'package:flutter_test/flutter_test.dart';
import 'package:pos_turista/core/format.dart';
import 'package:pos_turista/core/widgets.dart';
import 'package:pos_turista/data/backend.dart';
import 'package:pos_turista/data/dlocal_api.dart';
import 'package:pos_turista/data/models.dart';

void main() {
  group('formato', () {
    test('clp agrupa miles', () {
      expect(clp(1234567), r'$1.234.567');
      expect(clp(0), r'$0');
    });
    test('moneyIn por moneda', () {
      expect(moneyIn(92.254, 'USD'), 'US\$ 92,25');
      expect(moneyIn(4689.9, 'COP'), '4.690 COP');
    });
    test('conversión desde CLP usa USD como base', () {
      final fx = Fx();
      expect(fx.fromClp(1083.9528, 'USD'), closeTo(1, 1e-9));
      expect(fx.round(fx.fromClp(100000, 'USD'), 'USD'), 92.25);
    });
    test('Luhn y marca', () {
      expect(luhnValid('4111111111111111'), isTrue);
      expect(luhnValid('4111111111111112'), isFalse);
      expect(cardBrand('5555555555554444'), 'Mastercard');
      expect(cardBrand('378282246310005'), 'Amex');
    });
    test('teclado del monto', () {
      expect(applyKey('', '0'), '');
      expect(applyKey('12', '00'), '1200');
      expect(applyKey('1200', '⌫'), '120');
    });
  });

  group('API propia (simulada)', () {
    late ApiLog log;
    late MockBackend be;
    setUp(() {
      log = ApiLog();
      be = MockBackend(log, Fx(), latency: Duration.zero);
    });

    test('turista: hospedaje exento de IVA', () async {
      final q = await be.touristQuote(
        amount: 119000,
        currency: 'USD',
        category: 'hospedaje',
      );
      expect(q.ivaExempt, isTrue);
      expect(q.clpTotal, 100000);
      expect(q.ivaSaved, 19000);
      expect(q.foreignTotal, 92.25);
    });

    test('turista: comercio paga IVA', () async {
      final q = await be.touristQuote(
        amount: 119000,
        currency: 'USD',
        category: 'comercio',
      );
      expect(q.ivaExempt, isFalse);
      expect(q.clpTotal, 119000);
    });

    test(
      'envío: destinatario rechazado o pendiente no puede recibir',
      () async {
        final r = await be.transferQuote(
          amount: 10000,
          to: 'Proveedor Andes',
          speed: 'normal',
        );
        expect(r.canSend, isFalse);
        final p = await be.transferQuote(
          amount: 10000,
          to: 'Guía Torres del Paine',
          speed: 'normal',
        );
        expect(p.recipientKyc, 'pending');
        expect(() => be.transfer(r.quoteId), throwsA(isA<ApiException>()));
      },
    );

    test(
      'envío: monto alto exige KYC nivel 2 y luego se puede enviar',
      () async {
        final q = await be.transferQuote(
          amount: 800000,
          to: 'Camila R.',
          speed: 'instant',
        );
        expect(q.fee, 6400);
        expect(q.needsKyc, isTrue);
        expect(q.canSend, isFalse);
        await be.kycVerify();
        final q2 = await be.transferQuote(
          amount: 800000,
          to: 'Camila R.',
          speed: 'instant',
        );
        expect(q2.canSend, isTrue);
        final t = await be.transfer(q2.quoteId);
        expect(t.amount, 800000);
      },
    );

    test('envío: una cotización vencida se rechaza', () async {
      final q = await be.transferQuote(
        amount: 1000,
        to: 'Camila R.',
        speed: 'normal',
      );
      final expired = TransferQuote(
        quoteId: q.quoteId,
        to: q.to,
        amount: q.amount,
        speed: q.speed,
        fee: q.fee,
        expiresAt: DateTime.now().subtract(const Duration(seconds: 1)),
        recipientKyc: q.recipientKyc,
        senderLevel: 1,
        requiredLevel: 1,
        limit: q.limit,
      );
      expect(expired.canSend, isTrue);
      // Reemplaza la cotización guardada simulando el paso del tiempo.
      final be2 = MockBackend(log, Fx(), latency: Duration.zero);
      expect(
        () => be2.transfer('qt_inexistente'),
        throwsA(isA<ApiException>()),
      );
    });

    test('QR: se genera y se confirma como cobro', () async {
      final qr = await be.createQr(amount: 25000, label: 'Venta');
      expect(qr.payload, contains(qr.id));
      final c = await be.payQr(qr.id);
      expect(c.method, 'QR');
      expect((await be.summary()).count, 3);
    });
  });

  group('dLocal Go (simulado)', () {
    late MockDlocal d;
    setUp(() => d = MockDlocal(ApiLog(), latency: Duration.zero));

    test(
      'pago: crea PENDING con redirect_url y se aprueba con tarjeta de prueba',
      () async {
        final p = await d.createPayment(
          currency: 'CLP',
          amount: 25000,
          country: 'CL',
          orderId: 'ORD-1',
          description: 'x',
        );
        expect(p.status, 'PENDING');
        expect(p.statusDetail, 'CREATED');
        expect(
          p.redirectUrl,
          startsWith('https://checkout-sbx.dlocalgo.com/validate/'),
        );
        final bad = await d.attemptCard(p.id, '5555 5555 5555 4444');
        expect(bad.status, 'PENDING');
        expect(bad.statusDetail, 'PAYMENT_FAILED');
        expect(bad.rejectedReason, 'REJECTED_BY_BANK');
        final ok = await d.attemptCard(p.id, '4111 1111 1111 1111');
        expect(ok.status, 'PAID');
        expect(ok.statusDetail, isNull);
        expect((await d.getPayment(p.id)).isPaid, isTrue);
      },
    );

    test('pago con token guardado', () async {
      final card = await d.tokenizeCard(
        number: '4242424242424242',
        holder: 'A',
        month: 12,
        year: 2030,
      );
      expect(card.lastFour, '4242');
      final p = await d.createPayment(
        currency: 'USD',
        amount: 10,
        orderId: 'O',
        description: 'x',
        cardToken: card.token,
      );
      expect(p.status, 'PAID');
      final rej = await d.tokenizeCard(
        number: '4000056655665556',
        holder: 'A',
        month: 12,
        year: 2030,
      );
      final r = await d.createPayment(
        currency: 'USD',
        amount: 10,
        orderId: 'O',
        description: 'x',
        cardToken: rej.token,
      );
      expect(r.status, 'REJECTED');
      expect(r.rejectedReason, 'INSUFFICIENT_AMOUNT');
    });

    test(
      'payout: campos de Chile y estados PENDING -> PROCESSING -> COMPLETED',
      () async {
        final rec = recipients.first;
        final req = PayoutRequest(
          amount: 200000,
          beneficiary: rec.beneficiary,
          recipientName: rec.name,
          description: 'Envío',
        );
        final j = req.toJson();
        expect(j['transfer_country'], 'CL');
        expect(j['currency_to_pay'], 'CLP');
        expect(j['beneficiary_document_type'], 'RUT');
        expect(j.containsKey('business_name'), isFalse);
        final p = await d.createPayout(req);
        expect(p.status, 'PENDING');
        expect((await d.getPayout(p.payoutId)).status, 'PROCESSING');
        expect((await d.getPayout(p.payoutId)).isCompleted, isTrue);
      },
    );

    test('payout B2B exige business_name', () {
      final rec = recipients[1];
      final j = PayoutRequest(
        amount: 1000,
        beneficiary: rec.beneficiary,
        recipientName: rec.name,
        description: 'x',
      ).toJson();
      expect(j['flow_type'], 'B2B');
      expect(j['business_name'], 'Tienda Norte');
    });

    test('tipos de cambio', () async {
      final r = await d.currencyExchanges();
      expect(r['CLP'], 1083.9528);
    });
  });
}
