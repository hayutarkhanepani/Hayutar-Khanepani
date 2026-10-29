import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { CommitteeSettings, BillTemplateSettings, ReceiptTemplateSettings, DateTimeSettings } from '../types';
import {
  updateCommitteeSettings,
  DEFAULT_BILL_TEMPLATE,
  DEFAULT_RECEIPT_TEMPLATE,
  correctPaymentDate,
} from '../services/dbService';
import {
  formatNPR,
  toNepaliNumerals,
  formatSystemDateTime,
  DEFAULT_DATETIME_SETTINGS,
} from '../utils/nepaliCalendar';
import {
  Settings,
  Building,
  Printer,
  Bell,
  Clock,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Save,
  RotateCcw,
  Eye,
  Sliders,
  ShieldCheck,
  Check,
  Droplets,
  HelpCircle,
  FileSpreadsheet,
  Receipt,
  User,
  Calendar,
  Sparkles,
  Scissors,
  Layers,
  History,
  Lock,
} from 'lucide-react';

interface AdminSettingsProps {
  settings: CommitteeSettings;
  onRefresh: () => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ settings, onRefresh }) => {
  const { lang, t } = useLanguage();
  const { isSuperAdmin, isPermanentSuperAdmin } = useAuth();

  // Active section tab
  const [activeTab, setActiveTab] = useState<
    'office' | 'templates' | 'receipt-template' | 'datetime' | 'notice' | 'counter' | 'payments'
  >('office');

  // Preview Mode in Bill Templates Tab
  const [previewDocType, setPreviewDocType] = useState<'bill' | 'receipt'>('bill');

  // Form State - Office & Contact Details
  const [committeeNameNepali, setCommitteeNameNepali] = useState(settings.committeeNameNepali || '');
  const [committeeName, setCommitteeName] = useState(settings.committeeName || '');
  const [tagline, setTagline] = useState(settings.tagline || settings.billTemplate?.tagline || 'शुद्ध पिउने पानी, स्वस्थ जिन्दगी');
  const [registrationNumber, setRegistrationNumber] = useState(settings.registrationNumber || '');
  const [panNumber, setPanNumber] = useState(settings.panNumber || '602498712');
  const [address, setAddress] = useState(settings.address || 'वडा कार्यालय परिसर, हायुटार');
  const [phone, setPhone] = useState(settings.phone || '+977-01-5544332');
  const [email, setEmail] = useState(settings.email || 'hayutarkhanepani@gmail.com');
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '');

  // Form State - Counter & Working Hours
  const [counterOpeningTime, setCounterOpeningTime] = useState(settings.counterOpeningTime || '१०:०० बिहान (10:00 AM)');
  const [counterClosingTime, setCounterClosingTime] = useState(settings.counterClosingTime || '०४:०० दिउँसो (4:00 PM)');
  const [counterWorkingDays, setCounterWorkingDays] = useState(
    settings.counterWorkingDays || 'आइतबार देखि शुक्रबार (सार्वजनिक बिदा बाहेक)'
  );

  // Form State - Public Notice / Announcement
  const [publicNotice, setPublicNotice] = useState(
    settings.publicNotice ||
      'सूचना: प्रत्येक महिनाको २० गतेभित्र खानेपानी महसुल बुझाई ५% जरिवानाबाट बच्नुहोस्। काउन्टर बिहान १०:०० देखि दिउँसो ४:०० सम्म खुला रहनेछ।'
  );
  const [publicNoticeActive, setPublicNoticeActive] = useState<boolean>(settings.publicNoticeActive ?? true);
  const [publicNoticeType, setPublicNoticeType] = useState<'info' | 'warning' | 'urgent'>(settings.publicNoticeType || 'info');

  // Form State - Bill Template Settings
  const initialBillTemplate: BillTemplateSettings = {
    ...DEFAULT_BILL_TEMPLATE,
    ...(settings.billTemplate || {}),
  };
  const [billTemplate, setBillTemplate] = useState<BillTemplateSettings>(initialBillTemplate);

  // Form State - Feature 3: Editable Receipt Template Settings (Exclusively managed by Super Admin)
  const initialReceiptTemplate: ReceiptTemplateSettings = {
    ...DEFAULT_RECEIPT_TEMPLATE,
    ...(settings.receiptTemplate || {}),
  };
  const [receiptTemplate, setReceiptTemplate] = useState<ReceiptTemplateSettings>(initialReceiptTemplate);

  // Form State - Feature 2: Editable Date & Time Settings
  const initialDateTimeSettings: DateTimeSettings = {
    ...DEFAULT_DATETIME_SETTINGS,
    ...(settings.dateTimeSettings || {}),
  };
  const [dateTimeSettings, setDateTimeSettings] = useState<DateTimeSettings>(initialDateTimeSettings);

  // Manual Date Correction Workflow State
  const [correctionPaymentId, setCorrectionPaymentId] = useState('');
  const [correctionNewDate, setCorrectionNewDate] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionLoading, setCorrectionLoading] = useState(false);
  const [correctionSuccessMsg, setCorrectionSuccessMsg] = useState('');
  const [correctionErrorMsg, setCorrectionErrorMsg] = useState('');

  // Bank & Payments
  const [bankName, setBankName] = useState(settings.bankName || '');
  const [bankAccountNumber, setBankAccountNumber] = useState(settings.bankAccountNumber || '');
  const [bankBranch, setBankBranch] = useState(settings.bankBranch || '');
  const [bankAccountHolder, setBankAccountHolder] = useState(settings.bankAccountHolder || '');
  const [onlineGatewaysActive, setOnlineGatewaysActive] = useState(settings.onlineGatewaysActive ?? false);
  const [bankVouchersActive, setBankVouchersActive] = useState(settings.bankVouchersActive ?? false);
  const [esewaCode, setEsewaCode] = useState(settings.esewaMerchantCode || '');
  const [khaltiKey, setKhaltiKey] = useState(settings.khaltiPublicKey || '');
  const [connectIpsId, setConnectIpsId] = useState(settings.connectIpsMerchantId || '');
  const [esewaEnabled, setEsewaEnabled] = useState(settings.gatewaysEnabled?.esewa ?? false);
  const [khaltiEnabled, setKhaltiEnabled] = useState(settings.gatewaysEnabled?.khalti ?? false);
  const [connectIpsEnabled, setConnectIpsEnabled] = useState(settings.gatewaysEnabled?.connectIps ?? false);

  // Status feedback
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Keep form in sync when settings prop updates
  useEffect(() => {
    setCommitteeNameNepali(settings.committeeNameNepali || '');
    setCommitteeName(settings.committeeName || '');
    setTagline(settings.tagline || settings.billTemplate?.tagline || 'शुद्ध पिउने पानी, स्वस्थ जिन्दगी');
    setRegistrationNumber(settings.registrationNumber || '');
    setPanNumber(settings.panNumber || '602498712');
    setAddress(settings.address || 'वडा कार्यालय परिसर, हायुटार');
    setPhone(settings.phone || '+977-01-5544332');
    setEmail(settings.email || 'hayutarkhanepani@gmail.com');
    setLogoUrl(settings.logoUrl || '');
    setCounterOpeningTime(settings.counterOpeningTime || '१०:०० बिहान (10:00 AM)');
    setCounterClosingTime(settings.counterClosingTime || '०४:०० दिउँसो (4:00 PM)');
    setCounterWorkingDays(settings.counterWorkingDays || 'आइतबार देखि शुक्रबार (सार्वजनिक बिदा बाहेक)');
    setPublicNotice(
      settings.publicNotice ||
        'सूचना: प्रत्येक महिनाको २० गतेभित्र खानेपानी महसुल बुझाई ५% जरिवानाबाट बच्नुहोस्। काउन्टर बिहान १०:०० देखि दिउँसो ४:०० सम्म खुला रहनेछ।'
    );
    setPublicNoticeActive(settings.publicNoticeActive ?? true);
    setPublicNoticeType(settings.publicNoticeType || 'info');
    setBillTemplate({
      ...DEFAULT_BILL_TEMPLATE,
      ...(settings.billTemplate || {}),
    });
    setReceiptTemplate({
      ...DEFAULT_RECEIPT_TEMPLATE,
      ...(settings.receiptTemplate || {}),
    });
    setDateTimeSettings({
      ...DEFAULT_DATETIME_SETTINGS,
      ...(settings.dateTimeSettings || {}),
    });
    setBankName(settings.bankName || '');
    setBankAccountNumber(settings.bankAccountNumber || '');
    setBankBranch(settings.bankBranch || '');
    setBankAccountHolder(settings.bankAccountHolder || '');
    setOnlineGatewaysActive(settings.onlineGatewaysActive ?? false);
    setBankVouchersActive(settings.bankVouchersActive ?? false);
    setEsewaCode(settings.esewaMerchantCode || '');
    setKhaltiKey(settings.khaltiPublicKey || '');
    setConnectIpsId(settings.connectIpsMerchantId || '');
    setEsewaEnabled(settings.gatewaysEnabled?.esewa ?? false);
    setKhaltiEnabled(settings.gatewaysEnabled?.khalti ?? false);
    setConnectIpsEnabled(settings.gatewaysEnabled?.connectIps ?? false);
  }, [settings]);

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const updated: CommitteeSettings = {
        ...settings,
        committeeNameNepali: committeeNameNepali.trim(),
        committeeName: committeeName.trim(),
        tagline: tagline.trim(),
        registrationNumber: registrationNumber.trim(),
        panNumber: panNumber.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        logoUrl: logoUrl.trim(),
        counterOpeningTime: counterOpeningTime.trim(),
        counterClosingTime: counterClosingTime.trim(),
        counterWorkingDays: counterWorkingDays.trim(),
        publicNotice: publicNotice.trim(),
        publicNoticeActive,
        publicNoticeType,
        billTemplate: {
          ...billTemplate,
          tagline: tagline.trim(),
        },
        receiptTemplate: {
          ...receiptTemplate,
          phone: phone.trim(),
          panNumber: panNumber.trim(),
          registrationNumber: registrationNumber.trim(),
          headerAddressNepali: address.trim(),
          logoUrl: logoUrl.trim() || receiptTemplate.logoUrl,
        },
        dateTimeSettings,
        // Bank info
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        bankBranch: bankBranch.trim(),
        bankAccountHolder: bankAccountHolder.trim(),
        onlineGatewaysActive,
        bankVouchersActive,
        esewaMerchantCode: esewaCode.trim(),
        khaltiPublicKey: khaltiKey.trim(),
        connectIpsMerchantId: connectIpsId.trim(),
        gatewaysEnabled: {
          esewa: esewaEnabled,
          khalti: khaltiEnabled,
          connectIps: connectIpsEnabled,
        },
      };

      await updateCommitteeSettings(updated);
      setSuccessMsg(
        lang === 'ne'
          ? 'सेटिङहरू सफलतापूर्वक सुरक्षित गरियो! बिल, रसिद र सम्पूर्ण प्रणालीमा तुरुन्तै लागू भएको छ।'
          : 'Settings successfully saved to Firestore! Changes propagated to bills, receipts, and public views.'
      );
      onRefresh();

      setTimeout(() => {
        setSuccessMsg('');
      }, 5000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setErrorMsg(err?.message || (lang === 'ne' ? 'सेटिङ सुरक्षित गर्न सकिएन।' : 'Failed to save settings.'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaultBillTemplate = () => {
    if (
      window.confirm(
        lang === 'ne'
          ? 'के तपाईं बिल प्रिन्ट टेम्प्लेटलाई मानक पूर्वनिर्धारित ढाँचामा फर्काउन चाहनुहुन्छ?'
          : 'Reset bill template settings to default system layout?'
      )
    ) {
      setBillTemplate(DEFAULT_BILL_TEMPLATE);
    }
  };

  const handleResetToDefaultReceiptTemplate = () => {
    if (
      window.confirm(
        lang === 'ne'
          ? 'के तपाईं रसिद प्रिन्ट टेम्प्लेटलाई मानक २ प्रति (कार्यालय + ग्राहक प्रति) ढाँचामा फर्काउन चाहनुहुन्छ?'
          : 'Reset receipt template settings to default dual-copy layout?'
      )
    ) {
      setReceiptTemplate(DEFAULT_RECEIPT_TEMPLATE);
    }
  };

  const handleExecuteDateCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionPaymentId.trim() || !correctionNewDate.trim() || !correctionReason.trim()) {
      setCorrectionErrorMsg(lang === 'ne' ? 'सबै आवश्यक विवरणहरू भर्नुहोस्।' : 'Please fill all required fields.');
      return;
    }

    setCorrectionLoading(true);
    setCorrectionErrorMsg('');
    setCorrectionSuccessMsg('');

    try {
      await correctPaymentDate(correctionPaymentId.trim(), correctionNewDate.trim(), correctionReason.trim());
      setCorrectionSuccessMsg(
        lang === 'ne'
          ? `भुक्तानी रसिद मिति सफलतापूर्वक सच्याइयो र अडिट लगमा दर्ता गरियो।`
          : 'Payment date corrected and audit log recorded successfully.'
      );
      setCorrectionPaymentId('');
      setCorrectionNewDate('');
      setCorrectionReason('');
      onRefresh();
    } catch (err: any) {
      setCorrectionErrorMsg(err?.message || 'Date correction failed.');
    } finally {
      setCorrectionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-8">
          <Settings className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sliders className="w-3.5 h-3.5" />
            <span>{lang === 'ne' ? 'प्रशासनिक नियन्त्रण प्यानल' : 'System Administration & Templates'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
            {lang === 'ne' ? 'कार्यालय, मिति, बिल तथा रसिद टेम्प्लेट सेटिङ' : 'Committee Profile, Date/Time & Receipt Templates'}
          </h1>
          <p className="text-sm text-sky-100/90 leading-relaxed">
            {lang === 'ne'
              ? 'समितिको कार्यालय सम्पर्क, मिति तथा समय ढाँचा (वि.सं./ई.सं.), १ पानामा २ प्रति (कार्यालय र ग्राहक) छापिने रसिद टेम्प्लेट, तथा सार्वजनिक सूचना व्यवस्थापन गर्नुहोस्।'
              : 'Manage office profile, date & time formatting, 2-copies-per-A4 receipt templates, and committee configurations.'}
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-sm font-semibold">{errorMsg}</p>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-1.5 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('office')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'office'
              ? 'bg-sky-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>{lang === 'ne' ? 'कार्यालय विवरण' : 'Office Profile'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receipt-template')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'receipt-template'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>{lang === 'ne' ? 'रसिद टेम्प्लेट (२ प्रति A4)' : 'Receipt Template (Dual Copy)'}</span>
          <span className="bg-purple-200 text-purple-900 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
            Super Admin
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('datetime')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'datetime'
              ? 'bg-sky-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{lang === 'ne' ? 'मिति तथा समय सेटिङ' : 'Date & Time Settings'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'templates'
              ? 'bg-sky-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>{lang === 'ne' ? 'बिल प्रिन्ट टेम्प्लेट' : 'Bill Print Template'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notice')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'notice'
              ? 'bg-sky-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>{lang === 'ne' ? 'सूचना ब्यानर' : 'Notice Banner'}</span>
          {publicNoticeActive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('counter')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'counter'
              ? 'bg-sky-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{lang === 'ne' ? 'काउन्टर समय' : 'Counter Hours'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'payments'
              ? 'bg-sky-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>{lang === 'ne' ? 'डिजिटल भुक्तानी' : 'Payment Gateways'}</span>
        </button>
      </div>

      {/* Main Settings Form Container */}
      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: कार्यालय तथा सम्पर्क विवरण (Office & Contact Details) */}
        {/* ========================================================================= */}
        {activeTab === 'office' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {lang === 'ne' ? 'कार्यालय विवरण तथा सम्पर्क जानकारी' : 'Committee Profile & Contact Info'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {lang === 'ne'
                      ? 'समितिको नाम, ठेगाना, फोन, ईमेल, प्यान नम्बर र लोगो'
                      : 'Committee official name, address, phone numbers, registration and PAN'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    {lang === 'ne' ? 'समितिको आधिकारिक नाम (नेपालीमा)*' : 'Committee Name (Nepali)*'}
                  </label>
                  <input
                    type="text"
                    required
                    value={committeeNameNepali}
                    onChange={(e) => setCommitteeNameNepali(e.target.value)}
                    placeholder="श्री हायुटार खानेपानी तथा सरसफाइ उपभोक्ता समिति"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    {lang === 'ne' ? 'समितिको नाम (English मा)*' : 'Committee Name (English)*'}
                  </label>
                  <input
                    type="text"
                    required
                    value={committeeName}
                    onChange={(e) => setCommitteeName(e.target.value)}
                    placeholder="Hayutar Drinking Water & Sanitation Consumer Committee"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    {lang === 'ne' ? 'नारा / मोटो (Tagline)' : 'Tagline / Motto'}
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="शुद्ध पिउने पानी, स्वस्थ जिन्दगी"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    {lang === 'ne' ? 'कार्यालयको ठेगाना*' : 'Office Address*'}
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="वडा कार्यालय परिसर, हायुटार, नेपाल"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    {lang === 'ne' ? 'सम्पर्क फोन नम्बर*' : 'Contact Phone Number*'}
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+977-01-5544332 / 9851000000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    {lang === 'ne' ? 'आधिकारिक इमेल*' : 'Official Email*'}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hayutarkhanepani@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    {lang === 'ne' ? 'समिति दर्ता नम्बर' : 'Registration Number'}
                  </label>
                  <input
                    type="text"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="WSSDO-NP-2065/04"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 font-medium font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    {lang === 'ne' ? 'स्थायी लेखा नम्बर (PAN / VAT)' : 'PAN / VAT Number'}
                  </label>
                  <input
                    type="text"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value)}
                    placeholder="602498712"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 font-medium font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    {lang === 'ne' ? 'समितिको लोगो (Logo Image URL)' : 'Committee Logo Image URL'}
                  </label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png (खाली छोडेमा मानक खानेपानी प्रतीक प्रयोग हुनेछ)"
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 text-xs font-mono"
                    />
                    <div className="w-12 h-12 rounded-xl border border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Droplets className="w-6 h-6 text-sky-600" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: रसिद टेम्प्लेट (Feature 3: Editable Receipt Template - Super Admin) */}
        {/* ========================================================================= */}
        {activeTab === 'receipt-template' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Form Controls (7 cols) */}
              <div className="lg:col-span-7 space-y-5">
                <div className="bg-white rounded-2xl border border-purple-200 shadow-sm p-6 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-purple-100">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-purple-700" />
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">
                          {lang === 'ne' ? 'आधिकारिक रसिद टेम्प्लेट सम्पादन' : 'Official Receipt Template Settings'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {lang === 'ne'
                            ? '१ पानामा २ प्रति (कार्यालय प्रति र ग्राहक प्रति) प्रिन्ट हुने ढाँचा'
                            : 'Configures dual-copy A4 receipt printing and layout'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetToDefaultReceiptTemplate}
                      className="text-xs text-slate-500 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{lang === 'ne' ? 'डिफल्टमा फर्काउनुहोस्' : 'Reset to Default'}</span>
                    </button>
                  </div>

                  {/* Super admin verification badge */}
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-[11px] text-purple-900 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-purple-700 shrink-0" />
                    <span>
                      {lang === 'ne'
                        ? 'यो रसिद टेम्प्लेट अधिकार सुपर एडमिन (hayutarkhanepani@gmail.com) द्वारा मात्र परिमार्जन गर्न सकिन्छ।'
                        : 'Receipt template configuration is protected and restricted to Super Admin.'}
                    </span>
                  </div>

                  {/* Receipt Titles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {lang === 'ne' ? 'रसिद शीर्षक (नेपाली)*' : 'Receipt Title (Nepali)*'}
                      </label>
                      <input
                        type="text"
                        value={receiptTemplate.receiptTitleNepali}
                        onChange={(e) => setReceiptTemplate({ ...receiptTemplate, receiptTitleNepali: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500"
                        placeholder="नगद / महसुल भुक्तानी आधिकारिक रसिद"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {lang === 'ne' ? 'रसिद शीर्षक (English)*' : 'Receipt Title (English)*'}
                      </label>
                      <input
                        type="text"
                        value={receiptTemplate.receiptTitleEnglish}
                        onChange={(e) => setReceiptTemplate({ ...receiptTemplate, receiptTitleEnglish: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500"
                        placeholder="Official Payment Receipt"
                      />
                    </div>
                  </div>

                  {/* Project Name and Header */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {lang === 'ne' ? 'खानेपानी आयोजनाको नाम (Project Name)' : 'Water Supply Project Name'}
                    </label>
                    <input
                      type="text"
                      value={receiptTemplate.waterProjectNameNepali || ''}
                      onChange={(e) => setReceiptTemplate({ ...receiptTemplate, waterProjectNameNepali: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500"
                      placeholder="श्री हायुटार बृहत् खानेपानी तथा सरसफाइ उपभोक्ता समिति"
                    />
                  </div>

                  {/* Dual Copy Labels */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {lang === 'ne' ? 'माथिल्लो प्रति लेबल (Top Copy)' : 'Top Copy Label'}
                      </label>
                      <input
                        type="text"
                        value={receiptTemplate.officeCopyLabelNepali || 'कार्यालय प्रति (OFFICE COPY)'}
                        onChange={(e) => setReceiptTemplate({ ...receiptTemplate, officeCopyLabelNepali: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 font-semibold text-purple-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {lang === 'ne' ? 'तल्लो प्रति लेबल (Bottom Copy)' : 'Bottom Copy Label'}
                      </label>
                      <input
                        type="text"
                        value={receiptTemplate.customerCopyLabelNepali || 'ग्राहक प्रति (CUSTOMER COPY)'}
                        onChange={(e) => setReceiptTemplate({ ...receiptTemplate, customerCopyLabelNepali: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 font-semibold text-emerald-900"
                      />
                    </div>
                  </div>

                  {/* Paper Layout Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {lang === 'ne' ? 'रसिद प्रिन्ट ढाँचा (Paper Layout)' : 'Receipt Paper Layout'}
                    </label>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[
                        { id: 'DUAL_A4', label: '२ प्रति A4 (कार्यालय + ग्राहक)', desc: 'मानक पूर्ण पाना (१ पानामा २ प्रति)' },
                        { id: 'SINGLE_A4', label: 'एकल प्रति (A4 / A5)', desc: '१ पानामा १ प्रति मात्र' },
                        { id: 'POS80', label: '80mm Thermal (POS)', desc: 'थर्मल काउन्टर रसिद' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setReceiptTemplate({ ...receiptTemplate, paperLayout: item.id as any })}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            receiptTemplate.paperLayout === item.id
                              ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-500/20'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="block font-bold text-xs text-slate-900">{item.label}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">{item.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={receiptTemplate.showCutLine !== false}
                        onChange={(e) => setReceiptTemplate({ ...receiptTemplate, showCutLine: e.target.checked })}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span>{lang === 'ne' ? '२ प्रतिको बीचमा कैंची चिन्ह (Cut Line) देखाउने' : 'Show Scissor Cut Line'}</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={receiptTemplate.showPreviousDueBreakdown !== false}
                        onChange={(e) =>
                          setReceiptTemplate({ ...receiptTemplate, showPreviousDueBreakdown: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span>{lang === 'ne' ? 'बाँकी बक्यौता हिसाब (Ledger Balance) देखाउने' : 'Show Ledger Balance Breakdown'}</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={receiptTemplate.showSignatures !== false}
                        onChange={(e) => setReceiptTemplate({ ...receiptTemplate, showSignatures: e.target.checked })}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span>{lang === 'ne' ? 'लेखापाल तथा आधिकारिक दस्तखत देखाउने' : 'Show Accountant & Official Signatures'}</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={receiptTemplate.showSealSpace !== false}
                        onChange={(e) => setReceiptTemplate({ ...receiptTemplate, showSealSpace: e.target.checked })}
                        className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                      />
                      <span>{lang === 'ne' ? 'समिति छाप स्थान देखाउने' : 'Show Committee Seal Block'}</span>
                    </label>
                  </div>

                  {/* Signatures Titles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {lang === 'ne' ? 'क्यासियर पदवी' : 'Cashier Title'}
                      </label>
                      <input
                        type="text"
                        value={receiptTemplate.cashierTitleNepali || 'रकम बुझिलिने (क्यासियर)'}
                        onChange={(e) => setReceiptTemplate({ ...receiptTemplate, cashierTitleNepali: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {lang === 'ne' ? 'लेखापाल पदवी' : 'Accountant Title'}
                      </label>
                      <input
                        type="text"
                        value={receiptTemplate.accountantTitleNepali || 'लेखापाल / काउन्टर प्रमुख'}
                        onChange={(e) => setReceiptTemplate({ ...receiptTemplate, accountantTitleNepali: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {lang === 'ne' ? 'अध्यक्ष पदवी' : 'Chairperson Title'}
                      </label>
                      <input
                        type="text"
                        value={receiptTemplate.chairpersonTitleNepali || 'अध्यक्ष / संयोजक'}
                        onChange={(e) => setReceiptTemplate({ ...receiptTemplate, chairpersonTitleNepali: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                  </div>

                  {/* Footer Notice */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {lang === 'ne' ? 'रसिदको पुछारमा छापिने आधिकारिक सूचना (Footer Notice)' : 'Receipt Footer Notice'}
                    </label>
                    <textarea
                      rows={2}
                      value={receiptTemplate.receiptNotice || ''}
                      onChange={(e) => setReceiptTemplate({ ...receiptTemplate, receiptNotice: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Live Dual-Copy Preview Box (5 cols) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-purple-700" />
                    <span className="font-bold text-xs text-slate-900">
                      {lang === 'ne' ? 'प्रत्यक्ष प्रिन्ट नमूना (Live A4 Preview)' : 'Live A4 Print Preview'}
                    </span>
                  </div>
                  <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                    A4 Single Sheet
                  </span>
                </div>

                <div className="bg-slate-100 p-3 rounded-2xl border border-slate-300 shadow-inner max-h-[620px] overflow-y-auto text-[9px] space-y-2">
                  {/* Top Copy Preview */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-1.5">
                    <div className="flex justify-between items-start border-b pb-1">
                      <div>
                        <div className="font-black text-slate-900 text-[10px]">
                          {settings.committeeNameNepali || 'श्री हायुटार खानेपानी तथा सरसफाइ उपभोक्ता समिति'}
                        </div>
                        <div className="text-[8px] text-slate-500">
                          {receiptTemplate.waterProjectNameNepali || settings.committeeName}
                        </div>
                      </div>
                      <span className="bg-purple-100 text-purple-900 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                        {receiptTemplate.officeCopyLabelNepali || 'कार्यालय प्रति (OFFICE COPY)'}
                      </span>
                    </div>

                    <div className="flex justify-between text-[8px] bg-slate-50 p-1 rounded font-mono">
                      <span>रसिद नं: RCP-2082-0142</span>
                      <span>मिति: २०८१/११/१५ (10:30 AM)</span>
                    </div>

                    <div className="bg-emerald-50/60 p-1 rounded text-[8px]">
                      <div>उपभोक्ता: <strong>राम कुमार श्रेष्ठ (HYT-00101)</strong></div>
                      <div>वडा नं १, धारापानी • सम्पर्क: ९८५१००००००</div>
                    </div>

                    <div className="flex justify-between font-bold text-[9px] bg-emerald-100/70 p-1 rounded">
                      <span>प्राप्त रकम (Amount Paid):</span>
                      <span>रु १५०.००</span>
                    </div>

                    <div className="flex justify-between pt-1 border-t text-[8px] text-slate-500 text-center">
                      <div>कम्प्युटर क्यासियर</div>
                      <div>लेखापाल</div>
                      <div>समिति छाप</div>
                    </div>
                  </div>

                  {/* Scissor Cut Line */}
                  <div className="relative flex items-center justify-center my-1 select-none">
                    <div className="w-full border-t border-dashed border-slate-400" />
                    <span className="bg-white px-2 text-[8px] text-slate-600 font-bold border border-dashed rounded-full flex items-center gap-1">
                      <Scissors className="w-2.5 h-2.5" />
                      <span>{lang === 'ne' ? 'कैंची चिन्ह / यहाँबाट काट्नुहोस् (CUT HERE)' : 'CUT HERE'}</span>
                    </span>
                  </div>

                  {/* Bottom Copy Preview */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-1.5">
                    <div className="flex justify-between items-start border-b pb-1">
                      <div>
                        <div className="font-black text-slate-900 text-[10px]">
                          {settings.committeeNameNepali || 'श्री हायुटार खानेपानी तथा सरसफाइ उपभोक्ता समिति'}
                        </div>
                        <div className="text-[8px] text-slate-500">
                          {receiptTemplate.waterProjectNameNepali || settings.committeeName}
                        </div>
                      </div>
                      <span className="bg-emerald-100 text-emerald-900 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                        {receiptTemplate.customerCopyLabelNepali || 'ग्राहक प्रति (CUSTOMER COPY)'}
                      </span>
                    </div>

                    <div className="flex justify-between text-[8px] bg-slate-50 p-1 rounded font-mono">
                      <span>रसिद नं: RCP-2082-0142</span>
                      <span>मिति: २०८१/११/१५ (10:30 AM)</span>
                    </div>

                    <div className="bg-emerald-50/60 p-1 rounded text-[8px]">
                      <div>उपभोक्ता: <strong>राम कुमार श्रेष्ठ (HYT-00101)</strong></div>
                      <div>वडा नं १, धारापानी • सम्पर्क: ९८५१००००००</div>
                    </div>

                    <div className="flex justify-between font-bold text-[9px] bg-emerald-100/70 p-1 rounded">
                      <span>प्राप्त रकम (Amount Paid):</span>
                      <span>रु १५०.००</span>
                    </div>

                    <div className="flex justify-between pt-1 border-t text-[8px] text-slate-500 text-center">
                      <div>कम्प्युटर क्यासियर</div>
                      <div>लेखापाल</div>
                      <div>समिति छाप</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: मिति तथा समय सेटिङ (Feature 2: Editable Date & Time Settings) */}
        {/* ========================================================================= */}
        {activeTab === 'datetime' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-sky-700" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {lang === 'ne' ? 'प्रणाली मिति तथा समय सेटिङ' : 'Date & Time Settings'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {lang === 'ne'
                        ? 'समय क्षेत्र, विक्रम संवत् (वि.सं.) तथा अंग्रेजी मिति (ई.सं.) प्रदर्शन ढाँचा'
                        : 'Configure timezone, Bikram Sambat (BS) / Gregorian (AD) formats, and 12h/24h time'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timezone & Calendar Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    {lang === 'ne' ? 'समय क्षेत्र (Timezone)*' : 'Timezone*'}
                  </label>
                  <select
                    value={dateTimeSettings.timeZone}
                    onChange={(e) => setDateTimeSettings({ ...dateTimeSettings, timeZone: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="Asia/Kathmandu">Asia/Kathmandu (नेपाल मानक समय UTC+05:45)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST UTC+05:30)</option>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {lang === 'ne'
                      ? 'बिल, भुक्तानी रसिद र अडिट लगमा प्रयोग हुने आधिकारिक समय क्षेत्र'
                      : 'Used for timestamping transactions and print receipts.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    {lang === 'ne' ? 'समय ढाँचा (Time Format)*' : 'Time Format*'}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDateTimeSettings({ ...dateTimeSettings, timeFormatPreference: '12H' })}
                      className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                        dateTimeSettings.timeFormatPreference === '12H'
                          ? 'border-sky-600 bg-sky-50 text-sky-900 font-bold ring-2 ring-sky-500/20'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-xs">१२ घण्टे (12-Hour)</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">०२:३० दिउँसो / PM</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateTimeSettings({ ...dateTimeSettings, timeFormatPreference: '24H' })}
                      className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                        dateTimeSettings.timeFormatPreference === '24H'
                          ? 'border-sky-600 bg-sky-50 text-sky-900 font-bold ring-2 ring-sky-500/20'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-xs">२४ घण्टे (24-Hour)</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">१४:३० (14:30)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Date Format Preference */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  {lang === 'ne' ? 'मिति प्रदर्शन ढाँचा (Date Format Preference)*' : 'Date Format Preference*'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {[
                    {
                      id: 'BS_PRIMARY_AD_SECONDARY',
                      title: 'वि.सं. मुख्य + (ई.सं.)',
                      example: '२०८१/११/१५ (2025-02-27)',
                      desc: 'मानक नेपाली सरकारी ढाँचा',
                    },
                    {
                      id: 'BOTH_SIDE_BY_SIDE',
                      title: 'दुवै मिति सँगसँगै',
                      example: 'वि.सं. २०८१-११-१५ / सन् 2025-02-27',
                      desc: 'विस्तृत दोहोरो विवरण',
                    },
                    {
                      id: 'BS_ONLY',
                      title: 'केवल वि.सं. (BS Only)',
                      example: '२०८१/११/१५',
                      desc: 'नेपाली क्यालेन्डर मात्र',
                    },
                    {
                      id: 'AD_ONLY',
                      title: 'केवल ई.सं. (AD Only)',
                      example: '2025-02-27',
                      desc: 'Gregorian Standard',
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDateTimeSettings({ ...dateTimeSettings, dateFormatPreference: item.id as any })}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        dateTimeSettings.dateFormatPreference === item.id
                          ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-500/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block font-bold text-xs text-slate-900">{item.title}</span>
                      <span className="font-mono text-[11px] text-sky-800 font-semibold block mt-1">{item.example}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Formatted Output Preview Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span className="font-bold text-xs text-slate-800">
                    {lang === 'ne' ? 'हालको ढाँचा अनुसार प्रत्यक्ष नतिजा (Live Formatted Output)' : 'Current Formatted Sample'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">
                      {lang === 'ne' ? 'रसिद र बिलमा मिति/समय:' : 'On Receipts & Bills:'}
                    </span>
                    <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                      {formatSystemDateTime(new Date().toISOString(), {
                        settings: dateTimeSettings,
                        includeTime: true,
                        lang,
                      })}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">
                      {lang === 'ne' ? 'प्रतिवेदन तथा तालिकामा मिति:' : 'On Reports & Tables:'}
                    </span>
                    <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                      {formatSystemDateTime(new Date().toISOString(), {
                        settings: dateTimeSettings,
                        includeTime: false,
                        lang,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Manual Date Correction Tool (Audit-Controlled) */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-4 h-4 text-purple-700" />
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                    {lang === 'ne'
                      ? 'अफलाइन संकलन मिति सच्याउने सुविधा (Manual Date Correction with Audit Trail)'
                      : 'Offline Transaction Date Correction'}
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  {lang === 'ne'
                    ? 'काउन्टर बन्द भएको दिन वा इन्टरनेट नभएको समयमा संकलन भई पछि प्रविष्ट गरिएको भुक्तानीको मिति सच्याउन यो फारम प्रयोग गर्नुहोस्। प्रत्येक सच्याइको कारणसहितको अडिट रेकर्ड सुरक्षित रहनेछ।'
                    : 'Correct offline recording dates with mandatory audit reason. Financial amounts remain completely protected.'}
                </p>

                {correctionSuccessMsg && (
                  <div className="p-3 mb-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{correctionSuccessMsg}</span>
                  </div>
                )}

                {correctionErrorMsg && (
                  <div className="p-3 mb-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{correctionErrorMsg}</span>
                  </div>
                )}

                <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {lang === 'ne' ? 'भुक्तानी ID / रसिद नं*' : 'Payment ID / Receipt No*'}
                    </label>
                    <input
                      type="text"
                      value={correctionPaymentId}
                      onChange={(e) => setCorrectionPaymentId(e.target.value)}
                      placeholder="e.g. RCP-2082-0001 वा ID"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {lang === 'ne' ? 'नयाँ वास्तविक मिति (Correct Date)*' : 'Correct Date (BS/AD)*'}
                    </label>
                    <input
                      type="text"
                      value={correctionNewDate}
                      onChange={(e) => setCorrectionNewDate(e.target.value)}
                      placeholder="e.g. 2081-11-14"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {lang === 'ne' ? 'सच्याउनुको कारण (Audit Reason)*' : 'Correction Reason*'}
                    </label>
                    <input
                      type="text"
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      placeholder="e.g. शनिबार काउन्टरमा नगद बुझिएको रसिद"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3 text-right">
                    <button
                      type="button"
                      disabled={correctionLoading}
                      onClick={handleExecuteDateCorrection}
                      className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {correctionLoading ? 'सच्याउँदै...' : lang === 'ne' ? 'मिति सच्याउनुहोस् र अडिट दर्ता गर्नुहोस्' : 'Save Date Correction'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: बिल प्रिन्ट टेम्प्लेट (Bill Print Template) */}
        {/* ========================================================================= */}
        {activeTab === 'templates' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-sky-700" />
                <h3 className="font-bold text-slate-900 text-base">
                  {lang === 'ne' ? 'बिल प्रिन्ट टेम्प्लेट ढाँचा' : 'Bill Print Layout Settings'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleResetToDefaultBillTemplate}
                className="text-xs text-slate-500 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'ne' ? 'डिफल्टमा फर्काउनुहोस्' : 'Reset to Default'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'बिल मुख्य शीर्षक (नेपाली)' : 'Bill Header (Nepali)'}
                </label>
                <input
                  type="text"
                  value={billTemplate.headerTitleNepali || ''}
                  onChange={(e) => setBillTemplate({ ...billTemplate, headerTitleNepali: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500"
                  placeholder="मासिक खानेपानी महसुल बिल"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'बिल उपशीर्षक (English)' : 'Bill Header (English)'}
                </label>
                <input
                  type="text"
                  value={billTemplate.headerTitleEnglish || ''}
                  onChange={(e) => setBillTemplate({ ...billTemplate, headerTitleEnglish: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500"
                  placeholder="Monthly Water Consumption Bill"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={billTemplate.showLogo ?? true}
                  onChange={(e) => setBillTemplate({ ...billTemplate, showLogo: e.target.checked })}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                />
                <span>{lang === 'ne' ? 'बिलमा लोगो देखाउने' : 'Show Logo on Bill'}</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={billTemplate.showSignatures ?? true}
                  onChange={(e) => setBillTemplate({ ...billTemplate, showSignatures: e.target.checked })}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                />
                <span>{lang === 'ne' ? 'दस्तखत स्थान देखाउने' : 'Show Signatures Space'}</span>
              </label>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: सार्वजनिक सूचना ब्यानर (Notice Banner) */}
        {/* ========================================================================= */}
        {activeTab === 'notice' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-sky-700" />
                <h3 className="font-bold text-slate-900 text-base">
                  {lang === 'ne' ? 'सार्वजनिक सूचना तथा सन्देश ब्यानर' : 'Public Announcement Banner'}
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={publicNoticeActive}
                  onChange={(e) => setPublicNoticeActive(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600"
                />
                <span className="font-bold text-slate-800">
                  {lang === 'ne' ? 'सार्वजनिक सूचना ब्यानर सक्रिय राख्नुहोस्' : 'Enable Public Announcement Banner'}
                </span>
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'सूचनाको व्यहोरा (Notice Text)' : 'Announcement Text'}
                </label>
                <textarea
                  rows={3}
                  value={publicNotice}
                  onChange={(e) => setPublicNotice(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: काउन्टर समय (Counter Hours) */}
        {/* ========================================================================= */}
        {activeTab === 'counter' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
              <Clock className="w-5 h-5 text-sky-700" />
              <h3 className="font-bold text-slate-900 text-base">
                {lang === 'ne' ? 'काउन्टर सञ्चालन समय तथा कार्यदिन' : 'Counter Operating Hours'}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'काउन्टर खुल्ने समय' : 'Opening Time'}
                </label>
                <input
                  type="text"
                  value={counterOpeningTime}
                  onChange={(e) => setCounterOpeningTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'काउन्टर बन्द हुने समय' : 'Closing Time'}
                </label>
                <input
                  type="text"
                  value={counterClosingTime}
                  onChange={(e) => setCounterClosingTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'सञ्चालन हुने बार' : 'Working Days'}
                </label>
                <input
                  type="text"
                  value={counterWorkingDays}
                  onChange={(e) => setCounterWorkingDays(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: डिजिटल भुक्तानी (Payment Gateways) */}
        {/* ========================================================================= */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
              <CreditCard className="w-5 h-5 text-sky-700" />
              <h3 className="font-bold text-slate-900 text-base">
                {lang === 'ne' ? 'बैंक तथा डिजिटल भुक्तानी गेटवे' : 'Bank & Payment Gateways'}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">बैंकको नाम</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  placeholder="उदा: राष्ट्रिय वाणिज्य बैंक"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">बैंक खाता नम्बर</label>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                  placeholder="XXXXXXXXXXXX"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom Save Action Bar */}
        <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 flex justify-between items-center">
          <div className="text-xs text-slate-500">
            {lang === 'ne' ? 'सम्पादित सेटिङहरू बचत गर्न यहाँ क्लिक गर्नुहोस्।' : 'Save your configurations to apply system-wide.'}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{lang === 'ne' ? 'सेटिङहरू सुरक्षित गर्नुहोस् (Save Settings)' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
