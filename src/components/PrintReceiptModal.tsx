import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Payment, CommitteeSettings, Household, ReceiptTemplateSettings } from '../types';
import { formatNPR, toNepaliNumerals, formatSystemDateTime } from '../utils/nepaliCalendar';
import { resolveConsumerInfo, ResolvedConsumerInfo } from '../utils/consumerHelper';
import { getHouseholdByCustomerCode, DEFAULT_RECEIPT_TEMPLATE } from '../services/dbService';
import {
  X,
  Printer,
  Droplets,
  CheckCircle2,
  User,
  Scissors,
  Layers,
  FileText,
  Building,
  Phone,
  QrCode,
} from 'lucide-react';
import { printDocument } from '../utils/printHelper';

interface PrintReceiptModalProps {
  payment: Payment | null;
  settings: CommitteeSettings;
  household?: Household | null;
  households?: Household[];
  onClose: () => void;
}

interface SingleReceiptCopyProps {
  copyType: 'office' | 'customer';
  payment: Payment;
  consumer: ResolvedConsumerInfo;
  settings: CommitteeSettings;
  template: ReceiptTemplateSettings;
  lang: 'en' | 'ne';
  isPos: boolean;
}

const SingleReceiptCopy: React.FC<SingleReceiptCopyProps> = ({
  copyType,
  payment,
  consumer,
  settings,
  template,
  lang,
  isPos,
}) => {
  const isOffice = copyType === 'office';
  const copyLabel = isOffice
    ? template.officeCopyLabelNepali || 'कार्यालय प्रति (OFFICE COPY)'
    : template.customerCopyLabelNepali || 'ग्राहक प्रति (CUSTOMER COPY)';

  const formattedDate = formatSystemDateTime(payment.date || payment.createdAt, {
    settings: settings.dateTimeSettings,
    includeTime: true,
    lang,
  });

  const formattedAmount = formatNPR(payment.amount, lang);
  const formattedBalance = formatNPR(consumer.currentBalance, lang);

  return (
    <div
      className={`receipt-half-copy relative bg-white border rounded-xl overflow-hidden print:border-none print:shadow-none print:rounded-none ${
        template.borderStyle === 'double'
          ? 'border-2 border-dashed border-slate-300'
          : template.borderStyle === 'clean'
          ? 'border-none'
          : 'border border-slate-300'
      } ${isPos ? 'p-3 text-[11px]' : 'p-3.5 text-xs'}`}
    >
      {/* Top Banner with Copy Badge */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {template.showLogo !== false && (
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              {template.logoUrl || settings.logoUrl ? (
                <img
                  src={template.logoUrl || settings.logoUrl}
                  alt="Emblem"
                  className="w-full h-full object-contain rounded-full"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Droplets className="w-4 h-4 text-emerald-700" />
              )}
            </div>
          )}
          <div>
            <h3 className="font-black text-slate-900 text-xs sm:text-sm tracking-tight leading-tight">
              {settings.committeeNameNepali || 'श्री हायुटार खानेपानी तथा सरसफाइ उपभोक्ता समिति'}
            </h3>
            <div className="text-[10px] font-semibold text-slate-600 leading-tight">
              {template.waterProjectNameNepali || settings.committeeName}
            </div>
            <div className="text-[9px] text-slate-500 leading-tight">
              {template.headerAddressNepali || settings.address} • फोन: {template.phone || settings.phone}
              {template.panNumber || settings.panNumber
                ? ` • स्थायी लेखा नं (PAN): ${template.panNumber || settings.panNumber}`
                : ''}
            </div>
          </div>
        </div>

        {/* Copy Indicator Badge */}
        <div className="text-right shrink-0">
          <span
            className={`inline-block px-2.5 py-1 rounded-md font-black text-[10px] tracking-wider uppercase shadow-xs ${
              isOffice
                ? 'bg-purple-100 text-purple-900 border border-purple-300 print:bg-purple-100 print:text-purple-900'
                : 'bg-emerald-100 text-emerald-900 border border-emerald-300 print:bg-emerald-100 print:text-emerald-900'
            }`}
          >
            {copyLabel}
          </span>
          <div className="text-[9px] text-slate-400 mt-0.5 font-mono">
            {template.registrationNumber || settings.registrationNumber
              ? `दर्ता नं: ${template.registrationNumber || settings.registrationNumber}`
              : ''}
          </div>
        </div>
      </div>

      {/* Receipt Meta & Identification Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1.5 my-1.5 bg-slate-50/80 rounded-lg px-2 border border-slate-200 text-[10px]">
        <div>
          <span className="text-slate-500 block">{lang === 'ne' ? 'रसिद नम्बर:' : 'Receipt No:'}</span>
          <span className="font-black font-mono text-emerald-800 text-xs">{payment.receiptNumber}</span>
        </div>
        <div>
          <span className="text-slate-500 block">{lang === 'ne' ? 'भुक्तानी मिति / समय:' : 'Payment Date/Time:'}</span>
          <span className="font-semibold text-slate-800">{formattedDate}</span>
        </div>
        <div>
          <span className="text-slate-500 block">{lang === 'ne' ? 'भुक्तानी माध्यम:' : 'Payment Mode:'}</span>
          <span className="font-bold text-slate-800">
            {payment.paymentMethod === 'CASH'
              ? (lang === 'ne' ? 'नगद (Cash)' : 'Cash')
              : payment.paymentMethod === 'BANK_DEPOSIT'
              ? (lang === 'ne' ? 'बैंक भौचर (Bank)' : 'Bank Voucher')
              : payment.paymentMethod === 'CHEQUE'
              ? (lang === 'ne' ? 'चेक (Cheque)' : 'Cheque')
              : payment.paymentMethod}
          </span>
        </div>
        <div className="text-right sm:text-left">
          <span className="text-slate-500 block">{lang === 'ne' ? 'भौचर / ट्रान्ज्याक्सन नं:' : 'Txn / Slip Ref:'}</span>
          <span className="font-mono text-slate-700">{payment.transactionReference || '-'}</span>
        </div>
      </div>

      {/* Consumer Details Card */}
      <div className="bg-emerald-50/50 rounded-lg p-2 border border-emerald-100 text-[10px] space-y-1">
        <div className="flex justify-between items-center border-b border-emerald-200/60 pb-1">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
            <span className="font-extrabold text-slate-900 text-xs">{consumer.fullName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">{lang === 'ne' ? 'स्थायी ग्राहक कोड:' : 'Permanent ID:'}</span>
            <span className="font-mono font-black text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded text-[11px]">
              {consumer.customerCode}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5 text-[10px]">
          <div>
            <span className="text-slate-500">{lang === 'ne' ? 'घरधुरी नं:' : 'Household No:'}</span>{' '}
            <span className="font-semibold text-slate-800">{consumer.householdNumber}</span>
          </div>
          <div>
            <span className="text-slate-500">{lang === 'ne' ? 'धारा जडान नं:' : 'Connection No:'}</span>{' '}
            <span className="font-semibold text-slate-800">{consumer.connectionNumber || '-'}</span>
          </div>
          <div>
            <span className="text-slate-500">{lang === 'ne' ? 'वडा तथा टोल:' : 'Ward & Tole:'}</span>{' '}
            <span className="font-semibold text-slate-800">
              {consumer.ward !== 'उपलब्ध छैन' ? (lang === 'ne' ? `वडा ${toNepaliNumerals(consumer.ward)}` : `Ward ${consumer.ward}`) : '-'}
              {consumer.tole ? `, ${consumer.tole}` : ''}
            </span>
          </div>
          <div>
            <span className="text-slate-500">{lang === 'ne' ? 'सम्पर्क फोन:' : 'Phone:'}</span>{' '}
            <span className="font-mono font-medium text-slate-800">{consumer.phoneNumber || '-'}</span>
          </div>
        </div>
      </div>

      {/* Financial Settlement Table */}
      <div className="mt-1.5 border border-slate-200 rounded-lg overflow-hidden bg-white text-[10px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <th className="py-1 px-2.5">{lang === 'ne' ? 'विवरण (Description)' : 'Description'}</th>
              <th className="py-1 px-2.5 text-center">{lang === 'ne' ? 'बिल संकेत' : 'Bill Ref'}</th>
              <th className="py-1 px-2.5 text-right">{lang === 'ne' ? 'रकम (Amount)' : 'Amount'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-1 px-2.5 font-medium text-slate-800">
                {lang === 'ne' ? 'खानेपानी महसुल तथा सरसफाइ सेवा शुल्क भुक्तानी' : 'Water Consumption & Utility Payment'}
              </td>
              <td className="py-1 px-2.5 text-center font-mono text-slate-600">
                {payment.billNumber || payment.billId || '-'}
              </td>
              <td className="py-1 px-2.5 text-right font-black text-slate-900">
                {formattedAmount}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Ledger Balance Summary Strip */}
        <div className="flex justify-between items-center bg-emerald-50/80 px-2.5 py-1.5 border-t border-emerald-200 text-xs">
          <div className="font-black text-emerald-950">
            {lang === 'ne' ? 'जम्मा बुझिलिएको रकम (Total Received):' : 'Total Amount Received:'}
          </div>
          <div className="font-black text-emerald-900 text-sm">
            {formattedAmount}
          </div>
        </div>

        {template.showPreviousDueBreakdown !== false && (
          <div className="flex justify-between items-center px-2.5 py-1 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-600">
            <span>{lang === 'ne' ? 'भुक्तानी पछिको बाँकी हिसाब (Remaining Ledger Balance):' : 'Current Balance Due:'}</span>
            <span className="font-bold text-slate-800">{formattedBalance}</span>
          </div>
        )}
      </div>

      {/* Remarks if present */}
      {payment.remarks && (
        <div className="mt-1 text-[9px] text-slate-600 italic bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
          <strong>{lang === 'ne' ? 'कैफियत:' : 'Remarks:'}</strong> {payment.remarks}
        </div>
      )}

      {/* Official Signatures and Seal Blocks */}
      <div className="mt-2.5 pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-center text-[9px] text-slate-600">
        <div>
          <div className="border-t border-slate-400 w-24 mx-auto pt-0.5 font-bold text-slate-900 truncate">
            {payment.staffName || 'Authorized Cashier'}
          </div>
          <div className="text-[9px] text-slate-500">
            {template.cashierTitleNepali || (lang === 'ne' ? 'रकम बुझिलिने (क्यासियर)' : 'Cashier')}
          </div>
        </div>

        {template.showSignatures !== false && (
          <div>
            <div className="border-t border-slate-400 w-24 mx-auto pt-0.5 font-bold text-slate-900">
              {template.accountantTitleNepali || (lang === 'ne' ? 'लेखापाल' : 'Accountant')}
            </div>
            <div className="text-[9px] text-slate-500">
              {lang === 'ne' ? 'जाँच गर्ने / लेखा' : 'Accounts Section'}
            </div>
          </div>
        )}

        <div>
          <div className="border-t border-slate-400 w-24 mx-auto pt-0.5 font-bold text-slate-900">
            {template.chairpersonTitleNepali || (lang === 'ne' ? 'अध्यक्ष / समिति छाप' : 'Chairperson / Seal')}
          </div>
          <div className="text-[9px] text-slate-500 truncate">
            {settings.committeeNameNepali || 'उपभोक्ता समिति'}
          </div>
        </div>
      </div>

      {/* Official System Disclaimer Notice */}
      <div className="text-[8px] text-slate-400 text-center italic mt-1.5 leading-tight">
        {template.receiptNotice ||
          (lang === 'ne'
            ? 'यो कम्प्युटर प्रणालीबाट जारी गरिएको आधिकारिक भुक्तानी रसिद हो। कृपया सुरक्षित राख्नुहोला।'
            : 'This is a system generated official receipt. Please preserve for records.')}
      </div>
    </div>
  );
};

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  payment,
  settings,
  household,
  households = [],
  onClose,
}) => {
  const { lang, t } = useLanguage();
  // Layout modes: 'dual' (Dual copy on 1 A4 sheet: Office + Customer copy), 'single' (Single copy), 'pos' (80mm thermal)
  const [printLayout, setPrintLayout] = useState<'dual' | 'single' | 'pos'>('dual');
  const [fetchedHousehold, setFetchedHousehold] = useState<Household | null>(household || null);

  const template: ReceiptTemplateSettings = {
    ...DEFAULT_RECEIPT_TEMPLATE,
    ...(settings.receiptTemplate || {}),
  };

  useEffect(() => {
    let isMounted = true;
    async function loadMissingConsumer() {
      if (!payment) return;
      if (household) {
        setFetchedHousehold(household);
        return;
      }
      const existing = households.find(
        (h) => h.customerCode === payment.customerId || h.id === payment.householdId || h.id === payment.customerId
      );
      if (existing) {
        setFetchedHousehold(existing);
        return;
      }

      // Fetch from database using customerId
      if (payment.customerId) {
        try {
          const doc = await getHouseholdByCustomerCode(payment.customerId);
          if (isMounted && doc) {
            setFetchedHousehold(doc);
          }
        } catch (err) {
          console.warn('Failed to fetch consumer document for receipt:', err);
        }
      }
    }

    loadMissingConsumer();
    return () => {
      isMounted = false;
    };
  }, [payment, household, households]);

  if (!payment) return null;

  const combinedHouseholds = fetchedHousehold ? [fetchedHousehold, ...households] : households;
  const consumer: ResolvedConsumerInfo = resolveConsumerInfo(payment, combinedHouseholds);

  const handlePrint = () => {
    printDocument('printable-receipt', {
      documentTitle: `Receipt_${payment.receiptNumber}_${consumer.customerCode}`,
      paperSize: printLayout === 'pos' ? 'POS80' : 'A4',
    });
  };

  return (
    <div className="printable-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
      <div
        className={`printable-modal-card relative bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 print:border-none print:shadow-none print:m-0 print:rounded-none ${
          printLayout === 'pos' ? 'w-full max-w-sm' : 'w-full max-w-3xl'
        }`}
      >
        {/* Toolbar Header (Hidden during native print) */}
        <div className="bg-emerald-800 text-white p-3.5 sm:p-4 flex flex-wrap justify-between items-center gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            <div>
              <span className="font-bold text-sm block">
                {lang === 'ne' ? 'भुक्तानी रसिद प्रिन्ट (Payment Receipt)' : 'Official Payment Receipt'}
              </span>
              <span className="text-[11px] text-emerald-200">
                {printLayout === 'dual'
                  ? (lang === 'ne' ? '१ पानामा २ प्रति: कार्यालय प्रति र ग्राहक प्रति' : 'Single A4: Office Copy & Customer Copy')
                  : printLayout === 'single'
                  ? (lang === 'ne' ? 'एकल प्रति (Single Copy)' : 'Single Copy')
                  : '80mm POS Thermal'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Layout selector buttons */}
            <div className="inline-flex rounded-lg bg-emerald-900/60 p-0.5 border border-emerald-700 text-xs">
              <button
                type="button"
                onClick={() => setPrintLayout('dual')}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  printLayout === 'dual'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-emerald-100 hover:text-white'
                }`}
                title="Print 2 copies on 1 A4 sheet: Office Copy + Customer Copy"
              >
                {lang === 'ne' ? 'दुई प्रति (A4)' : 'Dual Copy (A4)'}
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('single')}
                className={`px-2 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  printLayout === 'single'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-emerald-100 hover:text-white'
                }`}
              >
                {lang === 'ne' ? 'एकल प्रति' : 'Single'}
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('pos')}
                className={`px-2 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  printLayout === 'pos'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-emerald-100 hover:text-white'
                }`}
              >
                POS (80mm)
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs rounded-lg bg-white text-emerald-900 font-bold flex items-center gap-1.5 shadow-md hover:bg-emerald-50 cursor-pointer transition-all"
            >
              <Printer className="w-4 h-4 text-emerald-800" />
              <span>{t('printReceipt')}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Container (Target of print helper) */}
        <div
          id="printable-receipt"
          className="p-4 sm:p-6 bg-white space-y-3 font-sans print:p-2 text-slate-800"
        >
          {printLayout === 'dual' ? (
            <>
              {/* TOP HALF: कार्यालय प्रति (OFFICE COPY) */}
              <SingleReceiptCopy
                copyType="office"
                payment={payment}
                consumer={consumer}
                settings={settings}
                template={template}
                lang={lang}
                isPos={false}
              />

              {/* HORIZONTAL CUT LINE / कैंची चिन्ह */}
              <div className="receipt-cut-line relative flex items-center justify-center my-3 py-1 print:my-2 text-slate-400 select-none">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-dashed border-slate-300 print:border-slate-400" />
                </div>
                <span className="relative bg-white px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border border-dashed border-slate-300 rounded-full py-0.5 print:bg-white">
                  <Scissors className="w-3.5 h-3.5 text-slate-600 inline" />
                  <span>{lang === 'ne' ? 'कैंची चिन्ह / यहाँबाट काट्नुहोस् (CUT HERE)' : '--- CUT ALONG DASHED LINE ---'}</span>
                </span>
              </div>

              {/* BOTTOM HALF: ग्राहक प्रति (CUSTOMER COPY) */}
              <SingleReceiptCopy
                copyType="customer"
                payment={payment}
                consumer={consumer}
                settings={settings}
                template={template}
                lang={lang}
                isPos={false}
              />
            </>
          ) : (
            <SingleReceiptCopy
              copyType="customer"
              payment={payment}
              consumer={consumer}
              settings={settings}
              template={template}
              lang={lang}
              isPos={printLayout === 'pos'}
            />
          )}
        </div>
      </div>
    </div>
  );
};
