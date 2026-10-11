import { Loader2 } from 'lucide-react';

interface CenteredLoadingProps {
  message?: string;
  size?: 'md' | 'lg' | 'xl';
  fullScreen?: boolean;
}

const sizeClasses = {
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
};

const textSizeClasses = {
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

/**
 * Centered loading component with spinner and text
 * Uses Tailwind CSS for styling
 * @param fullScreen - If true, takes full viewport height. If false, adapts to container.
 */
export function CenteredLoading({ message = 'Loading...', size = 'lg', fullScreen = true }: CenteredLoadingProps) {
  return (
    <div className={`bg-background flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'h-full'}`}>
      <div className="flex flex-col items-center gap-4">
        <Loader2 strokeWidth={1.5} className={`${sizeClasses[size]} text-primary animate-spin`} />
        <p className={`${textSizeClasses[size]} text-muted-foreground font-medium`}>{message}</p>
      </div>
    </div>
  );
}
