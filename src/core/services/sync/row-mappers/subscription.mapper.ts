import type { Subscription } from '@core/types/subscription.types';
import type { RowMapper } from '@core/types/base.types';

export const subscriptionMapper: RowMapper<Subscription> = {
  toRow(s: Subscription, userId: string): Record<string, unknown> {
    return {
      id: s.id,
      user_id: userId,
      name: s.name,
      logo: s.logo ?? null,
      url: s.url ?? null,
      email: s.email ?? null,
      category: s.category,
      price: s.price,
      currency: s.currency,
      billing_cycle: s.billingCycle,
      next_billing_date: s.nextBillingDate,
      payment_method: s.paymentMethod ?? null,
      status: s.status,
      reminder: s.reminder,
      notes: s.notes ?? null,
      tags: s.tags ?? [],
      created_at: s.createdAt,
    };
  },

  fromRow(r: Record<string, unknown>): Subscription {
    return {
      id: r.id as string,
      name: r.name as string,
      logo: (r.logo ?? undefined) as string | undefined,
      url: (r.url ?? undefined) as string | undefined,
      email: (r.email ?? undefined) as string | undefined,
      category: r.category as string,
      price: r.price as number,
      currency: r.currency as string,
      billingCycle: r.billing_cycle as Subscription['billingCycle'],
      nextBillingDate: r.next_billing_date as string,
      paymentMethod: (r.payment_method ?? undefined) as string | undefined,
      status: r.status as Subscription['status'],
      reminder: r.reminder as number,
      notes: (r.notes ?? undefined) as string | undefined,
      tags: (r.tags ?? []) as string[],
      createdAt: r.created_at as string,
    };
  },
};
