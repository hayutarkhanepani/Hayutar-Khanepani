import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { HouseholdManagement } from './components/HouseholdManagement';
import { BillingManagement } from './components/BillingManagement';
import { CounterPaymentModal } from './components/CounterPaymentModal';
import { CustomerDashboard } from './components/CustomerDashboard';
import { ReportsDashboard } from './components/ReportsDashboard';
import { TariffSettings } from './components/TariffSettings';
import { AuditLogViewer } from './components/AuditLogViewer';
import { WardToleManagement } from './components/WardToleManagement';
import { StaffManagement } from './components/StaffManagement';
import { PrintBillModal } from './components/PrintBillModal';
import { PrintReceiptModal } from './components/PrintReceiptModal';
import { PrintConsumerCardModal } from './components/PrintConsumerCardModal';
import { VoucherGeneratorModal } from './components/VoucherGeneratorModal';
import { OnlinePaymentModal } from './components/OnlinePaymentModal';
import { FinancialReconciliation } from './components/FinancialReconciliation';
import { SecurityTesting } from './components/SecurityTesting';
import { CustomerSelfService } from './components/CustomerSelfService';
import { AdminSidebar } from './components/AdminSidebar';
import { AdminSettings } from './components/AdminSettings';
import { StaffActivityReconciliation } from './components/StaffActivityReconciliation';
import {
  Household,
  Bill,
  Payment,
  Voucher,
  Tariff,
  CommitteeSettings,
  WardInfo,
  UserProfile,
  ConsumerCategory,
} from './types';
import {
  getCommitteeSettings,
  getTariffs,
  getHouseholds,
  getBills,
  getPayments,
  getWards,
  saveWard,
  DEFAULT_SETTINGS,
  INITIAL_TARIFFS,
  INITIAL_WARDS,
  saveHousehold,
  generateSingleBill,
  saveTariff,
  updateCommitteeSettings,
  getConsumerCategories,
  getAllUsers,
} from './services/dbService';
import { getCurrentBSMonthYear } from './utils/nepaliCalendar';

const MainApp: React.FC = () => {
  const {
    currentUser,
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
  } = useAuth();
  const { lang, t } = useLanguage();

  // Navigation tab
  const [currentTab, setCurrentTab] = useState<string>('home');

  // Application Data States
  const [settings, setSettings] = useState<CommitteeSettings>(DEFAULT_SETTINGS);
  const [tariffs, setTariffs] = useState<Tariff[]>(INITIAL_TARIFFS);
  const [wards, setWards] = useState<WardInfo[]>(INITIAL_WARDS);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [categories, setCategories] = useState<ConsumerCategory[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Modal States
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    mode: 'login' | 'register' | 'admin';
  }>({ isOpen: false, mode: 'login' });

  const [counterPaymentOpen, setCounterPaymentOpen] = useState(false);
  const [counterPaymentHousehold, setCounterPaymentHousehold] = useState<Household | null>(null);

  const [selectedBillForPrint, setSelectedBillForPrint] = useState<Bill | string | null>(null);
  const [selectedPaymentForPrint, setSelectedPaymentForPrint] = useState<Payment | null>(null);
  const [selectedCardHousehold, setSelectedCardHousehold] = useState<Household | null>(null);
  const [selectedBillForVoucher, setSelectedBillForVoucher] = useState<{
    bill: Bill;
    household: Household;
  } | null>(null);
  const [selectedBillForOnlinePay, setSelectedBillForOnlinePay] = useState<{
    bill: Bill;
    household: Household;
  } | null>(null);

  const [lookupCustomerCode, setLookupCustomerCode] = useState<string>('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Initial seeding if database is freshly provisioned
  const checkAndSeedInitialData = useCallback(async (
    existingHouseholds: Household[],
    existingWards: WardInfo[]
  ) => {
    if (existingHouseholds.length === 0) {
      try {
        console.log('Seeding initial committee households, wards, and fixed tariffs...');
        for (const t of INITIAL_TARIFFS) {
          await saveTariff(t);
        }
        for (const w of INITIAL_WARDS) {
          await saveWard(w);
        }
        await updateCommitteeSettings(DEFAULT_SETTINGS);

        // 5 initial households with fixed monthly charges
        const sampleHouseholds: Household[] = [
          {
            id: 'HHD-001',
            customerCode: 'HYT-00101',
            householdNumber: 'H-101',
            ownerName: 'राम बहादुर थापा (Ram B. Thapa)',
            ward: '1',
            tole: 'बजार टोल (Bazar Tole)',
            address: 'Ward No. 1, Hayutar',
            phoneNumber: '9841234567',
            email: 'ram.thapa@example.com',
            connectionNumber: 'TAP-101',
            meterNumber: 'M-1001',
            monthlyFixedCharge: 150,
            status: 'ACTIVE',
            registrationDate: '2078-01-15',
            connectionDate: '2078-01-15',
            tariffId: 'tariff-domestic',
            openingBalance: 0,
            currentBalance: 180, // 150 + 20 + 10
            createdAt: new Date().toISOString(),
          },
          {
            id: 'HHD-002',
            customerCode: 'HYT-00102',
            householdNumber: 'H-102',
            ownerName: 'सीता देवी श्रेष्ठ (Sita D. Shrestha)',
            ward: '1',
            tole: 'धारापानी (Dharapani)',
            address: 'Ward No. 1, Hayutar',
            phoneNumber: '9851098765',
            email: 'sita.shrestha@example.com',
            connectionNumber: 'TAP-102',
            meterNumber: 'M-1002',
            monthlyFixedCharge: 150,
            status: 'ACTIVE',
            registrationDate: '2078-02-10',
            connectionDate: '2078-02-10',
            tariffId: 'tariff-domestic',
            openingBalance: 0,
            currentBalance: 0,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'HHD-003',
            customerCode: 'HYT-00103',
            householdNumber: 'H-201',
            ownerName: 'हरि प्रसाद न्यौपाने (Hari P. Neupane)',
            ward: '2',
            tole: 'डाँडा गाउँ (Danda Gaun)',
            address: 'Ward No. 2, Hayutar',
            phoneNumber: '9849112233',
            connectionNumber: 'TAP-201',
            meterNumber: 'M-1003',
            monthlyFixedCharge: 150,
            status: 'ACTIVE',
            registrationDate: '2078-04-01',
            connectionDate: '2078-04-01',
            tariffId: 'tariff-domestic',
            openingBalance: 360,
            currentBalance: 540,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'HHD-004',
            customerCode: 'HYT-00104',
            householdNumber: 'H-202',
            ownerName: 'हायुटार मिनी मार्केट (Hayutar Mini Market)',
            ward: '2',
            tole: 'चौतारा (Chautara)',
            address: 'Ward No. 2, Hayutar',
            phoneNumber: '9812345678',
            connectionNumber: 'TAP-COMM-01',
            meterNumber: 'M-2001',
            monthlyFixedCharge: 350,
            status: 'ACTIVE',
            registrationDate: '2079-01-10',
            connectionDate: '2079-01-10',
            tariffId: 'tariff-commercial',
            openingBalance: 0,
            currentBalance: 420,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'HHD-005',
            customerCode: 'HYT-00105',
            householdNumber: 'H-301',
            ownerName: 'श्री जनज्योति आधारभूत विद्यालय (School)',
            ward: '3',
            tole: 'स्कुल डाँडा (School Danda)',
            address: 'Ward No. 3, Hayutar',
            phoneNumber: '015544111',
            connectionNumber: 'TAP-INST-01',
            meterNumber: 'M-3001',
            monthlyFixedCharge: 250,
            status: 'ACTIVE',
            registrationDate: '2076-06-15',
            connectionDate: '2076-06-15',
            tariffId: 'tariff-institutional',
            openingBalance: 0,
            currentBalance: 0,
            createdAt: new Date().toISOString(),
          },
        ];

        for (const h of sampleHouseholds) {
          await saveHousehold(h);
        }

        // Generate initial fixed bill for HHD-001
        const bs = getCurrentBSMonthYear();
        await generateSingleBill({
          household: sampleHouseholds[0],
          tariff: INITIAL_TARIFFS[0],
          billingMonth: bs.monthEn,
          billingYear: bs.year,
          nepaliMonthYear: `${bs.monthNe} ${bs.year}`,
          issueDate: new Date().toISOString().split('T')[0],
          dueDate: `${bs.year}-07-20`,
          settings: DEFAULT_SETTINGS,
        });
      } catch (err) {
        console.warn('Initial seeding notice:', err);
      }
    }
  }, []);

  // Fetch all collections
  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [s, t, w, h, b, p, cats, u] = await Promise.all([
        getCommitteeSettings(),
        getTariffs(),
        getWards(),
        getHouseholds(),
        getBills(),
        getPayments(),
        getConsumerCategories(),
        getAllUsers(),
      ]);

      setSettings(s);
      setTariffs(t);
      setWards(w);
      setHouseholds(h);
      setBills(b);
      setPayments(p);
      setCategories(cats);
      setUsers(u);

      if (h.length === 0) {
        await checkAndSeedInitialData(h, w);
        const [refreshedH, refreshedB, refreshedW] = await Promise.all([
          getHouseholds(),
          getBills(),
          getWards(),
        ]);
        setHouseholds(refreshedH);
        setBills(refreshedB);
        setWards(refreshedW);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [checkAndSeedInitialData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAuthModal = (mode: 'login' | 'register' | 'admin') => {
    setAuthModalState({ isOpen: true, mode });
  };

  const handleOpenCounterPayment = (household?: Household) => {
    setCounterPaymentHousehold(household || null);
    setCounterPaymentOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        openAuthModal={openAuthModal}
        onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />

      {/* Main Content Area with Left Sidebar for Staff / Admin */}
      <div className="flex-1 flex min-h-0">
        {isStaff && (
          <AdminSidebar
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            isOpenMobile={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          />
        )}

        <main className="flex-1 min-w-0 overflow-y-auto">
          {currentTab === 'home' && (
            <LandingPage
              settings={settings}
              tariffs={tariffs}
              openAuthModal={openAuthModal}
              onViewBill={(bill: Bill) => setSelectedBillForPrint(bill)}
              onNavigateToLookup={(code?: string) => {
                if (code) setLookupCustomerCode(code);
                setCurrentTab('customer-lookup');
              }}
            />
          )}

        {currentTab !== 'home' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {currentTab === 'households' && isStaff && (
              <HouseholdManagement
                households={households}
                tariffs={tariffs}
                wards={wards}
                settings={settings}
                onRefresh={loadData}
                onSelectHousehold={(h) => handleOpenCounterPayment(h)}
              />
            )}

            {currentTab === 'billing' && isStaff && (
              <BillingManagement
                bills={bills}
                households={households}
                tariffs={tariffs}
                wards={wards}
                settings={settings}
                payments={payments}
                onRefresh={loadData}
                onViewBill={(bill) => setSelectedBillForPrint(bill)}
              />
            )}

            {currentTab === 'counter-payment' && isBillingStaff && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {lang === 'ne' ? 'काउन्टर महसुल संकलन केन्द्र' : 'Counter Cashier Desk'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {lang === 'ne'
                        ? 'कार्यालय काउन्टरमा नगद, चेक वा बैंक जम्मा मार्फत महसुल भुक्तानी गरी तत्काल आधिकारिक रसिद जारी गर्नुहोस्।'
                        : 'Collect utility payments directly at the cashier desk, generate instant receipts, and update ledger.'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpenCounterPayment()}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
                  >
                    {lang === 'ne' ? 'नयाँ भुक्तानी रसिद काट्नुहोस्' : 'Record New Payment'}
                  </button>
                </div>

                {/* Recent Payments Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-200 font-bold text-xs uppercase text-slate-600">
                    {lang === 'ne' ? 'हालै काटिएका काउन्टर रसिदहरू' : 'Recent Counter Receipts'}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">{t('receiptNumber')}</th>
                          <th className="py-2.5 px-4">{t('customerCode')}</th>
                          <th className="py-2.5 px-4">{t('ownerName')}</th>
                          <th className="py-2.5 px-4">{lang === 'ne' ? 'विधि' : 'Method'}</th>
                          <th className="py-2.5 px-4 text-right">{lang === 'ne' ? 'रकम' : 'Amount'}</th>
                          <th className="py-2.5 px-4">{lang === 'ne' ? 'मिति' : 'Date'}</th>
                          <th className="py-2.5 px-4 text-right">{lang === 'ne' ? 'कार्य' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                              {lang === 'ne' ? 'कुनै रसिद काटिएको छैन।' : 'No payments recorded yet.'}
                            </td>
                          </tr>
                        ) : (
                          payments.slice(0, 15).map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-mono font-bold text-emerald-700">{p.receiptNumber}</td>
                              <td className="py-3 px-4 font-semibold text-slate-800">{p.customerId}</td>
                              <td className="py-3 px-4 text-slate-900">{p.customerName}</td>
                              <td className="py-3 px-4 font-medium">{p.paymentMethod}</td>
                              <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                                {lang === 'ne' ? `रु ${p.amount}` : `NPR ${p.amount}`}
                              </td>
                              <td className="py-3 px-4 text-slate-500">{p.date}</td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => setSelectedPaymentForPrint(p)}
                                  className="px-2.5 py-1 text-[11px] rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold cursor-pointer"
                                >
                                  {t('printReceipt')}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {currentTab === 'reports' && isStaff && (
              <ReportsDashboard
                bills={bills}
                payments={payments}
                households={households}
                users={users}
                categories={categories}
              />
            )}

            {/* Operational Management for All Authorized Admins */}
            {currentTab === 'wards' && isAdmin && (
              <WardToleManagement
                wards={wards}
                households={households}
                onRefresh={loadData}
              />
            )}

            {currentTab === 'reconciliation' && isStaff && (
              <FinancialReconciliation
                payments={payments}
                households={households}
                bills={bills}
                onViewReceipt={(payment) => setSelectedPaymentForPrint(payment)}
              />
            )}

            {/* Permanent Super Admin Only: Tariff Settings */}
            {currentTab === 'tariffs' && isSuperAdmin && (
              <TariffSettings
                tariffs={tariffs}
                settings={settings}
                onRefresh={loadData}
              />
            )}

            {/* Permanent Super Admin Only: System & Committee Settings */}
            {currentTab === 'settings' && isSuperAdmin && (
              <AdminSettings
                settings={settings}
                onRefresh={loadData}
              />
            )}

            {/* Permanent Super Admin Only: Admin Features */}
            {currentTab === 'staff' && canAccessAdminFeatures && (
              <StaffManagement
                wards={wards}
                onRefresh={loadData}
              />
            )}

            {(currentTab === 'security-test' || currentTab === 'payment-tests') && canAccessAdminFeatures && (
              <SecurityTesting />
            )}

            {currentTab === 'audit' && canAccessAdminFeatures && (
              <AuditLogViewer />
            )}

            {currentTab === 'staff-reconciliation' && canAccessAdminFeatures && (
              <StaffActivityReconciliation
                bills={bills}
                payments={payments}
                households={households}
                users={users}
                settings={settings}
                onRefresh={loadData}
                onViewBill={(bill: Bill) => setSelectedBillForPrint(bill)}
                onViewReceipt={(payment: Payment) => setSelectedPaymentForPrint(payment)}
              />
            )}

            {/* Strict Unauthorized Boundary Catch: Direct URL / State Navigation Guard */}
            {['staff', 'audit', 'security-test', 'payment-tests', 'settings', 'tariffs', 'staff-reconciliation'].includes(currentTab) && !isSuperAdmin && (
              <div className="max-w-2xl mx-auto my-12 bg-white rounded-2xl border-2 border-rose-300 shadow-xl overflow-hidden">
                <div className="bg-rose-600 text-white p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <span className="text-2xl">🛑</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">
                      {lang === 'ne' ? 'अनधिकृत पहुँच निषेध (Restricted Access)' : 'Access Denied: Permanent Admin Only'}
                    </h3>
                    <p className="text-xs text-rose-100 mt-0.5">
                      {lang === 'ne'
                        ? 'यो खण्ड स्थायी सुपर एडमिन (Permanent Super Admin) को लागि मात्र सुरक्षित गरिएको छ।'
                        : 'This administrative tool is strictly reserved for the authorized permanent Super Admin.'}
                    </p>
                  </div>
                </div>

                <div className="p-6 space-y-4 text-xs">
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 text-slate-700">
                    <div>
                      <span className="font-semibold text-rose-900">{lang === 'ne' ? 'सुरक्षा नियम:' : 'Security Policy:'}</span>{' '}
                      {lang === 'ne'
                        ? 'कर्मचारी व्यवस्थापन, अडिट लग, सुरक्षा परीक्षण र प्रणाली सेटिङ केवल अधिकृत इमेल hayutarkhanepani@gmail.com बाट मात्र खोल्न सकिन्छ।'
                        : 'Staff Management, Audit Logs, Security Testing, and Admin Settings are strictly restricted to hayutarkhanepani@gmail.com.'}
                    </div>
                    <div>
                      <span className="font-semibold">{lang === 'ne' ? 'तपाईंको इमेल:' : 'Your Email:'}</span>{' '}
                      <span className="font-mono text-slate-800">{currentUser?.email || 'Not logged in'}</span>
                    </div>
                    <div>
                      <span className="font-semibold">{lang === 'ne' ? 'तपाईंको भूमिका:' : 'Your Role:'}</span>{' '}
                      <span className="font-bold text-slate-800">
                        {isOtherAdmin ? 'ADMIN (प्रशासक - दैनिक कार्य सञ्चालन)' : isBillingStaff ? 'BILLING STAFF' : isAreaStaff ? 'AREA STAFF' : 'CONSUMER'}
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-600 leading-relaxed">
                    {lang === 'ne'
                      ? 'तपाईंलाई दैनिक ग्राहक व्यवस्थापन, बिलिङ, काउन्टर भुक्तानी, वित्तीय मिलान र प्रतिवेदन हेर्ने अधिकार प्राप्त छ। कृपया आफ्नो तोकिएको कार्यक्षेत्रमा फर्कनुहोस्।'
                      : 'You are authorized for daily consumer management, billing, cashier counter, and financial reports. Please return to your designated workspace.'}
                  </p>

                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      onClick={() => setCurrentTab('home')}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer transition-colors"
                    >
                      {lang === 'ne' ? 'गृहपृष्ठ / ड्यासबोर्डमा फर्कनुहोस्' : 'Return to Dashboard'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentTab === 'customer-lookup' && (
              <CustomerSelfService
                bills={bills}
                payments={payments}
                settings={settings}
                onViewBill={(bill) => setSelectedBillForPrint(bill)}
                onViewReceipt={(payment) => setSelectedPaymentForPrint(payment)}
                onViewCard={(household) => setSelectedCardHousehold(household)}
                initialCustomerCode={lookupCustomerCode}
                onOpenRegister={() => setAuthModalState({ isOpen: true, mode: 'register' })}
              />
            )}

            {currentTab === 'my-account' && (
              <CustomerDashboard
                bills={bills}
                payments={payments}
                vouchers={vouchers}
                settings={settings}
                onViewBill={(bill) => setSelectedBillForPrint(bill)}
                onViewReceipt={(payment) => setSelectedPaymentForPrint(payment)}
                onViewCard={(household) => setSelectedCardHousehold(household)}
                onGenerateVoucher={(bill, household) =>
                  setSelectedBillForVoucher({ bill, household })
                }
                onPayOnline={(bill, household) =>
                  setSelectedBillForOnlinePay({ bill, household })
                }
                onRefresh={loadData}
              />
            )}
          </div>
        )}
      </main>
      </div>

      {/* Global Modals */}
      <AuthModal
        isOpen={authModalState.isOpen}
        initialMode={authModalState.mode}
        onClose={() => setAuthModalState({ isOpen: false, mode: 'login' })}
      />

      <CounterPaymentModal
        isOpen={counterPaymentOpen}
        onClose={() => {
          setCounterPaymentOpen(false);
          setCounterPaymentHousehold(null);
        }}
        households={households}
        bills={bills}
        preSelectedHousehold={counterPaymentHousehold}
        onPaymentSuccess={(payment) => {
          loadData();
          setSelectedPaymentForPrint(payment);
        }}
      />

      <PrintConsumerCardModal
        household={selectedCardHousehold}
        settings={settings}
        onClose={() => setSelectedCardHousehold(null)}
      />

      <PrintBillModal
        bill={typeof selectedBillForPrint === 'object' ? selectedBillForPrint : null}
        billId={typeof selectedBillForPrint === 'string' ? selectedBillForPrint : selectedBillForPrint?.id}
        settings={settings}
        households={households}
        onClose={() => setSelectedBillForPrint(null)}
      />

      <PrintReceiptModal
        payment={selectedPaymentForPrint}
        settings={settings}
        households={households}
        onClose={() => setSelectedPaymentForPrint(null)}
      />

      {selectedBillForVoucher && (
        <VoucherGeneratorModal
          bill={selectedBillForVoucher.bill}
          household={selectedBillForVoucher.household}
          settings={settings}
          onClose={() => setSelectedBillForVoucher(null)}
        />
      )}

      {selectedBillForOnlinePay && (
        <OnlinePaymentModal
          bill={selectedBillForOnlinePay.bill}
          household={selectedBillForOnlinePay.household}
          settings={settings}
          isOpen={Boolean(selectedBillForOnlinePay)}
          onClose={() => setSelectedBillForOnlinePay(null)}
          onPaymentSuccess={(payment) => {
            loadData();
            setSelectedPaymentForPrint(payment);
          }}
          onNavigateToSettings={() => setCurrentTab('tariffs')}
          onSwitchToVoucher={() => {
            const item = selectedBillForOnlinePay;
            setSelectedBillForOnlinePay(null);
            if (item) {
              setSelectedBillForVoucher(item);
            }
          }}
          householdPayments={payments.filter(
            (p) => p.customerId === selectedBillForOnlinePay.household.customerCode
          )}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </LanguageProvider>
  );
}
