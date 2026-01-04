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
 * Update costs in the proximal grid based on a newly placed charging station
 * This simulates how adding a new station affects the cost landscape
 */
const updateCostsWithNewStation = (workingCells, newStation) => {
    const INFLUENCE_RADIUS = 5000; // 5km influence radius for new station
    const MAX_COST_REDUCTION = 100; // Maximum cost reduction near the station

    workingCells.forEach(cell => {
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
 * Now with dynamic cost updates as stations are placed
 * @param {Array} cells - Grid cells with cost calculations
 * @param {number} n - Number of stations to place
 * @param {number} minDistanceKm - Minimum distance between stations in km (default 0.5km)
 * @returns {Array} Array of optimal locations with coordinates and cost info
 */
export const findOptimalLocations = (cells, n, minDistanceKm = 0.5) => {
    // Filter to only cells inside the polygon
    const cellsInPolygon = cells.filter(c => c.inPolygon);

    if (cellsInPolygon.length === 0) {
        console.warn('No cells in polygon for optimal location search');
        return [];
    }

    console.log('\n=== FINDING OPTIMAL CHARGING STATION LOCATIONS ===');
    console.log(`Total cells in polygon: ${cellsInPolygon.length}`);
    console.log(`Requested stations: ${n}`);
    console.log(`Minimum distance between stations: ${minDistanceKm} km`);
    console.log('NOTE: Using working copy of proximal grid - original cost map remains unchanged');
    console.log('NOTE: Each new station dynamically updates costs for subsequent placements');
    console.log('NOTE: All stations will be placed ONLY within the user-defined polygon\n');

    // Create a deep copy of cells for working calculations
    const workingCells = cellsInPolygon.map(cell => ({
        ...cell,
        cost: cell.cost, // Copy current cost
        nearestStationDistance: cell.nearestStationDistance || Infinity,
        density: cell.density || 0,
        adoptionLikelihood: cell.adoptionLikelihood || 0
    }));

    const optimalLocations = [];
    const minDistanceMeters = minDistanceKm * 1000;

    // Iterative algorithm: Place stations one by one, updating costs after each placement
    for (let stationNum = 0; stationNum < n; stationNum++) {
        // Sort by current cost (lower = more favorable)
        workingCells.sort((a, b) => a.cost - b.cost);

        // Find the best candidate that's far enough from already placed stations
        let bestCandidate = null;

        for (const candidate of workingCells) {
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

            if (!tooClose) {
                bestCandidate = candidate;
                break; // Found the best valid candidate
            }
        }

        if (!bestCandidate) {
            console.warn(`Could not find valid location for station ${stationNum + 1} (only placed ${optimalLocations.length})`);
            break;
        }

        // Add this location to our results
        const newLocation = {
            latitude: bestCandidate.centerLat,
            longitude: bestCandidate.centerLng,
            cost: bestCandidate.cost,
            nearestStationDistance: bestCandidate.nearestStationDistance === Infinity ? 0 : bestCandidate.nearestStationDistance,
            density: bestCandidate.density,
            adoptionLikelihood: bestCandidate.adoptionLikelihood,
            stationNumber: stationNum + 1
        };

        optimalLocations.push(newLocation);

        console.log(`Station ${stationNum + 1}: Placed at (${newLocation.latitude.toFixed(6)}, ${newLocation.longitude.toFixed(6)}) with cost ${newLocation.cost.toFixed(2)}`);

        // Update the working grid costs based on this new station
        // This ensures the next station considers the impact of this one
        if (stationNum < n - 1) { // Don't update after the last station
            updateCostsWithNewStation(workingCells, newLocation);
            console.log(`  → Updated ${workingCells.length} cells with new station influence`);
        }
    }

    console.log(`\n=== FOUND ${optimalLocations.length} OPTIMAL LOCATIONS ===`);
    console.log('Each station placement considered the cumulative impact of previously placed stations');
    console.table(optimalLocations.map((loc, idx) => ({
        station: loc.stationNumber,
        latitude: loc.latitude.toFixed(6),
        longitude: loc.longitude.toFixed(6),
        cost_at_placement: loc.cost.toFixed(2),
        nearestStation_km: loc.nearestStationDistance.toFixed(3)
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
                        <span style="color: #166534; font-weight: 600;">Cost at Placement:</span>
                        <strong style="color: #16a34a; font-size: 16px;">${location.cost.toFixed(2)}</strong>
                    </div>
                    
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
