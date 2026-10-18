import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/widgets.dart';
import 'method_screen.dart';

/// Teclado para ingresar el monto a cobrar (cobro normal o turista).
class AmountScreen extends StatefulWidget {
  const AmountScreen({super.key, required this.tourist});
  final bool tourist;

  @override
  State<AmountScreen> createState() => _AmountScreenState();
}

class _AmountScreenState extends State<AmountScreen> {
  String _digits = '';
  String _category = 'comercio';

  int get _amount => int.tryParse(_digits) ?? 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.tourist ? 'Cobro turista' : 'Nuevo cobro'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            AmountDisplay(text: thousands(_amount)),
            Text(
              _amount == 0 ? 'Ingresa el monto a cobrar' : '',
              textAlign: TextAlign.center,
            ),
            if (widget.tourist) ...[
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'comercio', label: Text('Comercio')),
                  ButtonSegment(value: 'hospedaje', label: Text('Hospedaje')),
                ],
                selected: {_category},
                onSelectionChanged: (s) => setState(() => _category = s.first),
              ),
            ],
            const SizedBox(height: 8),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              children: [
                for (final v in const [5000, 10000, 20000, 50000])
                  ActionChip(
                    label: Text(clp(v)),
                    onPressed: () => setState(() => _digits = '$v'),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Keypad(
              onKey: (k) => setState(() => _digits = applyKey(_digits, k)),
            ),
            const SizedBox(height: 8),
            PrimaryButton(
              label: 'Continuar',
              onPressed: _amount == 0
                  ? null
                  : () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => MethodScreen(
                          amount: _amount,
                          tourist: widget.tourist,
                          category: _category,
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
