import 'package:flutter/material.dart';

import '../app_state.dart';
import '../core/widgets.dart';
import '../data/models.dart';

class ReceiptScreen extends StatefulWidget {
  const ReceiptScreen({super.key, required this.receipt});
  final Receipt receipt;

  @override
  State<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends State<ReceiptScreen> {
  late DPayout? _payout = widget.receipt.payout;
  bool _busy = false;

  Future<void> _refreshPayout() async {
    final st = AppScope.read(context);
    final id = _payout!.payoutId;
    setState(() => _busy = true);
    try {
      if (st.isMock) {
        st.log.add(
          'dLocal Go → tu servidor · POST notification_url',
          '{"payout_id":"$id"}',
        );
      }
      final p = await st.dlocal.getPayout(id);
      if (mounted) setState(() => _payout = p);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.receipt;
    final cs = Theme.of(context).colorScheme;
    final done = _payout == null || _payout!.isCompleted;
    final rows = [
      ...r.rows,
      if (_payout != null) ('Payout dLocal Go', _payout!.payoutId),
    ];
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const SizedBox(height: 24),
            Center(
              child: CircleAvatar(
                radius: 40,
                backgroundColor: cs.primaryContainer,
                child: Icon(
                  Icons.check,
                  size: 44,
                  color: cs.onPrimaryContainer,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              done ? r.title : (r.inProgressTitle ?? r.title),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineMedium
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 20),
            InfoRows(rows),
            if (_payout != null) ...[
              const SizedBox(height: 12),
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                children: [
                  const Text('Estado del envío:'),
                  StatusPill(_payout!.status, ok: _payout!.isCompleted),
                ],
              ),
              const SizedBox(height: 12),
              if (!_payout!.isCompleted)
                OutlinedButton(
                  onPressed: _busy ? null : _refreshPayout,
                  child: Text(
                    AppScope.read(context).isMock
                        ? 'Simular notificación de dLocal Go'
                        : 'Actualizar estado',
                  ),
                ),
            ],
            const SizedBox(height: 24),
            PrimaryButton(
              label: 'Volver al inicio',
              onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
            ),
          ],
        ),
      ),
    );
  }
}
