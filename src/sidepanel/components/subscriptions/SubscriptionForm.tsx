import { useState } from 'react';
import { X, Wand2 } from 'lucide-react';
import type { Subscription, SubscriptionTemplate } from '@core/types/subscription.types';
import {
  SUPPORTED_CURRENCIES, CATEGORY_LABELS,
} from '@core/types/subscription.types';
import { SubscriptionService } from '@core/services/subscription.service';
import { resolveFavIcon } from '@core/utils/favicon';
import QuickAddTemplates from './QuickAddTemplates';

interface Props {
  initial?: Subscription | null;
  onSave: (sub: Subscription) => void;
  onClose: () => void;
}

function getDefaultForm(): Partial<Subscription> {
  return {
    name: '',
    url: '',
    category: 'personal',
    price: 0,
    currency: 'USD',
    billingCycle: 'monthly',
    nextBillingDate: SubscriptionService.computeNextBillingDate('monthly', new Date()),
    status: 'active',
    reminder: 3,
    notes: '',
    tags: [],
    paymentMethod: '',
  };
}

export default function SubscriptionForm({ initial, onSave, onClose }: Props) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [form, setForm] = useState<Partial<Subscription>>(
    initial ? { ...initial } : getDefaultForm(),
  );
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof Subscription>(key: K, value: Subscription[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const applyTemplate = (template: SubscriptionTemplate) => {
    setForm((prev) => ({
      ...prev,
      name: template.name,
      url: template.url ?? '',
      category: template.category,
      price: template.defaultPrice,
      currency: template.currency,
      billingCycle: template.billingCycle,
      nextBillingDate: SubscriptionService.computeNextBillingDate(template.billingCycle, new Date()),
      logo: template.url ? resolveFavIcon('', template.url) : prev.logo,
    }));
    setShowTemplates(false);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name?.trim()) errs.name = 'Name is required';
    if (!form.price || form.price < 0) errs.price = 'Price must be positive';
    if (!form.nextBillingDate) errs.nextBillingDate = 'Billing date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const now = new Date().toISOString();
    const sub: Subscription = {
      id: initial?.id ?? SubscriptionService.generateId(),
      name: form.name!.trim(),
      url: form.url?.trim() || undefined,
      logo: form.logo,
      category: form.category ?? 'personal',
      price: form.price ?? 0,
      currency: form.currency ?? 'USD',
      billingCycle: form.billingCycle ?? 'monthly',
      nextBillingDate: form.nextBillingDate!,
      paymentMethod: form.paymentMethod?.trim() || undefined,
      status: form.status ?? 'active',
      reminder: form.reminder ?? 3,
      notes: form.notes?.trim() || undefined,
      tags: form.tags ?? [],
      createdAt: initial?.createdAt ?? now,
    };
    onSave(sub);
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    set('tags', [...(form.tags ?? []), tag]);
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    set('tags', (form.tags ?? []).filter((t) => t !== tag));
  };

  if (showTemplates) {
    return (
      <div className="flex flex-col h-full">
        <QuickAddTemplates onSelect={applyTemplate} onClose={() => setShowTemplates(false)} />
      </div>
    );
  }

  const inputCls = 'w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-violet-400 transition-colors';
  const labelCls = 'text-xs font-medium text-[var(--color-text-secondary)] mb-1';
  const selectStyle: React.CSSProperties = { colorScheme: 'dark' };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          {initial ? 'Edit Subscription' : 'Add Subscription'}
        </h3>
        <div className="flex items-center gap-2">
          {!initial && (
            <button
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
            >
              <Wand2 size={12} />
              <span>Templates</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-[var(--color-bg-secondary)] transition-colors text-[var(--color-text-secondary)]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {/* Name + URL */}
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Name *</label>
          <input
            className={`${inputCls} ${errors.name ? 'border-red-400' : ''}`}
            value={form.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Netflix"
            autoFocus
          />
          {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
        </div>

        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Website URL</label>
          <input
            className={inputCls}
            value={form.url ?? ''}
            onChange={(e) => set('url', e.target.value)}
            placeholder="https://..."
          />
        </div>

        {/* Price + Currency */}
        <div className="flex gap-2">
          <div className="flex flex-col gap-0.5 flex-1">
            <label className={labelCls}>Price *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={`${inputCls} ${errors.price ? 'border-red-400' : ''}`}
              value={form.price ?? ''}
              onChange={(e) => set('price', parseFloat(e.target.value) || 0)}
            />
            {errors.price && <p className="text-xs text-red-500 mt-0.5">{errors.price}</p>}
          </div>
          <div className="flex flex-col gap-0.5 w-24">
            <label className={labelCls}>Currency</label>
            <select
              className={inputCls}
              style={selectStyle}
              value={form.currency ?? 'USD'}
              onChange={(e) => set('currency', e.target.value)}
            >
              {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Billing cycle + Next date */}
        <div className="flex gap-2">
          <div className="flex flex-col gap-0.5 flex-1">
            <label className={labelCls}>Billing Cycle</label>
            <select
              className={inputCls}
              style={selectStyle}
              value={form.billingCycle ?? 'monthly'}
              onChange={(e) => {
                const cycle = e.target.value as Subscription['billingCycle'];
                set('billingCycle', cycle);
                set('nextBillingDate', SubscriptionService.computeNextBillingDate(cycle, new Date()));
              }}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="weekly">Weekly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <label className={labelCls}>Next Billing Date *</label>
            <input
              type="date"
              className={`${inputCls} ${errors.nextBillingDate ? 'border-red-400' : ''}`}
              value={form.nextBillingDate ?? ''}
              onChange={(e) => set('nextBillingDate', e.target.value)}
            />
          </div>
        </div>

        {/* Category + Status */}
        <div className="flex gap-2">
          <div className="flex flex-col gap-0.5 flex-1">
            <label className={labelCls}>Category</label>
            <select
              className={inputCls}
              style={selectStyle}
              value={form.category ?? 'personal'}
              onChange={(e) => set('category', e.target.value as Subscription['category'])}
            >
              {(Object.entries(CATEGORY_LABELS) as [Subscription['category'], string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <label className={labelCls}>Status</label>
            <select
              className={inputCls}
              style={selectStyle}
              value={form.status ?? 'active'}
              onChange={(e) => set('status', e.target.value as Subscription['status'])}
            >
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="canceling">Canceling</option>
              <option value="paused">Paused</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        </div>

        {/* Payment method + Reminder */}
        <div className="flex gap-2">
          <div className="flex flex-col gap-0.5 flex-1">
            <label className={labelCls}>Payment Method</label>
            <input
              className={inputCls}
              value={form.paymentMethod ?? ''}
              onChange={(e) => set('paymentMethod', e.target.value)}
              placeholder="Visa, PayPal…"
            />
          </div>
          <div className="flex flex-col gap-0.5 w-28">
            <label className={labelCls}>Reminder (days)</label>
            <input
              type="number"
              min="0"
              max="30"
              className={inputCls}
              value={form.reminder ?? 3}
              onChange={(e) => set('reminder', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Notes</label>
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Optional notes…"
          />
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-0.5">
          <label className={labelCls}>Tags</label>
          <div className="flex flex-wrap gap-1 mb-1">
            {(form.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 hover:text-red-500 transition-colors"
                  aria-label={`Remove tag ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              className={`${inputCls} flex-1`}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="Add tag…"
            />
            <button
              onClick={addTag}
              className="px-2 py-1 rounded-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-[var(--color-border)]">
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-md text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          {initial ? 'Save Changes' : 'Add Subscription'}
        </button>
      </div>
    </div>
  );
}
