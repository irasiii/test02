import 'package:flutter/material.dart';

class NearbyDriversCard extends StatelessWidget {
  const NearbyDriversCard({super.key, required this.count, required this.loading});
  final int count;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [BoxShadow(blurRadius: 8, color: Color(0x22000000), offset: Offset(0, 2))],
      ),
      child: Row(
        children: [
          const Icon(Icons.taxi_alert_outlined, color: Colors.deepOrange),
          const SizedBox(width: 10),
          Expanded(
            child: Text(loading
                ? 'Searching for nearby drivers...'
                : (count > 0
                    ? '$count ${count == 1 ? 'driver' : 'drivers'} are nearby'
                    : 'No drivers nearby right now'),
            style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
