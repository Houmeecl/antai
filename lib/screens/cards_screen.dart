import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_state.dart';
import '../core/format.dart';
import '../core/widgets.dart';

/// Tarjetas guardadas. Solo se conserva el token y los 4 últimos dígitos.
class CardsScreen extends StatelessWidget {
  const CardsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final st = AppScope.of(context);
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'fab-cards',
        onPressed: () => Navigator.of(
          context,
        ).push(MaterialPageRoute<void>(builder: (_) => const AddCardScreen())),
        icon: const Icon(Icons.add),
        label: const Text('Registrar tarjeta'),
      ),
      body: st.cards.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('Todavía no tienes tarjetas guardadas.'),
              ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 96),
              children: [
                for (final c in st.cards)
                  Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: ListTile(
                      leading: const Icon(Icons.credit_card),
                      title: Row(
                        children: [
                          Flexible(
                            child: Text(
                              '${c.brand} •••• ${c.lastFour}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          if (c.isDefault) ...[
                            const SizedBox(width: 8),
                            const StatusPill('Predeterminada'),
                          ],
                        ],
                      ),
                      subtitle: Text(
                        '${c.holder} · vence ${c.expiry}\n${c.token}',
                      ),
                      isThreeLine: true,
                      trailing: PopupMenuButton<String>(
                        onSelected: (v) => v == 'def'
                            ? st.setDefaultCard(c.token)
                            : st.removeCard(c.token),
                        itemBuilder: (_) => [
                          if (!c.isDefault)
                            const PopupMenuItem(
                              value: 'def',
                              child: Text('Predeterminar'),
                            ),
                          const PopupMenuItem(
                            value: 'del',
                            child: Text('Eliminar'),
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

class AddCardScreen extends StatefulWidget {
  const AddCardScreen({super.key});

  @override
  State<AddCardScreen> createState() => _AddCardScreenState();
}

class _AddCardScreenState extends State<AddCardScreen> {
  final _name = TextEditingController(text: 'Test Test');
  final _number = TextEditingController(text: '4111 1111 1111 1111');
  final _expiry = TextEditingController(text: '12/30');
  final _cvv = TextEditingController(text: '123');
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _number.dispose();
    _expiry.dispose();
    _cvv.dispose();
    super.dispose();
  }

  String get _digits => _number.text.replaceAll(RegExp(r'\D'), '');

  String? _validate() {
    if (_name.text.trim().isEmpty) {
      return 'Ingresa el nombre que aparece en la tarjeta.';
    }
    if (!luhnValid(_digits)) return 'El número de tarjeta no es válido.';
    final m =
        int.tryParse(
          _expiry.text.length == 5 ? _expiry.text.substring(0, 2) : '',
        ) ??
        0;
    final y =
        2000 +
        (int.tryParse(
              _expiry.text.length == 5 ? _expiry.text.substring(3) : '',
            ) ??
            0);
    if (m < 1 || m > 12 || !DateTime(y, m + 1).isAfter(DateTime.now())) {
      return 'La fecha de vencimiento no es válida.';
    }
    final cvvLen = _cvv.text.length;
    if (cvvLen < (cardBrand(_digits) == 'Amex' ? 4 : 3)) {
      return 'El CVV no es válido.';
    }
    return null;
  }

  Future<void> _save() async {
    final err = _validate();
    if (err != null) return setState(() => _error = err);
    final st = AppScope.read(context);
    final nav = Navigator.of(context);
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final card = await st.dlocal.tokenizeCard(
        number: _digits,
        holder: _name.text.trim(),
        month: int.parse(_expiry.text.substring(0, 2)),
        year: 2000 + int.parse(_expiry.text.substring(3)),
      );
      _cvv.clear(); // el CVV nunca se conserva
      st.addCard(card);
      nav.pop();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final digits = _digits;
    return Scaffold(
      appBar: AppBar(title: const Text('Registrar tarjeta')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            AspectRatio(
              aspectRatio: 1.586,
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  gradient: const LinearGradient(
                    colors: [
                      Color(0xFFFFB3C7),
                      Color(0xFFF58AA8),
                      Color(0xFFE8668F),
                    ],
                  ),
                ),
                child: DefaultTextStyle(
                  style: const TextStyle(
                    color: Color(0xFF17111A),
                    fontFamily: 'monospace',
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        cardBrand(digits),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        _number.text.isEmpty
                            ? '•••• •••• •••• ••••'
                            : _number.text,
                        style: const TextStyle(fontSize: 20),
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Flexible(
                            child: Text(
                              _name.text.isEmpty
                                  ? 'NOMBRE'
                                  : _name.text.toUpperCase(),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(_expiry.text.isEmpty ? 'MM/AA' : _expiry.text),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const NoteBanner(
              'Modo sandbox. No ingreses tarjetas reales: usa las tarjetas de prueba. '
              'No se guarda el número completo ni el CVV, solo un token y los 4 últimos dígitos.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _name,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                labelText: 'Nombre en la tarjeta',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _number,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                CardNumberFormatter(),
              ],
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                labelText: 'Número',
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
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      labelText: 'Vence (MM/AA)',
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
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(4),
                    ],
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
              children: [
                for (final c in testCards)
                  ActionChip(
                    label: Text('${c.$1} ${c.$2.substring(c.$2.length - 4)}'),
                    onPressed: () => setState(() => _number.text = c.$2),
                  ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: TextStyle(color: cs.error, fontWeight: FontWeight.w600),
              ),
            ],
            const SizedBox(height: 20),
            PrimaryButton(
              label: 'Guardar tarjeta',
              busy: _busy,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}
