import type { PlanTier } from '@core/types/limits.types';
import { isPremiumTier } from '@core/services/limits/action-tracker';

/**
 * Single source of truth for Import/Export access control.
 * Import/Export are premium features (PRO and Lifetime only).
 * They are NOT user actions — no action counting applies.
 *
 * Returns a ready-to-return error response when access is denied,
 * or null when access is granted.
 */
export function assertImportExportAccess(
  tier: PlanTier,
): { success: false; error: 'upgrade_required'; message: string } | null {
  if (!isPremiumTier(tier)) {
    return {
      success: false,
      error: 'upgrade_required',
      message: 'Import/Export is available فقط في خطة PRO أو Lifetime',
    };
  }
  return null;
}
