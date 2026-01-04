import L from 'leaflet';

/* ----------------------------------------------------
   ADOPTION LIKELIHOOD COST LAYER
   Calculates cost based on EV adoption likelihood in the area
   Higher adoption likelihood = More open to EV = Lower cost (more favorable)
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
   FETCH ADOPTION LIKELIHOOD DATA FROM DATABASE
   Fetches from expanded area (polygon + buffer) to account for surroundings
---------------------------------------------------- */
export const fetchAdoptionLikelihoodData = async (bounds, includeBuffer = true) => {
    try {
        // Expand bounds to include surrounding area for cost calculations
        const searchBounds = includeBuffer ? expandBounds(bounds, 5) : bounds;

        const response = await fetch('/api/adoption_likelihood', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bounds: searchBounds })
        });

        if (!response.ok) throw new Error('Failed to fetch adoption likelihood data');

        const { adoptionData } = await response.json();
        console.log(`Fetched ${adoptionData.length} adoption likelihood zones from ${includeBuffer ? 'expanded' : 'polygon'} area`);
        return adoptionData;
    } catch (error) {
        console.error('Error fetching adoption likelihood data:', error);
        return [];
    }
};

/* ----------------------------------------------------
   CALCULATE ADOPTION LIKELIHOOD COST
   Uses radial decay from adoption centers
   Formula based on population, ev_adoption_likelihood_score, and area metrics
---------------------------------------------------- */
export const calculateAdoptionLikelihoodCost = (cells, adoptionData) => {
    if (!adoptionData || adoptionData.length === 0) {
        console.log('No adoption likelihood data provided for cost calculation');
        return cells;
    }

    // ADOPTION WEIGHT CONSTANT - Adjust this to control cost impact
    const ADOPTION_WEIGHT = -1;

    console.log('\n=== APPLYING ADOPTION LIKELIHOOD COST ===');
    console.log(`Processing ${cells.length} cells based on ${adoptionData.length} adoption zones`);
    console.log(`Adoption weight constant: ${ADOPTION_WEIGHT}\n`);

    // Display adoption centers
    console.log('=== ADOPTION LIKELIHOOD CENTERS ===');
    console.table(adoptionData.map((zone, idx) => ({
        id: idx + 1,
        latitude: zone.latitude.toFixed(6),
        longitude: zone.longitude.toFixed(6),
        population: zone.population,
        ev_adoption_likelihood_score: zone.ev_adoption_likelihood_score,
        per_capita_income: zone.per_capita_income,
        area: zone.area
    })));

    cells.forEach((cell) => {
        let totalWeightedAdoption = 0;
        let totalInfluenceWeight = 0;

        // Calculate influence from all nearby adoption zones (radial decay)
        adoptionData.forEach(zone => {
            const distance = calculateDistance(
                cell.centerLat,
                cell.centerLng,
                zone.latitude,
                zone.longitude
            );

            // Calculate area radius (assuming circular area)
            const areaRadius = Math.sqrt(zone.area / Math.PI);

            // Influence radius = area radius + buffer
            const influenceRadius = areaRadius + 500; // 500m buffer

            if (distance <= influenceRadius) {
                // Radial decay: influence decreases with distance from zone center
                const distanceInfluence = Math.max(0, 1 - (distance / influenceRadius));

                // Calculate adoption likelihood metric
                // Higher population + higher ev_adoption_likelihood_score = higher likelihood
                const adoptionMetric = zone.population * zone.ev_adoption_likelihood_score;

                totalWeightedAdoption += adoptionMetric * distanceInfluence;
                totalInfluenceWeight += distanceInfluence;
            }
        });

        if (totalInfluenceWeight > 0) {
            const avgAdoptionMetric = totalWeightedAdoption / totalInfluenceWeight;

            // Store adoption metric for reference
            cell.adoptionLikelihood = avgAdoptionMetric;

            // Calculate cost: higher adoption = lower cost (more favorable)
            // Negative cost = favorable
            const adoptionCost = Math.round(avgAdoptionMetric * ADOPTION_WEIGHT);

            cell.cost += adoptionCost;
            cell.adoptionCostAdjustment = adoptionCost;
        } else {
            // No adoption zones nearby
            cell.adoptionLikelihood = 0;
            cell.adoptionCostAdjustment = 0;
        }
    });

    // Log statistics
    const cellsInPolygon = cells.filter(c => c.inPolygon);
    const cellsWithAdoption = cellsInPolygon.filter(c => c.adoptionLikelihood > 0);
    const avgAdoption = cellsWithAdoption.length > 0
        ? cellsWithAdoption.reduce((sum, c) => sum + c.adoptionLikelihood, 0) / cellsWithAdoption.length
        : 0;
    const maxAdoption = cellsWithAdoption.length > 0
        ? Math.max(...cellsWithAdoption.map(c => c.adoptionLikelihood))
        : 0;
    const minAdoption = cellsWithAdoption.length > 0
        ? Math.min(...cellsWithAdoption.map(c => c.adoptionLikelihood))
        : 0;

    console.log('\n=== ADOPTION LIKELIHOOD COST RESULTS ===');
    console.log(`Cells in polygon: ${cellsInPolygon.length}`);
    console.log(`Cells with adoption data: ${cellsWithAdoption.length}`);
    console.log(`Cells without adoption data: ${cellsInPolygon.length - cellsWithAdoption.length}`);
    console.log(`Adoption likelihood statistics:`);
    console.log(`  - Min likelihood: ${minAdoption.toExponential(3)}`);
    console.log(`  - Max likelihood: ${maxAdoption.toExponential(3)}`);
    console.log(`  - Average likelihood: ${avgAdoption.toExponential(3)}`);
    console.log('');

    // Display sample of cells with best adoption likelihood
    const sortedByAdoption = cellsInPolygon
        .filter(c => c.adoptionLikelihood > 0)
        .slice()
        .sort((a, b) => b.adoptionLikelihood - a.adoptionLikelihood);
    const sampleSize = Math.min(20, sortedByAdoption.length);

    console.log(`=== TOP ${sampleSize} CELLS BY ADOPTION LIKELIHOOD ===`);
    console.table(sortedByAdoption.slice(0, sampleSize).map((cell, idx) => ({
        rank: idx + 1,
        centerLat: cell.centerLat.toFixed(6),
        centerLng: cell.centerLng.toFixed(6),
        adoptionLikelihood: cell.adoptionLikelihood.toExponential(3),
        costAdjustment: cell.adoptionCostAdjustment,
        totalCost: cell.cost
    })));

    console.log('\n');
    return cells;
};

/* ----------------------------------------------------
   PLOT ADOPTION LIKELIHOOD CENTERS ON MAP
   Visualize adoption likelihood zone centers
---------------------------------------------------- */
export const plotAdoptionCentersOnMap = (map, adoptionData) => {
    if (!adoptionData || adoptionData.length === 0) {
        console.log('No adoption likelihood centers to plot');
        return null;
    }

    const layer = L.layerGroup();

    adoptionData.forEach((zone, i) => {
        // Size based on adoption rate
        const radius = 4 + (zone.ev_adoption_likelihood_score * 10);

        const marker = L.circleMarker([zone.latitude, zone.longitude], {
            radius: radius,
            color: '#f59e0b', // Amber color for adoption zones
            fillColor: '#fbbf24',
            fillOpacity: 0.8,
            weight: 2
        });

        marker.bindPopup(
            `<strong>Adoption Zone ${i + 1}</strong><br/>` +
            `Population: ${zone.population.toLocaleString()}<br/>` +
            `EV Adoption Likelihood: ${(zone.ev_adoption_likelihood_score * 100).toFixed(2)}%<br/>` +
            `Per Capita Income: ₹${zone.per_capita_income.toLocaleString()}<br/>` +
            `Area: ${zone.area.toFixed(2)} km²<br/>` +
            `Lat: ${zone.latitude.toFixed(6)}<br/>` +
            `Lng: ${zone.longitude.toFixed(6)}`
        );

        layer.addLayer(marker);
    });

    layer.addTo(map);
    console.log(`Plotted ${adoptionData.length} adoption likelihood centers on map`);
    return layer;
};

export default {
    fetchAdoptionLikelihoodData,
    calculateAdoptionLikelihoodCost,
    plotAdoptionCentersOnMap
};
