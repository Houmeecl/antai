import 'dart:async';

import 'package:flutter/material.dart';

import '../app_state.dart';
import '../core/format.dart';
import '../core/widgets.dart';
import '../data/backend.dart';
import '../data/models.dart';
import 'receipt_screen.dart';

/// Envío de dinero: monto, destinatario y velocidad. Luego se cotiza.
class SendScreen extends StatefulWidget {
  const SendScreen({super.key});

  @override
  State<SendScreen> createState() => _SendScreenState();
}

class _SendScreenState extends State<SendScreen> {
  String _digits = '';
  String _to = recipients.first.name;
  String _speed = 'instant';
  bool _busy = false;

  int get _amount => int.tryParse(_digits) ?? 0;

  Future<void> _quote() async {
    final st = AppScope.read(context);
    setState(() => _busy = true);
    try {
      final q = await st.backend.transferQuote(
        amount: _amount,
        to: _to,
        speed: _speed,
      );
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => TransferQuoteScreen(initial: q),
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
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        AmountDisplay(text: thousands(_amount)),
        Wrap(
          spacing: 8,
          children: [
            for (final r in recipients)
              ChoiceChip(
                label: Text(r.name),
                selected: _to == r.name,
                onSelected: (_) => setState(() => _to = r.name),
              ),
          ],
        ),
        const SizedBox(height: 12),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'instant', label: Text('Al instante')),
            ButtonSegment(value: 'normal', label: Text('Mañana')),
          ],
          selected: {_speed},
          onSelectionChanged: (s) => setState(() => _speed = s.first),
        ),
        const SizedBox(height: 4),
        const Text(
          'La comisión y el KYC los define la API al cotizar',
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Keypad(onKey: (k) => setState(() => _digits = applyKey(_digits, k))),
        const SizedBox(height: 8),
        PrimaryButton(
          label: 'Cotizar envío',
          busy: _busy,
          onPressed: _amount == 0 ? null : _quote,
        ),
      ],
    );
  }
}

/// Cotización del envío: muestra comisión, KYC y vigencia.
/// Confirmar llama a la API propia y luego crea el payout en dLocal Go.
class TransferQuoteScreen extends StatefulWidget {
  const TransferQuoteScreen({super.key, required this.initial});
  final TransferQuote initial;

  @override
  State<TransferQuoteScreen> createState() => _TransferQuoteScreenState();
}

class _TransferQuoteScreenState extends State<TransferQuoteScreen> {
  late TransferQuote _q = widget.initial;
  int _left = 0;
  bool _busy = false;
  String? _error;
  Timer? _timer;

  bool get _expired => _left <= 0;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    void tick() => setState(
      () => _left = _q.expiresAt
          .difference(DateTime.now())
          .inSeconds
          .clamp(0, 9999),
    );
    tick();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      tick();
      if (_expired) _timer?.cancel();
    });
  }

  Future<void> _requote() async {
    final st = AppScope.read(context);
    final n = await st.backend.transferQuote(
      amount: _q.amount,
      to: _q.to,
      speed: _q.speed,
    );
    if (!mounted) return;
    setState(() {
      _q = n;
      _error = null;
    });
    _startTimer();
  }

  Future<void> _confirm() async {
    final st = AppScope.read(context);
    final nav = Navigator.of(context);
    setState(() => _busy = true);
    try {
      final t = await st.backend.transfer(_q.quoteId);
      final rec = recipients.firstWhere((r) => r.name == t.to);
      final payout = await st.dlocal.createPayout(
        PayoutRequest(
          amount: t.amount,
          beneficiary: rec.beneficiary,
          recipientName: rec.name,
          description: 'Envío ${t.id}',
        ),
      );
      await nav.pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => ReceiptScreen(
            receipt: Receipt(
              title: 'Dinero enviado',
              inProgressTitle: 'Envío en proceso',
              payout: payout,
              rows: [
                ('Monto', clp(t.amount)),
                ('Destino', t.to),
                ('Comisión', clp(t.fee)),
                ('Folio', t.id),
              ],
            ),
          ),
        ),
      );
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.code);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verifyKyc() async {
    final st = AppScope.read(context);
    setState(() => _busy = true);
    try {
      await st.backend.kycVerify();
      await _requote();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _q;
    const kycNames = {
      'verified': 'Verificado',
      'pending': 'Pendiente',
      'rejected': 'Rechazado',
    };
    var label = 'Confirmar envío';
    VoidCallback? action = _confirm;
    String? message;
    if (_expired) {
      label = 'Cotizar de nuevo';
      action = () async {
        setState(() => _busy = true);
        try {
          await _requote();
        } finally {
          if (mounted) setState(() => _busy = false);
        }
      };
      message = 'La cotización venció. Pide una nueva a la API.';
    } else if (q.recipientKyc == 'pending') {
      label = 'Destinatario no habilitado';
      action = null;
      message =
          'KYC del destinatario pendiente. La API no permite enviar todavía.';
    } else if (q.recipientKyc == 'rejected') {
      label = 'Destinatario no habilitado';
      action = null;
      message = 'KYC del destinatario rechazado. La API no permite enviar.';
    } else if (q.needsKyc) {
      label = 'Verificar identidad (KYC)';
      action = _verifyKyc;
      message =
          'Tu nivel ${q.senderLevel} permite hasta ${clp(q.limit)} por envío. '
          'Este monto requiere nivel ${q.requiredLevel} (RUT y selfie).';
    } else if (_error == 'kyc_blocked') {
      message = 'La API bloqueó la transferencia por KYC.';
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Cotización')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              clp(q.totalDebit),
              style: Theme.of(context).textTheme.displaySmall
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            const Text('Total a debitar, según la API'),
            const SizedBox(height: 16),
            InfoRows([
              ('Monto', clp(q.amount)),
              ('Comisión', clp(q.fee)),
              ('Destinatario', q.to),
              ('KYC destinatario', kycNames[q.recipientKyc] ?? q.recipientKyc),
              ('Tu nivel KYC', 'Nivel ${q.senderLevel}'),
              ('Cotización vence en', '$_left s'),
            ]),
            if (message != null) ...[
              const SizedBox(height: 12),
              NoteBanner(message),
            ],
            const SizedBox(height: 20),
            PrimaryButton(label: label, busy: _busy, onPressed: action),
          ],
        ),
      ),
    );
  }
}
