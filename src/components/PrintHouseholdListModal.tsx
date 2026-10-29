import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Household, CommitteeSettings } from '../types';
import { formatNPR, toNepaliNumerals } from '../utils/nepaliCalendar';
import { X, Printer, Droplets, Users } from 'lucide-react';

import { printDocument } from '../utils/printHelper';

interface PrintHouseholdListModalProps {
  households: Household[];
  settings: CommitteeSettings;
  wardFilter: string;
  onClose: () => void;
}

export const PrintHouseholdListModal: React.FC<PrintHouseholdListModalProps> = ({
  households,
  settings,
  wardFilter,
  onClose,
}) => {
  const { lang, t } = useLanguage();

  const handlePrint = () => {
    printDocument('printable-roster', {
      documentTitle: `Household_Directory_Ward_${wardFilter}`,
      paperSize: 'A4',
    });
  };

  return (
    <div className="printable-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
      <div className="printable-modal-card relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 print:border-none print:shadow-none print:m-0 print:w-full print:rounded-none">
        {/* Toolbar */}
        <div className="bg-sky-800 text-white p-4 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-200" />
            <span className="font-bold text-sm">
              {lang === 'ne' ? 'उपभोक्ता घरधुरी नामावली (मुद्रण प्रति)' : 'Household Consumer Directory (Print Preview)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{lang === 'ne' ? 'सूचि छाप्नुहोस्' : 'Print Roster'}</span>
            </button>
            <button onClick={onClose} className="p-1 text-sky-200 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div className="p-8 space-y-4 text-slate-800 font-sans print:p-4" id="printable-roster">
          {/* Header */}
          <div className="text-center border-b-2 border-sky-800 pb-3">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Droplets className="w-6 h-6 text-sky-700" />
              <h1 className="text-xl font-black text-slate-900">{settings.committeeNameNepali}</h1>
            </div>
            <div className="text-xs text-slate-600 font-medium">{settings.committeeName}</div>
            <div className="text-[11px] text-slate-500">
              {settings.address} • दर्ता नं: {settings.registrationNumber}
            </div>
            <div className="mt-2 inline-block px-3 py-0.5 rounded-full bg-sky-100 text-sky-900 font-bold text-xs uppercase">
              {lang === 'ne'
                ? `उपभोक्ता घरधुरी दर्ता विवरण (कुल: ${toNepaliNumerals(households.length)})`
                : `Consumer Household Register (Total: ${households.length} records)`}
              {wardFilter !== 'ALL' && ` • Ward ${wardFilter}`}
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                <tr>
                  <th className="py-2 px-2.5">क्र.सं.</th>
                  <th className="py-2 px-2.5">ग्राहक नं (Code)</th>
                  <th className="py-2 px-2.5">घर नं</th>
                  <th className="py-2 px-2.5">उपभोक्ताको नाम</th>
                  <th className="py-2 px-2.5">वडा / टोल</th>
                  <th className="py-2 px-2.5">सम्पर्क नं</th>
                  <th className="py-2 px-2.5">धारा / मिटर नं</th>
                  <th className="py-2 px-2.5 text-right">मासिक शुल्क</th>
                  <th className="py-2 px-2.5 text-right">बाँकी रकम</th>
                  <th className="py-2 px-2.5 text-center">स्थिति</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {households.map((h, idx) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2.5 text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-2.5 font-bold font-mono text-sky-800">{h.customerCode}</td>
                    <td className="py-2 px-2.5 text-slate-700">{h.householdNumber}</td>
                    <td className="py-2 px-2.5 font-semibold text-slate-900">{h.ownerName}</td>
                    <td className="py-2 px-2.5 text-slate-600">Ward {h.ward}, {h.tole}</td>
                    <td className="py-2 px-2.5 font-mono text-slate-600">{h.phoneNumber}</td>
                    <td className="py-2 px-2.5 text-slate-700">{h.connectionNumber || h.meterNumber}</td>
                    <td className="py-2 px-2.5 text-right font-medium">रु {h.monthlyFixedCharge || 150}</td>
                    <td className={`py-2 px-2.5 text-right font-bold ${h.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatNPR(h.currentBalance, lang)}
                    </td>
                    <td className="py-2 px-2.5 text-center font-semibold">
                      {h.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer with signatures */}
          <div className="pt-8 grid grid-cols-3 gap-6 text-center text-[10px] text-slate-500">
            <div>
              <div className="border-t border-slate-400 w-32 mx-auto pt-1 font-semibold text-slate-800">
                क्षेत्रीय प्राविधिक / कर्मचारी
              </div>
              <div>Field / Area Staff</div>
            </div>
            <div>
              <div className="border-t border-slate-400 w-32 mx-auto pt-1 font-semibold text-slate-800">
                प्रमाणीकरण मिति
              </div>
              <div>{new Date().toISOString().slice(0, 10)}</div>
            </div>
            <div>
              <div className="border-t border-slate-400 w-32 mx-auto pt-1 font-semibold text-slate-800">
                समिति अध्यक्ष / सचिव
              </div>
              <div>Authorized Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
