import 'package:flutter/material.dart';

import '../app_state.dart';
import '../core/format.dart';
import 'amount_screen.dart';

/// Inicio del POS: ventas del día y accesos a cobrar.
class CajaScreen extends StatefulWidget {
  const CajaScreen({super.key, required this.onSend});

  /// Cambia a la pestaña de envío de dinero.
  final VoidCallback onSend;

  @override
  State<CajaScreen> createState() => _CajaScreenState();
}

class _CajaScreenState extends State<CajaScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => AppScope.read(context).refreshSummary(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context);
    final cs = Theme.of(context).colorScheme;
    final s = st.summary;
    final last = st.backend.charges.reversed.take(4).toList();
    void open(bool tourist) => Navigator.of(context)
        .push(
          MaterialPageRoute<void>(
            builder: (_) => AmountScreen(tourist: tourist),
          ),
        )
        .then((_) => st.refreshSummary());

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: cs.primaryContainer,
            borderRadius: BorderRadius.circular(26),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Ventas de hoy',
                style: TextStyle(
                  color: cs.onPrimaryContainer.withValues(alpha: .75),
                ),
              ),
              Text(
                s == null ? '…' : clp(s.total),
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: cs.onPrimaryContainer,
                ),
              ),
              Text(
                s == null ? 'Consultando API…' : '${s.count} cobros aprobados',
                style: TextStyle(
                  color: cs.onPrimaryContainer.withValues(alpha: .75),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _Tile(
                icon: Icons.credit_card,
                title: 'Cobrar',
                sub: 'Tarjeta, QR o cuotas',
                onTap: () => open(false),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _Tile(
                icon: Icons.luggage,
                title: 'Turista',
                sub: 'Moneda extranjera e IVA',
                onTap: () => open(true),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _Tile(
          icon: Icons.send,
          title: 'Enviar dinero',
          sub: 'Transferencia a contactos y proveedores',
          onTap: widget.onSend,
          wide: true,
        ),
        const SizedBox(height: 20),
        Text(
          'ÚLTIMOS COBROS',
          style: Theme.of(context).textTheme.labelMedium
              ?.copyWith(color: cs.outline, letterSpacing: 1),
        ),
        for (final c in last)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(c.label),
            subtitle: Text('${c.method} · ${c.at}'),
            trailing: Text(
              clp(c.amount),
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.title,
    required this.sub,
    required this.onTap,
    this.wide = false,
  });
  final IconData icon;
  final String title;
  final String sub;
  final VoidCallback onTap;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: wide
              ? Row(
                  children: [
                    Icon(icon, size: 26),
                    const SizedBox(width: 14),
                    Expanded(child: _text(context)),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(icon, size: 26),
                    const SizedBox(height: 10),
                    _text(context),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _text(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        title,
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
      ),
      Text(
        sub,
        style: TextStyle(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
          fontSize: 12,
        ),
      ),
    ],
  );
}
