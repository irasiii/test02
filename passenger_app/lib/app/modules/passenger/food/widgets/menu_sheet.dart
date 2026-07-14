import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:geny_app/app/data/providers/providers.dart';
import '../food_cart_controller.dart';
import '../pages/checkout_page.dart';

class MenuSheet extends ConsumerStatefulWidget {
  const MenuSheet({super.key, required this.restaurant});

  final Map<String, dynamic> restaurant;

  @override
  ConsumerState<MenuSheet> createState() => _MenuSheetState();
}

class _MenuSheetState extends ConsumerState<MenuSheet> {
  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadMenu();
  }

  Future<void> _loadMenu() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rid = widget.restaurant['id'] as String;
      final items = await ref.read(apiClientProvider).listMenuItems(rid);
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(foodCartProvider);
    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Material(
                elevation: 2,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          widget.restaurant['name'] as String? ?? '',
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                    ? Center(child: Text('Error: $_error'))
                    : ListView.separated(
                        controller: scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        separatorBuilder: (_, __) => const Divider(),
                        itemCount: _items.length,
                        itemBuilder: (context, i) {
                          final item = _items[i] as Map<String, dynamic>;
                          final id = (item['id'] as String?) ?? '';
                          return _MenuItemRow(
                            id: id,
                            name: item['name'] as String? ?? '',
                            description: (item['description'] ?? '').toString(),
                            price: (item['price'] as num?)?.toDouble() ?? 0,
                            available: (item['isAvailable'] as bool?) == true,
                            imageUrl: item['imageUrl'] as String?,
                            onAdd: () => ref.read(foodCartProvider.notifier).addItem(
                              id: id, name: item['name'] as String, price: (item['price'] as num).toDouble(),
                            ),
                          );
                        },
                      ),
              ),
              if (cart.items.isNotEmpty)
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade50,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text('${cart.itemCount} items', style: const TextStyle(fontWeight: FontWeight.bold)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () {
                              Navigator.pop(context);
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => CheckoutPage(
                                    restaurant: widget.restaurant,
                                    items: cart.items.map((c) => c.toApiItem()).toList(),
                                    onClosed: () => ref.read(foodCartProvider.notifier).reset(),
                                  ),
                                ),
                              );
                              ref.read(foodCartProvider.notifier).reset();
                            },
                            icon: const Icon(Icons.shopping_cart_checkout),
                            label: Text('Checkout • \$${cart.subtotal.toStringAsFixed(2)}'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _MenuItemRow extends StatelessWidget {
  const _MenuItemRow({
    required this.id, required this.name, required this.description,
    required this.price, required this.available, this.imageUrl, required this.onAdd,
  });

  final String id;
  final String name;
  final String description;
  final double price;
  final bool available;
  final String? imageUrl;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: available ? 1 : 0.4,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(vertical: 8),
        leading: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: imageUrl != null
            ? Image.network(imageUrl!, width: 64, height: 64, fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(width: 64, height: 64, color: Colors.grey.shade200))
            : Container(width: 64, height: 64, color: Colors.grey.shade200, child: const Icon(Icons.fastfood)),
        ),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (description.isNotEmpty) Text(description, maxLines: 1, overflow: TextOverflow.ellipsis),
            Row(
              children: [
                Text('\$${price.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.deepOrange)),
                const SizedBox(width: 8),
                if (!available) const Text('Sold out', style: TextStyle(color: Colors.red, fontSize: 12)),
              ],
            ),
          ],
        ),
        trailing: IconButton(
          icon: const Icon(Icons.add_circle, color: Colors.deepOrange),
          onPressed: available ? onAdd : null,
        ),
      ),
    );
  }
}
