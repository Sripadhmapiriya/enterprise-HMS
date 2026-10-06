'use client';

import React, { useState, useEffect, useMemo, useRef, ReactNode, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  LayoutDashboard,
  Users,
  Calendar,
  ListOrdered,
  Stethoscope,
  Bed,
  FileText,
  FlaskConical,
  ScanLine,
  Pill,
  Package,
  CreditCard,
  Receipt,
  FileCheck,
  Siren,
  Scissors,
  HeartPulse,
  Droplets,
  Sparkles,
  UtensilsCrossed,
  ShoppingCart,
  Brush,
  Truck,
  UserCheck,
  Banknote,
  BookOpen,
  Building,
  BarChart3,
  Network,
  ShieldCheck,
  Settings,
  Wrench,
  MessageSquare,
  FileSpreadsheet,
  ChevronDown,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Home,
  Check,
  Pin,
  PinOff,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  AlertTriangle,
} from 'lucide-react';
import {
  CommandPalette,
  CommandItem,
  Badge,
  clinicalAlertPulseVariants,
  MOTION_DURATIONS,
  MOTION_EASINGS,
  MOTION_SPRING,
} from '@enterprise-hms/ui';
import { authApi, platformServiceApi } from '@/lib/api';

// SVG Icon dictionary mapping module manifest icon strings to Lucide components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  Calendar,
  ListOrdered,
  Stethoscope,
  Bed,
  FileText,
  FlaskConical,
  ScanLine,
  Pill,
  Package,
  CreditCard,
  Receipt,
  FileCheck,
  Siren,
  Scissors,
  HeartPulse,
  Droplets,
  Sparkles,
  UtensilsCrossed,
  ShoppingCart,
  Brush,
  Truck,
  UserCheck,
  Banknote,
  BookOpen,
  Building,
  BarChart3,
  Network,
  ShieldCheck,
  Settings,
  Wrench,
  MessageSquare,
  FileSpreadsheet,
};

export interface NavItemDef {
  id: string;
  label: string;
  route: string;
  icon: string;
  moduleId: string;
  permission?: string;
  badgeKey?: 'queue' | 'lab' | 'emergency' | 'criticalAlerts';
}

export interface NavSectionDef {
  title: string;
  items: NavItemDef[];
}

// Module-grouped navigation without any deprecated legacy labels
export const NAV_SECTIONS: NavSectionDef[] = [
  {
    title: 'Core & Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', route: '/dashboard', icon: 'LayoutDashboard', moduleId: 'foundation' },
    ],
  },
  {
    title: 'Clinical Services',
    items: [
      { id: 'patients', label: 'Patients', route: '/patients', icon: 'Users', moduleId: 'patients', permission: 'patients.read' },
      { id: 'appointments', label: 'Appointments', route: '/appointments', icon: 'Calendar', moduleId: 'scheduling', permission: 'scheduling.read' },
      { id: 'queue', label: 'OPD Queue Board', route: '/queue', icon: 'ListOrdered', moduleId: 'scheduling', permission: 'scheduling.queue.manage', badgeKey: 'queue' },
      { id: 'emergency', label: 'Emergency (ER)', route: '/operations/emergency', icon: 'Siren', moduleId: 'emergency', permission: 'emergency.board.view', badgeKey: 'emergency' },
    ],
  },
  {
    title: 'Inpatient Care',
    items: [
      { id: 'ipd-dash', label: 'IPD Overview', route: '/ipd', icon: 'Bed', moduleId: 'ipd' },
      { id: 'admissions', label: 'Admissions & ADT', route: '/ipd/admissions', icon: 'FileText', moduleId: 'ipd' },
      { id: 'bed-board', label: 'Bed Board', route: '/ipd/bed-board', icon: 'Building', moduleId: 'ipd' },
      { id: 'nursing', label: 'Nursing Station', route: '/ipd/nursing', icon: 'Stethoscope', moduleId: 'ipd' },
      { id: 'rounds', label: 'Doctor Rounds', route: '/ipd/rounds', icon: 'FileText', moduleId: 'ipd' },
      { id: 'icu', label: 'ICU & Critical Care', route: '/operations/icu', icon: 'HeartPulse', moduleId: 'icu' },
      { id: 'ot', label: 'Operating Theatre (OT)', route: '/operations/ot', icon: 'Scissors', moduleId: 'ot' },
    ],
  },
  {
    title: 'Diagnostics',
    items: [
      { id: 'lab', label: 'Laboratory Worklist', route: '/laboratory', icon: 'FlaskConical', moduleId: 'laboratory', badgeKey: 'lab' },
      { id: 'radiology', label: 'Radiology / PACS', route: '/radiology', icon: 'ScanLine', moduleId: 'radiology' },
    ],
  },
  {
    title: 'Pharmacy & Supplies',
    items: [
      { id: 'pharmacy', label: 'Pharmacy & Dispense', route: '/pharmacy', icon: 'Pill', moduleId: 'pharmacy' },
      { id: 'inventory', label: 'Inventory & Stores', route: '/inventory', icon: 'Package', moduleId: 'inventory' },
      { id: 'cssd', label: 'CSSD Sterilization', route: '/operations/cssd', icon: 'Sparkles', moduleId: 'cssd' },
      { id: 'dietary', label: 'Dietary Services', route: '/operations/dietary', icon: 'UtensilsCrossed', moduleId: 'dietary' },
    ],
  },
  {
    title: 'Billing & RCM',
    items: [
      { id: 'billing', label: 'Billing Summary', route: '/billing', icon: 'CreditCard', moduleId: 'billing' },
      { id: 'invoices', label: 'Invoices & Tariffs', route: '/billing/invoices', icon: 'Receipt', moduleId: 'billing' },
      { id: 'payments', label: 'Payments & Receipts', route: '/billing/payments', icon: 'Banknote', moduleId: 'billing' },
      { id: 'insurance', label: 'Insurance & Claims', route: '/billing/insurance', icon: 'FileCheck', moduleId: 'insurance' },
    ],
  },
  {
    title: 'Hospital Operations',
    items: [
      { id: 'bloodbank', label: 'Blood Bank', route: '/operations/blood-bank', icon: 'Droplets', moduleId: 'bloodbank' },
      { id: 'procurement', label: 'Procurement (PO/GRN)', route: '/operations/procurement', icon: 'ShoppingCart', moduleId: 'procurement' },
      { id: 'assets', label: 'Biomedical Assets', route: '/finance/assets', icon: 'Wrench', moduleId: 'assets' },
      { id: 'housekeeping', label: 'Housekeeping', route: '/operations/housekeeping', icon: 'Brush', moduleId: 'housekeeping' },
      { id: 'ambulance', label: 'Ambulance Dispatch', route: '/operations/ambulance', icon: 'Truck', moduleId: 'ambulance' },
    ],
  },
  {
    title: 'Workforce & Administration',
    items: [
      { id: 'hr', label: 'Employee Master', route: '/hr/employees', icon: 'UserCheck', moduleId: 'hr' },
      { id: 'finance', label: 'General Ledger', route: '/finance/ledger', icon: 'BookOpen', moduleId: 'finance' },
      { id: 'crm', label: 'Patient CRM & Feedback', route: '/crm/feedback', icon: 'MessageSquare', moduleId: 'crm' },
      { id: 'analytics', label: 'Analytics & MIS', route: '/analytics', icon: 'BarChart3', moduleId: 'analytics' },
      { id: 'integrations', label: 'Integrations Hub', route: '/integrations', icon: 'Network', moduleId: 'integrations' },
      { id: 'import', label: 'Onboarding Import', route: '/settings/import', icon: 'FileSpreadsheet', moduleId: 'enterprise' },
      { id: 'enterprise', label: 'Enterprise Admin', route: '/enterprise/admin', icon: 'Building', moduleId: 'enterprise' },
      { id: 'module-manager', label: 'Module Manager', route: '/enterprise/modules', icon: 'ShieldCheck', moduleId: 'enterprise' },
      { id: 'hospitals', label: 'Hospital Master', route: '/hospitals', icon: 'Building', moduleId: 'foundation' },
      { id: 'users', label: 'Users & Roles', route: '/users', icon: 'Users', moduleId: 'foundation' },
    ],
  },
];

// Helper to determine exact best-match active route
export function getActiveRoute(pathname: string, allItems: NavItemDef[]): string | null {
  if (pathname === '/dashboard') return '/dashboard';

  let bestMatch: string | null = null;
  let maxMatchLength = 0;

  for (const item of allItems) {
    if (item.route === pathname) {
      return item.route;
    }
    if (item.route !== '/dashboard' && pathname.startsWith(item.route + '/')) {
      if (item.route.length > maxMatchLength) {
        maxMatchLength = item.route.length;
        bestMatch = item.route;
      }
    }
  }

  return bestMatch;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // User & Capabilities State
  const [currentUser, setCurrentUser] = useState<{
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    roles?: string[];
    permissions?: string[];
    tenantName?: string;
    enabledModules?: string[];
  } | null>(null);

  const [enabledModules, setEnabledModules] = useState<string[] | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Sidebar Modes & Layout
  const [isCollapsed, setIsCollapsed] = useState(false); // 72px rail on desktop
  const [isDrawerOpen, setIsDrawerOpen] = useState(false); // Mobile / tablet drawer
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown States
  const [isHospitalMenuOpen, setIsHospitalMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Live Badges State from API
  const [badges, setBadges] = useState<{
    queue: number;
    lab: number;
    emergency: number;
    criticalAlerts: number;
  }>({
    queue: 0,
    lab: 0,
    emergency: 0,
    criticalAlerts: 0,
  });

  // Active hospital branch state
  const [selectedHospital, setSelectedHospital] = useState('City General Hospital - Main Campus');
  const hospitals = [
    'City General Hospital - Main Campus',
    'Metro Care Clinic - North Wing',
    'St. Jude Trauma Center - East',
  ];

  // Group Open/Closed states (per user)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Pinned favorites (up to 6, per user)
  const [pinnedRoutes, setPinnedRoutes] = useState<string[]>([]);

  // Keyboard navigation focus index ref
  const navListRef = useRef<HTMLDivElement>(null);

  // Reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  // 1. Initial Load: Auth, User, Capabilities, Preferences
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('hms_access_token');
    if (!token) {
      window.location.href = '/login?redirect=' + encodeURIComponent(pathname);
      return;
    }

    // Load theme
    const savedTheme = (localStorage.getItem('hms_theme') as 'light' | 'dark') || 'light';
    setTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.remove('dark');
    }

    // Load cached user if available
    try {
      const rawUser = localStorage.getItem('hms_user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        setCurrentUser(u);
        if (u.permissions) setUserPermissions(u.permissions);
      }
    } catch {}

    // Load active branch
    const savedBranch = localStorage.getItem('hms_selected_branch');
    if (savedBranch) setSelectedHospital(savedBranch);

    // Fetch user details & capabilities from server
    async function initUserSession() {
      try {
        const [meRes, capRes] = await Promise.all([
          authApi.getMe().catch(() => null),
          authApi.getCapabilities().catch(() => null),
        ]);

        const userId = meRes?.data?.id || 'default';

        if (meRes?.data) {
          setCurrentUser(meRes.data);
          if (meRes.data.permissions) setUserPermissions(meRes.data.permissions);
        }

        if (capRes?.data?.enabledModules) {
          setEnabledModules(capRes.data.enabledModules);
        }

        // Restore collapsed preference
        const savedCollapsed = localStorage.getItem(`hms_sidebar_collapsed_${userId}`);
        if (savedCollapsed !== null) {
          setIsCollapsed(savedCollapsed === 'true');
        }

        // Restore pinned routes
        const savedPinned = localStorage.getItem(`hms_sidebar_pinned_${userId}`);
        if (savedPinned) {
          try {
            setPinnedRoutes(JSON.parse(savedPinned));
          } catch {}
        }

        // Restore group open states
        const savedGroups = localStorage.getItem(`hms_sidebar_groups_${userId}`);
        if (savedGroups) {
          try {
            setOpenGroups(JSON.parse(savedGroups));
          } catch {}
        }
      } catch {
        // Fallback gracefully to default state
      }
    }

    initUserSession();
  }, [pathname]);

  // 2. Poll / Fetch Live Badges from API
  useEffect(() => {
    let isMounted = true;
    async function fetchBadges() {
      try {
        const res = await platformServiceApi.getSidebarBadges();
        if (res?.data && isMounted) {
          setBadges({
            queue: Number(res.data.queue) || 0,
            lab: Number(res.data.lab) || 0,
            emergency: Number(res.data.emergency) || 0,
            criticalAlerts: Number(res.data.criticalAlerts) || 0,
          });
        }
      } catch {}
    }

    fetchBadges();
    const interval = setInterval(fetchBadges, 30000); // 30s refresh
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 3. Filter Nav Sections by Enabled Modules & Permissions
  const visibleNavSections = useMemo(() => {
    const isSuperAdmin =
      userPermissions.includes('*') ||
      userPermissions.includes('superadmin') ||
      currentUser?.roles?.includes('System Administrator') ||
      currentUser?.roles?.includes('Super Admin');

    return NAV_SECTIONS.map((section) => {
      const filteredItems = section.items.filter((item) => {
        // Foundation module items are always visible
        if (item.moduleId !== 'foundation') {
          if (enabledModules && !enabledModules.includes(item.moduleId)) {
            return false;
          }
        }
        // Permission check
        if (item.permission && !isSuperAdmin) {
          if (!userPermissions.includes(item.permission)) {
            return false;
          }
        }
        return true;
      });

      return {
        ...section,
        items: filteredItems,
      };
    }).filter((section) => section.items.length > 0); // Hide groups with 0 visible items!
  }, [enabledModules, userPermissions, currentUser]);

  // Flattened list of all visible items
  const allVisibleItems = useMemo(() => {
    return visibleNavSections.flatMap((s) => s.items);
  }, [visibleNavSections]);

  // Active route
  const activeRoute = useMemo(() => {
    return getActiveRoute(pathname, allVisibleItems);
  }, [pathname, allVisibleItems]);

  // 4. Auto-open the group that contains the current page, and keep only current group open by default
  useEffect(() => {
    if (!activeRoute) return;

    // Find which section contains the active route
    const currentSection = visibleNavSections.find((sec) =>
      sec.items.some((item) => item.route === activeRoute)
    );

    if (currentSection) {
      setOpenGroups((prev) => {
        // If user has not yet interacted with groups (empty prev), open ONLY current group
        if (Object.keys(prev).length === 0) {
          return { [currentSection.title]: true };
        }
        // Otherwise ensure current section is open
        if (!prev[currentSection.title]) {
          const next = { ...prev, [currentSection.title]: true };
          const userId = currentUser?.id || 'default';
          localStorage.setItem(`hms_sidebar_groups_${userId}`, JSON.stringify(next));
          return next;
        }
        return prev;
      });
    }
  }, [activeRoute, visibleNavSections, currentUser]);

  // Toggle group open/close and persist
  const toggleGroup = useCallback(
    (title: string) => {
      setOpenGroups((prev) => {
        const next = { ...prev, [title]: !prev[title] };
        const userId = currentUser?.id || 'default';
        localStorage.setItem(`hms_sidebar_groups_${userId}`, JSON.stringify(next));
        return next;
      });
    },
    [currentUser]
  );

  // Toggle collapsed rail mode and persist
  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      const userId = currentUser?.id || 'default';
      localStorage.setItem(`hms_sidebar_collapsed_${userId}`, String(next));
      return next;
    });
  }, [currentUser]);

  // Toggle Pinned / Favorite status (max 6)
  const togglePin = useCallback(
    (route: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setPinnedRoutes((prev) => {
        let next: string[];
        if (prev.includes(route)) {
          next = prev.filter((r) => r !== route);
        } else {
          if (prev.length >= 6) return prev; // max 6 pinned
          next = [...prev, route];
        }
        const userId = currentUser?.id || 'default';
        localStorage.setItem(`hms_sidebar_pinned_${userId}`, JSON.stringify(next));
        return next;
      });
    },
    [currentUser]
  );

  // Theme Toggle
  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('hms_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Sign out
  const handleSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hms_access_token');
      localStorage.removeItem('hms_refresh_token');
      localStorage.removeItem('hms_tenant_id');
      localStorage.removeItem('hms_user');
      window.location.href = '/login';
    }
  };

  // Keyboard navigation & Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      // Escape key closes drawer and search
      if (e.key === 'Escape') {
        if (isDrawerOpen) setIsDrawerOpen(false);
        if (searchQuery) setSearchQuery('');
        if (isHospitalMenuOpen) setIsHospitalMenuOpen(false);
        if (isNotificationsOpen) setIsNotificationsOpen(false);
        if (isUserMenuOpen) setIsUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, searchQuery, isHospitalMenuOpen, isNotificationsOpen, isUserMenuOpen]);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  // Pinned items resolved definitions
  const pinnedItems = useMemo(() => {
    return pinnedRoutes
      .map((route) => allVisibleItems.find((item) => item.route === route))
      .filter((item): item is NavItemDef => Boolean(item));
  }, [pinnedRoutes, allVisibleItems]);

  // Filtered navigation items based on search query
  const searchFilteredItems = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();
    return allVisibleItems.filter(
      (item) => item.label.toLowerCase().includes(q) || item.route.toLowerCase().includes(q)
    );
  }, [searchQuery, allVisibleItems]);

  // Command palette items
  const commandItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [];
    for (const section of visibleNavSections) {
      for (const item of section.items) {
        items.push({
          id: item.id,
          title: item.label,
          subtitle: section.title,
          category: 'Navigation',
          href: item.route,
          keywords: [item.label, section.title, item.route],
        });
      }
    }
    // Add quick clinical actions
    items.push({
      id: 'quick-patient',
      title: 'Register New Patient',
      subtitle: 'Open patient registration intake',
      category: 'Actions',
      href: '/patients',
    });
    items.push({
      id: 'quick-appointment',
      title: 'Book Appointment',
      subtitle: 'Schedule outpatient slot',
      category: 'Actions',
      href: '/appointments',
    });
    items.push({
      id: 'quick-er',
      title: 'Emergency Triage',
      subtitle: 'Register inbound trauma / ER case',
      category: 'Actions',
      href: '/operations/emergency',
    });
    return items;
  }, [visibleNavSections]);

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return [{ label: 'Dashboard', href: '/dashboard', isCurrent: true }];
    return parts.map((part, index) => {
      const href = '/' + parts.slice(0, index + 1).join('/');
      const label = part
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return {
        label,
        href,
        isCurrent: index === parts.length - 1,
      };
    });
  }, [pathname]);

  const displayName = currentUser?.firstName
    ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim()
    : 'Dr. Sarah Jenkins';
  const displayEmail = currentUser?.email || 'sarah.jenkins@hospital.org';
  const displayRole = currentUser?.roles?.[0] || 'Physician / Admin';
  const tenantName = currentUser?.tenantName || 'City General Hospital';
  const initials = currentUser?.firstName
    ? `${currentUser.firstName[0]}${currentUser.lastName?.[0] || ''}`.toUpperCase()
    : 'SJ';

  // Badge rendering helper
  const renderBadge = (item: NavItemDef) => {
    if (!item.badgeKey) return null;
    const count = badges[item.badgeKey];
    if (count <= 0) return null;

    if (item.badgeKey === 'emergency') {
      return (
        <motion.span
          variants={clinicalAlertPulseVariants}
          initial="initial"
          animate="pulse"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-950/80 text-red-200 border border-red-700/60 shadow-xs tabular-nums"
        >
          <AlertTriangle className="w-2.5 h-2.5 text-red-400" aria-hidden="true" />
          <span>{count}</span>
        </motion.span>
      );
    }

    if (item.badgeKey === 'lab') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950 text-cyan-200 border border-cyan-800/60 tabular-nums">
          {count}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 tabular-nums">
        {count}
      </span>
    );
  };

  // Keyboard navigation within nav
  const handleNavKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const focusable = navListRef.current?.querySelectorAll<HTMLElement>(
        'a[role="link"], button[role="button"]'
      );
      if (!focusable || focusable.length === 0) return;

      const currentIdx = Array.from(focusable).indexOf(document.activeElement as HTMLElement);
      let nextIdx = 0;
      if (e.key === 'ArrowDown') {
        nextIdx = currentIdx < focusable.length - 1 ? currentIdx + 1 : 0;
      } else {
        nextIdx = currentIdx > 0 ? currentIdx - 1 : focusable.length - 1;
      }
      focusable[nextIdx]?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors duration-200">
      {/* Mobile / Tablet Backdrop */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        aria-label="Application Sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-100 border-r border-slate-800 transition-all duration-200 ${
          isDrawerOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-[72px]' : 'lg:w-64'}`}
      >
        {/* Header: Product Logo & Tenant Info & Close Button */}
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-slate-800 shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 overflow-hidden focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-md py-1"
          >
            <div className="w-8 h-8 rounded-lg bg-[#0891B2] flex items-center justify-center text-white shrink-0 shadow-sm">
              <Activity className="w-5 h-5" aria-hidden="true" />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <span className="font-bold text-sm tracking-tight text-white whitespace-nowrap block leading-tight">
                  Enterprise <span className="text-[#22D3EE]">HMS</span>
                </span>
                <span className="text-[10px] text-slate-400 truncate block leading-tight">
                  {tenantName}
                </span>
              </div>
            )}
          </Link>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          {/* Mobile drawer close button */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close mobile navigation"
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-md"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Hospital Branch Selector directly under header */}
        {!isCollapsed && (
          <div className="px-3 pt-2 pb-1.5 border-b border-slate-800/80 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsHospitalMenuOpen((prev) => !prev)}
                aria-expanded={isHospitalMenuOpen}
                aria-label="Select hospital branch"
                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building className="w-3.5 h-3.5 text-[#22D3EE] shrink-0" aria-hidden="true" />
                  <span className="truncate text-[11px] font-medium">{selectedHospital}</span>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
              </button>

              {isHospitalMenuOpen && (
                <div className="absolute left-0 right-0 mt-1 rounded-md border border-slate-700 bg-slate-800 p-1 shadow-xl z-50 space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Hospital Branches
                  </div>
                  {hospitals.map((hosp) => (
                    <button
                      key={hosp}
                      type="button"
                      onClick={() => {
                        setSelectedHospital(hosp);
                        setIsHospitalMenuOpen(false);
                        localStorage.setItem('hms_selected_branch', hosp);
                      }}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-xs text-slate-200 hover:bg-cyan-950/60 hover:text-[#22D3EE] transition-colors"
                    >
                      <span className="truncate text-[11px]">{hosp}</span>
                      {selectedHospital === hosp && (
                        <Check className="w-3 h-3 text-[#22D3EE]" aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search at top of sidebar */}
        <div className="p-2 border-b border-slate-800/60 shrink-0">
          {!isCollapsed ? (
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu..."
                aria-label="Filter menu items"
                className="w-full pl-8 pr-14 py-1.5 bg-slate-800/80 border border-slate-700/60 rounded-md text-xs text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-cyan-400"
              />
              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="absolute right-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 hover:text-white"
                title="Open Command Palette (Ctrl+K)"
              >
                Ctrl K
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              aria-label="Search navigation (Ctrl+K)"
              className="w-full p-2 flex items-center justify-center rounded-md hover:bg-slate-800 text-slate-400 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Scrollable Navigation Area with scroll fade mask and custom scrollbar */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          {/* Soft top gradient fade mask */}
          <div className="pointer-events-none h-3 bg-gradient-to-b from-slate-900 to-transparent absolute top-0 left-0 right-0 z-10" />

          <nav
            ref={navListRef}
            aria-label="Sidebar Navigation"
            onKeyDown={handleNavKeyDown}
            className="h-full overflow-y-auto custom-scrollbar py-2 px-2 space-y-3 text-xs"
          >
            {/* 1. Live Filtered Search Results View */}
            {searchFilteredItems !== null ? (
              <div className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Filtered ({searchFilteredItems.length})</span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-[10px] text-cyan-400 hover:underline"
                  >
                    Clear
                  </button>
                </div>
                {searchFilteredItems.length === 0 ? (
                  <div className="px-3 py-4 text-center text-slate-500 text-xs">
                    No matching pages found
                  </div>
                ) : (
                  searchFilteredItems.map((item) => {
                    const isActive = activeRoute === item.route;
                    const IconComponent = ICON_MAP[item.icon] || FileText;

                    return (
                      <Link
                        key={item.id}
                        href={item.route}
                        role="link"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => {
                          setSearchQuery('');
                          setIsDrawerOpen(false);
                        }}
                        className={`relative group flex items-center justify-between px-3 py-2 rounded-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                          isActive
                            ? 'bg-cyan-500/15 text-cyan-300 font-semibold shadow-xs'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeNavIndicator"
                            className="absolute inset-0 bg-cyan-500/15 border-l-2 border-[#22D3EE] rounded-md pointer-events-none"
                            transition={MOTION_SPRING}
                          />
                        )}
                        <div className="flex items-center gap-2.5 truncate">
                          <IconComponent className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-cyan-300" />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {renderBadge(item)}
                      </Link>
                    );
                  })
                )}
              </div>
            ) : (
              <>
                {/* 2. Pinned Favorites Section (Max 6) */}
                {pinnedItems.length > 0 && (
                  <div className="space-y-0.5 border-b border-slate-800/80 pb-2 mb-2">
                    {!isCollapsed && (
                      <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Pin className="w-3 h-3 text-[#22D3EE]" aria-hidden="true" />
                        <span>Pinned ({pinnedItems.length}/6)</span>
                      </div>
                    )}
                    {pinnedItems.map((item) => {
                      const isActive = activeRoute === item.route;
                      const IconComponent = ICON_MAP[item.icon] || FileText;

                      return (
                        <div key={'pinned-' + item.id} className="relative group">
                          <Link
                            href={item.route}
                            role="link"
                            aria-current={isActive ? 'page' : undefined}
                            className={`relative flex items-center ${
                              isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                            } rounded-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                              isActive
                                ? 'bg-cyan-500/15 text-cyan-300 font-semibold shadow-xs'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="activeNavIndicator"
                                className="absolute inset-0 bg-cyan-500/15 border-l-2 border-[#22D3EE] rounded-md pointer-events-none"
                                transition={MOTION_SPRING}
                              />
                            )}
                            <div className="flex items-center gap-2.5 truncate">
                              <IconComponent className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-cyan-300" />
                              {!isCollapsed && <span className="truncate">{item.label}</span>}
                            </div>
                            {!isCollapsed && (
                              <div className="flex items-center gap-1">
                                {renderBadge(item)}
                                <button
                                  type="button"
                                  onClick={(e) => togglePin(item.route, e)}
                                  aria-label={`Unpin ${item.label}`}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-amber-400 transition-opacity"
                                >
                                  <PinOff className="w-3 h-3" aria-hidden="true" />
                                </button>
                              </div>
                            )}
                          </Link>

                          {/* Accessible tooltip when collapsed */}
                          {isCollapsed && (
                            <div
                              role="tooltip"
                              className="absolute left-[76px] top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-white text-xs whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150"
                            >
                              {item.label}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. Collapsible Navigation Groups */}
                {visibleNavSections.map((section) => {
                  const isOpen = isCollapsed ? false : Boolean(openGroups[section.title]);
                  const hasActiveItem = section.items.some((item) => item.route === activeRoute);

                  return (
                    <div key={section.title} className="space-y-0.5">
                      {!isCollapsed ? (
                        <button
                          type="button"
                          role="button"
                          onClick={() => toggleGroup(section.title)}
                          aria-expanded={isOpen}
                          aria-controls={`group-${section.title.replace(/\s+/g, '-')}`}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] font-semibold uppercase tracking-wider text-left transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                            hasActiveItem
                              ? 'text-cyan-300 bg-slate-800/40'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                          }`}
                        >
                          <span className="truncate">{section.title}</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                              isOpen ? 'transform rotate-180 text-cyan-400' : 'text-slate-500'
                            }`}
                            aria-hidden="true"
                          />
                        </button>
                      ) : null}

                      {/* Group Items (expanded or collapsed rail) */}
                      {isCollapsed ? (
                        <div className="space-y-1">
                          {section.items.map((item) => {
                            const isActive = activeRoute === item.route;
                            const IconComponent = ICON_MAP[item.icon] || FileText;

                            return (
                              <div key={item.id} className="relative group">
                                <Link
                                  href={item.route}
                                  role="link"
                                  aria-current={isActive ? 'page' : undefined}
                                  className={`relative flex items-center justify-center p-2.5 rounded-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                                    isActive
                                      ? 'bg-cyan-500/15 text-cyan-300 font-semibold shadow-xs'
                                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                  }`}
                                >
                                  {isActive && (
                                    <motion.div
                                      layoutId="activeNavIndicator"
                                      className="absolute inset-0 bg-cyan-500/15 border-l-2 border-[#22D3EE] rounded-md pointer-events-none"
                                      transition={MOTION_SPRING}
                                    />
                                  )}
                                  <IconComponent className="w-5 h-5 shrink-0 group-hover:text-cyan-300" />
                                </Link>

                                {/* Floating tooltip for icon-rail mode */}
                                <div
                                  role="tooltip"
                                  className="absolute left-[76px] top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-white text-xs whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 flex items-center gap-2"
                                >
                                  <span>{item.label}</span>
                                  {renderBadge(item)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              id={`group-${section.title.replace(/\s+/g, '-')}`}
                              initial={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              animate={prefersReducedMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                              exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              transition={{
                                duration: MOTION_DURATIONS.normal,
                                ease: MOTION_EASINGS.standard,
                              }}
                              className="overflow-hidden space-y-0.5 pt-0.5"
                            >
                              {section.items.map((item) => {
                                const isActive = activeRoute === item.route;
                                const isPinned = pinnedRoutes.includes(item.route);
                                const IconComponent = ICON_MAP[item.icon] || FileText;

                                return (
                                  <div key={item.id} className="relative group">
                                    <Link
                                      href={item.route}
                                      role="link"
                                      aria-current={isActive ? 'page' : undefined}
                                      className={`relative flex items-center justify-between px-3 py-2 rounded-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                                        isActive
                                          ? 'bg-cyan-500/15 text-cyan-300 font-semibold shadow-xs'
                                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                      }`}
                                    >
                                      {isActive && (
                                        <motion.div
                                          layoutId="activeNavIndicator"
                                          className="absolute inset-0 bg-cyan-500/15 border-l-2 border-[#22D3EE] rounded-md pointer-events-none"
                                          transition={MOTION_SPRING}
                                        />
                                      )}
                                      <div className="flex items-center gap-2.5 truncate">
                                        <IconComponent className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-cyan-300" />
                                        <span className="truncate">{item.label}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {renderBadge(item)}
                                        <button
                                          type="button"
                                          onClick={(e) => togglePin(item.route, e)}
                                          aria-label={isPinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
                                          className={`p-0.5 rounded transition-opacity ${
                                            isPinned
                                              ? 'text-cyan-400'
                                              : 'opacity-0 group-hover:opacity-100 text-slate-500 hover:text-cyan-300'
                                          }`}
                                        >
                                          <Pin className="w-3 h-3" aria-hidden="true" />
                                        </button>
                                      </div>
                                    </Link>
                                  </div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </nav>

          {/* Soft bottom gradient fade mask */}
          <div className="pointer-events-none h-4 bg-gradient-to-t from-slate-900 to-transparent absolute bottom-0 left-0 right-0 z-10" />
        </div>

        {/* Footer: User Card & Dropdown Menu */}
        <div className="p-2.5 border-t border-slate-800 shrink-0 relative bg-slate-900 z-20">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            aria-expanded={isUserMenuOpen}
            aria-label="User profile and account settings"
            className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 text-left"
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-full bg-cyan-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {initials}
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <div className="text-xs font-semibold text-slate-200 truncate">{displayName}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {displayRole} • Main Campus
                  </div>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            )}
          </button>

          {/* User popup dropdown */}
          {isUserMenuOpen && (
            <div className="absolute bottom-16 left-2 right-2 rounded-lg border border-slate-700 bg-slate-800 p-1.5 shadow-2xl z-50 space-y-1 text-xs">
              <div className="px-2.5 py-2 border-b border-slate-700/80">
                <div className="font-semibold text-slate-100">{displayName}</div>
                <div className="text-[11px] text-slate-400 truncate">{displayEmail}</div>
                <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-200 border border-cyan-700/60">
                  {displayRole}
                </span>
              </div>

              <Link
                href="/users"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded text-slate-200 hover:bg-slate-700 hover:text-white"
                onClick={() => setIsUserMenuOpen(false)}
              >
                <Users className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>Profile & Roles</span>
              </Link>

              {/* Theme toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {theme === 'dark' ? (
                    <Moon className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  )}
                  <span>Theme</span>
                </div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">
                  {theme}
                </span>
              </button>

              {/* Sign out */}
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-red-400 hover:bg-red-950/40 hover:text-red-300 text-left cursor-pointer border-t border-slate-700/60 pt-1.5"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Layout Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'
        }`}
      >
        {/* Sticky Topbar Header */}
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile / Tablet Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Desktop Collapse Toggle */}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:flex p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Menu className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* Topbar Hospital Branch Display */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Building className="w-3.5 h-3.5 text-[#0891B2] dark:text-[#22D3EE]" aria-hidden="true" />
              <span className="truncate max-w-[200px] sm:max-w-none">{selectedHospital}</span>
            </div>
          </div>

          {/* Right Header Utilities */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Global Search / Command Palette Trigger */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              aria-label="Open command search palette (Ctrl+K)"
              className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Search className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
              <span className="hidden sm:inline font-medium">Search records & modules...</span>
              <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                Ctrl K
              </kbd>
            </button>

            {/* Notification Center */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                aria-expanded={isNotificationsOpen}
                aria-label={`View clinical alerts (${badges.criticalAlerts} alerts)`}
                className="relative p-2 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                {badges.criticalAlerts > 0 && (
                  <motion.span
                    variants={clinicalAlertPulseVariants}
                    initial="initial"
                    animate="pulse"
                    className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900"
                  />
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-1.5 w-80 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xl z-50 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
                      <span>Clinical Alerts</span>
                    </span>
                    <Badge variant="critical" size="sm">
                      {badges.criticalAlerts || 3} New
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 text-red-900 dark:text-red-200">
                      <div className="font-semibold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                        <span>Critical Lab Value: MRN-2024-0012</span>
                      </div>
                      <div className="text-[11px] text-red-700 dark:text-red-300">Serum Potassium 6.2 mEq/L (Ref: 3.5 - 5.0)</div>
                    </div>
                    <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 text-amber-900 dark:text-amber-200">
                      <div className="font-semibold">Bed Turnaround Alert</div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-300">ICU Bed #4 sanitized and ready for admission</div>
                    </div>
                    <div className="p-2 rounded bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-100 dark:border-cyan-900 text-cyan-900 dark:text-cyan-200">
                      <div className="font-semibold">Pharmacy Shift Closing</div>
                      <div className="text-[11px] text-cyan-700 dark:text-cyan-300">Narcotics reconciliation pending verification</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Theme Toggle in Topbar */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle visual theme"
              className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-amber-300" aria-hidden="true" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        {/* Breadcrumb Trail */}
        <div className="px-6 py-2 bg-slate-100/70 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800">
          <nav aria-label="Breadcrumb" className="flex items-center text-xs text-slate-500 dark:text-slate-400">
            <ol className="flex items-center space-x-1.5 list-none p-0 m-0">
              <li>
                <Link
                  href="/dashboard"
                  className="flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                  aria-label="Home Dashboard"
                >
                  <Home className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </li>
              {breadcrumbs.map((item, idx) => (
                <li key={idx} className="flex items-center space-x-1.5">
                  <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" aria-hidden="true" />
                  {item.isCurrent ? (
                    <span className="font-semibold text-slate-800 dark:text-slate-100" aria-current="page">
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* Dynamic Page Content with Fast Page Entrance Transition (<200ms) */}
        <main className="flex-1 p-6">
          <motion.div
            key={pathname}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0.01 : MOTION_DURATIONS.normal,
              ease: MOTION_EASINGS.decelerate,
            }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        items={commandItems}
      />
    </div>
  );
}
