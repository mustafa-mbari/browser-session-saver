import { useState, useEffect } from 'react';
import type { PlanTier } from '@core/types/limits.types';
import { getCachedPlanTier, isPremiumTier } from '@core/services/limits/action-tracker';

export function useIsPremium(): { isPremium: boolean; tier: PlanTier; loading: boolean } {
  const [tier, setTier] = useState<PlanTier>('guest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCachedPlanTier().then((t) => {
      setTier(t);
      setLoading(false);
    });
  }, []);

  return { isPremium: isPremiumTier(tier), tier, loading };
}
