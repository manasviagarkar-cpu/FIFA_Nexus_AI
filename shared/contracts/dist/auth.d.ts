import { UserRole, AccessibilityNeed, SupportedLanguage } from './common';
export { UserRole, AccessibilityNeed, SupportedLanguage };
/** JWT token payload structure */
export interface JWTPayload {
    /** User unique identifier */
    sub: string;
    /** User email */
    email: string;
    /** User display name */
    name: string;
    /** Assigned role for RBAC */
    role: UserRole;
    /** Token issued at (Unix timestamp) */
    iat: number;
    /** Token expiration (Unix timestamp) */
    exp: number;
    /** Token issuer */
    iss: string;
}
/** User profile for personalization */
export interface UserProfile {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    /** Preferred language for multilingual support */
    preferredLanguage: SupportedLanguage;
    /** Accessibility requirements */
    accessibilityNeeds: AccessibilityNeed[];
    /** VIP status flag */
    isVIP: boolean;
    /** Supported team (ISO country code) */
    supportedTeam?: string;
    /** Seat/section assignment */
    seatInfo?: {
        section: string;
        row: string;
        seat: string;
        level: number;
    };
    /** Profile creation timestamp */
    createdAt: string;
    /** Last update timestamp */
    updatedAt: string;
}
/** Login request */
export interface LoginRequest {
    email: string;
    password: string;
}
/** Login response */
export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
    user: Omit<UserProfile, 'createdAt' | 'updatedAt'>;
}
/** Rate limit configuration per role */
export interface RateLimitConfig {
    role: UserRole;
    /** Requests per window */
    maxRequests: number;
    /** Window duration in seconds */
    windowSeconds: number;
}
/** Default rate limits */
export declare const DEFAULT_RATE_LIMITS: Record<UserRole, RateLimitConfig>;
/** Permission definitions per role */
export declare const ROLE_PERMISSIONS: Record<UserRole, string[]>;
//# sourceMappingURL=auth.d.ts.map