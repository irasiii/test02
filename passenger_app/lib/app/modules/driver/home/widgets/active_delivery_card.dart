import 'package:flutter/material.dart';
import 'package:timeago/timeago.dart' as timeago;

/// Live card for an in-progress food-delivery assigned to the driver, with a
/// single-tap control to advance the order through its fulfilment states.
class ActiveDeliveryCard extends StatelessWidget {
  const ActiveDeliveryCard({super.key, required this.order, required this.onAdvance});
  final Map<String, dynamic> order;
  final VoidCallback onAdvance;

  String _actionLabel(String status) {
    switch (status) {
      case 'ACCEPTED':
      case 'PREPARING':
      case 'READY':
        return 'Pick up order';
      case 'PICKED_UP':
        return 'Start delivery';
      case 'ON_THE_WAY':
        return 'Mark delivered';
      default:
        return 'Next step';
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = order['status'] as String? ?? '';
    final total = (order['total'] as num?)?.toDouble() ?? 0;
    final restaurant = order['restaurant'] is Map ? order['restaurant'] as Map : null;
    final address = order['deliveryAddress'] as String? ?? '';
    final createdAt = order['createdAt'] is String ? DateTime.tryParse(order['createdAt'] as String) : null;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const CircleAvatar(
                  backgroundColor: Color(0xFFFF6B35),
                  child: Icon(Icons.delivery_dining, color: Colors.white),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Delivery #${_short(order['id'])}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      if (createdAt != null)
                        Text(timeago.format(createdAt), style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(12)),
                  child: Text(status, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (restaurant != null)
              Text('From: ${restaurant['name'] ?? 'Restaurant'}', style: const TextStyle(fontWeight: FontWeight.w600)),
            Text('To: $address', style: const TextStyle(color: Colors.black87)),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total', style: TextStyle(color: Colors.black54)),
                Text('\$${total.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
              ],
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onAdvance,
                icon: const Icon(Icons.arrow_forward),
                label: Text(_actionLabel(status)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _short(dynamic id) {
    final s = id?.toString() ?? '';
    return s.length > 8 ? s.substring(0, 8) : s;
  }
}
