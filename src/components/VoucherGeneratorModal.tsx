import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Bill, Household, CommitteeSettings, Voucher } from '../types';
import { formatNPR, toNepaliNumerals } from '../utils/nepaliCalendar';
import { createVoucher } from '../services/dbService';
import { resolveConsumerInfo, ResolvedConsumerInfo } from '../utils/consumerHelper';
import { printDocument } from '../utils/printHelper';
import {
  X,
  Printer,
  FileCheck,
  Droplets,
  AlertCircle,
  QrCode,
  Download,
  Receipt,
  FileText,
  User,
  MapPin,
  Building,
} from 'lucide-react';

interface VoucherGeneratorModalProps {
  bill: Bill;
  household: Household;
  settings: CommitteeSettings;
  onClose: () => void;
}

export const VoucherGeneratorModal: React.FC<VoucherGeneratorModalProps> = ({
  bill,
  household,
  settings,
  onClose,
}) => {
  const { lang, t } = useLanguage();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [layoutMode, setLayoutMode] = useState<'a4' | 'thermal'>('a4');

  const consumer: ResolvedConsumerInfo = resolveConsumerInfo(bill, [household]);

  // Auto-generate voucher record on mount if not yet generated
  useEffect(() => {
    async function initVoucher() {
      setLoading(true);
      try {
        const v = await createVoucher(bill, household);
        setVoucher(v);
      } catch (err: any) {
        setError(err.message || 'Error generating voucher');
      } finally {
        setLoading(false);
      }
    }
    initVoucher();
  }, [bill, household]);

  const handlePrint = () => {
    printDocument('printable-voucher', {
      documentTitle: `Voucher_${voucher?.voucherNumber || bill.billNumber}_${consumer.customerCode}`,
      paperSize: layoutMode === 'thermal' ? 'POS80' : 'A4',
    });
  };

  return (
    <div className="printable-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
      <div
        className={`printable-modal-card relative w-full ${
          layoutMode === 'thermal' ? 'max-w-sm' : 'max-w-2xl'
        } bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 print:border-none print:shadow-none print:m-0 print:w-full print:rounded-none transition-all duration-200`}
      >
        {/* Toolbar */}
        <div className="bg-sky-800 text-white p-4 flex flex-wrap justify-between items-center gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-sky-200" />
            <span className="font-bold text-sm">
              {lang === 'ne' ? 'काउन्टर / बैंक भुक्तानी भौचर' : 'Official Payment Voucher'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Format toggle */}
            <div className="flex bg-sky-900/80 rounded-lg p-0.5 border border-sky-700 text-[11px]">
              <button
                type="button"
                onClick={() => setLayoutMode('a4')}
                className={`px-2 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors ${
                  layoutMode === 'a4'
                    ? 'bg-white text-sky-900 shadow-xs'
                    : 'text-sky-200 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>A4</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('thermal')}
                className={`px-2 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors ${
                  layoutMode === 'thermal'
                    ? 'bg-white text-sky-900 shadow-xs'
                    : 'text-sky-200 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>80mm</span>
              </button>
            </div>

            <button
              onClick={handlePrint}
              disabled={loading || !voucher}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>{lang === 'ne' ? 'छाप्नुहोस् / PDF' : 'Print / Save PDF'}</span>
            </button>
            <button onClick={onClose} className="p-1 text-sky-200 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <span>{lang === 'ne' ? 'भौचर विवरण लोड हुँदैछ...' : 'Generating voucher document...'}</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="font-semibold">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium"
            >
              बन्द गर्नुहोस्
            </button>
          </div>
        ) : voucher ? (
          layoutMode === 'thermal' ? (
            /* =====================================
               80MM COMPACT RECEIPT/THERMAL LAYOUT
               ===================================== */
            <div className="p-5 space-y-3 text-slate-800 font-mono text-xs print:p-2" id="printable-voucher-thermal">
              <div className="text-center border-b border-dashed border-slate-400 pb-2">
                <div className="font-bold text-sm text-slate-900">{settings.committeeNameNepali}</div>
                <div className="text-[10px] text-slate-600">{settings.committeeName}</div>
                <div className="text-[10px] text-slate-500">{settings.address} • {settings.phone}</div>
                <div className="mt-1 font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] inline-block">
                  *** BANK VOUCHER (UNPAID) ***
                </div>
              </div>

              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>VOUCHER NO:</span>
                  <span className="font-bold">{voucher.voucherNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE:</span>
                  <span>{voucher.issueDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>CUST CODE:</span>
                  <span className="font-bold">{consumer.customerCode}</span>
                </div>
                <div className="flex justify-between">
                  <span>NAME:</span>
                  <span className="font-bold">{consumer.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span>HHD NO:</span>
                  <span>{consumer.householdNumber} ({consumer.ward !== 'उपलब्ध छैन' ? `Ward ${consumer.ward}` : ''})</span>
                </div>
                <div className="flex justify-between">
                  <span>CONN NO:</span>
                  <span>{consumer.connectionNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>PERIOD:</span>
                  <span>{voucher.billingPeriod}</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="text-[11px] space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>Previous Dues:</span>
                  <span>{formatNPR(bill.previousBalance, lang)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Charge:</span>
                  <span>{formatNPR(bill.monthlyCharge, lang)}</span>
                </div>
                {bill.penaltyAmount > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>Late Penalty:</span>
                    <span>+{formatNPR(bill.penaltyAmount, lang)}</span>
                  </div>
                )}
                {bill.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Early Discount:</span>
                    <span>-{formatNPR(bill.discountAmount, lang)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-300">
                  <span>TOTAL PAYABLE:</span>
                  <span>{formatNPR(bill.totalAmount, lang)}</span>
                </div>
              </div>

              {/* Bank Info */}
              <div className="text-[10px] bg-slate-50 p-2 rounded border border-slate-300 space-y-0.5">
                <div><strong>Bank:</strong> {settings.bankName || 'Nepal Bank Limited'}</div>
                <div><strong>A/C:</strong> {settings.bankAccountNumber || '01900100234567'}</div>
                <div><strong>Branch:</strong> {settings.bankBranch || 'Main Branch'}</div>
                <div><strong>Status:</strong> <span className="text-amber-800 font-bold">UNPAID (Pending Deposit)</span></div>
              </div>

              <div className="pt-2 text-center text-[10px] text-slate-500">
                <div>Present this slip at bank counter or committee desk.</div>
                <div className="mt-1 font-bold">Teller Stamp: [____________]</div>
              </div>
            </div>
          ) : (
            /* =====================================
               FULL A4 OFFICIAL DOCUMENT LAYOUT
               ===================================== */
            <div className="p-8 space-y-5 text-slate-800 font-sans print:p-6" id="printable-voucher-a4">
              {/* Header */}
              <div className="text-center border-b-2 border-sky-800 pb-3">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Droplets className="w-6 h-6 text-sky-700" />
                  <h2 className="text-lg font-black text-slate-900">
                    {settings.committeeNameNepali}
                  </h2>
                </div>
                <div className="text-xs text-slate-600 font-medium">{settings.committeeName}</div>
                <div className="text-xs text-slate-500">
                  {settings.address} • {settings.phone}
                </div>

                <div className="mt-2 inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-xs uppercase tracking-wider">
                  <span>{lang === 'ne' ? 'महसुल भुक्तानी भौचर' : 'UTILITY PAYMENT VOUCHER'}</span>
                  <span>•</span>
                  <span className="text-rose-700">UNPAID (भुक्तानी हुन बाँकी)</span>
                </div>
              </div>

              {/* Voucher Meta */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500">{lang === 'ne' ? 'भौचर नम्बर:' : 'Voucher No:'}</span>{' '}
                  <span className="font-bold font-mono text-sky-800 text-sm">{voucher.voucherNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500">{lang === 'ne' ? 'जारी मिति:' : 'Date:'}</span>{' '}
                  <span className="font-semibold">{voucher.issueDate}</span>
                </div>
                <div>
                  <span className="text-slate-500">{t('status')}:</span>{' '}
                  <span className="font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                    UNPAID (अपुष्ट)
                  </span>
                </div>
              </div>

              {/* Consumer Full Identity Card */}
              <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 space-y-2 text-xs">
                <div className="flex justify-between items-start border-b border-sky-100 pb-2">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                      {lang === 'ne' ? 'उपभोक्ताको पूरा नाम:' : 'Consumer Full Name:'}
                    </span>
                    <div className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 mt-0.5">
                      <User className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span>{consumer.fullName}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full font-mono">
                      {consumer.customerCode}
                    </span>
                    <div className="text-[11px] text-slate-500 mt-1">
                      वर्ग: <strong>{consumer.category}</strong>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">{t('householdNumber')}:</span>{' '}
                    <span className="font-semibold text-slate-800">{consumer.householdNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">{lang === 'ne' ? 'धारा जडान नं:' : 'Connection No:'}</span>{' '}
                    <span className="font-semibold text-slate-800">{consumer.connectionNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('ward')}:</span>{' '}
                    <span className="font-semibold text-slate-800">
                      {consumer.ward !== 'उपलब्ध छैन' ? (lang === 'ne' ? `वडा नं ${toNepaliNumerals(consumer.ward)}` : `Ward ${consumer.ward}`) : 'उपलब्ध छैन'}
                      {consumer.tole ? `, ${consumer.tole}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">सम्पर्क:</span>{' '}
                    <span className="font-mono text-slate-800">{consumer.phoneNumber}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500">ठेगाना:</span>{' '}
                    <span className="text-slate-800">{consumer.address}</span>
                  </div>
                </div>
              </div>

              {/* Due Details & Financial Breakdown */}
              <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-white text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{t('billingPeriod')}:</span>
                  <span className="font-bold text-sky-900">{voucher.billingPeriod}</span>
                </div>

                {/* Financial breakdown */}
                <div className="pt-1 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>{lang === 'ne' ? 'अघिल्लो बाँकी बक्यौता:' : 'Previous Arrears:'}</span>
                    <span className="font-semibold">{formatNPR(bill.previousBalance, lang)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{lang === 'ne' ? 'चालु महिनाको महसुल:' : 'Current Month Fixed Tariff:'}</span>
                    <span className="font-semibold">{formatNPR(bill.monthlyCharge, lang)}</span>
                  </div>
                  {bill.sanitationCharge > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>{t('sanitationCharge')}:</span>
                      <span className="font-semibold">{formatNPR(bill.sanitationCharge, lang)}</span>
                    </div>
                  )}
                  {bill.penaltyAmount > 0 && (
                    <div className="flex justify-between text-rose-700">
                      <span>{lang === 'ne' ? 'विलम्ब शुल्क (जरिवाना):' : 'Late Payment Penalty:'}</span>
                      <span className="font-semibold">+{formatNPR(bill.penaltyAmount, lang)}</span>
                    </div>
                  )}
                  {bill.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>{lang === 'ne' ? 'समयमै भुक्तानी छुट:' : 'Early Payment Discount:'}</span>
                      <span className="font-semibold">-{formatNPR(bill.discountAmount, lang)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 border-t-2 border-sky-800 text-sm font-extrabold text-rose-700 bg-rose-50/50 px-3 rounded-lg">
                    <span>{lang === 'ne' ? 'कुल भुक्तानी गर्नुपर्ने रकम (Total Amount Due):' : 'Total Amount Due:'}</span>
                    <span>{formatNPR(bill.totalAmount, lang)}</span>
                  </div>
                </div>
              </div>

              {/* Bank Deposit instructions */}
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-950 space-y-1">
                <p className="font-bold text-sky-900 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-sky-700" />
                  <span>{lang === 'ne' ? 'बैंक खाता वा काउन्टर भुक्तानी विवरण:' : 'Bank Deposit / Counter Details:'}</span>
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>बैंक: <strong>{settings.bankName || 'Nepal Bank Limited'}</strong></div>
                  <div>खाता नं: <strong className="font-mono">{settings.bankAccountNumber || '01900100234567'}</strong></div>
                  <div>शाखा: <strong>{settings.bankBranch || 'Main Branch'}</strong></div>
                  <div>खातावाला: <strong>{settings.committeeNameNepali}</strong></div>
                </div>
              </div>

              {/* QR Code and Barcode Reference */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-white p-1 rounded-lg border border-slate-300 flex items-center justify-center shrink-0">
                    <QrCode className="w-12 h-12 text-slate-900" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-[11px]">
                      {lang === 'ne' ? 'डिजिटल स्क्यान तथा बैंक सन्दर्भ कोड' : 'Digital Reference & QR'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      REF: {voucher.voucherNumber} • AMT: NPR {bill.totalAmount}
                    </div>
                    <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                      सूचना: रकम बुझाएपछि बैंक वा काउन्टरबाट छाप लगाई आधिकारिक रसिद प्राप्त गर्नुहोस्।
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono hidden sm:block">
                  <div className="border border-slate-300 px-3 py-1.5 rounded-lg bg-white inline-block text-center">
                    <div className="text-sm tracking-widest font-black text-slate-800">
                      ||| | |||| | |||||| || |
                    </div>
                    <div className="text-[9px] text-slate-500">{voucher.voucherNumber}</div>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-4 grid grid-cols-2 gap-4 text-center text-[10px] text-slate-500">
                <div>
                  <div className="border-t border-slate-400 w-32 mx-auto pt-1 font-semibold text-slate-800">
                    {lang === 'ne' ? 'उपभोक्ताको सही' : 'Depositor Signature'}
                  </div>
                </div>
                <div>
                  <div className="border-t border-slate-400 w-32 mx-auto pt-1 font-semibold text-slate-800">
                    {lang === 'ne' ? 'बैंक टेलर / काउन्टर छाप' : 'Bank Teller / Cashier Stamp'}
                  </div>
                </div>
              </div>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
};
