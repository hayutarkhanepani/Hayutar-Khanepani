import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Bill, Household, Payment, CommitteeSettings } from '../types';
import { formatNPR, toNepaliNumerals } from '../utils/nepaliCalendar';
import { getHouseholdByCustomerCode } from '../services/dbService';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Printer,
  ShieldCheck,
  CreditCard,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  Droplets,
  Lock,
  Clock,
  Sparkles,
  Info,
  Bell,
} from 'lucide-react';

interface CustomerSelfServiceProps {
  bills: Bill[];
  payments: Payment[];
  settings: CommitteeSettings;
  onViewBill: (bill: Bill) => void;
  onViewReceipt: (payment: Payment) => void;
  onViewCard: (household: Household) => void;
  initialCustomerCode?: string;
  onOpenRegister?: () => void;
}

export const CustomerSelfService: React.FC<CustomerSelfServiceProps> = ({
  bills,
  payments,
  settings,
  onViewBill,
  onViewReceipt,
  onViewCard,
  initialCustomerCode = '',
  onOpenRegister,
}) => {
  const { lang, t } = useLanguage();

  const [customerCodeInput, setCustomerCodeInput] = useState(initialCustomerCode);
  const [loading, setLoading] = useState(false);
  const [searchedHousehold, setSearchedHousehold] = useState<Household | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'bills' | 'receipts'>('bills');

  // Privacy helper: Mask phone number (e.g. 9841***321)
  const maskPhone = (phone?: string) => {
    if (!phone || phone.length < 5) return '****';
    const clean = phone.replace(/\s+/g, '');
    if (clean.length <= 6) return clean.slice(0, 2) + '***';
    return clean.slice(0, 4) + '***' + clean.slice(-3);
  };

  // Privacy helper: Mask email (e.g. r***@gmail.com)
  const maskEmail = (email?: string) => {
    if (!email || !email.includes('@')) return '';
    const [user, domain] = email.split('@');
    if (user.length <= 2) return user.slice(0, 1) + '***@' + domain;
    return user.slice(0, 2) + '***@' + domain;
  };

  // Format customer code cleanly
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = customerCodeInput.trim().toUpperCase();

    if (!code) {
      setErrorMessage(
        lang === 'ne'
          ? 'कृपया आफ्नो स्थायी ग्राहक नम्बर प्रविष्ट गर्नुहोस्।'
          : 'Please enter your Permanent Customer Number.'
      );
      setSearchedHousehold(null);
      return;
    }

    if (code.length < 2) {
      setErrorMessage(
        lang === 'ne'
          ? 'ग्राहक नम्बर कम्तीमा २ अक्षरको हुनुपर्छ (जस्तै: HYT-00101 वा 101)।'
          : 'Customer number must be at least 2 characters (e.g., HYT-00101 or 101).'
      );
      setSearchedHousehold(null);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const h = await getHouseholdByCustomerCode(code);
      if (!h) {
        setErrorMessage(
          lang === 'ne'
            ? `उक्त स्थायी ग्राहक नम्बर "${code}" प्रणालीमा फेला परेन। कृपया आफ्नो ग्राहक कोड (जस्तै: HYT-00101) पुनः जाँच गर्नुहोस् वा समितिको कार्यालयमा सम्पर्क गर्नुहोस्।`
            : `No consumer record found for Permanent Code "${code}". Please verify your Customer Code (e.g. HYT-00101) or contact the committee office.`
        );
        setSearchedHousehold(null);
      } else {
        setSearchedHousehold(h);
      }
    } catch (err: any) {
      console.error('Customer lookup error:', err);
      setErrorMessage(
        lang === 'ne'
          ? 'रेकर्ड खोजी गर्दा समस्या देखियो। कृपया केही समयपछि पुनः प्रयास गर्नुहोस्।'
          : 'Error looking up customer record. Please try again.'
      );
      setSearchedHousehold(null);
    } finally {
      setLoading(false);
    }
  };

  // Related bills for this consumer
  const consumerBills = useMemo(() => {
    if (!searchedHousehold) return [];
    return bills.filter(
      (b) =>
        b.customerId.toUpperCase() === searchedHousehold.customerCode.toUpperCase() ||
        (b.householdNumber && b.householdNumber === searchedHousehold.householdNumber)
    );
  }, [bills, searchedHousehold]);

  // Related payments/receipts for this consumer
  const consumerPayments = useMemo(() => {
    if (!searchedHousehold) return [];
    return payments.filter(
      (p) =>
        p.customerId.toUpperCase() === searchedHousehold.customerCode.toUpperCase() ||
        (p.householdId && p.householdId === searchedHousehold.id)
    );
  }, [payments, searchedHousehold]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Public Announcement Banner */}
      {settings.publicNoticeActive && settings.publicNotice && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm ${
            settings.publicNoticeType === 'urgent'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : settings.publicNoticeType === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-sky-50 border-sky-300 text-sky-950'
          }`}
        >
          <Bell
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              settings.publicNoticeType === 'urgent'
                ? 'text-rose-600'
                : settings.publicNoticeType === 'warning'
                ? 'text-amber-600'
                : 'text-sky-600'
            }`}
          />
          <div className="text-xs sm:text-sm font-semibold leading-relaxed">
            <span className="font-bold mr-2 uppercase tracking-wide">
              {lang === 'ne' ? 'सार्वजनिक सूचना:' : 'Notice:'}
            </span>
            {settings.publicNotice}
          </div>
        </div>
      )}

      {/* Top Banner Card: Customer Self Service Header */}
      <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-blue-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-700/60 border border-sky-400/30 text-sky-200 text-xs font-semibold backdrop-blur">
            <Droplets className="w-3.5 h-3.5 text-sky-300" />
            <span>{lang === 'ne' ? 'खानेपानी ग्राहक स्व-सेवा पोर्टल' : 'Consumer Self-Service Portal'}</span>
            <span>•</span>
            <span>{settings.committeeNameNepali || 'खानेपानी उपभोक्ता समिति'}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-heading">
            {lang === 'ne' ? 'आफ्नो विवरण हेर्नुहोस्' : 'View Consumer Statement & Bills'}
          </h2>

          <p className="text-xs sm:text-sm text-sky-100 max-w-2xl leading-relaxed">
            {lang === 'ne'
              ? 'यहाँ कुनै फोन नम्बर वा पासवर्ड आवश्यक छैन। आफ्नो स्थायी ग्राहक नम्बर (Consumer Code) प्रविष्ट गरी महसुल बिल, काउन्टर रसिद तथा बाँकी बक्यौता तुरुन्तै हेर्नुहोस्।'
              : 'No password or mandatory phone required. Enter your permanent Customer Code to view your monthly bills, payment receipts, and balance.'}
          </p>

          {/* Simple Search Form */}
          <form onSubmit={handleSearch} className="pt-2 flex flex-col sm:flex-row gap-2 max-w-xl">
            <div className="relative flex-1">
              <label htmlFor="customerCodeInput" className="sr-only">
                {lang === 'ne' ? 'स्थायी ग्राहक नं.' : 'Permanent Customer Code'}
              </label>
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4 text-sky-600" />
              </div>
              <input
                id="customerCodeInput"
                type="text"
                value={customerCodeInput}
                onChange={(e) => setCustomerCodeInput(e.target.value)}
                placeholder={lang === 'ne' ? 'स्थायी ग्राहक नं. (जस्तै: HYT-00101)' : 'Permanent Customer No. (e.g. HYT-00101)'}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white text-slate-900 text-sm font-mono font-bold uppercase placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 hover:scale-101"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>{lang === 'ne' ? 'खोज्दै...' : 'Searching...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{lang === 'ne' ? 'विवरण हेर्नुहोस्' : 'View Statement'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Helpful Not Found or Error Alert */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl text-rose-800 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block text-sm">
                {lang === 'ne' ? 'ग्राहक फेला परेन' : 'Record Not Found'}
              </span>
              <p className="leading-relaxed">{errorMessage}</p>
              <div className="pt-1 text-[11px] text-rose-600 flex items-center gap-3">
                <span>कार्यालय सम्पर्क: {settings.phone || '०१-५५५००००'}</span>
                <span>•</span>
                <span>इमेल: {settings.email || 'support@khanepani.gov.np'}</span>
              </div>
            </div>
          </div>
          {onOpenRegister && (
            <button
              onClick={onOpenRegister}
              className="shrink-0 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {lang === 'ne' ? 'नयाँ खाता खोल्नुहोस्' : 'Create ID / Apply'}
            </button>
          )}
        </div>
      )}

      {/* Quick link banner for new consumers who don't have an ID yet */}
      {!searchedHousehold && onOpenRegister && (
        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                {lang === 'ne' ? 'नयाँ धारा जडान वा अनलाइन ग्राहक खाता छैन?' : 'New Tap Connection or Need an Online ID?'}
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                {lang === 'ne'
                  ? 'घरको धारा जडान गर्न वा आफ्नो स्थायी ग्राहक नं. अनलाइनमा जोड्न आवेदन दिनुहोस्।'
                  : 'Apply for a new water tap or link your existing household to an online account.'}
              </p>
            </div>
          </div>
          <button
            onClick={onOpenRegister}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5"
          >
            <span>{lang === 'ne' ? 'नयाँ खाता (Create ID)' : 'Create ID / Register'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Consumer Approved Statement Display */}
      {searchedHousehold && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Consumer Information Card with Privacy Protection */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xl shadow-xs">
                  <UserCheck className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-extrabold text-slate-900">
                      {searchedHousehold.ownerName}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        searchedHousehold.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {searchedHousehold.status === 'ACTIVE'
                        ? (lang === 'ne' ? 'सक्रिय धारा (ACTIVE)' : 'ACTIVE')
                        : (lang === 'ne' ? 'निष्क्रिय धारा (INACTIVE)' : 'INACTIVE')}
                    </span>
                    {searchedHousehold.category && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                        {searchedHousehold.category}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-3">
                    <span className="font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      {lang === 'ne' ? 'स्थायी ग्राहक नं:' : 'Customer Code:'} {searchedHousehold.customerCode}
                    </span>
                    <span>
                      {lang === 'ne' ? 'घर नं:' : 'House No:'} {searchedHousehold.householdNumber}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ward {searchedHousehold.ward}{searchedHousehold.tole ? `, ${searchedHousehold.tole}` : ''}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action: Print Consumer Card */}
              <button
                type="button"
                onClick={() => onViewCard(searchedHousehold)}
                className="px-4 py-2.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
              >
                <Printer className="w-4 h-4 text-sky-600" />
                <span>{lang === 'ne' ? 'उपभोक्ता कार्ड प्रिन्ट' : 'Print Consumer Card'}</span>
              </button>
            </div>

            {/* Approved Details & Outstanding Balance Ribbon */}
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Outstanding Balance */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border-2 border-amber-300">
                <span className="text-xs text-amber-900 font-semibold block">
                  {lang === 'ne' ? 'हाल तिर्न बाँकी बक्यौता' : 'Current Balance Due'}
                </span>
                <span className={`text-2xl font-black mt-1 block ${searchedHousehold.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  रु {Number(searchedHousehold.currentBalance || 0).toLocaleString()}
                </span>
                <span className="text-[11px] text-amber-800 mt-1 block">
                  {searchedHousehold.currentBalance > 0
                    ? (lang === 'ne' ? 'कार्यालय काउन्टरमा भुक्तानी गर्नुहोस्' : 'Payable at office cashier desk')
                    : (lang === 'ne' ? 'कुनै बक्यौता बाँकी छैन (सफा)' : 'No outstanding dues')}
                </span>
              </div>

              {/* Fixed Monthly Fee */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 font-semibold block">
                  {lang === 'ne' ? 'मासिक तोकिएको महसुल' : 'Fixed Monthly Charge'}
                </span>
                <span className="text-xl font-bold text-slate-800 mt-1 block">
                  रु {searchedHousehold.monthlyFixedCharge || settings.standardMonthlyCharge || 150} / महिना
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {lang === 'ne' ? 'धारा/मीटर नं:' : 'Connection/Meter No:'} {searchedHousehold.meterNumber || searchedHousehold.connectionNumber || 'दर्ता छ'}
                </span>
              </div>

              {/* Privacy Masked Contact */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{lang === 'ne' ? 'सुरक्षित सम्पर्क (गोप्य)' : 'Privacy Masked Contact'}</span>
                </div>
                <div className="text-xs text-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{maskPhone(searchedHousehold.phoneNumber)}</span>
                  </div>
                  {searchedHousehold.email && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span className="truncate">{maskEmail(searchedHousehold.email)}</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {lang === 'ne' ? 'गोपनीयताका लागि सम्पर्क नम्बर मास्क गरिएको' : 'Masked for personal data protection'}
                </span>
              </div>

              {/* Total Bills & Payments */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 font-semibold block">
                  {lang === 'ne' ? 'कुल जारी बिल तथा रसिद' : 'Recorded Bills & Receipts'}
                </span>
                <div className="text-xs font-bold text-slate-800 mt-1 space-y-0.5">
                  <div>{lang === 'ne' ? 'जारी बिल:' : 'Bills:'} {toNepaliNumerals(consumerBills.length)} वटा</div>
                  <div>{lang === 'ne' ? 'काउन्टर रसिद:' : 'Receipts:'} {toNepaliNumerals(consumerPayments.length)} वटा</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bills vs Receipts Tabbed Tables */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('bills')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeSubTab === 'bills'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span>
                    {lang === 'ne' ? 'महसुल बिलहरू' : 'Utility Bills'} ({toNepaliNumerals(consumerBills.length)})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('receipts')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeSubTab === 'receipts'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {lang === 'ne' ? 'भुक्तानी रसिदहरू' : 'Payment Receipts'} ({toNepaliNumerals(consumerPayments.length)})
                  </span>
                </button>
              </div>

              <span className="text-[11px] text-slate-400 hidden sm:inline">
                {lang === 'ne' ? 'आधिकारिक काउन्टर अभिलेख' : 'Official Counter Records'}
              </span>
            </div>

            {/* Sub Tab: Bills */}
            {activeSubTab === 'bills' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">{t('billNumber')}</th>
                      <th className="py-3 px-4">{t('billingPeriod')}</th>
                      <th className="py-3 px-4 text-right">Fixed Fee</th>
                      <th className="py-3 px-4 text-right">Prev Balance</th>
                      <th className="py-3 px-4 text-right">{t('totalDue')}</th>
                      <th className="py-3 px-4 text-right">{t('paidAmount')}</th>
                      <th className="py-3 px-4 text-right">{t('balanceDue')}</th>
                      <th className="py-3 px-4 text-center">{t('status')}</th>
                      <th className="py-3 px-4 text-right">{lang === 'ne' ? 'कार्य' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consumerBills.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500 italic">
                          {lang === 'ne' ? 'यो ग्राहक नम्बरमा कुनै बिल फेला परेन।' : 'No bills issued for this customer code.'}
                        </td>
                      </tr>
                    ) : (
                      consumerBills.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-sky-700">{b.billNumber}</td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {lang === 'ne' ? b.nepaliMonthYear : `${b.billingMonth} ${b.billingYear}`}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-700">रु {b.monthlyCharge || 150}</td>
                          <td className="py-3 px-4 text-right text-slate-500">रु {b.previousBalance || 0}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">रु {b.totalAmount}</td>
                          <td className="py-3 px-4 text-right font-semibold text-emerald-600">रु {b.paidAmount || 0}</td>
                          <td className={`py-3 px-4 text-right font-black ${b.balanceDue > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                            रु {b.balanceDue || 0}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                b.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : b.status === 'PARTIALLY_PAID'
                                  ? 'bg-amber-100 text-amber-800'
                                  : b.status === 'CANCELLED'
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => onViewBill(b)}
                              className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>{lang === 'ne' ? 'बिल हेर्नुहोस्' : 'View Bill'}</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sub Tab: Receipts */}
            {activeSubTab === 'receipts' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">{t('receiptNumber')}</th>
                      <th className="py-3 px-4">{lang === 'ne' ? 'भुक्तानी मिति' : 'Payment Date'}</th>
                      <th className="py-3 px-4">{lang === 'ne' ? 'भुक्तानी विधि' : 'Payment Method'}</th>
                      <th className="py-3 px-4 text-right">{lang === 'ne' ? 'रकम' : 'Amount'}</th>
                      <th className="py-3 px-4 text-center">{t('status')}</th>
                      <th className="py-3 px-4 text-right">{lang === 'ne' ? 'कार्य' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consumerPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                          {lang === 'ne' ? 'यो ग्राहक नम्बरमा कुनै भुक्तानी रसिद फेला परेन।' : 'No payment receipts found for this customer.'}
                        </td>
                      </tr>
                    ) : (
                      consumerPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-emerald-700">{p.receiptNumber}</td>
                          <td className="py-3 px-4 text-slate-700">{p.date}</td>
                          <td className="py-3 px-4 font-medium text-slate-800">{p.paymentMethod}</td>
                          <td className="py-3 px-4 text-right font-extrabold text-emerald-700">रु {p.amount}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              {p.status || 'COMPLETED'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => onViewReceipt(p)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>{lang === 'ne' ? 'रसिद प्रिन्ट' : 'Print Receipt'}</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
