import 'package:flutter/material.dart';

import '../app_state.dart';
import '../core/widgets.dart';
import '../data/models.dart';
import 'checkout_screen.dart';
import 'receipt_screen.dart';

/// Tienda para turistas: catálogo, moneda y acceso al carrito.
class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  String _cat = 'Todo';

  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context);
    final list = products
        .where((p) => _cat == 'Todo' || p.category == _cat)
        .toList();
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'fab-shop',
        onPressed: () => Navigator.of(context)
            .push(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
        icon: const Icon(Icons.shopping_bag_outlined),
        label: Text('Carrito (${st.cartCount})'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
        children: [
          Text(
            'Chile para llevar',
            style: Theme.of(context).textTheme.headlineMedium
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          const Text(
            'Paga en tu moneda: los precios usan el tipo de cambio de dLocal Go.',
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              for (final c in st.fx.currencies)
                ChoiceChip(
                  label: Text(c),
                  selected: st.currency == c,
                  onSelected: (_) => st.setCurrency(c),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final c in const [
                'Todo',
                'Artesanía',
                'Experiencias',
                'Gourmet',
              ])
                FilterChip(
                  label: Text(c),
                  selected: _cat == c,
                  onSelected: (_) => setState(() => _cat = c),
                ),
            ],
          ),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: list.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.66,
            ),
            itemBuilder: (_, i) => _ProductCard(product: list[i]),
          ),
        ],
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    final st = AppScope.read(context);
    final cs = Theme.of(context).colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: cs.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            height: 92,
            color: Color(product.colorValue),
            alignment: Alignment.center,
            child: Text(
              product.glyph,
              style: const TextStyle(
                fontSize: 44,
                fontWeight: FontWeight.w800,
                color: Color(0xCC17111A),
              ),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.category,
                    style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant),
                  ),
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const Spacer(),
                  ListenableBuilder(
                    listenable: st,
                    builder: (_, _) => Text(
                      st.priceText(product.clp),
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => st.addToCart(product.id),
                      style: FilledButton.styleFrom(
                        shape: const StadiumBorder(),
                      ),
                      child: const Text('Agregar'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context);
    final lines = [
      for (final e in st.cart.entries)
        (products.firstWhere((p) => p.id == e.key), e.value),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Carrito')),
      body: SafeArea(
        child: lines.isEmpty
            ? const Center(child: Text('Tu carrito está vacío.'))
            : ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  for (final (p, q) in lines)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(p.name),
                      subtitle: Row(
                        children: [
                          IconButton(
                            tooltip: 'Quitar uno',
                            onPressed: () => st.changeQty(p.id, -1),
                            icon: const Icon(Icons.remove_circle_outline),
                          ),
                          Text('$q'),
                          IconButton(
                            tooltip: 'Agregar uno',
                            onPressed: () => st.changeQty(p.id, 1),
                            icon: const Icon(Icons.add_circle_outline),
                          ),
                        ],
                      ),
                      trailing: Text(
                        st.priceText(p.clp * q),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  const Divider(),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text(
                      'Total',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    trailing: Text(
                      st.priceText(st.cartTotalClp),
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  PrimaryButton(
                    label: 'Ir a pagar',
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const ShopCheckoutScreen(),
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

/// Pago de la tienda: tarjeta guardada (solo simulado) o checkout de dLocal Go.
class ShopCheckoutScreen extends StatefulWidget {
  const ShopCheckoutScreen({super.key});

  @override
  State<ShopCheckoutScreen> createState() => _ShopCheckoutScreenState();
}

class _ShopCheckoutScreenState extends State<ShopCheckoutScreen> {
  final _email = TextEditingController(text: 'turista@example.com');
  String? _sel; // token o 'new'
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Receipt _receipt(
    String orderId,
    String paymentId,
    String card,
    String total,
    List<String> items,
  ) => Receipt(
    title: 'Pago aprobado',
    rows: [
      ('Pedido', orderId),
      ('Pago dLocal Go', paymentId),
      ('Tarjeta', card),
      for (final i in items) ('Artículo', i),
      ('Total', total),
    ],
  );

  Future<void> _pay() async {
    final st = AppScope.read(context);
    final nav = Navigator.of(context);
    if (!RegExp(r'^\S+@\S+\.\S+$').hasMatch(_email.text.trim())) {
      return setState(() => _error = 'Ingresa un correo válido.');
    }
    final token =
        _sel ??
        (st.isMock && st.cards.isNotEmpty
            ? (st.cards.firstWhere(
                (c) => c.isDefault,
                orElse: () => st.cards.first,
              )).token
            : 'new');
    final items = [
      for (final e in st.cart.entries)
        '${e.value} × ${products.firstWhere((p) => p.id == e.key).name}',
    ];
    final total = st.priceText(st.cartTotalClp);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final orderId = st.nextOrderId();
      final payment = await st.dlocal.createPayment(
        currency: st.currency,
        amount: st.priceIn(st.cartTotalClp),
        country: null,
        orderId: orderId,
        description: 'Pedido $orderId',
        cardToken: token == 'new' ? null : token,
      );
      if (token != 'new') {
        if (!payment.isPaid) {
          setState(
            () => _error =
                'Pago rechazado: ${payment.rejectedReason}. Prueba con otra tarjeta.',
          );
          return;
        }
        final c = st.cards.firstWhere((c) => c.token == token);
        st.log.add(
          'dLocal Go → tu servidor · POST notification_url',
          '{"payment_id":"${payment.id}"}',
        );
        final got = await st.dlocal.getPayment(payment.id);
        st.clearCart();
        await nav.pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => ReceiptScreen(
              receipt: _receipt(
                orderId,
                got.id,
                '${c.brand} •••• ${c.lastFour}',
                total,
                items,
              ),
            ),
          ),
        );
        return;
      }
      await nav.pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => CheckoutScreen(
            payment: payment,
            onPaid: (paid) async {
              st.clearCart();
              return _receipt(
                orderId,
                paid.id,
                'Tarjeta (dLocal Go)',
                total,
                items,
              );
            },
          ),
        ),
      );
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context);
    final saved = st.isMock ? st.cards : const <SavedCard>[];
    final sel =
        _sel ??
        (saved.isEmpty
            ? 'new'
            : saved
                  .firstWhere((c) => c.isDefault, orElse: () => saved.first)
                  .token);
    return Scaffold(
      appBar: AppBar(title: const Text('Pagar')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              st.priceText(st.cartTotalClp),
              style: Theme.of(context).textTheme.displaySmall
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            Text('Se cobra en ${st.currency}'),
            const SizedBox(height: 16),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Correo',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            for (final c in saved)
              ListTile(
                selected: sel == c.token,
                leading: Icon(
                  sel == c.token
                      ? Icons.radio_button_checked
                      : Icons.radio_button_off,
                ),
                title: Text('${c.brand} •••• ${c.lastFour}'),
                subtitle: Text(c.holder),
                onTap: () => setState(() => _sel = c.token),
              ),
            ListTile(
              selected: sel == 'new',
              leading: Icon(
                sel == 'new'
                    ? Icons.radio_button_checked
                    : Icons.radio_button_off,
              ),
              title: const Text('Usar otra tarjeta'),
              subtitle: const Text('Pagas en el checkout de dLocal Go'),
              onTap: () => setState(() => _sel = 'new'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            const SizedBox(height: 16),
            PrimaryButton(
              label: 'Pagar ${st.priceText(st.cartTotalClp)}',
              busy: _busy,
              onPressed: _pay,
            ),
          ],
        ),
      ),
    );
  }
}
