import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Household, Tariff, WardInfo, ColumnMapping, CommitteeSettings, ConsumerCategory, ConsumerRegistrationRequest } from '../types';
import { formatNPR, toNepaliNumerals } from '../utils/nepaliCalendar';
import {
  saveHousehold,
  generateUniquePermanentCustomerCode,
  detectDuplicateNames,
  canDeleteHousehold,
  deleteHouseholdProtected,
  toggleHouseholdStatus,
  adjustHouseholdBalance,
  getConsumerRegistrationRequests,
  approveRegistrationRequest,
  rejectRegistrationRequest,
} from '../services/dbService';
import { PrintHouseholdListModal } from './PrintHouseholdListModal';
import { PrintConsumerCardModal } from './PrintConsumerCardModal';
import {
  Users,
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  Edit,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  FileSpreadsheet,
  Printer,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  ShieldAlert,
  Trash2,
  Sliders,
  DollarSign,
  UserCheck,
  Eye,
  RotateCcw,
} from 'lucide-react';

interface HouseholdManagementProps {
  households: Household[];
  tariffs: Tariff[];
  wards: WardInfo[];
  settings: CommitteeSettings;
  onRefresh: () => void;
  onSelectHousehold: (household: Household) => void;
}

export const HouseholdManagement: React.FC<HouseholdManagementProps> = ({
  households,
  tariffs,
  wards,
  settings,
  onRefresh,
  onSelectHousehold,
}) => {
  const { lang, t } = useLanguage();
  const { isSuperAdmin, isAreaStaff, assignedWards } = useAuth();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWard, setSelectedWard] = useState(
    isAreaStaff && assignedWards.length > 0 ? assignedWards[0] : 'ALL'
  );
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [filterNeedsVerification, setFilterNeedsVerification] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHousehold, setEditingHousehold] = useState<Household | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Print Roster & Card Modals
  const [isPrintRosterOpen, setIsPrintRosterOpen] = useState(false);
  const [selectedCardHousehold, setSelectedCardHousehold] = useState<Household | null>(null);

  // Complete View Modal
  const [viewingHousehold, setViewingHousehold] = useState<Household | null>(null);

  // Protected Delete Modal
  const [deleteModalHousehold, setDeleteModalHousehold] = useState<Household | null>(null);
  const [deleteCheckResult, setDeleteCheckResult] = useState<{
    canDelete: boolean;
    reason?: string;
    billsCount: number;
    paymentsCount: number;
  } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Balance Adjustment Modal
  const [adjustModalHousehold, setAdjustModalHousehold] = useState<Household | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number | ''>('');
  const [adjustType, setAdjustType] = useState<'OPENING_BALANCE' | 'CREDIT_ADJUSTMENT' | 'DEBIT_PENALTY'>('OPENING_BALANCE');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // Duplicate Names Review Modal
  const [isDuplicateReviewOpen, setIsDuplicateReviewOpen] = useState(false);

  // View state: 'roster' (Consumer Register) or 'requests' (Self-Registration Requests Queue)
  const [activeView, setActiveView] = useState<'roster' | 'requests'>('roster');
  const [registrationRequests, setRegistrationRequests] = useState<ConsumerRegistrationRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestFilter, setRequestFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [reviewingRequest, setReviewingRequest] = useState<ConsumerRegistrationRequest | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [requestActionLoading, setRequestActionLoading] = useState(false);
  const [requestActionMsg, setRequestActionMsg] = useState('');

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const data = await getConsumerRegistrationRequests();
      setRegistrationRequests(data);
    } catch (err) {
      console.warn('Failed to load registration requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const pendingRequestsCount = useMemo(() => {
    return registrationRequests.filter((r) => r.status === 'PENDING').length;
  }, [registrationRequests]);

  const [requestSearch, setRequestSearch] = useState('');

  const filteredRequests = useMemo(() => {
    return registrationRequests.filter((r) => {
      const matchFilter = requestFilter === 'ALL' || r.status === requestFilter;
      const matchSearch =
        !requestSearch.trim() ||
        r.fullName.toLowerCase().includes(requestSearch.toLowerCase()) ||
        r.phoneNumber.includes(requestSearch) ||
        (r.existingCustomerCode && r.existingCustomerCode.toLowerCase().includes(requestSearch.toLowerCase())) ||
        (r.assignedCustomerCode && r.assignedCustomerCode.toLowerCase().includes(requestSearch.toLowerCase()));
      return matchFilter && matchSearch;
    });
  }, [registrationRequests, requestFilter, requestSearch]);

  // Form Fields
  const [customerCode, setCustomerCode] = useState('');
  const [householdNumber, setHouseholdNumber] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ward, setWard] = useState('1');
  const [tole, setTole] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Residential');
  const [connectionNumber, setConnectionNumber] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [monthlyFixedCharge, setMonthlyFixedCharge] = useState(150);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [registrationDate, setRegistrationDate] = useState('2081-01-01');
  const [connectionDate, setConnectionDate] = useState('2081-01-01');
  const [tariffId, setTariffId] = useState(tariffs[0]?.id || 'tariff-domestic');
  const [openingBalance, setOpeningBalance] = useState(0);

  // ----------------------------------------------------
  // Excel / CSV Import Workflow State
  // ----------------------------------------------------
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1);
  const [csvRawHeaders, setCsvRawHeaders] = useState<string[]>([]);
  const [csvRawRows, setCsvRawRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    customerCode: '',
    householdNumber: '',
    ownerName: '',
    ward: '',
    tole: '',
    address: '',
    phoneNumber: '',
    email: '',
    category: '',
    connectionNumber: '',
    monthlyFixedCharge: '',
    status: '',
    registrationDate: '',
    openingBalance: '',
  });

  const [validatedRecords, setValidatedRecords] = useState<{
    household: Partial<Household>;
    errors: string[];
    isDuplicate: boolean;
    duplicateReason?: string;
  }[]>([]);

  const [importSummary, setImportSummary] = useState<{
    imported: number;
    skippedDuplicates: number;
    failed: number;
  }>({ imported: 0, skippedDuplicates: 0, failed: 0 });

  const [csvImporting, setCsvImporting] = useState(false);

  // Duplicate Names Detection
  const duplicateNameGroups = useMemo(() => {
    return detectDuplicateNames(households);
  }, [households]);

  // Live duplicate name detection in Add/Edit consumer modal
  const existingMatchesForModalName = useMemo(() => {
    if (!ownerName || !ownerName.trim()) return [];
    const norm = ownerName.trim().normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
    return households.filter(
      (h) =>
        (!editingHousehold || h.id !== editingHousehold.id) &&
        h.ownerName.trim().normalize('NFKC').toLowerCase().replace(/\s+/g, ' ') === norm
    );
  }, [ownerName, editingHousehold, households]);

  const handleApproveConsumerRequest = async (req: ConsumerRegistrationRequest) => {
    setRequestActionLoading(true);
    setRequestActionMsg('');
    try {
      const nextCode =
        req.requestType === 'EXISTING_HOUSEHOLD_LINK' && req.existingCustomerCode
          ? req.existingCustomerCode
          : generateUniquePermanentCustomerCode(households);

      await approveRegistrationRequest(req, nextCode);
      setRequestActionMsg(
        lang === 'ne'
          ? `आवेदन स्वीकृत गरियो! स्थायी ग्राहक कोड ${nextCode} जारी भयो।`
          : `Request approved! Permanent ID ${nextCode} issued.`
      );
      setReviewingRequest(null);
      await loadRequests();
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Approval failed');
    } finally {
      setRequestActionLoading(false);
    }
  };

  const handleRejectConsumerRequest = async (requestId: string) => {
    if (!rejectionReasonInput.trim()) {
      alert(lang === 'ne' ? 'कृपया अस्वीकृत गर्नुको कारण प्रविष्ट गर्नुहोस्।' : 'Please enter rejection reason.');
      return;
    }
    setRequestActionLoading(true);
    try {
      await rejectRegistrationRequest(requestId, rejectionReasonInput.trim());
      setReviewingRequest(null);
      setRejectionReasonInput('');
      await loadRequests();
      onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Rejection failed');
    } finally {
      setRequestActionLoading(false);
    }
  };

  // Filtered List based on search, ward, category, status, and role-based ward restrictions
  const filteredHouseholds = useMemo(() => {
    return households.filter((h) => {
      // Area staff can ONLY see households in their assigned wards
      if (isAreaStaff && assignedWards.length > 0 && !assignedWards.includes(h.ward)) {
        return false;
      }

      const matchSearch =
        searchTerm === '' ||
        h.customerCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.householdNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.phoneNumber.includes(searchTerm) ||
        (h.connectionNumber && h.connectionNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        h.meterNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchWard = selectedWard === 'ALL' || h.ward === selectedWard;
      const matchStatus = selectedStatus === 'ALL' || h.status === selectedStatus;
      const matchCategory = selectedCategory === 'ALL' || (h.category || 'Residential') === selectedCategory;
      const matchVerification = !filterNeedsVerification || h.needsVerification || duplicateNameGroups.has(h.ownerName.trim().normalize('NFKC').toLowerCase());

      return matchSearch && matchWard && matchStatus && matchCategory && matchVerification;
    });
  }, [households, searchTerm, selectedWard, selectedStatus, selectedCategory, filterNeedsVerification, isAreaStaff, assignedWards, duplicateNameGroups]);

  // Pagination
  const totalPages = Math.ceil(filteredHouseholds.length / itemsPerPage) || 1;
  const paginatedHouseholds = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredHouseholds.slice(start, start + itemsPerPage);
  }, [filteredHouseholds, currentPage]);

  const openAddModal = () => {
    setEditingHousehold(null);
    // Unique permanent customer code auto-generated from database sequence
    const nextCode = generateUniquePermanentCustomerCode(households);
    setCustomerCode(nextCode);
    setHouseholdNumber(`H-${households.length + 1}`);
    setOwnerName('');
    setWard(isAreaStaff && assignedWards.length > 0 ? assignedWards[0] : '1');
    setTole('');
    setAddress('');
    setPhoneNumber('');
    setEmail('');
    setCategory('Residential');
    setConnectionNumber(`TAP-${1000 + households.length + 1}`);
    setMeterNumber(`M-${1000 + households.length + 1}`);
    setMonthlyFixedCharge(settings.standardMonthlyCharge || 150);
    setStatus('ACTIVE');
    setRegistrationDate('2081-01-01');
    setConnectionDate('2081-01-01');
    setTariffId(tariffs[0]?.id || 'tariff-domestic');
    setOpeningBalance(0);
    setModalError('');
    setIsModalOpen(true);
  };

  const openEditModal = (h: Household) => {
    setEditingHousehold(h);
    // Permanent Customer Code is immutable
    setCustomerCode(h.customerCode);
    setHouseholdNumber(h.householdNumber);
    setOwnerName(h.ownerName);
    setWard(h.ward);
    setTole(h.tole || '');
    setAddress(h.address || '');
    setPhoneNumber(h.phoneNumber || '');
    setEmail(h.email || '');
    setCategory(h.category || 'Residential');
    setConnectionNumber(h.connectionNumber || '');
    setMeterNumber(h.meterNumber || '');
    setMonthlyFixedCharge(h.monthlyFixedCharge || 150);
    setStatus(h.status);
    setRegistrationDate(h.registrationDate || h.connectionDate);
    setConnectionDate(h.connectionDate);
    setTariffId(h.tariffId || tariffs[0]?.id || 'tariff-domestic');
    setOpeningBalance(h.openingBalance || 0);
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSaveHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');

    try {
      if (!customerCode.trim() || !householdNumber.trim() || !ownerName.trim()) {
        throw new Error(lang === 'ne' ? 'कृपया आवश्यक विवरणहरू भर्नुहोस्।' : 'Please fill all required fields.');
      }

      // Check duplicates on add
      if (!editingHousehold) {
        const dupCode = households.find(
          (h) => h.customerCode.trim().toUpperCase() === customerCode.trim().toUpperCase()
        );
        if (dupCode) {
          throw new Error(`Permanent Customer Code ${customerCode} already exists and cannot be reused.`);
        }
      }

      // Check duplicate name warning
      const hasSameName = households.some(
        (h) =>
          (!editingHousehold || h.id !== editingHousehold.id) &&
          h.ownerName.trim().toLowerCase() === ownerName.trim().toLowerCase()
      );

      const id = editingHousehold ? editingHousehold.id : `HHD-${Date.now()}`;
      const householdToSave: Household = {
        id,
        // Permanent Code remains invariant
        customerCode: (editingHousehold ? editingHousehold.customerCode : customerCode).trim().toUpperCase(),
        householdNumber: householdNumber.trim(),
        ownerName: ownerName.trim(),
        ward,
        tole: tole.trim(),
        address: address.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim(),
        category,
        connectionNumber: connectionNumber.trim(),
        meterNumber: meterNumber.trim() || `M-${customerCode}`,
        monthlyFixedCharge: Number(monthlyFixedCharge) || 150,
        status,
        registrationDate,
        connectionDate,
        tariffId,
        openingBalance: Number(openingBalance) || 0,
        currentBalance: editingHousehold ? editingHousehold.currentBalance : Number(openingBalance) || 0,
        lastMeterReading: editingHousehold?.lastMeterReading || 0,
        needsVerification: hasSameName,
        verificationReason: hasSameName ? 'Another consumer with the same name exists.' : '',
        duplicateNameFlag: hasSameName,
      };

      if (editingHousehold?.userId) {
        householdToSave.userId = editingHousehold.userId;
      }
      if (editingHousehold?.createdAt) {
        householdToSave.createdAt = editingHousehold.createdAt;
      }

      await saveHousehold(householdToSave);
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setModalError(err.message || 'Error saving consumer record.');
    } finally {
      setModalLoading(false);
    }
  };

  // Status Toggle (Deactivate / Reactivate)
  const handleToggleStatus = async (h: Household) => {
    const newStatus = h.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = newStatus === 'ACTIVE' ? 'Reactivate' : 'Deactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} consumer ${h.customerCode} (${h.ownerName})?`)) {
      return;
    }

    try {
      await toggleHouseholdStatus(h.id, newStatus, `Admin toggle status to ${newStatus}`);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    }
  };

  // Open Protected Delete Modal
  const openDeleteModal = async (h: Household) => {
    setDeleteModalHousehold(h);
    setDeleteReason('');
    setDeleteCheckResult(null);
    setDeleteLoading(true);

    try {
      const check = await canDeleteHousehold(h.customerCode);
      setDeleteCheckResult(check);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalHousehold || !deleteReason.trim()) return;
    setDeleteLoading(true);

    try {
      await deleteHouseholdProtected(deleteModalHousehold, deleteReason.trim());
      setDeleteModalHousehold(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error deleting consumer record');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Open Balance Adjustment Modal
  const openAdjustModal = (h: Household) => {
    setAdjustModalHousehold(h);
    setAdjustAmount(h.currentBalance || 0);
    setAdjustType('OPENING_BALANCE');
    setAdjustReason('');
    setAdjustError('');
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalHousehold || adjustAmount === '' || !adjustReason.trim()) {
      setAdjustError('Please specify the amount and authorized justification reason.');
      return;
    }
    setAdjustLoading(true);
    setAdjustError('');

    try {
      await adjustHouseholdBalance(
        adjustModalHousehold.id,
        Number(adjustAmount),
        adjustType,
        adjustReason.trim()
      );
      setAdjustModalHousehold(null);
      onRefresh();
    } catch (err: any) {
      setAdjustError(err.message || 'Error adjusting balance');
    } finally {
      setAdjustLoading(false);
    }
  };

  // CSV Export with UTF-8 BOM for Nepali Unicode
  const handleExportCSV = () => {
    const headers = [
      'Permanent Customer Code',
      'Household No',
      'Owner Name',
      'Category',
      'Ward',
      'Tole',
      'Address',
      'Phone',
      'Connection No',
      'Monthly Fixed Charge (NPR)',
      'Status',
      'Registration Date',
      'Current Balance (NPR)',
    ];

    const sanitizeCell = (val: any) => {
      let str = String(val ?? '').trim();
      if (/^[=+@-]/.test(str)) {
        str = `'${str}`; // Formula injection protection
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = filteredHouseholds.map((h) => [
      sanitizeCell(h.customerCode),
      sanitizeCell(h.householdNumber),
      sanitizeCell(h.ownerName),
      sanitizeCell(h.category || 'Residential'),
      sanitizeCell(h.ward),
      sanitizeCell(h.tole),
      sanitizeCell(h.address),
      sanitizeCell(h.phoneNumber),
      sanitizeCell(h.connectionNumber || ''),
      h.monthlyFixedCharge || 150,
      sanitizeCell(h.status),
      sanitizeCell(h.registrationDate || h.connectionDate),
      h.currentBalance || 0,
    ]);

    // UTF-8 BOM \uFEFF ensures Nepali Unicode text opens cleanly in Microsoft Excel
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `consumers_register_${selectedWard}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ----------------------------------------------------
  // Excel / CSV File Upload & Parsing
  // ----------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) throw new Error('File has no data rows.');

        const headers = lines[0].split(',').map((h) => h.replace(/(^"|"$)/g, '').trim());
        const rows = lines.slice(1).map((line) =>
          line.split(',').map((c) => c.replace(/(^"|"$)/g, '').trim())
        );

        setCsvRawHeaders(headers);
        setCsvRawRows(rows);

        // Auto-guess initial mapping
        const autoMap: ColumnMapping = {
          customerCode: headers.find((h) => /code|id|ग्राहक/i.test(h)) || '',
          householdNumber: headers.find((h) => /house|घर/i.test(h)) || '',
          ownerName: headers.find((h) => /name|नाम/i.test(h)) || '',
          ward: headers.find((h) => /ward|वडा/i.test(h)) || '',
          tole: headers.find((h) => /tole|टोल/i.test(h)) || '',
          address: headers.find((h) => /address|ठेगाना/i.test(h)) || '',
          phoneNumber: headers.find((h) => /phone|mobile|सम्पर्क|फोन/i.test(h)) || '',
          email: headers.find((h) => /email|इमेल/i.test(h)) || '',
          category: headers.find((h) => /category|वर्ग/i.test(h)) || '',
          connectionNumber: headers.find((h) => /connection|tap|धारा/i.test(h)) || '',
          monthlyFixedCharge: headers.find((h) => /charge|fee|शुल्क/i.test(h)) || '',
          status: headers.find((h) => /status|स्थिति/i.test(h)) || '',
          registrationDate: headers.find((h) => /date|मिति/i.test(h)) || '',
          openingBalance: headers.find((h) => /balance|बक्यौता/i.test(h)) || '',
        };

        setColumnMapping(autoMap);
        setImportStep(2);
      } catch (err: any) {
        alert(err.message || 'Failed to read CSV/Excel file.');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // Step 2 -> Step 3: Validate & Check Duplicates
  const handleValidateAndPreview = () => {
    let nextSeq = 100;
    households.forEach((h) => {
      const match = h.customerCode.match(/HYT-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > nextSeq) nextSeq = num;
      }
    });

    const validated = csvRawRows.map((row, idx) => {
      const getVal = (col: string) => {
        if (!col) return '';
        const index = csvRawHeaders.indexOf(col);
        return index !== -1 && row[index] !== undefined ? row[index].trim() : '';
      };

      let code = getVal(columnMapping.customerCode).toUpperCase();
      const houseNo = getVal(columnMapping.householdNumber) || `H-${idx + 1}`;
      const name = getVal(columnMapping.ownerName);
      const wardVal = getVal(columnMapping.ward) || '1';
      const toleVal = getVal(columnMapping.tole) || 'Office Area';
      const addressVal = getVal(columnMapping.address) || `Ward ${wardVal}, Hayutar`;
      const phoneVal = getVal(columnMapping.phoneNumber) || '';
      const emailVal = getVal(columnMapping.email) || '';
      const catVal = getVal(columnMapping.category) || 'Residential';
      const connVal = getVal(columnMapping.connectionNumber) || `TAP-${1000 + idx + 1}`;
      const chargeVal = Number(getVal(columnMapping.monthlyFixedCharge)) || settings.standardMonthlyCharge || 150;
      const statusVal = (getVal(columnMapping.status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE';
      const regDateVal = getVal(columnMapping.registrationDate) || '2081-01-01';
      const openBalVal = Number(getVal(columnMapping.openingBalance)) || 0;

      const errors: string[] = [];
      if (!name) errors.push('Customer Name is missing');

      // If imported without code, automatically generate unique sequential permanent code
      if (!code) {
        nextSeq++;
        code = `HYT-${nextSeq.toString().padStart(5, '0')}`;
      }

      // Check duplicates against existing records
      let isDuplicate = false;
      let duplicateReason = '';

      const dupCode = households.find((h) => h.customerCode === code);
      if (dupCode) {
        isDuplicate = true;
        duplicateReason = `Duplicate permanent code ${code} matches existing consumer: ${dupCode.ownerName}`;
      }

      return {
        household: {
          customerCode: code,
          householdNumber: houseNo,
          ownerName: name,
          ward: wardVal,
          tole: toleVal ? toleVal.trim() : '',
          address: addressVal ? addressVal.trim() : '',
          phoneNumber: phoneVal ? phoneVal.trim() : '',
          email: emailVal ? emailVal.trim() : '',
          category: catVal || 'Residential',
          connectionNumber: connVal ? connVal.trim() : '',
          meterNumber: `M-${code}`,
          monthlyFixedCharge: chargeVal,
          status: statusVal,
          registrationDate: regDateVal,
          connectionDate: regDateVal,
          openingBalance: openBalVal,
          currentBalance: openBalVal,
          tariffId: tariffs[0]?.id || 'tariff-domestic',
        },
        errors,
        isDuplicate,
        duplicateReason,
      };
    });

    setValidatedRecords(validated);
    setImportStep(3);
  };

  // Step 3 -> Step 4: Execute Safe Import
  const handleExecuteImport = async () => {
    setCsvImporting(true);
    let imported = 0;
    let skippedDuplicates = 0;
    let failed = 0;

    try {
      for (const item of validatedRecords) {
        if (item.errors.length > 0) {
          failed++;
          continue;
        }
        if (item.isDuplicate) {
          skippedDuplicates++;
          continue;
        }

        const id = `HHD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const householdToSave: Household = {
          ...(item.household as Household),
          id,
          email: item.household.email ? item.household.email.trim() : '',
          connectionNumber: item.household.connectionNumber ? item.household.connectionNumber.trim() : '',
          createdAt: new Date().toISOString(),
        };

        await saveHousehold(householdToSave);
        imported++;
      }

      setImportSummary({ imported, skippedDuplicates, failed });
      setImportStep(4);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setCsvImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Primary Sub-Navigation: Consumer Roster vs Self-Registration Requests */}
      <div className="flex flex-wrap gap-2 bg-white rounded-2xl p-1.5 shadow-xs border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveView('roster')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeView === 'roster'
              ? 'bg-sky-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{lang === 'ne' ? 'उपभोक्ता दर्ता किताब (Consumer Register)' : 'Consumer Register'}</span>
          <span className="bg-sky-200 text-sky-900 px-2 py-0.5 rounded-full text-[10px]">
            {toNepaliNumerals(households.length)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveView('requests');
            loadRequests();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeView === 'requests'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>{lang === 'ne' ? 'नयाँ दर्ता तथा प्रमाणीकरण आवेदनहरू' : 'Registration & Link Requests'}</span>
          {pendingRequestsCount > 0 ? (
            <span className="bg-amber-400 text-amber-950 font-black px-2 py-0.5 rounded-full text-[10px] animate-pulse">
              {pendingRequestsCount} {lang === 'ne' ? 'नयाँ' : 'New'}
            </span>
          ) : (
            <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[10px]">
              {registrationRequests.length}
            </span>
          )}
        </button>
      </div>

      {requestActionMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{requestActionMsg}</span>
        </div>
      )}

      {activeView === 'roster' ? (
        <>
          {/* Duplicate Names Alert Banner (if any duplicates detected) */}
          {duplicateNameGroups.size > 0 && isSuperAdmin && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
              <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h4 className="font-bold text-amber-950 text-xs sm:text-sm">
                {lang === 'ne'
                  ? `दोहोरो नाम समीक्षा आवश्यक: ${duplicateNameGroups.size} वटा नामहरू दोहोरिएका छन्`
                  : `Duplicate Name Review Alert: ${duplicateNameGroups.size} consumer names appear more than once`}
              </h4>
              <p className="text-[11px] text-amber-800 mt-0.5">
                {lang === 'ne'
                  ? 'समान नाम भएका उपभोक्ताहरूलाई प्रणालीले छुट्टाछुट्टै स्थायी ग्राहक कोड दिएको छ। कृपया पहिचान प्रमाणीकरण गर्नुहोस्।'
                  : 'Identical names have distinct permanent codes. Verify their identity to prevent accidental misallocation.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsDuplicateReviewOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer shrink-0"
          >
            {lang === 'ne' ? 'समीक्षा गर्नुहोस्' : 'Review Records'}
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-600" />
            <span>{lang === 'ne' ? 'उपभोक्ता दर्ता किताब तथा ग्राहक व्यवस्थापन' : 'Consumer Register & Household Management'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'ne'
              ? `कुल दर्ता: ${toNepaliNumerals(households.length)} उपभोक्ता • स्थायी ग्राहक कोड, वर्ग, मासिक महसुल तथा आधिकारिक परिचय पत्र`
              : `Total consumers: ${households.length} • Permanent IDs, categories, fixed fees, and printable consumer cards`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Printable Roster button */}
          <button
            onClick={() => setIsPrintRosterOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-sky-600" />
            <span>{lang === 'ne' ? 'नामावली प्रिन्ट' : 'Print Roster'}</span>
          </button>

          {/* Import Excel / CSV button */}
          {isSuperAdmin && (
            <button
              onClick={() => {
                setImportStep(1);
                setIsCsvModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>{lang === 'ne' ? 'Excel / CSV आयात' : 'Excel/CSV Import'}</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>{t('exportCSV')}</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ne' ? 'नयाँ उपभोक्ता थप्नुहोस्' : 'Add Consumer'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={lang === 'ne' ? 'स्थायी ग्राहक कोड, घर नं, नाम, फोन खोज्नुहोस्...' : 'Search permanent code, house #, name, phone...'}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Ward Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              <option value="ALL">{t('allWards')}</option>
              {wards.map((w) => (
                <option key={w.id} value={w.wardNumber}>
                  Ward {w.wardNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
          >
            <option value="ALL">{lang === 'ne' ? 'सबै वर्गहरू' : 'All Categories'}</option>
            <option value="Residential">Residential (घरेलु)</option>
            <option value="Commercial">Commercial (व्यापारिक)</option>
            <option value="Institutional">Institutional (संस्थागत)</option>
            <option value="Government">Government (सरकारी)</option>
            <option value="Other">Other (अन्य)</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
          >
            <option value="ALL">{lang === 'ne' ? 'सबै स्थिति' : 'All Status'}</option>
            <option value="ACTIVE">{lang === 'ne' ? 'सक्रिय (Active)' : 'Active'}</option>
            <option value="INACTIVE">{lang === 'ne' ? 'निष्क्रिय (Inactive)' : 'Inactive'}</option>
          </select>
        </div>
      </div>

      {/* Consumer Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">{lang === 'ne' ? 'स्थायी ग्राहक नं' : 'Permanent Code'}</th>
                <th className="py-3 px-4">{t('householdNumber')}</th>
                <th className="py-3 px-4">{lang === 'ne' ? 'उपभोक्ताको नाम' : 'Consumer Name'}</th>
                <th className="py-3 px-4">{lang === 'ne' ? 'वर्ग (Category)' : 'Category'}</th>
                <th className="py-3 px-4">{t('ward')} / {t('tole')}</th>
                <th className="py-3 px-4">{t('phoneNumber')}</th>
                <th className="py-3 px-4 text-right">{lang === 'ne' ? 'मासिक शुल्क' : 'Monthly Fee'}</th>
                <th className="py-3 px-4 text-right">{t('currentBalance')}</th>
                <th className="py-3 px-4 text-center">{t('status')}</th>
                <th className="py-3 px-4 text-right">{lang === 'ne' ? 'कार्य' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedHouseholds.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500 italic">
                    {lang === 'ne' ? 'कुनै उपभोक्ता फेला परेन।' : 'No consumer records found matching filters.'}
                  </td>
                </tr>
              ) : (
                paginatedHouseholds.map((h) => {
                  const isDupName = duplicateNameGroups.has(h.ownerName.trim().normalize('NFKC').toLowerCase());

                  return (
                    <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-sky-800 font-mono flex items-center gap-1.5">
                        <span>{h.customerCode}</span>
                        {isDupName && (
                          <span
                            title="Same name detected with another consumer. Identity review advised."
                            className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0"
                          ></span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{h.householdNumber}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div>{h.ownerName}</div>
                        {isDupName && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-normal">
                            समीक्षा आवश्यक
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          {h.category || 'Residential'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        Ward {h.ward}{h.tole ? `, ${h.tole}` : ''}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">{h.phoneNumber || '-'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-800">
                        रु {h.monthlyFixedCharge || 150}
                      </td>
                      <td className={`py-3 px-4 text-right font-extrabold ${h.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatNPR(h.currentBalance, lang)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            h.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {h.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Print Consumer Card */}
                          <button
                            onClick={() => setSelectedCardHousehold(h)}
                            title={lang === 'ne' ? 'परिचय पत्र छाप्नुहोस्' : 'Print Consumer Card'}
                            className="p-1.5 text-sky-700 hover:bg-sky-50 rounded-lg cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>

                          {/* Record Counter Payment */}
                          <button
                            onClick={() => onSelectHousehold(h)}
                            className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold text-[11px] cursor-pointer"
                          >
                            {lang === 'ne' ? 'रसिद' : 'Pay'}
                          </button>

                          {/* View Complete Record */}
                          <button
                            onClick={() => setViewingHousehold(h)}
                            title="View Record"
                            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Super Admin Edit */}
                          {isSuperAdmin && (
                            <>
                              <button
                                onClick={() => openEditModal(h)}
                                title="Edit Consumer"
                                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {/* Adjust Balance */}
                              <button
                                onClick={() => openAdjustModal(h)}
                                title={lang === 'ne' ? 'बक्यौता समायोजन' : 'Adjust Balance'}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                              </button>

                              {/* Protected Delete */}
                              <button
                                onClick={() => openDeleteModal(h)}
                                title="Protected Delete"
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs text-slate-600 gap-2">
          <div>
            Showing {paginatedHouseholds.length} of {filteredHouseholds.length} consumers (Page {currentPage} of {totalPages})
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-semibold">{currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      </>
      ) : (
        /* ========================================================================= */
        /* REGISTRATION & VERIFICATION REQUESTS VIEW */
        /* ========================================================================= */
        <div className="space-y-5">
          {/* Requests Header Banner */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-purple-600" />
                <span>
                  {lang === 'ne' ? 'नयाँ दर्ता तथा खाता प्रमाणीकरण आवेदनहरू' : 'Registration & Link Requests'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {lang === 'ne'
                  ? 'उपभोक्ताहरूले नयाँ धारा जडान वा आफ्ना पुराना धाराको खाता जोड्न दिएका आवेदनहरूको प्रमाणीकरण गरी स्थायी ग्राहक कोड जारी गर्नुहोस्।'
                  : 'Review consumer self-registration and household linking applications. Assign verified permanent customer IDs.'}
              </p>
            </div>

            <button
              type="button"
              onClick={loadRequests}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-purple-600" />
              <span>{lang === 'ne' ? 'ताजा गर्नुहोस् (Refresh)' : 'Refresh'}</span>
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                placeholder={lang === 'ne' ? 'आवेदकको नाम, फोन वा कोड खोज्नुहोस्...' : 'Search applicant name, phone, code...'}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setRequestFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    requestFilter === st
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL'
                    ? lang === 'ne' ? 'सबै' : 'All'
                    : st === 'PENDING'
                    ? lang === 'ne' ? 'स्वीकृति बाँकी (Pending)' : 'Pending'
                    : st === 'APPROVED'
                    ? lang === 'ne' ? 'स्वीकृत (Approved)' : 'Approved'
                    : lang === 'ne' ? 'अस्वीकृत (Rejected)' : 'Rejected'}
                </button>
              ))}
            </div>
          </div>

          {/* Requests Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loadingRequests ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <span className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full inline-block animate-spin mb-2"></span>
                <div>{lang === 'ne' ? 'आवेदनहरू लोड हुँदैछन्...' : 'Loading requests...'}</div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                {lang === 'ne' ? 'कुनै आवेदन फेला परेन।' : 'No registration requests found.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">{lang === 'ne' ? 'आवेदकको नाम' : 'Applicant'}</th>
                      <th className="py-3 px-4">{lang === 'ne' ? 'प्रकार' : 'Type'}</th>
                      <th className="py-3 px-4">{lang === 'ne' ? 'सम्पर्क फोन' : 'Phone'}</th>
                      <th className="py-3 px-4">{lang === 'ne' ? 'ठेगाना / वडा' : 'Ward / Address'}</th>
                      <th className="py-3 px-4">{lang === 'ne' ? 'ग्राहक कोड (Customer ID)' : 'Customer ID'}</th>
                      <th className="py-3 px-4">{lang === 'ne' ? 'स्थिति' : 'Status'}</th>
                      <th className="py-3 px-4 text-right">{lang === 'ne' ? 'कार्य' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{req.fullName}</div>
                          <div className="text-[10px] text-slate-400">
                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '-'}
                          </div>
                          {req.applicantNotes && (
                            <div className="text-[10px] text-slate-500 italic mt-0.5 max-w-xs truncate">
                              "{req.applicantNotes}"
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              req.requestType === 'NEW_CONNECTION'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {req.requestType === 'NEW_CONNECTION'
                              ? lang === 'ne' ? 'नयाँ धारा आवेदन' : 'New Tap'
                              : lang === 'ne' ? 'खाता लिङ्किङ' : 'Account Link'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-slate-800 font-semibold">{req.phoneNumber}</div>
                          {req.email && <div className="text-[10px] text-slate-500">{req.email}</div>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">वडा नं {req.ward}</div>
                          <div className="text-[10px] text-slate-500">{req.address || req.tole || '-'}</div>
                        </td>
                        <td className="py-3 px-4">
                          {req.assignedCustomerCode ? (
                            <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                              {req.assignedCustomerCode}
                            </span>
                          ) : req.existingCustomerCode ? (
                            <span className="font-mono font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                              {req.existingCustomerCode}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">स्वीकृतिमा स्वतः जारी हुनेछ</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : req.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-rose-100 text-rose-900 border border-rose-300'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {req.status === 'PENDING' && isSuperAdmin ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={requestActionLoading}
                                onClick={() => handleApproveConsumerRequest(req)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                {lang === 'ne' ? 'स्वीकृत गर्नुहोस्' : 'Approve'}
                              </button>
                              <button
                                type="button"
                                disabled={requestActionLoading}
                                onClick={() => setReviewingRequest(req)}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                              >
                                {lang === 'ne' ? 'अस्वीकृत' : 'Reject'}
                              </button>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400">
                              {req.status === 'REJECTED' && req.rejectionReason
                                ? `कारण: ${req.rejectionReason}`
                                : req.reviewedBy
                                ? `By ${req.reviewedBy}`
                                : '-'}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rejection Modal */}
          {reviewingRequest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>{lang === 'ne' ? 'आवेदन अस्वीकृत गर्ने' : 'Reject Application'}</span>
                  </h3>
                  <button onClick={() => setReviewingRequest(null)} className="p-1 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-slate-600">
                  आवेदक <strong>{reviewingRequest.fullName}</strong> ({reviewingRequest.phoneNumber}) को आवेदन अस्वीकृत गर्न कारण खुलाउनुहोस्:
                </div>
                <textarea
                  rows={3}
                  required
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="उदा: वडा वा घरधुरी ठेगाना मेल नखाएको, आवश्यक कागजात नपुगेको..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewingRequest(null)}
                    className="px-3 py-1.5 rounded-lg border text-xs"
                  >
                    रद्द गर्नुहोस्
                  </button>
                  <button
                    type="button"
                    disabled={requestActionLoading}
                    onClick={() => handleRejectConsumerRequest(reviewingRequest.id)}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    अस्वीकृत पुष्टि गर्नुहोस्
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* ADD / EDIT CONSUMER MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-sky-800 text-white p-5 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-200" />
                <span>
                  {editingHousehold
                    ? (lang === 'ne' ? 'उपभोक्ता विवरण संशोधन' : 'Edit Consumer Information')
                    : (lang === 'ne' ? 'नयाँ उपभोक्ता दर्ता (स्थायी कोड सहित)' : 'New Consumer Registration')}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-sky-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHousehold} className="p-6 space-y-4 overflow-y-auto flex-1">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Permanent Customer Code (Read-only during edit) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'स्थायी ग्राहक नम्बर (Permanent Code)' : 'Permanent Customer Code'} *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingHousehold)}
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold uppercase bg-slate-50 disabled:text-slate-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {editingHousehold ? 'Permanent ID is immutable and cannot be changed.' : 'Auto-generated permanent sequence code.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'घरधुरी नम्बर (Household No)' : 'Household Number'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={householdNumber}
                    onChange={(e) => setHouseholdNumber(e.target.value)}
                    placeholder="e.g. H-104 or १-२३"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'उपभोक्ताको पूरा नाम (Nepali/English)' : 'Consumer Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. राम बहादुर थापा (Ram B. Thapa)"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-medium"
                  />
                </div>

                {/* Duplicate Name Resolution Banner */}
                {existingMatchesForModalName.length > 0 && (
                  <div className="col-span-1 sm:col-span-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-bold">
                        {lang === 'ne' ? 'नाम दोहोरिएको पहिचान (Duplicate Name Detected):' : 'Duplicate Name Detected:'}
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {lang === 'ne'
                          ? `प्रणालीमा "${ownerName.trim()}" नाम भएका ${existingMatchesForModalName.length} जना उपभोक्ता पहिले नै दर्ता छन्। प्रणालीले यो नयाँ उपभोक्तालाई भिन्न स्थायी ग्राहक कोड (${customerCode}) सुरक्षित राखेको छ, जसले गर्दा नाम उस्तै भए पनि दुवैको हिसाब, धारा र रसिद फरक रहनेछ।`
                          : `Consumers with this name already exist. The system guarantees a distinct permanent ID (${customerCode}) to keep ledger records safe and separate.`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Consumer Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'ग्राहक वर्ग (Category)' : 'Consumer Category'} *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="Residential">Residential (घरेलु / आवासीय)</option>
                    <option value="Commercial">Commercial (व्यापारिक तथा होटल)</option>
                    <option value="Institutional">Institutional (संस्थागत तथा विद्यालय)</option>
                    <option value="Government">Government (सरकारी / सार्वजनिक कार्यालय)</option>
                    <option value="Other">Other (अन्य विशेष उपभोक्ता)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'वडा नम्बर' : 'Ward'} *
                  </label>
                  <select
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  >
                    {wards.map((w) => (
                      <option key={w.id} value={w.wardNumber}>
                        Ward {w.wardNumber} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'टोलको नाम' : 'Tole Name'}
                  </label>
                  <input
                    type="text"
                    value={tole}
                    onChange={(e) => setTole(e.target.value)}
                    placeholder="e.g. बजार टोल, धारापानी"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'पूरा ठेगाना' : 'Full Address'}
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Ward 3, Hayutar"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'सम्पर्क फोन नम्बर' : 'Phone Number'}
                  </label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="98XXXXXXXX"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'धारा जडान नम्बर' : 'Connection Number'}
                  </label>
                  <input
                    type="text"
                    value={connectionNumber}
                    onChange={(e) => setConnectionNumber(e.target.value)}
                    placeholder="e.g. TAP-101"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'मासिक तोकिएको शुल्क (NPR)' : 'Monthly Fixed Charge (NPR)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={monthlyFixedCharge}
                    onChange={(e) => setMonthlyFixedCharge(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'ne' ? 'सुरुआती बक्यौता (Opening Balance NPR)' : 'Opening Balance (NPR)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={Boolean(editingHousehold)}
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('status')}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="ACTIVE">{lang === 'ne' ? 'सक्रिय (ACTIVE)' : 'ACTIVE'}</option>
                    <option value="INACTIVE">{lang === 'ne' ? 'निष्क्रिय (INACTIVE)' : 'INACTIVE'}</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-xs font-semibold text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {modalLoading ? 'Saving...' : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* DUPLICATE NAMES REVIEW MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {isDuplicateReviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-amber-800 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-200" />
                <h3 className="font-bold text-sm">
                  {lang === 'ne' ? 'दोहोरो नाम समीक्षा तथा प्रमाणीकरण' : 'Duplicate Consumer Names Review'}
                </h3>
              </div>
              <button onClick={() => setIsDuplicateReviewOpen(false)} className="p-1 text-amber-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs text-slate-700">
              <p className="text-slate-600">
                {lang === 'ne'
                  ? 'तल समान नाम भएका उपभोक्ताहरूको सूचि दिइएको छ। तिनीहरूको स्थायी ग्राहक कोड, ठेगाना र फोन नम्बर फरक रहेको पुष्टि गर्नुहोस्। प्रणालीले यी खाताहरूलाई स्वतः मिसाउने (merge) गर्दैन।'
                  : 'The consumers below share identical names. Verify their distinct permanent codes, addresses, and phone numbers. The system never merges records automatically.'}
              </p>

              <div className="space-y-4">
                {Array.from(duplicateNameGroups.entries()).map(([normName, list]) => (
                  <div key={normName} className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/40">
                    <div className="bg-amber-100/80 px-4 py-2 font-bold text-amber-950 flex justify-between items-center">
                      <span>Name: {list[0].ownerName}</span>
                      <span className="text-[10px] font-semibold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                        {list.length} Records Found
                      </span>
                    </div>

                    <div className="divide-y divide-amber-200/60">
                      {list.map((c) => (
                        <div key={c.id} className="p-3 flex justify-between items-center text-xs">
                          <div>
                            <div className="font-bold text-sky-900 font-mono">{c.customerCode}</div>
                            <div className="text-slate-600">
                              House #{c.householdNumber} • Ward {c.ward}, {c.tole || '-'} • Phone: {c.phoneNumber || '-'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{formatNPR(c.currentBalance, lang)}</span>
                            <button
                              onClick={() => {
                                setIsDuplicateReviewOpen(false);
                                openEditModal(c);
                              }}
                              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-[11px] rounded-lg font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setIsDuplicateReviewOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* PROTECTED DELETION CONFIRMATION MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {deleteModalHousehold && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-rose-700 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span>Protected Record Deletion</span>
              </h3>
              <button onClick={() => setDeleteModalHousehold(null)} className="p-1 text-rose-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              {deleteCheckResult && !deleteCheckResult.canDelete ? (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
                  <div className="font-bold text-rose-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-700" />
                    <span>Financial Retention Policy Enforced</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    {deleteCheckResult.reason}
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await toggleHouseholdStatus(deleteModalHousehold.id, 'INACTIVE', 'Deactivated in lieu of deletion due to financial history');
                        setDeleteModalHousehold(null);
                        onRefresh();
                      }}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs"
                    >
                      Deactivate Consumer Account Instead (Safe)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p>
                    Are you sure you want to permanently delete consumer record <strong>{deleteModalHousehold.customerCode} ({deleteModalHousehold.ownerName})</strong>?
                  </p>
                  <p className="text-[11px] text-slate-500">
                    No financial history was found for this consumer. Please provide an administrative justification:
                  </p>
                  <input
                    type="text"
                    required
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Reason for deletion (e.g. Duplicate test record)..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setDeleteModalHousehold(null)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleteLoading || !deleteReason.trim()}
                      onClick={handleConfirmDelete}
                      className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {deleteLoading ? 'Deleting...' : 'Confirm Deletion'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* BALANCE ADJUSTMENT MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {adjustModalHousehold && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-sky-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-sky-300" />
                <span>{lang === 'ne' ? 'बक्यौता रकम समायोजन' : 'Adjust Consumer Balance'}</span>
              </h3>
              <button onClick={() => setAdjustModalHousehold(null)} className="p-1 text-sky-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-5 space-y-4 text-xs text-slate-700">
              {adjustError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                  {adjustError}
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div>Consumer: <strong>{adjustModalHousehold.ownerName}</strong> ({adjustModalHousehold.customerCode})</div>
                <div>Current Ledger Balance: <strong className="text-rose-600">{formatNPR(adjustModalHousehold.currentBalance, lang)}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adjustment Type *
                </label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                >
                  <option value="OPENING_BALANCE">Correct Opening Balance (सुरुआती बक्यौता संशोधन)</option>
                  <option value="CREDIT_ADJUSTMENT">Credit Adjustment / Waiver (छुट / बक्यौता मिनाहा)</option>
                  <option value="DEBIT_PENALTY">Debit Charge / Penalty Addition (थप शुल्क / जरिवाना)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adjustment Amount (NPR) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrative Reason / Justification *
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Corrected verified opening register page 24"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAdjustModalHousehold(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {adjustLoading ? 'Recording...' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* COMPLETE VIEW MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {viewingHousehold && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-sky-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Consumer Record Details</h3>
              <button onClick={() => setViewingHousehold(null)} className="p-1 text-sky-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Permanent Code:</span>
                <span className="font-bold font-mono text-sky-900">{viewingHousehold.customerCode}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Owner Name:</span>
                <span className="font-bold text-slate-900">{viewingHousehold.ownerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Category:</span>
                <span className="font-semibold">{viewingHousehold.category || 'Residential'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Household No:</span>
                <span className="font-semibold">{viewingHousehold.householdNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Ward & Tole:</span>
                <span>Ward {viewingHousehold.ward}, {viewingHousehold.tole || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Address:</span>
                <span>{viewingHousehold.address || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Phone:</span>
                <span className="font-mono">{viewingHousehold.phoneNumber || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Connection / Meter:</span>
                <span className="font-mono">{viewingHousehold.connectionNumber || '-'} / {viewingHousehold.meterNumber || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Monthly Fixed Charge:</span>
                <span className="font-semibold">रु {viewingHousehold.monthlyFixedCharge || 150}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Current Balance:</span>
                <span className="font-extrabold text-rose-600 text-sm">{formatNPR(viewingHousehold.currentBalance, lang)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Registration Date:</span>
                <span>{viewingHousehold.registrationDate || '-'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-emerald-700">{viewingHousehold.status}</span>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  onClick={() => {
                    const h = viewingHousehold;
                    setViewingHousehold(null);
                    setSelectedCardHousehold(h);
                  }}
                  className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold"
                >
                  Print Consumer Card
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* EXCEL / CSV IMPORT WORKFLOW MODAL (4 Steps) */}
      {/* ---------------------------------------------------------------------- */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-sky-900 text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-sky-200" />
                <h3 className="font-bold text-base">
                  {lang === 'ne' ? 'Excel / CSV उपभोक्ता आयात प्रणाली' : 'Excel/CSV Consumer Import Workflow'}
                </h3>
              </div>
              <button onClick={() => setIsCsvModalOpen(false)} className="p-1 text-sky-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex justify-between text-xs font-semibold text-slate-500 shrink-0">
              <span className={importStep === 1 ? 'text-sky-700 font-bold' : ''}>1. Upload File</span>
              <span>→</span>
              <span className={importStep === 2 ? 'text-sky-700 font-bold' : ''}>2. Map Columns</span>
              <span>→</span>
              <span className={importStep === 3 ? 'text-sky-700 font-bold' : ''}>3. Validate & Duplicates</span>
              <span>→</span>
              <span className={importStep === 4 ? 'text-sky-700 font-bold' : ''}>4. Summary</span>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Step 1: Upload */}
              {importStep === 1 && (
                <div className="space-y-4 text-center py-8">
                  <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-sky-300">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {lang === 'ne' ? 'Excel वा CSV फाइल चयन गर्नुहोस्' : 'Select CSV/Excel Exported File'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Supports Nepali Unicode names, phone numbers, and balances. Columns will be mapped in the next step.
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".csv, .txt"
                    onChange={handleFileChange}
                    className="text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
                  />
                </div>
              )}

              {/* Step 2: Column Mapping */}
              {importStep === 2 && (
                <div className="space-y-4 text-xs">
                  <p className="text-slate-600">
                    Match the spreadsheet columns to the application fields. If a Permanent Code column is not mapped, permanent sequential codes will be generated automatically.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.keys(columnMapping).map((field) => (
                      <div key={field} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="font-semibold text-slate-700 capitalize">
                          {field.replace(/([A-Z])/g, ' $1')}
                        </span>
                        <select
                          value={(columnMapping as any)[field]}
                          onChange={(e) =>
                            setColumnMapping({ ...columnMapping, [field]: e.target.value })
                          }
                          className="px-2 py-1 rounded border border-slate-300 text-xs bg-white max-w-[180px]"
                        >
                          <option value="">-- Ignore / Default --</option>
                          {csvRawHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setImportStep(1)}
                      className="px-4 py-2 border rounded-xl text-xs font-semibold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleValidateAndPreview}
                      className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold"
                    >
                      Validate Records
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Validate & Duplicates Preview */}
              {importStep === 3 && (
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-slate-900">Validation & Duplicate Preview</h4>
                      <p className="text-slate-500 text-[11px]">
                        Review errors and duplicate warnings. Existing records will never be overwritten silently.
                      </p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                        <tr>
                          <th className="p-2">Code</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Category</th>
                          <th className="p-2">Ward</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validatedRecords.map((item, i) => (
                          <tr key={i} className={item.isDuplicate ? 'bg-amber-50/70' : item.errors.length > 0 ? 'bg-rose-50/70' : ''}>
                            <td className="p-2 font-mono font-bold">{item.household.customerCode}</td>
                            <td className="p-2">{item.household.ownerName}</td>
                            <td className="p-2">{item.household.category || 'Residential'}</td>
                            <td className="p-2">Ward {item.household.ward}</td>
                            <td className="p-2">
                              {item.errors.length > 0 ? (
                                <span className="text-rose-600 font-bold">{item.errors.join(', ')}</span>
                              ) : item.isDuplicate ? (
                                <span className="text-amber-700 font-bold">{item.duplicateReason}</span>
                              ) : (
                                <span className="text-emerald-600 font-semibold">Valid (Ready)</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setImportStep(2)}
                      className="px-4 py-2 border rounded-xl text-xs font-semibold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={csvImporting}
                      onClick={handleExecuteImport}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {csvImporting ? 'Importing Records...' : 'Confirm Safe Import'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Summary */}
              {importStep === 4 && (
                <div className="space-y-4 text-center py-6 text-xs">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-slate-900 text-base">Import Completed Successfully</h4>
                  <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="text-lg font-bold text-emerald-800">{importSummary.imported}</div>
                      <div className="text-slate-600">Imported</div>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="text-lg font-bold text-amber-800">{importSummary.skippedDuplicates}</div>
                      <div className="text-slate-600">Skipped (Dup)</div>
                    </div>
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                      <div className="text-lg font-bold text-rose-800">{importSummary.failed}</div>
                      <div className="text-slate-600">Failed</div>
                    </div>
                  </div>
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => setIsCsvModalOpen(false)}
                      className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Consumer Roster Modal */}
      {isPrintRosterOpen && (
        <PrintHouseholdListModal
          households={filteredHouseholds}
          settings={settings}
          wardFilter={selectedWard}
          onClose={() => setIsPrintRosterOpen(false)}
        />
      )}

      {/* Printable Consumer Identity Card Modal */}
      {selectedCardHousehold && (
        <PrintConsumerCardModal
          household={selectedCardHousehold}
          settings={settings}
          onClose={() => setSelectedCardHousehold(null)}
        />
      )}
    </div>
  );
};
