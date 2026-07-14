import 'package:flutter/material.dart';

class FareEstimateBanner extends StatelessWidget {
  const FareEstimateBanner({
    super.key,
    required this.fare,
    required this.distanceKm,
    required this.durationMin,
  });

  final double fare;
  final double distanceKm;
  final double durationMin;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F5E9),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFA5D6A7)),
      ),
      child: Row(
        children: [
          const Icon(Icons.local_offer, color: Colors.green, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Fare: \$${fare.toStringAsFixed(2)}  •  ${distanceKm.toStringAsFixed(1)} km  •  ~${durationMin.round()} min',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
