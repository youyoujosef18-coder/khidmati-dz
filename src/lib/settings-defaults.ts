/** Default, non-secret platform settings. Secrets never live here. */
export interface PlatformSettings {
  cancellation_policy: {
    /** Client may cancel a confirmed booking until N hours before the start. */
    clientFreeCancellationHours: number;
    /** After that window, cancellation goes through support (cash-only launch: no fees). */
    lateCancellationRequiresSupport: boolean;
  };
  completion_review_hours: number;
  request_expiry_days: number;
  quote_default_validity_hours: number;
  fixed_price_hold_hours: number;
  dispute_window_days: number;
  maintenance_mode: boolean;
  support_contacts: { email: string; phone: string; whatsapp: string; address: string };
  social_links: { facebook: string; instagram: string; tiktok: string; linkedin: string };
  feature_flags: {
    onlinePayments: boolean;
    emergencyRequests: boolean;
    sponsoredListings: boolean;
    technicianSubscriptions: boolean;
  };
  verification_requirements: { requireIdentityDocument: boolean; requireQualificationDocument: boolean };
  platform_fee: { enabled: boolean; basisPoints: number };
  notification_overrides: Record<string, { titleFr?: string; bodyFr?: string; titleAr?: string; bodyAr?: string }>;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  cancellation_policy: { clientFreeCancellationHours: 12, lateCancellationRequiresSupport: true },
  completion_review_hours: 72,
  request_expiry_days: 7,
  quote_default_validity_hours: 72,
  fixed_price_hold_hours: 12,
  dispute_window_days: 7,
  maintenance_mode: false,
  support_contacts: { email: "", phone: "", whatsapp: "", address: "" },
  social_links: { facebook: "", instagram: "", tiktok: "", linkedin: "" },
  feature_flags: {
    onlinePayments: false,
    emergencyRequests: true,
    sponsoredListings: false,
    technicianSubscriptions: false,
  },
  verification_requirements: { requireIdentityDocument: true, requireQualificationDocument: false },
  platform_fee: { enabled: false, basisPoints: 0 },
  notification_overrides: {},
};
