import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Bill, Household, Tariff, CommitteeSettings, WardInfo, Payment } from '../types';
import {
  NEPALI_MONTHS,
  NEPALI_YEARS,
  getCurrentBSMonthYear,
  formatNPR,
  toNepaliNumerals,
} from '../utils/nepaliCalendar';
import {
  generateSingleBill,
  correctBill,
  editBillDetails,
  deleteSingleBill,
  deleteBillsBulk,
  canDeleteBill,
} from '../services/dbService';
import {
  Receipt,
  Search,
  Filter,
  Plus,
  Play,
  CheckCircle,
  Clock,
  Printer,
  AlertTriangle,
  ArrowRight,
  X,
  FileCheck,
  Calendar,
  Layers,
  Edit,
  ShieldAlert,
  Trash2,
  CheckSquare,
  Square,
  MinusSquare,
  AlertOctagon,
  Info,
  Check,
} from 'lucide-react';

interface BillingManagementProps {
  bills: Bill[];
  households: Household[];
  tariffs: Tariff[];
  wards: WardInfo[];
  settings: CommitteeSettings;
  payments?: Payment[];
  onRefresh: () => void;
  onViewBill: (bill: Bill) => void;
}

export const BillingManagement: React.FC<BillingManagementProps> = ({
  bills,
  households,
  tariffs,
  wards,
  settings,
  payments = [],
  onRefresh,
  onViewBill,
}) => {
  const { lang, t } = useLanguage();
  const { currentUser, isSuperAdmin, isBillingStaff, isAreaStaff, assignedWards } = useAuth();
  const currentBS = getCurrentBSMonthYear();

  // Filters
  const [selectedYear, setSelectedYear] = useState(currentBS.year);
  const [selectedMonth, setSelectedMonth] = useState(currentBS.monthEn);
  const [selectedWard, setSelectedWard] = useState(
    isAreaStaff && assignedWards.length > 0 ? assignedWards[0] : 'ALL'
  );
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [generationDateFilter, setGenerationDateFilter] = useState('');

  // Bulk / Multi-Selection State for Bill Management
  const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(new Set());

  // Delete Bills Confirmation Modal State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [billsPendingDeletion, setBillsPendingDeletion] = useState<Bill[] | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bulk Generation Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkYear, setBulkYear] = useState(currentBS.year);
  const [bulkMonthObj, setBulkMonthObj] = useState(
    NEPALI_MONTHS[currentBS.monthIndex - 1] || NEPALI_MONTHS[0]
  );
  const [bulkWardTarget, setBulkWardTarget] = useState('ALL');
  const [bulkDueDate, setBulkDueDate] = useState(
    `${currentBS.year}-${String(currentBS.monthIndex).padStart(2, '0')}-${settings.billingDueDayOfMonth || 20}`
  );
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, generated: 0, skipped: 0 });

  // Single Bill Modal
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [singleHouseholdId, setSingleHouseholdId] = useState('');
  const [singleFixedCharge, setSingleFixedCharge] = useState<number>(settings.standardMonthlyCharge || 150);
  const [singleDueDate, setSingleDueDate] = useState(
    `${currentBS.year}-${String(currentBS.monthIndex).padStart(2, '0')}-${settings.billingDueDayOfMonth || 20}`
  );
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState('');

  // Bill Correction / Editing Modal (Super Admin only with audit trail)
  const [correctingBill, setCorrectingBill] = useState<Bill | null>(null);
  const [editMonthlyCharge, setEditMonthlyCharge] = useState<number>(0);
  const [editSanitationCharge, setEditSanitationCharge] = useState<number>(0);
  const [editPenaltyAmount, setEditPenaltyAmount] = useState<number>(0);
  const [editDiscountAmount, setEditDiscountAmount] = useState<number>(0);
  const [editDueDate, setEditDueDate] = useState('');
  const [editBillingMonth, setEditBillingMonth] = useState('');
  const [editBillingYear, setEditBillingYear] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctingLoading, setCorrectingLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccessMsg, setEditSuccessMsg] = useState('');

  const handleOpenEditBill = (b: Bill) => {
    setCorrectingBill(b);
    setEditMonthlyCharge(b.monthlyCharge ?? 150);
    setEditSanitationCharge(b.sanitationCharge ?? 20);
    setEditPenaltyAmount(b.penaltyAmount ?? 0);
    setEditDiscountAmount(b.discountAmount ?? 0);
    setEditDueDate(b.dueDate ?? '');
    setEditBillingMonth(b.billingMonth ?? currentBS.monthEn);
    setEditBillingYear(b.billingYear ?? currentBS.year);
    setCorrectionReason('');
    setEditError('');
    setEditSuccessMsg('');
  };

  // Filtered households according to assigned wards
  const eligibleHouseholds = useMemo(() => {
    return households.filter((h) => {
      if (isAreaStaff && assignedWards.length > 0 && !assignedWards.includes(h.ward)) {
        return false;
      }
      return true;
    });
  }, [households, isAreaStaff, assignedWards]);

  // Selected single household
  const singleHousehold = useMemo(() => {
    return eligibleHouseholds.find((h) => h.id === singleHouseholdId) || null;
  }, [eligibleHouseholds, singleHouseholdId]);

  // Filtered Bills based on role ward-scoping, year, month, ward, status, issue date, and search
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      // Area staff may only access bills within their assigned wards
      if (isAreaStaff && assignedWards.length > 0 && !assignedWards.includes(b.ward)) {
        return false;
      }

      const matchYear = selectedYear === 'ALL' || b.billingYear === selectedYear;
      const matchMonth = selectedMonth === 'ALL' || b.billingMonth === selectedMonth;
      const matchWard = selectedWard === 'ALL' || b.ward === selectedWard;
      const matchStatus = selectedStatus === 'ALL' || b.status === selectedStatus;
      const matchIssueDate = !generationDateFilter || b.issueDate === generationDateFilter;
      const searchLower = searchTerm.toLowerCase();
      const matchSearch =
        searchTerm === '' ||
        b.billNumber.toLowerCase().includes(searchLower) ||
        b.customerId.toLowerCase().includes(searchLower) ||
        b.customerName.toLowerCase().includes(searchLower) ||
        (b.householdNumber && b.householdNumber.toLowerCase().includes(searchLower)) ||
        (b.tole && b.tole.toLowerCase().includes(searchLower));

      return matchYear && matchMonth && matchWard && matchStatus && matchIssueDate && matchSearch;
    });
  }, [bills, selectedYear, selectedMonth, selectedWard, selectedStatus, generationDateFilter, searchTerm, isAreaStaff, assignedWards]);

  // Selected Bills array
  const selectedBills = useMemo(() => {
    return bills.filter((b) => selectedBillIds.has(b.id));
  }, [bills, selectedBillIds]);

  const allFilteredSelected = useMemo(() => {
    return filteredBills.length > 0 && filteredBills.every((b) => selectedBillIds.has(b.id));
  }, [filteredBills, selectedBillIds]);

  const someFilteredSelected = useMemo(() => {
    return filteredBills.some((b) => selectedBillIds.has(b.id));
  }, [filteredBills, selectedBillIds]);

  const toggleSelectBill = (id: string) => {
    setSelectedBillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedBillIds((prev) => {
      const next = new Set(prev);
      filteredBills.forEach((b) => next.add(b.id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedBillIds(new Set());
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      clearSelection();
    } else {
      selectAllFiltered();
    }
  };

  // Safety audit evaluation for bills selected for deletion
  const safetyReport = useMemo(() => {
    if (!billsPendingDeletion) return { eligible: [] as Bill[], blocked: [] as { bill: Bill; reason: string }[] };
    const eligible: Bill[] = [];
    const blocked: { bill: Bill; reason: string }[] = [];
    for (const b of billsPendingDeletion) {
      const check = canDeleteBill(b, payments);
      if (check.canDelete) {
        eligible.push(b);
      } else {
        blocked.push({ bill: b, reason: check.reason || 'Payment recorded' });
      }
    }
    return { eligible, blocked };
  }, [billsPendingDeletion, payments]);

  // Handle bill deletion execution
  const handleExecuteDeletion = async () => {
    if (!billsPendingDeletion || billsPendingDeletion.length === 0) return;
    if (!deleteReason.trim()) {
      alert(lang === 'ne' ? 'कृपया बिल मेटाउनुको कारण (Audit Reason) अनिवार्य उल्लेख गर्नुहोस्।' : 'Please provide an audit reason for deleting.');
      return;
    }

    if (safetyReport.eligible.length === 0) {
      alert(lang === 'ne' ? 'चयन गरिएका सबै बिलहरूमा भुक्तानी/रसिद काटिसकिएको हुनाले कुनै पनि बिल मेटाउन मिल्दैन।' : 'None of the selected bills can be deleted due to payment records.');
      return;
    }

    setIsDeleting(true);
    setDeleteMessage(null);

    try {
      const operatorEmail = currentUser?.email || 'admin@khanepani.gov.np';
      const res = await deleteBillsBulk(safetyReport.eligible, deleteReason.trim(), operatorEmail, payments);

      if (res.deletedCount > 0) {
        setSelectedBillIds((prev) => {
          const next = new Set(prev);
          safetyReport.eligible.forEach((b) => next.delete(b.id));
          return next;
        });

        setDeleteMessage({
          type: 'success',
          text: lang === 'ne'
            ? `सफलतापूर्वक ${toNepaliNumerals(res.deletedCount)} वटा बिल मेटियो।` + (safetyReport.blocked.length > 0 ? ` (${toNepaliNumerals(safetyReport.blocked.length)} वटा भुक्तानी भएका बिल सुरक्षित राखियो)` : '')
            : `Successfully deleted ${res.deletedCount} bills.` + (safetyReport.blocked.length > 0 ? ` (${safetyReport.blocked.length} bills with payments retained)` : ''),
        });

        onRefresh();
        setTimeout(() => {
          setIsDeleteDialogOpen(false);
          setBillsPendingDeletion(null);
          setDeleteReason('');
          setDeleteMessage(null);
        }, 1200);
      } else {
        setDeleteMessage({
          type: 'error',
          text: lang === 'ne'
            ? `कुनै बिल मेटिएन। ${res.errors.join(', ')}`
            : `No bills deleted. ${res.errors.join(', ')}`,
        });
      }
    } catch (err: any) {
      console.error('Delete bills error:', err);
      setDeleteMessage({
        type: 'error',
        text: err.message || 'Failed to delete bills.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Execute Bulk Bill Generation
  const handleRunBulkGeneration = async () => {
    setBulkRunning(true);

    // Target households based on bulkWardTarget and active status
    const targetHouseholds = households.filter((h) => {
      const matchWard = bulkWardTarget === 'ALL' || h.ward === bulkWardTarget;
      return matchWard;
    });

    setBulkProgress({ current: 0, total: targetHouseholds.length, generated: 0, skipped: 0 });

    const monthEn = bulkMonthObj.en;
    const monthNe = bulkMonthObj.ne;
    const nepaliMonthYear = `${monthNe} ${toNepaliNumerals(bulkYear)}`;
    const issueDate = new Date().toISOString().split('T')[0];

    let genCount = 0;
    let skipCount = 0;

    for (let i = 0; i < targetHouseholds.length; i++) {
      const h = targetHouseholds[i];
      setBulkProgress((prev) => ({ ...prev, current: i + 1 }));

      // Prevent duplicate bills for the same household and billing period
      const existing = bills.find(
        (b) =>
          b.customerId === h.customerCode &&
          b.billingMonth === monthEn &&
          b.billingYear === bulkYear
      );

      if (existing) {
        skipCount++;
        continue;
      }

      const tariff = tariffs.find((t) => t.id === h.tariffId) || tariffs[0];
      try {
        await generateSingleBill({
          household: h,
          tariff,
          billingMonth: monthEn,
          billingYear: bulkYear,
          nepaliMonthYear,
          issueDate,
          dueDate: bulkDueDate,
          settings,
        });
        genCount++;
      } catch (err) {
        console.warn(`Failed to generate bill for ${h.customerCode}:`, err);
      }
    }

    setBulkProgress((prev) => ({ ...prev, generated: genCount, skipped: skipCount }));
    setBulkRunning(false);
    onRefresh();
  };

  // Run Single Bill Generation
  const handleGenerateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleHousehold) return;

    setSingleLoading(true);
    setSingleError('');

    try {
      const tariff = tariffs.find((t) => t.id === singleHousehold.tariffId) || tariffs[0];
      const monthObj = bulkMonthObj;
      const nepaliMonthYear = `${monthObj.ne} ${toNepaliNumerals(bulkYear)}`;

      await generateSingleBill({
        household: singleHousehold,
        tariff,
        billingMonth: monthObj.en,
        billingYear: bulkYear,
        nepaliMonthYear,
        overrideMonthlyCharge: singleFixedCharge,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: singleDueDate,
        settings,
      });

      setIsSingleModalOpen(false);
      setSingleHouseholdId('');
      onRefresh();
    } catch (err: any) {
      setSingleError(err.message || 'Failed to generate bill.');
    } finally {
      setSingleLoading(false);
    }
  };

  // Proposed total amount for live preview in Edit Bill modal
  const proposedTotalAmount = useMemo(() => {
    if (!correctingBill) return 0;
    const prev = correctingBill.previousBalance || 0;
    return Math.max(0, editMonthlyCharge + editSanitationCharge + editPenaltyAmount - editDiscountAmount + prev);
  }, [correctingBill, editMonthlyCharge, editSanitationCharge, editPenaltyAmount, editDiscountAmount]);

  // Execute Bill Correction / Editing (Super Admin only)
  const handleExecuteCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingBill) return;

    if (!correctionReason.trim()) {
      setEditError(lang === 'ne' ? 'कृपया संशोधनको आधिकारिक कारण (Audit Reason) अनिवार्य उल्लेख गर्नुहोस्।' : 'Please state an audit reason for adjusting this issued bill.');
      return;
    }

    if (correctingBill.paidAmount > 0 && proposedTotalAmount < correctingBill.paidAmount) {
      setEditError(
        lang === 'ne'
          ? `नयाँ कुल रकम (रु ${proposedTotalAmount}) पहिले नै भुक्तानी भइसकेको रकम (रु ${correctingBill.paidAmount}) भन्दा कम हुन सक्दैन।`
          : `New total (NPR ${proposedTotalAmount}) cannot be less than already paid amount (NPR ${correctingBill.paidAmount}).`
      );
      return;
    }

    setCorrectingLoading(true);
    setEditError('');
    setEditSuccessMsg('');

    try {
      const monthObj = NEPALI_MONTHS.find((m) => m.en === editBillingMonth) || NEPALI_MONTHS[0];
      const nepaliMonthYear = `${monthObj.ne} ${toNepaliNumerals(editBillingYear)}`;

      await editBillDetails({
        billId: correctingBill.id,
        monthlyCharge: Number(editMonthlyCharge),
        sanitationCharge: Number(editSanitationCharge),
        penaltyAmount: Number(editPenaltyAmount),
        discountAmount: Number(editDiscountAmount),
        dueDate: editDueDate,
        billingMonth: editBillingMonth,
        billingYear: editBillingYear,
        nepaliMonthYear,
        reason: correctionReason.trim(),
        operatorEmail: currentUser?.email || 'admin@khanepani.gov.np',
      });

      setEditSuccessMsg(lang === 'ne' ? 'बिल सफलतापूर्वक संशोधन गरियो र बक्यौता मिलान भयो!' : 'Bill updated successfully and balance reconciled!');
      onRefresh();

      setTimeout(() => {
        setCorrectingBill(null);
        setCorrectionReason('');
        setEditSuccessMsg('');
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || 'Failed to update bill');
    } finally {
      setCorrectingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-sky-600" />
            <span>{lang === 'ne' ? 'मासिक तोकिएको महसुल बिलिङ इन्जिन' : 'Fixed Monthly Household Billing Engine'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'ne'
              ? `नियमित मासिक शुल्क (रु ${settings.standardMonthlyCharge || 150}), सरसफाइ/मर्मत शुल्क तथा अघिल्लो बक्यौता हिसाब गरी एकमुष्ठ वा वडागत बिल जारी गर्नुहोस्।`
              : `Generates fixed monthly household utility bills (NPR ${settings.standardMonthlyCharge || 150} standard) with audit trails and duplicate prevention.`}
          </p>
        </div>

        {isBillingStaff && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setSingleHouseholdId(eligibleHouseholds[0]?.id || '');
                setSingleFixedCharge(settings.standardMonthlyCharge || 150);
                setIsSingleModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-sky-600" />
              <span>{lang === 'ne' ? 'व्यक्तिगत बिल जारी' : 'Single Bill'}</span>
            </button>

            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{lang === 'ne' ? 'एकमुष्ठ मासिक बिल जारी (Bulk)' : 'Bulk Generate Bills'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={lang === 'ne' ? 'बिल नं, ग्राहक कोड, नाम, टोल...' : 'Search bill no, code, name, tole...'}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Issue Date Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200" title="Filter by bill issue date">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={generationDateFilter}
              onChange={(e) => setGenerationDateFilter(e.target.value)}
              className="text-xs bg-transparent border-0 focus:outline-none text-slate-700"
            />
            {generationDateFilter && (
              <button
                type="button"
                onClick={() => setGenerationDateFilter('')}
                className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title="Clear date filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
          >
            <option value="ALL">All Years</option>
            {NEPALI_YEARS.map((y) => (
              <option key={y} value={y}>
                BS {y}
              </option>
            ))}
          </select>

          {/* Month Filter */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
          >
            <option value="ALL">All Months</option>
            {NEPALI_MONTHS.map((m) => (
              <option key={m.index} value={m.en}>
                {m.ne} ({m.en})
              </option>
            ))}
          </select>

          {/* Ward Filter */}
          <select
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
          >
            {!isAreaStaff && <option value="ALL">All Wards</option>}
            {wards.map((w) => (
              <option key={w.id} value={w.wardNumber}>
                Ward {w.wardNumber}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
          >
            <option value="ALL">{lang === 'ne' ? 'सबै स्थिति (All Status)' : 'All Status'}</option>
            <option value="UNPAID">{lang === 'ne' ? 'भुक्तानी नभएको (UNPAID)' : 'UNPAID'}</option>
            <option value="PARTIALLY_PAID">{lang === 'ne' ? 'आंशिक भुक्तानी (PARTIALLY PAID)' : 'PARTIALLY PAID'}</option>
            <option value="PAID">{lang === 'ne' ? 'भुक्तानी भएको (PAID)' : 'PAID'}</option>
            <option value="PENDING">{lang === 'ne' ? 'पुष्टि हुन बाँकी (PENDING)' : 'PENDING'}</option>
            <option value="OVERDUE">{lang === 'ne' ? 'म्याद नाघेको (OVERDUE)' : 'OVERDUE'}</option>
            <option value="CANCELLED">{lang === 'ne' ? 'रद्द गरिएको (CANCELLED)' : 'CANCELLED'}</option>
          </select>
        </div>
      </div>

      {/* Multi-Select Action Ribbon */}
      {selectedBillIds.size > 0 && (
        <div className="bg-sky-50 border-2 border-sky-300 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-sky-600 text-white font-bold text-xs shadow-2xs">
              {selectedBillIds.size}
            </span>
            <div>
              <span className="text-xs font-bold text-sky-950 block">
                {lang === 'ne'
                  ? `${toNepaliNumerals(selectedBillIds.size)} वटा बिल चयन गरिएको छ`
                  : `${selectedBillIds.size} bills selected`}
              </span>
              <span className="text-[11px] text-sky-700">
                {lang === 'ne'
                  ? `कुल रकम: रु ${selectedBills.reduce((acc, b) => acc + (b.totalAmount || 0), 0).toLocaleString()} • उपभोक्ता संख्या: ${toNepaliNumerals(new Set(selectedBills.map(b => b.customerId)).size)} जना`
                  : `Total Amount: NPR ${selectedBills.reduce((acc, b) => acc + (b.totalAmount || 0), 0).toLocaleString()} • ${new Set(selectedBills.map(b => b.customerId)).size} Consumers`}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filteredBills.length > selectedBillIds.size && (
              <button
                type="button"
                onClick={selectAllFiltered}
                className="px-3 py-1.5 rounded-xl border border-sky-200 bg-white hover:bg-sky-100 text-sky-800 text-xs font-semibold cursor-pointer transition-colors"
              >
                {lang === 'ne'
                  ? `फिल्टर अनुसार सबै (${toNepaliNumerals(filteredBills.length)}) चयन`
                  : `Select All Filtered (${filteredBills.length})`}
              </button>
            )}

            <button
              type="button"
              onClick={clearSelection}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
            >
              {lang === 'ne' ? 'चयन हटाउनुहोस्' : 'Clear Selection'}
            </button>

            {selectedBills.length === 1 && (
              <button
                type="button"
                onClick={() => onViewBill(selectedBills[0])}
                className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{lang === 'ne' ? 'बिल छाप्नुहोस्' : 'Print Bill'}</span>
              </button>
            )}

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setBillsPendingDeletion(selectedBills);
                  setDeleteReason('');
                  setDeleteMessage(null);
                  setIsDeleteDialogOpen(true);
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ne'
                    ? `चयन गरिएका (${toNepaliNumerals(selectedBillIds.size)}) बिल मेटाउनुहोस्`
                    : `Delete Selected (${selectedBillIds.size}) Bills`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bills Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="py-3 px-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
                    }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    title={allFilteredSelected ? 'Deselect all' : 'Select all matching filter'}
                  />
                </th>
                <th className="py-3 px-4">{t('billNumber')}</th>
                <th className="py-3 px-4">{t('customerCode')}</th>
                <th className="py-3 px-4">{t('ownerName')}</th>
                <th className="py-3 px-4">Ward / Tole</th>
                <th className="py-3 px-4">{t('billingPeriod')}</th>
                <th className="py-3 px-4 text-right">Fixed Monthly Fee</th>
                <th className="py-3 px-4 text-right">Prev Balance</th>
                <th className="py-3 px-4 text-right">{t('totalDue')}</th>
                <th className="py-3 px-4 text-right">{t('paidAmount')}</th>
                <th className="py-3 px-4 text-right">{t('balanceDue')}</th>
                <th className="py-3 px-4 text-center">{t('status')}</th>
                <th className="py-3 px-4 text-right">{lang === 'ne' ? 'कार्य' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-slate-500 italic">
                    No bills found for the selected filter. Click "Bulk Generate Bills" to issue monthly bills.
                  </td>
                </tr>
              ) : (
                filteredBills.map((b) => (
                  <tr
                    key={b.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      selectedBillIds.has(b.id) ? 'bg-sky-50/60' : ''
                    }`}
                  >
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedBillIds.has(b.id)}
                        onChange={() => toggleSelectBill(b.id)}
                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4 font-bold text-sky-700 font-mono">{b.billNumber}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{b.customerId}</td>
                    <td className="py-3 px-4 text-slate-900 font-medium">{b.customerName}</td>
                    <td className="py-3 px-4 text-slate-600">
                      Ward {b.ward}{b.tole ? `, ${b.tole}` : ''}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {lang === 'ne' ? b.nepaliMonthYear : `${b.billingMonth} ${b.billingYear}`}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-800">
                      रु {b.monthlyCharge || 150}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {formatNPR(b.previousBalance || 0, lang)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatNPR(b.totalAmount, lang)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                      {formatNPR(b.paidAmount, lang)}
                    </td>
                    <td className={`py-3 px-4 text-right font-black ${b.balanceDue > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      {formatNPR(b.balanceDue, lang)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          b.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'PARTIALLY_PAID'
                            ? 'bg-amber-100 text-amber-800'
                            : b.status === 'PENDING'
                            ? 'bg-blue-100 text-blue-800'
                            : b.status === 'OVERDUE'
                            ? 'bg-red-100 text-red-900'
                            : b.status === 'CANCELLED'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {b.status === 'PAID' ? (lang === 'ne' ? 'भुक्तानी भएको' : 'PAID') :
                         b.status === 'PARTIALLY_PAID' ? (lang === 'ne' ? 'आंशिक भुक्तानी' : 'PARTIALLY PAID') :
                         b.status === 'PENDING' ? (lang === 'ne' ? 'पुष्टि हुन बाँकी' : 'PENDING') :
                         b.status === 'OVERDUE' ? (lang === 'ne' ? 'म्याद नाघेको' : 'OVERDUE') :
                         b.status === 'CANCELLED' ? (lang === 'ne' ? 'रद्द गरिएको' : 'CANCELLED') :
                         (lang === 'ne' ? 'भुक्तानी नभएको' : 'UNPAID')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewBill(b)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg text-sky-700 bg-sky-50 hover:bg-sky-100 flex items-center gap-1 cursor-pointer transition-colors"
                          title={lang === 'ne' ? 'बिल हेर्नुहोस् र छाप्नुहोस्' : 'View & Print Bill'}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{lang === 'ne' ? 'बिल छाप्नुहोस्' : 'Print Bill'}</span>
                        </button>

                        {/* Super Admin authorized correction */}
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleOpenEditBill(b)}
                            className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                            title={lang === 'ne' ? 'बिल संशोधन गर्नुहोस् (Edit Bill)' : 'Edit Bill (with audit trail)'}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Super Admin authorized single bill delete */}
                        {isSuperAdmin && (
                          <button
                            onClick={() => {
                              setBillsPendingDeletion([b]);
                              setDeleteReason('');
                              setDeleteMessage(null);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer transition-colors"
                            title={lang === 'ne' ? 'यो बिल मेटाउनुहोस् (Delete Bill)' : 'Delete Bill'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-4">
            <span>
              {lang === 'ne' ? 'कुल बिल संख्या:' : 'Total Bills:'} {toNepaliNumerals(filteredBills.length)}
            </span>
            {selectedBillIds.size > 0 && (
              <span className="font-semibold text-sky-700">
                {lang === 'ne' ? 'चयन गरिएको:' : 'Selected:'} {toNepaliNumerals(selectedBillIds.size)}
              </span>
            )}
          </div>
          <span>Snapshot Preserved Invariant</span>
        </div>
      </div>

      {/* Bulk Generation Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-sky-800 text-white p-5 flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Play className="w-5 h-5 fill-sky-200" />
                <span>{lang === 'ne' ? 'एकमुष्ठ मासिक बिल जारी गर्नुहोस्' : 'Bulk Monthly Bill Generation'}</span>
              </h3>
              <button
                disabled={bulkRunning}
                onClick={() => setIsBulkModalOpen(false)}
                className="text-sky-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900">
                <p className="font-semibold mb-1">Fixed Monthly Fee Model:</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-sky-800">
                  <li>
                    Standard monthly household fee: <strong>NPR {settings.standardMonthlyCharge || 150}</strong> (or custom fee set on household record).
                  </li>
                  <li>
                    Sanitation Cess: NPR {settings.sanitationFee || 20} • Maintenance: NPR {settings.maintenanceFee || 10}.
                  </li>
                  <li>
                    Prevents duplicates: existing bills for the chosen month will be skipped safely.
                  </li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Billing Year (BS)</label>
                  <select
                    value={bulkYear}
                    disabled={bulkRunning}
                    onChange={(e) => setBulkYear(e.target.value)}
                    className="w-full p-2 border rounded-xl bg-white"
                  >
                    {NEPALI_YEARS.map((y) => <option key={y} value={y}>BS {y}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Billing Month</label>
                  <select
                    value={bulkMonthObj.en}
                    disabled={bulkRunning}
                    onChange={(e) => {
                      const found = NEPALI_MONTHS.find((m) => m.en === e.target.value);
                      if (found) setBulkMonthObj(found);
                    }}
                    className="w-full p-2 border rounded-xl bg-white"
                  >
                    {NEPALI_MONTHS.map((m) => (
                      <option key={m.index} value={m.en}>
                        {m.ne} ({m.en})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Ward Selection</label>
                  <select
                    value={bulkWardTarget}
                    disabled={bulkRunning}
                    onChange={(e) => setBulkWardTarget(e.target.value)}
                    className="w-full p-2 border rounded-xl bg-white"
                  >
                    <option value="ALL">All Eligible Wards</option>
                    {wards.map((w) => (
                      <option key={w.id} value={w.wardNumber}>Ward {w.wardNumber}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    disabled={bulkRunning}
                    value={bulkDueDate}
                    onChange={(e) => setBulkDueDate(e.target.value)}
                    className="w-full p-2 border rounded-xl"
                  />
                </div>
              </div>

              {bulkRunning && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs text-slate-600 font-semibold">
                    <span>Generating bills...</span>
                    <span>{bulkProgress.current} / {bulkProgress.total}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-600 h-2 transition-all duration-150"
                      style={{ width: `${Math.round((bulkProgress.current / (bulkProgress.total || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {bulkProgress.total > 0 && !bulkRunning && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
                  Bulk run complete: Generated {bulkProgress.generated} bills, skipped {bulkProgress.skipped} existing duplicates.
                </div>
              )}

              <div className="pt-4 border-t flex justify-end gap-2">
                <button
                  type="button"
                  disabled={bulkRunning}
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkRunning}
                  onClick={handleRunBulkGeneration}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  {bulkRunning ? 'Generating...' : 'Start Bulk Generation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Bill Modal */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900">Generate Individual Monthly Bill</h3>

            {singleError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                {singleError}
              </div>
            )}

            <form onSubmit={handleGenerateSingle} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Household *</label>
                <select
                  required
                  value={singleHouseholdId}
                  onChange={(e) => {
                    setSingleHouseholdId(e.target.value);
                    const h = eligibleHouseholds.find((item) => item.id === e.target.value);
                    if (h) setSingleFixedCharge(h.monthlyFixedCharge || settings.standardMonthlyCharge || 150);
                  }}
                  className="w-full p-2 border rounded-xl bg-white"
                >
                  {eligibleHouseholds.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.customerCode} - {h.ownerName} (Ward {h.ward}, {h.householdNumber})
                    </option>
                  ))}
                </select>
              </div>

              {singleHousehold && (
                <div className="p-3 bg-slate-50 border rounded-xl space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ward & Tole:</span>
                    <span className="font-semibold">Ward {singleHousehold.ward}, {singleHousehold.tole}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Carried-Forward Balance:</span>
                    <span className="font-bold text-rose-600">{formatNPR(singleHousehold.currentBalance || 0, lang)}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Monthly Fixed Charge (NPR) *</label>
                <input
                  type="number"
                  required
                  value={singleFixedCharge}
                  onChange={(e) => setSingleFixedCharge(Number(e.target.value))}
                  className="w-full p-2 border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={singleDueDate}
                  onChange={(e) => setSingleDueDate(e.target.value)}
                  className="w-full p-2 border rounded-xl"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={singleLoading}
                  className="px-5 py-2 bg-sky-600 text-white rounded-xl font-semibold"
                >
                  {singleLoading ? 'Generating...' : 'Issue Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comprehensive Edit Bill Modal (Super Admin only with audit trail) */}
      {correctingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-sky-800 text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  <Edit className="w-5 h-5 text-sky-200" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {lang === 'ne' ? 'बिल संशोधन तथा सम्पादन (Edit Bill)' : 'Edit Mistakenly Generated Bill'}
                  </h3>
                  <p className="text-xs text-sky-200">
                    {lang === 'ne'
                      ? 'गल्तीले जारी भएका बिलहरूको महसुल दर, मिति र विवरण आधिकारिक अडिट अभिलेख सहित संशोधन'
                      : 'Authorized administrative correction with permanent before-and-after audit logs.'}
                  </p>
                </div>
              </div>
              <button
                disabled={correctingLoading}
                onClick={() => setCorrectingBill(null)}
                className="text-sky-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteCorrection} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Messages */}
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}
              {editSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{editSuccessMsg}</span>
                </div>
              )}

              {/* Consumer & Bill Summary */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Bill No</span>
                  <span className="font-mono font-bold text-sky-700">{correctingBill.billNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Customer ID</span>
                  <span className="font-semibold text-slate-900">{correctingBill.customerId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Customer Name</span>
                  <span className="font-medium text-slate-900 truncate block">{correctingBill.customerName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Ward / Tole</span>
                  <span className="font-medium text-slate-700">Ward {correctingBill.ward}{correctingBill.tole ? `, ${correctingBill.tole}` : ''}</span>
                </div>
              </div>

              {/* Warning if payments already made */}
              {correctingBill.paidAmount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      {lang === 'ne' ? 'आंशिक भुक्तानी भइसकेको बिल:' : 'Partial Payment Warning:'}
                    </span>
                    <span className="text-[11px]">
                      {lang === 'ne'
                        ? `यो बिलमा पहिले नै रु ${correctingBill.paidAmount} भुक्तानी भइसकेको छ। कुल नयाँ रकम रु ${correctingBill.paidAmount} भन्दा कम गर्न पाइने छैन।`
                        : `This bill already has payments of NPR ${correctingBill.paidAmount}. The revised total cannot be lower than the paid amount.`}
                    </span>
                  </div>
                </div>
              )}

              {/* Before vs Proposed Comparison Card */}
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[11px] text-sky-700 block">{lang === 'ne' ? 'साविक कुल रकम' : 'Original Total'}</span>
                  <span className="text-sm font-bold text-slate-700">रु {correctingBill.totalAmount}</span>
                </div>
                <div>
                  <span className="text-[11px] text-sky-700 block">{lang === 'ne' ? 'प्रस्तावित नयाँ रकम' : 'Proposed Total'}</span>
                  <span className="text-sm font-extrabold text-sky-900">रु {proposedTotalAmount}</span>
                </div>
                <div>
                  <span className="text-[11px] text-sky-700 block">{lang === 'ne' ? 'रकम फरक (Diff)' : 'Difference'}</span>
                  <span className={`text-sm font-bold ${proposedTotalAmount - correctingBill.totalAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {proposedTotalAmount - correctingBill.totalAmount > 0 ? '+' : ''}
                    रु {proposedTotalAmount - correctingBill.totalAmount}
                  </span>
                </div>
              </div>

              {/* Editable Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Billing Year */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'बिलिङ वर्ष (BS) *' : 'Billing Year (BS) *'}
                  </label>
                  <select
                    value={editBillingYear}
                    onChange={(e) => setEditBillingYear(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    {NEPALI_YEARS.map((y) => (
                      <option key={y} value={y}>
                        BS {y}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Billing Month */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'बिलिङ महिना *' : 'Billing Month *'}
                  </label>
                  <select
                    value={editBillingMonth}
                    onChange={(e) => setEditBillingMonth(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    {NEPALI_MONTHS.map((m) => (
                      <option key={m.index} value={m.en}>
                        {m.ne} ({m.en})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fixed Monthly Charge */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'मासिक तोकिएको महसुल (रु) *' : 'Fixed Monthly Charge (NPR) *'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editMonthlyCharge}
                    onChange={(e) => setEditMonthlyCharge(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>

                {/* Sanitation Fee */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'सरसफाइ तथा मर्मत शुल्क (रु)' : 'Sanitation / Maintenance Fee (NPR)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editSanitationCharge}
                    onChange={(e) => setEditSanitationCharge(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-slate-300 font-medium"
                  />
                </div>

                {/* Penalty */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'विलम्ब जरिवाना रकम (रु)' : 'Late Penalty Amount (NPR)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editPenaltyAmount}
                    onChange={(e) => setEditPenaltyAmount(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-slate-300 font-medium"
                  />
                </div>

                {/* Discount */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'विशेष छुट रकम (रु)' : 'Discount Amount (NPR)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editDiscountAmount}
                    onChange={(e) => setEditDiscountAmount(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-slate-300 font-medium"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'भुक्तानी म्याद (Due Date) *' : 'Payment Due Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full p-2 rounded-xl border border-slate-300"
                  />
                </div>

                {/* Previous Balance snapshot info */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'साविक अघिल्लो बक्यौता (रु)' : 'Previous Balance (NPR)'}
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`रु ${correctingBill.previousBalance || 0}`}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-semibold cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Mandatory Reason for Audit Log */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  {lang === 'ne' ? 'संशोधनको आधिकारिक कारण (Audit Correction Reason) *' : 'Audit Correction Reason *'}
                </label>
                <textarea
                  required
                  rows={2}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder={
                    lang === 'ne'
                      ? 'जस्तै: समिति निर्णय अनुसार महसुल छुट, गलत महिना सच्याइएको, धारा बन्द अवधि समायोजन...'
                      : 'e.g. Committee resolution discount adjustment, corrected billing cycle...'
                  }
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={correctingLoading}
                  onClick={() => setCorrectingBill(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {lang === 'ne' ? 'रद्द गर्नुहोस् (Cancel)' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={correctingLoading || !correctionReason.trim()}
                  className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {correctingLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>{lang === 'ne' ? 'सुरक्षित गर्दै...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{lang === 'ne' ? 'संशोधन स्वीकृत गरी सुरक्षित गर्नुहोस्' : 'Authorize & Save Correction'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Bills Confirmation Dialog (Main Admin / Super Admin) */}
      {isDeleteDialogOpen && billsPendingDeletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-rose-700 text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  <AlertTriangle className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {lang === 'ne' ? 'बिल मेटाउने प्रशासनिक पुष्टि' : 'Confirm Bill Deletion'}
                  </h3>
                  <p className="text-xs text-rose-100">
                    {lang === 'ne'
                      ? 'गल्तीवश जारी भएका वा दोहोरो बिलहरू मेटाउनु अघि वित्तीय सुरक्षा समीक्षा'
                      : 'Audit review and financial safety check before removing generated bills.'}
                  </p>
                </div>
              </div>
              <button
                disabled={isDeleting}
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setBillsPendingDeletion(null);
                  setDeleteReason('');
                  setDeleteMessage(null);
                }}
                className="text-rose-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {deleteMessage && (
                <div
                  className={`p-3.5 rounded-xl border flex items-center gap-2.5 ${
                    deleteMessage.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {deleteMessage.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-medium">{deleteMessage.text}</span>
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {lang === 'ne' ? 'चयन गरिएका कुल बिल' : 'Total Bills Selected'}
                  </span>
                  <span className="text-lg font-black text-slate-900 mt-1 block">
                    {toNepaliNumerals(billsPendingDeletion.length)} वटा
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {lang === 'ne' ? 'प्रभावित महिना / वर्ष' : 'Billing Period(s)'}
                  </span>
                  <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
                    {Array.from(new Set(billsPendingDeletion.map((b) => b.nepaliMonthYear || `${b.billingMonth} ${b.billingYear}`))).join(', ')}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {lang === 'ne' ? 'मेटाउन लागिएको कुल रकम' : 'Total Amount to Remove'}
                  </span>
                  <span className="text-lg font-black text-rose-600 mt-1 block">
                    रु {billsPendingDeletion.reduce((acc, b) => acc + (b.totalAmount || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Financial Safety Check Alert */}
              {safetyReport.blocked.length > 0 && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-2 text-amber-900">
                  <div className="flex items-center gap-2 font-bold text-amber-800 text-xs">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {lang === 'ne'
                        ? `सुरक्षा सतर्कता: ${toNepaliNumerals(safetyReport.blocked.length)} वटा बिलमा भुक्तानी/रसिद काटिसकिएको हुनाले मेटाउन मिल्दैन!`
                        : `Financial Guard: ${safetyReport.blocked.length} bills have recorded payment history and CANNOT be deleted!`}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {lang === 'ne'
                      ? 'वित्तीय नियम तथा अडिट इनभ्यारिएन्ट अनुसार भुक्तानी भएको बिल मेटाउन सख्त निषेध छ। यी बिलहरू सुरक्षित राखिनेछन् र बाँकी भुक्तानी नभएका बिलहरू मात्र मेटिनेछन्।'
                      : 'Statutory accounting rules prohibit deleting bills with completed or partial payments. Blocked bills will be preserved safely.'}
                  </p>
                  <div className="max-h-24 overflow-y-auto bg-white/70 p-2 rounded-lg border border-amber-200 divide-y divide-amber-100 text-[11px]">
                    {safetyReport.blocked.map(({ bill, reason }) => (
                      <div key={bill.id} className="py-1 flex justify-between items-center">
                        <span className="font-mono font-bold text-slate-800">{bill.billNumber} ({bill.customerName})</span>
                        <span className="text-amber-700 font-medium">{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Affected Consumers Preview Table */}
              <div>
                <div className="flex justify-between items-center mb-1.5 font-bold text-slate-700 text-xs">
                  <span>
                    {lang === 'ne'
                      ? `मेटाउन लागिएका उपभोक्ता बिलहरू (${toNepaliNumerals(safetyReport.eligible.length)} वटा)`
                      : `Eligible Bills to Delete (${safetyReport.eligible.length})`}
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {lang === 'ne' ? 'सम्बन्धित घरधुरीको बक्यौता स्वतः समायोजन हुनेछ' : 'Household balances will reconcile automatically'}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b text-slate-600 font-semibold sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Bill Number</th>
                        <th className="py-2 px-3">Customer</th>
                        <th className="py-2 px-3">Ward</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {safetyReport.eligible.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-500 italic">
                            {lang === 'ne'
                              ? 'कुनै पनि बिल मेटाउन योग्य छैन (सबैमा भुक्तानी रेकर्ड छ)।'
                              : 'No eligible bills to delete (all have payment records).'}
                          </td>
                        </tr>
                      ) : (
                        safetyReport.eligible.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-sky-700">{b.billNumber}</td>
                            <td className="py-2 px-3 text-slate-900 font-medium">
                              {b.customerName} <span className="text-slate-400 font-mono">({b.customerId})</span>
                            </td>
                            <td className="py-2 px-3 text-slate-600">Ward {b.ward}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              {formatNPR(b.totalAmount, lang)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                {b.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Informational Guidance on Financial Safety */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <p className="font-semibold">
                    {lang === 'ne' ? 'वित्तीय मिलान तथा इनभ्यारिएन्ट नियम:' : 'Financial Reconciliation Rule:'}
                  </p>
                  <p>
                    {lang === 'ne'
                      ? 'बिल मेटिएपछि सम्बन्धित घरधुरीको बाँकी बक्यौता (Current Balance) बाट उक्त बिलको शुल्क स्वतः घटाएर सही स्थिति कायम गरिन्छ। यस कार्यको पूर्ण अभिलेख (Permanent Audit Log) मुख्य प्रशासकको इमेल सहित सुरक्षित रहन्छ।'
                      : 'Deleted bills automatically reduce the consumer balance back to prior state and a permanent audit log is recorded.'}
                  </p>
                </div>
              </div>

              {/* Mandatory Reason for Audit Trail */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  {lang === 'ne' ? 'बिल मेटाउनुको आधिकारिक कारण (Audit Reason) *' : 'Reason for Deletion (Audit Trail) *'}
                </label>
                <textarea
                  required
                  rows={2}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder={
                    lang === 'ne'
                      ? 'जस्तै: गल्तीले दोहोरो बिल जारी भएको, गलत महसुल दर संशोधन गरिएको...'
                      : 'e.g., Mistaken duplicate bill generation, incorrect tariff applied...'
                  }
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setBillsPendingDeletion(null);
                  setDeleteReason('');
                  setDeleteMessage(null);
                }}
                className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-100 text-xs cursor-pointer transition-colors"
              >
                {lang === 'ne' ? 'रद्द गर्नुहोस् (Cancel)' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={isDeleting || safetyReport.eligible.length === 0 || !deleteReason.trim()}
                onClick={handleExecuteDeletion}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>{lang === 'ne' ? 'मेटिँदैछ...' : 'Deleting...'}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>
                      {lang === 'ne'
                        ? `पुष्टि गरी ${toNepaliNumerals(safetyReport.eligible.length)} वटा बिल मेटाउनुहोस्`
                        : `Confirm Delete (${safetyReport.eligible.length}) Bills`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
