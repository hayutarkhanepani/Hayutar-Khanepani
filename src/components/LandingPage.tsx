import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { CommitteeSettings, Tariff, Bill, Household } from '../types';
import { formatNPR, toNepaliNumerals } from '../utils/nepaliCalendar';
import { getHouseholdByCustomerCode } from '../services/dbService';
import {
  Droplets,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Phone,
  MapPin,
  Mail,
  ShieldCheck,
  CreditCard,
  UserPlus,
  LogIn,
  ArrowRight,
  Sparkles,
  Building,
  Calendar,
  Lock,
  Bell,
} from 'lucide-react';

interface LandingPageProps {
  settings: CommitteeSettings;
  tariffs: Tariff[];
  openAuthModal: (mode: 'login' | 'register' | 'admin') => void;
  onViewBill?: (bill: Bill) => void;
  onNavigateToLookup?: (code?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  settings,
  tariffs,
  openAuthModal,
  onViewBill,
  onNavigateToLookup,
}) => {
  const { lang, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    customerCode: string;
    ward: string;
    status: string;
    exists: boolean;
  } | null>(null);
  const [searchError, setSearchError] = useState('');

  const handleQuickSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = searchQuery.trim().toUpperCase();
    if (!code) {
      if (onNavigateToLookup) {
        onNavigateToLookup();
      }
      return;
    }
    if (onNavigateToLookup) {
      onNavigateToLookup(code);
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const h = await getHouseholdByCustomerCode(code);
      if (!h) {
        setSearchError(
          lang === 'ne'
            ? 'यो स्थायी ग्राहक नम्बर प्रणालीमा फेला परेन। कृपया आफ्नो ग्राहक कोड (जस्तै: HYT-00101) जाँच गर्नुहोस् वा नयाँ खाता खोल्नुहोस्।'
            : 'No consumer record found for this Permanent Code. Please verify your Code (e.g. HYT-00101) or create a new ID.'
        );
      } else {
        setSearchResult({
          customerCode: h.customerCode,
          ward: h.ward,
          status: h.status,
          exists: true,
        });
      }
    } catch (err) {
      setSearchError('Error verifying consumer record. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Public Announcement Ticker / Banner */}
      {settings.publicNoticeActive && settings.publicNotice && (
        <div
          className={`py-2.5 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b shadow-xs transition-all ${
            settings.publicNoticeType === 'urgent'
              ? 'bg-rose-600 text-white border-rose-700'
              : settings.publicNoticeType === 'warning'
              ? 'bg-amber-500 text-amber-950 border-amber-600'
              : 'bg-sky-700 text-sky-100 border-sky-800'
          }`}
        >
          <Bell className="w-4 h-4 shrink-0 animate-bounce" />
          <span className="font-bold uppercase tracking-wider text-[11px] bg-white/20 px-2 py-0.5 rounded-full shrink-0">
            {lang === 'ne' ? 'आधिकारिक सार्वजनिक सूचना' : 'Official Notice'}
          </span>
          <span className="truncate max-w-4xl">{settings.publicNotice}</span>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-900 via-sky-800 to-blue-900 text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-5">
            {/* Committee Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-700/60 border border-sky-400/30 text-sky-200 text-xs font-semibold backdrop-blur">
              <Droplets className="w-4 h-4 text-sky-300" />
              <span>{settings.registrationNumber || 'WSSDO Registered'}</span>
              <span>•</span>
              <span>{lang === 'ne' ? 'आर्थिक वर्ष २०८१/८२' : 'Fiscal Year 2081/82'}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight font-heading">
              {lang === 'ne' ? settings.committeeNameNepali : settings.committeeName}
            </h1>

            {(settings.tagline || settings.billTemplate?.tagline) && (
              <p className="text-sm font-semibold text-sky-200 italic -mt-2">
                "{settings.tagline || settings.billTemplate?.tagline}"
              </p>
            )}

            <p className="text-base sm:text-lg text-sky-100 max-w-2xl mx-auto font-normal">
              {lang === 'ne'
                ? 'स्थानीय जनसमुदायलाई निरन्तर, स्वच्छ तथा शुद्ध खानेपानी सेवा उपलब्ध गराउँदै पारदर्शी महसुल प्रणाली तथा आधिकारिक काउन्टर रसिद व्यवस्थापन।'
                : 'Providing pure, reliable drinking water with transparent billing, permanent consumer IDs, and authorized cashier receipts.'}
            </p>

            {/* 2 Prominent Landing Page Options: Create ID and Login ID */}
            <div className="pt-2 flex flex-wrap justify-center items-center gap-3">
              <button
                onClick={() => openAuthModal('register')}
                className="px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-md flex items-center gap-2 transition-all cursor-pointer hover:scale-102"
              >
                <UserPlus className="w-4 h-4" />
                <span>{lang === 'ne' ? 'नयाँ खाता सिर्जना गर्नुहोस् (Create ID)' : 'Create ID'}</span>
              </button>

              <button
                onClick={() => openAuthModal('login')}
                className="px-7 py-3.5 rounded-xl bg-white text-sky-950 hover:bg-sky-50 font-extrabold text-sm shadow-md flex items-center gap-2 transition-all cursor-pointer hover:scale-102"
              >
                <LogIn className="w-4 h-4 text-sky-600" />
                <span>{lang === 'ne' ? 'खाता लगइन (Login ID)' : 'Login ID'}</span>
              </button>

              <button
                onClick={() => openAuthModal('admin')}
                className="px-5 py-3.5 rounded-xl bg-sky-950/80 border border-sky-400/40 hover:bg-sky-950 text-sky-200 font-semibold text-xs transition-all cursor-pointer"
              >
                <span>{lang === 'ne' ? 'समिति प्रशासन (Staff / Admin)' : 'Staff & Admin Portal'}</span>
              </button>
            </div>
          </div>

          {/* Consumer Verification & Code Verification Card */}
          <div className="mt-12 max-w-2xl mx-auto bg-white rounded-2xl p-4 sm:p-6 shadow-xl border border-sky-100 text-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-5 h-5 text-sky-600" />
              <h3 className="font-bold text-slate-900 text-base">
                {lang === 'ne' ? 'आफ्नो विवरण हेर्नुहोस्' : 'View Consumer Statement & Bills'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {lang === 'ne'
                ? 'कुनै फोन नम्बर वा पासवर्ड आवश्यक छैन। आफ्नो स्थायी ग्राहक नम्बर प्रविष्ट गरी मासिक महसुल बिल, काउन्टर रसिद तथा बाँकी बक्यौता हेर्नुहोस्।'
                : 'No password or phone required. Enter your permanent Customer Code to view your monthly bills, payment receipts, and balance.'}
            </p>

            <form onSubmit={handleQuickSearch} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <label htmlFor="landingSearchCode" className="block text-[11px] font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'स्थायी ग्राहक नं.' : 'Permanent Customer Code'}
                </label>
                <input
                  id="landingSearchCode"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'ne' ? 'स्थायी ग्राहक नं. (जस्तै: HYT-00101)' : 'Permanent Customer No. (e.g. HYT-00101)'}
                  className="w-full pl-3.5 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 font-mono font-bold uppercase"
                />
              </div>
              <div className="sm:self-end">
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {searchLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>{lang === 'ne' ? 'विवरण हेर्नुहोस्' : 'View Statement'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {searchError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{searchError}</span>
              </div>
            )}

            {/* Privacy-Protected Search Result Display */}
            {searchResult && (
              <div className="mt-5 border-t border-slate-100 pt-4 space-y-3">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900 text-sm font-mono">
                        {searchResult.customerCode}
                      </div>
                      <div className="text-xs text-slate-600">
                        {lang === 'ne' ? `दर्ता भएको वडा नं ${toNepaliNumerals(searchResult.ward)} • स्थिति:` : `Registered in Ward ${searchResult.ward} • Status:`}{' '}
                        <span className="font-bold text-emerald-700">{searchResult.status}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => openAuthModal('login')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{lang === 'ne' ? 'विवरण हेर्न लगइन गर्नुहोस्' : 'Login to View Statement'}</span>
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {lang === 'ne'
                      ? 'उपभोक्ताको गोपनीयता संरक्षणका लागि बिल, बक्यौता तथा रसिद लगइन गरेपछि मात्र देखाइन्छ।'
                      : 'For privacy, full billing statements, card details, and receipts require account authentication.'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Official Tariff Rates Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {lang === 'ne' ? 'आधिकारिक महसुल दर तथा ग्राहक वर्गहरू' : 'Approved Tariffs & Consumer Categories'}
          </h2>
          <p className="text-slate-600 text-sm">
            {lang === 'ne'
              ? 'समितिको कार्यसमितिद्वारा निर्धारित मासिक न्यूनतम महसुल दर, सरसफाइ शुल्क र बिलिङ नियमहरू।'
              : 'Monthly fixed charges, sanitation fees, and billing rules approved by the consumer committee.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tariffs.map((tariff) => (
            <div
              key={tariff.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="p-6">
                <div className="text-xs font-bold tracking-wider uppercase text-sky-700 mb-1">
                  {tariff.category}
                </div>
                <h3 className="text-lg font-bold text-slate-900">{tariff.nameNepali}</h3>
                <p className="text-xs text-slate-500 mb-4">{tariff.name}</p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {formatNPR(tariff.standardMonthlyCharge, lang)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {lang === 'ne' ? '/ महिना (न्यूनतम)' : '/ month (fixed base)'}
                  </span>
                </div>

                <ul className="mt-6 space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-4">
                  <li className="flex justify-between items-center">
                    <span>{lang === 'ne' ? 'न्यूनतम एकाइ:' : 'Base units included:'}</span>
                    <span className="font-semibold text-slate-900">{toNepaliNumerals(tariff.minUnits ?? 10)} units</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span>{lang === 'ne' ? 'सरसफाइ उपकर:' : 'Sanitation fee:'}</span>
                    <span className="font-semibold text-slate-900">{formatNPR(tariff.sanitationFee, lang)}</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span>{lang === 'ne' ? 'समयमै भुक्तानी छुट:' : 'Early discount:'}</span>
                    <span className="font-semibold text-emerald-700">{tariff.earlyDiscountPercentage}%</span>
                  </li>
                  <li className="flex justify-between items-center">
                    <span>{lang === 'ne' ? 'म्याद नाघेको जरिवाना:' : 'Late penalty:'}</span>
                    <span className="font-semibold text-rose-600">{tariff.latePenaltyPercentage}%</span>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>{lang === 'ne' ? 'लागू मिति:' : 'Effective:'} २०८१ बैशाख</span>
                <span className="text-sky-700 font-semibold">{lang === 'ne' ? 'सक्रिय' : 'Active'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact & Committee Information Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white">
                <Droplets className="w-5 h-5" />
              </div>
              <span className="font-bold text-white text-base">
                {lang === 'ne' ? settings.committeeNameNepali : settings.committeeName}
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              {lang === 'ne'
                ? 'नेपाल सरकारको खानेपानी तथा ढल व्यवस्थापन विभाग तथा स्थानीय तहमा दर्ता भएको उपभोक्ता समिति।'
                : 'Registered Water Supply & Sanitation Consumer Committee dedicated to reliable utility service.'}
            </p>
            <div className="text-xs text-slate-400">
              {lang === 'ne' ? 'दर्ता नं:' : 'Reg No:'} {settings.registrationNumber}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm mb-3">
              {lang === 'ne' ? 'सम्पर्क ठेगाना' : 'Office Location'}
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>{settings.address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{settings.phone}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{settings.email}</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white text-sm mb-3">
              {lang === 'ne' ? 'उपभोक्ता सेवा' : 'Consumer Services'}
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button onClick={() => openAuthModal('register')} className="hover:text-white transition-colors cursor-pointer">
                  {lang === 'ne' ? 'नयाँ ग्राहक दर्ता' : 'New Consumer Registration'}
                </button>
              </li>
              <li>
                <button onClick={() => openAuthModal('login')} className="hover:text-white transition-colors cursor-pointer">
                  {lang === 'ne' ? 'उपभोक्ता लगइन' : 'Consumer Login Portal'}
                </button>
              </li>
              <li>
                <button onClick={() => openAuthModal('admin')} className="hover:text-white transition-colors cursor-pointer">
                  {lang === 'ne' ? 'कर्मचारी तथा समिति प्रशासन' : 'Staff & Committee Admin'}
                </button>
              </li>
              <li>
                <div className="text-slate-400 flex items-start gap-1.5 pt-1 border-t border-slate-800">
                  <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                  <span>
                    {lang === 'ne'
                      ? `काउन्टर समय: ${settings.counterOpeningTime || 'बिहान १०:००'} देखि ${settings.counterClosingTime || 'दिउँसो ४:००'} सम्म`
                      : `Counter: ${settings.counterOpeningTime || '10:00 AM'} to ${settings.counterClosingTime || '4:00 PM'}`}
                  </span>
                </div>
                {settings.counterWorkingDays && (
                  <div className="text-[10px] text-slate-500 pl-5">
                    {settings.counterWorkingDays}
                  </div>
                )}
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-slate-800 mt-8 pt-6 flex flex-wrap justify-between items-center text-xs text-slate-500 gap-2">
          <div>
            © {new Date().getFullYear()} {settings.committeeNameNepali}. All rights reserved.
          </div>
          <div>
            Water Supply Billing Management System • Developed for Consumer Committees in Nepal
          </div>
        </div>
      </footer>
    </div>
  );
};
