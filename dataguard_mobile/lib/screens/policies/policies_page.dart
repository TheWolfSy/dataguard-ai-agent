import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common/dg_card.dart';
import '../../widgets/common/dg_badge.dart';

class PoliciesPage extends StatelessWidget {
  const PoliciesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 20),
          Expanded(child: _buildPolicyList()),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Security Policies',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: DGColors.textDark,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '12 policies · 8 active · 2 with errors',
              style: TextStyle(
                fontSize: 11,
                color: DGColors.textMutedDark.withAlpha(179),
              ),
            ),
          ],
        ),
        ElevatedButton.icon(
          onPressed: () {},
          icon: const Icon(Icons.add, size: 14),
          label: const Text('NEW POLICY'),
        ),
      ],
    );
  }

  Widget _buildPolicyList() {
    final policies = [
      _Policy(
        name: 'PCI DSS Compliance',
        description: 'Payment Card Industry Data Security Standard enforcement for credit card data handling.',
        category: 'Compliance',
        isActive: true,
        syncStatus: 'synced',
      ),
      _Policy(
        name: 'GDPR Data Protection',
        description: 'General Data Protection Regulation rules for EU citizen data processing.',
        category: 'Regulatory',
        isActive: true,
        syncStatus: 'synced',
      ),
      _Policy(
        name: 'PII Auto-Redaction',
        description: 'Automatically redact personally identifiable information in log files and exports.',
        category: 'Security',
        isActive: true,
        syncStatus: 'synced',
      ),
      _Policy(
        name: 'Data Retention',
        description: 'Retention period rules for different data classification levels.',
        category: 'Governance',
        isActive: false,
        syncStatus: 'error',
      ),
      _Policy(
        name: 'Encryption at Rest',
        description: 'Enforce AES-256 encryption for all stored sensitive data.',
        category: 'Security',
        isActive: true,
        syncStatus: 'synced',
      ),
      _Policy(
        name: 'Access Control',
        description: 'Role-based access control for data classification and redaction tools.',
        category: 'Security',
        isActive: false,
        syncStatus: 'error',
      ),
      _Policy(
        name: 'SOC 2 Controls',
        description: 'Service Organization Control 2 security, availability, and confidentiality controls.',
        category: 'Compliance',
        isActive: true,
        syncStatus: 'synced',
      ),
      _Policy(
        name: 'HIPAA Safeguards',
        description: 'Health Insurance Portability and Accountability Act physical and technical safeguards.',
        category: 'Regulatory',
        isActive: true,
        syncStatus: 'synced',
      ),
      _Policy(
        name: 'Audit Logging',
        description: 'Comprehensive audit trail for all data access and modification events.',
        category: 'Governance',
        isActive: true,
        syncStatus: 'synced',
      ),
      _Policy(
        name: 'Data Classification',
        description: 'Automatic classification of data based on content analysis and pattern matching.',
        category: 'Security',
        isActive: false,
        syncStatus: 'pending',
      ),
      _Policy(
        name: 'Breach Notification',
        description: 'Automated notification workflow when a data breach is detected.',
        category: 'Compliance',
        isActive: false,
        syncStatus: 'pending',
      ),
      _Policy(
        name: 'Vendor Risk Management',
        description: 'Third-party vendor security assessment and monitoring policy.',
        category: 'Governance',
        isActive: true,
        syncStatus: 'synced',
      ),
    ];

    return ListView.builder(
      itemCount: policies.length,
      itemBuilder: (context, index) => _buildPolicyCard(policies[index]),
    );
  }

  Widget _buildPolicyCard(_Policy policy) {
    final statusBadge = switch (policy.syncStatus) {
      'synced' => const DGBadge(label: 'SYNCED', variant: DGBadgeVariant.success),
      'error' => const DGBadge(label: 'ERROR', variant: DGBadgeVariant.error),
      _ => const DGBadge(label: 'PENDING', variant: DGBadgeVariant.warning),
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: DGCard(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: policy.isActive
                    ? DGColors.success.withAlpha(25)
                    : DGColors.textMutedDark.withAlpha(25),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: policy.isActive
                      ? DGColors.success.withAlpha(64)
                      : DGColors.textMutedDark.withAlpha(51),
                ),
              ),
              child: Icon(
                Icons.shield_outlined,
                size: 18,
                color: policy.isActive ? DGColors.success : DGColors.textMutedDark,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        policy.name,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: DGColors.textDark,
                        ),
                      ),
                      const SizedBox(width: 8),
                      DGBadge(label: policy.category.toUpperCase(), variant: DGBadgeVariant.info),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    policy.description,
                    style: TextStyle(
                      fontSize: 10,
                      color: DGColors.textMutedDark.withAlpha(179),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            statusBadge,
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: policy.isActive
                    ? DGColors.success.withAlpha(25)
                    : DGColors.textMutedDark.withAlpha(25),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                policy.isActive ? 'ACTIVE' : 'INACTIVE',
                style: TextStyle(
                  fontSize: 9,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w700,
                  color: policy.isActive ? DGColors.success : DGColors.textMutedDark,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Policy {
  final String name;
  final String description;
  final String category;
  final bool isActive;
  final String syncStatus;

  const _Policy({
    required this.name,
    required this.description,
    required this.category,
    required this.isActive,
    required this.syncStatus,
  });
}
