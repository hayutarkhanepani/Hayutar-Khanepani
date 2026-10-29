import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Bill, Household, Payment, CommitteeSettings, Voucher } from '../types';
import { formatNPR, toNepaliNumerals } from '../utils/nepaliCalendar';
import { saveHousehold } from '../services/dbService';
import {
  UserCheck,
  Receipt,
  CreditCard,
  FileCheck,
  AlertCircle,
  Printer,
  Calendar,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  Edit2,
  Check,
  History,
  Bell,
} from 'lucide-react';

interface CustomerDashboardProps {
  bills: Bill[];
  payments: Payment[];
  vouchers: Voucher[];
  settings: CommitteeSettings;
  onViewBill: (bill: Bill) => void;
  onViewReceipt: (payment: Payment) => void;
  onViewCard: (household: Household) => void;
  onGenerateVoucher?: (bill: Bill, household: Household) => void;
  onPayOnline?: (bill: Bill, household: Household) => void;
  onRefresh: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  bills,
  payments,
  vouchers,
  settings,
  onViewBill,
  onViewReceipt,
  onViewCard,
  onGenerateVoucher,
  onPayOnline,
  onRefresh,
}) => {
  const { currentUser, userProfile, linkedHousehold, linkCustomerHousehold } = useAuth();
  const { lang, t } = useLanguage();

  // Linking form state
  const [linkCustomerCode, setLinkCustomerCode] = useState('');
  const [linkPhone, setLinkPhone] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkMessage, setLinkMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Contact edit state
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editPhone, setEditPhone] = useState(linkedHousehold?.phoneNumber || '');
  const [editEmail, setEditEmail] = useState(linkedHousehold?.email || '');
  const [contactSaving, setContactSaving] = useState(false);

  // Month filter for consumer bills
  const [filterYear, setFilterYear] = useState('ALL');

  const customerBills = useMemo(() => {
    if (!linkedHousehold) return [];
    return bills.filter((b) => b.customerId === linkedHousehold.customerCode);
  }, [bills, linkedHousehold]);

  const customerPayments = useMemo(() => {
    if (!linkedHousehold) return [];
    return payments.filter((p) => p.customerId === linkedHousehold.customerCode);
  }, [payments, linkedHousehold]);

  // Current active unpaid bill
  const currentUnpaidBill = useMemo(() => {
    return customerBills.find((b) => b.status === 'UNPAID' || b.status === 'PARTIALLY_PAID' || b.status === 'OVERDUE');
  }, [customerBills]);

  const handleLinkHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkLoading(true);
    setLinkMessage(null);

    const res = await linkCustomerHousehold(linkCustomerCode.trim().toUpperCase(), linkPhone.trim());
    setLinkMessage({ text: res.message, isError: !res.success });
    setLinkLoading(false);
    if (res.success) {
      onRefresh();
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedHousehold) return;
    setContactSaving(true);
    try {
      await saveHousehold({
        ...linkedHousehold,
        phoneNumber: editPhone.trim(),
        email: editEmail.trim(),
      });
      setIsEditingContact(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setContactSaving(false);
    }
  };

  return (
    <div className="space-y-6">
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
              {lang === 'ne' ? 'समितिको सार्वजनिक सूचना:' : 'Notice:'}
            </span>
            {settings.publicNotice}
          </div>
        </div>
      )}

      {/* If household is not linked yet */}
      {!linkedHousehold && (
        <div className="bg-white p-6 rounded-2xl border-2 border-amber-300 shadow-sm max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {lang === 'ne' ? 'आफ्नो विवरण हेर्नुहोस् (धारा खाता जोड्नुहोस्)' : 'View Consumer Statement & Link Account'}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'ne'
                  ? 'आफ्नो स्थायी ग्राहक नम्बर (Consumer Code) प्रविष्ट गरी खाताको विवरण, बिल तथा बक्यौता हेर्नुहोस्।'
                  : 'Enter your Permanent Customer Code to view your statement and access your bills.'}
              </p>
            </div>
          </div>

          {linkMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                linkMessage.isError
                  ? 'bg-rose-50 border border-rose-200 text-rose-700'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}
            >
              {linkMessage.isError ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{linkMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleLinkHousehold} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                {lang === 'ne' ? 'स्थायी ग्राहक नं. (Permanent Customer Code) *' : 'Permanent Customer Code *'}
              </label>
              <input
                type="text"
                required
                value={linkCustomerCode}
                onChange={(e) => setLinkCustomerCode(e.target.value)}
                placeholder="e.g. HYT-00101"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {lang === 'ne' ? 'मोबाइल नम्बर (वैकल्पिक / Optional)' : 'Mobile Number (Optional)'}
              </label>
              <input
                type="text"
                value={linkPhone}
                onChange={(e) => setLinkPhone(e.target.value)}
                placeholder="98XXXXXXXX"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {lang === 'ne' ? 'नोट: ग्राहक नम्बर मात्र प्रविष्ट गर्दा पनि खाता जोड्न सकिन्छ।' : 'Phone number is not required for customer lookup.'}
              </span>
            </div>

            <button
              type="submit"
              disabled={linkLoading}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {linkLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>{lang === 'ne' ? 'घरधुरी प्रमाणित गरी जोड्नुहोस्' : 'Verify & Link Household'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* When household is linked */}
      {linkedHousehold && (
        <>
          {/* Consumer Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Household Identity Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-mono">
                  {linkedHousehold.customerCode}
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    linkedHousehold.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {linkedHousehold.status}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">{linkedHousehold.ownerName}</h3>
                <p className="text-xs text-slate-500">
                  {t('householdNumber')}: {linkedHousehold.householdNumber} • {lang === 'ne' ? `वडा नं ${toNepaliNumerals(linkedHousehold.ward)}` : `Ward ${linkedHousehold.ward}`}, {linkedHousehold.tole}
                </p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {lang === 'ne' ? 'धारा दर्ता नं:' : 'Connection No:'} {linkedHousehold.connectionNumber || 'N/A'} • {lang === 'ne' ? 'मिटर नं:' : 'Meter No:'} {linkedHousehold.meterNumber || 'N/A'}
                </p>
              </div>

              {/* Contact info with quick edit */}
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
                {!isEditingContact ? (
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{linkedHousehold.phoneNumber}</span>
                      </div>
                      {linkedHousehold.email && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{linkedHousehold.email}</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setEditPhone(linkedHousehold.phoneNumber);
                        setEditEmail(linkedHousehold.email || '');
                        setIsEditingContact(true);
                      }}
                      className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{lang === 'ne' ? 'परिवर्तन' : 'Update'}</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSaveContact} className="space-y-2">
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Phone"
                      className="w-full px-2 py-1 text-xs rounded border border-slate-300"
                    />
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full px-2 py-1 text-xs rounded border border-slate-300"
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingContact(false)}
                        className="px-2 py-0.5 text-[10px] text-slate-600 rounded border border-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={contactSaving}
                        className="px-2 py-0.5 text-[10px] bg-sky-600 text-white rounded font-medium"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Total Balance & Due Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">
                  {lang === 'ne' ? 'कुल बाँकी बक्यौता रकम' : 'Total Outstanding Balance'}
                </span>
                <div
                  className={`text-3xl font-black mt-2 ${
                    linkedHousehold.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {formatNPR(linkedHousehold.currentBalance, lang)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {linkedHousehold.currentBalance > 0
                    ? (lang === 'ne' ? 'कृपया समयमै महसुल बुझाई जरिवानाबाट बच्नुहोस्।' : 'Please clear dues before due date to avoid penalty.')
                    : (lang === 'ne' ? 'सबै महसुल चुक्ता भएको छ। धन्यवाद!' : 'All dues cleared. Thank you!')}
                </p>
              </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => onViewCard(linkedHousehold)}
                    className="flex-1 py-2 text-center text-xs font-semibold rounded-xl bg-sky-700 hover:bg-sky-800 text-white shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{lang === 'ne' ? 'उपभोक्ता कार्ड हेर्नुहोस् (Card)' : 'View Consumer Card'}</span>
                  </button>
                </div>
              </div>

            {/* Current Month Bill Preview */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">
                  {lang === 'ne' ? 'हालको महिनाको बिल' : 'Latest Bill'}
                </span>
                {currentUnpaidBill ? (
                  <div className="mt-2 space-y-1">
                    <div className="text-base font-bold text-slate-900">
                      {lang === 'ne' ? currentUnpaidBill.nepaliMonthYear : `${currentUnpaidBill.billingMonth} ${currentUnpaidBill.billingYear}`}
                    </div>
                    <div className="text-xs text-slate-600">
                      {lang === 'ne' ? 'खपत:' : 'Units:'} {toNepaliNumerals(currentUnpaidBill.unitsConsumed ?? 0)} units • {lang === 'ne' ? 'रकम:' : 'Amount:'} {formatNPR(currentUnpaidBill.totalAmount, lang)}
                    </div>
                    <div className="text-[11px] text-rose-600 font-semibold">
                      {t('dueDate')}: {currentUnpaidBill.dueDate}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-xs text-slate-500 italic">
                    {lang === 'ne' ? 'कुनै बुझाउन बाँकी बिल छैन।' : 'No pending unpaid bills for this period.'}
                  </div>
                )}
              </div>

              {currentUnpaidBill && (
                <button
                  onClick={() => onViewBill(currentUnpaidBill)}
                  className="w-full py-2 text-center text-xs font-semibold rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t('printBill')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Consumer Service & Counter Information Banner */}
          <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-blue-900 rounded-2xl p-5 text-white shadow-md">
            <div className="text-xs font-bold text-sky-300 uppercase tracking-wider mb-3">
              {lang === 'ne' ? 'उपभोक्ता सेवा तथा काउन्टर भुक्तानी जानकारी' : 'Consumer Services & Counter Collection'}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Option 1: Official Consumer Card */}
              <button
                type="button"
                onClick={() => onViewCard(linkedHousehold)}
                className="bg-white/10 hover:bg-white/20 border border-white/20 p-4 rounded-xl text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 font-bold text-sm text-sky-200">
                  <CreditCard className="w-4 h-4 text-sky-300" />
                  <span>१. {lang === 'ne' ? 'उपभोक्ता परिचय पत्र (ID Card)' : '1. Consumer Identity Card'}</span>
                </div>
                <p className="text-[11px] text-sky-100 mt-1 leading-relaxed">
                  {lang === 'ne'
                    ? 'स्थायी ग्राहक नम्बर सहितको आधिकारिक परिचय पत्र हेर्नुहोस् र प्रिन्ट गर्नुहोस्।'
                    : 'View and print your official consumer card with permanent customer code.'}
                </p>
                <div className="mt-3 text-xs font-semibold text-sky-300 flex items-center gap-1">
                  <span>{lang === 'ne' ? 'कार्ड डाउनलोड / प्रिन्ट' : 'Print Consumer Card'}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>

              {/* Option 2: Office Cashier Info */}
              <div className="bg-white/10 border border-white/20 p-4 rounded-xl text-left">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                  <Clock className="w-4 h-4" />
                  <span>२. {lang === 'ne' ? 'कार्यालय काउन्टर भुक्तानी' : '2. Office Counter Payment'}</span>
                </div>
                <p className="text-[11px] text-sky-100 mt-1 leading-relaxed">
                  {lang === 'ne'
                    ? 'कार्यालय काउन्टरमा नगद, चेक वा बैंक जम्मा भौचर बुझाई आधिकारिक रसिद प्राप्त गर्नुहोस्। समय: बिहान १० देखि ४ बजेसम्म।'
                    : 'Pay dues in-person at the office counter via Cash, Cheque, or Bank Deposit for an official receipt.'}
                </p>
                <div className="mt-2 text-[10px] text-emerald-300 font-semibold">
                  {lang === 'ne' ? '📍 वडा कार्यालय भवन, हायुटार' : '📍 Ward Office Complex, Hayutar'}
                </div>
              </div>

              {/* Option 3: View Payment History */}
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('consumer-receipts-archive');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-white/10 hover:bg-white/20 border border-white/20 p-4 rounded-xl text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 font-bold text-sm text-amber-200">
                  <History className="w-4 h-4" />
                  <span>३. {lang === 'ne' ? 'रसिद अभिलेख तथा इतिहास' : '3. Receipt History & Reprint'}</span>
                </div>
                <p className="text-[11px] text-sky-100 mt-1 leading-relaxed">
                  {lang === 'ne'
                    ? 'विगतमा बुझाइएका सबै महसुलका आधिकारिक रसिदहरू हेर्नुहोस् र पुनः प्रिन्ट गर्नुहोस्।'
                    : 'Review previous payment records, dates, amounts, and reprint official receipts.'}
                </p>
                <div className="mt-3 text-xs font-semibold text-amber-300 flex items-center gap-1">
                  <span>{lang === 'ne' ? 'रसिद अभिलेख हेर्नुहोस्' : 'Browse Receipts'}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            </div>
          </div>

          {/* Customer Bills History */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-sky-600" />
                <span>{lang === 'ne' ? 'विगतका महसुल बिलहरूको इतिहास' : 'Billing History'}</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">{t('billNumber')}</th>
                    <th className="py-2.5 px-4">{t('billingPeriod')}</th>
                    <th className="py-2.5 px-4 text-center">{lang === 'ne' ? 'मासिक महसुल' : 'Monthly Charge'}</th>
                    <th className="py-2.5 px-4 text-right">{t('totalDue')}</th>
                    <th className="py-2.5 px-4 text-right">{t('paidAmount')}</th>
                    <th className="py-2.5 px-4 text-right">{t('balanceDue')}</th>
                    <th className="py-2.5 px-4 text-center">{t('status')}</th>
                    <th className="py-2.5 px-4 text-right">{lang === 'ne' ? 'कार्य' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customerBills.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                        {lang === 'ne' ? 'कुनै बिल फेला परेन।' : 'No bills found for this consumer.'}
                      </td>
                    </tr>
                  ) : (
                    customerBills.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-sky-700">{b.billNumber}</td>
                        <td className="py-3 px-4 text-slate-800 font-medium">
                          {lang === 'ne' ? b.nepaliMonthYear : `${b.billingMonth} ${b.billingYear}`}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          रु {b.monthlyCharge || b.minCharge || 150}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700">{formatNPR(b.totalAmount, lang)}</td>
                        <td className="py-3 px-4 text-right text-emerald-600 font-medium">{formatNPR(b.paidAmount, lang)}</td>
                        <td className={`py-3 px-4 text-right font-bold ${b.balanceDue > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                          {formatNPR(b.balanceDue, lang)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              b.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : b.status === 'PARTIALLY_PAID'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {t(b.status === 'PAID' ? 'paid' : b.status === 'PARTIALLY_PAID' ? 'partiallyPaid' : 'unpaid')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onViewBill(b)}
                              className="px-2.5 py-1 text-[11px] rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              title={lang === 'ne' ? 'बिल हेर्नुहोस् र छाप्नुहोस्' : 'Print Bill'}
                            >
                              <Printer className="w-3 h-3" />
                              <span>{t('printBill')}</span>
                            </button>
                            {b.status !== 'PAID' && settings.bankVouchersActive && onGenerateVoucher && (
                              <button
                                onClick={() => onGenerateVoucher(b, linkedHousehold)}
                                className="px-2 py-1 text-[11px] rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                              >
                                {lang === 'ne' ? 'भौचर' : 'Voucher'}
                              </button>
                            )}
                            {b.status !== 'PAID' && settings.onlineGatewaysActive && onPayOnline && (
                              <button
                                onClick={() => onPayOnline(b, linkedHousehold)}
                                className="px-2 py-1 text-[11px] rounded bg-emerald-600 text-white hover:bg-emerald-700 font-semibold"
                              >
                                {t('payNow')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Receipts History */}
          <div id="consumer-receipts-archive" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden scroll-mt-20">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>{lang === 'ne' ? 'भुक्तानी तथा रसिदहरूको इतिहास' : 'Payment Receipts Archive'}</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">{t('receiptNumber')}</th>
                    <th className="py-2.5 px-4">{lang === 'ne' ? 'मिति' : 'Date'}</th>
                    <th className="py-2.5 px-4">{lang === 'ne' ? 'भुक्तानी विधि' : 'Method'}</th>
                    <th className="py-2.5 px-4">{lang === 'ne' ? 'कारोबार संकेत' : 'Txn Ref'}</th>
                    <th className="py-2.5 px-4 text-right">{lang === 'ne' ? 'रकम' : 'Amount'}</th>
                    <th className="py-2.5 px-4 text-right">{lang === 'ne' ? 'कार्य' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customerPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                        {lang === 'ne' ? 'कुनै भुक्तानी रसिद फेला परेन।' : 'No payment records found.'}
                      </td>
                    </tr>
                  ) : (
                    customerPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700">{p.receiptNumber}</td>
                        <td className="py-3 px-4 text-slate-700">{p.date}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{p.paymentMethod}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{p.transactionReference}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">{formatNPR(p.amount, lang)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onViewReceipt(p)}
                            className="px-2.5 py-1 text-[11px] rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-medium"
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
        </>
      )}
    </div>
  );
};
