import { LAYER_HIERARCHY, type Entity } from './models';

export interface LayerColorTheme {
  name: string;
  hex: string;
  bgRgba: string;
  borderHex: string;
  textHex: string;
  tailwindBg: string;
  tailwindBorder: string;
  tailwindText: string;
}

const PRESET_LAYER_COLORS: Record<string, LayerColorTheme> = {
  'Su-ken': {
    name: 'Su-ken',
    hex: '#38bdf8', // sky-400
    bgRgba: 'rgba(56, 189, 248, 0.12)',
    borderHex: '#0284c7',
    textHex: '#bae6fd',
    tailwindBg: 'bg-sky-950/40',
    tailwindBorder: 'border-sky-500/60',
    tailwindText: 'text-sky-300'
  },
  'Kan-ken': {
    name: 'Kan-ken',
    hex: '#fbbf24', // amber-400
    bgRgba: 'rgba(251, 191, 36, 0.12)',
    borderHex: '#d97706',
    textHex: '#fde68a',
    tailwindBg: 'bg-amber-950/40',
    tailwindBorder: 'border-amber-500/60',
    tailwindText: 'text-amber-300'
  },
  'An-ken': {
    name: 'An-ken',
    hex: '#c084fc', // purple-400
    bgRgba: 'rgba(192, 132, 252, 0.12)',
    borderHex: '#9333ea',
    textHex: '#e9d5ff',
    tailwindBg: 'bg-purple-950/40',
    tailwindBorder: 'border-purple-500/60',
    tailwindText: 'text-purple-300'
  },
  'Ki-ken': {
    name: 'Ki-ken',
    hex: '#fb7185', // rose-400
    bgRgba: 'rgba(251, 113, 133, 0.12)',
    borderHex: '#e11d48',
    textHex: '#fecdd3',
    tailwindBg: 'bg-rose-950/40',
    tailwindBorder: 'border-rose-500/60',
    tailwindText: 'text-rose-300'
  },
  '現実界': {
    name: '現実界',
    hex: '#34d399', // emerald-400
    bgRgba: 'rgba(52, 211, 153, 0.12)',
    borderHex: '#059669',
    textHex: '#a7f3d0',
    tailwindBg: 'bg-emerald-950/40',
    tailwindBorder: 'border-emerald-500/60',
    tailwindText: 'text-emerald-300'
  },
  '異界': {
    name: '異界',
    hex: '#e879f9', // fuchsia-400
    bgRgba: 'rgba(232, 121, 249, 0.12)',
    borderHex: '#c026d3',
    textHex: '#f5d0fe',
    tailwindBg: 'bg-fuchsia-950/40',
    tailwindBorder: 'border-fuchsia-500/60',
    tailwindText: 'text-fuchsia-300'
  },
  '表社会': {
    name: '表社会',
    hex: '#60a5fa', // blue-400
    bgRgba: 'rgba(96, 165, 250, 0.12)',
    borderHex: '#2563eb',
    textHex: '#bfdbfe',
    tailwindBg: 'bg-blue-950/40',
    tailwindBorder: 'border-blue-500/60',
    tailwindText: 'text-blue-300'
  },
  '裏社会': {
    name: '裏社会',
    hex: '#a78bfa', // violet-400
    bgRgba: 'rgba(167, 139, 250, 0.12)',
    borderHex: '#7c3aed',
    textHex: '#ddd6fe',
    tailwindBg: 'bg-violet-950/40',
    tailwindBorder: 'border-violet-500/60',
    tailwindText: 'text-violet-300'
  },
  '神界': {
    name: '神界',
    hex: '#facc15', // yellow-400
    bgRgba: 'rgba(250, 204, 21, 0.12)',
    borderHex: '#ca8a04',
    textHex: '#fef08a',
    tailwindBg: 'bg-yellow-950/40',
    tailwindBorder: 'border-yellow-500/60',
    tailwindText: 'text-yellow-300'
  },
  '魔界': {
    name: '魔界',
    hex: '#f87171', // red-400
    bgRgba: 'rgba(248, 113, 113, 0.12)',
    borderHex: '#dc2626',
    textHex: '#fecaca',
    tailwindBg: 'bg-red-950/40',
    tailwindBorder: 'border-red-500/60',
    tailwindText: 'text-red-300'
  }
};

const DYNAMIC_PALETTE = [
  { hex: '#38bdf8', borderHex: '#0284c7', textHex: '#bae6fd', bgRgba: 'rgba(56, 189, 248, 0.12)' },
  { hex: '#fbbf24', borderHex: '#d97706', textHex: '#fde68a', bgRgba: 'rgba(251, 191, 36, 0.12)' },
  { hex: '#34d399', borderHex: '#059669', textHex: '#a7f3d0', bgRgba: 'rgba(52, 211, 153, 0.12)' },
  { hex: '#c084fc', borderHex: '#9333ea', textHex: '#e9d5ff', bgRgba: 'rgba(192, 132, 252, 0.12)' },
  { hex: '#fb7185', borderHex: '#e11d48', textHex: '#fecdd3', bgRgba: 'rgba(251, 113, 133, 0.12)' },
  { hex: '#2dd4bf', borderHex: '#0d9488', textHex: '#99f6e4', bgRgba: 'rgba(45, 212, 191, 0.12)' },
  { hex: '#f472b6', borderHex: '#db2777', textHex: '#fbcfe8', bgRgba: 'rgba(244, 114, 182, 0.12)' },
  { hex: '#a3e635', borderHex: '#65a30d', textHex: '#d9f99d', bgRgba: 'rgba(163, 230, 53, 0.12)' }
];

export function getLayerColor(layer: string | null | undefined): LayerColorTheme {
  if (!layer) {
    return {
      name: '未分類',
      hex: '#94a3b8',
      bgRgba: 'rgba(148, 163, 184, 0.08)',
      borderHex: '#475569',
      textHex: '#cbd5e1',
      tailwindBg: 'bg-slate-900/40',
      tailwindBorder: 'border-slate-600/50',
      tailwindText: 'text-slate-300'
    };
  }

  if (PRESET_LAYER_COLORS[layer]) {
    return PRESET_LAYER_COLORS[layer];
  }

  // Consistent hash for dynamic custom layer names
  let hash = 0;
  for (let i = 0; i < layer.length; i++) {
    hash = (hash << 5) - hash + layer.charCodeAt(i);
    hash |= 0;
  }
  const colorIndex = Math.abs(hash) % DYNAMIC_PALETTE.length;
  const picked = DYNAMIC_PALETTE[colorIndex];

  return {
    name: layer,
    hex: picked.hex,
    bgRgba: picked.bgRgba,
    borderHex: picked.borderHex,
    textHex: picked.textHex,
    tailwindBg: 'bg-[#181c24]',
    tailwindBorder: `border-[${picked.borderHex}]`,
    tailwindText: `text-[${picked.textHex}]`
  };
}

/**
 * Extracts all unique layers currently declared or used in entities,
 * merging with custom layers and the default hierarchy.
 */
export function extractAllLayers(
  entities: Record<string, Entity> | Entity[],
  customLayers: string[] = []
): string[] {
  const entityList = Array.isArray(entities) ? entities : Object.values(entities);
  const foundLayers = new Set<string>();

  for (const ent of entityList) {
    if (ent.layer && ent.layer.trim()) {
      foundLayers.add(ent.layer.trim());
    }
  }

  for (const c of customLayers) {
    if (c && c.trim()) foundLayers.add(c.trim());
  }

  // If no entities have custom layers yet, default to LAYER_HIERARCHY
  if (foundLayers.size === 0) {
    LAYER_HIERARCHY.forEach(l => foundLayers.add(l));
  }

  return Array.from(foundLayers);
}

/**
 * Determines whether a relation between two entities crosses different layers.
 */
export function isCrossLayerRelation(
  sourceLayer?: string | null,
  targetLayer?: string | null
): boolean {
  if (!sourceLayer || !targetLayer) return false;
  return sourceLayer.trim() !== targetLayer.trim();
}
