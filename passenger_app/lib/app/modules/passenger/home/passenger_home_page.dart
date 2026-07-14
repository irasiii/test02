import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import 'package:geny_app/app/data/providers/providers.dart';
import 'widgets/ride_request_sheet.dart';
import 'widgets/food_quick_link.dart';
import 'widgets/nearby_drivers_card.dart';

class PassengerHomePage extends ConsumerStatefulWidget {
  const PassengerHomePage({super.key});

  @override
  ConsumerState<PassengerHomePage> createState() => _PassengerHomePageState();
}

class _PassengerHomePageState extends ConsumerState<PassengerHomePage> {
  GoogleMapController? _mapController;
  static const _riyadh = LatLng(24.7136, 46.6753);
  CameraPosition _initialCamera = const CameraPosition(target: _riyadh, zoom: 13);
  bool _loadingLocation = false;
  LatLng? _currentPosition;
  String _currentAddress = '';
  final Set<Marker> _markers = {};
  List<dynamic> _nearbyDrivers = [];
  bool _loadingDrivers = false;

  @override
  void initState() {
    super.initState();
    _requestLocationAndLoadDrivers();
  }

  Future<void> _requestLocationAndLoadDrivers() async {
    setState(() => _loadingLocation = true);
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        // Default to Riyadh for demo.
        await _loadNearbyDrivers(_riyadh.latitude, _riyadh.longitude);
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        await _loadNearbyDrivers(_riyadh.latitude, _riyadh.longitude);
        return;
      }
      final position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      final latlng = LatLng(position.latitude, position.longitude);
      _currentPosition = latlng;
      _mapController?.animateCamera(CameraUpdate.newLatLngZoom(latlng, 15.5));
      // Reverse-geocode address for display
      try {
        final places = await placemarkFromCoordinates(position.latitude, position.longitude);
        final p = places.first;
        _currentAddress = '${p.street ?? ''} ${p.locality ?? ''} ${p.country ?? ''}'.trim();
      } catch (_) {
        _currentAddress = '';
      }
      await _loadNearbyDrivers(position.latitude, position.longitude);
    } catch (e) {
      debugPrint('[PassengerHome] location error: $e');
      await _loadNearbyDrivers(_riyadh.latitude, _riyadh.longitude);
    } finally {
      if (mounted) setState(() => _loadingLocation = false);
    }
  }

  Future<void> _loadNearbyDrivers(double lat, double lng) async {
    setState(() => _loadingDrivers = true);
    try {
      final drivers = await ref.read(apiClientProvider).nearbyDrivers(lat, lng, radiusKm: 8);
      if (!mounted) return;
      setState(() {
        _nearbyDrivers = drivers;
        _markers
          ..clear()
          ..add(Marker(
            markerId: const MarkerId('me'),
            position: LatLng(lat, lng),
            infoWindow: const InfoWindow(title: 'You are here'),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
          ));
        for (final d in drivers) {
          final dLat = (d['lat'] as num?)?.toDouble() ?? 0;
          final dLng = (d['lng'] as num?)?.toDouble() ?? 0;
          final mid = d['id'] as String? ?? 'driver';
          _markers.add(Marker(
            markerId: MarkerId(mid),
            position: LatLng(dLat, dLng),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
            infoWindow: InfoWindow(title: 'Driver nearby', snippet: 'Rating: ${d['rating']?.toString() ?? '-'}'),
          ));
        }
      });
    } catch (e) {
      debugPrint('[PassengerHome] nearby error: $e');
    } finally {
      if (mounted) setState(() => _loadingDrivers = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: _initialCamera,
            onMapCreated: (controller) => _mapController = controller,
            markers: _markers,
            myLocationEnabled: true,
            myLocationButtonEnabled: true,
            compassEnabled: true,
            zoomControlsEnabled: false,
          ),
          // Top: location pill + filter chips
          Positioned(
            top: 12,
            left: 12,
            right: 12,
            child: SafeArea(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: const [BoxShadow(blurRadius: 8, color: Color(0x22000000), offset: Offset(0, 2))],
                ),
                child: Row(
                  children: [
                    const Icon(Icons.my_location, color: Colors.black54),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _loadingLocation
                            ? 'Locating...'
                            : (_currentAddress.isEmpty ? 'Current location' : _currentAddress),
                        style: const TextStyle(fontWeight: FontWeight.w500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.refresh),
                      onPressed: _loadingDrivers ? null : _requestLocationAndLoadDrivers,
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Bottom sheet: ride request + food quick-link
          Positioned(
            left: 16,
            right: 16,
            bottom: 16,
            child: Column(
              children: [
                NearbyDriversCard(
                  count: _nearbyDrivers.length,
                  loading: _loadingDrivers,
                ),
                const SizedBox(height: 12),
                const FoodQuickLink(),
                const SizedBox(height: 12),
                RideRequestSheet(
                  currentLat: _currentPosition?.latitude ?? _riyadh.latitude,
                  currentLng: _currentPosition?.longitude ?? _riyadh.longitude,
                  currentAddress: _currentAddress,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
