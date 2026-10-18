/// API propia del comercio (resumen de ventas, cotización turista, QR,
/// cotización y KYC de envíos). Está simulada: reemplaza esta clase por tu
/// servidor cuando esté disponible. Los nombres de campo son supuestos.
library;

import 'dart:math';

import '../core/format.dart';
import 'dlocal_api.dart';
import 'models.dart';

class Charge {
  Charge({
    required this.id,
    required this.amount,
    required this.method,
    required this.label,
    required this.at,
    this.authCode,
  });
  final String id;
  final int amount;
  final String method;
  final String label;
  final String at;
  final String? authCode;
}

class Summary {
  const Summary(this.total, this.count);
  final int total;
  final int count;
}

class TouristQuote {
  const TouristQuote({
    required this.clpTotal,
    required this.ivaExempt,
    required this.ivaSaved,
    required this.currency,
    required this.foreignTotal,
  });
  final int clpTotal;
  final bool ivaExempt;
  final int ivaSaved;
  final String currency;
  final double foreignTotal;
}

class QrCharge {
  QrCharge({
    required this.id,
    required this.amount,
    required this.payload,
    required this.expiresAt,
    required this.label,
  });
  final String id;
  final int amount;
  final String label;
  final String payload;
  final DateTime expiresAt;
}

class TransferQuote {
  const TransferQuote({
    required this.quoteId,
    required this.to,
    required this.amount,
    required this.speed,
    required this.fee,
    required this.expiresAt,
    required this.recipientKyc,
    required this.senderLevel,
    required this.requiredLevel,
    required this.limit,
  });
  final String quoteId;
  final String to;
  final int amount;
  final String speed;
  final int fee;
  final DateTime expiresAt;

  /// verified, pending o rejected.
  final String recipientKyc;
  final int senderLevel;
  final int requiredLevel;
  final int limit;

  int get totalDebit => amount + fee;
  bool get needsKyc => requiredLevel > senderLevel;
  bool get canSend => recipientKyc == 'verified' && !needsKyc;
}

class Transfer {
  const Transfer({
    required this.id,
    required this.to,
    required this.amount,
    required this.fee,
    required this.quoteId,
  });
  final String id;
  final String to;
  final int amount;
  final int fee;
  final String quoteId;
}

/// Destinatarios de ejemplo con su estado KYC y datos bancarios (Chile).
class Recipient {
  const Recipient(this.name, this.kyc, this.beneficiary);
  final String name;
  final String kyc;
  final Beneficiary beneficiary;
}

const recipients = <Recipient>[
  Recipient(
    'Camila R.',
    'verified',
    Beneficiary(
      first: 'Camila',
      last: 'Rojas',
      email: 'camila@example.com',
      document: '12345678K',
      bankCode: '1',
      account: '0012345678',
      accountType: 'CHECKING',
      flow: 'B2C',
    ),
  ),
  Recipient(
    'Tienda Norte',
    'verified',
    Beneficiary(
      first: 'Pedro',
      last: 'Soto',
      email: 'pagos@tiendanorte.example',
      document: '765432109',
      bankCode: '12',
      account: '0098765432',
      accountType: 'CHECKING',
      flow: 'B2B',
    ),
  ),
  Recipient(
    'Proveedor Andes',
    'rejected',
    Beneficiary(
      first: 'Ana',
      last: 'Pizarro',
      email: 'ap@andes.example',
      document: '761234567',
      bankCode: '37',
      account: '0055512345',
      accountType: 'CHECKING',
      flow: 'B2B',
    ),
  ),
  Recipient(
    'Guía Torres del Paine',
    'pending',
    Beneficiary(
      first: 'Mateo',
      last: 'Vera',
      email: 'mateo@example.com',
      document: '15234567K',
      bankCode: '51',
      account: '0077788899',
      accountType: 'VISTA',
      flow: 'B2C',
    ),
  ),
];

class MockBackend {
  MockBackend(
    this.log,
    this.fx, {
    this.latency = const Duration(milliseconds: 300),
  });

  final ApiLog log;
  final Fx fx;
  final Duration latency;
  static const ivaRate = 0.19;
  static const limits = {1: 500000, 2: 5000000};

  final List<Charge> charges = [
    Charge(
      id: 'ch_1001',
      amount: 18900,
      method: 'Tarjeta',
      label: 'Cafetería',
      at: '09:12',
    ),
    Charge(
      id: 'ch_1002',
      amount: 42500,
      method: 'QR',
      label: 'Artesanía',
      at: '10:40',
    ),
  ];
  int kycLevel = 1;
  final Map<String, QrCharge> _qr = {};
  final Map<String, TransferQuote> _quotes = {};
  final Map<String, bool> _paidQr = {};
  final _rand = Random();
  var _seq = 1003;

  Future<void> _wait() => Future<void>.delayed(latency);

  void _log(String call, Object? req, Object? res) =>
      log.add(call, '${req == null ? '' : 'request  $req\n'}response $res');

  String _now() {
    final t = DateTime.now();
    return '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  }

  Future<Summary> summary() async {
    await _wait();
    final s = Summary(charges.fold(0, (a, c) => a + c.amount), charges.length);
    _log(
      'GET /api/v1/summary -> 200',
      null,
      '{total: ${s.total}, count: ${s.count}}',
    );
    return s;
  }

  Future<TouristQuote> touristQuote({
    required int amount,
    required String currency,
    required String category,
  }) async {
    await _wait();
    final exempt = category == 'hospedaje';
    final net = exempt ? (amount / (1 + ivaRate)).round() : amount;
    final q = TouristQuote(
      clpTotal: net,
      ivaExempt: exempt,
      ivaSaved: amount - net,
      currency: currency,
      foreignTotal: fx.round(fx.fromClp(net, currency), currency),
    );
    _log(
      'POST /api/v1/tourist/quote -> 200',
      '{amount: $amount, currency: $currency, category: $category}',
      '{clp_total: ${q.clpTotal}, iva_exempt: ${q.ivaExempt}, foreign_total: ${q.foreignTotal}}',
    );
    return q;
  }

  Future<Charge> createCharge({
    required int amount,
    required String method,
    required String label,
  }) async {
    await _wait();
    final c = Charge(
      id: 'ch_${_seq++}',
      amount: amount,
      method: method,
      label: label,
      at: _now(),
      authCode: '${100000 + _rand.nextInt(900000)}',
    );
    charges.add(c);
    _log(
      'POST /api/v1/charges -> 201',
      '{amount: $amount, method: $method}',
      '{id: ${c.id}, status: approved}',
    );
    return c;
  }

  Future<QrCharge> createQr({
    required int amount,
    required String label,
  }) async {
    await _wait();
    final id = 'qr_${_seq++}';
    final q = QrCharge(
      id: id,
      amount: amount,
      label: label,
      payload: 'pospay://charge?id=$id&amount=$amount&cur=CLP',
      expiresAt: DateTime.now().add(const Duration(seconds: 120)),
    );
    _qr[id] = q;
    _log(
      'POST /api/v1/qr/charges -> 201',
      '{amount: $amount}',
      '{id: $id, payload: ${q.payload}}',
    );
    return q;
  }

  Future<Charge> payQr(String id) async {
    await _wait();
    final q = _qr[id] ?? (throw ApiException('qr_not_found'));
    if (DateTime.now().isAfter(q.expiresAt)) throw ApiException('qr_expired');
    _paidQr[id] = true;
    return createCharge(amount: q.amount, method: 'QR', label: q.label);
  }

  Future<TransferQuote> transferQuote({
    required int amount,
    required String to,
    required String speed,
  }) async {
    await _wait();
    final rec = recipients.firstWhere((r) => r.name == to);
    final required = amount > limits[1]! ? 2 : 1;
    final q = TransferQuote(
      quoteId: 'qt_${_seq++}',
      to: to,
      amount: amount,
      speed: speed,
      fee: speed == 'instant' ? (amount * 0.008).round() : 0,
      expiresAt: DateTime.now().add(const Duration(seconds: 60)),
      recipientKyc: rec.kyc,
      senderLevel: kycLevel,
      requiredLevel: required,
      limit: limits[kycLevel]!,
    );
    _quotes[q.quoteId] = q;
    _log(
      'POST /api/v1/transfers/quote -> 200',
      '{amount: $amount, to: $to, speed: $speed}',
      '{quote_id: ${q.quoteId}, fee: ${q.fee}, recipient_kyc: ${q.recipientKyc}, required_level: $required, can_send: ${q.canSend}}',
    );
    return q;
  }

  Future<void> kycVerify() async {
    await _wait();
    kycLevel = 2;
    _log(
      'POST /api/v1/kyc/verify -> 200',
      '{customer_id: cus_demo, document: RUT, selfie: true}',
      '{status: verified, level: 2}',
    );
  }

  /// Confirma el envío validando la cotización, su vigencia y el KYC.
  Future<Transfer> transfer(String quoteId) async {
    await _wait();
    final q = _quotes[quoteId] ?? (throw ApiException('quote_not_found'));
    if (DateTime.now().isAfter(q.expiresAt)) {
      throw ApiException('quote_expired');
    }
    // El nivel del remitente puede haber subido desde que se cotizó.
    final ok = q.recipientKyc == 'verified' && kycLevel >= q.requiredLevel;
    if (!ok) throw ApiException('kyc_blocked');
    final t = Transfer(
      id: 'tr_${_seq++}',
      to: q.to,
      amount: q.amount,
      fee: q.fee,
      quoteId: quoteId,
    );
    _log(
      'POST /api/v1/transfers -> 201',
      '{quote_id: $quoteId}',
      '{id: ${t.id}, status: sent}',
    );
    return t;
  }
}
