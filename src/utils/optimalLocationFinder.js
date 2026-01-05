import L from 'leaflet';

/* ----------------------------------------------------
   FIND OPTIMAL LOCATIONS FOR EV CHARGING STATIONS
   Uses proximal grid cost analysis to find best placements
---------------------------------------------------- */

/**
 * Calculate distance between two points using Haversine formula
 */
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

/**
 * Create spatial grid index for faster nearest neighbor searches
 * ONLY indexes cells INSIDE the polygon (excludes buffer cells)
 */
const createSpatialIndex = (cells) => {
    const GRID_SIZE = 0.01; // ~1km grid cells
    const index = new Map();

    // ONLY index cells that are inside the polygon (no buffer cells)
    const cellsInPolygon = cells.filter(c => c.inPolygon);

    cellsInPolygon.forEach(cell => {
        const gridX = Math.floor(cell.centerLat / GRID_SIZE);
        const gridY = Math.floor(cell.centerLng / GRID_SIZE);
        const key = `${gridX},${gridY}`;

        if (!index.has(key)) {
            index.set(key, []);
        }
        index.get(key).push(cell);
    });

    return { index, GRID_SIZE };
};

/**
 * Get cells within radius using spatial index
 * ONLY returns cells inside polygon (no buffer cells)
 */
const getCellsInRadius = (centerCell, radiusMeters, spatialIndex) => {
    const { index, GRID_SIZE } = spatialIndex;
    const radiusDegrees = radiusMeters / 111320; // Approximate conversion
    const gridRadius = Math.ceil(radiusDegrees / GRID_SIZE);

    const centerGridX = Math.floor(centerCell.centerLat / GRID_SIZE);
    const centerGridY = Math.floor(centerCell.centerLng / GRID_SIZE);

    const nearbyCells = [];

    for (let dx = -gridRadius; dx <= gridRadius; dx++) {
        for (let dy = -gridRadius; dy <= gridRadius; dy++) {
            const key = `${centerGridX + dx},${centerGridY + dy}`;
            const cells = index.get(key);
            if (cells) {
                // Double-check cells are in polygon (should already be filtered, but safety check)
                nearbyCells.push(...cells.filter(c => c.inPolygon));
            }
        }
    }

    return nearbyCells;
};

/**
 * Calculate the suitability score for placing a station at a specific location
 * OPTIMIZED VERSION - considers ONLY cells inside polygon
 * Lower score = better location (we minimize cost)
 */
const calculateLocationScore = (candidate, workingCells, alreadyPlacedStations, spatialIndex) => {
    const INFLUENCE_RADIUS = 5000; // 5km influence radius

    // Primary score: the candidate's own cost (lower is better)
    let score = candidate.cost;

    // Penalize locations too close to already placed stations
    for (const station of alreadyPlacedStations) {
        const distanceToPlaced = calculateDistance(
            candidate.centerLat,
            candidate.centerLng,
            station.latitude,
            station.longitude
        );

        if (distanceToPlaced < INFLUENCE_RADIUS) {
            // Add penalty for proximity to existing new stations
            // Closer = higher penalty
            const overlapPenalty = (1 - distanceToPlaced / INFLUENCE_RADIUS) * 1000;
            score += overlapPenalty;
        }
    }

    // REWARD: Consider population density coverage within polygon
    // Get nearby cells INSIDE polygon only using spatial index
    const nearbyCells = getCellsInRadius(candidate, INFLUENCE_RADIUS, spatialIndex);
    const totalDensity = nearbyCells.reduce((sum, cell) => sum + (cell.density || 0), 0);

    // Higher density coverage = lower score (better location)
    // Use logarithmic scaling to avoid over-weighting density
    if (totalDensity > 0) {
        const densityBonus = Math.log(totalDensity + 1) * 10;
        score -= densityBonus; // Subtract to make it better (lower score)
    }

    return score;
};

/**
 * Update costs in the proximal grid based on a newly placed charging station
 * OPTIMIZED VERSION - only updates cells INSIDE polygon
 */
const updateCostsWithNewStation = (workingCells, newStation, spatialIndex) => {
    const INFLUENCE_RADIUS = 5000; // 5km influence radius for new station
    const MAX_COST_REDUCTION = 100; // Maximum cost reduction near the station

    // Use spatial index to only update nearby cells INSIDE POLYGON
    const nearbyCells = spatialIndex ?
        getCellsInRadius(newStation, INFLUENCE_RADIUS, spatialIndex) :
        workingCells.filter(c => c.inPolygon);

    nearbyCells.forEach(cell => {
        // Skip if not in polygon (safety check)
        if (!cell.inPolygon) return;

        const distance = calculateDistance(
            cell.centerLat,
            cell.centerLng,
            newStation.latitude,
            newStation.longitude
        );

        if (distance <= INFLUENCE_RADIUS) {
            // Closer to the new station = higher cost (less favorable for next station)
            // Linear decay: 100% cost increase at station, 0% at 5km
            const distanceRatio = distance / INFLUENCE_RADIUS;
            const costIncrease = MAX_COST_REDUCTION * (1 - distanceRatio);

            // Update the cost
            cell.cost += costIncrease;

            // Update nearest station distance if this station is closer
            if (!cell.nearestStationDistance || distance < cell.nearestStationDistance * 1000) {
                cell.nearestStationDistance = distance / 1000; // Convert to km
            }
        }
    });

    return workingCells;
};

/**
 * Find N optimal locations for EV charging stations
 * OPTIMIZED VERSION with spatial indexing and progress reporting
 * @param {Array} cells - Grid cells with cost calculations
 * @param {number} n - Number of stations to place
 * @param {number} minDistanceKm - Minimum distance between stations in km (default 0.5km)
 * @param {Function} onProgress - Optional callback for progress updates
 * @returns {Promise<Array>} Array of optimal locations with coordinates and cost info
 */
export const findOptimalLocations = async (cells, n, minDistanceKm = 0.5, onProgress) => {
    // Filter to ONLY cells inside the polygon (exclude buffer cells)
    const cellsInPolygon = cells.filter(c => c.inPolygon);
    const bufferCells = cells.filter(c => !c.inPolygon);

    if (cellsInPolygon.length === 0) {
        console.warn('No cells in polygon for optimal location search');
        return [];
    }

    console.log('\n=== FINDING OPTIMAL CHARGING STATION LOCATIONS ===');
    console.log(`Total cells in polygon: ${cellsInPolygon.length}`);
    console.log(`Buffer cells (excluded from placement): ${bufferCells.length}`);
    console.log(`Requested stations: ${n}`);
    console.log(`Minimum distance between stations: ${minDistanceKm} km`);
    console.log('NOTE: Using optimized spatial indexing for faster computation');
    console.log('NOTE: Selecting locations with LOWEST cost (most favorable)');
    console.log('NOTE: Adding density bonus to prefer high-population areas');
    console.log('NOTE: Each placement updates costs for next iteration');
    console.log('NOTE: All stations will be placed ONLY within the user-defined polygon');
    console.log('NOTE: Buffer cells are COMPLETELY EXCLUDED from consideration\n');

    // Create spatial index for faster lookups (POLYGON CELLS ONLY)
    console.log('Building spatial index (polygon cells only)...');
    const spatialIndex = createSpatialIndex(cellsInPolygon);
    console.log(`✓ Spatial index created with ${cellsInPolygon.length} polygon cells\n`);

    // Create a deep copy of cells for working calculations
    const workingCells = cellsInPolygon.map(cell => ({
        ...cell,
        cost: cell.cost, // Copy current cost
        nearestStationDistance: cell.nearestStationDistance || Infinity,
        density: cell.density || 0,
        adoptionLikelihood: cell.adoptionLikelihood || 0,
        inPolygon: true // Ensure flag is set
    }));

    const optimalLocations = [];
    const minDistanceMeters = minDistanceKm * 1000;

    // Iterative algorithm with progress reporting and optimization
    for (let stationNum = 0; stationNum < n; stationNum++) {
        // Report progress
        if (onProgress) {
            const progress = ((stationNum) / n) * 100;
            onProgress(progress);
        }

        // Allow UI to breathe every few iterations
        if (stationNum % 2 === 0 && stationNum > 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        let bestCandidate = null;
        let bestScore = Infinity; // Lower score is better

        console.log(`\n--- Evaluating candidates for Station ${stationNum + 1} ---`);

        // Sample candidates for large datasets (limit evaluation for performance)
        const MAX_CANDIDATES_TO_EVALUATE = 500;
        const candidateStep = Math.max(1, Math.floor(workingCells.length / MAX_CANDIDATES_TO_EVALUATE));

        // IMPORTANT: Only evaluate cells inside polygon
        const candidates = workingCells
            .filter(c => c.inPolygon)
            .filter((_, idx) => idx % candidateStep === 0);

        console.log(`Evaluating ${candidates.length} candidate locations (sampled from ${workingCells.length} polygon cells)`);

        // Evaluate candidates and find the one with minimum score (lowest cost)
        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];

            // Double-check candidate is in polygon
            if (!candidate.inPolygon) continue;

            // Check if candidate is far enough from already selected locations
            let tooClose = false;
            for (const location of optimalLocations) {
                const distance = calculateDistance(
                    candidate.centerLat,
                    candidate.centerLng,
                    location.latitude,
                    location.longitude
                );

                if (distance < minDistanceMeters) {
                    tooClose = true;
                    break;
                }
            }

            if (tooClose) continue; // Skip this candidate

            // Calculate the suitability score (lower = better)
            const score = calculateLocationScore(candidate, workingCells, optimalLocations, spatialIndex);

            // The best candidate has the lowest score
            if (score < bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }

        if (!bestCandidate) {
            console.warn(`Could not find valid location for station ${stationNum + 1} (only placed ${optimalLocations.length})`);
            break;
        }

        // Verify candidate is in polygon
        if (!bestCandidate.inPolygon) {
            console.error(`ERROR: Selected candidate is outside polygon! Skipping.`);
            break;
        }

        // Add this location to our results
        const newLocation = {
            latitude: bestCandidate.centerLat,
            longitude: bestCandidate.centerLng,
            cost: bestCandidate.cost,
            score: bestScore,
            nearestStationDistance: bestCandidate.nearestStationDistance === Infinity ? 0 : bestCandidate.nearestStationDistance,
            density: bestCandidate.density,
            adoptionLikelihood: bestCandidate.adoptionLikelihood,
            stationNumber: stationNum + 1,
            inPolygon: true
        };

        optimalLocations.push(newLocation);

        console.log(`✓ Station ${stationNum + 1}: Placed at (${newLocation.latitude.toFixed(6)}, ${newLocation.longitude.toFixed(6)})`);
        console.log(`  Cell Cost: ${newLocation.cost.toFixed(2)} | Selection Score: ${newLocation.score.toFixed(2)} (lower is better)`);
        console.log(`  Density: ${newLocation.density.toExponential(2)} | Location: INSIDE POLYGON`);

        // Update the working grid costs based on this new station (using spatial index)
        // This ensures the next station considers the impact of this one
        if (stationNum < n - 1) { // Don't update after the last station
            updateCostsWithNewStation(workingCells, newLocation, spatialIndex);
            console.log(`  → Updated proximal grid with new station influence (polygon cells only)`);
        }
    }

    // Final progress update
    if (onProgress) {
        onProgress(100);
    }

    console.log(`\n=== FOUND ${optimalLocations.length} OPTIMAL LOCATIONS ===`);
    console.log('All stations placed INSIDE polygon (buffer cells excluded)');
    console.log('Locations optimized for lowest cost + highest density coverage');
    console.table(optimalLocations.map((loc, idx) => ({
        station: loc.stationNumber,
        latitude: loc.latitude.toFixed(6),
        longitude: loc.longitude.toFixed(6),
        cell_cost: loc.cost.toFixed(2),
        selection_score: loc.score.toFixed(2),
        density: loc.density.toExponential(2)
    })));

    return optimalLocations;
};

/**
 * Plot optimal locations on the map with highly visible markers
 */
export const plotOptimalLocations = (map, locations) => {
    if (!locations || locations.length === 0) {
        console.log('No optimal locations to plot');
        return null;
    }

    const layer = L.layerGroup();

    locations.forEach((location, i) => {
        // Create a highly visible pulsing marker with icon
        const icon = L.divIcon({
            className: 'optimal-location-marker',
            html: `<div style="
                position: relative;
                width: 50px;
                height: 50px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <!-- Pulsing ring effect -->
                <div style="
                    position: absolute;
                    width: 50px;
                    height: 50px;
                    background: rgba(34, 197, 94, 0.3);
                    border: 3px solid #22c55e;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                "></div>
                
                <!-- Main marker body -->
                <div style="
                    position: relative;
                    width: 30px;
                    height: 30px;
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    border: 4px solid white;
                    border-radius: 50%;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3), 0 0 20px rgba(34, 197, 94, 0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 14px;
                    z-index: 1000;
                ">${i + 1}</div>
                
                <!-- Star icon on top -->
                <div style="
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 20px;
                    height: 20px;
                    background: #fbbf24;
                    border: 2px solid white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    z-index: 1001;
                ">⭐</div>
            </div>
            <style>
                @keyframes pulse {
                    0% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: scale(1.3);
                        opacity: 0.5;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                .optimal-location-marker {
                    z-index: 10000 !important;
                }
            </style>`,
            iconSize: [50, 50],
            iconAnchor: [25, 25]
        });

        const divMarker = L.marker([location.latitude, location.longitude], {
            icon,
            zIndexOffset: 10000 // Ensure marker is on top
        });

        divMarker.bindPopup(
            `<div style="font-family: system-ui; min-width: 240px;">
                <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 12px; margin: -10px -10px 10px -10px; border-radius: 8px 8px 0 0;">
                    <div style="font-size: 18px; font-weight: bold; display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 24px;">⭐</span>
                        <span>Station #${location.stationNumber || (i + 1)}</span>
                    </div>
                    <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
                        NEW CHARGING STATION ${location.stationNumber ? `(Placed ${location.stationNumber === 1 ? '1st' : location.stationNumber === 2 ? '2nd' : location.stationNumber === 3 ? '3rd' : location.stationNumber + 'th'})` : ''}
                    </div>
                </div>
                
                <div style="padding: 8px 0;">
                    <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 8px; background: #f0fdf4; border-radius: 6px;">
                        <span style="color: #166534; font-weight: 600;">Cell Cost:</span>
                        <strong style="color: #16a34a; font-size: 16px;">${location.cost.toFixed(2)}</strong>
                    </div>
                    
                    ${location.overallBenefit !== undefined ? `
                    <div style="display: flex; justify-content: space-between; margin: 8px 0; padding: 8px; background: #eff6ff; border-radius: 6px;">
                        <span style="color: #1e40af; font-weight: 600;">Overall Benefit:</span>
                        <strong style="color: #2563eb; font-size: 16px;">${location.overallBenefit.toFixed(2)}</strong>
                    </div>
                    ` : ''}
                    
                    ${location.cellsAffected !== undefined ? `
                    <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">
                        <span style="color: #6b7280;">Cells Benefited:</span>
                        <strong style="color: #1f2937;">${location.cellsAffected} cells</strong>
                    </div>
                    ` : ''}
                    
                    ${location.averageBenefit !== undefined ? `
                    <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">
                        <span style="color: #6b7280;">Avg Benefit/Cell:</span>
                        <strong style="color: #1f2937;">${location.averageBenefit.toFixed(2)}</strong>
                    </div>
                    ` : ''}
                    
                    <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">
                        <span style="color: #6b7280;">Nearest Existing Station:</span>
                        <strong style="color: #1f2937;">${location.nearestStationDistance ? location.nearestStationDistance.toFixed(3) : '0.000'} km</strong>
                    </div>
                    
                    ${location.density > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">
                        <span style="color: #6b7280;">Population Density:</span>
                        <strong style="color: #1f2937;">${location.density.toExponential(2)}</strong>
                    </div>
                    ` : ''}
                    
                    ${location.adoptionLikelihood > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin: 6px 0; padding: 6px 0; border-bottom: 1px solid #e5e7eb;">
                        <span style="color: #6b7280;">Adoption Score:</span>
                        <strong style="color: #1f2937;">${location.adoptionLikelihood.toExponential(2)}</strong>
                    </div>
                    ` : ''}
                </div>
                
                <div style="margin-top: 12px; padding: 10px; background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); border-radius: 6px; text-align: center; border: 2px solid #22c55e;">
                    <span style="font-size: 13px; font-weight: 700; color: #16a34a;">
                        ✓ OPTIMAL PLACEMENT
                    </span>
                    <div style="font-size: 10px; color: #166534; margin-top: 4px;">
                        ${location.stationNumber > 1 ? `Considers impact of ${location.stationNumber - 1} previous station${location.stationNumber > 2 ? 's' : ''}` : 'First station placement'}
                    </div>
                </div>
                
                <div style="margin-top: 8px; padding: 6px; background: #f9fafb; border-radius: 4px; text-align: center;">
                    <div style="font-size: 10px; color: #6b7280; font-weight: 500;">COORDINATES</div>
                    <div style="font-size: 11px; color: #1f2937; font-family: monospace; margin-top: 2px;">
                        ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}
                    </div>
                </div>
            </div>`,
            {
                maxWidth: 280,
                className: 'optimal-location-popup'
            }
        );

        layer.addLayer(divMarker);
    });

    layer.addTo(map);
    console.log(`Plotted ${locations.length} optimal locations on map`);
    return layer;
};

export default {
    findOptimalLocations,
    plotOptimalLocations
};
