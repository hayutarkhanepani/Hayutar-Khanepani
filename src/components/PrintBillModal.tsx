import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Bill, CommitteeSettings, Household } from '../types';
import { formatNPR, toNepaliNumerals } from '../utils/nepaliCalendar';
import { resolveConsumerInfo, ResolvedConsumerInfo } from '../utils/consumerHelper';
import { getHouseholdByCustomerCode, getBillById } from '../services/dbService';
import { printDocument } from '../utils/printHelper';
import {
  X,
  Printer,
  Droplets,
  AlertTriangle,
  User,
  QrCode,
  Gauge,
  Loader2,
  FileCheck2,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface PrintBillModalProps {
  bill?: Bill | null;
  billId?: string | null;
  settings: CommitteeSettings;
  household?: Household | null;
  households?: Household[];
  onClose: () => void;
  isOpen?: boolean;
}

export const PrintBillModal: React.FC<PrintBillModalProps> = ({
  bill,
  billId,
  settings,
  household,
  households = [],
  onClose,
  isOpen,
}) => {
  const { lang, t } = useLanguage();
  const { currentUser, userProfile, isCustomer, isAdmin, isStaff } = useAuth();

  const isModalRequested = isOpen !== undefined ? isOpen : Boolean(bill || billId);

  const [activeBill, setActiveBill] = useState<Bill | null>(bill || null);
  const [activeHousehold, setActiveHousehold] = useState<Household | null>(household || null);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [paperSize, setPaperSize] = useState<'A4' | 'POS80'>('A4');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Initialize paper size from settings if present
  useEffect(() => {
    if (settings.billTemplate?.paperSize === 'POS80') {
      setPaperSize('POS80');
    }
  }, [settings.billTemplate?.paperSize]);

  // Load verified bill and consumer details from Firestore or cache
  useEffect(() => {
    let isMounted = true;

    async function loadBillAndConsumer() {
      if (!isModalRequested) {
        setActiveBill(null);
        setActiveHousehold(null);
        setFetchError(null);
        setIsFetching(false);
        return;
      }

      setFetchError(null);
      setIsFetching(true);

      try {
        let currentBill: Bill | null = bill || null;
        const targetId = billId || (bill && bill.id ? bill.id : '');

        // 1. Fetch full bill document if only ID was provided or if critical fields are absent
        if (!currentBill || !currentBill.billNumber || currentBill.totalAmount === undefined) {
          if (targetId) {
            const fetched = await getBillById(targetId);
            if (fetched) {
              currentBill = fetched;
            }
          }
        }

        if (!isMounted) return;

        // If no bill record could be found
        if (!currentBill) {
          setFetchError(
            lang === 'ne'
              ? 'कुनै बिल फेला परेन। कृपया महसुल सूचीबाट बिल चयन गरी पुनः प्रयास गर्नुहोस्।'
              : 'No bill found. Please select a valid bill from the tariff list and try again.'
          );
          setIsFetching(false);
          return;
        }

        // 2. Authorization Guard (Rule 9):
        // Consumers may only view/print bills that belong to their registered household
        if (currentUser && isCustomer && !isAdmin && !isStaff) {
          const userCode = (userProfile?.customerId || '').toUpperCase().trim();
          const billCustomer = (currentBill.customerId || '').toUpperCase().trim();
          if (userCode && billCustomer && userCode !== billCustomer) {
            setFetchError(
              lang === 'ne'
                ? 'तपाईंलाई अन्य उपभोक्ताको बिल हेर्ने वा छाप्ने अनुमति छैन।'
                : 'Unauthorized: You are only permitted to view or print your own utility bills.'
            );
            setIsFetching(false);
            return;
          }
        }

        setActiveBill(currentBill);

        // 3. Resolve Household record from memory or Firestore
        let matchedHousehold: Household | null = household || null;
        if (!matchedHousehold) {
          matchedHousehold =
            households.find(
              (h) =>
                h.customerCode === currentBill!.customerId ||
                h.id === currentBill!.householdId ||
                h.id === currentBill!.customerId
            ) || null;
        }

        if (!matchedHousehold && currentBill.customerId) {
          try {
            const doc = await getHouseholdByCustomerCode(currentBill.customerId);
            if (doc) {
              matchedHousehold = doc;
            }
          } catch (hhErr) {
            console.warn('Failed to fetch household for bill:', hhErr);
          }
        }

        if (isMounted) {
          setActiveHousehold(matchedHousehold);
        }
      } catch (err: any) {
        console.error('Error loading bill for print:', err);
        if (isMounted) {
          setFetchError(
            err.message ||
              (lang === 'ne'
                ? 'डाटाबेसबाट बिल विवरण प्राप्त गर्न सकिएन।'
                : 'Failed to retrieve bill details from database.')
          );
        }
      } finally {
        if (isMounted) {
          setIsFetching(false);
        }
      }
    }

    loadBillAndConsumer();

    return () => {
      isMounted = false;
    };
  }, [
    isModalRequested,
    bill,
    billId,
    household,
    households,
    currentUser,
    userProfile,
    isCustomer,
    isAdmin,
    isStaff,
    lang,
  ]);

  // If no print modal was opened, do not render anything
  if (!isModalRequested) {
    return null;
  }

  // Loading state modal
  if (isFetching && !activeBill) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-xl space-y-4">
          <Loader2 className="w-10 h-10 text-sky-600 animate-spin mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            {lang === 'ne' ? 'बिल विवरण प्राप्त गरिँदैछ...' : 'Fetching Bill Details...'}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {lang === 'ne'
              ? 'कृपया प्रतिक्षा गर्नुहोस्, डाटाबेसबाट वास्तविक बिल तथा उपभोक्ता विवरण लोड हुँदैछ।'
              : 'Please wait while verified bill and consumer records are loaded.'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    );
  }

  // Error or Not Found State
  if (fetchError || !activeBill) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-xl space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            {lang === 'ne' ? 'कुनै बिल फेला परेन' : 'No Bill Found'}
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            {fetchError ||
              (lang === 'ne'
                ? 'कृपया महसुल सूचीबाट बिल चयन गरी पुनः प्रयास गर्नुहोस्।'
                : 'Please select a valid bill from the list to preview and print.')}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl cursor-pointer"
          >
            {lang === 'ne' ? 'बन्द गर्नुहोस् (Close)' : 'Close'}
          </button>
        </div>
      </div>
    );
  }

  const combinedHouseholds = activeHousehold ? [activeHousehold, ...households] : households;
  const consumer: ResolvedConsumerInfo = resolveConsumerInfo(activeBill, combinedHouseholds);

  const handlePrint = () => {
    if (isFetching || isPrinting || !activeBill) return;
    setIsPrinting(true);

    printDocument('printable-bill', {
      documentTitle: `Bill_${activeBill.billNumber}_${consumer.customerCode}`,
      paperSize,
      onAfterPrint: () => {
        setIsPrinting(false);
      },
    });

    // Fallback safety timeout in case afterprint does not fire
    setTimeout(() => {
      setIsPrinting(false);
    }, 1500);
  };

  return (
    <div className="printable-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
      <div
        className={`printable-modal-card relative w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 print:border-none print:shadow-none print:m-0 print:w-full print:rounded-none transition-all ${
          paperSize === 'POS80' ? 'max-w-md' : 'max-w-2xl'
        }`}
      >
        {/* Modal Toolbar - Hidden in Print */}
        <div className="bg-sky-900 text-white p-3.5 sm:p-4 flex flex-wrap justify-between items-center gap-2 print:hidden border-b border-sky-800">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-sky-200 shrink-0" />
            <div>
              <span className="font-bold text-xs sm:text-sm block leading-tight">
                {lang === 'ne' ? 'खानेपानी महसुल बिल (मुद्रण पूर्वावलोकन)' : 'Water Supply Utility Bill (Print Preview)'}
              </span>
              <span className="text-[10px] text-sky-200 font-mono">
                {activeBill.billNumber} • {consumer.customerCode}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Paper Size Selector */}
            <div className="inline-flex rounded-lg bg-sky-950/60 p-0.5 border border-sky-700/50 text-[11px]">
              <button
                type="button"
                onClick={() => setPaperSize('A4')}
                className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  paperSize === 'A4'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-sky-200 hover:text-white'
                }`}
                title="Standard A4 Page"
              >
                A4
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('POS80')}
                className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  paperSize === 'POS80'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-sky-200 hover:text-white'
                }`}
                title="Compact 80mm Thermal Receipt"
              >
                POS (80mm)
              </button>
            </div>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={isFetching || isPrinting}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                isFetching || isPrinting
                  ? 'bg-emerald-800 text-emerald-200 cursor-not-allowed opacity-80'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
              }`}
            >
              {isFetching || isPrinting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{lang === 'ne' ? 'लोड हुँदैछ...' : 'Printing...'}</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>{t('printBill')}</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-sky-200 hover:text-white hover:bg-sky-800 rounded-lg transition-colors cursor-pointer"
              title={t('cancel')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Loading Indicator Banner */}
        {isFetching && (
          <div className="bg-sky-50 border-b border-sky-100 px-4 py-2 text-xs text-sky-800 flex items-center gap-2 print:hidden">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600 shrink-0" />
            <span>
              {lang === 'ne'
                ? 'ग्राहक विवरण प्राप्त गरिँदैछ, कृपया एकछिन प्रतिक्षा गर्नुहोस्...'
                : 'Loading latest consumer record from Firestore...'}
            </span>
          </div>
        )}

        {/* The Printable Bill Document */}
        <div
          className={`p-6 sm:p-8 space-y-4 text-slate-800 font-sans print:p-4 bg-white ${
            paperSize === 'POS80' ? 'text-xs max-w-sm mx-auto' : ''
          }`}
          id="printable-bill"
        >
          {/* Header */}
          <div className="text-center border-b-2 border-sky-800 pb-3 relative">
            {settings.billTemplate?.showLogo !== false && (
              <div className="flex justify-center mb-1.5">
                {settings.logoUrl || settings.billTemplate?.logoUrl ? (
                  <img
                    src={settings.logoUrl || settings.billTemplate?.logoUrl}
                    alt="Logo"
                    className="w-12 h-12 object-contain mx-auto"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center mx-auto print:border print:border-sky-300">
                    <Droplets className="w-6 h-6 fill-sky-600" />
                  </div>
                )}
              </div>
            )}

            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
              {settings.committeeNameNepali || 'श्री हायुटार खानेपानी तथा सरसफाइ उपभोक्ता समिति'}
            </h1>
            <div className="text-xs font-semibold text-slate-600">
              {settings.committeeName}
            </div>
            {(settings.billTemplate?.tagline || settings.tagline) && (
              <div className="text-[11px] font-semibold text-sky-800 italic mt-0.5">
                "{settings.billTemplate?.tagline || settings.tagline}"
              </div>
            )}
            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
              {settings.address} • फोन: {settings.phone} • दर्ता नं: {settings.registrationNumber}
              {settings.panNumber ? ` • स्थायी लेखा नं (PAN): ${settings.panNumber}` : ''}
            </div>

            <div className="inline-block mt-2.5 px-3.5 py-0.5 rounded-full bg-sky-100 text-sky-900 font-bold text-xs uppercase tracking-wider print:border print:border-sky-300">
              {lang === 'ne'
                ? settings.billTemplate?.headerTitleNepali || 'मासिक खानेपानी महसुल बिल'
                : settings.billTemplate?.headerTitleEnglish || 'Monthly Water Consumption Bill'}
            </div>
          </div>

          {/* Consumer Information Card */}
          <div className="bg-sky-50/60 p-3.5 sm:p-4 rounded-xl border border-sky-100 space-y-2.5 print:bg-white print:border-slate-300">
            <div className="flex justify-between items-start border-b border-sky-100 print:border-slate-200 pb-2">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  {lang === 'ne' ? 'उपभोक्ताको नाम (Consumer Full Name):' : 'Consumer Full Name:'}
                </span>
                <div className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-sky-600 inline shrink-0 print:hidden" />
                  <span>{consumer.fullName}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-900 bg-sky-100 print:bg-slate-100 px-2.5 py-0.5 rounded-md font-mono border border-sky-200 print:border-slate-300">
                  {consumer.customerCode}
                </span>
                <div className="text-[10px] text-slate-600 font-medium mt-1">
                  {lang === 'ne' ? 'वर्ग:' : 'Category:'} <strong className="text-slate-800">{consumer.category}</strong>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <span className="text-slate-500">{t('householdNumber')}:</span>{' '}
                <span className="font-semibold text-slate-900">{consumer.householdNumber}</span>
              </div>
              <div>
                <span className="text-slate-500">{lang === 'ne' ? 'धारा / जडान नं:' : 'Connection No:'}</span>{' '}
                <span className="font-semibold text-slate-900">{consumer.connectionNumber || 'उपलब्ध छैन'}</span>
              </div>
              <div>
                <span className="text-slate-500">{t('ward')}:</span>{' '}
                <span className="font-semibold text-slate-900">
                  {consumer.ward !== 'उपलब्ध छैन' ? (lang === 'ne' ? `वडा नं ${toNepaliNumerals(consumer.ward)}` : `Ward ${consumer.ward}`) : 'उपलब्ध छैन'}
                  {consumer.tole ? `, ${consumer.tole}` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-500">{lang === 'ne' ? 'सम्पर्क फोन:' : 'Phone:'}</span>{' '}
                <span className="font-mono text-slate-900">{consumer.phoneNumber}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500">{lang === 'ne' ? 'ठेगाना:' : 'Address:'}</span>{' '}
                <span className="text-slate-900 font-medium">{consumer.address}</span>
              </div>
            </div>
          </div>

          {/* Bill Meta Details */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 print:bg-white">
            <div className="space-y-1">
              <div>
                <span className="text-slate-500">{t('billNumber')}:</span>{' '}
                <span className="font-bold font-mono text-slate-900">{activeBill.billNumber}</span>
              </div>
              <div>
                <span className="text-slate-500">{t('billingPeriod')}:</span>{' '}
                <span className="font-bold text-sky-900">
                  {lang === 'ne' ? activeBill.nepaliMonthYear : `${activeBill.billingMonth} ${activeBill.billingYear}`}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-right">
              <div>
                <span className="text-slate-500">{lang === 'ne' ? 'जारी मिति:' : 'Issue Date:'}</span>{' '}
                <span className="font-semibold text-slate-800">{activeBill.issueDate}</span>
              </div>
              <div>
                <span className="text-slate-500">{t('dueDate')}:</span>{' '}
                <span className="font-bold text-rose-700">{activeBill.dueDate}</span>
              </div>
            </div>
          </div>

          {/* Meter Reading Details (If meter readings exist) */}
          {(activeBill.currentReading !== undefined || activeBill.previousReading !== undefined) && (
            <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200 text-xs print:bg-white">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1.5">
                <Gauge className="w-3.5 h-3.5 text-sky-600" />
                <span>{lang === 'ne' ? 'मिटर रिडिङ विवरण (Meter Readings)' : 'Meter Reading Details'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500">{lang === 'ne' ? 'अघिल्लो रिडिङ' : 'Prev Reading'}</div>
                  <div className="font-bold font-mono text-slate-800">{activeBill.previousReading ?? 0}</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500">{lang === 'ne' ? 'हालको रिडिङ' : 'Current Reading'}</div>
                  <div className="font-bold font-mono text-slate-800">{activeBill.currentReading ?? 0}</div>
                </div>
                <div className="bg-sky-50 p-2 rounded-lg border border-sky-200">
                  <div className="text-[10px] text-sky-700 font-semibold">{lang === 'ne' ? 'खपत इकाइ (Units)' : 'Units Consumed'}</div>
                  <div className="font-black font-mono text-sky-950">
                    {activeBill.unitsConsumed ?? Math.max(0, (activeBill.currentReading || 0) - (activeBill.previousReading || 0))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Amount Calculation Breakdown */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-white text-xs space-y-1.5">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 font-medium">
                {lang === 'ne' ? 'मासिक तोकिएको धारा महसुल (Fixed Monthly Tariff)' : 'Fixed Monthly Household Tariff'}
              </span>
              <span className="font-bold text-slate-900">{formatNPR(activeBill.monthlyCharge || 150, lang)}</span>
            </div>

            {activeBill.sanitationCharge > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">{t('sanitationCharge')}</span>
                <span className="font-semibold text-slate-800">{formatNPR(activeBill.sanitationCharge, lang)}</span>
              </div>
            )}

            {activeBill.maintenanceFee !== undefined && activeBill.maintenanceFee > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">{lang === 'ne' ? 'मर्मत सम्भार शुल्क' : 'Maintenance Fee'}</span>
                <span className="font-semibold text-slate-800">{formatNPR(activeBill.maintenanceFee, lang)}</span>
              </div>
            )}

            {activeBill.additionalCharges && activeBill.additionalCharges.map((ch, idx) => (
              <div key={idx} className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">{ch.name}</span>
                <span className="font-semibold text-slate-800">{formatNPR(ch.amount, lang)}</span>
              </div>
            ))}

            {activeBill.previousBalance > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
                <span>{lang === 'ne' ? 'अघिल्लो बाँकी बक्यौता (Previous Dues)' : 'Previous Outstanding Balance'}</span>
                <span className="font-bold">{formatNPR(activeBill.previousBalance, lang)}</span>
              </div>
            )}

            {activeBill.penaltyAmount > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
                <span>{lang === 'ne' ? 'ढिलो भुक्तानी जरिवाना (Late Penalty)' : 'Late Payment Penalty'}</span>
                <span className="font-bold">+{formatNPR(activeBill.penaltyAmount, lang)}</span>
              </div>
            )}

            {activeBill.adjustmentAmount !== undefined && activeBill.adjustmentAmount !== 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-amber-700">
                <span>{lang === 'ne' ? 'रकम समायोजन (Adjustment / Correction)' : 'Bill Adjustment'}</span>
                <span className="font-bold">
                  {activeBill.adjustmentAmount > 0 ? `+${formatNPR(activeBill.adjustmentAmount, lang)}` : formatNPR(activeBill.adjustmentAmount, lang)}
                </span>
              </div>
            )}

            {activeBill.discountAmount > 0 && (
              <div className="flex justify-between py-1 border-b border-slate-100 text-emerald-600">
                <span>{lang === 'ne' ? 'समयमै भुक्तानी छुट (Early Discount)' : 'Early Payment Discount'}</span>
                <span className="font-bold">-{formatNPR(activeBill.discountAmount, lang)}</span>
              </div>
            )}

            {/* Total Amount Due */}
            <div className="flex justify-between py-2 border-t-2 border-sky-800 text-sm font-black text-slate-900 bg-sky-50/70 px-3 rounded-lg print:bg-slate-100">
              <span>{lang === 'ne' ? 'जम्मा भुक्तानी गर्नुपर्ने रकम (Total Payable):' : 'Total Amount Due:'}</span>
              <span className="text-sky-950 font-black">{formatNPR(activeBill.totalAmount, lang)}</span>
            </div>

            {/* Paid & Remaining Due Grid */}
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
              <div className="flex justify-between bg-emerald-50 print:bg-white p-2 rounded-lg border border-emerald-200 print:border-slate-300">
                <span className="text-emerald-800 font-medium">{lang === 'ne' ? 'हालसम्म बुझाएको रकम:' : 'Amount Paid:'}</span>
                <span className="font-bold text-emerald-950">{formatNPR(activeBill.paidAmount || 0, lang)}</span>
              </div>
              <div className="flex justify-between bg-rose-50 print:bg-white p-2 rounded-lg border border-rose-200 print:border-slate-300">
                <span className="text-rose-800 font-medium">{lang === 'ne' ? 'बाँकी बक्यौता रकम:' : 'Remaining Due:'}</span>
                <span className="font-bold text-rose-950">{formatNPR(activeBill.balanceDue, lang)}</span>
              </div>
            </div>
          </div>

          {/* QR Verification Code if enabled */}
          {settings.billTemplate?.showQrCode !== false && (
            <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs print:p-2 print:bg-white">
              <div className="w-12 h-12 bg-white border border-slate-300 rounded-lg flex items-center justify-center shrink-0">
                <QrCode className="w-10 h-10 text-slate-800" />
              </div>
              <div className="text-[11px] text-slate-600 leading-tight">
                <strong className="text-slate-800 block text-xs">
                  {lang === 'ne' ? 'काउन्टर प्रमाणीकरण QR कोड' : 'Counter Verification QR'}
                </strong>
                {lang === 'ne'
                  ? `बिल नं: ${activeBill.billNumber} • ग्राहक: ${consumer.customerCode} (${consumer.fullName}) • प्रमाणीकरण लिङ्क`
                  : `Bill: ${activeBill.billNumber} • Customer: ${consumer.customerCode} (${consumer.fullName})`}
              </div>
            </div>
          )}

          {/* Payment Notice & Signatures */}
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <div className="text-[11px] text-slate-600 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200/60 flex items-start gap-2 print:bg-white print:border-slate-300">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 print:hidden" />
              <div>
                <strong>{lang === 'ne' ? 'भुक्तानी सम्बन्धी सूचना:' : 'Payment Notice:'}</strong>{' '}
                {settings.billTemplate?.termsAndConditions ? (
                  <span>
                    {settings.billTemplate.termsAndConditions}{' '}
                    {lang === 'ne'
                      ? `(भुक्तानी म्याद: ${activeBill.dueDate} | काउन्टर समय: ${settings.counterOpeningTime || 'बिहान १०:००'} देखि ${settings.counterClosingTime || 'दिउँसो ४:००'} सम्म)`
                      : `(Due Date: ${activeBill.dueDate} | Counter Hours: ${settings.counterOpeningTime || '10:00 AM'} to ${settings.counterClosingTime || '4:00 PM'})`}
                  </span>
                ) : lang === 'ne' ? (
                  `कृपया तोकिएको मिति (${activeBill.dueDate}) भित्र समिति कार्यालय काउन्टरमा नगद, चेक वा बैंक भौचर मार्फत महसुल बुझाई आधिकारिक रसिद लिनुहोला। काउन्टर समय: ${settings.counterOpeningTime || 'बिहान १०:००'} देखि ${settings.counterClosingTime || 'दिउँसो ४:००'} सम्म।`
                ) : (
                  `Please pay at the committee office counter by ${activeBill.dueDate} to avoid late penalty. Office hours: ${settings.counterOpeningTime || '10:00 AM'} - ${settings.counterClosingTime || '4:00 PM'}.`
                )}
              </div>
            </div>

            {settings.billTemplate?.showSignatures !== false && (
              <div className="grid grid-cols-2 gap-6 pt-6 text-center text-xs">
                <div>
                  <div className="border-t border-slate-400 w-36 mx-auto pt-1 font-semibold text-slate-800">
                    {settings.billTemplate?.preparedByTitle || (lang === 'ne' ? 'तयार गर्ने कर्मचारी' : 'Prepared By')}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {lang === 'ne' ? 'महसुल शाखा / बिलिङ' : 'Billing Department'}
                  </div>
                </div>

                <div>
                  <div className="border-t border-slate-400 w-36 mx-auto pt-1 font-semibold text-slate-800">
                    {settings.billTemplate?.approvedByTitle || (lang === 'ne' ? 'अध्यक्ष / कोषाध्यक्ष' : 'Chairman / Treasurer')}
                  </div>
                  <div className="text-[10px] text-slate-500">{settings.committeeNameNepali}</div>
                </div>
              </div>
            )}

            {settings.billTemplate?.showSealSpace !== false && (
              <div className="text-center pt-2 print:pt-4">
                <div className="inline-block border border-dashed border-slate-300 px-4 py-1 rounded-lg text-[9px] text-slate-400 uppercase tracking-wider">
                  {lang === 'ne' ? '[ खानेपानी उपभोक्ता समितिको आधिकारिक छाप ]' : '[ Committee Official Seal ]'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
