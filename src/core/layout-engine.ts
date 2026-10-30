import { Entity } from './models';

export interface LayoutOptions {
  canvasWidth?: number;
  canvasHeight?: number;
  laneOrientation?: 'horizontal' | 'vertical';
  nodeRadius?: number;
}

/**
 * Arranges nodes into neat layer-based swimlanes / bands.
 * Each layer gets its own dedicated column or row, with nodes neatly gridded inside.
 */
export function computeLayerSwimlaneLayout(
  entities: Entity[],
  layers: string[],
  options: LayoutOptions = {}
): Record<string, { x: number; y: number }> {
  const {
    laneOrientation = 'horizontal',
    nodeRadius = 40,
  } = options;

  const positions: Record<string, { x: number; y: number }> = {};
  if (entities.length === 0) return positions;

  // Group entities by layer
  const layerGroups: Record<string, Entity[]> = {};
  layers.forEach(layer => {
    layerGroups[layer] = [];
  });
  const unassignedEntities: Entity[] = [];

  entities.forEach(entity => {
    if (entity.layer && layerGroups[entity.layer]) {
      layerGroups[entity.layer].push(entity);
    } else {
      unassignedEntities.push(entity);
    }
  });

  // Only keep layers that actually have entities
  const activeLayers = layers.filter(layer => layerGroups[layer]?.length > 0);
  if (unassignedEntities.length > 0) {
    activeLayers.push('未設定');
    layerGroups['未設定'] = unassignedEntities;
  }

  if (activeLayers.length === 0) return positions;

  const nodeDiameter = nodeRadius * 2;
  const paddingX = 80;
  const paddingY = 80;
  const itemGapX = 140;
  const itemGapY = 110;

  if (laneOrientation === 'horizontal') {
    // Horizontal lanes stacked vertically, or side-by-side columns
    // Side-by-side columns (bands) is the most standard swimlane visualization
    const columnWidth = 320;
    const startX = 200;
    const startY = 180;

    activeLayers.forEach((layerName, layerIdx) => {
      const groupEntities = layerGroups[layerName] || [];
      const colX = startX + layerIdx * (columnWidth + 60);

      // Arrange nodes inside this column in 2 columns if more than 4 nodes, else 1 column
      const nodesPerSubCol = groupEntities.length > 6 ? 2 : 1;
      const subColWidth = nodesPerSubCol === 2 ? 140 : 0;

      groupEntities.forEach((entity, idx) => {
        if (nodesPerSubCol === 1) {
          positions[entity.id] = {
            x: colX + columnWidth / 2,
            y: startY + idx * itemGapY,
          };
        } else {
          const subCol = idx % 2;
          const row = Math.floor(idx / 2);
          positions[entity.id] = {
            x: colX + (subCol === 0 ? 80 : 80 + subColWidth),
            y: startY + row * itemGapY,
          };
        }
      });
    });
  } else {
    // Horizontal rows
    const rowHeight = 240;
    const startX = 200;
    const startY = 180;

    activeLayers.forEach((layerName, layerIdx) => {
      const groupEntities = layerGroups[layerName] || [];
      const rowY = startY + layerIdx * (rowHeight + 40);

      groupEntities.forEach((entity, idx) => {
        positions[entity.id] = {
          x: startX + idx * itemGapX,
          y: rowY + rowHeight / 2,
        };
      });
    });
  }

  return positions;
}
