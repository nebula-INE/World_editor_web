/**
 * Point-of-View (POV) visual styles and helpers
 */

export interface POVConfig {
  characterName: string;
  color: string;
  bgSubtle: string;
  borderSubtle: string;
  badgeBg: string;
  textCol: string;
}

export const POV_PALETTES = [
  {
    color: '#06b6d4', // cyan-500
    bgSubtle: 'rgba(6, 182, 212, 0.08)',
    borderSubtle: 'rgba(6, 182, 212, 0.35)',
    badgeBg: 'rgba(6, 182, 212, 0.2)',
    textCol: '#22d3ee'
  },
  {
    color: '#8b5cf6', // violet-500
    bgSubtle: 'rgba(139, 92, 246, 0.08)',
    borderSubtle: 'rgba(139, 92, 246, 0.35)',
    badgeBg: 'rgba(139, 92, 246, 0.2)',
    textCol: '#a78bfa'
  },
  {
    color: '#10b981', // emerald-500
    bgSubtle: 'rgba(16, 185, 129, 0.08)',
    borderSubtle: 'rgba(16, 185, 129, 0.35)',
    badgeBg: 'rgba(16, 185, 129, 0.2)',
    textCol: '#34d399'
  },
  {
    color: '#f59e0b', // amber-500
    bgSubtle: 'rgba(245, 158, 11, 0.08)',
    borderSubtle: 'rgba(245, 158, 11, 0.35)',
    badgeBg: 'rgba(245, 158, 11, 0.2)',
    textCol: '#fbbf24'
  },
  {
    color: '#f43f5e', // rose-500
    bgSubtle: 'rgba(244, 63, 94, 0.08)',
    borderSubtle: 'rgba(244, 63, 94, 0.35)',
    badgeBg: 'rgba(244, 63, 94, 0.2)',
    textCol: '#fb7185'
  },
  {
    color: '#3b82f6', // blue-500
    bgSubtle: 'rgba(59, 130, 246, 0.08)',
    borderSubtle: 'rgba(59, 130, 246, 0.35)',
    badgeBg: 'rgba(59, 130, 246, 0.2)',
    textCol: '#60a5fa'
  }
];

export function getPovColor(characterName?: string | null): POVConfig {
  if (!characterName || characterName === '三人称客観' || characterName === '客観') {
    return {
      characterName: characterName || '三人称客観',
      color: '#64748b', // slate-500
      bgSubtle: 'rgba(100, 116, 139, 0.08)',
      borderSubtle: 'rgba(100, 116, 139, 0.3)',
      badgeBg: 'rgba(100, 116, 139, 0.2)',
      textCol: '#94a3b8'
    };
  }

  // Consistent hash for stable palette
  let hash = 0;
  for (let i = 0; i < characterName.length; i++) {
    hash = (hash << 5) - hash + characterName.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % POV_PALETTES.length;
  const palette = POV_PALETTES[idx];

  return {
    characterName,
    ...palette
  };
}
