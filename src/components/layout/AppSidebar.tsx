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
  User,
  FileBarChart,
  Bell,
  Search,
  Users,
  Truck,
  FileText,
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
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/suppliers', label: 'Suppliers', icon: Truck },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { path: '/reports', label: 'Reports', icon: FileBarChart },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const cashierNavItems = [
  { path: '/pos', label: 'POS', icon: ShoppingCart },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/sales', label: 'My Sales', icon: Receipt },
  { path: '/credits', label: 'Credits', icon: CreditCard },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { path: '/reports', label: 'Reports', icon: FileBarChart },
];

export function AppSidebar() {
  const { profile, role, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = isAdmin ? adminNavItems : cashierNavItems;

  return (
    <>
      {/* Desktop Top Nav - Pill-shaped */}
      <header className="hidden lg:flex fixed top-0 left-0 right-0 z-50 px-6 py-3">
        <div className="w-full glass-panel rounded-full px-3 py-2 flex items-center justify-between">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 px-4">
            <span className="text-lg font-bold text-foreground tracking-tight">Ruinu</span>
          </Link>

          {/* Nav Items - pill-shaped */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn('nav-pill press-effect', isActive && 'active')}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
              <Bell className="w-4 h-4" />
            </Button>
            <Link
              to="/profile"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-muted transition-colors press-effect"
            >
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                <User className="w-4 h-4 text-accent-foreground" />
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-sm font-semibold leading-tight">{profile?.full_name?.split(' ')[0] || 'User'}</p>
                <p className="text-2xs text-muted-foreground capitalize">{role || 'Loading'}</p>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground hover:text-foreground"
              onClick={signOut}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 z-50 px-4 py-2">
        <div className="glass-panel rounded-2xl h-full flex items-center px-4 justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <span className="font-bold text-foreground">Ruinu</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/profile">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                <User className="w-4 h-4 text-accent-foreground" />
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed left-3 top-20 bottom-3 w-72 z-40 flex flex-col transition-all duration-300 rounded-[var(--bento-radius)] overflow-hidden',
          mobileOpen
            ? 'translate-x-0 opacity-100'
            : '-translate-x-[110%] opacity-0'
        )}
        style={{
          background: 'hsl(var(--sidebar-background))',
        }}
      >
        {/* Header */}
        <div className="p-5 border-b border-sidebar-border">
          <h1 className="text-base font-bold text-sidebar-foreground">Ruinu General Merchants</h1>
          <p className="text-xs text-sidebar-foreground/50 mt-0.5 capitalize">{role || 'Loading...'}</p>
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
                className={cn('nav-item', isActive && 'active')}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="p-4 border-t border-sidebar-border">
          <Link
            to="/profile"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2.5 mb-3 rounded-xl bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-sidebar-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sidebar-foreground truncate text-sm">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-xs text-sidebar-foreground/50 capitalize">
                  {role || 'Loading...'}
                </p>
              </div>
            </div>
          </Link>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent font-medium rounded-xl"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  );
}