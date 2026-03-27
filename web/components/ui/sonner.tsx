"use client"

import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-stone-900 group-[.toaster]:border-stone-200 group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl dark:group-[.toaster]:bg-[var(--dark-card)] dark:group-[.toaster]:text-stone-100 dark:group-[.toaster]:border-[var(--dark-border)]",
          description: "group-[.toast]:text-stone-500 dark:group-[.toast]:text-stone-400",
          actionButton:
            "group-[.toast]:bg-indigo-500 group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-stone-100 group-[.toast]:text-stone-500 dark:group-[.toast]:bg-stone-800 dark:group-[.toast]:text-stone-400",
          success: "group-[.toaster]:!bg-emerald-50 group-[.toaster]:!text-emerald-900 group-[.toaster]:!border-emerald-200 dark:group-[.toaster]:!bg-emerald-950 dark:group-[.toaster]:!text-emerald-100 dark:group-[.toaster]:!border-emerald-800",
          error: "group-[.toaster]:!bg-rose-50 group-[.toaster]:!text-rose-900 group-[.toaster]:!border-rose-200 dark:group-[.toaster]:!bg-rose-950 dark:group-[.toaster]:!text-rose-100 dark:group-[.toaster]:!border-rose-800",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
