import { AccessibilityNeed, GeoCoordinate, RoutePreference, ZoneType, CongestionLevel } from './common';
/** A node in the stadium graph for pathfinding */
export interface StadiumNode {
    id: string;
    name: string;
    zoneType: ZoneType;
    coordinate: GeoCoordinate;
    /** Whether this node is wheelchair accessible */
    isAccessible: boolean;
    /** Whether this node is VIP-only */
    isVIPOnly: boolean;
    /** Connected node IDs with traversal costs */
    connections: NodeConnection[];
    /** Current crowd density at this node (0.0 - 1.0) */
    currentDensity: number;
    /** Maximum capacity */
    capacity: number;
}
/** Connection between two stadium nodes */
export interface NodeConnection {
    targetNodeId: string;
    /** Base traversal time in seconds */
    baseCostSeconds: number;
    /** Distance in meters */
    distanceMeters: number;
    /** Whether this path is wheelchair accessible */
    isAccessible: boolean;
    /** Whether this is a VIP-only shortcut */
    isVIPOnly: boolean;
    /** Whether stairs are required */
    hasStairs: boolean;
    /** Whether elevator is available */
    hasElevator: boolean;
}
/** Route calculation request */
export interface RouteRequest {
    /** Starting point node ID or coordinate */
    origin: string | GeoCoordinate;
    /** Destination node ID or coordinate */
    destination: string | GeoCoordinate;
    /** User accessibility requirements */
    accessibilityNeeds: AccessibilityNeed[];
    /** Whether user has VIP access */
    isVIP: boolean;
    /** Route optimization preference */
    preference: RoutePreference;
    /** Whether to avoid high-density areas (threshold 0.0-1.0) */
    maxDensityThreshold?: number;
    /** User ID for personalization */
    userId?: string;
}
/** Calculated route response */
export interface RouteResponse {
    /** Unique route identifier */
    routeId: string;
    /** Ordered list of nodes in the route */
    path: RouteStep[];
    /** Total estimated time in seconds */
    totalTimeSeconds: number;
    /** Total distance in meters */
    totalDistanceMeters: number;
    /** Average crowd density along the route (0.0 - 1.0) */
    averageDensity: number;
    /** Accessibility summary for screen readers */
    accessibilityNotes: string;
    /** Alt-text description of the route for accessibility */
    altText: string;
    /** Whether the route was personalized */
    isPersonalized: boolean;
    /** Route preference used */
    preference: RoutePreference;
    /** Timestamp when the route was calculated */
    calculatedAt: string;
    /** Route validity period in seconds (recalculate after) */
    validForSeconds: number;
    /** Alternative routes */
    alternatives?: RouteResponse[];
}
/** Individual step in a calculated route */
export interface RouteStep {
    /** Step sequence number (1-indexed) */
    stepNumber: number;
    /** Node at this step */
    nodeId: string;
    /** Human-readable name */
    nodeName: string;
    /** Zone type for context */
    zoneType: ZoneType;
    /** Coordinate for map rendering */
    coordinate: GeoCoordinate;
    /** Navigation instruction for this step */
    instruction: string;
    /** Alt-text for this step (accessibility) */
    altText: string;
    /** Estimated time to reach from previous step (seconds) */
    timeFromPreviousSeconds: number;
    /** Distance from previous step (meters) */
    distanceFromPreviousMeters: number;
    /** Current density at this point */
    currentDensity: number;
    /** Congestion level for visual display */
    congestionLevel: CongestionLevel;
}
/** Zone density information */
export interface ZoneDensityInfo {
    zoneId: string;
    zoneName: string;
    zoneType: ZoneType;
    /** Current occupancy count */
    currentOccupancy: number;
    /** Maximum capacity */
    maxCapacity: number;
    /** Density ratio (0.0 - 1.0) */
    densityRatio: number;
    /** Congestion classification */
    congestionLevel: CongestionLevel;
    /** Trend: positive = filling, negative = emptying */
    trend: number;
    /** Alt-text description for accessibility */
    altText: string;
    /** Last updated timestamp */
    updatedAt: string;
}
/** Stadium map data (cacheable) */
export interface StadiumMap {
    stadiumId: string;
    stadiumName: string;
    nodes: StadiumNode[];
    /** Total capacity */
    totalCapacity: number;
    /** Number of levels/floors */
    levels: number;
    /** Map version for cache invalidation */
    version: string;
    /** Alt-text description of the stadium layout */
    altText: string;
    /** Last updated timestamp */
    updatedAt: string;
}
//# sourceMappingURL=wayfinding.d.ts.map