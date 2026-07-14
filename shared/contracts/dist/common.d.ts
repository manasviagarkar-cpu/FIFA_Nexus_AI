/** User roles for RBAC across all services */
export declare enum UserRole {
    FAN = "fan",
    STAFF = "staff",
    ADMIN = "admin"
}
/** Accessibility requirement types */
export declare enum AccessibilityNeed {
    WHEELCHAIR = "wheelchair",
    VISUAL_IMPAIRMENT = "visual_impairment",
    HEARING_IMPAIRMENT = "hearing_impairment",
    MOBILITY_LIMITED = "mobility_limited",
    ELDERLY = "elderly",
    FAMILY_WITH_CHILDREN = "family_with_children",
    NONE = "none"
}
/** Stadium zone types */
export declare enum ZoneType {
    ENTRANCE = "entrance",
    CONCOURSE = "concourse",
    SEATING = "seating",
    CONCESSION = "concession",
    RESTROOM = "restroom",
    MERCHANDISE = "merchandise",
    VIP_LOUNGE = "vip_lounge",
    MEDICAL = "medical",
    EXIT = "exit",
    PARKING = "parking",
    MEDIA = "media"
}
/** Congestion severity levels */
export declare enum CongestionLevel {
    LOW = "low",
    MODERATE = "moderate",
    HIGH = "high",
    CRITICAL = "critical"
}
/** Alert priority levels */
export declare enum AlertPriority {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
/** Alert status tracking */
export declare enum AlertStatus {
    ACTIVE = "active",
    ACKNOWLEDGED = "acknowledged",
    RESOLVED = "resolved",
    EXPIRED = "expired"
}
/** Sensor types for IoT data ingestion */
export declare enum SensorType {
    TURNSTILE = "turnstile",
    WIFI_PROBE = "wifi_probe",
    CAMERA = "camera",
    ENVIRONMENTAL = "environmental",
    CROWD_COUNTER = "crowd_counter"
}
/** Supported languages for multilingual assistance */
export declare enum SupportedLanguage {
    EN = "en",
    ES = "es",
    FR = "fr",
    AR = "ar",
    PT = "pt",
    DE = "de",
    JA = "ja",
    ZH = "zh",
    KO = "ko",
    HI = "hi",
    IT = "it",
    NL = "nl"
}
/** Route optimization preference */
export declare enum RoutePreference {
    FASTEST = "fastest",
    LEAST_CROWDED = "least_crowded",
    ACCESSIBLE = "accessible",
    SCENIC = "scenic",
    FAMILY_FRIENDLY = "family_friendly"
}
/** Standardized API error structure for accessibility and screen readers */
export interface ApiError {
    /** Machine-readable error code (e.g., 'AUTH_EXPIRED') */
    code: string;
    /** Human-readable error message suitable for screen readers */
    message: string;
    /** Detailed description for debugging (not shown to end users) */
    details?: string;
    /** HTTP status code */
    statusCode: number;
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Request trace ID for support correlation */
    traceId: string;
}
/** Standardized API response wrapper */
export interface ApiResponse<T> {
    /** Whether the request was successful */
    success: boolean;
    /** Response payload */
    data?: T;
    /** Error details if success is false */
    error?: ApiError;
    /** Response metadata */
    meta?: {
        /** ISO 8601 timestamp */
        timestamp: string;
        /** API version */
        version: string;
        /** Request trace ID */
        traceId: string;
        /** Accessibility description of the response content */
        altText?: string;
    };
}
/** Pagination metadata */
export interface PaginationMeta {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}
/** Paginated API response */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: PaginationMeta;
}
/** Geographic coordinate */
export interface GeoCoordinate {
    latitude: number;
    longitude: number;
    /** Floor/level within the stadium (0 = ground level) */
    level: number;
}
/** Health check response structure */
export interface HealthCheckResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    service: string;
    version: string;
    uptime: number;
    timestamp: string;
    dependencies: {
        name: string;
        status: 'connected' | 'disconnected' | 'degraded';
        latencyMs?: number;
    }[];
}
//# sourceMappingURL=common.d.ts.map