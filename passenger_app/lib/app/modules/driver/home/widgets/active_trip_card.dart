import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:timeago/timeago.dart' as timeago;

import 'package:geny_app/app/data/services/tracking_client.dart';

/// Live Google Map inside an active trip card — receives driver:location updates
/// from the tracking client and pins the driver animateCamera to follow them.
class ActiveTripCard extends ConsumerStatefulWidget {
  const ActiveTripCard({super.key, required this.trip, required this.onAdvance});
  final Map<String, dynamic> trip;
  final VoidCallback onAdvance;

  @override
  ConsumerState<ActiveTripCard> createState() => _ActiveTripCardState();
}

class _ActiveTripCardState extends ConsumerState<ActiveTripCard> {
  GoogleMapController? _ctl;
  Set<Marker> _markers = {};

  @override
  void initState() {
    super.initState();
    _rebuildMarkers();
    // Listen to live driver locations
    final client = ref.read(trackingClientProvider);
    client.events.listen((event) {
      if (event.event == 'trip:location' && event.data is Map) {
        final d = event.data as Map;
        final lat = (d['lat'] as num?)?.toDouble();
        final lng = (d['lng'] as num?)?.toDouble();
        if (lat != null && lng != null) {
          setState(() {
            _markers = {
              Marker(markerId: const MarkerId('driver'), position: LatLng(lat, lng), icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange)),
            };
          });
          _ctl?.animateCamera(CameraUpdate.newLatLng(LatLng(lat, lng)));
        }
      }
    });
  }

  void _rebuildMarkers() {
    final t = widget.trip;
    final lat = (t['destinationLat'] as num?)?.toDouble();
    final lng = (t['destinationLng'] as num?)?.toDouble();
    if (lat != null && lng != null) {
      _markers.add(Marker(markerId: const MarkerId('dest'), position: LatLng(lat, lng)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.trip;
    final status = t['status'] as String? ?? '';
    final fare = (t['finalFare'] as num?)?.toDouble() ?? (t['fareEstimate'] as num?)?.toDouble() ?? 0;
    final createdAt = t['createdAt'] is String ? DateTime.tryParse(t['createdAt'] as String) : null;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: const Color(0xFF2ECC71),
                  child: const Icon(Icons.drive_eta, color: Colors.white),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Trip to ${(t['destinationAddress'] as String?) ?? ''}',
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      if (createdAt != null)
                        Text(timeago.format(createdAt), style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: status == 'STARTED' ? Colors.blue.shade50 : Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(status, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 180,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: GoogleMap(
                  initialCameraPosition: CameraPosition(
                    target: LatLng(
                      (t['pickupLat'] as num?)?.toDouble() ?? 24.7136,
                      (t['pickupLng'] as num?)?.toDouble() ?? 46.6753,
                    ),
                    zoom: 14,
                  ),
                  markers: _markers,
                  zoomControlsEnabled: false,
                  myLocationButtonEnabled: false,
                  onMapCreated: (c) => _ctl = c,
                ),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Estimated fare', style: TextStyle(color: Colors.black54)),
                Text('\$${fare.toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 22)),
              ],
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: widget.onAdvance,
                icon: const Icon(Icons.arrow_forward),
                label: Text(_actionLabel(status)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _actionLabel(String status) {
    switch (status) {
      case 'ACCEPTED':
        return 'Start navigation to pickup';
      case 'DRIVER_ARRIVING':
        return 'Arrived at pickup';
      case 'DRIVER_ARRIVED':
        return 'Start trip';
      case 'STARTED':
        return 'Complete trip';
      default:
        return 'Next step';
    }
  }
}
