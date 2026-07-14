import 'dart:math' as math;

class LatLngModel {
  final double lat;
  final double lng;
  const LatLngModel(this.lat, this.lng);

  Map<String, dynamic> toJson() => {'lat': lat, 'lng': lng};

  @override
  String toString() => 'LatLng($lat, $lng)';
}

class GeoUtils {
  GeoUtils._();

  /// Haversine distance in km between two points
  static double distanceKm(LatLngModel a, LatLngModel b) {
    const r = 6371.0;
    final dLat = _toRad(b.lat - a.lat);
    final dLng = _toRad(b.lng - a.lng);
    final h = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_toRad(a.lat)) * math.cos(_toRad(b.lat)) * math.sin(dLng / 2) * math.sin(dLng / 2);
    final c = 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h));
    return (r * c).abs();
  }

  static double _toRad(double deg) => deg * (math.pi / 180.0);
}
