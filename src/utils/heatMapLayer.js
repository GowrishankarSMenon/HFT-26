import L from 'leaflet';

/* ----------------------------------------------------
   COLOR GRADIENT FOR COST VISUALIZATION
   Green (low cost/favorable) → Yellow → Red (high cost/unfavorable)
---------------------------------------------------- */
const getColorForCost = (costRatio) => {
    // costRatio: 0 (low cost/favorable) -> 1 (high cost/unfavorable)

    if (costRatio < 0.5) {
        // Green to Yellow (favorable to neutral)
        const r = Math.round(255 * (costRatio * 2));
        const g = 255;
        const b = 0;
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        // Yellow to Red (neutral to unfavorable)
        const r = 255;
        const g = Math.round(255 * (2 - costRatio * 2));
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
    const costRange = maxCost - minCost;

    console.log('\n=== HEAT MAP GENERATION ===');
    console.log(`Cost range: ${minCost} - ${maxCost}`);
    console.log(`Color scheme: Green (${minCost}) → Yellow → Red (${maxCost})`);
    console.log(`Visualizing ${cellsInPolygon.length} cells\n`);

    const heatMapLayer = L.layerGroup();

    cellsInPolygon.forEach((cell, idx) => {
        if (
            !Number.isFinite(cell.minLat) ||
            !Number.isFinite(cell.minLng) ||
            !Number.isFinite(cell.maxLat) ||
            !Number.isFinite(cell.maxLng)
        ) return;

        // Calculate cost ratio (0 = favorable/low cost, 1 = unfavorable/high cost)
        const costRatio = costRange > 0 ? (cell.cost - minCost) / costRange : 0;
        const color = getColorForCost(costRatio);

        // Favorability percentage (inverse of cost ratio)
        const favorability = (100 * (1 - costRatio)).toFixed(1);

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
          <strong style="color: #1f2937;">${cell.cost}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="color: #6b7280;">Favorability:</span>
          <strong style="color: ${costRatio < 0.3 ? '#059669' : costRatio < 0.7 ? '#d97706' : '#dc2626'};">
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
            ${costRatio < 0.3 ? '✓ HIGHLY FAVORABLE' : costRatio < 0.7 ? '⚠ MODERATE' : '✗ UNFAVORABLE'}
          </span>
        </div>
        <div style="margin-top: 4px; font-size: 10px; color: #9ca3af;">
          Lat: ${cell.centerLat.toFixed(6)}, Lng: ${cell.centerLng.toFixed(6)}
        </div>
      </div>`
        );

        heatMapLayer.addLayer(rect);
    });

    // Generate legend statistics
    const distribution = {
        highlyFavorable: cellsInPolygon.filter(c => {
            const ratio = costRange > 0 ? (c.cost - minCost) / costRange : 0;
            return ratio < 0.3;
        }).length,
        moderate: cellsInPolygon.filter(c => {
            const ratio = costRange > 0 ? (c.cost - minCost) / costRange : 0;
            return ratio >= 0.3 && ratio < 0.7;
        }).length,
        unfavorable: cellsInPolygon.filter(c => {
            const ratio = costRange > 0 ? (c.cost - minCost) / costRange : 0;
            return ratio >= 0.7;
        }).length
    };

    console.log('=== HEAT MAP DISTRIBUTION ===');
    console.log(`🟢 Highly Favorable (0-30% cost): ${distribution.highlyFavorable} cells (${(100 * distribution.highlyFavorable / cellsInPolygon.length).toFixed(1)}%)`);
    console.log(`🟡 Moderate (30-70% cost): ${distribution.moderate} cells (${(100 * distribution.moderate / cellsInPolygon.length).toFixed(1)}%)`);
    console.log(`🔴 Unfavorable (70-100% cost): ${distribution.unfavorable} cells (${(100 * distribution.unfavorable / cellsInPolygon.length).toFixed(1)}%)`);
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
          <span style="color: #059669; font-weight: 500;">Highly Favorable</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 20px; height: 20px; background: rgb(255, 255, 0); border: 1px solid #ccc;"></div>
          <span style="color: #d97706; font-weight: 500;">Moderate</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 20px; height: 20px; background: rgb(255, 0, 0); border: 1px solid #ccc;"></div>
          <span style="color: #dc2626; font-weight: 500;">Unfavorable</span>
        </div>
      </div>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280;">
        Based on proximity to existing charging stations
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
