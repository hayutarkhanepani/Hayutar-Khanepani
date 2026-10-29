import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  LayoutDashboard,
  Users,
  Receipt,
  CreditCard,
  BarChart3,
  Scale,
  Layers,
  Sliders,
  Shield,
  History,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  UserCheck,
  Search,
  X,
  Droplets,
  Settings,
  Sparkles,
} from 'lucide-react';

interface AdminSidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentTab,
  setCurrentTab,
  isOpenMobile,
  onCloseMobile,
}) => {
  const {
    role,
    isSuperAdmin,
    isPermanentSuperAdmin,
    isOtherAdmin,
    isAdmin,
    isBillingStaff,
    isAreaStaff,
    isStaff,
    canAccessAdminFeatures,
  } = useAuth();
  const { lang, t } = useLanguage();

  // Admin Features parent menu expand/collapse state (defaults to expanded)
  const [isAdminFeaturesExpanded, setIsAdminFeaturesExpanded] = useState<boolean>(true);

  // Desktop sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const handleTabClick = (tab: string) => {
    setCurrentTab(tab);
    onCloseMobile();
  };

  const isAdminChildActive =
    currentTab === 'staff' ||
    currentTab === 'audit' ||
    currentTab === 'security-test' ||
    currentTab === 'payment-tests' ||
    currentTab === 'staff-reconciliation';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-100 border-r border-slate-800 transition-all duration-300 ease-in-out lg:static lg:z-30 ${
          isOpenMobile ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'
        } ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-72'}`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
          <div
            onClick={() => handleTabClick('home')}
            className="flex items-center gap-3 cursor-pointer group overflow-hidden"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow-md shrink-0">
              <Droplets className="w-6 h-6 fill-sky-200" />
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <span className="font-bold text-white text-sm block truncate leading-tight">
                  {lang === 'ne' ? 'खानेपानी समिति' : 'Water Committee'}
                </span>
                <span className="text-[11px] text-sky-400 font-medium block truncate">
                  {lang === 'ne' ? 'प्रशासनिक प्यानल' : 'Admin Workspace'}
                </span>
              </div>
            )}
          </div>

          {/* Close for mobile, collapse toggle for desktop */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Role Indicator Card */}
        {!isSidebarCollapsed && (
          <div className="p-3 mx-3 my-2 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">
                {lang === 'ne' ? 'प्रशासनिक भूमिका' : 'Assigned Role'}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isSuperAdmin
                    ? 'bg-purple-900/80 text-purple-200 border border-purple-700'
                    : isOtherAdmin
                    ? 'bg-indigo-900/80 text-indigo-200 border border-indigo-700'
                    : isBillingStaff
                    ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                    : 'bg-blue-900/80 text-blue-200 border border-blue-700'
                }`}
              >
                {isSuperAdmin
                  ? 'MAIN ADMIN (सुपर एडमिन)'
                  : isOtherAdmin
                  ? 'ADMIN (प्रशासक)'
                  : isBillingStaff
                  ? 'BILLING STAFF'
                  : 'AREA STAFF'}
              </span>
            </div>
          </div>
        )}

        {/* Navigation Items (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 text-xs font-medium">
          {/* Section: Operational Core */}
          <div>
            {!isSidebarCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {lang === 'ne' ? 'दैनिक सञ्चालन (Operations)' : 'Core Operations'}
              </div>
            )}
            <div className="space-y-1">
              <button
                onClick={() => handleTabClick('home')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  currentTab === 'home'
                    ? 'bg-sky-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                title={lang === 'ne' ? 'ड्यासबोर्ड / गृह' : 'Dashboard / Home'}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0 text-sky-400" />
                {!isSidebarCollapsed && <span>{lang === 'ne' ? 'ड्यासबोर्ड / गृह' : 'Dashboard / Home'}</span>}
              </button>

              <button
                onClick={() => handleTabClick('households')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  currentTab === 'households'
                    ? 'bg-sky-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                title={lang === 'ne' ? 'ग्राहक तथा धारा व्यवस्थापन' : 'Consumers & Connections'}
              >
                <Users className="w-4 h-4 shrink-0 text-sky-400" />
                {!isSidebarCollapsed && <span>{lang === 'ne' ? 'ग्राहक तथा धारा' : 'Consumers & Taps'}</span>}
              </button>

              <button
                onClick={() => handleTabClick('billing')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  currentTab === 'billing'
                    ? 'bg-sky-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                title={lang === 'ne' ? 'महसुल तथा बिलिङ' : 'Billing & Metering'}
              >
                <Receipt className="w-4 h-4 shrink-0 text-sky-400" />
                {!isSidebarCollapsed && <span>{lang === 'ne' ? 'महसुल तथा बिलिङ' : 'Billing & Invoicing'}</span>}
              </button>

              {isBillingStaff && (
                <button
                  onClick={() => handleTabClick('counter-payment')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    currentTab === 'counter-payment'
                      ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                  title={lang === 'ne' ? 'काउन्टर महसुल संकलन' : 'Cashier Counter'}
                >
                  <CreditCard className="w-4 h-4 shrink-0 text-emerald-400" />
                  {!isSidebarCollapsed && <span>{lang === 'ne' ? 'काउन्टर भुक्तानी' : 'Counter Cashier'}</span>}
                </button>
              )}

              <button
                onClick={() => handleTabClick('reports')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  currentTab === 'reports'
                    ? 'bg-sky-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                title={lang === 'ne' ? 'वित्तीय प्रतिवेदन' : 'Financial Reports'}
              >
                <BarChart3 className="w-4 h-4 shrink-0 text-sky-400" />
                {!isSidebarCollapsed && <span>{lang === 'ne' ? 'वित्तीय प्रतिवेदन' : 'Financial Reports'}</span>}
              </button>

              <button
                onClick={() => handleTabClick('reconciliation')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  currentTab === 'reconciliation'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                title={lang === 'ne' ? 'वित्तीय मिलान (Reconciliation)' : 'Reconciliation'}
              >
                <Scale className="w-4 h-4 shrink-0 text-emerald-400" />
                {!isSidebarCollapsed && <span>{lang === 'ne' ? 'वित्तीय मिलान' : 'Reconciliation'}</span>}
              </button>

              {isAdmin && (
                <button
                  onClick={() => handleTabClick('wards')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    currentTab === 'wards'
                      ? 'bg-sky-600 text-white font-semibold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                  title={lang === 'ne' ? 'वडा तथा टोल' : 'Wards & Toles'}
                >
                  <Layers className="w-4 h-4 shrink-0 text-sky-400" />
                  {!isSidebarCollapsed && <span>{lang === 'ne' ? 'वडा तथा टोल' : 'Wards & Toles'}</span>}
                </button>
              )}

              {isSuperAdmin && (
                <>
                  <button
                    onClick={() => handleTabClick('tariffs')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                      currentTab === 'tariffs'
                        ? 'bg-sky-600 text-white font-semibold shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                    title={lang === 'ne' ? 'महसुल दररेट' : 'Tariff Settings'}
                  >
                    <Sliders className="w-4 h-4 shrink-0 text-sky-400" />
                    {!isSidebarCollapsed && <span>{lang === 'ne' ? 'महसुल दररेट' : 'Tariff Settings'}</span>}
                  </button>

                  <button
                    onClick={() => handleTabClick('settings')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                      currentTab === 'settings'
                        ? 'bg-sky-600 text-white font-semibold shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                    title={lang === 'ne' ? 'Settings (सेटिङ)' : 'Settings'}
                  >
                    <Settings className="w-4 h-4 shrink-0 text-sky-400" />
                    {!isSidebarCollapsed && (
                      <div className="text-left">
                        <span>{lang === 'ne' ? 'Settings (सेटिङ)' : 'Settings'}</span>
                      </div>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Section: REQUIREMENT 4 - Admin Features (प्रशासनिक सुविधाहरू) PARENT MENU (Restricted exclusively to Permanent Super Admin) */}
          {canAccessAdminFeatures && (
            <div className="pt-2 border-t border-slate-800/80">
              {/* Parent Menu Header with Expand/Collapse Toggle */}
              <button
                onClick={() => setIsAdminFeaturesExpanded(!isAdminFeaturesExpanded)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  isAdminChildActive
                    ? 'bg-purple-950/60 border border-purple-800/80 text-purple-200'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
                title={lang === 'ne' ? 'Admin Features (प्रशासनिक सुविधाहरू)' : 'Admin Features'}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center shrink-0">
                    <Shield className="w-3.5 h-3.5 text-purple-300" />
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="text-left min-w-0">
                      <span className="font-bold text-xs block text-white truncate">
                        {lang === 'ne' ? 'Admin Features' : 'Admin Features'}
                      </span>
                      <span className="text-[10px] text-purple-300 font-medium block truncate">
                        {lang === 'ne' ? '(प्रशासनिक सुविधाहरू)' : 'Administrative Tools'}
                      </span>
                    </div>
                  )}
                </div>

                {!isSidebarCollapsed && (
                  <div className="shrink-0 text-slate-400 ml-2">
                    {isAdminFeaturesExpanded ? (
                      <ChevronDown className="w-4 h-4 text-purple-300" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                )}
              </button>

              {/* Collapsible Children Items (The 3 features specified in prompt) */}
              {(isAdminFeaturesExpanded || isSidebarCollapsed) && (
                <div
                  className={`mt-1.5 space-y-1 ${
                    isSidebarCollapsed ? '' : 'pl-3 border-l-2 border-purple-800/50 ml-3'
                  }`}
                >
                  {/* 1. कर्मचारी व्यवस्थापन */}
                  <button
                    onClick={() => handleTabClick('staff')}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer text-xs ${
                      currentTab === 'staff'
                        ? 'bg-purple-600 text-white font-bold shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/90'
                    } ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                    title={lang === 'ne' ? '१. कर्मचारी व्यवस्थापन (Staff Management)' : '1. Staff Management'}
                  >
                    <UserCheck className="w-4 h-4 shrink-0 text-purple-400" />
                    {!isSidebarCollapsed && (
                      <div className="text-left">
                        <span className="block leading-tight font-semibold">
                          {lang === 'ne' ? 'कर्मचारी व्यवस्थापन' : 'Staff Management'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {lang === 'ne' ? 'भूमिका र वडा अनुमति' : 'Roles & Ward Access'}
                        </span>
                      </div>
                    )}
                  </button>

                  {/* 2. अडिट लग */}
                  <button
                    onClick={() => handleTabClick('audit')}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer text-xs ${
                      currentTab === 'audit'
                        ? 'bg-purple-600 text-white font-bold shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/90'
                    } ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                    title={lang === 'ne' ? '२. अडिट लग (Audit Trail)' : '2. Audit Logs'}
                  >
                    <History className="w-4 h-4 shrink-0 text-sky-400" />
                    {!isSidebarCollapsed && (
                      <div className="text-left">
                        <span className="block leading-tight font-semibold">
                          {lang === 'ne' ? 'अडिट लग' : 'Audit Logs'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {lang === 'ne' ? 'बिल, भुक्तानी र सम्पादन इतिहास' : 'Immutable Event Trail'}
                        </span>
                      </div>
                    )}
                  </button>

                  {/* 3. सुरक्षा परीक्षण */}
                  <button
                    onClick={() => handleTabClick('security-test')}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer text-xs ${
                      currentTab === 'security-test' || currentTab === 'payment-tests'
                        ? 'bg-purple-600 text-white font-bold shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/90'
                    } ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                    title={lang === 'ne' ? '३. सुरक्षा परीक्षण (Security Testing)' : '3. Security Testing'}
                  >
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                    {!isSidebarCollapsed && (
                      <div className="text-left">
                        <span className="block leading-tight font-semibold">
                          {lang === 'ne' ? 'सुरक्षा परीक्षण' : 'Security Testing'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {lang === 'ne' ? 'Auth, Rules र अनधिकृत पहुँच' : 'Auth, Rules & RBAC Audit'}
                        </span>
                      </div>
                    )}
                  </button>

                  {/* 4. कर्मचारी कार्यसम्पादन तथा हिसाब मिलान */}
                  <button
                    onClick={() => handleTabClick('staff-reconciliation')}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer text-xs ${
                      currentTab === 'staff-reconciliation'
                        ? 'bg-purple-600 text-white font-bold shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/90'
                    } ${isSidebarCollapsed ? 'justify-center px-1' : ''}`}
                    title={lang === 'ne' ? '४. कार्यसम्पादन तथा हिसाब मिलान' : '4. Staff Activity & Reconciliation'}
                  >
                    <Scale className="w-4 h-4 shrink-0 text-purple-400" />
                    {!isSidebarCollapsed && (
                      <div className="text-left">
                        <span className="block leading-tight font-semibold">
                          {lang === 'ne' ? 'कार्यसम्पादन तथा हिसाब मिलान' : 'Staff Reconciliation'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {lang === 'ne' ? 'कार्यभार, संकलन र हिसाब मिलान' : 'Activity & Cash Handover'}
                        </span>
                      </div>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Consumer Self-Service quick jump */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={() => handleTabClick('customer-lookup')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors cursor-pointer text-xs ${
                currentTab === 'customer-lookup'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-emerald-400 hover:text-white hover:bg-emerald-950/40'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={lang === 'ne' ? 'ग्राहक खोजी (आफ्नो विवरण हेर्नुहोस्)' : 'Consumer Statement Lookup'}
            >
              <Search className="w-4 h-4 shrink-0" />
              {!isSidebarCollapsed && (
                <span>{lang === 'ne' ? 'ग्राहक विवरण खोजी' : 'Consumer Lookup'}</span>
              )}
            </button>
          </div>
        </div>

        {/* Footer info in Sidebar */}
        {!isSidebarCollapsed && (
          <div className="p-3 border-t border-slate-800 text-[10px] text-slate-400 text-center">
            <span>Water Consumer Management v2.4</span>
          </div>
        )}
      </aside>
    </>
  );
};
