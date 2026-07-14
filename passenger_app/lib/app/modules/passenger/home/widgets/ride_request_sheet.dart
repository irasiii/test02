import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:geny_app/app/data/providers/providers.dart';
import 'fare_estimate_dialog.dart';

/// Bottom sheet on the passenger home that allows the user to:
///   - Confirm pickup (defaults to current GPS position)
///   - Type/select a destination address
///   - See a fare estimate from the backend
///   - Tap "Request ride" to create a trip
class RideRequestSheet extends ConsumerStatefulWidget {
  const RideRequestSheet({
    super.key,
    required this.currentLat,
    required this.currentLng,
    this.currentAddress,
  });

  final double currentLat;
  final double currentLng;
  final String? currentAddress;

  @override
  ConsumerState<RideRequestSheet> createState() => _RideRequestSheetState();
}

class _RideRequestSheetState extends ConsumerState<RideRequestSheet> {
  final _destinationCtrl = TextEditingController();
  final _pickupCtrl = TextEditingController();
  bool _requesting = false;
  Map<String, dynamic>? _fareEstimate;

  @override
  void initState() {
    super.initState();
    _pickupCtrl.text = widget.currentAddress ?? 'Current location';
  }

  @override
  void dispose() {
    _destinationCtrl.dispose();
    _pickupCtrl.dispose();
    super.dispose();
  }

  Future<void> _requestRide() async {
    if (_destinationCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a destination')),
      );
      return;
    }
    setState(() => _requesting = true);
    try {
      // For demo purposes we send the destination text as the address and reuse
      // current position as destination coordinates. In production we would
      // forward-geocode the typed address first.
      final body = await ref.read(apiClientProvider).requestTrip({
        'pickupLat': widget.currentLat,
        'pickupLng': widget.currentLng,
        'pickupAddress': _pickupCtrl.text,
        'destinationLat': widget.currentLat + 0.01,
        'destinationLng': widget.currentLng + 0.01,
        'destinationAddress': _destinationCtrl.text,
        'type': 'RIDE',
        'passengerCount': 1,
      });
      setState(() => _fareEstimate = body);
      final tripId = body['id'] as String?;
      if (tripId != null) {
        // ignore: unused_local_variable
        final fare = body['fareEstimate'];
        // Show a confirmation dialog
        await showDialog<void>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Trip requested!'),
            content: Text(
              'We are searching for drivers nearby\n'
              'Estimated fare: \$${(body['fareEstimate'] as num?)?.toStringAsFixed(2) ?? '-'}'
              '\nDistance: ${(body['distanceKm'] as num?)?.toStringAsFixed(2) ?? '-'} km',
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK')),
            ],
          ),
        );
        if (mounted) context.go('/passenger/rides');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Request failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _requesting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [BoxShadow(blurRadius: 14, color: Color(0x33000000), offset: Offset(0, 4))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: const [
                Icon(Icons.local_taxi, size: 20, color: Colors.black54),
                SizedBox(width: 6),
                Text('Request a ride', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _pickupCtrl,
              decoration: const InputDecoration(
                labelText: 'Pickup',
                prefixIcon: Icon(Icons.trip_origin, color: Colors.green),
              ),
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _destinationCtrl,
              decoration: const InputDecoration(
                labelText: 'Where to?',
                prefixIcon: Icon(Icons.place_outlined, color: Colors.red),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 52,
              child: ElevatedButton.icon(
                onPressed: _requesting ? null : _requestRide,
                icon: _requesting
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.search),
                label: Text(_requesting ? 'Requesting...' : 'Request ride'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepOrange,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            if (_fareEstimate != null) const SizedBox(height: 12),
            if (_fareEstimate != null)
              FareEstimateBanner(
                fare: (_fareEstimate!['fareEstimate'] as num?)?.toDouble() ?? 0,
                distanceKm: (_fareEstimate!['distanceKm'] as num?)?.toDouble() ?? 0,
                durationMin: ((_fareEstimate!['durationSec'] as num?)?.toDouble() ?? 0) / 60,
              ),
          ],
        ),
      ),
    );
  }
}
