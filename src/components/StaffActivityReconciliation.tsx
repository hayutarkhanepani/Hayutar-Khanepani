import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Bill,
  Payment,
  Household,
  UserProfile,
  CommitteeSettings,
  StaffCashHandover,
  HandoverStatus,
  AuditLog,
} from '../types';
import {
  getStaffReconciliations,
  saveStaffCashHandover,
  reviewStaffReconciliation,
  getAuditLogs,
} from '../services/dbService';
import {
  ShieldAlert,
  Users,
  Calendar,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Printer,
  Search,
  Scale,
  DollarSign,
  TrendingUp,
  Clock,
  FileText,
  CreditCard,
  Building,
  RotateCcw,
  Check,
  ChevronDown,
  RefreshCw,
  Eye,
  PlusCircle,
  AlertCircle,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { toNepaliNumerals, formatNPR } from '../utils/nepaliCalendar';

interface StaffActivityReconciliationProps {
  bills: Bill[];
  payments: Payment[];
  households: Household[];
  users: UserProfile[];
  settings: CommitteeSettings;
  onRefresh?: () => Promise<void>;
  onViewBill?: (bill: Bill) => void;
  onViewReceipt?: (payment: Payment) => void;
}

export interface ActivityLedgerItem {
  id: string;
  type: 'BILL' | 'PAYMENT' | 'CONSUMER' | 'HANDOVER' | 'AUDIT_CORRECTION';
  typeLabelNe: string;
  typeLabelEn: string;
  referenceId: string;
  consumerCode: string;
  consumerName: string;
  billNumber?: string;
  billingPeriod?: string;
  amount: number;
  originalAmount?: number;
  paymentMethod?: string;
  status: string;
  receiptNumber?: string;
  actorUid: string;
  actorStaffId: string;
  actorName: string;
  actorEmail: string;
  isHistoricalOrUnknown: boolean;
  timestamp: string;
  reason?: string;
}

export const StaffActivityReconciliation: React.FC<StaffActivityReconciliationProps> = ({
  bills,
  payments,
  households,
  users,
  settings,
  onRefresh,
  onViewBill,
  onViewReceipt,
}) => {
  const { currentUser, isSuperAdmin } = useAuth();
  const { lang, t } = useLanguage();

  // Active view tab inside module
  const [activeTab, setActiveTab] = useState<'summary' | 'reconciliation' | 'ledger' | 'discrepancies'>('summary');

  // Filters
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('ALL'); // 'ALL' or staffUid or staffId
  const [periodPreset, setPeriodPreset] = useState<'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'>('THIS_MONTH');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('ALL'); // 'ALL', 'BILLS', 'PAYMENTS', 'CONSUMERS', 'HANDOVERS'
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // 'ALL', 'COMPLETED', 'CANCELLED', 'PENDING'
  const [billingPeriodFilter, setBillingPeriodFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Server data: Cash handovers and Audit logs
  const [handovers, setHandovers] = useState<StaffCashHandover[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Modals
  const [showHandoverModal, setShowHandoverModal] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [selectedHandoverForReview, setSelectedHandoverForReview] = useState<StaffCashHandover | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [reviewDecision, setReviewDecision] = useState<HandoverStatus>('APPROVED');

  // New Handover Form State
  const [newHandoverStaffUid, setNewHandoverStaffUid] = useState<string>('');
  const [newHandoverDate, setNewHandoverDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newHandoverShift, setNewHandoverShift] = useState<'FULL_DAY' | 'MORNING' | 'DAY' | 'EVENING'>('FULL_DAY');
  const [newHandoverOpeningBalance, setNewHandoverOpeningBalance] = useState<number>(0);
  const [newHandoverCountedCash, setNewHandoverCountedCash] = useState<number>(0);
  const [newHandoverExplanation, setNewHandoverExplanation] = useState<string>('');

  // Print Mode State
  const [printMode, setPrintMode] = useState<boolean>(false);

  // 1. Strict Super Admin Access Verification
  const isAuthorized = currentUser?.email?.toLowerCase() === 'hayutarkhanepani@gmail.com';

  // Initialize date range based on preset
  useEffect(() => {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (periodPreset === 'ALL') {
      setDateFrom('');
      setDateTo('');
    } else if (periodPreset === 'TODAY') {
      const d = toISO(today);
      setDateFrom(d);
      setDateTo(d);
    } else if (periodPreset === 'THIS_WEEK') {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day; // Sunday start
      d.setDate(diff);
      setDateFrom(toISO(d));
      setDateTo(toISO(today));
    } else if (periodPreset === 'THIS_MONTH') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(toISO(start));
      setDateTo(toISO(today));
    } else if (periodPreset === 'LAST_MONTH') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setDateFrom(toISO(start));
      setDateTo(toISO(end));
    }
  }, [periodPreset]);

  // Load backend handovers and audit logs
  const loadData = async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const [hList, logs] = await Promise.all([
        getStaffReconciliations(),
        getAuditLogs(300),
      ]);
      setHandovers(hList || []);
      setAuditLogs(logs || []);
    } catch (err) {
      console.error('Failed to load staff reconciliation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAuthorized]);

  // Build Unified Staff Directory (both active/inactive users and distinct historical staff names)
  const staffList = useMemo(() => {
    const map = new Map<string, { uid: string; staffId: string; displayName: string; email: string; role: string; accountStatus: string }>();

    // 1. Registered staff from users
    users
      .filter((u) => u.role !== 'CUSTOMER')
      .forEach((u) => {
        map.set(u.uid, {
          uid: u.uid,
          staffId: u.staffId || 'STF-AUTO',
          displayName: u.displayName || u.email?.split('@')[0] || 'Staff Member',
          email: u.email || '',
          role: u.role,
          accountStatus: u.accountStatus || (u.isActive ? 'ACTIVE' : 'INACTIVE'),
        });
      });

    // 2. Discover actors from payments
    payments.forEach((p) => {
      if (p.receivedBy && !map.has(p.receivedBy)) {
        map.set(p.receivedBy, {
          uid: p.receivedBy,
          staffId: p.receivedBy.startsWith('STF') ? p.receivedBy : 'HISTORICAL',
          displayName: p.staffName || p.receivedBy,
          email: '',
          role: 'BILLING_STAFF',
          accountStatus: 'HISTORICAL',
        });
      }
    });

    return Array.from(map.values());
  }, [users, payments]);

  // Helper: Find matching staff info for an actor
  const resolveActor = (actorUidOrEmail?: string, staffName?: string) => {
    if (!actorUidOrEmail && !staffName) {
      return {
        actorUid: 'unknown',
        actorStaffId: 'UNKNOWN',
        actorName: 'Unknown / Historical Record (अज्ञात / पुराना अभिलेख)',
        actorEmail: '',
        isHistoricalOrUnknown: true,
      };
    }

    const needle = (actorUidOrEmail || '').toLowerCase();
    const matched = staffList.find(
      (s) =>
        s.uid.toLowerCase() === needle ||
        s.email.toLowerCase() === needle ||
        (s.staffId && s.staffId.toLowerCase() === needle) ||
        (staffName && s.displayName.toLowerCase() === staffName.toLowerCase())
    );

    if (matched) {
      return {
        actorUid: matched.uid,
        actorStaffId: matched.staffId,
        actorName: matched.displayName,
        actorEmail: matched.email,
        isHistoricalOrUnknown: false,
      };
    }

    // If no match found, attribute transparently without fabricating
    return {
      actorUid: actorUidOrEmail || 'historical',
      actorStaffId: 'HISTORICAL',
      actorName: staffName || actorUidOrEmail || 'Unknown / Historical Record (अज्ञात / पुराना अभिलेख)',
      actorEmail: actorUidOrEmail?.includes('@') ? actorUidOrEmail : '',
      isHistoricalOrUnknown: true,
    };
  };

  // Compile Comprehensive Transaction Ledger
  const rawLedgerItems: ActivityLedgerItem[] = useMemo(() => {
    const items: ActivityLedgerItem[] = [];

    // A. Payments & Counter Collections
    payments.forEach((p) => {
      const actor = resolveActor(p.receivedBy || p.userId, p.staffName);
      items.push({
        id: `TXN-PAY-${p.id}`,
        type: 'PAYMENT',
        typeLabelNe: 'काउन्टर भुक्तानी संकलन',
        typeLabelEn: 'Payment Collection',
        referenceId: p.transactionReference || p.id,
        consumerCode: p.customerId,
        consumerName: p.customerName,
        billNumber: p.billNumber,
        amount: Number(p.amount) || 0,
        paymentMethod: p.paymentMethod,
        status: p.status || 'COMPLETED',
        receiptNumber: p.receiptNumber,
        actorUid: actor.actorUid,
        actorStaffId: actor.actorStaffId,
        actorName: actor.actorName,
        actorEmail: actor.actorEmail,
        isHistoricalOrUnknown: actor.isHistoricalOrUnknown,
        timestamp: p.createdAt || p.date || new Date().toISOString(),
        reason: p.remarks,
      });
    });

    // B. Bills Issued & Cancelled
    bills.forEach((b) => {
      // Find actor from bill userId or audit log
      const actor = resolveActor(b.userId, undefined);
      const isCancelled = b.status === 'CANCELLED';

      items.push({
        id: `TXN-BIL-${b.id}`,
        type: 'BILL',
        typeLabelNe: isCancelled ? 'रद्द गरिएको बिल' : 'जारी गरिएको बिल',
        typeLabelEn: isCancelled ? 'Cancelled Bill' : 'Valid Bill',
        referenceId: b.billNumber || b.id,
        consumerCode: b.customerId,
        consumerName: b.customerName,
        billNumber: b.billNumber,
        billingPeriod: b.nepaliMonthYear || `${b.billingMonth} ${b.billingYear}`,
        amount: Number(b.totalAmount) || 0,
        status: b.status,
        receiptNumber: '',
        actorUid: actor.actorUid,
        actorStaffId: actor.actorStaffId,
        actorName: actor.actorName,
        actorEmail: actor.actorEmail,
        isHistoricalOrUnknown: actor.isHistoricalOrUnknown,
        timestamp: b.createdAt || b.issueDate || new Date().toISOString(),
        reason: b.cancellationReason,
      });
    });

    // C. Cash Handovers
    handovers.forEach((h) => {
      items.push({
        id: `TXN-HND-${h.id}`,
        type: 'HANDOVER',
        typeLabelNe: 'नगद दाखिला हिसाब',
        typeLabelEn: 'Cash Handover',
        referenceId: h.id,
        consumerCode: '-',
        consumerName: `Cashier: ${h.staffName}`,
        amount: Number(h.actualCountedCash) || 0,
        originalAmount: Number(h.expectedClosingCash) || 0,
        paymentMethod: 'CASH',
        status: h.status,
        receiptNumber: '-',
        actorUid: h.staffUid,
        actorStaffId: h.staffId,
        actorName: h.staffName,
        actorEmail: h.staffEmail,
        isHistoricalOrUnknown: false,
        timestamp: h.createdAt,
        reason: h.staffExplanation || (h.difference !== 0 ? `Discrepancy: NPR ${h.difference}` : 'Balanced handover'),
      });
    });

    // D. Audit logs for corrections and consumer updates
    auditLogs.forEach((log) => {
      if (log.action === 'CORRECT_BILL' || log.action === 'CANCEL_BILL' || log.action === 'UPDATE_CONSUMER' || log.action === 'CREATE_CONSUMER') {
        const actor = resolveActor(log.userEmail, log.performedBy);
        items.push({
          id: `TXN-LOG-${log.id}`,
          type: 'AUDIT_CORRECTION',
          typeLabelNe: log.action === 'CORRECT_BILL' ? 'बिल संशोधन' : log.action === 'CANCEL_BILL' ? 'बिल रद्दीकरण' : 'ग्राहक विवरण अद्यावधिक',
          typeLabelEn: log.action,
          referenceId: log.entityId,
          consumerCode: log.entityType === 'Household' ? log.entityId : '-',
          consumerName: log.details?.substring(0, 40) || log.action,
          amount: 0,
          status: 'AUDITED',
          receiptNumber: '-',
          actorUid: actor.actorUid,
          actorStaffId: actor.actorStaffId,
          actorName: actor.actorName,
          actorEmail: actor.actorEmail,
          isHistoricalOrUnknown: actor.isHistoricalOrUnknown,
          timestamp: log.timestamp || log.createdAt || new Date().toISOString(),
          reason: log.details,
        });
      }
    });

    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [payments, bills, handovers, auditLogs, staffList]);

  // Filtered Ledger Items based on user selections
  const filteredLedgerItems = useMemo(() => {
    return rawLedgerItems.filter((item) => {
      // 1. Staff Filter
      if (selectedStaffFilter !== 'ALL') {
        const matchUid = item.actorUid === selectedStaffFilter;
        const matchStaffId = item.actorStaffId === selectedStaffFilter;
        const matchEmail = item.actorEmail && item.actorEmail.toLowerCase() === selectedStaffFilter.toLowerCase();
        if (!matchUid && !matchStaffId && !matchEmail) {
          return false;
        }
      }

      // 2. Date Range Filter
      if (dateFrom) {
        const itemDate = item.timestamp.split('T')[0];
        if (itemDate < dateFrom) return false;
      }
      if (dateTo) {
        const itemDate = item.timestamp.split('T')[0];
        if (itemDate > dateTo) return false;
      }

      // 3. Activity Type Filter
      if (activityTypeFilter !== 'ALL') {
        if (activityTypeFilter === 'BILLS' && item.type !== 'BILL') return false;
        if (activityTypeFilter === 'PAYMENTS' && item.type !== 'PAYMENT') return false;
        if (activityTypeFilter === 'CONSUMERS' && item.type !== 'CONSUMER' && !item.typeLabelNe.includes('ग्राहक')) return false;
        if (activityTypeFilter === 'HANDOVERS' && item.type !== 'HANDOVER') return false;
      }

      // 4. Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'COMPLETED' && item.status !== 'COMPLETED' && item.status !== 'PAID' && item.status !== 'APPROVED') return false;
        if (statusFilter === 'CANCELLED' && item.status !== 'CANCELLED' && item.status !== 'VOID') return false;
        if (statusFilter === 'PENDING' && item.status !== 'PENDING' && item.status !== 'PENDING_REVIEW' && item.status !== 'UNPAID') return false;
      }

      // 5. Billing Period Filter
      if (billingPeriodFilter !== 'ALL' && item.billingPeriod) {
        if (!item.billingPeriod.includes(billingPeriodFilter)) return false;
      }

      // 6. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchRef = item.referenceId.toLowerCase().includes(q);
        const matchCode = item.consumerCode.toLowerCase().includes(q);
        const matchName = item.consumerName.toLowerCase().includes(q);
        const matchActor = item.actorName.toLowerCase().includes(q);
        const matchRcpt = item.receiptNumber && item.receiptNumber.toLowerCase().includes(q);
        if (!matchRef && !matchCode && !matchName && !matchActor && !matchRcpt) {
          return false;
        }
      }

      return true;
    });
  }, [rawLedgerItems, selectedStaffFilter, dateFrom, dateTo, activityTypeFilter, statusFilter, billingPeriodFilter, searchQuery]);

  // Aggregate Metrics for Filtered Dataset
  const metrics = useMemo(() => {
    // Unique bills (valid vs cancelled)
    const validBills = filteredLedgerItems.filter((i) => i.type === 'BILL' && i.status !== 'CANCELLED');
    const cancelledBills = filteredLedgerItems.filter((i) => i.type === 'BILL' && i.status === 'CANCELLED');

    const totalValidBilledAmount = validBills.reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalCancelledBillAmount = cancelledBills.reduce((sum, b) => sum + (b.amount || 0), 0);

    // Payments: separate cash, bank, and online collections
    const paymentsList = filteredLedgerItems.filter((i) => i.type === 'PAYMENT' && i.status === 'COMPLETED');
    const cashCollections = paymentsList.filter((p) => p.paymentMethod === 'CASH').reduce((sum, p) => sum + p.amount, 0);
    const bankCollections = paymentsList.filter((p) => p.paymentMethod === 'BANK_DEPOSIT' || p.paymentMethod === 'BANK_TRANSFER' || p.paymentMethod === 'CHEQUE').reduce((sum, p) => sum + p.amount, 0);
    const onlineCollections = paymentsList.filter((p) => p.paymentMethod === 'ESEWA' || p.paymentMethod === 'KHALTI' || p.paymentMethod === 'CONNECT_IPS').reduce((sum, p) => sum + p.amount, 0);
    const totalCollectedAmount = cashCollections + bankCollections + onlineCollections;

    // Handovers: Counted cash vs Expected closing cash
    const filteredHandovers = handovers.filter((h) => {
      if (selectedStaffFilter !== 'ALL' && h.staffUid !== selectedStaffFilter && h.staffId !== selectedStaffFilter) {
        return false;
      }
      if (dateFrom && h.reconciliationDate < dateFrom) return false;
      if (dateTo && h.reconciliationDate > dateTo) return false;
      return true;
    });

    const totalCountedCashHandedOver = filteredHandovers.reduce((sum, h) => sum + (Number(h.actualCountedCash) || 0), 0);
    const totalExpectedClosingCash = filteredHandovers.reduce((sum, h) => sum + (Number(h.expectedClosingCash) || 0), 0);
    const totalDiscrepancyAmount = filteredHandovers.reduce((sum, h) => sum + (Number(h.difference) || 0), 0);
    const pendingHandoversCount = filteredHandovers.filter((h) => h.status === 'PENDING_REVIEW').length;

    // Outstanding consumer arrears
    const totalOutstandingArrears = households.reduce((sum, h) => sum + (h.currentBalance || 0), 0);

    // Discrepancy requiring investigation:
    // Difference between actual counted cash handed over and expected cash collections
    const discrepancyRequiringInvestigation = totalCountedCashHandedOver > 0
      ? Math.abs(totalCountedCashHandedOver - totalExpectedClosingCash)
      : 0;

    return {
      validBillsCount: validBills.length,
      totalValidBilledAmount,
      cancelledBillsCount: cancelledBills.length,
      totalCancelledBillAmount,
      paymentsCount: paymentsList.length,
      cashCollections,
      bankCollections,
      onlineCollections,
      totalCollectedAmount,
      totalCountedCashHandedOver,
      totalExpectedClosingCash,
      totalDiscrepancyAmount,
      pendingHandoversCount,
      totalOutstandingArrears,
      discrepancyRequiringInvestigation,
      filteredHandovers,
    };
  }, [filteredLedgerItems, handovers, selectedStaffFilter, dateFrom, dateTo, households]);

  // Per-Staff Comparative Workload Table
  const staffWorkloadSummaries = useMemo(() => {
    return staffList.map((staff) => {
      const staffItems = rawLedgerItems.filter((i) => {
        const match = i.actorUid === staff.uid || i.actorStaffId === staff.staffId || (staff.email && i.actorEmail.toLowerCase() === staff.email.toLowerCase());
        if (!match) return false;
        if (dateFrom && i.timestamp.split('T')[0] < dateFrom) return false;
        if (dateTo && i.timestamp.split('T')[0] > dateTo) return false;
        return true;
      });

      const validBills = staffItems.filter((i) => i.type === 'BILL' && i.status !== 'CANCELLED');
      const cancelledBills = staffItems.filter((i) => i.type === 'BILL' && i.status === 'CANCELLED');
      const validPayments = staffItems.filter((i) => i.type === 'PAYMENT' && i.status === 'COMPLETED');

      const cashColl = validPayments.filter((p) => p.paymentMethod === 'CASH').reduce((sum, p) => sum + p.amount, 0);
      const bankColl = validPayments.filter((p) => p.paymentMethod === 'BANK_DEPOSIT' || p.paymentMethod === 'BANK_TRANSFER' || p.paymentMethod === 'CHEQUE').reduce((sum, p) => sum + p.amount, 0);
      const onlineColl = validPayments.filter((p) => p.paymentMethod === 'ESEWA' || p.paymentMethod === 'KHALTI' || p.paymentMethod === 'CONNECT_IPS').reduce((sum, p) => sum + p.amount, 0);
      const totalColl = cashColl + bankColl + onlineColl;

      const staffHandovers = handovers.filter((h) => h.staffUid === staff.uid || h.staffId === staff.staffId);
      const handedOver = staffHandovers.reduce((sum, h) => sum + (Number(h.actualCountedCash) || 0), 0);
      const disc = staffHandovers.reduce((sum, h) => sum + (Number(h.difference) || 0), 0);

      return {
        ...staff,
        validBillsCount: validBills.length,
        validBillsTotal: validBills.reduce((s, b) => s + b.amount, 0),
        cancelledBillsCount: cancelledBills.length,
        paymentsCount: validPayments.length,
        cashCollected: cashColl,
        bankCollected: bankColl,
        onlineCollected: onlineColl,
        totalCollected: totalColl,
        cashHandedOver: handedOver,
        discrepancy: disc,
        totalActionsCount: staffItems.length,
      };
    });
  }, [staffList, rawLedgerItems, handovers, dateFrom, dateTo]);

  // Export Complete Filtered Dataset to Excel-Compatible CSV
  const handleExportCSV = () => {
    const reportTitle = 'कर्मचारी कार्यसम्पादन तथा हिसाब मिलान प्रतिवेदन (Staff Activity & Reconciliation Report)';
    const generatedAt = new Date().toLocaleString('ne-NP');
    const selectedStaffName = selectedStaffFilter === 'ALL' ? 'सबै कर्मचारी (All Staff)' : staffList.find((s) => s.uid === selectedStaffFilter)?.displayName || selectedStaffFilter;
    const periodLabel = `${dateFrom || 'शुरुआत'} देखि ${dateTo || 'हालसम्म'}`;

    // UTF-8 BOM so Excel opens Nepali characters cleanly
    let csvContent = '\uFEFF';

    // Metadata Header
    csvContent += `"${settings.committeeNameNepali || 'हायुटार खानेपानी तथा सरसफाइ उपभोक्ता समिति'}"\n`;
    csvContent += `"${reportTitle}"\n`;
    csvContent += `"प्रतिवेदन तयार मिति:","${generatedAt}"\n`;
    csvContent += `"छानिएको अवधि:","${periodLabel}"\n`;
    csvContent += `"छानिएको कर्मचारी:","${selectedStaffName}"\n`;
    csvContent += `"कुल जारी बिल रकम:","NPR ${metrics.totalValidBilledAmount}"\n`;
    csvContent += `"कुल संकलित रकम:","NPR ${metrics.totalCollectedAmount} (नगद: ${metrics.cashCollections}, बैंक: ${metrics.bankCollections}, अनलाइन: ${metrics.onlineCollections})"\n`;
    csvContent += `"भौतिक नगद दाखिला:","NPR ${metrics.totalCountedCashHandedOver}"\n`;
    csvContent += `"हिसाब मिलान फरक:","NPR ${metrics.totalDiscrepancyAmount}"\n\n`;

    // Detailed Table Columns
    const headers = [
      'मिति / समय (Timestamp)',
      'गतिविधि प्रकार (Activity Type)',
      'सन्दर्भ / कारोबार नं (Reference ID)',
      'ग्राहक नं (Customer Code)',
      'ग्राहकको नाम (Customer Name)',
      'बिल नं (Bill No)',
      'बिलिङ अवधि (Billing Period)',
      'रकम (Amount NPR)',
      'भुक्तानी विधि (Payment Method)',
      'रसिद नं (Receipt No)',
      'कारोबार स्थिति (Status)',
      'जिम्मेवार कर्मचारी (Staff Name)',
      'कर्मचारी परिचयपत्र (Staff ID)',
      'कर्मचारी इमेल (Staff Email)',
      'ऐतिहासिक/अज्ञात (Historical / Unknown)',
      'कैफियत / कारण (Notes / Reason)',
    ];
    csvContent += headers.map((h) => `"${h}"`).join(',') + '\n';

    // Rows
    filteredLedgerItems.forEach((item) => {
      const row = [
        item.timestamp,
        item.typeLabelNe,
        item.referenceId,
        item.consumerCode,
        item.consumerName.replace(/"/g, '""'),
        item.billNumber || '-',
        item.billingPeriod || '-',
        item.amount.toString(),
        item.paymentMethod || '-',
        item.receiptNumber || '-',
        item.status,
        item.actorName.replace(/"/g, '""'),
        item.actorStaffId,
        item.actorEmail || '-',
        item.isHistoricalOrUnknown ? 'YES' : 'NO',
        (item.reason || '').replace(/"/g, '""'),
      ];
      csvContent += row.map((val) => `"${val}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Staff_Activity_Reconciliation_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Save New Cash Handover
  const handleSaveHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    const staff = staffList.find((s) => s.uid === newHandoverStaffUid);
    if (!staff) {
      alert('कृपया कर्मचारी चयन गर्नुहोस्।');
      return;
    }

    // Auto-calculate expected closing cash from recorded cash receipts on that date for this staff
    const relevantCashPayments = payments.filter((p) => {
      const matchActor = p.receivedBy === staff.uid || p.receivedBy === staff.staffId;
      const matchDate = (p.createdAt || p.date || '').startsWith(newHandoverDate);
      return matchActor && matchDate && p.paymentMethod === 'CASH' && p.status === 'COMPLETED';
    });
    const cashCollectedOnDate = relevantCashPayments.reduce((s, p) => s + (p.amount || 0), 0);

    const expectedClosing = Number(newHandoverOpeningBalance) + cashCollectedOnDate;

    setActionLoading(true);
    try {
      await saveStaffCashHandover({
        staffUid: staff.uid,
        staffId: staff.staffId,
        staffName: staff.displayName,
        staffEmail: staff.email,
        reconciliationDate: newHandoverDate,
        shift: newHandoverShift,
        periodStart: `${newHandoverDate}T06:00:00Z`,
        periodEnd: `${newHandoverDate}T18:00:00Z`,
        openingBalance: Number(newHandoverOpeningBalance),
        cashCollected: cashCollectedOnDate,
        bankCollected: 0,
        onlineCollected: 0,
        totalCollected: cashCollectedOnDate,
        refundsOrReversals: 0,
        expectedClosingCash: expectedClosing,
        actualCountedCash: Number(newHandoverCountedCash),
        difference: Number(newHandoverCountedCash) - expectedClosing,
        staffExplanation: newHandoverExplanation,
        status: 'PENDING_REVIEW',
      });

      setShowHandoverModal(false);
      setNewHandoverOpeningBalance(0);
      setNewHandoverCountedCash(0);
      setNewHandoverExplanation('');
      await loadData();
      if (onRefresh) await onRefresh();
      alert('काउन्टर नगद दाखिला हिसाब सफलतापूर्वक सुरक्षित गरियो। सुपर एडमिनबाट प्रमाणीकरणको प्रतीक्षामा छ।');
    } catch (err: any) {
      alert(`त्रुटि: ${err.message || 'हिसाब सुरक्षित गर्न सकिएन'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Review / Approval of Cash Handover
  const handleReviewHandover = async () => {
    if (!selectedHandoverForReview) return;
    setActionLoading(true);
    try {
      await reviewStaffReconciliation(
        selectedHandoverForReview.id,
        reviewDecision,
        reviewNotes
      );
      setShowReviewModal(false);
      setSelectedHandoverForReview(null);
      setReviewNotes('');
      await loadData();
      if (onRefresh) await onRefresh();
      alert(`हिसाब दाखिला स्थिति सफलतापूर्वक '${reviewDecision === 'APPROVED' ? 'स्वीकृत (Approved)' : 'फरक चिन्हित (Flagged)'}' मा अद्यावधिक गरियो।`);
    } catch (err: any) {
      alert(`त्रुटि: ${err.message || 'समीक्षा अद्यावधिक असफल भयो'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Boundary Guard: If unauthorized, display clear warning
  // -------------------------------------------------------------
  if (!isAuthorized) {
    return (
      <div className="max-w-3xl mx-auto my-12 bg-white rounded-3xl border-2 border-rose-300 shadow-xl overflow-hidden">
        <div className="bg-rose-600 text-white p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold">
              {lang === 'ne'
                ? 'अनधिकृत पहुँच निषेध (Restricted Module)'
                : 'Access Denied: Permanent Super Admin Only'}
            </h3>
            <p className="text-xs text-rose-100 mt-1">
              कर्मचारी कार्यसम्पादन तथा हिसाब मिलान प्रतिवेदन केवल स्थायी सुपर एडमिन (hayutarkhanepani@gmail.com) को लागि मात्र सुरक्षित गरिएको छ।
            </p>
          </div>
        </div>
        <div className="p-6 space-y-4 text-xs text-slate-700">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
            <div>
              <span className="font-semibold text-rose-900">सुरक्षा नीति:</span> यो मोड्युल Admin Features अन्तर्गतको वित्तीय तथा कर्मचारी अडिट खण्ड हो। अन्य कुनै पनि Admin वा कर्मचारीले प्रत्यक्ष वा अप्रत्यक्ष रूपमा यो डेटा हेर्न वा चलाउन पाउँदैनन्।
            </div>
            <div>
              <span className="font-semibold">तपाईंको इमेल:</span> <span className="font-mono text-slate-900">{currentUser?.email || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Printable Report Layout View
  // -------------------------------------------------------------
  if (printMode) {
    return (
      <div className="bg-white p-8 max-w-5xl mx-auto font-sans text-slate-900 space-y-6 print:p-0">
        <div className="flex justify-between items-center print:hidden border-b pb-4">
          <button
            onClick={() => setPrintMode(false)}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs cursor-pointer"
          >
            ← प्रतिवेदनमा फर्कनुहोस्
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm hover:bg-indigo-700"
          >
            <Printer className="w-4 h-4" />
            प्रिन्ट गर्नुहोस् (Print)
          </button>
        </div>

        {/* Printable Official Header */}
        <div className="text-center border-b-2 border-slate-900 pb-4">
          <h1 className="text-xl font-extrabold uppercase tracking-wide">
            {settings.committeeNameNepali || 'हायुटार खानेपानी तथा सरसफाइ उपभोक्ता समिति'}
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {settings.address || 'हायुटार, वडा नं १ र २'} | सम्पर्क: {settings.phone || '९८४१२३४५६७'} | दर्ता नं: {settings.registrationNumber || '१२३-०७५/७६'}
          </p>
          <div className="inline-block mt-3 px-4 py-1 bg-slate-900 text-white font-bold text-xs rounded-full">
            कर्मचारी कार्यसम्पादन तथा हिसाब मिलान प्रतिवेदन (Staff Activity & Reconciliation Report)
          </div>
          <div className="flex justify-between text-[11px] text-slate-600 mt-3 pt-2 border-t border-slate-200">
            <span>अवधि: <strong>{dateFrom || 'शुरुआत'} देखि {dateTo || 'हालसम्म'}</strong></span>
            <span>कर्मचारी: <strong>{selectedStaffFilter === 'ALL' ? 'सबै कर्मचारी' : staffList.find((s) => s.uid === selectedStaffFilter)?.displayName || selectedStaffFilter}</strong></span>
            <span>प्रतिवेदन मिति: <strong>{new Date().toLocaleString('ne-NP')}</strong></span>
          </div>
        </div>

        {/* Printable KPI Matrix */}
        <div className="grid grid-cols-4 gap-4 text-xs">
          <div className="border border-slate-300 p-3 rounded-lg">
            <span className="text-slate-500 block text-[10px]">कुल जारी बिल</span>
            <span className="text-base font-bold text-slate-900">{metrics.validBillsCount} वटा</span>
            <span className="block text-[11px] text-slate-600 mt-0.5">रु {metrics.totalValidBilledAmount.toLocaleString()}</span>
          </div>
          <div className="border border-slate-300 p-3 rounded-lg">
            <span className="text-slate-500 block text-[10px]">काउन्टर नगद संकलन</span>
            <span className="text-base font-bold text-emerald-700">रु {metrics.cashCollections.toLocaleString()}</span>
            <span className="block text-[11px] text-slate-600 mt-0.5">कुल संकलन: रु {metrics.totalCollectedAmount.toLocaleString()}</span>
          </div>
          <div className="border border-slate-300 p-3 rounded-lg">
            <span className="text-slate-500 block text-[10px]">दाखिला भएको नगद</span>
            <span className="text-base font-bold text-indigo-700">रु {metrics.totalCountedCashHandedOver.toLocaleString()}</span>
            <span className="block text-[11px] text-slate-600 mt-0.5">अपेक्षित: रु {metrics.totalExpectedClosingCash.toLocaleString()}</span>
          </div>
          <div className="border border-slate-300 p-3 rounded-lg">
            <span className="text-slate-500 block text-[10px]">हिसाब मिलान फरक</span>
            <span className={`text-base font-bold ${metrics.totalDiscrepancyAmount === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              रु {metrics.totalDiscrepancyAmount.toLocaleString()}
            </span>
            <span className="block text-[10px] text-slate-500 mt-0.5">
              {metrics.totalDiscrepancyAmount === 0 ? 'हिसाब शून्य मिलान' : 'छानबिन आवश्यक'}
            </span>
          </div>
        </div>

        {/* Workload Summary Table */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase text-slate-700">कर्मचारीगत कार्यसम्पादन सारांश</h3>
          <table className="w-full text-[11px] border-collapse border border-slate-300">
            <thead className="bg-slate-100 font-bold">
              <tr>
                <th className="border border-slate-300 p-1.5 text-left">कर्मचारी</th>
                <th className="border border-slate-300 p-1.5 text-left">परिचय नं</th>
                <th className="border border-slate-300 p-1.5 text-center">जारी बिल</th>
                <th className="border border-slate-300 p-1.5 text-right">बिल रकम</th>
                <th className="border border-slate-300 p-1.5 text-center">रसिद संख्या</th>
                <th className="border border-slate-300 p-1.5 text-right">नगद संकलन</th>
                <th className="border border-slate-300 p-1.5 text-right">दाखिला नगद</th>
                <th className="border border-slate-300 p-1.5 text-right">फरक (Diff)</th>
              </tr>
            </thead>
            <tbody>
              {staffWorkloadSummaries.map((s) => (
                <tr key={s.uid}>
                  <td className="border border-slate-300 p-1.5 font-semibold">{s.displayName}</td>
                  <td className="border border-slate-300 p-1.5 font-mono">{s.staffId}</td>
                  <td className="border border-slate-300 p-1.5 text-center">{s.validBillsCount}</td>
                  <td className="border border-slate-300 p-1.5 text-right">रु {s.validBillsTotal.toLocaleString()}</td>
                  <td className="border border-slate-300 p-1.5 text-center">{s.paymentsCount}</td>
                  <td className="border border-slate-300 p-1.5 text-right font-bold text-emerald-800">रु {s.cashCollected.toLocaleString()}</td>
                  <td className="border border-slate-300 p-1.5 text-right">रु {s.cashHandedOver.toLocaleString()}</td>
                  <td className={`border border-slate-300 p-1.5 text-right font-bold ${s.discrepancy === 0 ? 'text-slate-700' : 'text-rose-700'}`}>
                    रु {s.discrepancy.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Signature Section */}
        <div className="grid grid-cols-3 gap-6 pt-16 text-center text-xs">
          <div>
            <div className="border-t border-slate-800 pt-2 font-bold">तयार गर्ने (कर्मचारी/काउन्टर)</div>
            <span className="text-[10px] text-slate-500">दस्तखत र मिति</span>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-2 font-bold">जाँच गर्ने (लेखापाल)</div>
            <span className="text-[10px] text-slate-500">दस्तखत र मिति</span>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-2 font-bold">प्रमाणित गर्ने (स्थायी सुपर एडमिन)</div>
            <span className="text-[10px] text-slate-500">hayutarkhanepani@gmail.com</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------
          Header Banner
      ------------------------------------------------------------- */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-2xl shadow-xs">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  कर्मचारी कार्यसम्पादन तथा हिसाब मिलान प्रतिवेदन
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 font-bold text-[10px]">
                  SUPER ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Staff Activity & Financial Reconciliation Reports: कर्मचारीको व्यक्तिगत कार्यसम्पादन, बिलिङ, काउन्टर नगद संकलन, दाखिला हिसाब र लेखा परीक्षण।
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowHandoverModal(true)}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>नयाँ नगद दाखिला हिसाब (Cash Handover)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
            title="Download Complete Excel CSV"
          >
            <Download className="w-4 h-4" />
            <span>एक्सेल डाउनलोड (Excel CSV)</span>
          </button>

          <button
            onClick={() => setPrintMode(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>प्रिन्ट लेआउट</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          Filter Control Bar
      ------------------------------------------------------------- */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Staff Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              कर्मचारी चयन (Staff Member)
            </label>
            <select
              value={selectedStaffFilter}
              onChange={(e) => setSelectedStaffFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">-- सबै कर्मचारी (All Staff) --</option>
              {staffList.map((s) => (
                <option key={s.uid} value={s.uid}>
                  {s.displayName} ({s.staffId}) - {s.role}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Period Presets */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              अवधि छनौट (Period Preset)
            </label>
            <select
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="TODAY">आज (Today)</option>
              <option value="THIS_WEEK">यस हप्ता (This Week)</option>
              <option value="THIS_MONTH">यस महिना (This Month)</option>
              <option value="LAST_MONTH">गत महिना (Last Month)</option>
              <option value="ALL">सबै समय (All Time)</option>
              <option value="CUSTOM">अनुकूल मिति (Custom Date Range)</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              मिति देखि (Date From)
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPeriodPreset('CUSTOM');
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              मिति सम्म (Date To)
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPeriodPreset('CUSTOM');
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Activity Type Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              गतिविधि प्रकार (Activity Type)
            </label>
            <select
              value={activityTypeFilter}
              onChange={(e) => setActivityTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">सबै गतिविधिहरू</option>
              <option value="PAYMENTS">काउन्टर भुक्तानी संकलन (Payments)</option>
              <option value="BILLS">बिलिङ तथा जारी बिलहरू (Bills)</option>
              <option value="HANDOVERS">नगद दाखिला हिसाब (Handovers)</option>
              <option value="CONSUMERS">ग्राहक व्यवस्थापन (Consumers)</option>
            </select>
          </div>
        </div>

        {/* Secondary filters row */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="कारोबार नं, ग्राहक कोड, ग्राहकको नाम, रसिद नं वा कर्मचारी अनुसार खोज्नुहोस्..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-medium"
            >
              <option value="ALL">सबै स्थिति (All Status)</option>
              <option value="COMPLETED">सम्पन्न / प्रमाणीकृत (Completed)</option>
              <option value="CANCELLED">रद्द / Void (Cancelled)</option>
              <option value="PENDING">प्रक्रियाधीन (Pending / Review)</option>
            </select>

            <button
              onClick={() => {
                setSelectedStaffFilter('ALL');
                setPeriodPreset('THIS_MONTH');
                setActivityTypeFilter('ALL');
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold cursor-pointer"
            >
              फिल्टर रिसेट
            </button>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          High-Level KPI Cards (Separated Categories)
      ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Valid Billed Amount */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
              १. जारी गरिएको कुल बिल
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              रु {metrics.totalValidBilledAmount.toLocaleString()}
            </span>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>वैध बिल संख्या: <strong>{metrics.validBillsCount}</strong></span>
              {metrics.cancelledBillsCount > 0 && (
                <span className="text-rose-600 font-semibold">
                  रद्द: {metrics.cancelledBillsCount} (रु {metrics.totalCancelledBillAmount.toLocaleString()})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Total Collected Amount */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
              २. संकलित कुल रकम
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-700 tracking-tight">
              रु {metrics.totalCollectedAmount.toLocaleString()}
            </span>
            <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-2">
              <span>नगद: <strong className="text-emerald-700">रु {metrics.cashCollections.toLocaleString()}</strong></span>
              <span>बैंक: <strong>रु {metrics.bankCollections.toLocaleString()}</strong></span>
              <span>अनलाइन: <strong>रु {metrics.onlineCollections.toLocaleString()}</strong></span>
            </div>
          </div>
        </div>

        {/* 3. Counted Cash Handed Over */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
              ३. भौतिक रूपमा दाखिला नगद
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Building className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-indigo-700 tracking-tight">
              रु {metrics.totalCountedCashHandedOver.toLocaleString()}
            </span>
            <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
              <span>अपेक्षित नगद: <strong>रु {metrics.totalExpectedClosingCash.toLocaleString()}</strong></span>
              {metrics.pendingHandoversCount > 0 && (
                <span className="text-amber-600 font-bold">
                  समीक्षा बाँकी: {metrics.pendingHandoversCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4. Discrepancy & Arrears */}
        <div className={`p-5 rounded-3xl border shadow-xs relative overflow-hidden ${
          metrics.totalDiscrepancyAmount === 0 ? 'bg-white border-slate-200' : 'bg-rose-50/50 border-rose-300'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">
              ४. हिसाब मिलान फरक / बक्यौता
            </span>
            <div className={`p-2 rounded-xl ${
              metrics.totalDiscrepancyAmount === 0 ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-700'
            }`}>
              {metrics.totalDiscrepancyAmount === 0 ? <Check className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black tracking-tight ${
                metrics.totalDiscrepancyAmount === 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                रु {metrics.totalDiscrepancyAmount.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                ({metrics.totalDiscrepancyAmount === 0 ? 'शून्य फरक' : 'छानबिन आवश्यक'})
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              ग्राहक कुल बक्यौता: <strong>रु {metrics.totalOutstandingArrears.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          Tab Navigation for Module
      ------------------------------------------------------------- */}
      <div className="flex border-b border-slate-200 gap-3 text-xs font-bold">
        <button
          onClick={() => setActiveTab('summary')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'summary'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>१. कर्मचारी कार्यसम्पादन सारांश (Workload Summary)</span>
        </button>

        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'reconciliation'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>२. काउन्टर हिसाब मिलान (Cash Handover & Balancing)</span>
          {metrics.pendingHandoversCount > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px]">
              {metrics.pendingHandoversCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'ledger'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>३. विस्तृत कारोबार लेजर (Detailed Activity Ledger)</span>
          <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px]">
            {filteredLedgerItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('discrepancies')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'discrepancies'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>४. अपवाद तथा फरक विवरण (Exceptions & Flags)</span>
        </button>
      </div>

      {/* -------------------------------------------------------------
          TAB 1: Staff Workload Comparison Table
      ------------------------------------------------------------- */}
      {activeTab === 'summary' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/60">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                कर्मचारीगत कार्यसम्पादन तथा संकलन तुलना (Staff Workload & Performance Comparison)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                प्रत्येक कर्मचारीले जारी गरेका बिल, काउन्टरमा काटेका रसिद, नगद दाखिला र हिसाब मिलानको प्रत्यक्ष स्थिति।
              </p>
            </div>
            <span className="text-xs text-slate-500 font-semibold">
              कुल कर्मचारी: {staffWorkloadSummaries.length} जना
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">कर्मचारी विवरण (Staff Identity)</th>
                  <th className="py-3 px-4">भूमिका (Role)</th>
                  <th className="py-3 px-4 text-center">जारी बिल (Bills)</th>
                  <th className="py-3 px-4 text-right">बिल रकम (Billed NPR)</th>
                  <th className="py-3 px-4 text-center">काउन्टर रसिद (Receipts)</th>
                  <th className="py-3 px-4 text-right">नगद संकलन (Cash NPR)</th>
                  <th className="py-3 px-4 text-right">अन्य संकलन (Bank/Online)</th>
                  <th className="py-3 px-4 text-right">दाखिला नगद (Handed Over)</th>
                  <th className="py-3 px-4 text-right">हिसाब फरक (Diff)</th>
                  <th className="py-3 px-4 text-center">कार्य (Action)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffWorkloadSummaries.map((staff) => (
                  <tr key={staff.uid} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{staff.displayName}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="font-mono font-semibold text-purple-700">{staff.staffId}</span>
                        {staff.email && <span>• {staff.email}</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {staff.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                      {staff.validBillsCount}
                      {staff.cancelledBillsCount > 0 && (
                        <span className="block text-[10px] text-rose-500 font-normal">
                          (-{staff.cancelledBillsCount} रद्द)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                      रु {staff.validBillsTotal.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                      {staff.paymentsCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-emerald-700">
                      रु {staff.cashCollected.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                      रु {(staff.bankCollected + staff.onlineCollected).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-indigo-700">
                      रु {staff.cashHandedOver.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`font-bold ${staff.discrepancy === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {staff.discrepancy === 0 ? 'रु ०' : `रु ${staff.discrepancy.toLocaleString()}`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedStaffFilter(staff.uid);
                          setActiveTab('ledger');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-[11px] cursor-pointer"
                      >
                        विस्तृत लेजर हेर्नुहोस्
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 2: Cash Handover & Financial Balancing Registry
      ------------------------------------------------------------- */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6">
          {/* Explanation Box */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">काउन्टर हिसाब मिलान सिद्धान्त (Cash Reconciliation Principle):</span>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                जारी गरिएको बिल रकम, रसिदमा संकलित रकम र भौतिक रूपमा दाखिला गरिएको नगद फरक–फरक कारोबार हुन्। काउन्टर कर्मचारीले आफ्नो सिफ्टको अन्त्यमा संकलित नगद दाखिला गर्दा सुरुवाती मौज्दात, कुल नगद रसिद र फिर्ता समायोजन गरी भौतिक रूपमा गनिएको नगद सुपर एडमिनलाई बुझाउनुपर्छ। सुपर एडमिनले जाँच गरी अनुमोदन गर्दा मात्र हिसाब प्रमाणीकरण हुन्छ।
              </p>
            </div>
          </div>

          {/* Handover List Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/60">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  काउन्टर नगद दाखिला तथा हिसाब मिलान दर्ता (Cash Handover Registry)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  कर्मचारीहरूले बुझाएको भौतिक नगद, अपेक्षित नगद र सुपर एडमिन अनुमोदन अभिलेख।
                </p>
              </div>

              <button
                onClick={() => setShowHandoverModal(true)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>नयाँ दाखिला दर्ता</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">दाखिला नं / मिति</th>
                    <th className="py-3 px-4">काउन्टर कर्मचारी</th>
                    <th className="py-3 px-4 text-right">सुरुवाती मौज्दात (Opening)</th>
                    <th className="py-3 px-4 text-right">संकलित नगद (Cash Coll.)</th>
                    <th className="py-3 px-4 text-right">अपेक्षित नगद (Expected)</th>
                    <th className="py-3 px-4 text-right">गनिएको नगद (Counted)</th>
                    <th className="py-3 px-4 text-right">फरक रकम (Diff)</th>
                    <th className="py-3 px-4">स्थिति (Status)</th>
                    <th className="py-3 px-4">जाँचकर्ता / समीक्षा</th>
                    <th className="py-3 px-4 text-center">कार्य</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.filteredHandovers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 italic">
                        छानिएको मिति वा कर्मचारीको कुनै नगद दाखिला रेकर्ड भेटिएन।
                      </td>
                    </tr>
                  ) : (
                    metrics.filteredHandovers.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                          {h.id}
                          <div className="text-[10px] text-slate-500 font-sans">{h.reconciliationDate} ({h.shift || 'FULL_DAY'})</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900">{h.staffName}</span>
                          <span className="block text-[10px] text-purple-700 font-mono">{h.staffId}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                          रु {Number(h.openingBalance || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-emerald-700">
                          रु {Number(h.cashCollected || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                          रु {Number(h.expectedClosingCash || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-indigo-700">
                          रु {Number(h.actualCountedCash || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className={`font-bold ${h.difference === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            रु {Number(h.difference || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            h.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : h.status === 'DISCREPANCY_FLAGGED'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {h.status === 'APPROVED' ? 'स्वीकृत (Approved)' : h.status === 'DISCREPANCY_FLAGGED' ? 'छानबिन आवश्यक' : 'समीक्षा बाँकी'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[11px]">
                          {h.reviewedBy ? (
                            <div>
                              <span className="font-semibold text-slate-800">{h.reviewedBy}</span>
                              <span className="block text-[10px] text-slate-400">{h.reviewedAt?.split('T')[0]}</span>
                              {h.reviewerNotes && <span className="block text-[10px] text-slate-600 italic">"{h.reviewerNotes}"</span>}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">जाँच भएको छैन</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedHandoverForReview(h);
                              setReviewDecision(h.status === 'PENDING_REVIEW' ? 'APPROVED' : h.status);
                              setReviewNotes(h.reviewerNotes || '');
                              setShowReviewModal(true);
                            }}
                            className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] cursor-pointer"
                          >
                            समीक्षा / अनुमोदन
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 3: Detailed Transaction Ledger
      ------------------------------------------------------------- */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/60">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                विस्तृत कारोबार तथा कार्यसम्पादन लेजर (Detailed Activity & Transaction Ledger)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                प्रत्येक बिल, भुक्तानी, रसिद र संशोधन कारोबारको प्रमाणित कर्मचारी अभिलेख।
              </p>
            </div>
            <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
              देखाइएका कारोबार: {filteredLedgerItems.length} वटा
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">प्रकार (Type)</th>
                  <th className="py-3 px-4">सन्दर्भ नं (Ref ID)</th>
                  <th className="py-3 px-4">ग्राहक (Customer)</th>
                  <th className="py-3 px-4">बिल / अवधि</th>
                  <th className="py-3 px-4 text-right">रकम (Amount)</th>
                  <th className="py-3 px-4">विधि / स्थिति</th>
                  <th className="py-3 px-4">रसिद नं</th>
                  <th className="py-3 px-4">जिम्मेवार कर्मचारी (Attributed Actor)</th>
                  <th className="py-3 px-4">मिति / समय</th>
                  <th className="py-3 px-4 text-center">कार्य</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLedgerItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 italic">
                      फिल्टर अनुसार कुनै कारोबार रेकर्ड भेटिएन।
                    </td>
                  </tr>
                ) : (
                  filteredLedgerItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.type === 'PAYMENT'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.type === 'BILL'
                            ? item.status === 'CANCELLED'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                            : item.type === 'HANDOVER'
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {item.typeLabelNe}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {item.referenceId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.consumerName}</div>
                        <div className="text-[10px] font-mono text-slate-500">{item.consumerCode}</div>
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        {item.billNumber && <span className="font-mono block text-slate-800">{item.billNumber}</span>}
                        {item.billingPeriod && <span className="text-slate-500 block">{item.billingPeriod}</span>}
                        {!item.billNumber && !item.billingPeriod && <span className="text-slate-400">-</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {item.amount > 0 ? `रु ${item.amount.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        <span className="font-semibold text-slate-800">{item.paymentMethod || '-'}</span>
                        <span className="block text-[10px] text-slate-500 font-medium">{item.status}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-800 text-[11px]">
                        {item.receiptNumber || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.actorName}</div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <span className="font-mono text-purple-700">{item.actorStaffId}</span>
                          {item.actorEmail && <span>• {item.actorEmail}</span>}
                        </div>
                        {item.isHistoricalOrUnknown && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-semibold">
                            ऐतिहासिक अभिलेख
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                        {item.timestamp.replace('T', ' ').substring(0, 16)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.type === 'BILL' && onViewBill && (
                          <button
                            onClick={() => {
                              const b = bills.find((bill) => bill.id === item.referenceId || bill.billNumber === item.referenceId);
                              if (b) onViewBill(b);
                            }}
                            className="p-1 text-slate-600 hover:text-purple-700 cursor-pointer"
                            title="बिल हेर्नुहोस्"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {item.type === 'PAYMENT' && onViewReceipt && (
                          <button
                            onClick={() => {
                              const p = payments.find((pay) => pay.id === item.referenceId || pay.transactionReference === item.referenceId);
                              if (p) onViewReceipt(p);
                            }}
                            className="p-1 text-slate-600 hover:text-emerald-700 cursor-pointer"
                            title="रसिद हेर्नुहोस्"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 4: Exceptions & Discrepancies
      ------------------------------------------------------------- */}
      {activeTab === 'discrepancies' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>लेखा अपवाद तथा फरक विश्लेषण (Exceptions & Discrepancies)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              रद्द गरिएका बिल, फरक परेका नगद दाखिला, र ऐतिहासिक अस्पष्ट अभिलेखहरूको विस्तृत सूची।
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                <span className="text-xs font-bold text-rose-900 block">रद्द गरिएका बिलहरू (Cancelled Bills)</span>
                <span className="text-2xl font-black text-rose-700 mt-2 block">{metrics.cancelledBillsCount} वटा</span>
                <span className="text-xs text-rose-800">कुल रकम: रु {metrics.totalCancelledBillAmount.toLocaleString()}</span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <span className="text-xs font-bold text-amber-900 block">समीक्षा बाँकी नगद दाखिला</span>
                <span className="text-2xl font-black text-amber-700 mt-2 block">{metrics.pendingHandoversCount} वटा</span>
                <span className="text-xs text-amber-800">सुपर एडमिन प्रमाणीकरण बाँकी</span>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200">
                <span className="text-xs font-bold text-purple-900 block">कुल हिसाब फरक रकम</span>
                <span className={`text-2xl font-black mt-2 block ${metrics.totalDiscrepancyAmount === 0 ? 'text-emerald-700' : 'text-purple-700'}`}>
                  रु {metrics.totalDiscrepancyAmount.toLocaleString()}
                </span>
                <span className="text-xs text-purple-800">
                  {metrics.totalDiscrepancyAmount === 0 ? 'कुनै फरक भेटिएन' : 'अपेक्षित र गनिएको नगद बीचको अन्तर'}
                </span>
              </div>
            </div>

            {/* List of Flagged Handovers */}
            <div className="mt-6">
              <h4 className="font-bold text-xs uppercase text-slate-700 mb-3">
                फरक परेका वा समीक्षा बाँकी दाखिला रेकर्डहरू
              </h4>
              {handovers.filter((h) => h.status !== 'APPROVED' || h.difference !== 0).length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl text-slate-500 text-xs italic">
                  कुनै पनि फरक परेको वा शंकास्पद दाखिला रेकर्ड छैन। सम्पूर्ण दाखिला हिसाब स्वीकृत छ।
                </div>
              ) : (
                <div className="space-y-3">
                  {handovers
                    .filter((h) => h.status !== 'APPROVED' || h.difference !== 0)
                    .map((h) => (
                      <div
                        key={h.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{h.id}</span>
                            <span className="text-slate-500">• {h.reconciliationDate}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              h.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {h.status}
                            </span>
                          </div>
                          <div className="mt-1 text-slate-700">
                            कर्मचारी: <strong>{h.staffName} ({h.staffId})</strong> | अपेक्षित: रु {h.expectedClosingCash} | गनिएको: रु {h.actualCountedCash} | फरक: <strong className="text-rose-700">रु {h.difference}</strong>
                          </div>
                          {h.staffExplanation && (
                            <div className="mt-0.5 text-slate-500 italic">
                              स्पष्टीकरण: "{h.staffExplanation}"
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            setSelectedHandoverForReview(h);
                            setReviewDecision(h.status === 'PENDING_REVIEW' ? 'APPROVED' : h.status);
                            setReviewNotes(h.reviewerNotes || '');
                            setShowReviewModal(true);
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer hover:bg-slate-800 shrink-0"
                        >
                          समीक्षा गर्नुहोस्
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: Record New Cash Handover
      ------------------------------------------------------------- */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  काउन्टर नगद दाखिला हिसाब दर्ता (New Cash Handover)
                </h3>
                <p className="text-xs text-slate-500">
                  काउन्टरमा भौतिक रूपमा संकलन भएको नगद गनेर दाखिला गर्नुहोस्।
                </p>
              </div>
              <button
                onClick={() => setShowHandoverModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveHandover} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  काउन्टर कर्मचारी चयन (Staff Member) *
                </label>
                <select
                  required
                  value={newHandoverStaffUid}
                  onChange={(e) => setNewHandoverStaffUid(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- कर्मचारी छान्नुहोस् --</option>
                  {staffList.map((s) => (
                    <option key={s.uid} value={s.uid}>
                      {s.displayName} ({s.staffId}) - {s.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    दाखिला मिति (Date) *
                  </label>
                  <input
                    type="date"
                    required
                    value={newHandoverDate}
                    onChange={(e) => setNewHandoverDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    सिफ्ट (Shift)
                  </label>
                  <select
                    value={newHandoverShift}
                    onChange={(e) => setNewHandoverShift(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800"
                  >
                    <option value="FULL_DAY">पूरा दिन (Full Day)</option>
                    <option value="MORNING">बिहानी (Morning)</option>
                    <option value="DAY">दिउँसो (Day)</option>
                    <option value="EVENING">साँझ (Evening)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    सुरुवाती मौज्दात (Opening Cash NPR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newHandoverOpeningBalance}
                    onChange={(e) => setNewHandoverOpeningBalance(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    भौतिक रूपमा गनिएको नगद (Counted Cash NPR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newHandoverCountedCash}
                    onChange={(e) => setNewHandoverCountedCash(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  कर्मचारीको कैफियत वा स्पष्टीकरण (Staff Explanation / Notes)
                </label>
                <textarea
                  rows={2}
                  placeholder="हिसाब मिलान, बैंक दाखिला भौचर वा कुनै फरक परेको भए सोको स्पष्ट कारण..."
                  value={newHandoverExplanation}
                  onChange={(e) => setNewHandoverExplanation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800"
                />
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-[11px] text-purple-900">
                <span className="font-bold">स्वचालित प्रमाणीकरण:</span> यस मितिमा उक्त कर्मचारीले जारी गरेका काउन्टर नगद रसिदहरूको कुल रकम स्वतः हिसाब गरी अपेक्षित रकमसँग तुलना गरिनेछ।
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowHandoverModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  रद्द गर्नुहोस्
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'सुरक्षित गर्दै...' : 'दाखिला हिसाब सुरक्षित गर्नुहोस्'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: Super Admin Review & Approval
      ------------------------------------------------------------- */}
      {showReviewModal && selectedHandoverForReview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  दाखिला हिसाब समीक्षा तथा अनुमोदन (Review Cash Handover)
                </h3>
                <p className="text-slate-500">
                  रेकर्ड ID: <span className="font-mono font-bold text-purple-700">{selectedHandoverForReview.id}</span>
                </p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">कर्मचारी:</span>
                  <span className="font-bold text-slate-900">{selectedHandoverForReview.staffName} ({selectedHandoverForReview.staffId})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">दाखिला मिति:</span>
                  <span className="font-semibold text-slate-800">{selectedHandoverForReview.reconciliationDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">अपेक्षित नगद (Expected):</span>
                  <span className="font-bold text-slate-900">रु {selectedHandoverForReview.expectedClosingCash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">भौतिक गनिएको नगद (Counted):</span>
                  <span className="font-black text-indigo-700">रु {selectedHandoverForReview.actualCountedCash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-700">हिसाब फरक (Difference):</span>
                  <span className={`font-black ${selectedHandoverForReview.difference === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    रु {selectedHandoverForReview.difference.toLocaleString()}
                  </span>
                </div>
              </div>

              {selectedHandoverForReview.staffExplanation && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                  <span className="font-bold">कर्मचारीको भनाइ:</span> "{selectedHandoverForReview.staffExplanation}"
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  अनुमोदन निर्णय (Approval Status) *
                </label>
                <select
                  value={reviewDecision}
                  onChange={(e) => setReviewDecision(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800"
                >
                  <option value="APPROVED">स्वीकृत (APPROVED) - नगद हिसाब प्रमाणित</option>
                  <option value="DISCREPANCY_FLAGGED">छानबिन आवश्यक (DISCREPANCY_FLAGGED) - फरक चिन्हित</option>
                  <option value="PENDING_REVIEW">प्रक्रियाधीन (PENDING_REVIEW) - पुनः जाँच</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  सुपर एडमिन अडिट कैफियत (Reviewer Notes) *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="लेखा परीक्षण कैफियत, बैंक दाखिला भौचर मिलान, वा छानबिन निर्देशन..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
              >
                बन्द गर्नुहोस्
              </button>
              <button
                type="button"
                onClick={handleReviewHandover}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'अद्यावधिक गर्दै...' : 'अनुमोदन निर्णय सुरक्षित गर्नुहोस्'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
