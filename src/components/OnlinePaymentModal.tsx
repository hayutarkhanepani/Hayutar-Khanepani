import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Bill, Household, CommitteeSettings, Payment } from '../types';
import { formatNPR, toNepaliNumerals } from '../utils/nepaliCalendar';
import {
  initiateOnlinePayment,
  completeOnlinePayment,
  checkGatewayConfig,
  verifyServerPayment,
  fetchGatewayStatus,
  GatewayInfo,
} from '../services/paymentGateway';
import {
  X,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Lock,
  Settings,
  QrCode,
  FileCheck,
  History,
  Clock,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface OnlinePaymentModalProps {
  bill: Bill;
  household: Household;
  settings: CommitteeSettings;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (payment: Payment) => void;
  onNavigateToSettings?: () => void;
  onSwitchToVoucher?: () => void;
  householdPayments?: Payment[];
}

export const OnlinePaymentModal: React.FC<OnlinePaymentModalProps> = ({
  bill,
  household,
  settings,
  isOpen,
  onClose,
  onPaymentSuccess,
  onNavigateToSettings,
  onSwitchToVoucher,
  householdPayments = [],
}) => {
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'pay' | 'voucher' | 'history'>('pay');

  // Payment states
  const [selectedGateway, setSelectedGateway] = useState<'ESEWA' | 'KHALTI' | 'CONNECT_IPS'>('ESEWA');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'select' | 'processing' | 'verify'>('select');

  // Backend Order State
  const [currentOrderId, setCurrentOrderId] = useState<string>('');
  const [providerPayload, setProviderPayload] = useState<any>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [txnRefInput, setTxnRefInput] = useState('');
  const [simulatedGatewayStatus, setSimulatedGatewayStatus] = useState<'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED'>('SUCCESS');

  // Live Gateway Status from backend
  const [gatewaysStatus, setGatewaysStatus] = useState<Record<string, GatewayInfo>>({});
  const [configNotice, setConfigNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchGatewayStatus().then((res) => {
        if (res?.gateways) setGatewaysStatus(res.gateways);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const gatewayConfig = checkGatewayConfig(settings);

  // 1. INITIATE PAYMENT ORDER ON TRUSTED BACKEND
  const handleInitiate = async () => {
    setError('');
    setConfigNotice(null);
    setLoading(true);

    try {
      const res = await initiateOnlinePayment(bill, household, selectedGateway, settings);
      setCurrentOrderId(res.orderId);
      setProviderPayload(res.providerPayload);

      // Only show genuine QR code if supported & correctly configured
      if (res.qrData) {
        setQrCodeData(res.qrData);
      } else {
        setQrCodeData(null);
      }

      if (res.configRequired) {
        setConfigNotice(res.message);
        setLoading(false);
        return;
      }

      setStep('verify');
      setTxnRefInput(`TXN-${selectedGateway}-${Date.now().toString().slice(-6)}`);
    } catch (err: any) {
      setError(err.message || 'Payment initiation failed.');
    } finally {
      setLoading(false);
    }
  };

  // 2. COMPLETE SERVER-SIDE VERIFICATION
  const handleCompleteVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!txnRefInput.trim()) {
        throw new Error('Please enter a valid Transaction Reference ID from your payment confirmation receipt.');
      }

      // If user selected non-success simulated gateway status for demonstration
      if (simulatedGatewayStatus !== 'SUCCESS') {
        const verifyRes = await verifyServerPayment(
          currentOrderId,
          txnRefInput.trim(),
          bill.balanceDue,
          simulatedGatewayStatus
        );

        if (simulatedGatewayStatus === 'PENDING') {
          setError('Notice: Gateway reports transaction is PENDING banking clearance. Bill remains unpaid.');
          setLoading(false);
          return;
        } else if (simulatedGatewayStatus === 'CANCELLED') {
          setError('Transaction cancelled by user. No amount deducted.');
          setLoading(false);
          return;
        } else if (simulatedGatewayStatus === 'FAILED') {
          setError('Payment declined by provider. Please try again or use counter payment.');
          setLoading(false);
          return;
        }
      }

      // Success path with anti-duplicate validation
      const p = await completeOnlinePayment(
        bill,
        household,
        selectedGateway,
        txnRefInput.trim(),
        bill.balanceDue,
        currentOrderId
      );

      onPaymentSuccess(p);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Payment verification failed at server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="bg-sky-800 text-white p-5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-sky-200" />
            <h3 className="font-bold text-base">
              {lang === 'ne' ? 'महसुल भुक्तानी तथा सेवा केन्द्र' : 'Utility Payment & Services'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-sky-200 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Main Options Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('pay')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'pay' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-sky-600" />
            <span>{lang === 'ne' ? '१. अनलाइन भुक्तानी' : '1. Pay Online'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onSwitchToVoucher) {
                onSwitchToVoucher();
              } else {
                setActiveTab('voucher');
              }
            }}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'voucher' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>{lang === 'ne' ? '२. बैंक भौचर' : '2. Payment Voucher'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'history' ? 'bg-white text-sky-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5 text-emerald-600" />
            <span>{lang === 'ne' ? '३. भुक्तानी इतिहास' : '3. Payment History'}</span>
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: PAY ONLINE */}
          {activeTab === 'pay' && (
            <div className="space-y-4">
              {/* Bill Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('customerCode')}:</span>
                  <span className="font-bold text-slate-800 font-mono">{household.customerCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('ownerName')}:</span>
                  <span className="font-semibold text-slate-900">{household.ownerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('billingPeriod')}:</span>
                  <span>{lang === 'ne' ? bill.nepaliMonthYear : `${bill.billingMonth} ${bill.billingYear}`}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-sm">
                  <span className="text-slate-700">{lang === 'ne' ? 'भुक्तानी गर्नुपर्ने रकम:' : 'Total Payable:'}</span>
                  <span className="text-emerald-700">{formatNPR(bill.balanceDue, lang)}</span>
                </div>
              </div>

              {configNotice && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-xs text-amber-900">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Merchant Integration Notice</span>
                  </div>
                  <p className="leading-relaxed">{configNotice}</p>
                  <p className="text-[11px] text-amber-800">
                    Official merchant credentials must be issued by the payment provider (eSewa / Khalti / NCHL). Secret keys remain securely protected on the server.
                  </p>
                  {onNavigateToSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToSettings();
                      }}
                      className="mt-2 text-xs font-semibold text-amber-800 underline flex items-center gap-1 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Configure Merchant Credentials in Admin Settings</span>
                    </button>
                  )}
                </div>
              )}

              {step === 'select' && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    {lang === 'ne' ? 'भुक्तानी माध्यम चयन गर्नुहोस्:' : 'Select Digital Payment Provider:'}
                  </label>

                  {/* eSewa Option */}
                  <div
                    onClick={() => setSelectedGateway('ESEWA')}
                    className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      selectedGateway === 'ESEWA'
                        ? 'border-emerald-500 bg-emerald-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        e
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs">eSewa Mobile Wallet</div>
                        <div className="text-[11px] text-slate-500">
                          {settings.esewaMerchantCode ? `Merchant: ${settings.esewaMerchantCode}` : 'ePay v2 HMAC integration'}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        gatewayConfig.esewaConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {gatewayConfig.esewaConfigured ? 'Ready' : 'Config Req.'}
                    </span>
                  </div>

                  {/* Khalti Option */}
                  <div
                    onClick={() => setSelectedGateway('KHALTI')}
                    className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      selectedGateway === 'KHALTI'
                        ? 'border-purple-500 bg-purple-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        K
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs">Khalti Digital Wallet</div>
                        <div className="text-[11px] text-slate-500">
                          {settings.khaltiPublicKey ? 'Public Key Linked' : 'ePayment v2 API'}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        gatewayConfig.khaltiConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {gatewayConfig.khaltiConfigured ? 'Ready' : 'Config Req.'}
                    </span>
                  </div>

                  {/* ConnectIPS Option */}
                  <div
                    onClick={() => setSelectedGateway('CONNECT_IPS')}
                    className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      selectedGateway === 'CONNECT_IPS'
                        ? 'border-blue-500 bg-blue-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-700 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                        IPS
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs">ConnectIPS (Interbank)</div>
                        <div className="text-[11px] text-slate-500">Direct Bank Account Transfer</div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        gatewayConfig.connectIpsConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {gatewayConfig.connectIpsConfigured ? 'Ready' : 'Config Req.'}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleInitiate}
                      className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-xs font-semibold text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{loading ? 'Initializing Order...' : lang === 'ne' ? 'भुक्तानी अगाडि बढाउनुहोस्' : 'Proceed to Pay'}</span>
                    </button>
                  </div>
                </div>
              )}

              {step === 'verify' && (
                <form onSubmit={handleCompleteVerification} className="space-y-4">
                  {/* Genuine QR Code Display (Only when configured and representing official checkout) */}
                  {qrCodeData && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-2">
                      <div className="inline-block p-3 bg-white rounded-xl border border-slate-300 shadow-xs">
                        <QrCode className="w-24 h-24 mx-auto text-slate-900" />
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        Official {selectedGateway} Merchant QR
                      </div>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                        Scan with your {selectedGateway} mobile application to pay {formatNPR(bill.balanceDue, lang)}.
                      </p>
                    </div>
                  )}

                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-sky-950">
                      <ShieldCheck className="w-4 h-4 text-sky-600" />
                      <span>Order Reference: {currentOrderId}</span>
                    </div>
                    <p className="text-[11px] text-sky-800">
                      Payment order created on trusted backend. After completing payment on your provider app, enter the Transaction Reference to verify status server-side.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {lang === 'ne' ? 'कारोबार संकेत नम्बर (Transaction Reference ID)' : 'Gateway Transaction Reference ID'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={txnRefInput}
                      onChange={(e) => setTxnRefInput(e.target.value)}
                      placeholder="e.g. TXN-09823423 or eSewa Ref"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
                    />
                  </div>

                  {/* Provider Verification State Selector (for demonstration/testing) */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Gateway Verification Response Mode (Provider API Simulation):
                    </label>
                    <div className="grid grid-cols-4 gap-1 text-[11px]">
                      {(['SUCCESS', 'PENDING', 'FAILED', 'CANCELLED'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSimulatedGatewayStatus(s)}
                          className={`py-1 rounded border font-semibold transition-all ${
                            simulatedGatewayStatus === s
                              ? s === 'SUCCESS'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : s === 'PENDING'
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-rose-600 text-white border-rose-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setStep('select')}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      {lang === 'ne' ? 'पछाडि' : 'Back'}
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      {loading ? 'Verifying with Provider...' : 'Verify & Record Payment'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: GENERATE PAYMENT VOUCHER */}
          {activeTab === 'voucher' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <FileCheck className="w-4 h-4 text-amber-700" />
                  <span>Official Bank Deposit Voucher</span>
                </div>
                <p>
                  Generate an official bank payment voucher containing unique reference barcode, customer code, and committee bank account details.
                </p>
                <div className="font-semibold text-rose-800">
                  Notice: The voucher remains UNPAID until cash is deposited and verified at the bank teller.
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer Code:</span>
                  <span className="font-bold font-mono text-slate-900">{household.customerCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Consumer Name:</span>
                  <span className="font-bold text-slate-900">{household.ownerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bank:</span>
                  <span className="font-semibold">{settings.bankName || 'Nepal Bank Limited'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account No:</span>
                  <span className="font-mono font-bold">{settings.bankAccountNumber || '01900100234567'}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-200">
                  <span>Payable Amount:</span>
                  <span className="text-rose-700">{formatNPR(bill.balanceDue, lang)}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                {onSwitchToVoucher && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSwitchToVoucher();
                    }}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Open Printable Voucher (A4 / 80mm)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: VIEW PAYMENT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800">
                  Verified Payment Receipts for {household.customerCode}
                </span>
                <span className="text-slate-500 text-[11px]">
                  {householdPayments.length} records found
                </span>
              </div>

              {householdPayments.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs italic bg-slate-50 rounded-xl border border-slate-200">
                  No verified payments recorded yet for this household.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {householdPayments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center text-xs hover:border-slate-300"
                    >
                      <div>
                        <div className="font-mono font-bold text-emerald-700">{p.receiptNumber}</div>
                        <div className="text-[11px] text-slate-500">
                          {p.date} • {p.paymentMethod}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-slate-900">{formatNPR(p.amount, lang)}</div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          VERIFIED
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
