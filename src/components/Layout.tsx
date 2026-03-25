import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Plus, User, BarChart3, Settings, Apple } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export function Layout() {
  const location = useLocation();
  
  // Hide nav on onboarding, login, success
  const hideNav = ['/login', '/onboarding', '/success'].includes(location.pathname);

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/add-meal', icon: Plus, label: 'Add', isCenter: true },
    { path: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-paper flex flex-col relative">
      {/* Top Navigation for Desktop */}
      {!hideNav && (
        <header className="fixed top-0 left-0 right-0 z-50 px-8 py-6 hidden md:flex justify-between items-center bg-paper/80 backdrop-blur-md border-b border-ink/5">
          <Link to="/" className="flex items-center gap-3 group">
            <Apple className="text-ink group-hover:text-gold transition-colors" fill="currentColor" size={24} />
            <span className="font-serif text-2xl tracking-tight">Cal AI</span>
          </Link>
          
          <nav className="flex items-center gap-12">
            {navItems.filter(i => !i.isCenter).map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "text-[10px] uppercase tracking-[0.2em] font-bold transition-all hover:text-gold",
                    isActive ? "text-ink" : "text-ink/40"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link to="/add-meal" className="luxury-button py-2 px-6 text-xs">
              Log Entry
            </Link>
          </nav>
        </header>
      )}

      <main className={cn("flex-1", !hideNav && "md:pt-24")}>
        <Outlet />
      </main>

      {/* Mobile Navigation */}
      {!hideNav && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[400px] z-50 md:hidden">
          <nav className="bg-ink/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[32px] p-2 flex justify-between items-center">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              if (item.isCenter) {
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="relative"
                  >
                    <div className="bg-gold text-ink p-4 rounded-full shadow-lg active:scale-90 transition-transform">
                      <Icon size={24} strokeWidth={2.5} />
                    </div>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center justify-center py-3 px-5 rounded-2xl transition-all relative",
                    isActive ? "text-white" : "text-white/40"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-active-mobile"
                      className="absolute inset-0 bg-white/10 rounded-2xl -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
