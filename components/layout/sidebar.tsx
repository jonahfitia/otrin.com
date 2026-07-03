'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tag,
  CreditCard,
  PieChart,
  Target,
  RefreshCw,
  BarChart3,
  Calendar,
  Settings,
  TrendingUp,
  LogOut,
  ChevronLeft,
  FlaskConical,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord', exact: true },
  { href: '/dashboard/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { href: '/dashboard/accounts', icon: CreditCard, label: 'Comptes' },
  { href: '/dashboard/categories', icon: Tag, label: 'Catégories' },
  { href: '/dashboard/budget', icon: PieChart, label: 'Budget' },
  { href: '/dashboard/goals', icon: Target, label: 'Objectifs' },
  { href: '/dashboard/recurring', icon: RefreshCw, label: 'Récurrents' },
  { href: '/dashboard/simulation', icon: FlaskConical, label: 'Simulation' },
  { href: '/dashboard/reports', icon: BarChart3, label: 'Rapports' },
  { href: '/dashboard/calendar', icon: Calendar, label: 'Calendrier' },
  { href: '/dashboard/settings', icon: Settings, label: 'Paramètres' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onClose?: () => void;
  mobile?: boolean;
}

export function Sidebar({ collapsed, onToggle, onClose, mobile }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col h-full bg-card border-r border-border transition-all duration-300',
          collapsed && !mobile ? 'w-[70px]' : 'w-[240px]'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center px-4 h-16 border-b border-border', collapsed && !mobile ? 'justify-center' : 'justify-between')}>
          {(!collapsed || mobile) && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg tracking-tight">Volako</span>
            </div>
          )}
          {collapsed && !mobile && (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
          )}
          {mobile ? (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={onToggle}
              className={cn(
                'p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground',
                collapsed && 'rotate-180'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            const content = (
              <Link
                key={item.href}
                href={item.href}
                onClick={mobile ? onClose : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group',
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  collapsed && !mobile && 'justify-center px-2'
                )}
              >
                <item.icon className={cn('w-5 h-5 flex-shrink-0', active && 'text-primary')} />
                {(!collapsed || mobile) && <span className="text-sm">{item.label}</span>}
                {active && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );

            if (collapsed && !mobile) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return content;
          })}
        </nav>

        {/* User */}
        <div className={cn('p-3 border-t border-border', collapsed && !mobile && 'px-2')}>
          {collapsed && !mobile ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={signOut}
                  className="w-full flex justify-center p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Déconnexion</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold text-sm">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.email?.split('@')[0]}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                onClick={signOut}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                title="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
