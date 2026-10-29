import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { UserProfile, UserRole, WardInfo, AuditLog, AccountStatus } from '../types';
import {
  getAllUsers,
  saveUserProfile,
  generateUniqueStaffId,
  getNextPermanentStaffId,
  checkStaffHistoricalDependencies,
  deactivateStaffUser,
  reactivateStaffUser,
  editStaffProfile,
  deleteStaffUser,
  getStaffAuditLogs,
  createAuditLog,
  BOOTSTRAP_ADMIN_EMAIL,
} from '../services/dbService';
import {
  UserCheck,
  Shield,
  Search,
  CheckCircle,
  XCircle,
  Edit,
  MapPin,
  AlertCircle,
  RefreshCw,
  UserPlus,
  Layers,
  Printer,
  Download,
  Lock,
  Mail,
  Phone,
  X,
  CreditCard,
  UserX,
  RotateCcw,
  Eye,
  Trash2,
  AlertTriangle,
  History,
  FileText,
  Clock,
  Briefcase,
  Calendar,
  Building,
} from 'lucide-react';

interface StaffManagementProps {
  wards: WardInfo[];
  onRefresh: () => void;
}

export const StaffManagement: React.FC<StaffManagementProps> = ({ wards, onRefresh }) => {
  const { lang, t } = useLanguage();
  const { currentUser, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modals state
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
  const [deactivatingStaff, setDeactivatingStaff] = useState<UserProfile | null>(null);
  const [reactivatingStaff, setReactivatingStaff] = useState<UserProfile | null>(null);
  const [viewingStaff, setViewingStaff] = useState<UserProfile | null>(null);
  const [staffAuditLogs, setStaffAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [deletingStaff, setDeletingStaff] = useState<UserProfile | null>(null);
  const [deletionDependencyInfo, setDeletionDependencyInfo] = useState<{
    checked: boolean;
    hasDependencies: boolean;
    paymentCount: number;
    billCount: number;
    auditCount: number;
    summary: string;
  } | null>(null);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');

  // Add staff form state
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffAddress, setNewStaffAddress] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('AREA_STAFF');
  const [newStaffDesignation, setNewStaffDesignation] = useState('');
  const [newStaffNotes, setNewStaffNotes] = useState('');
  const [newStaffWards, setNewStaffWards] = useState<string[]>(['1']);
  const [addStaffLoading, setAddStaffLoading] = useState(false);

  // Edit staff form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('AREA_STAFF');
  const [editWards, setEditWards] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState<AccountStatus>('ACTIVE');
  const [editReason, setEditReason] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Deactivate form state
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // Reactivate form state
  const [reactivateReason, setReactivateReason] = useState('');
  const [reactivateLoading, setReactivateLoading] = useState(false);

  // Delete form state
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Notification message
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const all = await getAllUsers();
      setUsers(all);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter staff members
  const staffMembers = users.filter((u) => {
    const isStaff =
      u.role === 'SUPER_ADMIN' ||
      u.role === 'ADMIN' ||
      u.role === 'AREA_STAFF' ||
      u.role === 'BILLING_STAFF' ||
      (u.role as string) === 'admin' ||
      (u.role as string) === 'staff';

    if (!isStaff) return false;

    // Status filter
    const isActive = u.isActive !== false && u.accountStatus !== 'INACTIVE' && u.accountStatus !== 'SUSPENDED';
    if (statusFilter === 'ACTIVE' && !isActive) return false;
    if (statusFilter === 'INACTIVE' && isActive) return false;

    // Role filter
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

    // Search term
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const matchName = u.displayName?.toLowerCase().includes(term);
      const matchEmail = u.email?.toLowerCase().includes(term);
      const matchStaffId = u.staffId?.toLowerCase().includes(term);
      const matchPhone = u.phoneNumber?.includes(term);
      const matchDesignation = u.designation?.toLowerCase().includes(term);
      const matchWards = (u.assignedWards || []).some((w) => w.includes(term));
      return matchName || matchEmail || matchStaffId || matchPhone || matchDesignation || matchWards;
    }

    return true;
  });

  const activeStaffCount = users.filter(
    (u) =>
      (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' || u.role === 'AREA_STAFF' || u.role === 'BILLING_STAFF') &&
      u.isActive !== false &&
      u.accountStatus !== 'INACTIVE'
  ).length;

  const inactiveStaffCount = users.filter(
    (u) =>
      (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' || u.role === 'AREA_STAFF' || u.role === 'BILLING_STAFF') &&
      (u.isActive === false || u.accountStatus === 'INACTIVE' || u.accountStatus === 'SUSPENDED')
  ).length;

  // Open Add Modal
  const openAddModal = () => {
    setNewStaffEmail('');
    setNewStaffName('');
    setNewStaffPhone('');
    setNewStaffAddress('');
    setNewStaffRole('AREA_STAFF');
    setNewStaffDesignation('Area Water Meter Reader');
    setNewStaffNotes('');
    setNewStaffWards(['1']);
    setIsAddStaffOpen(true);
    setMessage(null);
  };

  // Handle Create Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newStaffEmail.trim().toLowerCase();
    const cleanName = newStaffName.trim();

    if (!cleanEmail || !cleanName) {
      alert('Please provide staff name and authenticated email');
      return;
    }

    // Check for existing account with same email
    const duplicateEmail = users.find((u) => u.email?.toLowerCase() === cleanEmail);
    if (duplicateEmail) {
      alert(`Account with email ${cleanEmail} already exists (${duplicateEmail.displayName}, Staff ID: ${duplicateEmail.staffId || 'N/A'}). Duplicate accounts are prevented.`);
      return;
    }

    setAddStaffLoading(true);
    try {
      const nextStaffId = await getNextPermanentStaffId();
      const uid = `staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const timestamp = new Date().toISOString();

      const newStaff: UserProfile = {
        uid,
        email: cleanEmail,
        displayName: cleanName,
        phoneNumber: newStaffPhone.trim() || undefined,
        address: newStaffAddress.trim() || undefined,
        role: newStaffRole,
        staffId: nextStaffId,
        designation: newStaffDesignation.trim() || undefined,
        notes: newStaffNotes.trim() || undefined,
        assignedWards: newStaffRole === 'AREA_STAFF' ? newStaffWards : [],
        isApproved: true,
        isActive: true,
        accountStatus: 'ACTIVE',
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await saveUserProfile(newStaff);

      await createAuditLog(
        'CREATE_STAFF',
        'User',
        uid,
        `Main Admin (${currentUser?.email}) created new staff account for ${cleanName} (Staff ID: ${nextStaffId}, Email: ${cleanEmail}, Role: ${newStaffRole}, Assigned Wards: [${newStaffWards.join(', ')}]).`
      );

      setIsAddStaffOpen(false);
      setMessage({
        text: `Staff account created with unique ID ${nextStaffId}. The employee can log in using ${cleanEmail}.`,
        isError: false,
      });
      fetchUsers();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error creating staff account');
    } finally {
      setAddStaffLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (staff: UserProfile) => {
    setEditingStaff(staff);
    setEditName(staff.displayName || '');
    setEditPhone(staff.phoneNumber || '');
    setEditAddress(staff.address || '');
    setEditDesignation(staff.designation || '');
    setEditNotes(staff.notes || '');
    setEditRole(staff.role);
    setEditWards(staff.assignedWards || []);
    setEditStatus(staff.accountStatus || (staff.isActive !== false ? 'ACTIVE' : 'INACTIVE'));
    setEditReason('');
    setMessage(null);
  };

  const handleToggleEditWard = (wardNum: string) => {
    if (editWards.includes(wardNum)) {
      setEditWards(editWards.filter((w) => w !== wardNum));
    } else {
      setEditWards([...editWards, wardNum]);
    }
  };

  // Handle Save Staff Edit
  const handleSaveStaffEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setEditLoading(true);
    setMessage(null);

    try {
      await editStaffProfile(
        editingStaff.uid,
        editingStaff,
        {
          displayName: editName,
          phoneNumber: editPhone,
          address: editAddress,
          designation: editDesignation,
          notes: editNotes,
          role: editRole,
          assignedWards: editRole === 'AREA_STAFF' ? editWards : [],
          accountStatus: editStatus,
        },
        currentUser?.email || BOOTSTRAP_ADMIN_EMAIL,
        editReason
      );

      setMessage({
        text: lang === 'ne' ? 'कर्मचारी विवरण तथा अधिकार सफलतापूर्वक अद्यावधिक गरियो!' : 'Staff profile and permissions updated successfully!',
        isError: false,
      });
      setEditingStaff(null);
      fetchUsers();
      onRefresh();
    } catch (err: any) {
      setMessage({ text: err.message || 'Error updating staff', isError: true });
    } finally {
      setEditLoading(false);
    }
  };

  // Open Deactivate Confirmation Modal
  const openDeactivateModal = (staff: UserProfile) => {
    if (staff.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      alert('Security Policy: The Permanent Main Administrator (hayutarkhanepani@gmail.com) cannot be deactivated.');
      return;
    }
    setDeactivatingStaff(staff);
    setDeactivateReason('');
    setMessage(null);
  };

  // Handle Deactivate Confirm
  const handleConfirmDeactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deactivatingStaff) return;

    if (!deactivateReason.trim()) {
      alert('Please specify the reason for deactivating this staff account (e.g. कार्यकाल समाप्त, अन्यत्र सरुवा, राजीनामा).');
      return;
    }

    setDeactivateLoading(true);
    try {
      await deactivateStaffUser(
        deactivatingStaff.uid,
        deactivatingStaff,
        currentUser?.email || BOOTSTRAP_ADMIN_EMAIL,
        deactivateReason.trim()
      );

      setMessage({
        text: `Staff member ${deactivatingStaff.displayName} (${deactivatingStaff.staffId}) safely deactivated. System access revoked while retaining historical records.`,
        isError: false,
      });
      setDeactivatingStaff(null);
      fetchUsers();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error deactivating staff');
    } finally {
      setDeactivateLoading(false);
    }
  };

  // Open Reactivate Modal
  const openReactivateModal = (staff: UserProfile) => {
    setReactivatingStaff(staff);
    setReactivateReason('');
    setMessage(null);
  };

  // Handle Reactivate Confirm
  const handleConfirmReactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reactivatingStaff) return;

    setReactivateLoading(true);
    try {
      await reactivateStaffUser(
        reactivatingStaff.uid,
        reactivatingStaff,
        currentUser?.email || BOOTSTRAP_ADMIN_EMAIL,
        reactivateReason.trim()
      );

      setMessage({
        text: `Staff member ${reactivatingStaff.displayName} (${reactivatingStaff.staffId}) successfully reactivated with assigned role ${reactivatingStaff.role}.`,
        isError: false,
      });
      setReactivatingStaff(null);
      fetchUsers();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error reactivating staff');
    } finally {
      setReactivateLoading(false);
    }
  };

  // Open Details Modal with audit logs
  const openDetailsModal = async (staff: UserProfile) => {
    setViewingStaff(staff);
    setLoadingAuditLogs(true);
    try {
      const logs = await getStaffAuditLogs(staff.email || '', staff.displayName || '', staff.staffId);
      setStaffAuditLogs(logs);
    } catch (err) {
      console.warn('Error loading staff audit logs:', err);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  // Open Delete Confirmation Modal (Runs dependency check first)
  const openDeleteModal = async (staff: UserProfile) => {
    if (staff.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      alert('Security Policy: The designated Permanent Main Administrator (hayutarkhanepani@gmail.com) cannot be deleted.');
      return;
    }
    setDeletingStaff(staff);
    setConfirmDeleteInput('');
    setDeletionDependencyInfo(null);

    // Run dependency check
    try {
      const deps = await checkStaffHistoricalDependencies(staff);
      setDeletionDependencyInfo({ checked: true, ...deps });
    } catch (err) {
      console.warn('Dependency check failed:', err);
      setDeletionDependencyInfo({
        checked: true,
        hasDependencies: true,
        paymentCount: 1,
        billCount: 0,
        auditCount: 1,
        summary: 'Cannot verify dependencies safely. Archival recommended.',
      });
    }
  };

  // Handle Confirm Permanent Delete
  const handleConfirmDelete = async () => {
    if (!deletingStaff) return;

    if (deletionDependencyInfo?.hasDependencies) {
      alert('Permanent deletion blocked due to existing historical financial records. Use Safe Deactivation/Archival.');
      return;
    }

    if (confirmDeleteInput.trim() !== deletingStaff.staffId && confirmDeleteInput.trim() !== deletingStaff.displayName) {
      alert(`Please type "${deletingStaff.staffId}" or "${deletingStaff.displayName}" to confirm deletion.`);
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteStaffUser(
        deletingStaff.uid,
        deletingStaff,
        currentUser?.email || BOOTSTRAP_ADMIN_EMAIL
      );

      setMessage({
        text: `Staff record ${deletingStaff.displayName} permanently deleted. Staff ID retired.`,
        isError: false,
      });
      setDeletingStaff(null);
      fetchUsers();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error deleting staff record');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Export Staff Register CSV
  const handleExportStaffCSV = () => {
    const headers = [
      'Staff ID',
      'Name',
      'Email',
      'Phone',
      'Address',
      'Role',
      'Designation',
      'Assigned Wards',
      'Account Status',
      'Date Registered',
      'Deactivated Reason',
    ];

    const rows = staffMembers.map((s) => [
      `"${s.staffId || '-'}"`,
      `"${s.displayName || '-'}"`,
      `"${s.email || '-'}"`,
      `"${s.phoneNumber || '-'}"`,
      `"${s.address || '-'}"`,
      `"${s.role}"`,
      `"${s.designation || '-'}"`,
      `"${(s.assignedWards || []).join(', ')}"`,
      `"${s.isActive !== false && s.accountStatus !== 'INACTIVE' ? 'ACTIVE' : 'INACTIVE'}"`,
      `"${s.createdAt ? s.createdAt.slice(0, 10) : '-'}"`,
      `"${s.deactivationReason || '-'}"`,
    ]);

    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `staff_register_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            <span>{lang === 'ne' ? 'कर्मचारी तथा अधिकार व्यवस्थापन (Staff & Permissions)' : 'Staff & Permissions Management'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'ne'
              ? 'मुख्य प्रशासकद्वारा कर्मचारी खाता सिर्जना, सम्पादन, सुरक्षित निष्क्रियता (Archival), पुनः सक्रियता र वडा कार्यक्षेत्र तोक्ने अधिकार।'
              : 'Main Admin control over employee registration, edits, safe deactivation/archival, reactivation, and assigned service areas.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportStaffCSV}
            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Download CSV Register"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Register</span>
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>{lang === 'ne' ? 'नयाँ कर्मचारी थप्नुहोस्' : 'Create Staff Account'}</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            message.isError
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
            <span className="font-medium">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang === 'ne' ? `सबै कर्मचारी (${users.length})` : `All Staff (${users.length})`}
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${
                statusFilter === 'ACTIVE' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>{lang === 'ne' ? `सक्रिय (${activeStaffCount})` : `Active (${activeStaffCount})`}</span>
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${
                statusFilter === 'INACTIVE' ? 'bg-slate-700 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>{lang === 'ne' ? `निष्क्रिय / सुरक्षित (${inactiveStaffCount})` : `Inactive / Archived (${inactiveStaffCount})`}</span>
            </button>
          </div>

          {/* Role Filter & Refresh */}
          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-700"
            >
              <option value="ALL">All Roles (सबै भूमिका)</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN (स्थायी मुख्य एडमिन)</option>
              <option value="ADMIN">ADMIN (अन्य प्रशासक)</option>
              <option value="BILLING_STAFF">BILLING_STAFF (काउन्टर क्यासियर)</option>
              <option value="AREA_STAFF">AREA_STAFF (फिल्ड रिडर)</option>
            </select>

            <button
              onClick={fetchUsers}
              className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl cursor-pointer"
              title="Refresh List"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search staff ID, full name, email, phone number, designation, or assigned ward..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Permanent Staff ID</th>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Contact & Location</th>
                <th className="py-3 px-4">Role & Privilege</th>
                <th className="py-3 px-4">Assigned Service Areas</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Date Added</th>
                <th className="py-3 px-4 text-right">Available Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                    {loading ? 'कर्मचारी विवरण लोड हुँदैछ...' : 'कुनै कर्मचारी खाता फेला परेन।'}
                  </td>
                </tr>
              ) : (
                staffMembers.map((s) => {
                  const isMainAdmin = s.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
                  const isActive = s.isActive !== false && s.accountStatus !== 'INACTIVE' && s.accountStatus !== 'SUSPENDED';

                  return (
                    <tr key={s.uid} className={`hover:bg-slate-50/80 transition-colors ${!isActive ? 'bg-slate-50/40 text-slate-500' : ''}`}>
                      {/* Staff ID */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {s.staffId || 'STF-001'}
                        </span>
                      </td>

                      {/* Name & Designation */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isMainAdmin
                              ? 'bg-purple-600 text-white'
                              : isActive
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {(s.displayName || 'S').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{s.displayName || 'Staff Member'}</span>
                              {isMainAdmin && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                                  Main Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">{s.designation || 'Water Supply Staff'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Location */}
                      <td className="py-3 px-4 text-slate-600">
                        <div className="font-mono text-[11px] text-slate-800">{s.email || '-'}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          {s.phoneNumber && <span>📞 {s.phoneNumber}</span>}
                          {s.address && <span>📍 {s.address}</span>}
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                            s.role === 'SUPER_ADMIN'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : s.role === 'ADMIN'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : s.role === 'BILLING_STAFF'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {s.role}
                        </span>
                      </td>

                      {/* Service Areas */}
                      <td className="py-3 px-4 text-slate-600">
                        {s.role === 'SUPER_ADMIN' ? (
                          <span className="text-[11px] font-semibold text-purple-900">All Wards (Super Admin)</span>
                        ) : s.role === 'ADMIN' ? (
                          <span className="text-[11px] font-semibold text-indigo-900">All Wards (Operations Admin)</span>
                        ) : s.assignedWards && s.assignedWards.length > 0 ? (
                          <span className="text-[11px] font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full">
                            Wards: {s.assignedWards.join(', ')}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                          <span>{isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                        </span>
                      </td>

                      {/* Date Added */}
                      <td className="py-3 px-4 text-center text-slate-500 text-[11px]">
                        {s.createdAt ? s.createdAt.slice(0, 10) : '-'}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details */}
                          <button
                            onClick={() => openDetailsModal(s)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                            title="View Staff Profile & Activity"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Staff Profile & Rights */}
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-sky-700 cursor-pointer"
                            title="Edit Staff Details & Permissions"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Deactivate or Reactivate */}
                          {!isMainAdmin && (
                            <>
                              {isActive ? (
                                <button
                                  onClick={() => openDeactivateModal(s)}
                                  className="px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                                  title="Safe Deactivation / Archival"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Deactivate</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => openReactivateModal(s)}
                                  className="px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                                  title="Reactivate Staff Account"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Reactivate</span>
                                </button>
                              )}

                              {/* Controlled Permanent Delete (Super Admin only, with historical dependency verification) */}
                              {isSuperAdmin && (
                                <button
                                  onClick={() => openDeleteModal(s)}
                                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="Permanently Delete Staff Record (Dependency Verified)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
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
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE STAFF ACCOUNT */}
      {/* ========================================================================= */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-purple-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                <span>{lang === 'ne' ? 'नयाँ आधिकारिक कर्मचारी खाता सिर्जना' : 'Create Authorized Staff Account'}</span>
              </h3>
              <button onClick={() => setIsAddStaffOpen(false)} className="p-1 text-purple-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-5 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Staff Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="e.g. Ramesh K. Sharma"
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Staff Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    placeholder="e.g. ramesh@committee.np"
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Phone Number</label>
                  <input
                    type="text"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designation / Title</label>
                  <input
                    type="text"
                    value={newStaffDesignation}
                    onChange={(e) => setNewStaffDesignation(e.target.value)}
                    placeholder="e.g. Area Meter Reader / Cashier"
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Residential Address / Tole</label>
                <input
                  type="text"
                  value={newStaffAddress}
                  onChange={(e) => setNewStaffAddress(e.target.value)}
                  placeholder="e.g. Ward No. 1, Bazar Tole"
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Role & Responsibility *</label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border rounded-xl bg-white font-medium"
                >
                  <option value="AREA_STAFF">AREA_STAFF — Restricted to Assigned Service Wards</option>
                  <option value="BILLING_STAFF">BILLING_STAFF — Counter Cashier & Invoicing</option>
                  <option value="ADMIN">ADMIN — Other Admin (दैनिक प्रशासन, ग्राहक, बिलिङ, वित्तीय मिलान)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {newStaffRole === 'ADMIN'
                    ? 'Note: Other Admin can manage daily consumers, bills, payments, and reconciliation, but is strictly blocked from Staff Management, Audit Logs, Security Testing, and System Settings.'
                    : newStaffRole === 'BILLING_STAFF'
                    ? 'Note: Billing Staff can collect payments at the cashier counter and generate monthly bills.'
                    : 'Note: Area Staff is restricted to assigned service wards for meter readings and consumer records.'}
                </p>
              </div>

              {newStaffRole === 'AREA_STAFF' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Service Wards</label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {wards.map((w) => {
                      const selected = newStaffWards.includes(w.wardNumber);
                      return (
                        <button
                          type="button"
                          key={w.id}
                          onClick={() => {
                            if (selected) {
                              setNewStaffWards(newStaffWards.filter((num) => num !== w.wardNumber));
                            } else {
                              setNewStaffWards([...newStaffWards, w.wardNumber]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            selected ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          Ward {w.wardNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Administrative Notes (Optional)</label>
                <textarea
                  value={newStaffNotes}
                  onChange={(e) => setNewStaffNotes(e.target.value)}
                  placeholder="Notes on employment contract, joining terms, or identification..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-4 py-2 border rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addStaffLoading}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {addStaffLoading ? 'Creating Account...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT STAFF DETAILS & PERMISSIONS */}
      {/* ========================================================================= */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-sky-800 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Edit className="w-4 h-4 text-sky-200" />
                <span>{lang === 'ne' ? 'कर्मचारी विवरण तथा अधिकार सम्पादन' : 'Edit Staff Profile & Permissions'}</span>
              </h3>
              <button onClick={() => setEditingStaff(null)} className="p-1 text-sky-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaffEdit} className="p-5 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
              {/* Identity snapshot */}
              <div className="p-3 bg-slate-50 border rounded-xl flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">PERMANENT STAFF ID</span>
                  <strong className="font-mono text-purple-900 text-sm">{editingStaff.staffId || 'STF-001'}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">AUTHENTICATED EMAIL</span>
                  <strong className="font-mono text-slate-800">{editingStaff.email}</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Phone Number</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Address / Tole</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>

              {/* Role selection: locked for permanent super admin, selectable for others */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role & Authorization Level</label>
                {editingStaff.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ? (
                  <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 font-bold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span>SUPER_ADMIN — Permanent Super Admin (hayutarkhanepani@gmail.com)</span>
                  </div>
                ) : (
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border rounded-xl bg-white font-medium"
                  >
                    <option value="AREA_STAFF">AREA_STAFF — Restricted to Assigned Wards</option>
                    <option value="BILLING_STAFF">BILLING_STAFF — Counter Cashier & Billing Access</option>
                    <option value="ADMIN">ADMIN — Other Admin (दैनिक प्रशासन, ग्राहक, बिलिङ, वित्तीय मिलान)</option>
                  </select>
                )}
                {editRole === 'ADMIN' && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Other Admin can operate daily consumers, bills, payments, and reconciliation, but is blocked from Staff Management, Audit Logs, Security Testing, and System Settings.
                  </p>
                )}
              </div>

              {editRole === 'AREA_STAFF' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Service Wards</label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {wards.map((w) => {
                      const selected = editWards.includes(w.wardNumber);
                      return (
                        <button
                          type="button"
                          key={w.id}
                          onClick={() => handleToggleEditWard(w.wardNumber)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                            selected ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          Ward {w.wardNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
                {editingStaff.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() ? (
                  <div className="text-slate-500 text-xs italic">
                    Permanent Super Admin account cannot be deactivated.
                  </div>
                ) : (
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as AccountStatus)}
                    className="w-full px-3 py-2 border rounded-xl bg-white font-medium"
                  >
                    <option value="ACTIVE">ACTIVE (Authorized system access)</option>
                    <option value="INACTIVE">INACTIVE (Safe deactivation / Archived)</option>
                    <option value="SUSPENDED">SUSPENDED (Temporarily restricted)</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Update (Audit Trail) *</label>
                <input
                  type="text"
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. वडा सरुवा, पदोन्नति, फोन नम्बर अद्यावधिक"
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 border rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SAFE DEACTIVATE / REMOVE CONFIRMATION */}
      {/* ========================================================================= */}
      {deactivatingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-rose-700 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <UserX className="w-5 h-5 text-rose-200" />
                <span>{lang === 'ne' ? 'कर्मचारी खाता सुरक्षित निष्क्रियता (Safe Deactivation)' : 'Deactivate Staff Account'}</span>
              </h3>
              <button onClick={() => setDeactivatingStaff(null)} className="p-1 text-rose-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeactivate} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-slate-800">
                <div>
                  Staff Name: <strong className="text-rose-950 font-bold">{deactivatingStaff.displayName}</strong>
                </div>
                <div>
                  Staff ID: <strong className="font-mono text-purple-900">{deactivatingStaff.staffId || 'STF-001'}</strong>
                </div>
                <div>
                  Role: <strong>{deactivatingStaff.role}</strong> ({deactivatingStaff.email})
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 leading-relaxed text-[11px]">
                <strong className="text-slate-800 block mb-0.5">💡 सुरक्षित निष्क्रियता नीति (Safe Archival Policy):</strong>
                यस कर्मचारीको लगइन र प्रशासनिक अधिकार तुरुन्त बन्द हुनेछ। तर उहाँद्वारा विगतमा जारी गरिएका बिल, काउन्टर महसुल रसिद, भुक्तानी र अडिट लगहरू वित्तीय तथा कानुनी जवाफदेहिताका लागि पूर्ण सुरक्षित रहनेछन्।
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  निष्क्रिय गर्नुको कारण (Reason for Deactivation) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  placeholder="e.g. कार्यकाल समाप्त, अन्यत्र सरुवा, राजीनामा स्वीकृत, वा जिम्मेवारी हेरफेर..."
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeactivatingStaff(null)}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-700"
                >
                  रद्द गर्नुहोस् (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={deactivateLoading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {deactivateLoading ? 'Deactivating...' : 'निष्क्रिय गर्नुहोस् (Confirm Deactivation)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: REACTIVATE STAFF CONFIRMATION */}
      {/* ========================================================================= */}
      {reactivatingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-emerald-700 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-200" />
                <span>{lang === 'ne' ? 'कर्मचारी खाता पुनः सक्रियता (Reactivate Account)' : 'Reactivate Staff Account'}</span>
              </h3>
              <button onClick={() => setReactivatingStaff(null)} className="p-1 text-emerald-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReactivate} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-slate-800">
                <div>
                  Staff Name: <strong className="text-emerald-950 font-bold">{reactivatingStaff.displayName}</strong>
                </div>
                <div>
                  Staff ID: <strong className="font-mono text-purple-900">{reactivatingStaff.staffId || 'STF-001'}</strong>
                </div>
                <div>
                  Restored Role: <strong className="text-emerald-800 font-bold">{reactivatingStaff.role}</strong>
                </div>
              </div>

              <p className="text-slate-600 text-xs leading-relaxed">
                खाता पुनः सक्रिय गर्दा यस कर्मचारीले आफ्नो पूर्व-निर्धारित भूमिका (<strong>{reactivatingStaff.role}</strong>) अनुसारको प्रणाली पहुँच प्राप्त गर्नेछन्। यसले स्वतः सुपर एडमिन अधिकार दिनेछैन।
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  पुनः सक्रियताको टिप्पणी (Optional Notes / Reason)
                </label>
                <input
                  type="text"
                  value={reactivateReason}
                  onChange={(e) => setReactivateReason(e.target.value)}
                  placeholder="e.g. जिम्मेवारी पुनः बहाली, नयाँ सम्झौता नवीकरण..."
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReactivatingStaff(null)}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reactivateLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {reactivateLoading ? 'Reactivating...' : 'पुनः सक्रिय गर्नुहोस् (Reactivate)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: STAFF DETAILS & AUDIT TRAIL MODAL */}
      {/* ========================================================================= */}
      {viewingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-sm">
                  {(viewingStaff.displayName || 'S').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <span>{viewingStaff.displayName}</span>
                    <span className="text-xs font-mono bg-purple-900/60 text-purple-200 px-2 py-0.5 rounded border border-purple-700">
                      {viewingStaff.staffId || 'STF-001'}
                    </span>
                  </h3>
                  <div className="text-xs text-slate-400">{viewingStaff.designation || 'Water Supply Committee Staff'}</div>
                </div>
              </div>
              <button onClick={() => setViewingStaff(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
              {/* Key metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Assigned Role</span>
                  <span className="text-xs font-bold text-purple-900 mt-0.5 block">{viewingStaff.role}</span>
                </div>
                <div className="p-3 bg-slate-50 border rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                  <span className={`text-xs font-bold mt-0.5 block ${viewingStaff.isActive !== false ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {viewingStaff.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Registered Date</span>
                  <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
                    {viewingStaff.createdAt ? viewingStaff.createdAt.slice(0, 10) : '-'}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Service Wards</span>
                  <span className="text-xs font-semibold text-sky-800 mt-0.5 block">
                    {viewingStaff.role === 'SUPER_ADMIN' || viewingStaff.role === 'ADMIN'
                      ? 'All Wards'
                      : (viewingStaff.assignedWards || []).length > 0
                      ? `Ward ${(viewingStaff.assignedWards || []).join(', ')}`
                      : 'Unassigned'}
                  </span>
                </div>
              </div>

              {/* Contact info card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>Contact & Administrative Notes</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div><strong>Email:</strong> <span className="font-mono">{viewingStaff.email}</span></div>
                  <div><strong>Phone:</strong> {viewingStaff.phoneNumber || '-'}</div>
                  <div><strong>Address:</strong> {viewingStaff.address || '-'}</div>
                  <div><strong>Notes:</strong> {viewingStaff.notes || 'None recorded'}</div>
                </div>

                {viewingStaff.deactivationReason && (
                  <div className="pt-2 border-t border-slate-200 text-rose-800 text-[11px]">
                    <strong>Deactivation Notice:</strong> {viewingStaff.deactivationReason} ({viewingStaff.deactivatedAt?.slice(0, 10)}) by {viewingStaff.deactivatedBy}
                  </div>
                )}
              </div>

              {/* Audit Activity Section */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <History className="w-4 h-4 text-purple-600" />
                    <span>Recent Audit Events for this Staff Member ({staffAuditLogs.length})</span>
                  </div>
                </h4>

                {loadingAuditLogs ? (
                  <div className="py-6 text-center text-slate-400 text-xs">Loading audit trail...</div>
                ) : staffAuditLogs.length === 0 ? (
                  <div className="py-4 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl border">
                    No recent audit events recorded for this staff ID.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {staffAuditLogs.map((log) => (
                      <div key={log.id} className="p-3 text-[11px] bg-white hover:bg-slate-50">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-purple-900 font-mono">{log.action}</span>
                          <span className="text-[10px] text-slate-400">{log.timestamp ? log.timestamp.slice(0, 16).replace('T', ' ') : ''}</span>
                        </div>
                        <p className="text-slate-600 mt-0.5">{log.details}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setViewingStaff(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CONTROLLED PERMANENT DELETION (DEPENDENCY VERIFIED) */}
      {/* ========================================================================= */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="bg-rose-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-300" />
                <span>{lang === 'ne' ? 'कर्मचारी रेकर्ड स्थायी मेटाउने' : 'Permanently Delete Staff Record'}</span>
              </h3>
              <button onClick={() => setDeletingStaff(null)} className="p-1 text-rose-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border rounded-xl space-y-1">
                <div>Name: <strong className="text-slate-900">{deletingStaff.displayName}</strong></div>
                <div>Staff ID: <strong className="font-mono text-purple-900">{deletingStaff.staffId || 'STF-001'}</strong></div>
                <div>Email: <strong className="font-mono">{deletingStaff.email}</strong></div>
              </div>

              {/* Dependency Status */}
              {!deletionDependencyInfo ? (
                <div className="py-4 text-center text-slate-500">Checking historical financial transactions...</div>
              ) : deletionDependencyInfo.hasDependencies ? (
                <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-2 text-rose-900">
                  <div className="font-bold flex items-center gap-1.5 text-xs text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>स्थायी मेटाउन निषेध (Permanent Deletion Blocked)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    यस कर्मचारीका नाममा <strong>{deletionDependencyInfo.paymentCount} वटा भुक्तानी रसिद</strong>, <strong>{deletionDependencyInfo.billCount} वटा बिल</strong> र <strong>{deletionDependencyInfo.auditCount} वटा अडिट लग</strong> दर्ता छन्।
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-700">
                    कानुनी तथा वित्तीय लेखापरीक्षण (Statutory Financial Audit) का लागि कारोबार भइसकेका कर्मचारीलाई स्थायी रूपमा मेटाउन मिल्दैन। कृपया 'सुरक्षित निष्क्रियता (Safe Deactivation)' मात्र प्रयोग गर्नुहोस्।
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const target = deletingStaff;
                        setDeletingStaff(null);
                        openDeactivateModal(target);
                      }}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs"
                    >
                      सुरक्षित निष्क्रिय गर्नुहोस् (Switch to Safe Deactivate)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-[11px]">
                    ✓ No historical payments or bills linked to this test account. Permanent deletion is safe. Staff ID will be permanently retired.
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Type "{deletingStaff.staffId}" to confirm permanent deletion:
                    </label>
                    <input
                      type="text"
                      value={confirmDeleteInput}
                      onChange={(e) => setConfirmDeleteInput(e.target.value)}
                      placeholder={deletingStaff.staffId || ''}
                      className="w-full px-3 py-2 border rounded-xl font-mono text-center"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setDeletingStaff(null)}
                      className="px-4 py-2 border rounded-xl font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleteLoading || (confirmDeleteInput.trim() !== deletingStaff.staffId && confirmDeleteInput.trim() !== deletingStaff.displayName)}
                      onClick={handleConfirmDelete}
                      className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl disabled:opacity-50"
                    >
                      {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
