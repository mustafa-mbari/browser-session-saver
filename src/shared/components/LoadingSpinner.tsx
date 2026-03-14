interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-3',
};

export default function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center p-4" role="status" aria-label="Loading">
      <div
        className={`${sizes[size]} border-primary border-t-transparent rounded-full animate-spin motion-reduce:animate-none`}
      />
    </div>
  );
}
