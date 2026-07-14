import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart' show debugPrint;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'package:geny_app/app/core/constants/app_constants.dart';
import 'package:geny_app/app/data/services/secure_storage.dart';

/// Real-time tracking WebSocket client.
///
/// Channels (server → client):
///   trip:<id>     -> trip:update, trip:location
///   order:<id>    -> order:update, order:location
///   driver:<id>   -> driver:offer, driver:location
///
/// Client → server:
///   auth { token }
///   join  { room }
///   driver:location { lat, lng, heading?, tripId?, orderId? }
class TrackingClient {
  TrackingClient(this._storage);

  final SecureStorage _storage;
  WebSocketChannel? _channel;
  bool _reconnectArmed = true;
  Timer? _heartbeat;

  final _messageController = StreamController<TrackingEvent>.broadcast();
  Stream<TrackingEvent> get events => _messageController.stream;

  Future<void> connect() async {
    if (_channel != null) return;
    try {
      _channel = WebSocketChannel.connect(Uri.parse(AppConstants.wsBaseUrl));
      debugPrint('[TrackingClient] connected to ${AppConstants.wsBaseUrl}');

      // Send auth immediately
      final token = await _storage.getAccessToken();
      if (token != null) {
        _send({'event': 'auth', 'data': {'token': token}});
      }

      _channel!.stream.listen(
        (msg) {
          debugPrint('[TrackingClient] recv: $msg');
          final decoded = _tryDecode(msg);
          if (decoded != null) _messageController.add(decoded);
        },
        onError: (e) => _handleDisconnect('stream error: $e'),
        onDone: () => _handleDisconnect('remote closed'),
      );

      _heartbeat = Timer.periodic(const Duration(seconds: 30), (_) {
        _send({'event': 'ping'});
      });
    } catch (e) {
      debugPrint('[TrackingClient] connect failed: $e');
      _handleDisconnect('connect exception');
    }
  }

  void join(String room) => _send({'event': 'join', 'data': {'room': room}});

  void sendDriverLocation({
    required double lat,
    required double lng,
    double? heading,
    String? tripId,
    String? orderId,
  }) =>
      _send({
        'event': 'driver:location',
        'data': {
          'lat': lat,
          'lng': lng,
          if (heading != null) 'heading': heading,
          if (tripId != null) 'tripId': tripId,
          if (orderId != null) 'orderId': orderId,
        },
      });

  void _send(Map<String, dynamic> envelope) {
    _channel?.sink.add(jsonEncode(envelope));
  }

  TrackingEvent? _tryDecode(dynamic raw) {
    if (raw is! String) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        final event = decoded['event'] as String?;
        final data = decoded['data'];
        if (event != null) return TrackingEvent(event, data);
      }
    } catch (_) {}
    return null;
  }

  void _handleDisconnect(String reason) {
    debugPrint('[TrackingClient] disconnected: $reason');
    _heartbeat?.cancel();
    _heartbeat = null;
    _channel = null;
    if (_reconnectArmed) {
      Future.delayed(const Duration(seconds: 3), () => connect());
    }
  }

  void disconnect() {
    _reconnectArmed = false;
    _heartbeat?.cancel();
    _channel?.sink.close();
    _channel = null;
  }
}

class TrackingEvent {
  final String event;
  final dynamic data;
  const TrackingEvent(this.event, this.data);
}

final trackingClientProvider = Provider<TrackingClient>((ref) {
  final client = TrackingClient(SecureStorage.instance);
  ref.onDispose(() {
    client.disconnect();
  });
  return client;
});
