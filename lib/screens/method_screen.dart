import 'package:flutter/material.dart';

import '../app_state.dart';
import '../core/format.dart';
import '../core/widgets.dart';
import '../data/backend.dart';
import '../data/models.dart';
import 'checkout_screen.dart';
import 'qr_screen.dart';
import 'receipt_screen.dart';

enum PayMethod { card, qr, tourist, bnpl }

/// Elección del método de pago. En modo turista cotiza moneda e IVA.
class MethodScreen extends StatefulWidget {
  const MethodScreen({
    super.key,
    required this.amount,
    required this.tourist,
    required this.category,
  });
  final int amount;
  final bool tourist;
  final String category;

  @override
  State<MethodScreen> createState() => _MethodScreenState();
}

class _MethodScreenState extends State<MethodScreen> {
  PayMethod _method = PayMethod.card;
  String _currency = 'USD';
  TouristQuote? _quote;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (widget.tourist) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _requote());
    }
  }

  Future<void> _requote() async {
    final st = AppScope.read(context);
    setState(() => _quote = null);
    try {
      await st.refreshFx();
      final q = await st.backend.touristQuote(
        amount: widget.amount,
        currency: _currency,
        category: widget.category,
      );
      if (mounted) setState(() => _quote = q);
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  int get _clpTotal =>
      widget.tourist && _quote != null ? _quote!.clpTotal : widget.amount;

  Future<void> _pay() async {
    final st = AppScope.read(context);
    final nav = Navigator.of(context);
    final label = widget.tourist ? 'Turista' : 'Venta';
    setState(() => _busy = true);
    try {
      switch (_method) {
        case PayMethod.qr:
          await nav.pushReplacement(
            MaterialPageRoute<void>(
              builder: (_) => QrScreen(amount: _clpTotal, label: label),
            ),
          );
          return;
        case PayMethod.bnpl:
          final c = await st.backend.createCharge(
            amount: _clpTotal,
            method: 'Paga en 4',
            label: label,
          );
          await st.refreshSummary();
          await nav.pushReplacement(
            MaterialPageRoute<void>(
              builder: (_) => ReceiptScreen(receipt: _chargeReceipt(c)),
            ),
          );
          return;
        case PayMethod.card:
        case PayMethod.tourist:
          final foreign = _method == PayMethod.tourist && _quote != null;
          final payment = await st.dlocal.createPayment(
            currency: foreign ? _currency : 'CLP',
            amount: foreign ? _quote!.foreignTotal : _clpTotal.toDouble(),
            country: foreign ? null : 'CL',
            orderId: st.nextOrderId(),
            description: 'Venta caja 01',
          );
          final total = _clpTotal;
          final methodName = foreign
              ? 'Turista $_currency (dLocal Go)'
              : 'Tarjeta (dLocal Go)';
          await nav.pushReplacement(
            MaterialPageRoute<void>(
              builder: (_) => CheckoutScreen(
                payment: payment,
                onPaid: (paid) async {
                  final c = await st.backend.createCharge(
                    amount: total,
                    method: methodName,
                    label: label,
                  );
                  return _chargeReceipt(c, dlocalId: paid.id);
                },
              ),
            ),
          );
      }
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Receipt _chargeReceipt(Charge c, {String? dlocalId}) => Receipt(
    title: 'Pago aprobado',
    rows: [
      ('Monto', clp(c.amount)),
      ('Método', c.method),
      if (dlocalId != null) ('Pago dLocal Go', dlocalId),
      ('Autorización', c.authCode ?? ''),
      ('Folio', c.id),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context);
    final q = _quote;
    final cuota = (_clpTotal / 4).ceil();
    final options = <(PayMethod, IconData, String, String)>[
      (
        PayMethod.card,
        Icons.credit_card,
        'Tarjeta',
        'Checkout seguro de dLocal Go',
      ),
      (
        PayMethod.qr,
        Icons.qr_code_2,
        'Código QR',
        'El cliente escanea desde su app',
      ),
      if (widget.tourist)
        (
          PayMethod.tourist,
          Icons.public,
          'Pagar en $_currency',
          q == null
              ? 'Cotizando…'
              : '${moneyIn(q.foreignTotal, _currency)} · 1 $_currency = ${(st.fx.usd['CLP']! / st.fx.usd[_currency]!).toStringAsFixed(2).replaceAll('.', ',')} CLP',
        ),
      (
        PayMethod.bnpl,
        Icons.local_florist,
        'Paga en 4 cuotas',
        '${clp(cuota)} cada 2 semanas · 0% interés',
      ),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Método de pago')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              clp(_clpTotal),
              style: Theme.of(context).textTheme.displaySmall
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            if (widget.tourist) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: [
                  for (final c in st.fx.currencies.where((c) => c != 'CLP'))
                    ChoiceChip(
                      label: Text(c),
                      selected: _currency == c,
                      onSelected: (_) {
                        setState(() => _currency = c);
                        _requote();
                      },
                    ),
                ],
              ),
              const SizedBox(height: 8),
              if (q != null)
                Row(
                  children: [
                    StatusPill(
                      q.ivaExempt ? 'IVA exento' : 'Con IVA',
                      ok: q.ivaExempt,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        q.ivaExempt
                            ? 'Ahorro del turista: ${clp(q.ivaSaved)} (demo)'
                            : 'La exención aplica solo a hospedaje.',
                      ),
                    ),
                  ],
                ),
            ],
            const SizedBox(height: 16),
            for (final o in options)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Card(
                  margin: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide(
                      width: 2,
                      color: _method == o.$1
                          ? Theme.of(context).colorScheme.onSurface
                          : Theme.of(context).colorScheme.outlineVariant,
                    ),
                  ),
                  child: ListTile(
                    onTap: () => setState(() => _method = o.$1),
                    leading: Icon(o.$2),
                    title: Text(
                      o.$3,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(o.$4),
                    trailing: Icon(
                      _method == o.$1
                          ? Icons.radio_button_checked
                          : Icons.radio_button_off,
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 8),
            PrimaryButton(
              label: 'Cobrar ${clp(_clpTotal)}',
              busy: _busy,
              onPressed: _pay,
            ),
          ],
        ),
      ),
    );
  }
}
