import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:geolocator/geolocator.dart';

import 'package:geny_app/app/data/providers/providers.dart';

class CheckoutPage extends ConsumerStatefulWidget {
  const CheckoutPage({
    super.key,
    required this.restaurant,
    required this.items,
    required this.onClosed,
  });

  final Map<String, dynamic> restaurant;
  final List<Map<String, dynamic>> items;
  final VoidCallback onClosed;

  @override
  ConsumerState<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends ConsumerState<CheckoutPage> {
  final _addressCtrl = TextEditingController(text: 'Current location');
  double _lat = 0;
  double _lng = 0;
  bool _placing = false;

  @override
  void initState() {
    super.initState();
    _fillCurrentLocation();
  }

  @override
  void dispose() {
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _fillCurrentLocation() async {
    try {
      final p = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      setState(() {
        _lat = p.latitude;
        _lng = p.longitude;
      });
    } catch (_) {
      setState(() {
        _lat = (widget.restaurant['lat'] as num?)?.toDouble() ?? 0;
        _lng = (widget.restaurant['lng'] as num?)?.toDouble() ?? 0;
      });
    }
  }

  Future<void> _placeOrder() async {
    setState(() => _placing = true);
    try {
      final order = await ref.read(apiClientProvider).createOrder({
        'restaurantId': widget.restaurant['id'],
        'items': widget.items,
        'deliveryAddress': _addressCtrl.text,
        'deliveryLat': _lat,
        'deliveryLng': _lng,
        'paymentMethod': 'CARD',
      });
      if (!mounted) return;

      final orderId = order['id'];
      final total = (order['total'] as num?)?.toDouble() ?? 0;
      final intent = await ref.read(apiClientProvider).createPaymentIntent(
        purpose: 'ORDER',
        referenceId: orderId,
        amount: total,
        description: 'GenY order $orderId',
      );
      if (!mounted) return;

      // Confirm the Stripe PaymentIntent client-side. Skipped in demo mode
      // (mock backend returns a `pi_mock_*` client secret with no real key).
      final clientSecret = intent['clientSecret'] as String?;
      if (clientSecret != null &&
          clientSecret.startsWith('pi_') &&
          !clientSecret.startsWith('pi_mock_')) {
        await Stripe.instance.initPaymentSheet(
          paymentSheetParameters: SetupPaymentSheetParameters(
            paymentIntentClientSecret: clientSecret,
            merchantDisplayName: 'GenY',
          ),
        );
        await Stripe.instance.presentPaymentSheet();
      }
      if (!mounted) return;
      widget.onClosed();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Order placed! Track it under Orders.')),
      );
      Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Deliver to',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            TextField(
              controller: _addressCtrl,
              decoration: const InputDecoration(prefixIcon: Icon(Icons.map_outlined)),
              maxLines: 2,
            ),
            const SizedBox(height: 24),
            Expanded(
              child: ListView(
                children: [
                  for (final it in widget.items)
                    ListTile(
                      leading: const Icon(Icons.fastfood, color: Colors.deepOrange),
                      title: Text('Item ${it['menuItemId']?.toString().substring(0, 4)}'),
                      subtitle: Text('Quantity: ${it['quantity']}'),
                    ),
                ],
              ),
            ),
            const Divider(),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _placing ? null : _placeOrder,
              icon: _placing
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Icon(Icons.check_circle),
              label: Text(_placing ? 'Placing order...' : 'Place order'),
            ),
          ],
        ),
      ),
    );
  }
}
