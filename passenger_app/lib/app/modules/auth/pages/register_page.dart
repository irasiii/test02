import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:geny_app/app/data/models/app_role.dart';
import '../../auth/auth_controller.dart';
import '../../common/widgets/primary_button.dart';

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  AppRole _role = AppRole.CUSTOMER;
  bool _obscure = true;

  @override
  void dispose() {
    for (final c in [_firstNameCtrl, _lastNameCtrl, _emailCtrl, _phoneCtrl, _passwordCtrl]) c.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final ok = await ref.read(authControllerProvider.notifier).register(
          email: _emailCtrl.text.trim(),
          phone: _phoneCtrl.text.trim(),
          firstName: _firstNameCtrl.text.trim(),
          lastName: _lastNameCtrl.text.trim(),
          password: _passwordCtrl.text,
          role: _role,
        );
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.read(authControllerProvider).error?.message ?? 'Registration failed')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.primary,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.topLeft,
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    onPressed: () => context.go('/login'),
                  ),
                ),
                const SizedBox(height: 8),
                const Text('Create your account',
                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Colors.white)),
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(child: _buildField(_firstNameCtrl, 'First name', Icons.person_outline,
                              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null)),
                          const SizedBox(width: 12),
                          Expanded(child: _buildField(_lastNameCtrl, 'Last name', Icons.person_outline,
                              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _buildField(_emailCtrl, 'Email', Icons.email_outlined,
                          validator: (v) => (v == null || !v.contains('@')) ? 'Invalid email' : null),
                      const SizedBox(height: 12),
                      _buildField(_phoneCtrl, 'Phone', Icons.phone_outlined,
                          validator: (v) => (v == null || v.trim().length < 7) ? 'Invalid phone' : null),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _passwordCtrl,
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                        ),
                        obscureText: _obscure,
                        validator: (v) => (v == null || v.length < 6) ? 'Min 6 characters' : null,
                      ),
                      const SizedBox(height: 16),
                      const Align(
                        alignment: Alignment.centerLeft,
                        child: Text('I am a', style: TextStyle(fontWeight: FontWeight.w600)),
                      ),
                      const SizedBox(height: 8),
                      SegmentedButton<AppRole>(
                        segments: const [
                          ButtonSegment(value: AppRole.CUSTOMER, label: Text('Customer'), icon: Icon(Icons.person)),
                          ButtonSegment(value: AppRole.DRIVER, label: Text('Driver'), icon: Icon(Icons.drive_eta)),
                          ButtonSegment(value: AppRole.RESTAURANT, label: Text('Restaurant'), icon: Icon(Icons.restaurant)),
                          ButtonSegment(value: AppRole.ADMIN, label: Text('Admin'), icon: Icon(Icons.admin_panel_settings)),
                        ],
                        selected: {_role},
                        onSelectionChanged: (s) => setState(() => _role = s.first),
                      ),
                      const SizedBox(height: 24),
                      PrimaryButton(
                        label: auth.isLoading ? 'Creating...' : 'Sign up',
                        isLoading: auth.isLoading,
                        onPressed: auth.isLoading ? null : _submit,
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () => context.go('/login'),
                        child: Text('Already have an account? Log in',
                            style: TextStyle(color: Theme.of(context).colorScheme.secondary)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField(TextEditingController c, String label, IconData icon, {String? Function(String?)? validator}) {
    return TextFormField(
      controller: c,
      decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
      validator: validator,
    );
  }
}
