"use strict";
// ============================================================================
// FIFA Nexus AI — Shared Contracts: Common Types
// Zero-drift synchronization between TypeScript and Python services
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutePreference = exports.SupportedLanguage = exports.SensorType = exports.AlertStatus = exports.AlertPriority = exports.CongestionLevel = exports.ZoneType = exports.AccessibilityNeed = exports.UserRole = void 0;
/** User roles for RBAC across all services */
var UserRole;
(function (UserRole) {
    UserRole["FAN"] = "fan";
    UserRole["STAFF"] = "staff";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
/** Accessibility requirement types */
var AccessibilityNeed;
(function (AccessibilityNeed) {
    AccessibilityNeed["WHEELCHAIR"] = "wheelchair";
    AccessibilityNeed["VISUAL_IMPAIRMENT"] = "visual_impairment";
    AccessibilityNeed["HEARING_IMPAIRMENT"] = "hearing_impairment";
    AccessibilityNeed["MOBILITY_LIMITED"] = "mobility_limited";
    AccessibilityNeed["ELDERLY"] = "elderly";
    AccessibilityNeed["FAMILY_WITH_CHILDREN"] = "family_with_children";
    AccessibilityNeed["NONE"] = "none";
})(AccessibilityNeed || (exports.AccessibilityNeed = AccessibilityNeed = {}));
/** Stadium zone types */
var ZoneType;
(function (ZoneType) {
    ZoneType["ENTRANCE"] = "entrance";
    ZoneType["CONCOURSE"] = "concourse";
    ZoneType["SEATING"] = "seating";
    ZoneType["CONCESSION"] = "concession";
    ZoneType["RESTROOM"] = "restroom";
    ZoneType["MERCHANDISE"] = "merchandise";
    ZoneType["VIP_LOUNGE"] = "vip_lounge";
    ZoneType["MEDICAL"] = "medical";
    ZoneType["EXIT"] = "exit";
    ZoneType["PARKING"] = "parking";
    ZoneType["MEDIA"] = "media";
})(ZoneType || (exports.ZoneType = ZoneType = {}));
/** Congestion severity levels */
var CongestionLevel;
(function (CongestionLevel) {
    CongestionLevel["LOW"] = "low";
    CongestionLevel["MODERATE"] = "moderate";
    CongestionLevel["HIGH"] = "high";
    CongestionLevel["CRITICAL"] = "critical";
})(CongestionLevel || (exports.CongestionLevel = CongestionLevel = {}));
/** Alert priority levels */
var AlertPriority;
(function (AlertPriority) {
    AlertPriority["LOW"] = "low";
    AlertPriority["MEDIUM"] = "medium";
    AlertPriority["HIGH"] = "high";
    AlertPriority["CRITICAL"] = "critical";
})(AlertPriority || (exports.AlertPriority = AlertPriority = {}));
/** Alert status tracking */
var AlertStatus;
(function (AlertStatus) {
    AlertStatus["ACTIVE"] = "active";
    AlertStatus["ACKNOWLEDGED"] = "acknowledged";
    AlertStatus["RESOLVED"] = "resolved";
    AlertStatus["EXPIRED"] = "expired";
})(AlertStatus || (exports.AlertStatus = AlertStatus = {}));
/** Sensor types for IoT data ingestion */
var SensorType;
(function (SensorType) {
    SensorType["TURNSTILE"] = "turnstile";
    SensorType["WIFI_PROBE"] = "wifi_probe";
    SensorType["CAMERA"] = "camera";
    SensorType["ENVIRONMENTAL"] = "environmental";
    SensorType["CROWD_COUNTER"] = "crowd_counter";
})(SensorType || (exports.SensorType = SensorType = {}));
/** Supported languages for multilingual assistance */
var SupportedLanguage;
(function (SupportedLanguage) {
    SupportedLanguage["EN"] = "en";
    SupportedLanguage["ES"] = "es";
    SupportedLanguage["FR"] = "fr";
    SupportedLanguage["AR"] = "ar";
    SupportedLanguage["PT"] = "pt";
    SupportedLanguage["DE"] = "de";
    SupportedLanguage["JA"] = "ja";
    SupportedLanguage["ZH"] = "zh";
    SupportedLanguage["KO"] = "ko";
    SupportedLanguage["HI"] = "hi";
    SupportedLanguage["IT"] = "it";
    SupportedLanguage["NL"] = "nl";
})(SupportedLanguage || (exports.SupportedLanguage = SupportedLanguage = {}));
/** Route optimization preference */
var RoutePreference;
(function (RoutePreference) {
    RoutePreference["FASTEST"] = "fastest";
    RoutePreference["LEAST_CROWDED"] = "least_crowded";
    RoutePreference["ACCESSIBLE"] = "accessible";
    RoutePreference["SCENIC"] = "scenic";
    RoutePreference["FAMILY_FRIENDLY"] = "family_friendly";
})(RoutePreference || (exports.RoutePreference = RoutePreference = {}));
//# sourceMappingURL=common.js.map