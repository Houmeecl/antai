import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../app_state.dart';
import '../core/format.dart';
import '../core/widgets.dart';
import '../data/dlocal_api.dart';
import '../data/models.dart';
import 'receipt_screen.dart';

/// Paso de checkout de dLocal Go.
///
/// Flujo documentado: crear el pago, enviar al cliente a `redirect_url`,
/// recibir la notificación (solo trae `payment_id`) y consultar el estado.
/// En modo simulado el checkout se dibuja aquí; en modo real se abre el
/// navegador y se consulta el estado hasta que deje de estar PENDING.
class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({
    super.key,
    required this.payment,
    required this.onPaid,
  });
  final DPayment payment;

  /// Se llama con el pago confirmado (PAID) y devuelve el comprobante.
  final Future<Receipt> Function(DPayment paid) onPaid;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _number = TextEditingController(text: '4111 1111 1111 1111');
  final _expiry = TextEditingController(text: '12/30');
  final _cvv = TextEditingController(text: '123');
  String? _error;
  bool _busy = false;
  Timer? _poll;

  @override
  void dispose() {
    _poll?.cancel();
    _number.dispose();
    _expiry.dispose();
    _cvv.dispose();
    super.dispose();
  }

  Future<void> _finish(DPayment paid) async {
    final st = AppScope.read(context);
    final receipt = await widget.onPaid(paid);
    await st.refreshSummary();
    if (!mounted) return;
    await Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => ReceiptScreen(receipt: receipt)),
    );
  }

  Future<void> _paySimulated() async {
    final st = AppScope.read(context);
    final mock = st.dlocal as MockDlocal;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final p = await mock.attemptCard(widget.payment.id, _number.text);
      if (!p.isPaid) {
        if (mounted) setState(() => _error = p.rejectedReason);
        return;
      }
      st.log.add(
        'dLocal Go → tu servidor · POST notification_url',
        '{"payment_id":"${p.id}"}',
      );
      await _finish(await st.dlocal.getPayment(p.id));
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openReal() async {
    final st = AppScope.read(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    final ok = await launchUrl(
      Uri.parse(widget.payment.redirectUrl),
      mode: LaunchMode.externalApplication,
    );
    if (!ok) {
      if (mounted) {
        setState(() => _busy = false);
        showError(context, 'No se pudo abrir el checkout');
      }
      return;
    }
    // Sin servidor que reciba la notificación, se consulta el estado cada 3 s.
    _poll = Timer.periodic(const Duration(seconds: 3), (t) async {
      try {
        final p = await st.dlocal.getPayment(widget.payment.id);
        if (!p.isFinal) return;
        t.cancel();
        if (p.isPaid) {
          await _finish(p);
        } else if (mounted) {
          setState(() {
            _busy = false;
            _error = p.rejectedReason ?? p.status;
          });
        }
      } catch (_) {
        // Se reintenta en el siguiente ciclo.
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final st = AppScope.read(context);
    final p = widget.payment;
    final amount = moneyIn(p.amount, p.currency);
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout dLocal Go')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            SelectableText(
              p.redirectUrl,
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 11,
                color: Theme.of(context).colorScheme.outline,
              ),
            ),
            AmountDisplay(
              text: amount.replaceAll(RegExp(r'^(US\$ |R\$ )'), ''),
              prefix: p.currency,
            ),
            Text(
              '${p.country == null ? 'El checkout pide el país del pagador. ' : ''}Pago ${p.id} · estado ${p.status}',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            if (st.isMock) ...[
              const NoteBanner(
                'Checkout simulado (sandbox). Usa las tarjetas de prueba de dLocal Go.',
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _number,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  CardNumberFormatter(),
                ],
                decoration: const InputDecoration(
                  labelText: 'Número de tarjeta (sandbox)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _expiry,
                      keyboardType: TextInputType.number,
                      inputFormatters: [ExpiryFormatter()],
                      decoration: const InputDecoration(
                        labelText: 'Vence',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _cvv,
                      keyboardType: TextInputType.number,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'CVV',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  for (final c in testCards)
                    ActionChip(
                      label: Text('${c.$1} ${c.$2.substring(c.$2.length - 4)}'),
                      onPressed: () => setState(() => _number.text = c.$2),
                    ),
                ],
              ),
            ] else
              const NoteBanner(
                'Se abrirá el checkout seguro de dLocal Go en el navegador. Al terminar, vuelve a la app.',
              ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  const StatusPill('Rechazado', ok: false),
                  const SizedBox(width: 8),
                  Expanded(child: Text('$_error. Prueba otra tarjeta.')),
                ],
              ),
            ],
            const SizedBox(height: 20),
            PrimaryButton(
              label: st.isMock
                  ? 'Pagar $amount'
                  : 'Abrir checkout de dLocal Go',
              busy: _busy,
              onPressed: st.isMock ? _paySimulated : _openReal,
            ),
          ],
        ),
      ),
    );
  }
}
