import 'package:flutter/material.dart';

import '../data/dlocal_api.dart';

/// Registro de llamadas a la API (simuladas o reales), en una hoja inferior.
void showApiLog(BuildContext context, ApiLog log) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: .7,
      maxChildSize: .95,
      builder: (ctx, controller) => ListenableBuilder(
        listenable: log,
        builder: (_, _) => log.entries.isEmpty
            ? const Center(child: Text('Aún no hay llamadas.'))
            : ListView.separated(
                controller: controller,
                padding: const EdgeInsets.all(16),
                itemCount: log.entries.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final e = log.entries[i];
                  return Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Theme.of(ctx).colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          e.title,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 4),
                        SelectableText(
                          e.body,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
      ),
    ),
  );
}
