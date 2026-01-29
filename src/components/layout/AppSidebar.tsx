import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  CreditCard,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const adminNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/pos', label: 'POS', icon: ShoppingCart },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/sales', label: 'Sales', icon: Receipt },
  { path: '/credits', label: 'Credits', icon: CreditCard },
  { path: '/cashbox', label: 'Cash Box', icon: Wallet },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const cashierNavItems = [
  { path: '/pos', label: 'POS', icon: ShoppingCart },
  { path: '/sales', label: 'My Sales', icon: Receipt },
  { path: '/credits', label: 'Credits', icon: CreditCard },
];

export function AppSidebar() {
  const { profile, role, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = isAdmin ? adminNavItems : cashierNavItems;

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <Store className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sidebar-foreground truncate">Ruino</h1>
            <p className="text-xs text-sidebar-foreground/60 truncate">General Merchants</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'nav-item',
                isActive && 'active'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User & Logout */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="px-4 py-3 mb-2">
          <p className="font-medium text-sidebar-foreground truncate">
            {profile?.full_name || 'User'}
          </p>
          <p className="text-xs text-sidebar-foreground/60 capitalize">
            {role || 'Loading...'}
          </p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar z-50 flex items-center px-4 border-b border-sidebar-border">
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
        <div className="flex items-center gap-2 ml-3">
          <Store className="w-5 h-5 text-sidebar-primary" />
          <span className="font-bold text-sidebar-foreground">Ruino POS</span>
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar h-screen fixed left-0 top-0 z-40">
        <NavContent />
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed left-0 top-14 bottom-0 w-64 bg-sidebar z-40 flex flex-col transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
