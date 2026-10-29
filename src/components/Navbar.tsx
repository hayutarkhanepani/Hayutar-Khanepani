import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Droplets,
  Home,
  Users,
  Receipt,
  CreditCard,
  BarChart3,
  Sliders,
  History,
  LogOut,
  UserCheck,
  Globe,
  Menu,
  X,
  Layers,
  Shield,
  Scale,
  ShieldAlert,
  Search,
  ChevronDown,
  LayoutGrid,
  Settings,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  openAuthModal: (mode: 'login' | 'register' | 'admin') => void;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  openAuthModal,
  onToggleSidebar,
}) => {
  const {
    currentUser,
    userProfile,
    role,
    isSuperAdmin,
    isPermanentSuperAdmin,
    isOtherAdmin,
    isAdmin,
    isBillingStaff,
    isAreaStaff,
    isStaff,
    isCustomer,
    canAccessAdminFeatures,
    canManageSettings,
    logout,
  } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAdminDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleLanguage = () => {
    setLang(lang === 'ne' ? 'en' : 'ne');
  };

  const handleNavClick = (tab: string) => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
    setAdminDropdownOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
      {/* Top emergency / notice ribbon */}
      <div className="bg-sky-900 text-sky-100 text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>
              {lang === 'ne'
                ? 'खानेपानी महसुल संकलन काउन्टर बिहान १०:०० देखि दिउँसो ४:०० बजेसम्म खुला रहन्छ।'
                : 'Water Tariff Collection Counter Open 10:00 AM - 4:00 PM.'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sky-200">
            <span>📞 +977-01-5544332</span>
            <span>📍 {lang === 'ne' ? 'वडा कार्यालय परिसर' : 'Ward Office Complex'}</span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Brand + Admin Sidebar toggle button */}
          <div className="flex items-center gap-2">
            {isStaff && onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200/80 mr-1"
                title={lang === 'ne' ? 'प्रशासनिक मेनु (Admin Sidebar)' : 'Toggle Admin Sidebar'}
              >
                <LayoutGrid className="w-5 h-5 text-sky-700" />
              </button>
            )}
            <div
              onClick={() => handleNavClick('home')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                <Droplets className="w-6 h-6 fill-sky-200" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-base sm:text-lg block leading-tight">
                  {lang === 'ne' ? 'खानेपानी उपभोक्ता समिति' : 'Water Supply Committee'}
                </span>
                <span className="text-xs text-sky-700 font-medium block">
                  {lang === 'ne' ? 'महसुल तथा ग्राहक व्यवस्थापन' : 'Billing & Consumer System'}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => handleNavClick('home')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'home'
                  ? 'bg-sky-50 text-sky-800 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Home className="w-4 h-4" />
              {t('navHome')}
            </button>

            {/* Consumer Self-Service (Permanent Customer Number Only) */}
            <button
              onClick={() => handleNavClick('customer-lookup')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                currentTab === 'customer-lookup'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50/70'
              }`}
            >
              <Search className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'ne' ? 'आफ्नो विवरण हेर्नुहोस्' : 'View Statement'}</span>
            </button>

            {/* Consumer tab */}
            {currentUser && isCustomer && (
              <button
                onClick={() => handleNavClick('my-account')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentTab === 'my-account'
                    ? 'bg-sky-50 text-sky-800 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <UserCheck className="w-4 h-4 text-sky-600" />
                {t('navMyAccount')}
              </button>
            )}

            {/* Staff / Admin Navigation */}
            {isStaff && (
              <>
                <button
                  onClick={() => handleNavClick('households')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentTab === 'households'
                      ? 'bg-sky-50 text-sky-800 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  {t('navHouseholds')}
                </button>

                <button
                  onClick={() => handleNavClick('billing')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentTab === 'billing'
                      ? 'bg-sky-50 text-sky-800 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  {t('navBilling')}
                </button>

                {isBillingStaff && (
                  <button
                    onClick={() => handleNavClick('counter-payment')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentTab === 'counter-payment'
                        ? 'bg-emerald-50 text-emerald-800 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    {t('navCounterPayment')}
                  </button>
                )}

                <button
                  onClick={() => handleNavClick('reports')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentTab === 'reports'
                      ? 'bg-sky-50 text-sky-800 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  {t('navReports')}
                </button>

                {/* Admin specific operational sections */}
                {isAdmin && (
                  <>
                    <button
                      onClick={() => handleNavClick('wards')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        currentTab === 'wards'
                          ? 'bg-sky-50 text-sky-800 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>{lang === 'ne' ? 'वडा/टोल' : 'Wards'}</span>
                    </button>

                    <button
                      onClick={() => handleNavClick('reconciliation')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        currentTab === 'reconciliation'
                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Scale className="w-4 h-4 text-emerald-600" />
                      <span>{lang === 'ne' ? 'वित्तीय मिलान' : 'Reconciliation'}</span>
                    </button>
                  </>
                )}

                {/* Permanent Super Admin exclusive sections */}
                {isSuperAdmin && (
                  <>
                    <button
                      onClick={() => handleNavClick('tariffs')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        currentTab === 'tariffs'
                          ? 'bg-sky-50 text-sky-800 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Sliders className="w-4 h-4" />
                      {t('navTariff')}
                    </button>

                    <button
                      onClick={() => handleNavClick('settings')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        currentTab === 'settings'
                          ? 'bg-sky-50 text-sky-800 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Settings className="w-4 h-4 text-sky-600" />
                      <span>{lang === 'ne' ? 'सेटिङ' : 'Settings'}</span>
                    </button>
                  </>
                )}

                {/* Admin Features (प्रशासनिक सुविधाहरू) Parent Menu: Strictly Permanent Super Admin */}
                {canAccessAdminFeatures && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                        currentTab === 'staff' || currentTab === 'audit' || currentTab === 'security-test' || currentTab === 'payment-tests'
                          ? 'bg-purple-100 text-purple-900 border border-purple-200'
                          : 'text-purple-700 hover:text-purple-900 hover:bg-purple-50'
                      }`}
                    >
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span>{lang === 'ne' ? 'Admin Features (प्रशासनिक)' : 'Admin Features'}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-purple-500" />
                    </button>

                      {adminDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50">
                          <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {lang === 'ne' ? 'Admin Features (प्रशासनिक सुविधाहरू)' : 'Administrative Tools'}
                          </div>

                          {/* 1. कर्मचारी व्यवस्थापन */}
                          <button
                            onClick={() => handleNavClick('staff')}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors cursor-pointer hover:bg-purple-50 ${
                              currentTab === 'staff' ? 'bg-purple-50 text-purple-900 font-bold' : 'text-slate-700'
                            }`}
                          >
                            <UserCheck className="w-4 h-4 text-purple-600 shrink-0" />
                            <div>
                              <div className="font-semibold">{lang === 'ne' ? '१. कर्मचारी व्यवस्थापन' : '1. Staff Management'}</div>
                              <div className="text-[10px] text-slate-400">{lang === 'ne' ? 'कर्मचारी थप, सम्पादन र वडा अनुमति' : 'Roles, wards & activation'}</div>
                            </div>
                          </button>

                          {/* 2. अडिट लग */}
                          <button
                            onClick={() => handleNavClick('audit')}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors cursor-pointer hover:bg-purple-50 ${
                              currentTab === 'audit' ? 'bg-purple-50 text-purple-900 font-bold' : 'text-slate-700'
                            }`}
                          >
                            <History className="w-4 h-4 text-sky-600 shrink-0" />
                            <div>
                              <div className="font-semibold">{lang === 'ne' ? '२. अडिट लग' : '2. Audit Logs'}</div>
                              <div className="text-[10px] text-slate-400">{lang === 'ne' ? 'बिल, भुक्तानी र वित्तीय इतिहास' : 'Immutable event history'}</div>
                            </div>
                          </button>

                          {/* 3. सुरक्षा परीक्षण */}
                          <button
                            onClick={() => handleNavClick('security-test')}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors cursor-pointer hover:bg-purple-50 ${
                              currentTab === 'security-test' || currentTab === 'payment-tests'
                                ? 'bg-purple-50 text-purple-900 font-bold'
                                : 'text-slate-700'
                            }`}
                          >
                            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                            <div>
                              <div className="font-semibold">{lang === 'ne' ? '३. सुरक्षा परीक्षण' : '3. Security Testing'}</div>
                              <div className="text-[10px] text-slate-400">{lang === 'ne' ? 'Auth, Rules र अनधिकृत पहुँच परीक्षण' : 'Auth, rules & RBAC audit'}</div>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                )}
              </>
            )}
          </nav>

          {/* Right actions: Language toggle + Auth buttons */}
          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Switch Language / भाषा परिवर्तन"
            >
              <Globe className="w-3.5 h-3.5 text-sky-600" />
              <span>{lang === 'ne' ? 'English' : 'नेपाली'}</span>
            </button>

            {/* Auth Actions */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800">
                    {userProfile?.displayName || currentUser.email?.split('@')[0]}
                  </div>
                  <span
                    className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isSuperAdmin
                        ? 'bg-purple-100 text-purple-800'
                        : isOtherAdmin
                        ? 'bg-indigo-100 text-indigo-800'
                        : isBillingStaff
                        ? 'bg-emerald-100 text-emerald-800'
                        : isAreaStaff
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {isSuperAdmin
                      ? 'SUPER ADMIN'
                      : isOtherAdmin
                      ? 'ADMIN'
                      : isBillingStaff
                      ? 'BILLING STAFF'
                      : isAreaStaff
                      ? 'AREA STAFF'
                      : 'CONSUMER'}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuthModal('login')}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 transition-colors cursor-pointer"
                >
                  {lang === 'ne' ? 'लगइन (Login)' : 'Login ID'}
                </button>
                <button
                  onClick={() => openAuthModal('register')}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 shadow-xs transition-colors cursor-pointer"
                >
                  {lang === 'ne' ? 'नयाँ खाता (Create ID)' : 'Create ID'}
                </button>
                <button
                  onClick={() => openAuthModal('admin')}
                  className="hidden md:inline-flex px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {lang === 'ne' ? 'प्रशासन (Admin)' : 'Admin'}
                </button>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1">
          <button
            onClick={() => handleNavClick('home')}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <Home className="w-4 h-4" />
            {t('navHome')}
          </button>

          <button
            onClick={() => handleNavClick('customer-lookup')}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-emerald-800 bg-emerald-50 rounded-lg"
          >
            <Search className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'ne' ? 'आफ्नो विवरण हेर्नुहोस् (ग्राहक नं)' : 'View Statement (Customer No)'}</span>
          </button>

          {currentUser && isCustomer && (
            <button
              onClick={() => handleNavClick('my-account')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50 rounded-lg"
            >
              <UserCheck className="w-4 h-4" />
              {t('navMyAccount')}
            </button>
          )}

          {isStaff && (
            <>
              <button
                onClick={() => handleNavClick('households')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <Users className="w-4 h-4" />
                {t('navHouseholds')}
              </button>
              <button
                onClick={() => handleNavClick('billing')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <Receipt className="w-4 h-4" />
                {t('navBilling')}
              </button>
              {isBillingStaff && (
                <button
                  onClick={() => handleNavClick('counter-payment')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg"
                >
                  <CreditCard className="w-4 h-4" />
                  {t('navCounterPayment')}
                </button>
              )}
              <button
                onClick={() => handleNavClick('reports')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <BarChart3 className="w-4 h-4" />
                {t('navReports')}
              </button>
              {/* Admin specific operational items */}
              {isAdmin && (
                <>
                  <button
                    onClick={() => handleNavClick('wards')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Wards & Toles</span>
                  </button>
                  <button
                    onClick={() => handleNavClick('reconciliation')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg"
                  >
                    <Scale className="w-4 h-4" />
                    <span>{lang === 'ne' ? 'वित्तीय मिलान' : 'Reconciliation'}</span>
                  </button>
                </>
              )}

              {/* Permanent Super Admin exclusive items */}
              {isSuperAdmin && (
                <>
                  <button
                    onClick={() => handleNavClick('tariffs')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    <Sliders className="w-4 h-4" />
                    {t('navTariff')}
                  </button>

                  <button
                    onClick={() => handleNavClick('settings')}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg ${
                      currentTab === 'settings'
                        ? 'bg-sky-100 text-sky-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Settings className="w-4 h-4 text-sky-600" />
                    <span>{lang === 'ne' ? 'सेटिङ (Settings)' : 'Settings'}</span>
                  </button>
                </>
              )}

              {/* Admin Features (प्रशासनिक सुविधाहरू) Group in Mobile: Permanent Super Admin ONLY */}
              {canAccessAdminFeatures && (
                <div className="pt-2 pb-1 border-t border-purple-100 mt-2">
                  <div className="px-3 py-1 text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-purple-600" />
                    <span>{lang === 'ne' ? 'Admin Features (प्रशासनिक सुविधाहरू)' : 'Admin Features'}</span>
                  </div>
                  <div className="pl-3 border-l-2 border-purple-200 ml-3 mt-1 space-y-1">
                    <button
                      onClick={() => handleNavClick('staff')}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg ${
                        currentTab === 'staff' ? 'bg-purple-100 text-purple-900' : 'text-slate-700 hover:bg-purple-50'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                      <span>{lang === 'ne' ? '१. कर्मचारी व्यवस्थापन' : '1. Staff Management'}</span>
                    </button>

                    <button
                      onClick={() => handleNavClick('audit')}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg ${
                        currentTab === 'audit' ? 'bg-purple-100 text-purple-900' : 'text-slate-700 hover:bg-purple-50'
                      }`}
                    >
                      <History className="w-3.5 h-3.5 text-sky-600" />
                      <span>{lang === 'ne' ? '२. अडिट लग' : '2. Audit Logs'}</span>
                    </button>

                    <button
                      onClick={() => handleNavClick('security-test')}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg ${
                        currentTab === 'security-test' || currentTab === 'payment-tests'
                          ? 'bg-purple-100 text-purple-900'
                          : 'text-slate-700 hover:bg-purple-50'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      <span>{lang === 'ne' ? '३. सुरक्षा परीक्षण' : '3. Security Testing'}</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {!currentUser && (
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal('login');
                }}
                className="w-full py-2 text-center text-sm font-medium text-sky-700 bg-sky-50 rounded-lg cursor-pointer"
              >
                {lang === 'ne' ? 'लगइन (Login ID)' : 'Login ID'}
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal('register');
                }}
                className="w-full py-2 text-center text-sm font-medium text-white bg-sky-600 rounded-lg cursor-pointer"
              >
                {lang === 'ne' ? 'नयाँ खाता (Create ID)' : 'Create ID'}
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
