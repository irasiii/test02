import 'package:flutter/material.dart';

class DriverStatusCard extends StatelessWidget {
  const DriverStatusCard({
    super.key,
    required this.isOnline,
    required this.isToggling,
    required this.onToggle,
  });

  final bool isOnline;
  final bool isToggling;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final color = isOnline ? const Color(0xFF2ECC71) : Colors.black54;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color, width: 1.5),
      ),
      child: Row(
        children: [
          Icon(isOnline ? Icons.toggle_on : Icons.toggle_off, color: color, size: 32),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isOnline ? 'Online' : 'Offline',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
                const SizedBox(height: 4),
                Text(isOnline ? 'You can receive requests now' : 'Tap to go online and earn',
                    style: const TextStyle(fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Switch.adaptive(value: isOnline, onChanged: isToggling ? null : (_) => onToggle()),
        ],
      ),
    );
  }
}
