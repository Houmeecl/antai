import 'dart:async';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../app_state.dart';
import '../core/format.dart';
import '../core/widgets.dart';
import '../data/backend.dart';
import '../data/models.dart';
import 'receipt_screen.dart';

/// Cobro con código QR: la API genera el cobro pendiente y el cliente paga
/// escaneando. En la demo el pago se confirma con un botón.
class QrScreen extends StatefulWidget {
  const QrScreen({super.key, required this.amount, required this.label});
  final int amount;
  final String label;

  @override
  State<QrScreen> createState() => _QrScreenState();
}

class _QrScreenState extends State<QrScreen> {
  QrCharge? _qr;
  int _left = 0;
  bool _busy = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _create();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _create() async {
    final st = AppScope.read(context);
    setState(() => _qr = null);
    try {
      final q = await st.backend.createQr(
        amount: widget.amount,
        label: widget.label,
      );
      if (!mounted) return;
      setState(() {
        _qr = q;
        _left = q.expiresAt.difference(DateTime.now()).inSeconds;
      });
      _timer?.cancel();
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        final s = q.expiresAt.difference(DateTime.now()).inSeconds;
        if (!mounted) return;
        setState(() => _left = s < 0 ? 0 : s);
        if (s <= 0) _timer?.cancel();
      });
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _simulatePay() async {
    final st = AppScope.read(context);
    setState(() => _busy = true);
    try {
      final c = await st.backend.payQr(_qr!.id);
      await st.refreshSummary();
      if (!mounted) return;
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => ReceiptScreen(
            receipt: Receipt(
              title: 'Pago aprobado',
              rows: [
                ('Monto', clp(c.amount)),
                ('Método', c.method),
                ('Autorización', c.authCode ?? ''),
                ('Folio', c.id),
              ],
            ),
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        setState(() => _left = 0);
        showError(context, e);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _qr;
    final expired = q != null && _left <= 0;
    return Scaffold(
      appBar: AppBar(title: const Text('Pago con QR')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            AmountDisplay(text: thousands(widget.amount)),
            Text(
              expired
                  ? 'El código venció.'
                  : 'Pide al cliente que escanee desde su app',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Center(
              child: q == null
                  ? const SizedBox(
                      height: 240,
                      child: Center(child: CircularProgressIndicator()),
                    )
                  : Opacity(
                      opacity: expired ? 0.25 : 1,
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(22),
                        ),
                        child: QrImageView(
                          data: q.payload,
                          size: 240,
                          backgroundColor: Colors.white,
                          semanticsLabel: 'Código QR de pago',
                        ),
                      ),
                    ),
            ),
            const SizedBox(height: 12),
            if (q != null)
              SelectableText(
                q.payload,
                textAlign: TextAlign.center,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 11),
              ),
            const SizedBox(height: 8),
            if (q != null && !expired)
              Text(
                'Vence en $_left s · esperando pago',
                textAlign: TextAlign.center,
              ),
            const SizedBox(height: 20),
            PrimaryButton(
              label: expired ? 'Generar nuevo QR' : 'Simular pago del cliente',
              busy: _busy,
              onPressed: q == null ? null : (expired ? _create : _simulatePay),
            ),
          ],
        ),
      ),
    );
  }
}
