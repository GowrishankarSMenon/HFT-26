"""
Flask API for finding optimal EV charging station locations
Uses spatial indexing and numpy for fast computation
with ITERATIVE BENEFIT MAXIMIZATION and COST MAP UPDATES
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from scipy.spatial import KDTree
import time
import math

app = Flask(__name__)
CORS(app)  # Enable CORS for Next.js frontend


class OptimalLocationFinder:
    """
    Find optimal EV charging station locations using ITERATIVE BENEFIT MAXIMIZATION
    with dynamic COST MAP UPDATES after each placement
    """

    def __init__(self, cells, n_stations=3, min_distance_km=0.5):
        """
        Initialize finder with grid cells

        Args:
            cells: List of dicts with keys: centerLat, centerLng, cost, density, inPolygon
            n_stations: Number of stations to place
            min_distance_km: Minimum distance between stations
        """
        # Filter to polygon cells only
        self.polygon_cells = [c for c in cells if c.get('inPolygon', False)]
        self.original_cells = cells
        self.n_stations = n_stations
        self.min_distance_m = min_distance_km * 3000
        self.influence_radius = 5000  # 5km for existing DB stations
        self.new_station_radius = 7500  # 7.5km for new stations (50% more)

        if not self.polygon_cells:
            raise ValueError("No cells found inside polygon")

        # Extract coordinates and costs
        self.coords = np.array([[c['centerLat'], c['centerLng']]
                               for c in self.polygon_cells])
        self.costs = np.array([c['cost'] for c in self.polygon_cells])
        self.densities = np.array([c.get('density', 0)
                                  for c in self.polygon_cells])

        # Calculate polygon center (centroid)
        self.polygon_center_lat = np.mean(self.coords[:, 0])
        self.polygon_center_lng = np.mean(self.coords[:, 1])
        print(
            f"✓ Polygon center: ({self.polygon_center_lat:.6f}, {self.polygon_center_lng:.6f})")

        # Calculate max distance from center to any polygon cell (for normalization)
        distances_to_center = np.array([
            self.haversine_distance(
                c['centerLat'], c['centerLng'],
                self.polygon_center_lat, self.polygon_center_lng
            ) for c in self.polygon_cells
        ])
        self.max_distance_from_center = np.max(distances_to_center)
        print(
            f"✓ Max distance from center: {self.max_distance_from_center:.1f}m")

        # Build KDTree for fast spatial queries
        self.kdtree = KDTree(self.coords)

        print(f"✓ Initialized with {len(self.polygon_cells)} polygon cells")
        print(f"✓ Building spatial index with KDTree...")

    def haversine_distance(self, lat1, lon1, lat2, lon2):
        """
        Calculate distance in meters using Haversine formula
        Vectorized for NumPy arrays
        """
        R = 6371000  # Earth radius in meters

        if isinstance(lat1, np.ndarray):
            # Vectorized version
            phi1 = np.radians(lat1)
            phi2 = np.radians(lat2)
            dphi = np.radians(lat2 - lat1)
            dlambda = np.radians(lon2 - lon1)

            a = np.sin(dphi/2)**2 + np.cos(phi1) * \
                np.cos(phi2) * np.sin(dlambda/2)**2
            return 2 * R * np.arctan2(np.sqrt(a), np.sqrt(1-a))
        else:
            # Scalar version
            phi1 = math.radians(lat1)
            phi2 = math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlambda = math.radians(lon2 - lon1)

            a = math.sin(dphi/2)**2 + math.cos(phi1) * \
                math.cos(phi2) * math.sin(dlambda/2)**2
            return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

    def degrees_to_meters(self, degrees):
        """Convert degrees to approximate meters (at equator)"""
        return degrees * 111320

    def meters_to_degrees(self, meters):
        """Convert meters to approximate degrees (at equator)"""
        return meters / 111320

    def calculate_score(self, candidate_idx, current_costs):
        """
        Calculate the TOTAL GRID COST INCREASE if we place a station here
        Higher score = better placement (more cost increase = better coverage)

        This simulates placing a station and calculates how much it would
        increase the total grid cost, just like existing EV stations do.
        """
        candidate = self.polygon_cells[candidate_idx]

        # Simulate placing station here and calculate cost increase
        # Use new_station_radius (50% larger) for new charging stations
        radius_degrees = self.meters_to_degrees(self.new_station_radius)
        MAX_COST_INCREASE = 100

        total_cost_increase = 0.0

        # Find nearby cells using KDTree
        nearby_indices = self.kdtree.query_ball_point(
            [candidate['centerLat'], candidate['centerLng']],
            radius_degrees
        )

        for idx in nearby_indices:
            cell = self.polygon_cells[idx]
            dist = self.haversine_distance(
                cell['centerLat'], cell['centerLng'],
                candidate['centerLat'], candidate['centerLng']
            )

            if dist <= self.new_station_radius:
                # Cost increase decreases with distance (linear decay)
                cost_increase = MAX_COST_INCREASE * \
                    (1 - dist / self.new_station_radius)
                total_cost_increase += cost_increase

        # Add bonus for polygon center proximity (prefer central locations)
        distance_to_center = self.haversine_distance(
            candidate['centerLat'], candidate['centerLng'],
            self.polygon_center_lat, self.polygon_center_lng
        )
        center_proximity_ratio = 1.0 - \
            (distance_to_center / self.max_distance_from_center)
        CENTER_BONUS = center_proximity_ratio * 100  # Bonus up to 100 points
        total_cost_increase += CENTER_BONUS

        return total_cost_increase

    def find_optimal_locations(self):
        """
        Iteratively find n optimal locations using COST MAXIMIZATION
        with COST MAP UPDATES after each placement

        Algorithm:
        1. For each candidate, SIMULATE placing a station there
        2. Calculate total grid cost INCREASE it would provide
        3. Choose location with MAXIMUM cost increase
        4. Actually place station there
        5. Update cost map to reflect new station's influence
        6. Repeat for next station (which now considers previous placements)

        This maximizes TOTAL grid cost by iteratively placing stations
        where they provide maximum coverage improvement.
        """
        print(f"\n=== FINDING {self.n_stations} OPTIMAL LOCATIONS ===")
        print("Using iterative cost-maximization with simulated placement effects\n")

        optimal_locations = []
        # Keep track of current costs (gets updated after each placement)
        current_costs = self.costs.copy()

        initial_total_cost = current_costs.sum()
        print(f"Initial total grid cost: {initial_total_cost:.2f}\n")

        for station_num in range(self.n_stations):
            print(f"\n--- Station {station_num + 1}/{self.n_stations} ---")

            best_idx = None
            # Higher score = better (more cost increase)
            best_score = -float('inf')

            # Sample candidates for performance (limit to 500 evaluations)
            n_candidates = min(500, len(self.polygon_cells))
            if len(self.polygon_cells) > n_candidates:
                candidate_indices = np.random.choice(
                    len(self.polygon_cells),
                    n_candidates,
                    replace=False
                )
            else:
                candidate_indices = np.arange(len(self.polygon_cells))

            print(f"Evaluating {len(candidate_indices)} candidates...")
            print(f"Current total grid cost: {current_costs.sum():.2f}")

            for idx in candidate_indices:
                candidate = self.polygon_cells[idx]

                # Check minimum distance constraint
                too_close = False
                for station in optimal_locations:
                    dist = self.haversine_distance(
                        candidate['centerLat'], candidate['centerLng'],
                        station['latitude'], station['longitude']
                    )
                    if dist < self.min_distance_m:
                        too_close = True
                        break

                if too_close:
                    continue

                # Calculate cost increase if we place station here
                # This simulates the station's effect on grid cost
                score = self.calculate_score(idx, current_costs)

                if score > best_score:  # Maximize cost increase
                    best_score = score
                    best_idx = idx

            if best_idx is None:
                print(f"⚠ Could not place station {station_num + 1}")
                break

            # Add optimal location
            cell = self.polygon_cells[best_idx]
            location = {
                'stationNumber': station_num + 1,
                'latitude': float(cell['centerLat']),
                'longitude': float(cell['centerLng']),
                'cost': float(current_costs[best_idx]),
                'score': float(best_score),
                'density': float(self.densities[best_idx]),
                'nearestStationDistance': float(cell.get('nearestStationDistance', 0)),
                'adoptionLikelihood': float(cell.get('adoptionLikelihood', 0))
            }
            optimal_locations.append(location)

            print(
                f"✓ Placed at ({location['latitude']:.6f}, {location['longitude']:.6f})")
            print(
                f"  Current Cost: {location['cost']:.2f} | Cost Increase: {location['score']:.2f}")

            # Calculate distance to center for reference
            dist_to_center = self.haversine_distance(
                location['latitude'], location['longitude'],
                self.polygon_center_lat, self.polygon_center_lng
            )
            print(f"  Distance to polygon center: {dist_to_center:.1f}m")

            # UPDATE COST MAP for next iteration
            # This is CRITICAL: new station INCREASES costs around it
            # This represents improved coverage/service in that area
            if station_num < self.n_stations - 1:
                current_costs = self._update_costs_and_return(
                    location, current_costs)
                cost_increase = current_costs.sum() - initial_total_cost
                print(
                    f"  Updated cost map | New total: {current_costs.sum():.2f} (↑{cost_increase:.2f})")

        print(f"\n✓ FOUND {len(optimal_locations)} OPTIMAL LOCATIONS")
        final_cost = current_costs.sum()
        total_increase = final_cost - initial_total_cost
        print(
            f"Total cost increase: {total_increase:.2f} ({(total_increase/initial_total_cost)*100:.1f}%)")
        print(f"Maximized grid coverage by placing stations in underserved areas")
        return optimal_locations

    def _update_costs_and_return(self, new_station, current_costs):
        """
        Update grid costs based on newly placed station and return updated array

        Each new station INCREASES the cost of nearby cells, representing
        improved coverage/service. Higher cost = better served area.
        Uses new_station_radius (50% larger than DB stations).
        """
        radius_degrees = self.meters_to_degrees(self.new_station_radius)
        MAX_COST_INCREASE = 100

        # Make a copy to avoid modifying reference
        updated_costs = current_costs.copy()

        # Find nearby cells using KDTree
        nearby_indices = self.kdtree.query_ball_point(
            [new_station['latitude'], new_station['longitude']],
            radius_degrees
        )

        for idx in nearby_indices:
            cell = self.polygon_cells[idx]
            dist = self.haversine_distance(
                cell['centerLat'], cell['centerLng'],
                new_station['latitude'], new_station['longitude']
            )

            if dist <= self.new_station_radius:
                # Cost increases with proximity to new station
                cost_increase = MAX_COST_INCREASE * \
                    (1 - dist / self.new_station_radius)
                updated_costs[idx] += cost_increase

        return updated_costs


@app.route('/api/find-optimal-locations', methods=['POST'])
def find_optimal_locations():
    """
    API endpoint to find optimal EV charging station locations

    Uses iterative cost-maximization by simulating each station's effect.
    Each candidate is evaluated by calculating how much total grid cost
    it would add (like existing EV stations). Stations are placed iteratively,
    with each placement affecting the cost map for subsequent decisions.

    Request body:
    {
        "cells": [...],       // Grid cells with cost data
        "n": 3,               // Number of stations
        "minDistanceKm": 0.5
    }

    Response:
    {
        "locations": [...],
        "executionTime": 1.23,
        "cellsProcessed": 500
    }
    """
    try:
        data = request.json
        cells = data.get('cells', [])
        n = data.get('n', 3)
        min_distance_km = data.get('minDistanceKm', 0.5)

        if not cells:
            return jsonify({'error': 'No cells provided'}), 400

        if n <= 0:
            return jsonify({'error': 'Number of stations must be > 0'}), 400

        # Measure execution time
        start_time = time.time()

        print(f"\n{'='*60}")
        print(f"New request: Find {n} stations from {len(cells)} cells")
        print(f"{'='*60}")

        # Find optimal locations
        finder = OptimalLocationFinder(cells, n, min_distance_km)
        locations = finder.find_optimal_locations()

        execution_time = time.time() - start_time

        print(f"\n✓ Execution time: {execution_time:.3f}s")
        print(f"✓ Cells processed: {len(finder.polygon_cells)}")

        return jsonify({
            'success': True,
            'locations': locations,
            'executionTime': round(execution_time, 3),
            'cellsProcessed': len(finder.polygon_cells),
            'locationsFound': len(locations)
        })

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Optimal Location Finder API',
        'version': '1.0'
    })


@app.route('/', methods=['GET'])
def index():
    """API documentation"""
    return jsonify({
        'service': 'EV Charging Station Optimal Location Finder',
        'version': '1.0',
        'endpoints': {
            'POST /api/find-optimal-locations': 'Find optimal station locations',
            'GET /health': 'Health check',
            'GET /': 'API documentation'
        },
        'example_request': {
            'cells': [{'centerLat': 10.0, 'centerLng': 76.0, 'cost': 50, 'density': 1000, 'inPolygon': True}],
            'n': 3,
            'minDistanceKm': 0.5
        }
    })


if __name__ == '__main__':
    print("Starting Flask API server...")
    print("http://localhost:5000")
    print("Press Ctrl+C to stop\n")
    app.run(debug=True, port=5000)
