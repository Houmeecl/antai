import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'format.dart';

/// Monto grande, estilo Klarna / Cash App.
class AmountDisplay extends StatelessWidget {
  const AmountDisplay({super.key, required this.text, this.prefix = 'CLP'});
  final String text;
  final String prefix;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Semantics(
      label: 'Monto $text $prefix',
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                prefix,
                style: t.titleMedium?.copyWith(
                  color: Theme.of(context).colorScheme.outline,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                text,
                style: t.displayMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Teclado numérico de 3x4.
class Keypad extends StatelessWidget {
  const Keypad({super.key, required this.onKey});
  final ValueChanged<String> onKey;

  static const keys = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '00',
    '0',
    '⌫',
  ];

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 2.1,
      children: [
        for (final k in keys)
          InkResponse(
            key: ValueKey('key-$k'),
            onTap: () {
              HapticFeedback.selectionClick();
              onKey(k);
            },
            radius: 40,
            child: Center(
              child: k == '⌫'
                  ? const Icon(
                      Icons.backspace_outlined,
                      semanticLabel: 'Borrar',
                    )
                  : Text(
                      k,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
            ),
          ),
      ],
    );
  }
}

/// Edita un monto entero a partir de las teclas del [Keypad].
String applyKey(String digits, String key, {int maxLen = 8}) {
  if (key == '⌫') {
    return digits.isEmpty ? digits : digits.substring(0, digits.length - 1);
  }
  final next = (digits + key).replaceFirst(RegExp(r'^0+'), '');
  return next.length > maxLen ? digits : next;
}

/// Lista de pares etiqueta / valor dentro de una tarjeta.
class InfoRows extends StatelessWidget {
  const InfoRows(this.rows, {super.key});
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Column(
          children: [
            for (var i = 0; i < rows.length; i++)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 11),
                decoration: BoxDecoration(
                  border: i == rows.length - 1
                      ? null
                      : Border(bottom: BorderSide(color: cs.outlineVariant)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      rows[i].$1,
                      style: TextStyle(color: cs.onSurfaceVariant),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Text(
                        rows[i].$2,
                        textAlign: TextAlign.right,
                        style: TextStyle(
                          fontWeight: i == rows.length - 1
                              ? FontWeight.w700
                              : FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.text, {super.key, this.ok = true});
  final String text;
  final bool ok;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: ok ? cs.tertiaryContainer : cs.errorContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: ok ? cs.onTertiaryContainer : cs.onErrorContainer,
        ),
      ),
    );
  }
}

/// Botón principal a todo el ancho, en píldora.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        child: busy
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              )
            : Text(label),
      ),
    );
  }
}

class NoteBanner extends StatelessWidget {
  const NoteBanner(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cs.secondaryContainer,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 13,
          color: cs.onSecondaryContainer,
          height: 1.4,
        ),
      ),
    );
  }
}

void showError(BuildContext context, Object e) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text('Error: $e')));
}

/// Formatea el número de tarjeta en grupos (4-4-4-4, o 4-6-5 en Amex).
class CardNumberFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final d = newValue.text.replaceAll(RegExp(r'\D'), '');
    final max = cardBrand(d) == 'Amex' ? 15 : 16;
    final n = d.length > max ? d.substring(0, max) : d;
    final String text;
    if (cardBrand(n) == 'Amex') {
      text = [
        n.substring(0, n.length.clamp(0, 4)),
        if (n.length > 4) n.substring(4, n.length.clamp(4, 10)),
        if (n.length > 10) n.substring(10),
      ].join(' ');
    } else {
      text = n.replaceAllMapped(RegExp(r'(\d{4})(?=\d)'), (m) => '${m[1]} ');
    }
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

/// MM/AA
class ExpiryFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final d = newValue.text.replaceAll(RegExp(r'\D'), '');
    final n = d.length > 4 ? d.substring(0, 4) : d;
    final text = n.length > 2 ? '${n.substring(0, 2)}/${n.substring(2)}' : n;
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

const testCards = <(String, String)>[
  ('Aprobada', '4111 1111 1111 1111'),
  ('Aprobada', '4242 4242 4242 4242'),
  ('Rechazada por banco', '5555 5555 5555 4444'),
  ('Sin saldo', '4000 0566 5566 5556'),
  ('Riesgo alto', '5120 3501 0006 4537'),
];
