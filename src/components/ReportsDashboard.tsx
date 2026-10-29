import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Bill, Payment, Household, UserProfile, ConsumerCategory } from '../types';
import { formatNPR, toNepaliNumerals, NEPALI_MONTHS, NEPALI_YEARS } from '../utils/nepaliCalendar';
import { detectDuplicateNames } from '../services/dbService';
import {
  BarChart3,
  TrendingUp,
  Download,
  AlertCircle,
  CheckCircle,
  Calendar,
  Layers,
  ArrowUpRight,
  Filter,
  Users,
  CreditCard,
  Phone,
  Printer,
  Search,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface ReportsDashboardProps {
  bills: Bill[];
  payments: Payment[];
  households: Household[];
  users?: UserProfile[];
  categories?: ConsumerCategory[];
}

export type ExcelReportType =
  | 'PAID_CONSUMERS'
  | 'UNPAID_CONSUMERS'
  | 'PARTIALLY_PAID'
  | 'PENDING_RECORDS'
  | 'OUTSTANDING_BALANCES'
  | 'MONTHLY_BILLING'
  | 'PAYMENT_RECEIPTS'
  | 'CATEGORIES_SUMMARY'
  | 'STAFF_REGISTER'
  | 'DUPLICATE_REVIEW';

export const ReportsDashboard: React.FC<ReportsDashboardProps> = ({
  bills,
  payments,
  households,
  users = [],
  categories = [],
}) => {
  const { lang, t } = useLanguage();
  const [activeReportTab, setActiveReportTab] = useState<'overview' | 'defaulters' | 'methods' | 'monthly' | 'excel-center'>('excel-center');

  // Excel Center State
  const [selectedReportType, setSelectedReportType] = useState<ExcelReportType>('OUTSTANDING_BALANCES');
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterWard, setFilterWard] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('ALL');

  // Defaulters list filter
  const [minArrears, setMinArrears] = useState<number>(100);
  const [defaulterWard, setDefaulterWard] = useState<string>('ALL');
  const [defaulterSearch, setDefaulterSearch] = useState<string>('');

  // Summary Metrics
  const totalBilled = useMemo(() => bills.reduce((acc, b) => acc + (b.totalAmount || 0), 0), [bills]);
  const totalCollected = useMemo(() => payments.reduce((acc, p) => acc + (p.amount || 0), 0), [payments]);
  const totalOutstanding = useMemo(() => households.reduce((acc, h) => acc + (h.currentBalance || 0), 0), [households]);

  // Breakdown by payment methods (Cash, Cheque, Bank Deposit)
  const methodStats = useMemo(() => {
    const methods = [
      { key: 'CASH', label: 'Counter Cash (नगद)', color: 'bg-emerald-500' },
      { key: 'CHEQUE', label: 'Cheque (चेक)', color: 'bg-amber-500' },
      { key: 'BANK_DEPOSIT', label: 'Bank Deposit (बैंक जम्मा)', color: 'bg-blue-500' },
      { key: 'BANK_TRANSFER', label: 'Bank Slip (बैंक भौचर)', color: 'bg-sky-500' },
    ];

    return methods.map((m) => {
      const filtered = payments.filter((p) => p.paymentMethod === m.key);
      const totalAmount = filtered.reduce((acc, p) => acc + p.amount, 0);
      const count = filtered.length;
      const percentage = totalCollected > 0 ? Math.round((totalAmount / totalCollected) * 100) : 0;
      return {
        ...m,
        amount: totalAmount,
        count,
        percentage,
      };
    });
  }, [payments, totalCollected]);

  // Ward-wise collections & outstanding
  const wardSummary = useMemo(() => {
    const wards = ['1', '2', '3', '4', '5'];
    return wards.map((w) => {
      const wardHouseholds = households.filter((h) => h.ward === w);
      const wardBalance = wardHouseholds.reduce((acc, h) => acc + (h.currentBalance || 0), 0);
      const wardPayments = payments.filter((p) => {
        const h = households.find((item) => item.customerCode === p.customerId);
        return h && h.ward === w;
      }).reduce((acc, p) => acc + p.amount, 0);

      return {
        ward: w,
        householdsCount: wardHouseholds.length,
        outstanding: wardBalance,
        collected: wardPayments,
      };
    });
  }, [households, payments]);

  // Defaulters List
  const defaultersList = useMemo(() => {
    return households
      .filter((h) => {
        const matchWard = defaulterWard === 'ALL' || h.ward === defaulterWard;
        const matchArrears = (h.currentBalance || 0) >= minArrears;
        const matchSearch =
          !defaulterSearch.trim() ||
          h.customerCode.toLowerCase().includes(defaulterSearch.toLowerCase()) ||
          h.ownerName.toLowerCase().includes(defaulterSearch.toLowerCase()) ||
          h.phoneNumber.includes(defaulterSearch);
        return matchWard && matchArrears && matchSearch;
      })
      .sort((a, b) => (b.currentBalance || 0) - (a.currentBalance || 0));
  }, [households, defaulterWard, minArrears, defaulterSearch]);

  // ----------------------------------------------------------------------
  // EXCEL REPORT BUILDER (10 REPORT TYPES)
  // ----------------------------------------------------------------------
  const excelReportData = useMemo(() => {
    const sanitize = (val: any) => {
      let str = String(val ?? '').trim();
      if (/^[=+@-]/.test(str)) {
        str = `'${str}`; // Prevent spreadsheet formula injection
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    let filename = '';
    let reportTitle = '';
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (selectedReportType === 'PAID_CONSUMERS') {
      reportTitle = 'Paid Consumers Report (भुक्तानी सम्पन्न ग्राहकहरू)';
      filename = `paid_consumers_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['Permanent Code', 'Consumer Name', 'Category', 'Ward', 'Household No', 'Status', 'Total Paid (NPR)', 'Last Payment Date'];

      const paidHouseholds = households.filter((h) => {
        if (filterWard !== 'ALL' && h.ward !== filterWard) return false;
        if (filterCategory !== 'ALL' && (h.category || 'Residential') !== filterCategory) return false;
        return (h.currentBalance || 0) === 0;
      });

      rows = paidHouseholds.map((h) => {
        const custPayments = payments.filter((p) => p.customerId === h.customerCode);
        const totalPaid = custPayments.reduce((s, p) => s + p.amount, 0);
        const lastPay = custPayments[custPayments.length - 1]?.date || '-';
        return [
          sanitize(h.customerCode),
          sanitize(h.ownerName),
          sanitize(h.category || 'Residential'),
          sanitize(h.ward),
          sanitize(h.householdNumber),
          sanitize('PAID (चुकता भएको)'),
          totalPaid,
          sanitize(lastPay),
        ];
      });
    } else if (selectedReportType === 'UNPAID_CONSUMERS') {
      reportTitle = 'Unpaid Consumers Report (भुक्तानी नभएका ग्राहकहरू)';
      filename = `unpaid_consumers_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['Permanent Code', 'Consumer Name', 'Category', 'Ward', 'Tole', 'Phone', 'Outstanding Due (NPR)', 'Status'];

      const unpaidHouseholds = households.filter((h) => {
        if (filterWard !== 'ALL' && h.ward !== filterWard) return false;
        if (filterCategory !== 'ALL' && (h.category || 'Residential') !== filterCategory) return false;
        return (h.currentBalance || 0) > 0;
      });

      rows = unpaidHouseholds.map((h) => [
        sanitize(h.customerCode),
        sanitize(h.ownerName),
        sanitize(h.category || 'Residential'),
        sanitize(h.ward),
        sanitize(h.tole || '-'),
        sanitize(h.phoneNumber || '-'),
        h.currentBalance,
        sanitize('UNPAID (बक्यौता बाँकी)'),
      ]);
    } else if (selectedReportType === 'PARTIALLY_PAID') {
      reportTitle = 'Partially Paid Consumers Report (आंशिक भुक्तानी ग्राहकहरू)';
      filename = `partially_paid_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['Permanent Code', 'Consumer Name', 'Category', 'Ward', 'Billed Amount', 'Paid So Far', 'Remaining Due (NPR)', 'Status'];

      const partPaidBills = bills.filter((b) => {
        if (filterWard !== 'ALL' && b.ward !== filterWard) return false;
        if (filterYear !== 'ALL' && b.billingYear !== filterYear) return false;
        if (filterMonth !== 'ALL' && b.billingMonth !== filterMonth) return false;
        return b.status === 'PARTIALLY_PAID';
      });

      rows = partPaidBills.map((b) => [
        sanitize(b.customerId),
        sanitize(b.customerName),
        sanitize(b.category || 'Residential'),
        sanitize(b.ward),
        b.totalAmount,
        b.paidAmount,
        b.balanceDue,
        sanitize('PARTIALLY_PAID (आंशिक भुक्तानी)'),
      ]);
    } else if (selectedReportType === 'PENDING_RECORDS') {
      reportTitle = 'Pending Verification Records (पुष्टि हुन बाँकी विवरण)';
      filename = `pending_verification_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['Record ID / Bill #', 'Consumer Name', 'Permanent Code', 'Amount (NPR)', 'Issue Date', 'Status', 'Reason'];

      const pendingBills = bills.filter((b) => b.status === 'PENDING');
      const needsVerifHouseholds = households.filter((h) => h.needsVerification || h.duplicateNameFlag);

      rows = [
        ...pendingBills.map((b) => [
          sanitize(b.billNumber),
          sanitize(b.customerName),
          sanitize(b.customerId),
          b.totalAmount,
          sanitize(b.issueDate),
          sanitize('PENDING (पुष्टि हुन बाँकी)'),
          sanitize('Awaiting committee administrative verification'),
        ]),
        ...needsVerifHouseholds.map((h) => [
          sanitize(h.id),
          sanitize(h.ownerName),
          sanitize(h.customerCode),
          h.currentBalance,
          sanitize(h.registrationDate || '-'),
          sanitize('REVIEW_REQUIRED'),
          sanitize(h.verificationReason || 'Duplicate name identity review required'),
        ]),
      ];
    } else if (selectedReportType === 'OUTSTANDING_BALANCES') {
      reportTitle = 'Outstanding Balances & Defaulters Register (कुल बाँकी बक्यौता दर्ता किताब)';
      filename = `outstanding_balances_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['Permanent Code', 'Household No', 'Consumer Name', 'Category', 'Ward', 'Tole', 'Phone', 'Opening Balance (NPR)', 'Current Outstanding (NPR)', 'Status'];

      const list = households
        .filter((h) => {
          if (filterWard !== 'ALL' && h.ward !== filterWard) return false;
          if (filterCategory !== 'ALL' && (h.category || 'Residential') !== filterCategory) return false;
          return (h.currentBalance || 0) > 0;
        })
        .sort((a, b) => (b.currentBalance || 0) - (a.currentBalance || 0));

      rows = list.map((h) => [
        sanitize(h.customerCode),
        sanitize(h.householdNumber),
        sanitize(h.ownerName),
        sanitize(h.category || 'Residential'),
        sanitize(h.ward),
        sanitize(h.tole || '-'),
        sanitize(h.phoneNumber || '-'),
        h.openingBalance || 0,
        h.currentBalance,
        sanitize(h.status),
      ]);
    } else if (selectedReportType === 'MONTHLY_BILLING') {
      reportTitle = 'Monthly Billing Details Register (मासिक महसुल बिलिङ दर्ता)';
      filename = `monthly_billing_${filterYear}_${filterMonth}_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['Bill Number', 'Billing Period', 'Permanent Code', 'Consumer Name', 'Ward', 'Fixed Monthly Charge', 'Prev Balance', 'Total Due (NPR)', 'Paid Amount', 'Balance Due', 'Status'];

      const list = bills.filter((b) => {
        if (filterYear !== 'ALL' && b.billingYear !== filterYear) return false;
        if (filterMonth !== 'ALL' && b.billingMonth !== filterMonth) return false;
        if (filterWard !== 'ALL' && b.ward !== filterWard) return false;
        return true;
      });

      rows = list.map((b) => [
        sanitize(b.billNumber),
        sanitize(`${b.nepaliMonthYear || b.billingMonth}`),
        sanitize(b.customerId),
        sanitize(b.customerName),
        sanitize(b.ward),
        b.monthlyCharge,
        b.previousBalance,
        b.totalAmount,
        b.paidAmount,
        b.balanceDue,
        sanitize(b.status),
      ]);
    } else if (selectedReportType === 'PAYMENT_RECEIPTS') {
      reportTitle = 'Official Payment & Receipt History (भुक्तानी तथा रसिद अभिलेख)';
      filename = `receipts_history_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['Receipt Number', 'Date', 'Permanent Code', 'Consumer Name', 'Ward', 'Amount Received (NPR)', 'Payment Method', 'Slip / Cheque Ref', 'Cashier Staff', 'Remarks'];

      const list = payments.filter((p) => {
        if (filterPaymentMethod !== 'ALL' && p.paymentMethod !== filterPaymentMethod) return false;
        if (filterDateFrom && p.date < filterDateFrom) return false;
        if (filterDateTo && p.date > filterDateTo) return false;
        if (filterWard !== 'ALL') {
          const h = households.find((item) => item.customerCode === p.customerId);
          if (!h || h.ward !== filterWard) return false;
        }
        return true;
      });

      rows = list.map((p) => [
        sanitize(p.receiptNumber),
        sanitize(p.date),
        sanitize(p.customerId),
        sanitize(p.customerName),
        sanitize(p.ward || '-'),
        p.amount,
        sanitize(p.paymentMethod),
        sanitize(p.transactionReference || '-'),
        sanitize(p.staffName || p.receivedBy),
        sanitize(p.remarks || '-'),
      ]);
    } else if (selectedReportType === 'CATEGORIES_SUMMARY') {
      reportTitle = 'Consumer Categories & Tariff Summary (ग्राहक वर्ग तथा महसुल प्रतिवेदन)';
      filename = `consumer_categories_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['Category Code', 'Category Name (EN)', 'Category Name (NE)', 'Base Monthly Fee (NPR)', 'Sanitation Fee (NPR)', 'Late Penalty %', 'Active Consumers Count', 'Total Outstanding'];

      const cats = ['Residential', 'Commercial', 'Institutional', 'Government', 'Other'];
      rows = cats.map((catName) => {
        const catHouseholds = households.filter((h) => (h.category || 'Residential') === catName);
        const catBal = catHouseholds.reduce((s, h) => s + (h.currentBalance || 0), 0);
        return [
          sanitize(catName.toUpperCase()),
          sanitize(catName),
          sanitize(
            catName === 'Residential' ? 'घरेलु / आवासीय' :
            catName === 'Commercial' ? 'व्यापारिक तथा होटल' :
            catName === 'Institutional' ? 'संस्थागत' :
            catName === 'Government' ? 'सरकारी' : 'अन्य'
          ),
          catHouseholds[0]?.monthlyFixedCharge || 150,
          20,
          5,
          catHouseholds.length,
          catBal,
        ];
      });
    } else if (selectedReportType === 'STAFF_REGISTER') {
      reportTitle = 'Authorized Staff & Employee Register (कर्मचारी दर्ता किताब)';
      filename = `staff_register_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['Staff ID', 'Name', 'Email', 'Role', 'Designation', 'Assigned Service Areas', 'Status', 'Account Created'];

      rows = users.map((u) => [
        sanitize(u.staffId || 'STF-001'),
        sanitize(u.displayName || '-'),
        sanitize(u.email || '-'),
        sanitize(u.role),
        sanitize(u.designation || '-'),
        sanitize(`Wards: ${(u.assignedWards || []).join(', ')}`),
        sanitize(u.isActive !== false ? 'ACTIVE' : 'INACTIVE'),
        sanitize(u.createdAt || '-'),
      ]);
    } else if (selectedReportType === 'DUPLICATE_REVIEW') {
      reportTitle = 'Consumer Code & Duplicate Name Review Report (दोहोरो नाम समीक्षा प्रतिवेदन)';
      filename = `duplicate_review_${new Date().toISOString().slice(0, 10)}.csv`;
      headers = ['Normalized Name', 'Permanent Code', 'Household No', 'Ward', 'Tole', 'Phone', 'Current Balance', 'Review Status'];

      const dups = detectDuplicateNames(households);
      const dupRows: (string | number)[][] = [];

      dups.forEach((list, norm) => {
        list.forEach((c) => {
          dupRows.push([
            sanitize(c.ownerName),
            sanitize(c.customerCode),
            sanitize(c.householdNumber),
            sanitize(c.ward),
            sanitize(c.tole || '-'),
            sanitize(c.phoneNumber || '-'),
            c.currentBalance || 0,
            sanitize('Distinct Code Assigned • Review Required'),
          ]);
        });
      });

      rows = dupRows;
    }

    return {
      reportTitle,
      filename,
      headers,
      rows,
      rowCount: rows.length,
    };
  }, [
    selectedReportType,
    bills,
    payments,
    households,
    users,
    filterYear,
    filterMonth,
    filterWard,
    filterCategory,
    filterDateFrom,
    filterDateTo,
    filterPaymentMethod,
  ]);

  // Execute Download
  const handleDownloadExcel = () => {
    if (excelReportData.rows.length === 0) {
      alert('No records match the selected filters. Change your filter parameters to generate data.');
      return;
    }

    const reportMeta = [
      `"Report: ${excelReportData.reportTitle}"`,
      `"Generated On: ${new Date().toLocaleString()}"`,
      `"Active Filters: Ward=${filterWard}, Category=${filterCategory}, Year=${filterYear}, Month=${filterMonth}"`,
      `"Total Records: ${excelReportData.rowCount}"`,
      '',
    ];

    const csvContent =
      '\uFEFF' +
      [
        ...reportMeta,
        excelReportData.headers.join(','),
        ...excelReportData.rows.map((r) => r.join(',')),
      ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = excelReportData.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span>{lang === 'ne' ? 'वित्तीय प्रतिवेदन तथा एक्सेल डाउनलोड केन्द्र' : 'Financial Reports & Excel Export Center'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'ne'
              ? 'आधिकारिक महसुल, भुक्तानी रसिद, बक्यौता, कर्मचारी दर्ता तथा १० प्रकारका विस्तृत एक्सेल प्रतिवेदनहरू।'
              : 'Admin financial reporting, defaulters tracking, and 10 authorized Excel exports with Nepali Unicode support.'}
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveReportTab('excel-center')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeReportTab === 'excel-center' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>{lang === 'ne' ? 'एक्सेल निर्यात केन्द्र (Excel Center)' : 'Excel Export Center'}</span>
          </button>

          <button
            onClick={() => setActiveReportTab('overview')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeReportTab === 'overview' ? 'bg-white text-sky-800 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            {lang === 'ne' ? 'अवलोकन र वडा राजस्व' : 'Overview & Wards'}
          </button>

          <button
            onClick={() => setActiveReportTab('defaulters')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeReportTab === 'defaulters' ? 'bg-white text-rose-800 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            {lang === 'ne' ? 'बक्यौता सूची (Defaulters)' : 'Defaulters'}
          </button>

          <button
            onClick={() => setActiveReportTab('methods')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeReportTab === 'methods' ? 'bg-white text-sky-800 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            {lang === 'ne' ? 'काउन्टर रसिद विधि' : 'Payment Methods'}
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 1. EXCEL EXPORT CENTER (10 REPORTS) */}
      {/* ---------------------------------------------------------------------- */}
      {activeReportTab === 'excel-center' && (
        <div className="space-y-6">
          {/* Report Type Selector Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                {lang === 'ne' ? '१. प्रतिवेदन प्रकार चयन गर्नुहोस् (Select Report Type)' : '1. Select Report Type (10 Reports Available)'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {[
                  { key: 'OUTSTANDING_BALANCES', name: 'Outstanding Balances (बक्यौता दर्ता किताब)', desc: 'Full arrears list with customer codes and contacts' },
                  { key: 'PAID_CONSUMERS', name: 'Paid Consumers (भुक्तानी सम्पन्न)', desc: 'Zero balance households with payment history' },
                  { key: 'UNPAID_CONSUMERS', name: 'Unpaid Consumers (भुक्तानी नभएका)', desc: 'Households with active unpaid dues' },
                  { key: 'PARTIALLY_PAID', name: 'Partially Paid (आंशिक भुक्तानी)', desc: 'Bills with partial installments paid' },
                  { key: 'PENDING_RECORDS', name: 'Pending Records (पुष्टि हुन बाँकी)', desc: 'Bills or consumers awaiting verification' },
                  { key: 'MONTHLY_BILLING', name: 'Monthly Billing Register (मासिक बिलिङ)', desc: 'All generated bills with charges and breakdowns' },
                  { key: 'PAYMENT_RECEIPTS', name: 'Payment & Receipts (रसिद अभिलेख)', desc: 'Official counter receipts with cashier details' },
                  { key: 'CATEGORIES_SUMMARY', name: 'Consumer Categories (ग्राहक वर्ग)', desc: 'Household distribution by category & tariffs' },
                  { key: 'STAFF_REGISTER', name: 'Staff Register (कर्मचारी दर्ता)', desc: 'Permanent staff IDs, roles, and assigned wards' },
                  { key: 'DUPLICATE_REVIEW', name: 'Duplicate Names Review (दोहोरो नाम)', desc: 'Consumers sharing identical names with distinct codes' },
                ].map((rep) => (
                  <button
                    key={rep.key}
                    type="button"
                    onClick={() => setSelectedReportType(rep.key as ExcelReportType)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedReportType === rep.key
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                      <span>{rep.name}</span>
                      {selectedReportType === rep.key && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{rep.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="pt-3 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                {lang === 'ne' ? '२. फिल्टर मापदण्ड (Filter Parameters)' : '2. Report Filter Parameters'}
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs">
                {/* Year Filter */}
                <div>
                  <span className="block text-slate-500 mb-1">Billing Year</span>
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="w-full p-2 border rounded-xl bg-white text-xs"
                  >
                    <option value="ALL">All Years</option>
                    {NEPALI_YEARS.map((y) => (
                      <option key={y} value={y}>BS {y}</option>
                    ))}
                  </select>
                </div>

                {/* Month Filter */}
                <div>
                  <span className="block text-slate-500 mb-1">Billing Month</span>
                  <select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="w-full p-2 border rounded-xl bg-white text-xs"
                  >
                    <option value="ALL">All Months</option>
                    {NEPALI_MONTHS.map((m) => (
                      <option key={m.index} value={m.en}>{m.ne} ({m.en})</option>
                    ))}
                  </select>
                </div>

                {/* Ward Filter */}
                <div>
                  <span className="block text-slate-500 mb-1">Ward Number</span>
                  <select
                    value={filterWard}
                    onChange={(e) => setFilterWard(e.target.value)}
                    className="w-full p-2 border rounded-xl bg-white text-xs"
                  >
                    <option value="ALL">All Wards</option>
                    {['1', '2', '3', '4', '5'].map((w) => (
                      <option key={w} value={w}>Ward {w}</option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <span className="block text-slate-500 mb-1">Consumer Category</span>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full p-2 border rounded-xl bg-white text-xs"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Institutional">Institutional</option>
                    <option value="Government">Government</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Payment Method Filter */}
                <div>
                  <span className="block text-slate-500 mb-1">Payment Method</span>
                  <select
                    value={filterPaymentMethod}
                    onChange={(e) => setFilterPaymentMethod(e.target.value)}
                    className="w-full p-2 border rounded-xl bg-white text-xs"
                  >
                    <option value="ALL">All Methods</option>
                    <option value="CASH">Counter Cash</option>
                    <option value="BANK_DEPOSIT">Bank Deposit</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                {/* Download Action Button */}
                <div className="flex items-end">
                  <button
                    onClick={handleDownloadExcel}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Excel</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Report Live Preview Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {excelReportData.reportTitle}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Showing on-screen preview • Matches: {excelReportData.rowCount} records • File: <code className="font-mono text-emerald-800">{excelReportData.filename}</code>
                </p>
              </div>

              <button
                onClick={handleDownloadExcel}
                disabled={excelReportData.rowCount === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export ({excelReportData.rowCount}) Records</span>
              </button>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold sticky top-0">
                  <tr>
                    {excelReportData.headers.map((h, i) => (
                      <th key={i} className="py-2.5 px-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {excelReportData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={excelReportData.headers.length || 1} className="py-8 text-center text-slate-400 italic">
                        No records match the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    excelReportData.rows.slice(0, 30).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        {row.map((val, cellIdx) => (
                          <td key={cellIdx} className="py-2 px-3 text-slate-700">
                            {typeof val === 'string' ? val.replace(/(^"|"$)/g, '') : val}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {excelReportData.rows.length > 30 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 text-center">
                Preview displays first 30 of {excelReportData.rowCount} records. Click <strong>Download Excel</strong> to export full database records.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 2. OVERVIEW & WARD REVENUE */}
      {/* ---------------------------------------------------------------------- */}
      {activeReportTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">Total Lifetime Invoiced</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{formatNPR(totalBilled, lang)}</div>
              <p className="text-[11px] text-slate-400 mt-1">Total revenue billed across all wards</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">Total Verified Collections</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{formatNPR(totalCollected, lang)}</div>
              <p className="text-[11px] text-emerald-700 mt-1">Office counter cash and verified deposits</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium">Total Current Arrears</span>
              <div className="text-2xl font-black text-rose-600 mt-1">{formatNPR(totalOutstanding, lang)}</div>
              <p className="text-[11px] text-rose-700 mt-1">Outstanding consumer balances</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-4">Ward-wise Revenue & Collection Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3">Ward</th>
                    <th className="p-3">Households</th>
                    <th className="p-3 text-right">Collections</th>
                    <th className="p-3 text-right">Arrears</th>
                    <th className="p-3 text-center">Collection Ratio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wardSummary.map((w) => {
                    const total = w.collected + w.outstanding;
                    const ratio = total > 0 ? Math.round((w.collected / total) * 100) : 0;
                    return (
                      <tr key={w.ward}>
                        <td className="p-3 font-bold">Ward {w.ward}</td>
                        <td className="p-3">{w.householdsCount} households</td>
                        <td className="p-3 text-right font-semibold text-emerald-700">{formatNPR(w.collected, lang)}</td>
                        <td className="p-3 text-right font-extrabold text-rose-600">{formatNPR(w.outstanding, lang)}</td>
                        <td className="p-3 text-center">
                          <span className="font-mono font-bold text-xs">{ratio}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 3. DEFAULTERS LIST */}
      {/* ---------------------------------------------------------------------- */}
      {activeReportTab === 'defaulters' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={defaulterSearch}
                onChange={(e) => setDefaulterSearch(e.target.value)}
                placeholder="Search defaulter by code, name, phone..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span>Threshold:</span>
              <select
                value={minArrears}
                onChange={(e) => setMinArrears(Number(e.target.value))}
                className="p-1.5 border rounded-lg bg-white font-semibold"
              >
                <option value={100}>&gt; NPR 100</option>
                <option value={300}>&gt; NPR 300</option>
                <option value={500}>&gt; NPR 500</option>
                <option value={1000}>&gt; NPR 1,000</option>
              </select>

              <select
                value={defaulterWard}
                onChange={(e) => setDefaulterWard(e.target.value)}
                className="p-1.5 border rounded-lg bg-white font-semibold"
              >
                <option value="ALL">All Wards</option>
                {['1', '2', '3', '4', '5'].map((w) => (
                  <option key={w} value={w}>Ward {w}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3">Permanent Code</th>
                    <th className="p-3">Consumer Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Ward & Tole</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3 text-right">Outstanding Arrears</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {defaultersList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                        No defaulters exceed the selected threshold.
                      </td>
                    </tr>
                  ) : (
                    defaultersList.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-sky-800">{d.customerCode}</td>
                        <td className="p-3 font-semibold text-slate-900">{d.ownerName}</td>
                        <td className="p-3 text-slate-600">{d.category || 'Residential'}</td>
                        <td className="p-3 text-slate-600">Ward {d.ward}, {d.tole || '-'}</td>
                        <td className="p-3 font-mono text-slate-600">{d.phoneNumber || '-'}</td>
                        <td className="p-3 text-right font-extrabold text-rose-600">{formatNPR(d.currentBalance, lang)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 4. PAYMENT METHODS BREAKDOWN */}
      {/* ---------------------------------------------------------------------- */}
      {activeReportTab === 'methods' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Authorized Cashier Collections by Method</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {methodStats.map((m) => (
              <div key={m.key} className="p-4 border rounded-xl bg-slate-50 space-y-1">
                <span className="text-xs text-slate-500 font-medium">{m.label}</span>
                <div className="text-xl font-bold text-slate-900">{formatNPR(m.amount, lang)}</div>
                <div className="text-[11px] text-slate-600">{m.count} receipts ({m.percentage}% share)</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
