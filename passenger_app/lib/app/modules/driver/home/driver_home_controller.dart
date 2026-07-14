import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import 'package:geny_app/app/core/errors/failures.dart';
import 'package:geny_app/app/data/providers/providers.dart';
import 'package:geny_app/app/data/services/api_client.dart';
import 'package:geny_app/app/data/services/tracking_client.dart';

class DriverHomeController extends StateNotifier<DriverHomeState> {
  DriverHomeController(this._api, this._tracking)
      : super(const DriverHomeState());

  final ApiClient _api;
  final TrackingClient _tracking;
  Timer? _pingTimer;
  StreamSubscription<TrackingEvent>? _eventsSub;

  Future<void> goOnline() async {
    state = state.copyWith(isToggling: true, clearError: true);
    try {
      await _api.driverOnline();
      await _tracking.connect();
      _subscribeTrackingEvents();
      _startPingLoop();
      state = state.copyWith(isOnline: true, isToggling: false);
    } on AppFailure catch (e) {
      state = state.copyWith(isToggling: false, error: e);
    } catch (e) {
      state = state.copyWith(isToggling: false, error: AppFailure.serverError(e.toString()));
    }
  }

  Future<void> goOffline() async {
    state = state.copyWith(isToggling: true);
    try {
      _pingTimer?.cancel();
      _pingTimer = null;
      await _api.driverOffline();
      _tracking.disconnect();
      state = const DriverHomeState();
    } catch (e) {
      state = state.copyWith(isToggling: false, error: AppFailure.serverError(e.toString()));
    }
  }

  void _startPingLoop() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      try {
        if (!state.isOnline) return;
        final position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
        await _api.driverPing(position.latitude, position.longitude);
        _tracking.sendDriverLocation(lat: position.latitude, lng: position.longitude);
      } catch (_) {
        // Silent — location ping is best-effort.
      }
    });
  }

  void _subscribeTrackingEvents() {
    _eventsSub?.cancel();
    _eventsSub = _tracking.events.listen((event) {
      if (event.event == 'driver:offer') {
        final data = event.data as Map?;
        final offer = data != null ? Map<String, dynamic>.from(data) : null;
        state = state.copyWith(activeOffer: offer);
      }
    });
  }

  Future<bool> acceptTrip(String tripId) async {
    try {
      final body = await _api.acceptTrip(tripId);
      final trip = body['trip'] as Map<String, dynamic>? ?? body;
      state = state.copyWith(activeTripId: tripId, activeTrip: trip, clearOffer: true);
      return true;
    } on AppFailure catch (e) {
      state = state.copyWith(error: e);
      return false;
    } catch (e) {
      state = state.copyWith(error: AppFailure.serverError(e.toString()));
      return false;
    }
  }

  Future<void> updateTripStatus(String tripId, String status) async {
    try {
      await _api.updateTripStatus(tripId, status);
      if (status == 'STARTED' || status == 'DRIVER_ARRIVING' || status == 'DRIVER_ARRIVED') {
        state = state.copyWith(activeTrip: {...(state.activeTrip ?? {}), 'status': status});
      } else if (status == 'COMPLETED') {
        state = state.copyWith(clearTrip: true);
      }
    } on AppFailure catch (e) {
      state = state.copyWith(error: e);
    }
  }

  void declineOffer() {
    state = state.copyWith(clearOffer: true);
  }

  @override
  void dispose() {
    _pingTimer?.cancel();
    _eventsSub?.cancel();
    super.dispose();
  }
}

final driverHomeControllerProvider =
    StateNotifierProvider<DriverHomeController, DriverHomeState>((ref) {
  return DriverHomeController(ref.watch(apiClientProvider), ref.watch(trackingClientProvider));
});

@immutable
class DriverHomeState {
  const DriverHomeState({
    this.isOnline = false,
    this.isToggling = false,
    this.error,
    this.activeOffer,
    this.activeTripId,
    this.activeTrip,
  });

  final bool isOnline;
  final bool isToggling;
  final AppFailure? error;
  final Map<String, dynamic>? activeOffer;
  final String? activeTripId;
  final Map<String, dynamic>? activeTrip;

  DriverHomeState copyWith({
    bool? isOnline,
    bool? isToggling,
    AppFailure? error,
    Map<String, dynamic>? activeOffer,
    String? activeTripId,
    Map<String, dynamic>? activeTrip,
    bool clearError = false,
    bool clearOffer = false,
    bool clearTrip = false,
  }) {
    return DriverHomeState(
      isOnline: isOnline ?? this.isOnline,
      isToggling: isToggling ?? this.isToggling,
      error: clearError ? null : (error ?? this.error),
      activeOffer: clearOffer ? null : (activeOffer ?? this.activeOffer),
      activeTripId: clearTrip ? null : (activeTripId ?? this.activeTripId),
      activeTrip: clearTrip ? null : (activeTrip ?? this.activeTrip),
    );
  }
}
