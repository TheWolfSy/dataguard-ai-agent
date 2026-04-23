import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

const SIDEBAR_HOVER_COLORS = [
  { bg: 'rgba(249,115,22,0.12)',  text: '#fb923c', border: '#f97316' },
  { bg: 'rgba(96,165,250,0.12)',  text: '#93c5fd', border: '#60a5fa' },
  { bg: 'rgba(52,211,153,0.10)',  text: '#6ee7b7', border: '#34d399' },
  { bg: 'rgba(167,139,250,0.10)', text: '#c4b5fd', border: '#a78bfa' },
  { bg: 'rgba(251,191,36,0.10)',  text: '#fde68a', border: '#fbbf24' },
  { bg: 'rgba(248,113,113,0.10)', text: '#fca5a5', border: '#f87171' },
];

export const SidebarItem = ({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: number;
}) => {
  const [hoverColor, setHoverColor] = React.useState<typeof SIDEBAR_HOVER_COLORS[0] | null>(null);

  const handleMouseEnter = () => {
    const random = SIDEBAR_HOVER_COLORS[Math.floor(Math.random() * SIDEBAR_HOVER_COLORS.length)];
    setHoverColor(random);
  };

  const handleMouseLeave = () => setHoverColor(null);

  const dynamicStyle =
    !active && hoverColor
      ? {
          backgroundColor: hoverColor.bg,
          color: hoverColor.text,
          borderRightColor: hoverColor.border,
        }
      : {};

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      style={dynamicStyle}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3.5 text-sm font-semibold transition-all duration-200 rounded-lg mx-1',
        active
          ? 'dg-sidebar-active'
          : `text-slate-400 ${hoverColor ? 'border-r-2' : ''}`
      )}
    >
      <div className={cn('p-1.5 rounded-lg transition-colors', active ? 'bg-orange-500/15' : 'bg-white/[0.03]')}>
        <Icon className="w-4 h-4 flex-shrink-0" />
      </div>
      <span className="flex-1 text-start text-sm">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[9px] font-bold leading-[18px] text-center tabular-nums" style={{ boxShadow: '0 0 10px rgba(249,115,22,0.4)' }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </motion.button>
  );
};
