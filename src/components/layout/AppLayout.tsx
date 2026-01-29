import { AppSidebar } from './AppSidebar';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main
        className={cn(
          'lg:ml-64 min-h-screen pt-14 lg:pt-0',
          className
        )}
      >
        {children}
      </main>
    </div>
  );
}
