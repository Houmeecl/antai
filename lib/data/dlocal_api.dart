/// Cliente de dLocal Go: implementación real (HTTP) y simulada.
///
/// Endpoints según https://docs.dlocalgo.com/integration-api :
/// - GET  /v1/currency-exchanges
/// - POST /v1/payments        -> devuelve `redirect_url`
/// - GET  /v1/payments/:id
/// - POST /v1/payouts
/// - GET  /v1/payouts/:id
library;

import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'models.dart';

/// Configuración por `--dart-define`. Sin claves se usa el modo simulado.
class Config {
  static const useMock = bool.fromEnvironment('USE_MOCK', defaultValue: true);
  static const baseUrl = String.fromEnvironment(
    'DLOCAL_BASE',
    defaultValue: 'https://api-sbx.dlocalgo.com',
  );
  static const apiKey = String.fromEnvironment('DLOCAL_API_KEY');
  static const secretKey = String.fromEnvironment('DLOCAL_SECRET_KEY');
  static const notificationUrl = String.fromEnvironment(
    'NOTIFICATION_URL',
    defaultValue: 'https://tu-servidor.example/notifications',
  );
}

class LogEntry {
  LogEntry(this.title, this.body) : at = DateTime.now();
  final String title;
  final String body;
  final DateTime at;
}

/// Registro de llamadas a la API, visible desde la app.
class ApiLog extends ChangeNotifier {
  final List<LogEntry> entries = [];

  void add(String title, String body) {
    entries.insert(0, LogEntry(title, body));
    if (entries.length > 60) entries.removeLast();
    notifyListeners();
  }
}

abstract class DlocalApi {
  /// GET /v1/currency-exchanges: tasas USD -> moneda.
  Future<Map<String, double>> currencyExchanges();

  /// POST /v1/payments. [cardToken] solo existe en el modo simulado.
  Future<DPayment> createPayment({
    required String currency,
    required double amount,
    String? country,
    required String orderId,
    required String description,
    String? cardToken,
  });

  Future<DPayment> getPayment(String id);

  Future<DPayout> createPayout(PayoutRequest request);

  Future<DPayout> getPayout(String id);

  /// Registro de tarjeta. dLocal Go no documenta este paso: solo simulado.
  Future<SavedCard> tokenizeCard({
    required String number,
    required String holder,
    required int month,
    required int year,
  });
}

/// Implementación real. Las claves van en el cliente solo para pruebas en
/// sandbox: en producción las llamadas deben pasar por tu servidor.
class DlocalGoClient implements DlocalApi {
  DlocalGoClient({
    required this.baseUrl,
    required this.apiKey,
    required this.secretKey,
    required this.log,
    http.Client? client,
  }) : _http = client ?? http.Client();

  final String baseUrl;
  final String apiKey;
  final String secretKey;
  final ApiLog log;
  final http.Client _http;

  Map<String, String> get _headers => {
    'Authorization': 'Bearer $apiKey:$secretKey',
    'Content-Type': 'application/json',
  };

  Future<dynamic> _send(
    String method,
    String path, [
    Map<String, dynamic>? body,
  ]) async {
    final uri = Uri.parse('$baseUrl$path');
    final req = http.Request(method, uri)..headers.addAll(_headers);
    if (body != null) req.body = jsonEncode(body);
    final res = await http.Response.fromStream(await _http.send(req));
    log.add(
      '$method $path -> ${res.statusCode}',
      'Authorization: Bearer API_KEY:SECRET_KEY\n'
          '${body == null ? '' : 'request  ${jsonEncode(body)}\n'}response ${res.body}',
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException('http_${res.statusCode}', res.body);
    }
    return jsonDecode(res.body);
  }

  @override
  Future<Map<String, double>> currencyExchanges() async {
    final list = await _send('GET', '/v1/currency-exchanges') as List<dynamic>;
    return {
      for (final e in list.cast<Map<String, dynamic>>())
        e['target_currency'] as String: (e['value'] as num).toDouble(),
    };
  }

  @override
  Future<DPayment> createPayment({
    required String currency,
    required double amount,
    String? country,
    required String orderId,
    required String description,
    String? cardToken,
  }) async {
    if (cardToken != null) {
      throw ApiException(
        'unsupported',
        'El pago con token no está documentado; usa el checkout.',
      );
    }
    final json = await _send('POST', '/v1/payments', {
      'currency': currency,
      'amount': amount,
      'country': ?country,
      'order_id': orderId,
      'description': description,
      'notification_url': Config.notificationUrl,
      'payment_type': 'CREDIT_CARD,DEBIT_CARD',
    });
    return DPayment.fromJson(json as Map<String, dynamic>);
  }

  @override
  Future<DPayment> getPayment(String id) async => DPayment.fromJson(
    await _send('GET', '/v1/payments/$id') as Map<String, dynamic>,
  );

  @override
  Future<DPayout> createPayout(PayoutRequest request) async => DPayout.fromJson(
    await _send('POST', '/v1/payouts', request.toJson())
        as Map<String, dynamic>,
  );

  @override
  Future<DPayout> getPayout(String id) async => DPayout.fromJson(
    await _send('GET', '/v1/payouts/$id') as Map<String, dynamic>,
  );

  @override
  Future<SavedCard> tokenizeCard({
    required String number,
    required String holder,
    required int month,
    required int year,
  }) => throw ApiException(
    'unsupported',
    'El registro de tarjetas solo existe en modo simulado.',
  );
}

/// Simulación local de dLocal Go para desarrollar sin claves.
class MockDlocal implements DlocalApi {
  MockDlocal(
    this.log, {
    this.latency = const Duration(milliseconds: 350),
    Map<String, double>? rates,
  }) : _rates =
           rates ?? const {'BRL': 6.65227, 'CLP': 1083.9528, 'COP': 4689.8892};

  final ApiLog log;
  final Duration latency;
  final Map<String, double> _rates;
  final Map<String, DPayment> _payments = {};
  final Map<String, ({DPayout payout, int polls})> _payouts = {};
  final Map<String, String> _tokenOutcome = {};
  final _rand = Random();
  var _seq = 54000;

  /// Tarjetas de prueba de la documentación de dLocal Go.
  static const approved = {'4111111111111111', '4242424242424242'};
  static const rejected = {
    '5555555555554444': 'REJECTED_BY_BANK',
    '4000056655665556': 'INSUFFICIENT_AMOUNT',
    '5120350100064537': 'REJECTED_HIGH_RISK',
  };

  Future<void> _wait() => Future<void>.delayed(latency);

  void _log(String title, Object? req, Object? res) => log.add(
    title,
    'Authorization: Bearer API_KEY:SECRET_KEY\n'
    '${req == null ? '' : 'request  ${jsonEncode(req)}\n'}response ${jsonEncode(res)}',
  );

  @override
  Future<Map<String, double>> currencyExchanges() async {
    await _wait();
    _log('GET /v1/currency-exchanges -> 200', null, [
      for (final e in _rates.entries)
        {'source_currency': 'USD', 'target_currency': e.key, 'value': e.value},
    ]);
    return Map.of(_rates);
  }

  @override
  Future<DPayment> createPayment({
    required String currency,
    required double amount,
    String? country,
    required String orderId,
    required String description,
    String? cardToken,
  }) async {
    await _wait();
    final id = 'DP-${_seq++}';
    final tok = List.generate(
      32,
      (_) => 'abcdefghijklmnopqrstuvwxyz0123456789'[_rand.nextInt(36)],
    ).join();
    var p = DPayment(
      id: id,
      amount: amount,
      currency: currency,
      country: country,
      status: 'PENDING',
      statusDetail: 'CREATED',
      orderId: orderId,
      redirectUrl: 'https://checkout-sbx.dlocalgo.com/validate/$tok',
    );
    if (cardToken != null) {
      final outcome = _tokenOutcome[cardToken];
      p = outcome == 'APPROVED'
          ? p.copyWith(
              status: 'PAID',
              paymentMethodType: 'CREDIT_CARD',
              clearStatusDetail: true,
            )
          : p.copyWith(
              status: 'REJECTED',
              statusDetail: 'PAYMENT_FAILED',
              rejectedReason: outcome ?? 'TOKEN_NOT_FOUND',
            );
    }
    _payments[id] = p;
    _log('POST /v1/payments -> 200', {
      'currency': currency,
      'amount': amount,
      'country': ?country,
      'order_id': orderId,
      'description': description,
      'notification_url': Config.notificationUrl,
      'card_token': ?cardToken,
    }, p.toJson());
    return p;
  }

  /// Simula el intento de pago en el checkout alojado (redirect_url).
  /// Un rechazo deja el pago PENDING con PAYMENT_FAILED, como en dLocal Go.
  Future<DPayment> attemptCard(String id, String number) async {
    await _wait();
    final n = number.replaceAll(RegExp(r'\s'), '');
    var p = _payments[id] ?? (throw ApiException('payment_not_found'));
    if (approved.contains(n)) {
      p = p.copyWith(
        status: 'PAID',
        paymentMethodType: 'CREDIT_CARD',
        clearStatusDetail: true,
      );
    } else {
      p = p.copyWith(
        statusDetail: 'PAYMENT_FAILED',
        rejectedReason: rejected[n] ?? 'CARD_INVALID',
      );
    }
    _payments[id] = p;
    return p;
  }

  @override
  Future<DPayment> getPayment(String id) async {
    await _wait();
    final p = _payments[id] ?? (throw ApiException('payment_not_found'));
    _log('GET /v1/payments/$id -> 200', null, p.toJson());
    return p;
  }

  @override
  Future<DPayout> createPayout(PayoutRequest request) async {
    await _wait();
    final j = request.toJson();
    const required = [
      'transfer_amount',
      'transfer_country',
      'flow_type',
      'purpose',
      'beneficiary_first_name',
      'beneficiary_last_name',
      'beneficiary_document',
      'beneficiary_document_type',
      'bank_code',
      'bank_account',
      'bank_branch',
      'bank_account_type',
      'currency_to_pay',
    ];
    final missing = [
      for (final k in required)
        if (j[k] == null || '${j[k]}'.isEmpty) k,
    ];
    if (missing.isNotEmpty) {
      throw ApiException('missing_fields', missing.join(', '));
    }
    final id = '${63466138405171 + _seq++}';
    final payout = DPayout(
      payoutId: id,
      status: 'PENDING',
      amount: request.amount.toDouble(),
      currency: 'CLP',
    );
    _payouts[id] = (payout: payout, polls: 0);
    _log('POST /v1/payouts -> 200', j, payout.toJson());
    return payout;
  }

  /// Cada consulta avanza el estado: PENDING -> PROCESSING -> COMPLETED.
  @override
  Future<DPayout> getPayout(String id) async {
    await _wait();
    final cur = _payouts[id] ?? (throw ApiException('payout_not_found'));
    final polls = cur.polls + 1;
    final next = DPayout(
      payoutId: id,
      status: polls > 1 ? 'COMPLETED' : 'PROCESSING',
      amount: cur.payout.amount,
      currency: cur.payout.currency,
    );
    _payouts[id] = (payout: next, polls: polls);
    _log('GET /v1/payouts/$id -> 200', null, next.toJson());
    return next;
  }

  @override
  Future<SavedCard> tokenizeCard({
    required String number,
    required String holder,
    required int month,
    required int year,
  }) async {
    await _wait();
    final token = 'tok_${_rand.nextInt(1 << 32).toRadixString(36)}';
    _tokenOutcome[token] = approved.contains(number)
        ? 'APPROVED'
        : (rejected[number] ?? 'CARD_NOT_ALLOWED_SANDBOX');
    final masked =
        '${number.substring(0, 6)}******${number.substring(number.length - 4)}';
    log.add(
      'POST /v1/cards -> 201',
      'request  {"number":"$masked","cvv":"***","holder":"$holder"}\nresponse {"token":"$token"}',
    );
    String two(int v) => v.toString().padLeft(2, '0');
    return SavedCard(
      token: token,
      brand: _brand(number),
      lastFour: number.substring(number.length - 4),
      expiry: '${two(month)}/${two(year % 100)}',
      holder: holder,
    );
  }

  static String _brand(String n) => n.startsWith('4')
      ? 'Visa'
      : RegExp(r'^(5[1-5]|2[2-7])').hasMatch(n)
      ? 'Mastercard'
      : RegExp(r'^3[47]').hasMatch(n)
      ? 'Amex'
      : 'Tarjeta';
}
