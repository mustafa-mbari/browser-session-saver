import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap, CreditCard, Calendar, CheckCircle2 } from 'lucide-react'

export default function BillingPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Current Plan */}
        <div className="flex-1 space-y-6">
          <div className="bg-white dark:bg-[var(--dark-card)] rounded-2xl border border-stone-200 dark:border-[var(--dark-border)] overflow-hidden shadow-sm">
            <div className="bg-indigo-600 p-6 text-white">
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-indigo-200" />
                    <span className="text-xs font-bold uppercase tracking-widest text-indigo-100">Current Plan</span>
                  </div>
                  <h2 className="text-2xl font-bold">Free</h2>
                </div>
                <Badge variant="outline" className="bg-white/10 text-white border-white/20 px-3 py-1">
                  Active
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-indigo-100 text-sm">
                <Calendar className="h-4 w-4" />
                <span>No credit card required</span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-[var(--dark-elevated)] border border-stone-100 dark:border-[var(--dark-border)]">
                  <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">Status</div>
                  <div className="flex items-center gap-1.5 font-semibold text-stone-800 dark:text-stone-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Good Standing
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-[var(--dark-elevated)] border border-stone-100 dark:border-[var(--dark-border)]">
                  <div className="text-xs text-stone-500 dark:text-stone-400 mb-1">Next Billing</div>
                  <div className="font-semibold text-stone-800 dark:text-stone-100">N/A</div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white dark:bg-[var(--dark-card)] rounded-2xl border border-stone-200 dark:border-[var(--dark-border)] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-stone-800 dark:text-stone-100">Payment Method</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">Default billing method</p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center py-4 border-2 border-dashed border-stone-100 dark:border-[var(--dark-border)] rounded-xl">
              <p className="text-sm text-stone-400">No payment method set</p>
            </div>
          </div>
        </div>

        {/* Billing History */}
        <div className="md:w-1/3">
          <Card className="h-full">
            <CardContent className="pt-6">
              <h3 className="font-bold text-stone-800 dark:text-stone-100 mb-4">Billing History</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400">No invoices yet.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
