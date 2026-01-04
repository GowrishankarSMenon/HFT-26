import L from 'leaflet';

/* ----------------------------------------------------
   SUBSTATIONS COST LAYER
   Calculates cost based on proximity to electrical substations
   Closer to substation = Better infrastructure = Lower cost (more favorable)
---------------------------------------------------- */

const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
};

/* ----------------------------------------------------
   EXPAND BOUNDS TO INCLUDE SURROUNDING AREA
   Polygon is for visualization, but costs are affected by surroundings
---------------------------------------------------- */
const expandBounds = (bounds, bufferKm = 5) => {
    // Calculate buffer in degrees (approximate)
    // 1 degree latitude ≈ 111 km
    const bufferDegrees = bufferKm / 111;

    const lats = bounds.map(coord => coord[0]);
    const lngs = bounds.map(coord => coord[1]);

    const minLat = Math.min(...lats) - bufferDegrees;
    const maxLat = Math.max(...lats) + bufferDegrees;
    const minLng = Math.min(...lngs) - bufferDegrees;
    const maxLng = Math.max(...lngs) + bufferDegrees;

    // Return expanded rectangular bounds
    return [
        [minLat, minLng],
        [minLat, maxLng],
        [maxLat, maxLng],
        [maxLat, minLng]
    ];
};

/* ----------------------------------------------------
   FETCH SUBSTATIONS DATA FROM DATABASE
   Fetches from expanded area (polygon + buffer) to account for surroundings
---------------------------------------------------- */
export const fetchSubstationsData = async (bounds, includeBuffer = true) => {
    try {
        // Expand bounds to include surrounding area for cost calculations
        const searchBounds = includeBuffer ? expandBounds(bounds, 5) : bounds;

        const response = await fetch('/api/substations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bounds: searchBounds })
        });

        if (!response.ok) throw new Error('Failed to fetch substations data');

        const { substations } = await response.json();
        console.log(`Fetched ${substations.length} substations from ${includeBuffer ? 'expanded' : 'polygon'} area`);
        return substations;
    } catch (error) {
        console.error('Error fetching substations data:', error);
        return [];
    }
};

/* ----------------------------------------------------
   CALCULATE SUBSTATIONS PROXIMITY COST
   Radial decay model: closer to substation = lower cost (more favorable)
   Higher voltage = stronger positive influence
---------------------------------------------------- */
export const calculateSubstationsCost = (cells, substationsData) => {
    if (!substationsData || substationsData.length === 0) {
        console.log('No substations data provided for cost calculation');
        return cells;
    }

    // Maximum benefit distance in km (beyond this, no benefit is applied)
    const MAX_BENEFIT_DISTANCE = 5.0; // 5 km radius
    const MAX_BENEFIT_COST = -50; // Maximum benefit (negative cost = favorable)

    console.log('\n=== APPLYING SUBSTATIONS PROXIMITY COST ===');
    console.log(`Processing ${cells.length} cells based on ${substationsData.length} substations`);
    console.log(`Benefit parameters: Max distance = ${MAX_BENEFIT_DISTANCE} km, Max benefit = ${MAX_BENEFIT_COST}`);
    console.log(`Model: Radial decay (highest benefit at center, decreases with distance)\n`);

    // Display substations
    console.log('=== SUBSTATIONS ===');
    console.table(substationsData.map((substation, idx) => ({
        id: idx + 1,
        Latitude: substation.Latitude.toFixed(6),
        Longitude: substation.Longitude.toFixed(6),
        Voltage_kV: substation.Voltage_kV
    })));

    cells.forEach((cell) => {
        let maxBenefit = 0;
        let nearestSubstationDistance = Infinity;
        let nearestSubstationVoltage = 0;

        // Find maximum benefit from all substations
        substationsData.forEach(substation => {
            const distance = calculateDistance(
                cell.centerLat,
                cell.centerLng,
                substation.Latitude,
                substation.Longitude
            ) / 1000; // Convert to km

            if (distance < nearestSubstationDistance) {
                nearestSubstationDistance = distance;
                nearestSubstationVoltage = substation.Voltage_kV;
            }

            // Calculate benefit using radial decay model
            if (distance <= MAX_BENEFIT_DISTANCE) {
                // Quadratic decay: benefit decreases with distance
                const distanceRatio = distance / MAX_BENEFIT_DISTANCE; // 0 (at substation) to 1 (at max distance)
                const benefitRatio = 1 - Math.pow(distanceRatio, 2); // Quadratic decay

                // Voltage scaling: higher voltage = stronger benefit (normalize to 400kV max)
                const voltageScale = Math.min(substation.Voltage_kV / 400, 1.5);

                const benefit = benefitRatio * MAX_BENEFIT_COST * voltageScale;
                maxBenefit = Math.min(maxBenefit, benefit); // More negative = better
            }
        });

        if (maxBenefit < 0) {
            cell.cost += Math.round(maxBenefit);
            cell.substationCostAdjustment = Math.round(maxBenefit);
        } else {
            cell.substationCostAdjustment = 0;
        }

        cell.nearestSubstationDistance = nearestSubstationDistance;
        cell.nearestSubstationVoltage = nearestSubstationVoltage;
    });

    // Log statistics
    const cellsInPolygon = cells.filter(c => c.inPolygon);
    const cellsWithBenefit = cellsInPolygon.filter(c => c.substationCostAdjustment < 0).length;
    const avgAdjustment = cellsInPolygon.reduce((sum, c) => sum + (c.substationCostAdjustment || 0), 0) / cellsInPolygon.length;

    console.log('\n=== SUBSTATIONS COST RESULTS ===');
    console.log(`Cells in polygon: ${cellsInPolygon.length}`);
    console.log(`Cells with substation benefit (within ${MAX_BENEFIT_DISTANCE} km): ${cellsWithBenefit}`);
    console.log(`Cells without benefit (beyond ${MAX_BENEFIT_DISTANCE} km): ${cellsInPolygon.length - cellsWithBenefit}`);
    console.log(`Average cost adjustment: ${avgAdjustment.toFixed(2)}`);
    console.log('');

    // Display sample of cells with best substation benefits
    const sortedByBenefit = cellsInPolygon
        .filter(c => c.substationCostAdjustment < 0)
        .slice()
        .sort((a, b) => a.substationCostAdjustment - b.substationCostAdjustment); // Most negative first
    const sampleSize = Math.min(20, sortedByBenefit.length);

    console.log(`=== TOP ${sampleSize} CELLS BY SUBSTATION BENEFIT ===`);
    console.table(sortedByBenefit.slice(0, sampleSize).map((cell, idx) => ({
        rank: idx + 1,
        centerLat: cell.centerLat.toFixed(6),
        centerLng: cell.centerLng.toFixed(6),
        costAdjustment: cell.substationCostAdjustment,
        nearestSubstation_km: cell.nearestSubstationDistance.toFixed(3),
        voltage_kV: cell.nearestSubstationVoltage,
        totalCost: cell.cost
    })));

    console.log('\n');
    return cells;
};

/* ----------------------------------------------------
   PLOT SUBSTATIONS ON MAP
   Visualize substation locations with voltage-based sizing
---------------------------------------------------- */
export const plotSubstationsOnMap = (map, substationsData, polygon = null) => {
    if (!substationsData || substationsData.length === 0) {
        console.log('No substations to plot');
        return null;
    }

    const layer = L.layerGroup();

    substationsData.forEach((substation, i) => {
        // Size based on voltage (larger = higher voltage)
        const radius = 4 + (substation.Voltage_kV / 100);

        const marker = L.circleMarker([substation.Latitude, substation.Longitude], {
            radius: radius,
            color: '#8b5cf6', // Purple color for substations
            fillColor: '#a78bfa',
            fillOpacity: 0.8,
            weight: 2
        });

        marker.bindPopup(
            `<strong>Substation ${i + 1}</strong><br/>` +
            `Voltage: ${substation.Voltage_kV} kV<br/>` +
            `Lat: ${substation.Latitude.toFixed(6)}<br/>` +
            `Lng: ${substation.Longitude.toFixed(6)}`
        );

        layer.addLayer(marker);
    });

    layer.addTo(map);
    console.log(`Plotted ${substationsData.length} substations on map`);
    return layer;
};

export default {
    fetchSubstationsData,
    calculateSubstationsCost,
    plotSubstationsOnMap
};
