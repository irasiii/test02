import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:geny_app/app/data/providers/providers.dart';

/// Reusable rating sheet that posts to `POST /ratings`.
class RateDialog extends ConsumerStatefulWidget {
  const RateDialog({
    super.key,
    required this.target,
    required this.targetId,
    this.referenceId,
    this.title,
  });

  /// RatingTarget enum value: DRIVER | CUSTOMER | RESTAURANT | ITEM.
  final String target;
  final String targetId;
  final String? referenceId;
  final String? title;

  @override
  ConsumerState<RateDialog> createState() => _RateDialogState();
}

class _RateDialogState extends ConsumerState<RateDialog> {
  double _stars = 5;
  final _commentCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await ref.read(apiClientProvider).createRating({
        'target': widget.target,
        'targetId': widget.targetId,
        if (widget.referenceId != null) 'referenceId': widget.referenceId,
        'stars': _stars.toInt(),
        'comment': _commentCtrl.text.trim(),
      });
      if (!mounted) return;
      Navigator.pop(context, true);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Thanks for your rating!')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title ?? 'Rate your experience'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          RatingBar.builder(
            initialRating: _stars,
            minRating: 1,
            allowHalfRating: false,
            itemSize: 36,
            itemBuilder: (_, __) => const Icon(Icons.star, color: Colors.amber),
            onRatingUpdate: (v) => _stars = v,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _commentCtrl,
            decoration: const InputDecoration(labelText: 'Comment (optional)', border: OutlineInputBorder()),
            maxLines: 2,
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        ElevatedButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting ? const Text('…') : const Text('Submit'),
        ),
      ],
    );
  }
}

/// Presents [RateDialog]. Returns `true` if a rating was submitted.
Future<bool?> showRatingDialog(
  BuildContext context, {
  required String target,
  required String targetId,
  String? referenceId,
  String? title,
}) {
  return showDialog<bool>(
    context: context,
    builder: (_) => RateDialog(
      target: target,
      targetId: targetId,
      referenceId: referenceId,
      title: title,
    ),
  );
}
