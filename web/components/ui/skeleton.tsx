import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-stone-200/60 dark:bg-[var(--dark-elevated)]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
