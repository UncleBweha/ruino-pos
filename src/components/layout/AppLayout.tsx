import { AppSidebar } from './AppSidebar';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <AppSidebar />
      <main
        className={cn(
          'min-h-screen pt-20 lg:pt-20 pb-6 relative z-[1]',
          className
        )}
      >
        {children}
      </main>
    </div>
  );
}