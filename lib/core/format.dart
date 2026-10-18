/// Formato de montos y tipos de cambio.
library;

String thousands(int n) {
  final s = n.abs().toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write('.');
    b.write(s[i]);
  }
  return '${n < 0 ? '-' : ''}$b';
}

/// Pesos chilenos: $1.234.567
String clp(num v) => '\$${thousands(v.round())}';

/// Monto en la moneda indicada (CLP, COP, USD, BRL).
String moneyIn(num v, String cur) {
  if (cur == 'CLP') return clp(v);
  if (cur == 'COP') return '${thousands(v.round())} COP';
  final cents = (v.abs() * 100).round();
  final frac = (cents % 100).toString().padLeft(2, '0');
  final prefix = cur == 'USD'
      ? 'US\$ '
      : cur == 'BRL'
      ? 'R\$ '
      : '';
  return '${v < 0 ? '-' : ''}$prefix${thousands(cents ~/ 100)},$frac';
}

/// Tipos de cambio con base USD, como los devuelve GET /v1/currency-exchanges.
class Fx {
  /// Valores de ejemplo de la documentación de dLocal Go.
  Map<String, double> usd = {
    'USD': 1,
    'CLP': 1083.9528,
    'BRL': 6.65227,
    'COP': 4689.8892,
  };

  List<String> get currencies => const ['CLP', 'USD', 'BRL', 'COP'];

  void update(Map<String, double> rates) {
    usd = {'USD': 1, ...usd, ...rates};
  }

  /// Convierte un monto en CLP a la moneda destino.
  double fromClp(num amountClp, String cur) =>
      amountClp / usd['CLP']! * usd[cur]!;

  /// Redondea según los decimales de la moneda.
  double round(double v, String cur) => (cur == 'CLP' || cur == 'COP')
      ? v.roundToDouble()
      : (v * 100).round() / 100;
}

/// Validación de tarjetas (algoritmo de Luhn) y marca.
bool luhnValid(String digits) {
  if (digits.length < 13) return false;
  var sum = 0;
  var dbl = false;
  for (var i = digits.length - 1; i >= 0; i--) {
    var x = int.parse(digits[i]);
    if (dbl) {
      x *= 2;
      if (x > 9) x -= 9;
    }
    sum += x;
    dbl = !dbl;
  }
  return sum % 10 == 0;
}

String cardBrand(String digits) {
  if (digits.startsWith('4')) return 'Visa';
  if (RegExp(r'^(5[1-5]|2[2-7])').hasMatch(digits)) return 'Mastercard';
  if (RegExp(r'^3[47]').hasMatch(digits)) return 'Amex';
  return 'Tarjeta';
}
