import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:geny_app/app/data/providers/providers.dart';

enum HistoryType { trips, orders, deliveries }

final historyStreamProvider = FutureProvider.family<List<Map<String, dynamic>>, HistoryType>((ref, type) async {
  final api = ref.watch(apiClientProvider);
  switch (type) {
    case HistoryType.trips:
      final trips = await api.myTrips();
      return trips.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    case HistoryType.orders:
      final orders = await api.myOrders();
      // Defensive cast: `myOrders` returns List<dynamic>.
      final list = (orders).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      return list;
    case HistoryType.deliveries:
      // Driver's perspective: list orders assigned to them (not the
      // customer-only /orders/me endpoint).
      final orders = await api.driverDeliveries();
      return orders.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }
});
