"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = exports.DEFAULT_RATE_LIMITS = exports.SupportedLanguage = exports.AccessibilityNeed = exports.UserRole = void 0;
const common_1 = require("./common");
Object.defineProperty(exports, "UserRole", { enumerable: true, get: function () { return common_1.UserRole; } });
Object.defineProperty(exports, "AccessibilityNeed", { enumerable: true, get: function () { return common_1.AccessibilityNeed; } });
Object.defineProperty(exports, "SupportedLanguage", { enumerable: true, get: function () { return common_1.SupportedLanguage; } });
/** Default rate limits */
exports.DEFAULT_RATE_LIMITS = {
    [common_1.UserRole.FAN]: { role: common_1.UserRole.FAN, maxRequests: 100, windowSeconds: 60 },
    [common_1.UserRole.STAFF]: { role: common_1.UserRole.STAFF, maxRequests: 500, windowSeconds: 60 },
    [common_1.UserRole.ADMIN]: { role: common_1.UserRole.ADMIN, maxRequests: 1000, windowSeconds: 60 },
};
/** Permission definitions per role */
exports.ROLE_PERMISSIONS = {
    [common_1.UserRole.FAN]: [
        'route:calculate',
        'route:view',
        'zone:density:view',
        'stadium:map:view',
        'translate',
        'stadium:query',
        'feedback:submit',
    ],
    [common_1.UserRole.STAFF]: [
        'route:calculate',
        'route:view',
        'zone:density:view',
        'stadium:map:view',
        'translate',
        'stadium:query',
        'feedback:submit',
        'sensor:ingest',
        'prediction:view',
        'alert:view',
        'alert:acknowledge',
    ],
    [common_1.UserRole.ADMIN]: [
        'route:calculate',
        'route:view',
        'zone:density:view',
        'stadium:map:view',
        'stadium:map:update',
        'translate',
        'stadium:query',
        'feedback:submit',
        'feedback:view',
        'sensor:ingest',
        'prediction:view',
        'prediction:configure',
        'alert:view',
        'alert:acknowledge',
        'alert:configure',
        'user:manage',
        'system:configure',
    ],
};
//# sourceMappingURL=auth.js.map