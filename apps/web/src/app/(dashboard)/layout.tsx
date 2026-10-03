import Link from "next/link";
import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex fixed h-full z-10">
        <div className="h-16 flex items-center px-6 font-bold text-xl tracking-tight border-b border-slate-800">
          <span className="text-blue-500 mr-2">✦</span> Enterprise HMS
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <NavItem href="/dashboard" icon="📊" label="Dashboard" active />
          
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Clinical (Phase 2)
          </div>
          <NavItem href="/patients" icon="🏥" label="Patients" />
          <NavItem href="/appointments" icon="📅" label="Appointments" />
          <NavItem href="/queue" icon="⏳" label="Live Queue" />
          <NavItem href="/encounters" icon="🩺" label="Encounters" />

          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Inpatient (Phase 3)
          </div>
          <NavItem href="/ipd" icon="🛏️" label="IPD Dashboard" />
          <NavItem href="/ipd/admissions" icon="📝" label="Admissions" />
          <NavItem href="/ipd/bed-board" icon="🏨" label="Bed Board" />
          <NavItem href="/ipd/nursing" icon="👩‍⚕️" label="Nursing Station" />
          <NavItem href="/ipd/rounds" icon="📋" label="Doctor Rounds" />

          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Diagnostics (Phase 4)
          </div>
          <NavItem href="/laboratory" icon="🔬" label="Laboratory" />
          <NavItem href="/radiology" icon="🩻" label="Radiology" />

          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Pharmacy & Inventory (Phase 5)
          </div>
          <NavItem href="/pharmacy" icon="💊" label="Pharmacy" />
          <NavItem href="/inventory" icon="📦" label="Inventory" />
          
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Billing & RCM (Phase 6)
          </div>
          <NavItem href="/billing" icon="💰" label="Billing Dashboard" />
          <NavItem href="/billing/invoices" icon="🧾" label="Invoices & Bills" />
          <NavItem href="/billing/payments" icon="💵" label="Payments & Receipts" />
          <NavItem href="/billing/insurance" icon="🛡️" label="Insurance & Claims" />

          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Hospital Operations (Phase 7)
          </div>
          <NavItem href="/operations/emergency" icon="🚑" label="Emergency (ER)" />
          <NavItem href="/operations/ot" icon="🔪" label="Operating Theatre (OT)" />
          <NavItem href="/operations/icu" icon="🫀" label="ICU / Critical Care" />
          <NavItem href="/operations/blood-bank" icon="🩸" label="Blood Bank" />
          <NavItem href="/operations/cssd" icon="🧺" label="CSSD (Sterilization)" />
          <NavItem href="/operations/dietary" icon="🍲" label="Dietary / Kitchen" />
          
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Support Services
          </div>
          <NavItem href="/operations/procurement" icon="🛒" label="Procurement" />
          <NavItem href="/operations/housekeeping" icon="🧹" label="Housekeeping" />
          <NavItem href="/operations/ambulance" icon="🚐" label="Ambulance Fleet" />

          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Management
          </div>
          <NavItem href="/hospitals" icon="🏥" label="Hospitals" />
          <NavItem href="/branches" icon="🏢" label="Branches" />
          <NavItem href="/departments" icon="📂" label="Departments" />
          
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Staff & Users
          </div>
          <NavItem href="/users" icon="👥" label="Users & Roles" />
          <NavItem href="/doctors" icon="👨‍⚕️" label="Doctors" />
          <NavItem href="/staff" icon="👩‍💼" label="Staff" />

          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            System
          </div>
          <NavItem href="/audit" icon="🛡️" label="Audit Logs" />
          <NavItem href="/settings" icon="⚙️" label="Settings" />
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-medium">
              SA
            </div>
            <div>
              <div className="text-sm font-medium">System Admin</div>
              <div className="text-xs text-slate-400">Demo Tenant</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen relative">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="font-medium text-slate-700">City General Hospital - Main Branch</div>
          <div className="flex items-center space-x-4">
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              🔔
            </button>
            <button className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md font-medium transition-colors">
              Log out
            </button>
          </div>
        </header>

        <div className="flex-1 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active?: boolean }) {
  return (
    <Link 
      href={href}
      className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
        active 
          ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" 
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <span className="text-lg">{icon}</span>
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
}
