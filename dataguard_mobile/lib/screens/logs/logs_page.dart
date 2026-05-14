import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common/dg_card.dart';
import '../../widgets/common/dg_badge.dart';

class LogsPage extends StatefulWidget {
  const LogsPage({super.key});

  @override
  State<LogsPage> createState() => _LogsPageState();
}

class _LogsPageState extends State<LogsPage> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 20),
          _buildSearchBar(),
          const SizedBox(height: 20),
          Expanded(child: _buildLogList()),
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
              'Data Logs',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: DGColors.textDark,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '1284 total scans · 47 with PII detected',
              style: TextStyle(
                fontSize: 11,
                color: DGColors.textMutedDark.withAlpha(179),
              ),
            ),
          ],
        ),
        Row(
          children: [
            _buildFilterChip('All', true),
            const SizedBox(width: 8),
            _buildFilterChip('Sensitive', false),
            const SizedBox(width: 8),
            _buildFilterChip('Clean', false),
          ],
        ),
      ],
    );
  }

  Widget _buildFilterChip(String label, bool active) {
    return InkWell(
      onTap: () {},
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? DGColors.accent.withAlpha(38) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active ? DGColors.accent : DGColors.borderBlue,
          ),
        ),
        child: Text(
          label.toUpperCase(),
          style: TextStyle(
            fontSize: 9,
            fontFamily: 'monospace',
            fontWeight: FontWeight.w700,
            color: active ? DGColors.accent : DGColors.textMutedDark,
          ),
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return TextField(
      controller: _searchController,
      decoration: const InputDecoration(
        hintText: 'Search logs...',
        prefixIcon: Icon(Icons.search, size: 16),
      ),
    );
  }

  Widget _buildLogList() {
    final logs = List.generate(20, (i) => _LogEntry(
      id: 'LOG-${1000 + i}',
      fileName: ['credit-card.txt', 'passwords.xlsx', 'notes.txt', 'config.json', 'backup.sql'][i % 5],
      classification: ['Highly Sensitive', 'Confidential', 'Public', 'Internal', 'Confidential'][i % 5],
      time: '${10 + (i % 12)}:${((i * 5) % 60).toString().padLeft(2, '0')}',
      piiDetected: i % 3 == 0,
    ));

    return ListView.builder(
      itemCount: logs.length,
      itemBuilder: (context, index) => _buildLogItem(logs[index]),
    );
  }

  Widget _buildLogItem(_LogEntry log) {
    final badgeVariant = switch (log.classification) {
      'Highly Sensitive' => DGBadgeVariant.error,
      'Confidential' => DGBadgeVariant.warning,
      'Internal' => DGBadgeVariant.info,
      _ => DGBadgeVariant.success,
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: DGCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            DGBadge(label: log.classification.toUpperCase(), variant: badgeVariant),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    log.fileName,
                    style: const TextStyle(
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: DGColors.textDark,
                    ),
                  ),
                  Text(
                    log.id,
                    style: TextStyle(
                      fontSize: 9,
                      fontFamily: 'monospace',
                      color: DGColors.textMutedDark.withAlpha(153),
                    ),
                  ),
                ],
              ),
            ),
            if (log.piiDetected)
              const DGBadge(label: 'PII', variant: DGBadgeVariant.error),
            const SizedBox(width: 8),
            Text(
              log.time,
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
}

class _LogEntry {
  final String id;
  final String fileName;
  final String classification;
  final String time;
  final bool piiDetected;

  const _LogEntry({
    required this.id,
    required this.fileName,
    required this.classification,
    required this.time,
    required this.piiDetected,
  });
}
