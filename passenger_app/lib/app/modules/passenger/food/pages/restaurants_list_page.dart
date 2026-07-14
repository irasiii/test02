import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';

import 'package:geny_app/app/data/providers/providers.dart';
import '../widgets/menu_sheet.dart';
import '../food_cart_controller.dart';

class RestaurantsListPage extends ConsumerStatefulWidget {
  const RestaurantsListPage({super.key});

  @override
  ConsumerState<RestaurantsListPage> createState() => _RestaurantsListPageState();
}

class _RestaurantsListPageState extends ConsumerState<RestaurantsListPage> {
  List<dynamic> _restaurants = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await ref.read(apiClientProvider).listRestaurants();
      if (!mounted) return;
      setState(() {
        _restaurants = list;
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
    return Scaffold(
      appBar: AppBar(title: const Text('Eat with GenY')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
            ? Center(child: Text('Error: $_error'))
            : ListView.separated(
                padding: const EdgeInsets.all(12),
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemCount: _restaurants.length,
                itemBuilder: (context, i) {
                  final r = _restaurants[i] as Map<String, dynamic>;
                  return RestaurantCard(
                    name: r['name'] as String? ?? '',
                    cuisines: ((r['cuisineTypes'] as List?) ?? []).cast<String>().join(', '),
                    rating: (r['rating'] as num?)?.toDouble() ?? 0,
                    ratingCount: (r['ratingCount'] as num?)?.toInt() ?? 0,
                    deliveryFee: (r['deliveryFee'] as num?)?.toDouble() ?? 0,
                    coverUrl: r['coverUrl'] as String? ?? r['logoUrl'] as String?,
                    onOpen: () {
                      ref.read(foodCartProvider.notifier).reset();
                      showModalBottomSheet<void>(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => MenuSheet(restaurant: r),
                      );
                    },
                  );
                },
              ),
      ),
    );
  }
}

class RestaurantCard extends StatelessWidget {
  const RestaurantCard({
    super.key,
    required this.name,
    required this.cuisines,
    required this.rating,
    required this.ratingCount,
    required this.deliveryFee,
    this.coverUrl,
    required this.onOpen,
  });

  final String name;
  final String cuisines;
  final double rating;
  final int ratingCount;
  final double deliveryFee;
  final String? coverUrl;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onOpen,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
              child: coverUrl != null
                ? CachedNetworkImage(imageUrl: coverUrl!, height: 120, fit: BoxFit.cover,
                    placeholder: (_, __) => Container(height: 120, color: Colors.grey.shade200),
                    errorWidget: (_, __, ___) => Container(height: 120, color: Colors.grey.shade300, child: const Icon(Icons.restaurant, size: 40, color: Colors.black54)))
                : Container(height: 120, color: Colors.grey.shade200, child: const Icon(Icons.restaurant, size: 40, color: Colors.black54)),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(8)),
                        child: Row(
                          children: [
                            const Icon(Icons.star, color: Colors.amber, size: 14),
                            const SizedBox(width: 4),
                            Text(rating.toStringAsFixed(1), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(cuisines, style: const TextStyle(color: Colors.black54, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.delivery_dining, size: 16, color: Colors.deepOrange),
                      const SizedBox(width: 4),
                      Text('\$${deliveryFee.toStringAsFixed(2)} delivery'),
                      const SizedBox(width: 12),
                      Text('$ratingCount ratings', style: const TextStyle(color: Colors.black54)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
