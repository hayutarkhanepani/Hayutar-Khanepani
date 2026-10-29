import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Tariff, CommitteeSettings, ConsumerCategory } from '../types';
import { formatNPR, toNepaliNumerals } from '../utils/nepaliCalendar';
import {
  saveTariff,
  updateCommitteeSettings,
  getConsumerCategories,
  saveConsumerCategory,
  deleteConsumerCategory,
  INITIAL_CATEGORIES,
} from '../services/dbService';
import {
  Sliders,
  Building,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Plus,
  Save,
  Shield,
  Layers,
  Tag,
  Lock,
  Edit,
  Trash2,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

interface TariffSettingsProps {
  tariffs: Tariff[];
  settings: CommitteeSettings;
  onRefresh: () => void;
}

export const TariffSettings: React.FC<TariffSettingsProps> = ({
  tariffs,
  settings,
  onRefresh,
}) => {
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'categories' | 'tariffs' | 'committee' | 'future-payments'>('categories');

  // Committee Settings Form
  const [committeeName, setCommitteeName] = useState(settings.committeeName);
  const [committeeNameNepali, setCommitteeNameNepali] = useState(settings.committeeNameNepali);
  const [regNo, setRegNo] = useState(settings.registrationNumber);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [email, setEmail] = useState(settings.email);
  const [fiscalYear, setFiscalYear] = useState(settings.currentFiscalYear);
  const [latePenaltyDays, setLatePenaltyDays] = useState(settings.latePenaltyDays || 20);
  const [earlyDiscountDays, setEarlyDiscountDays] = useState(settings.earlyDiscountDays || 7);

  // Bank Info Form (Strictly No hardcoded defaults)
  const [bankName, setBankName] = useState(settings.bankName || '');
  const [bankAccount, setBankAccount] = useState(settings.bankAccountNumber || '');
  const [bankBranch, setBankBranch] = useState(settings.bankBranch || '');
  const [bankAccountHolder, setBankAccountHolder] = useState(settings.bankAccountHolder || '');

  // Gateways Form (Strictly disabled by default)
  const [onlineGatewaysActive, setOnlineGatewaysActive] = useState(settings.onlineGatewaysActive ?? false);
  const [bankVouchersActive, setBankVouchersActive] = useState(settings.bankVouchersActive ?? false);
  const [esewaCode, setEsewaCode] = useState(settings.esewaMerchantCode || '');
  const [khaltiKey, setKhaltiKey] = useState(settings.khaltiPublicKey || '');
  const [connectIpsId, setConnectIpsId] = useState(settings.connectIpsMerchantId || '');
  const [esewaEnabled, setEsewaEnabled] = useState(settings.gatewaysEnabled?.esewa ?? false);
  const [khaltiEnabled, setKhaltiEnabled] = useState(settings.gatewaysEnabled?.khalti ?? false);
  const [connectIpsEnabled, setConnectIpsEnabled] = useState(settings.gatewaysEnabled?.connectIps ?? false);

  // Consumer Categories State
  const [categoriesList, setCategoriesList] = useState<ConsumerCategory[]>(INITIAL_CATEGORIES);
  const [editingCategory, setEditingCategory] = useState<ConsumerCategory | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Selected tariff for editing
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadCategories = async () => {
    try {
      const cats = await getConsumerCategories();
      setCategoriesList(cats);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const updated: CommitteeSettings = {
        ...settings,
        committeeName,
        committeeNameNepali,
        registrationNumber: regNo,
        address,
        phone,
        email,
        currentFiscalYear: fiscalYear,
        latePenaltyDays: Number(latePenaltyDays),
        earlyDiscountDays: Number(earlyDiscountDays),
        bankName: bankName.trim(),
        bankAccountNumber: bankAccount.trim(),
        bankBranch: bankBranch.trim(),
        bankAccountHolder: bankAccountHolder.trim(),
        onlineGatewaysActive,
        bankVouchersActive,
        esewaMerchantCode: esewaCode.trim() || undefined,
        khaltiPublicKey: khaltiKey.trim() || undefined,
        connectIpsMerchantId: connectIpsId.trim() || undefined,
        gatewaysEnabled: {
          esewa: esewaEnabled,
          khalti: khaltiEnabled,
          connectIps: connectIpsEnabled,
        },
      };

      await updateCommitteeSettings(updated);
      setSuccessMsg(lang === 'ne' ? 'विवरण सफलतापूर्वक सुरक्षित गरियो!' : 'Settings updated successfully!');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving committee settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTariffRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTariff) return;

    setSaving(true);
    setErrorMsg('');
    try {
      await saveTariff(editingTariff);
      setSuccessMsg(lang === 'ne' ? 'महसुल दर परिमार्जन गरियो।' : 'Tariff rate updated.');
      setEditingTariff(null);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating tariff.');
    } finally {
      setSaving(false);
    }
  };

  // Category Save
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setSaving(true);
    setErrorMsg('');

    try {
      await saveConsumerCategory(editingCategory);
      setSuccessMsg(lang === 'ne' ? 'ग्राहक वर्ग विवरण सुरक्षित गरियो।' : 'Consumer category saved successfully.');
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      loadCategories();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving category');
    } finally {
      setSaving(false);
    }
  };

  const openAddCategory = () => {
    setEditingCategory({
      id: `cat-${Date.now()}`,
      code: `CAT_${Date.now().toString().slice(-4)}`,
      name: '',
      nameNepali: '',
      standardMonthlyCharge: 150,
      latePenaltyPercentage: 5,
      earlyDiscountPercentage: 2,
      sanitationFee: 20,
      maintenanceFee: 10,
      description: '',
      isActive: true,
    });
    setIsCategoryModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-sky-600" />
            <span>{lang === 'ne' ? 'महसुल, ग्राहक वर्ग तथा समिति सेटिङ' : 'Tariffs, Consumer Categories & Settings'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'ne'
              ? 'ग्राहक वर्ग व्यवस्थापन, मासिक न्यूनतम शुल्क दर, जरिवाना अवधि तथा भविष्यको भुक्तानी द्वार कन्फिगरेसन।'
              : 'Consumer category tariffs, fixed fees, discount/penalty rules, and future payment settings.'}
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 gap-1 shadow-2xs">
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'categories'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>{lang === 'ne' ? 'ग्राहक वर्ग (Categories)' : 'Consumer Categories'}</span>
        </button>

        <button
          onClick={() => setActiveTab('tariffs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'tariffs'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{lang === 'ne' ? 'महसुल तालिका (Tariffs)' : 'Tariff Schedules'}</span>
        </button>

        <button
          onClick={() => setActiveTab('committee')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'committee'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>{lang === 'ne' ? 'समिति जानकारी' : 'Committee Info'}</span>
        </button>

        <button
          onClick={() => setActiveTab('future-payments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'future-payments'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>{lang === 'ne' ? 'भुक्तानी सेटिङ (भविष्यको द्वार)' : 'Payment Settings (Future)'}</span>
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 1. CONSUMER CATEGORIES MANAGEMENT */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Consumer Category Management</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure distinct monthly tariffs, penalties, and discounts for each consumer category. Changes affect future bills only.
              </p>
            </div>
            <button
              onClick={openAddCategory}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoriesList.map((cat) => (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-mono">
                      {cat.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        cat.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {cat.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-base">{cat.nameNepali}</h4>
                  <div className="text-xs text-slate-500 mb-3">{cat.name}</div>

                  <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span>Fixed Monthly Charge:</span>
                      <strong className="text-slate-900">रु {cat.standardMonthlyCharge}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Sanitation Fee:</span>
                      <span>रु {cat.sanitationFee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Late Penalty:</span>
                      <span className="text-rose-600 font-semibold">{cat.latePenaltyPercentage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Early Discount:</span>
                      <span className="text-emerald-700 font-semibold">{cat.earlyDiscountPercentage}%</span>
                    </div>
                  </div>
                  {cat.description && (
                    <p className="text-[11px] text-slate-500 mt-2 italic">{cat.description}</p>
                  )}
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingCategory(cat);
                      setIsCategoryModalOpen(true);
                    }}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Tariff</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 2. TARIFF SCHEDULES */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'tariffs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tariffs.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-6 space-y-4"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
                    {t.category}
                  </span>
                  <h3 className="font-bold text-slate-900 text-lg mt-2">{t.nameNepali}</h3>
                  <p className="text-xs text-slate-500">{t.name}</p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Standard Monthly Base Fee:</span>
                    <strong className="text-slate-900">रु {t.standardMonthlyCharge}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Sanitation Fee:</span>
                    <span>रु {t.sanitationFee}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Late Penalty:</span>
                    <span className="text-rose-600 font-semibold">{t.latePenaltyPercentage}%</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Early Discount:</span>
                    <span className="text-emerald-700 font-semibold">{t.earlyDiscountPercentage}%</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Inactive Household Rule:</span>
                    <span className="font-semibold">{t.inactiveHouseholdCharge === 0 ? 'Waived (रु ०)' : `रु ${t.inactiveHouseholdCharge}`}</span>
                  </div>
                </div>

                <button
                  onClick={() => setEditingTariff(t)}
                  className="w-full py-2 bg-sky-50 text-sky-800 hover:bg-sky-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Edit Tariff Schedule
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 3. COMMITTEE INFORMATION */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'committee' && (
        <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm border-b pb-2">Committee Legal & Registration Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Committee Name (Nepali) *</label>
              <input
                type="text"
                required
                value={committeeNameNepali}
                onChange={(e) => setCommitteeNameNepali(e.target.value)}
                className="w-full p-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Committee Name (English) *</label>
              <input
                type="text"
                required
                value={committeeName}
                onChange={(e) => setCommitteeName(e.target.value)}
                className="w-full p-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Registration Number *</label>
              <input
                type="text"
                required
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                className="w-full p-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Office Address *</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Office Phone *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Official Committee Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Current Fiscal Year</label>
              <input
                type="text"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="w-full p-2 border rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Billing Due Day of Month (e.g. 20th)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.billingDueDayOfMonth || 20}
                onChange={(e) => (settings.billingDueDayOfMonth = Number(e.target.value))}
                className="w-full p-2 border rounded-xl"
              />
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold"
            >
              {saving ? 'Saving...' : 'Save Committee Info'}
            </button>
          </div>
        </form>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 4. PAYMENT SETTINGS (FUTURE INTEGRATIONS & BANK DETAILS) */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'future-payments' && (
        <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          {/* Policy Inactive Notice */}
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-950 text-xs sm:text-sm">
              <Lock className="w-4 h-4 text-amber-700" />
              <span>Current Release Policy: Manual Counter Receipt Only</span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed">
              All digital payment gateways (eSewa, Khalti, ConnectIPS) and bank vouchers are <strong>strictly disabled by default</strong>. Authorized staff record payments manually at the cashier counter.
              You may configure bank details and merchant keys below, but they will remain inactive until you explicitly enable them and integration verification is complete.
            </p>
          </div>

          {/* Master Inactive Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 border rounded-xl bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-xs block">Online Payment Gateways</span>
                <span className="text-[11px] text-slate-500">eSewa, Khalti, ConnectIPS direct digital checkout</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlineGatewaysActive}
                  onChange={(e) => setOnlineGatewaysActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="p-4 border rounded-xl bg-slate-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-xs block">Bank Deposit Vouchers</span>
                <span className="text-[11px] text-slate-500">Allow consumers to download deposit slips for bank counters</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={bankVouchersActive}
                  onChange={(e) => setBankVouchersActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>

          {/* Committee Bank Account Details (No hardcoded values) */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Committee Bank Account Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Nepal Bank Limited / Rastriya Banijya Bank"
                  className="w-full p-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="e.g. 01900100XXXXXX"
                  className="w-full p-2 border rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bank Branch</label>
                <input
                  type="text"
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  placeholder="e.g. Local Branch"
                  className="w-full p-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Holder Name</label>
                <input
                  type="text"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  placeholder="e.g. Hayutar Drinking Water Consumer Committee"
                  className="w-full p-2 border rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Digital Gateway Merchant Credentials */}
          <div className="space-y-3 pt-3 border-t">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Gateway Merchant Credentials</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">eSewa Merchant Code</label>
                <input
                  type="text"
                  value={esewaCode}
                  onChange={(e) => setEsewaCode(e.target.value)}
                  placeholder="eSewa Merchant Code"
                  className="w-full p-2 border rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Khalti Public Key</label>
                <input
                  type="text"
                  value={khaltiKey}
                  onChange={(e) => setKhaltiKey(e.target.value)}
                  placeholder="Khalti Public API Key"
                  className="w-full p-2 border rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ConnectIPS Merchant ID</label>
                <input
                  type="text"
                  value={connectIpsId}
                  onChange={(e) => setConnectIpsId(e.target.value)}
                  placeholder="ConnectIPS Merchant ID"
                  className="w-full p-2 border rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
            >
              {saving ? 'Saving...' : 'Save Payment Configurations'}
            </button>
          </div>
        </form>
      )}

      {/* EDIT CATEGORY MODAL */}
      {isCategoryModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-sky-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Consumer Category Details</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-1 text-sky-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category Code *</label>
                  <input
                    type="text"
                    required
                    value={editingCategory.code}
                    onChange={(e) => setEditingCategory({ ...editingCategory, code: e.target.value.toUpperCase() })}
                    className="w-full p-2 border rounded-xl font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editingCategory.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditingCategory({ ...editingCategory, isActive: e.target.value === 'active' })}
                    className="w-full p-2 border rounded-xl bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    className="w-full p-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Name (Nepali) *</label>
                  <input
                    type="text"
                    required
                    value={editingCategory.nameNepali}
                    onChange={(e) => setEditingCategory({ ...editingCategory, nameNepali: e.target.value })}
                    className="w-full p-2 border rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Standard Monthly Base Fee (NPR) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingCategory.standardMonthlyCharge}
                    onChange={(e) => setEditingCategory({ ...editingCategory, standardMonthlyCharge: Number(e.target.value) })}
                    className="w-full p-2 border rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sanitation Fee (NPR)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingCategory.sanitationFee}
                    onChange={(e) => setEditingCategory({ ...editingCategory, sanitationFee: Number(e.target.value) })}
                    className="w-full p-2 border rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Late Penalty (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingCategory.latePenaltyPercentage}
                    onChange={(e) => setEditingCategory({ ...editingCategory, latePenaltyPercentage: Number(e.target.value) })}
                    className="w-full p-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Early Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingCategory.earlyDiscountPercentage}
                    onChange={(e) => setEditingCategory({ ...editingCategory, earlyDiscountPercentage: Number(e.target.value) })}
                    className="w-full p-2 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  placeholder="Category scope and eligibility rules..."
                  className="w-full p-2 border rounded-xl"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-3 py-1.5 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold"
                >
                  {saving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TARIFF MODAL */}
      {editingTariff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-sky-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Edit Tariff: {editingTariff.nameNepali}</h3>
              <button onClick={() => setEditingTariff(null)} className="p-1 text-sky-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTariffRate} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Monthly Fixed Base Charge (NPR) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editingTariff.standardMonthlyCharge}
                  onChange={(e) => setEditingTariff({ ...editingTariff, standardMonthlyCharge: Number(e.target.value) })}
                  className="w-full p-2 border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sanitation Cess (NPR)</label>
                <input
                  type="number"
                  min="0"
                  value={editingTariff.sanitationFee}
                  onChange={(e) => setEditingTariff({ ...editingTariff, sanitationFee: Number(e.target.value) })}
                  className="w-full p-2 border rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Late Payment Penalty (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editingTariff.latePenaltyPercentage}
                  onChange={(e) => setEditingTariff({ ...editingTariff, latePenaltyPercentage: Number(e.target.value) })}
                  className="w-full p-2 border rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Early Payment Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editingTariff.earlyDiscountPercentage}
                  onChange={(e) => setEditingTariff({ ...editingTariff, earlyDiscountPercentage: Number(e.target.value) })}
                  className="w-full p-2 border rounded-xl"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTariff(null)}
                  className="px-3 py-1.5 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold"
                >
                  {saving ? 'Updating...' : 'Update Tariff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
