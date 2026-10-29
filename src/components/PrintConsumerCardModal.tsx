import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Household, CommitteeSettings } from '../types';
import { formatNPR, toNepaliNumerals } from '../utils/nepaliCalendar';
import {
  X,
  Printer,
  Droplets,
  CreditCard,
  QrCode,
  ShieldCheck,
  MapPin,
  Phone,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

import { printDocument } from '../utils/printHelper';

interface PrintConsumerCardModalProps {
  household: Household | null;
  settings: CommitteeSettings;
  onClose: () => void;
}

export const PrintConsumerCardModal: React.FC<PrintConsumerCardModalProps> = ({
  household,
  settings,
  onClose,
}) => {
  const { lang, t } = useLanguage();

  if (!household) return null;

  const handlePrint = () => {
    printDocument('printable-consumer-card', {
      documentTitle: `Card_${household.customerCode}_${household.ownerName}`,
      paperSize: 'A4',
    });
  };

  return (
    <div className="printable-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
      <div className="printable-modal-card relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 print:border-none print:shadow-none print:m-0 print:w-full print:rounded-none transition-all">
        {/* Header Toolbar (Hidden in Print) */}
        <div className="bg-sky-900 text-white p-4 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-sky-300" />
            <h3 className="font-bold text-sm">
              {lang === 'ne' ? 'आधिकारिक उपभोक्ता परिचय पत्र' : 'Official Consumer Identity Card'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{lang === 'ne' ? 'कार्ड छाप्नुहोस् / PDF' : 'Print / Save PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-sky-200 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Card Body - Printable Area */}
        <div className="p-6 print:p-4 space-y-6" id="printable-consumer-card">
          {/* Card Front */}
          <div className="relative border-2 border-sky-800 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-white via-sky-50/40 to-blue-50/60 p-5">
            {/* Top Committee Header Banner */}
            <div className="border-b-2 border-sky-800/20 pb-3 flex items-center justify-between gap-3">
              <div className="w-12 h-12 rounded-xl bg-sky-700 flex items-center justify-center text-white shrink-0 shadow-sm">
                <Droplets className="w-7 h-7 fill-sky-200" />
              </div>
              <div className="text-center flex-1">
                <div className="font-black text-sm text-sky-950 leading-tight">
                  {settings.committeeNameNepali || 'श्री हायुटार खानेपानी तथा सरसफाइ उपभोक्ता समिति'}
                </div>
                <div className="text-[10px] text-sky-800 font-medium">
                  {settings.committeeName || 'Hayutar Drinking Water & Sanitation Committee'}
                </div>
                <div className="text-[9px] text-slate-500">
                  {settings.address} • दर्ता नं: {settings.registrationNumber || 'WSSDO-NP-2065/04'}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {household.status === 'ACTIVE' ? (lang === 'ne' ? 'सक्रिय' : 'ACTIVE') : (lang === 'ne' ? 'निष्क्रिय' : 'INACTIVE')}
                </span>
              </div>
            </div>

            {/* Badge Title */}
            <div className="my-2.5 text-center">
              <span className="inline-block px-4 py-0.5 rounded-full bg-sky-800 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-xs">
                {lang === 'ne' ? 'उपभोक्ता सदस्यता परिचय पत्र' : 'CONSUMER MEMBERSHIP CARD'}
              </span>
            </div>

            {/* Card Content Grid */}
            <div className="grid grid-cols-3 gap-4 items-center">
              {/* Photo & QR Box */}
              <div className="col-span-1 flex flex-col items-center justify-center border border-slate-200 bg-white p-2.5 rounded-xl text-center shadow-xs">
                <div className="w-18 h-18 bg-sky-50 border-2 border-dashed border-sky-300 rounded-lg flex flex-col items-center justify-center text-sky-600 mb-2">
                  <Droplets className="w-8 h-8 fill-sky-400" />
                  <span className="text-[8px] font-bold mt-1 text-sky-800">Hayutar Water</span>
                </div>
                {/* Visual Barcode / QR scan simulation with Customer Code */}
                <div className="w-full bg-slate-100 p-1 rounded font-mono text-[9px] text-slate-800 font-bold tracking-widest text-center border border-slate-200">
                  ||| || | |||| |
                  <div className="text-[8px] text-sky-900 font-bold">{household.customerCode}</div>
                </div>
              </div>

              {/* Consumer Info Details */}
              <div className="col-span-2 space-y-1.5 text-xs text-slate-800">
                <div className="flex justify-between py-0.5 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">{lang === 'ne' ? 'स्थायी ग्राहक नं (ID):' : 'Permanent Code:'}</span>
                  <span className="font-black text-sky-900 font-mono text-sm">{household.customerCode}</span>
                </div>

                <div className="flex justify-between py-0.5 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">{lang === 'ne' ? 'उपभोक्ताको नाम:' : 'Consumer Name:'}</span>
                  <span className="font-bold text-slate-900 text-right">{household.ownerName}</span>
                </div>

                <div className="flex justify-between py-0.5 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">{lang === 'ne' ? 'ग्राहक वर्ग (Category):' : 'Category:'}</span>
                  <span className="font-semibold text-purple-900 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                    {household.category || 'Residential (घरेलु)'}
                  </span>
                </div>

                <div className="flex justify-between py-0.5 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">{lang === 'ne' ? 'वडा / टोल:' : 'Ward / Tole:'}</span>
                  <span className="font-medium text-slate-800">
                    Ward {household.ward}, {household.tole || '-'}
                  </span>
                </div>

                <div className="flex justify-between py-0.5 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">{lang === 'ne' ? 'घर नं / धारा नं:' : 'House / Tap No:'}</span>
                  <span className="font-mono text-slate-800">
                    {household.householdNumber} • {household.connectionNumber || 'TAP-01'}
                  </span>
                </div>

                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500 font-semibold">{lang === 'ne' ? 'सम्पर्क फोन:' : 'Phone No:'}</span>
                  <span className="font-mono text-slate-800">{household.phoneNumber || '-'}</span>
                </div>
              </div>
            </div>

            {/* Bottom Signatures & Seal */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-end text-[10px] text-slate-600">
              <div>
                <div>जारी मिति (Issue Date): <strong>{household.registrationDate || '2081-01-01'}</strong></div>
                <div className="text-[9px] text-slate-400">Card ID: {household.id}</div>
              </div>

              <div className="text-center">
                <div className="w-16 h-8 border border-dashed border-slate-300 rounded flex items-center justify-center text-[8px] text-slate-400">
                  [समिति छाप]
                </div>
                <div className="text-[8px] text-slate-500 mt-0.5">Official Seal</div>
              </div>

              <div className="text-right">
                <div className="font-mono text-slate-800 font-bold border-b border-slate-400 pb-0.5">
                  Authorized Signatory
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">अध्यक्ष / अधिकृत हस्ताक्षर</div>
              </div>
            </div>
          </div>

          {/* Card Back / Instructions Notice */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-[11px] text-slate-600 space-y-1.5 print:mt-4">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-700" />
              <span>{lang === 'ne' ? 'उपभोक्ता कार्ड प्रयोग सम्बन्धी नियमहरू' : 'Card Usage Terms & Important Instructions'}</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[10px]">
              <li>यो कार्ड खानेपानी उपभोक्ता समितिको आधिकारिक सदस्य परिचय पत्र हो। महसुल बुझाउँदा यो कार्ड साथमा ल्याउनु अनिवार्य छ।</li>
              <li>स्थायी ग्राहक नम्बर परिवर्तन गर्न सकिने छैन। धारा स्थानान्तरण वा वर्ग परिवर्तन गर्दा समितिमा निवेदन दिनुपर्नेछ।</li>
              <li>प्रत्येक महिनाको २० गतेभित्र कार्यालय काउन्टरमा महसुल बुझाएमा जरिवानाबाट बच्न सकिनेछ।</li>
              <li>यो कार्ड हराएमा वा च्यातिएमा तुरुन्त कार्यालयमा सम्पर्क गरी नयाँ प्रतिलिपि लिनुहोस्।</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
