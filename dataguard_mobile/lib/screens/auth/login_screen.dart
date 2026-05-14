import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common/dg_card.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback onLogin;

  const LoginScreen({super.key, required this.onLogin});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _showPassword = false;
  bool _isLoading = false; // ignore: prefer_final_fields

  final _regSteps = [
    _RegStepData('Personal Info', 'Step 1'),
    _RegStepData('Security', 'Step 2'),
    _RegStepData('Verify', 'Step 3'),
  ];
  int _regCurrentStep = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? [
                    DGColors.surfaceDarker,
                    const Color(0xFF0B1530),
                    const Color(0xFF0D1D3D),
                    const Color(0xFF061020),
                  ]
                : [
                    DGColors.surfaceLight,
                    const Color(0xFFE2E8F0),
                    const Color(0xFFCBD5E1),
                    DGColors.surfaceLight,
                  ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: _buildAuthCard(isDark),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAuthCard(bool isDark) {
    return DGCard(
      padding: const EdgeInsets.all(36),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildLogo(isDark),
          const SizedBox(height: 24),
          _buildTabBar(isDark),
          const SizedBox(height: 24),
          SizedBox(
            height: 400,
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildLoginTab(),
                _buildRegisterTab(),
                _buildRecoverTab(),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _buildFooter(),
        ],
      ),
    );
  }

  Widget _buildLogo(bool isDark) {
    return Column(
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: DGColors.accent.withAlpha(77), width: 2),
            boxShadow: [
              BoxShadow(
                color: DGColors.accent.withAlpha(77),
                blurRadius: 18,
              ),
            ],
          ),
          child: const Icon(
            Icons.shield_outlined,
            size: 40,
            color: DGColors.accent,
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'DataGuard AI',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.5,
            color: DGColors.textDark,
          ),
        ),
      ],
    );
  }

  Widget _buildTabBar(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withAlpha(10)
            : Colors.black.withAlpha(10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark
              ? DGColors.borderBlue
              : DGColors.borderLightBlue,
        ),
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          gradient: LinearGradient(
            colors: isDark
                ? [const Color(0xFF1E3A5F), const Color(0xFF1A2E50)]
                : [Colors.blue.withAlpha(26), Colors.blue.withAlpha(13)],
          ),
          border: Border.all(
            color: isDark
                ? DGColors.blue.withAlpha(102)
                : DGColors.blue.withAlpha(102),
          ),
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        labelColor: isDark ? DGColors.badgeInfo : DGColors.blue,
        unselectedLabelColor: DGColors.textMutedDark,
        tabs: const [
          Tab(text: 'Login'),
          Tab(text: 'Register'),
          Tab(text: 'Recover'),
        ],
      ),
    );
  }

  Widget _buildLoginTab() {
    return Form(
      key: _formKey,
      child: ListView(
        children: [
          const Text(
            'Secure your data with intelligent PII detection and automated protection strategies.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              color: DGColors.textMutedDark,
            ),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _emailController,
            decoration: const InputDecoration(
              labelText: 'Email',
              hintText: 'example@email.com',
            ),
            keyboardType: TextInputType.emailAddress,
            validator: (v) =>
                v?.isEmpty ?? true ? 'Please enter your email' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _passwordController,
            decoration: InputDecoration(
              labelText: 'Password',
              hintText: '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022',
              suffixIcon: IconButton(
                icon: Icon(
                  _showPassword ? Icons.visibility_off : Icons.visibility,
                  size: 18,
                ),
                onPressed: () => setState(() => _showPassword = !_showPassword),
              ),
            ),
            obscureText: !_showPassword,
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleLogin,
              child: _isLoading
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.lock_outline, size: 16),
                        SizedBox(width: 8),
                        Text('Login'),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRegisterTab() {
    return ListView(
      children: [
        _buildStepper(),
        const SizedBox(height: 16),
        if (_regCurrentStep == 0) _buildRegStep1(),
        if (_regCurrentStep == 1) _buildRegStep2(),
        if (_regCurrentStep == 2) _buildRegStep3(),
        const SizedBox(height: 16),
        Row(
          children: [
            if (_regCurrentStep > 0)
              Expanded(
                child: TextButton(
                  onPressed: () =>
                      setState(() => _regCurrentStep--),
                  child: const Text('Back'),
                ),
              ),
            const SizedBox(width: 8),
            Expanded(
              child: ElevatedButton(
                onPressed: () {
                  if (_regCurrentStep < 2) {
                    setState(() => _regCurrentStep++);
                  }
                },
                child: Text(
                    _regCurrentStep < 2 ? 'Next \u2192' : 'Create Account'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStepper() {
    return Row(
      children: List.generate(_regSteps.length * 2 - 1, (i) {
        if (i.isOdd) {
          return Expanded(
            child: Container(
              height: 2,
              margin: const EdgeInsets.only(bottom: 28),
              color: i ~/ 2 < _regCurrentStep
                  ? DGColors.success
                  : DGColors.textMutedDark.withAlpha(51),
            ),
          );
        }
        final step = i ~/ 2;
        final isDone = step < _regCurrentStep;
        final isActive = step == _regCurrentStep;
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDone
                    ? DGColors.success
                    : isActive
                        ? DGColors.accent
                        : Colors.white.withAlpha(15),
                border: Border.all(
                  color: isDone
                      ? DGColors.success
                      : isActive
                          ? DGColors.accent
                          : DGColors.textMutedDark.withAlpha(77),
                ),
                boxShadow: isActive
                    ? [
                        BoxShadow(
                          color: DGColors.accent.withAlpha(64),
                          blurRadius: 8,
                        ),
                      ]
                    : null,
              ),
              child: isDone
                  ? const Icon(Icons.check, size: 16, color: Colors.white)
                  : Text(
                      '${step + 1}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: isActive ? Colors.white : DGColors.textMutedDark,
                      ),
                    ),
            ),
            const SizedBox(height: 4),
            Text(
              _regSteps[step].label,
              style: TextStyle(
                fontSize: 9,
                fontFamily: 'monospace',
                color: isActive
                    ? DGColors.accent
                    : isDone
                        ? DGColors.success
                        : DGColors.textMutedDark,
              ),
            ),
          ],
        );
      }),
    );
  }

  Widget _buildRegStep1() {
    return Column(
      children: [
        TextFormField(
          decoration: const InputDecoration(labelText: 'Full Name'),
        ),
        const SizedBox(height: 10),
        TextFormField(
          decoration: const InputDecoration(labelText: 'Email'),
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 10),
        TextFormField(
          decoration: const InputDecoration(labelText: 'Password'),
          obscureText: true,
        ),
      ],
    );
  }

  Widget _buildRegStep2() {
    return Column(
      children: [
        _buildSecurityQuestion('What was your first pet\'s name?', 1),
        const SizedBox(height: 10),
        _buildSecurityQuestion('What city were you born in?', 2),
        const SizedBox(height: 10),
        _buildSecurityQuestion('What is your mother\'s maiden name?', 3),
      ],
    );
  }

  Widget _buildSecurityQuestion(String question, int index) {
    return DGCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            question,
            style: const TextStyle(
              fontSize: 12,
              color: DGColors.badgeInfo,
            ),
          ),
          const SizedBox(height: 8),
          TextFormField(
            decoration: InputDecoration(
              hintText: 'Answer $index',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRegStep3() {
    return Column(
      children: [
        const Text(
          'Verification code has been sent to your email.',
          style: TextStyle(fontSize: 12, color: DGColors.textMutedDark),
        ),
        const SizedBox(height: 16),
        TextFormField(
          decoration: const InputDecoration(
            labelText: 'Verification Code',
            hintText: '000000',
          ),
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildRecoverTab() {
    return ListView(
      children: [
        TextFormField(
          decoration: const InputDecoration(
            labelText: 'Email',
            hintText: 'example@email.com',
          ),
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () {},
            child: const Text('Send Recovery Code'),
          ),
        ),
      ],
    );
  }

  Widget _buildFooter() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.lock_outline, size: 12, color: DGColors.textMutedDark),
        const SizedBox(width: 6),
        const Text(
          'End-to-end encrypted',
          style: TextStyle(
            fontSize: 10,
            fontFamily: 'monospace',
            color: DGColors.textMutedDark,
          ),
        ),
      ],
    );
  }

  void _handleLogin() {
    if (_formKey.currentState?.validate() ?? false) {
      widget.onLogin();
    }
  }
}

class _RegStepData {
  final String label;
  final String description;
  _RegStepData(this.label, this.description);
}
