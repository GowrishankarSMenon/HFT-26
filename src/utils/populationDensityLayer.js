/* ----------------------------------------------------
   POPULATION DENSITY COST LAYER
   Calculates cost based on EV vehicle density in the area
   Higher population density = Higher demand = Lower cost (more favorable)
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
   FETCH POPULATION DENSITY DATA FROM DATABASE
   Fetches from expanded area (polygon + buffer) to account for surroundings
---------------------------------------------------- */
export const fetchPopulationDensityData = async (bounds, includeBuffer = true) => {
    try {
        // Expand bounds to include surrounding area for cost calculations
        const searchBounds = includeBuffer ? expandBounds(bounds, 5) : bounds;

        const response = await fetch('/api/population_density', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bounds: searchBounds })
        });

        if (!response.ok) throw new Error('Failed to fetch population density data');

        const { densityData } = await response.json();
        console.log(`Fetched ${densityData.length} density zones from ${includeBuffer ? 'expanded' : 'polygon'} area`);
        return densityData;
    } catch (error) {
        console.error('Error fetching population density data:', error);
        return [];
    }
};

/* ----------------------------------------------------
   CALCULATE POPULATION DENSITY COST
   Simple formula: cost = density * weight
   Also considers proximity to density centers (similar to charging stations)
---------------------------------------------------- */
export const calculatePopulationDensityCost = (cells, densityData, chargingStations = []) => {
    if (!densityData || densityData.length === 0) {
        console.log('No population density data provided for cost calculation');
        return cells;
    }

    // WEIGHT CONSTANT - Adjust this to control cost impact
    const WEIGHT = -10000;

    console.log('\n=== APPLYING POPULATION DENSITY COST ===');
    console.log(`Processing ${cells.length} cells based on ${densityData.length} density zones`);
    console.log(`Charging stations for proximity: ${chargingStations.length}`);
    console.log(`Weight constant: ${WEIGHT}\n`);

    // Display density centers
    console.log('=== DENSITY CENTERS ===');
    console.table(densityData.map((zone, idx) => ({
        id: idx + 1,
        latitude: zone.latitude.toFixed(6),
        longitude: zone.longitude.toFixed(6),
        density_per_m2: zone.density_per_m2,
        area: zone.area,
        population: zone.population
    })));

    cells.forEach((cell) => {
        let totalWeightedDensity = 0;
        let totalWeight = 0;

        // Calculate influence from all nearby density zones
        densityData.forEach(zone => {
            const distance = calculateDistance(
                cell.centerLat,
                cell.centerLng,
                zone.latitude,
                zone.longitude
            );

            // Calculate area radius (assuming circular area)
            const areaRadius = Math.sqrt(zone.area / Math.PI);

            // Only consider zones within their radius + buffer
            const influenceRadius = areaRadius + 500; // 500m buffer

            if (distance <= influenceRadius) {
                // Weight decreases with distance from zone center
                const distanceWeight = Math.max(0, 1 - (distance / influenceRadius));

                totalWeightedDensity += zone.density_per_m2 * distanceWeight;
                totalWeight += distanceWeight;
            }
        });

        if (totalWeight > 0) {
            const avgDensity = totalWeightedDensity / totalWeight;

            // Store density for reference
            cell.density = avgDensity;

            // Simple formula: cost = density * weight
            const densityCost = Math.round(avgDensity * WEIGHT);

            cell.cost += densityCost;
            cell.densityCostAdjustment = densityCost;
        } else {
            // No density zones nearby
            cell.density = 0;
            cell.densityCostAdjustment = 0;
        }
    });

    // Log statistics
    const cellsInPolygon = cells.filter(c => c.inPolygon);
    const cellsWithDensity = cellsInPolygon.filter(c => c.density > 0);
    const avgDensity = cellsWithDensity.length > 0
        ? cellsWithDensity.reduce((sum, c) => sum + c.density, 0) / cellsWithDensity.length
        : 0;
    const maxDensity = cellsWithDensity.length > 0
        ? Math.max(...cellsWithDensity.map(c => c.density))
        : 0;
    const minDensity = cellsWithDensity.length > 0
        ? Math.min(...cellsWithDensity.map(c => c.density))
        : 0;

    console.log('\n=== POPULATION DENSITY COST RESULTS ===');
    console.log(`Cells in polygon: ${cellsInPolygon.length}`);
    console.log(`Cells with density data: ${cellsWithDensity.length}`);
    console.log(`Cells without density data: ${cellsInPolygon.length - cellsWithDensity.length}`);
    console.log(`Density statistics (per m²):`);
    console.log(`  - Min density: ${minDensity.toExponential(3)}`);
    console.log(`  - Max density: ${maxDensity.toExponential(3)}`);
    console.log(`  - Average density: ${avgDensity.toExponential(3)}`);
    console.log('');

    // Display sample of cells with density adjustments
    const sortedByDensity = cellsInPolygon
        .filter(c => c.density > 0)
        .slice()
        .sort((a, b) => b.density - a.density);
    const sampleSize = Math.min(20, sortedByDensity.length);

    console.log(`=== TOP ${sampleSize} CELLS BY DENSITY ===`);
    console.table(sortedByDensity.slice(0, sampleSize).map((cell, idx) => ({
        rank: idx + 1,
        centerLat: cell.centerLat.toFixed(6),
        centerLng: cell.centerLng.toFixed(6),
        density: cell.density.toExponential(3),
        costAdjustment: cell.densityCostAdjustment,
        totalCost: cell.cost
    })));

    console.log('\n');
    return cells;
};

export default {
    fetchPopulationDensityData,
    calculatePopulationDensityCost
};
