import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'driver_home_controller.dart';
import 'widgets/driver_status_card.dart';
import 'widgets/active_trip_card.dart';
import 'widgets/active_delivery_card.dart';
import 'widgets/trip_offer_card.dart';

class DriverHomePage extends ConsumerWidget {
  const DriverHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(driverHomeControllerProvider.notifier);
    final homeState = ref.watch(driverHomeControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Driver'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('No new notifications')),
            ),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DriverStatusCard(
              isOnline: homeState.isOnline,
              isToggling: homeState.isToggling,
              onToggle: () => homeState.isOnline ? state.goOffline() : state.goOnline(),
            ),
            const SizedBox(height: 16),
            if (homeState.error != null) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEBEE),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red),
                    const SizedBox(width: 8),
                    Expanded(child: Text(homeState.error!.message, style: const TextStyle(color: Colors.red))),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            if (homeState.isOnline && !homeState.isToggling) ...[
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      if (homeState.activeOffer != null)
                        TripOfferCard(
                          offer: homeState.activeOffer!,
                          onAccept: () {
                            final id = homeState.activeOffer!['tripId'] as String?;
                            if (id != null) {
                              state.acceptTrip(id);
                            }
                          },
                          onDecline: () {
                            state.declineOffer();
                          },
                        ),
                      if (homeState.activeTrip != null)
                        ActiveTripCard(
                          trip: homeState.activeTrip!,
                          onAdvance: () {
                            final id = (homeState.activeTrip?['id'] as String?) ?? homeState.activeTripId;
                            if (id == null) return;
                            final currentStatus = (homeState.activeTrip?['status'] as String?) ?? '';
                            final next = _nextStatus(currentStatus);
                            if (next != null) state.updateTripStatus(id, next);
                          },
                        ),
                      if (homeState.activeOrder != null)
                        ActiveDeliveryCard(
                          order: homeState.activeOrder!,
                          onAdvance: () => state.advanceOrder(),
                        ),
                      if (homeState.activeOffer == null && homeState.activeTrip == null)
                        Column(
                          children: [
                            const Icon(Icons.taxi_alert, size: 48, color: Colors.black54),
                            const SizedBox(height: 12),
                            const Text(
                              'Looking for nearby requests...',
                              style: TextStyle(fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(height: 24),
                            const LinearProgressIndicator(),
                          ],
                        ),
                    ],
                  ),
                ),
              ),
            ] else if (!homeState.isOnline && !homeState.isToggling)
              const Expanded(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.power_off, size: 48, color: Colors.black38),
                      SizedBox(height: 12),
                      Text('You are offline', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500)),
                      SizedBox(height: 4),
                      Text('Toggle online to start receiving ride/delivery requests'),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String? _nextStatus(String current) {
    switch (current) {
      case 'ACCEPTED':
        return 'DRIVER_ARRIVING';
      case 'DRIVER_ARRIVING':
        return 'DRIVER_ARRIVED';
      case 'DRIVER_ARRIVED':
        return 'STARTED';
      case 'STARTED':
        return 'COMPLETED';
      default:
        return null;
    }
  }
}
