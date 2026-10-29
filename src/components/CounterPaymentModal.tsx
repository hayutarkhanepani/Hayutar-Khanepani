import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Household, Bill, Payment } from '../types';
import { formatNPR, toNepaliNumerals, getTodayBSDateString } from '../utils/nepaliCalendar';
import { recordCounterPayment } from '../services/dbService';
import {
  CreditCard,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  Receipt,
  User,
  ShieldCheck,
} from 'lucide-react';

interface CounterPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  households: Household[];
  bills: Bill[];
  onPaymentSuccess: (payment: Payment) => void;
  preSelectedHousehold?: Household | null;
}

export const CounterPaymentModal: React.FC<CounterPaymentModalProps> = ({
  isOpen,
  onClose,
  households,
  bills,
  onPaymentSuccess,
  preSelectedHousehold,
}) => {
  const { lang, t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(
    preSelectedHousehold || null
  );
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<Payment['paymentMethod']>('CASH');
  const [transactionRef, setTransactionRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);

  // Household search matching
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return households.filter(
      (h) =>
        h.customerCode.toLowerCase().includes(q) ||
        h.householdNumber.toLowerCase().includes(q) ||
        h.ownerName.toLowerCase().includes(q) ||
        h.phoneNumber.includes(q)
    ).slice(0, 5);
  }, [households, searchQuery]);

  // Unpaid bills for this household
  const unpaidBills = useMemo(() => {
    if (!selectedHousehold) return [];
    return bills.filter(
      (b) =>
        b.customerId === selectedHousehold.customerCode &&
        (b.status === 'UNPAID' || b.status === 'PARTIALLY_PAID' || b.status === 'OVERDUE')
    );
  }, [bills, selectedHousehold]);

  if (!isOpen) return null;

  const handleSelectHousehold = (h: Household) => {
    setSelectedHousehold(h);
    setSearchQuery('');
    setAmount(h.currentBalance || 0);
    setError('');
  };

  const handlePreConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedHousehold) {
      setError(lang === 'ne' ? 'कृपया घरधुरी चयन गर्नुहोस्।' : 'Please select a household.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError(lang === 'ne' ? 'रकम शून्य भन्दा बढी हुनुपर्छ।' : 'Amount must be greater than zero.');
      return;
    }

    setConfirmStep(true);
  };

  const handleExecutePayment = async () => {
    if (!selectedHousehold || !amount) return;
    setLoading(true);
    setError('');

    try {
      const payment = await recordCounterPayment({
        household: selectedHousehold,
        amount: Number(amount),
        paymentMethod,
        transactionReference: transactionRef.trim() || `CASH-${Date.now().toString().slice(-6)}`,
        remarks: remarks || 'Counter Cash Payment',
        date: getTodayBSDateString(),
      });

      onPaymentSuccess(payment);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment.');
      setConfirmStep(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="bg-emerald-800 text-white p-5 flex justify-between items-center">
          <h3 className="font-bold text-base flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-200" />
            <span>{lang === 'ne' ? 'काउन्टर महसुल संकलन रसिद' : 'Record Counter Payment'}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-emerald-200 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {!confirmStep ? (
            <form onSubmit={handlePreConfirm} className="space-y-4">
              {/* Household Search or Selected Card */}
              {!selectedHousehold ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'ग्राहक नं वा नाम खोज्नुहोस्' : 'Search Customer by Code or Name'} *
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={lang === 'ne' ? 'जस्तै: HYT-00101 वा राम बहादुर' : 'e.g. HYT-00101 or Ram Bahadur'}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {searchResults.length > 0 && (
                    <div className="mt-2 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white shadow-xs">
                      {searchResults.map((h) => (
                        <div
                          key={h.id}
                          onClick={() => handleSelectHousehold(h)}
                          className="p-3 hover:bg-emerald-50/60 cursor-pointer flex justify-between items-center text-xs transition-colors"
                        >
                          <div>
                            <div className="font-bold text-slate-900">
                              {h.customerCode} - {h.ownerName}
                            </div>
                            <div className="text-slate-500 text-[11px]">
                              {h.householdNumber} • Ward {h.ward} • {h.phoneNumber}
                            </div>
                          </div>
                          <div className="text-right font-bold text-rose-600">
                            {formatNPR(h.currentBalance, lang)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      {selectedHousehold.customerCode}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-1">
                      {selectedHousehold.ownerName}
                    </h4>
                    <p className="text-xs text-slate-600">
                      {selectedHousehold.householdNumber} • Ward {selectedHousehold.ward}, {selectedHousehold.tole}
                    </p>
                    <p className="text-xs text-slate-500 font-mono">
                      Phone: {selectedHousehold.phoneNumber} • Meter: {selectedHousehold.meterNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">{lang === 'ne' ? 'कुल बाँकी बक्यौता' : 'Total Due Balance'}</div>
                    <div className="text-lg font-extrabold text-rose-600">
                      {formatNPR(selectedHousehold.currentBalance, lang)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedHousehold(null)}
                      className="mt-1 text-[11px] text-sky-700 hover:underline cursor-pointer"
                    >
                      {lang === 'ne' ? 'अर्को ग्राहक छान्नुहोस्' : 'Change Consumer'}
                    </button>
                  </div>
                </div>
              )}

              {/* Outstanding Bills breakdown */}
              {selectedHousehold && unpaidBills.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs">
                  <div className="font-semibold text-slate-700 mb-2">
                    {lang === 'ne' ? 'बुझाउन बाँकी बिलहरू:' : 'Outstanding Unpaid Bills:'}
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {unpaidBills.map((b) => (
                      <div key={b.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 text-[11px]">
                        <span>{lang === 'ne' ? b.nepaliMonthYear : `${b.billingMonth} ${b.billingYear}`} ({b.billNumber})</span>
                        <span className="font-bold text-rose-600">{formatNPR(b.balanceDue, lang)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'बुझाएको रकम (NPR)' : 'Amount Received (NPR)'} *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-bold text-slate-900 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {selectedHousehold && amount !== '' && Number(amount) < selectedHousehold.currentBalance && (
                    <p className="text-[10px] text-amber-600 mt-1">
                      {lang === 'ne'
                        ? `आंशिक भुक्तानी: बाँकी रु ${(selectedHousehold.currentBalance - Number(amount)).toFixed(2)} रहनेछ।`
                        : `Partial Payment: NPR ${(selectedHousehold.currentBalance - Number(amount)).toFixed(2)} will remain.`}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'भुक्तानी विधि' : 'Payment Method'} *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="CASH">{lang === 'ne' ? 'काउन्टर नगद (Cash)' : 'Counter Cash'}</option>
                    <option value="BANK_DEPOSIT">{lang === 'ne' ? 'बैंक जम्मा भौचर (Bank Deposit)' : 'Bank Deposit'}</option>
                    <option value="CHEQUE">{lang === 'ne' ? 'चेक (Cheque)' : 'Cheque'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'भौचर / कारोबार संकेत नं' : 'Slip / Txn Reference No.'}
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder={paymentMethod === 'CASH' ? 'Auto-generated' : 'Slip or Bank Ref #'}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'कैफियत (Remarks)' : 'Remarks'}
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={lang === 'ne' ? 'नियमित महसुल संकलन' : 'Regular tariff collection'}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!selectedHousehold || !amount}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {lang === 'ne' ? 'रसिद पुष्टि गर्नुहोस्' : 'Review & Confirm'}
                </button>
              </div>
            </form>
          ) : (
            /* Confirmation Step */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-center space-y-2">
                <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-slate-900 text-base">
                  {lang === 'ne' ? 'के तपाईं यो रसिद काट्न निश्चित हुनुहुन्छ?' : 'Confirm Payment Record?'}
                </h4>
                <p className="text-xs text-slate-600">
                  {lang === 'ne'
                    ? 'पुष्टि गरेपछि यो वित्तीय कारोबार स्थायी रूपमा सुरक्षित हुनेछ र उपभोक्ताको बक्यौता घट्नेछ।'
                    : 'Recording this transaction will immediately credit the consumer account and generate a receipt.'}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl space-y-2.5 text-xs border border-slate-200">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600 font-medium">{lang === 'ne' ? 'उपभोक्ता / कोड:' : 'Consumer / Code:'}</span>
                  <span className="font-bold text-slate-900">{selectedHousehold?.ownerName} ({selectedHousehold?.customerCode})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600 font-medium">{lang === 'ne' ? 'अघिल्लो बाँकी बक्यौता:' : 'Previous Balance:'}</span>
                  <span className="font-bold text-slate-800">{formatNPR(selectedHousehold?.currentBalance || 0, lang)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 bg-emerald-50/60 px-2 rounded">
                  <span className="text-emerald-900 font-bold">{lang === 'ne' ? 'बुझाउने रकम (Payment):' : 'Payment Received:'}</span>
                  <span className="font-extrabold text-emerald-700 text-sm">{formatNPR(Number(amount), lang)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600 font-medium">{lang === 'ne' ? 'भुक्तानी विधि:' : 'Payment Method:'}</span>
                  <span className="font-semibold text-slate-800">
                    {paymentMethod === 'CASH' ? (lang === 'ne' ? 'नगद (Cash)' : 'Cash') :
                     paymentMethod === 'BANK_DEPOSIT' ? (lang === 'ne' ? 'बैंक जम्मा (Bank Deposit)' : 'Bank Deposit') :
                     (lang === 'ne' ? 'चेक (Cheque)' : 'Cheque')}
                  </span>
                </div>
                <div className="flex justify-between py-1 bg-amber-50/60 px-2 rounded">
                  <span className="text-amber-900 font-bold">{lang === 'ne' ? 'बाँकी रहने रकम (Remaining Balance):' : 'Remaining Balance:'}</span>
                  <span className="font-extrabold text-slate-900">
                    {formatNPR(Math.max(0, (selectedHousehold?.currentBalance || 0) - Number(amount)), lang)}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setConfirmStep(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {lang === 'ne' ? 'फिर्ता' : 'Back'}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleExecutePayment}
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{lang === 'ne' ? 'रसिद जारी गर्नुहोस् (Print Ready)' : 'Issue Receipt'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
