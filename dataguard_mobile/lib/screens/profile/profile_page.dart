import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common/dg_card.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Profile',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: DGColors.textDark,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildAvatarCard(),
              const SizedBox(width: 20),
              Expanded(child: _buildInfoCard()),
            ],
          ),
          const SizedBox(height: 20),
          _buildSecurityCard(),
        ],
      ),
    );
  }

  Widget _buildAvatarCard() {
    return DGCard(
      width: 200,
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: DGColors.accent.withAlpha(77), width: 2),
              boxShadow: [
                BoxShadow(
                  color: DGColors.accent.withAlpha(51),
                  blurRadius: 18,
                ),
              ],
            ),
            child: const Icon(
              Icons.person,
              size: 40,
              color: DGColors.accent,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'John Doe',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: DGColors.textDark,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Security Analyst',
            style: TextStyle(
              fontSize: 11,
              fontFamily: 'monospace',
              color: DGColors.textMutedDark.withAlpha(179),
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.camera_alt_outlined, size: 14),
            label: const Text('CHANGE PHOTO'),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard() {
    return DGCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'ACCOUNT INFORMATION',
            style: TextStyle(
              fontSize: 10,
              fontFamily: 'monospace',
              fontWeight: FontWeight.w700,
              color: DGColors.textMutedDark,
            ),
          ),
          const SizedBox(height: 16),
          _buildInfoRow('Email', 'john.doe@example.com'),
          _buildDivider(),
          _buildInfoRow('Backup Email', 'john.doe.backup@example.com'),
          _buildDivider(),
          _buildInfoRow('Member Since', 'January 2025'),
          _buildDivider(),
          _buildInfoRow('Last Active', '2 hours ago'),
          _buildDivider(),
          _buildInfoRow('Email Verified', 'Yes'),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: DGColors.textMutedDark,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: DGColors.textDark,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return Divider(
      color: DGColors.borderBlue.withAlpha(77),
      height: 1,
    );
  }

  Widget _buildSecurityCard() {
    return DGCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'SECURITY SETTINGS',
            style: TextStyle(
              fontSize: 10,
              fontFamily: 'monospace',
              fontWeight: FontWeight.w700,
              color: DGColors.textMutedDark,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildSecurityOption(
                  'Change Password',
                  Icons.lock_outline,
                  () {},
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildSecurityOption(
                  'Two-Factor Auth',
                  Icons.security_outlined,
                  () {},
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildSecurityOption(
                  'Sessions',
                  Icons.devices_outlined,
                  () {},
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildSecurityOption(
                  'Export Data',
                  Icons.download_outlined,
                  () {},
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildSecurityOption(
                  'Delete Account',
                  Icons.delete_outline,
                  () {},
                ),
              ),
              const SizedBox(width: 12),
              Expanded(child: Container()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSecurityOption(String label, IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: DGColors.surfaceDark.withAlpha(76),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: DGColors.borderBlue.withAlpha(51)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 16, color: DGColors.accent),
            const SizedBox(width: 10),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: DGColors.textDark,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
