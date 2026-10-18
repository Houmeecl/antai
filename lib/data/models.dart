/// Modelos de datos. Los nombres de campo JSON siguen la documentación de
/// dLocal Go (https://docs.dlocalgo.com/integration-api).
library;

class ApiException implements Exception {
  ApiException(this.code, [this.detail]);
  final String code;
  final String? detail;
  @override
  String toString() => detail == null ? code : '$code: $detail';
}

/// Pago de dLocal Go (POST /v1/payments, GET /v1/payments/:id).
class DPayment {
  const DPayment({
    required this.id,
    required this.amount,
    required this.currency,
    required this.status,
    required this.orderId,
    required this.redirectUrl,
    this.country,
    this.statusDetail,
    this.rejectedReason,
    this.paymentMethodType,
  });

  final String id;
  final double amount;
  final String currency;
  final String? country;

  /// PENDING, PAID, REJECTED, CANCELLED o EXPIRED.
  final String status;

  /// CREATED, PENDING_PAYMENT, PAYMENT_FAILED o null cuando está PAID.
  final String? statusDetail;
  final String orderId;
  final String redirectUrl;
  final String? rejectedReason;
  final String? paymentMethodType;

  bool get isFinal => status != 'PENDING';
  bool get isPaid => status == 'PAID';

  DPayment copyWith({
    String? status,
    String? statusDetail,
    String? rejectedReason,
    String? paymentMethodType,
    bool clearStatusDetail = false,
  }) => DPayment(
    id: id,
    amount: amount,
    currency: currency,
    country: country,
    status: status ?? this.status,
    statusDetail: clearStatusDetail
        ? null
        : (statusDetail ?? this.statusDetail),
    orderId: orderId,
    redirectUrl: redirectUrl,
    rejectedReason: rejectedReason ?? this.rejectedReason,
    paymentMethodType: paymentMethodType ?? this.paymentMethodType,
  );

  factory DPayment.fromJson(Map<String, dynamic> j) => DPayment(
    id: j['id'] as String,
    amount: (j['amount'] as num).toDouble(),
    currency: j['currency'] as String,
    country: j['country'] as String?,
    status: j['status'] as String,
    statusDetail: j['status_detail'] as String?,
    orderId: '${j['order_id']}',
    redirectUrl: (j['redirect_url'] as String?) ?? '',
    rejectedReason: j['rejected_reason'] as String?,
    paymentMethodType: j['payment_method_type'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'amount': amount,
    'currency': currency,
    'country': ?country,
    'status': status,
    'status_detail': statusDetail,
    'order_id': orderId,
    'redirect_url': redirectUrl,
    'rejected_reason': ?rejectedReason,
    'payment_method_type': ?paymentMethodType,
  };
}

/// Datos del beneficiario para POST /v1/payouts (Chile).
class Beneficiary {
  const Beneficiary({
    required this.first,
    required this.last,
    required this.email,
    required this.document,
    required this.bankCode,
    required this.account,
    required this.accountType,
    required this.flow,
  });

  final String first;
  final String last;
  final String email;

  /// RUT: de 8 a 9 caracteres alfanuméricos.
  final String document;
  final String bankCode;
  final String account;

  /// CHECKING, SAVINGS o VISTA en Chile.
  final String accountType;

  /// B2C (persona) o B2B (empresa).
  final String flow;
}

class PayoutRequest {
  const PayoutRequest({
    required this.amount,
    required this.beneficiary,
    required this.recipientName,
    required this.description,
    this.purpose = 'REWARDS',
    this.branch = '0001',
  });

  final num amount;
  final Beneficiary beneficiary;
  final String recipientName;
  final String description;
  final String purpose;
  final String branch;

  Map<String, dynamic> toJson() => {
    'transfer_amount': amount,
    'transfer_country': 'CL',
    'flow_type': beneficiary.flow,
    'purpose': purpose,
    if (beneficiary.flow == 'B2B') 'business_name': recipientName,
    'beneficiary_first_name': beneficiary.first,
    'beneficiary_last_name': beneficiary.last,
    'beneficiary_email': beneficiary.email,
    'beneficiary_document': beneficiary.document,
    'beneficiary_document_type': 'RUT',
    'bank_code': beneficiary.bankCode,
    'bank_account': beneficiary.account,
    'bank_branch': branch,
    'bank_account_type': beneficiary.accountType,
    'currency_to_pay': 'CLP',
    'description': description,
  };
}

/// Payout de dLocal Go. Estados: PENDING, PROCESSING, ON_HOLD, DELIVERED,
/// COMPLETED, CANCELLED, REJECTED, FAILED.
class DPayout {
  const DPayout({
    required this.payoutId,
    required this.status,
    required this.amount,
    required this.currency,
  });

  final String payoutId;
  final String status;
  final double amount;
  final String currency;

  bool get isCompleted => status == 'COMPLETED';

  factory DPayout.fromJson(Map<String, dynamic> j) => DPayout(
    payoutId: '${j['payout_id']}',
    status: j['status'] as String,
    amount: ((j['amount'] ?? 0) as num).toDouble(),
    currency: (j['currency_to_pay'] ?? 'CLP') as String,
  );

  Map<String, dynamic> toJson() => {
    'payout_id': payoutId,
    'status': status,
    'amount': amount,
    'currency_to_pay': currency,
  };
}

class SavedCard {
  const SavedCard({
    required this.token,
    required this.brand,
    required this.lastFour,
    required this.expiry,
    required this.holder,
    this.isDefault = false,
  });

  final String token;
  final String brand;
  final String lastFour;
  final String expiry;
  final String holder;
  final bool isDefault;

  SavedCard copyWith({bool? isDefault}) => SavedCard(
    token: token,
    brand: brand,
    lastFour: lastFour,
    expiry: expiry,
    holder: holder,
    isDefault: isDefault ?? this.isDefault,
  );
}

class Product {
  const Product(
    this.id,
    this.name,
    this.category,
    this.clp,
    this.description,
    this.colorValue,
    this.glyph,
  );
  final int id;
  final String name;
  final String category;
  final int clp;
  final String description;
  final int colorValue;
  final String glyph;
}

const products = <Product>[
  Product(
    1,
    'Chal de alpaca',
    'Artesanía',
    38900,
    'Tejido a mano en el altiplano.',
    0xFFFFD1DC,
    'A',
  ),
  Product(
    2,
    'Cerámica de Pomaire',
    'Artesanía',
    12500,
    'Tazón de greda con acabado natural.',
    0xFFF5C7A9,
    'P',
  ),
  Product(
    3,
    'Tour Torres del Paine',
    'Experiencias',
    189000,
    'Día completo con guía y almuerzo.',
    0xFFBFE3D0,
    'T',
  ),
  Product(
    4,
    'Carménère reserva',
    'Gourmet',
    15900,
    'Valle de Colchagua, botella 750 ml.',
    0xFFD9B8E8,
    'C',
  ),
  Product(
    5,
    'Collar de lapislázuli',
    'Artesanía',
    45000,
    'Piedra azul del norte de Chile.',
    0xFFB8CDF2,
    'L',
  ),
  Product(
    6,
    'Mermelada de calafate',
    'Gourmet',
    5200,
    'Frasco de 250 g de la Patagonia.',
    0xFFE6B8C9,
    'M',
  ),
  Product(
    7,
    'Navegación por glaciares',
    'Experiencias',
    98000,
    'Zarpe desde Puerto Natales.',
    0xFFB6DFE8,
    'N',
  ),
  Product(
    8,
    'Mapa ilustrado de Chile',
    'Artesanía',
    9900,
    'Lámina A3 en papel reciclado.',
    0xFFF3E2A5,
    'M',
  ),
];

/// Comprobante que se muestra al terminar un cobro, pago o envío.
class Receipt {
  const Receipt({
    required this.title,
    required this.rows,
    this.payout,
    this.inProgressTitle,
  });
  final String title;
  final String? inProgressTitle;
  final List<(String, String)> rows;
  final DPayout? payout;
}
