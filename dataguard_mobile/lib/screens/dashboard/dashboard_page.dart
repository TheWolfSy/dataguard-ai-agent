import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common/dg_card.dart';
import '../../widgets/common/dg_badge.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(context),
          const SizedBox(height: 24),
          _buildStatCards(),
          const SizedBox(height: 24),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 2, child: _buildRecentLogs(context)),
              const SizedBox(width: 20),
              Expanded(flex: 1, child: _buildSidePanel(context)),
            ],
          ),
        ],
      ),
    );
  }


  Widget _buildHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Welcome back',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: DGColors.textDark,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'DataGuard AI — your data is protected in real-time.',
              style: TextStyle(
                fontSize: 11,
                color: DGColors.textMutedDark.withAlpha(179),
              ),
            ),
          ],
        ),
        DGCard(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.sync, size: 14, color: DGColors.success),
              const SizedBox(width: 8),
              Text(
                'ALL SYSTEMS NOMINAL',
                style: TextStyle(
                  fontSize: 9,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w700,
                  color: DGColors.success.withAlpha(204),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatCards() {
    final cards = [
      DGStatCard(
        label: 'Total Scans',
        value: '1,284',
        icon: Icons.search,
        iconColor: const Color(0xFF94A3B8),
      ),
      DGStatCard(
        label: 'PII Detected',
        value: '47',
        icon: Icons.warning_amber_rounded,
        iconColor: DGColors.critical,
      ),
      DGStatCard(
        label: 'Active Policies',
        value: '12',
        icon: Icons.shield_outlined,
        iconColor: const Color(0xFF38BDF8),
      ),
      DGStatCard(
        label: 'Protected Assets',
        value: '1,237',
        icon: Icons.lock_outline,
        iconColor: DGColors.success,
      ),
    ];

    return Row(
      children: cards
          .map((card) => Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Expanded(child: card),
              ))
          .toList(),
    );
  }

  Widget _buildRecentLogs(BuildContext context) {
    return DGCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'RECENT LOGS',
                style: TextStyle(
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w700,
                  color: DGColors.textMutedDark,
                ),
              ),
              InkWell(
                onTap: () {},
                child: const Row(
                  children: [
                    Text(
                      'VIEW ALL',
                      style: TextStyle(
                        fontSize: 9,
                        fontFamily: 'monospace',
                        color: DGColors.accent,
                      ),
                    ),
                    SizedBox(width: 4),
                    Icon(Icons.chevron_right, size: 14, color: DGColors.accent),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...List.generate(5, (i) => _buildLogRow(i)),
        ],
      ),
    );
  }

  Widget _buildLogRow(int index) {
    final logs = [
      ('credit-card.txt', 'Highly Sensitive', DGBadgeVariant.error, '2:30 PM'),
      ('passwords.xlsx', 'Confidential', DGBadgeVariant.warning, '1:45 PM'),
      ('notes.txt', 'Public', DGBadgeVariant.success, '12:15 PM'),
      ('config.json', 'Internal', DGBadgeVariant.info, '11:00 AM'),
      ('backup.sql', 'Confidential', DGBadgeVariant.warning, '9:30 AM'),
    ];
    final log = logs[index];

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: DGColors.surfaceDark.withAlpha(76),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: DGColors.borderBlue.withAlpha(51)),
        ),
        child: Row(
          children: [
            DGBadge(label: log.$2, variant: log.$3),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                log.$1,
                style: const TextStyle(
                  fontSize: 12,
                  color: DGColors.textDark,
                  fontFamily: 'monospace',
                ),
              ),
            ),
            Text(
              log.$4,
              style: TextStyle(
                fontSize: 9,
                fontFamily: 'monospace',
                color: DGColors.textMutedDark.withAlpha(153),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSidePanel(BuildContext context) {
    return Column(
      children: [
        _buildQuickActions(),
        const SizedBox(height: 16),
        _buildPolicyStatus(),
        const SizedBox(height: 16),
        _buildThreatBreakdown(),
      ],
    );
  }

  Widget _buildQuickActions() {
    return DGCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: DGColors.accent.withAlpha(25),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: DGColors.accent.withAlpha(64)),
                ),
                child: const Icon(Icons.bolt, size: 14, color: DGColors.accent),
              ),
              const SizedBox(width: 8),
              const Text(
                'QUICK ACTIONS',
                style: TextStyle(
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w700,
                  color: DGColors.textMutedDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...[
            ('Data Logs', Icons.storage_outlined, const Color(0xFF38BDF8)),
            ('Policies', Icons.shield_outlined, const Color(0xFF34D399)),
            ('Audit', Icons.check_circle_outline, const Color(0xFFA78BFA)),
            ('Settings', Icons.settings_outlined, DGColors.accent),
          ].map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: InkWell(
                  onTap: () {},
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: item.$3.withAlpha(12),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: item.$3.withAlpha(38)),
                    ),
                    child: Row(
                      children: [
                        Icon(item.$2, size: 14, color: item.$3),
                        const SizedBox(width: 8),
                        Text(
                          item.$1,
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: item.$3),
                        ),
                      ],
                    ),
                  ),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildPolicyStatus() {
    return DGCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: DGColors.accent.withAlpha(25),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: DGColors.accent.withAlpha(64)),
                ),
                child: const Icon(Icons.shield_outlined, size: 14, color: DGColors.accent),
              ),
              const SizedBox(width: 8),
              const Text(
                'POLICY STATUS',
                style: TextStyle(
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w700,
                  color: DGColors.textMutedDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...[
            ('Active', '8', DGColors.success),
            ('Synced', '10', const Color(0xFF38BDF8)),
            ('Error', '2', DGColors.critical),
          ].map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(width: 6, height: 6, decoration: BoxDecoration(color: item.$3, shape: BoxShape.circle)),
                        const SizedBox(width: 6),
                        Text(item.$1, style: const TextStyle(fontSize: 11, color: DGColors.textDark)),
                      ],
                    ),
                    Text(item.$2, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: item.$3)),
                  ],
                ),
              )),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: 8 / 12,
              backgroundColor: DGColors.borderBlue,
              valueColor: const AlwaysStoppedAnimation<Color>(DGColors.accent),
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            '8/12 active',
            style: TextStyle(fontSize: 9, fontFamily: 'monospace', color: DGColors.textMutedDark),
          ),
        ],
      ),
    );
  }

  Widget _buildThreatBreakdown() {
    return DGCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: DGColors.accent.withAlpha(25),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: DGColors.accent.withAlpha(64)),
                ),
                child: const Icon(Icons.bar_chart, size: 14, color: DGColors.accent),
              ),
              const SizedBox(width: 8),
              const Text(
                'THREAT BREAKDOWN',
                style: TextStyle(
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w700,
                  color: DGColors.textMutedDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...[
            ('Highly Sensitive', '12', DGColors.critical),
            ('Confidential', '18', DGColors.accent),
            ('Internal', '7', const Color(0xFF38BDF8)),
            ('Public', '10', DGColors.success),
          ].map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(item.$1, style: const TextStyle(fontSize: 10, fontFamily: 'monospace', color: DGColors.textMutedDark)),
                        Text(item.$2, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: item.$3)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: int.parse(item.$2) / 47,
                        backgroundColor: DGColors.borderBlue,
                        valueColor: AlwaysStoppedAnimation<Color>(item.$3),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}
