import 'package:flutter/widgets.dart';

import 'core/format.dart';
import 'data/backend.dart';
import 'data/dlocal_api.dart';
import 'data/models.dart';

/// Estado global: servicios, carrito de la tienda y tarjetas guardadas.
class AppState extends ChangeNotifier {
  AppState({DlocalApi? dlocal, MockBackend? backend, ApiLog? log})
    : log = log ?? ApiLog() {
    this.backend = backend ?? MockBackend(this.log, fx);
    this.dlocal =
        dlocal ??
        (Config.useMock
            ? MockDlocal(this.log)
            : DlocalGoClient(
                baseUrl: Config.baseUrl,
                apiKey: Config.apiKey,
                secretKey: Config.secretKey,
                log: this.log,
              ));
  }

  final ApiLog log;
  final Fx fx = Fx();
  late final MockBackend backend;
  late final DlocalApi dlocal;

  bool get isMock => dlocal is MockDlocal;

  Summary? summary;
  final List<SavedCard> cards = [];
  final Map<int, int> cart = {};
  String currency = 'CLP';
  int _order = 1000;

  String nextOrderId() => 'ORD-${++_order}';

  Future<void> refreshSummary() async {
    summary = await backend.summary();
    notifyListeners();
  }

  /// Carga los tipos de cambio de dLocal Go.
  Future<void> refreshFx() async {
    final rates = await dlocal.currencyExchanges();
    fx.update(rates);
    notifyListeners();
  }

  void setCurrency(String c) {
    currency = c;
    notifyListeners();
  }

  /// Precio de un monto en CLP expresado en la moneda elegida.
  double priceIn(num clpAmount) =>
      fx.round(fx.fromClp(clpAmount, currency), currency);

  String priceText(num clpAmount) => moneyIn(priceIn(clpAmount), currency);

  void addToCart(int id) {
    cart[id] = (cart[id] ?? 0) + 1;
    notifyListeners();
  }

  void changeQty(int id, int delta) {
    final n = (cart[id] ?? 0) + delta;
    if (n <= 0) {
      cart.remove(id);
    } else {
      cart[id] = n;
    }
    notifyListeners();
  }

  int get cartCount => cart.values.fold(0, (a, b) => a + b);

  int get cartTotalClp => cart.entries.fold(
    0,
    (a, e) => a + products.firstWhere((p) => p.id == e.key).clp * e.value,
  );

  void addCard(SavedCard c) {
    for (var i = 0; i < cards.length; i++) {
      cards[i] = cards[i].copyWith(isDefault: false);
    }
    cards.add(c.copyWith(isDefault: true));
    notifyListeners();
  }

  void setDefaultCard(String token) {
    for (var i = 0; i < cards.length; i++) {
      cards[i] = cards[i].copyWith(isDefault: cards[i].token == token);
    }
    notifyListeners();
  }

  void removeCard(String token) {
    cards.removeWhere((c) => c.token == token);
    if (cards.isNotEmpty && !cards.any((c) => c.isDefault)) {
      cards[0] = cards[0].copyWith(isDefault: true);
    }
    notifyListeners();
  }

  void clearCart() {
    cart.clear();
    notifyListeners();
  }
}

/// Acceso al estado desde cualquier pantalla.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child})
    : super(notifier: state);

  static AppState of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppScope>()!.notifier!;

  static AppState read(BuildContext context) =>
      context.getInheritedWidgetOfExactType<AppScope>()!.notifier!;
}
