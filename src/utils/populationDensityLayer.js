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
   FETCH POPULATION DENSITY DATA FROM DATABASE
---------------------------------------------------- */
export const fetchPopulationDensityData = async (bounds) => {
    try {
        const response = await fetch('/api/population_density', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bounds })
        });

        if (!response.ok) throw new Error('Failed to fetch population density data');

        const { densityData } = await response.json();
        return densityData;
    } catch (error) {
        console.error('Error fetching population density data:', error);
        return [];
    }
};

/* ----------------------------------------------------
   CALCULATE POPULATION DENSITY COST
   Cost inversely proportional to density (high density = low cost = favorable)
---------------------------------------------------- */
export const calculatePopulationDensityCost = (cells, densityData) => {
    if (!densityData || densityData.length === 0) {
        console.log('No population density data provided for cost calculation');
        return cells;
    }

    // EV penetration rate estimate (adjust based on Kerala data)
    const EV_PENETRATION_RATE = 0.02; // 2% of vehicles are EVs
    const VEHICLE_OWNERSHIP_RATE = 0.114; // 11.4% of population owns vehicles

    console.log('\n=== APPLYING POPULATION DENSITY COST ===');
    console.log(`Processing ${cells.length} cells based on ${densityData.length} density zones`);
    console.log(`EV penetration rate: ${(EV_PENETRATION_RATE * 100).toFixed(1)}%`);
    console.log(`Vehicle ownership rate: ${(VEHICLE_OWNERSHIP_RATE * 100).toFixed(1)}%\n`);

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
                const weight = Math.max(0, 1 - (distance / influenceRadius));

                // Calculate EV vehicle density per m²
                const evVehicleDensity = zone.density_per_m2 * VEHICLE_OWNERSHIP_RATE * EV_PENETRATION_RATE;

                totalWeightedDensity += evVehicleDensity * weight;
                totalWeight += weight;
            }
        });

        if (totalWeight > 0) {
            const avgEvDensity = totalWeightedDensity / totalWeight;

            // Store density for reference
            cell.evVehicleDensity = avgEvDensity;

            // Cost calculation: Higher EV density = Higher demand = LOWER cost (more favorable)
            // We invert the relationship: cost decreases as density increases
            // Normalize and invert: high density (e.g., 0.001) should give low cost
            // Use logarithmic scale to handle wide range of densities

            if (avgEvDensity > 0) {
                // Maximum benefit cost reduction (up to -50 cost points for high density areas)
                const MAX_DENSITY_BENEFIT = -50;

                // Logarithmic scaling: higher density = more negative cost (benefit)
                // Typical range: avgEvDensity from 0.000001 to 0.01
                const densityScore = Math.log10(avgEvDensity * 1000000 + 1); // Normalize to positive range
                const densityBenefit = Math.min(0, (densityScore / 10) * MAX_DENSITY_BENEFIT);

                cell.cost += Math.round(densityBenefit);
                cell.densityCostAdjustment = Math.round(densityBenefit);
            } else {
                cell.evVehicleDensity = 0;
                cell.densityCostAdjustment = 0;
            }
        } else {
            // No density zones nearby - slight penalty for unknown areas
            cell.evVehicleDensity = 0;
            cell.densityCostAdjustment = 10; // Small penalty
            cell.cost += 10;
        }
    });

    // Log statistics
    const cellsInPolygon = cells.filter(c => c.inPolygon);
    const cellsWithDensity = cellsInPolygon.filter(c => c.evVehicleDensity > 0);
    const avgDensity = cellsWithDensity.length > 0
        ? cellsWithDensity.reduce((sum, c) => sum + c.evVehicleDensity, 0) / cellsWithDensity.length
        : 0;
    const maxDensity = cellsWithDensity.length > 0
        ? Math.max(...cellsWithDensity.map(c => c.evVehicleDensity))
        : 0;
    const minDensity = cellsWithDensity.length > 0
        ? Math.min(...cellsWithDensity.map(c => c.evVehicleDensity))
        : 0;

    console.log('=== POPULATION DENSITY COST RESULTS ===');
    console.log(`Cells in polygon: ${cellsInPolygon.length}`);
    console.log(`Cells with density data: ${cellsWithDensity.length}`);
    console.log(`Cells without density data: ${cellsInPolygon.length - cellsWithDensity.length}`);
    console.log(`EV Vehicle Density statistics (vehicles per m²):`);
    console.log(`  - Min density: ${minDensity.toExponential(3)}`);
    console.log(`  - Max density: ${maxDensity.toExponential(3)}`);
    console.log(`  - Average density: ${avgDensity.toExponential(3)}`);
    console.log('');

    // Display sample of cells with density adjustments
    const sortedByDensity = cellsInPolygon
        .filter(c => c.evVehicleDensity > 0)
        .slice()
        .sort((a, b) => b.evVehicleDensity - a.evVehicleDensity);
    const sampleSize = Math.min(20, sortedByDensity.length);

    console.log(`=== TOP ${sampleSize} CELLS BY EV VEHICLE DENSITY ===`);
    console.table(sortedByDensity.slice(0, sampleSize).map((cell, idx) => ({
        rank: idx + 1,
        centerLat: cell.centerLat.toFixed(6),
        centerLng: cell.centerLng.toFixed(6),
        evDensity: cell.evVehicleDensity.toExponential(3),
        costAdjustment: cell.densityCostAdjustment,
        totalCost: cell.cost
    })));

    // Cost adjustment distribution
    const adjustmentRanges = {
        'High Benefit (-50 to -30)': 0,
        'Medium Benefit (-30 to -10)': 0,
        'Low Benefit (-10 to 0)': 0,
        'No Data (>0)': 0
    };

    cellsInPolygon.forEach(cell => {
        const adj = cell.densityCostAdjustment || 0;
        if (adj <= -30) adjustmentRanges['High Benefit (-50 to -30)']++;
        else if (adj <= -10) adjustmentRanges['Medium Benefit (-30 to -10)']++;
        else if (adj < 0) adjustmentRanges['Low Benefit (-10 to 0)']++;
        else adjustmentRanges['No Data (>0)']++;
    });

    console.log('\n=== DENSITY COST ADJUSTMENT DISTRIBUTION ===');
    console.table(Object.entries(adjustmentRanges).map(([range, count]) => ({
        adjustmentRange: range,
        cellCount: count,
        percentage: `${(100 * count / cellsInPolygon.length).toFixed(1)}%`
    })));

    console.log('\n');
    return cells;
};

export default {
    fetchPopulationDensityData,
    calculatePopulationDensityCost
};
