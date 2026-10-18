import 'package:flutter/material.dart';

import 'app_state.dart';
import 'screens/caja_screen.dart';
import 'screens/cards_screen.dart';
import 'screens/log_sheet.dart';
import 'screens/send_screen.dart';
import 'screens/shop_screen.dart';

void main() => runApp(PosApp(state: AppState()));

class PosApp extends StatelessWidget {
  const PosApp({super.key, required this.state});
  final AppState state;

  ThemeData _theme(Brightness b) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFFFFB3C7),
      brightness: b,
    );
    final dark = b == Brightness.dark;
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme.copyWith(
        primary: dark ? const Color(0xFFFFB3C7) : const Color(0xFF17111A),
        onPrimary: dark ? const Color(0xFF17111A) : Colors.white,
        primaryContainer: const Color(0xFFFFB3C7),
        onPrimaryContainer: const Color(0xFF17111A),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: state,
      child: MaterialApp(
        title: 'POS Turista',
        debugShowCheckedModeBanner: false,
        theme: _theme(Brightness.light),
        darkTheme: _theme(Brightness.dark),
        home: const Shell(),
      ),
    );
  }
}

class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _tab = 0;

  static const _titles = ['Caja 01', 'Enviar dinero', 'Tienda', 'Mis tarjetas'];

  @override
  Widget build(BuildContext context) {
    final st = AppScope.read(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_tab]),
        actions: [
          if (st.isMock)
            const Padding(
              padding: EdgeInsets.only(right: 4),
              child: Center(
                child: Chip(
                  label: Text('Simulado'),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ),
          IconButton(
            tooltip: 'Registro de API',
            icon: const Icon(Icons.terminal),
            onPressed: () => showApiLog(context, st.log),
          ),
        ],
      ),
      body: IndexedStack(
        index: _tab,
        children: [
          CajaScreen(onSend: () => setState(() => _tab = 1)),
          const SendScreen(),
          const ShopScreen(),
          const CardsScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.point_of_sale), label: 'Caja'),
          NavigationDestination(icon: Icon(Icons.send), label: 'Enviar'),
          NavigationDestination(icon: Icon(Icons.storefront), label: 'Tienda'),
          NavigationDestination(
            icon: Icon(Icons.credit_card),
            label: 'Tarjetas',
          ),
        ],
      ),
    );
  }
}
