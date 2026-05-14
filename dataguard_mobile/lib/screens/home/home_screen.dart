import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../dashboard/dashboard_page.dart';
import '../logs/logs_page.dart';
import '../policies/policies_page.dart';
import '../profile/profile_page.dart';
import '../settings/settings_page.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final _pages = const [
    DashboardPage(),
    LogsPage(),
    PoliciesPage(),
    ProfilePage(),
    SettingsPage(),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      body: Row(
        children: [
          _Sidebar(
            currentIndex: _currentIndex,
            onTap: (i) => setState(() => _currentIndex = i),
          ),
          Expanded(
            child: Container(
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
              child: _pages[_currentIndex],
            ),
          ),
        ],
      ),
    );
  }
}

class _Sidebar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const _Sidebar({required this.currentIndex, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 256,
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? DGColors.sidebarBgDark
            : DGColors.sidebarBgLight,
        border: Border(
          right: BorderSide(
            color: Theme.of(context).brightness == Brightness.dark
                ? DGColors.borderBlue
                : DGColors.borderLightBlue,
          ),
        ),
      ),
      child: Column(
        children: [
          const _SidebarHeader(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 24),
              children: [
                _SidebarItem(
                  icon: Icons.dashboard_outlined,
                  label: 'Dashboard',
                  isActive: currentIndex == 0,
                  onTap: () => onTap(0),
                ),
                _SidebarItem(
                  icon: Icons.storage_outlined,
                  label: 'Data Logs',
                  isActive: currentIndex == 1,
                  onTap: () => onTap(1),
                ),
                _SidebarItem(
                  icon: Icons.shield_outlined,
                  label: 'Security Policies',
                  isActive: currentIndex == 2,
                  onTap: () => onTap(2),
                ),
                _SidebarItem(
                  icon: Icons.person_outline,
                  label: 'Profile',
                  isActive: currentIndex == 3,
                  onTap: () => onTap(3),
                ),
                _SidebarItem(
                  icon: Icons.settings_outlined,
                  label: 'Settings',
                  isActive: currentIndex == 4,
                  onTap: () => onTap(4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SidebarHeader extends StatelessWidget {
  const _SidebarHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).brightness == Brightness.dark
                ? DGColors.borderBlue
                : DGColors.borderLightBlue,
          ),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: DGColors.accent.withAlpha(77), width: 2),
            ),
            child: const Icon(
              Icons.shield_outlined,
              size: 20,
              color: DGColors.accent,
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'DataGuard AI',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: DGColors.textDark,
                ),
              ),
              Text(
                'Security Agent v2.0',
                style: TextStyle(
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: DGColors.textMutedDark.withAlpha(179),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SidebarItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _SidebarItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: isActive
            ? const BoxDecoration(
                border: Border(
                  right: BorderSide(color: DGColors.accent, width: 3),
                ),
                gradient: LinearGradient(
                  colors: [
                    Color(0x2EF97316),
                    Color(0x0FF97316),
                  ],
                ),
              )
            : null,
        child: Row(
          children: [
            Icon(
              icon,
              size: 18,
              color: isActive ? DGColors.sidebarActive : DGColors.textMutedDark,
            ),
            const SizedBox(width: 12),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: isActive ? DGColors.sidebarActive : DGColors.textMutedDark,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
