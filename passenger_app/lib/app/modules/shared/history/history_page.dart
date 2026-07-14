import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timeago/timeago.dart' as timeago;

import 'history_controller.dart';

class HistoryPage extends ConsumerWidget {
  const HistoryPage({super.key, required this.type});
  final HistoryType type;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(historyStreamProvider(type));
    return Scaffold(
      appBar: AppBar(
        title: Text(switch (type) {
          HistoryType.trips       => 'My rides',
          HistoryType.orders      => 'My orders',
          HistoryType.deliveries  => 'My deliveries',
        }),
      ),
      body: asyncData.when(
        data: (items) {
          if (items.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    switch (type) {
                      HistoryType.trips      => Icons.directions_car_outlined,
                      HistoryType.orders     => Icons.receipt_long_outlined,
                      HistoryType.deliveries => Icons.delivery_dining_outlined,
                    },
                    size: 64,
                    color: Colors.black26,
                  ),
                  const SizedBox(height: 12),
                  const Text('Nothing yet'),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(historyStreamProvider(type)),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 12, endIndent: 12),
              itemCount: items.length,
              itemBuilder: (context, i) {
                final item = items[i];
                final title = switch (type) {
                  HistoryType.trips => 'Trip → ${item['destinationAddress'] ?? ''}',
                  HistoryType.orders => 'Order #${(item['id'] ?? '').toString().substring(0, 8)}',
                  HistoryType.deliveries => 'Delivery #${(item['id'] ?? '').toString().substring(0, 8)}',
                };
                final amount = switch (type) {
                  HistoryType.trips      => (item['finalFare'] ?? item['fareEstimate'] ?? 0),
                  HistoryType.orders     => item['total'] ?? 0,
                  HistoryType.deliveries => item['total'] ?? 0,
                };
                final status = item['status'] ?? '';
                final createdAt = item['createdAt'] is String
                    ? DateTime.tryParse(item['createdAt'] as String)
                  : null;

                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  leading: CircleAvatar(
                    backgroundColor: Theme.of(context).colorScheme.surface,
                    child: Icon(
                      switch (type) {
                        HistoryType.trips      => Icons.directions_car,
                        HistoryType.orders     => Icons.restaurant,
                        HistoryType.deliveries => Icons.delivery_dining,
                      },
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                  title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Row(
                    children: [
                      if (createdAt != null)
                        Text(timeago.format(createdAt), style: const TextStyle(fontSize: 11)),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(6)),
                        child: Text(status.toString(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  trailing: Text(
                    '\$${(amount as num? ?? 0).toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 32),
              const SizedBox(height: 8),
              Text(err.toString()),
              TextButton.icon(
                onPressed: () => ref.invalidate(historyStreamProvider(type)),
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
