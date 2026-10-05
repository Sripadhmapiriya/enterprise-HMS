'use client';

import React, { useState, useEffect, useMemo, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  CalendarCheck,
  Banknote,
  BookOpen,
  Building,
  BarChart3,
  Network,
  ShieldCheck,
  Settings,
  ChevronDown,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Home,
  Check,
} from 'lucide-react';
import { CommandPalette, CommandItem, Badge } from '@enterprise-hms/ui';

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
  CalendarCheck,
  Banknote,
  BookOpen,
  Building,
  BarChart3,
  Network,
  ShieldCheck,
  Settings,
};

interface NavItemDef {
  id: string;
  label: string;
  route: string;
  icon: string;
  badge?: string;
}

interface NavSectionDef {
  title: string;
  items: NavItemDef[];
}

// Module-grouped navigation without any deprecated legacy labels
const NAV_SECTIONS: NavSectionDef[] = [
  {
    title: 'Core & Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', route: '/dashboard', icon: 'LayoutDashboard' },
    ],
  },
  {
    title: 'Clinical Services',
    items: [
      { id: 'patients', label: 'Patients', route: '/patients', icon: 'Users' },
      { id: 'appointments', label: 'Appointments', route: '/appointments', icon: 'Calendar' },
      { id: 'queue', label: 'OPD Queue Board', route: '/queue', icon: 'ListOrdered' },
      { id: 'emergency', label: 'Emergency (ER)', route: '/operations/emergency', icon: 'Siren' },
    ],
  },
  {
    title: 'Inpatient Care',
    items: [
      { id: 'ipd-dash', label: 'IPD Overview', route: '/ipd', icon: 'Bed' },
      { id: 'admissions', label: 'Admissions & ADT', route: '/ipd/admissions', icon: 'FileText' },
      { id: 'bed-board', label: 'Bed Board', route: '/ipd/bed-board', icon: 'Building' },
      { id: 'nursing', label: 'Nursing Station', route: '/ipd/nursing', icon: 'Stethoscope' },
      { id: 'rounds', label: 'Doctor Rounds', route: '/ipd/rounds', icon: 'FileText' },
      { id: 'icu', label: 'ICU & Critical Care', route: '/operations/icu', icon: 'HeartPulse' },
      { id: 'ot', label: 'Operating Theatre (OT)', route: '/operations/ot', icon: 'Scissors' },
    ],
  },
  {
    title: 'Diagnostics',
    items: [
      { id: 'lab', label: 'Laboratory Worklist', route: '/laboratory', icon: 'FlaskConical' },
      { id: 'radiology', label: 'Radiology / PACS', route: '/radiology', icon: 'ScanLine' },
    ],
  },
  {
    title: 'Pharmacy & Supplies',
    items: [
      { id: 'pharmacy', label: 'Pharmacy & Dispense', route: '/pharmacy', icon: 'Pill' },
      { id: 'inventory', label: 'Inventory & Stores', route: '/inventory', icon: 'Package' },
      { id: 'cssd', label: 'CSSD Sterilization', route: '/operations/cssd', icon: 'Sparkles' },
      { id: 'dietary', label: 'Dietary Services', route: '/operations/dietary', icon: 'UtensilsCrossed' },
    ],
  },
  {
    title: 'Billing & RCM',
    items: [
      { id: 'billing', label: 'Billing Summary', route: '/billing', icon: 'CreditCard' },
      { id: 'invoices', label: 'Invoices & Tariffs', route: '/billing/invoices', icon: 'Receipt' },
      { id: 'payments', label: 'Payments & Receipts', route: '/billing/payments', icon: 'Banknote' },
      { id: 'insurance', label: 'Insurance & Claims', route: '/billing/insurance', icon: 'FileCheck' },
    ],
  },
  {
    title: 'Hospital Operations',
    items: [
      { id: 'bloodbank', label: 'Blood Bank', route: '/operations/blood-bank', icon: 'Droplets' },
      { id: 'procurement', label: 'Procurement (PO/GRN)', route: '/operations/procurement', icon: 'ShoppingCart' },
      { id: 'housekeeping', label: 'Housekeeping', route: '/operations/housekeeping', icon: 'Brush' },
      { id: 'ambulance', label: 'Ambulance Dispatch', route: '/operations/ambulance', icon: 'Truck' },
    ],
  },
  {
    title: 'Workforce & Administration',
    items: [
      { id: 'hr', label: 'Employee Master', route: '/hr/employees', icon: 'UserCheck' },
      { id: 'finance', label: 'General Ledger', route: '/finance/ledger', icon: 'BookOpen' },
      { id: 'enterprise', label: 'Enterprise Admin', route: '/enterprise/admin', icon: 'Building' },
      { id: 'module-manager', label: 'Module Manager', route: '/enterprise/modules', icon: 'ShieldCheck' },
      { id: 'hospitals', label: 'Hospital Master', route: '/hospitals', icon: 'Building' },
      { id: 'users', label: 'Users & Roles', route: '/users', icon: 'Users' },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Topbar dropdown states
  const [isHospitalMenuOpen, setIsHospitalMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Active hospital branch state
  const [selectedHospital, setSelectedHospital] = useState('City General Hospital - Main Campus');
  const hospitals = [
    'City General Hospital - Main Campus',
    'Metro Care Clinic - North Wing',
    'St. Jude Trauma Center - East',
  ];

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Construct command items from navigation registry
  const commandItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [];
    for (const section of NAV_SECTIONS) {
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
    // Add quick actions
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
  }, []);

  // Compute breadcrumbs
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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-100 transition-all duration-200 border-r border-slate-800 ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${isSidebarOpen ? 'md:w-64' : 'md:w-16'}`}
      >
        {/* Brand Banner */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-[#0891B2] flex items-center justify-center text-white shrink-0 shadow-sm">
              <Activity className="w-5 h-5" aria-hidden="true" />
            </div>
            {isSidebarOpen && (
              <span className="font-bold text-sm tracking-tight text-white whitespace-nowrap">
                Enterprise <span className="text-[#22D3EE]">HMS</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close mobile navigation"
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation Items (Grouped cleanly by module domain) */}
        <nav
          aria-label="Sidebar Navigation"
          className="flex-1 overflow-y-auto py-3 px-2 space-y-4 text-xs"
        >
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-0.5">
              {isSidebarOpen && (
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const isActive = pathname === item.route || pathname.startsWith(item.route + '/');
                const IconComponent = ICON_MAP[item.icon] || FileText;

                return (
                  <Link
                    key={item.id}
                    href={item.route}
                    title={!isSidebarOpen ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors font-medium ${
                      isActive
                        ? 'bg-[#0891B2] text-white shadow-xs font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 shrink-0" />
                    {isSidebarOpen && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="p-3 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-cyan-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
              SJ
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-slate-200 truncate">Dr. Sarah Jenkins</div>
                <div className="text-[10px] text-slate-400 truncate">Lead Physician • Main Campus</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isSidebarOpen ? 'md:ml-64' : 'md:ml-16'
        }`}
      >
        {/* Sticky Topbar Header */}
        <header className="h-14 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open navigation menu"
              className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 md:hidden"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Desktop sidebar collapse toggle */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              className="hidden md:flex p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* Hospital Branch Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsHospitalMenuOpen((prev) => !prev)}
                aria-expanded={isHospitalMenuOpen}
                aria-label="Select active hospital location"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-[#0891B2] bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-md border border-slate-200 transition-colors"
              >
                <Building className="w-3.5 h-3.5 text-[#0891B2]" aria-hidden="true" />
                <span className="truncate max-w-[180px] sm:max-w-none">{selectedHospital}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" aria-hidden="true" />
              </button>

              {isHospitalMenuOpen && (
                <div className="absolute left-0 mt-1.5 w-64 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg z-40 space-y-1">
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
                      }}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left text-xs text-slate-700 hover:bg-cyan-50 hover:text-[#0891B2]"
                    >
                      <span className="truncate">{hosp}</span>
                      {selectedHospital === hosp && (
                        <Check className="w-3.5 h-3.5 text-[#0891B2]" aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Header Utilities */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Global Search / Command Palette Trigger */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              aria-label="Open command search palette (Ctrl+K)"
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-2.5 py-1.5 transition-colors"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Search records & modules...</span>
              <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200">
                Ctrl K
              </kbd>
            </button>

            {/* Notification Center */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                aria-expanded={isNotificationsOpen}
                aria-label="View notifications (3 unread)"
                className="relative p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-1.5 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-xl z-40 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-semibold text-slate-800">Clinical Alerts</span>
                    <Badge variant="critical" size="sm">
                      3 New
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded bg-red-50 border border-red-100 text-red-900">
                      <div className="font-semibold">Critical Lab Value: MRN-2024-0012</div>
                      <div className="text-[11px] text-red-700">Serum Potassium 6.2 mEq/L (Ref: 3.5 - 5.0)</div>
                    </div>
                    <div className="p-2 rounded bg-amber-50 border border-amber-100 text-amber-900">
                      <div className="font-semibold">Bed Turnaround Alert</div>
                      <div className="text-[11px] text-amber-700">ICU Bed #4 sanitized and ready for admission</div>
                    </div>
                    <div className="p-2 rounded bg-cyan-50 border border-cyan-100 text-cyan-900">
                      <div className="font-semibold">Pharmacy Shift Closing</div>
                      <div className="text-[11px] text-cyan-700">Narcotics reconciliation pending verification</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-expanded={isUserMenuOpen}
                aria-label="User account menu"
                className="flex items-center gap-2 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[#0891B2] text-white flex items-center justify-center text-xs font-bold">
                  SJ
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" aria-hidden="true" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg z-40 space-y-1 text-xs">
                  <div className="px-2 py-1.5 border-b border-slate-100">
                    <div className="font-semibold text-slate-800">Dr. Sarah Jenkins</div>
                    <div className="text-[11px] text-slate-500">sarah.jenkins@hospital.org</div>
                    <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800">
                      Physician / Admin
                    </span>
                  </div>
                  <Link
                    href="/users"
                    className="block px-2 py-1.5 rounded text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    User Profile & Security
                  </Link>
                  <Link
                    href="/login"
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-red-600 hover:bg-red-50"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Sign Out</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Breadcrumb Trail */}
        <div className="px-6 py-2 bg-slate-100/70 border-b border-slate-200/80">
          <nav aria-label="Breadcrumb" className="flex items-center text-xs text-slate-500">
            <ol className="flex items-center space-x-1.5 list-none p-0 m-0">
              <li>
                <Link
                  href="/dashboard"
                  className="flex items-center text-slate-400 hover:text-slate-700 transition-colors"
                  aria-label="Home Dashboard"
                >
                  <Home className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </li>
              {breadcrumbs.map((item, idx) => (
                <li key={idx} className="flex items-center space-x-1.5">
                  <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" aria-hidden="true" />
                  {item.isCurrent ? (
                    <span className="font-semibold text-slate-800" aria-current="page">
                      {item.label}
                    </span>
                  ) : (
                    <Link href={item.href} className="text-slate-500 hover:text-slate-800 transition-colors">
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        items={commandItems}
      />
    </div>
  );
}
