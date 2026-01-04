import L from 'leaflet';

/* ----------------------------------------------------
   COLOR GRADIENT FOR COST VISUALIZATION
   Cost range: -100 (green/highly favorable) → 0 (yellow/neutral) → 100 (red/unfavorable)
---------------------------------------------------- */
const getColorForCost = (cost) => {
  // Normalize cost from [-100, 100] to [0, 1]
  // -100 (green) = 0, 0 (yellow) = 0.5, 100 (red) = 1
  const normalizedCost = (cost + 100) / 200;

  if (normalizedCost < 0.5) {
    // Green to Yellow (favorable to neutral)
    const r = Math.round(255 * (normalizedCost * 2));
    const g = 255;
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Yellow to Red (neutral to unfavorable)
    const r = 255;
    const g = Math.round(255 * (2 - normalizedCost * 2));
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
  }
};

/* ----------------------------------------------------
   GENERATE HEAT MAP LAYER
   Visualizes cost distribution as a temperature map
---------------------------------------------------- */
export const generateHeatMapLayer = (map, cells) => {
  const cellsInPolygon = cells.filter(c => c.inPolygon);

  if (cellsInPolygon.length === 0) {
    console.warn('No cells in polygon to visualize');
    return null;
  }

  // Get cost range for color mapping
  const costs = cellsInPolygon.map(c => c.cost);
  const maxCost = Math.max(...costs);
  const minCost = Math.min(...costs);

  console.log('\n=== HEAT MAP GENERATION ===');
  console.log(`Cost range: ${minCost.toFixed(2)} to ${maxCost.toFixed(2)}`);
  console.log(`Color scheme: Green (-100/100%) → Yellow (0/0%) → Red (100/-100%)`);
  console.log(`Visualizing ${cellsInPolygon.length} cells\n`);

  const heatMapLayer = L.layerGroup();

  cellsInPolygon.forEach((cell, idx) => {
    if (
      !Number.isFinite(cell.minLat) ||
      !Number.isFinite(cell.minLng) ||
      !Number.isFinite(cell.maxLat) ||
      !Number.isFinite(cell.maxLng)
    ) return;

    // Get color based on cost value (-100 to 100 range)
    const color = getColorForCost(cell.cost);

    // Favorability percentage: -100 (red) to 100 (green)
    const favorability = (-cell.cost).toFixed(1);

    const rect = L.rectangle(
      [
        [cell.minLat, cell.minLng],
        [cell.maxLat, cell.maxLng]
      ],
      {
        color: color,
        weight: 0.5,
        fillColor: color,
        fillOpacity: 0.6
      }
    );

    rect.bindPopup(
      `<div style="font-family: system-ui; min-width: 200px;">
        <strong style="font-size: 14px; color: #1f2937;">Grid Cell ${idx + 1}</strong>
        <hr style="margin: 8px 0; border: none; border-top: 1px solid #e5e7eb;">
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="color: #6b7280;">Cost:</span>
          <strong style="color: #1f2937;">${cell.cost.toFixed(2)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="color: #6b7280;">Favorability:</span>
          <strong style="color: ${parseFloat(favorability) > 50 ? '#059669' : parseFloat(favorability) > -50 ? '#d97706' : '#dc2626'};">
            ${favorability}%
          </strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="color: #6b7280;">Nearest Station:</span>
          <strong style="color: #1f2937;">
            ${cell.nearestStationDistance ? cell.nearestStationDistance.toFixed(3) + ' km' : 'N/A'}
          </strong>
        </div>
        <div style="margin-top: 8px; padding: 6px; background: ${color}; border-radius: 4px; text-align: center;">
          <span style="font-size: 11px; font-weight: 600; color: #1f2937;">
            ${parseFloat(favorability) > 50 ? '✓ HIGHLY FAVORABLE' : parseFloat(favorability) > -50 ? '⚠ MODERATE' : '✗ UNFAVORABLE'}
          </span>
        </div>
        <div style="margin-top: 4px; font-size: 10px; color: #9ca3af;">
          Lat: ${cell.centerLat.toFixed(6)}, Lng: ${cell.centerLng.toFixed(6)}
        </div>
      </div>`
    );

    heatMapLayer.addLayer(rect);
  });

  // Generate legend statistics (based on favorability percentage)
  const distribution = {
    highlyFavorable: cellsInPolygon.filter(c => -c.cost > 50).length,  // > 50% favorable
    moderate: cellsInPolygon.filter(c => -c.cost >= -50 && -c.cost <= 50).length,  // -50% to 50%
    unfavorable: cellsInPolygon.filter(c => -c.cost < -50).length  // < -50% (unfavorable)
  };

  console.log('=== HEAT MAP DISTRIBUTION ===');
  console.log(`🟢 Highly Favorable (>50%): ${distribution.highlyFavorable} cells (${(100 * distribution.highlyFavorable / cellsInPolygon.length).toFixed(1)}%)`);
  console.log(`🟡 Moderate (-50% to 50%): ${distribution.moderate} cells (${(100 * distribution.moderate / cellsInPolygon.length).toFixed(1)}%)`);
  console.log(`🔴 Unfavorable (<-50%): ${distribution.unfavorable} cells (${(100 * distribution.unfavorable / cellsInPolygon.length).toFixed(1)}%)`);
  console.log('');

  heatMapLayer.addTo(map);
  return heatMapLayer;
};

/* ----------------------------------------------------
   ADD HEAT MAP LEGEND TO MAP
   Creates a visual legend showing the color scale
---------------------------------------------------- */
export const addHeatMapLegend = (map) => {
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'heat-map-legend');
    div.style.background = 'white';
    div.style.padding = '10px';
    div.style.borderRadius = '8px';
    div.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    div.style.fontFamily = 'system-ui';
    div.style.fontSize = '12px';

    div.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; color: #1f2937;">
        EV Station Favorability
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 20px; height: 20px; background: rgb(0, 255, 0); border: 1px solid #ccc;"></div>
          <span style="color: #059669; font-weight: 500;">100% (Highly Favorable)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 20px; height: 20px; background: rgb(255, 255, 0); border: 1px solid #ccc;"></div>
          <span style="color: #d97706; font-weight: 500;">0% (Neutral)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 20px; height: 20px; background: rgb(255, 0, 0); border: 1px solid #ccc;"></div>
          <span style="color: #dc2626; font-weight: 500;">-100% (Unfavorable)</span>
        </div>
      </div>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280;">
        Based on charging, density, substations & adoption
      </div>
    `;

    return div;
  };

  legend.addTo(map);
  return legend;
};

export default {
  generateHeatMapLayer,
  addHeatMapLegend,
  getColorForCost
};
