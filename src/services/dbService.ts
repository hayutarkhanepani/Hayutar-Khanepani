import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import {
  Household,
  ConsumerCategory,
  Tariff,
  Bill,
  Payment,
  Voucher,
  CommitteeSettings,
  BillTemplateSettings,
  ReceiptTemplateSettings,
  DateTimeSettings,
  ConsumerRegistrationRequest,
  AuditLog,
  UserProfile,
  WardInfo,
  UserRole,
  BillStatus,
  StaffCashHandover,
  HandoverStatus,
} from '../types';
import {
  reconcileCustomerLedgerInMem,
  getPeriodScore,
  calculateBillPeriodicCharge,
} from '../utils/billingLedger';
import { DEFAULT_DATETIME_SETTINGS } from '../utils/nepaliCalendar';

export const BOOTSTRAP_ADMIN_EMAIL = 'hayutarkhanepani@gmail.com';

export const DEFAULT_RECEIPT_TEMPLATE: ReceiptTemplateSettings = {
  receiptTitleNepali: 'नगद / महसुल भुक्तानी आधिकारिक रसिद',
  receiptTitleEnglish: 'Official Payment Receipt',
  waterProjectNameNepali: 'श्री हायुटार बृहत् खानेपानी तथा सरसफाइ उपभोक्ता समिति',
  headerAddressNepali: 'वडा कार्यालय परिसर, हायुटार, नेपाल',
  phone: '+977-01-5544332 / 9851000000',
  panNumber: '602498712',
  registrationNumber: 'WSSDO-NP-2065/04',
  showLogo: true,
  logoUrl: '',
  showQrCode: true,
  paperLayout: 'DUAL_A4', // Dual A4 = Office Copy + Customer Copy on one sheet
  officeCopyLabelNepali: 'कार्यालय प्रति (OFFICE COPY)',
  customerCopyLabelNepali: 'ग्राहक प्रति (CUSTOMER COPY)',
  showCutLine: true,
  receiptNotice: 'यो कम्प्युटर प्रणालीबाट जारी गरिएको आधिकारिक भुक्तानी रसिद हो। कृपया यो रसिद सुरक्षित राख्नुहोला।',
  termsAndConditions: 'समयमै महसुल बुझाई जरिवानाबाट बचौं। आगामी महिनाको २० गतेभित्र बुझाएमा ५% छुट प्राप्त हुनेछ।',
  cashierTitleNepali: 'रकम बुझिलिने (क्यासियर)',
  accountantTitleNepali: 'लेखापाल / काउन्टर प्रमुख',
  chairpersonTitleNepali: 'अध्यक्ष / संयोजक',
  showSignatures: true,
  showSealSpace: true,
  showPreviousDueBreakdown: true,
  showAdvanceBalance: true,
  density: 'compact',
  borderStyle: 'solid',
};

export const DEFAULT_BILL_TEMPLATE: BillTemplateSettings = {
  headerTitleNepali: 'मासिक खानेपानी महसुल बिल',
  headerTitleEnglish: 'Monthly Water Consumption Bill',
  tagline: 'शुद्ध पिउने पानी, स्वस्थ जिन्दगी',
  showLogo: true,
  logoUrl: '',
  showQrCode: true,
  paperSize: 'A4',
  termsAndConditions: 'तोकिएको मितिभित्र कार्यालय काउन्टरमा महसुल बुझाउनुहोला। समय कटेपछि नियमानुसार जरिवाना लाग्नेछ।',
  preparedByTitle: 'तयार गर्ने कर्मचारी (बिलिङ)',
  approvedByTitle: 'अध्यक्ष / कोषाध्यक्ष',
  accountantTitle: 'लेखापाल / काउन्टर कर्मचारी',
  showSignatures: true,
  showSealSpace: true,
  receiptTitleNepali: 'आधिकारिक भुक्तानी रसिद',
  receiptTitleEnglish: 'Official Payment Receipt',
  receiptNotice: 'यो कम्प्युटर प्रणालीबाट जारी गरिएको आधिकारिक भुक्तानी रसिद हो।',
  receiptCashierTitle: 'बुझिलिने कर्मचारी (क्यासियर)',
};

// ----------------------------------------------------------------------
// Committee Settings (No Hardcoded Bank or Payment Gateways)
// ----------------------------------------------------------------------
export const DEFAULT_SETTINGS: CommitteeSettings = {
  id: 'general',
  committeeName: 'Hayutar Drinking Water & Sanitation Consumer Committee',
  committeeNameNepali: 'श्री हायुटार खानेपानी तथा सरसफाइ उपभोक्ता समिति',
  registrationNumber: 'WSSDO-NP-2065/04',
  panNumber: '602498712',
  address: 'वडा कार्यालय परिसर, हायुटार, नेपाल',
  phone: '+977-01-5544332 / 9851000000',
  email: 'hayutarkhanepani@gmail.com',
  currentFiscalYear: '2081/82',
  counterOpeningTime: '१०:०० बिहान (10:00 AM)',
  counterClosingTime: '०४:०० दिउँसो (4:00 PM)',
  counterWorkingDays: 'आइतबार देखि शुक्रबार (सार्वजनिक बिदा बाहेक)',
  publicNotice: 'सूचना: प्रत्येक महिनाको २० गतेभित्र खानेपानी महसुल बुझाई ५% जरिवानाबाट बच्नुहोस्। काउन्टर बिहान १०:०० देखि दिउँसो ४:०० सम्म खुला रहनेछ।',
  publicNoticeActive: true,
  publicNoticeType: 'info',
  tagline: 'शुद्ध पिउने पानी, स्वस्थ जिन्दगी',
  logoUrl: '',
  billTemplate: DEFAULT_BILL_TEMPLATE,
  receiptTemplate: DEFAULT_RECEIPT_TEMPLATE,
  dateTimeSettings: DEFAULT_DATETIME_SETTINGS,
  standardMonthlyCharge: 150, // Standard fixed monthly household charge (NPR 150)
  effectiveStartDate: '2081-01-01',
  billingDueDayOfMonth: 20, // 20th of the month
  latePenaltyDays: 20,
  latePenaltyPercentage: 5, // 5% after due date
  earlyDiscountDays: 7,
  earlyDiscountPercentage: 2, // 2% early discount
  sanitationFee: 20,
  maintenanceFee: 10,
  inactiveHouseholdCharge: 0, // Inactive households waived by default
  allowPartialPayments: true,
  // Payment Gateways & Bank details are strictly DISABLED by default until configured by Main Admin
  onlineGatewaysActive: false,
  bankVouchersActive: false,
  bankName: '',
  bankAccountNumber: '',
  bankBranch: '',
  bankAccountHolder: '',
  esewaMerchantCode: '',
  khaltiPublicKey: '',
  connectIpsMerchantId: '',
  gatewaysEnabled: {
    esewa: false,
    khalti: false,
    connectIps: false,
  },
};

export async function getCommitteeSettings(): Promise<CommitteeSettings> {
  const path = 'committeeSettings/general';
  try {
    const docRef = doc(db, 'committeeSettings', 'general');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        ...DEFAULT_SETTINGS,
        ...data,
        billTemplate: {
          ...DEFAULT_BILL_TEMPLATE,
          ...(data.billTemplate || {}),
        },
        receiptTemplate: {
          ...DEFAULT_RECEIPT_TEMPLATE,
          ...(data.receiptTemplate || {}),
        },
        dateTimeSettings: {
          ...DEFAULT_DATETIME_SETTINGS,
          ...(data.dateTimeSettings || {}),
        },
      } as CommitteeSettings;
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function updateCommitteeSettings(settings: CommitteeSettings): Promise<void> {
  const path = 'committeeSettings/general';
  try {
    const docRef = doc(db, 'committeeSettings', 'general');
    await setDoc(docRef, removeUndefined({ ...settings, updatedAt: new Date().toISOString() }), { merge: true });
    await createAuditLog('UPDATE_SETTINGS', 'CommitteeSettings', 'general', 'Updated committee information, fixed tariffs, and settings');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ----------------------------------------------------------------------
// Consumer Categories Management
// ----------------------------------------------------------------------
export const INITIAL_CATEGORIES: ConsumerCategory[] = [
  {
    id: 'cat-residential',
    code: 'RESIDENTIAL',
    name: 'Residential',
    nameNepali: 'घरेलु / आवासीय',
    standardMonthlyCharge: 150,
    latePenaltyPercentage: 5,
    earlyDiscountPercentage: 2,
    sanitationFee: 20,
    maintenanceFee: 10,
    description: 'Standard residential domestic household connection',
    isActive: true,
  },
  {
    id: 'cat-commercial',
    code: 'COMMERCIAL',
    name: 'Commercial',
    nameNepali: 'व्यापारिक तथा होटल',
    standardMonthlyCharge: 350,
    latePenaltyPercentage: 10,
    earlyDiscountPercentage: 2,
    sanitationFee: 50,
    maintenanceFee: 20,
    description: 'Shops, hotels, eateries, and commercial workshops',
    isActive: true,
  },
  {
    id: 'cat-institutional',
    code: 'INSTITUTIONAL',
    name: 'Institutional',
    nameNepali: 'संस्थागत तथा विद्यालय',
    standardMonthlyCharge: 250,
    latePenaltyPercentage: 5,
    earlyDiscountPercentage: 5,
    sanitationFee: 30,
    maintenanceFee: 15,
    description: 'Schools, NGOs, health clinics, and community buildings',
    isActive: true,
  },
  {
    id: 'cat-government',
    code: 'GOVERNMENT',
    name: 'Government / Public Office',
    nameNepali: 'सरकारी / सार्वजनिक कार्यालय',
    standardMonthlyCharge: 300,
    latePenaltyPercentage: 5,
    earlyDiscountPercentage: 0,
    sanitationFee: 40,
    maintenanceFee: 20,
    description: 'Ward offices, police stations, and government post offices',
    isActive: true,
  },
  {
    id: 'cat-other',
    code: 'OTHER',
    name: 'Other',
    nameNepali: 'अन्य विशेष उपभोक्ता',
    standardMonthlyCharge: 200,
    latePenaltyPercentage: 5,
    earlyDiscountPercentage: 2,
    sanitationFee: 25,
    maintenanceFee: 10,
    description: 'Custom community groups and other designated connections',
    isActive: true,
  },
];

export async function getConsumerCategories(): Promise<ConsumerCategory[]> {
  const path = 'consumerCategories';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      return INITIAL_CATEGORIES;
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ConsumerCategory));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveConsumerCategory(category: ConsumerCategory): Promise<void> {
  const path = `consumerCategories/${category.id}`;
  try {
    const docRef = doc(db, 'consumerCategories', category.id);
    await setDoc(docRef, removeUndefined({ ...category, updatedAt: new Date().toISOString() }), { merge: true });
    await createAuditLog('SAVE_CATEGORY', 'ConsumerCategory', category.id, `Saved category ${category.name} (${category.nameNepali})`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteConsumerCategory(categoryId: string): Promise<void> {
  const path = `consumerCategories/${categoryId}`;
  try {
    await deleteDoc(doc(db, 'consumerCategories', categoryId));
    await createAuditLog('DELETE_CATEGORY', 'ConsumerCategory', categoryId, `Deleted category ${categoryId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ----------------------------------------------------------------------
// Wards and Toles Management
// ----------------------------------------------------------------------
export const INITIAL_WARDS: WardInfo[] = [
  {
    id: 'ward-1',
    wardNumber: '1',
    name: 'वडा नं १ (Ward 1 - Bazar & Dharapani)',
    toles: ['बजार टोल (Bazar Tole)', 'धारापानी (Dharapani)', 'मुलबस्ती (Mul Basti)'],
  },
  {
    id: 'ward-2',
    wardNumber: '2',
    name: 'वडा नं २ (Ward 2 - Danda Gaun & Chautara)',
    toles: ['डाँडा गाउँ (Danda Gaun)', 'चौतारा (Chautara)', 'पीपलडाँडा (Pipal Danda)'],
  },
  {
    id: 'ward-3',
    wardNumber: '3',
    name: 'वडा नं ३ (Ward 3 - School Danda & Office Area)',
    toles: ['स्कुल डाँडा (School Danda)', 'कार्यालय परिसर (Office Area)', 'काफलडाँडा (Kafal Danda)'],
  },
  {
    id: 'ward-4',
    wardNumber: '4',
    name: 'वडा नं ४ (Ward 4 - Kholsi & Phedi)',
    toles: ['खोल्सी टोल (Kholsi Tole)', 'फेदी (Phedi)'],
  },
  {
    id: 'ward-5',
    wardNumber: '5',
    name: 'वडा नं ५ (Ward 5 - Upallo Gaun)',
    toles: ['उपल्लो गाउँ (Upallo Gaun)', 'सिमसार (Simsar)'],
  },
];

export async function getWards(): Promise<WardInfo[]> {
  const path = 'wards';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      return INITIAL_WARDS;
    }
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as WardInfo))
      .sort((a, b) => Number(a.wardNumber) - Number(b.wardNumber));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveWard(ward: WardInfo): Promise<void> {
  const path = `wards/${ward.id}`;
  try {
    await setDoc(doc(db, 'wards', ward.id), removeUndefined({ ...ward, updatedAt: new Date().toISOString() }), { merge: true });
    await createAuditLog('SAVE_WARD', 'Ward', ward.id, `Saved ward ${ward.wardNumber} with toles: ${ward.toles.join(', ')}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteWard(wardId: string): Promise<void> {
  const path = `wards/${wardId}`;
  try {
    await deleteDoc(doc(db, 'wards', wardId));
    await createAuditLog('DELETE_WARD', 'Ward', wardId, `Deleted ward record ${wardId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ----------------------------------------------------------------------
// Tariffs
// ----------------------------------------------------------------------
export const INITIAL_TARIFFS: Tariff[] = [
  {
    id: 'tariff-domestic',
    name: 'Standard Domestic (घरायसी)',
    nameNepali: 'साधारण घरायसी धारा',
    category: 'DOMESTIC',
    standardMonthlyCharge: 150, // Fixed monthly charge of NPR 150
    sanitationFee: 20,
    maintenanceFee: 10,
    latePenaltyPercentage: 5,
    earlyDiscountPercentage: 2,
    effectiveStartDate: '2081-01-01',
    inactiveHouseholdCharge: 0,
    active: true,
  },
  {
    id: 'tariff-commercial',
    name: 'Commercial / Hotel (व्यापारिक)',
    nameNepali: 'व्यापारिक तथा होटल धारा',
    category: 'COMMERCIAL',
    standardMonthlyCharge: 350,
    sanitationFee: 50,
    maintenanceFee: 20,
    latePenaltyPercentage: 10,
    earlyDiscountPercentage: 2,
    effectiveStartDate: '2081-01-01',
    inactiveHouseholdCharge: 50,
    active: true,
  },
  {
    id: 'tariff-institutional',
    name: 'Institutional / School (संस्थागत)',
    nameNepali: 'संस्थागत तथा विद्यालय धारा',
    category: 'INSTITUTIONAL',
    standardMonthlyCharge: 250,
    sanitationFee: 30,
    maintenanceFee: 15,
    latePenaltyPercentage: 5,
    earlyDiscountPercentage: 5,
    effectiveStartDate: '2081-01-01',
    inactiveHouseholdCharge: 0,
    active: true,
  },
];

export async function getTariffs(): Promise<Tariff[]> {
  const path = 'tariffs';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      return INITIAL_TARIFFS;
    }
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tariff));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveTariff(tariff: Tariff): Promise<void> {
  const path = `tariffs/${tariff.id}`;
  try {
    const docRef = doc(db, 'tariffs', tariff.id);
    await setDoc(docRef, removeUndefined({ ...tariff, updatedAt: new Date().toISOString() }), { merge: true });
    await createAuditLog('SAVE_TARIFF', 'Tariff', tariff.id, `Saved tariff ${tariff.name} (Monthly: NPR ${tariff.standardMonthlyCharge})`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ----------------------------------------------------------------------
// Audit Logging
// ----------------------------------------------------------------------
export async function createAuditLog(action: string, entityType: string, entityId: string, details: string): Promise<void> {
  const path = 'auditLogs';
  try {
    const logId = `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const logDoc = doc(db, 'auditLogs', logId);
    const logData: AuditLog = {
      id: logId,
      action,
      entityType,
      entityId,
      performedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'System Admin',
      userEmail: auth.currentUser?.email || 'system@committee.np',
      details,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await setDoc(logDoc, logData);
  } catch (err) {
    console.warn('Failed to record audit log:', err);
  }
}

export async function getAuditLogs(maxCount = 150): Promise<AuditLog[]> {
  const path = 'auditLogs';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ----------------------------------------------------------------------
// Consumer Register & Households Management
// ----------------------------------------------------------------------

/**
 * Generate a unique, permanent customer code (e.g. HYT-00101, HYT-00102).
 * Scans all existing records and guarantees the sequence never reuses an ID,
 * even if a consumer is deleted or deactivated.
 */
export function generateUniquePermanentCustomerCode(existingHouseholds: Household[]): string {
  let highestNum = 100;
  existingHouseholds.forEach((h) => {
    if (!h.customerCode) return;
    const match = h.customerCode.match(/HYT-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > highestNum) {
        highestNum = num;
      }
    }
  });

  const nextNum = highestNum + 1;
  const padded = nextNum.toString().padStart(5, '0');
  return `HYT-${padded}`;
}

/**
 * Detect consumers with identical or near-identical names (Unicode normalized,
 * trimmed) and flag them for Main Admin review without merging.
 */
export function detectDuplicateNames(households: Household[]): Map<string, Household[]> {
  const nameMap = new Map<string, Household[]>();

  households.forEach((h) => {
    if (!h.ownerName) return;
    // Normalize Unicode and trim
    const normalized = h.ownerName.trim().normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
    const existing = nameMap.get(normalized) || [];
    existing.push(h);
    nameMap.set(normalized, existing);
  });

  // Filter to keep only those with 2 or more consumers
  const duplicates = new Map<string, Household[]>();
  nameMap.forEach((list, key) => {
    if (list.length > 1) {
      duplicates.set(key, list);
    }
  });

  return duplicates;
}

export async function getHouseholds(): Promise<Household[]> {
  const path = 'households';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Household));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getHouseholdById(id: string): Promise<Household | null> {
  const path = `households/${id}`;
  try {
    const snap = await getDoc(doc(db, 'households', id));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Household;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getHouseholdByCustomerCode(code: string): Promise<Household | null> {
  const path = 'households';
  try {
    const q = query(collection(db, path), where('customerCode', '==', code.trim().toUpperCase()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as Household;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Recursively strips any keys with `undefined` values from an object or array.
 * Firebase Firestore setDoc/updateDoc/addDoc throws an error if any field is undefined.
 */
export function removeUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      clean[key] = removeUndefined(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Normalizes household data before saving or updating in Firestore:
 * - Email is optional: trims string or saves empty string '', never undefined.
 * - Optional text fields (connectionNumber, tole, address, phoneNumber): trims or saves empty string ''.
 * - Protects financial values: validates types and avoids zeroing out existing balances.
 * - Guarantees no field in the resulting payload is undefined.
 */
export function normalizeHouseholdForFirestore(
  household: Partial<Household> | Household,
  isUpdate: boolean = false
): Record<string, any> {
  const data: Record<string, any> = {};

  if (household.id) {
    data.id = String(household.id).trim();
  }

  if (household.customerCode !== undefined) {
    data.customerCode = household.customerCode ? String(household.customerCode).trim().toUpperCase() : '';
  }

  if (household.householdNumber !== undefined) {
    data.householdNumber = household.householdNumber ? String(household.householdNumber).trim() : '';
  }

  if (household.ownerName !== undefined) {
    data.ownerName = household.ownerName ? String(household.ownerName).trim() : '';
  }

  if (household.ward !== undefined) {
    data.ward = String(household.ward).trim();
  } else if (!isUpdate) {
    data.ward = '1';
  }

  if (household.tole !== undefined) {
    data.tole = household.tole ? String(household.tole).trim() : '';
  } else if (!isUpdate) {
    data.tole = '';
  }

  if (household.address !== undefined) {
    data.address = household.address ? String(household.address).trim() : '';
  } else if (!isUpdate) {
    data.address = '';
  }

  if (household.phoneNumber !== undefined) {
    data.phoneNumber = household.phoneNumber ? String(household.phoneNumber).trim() : '';
  } else if (!isUpdate) {
    data.phoneNumber = '';
  }

  // Email: optional field. Never undefined.
  if (household.email !== undefined) {
    data.email = typeof household.email === 'string' ? household.email.trim() : '';
  } else if (!isUpdate) {
    data.email = '';
  }

  // Category
  if (household.category !== undefined) {
    data.category = household.category && String(household.category).trim() ? String(household.category).trim() : 'Residential';
  } else if (!isUpdate) {
    data.category = 'Residential';
  }

  // Connection Number (Optional)
  if (household.connectionNumber !== undefined) {
    data.connectionNumber = household.connectionNumber ? String(household.connectionNumber).trim() : '';
  } else if (!isUpdate) {
    data.connectionNumber = '';
  }

  // Meter Number
  if (household.meterNumber !== undefined) {
    data.meterNumber = household.meterNumber ? String(household.meterNumber).trim() : (data.customerCode ? `M-${data.customerCode}` : '');
  } else if (!isUpdate) {
    data.meterNumber = data.customerCode ? `M-${data.customerCode}` : '';
  }

  // Status
  if (household.status !== undefined) {
    data.status = household.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  } else if (!isUpdate) {
    data.status = 'ACTIVE';
  }

  // Financial fields: validate numbers; do not zero out without validation
  if (household.monthlyFixedCharge !== undefined && household.monthlyFixedCharge !== null) {
    const charge = Number(household.monthlyFixedCharge);
    data.monthlyFixedCharge = !isNaN(charge) && charge >= 0 ? charge : 150;
  } else if (!isUpdate) {
    data.monthlyFixedCharge = 150;
  }

  if (household.openingBalance !== undefined && household.openingBalance !== null) {
    const opening = Number(household.openingBalance);
    data.openingBalance = !isNaN(opening) ? opening : 0;
  } else if (!isUpdate) {
    data.openingBalance = 0;
  }

  if (household.currentBalance !== undefined && household.currentBalance !== null) {
    const current = Number(household.currentBalance);
    data.currentBalance = !isNaN(current) ? current : (data.openingBalance ?? 0);
  } else if (!isUpdate) {
    data.currentBalance = data.openingBalance ?? 0;
  }

  if (household.lastMeterReading !== undefined && household.lastMeterReading !== null) {
    const reading = Number(household.lastMeterReading);
    if (!isNaN(reading)) {
      data.lastMeterReading = reading;
    }
  }

  // Dates
  if (household.registrationDate !== undefined) {
    data.registrationDate = household.registrationDate || '2081-01-01';
  } else if (!isUpdate) {
    data.registrationDate = '2081-01-01';
  }

  if (household.connectionDate !== undefined) {
    data.connectionDate = household.connectionDate || data.registrationDate || '2081-01-01';
  } else if (!isUpdate) {
    data.connectionDate = data.registrationDate || '2081-01-01';
  }

  if (household.tariffId !== undefined) {
    data.tariffId = household.tariffId || 'tariff-domestic';
  } else if (!isUpdate) {
    data.tariffId = 'tariff-domestic';
  }

  // Linked Auth UID
  if (household.userId !== undefined && household.userId) {
    data.userId = String(household.userId).trim();
  }

  // Verification & Review Flags
  if (household.needsVerification !== undefined) {
    data.needsVerification = Boolean(household.needsVerification);
  }

  if (household.verificationReason !== undefined) {
    data.verificationReason = household.verificationReason ? String(household.verificationReason).trim() : '';
  }

  if (household.duplicateNameFlag !== undefined) {
    data.duplicateNameFlag = Boolean(household.duplicateNameFlag);
  }

  if (household.cardPrintedAt !== undefined && household.cardPrintedAt) {
    data.cardPrintedAt = String(household.cardPrintedAt).trim();
  }

  // Timestamps
  if (household.createdAt) {
    data.createdAt = household.createdAt;
  } else if (!isUpdate) {
    data.createdAt = new Date().toISOString();
  }

  data.updatedAt = new Date().toISOString();

  return removeUndefined(data);
}

export async function saveHousehold(household: Household): Promise<void> {
  if (!household.id) {
    throw new Error('Cannot save household without an ID');
  }
  const path = `households/${household.id}`;
  try {
    const isNew = !household.createdAt;
    const normalizedData = normalizeHouseholdForFirestore(household, !isNew);
    const safePayload = removeUndefined(normalizedData);

    await setDoc(doc(db, 'households', household.id), safePayload, { merge: true });

    await createAuditLog(
      isNew ? 'CREATE_CONSUMER' : 'UPDATE_CONSUMER',
      'Household',
      household.id,
      `${isNew ? 'Created new' : 'Updated'} consumer ${safePayload.customerCode || household.customerCode} (${safePayload.ownerName || household.ownerName}, Category: ${safePayload.category || 'Residential'}, Ward: ${safePayload.ward || '1'})`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateHousehold(
  householdId: string,
  updates: Partial<Household>,
  auditReason?: string
): Promise<void> {
  const path = `households/${householdId}`;
  try {
    const normalizedData = normalizeHouseholdForFirestore(updates, true);
    // Remove doc id from updateDoc payload
    delete normalizedData.id;
    normalizedData.updatedAt = new Date().toISOString();

    const safePayload = removeUndefined(normalizedData);
    await updateDoc(doc(db, 'households', householdId), safePayload);

    await createAuditLog(
      'UPDATE_CONSUMER',
      'Household',
      householdId,
      auditReason || `Updated consumer record ${householdId}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Check if a household can be deleted safely or if financial retention rules apply.
 */
export async function canDeleteHousehold(householdCustomerCode: string): Promise<{
  canDelete: boolean;
  reason?: string;
  billsCount: number;
  paymentsCount: number;
}> {
  try {
    const billsQ = query(collection(db, 'bills'), where('customerId', '==', householdCustomerCode));
    const billsSnap = await getDocs(billsQ);

    const paymentsQ = query(collection(db, 'payments'), where('customerId', '==', householdCustomerCode));
    const paymentsSnap = await getDocs(paymentsQ);

    const billsCount = billsSnap.size;
    const paymentsCount = paymentsSnap.size;

    if (billsCount > 0 || paymentsCount > 0) {
      return {
        canDelete: false,
        reason: `Financial records exist (${billsCount} bills, ${paymentsCount} payments). For accounting integrity, deactivation is required instead of hard deletion.`,
        billsCount,
        paymentsCount,
      };
    }

    return { canDelete: true, billsCount: 0, paymentsCount: 0 };
  } catch (err: any) {
    return { canDelete: false, reason: err.message, billsCount: 0, paymentsCount: 0 };
  }
}

/**
 * Protected delete with explicit audit trail.
 */
export async function deleteHouseholdProtected(household: Household, reason: string): Promise<void> {
  const path = `households/${household.id}`;
  try {
    await deleteDoc(doc(db, 'households', household.id));
    await createAuditLog(
      'DELETE_CONSUMER',
      'Household',
      household.id,
      `Permanently deleted consumer ${household.customerCode} (${household.ownerName}). Reason: ${reason}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Deactivate or Reactivate consumer account.
 */
export async function toggleHouseholdStatus(
  householdId: string,
  newStatus: 'ACTIVE' | 'INACTIVE',
  reason: string
): Promise<void> {
  const path = `households/${householdId}`;
  try {
    await updateDoc(doc(db, 'households', householdId), {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
    await createAuditLog(
      newStatus === 'ACTIVE' ? 'REACTIVATE_CONSUMER' : 'DEACTIVATE_CONSUMER',
      'Household',
      householdId,
      `Changed consumer status to ${newStatus}. Reason: ${reason}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Authorized balance adjustment (opening balance correction or debit/credit adjustment)
 */
export async function adjustHouseholdBalance(
  householdId: string,
  adjustmentAmount: number,
  type: 'OPENING_BALANCE' | 'CREDIT_ADJUSTMENT' | 'DEBIT_PENALTY',
  reason: string
): Promise<void> {
  const path = `households/${householdId}`;
  try {
    const snap = await getDoc(doc(db, 'households', householdId));
    if (!snap.exists()) throw new Error('Household not found');
    const h = snap.data() as Household;

    let newBalance = h.currentBalance || 0;
    let newOpening = h.openingBalance || 0;

    if (type === 'OPENING_BALANCE') {
      const diff = adjustmentAmount - newOpening;
      newOpening = adjustmentAmount;
      newBalance = Math.max(0, newBalance + diff);
    } else if (type === 'CREDIT_ADJUSTMENT') {
      newBalance = Math.max(0, newBalance - adjustmentAmount);
    } else if (type === 'DEBIT_PENALTY') {
      newBalance += adjustmentAmount;
    }

    await updateDoc(doc(db, 'households', householdId), {
      openingBalance: newOpening,
      currentBalance: newBalance,
      updatedAt: new Date().toISOString(),
    });

    await createAuditLog(
      'ADJUST_BALANCE',
      'Household',
      householdId,
      `Adjusted balance for ${h.customerCode} (${h.ownerName}). Type: ${type}, Amount: NPR ${adjustmentAmount}, New Balance: NPR ${newBalance}. Reason: ${reason}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ----------------------------------------------------------------------
// Bills Management & Fixed Monthly Billing Engine
// ----------------------------------------------------------------------
export async function getBills(): Promise<Bill[]> {
  const path = 'bills';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bill));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getBillsForCustomer(customerId: string): Promise<Bill[]> {
  const path = 'bills';
  try {
    const q = query(collection(db, path), where('customerId', '==', customerId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bill));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Fetch a specific bill from Firestore by its document ID or billNumber.
 */
export async function getBillById(billIdOrNumber: string): Promise<Bill | null> {
  if (!billIdOrNumber || !billIdOrNumber.trim()) return null;
  const cleanId = billIdOrNumber.trim();
  const path = `bills/${cleanId}`;
  try {
    // 1. Try direct document ID lookup
    const docRef = doc(db, 'bills', cleanId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Bill;
    }

    // 2. Fallback to querying by billNumber in case billNumber was passed
    const q = query(collection(db, 'bills'), where('billNumber', '==', cleanId));
    const qSnap = await getDocs(q);
    if (!qSnap.empty) {
      const found = qSnap.docs[0];
      return { id: found.id, ...found.data() } as Bill;
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

/**
 * Reconcile a customer's entire ledger in Firestore:
 * Recomputes previousBalance, valid periodic charges, and payment allocation
 * without deleting historical payments or receipts, and updates household balance.
 */
export async function reconcileCustomerLedger(customerCode: string): Promise<void> {
  try {
    const household = await getHouseholdByCustomerCode(customerCode);
    if (!household) return;

    const [billsSnap, paymentsSnap] = await Promise.all([
      getDocs(query(collection(db, 'bills'), where('customerId', '==', customerCode))),
      getDocs(query(collection(db, 'payments'), where('customerId', '==', customerCode))),
    ]);

    const customerBills = billsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Bill));
    const customerPayments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));

    const result = reconcileCustomerLedgerInMem(household, customerBills, customerPayments);

    // Update household current balance
    await updateDoc(doc(db, 'households', household.id), {
      currentBalance: result.netOutstandingBalance,
      updatedAt: new Date().toISOString(),
    });

    // Update any bills requiring ledger adjustment
    for (const b of result.billsRequiringUpdate) {
      await updateDoc(doc(db, 'bills', b.id), {
        previousBalance: b.previousBalance,
        totalAmount: b.totalAmount,
        paidAmount: b.paidAmount,
        balanceDue: b.balanceDue,
        status: b.status,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn(`reconcileCustomerLedger note for ${customerCode}:`, err);
  }
}

export interface BillGenerationInput {
  household: Household;
  tariff: Tariff;
  billingMonth: string;
  billingYear: string;
  nepaliMonthYear: string;
  issueDate: string;
  dueDate: string;
  settings?: CommitteeSettings;
  overrideMonthlyCharge?: number;
}

export async function generateSingleBill(input: BillGenerationInput): Promise<Bill> {
  const { household, tariff, billingMonth, billingYear, nepaliMonthYear, issueDate, dueDate, settings } = input;
  const path = 'bills';

  // 1. Prevent duplicate active bills for the same consumer and period
  const existingBillsSnap = await getDocs(
    query(collection(db, 'bills'), where('customerId', '==', household.customerCode))
  );
  const existingBills = existingBillsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Bill));

  const duplicate = existingBills.find(
    (b) => b.billingYear === billingYear && b.billingMonth === billingMonth && b.status !== 'CANCELLED'
  );
  if (duplicate) {
    throw new Error(
      `Duplicate Bill Prevented: Customer ${household.customerCode} already has an active bill (${duplicate.billNumber}) for ${billingMonth} ${billingYear}.`
    );
  }

  // 2. Fixed monthly charge logic
  let monthlyCharge = input.overrideMonthlyCharge !== undefined
    ? input.overrideMonthlyCharge
    : (household.monthlyFixedCharge || tariff.standardMonthlyCharge || 150);

  if (household.status === 'INACTIVE') {
    monthlyCharge = tariff.inactiveHouseholdCharge ?? (settings?.inactiveHouseholdCharge || 0);
  }

  const sanitationCharge = tariff.sanitationFee || 20;
  const maintenanceFee = tariff.maintenanceFee || 10;
  const penaltyAmount = 0;
  const discountAmount = 0;

  // 3. Accurately compute Previous Balance strictly from verified prior active bills and payments
  const paymentsSnap = await getDocs(
    query(collection(db, 'payments'), where('customerId', '==', household.customerCode))
  );
  const existingPayments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));

  const targetPeriodScore = getPeriodScore(billingYear, billingMonth);
  const priorActiveBills = existingBills.filter(
    (b) => b.status !== 'CANCELLED' && getPeriodScore(b.billingYear, b.billingMonth) < targetPeriodScore
  );

  const priorCharges = priorActiveBills.reduce((sum, b) => sum + calculateBillPeriodicCharge(b), 0);
  const priorPayments = existingPayments
    .filter((p) => p.status === 'COMPLETED' || !p.status)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const openingBalance = Number(household.openingBalance) || 0;
  // True remaining unpaid balance prior to this bill cycle
  const previousBalance = Math.max(0, openingBalance + priorCharges - priorPayments);

  const currentMonthTotal = monthlyCharge + sanitationCharge + maintenanceFee;
  const totalAmount = previousBalance + currentMonthTotal;
  const paidAmount = 0;
  const balanceDue = totalAmount;

  // Unique deterministic ID to prevent duplicate bill collision
  const billId = `BIL-${billingYear}-${billingMonth.replace(/\s+/g, '')}-${household.customerCode}`;
  const billNumber = `${billingYear}/${billingMonth.substring(0, 3).toUpperCase()}-${household.customerCode}`;

  const bill: Bill = {
    id: billId,
    billNumber,
    customerId: household.customerCode,
    householdId: household.id,
    householdNumber: household.householdNumber,
    customerName: household.ownerName,
    ward: household.ward,
    tole: household.tole,
    category: household.category || 'Residential',
    billingMonth,
    billingYear,
    nepaliMonthYear,
    monthlyCharge,
    previousBalance,
    sanitationCharge,
    maintenanceFee,
    additionalCharges: [
      { name: 'Sanitation Cess (सरसफाइ)', amount: sanitationCharge },
      { name: 'Maintenance Fee (मर्मत)', amount: maintenanceFee },
    ],
    penaltyAmount,
    discountAmount,
    adjustmentAmount: 0,
    totalAmount,
    paidAmount,
    balanceDue,
    issueDate,
    dueDate,
    status: 'UNPAID',
    tariffId: tariff.id,
    tariffSnapshot: {
      name: tariff.name,
      standardMonthlyCharge: monthlyCharge,
      sanitationFee: tariff.sanitationFee,
      latePenaltyPercentage: tariff.latePenaltyPercentage,
      earlyDiscountPercentage: tariff.earlyDiscountPercentage,
    },
    userId: household.userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const billRef = doc(db, 'bills', billId);
    await setDoc(billRef, removeUndefined(bill));

    // Reconcile customer ledger cascade so household document and all bills are aligned
    await reconcileCustomerLedger(household.customerCode);

    await createAuditLog(
      'GENERATE_BILL',
      'Bill',
      billId,
      `Generated monthly bill ${billNumber} of NPR ${totalAmount} (Fixed: NPR ${monthlyCharge}, Prev Due: NPR ${previousBalance}) for ${household.ownerName} (${household.customerCode})`
    );

    return bill;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Super Admin bill correction with immutable audit trail.
 */
export async function correctBill(billId: string, adjustedTotal: number, reason: string): Promise<void> {
  const path = `bills/${billId}`;
  try {
    const billRef = doc(db, 'bills', billId);
    const snap = await getDoc(billRef);
    if (!snap.exists()) throw new Error('Bill not found.');
    const bill = snap.data() as Bill;

    const diff = adjustedTotal - bill.totalAmount;
    const newBalanceDue = Math.max(0, bill.balanceDue + diff);

    await updateDoc(billRef, {
      totalAmount: adjustedTotal,
      balanceDue: newBalanceDue,
      updatedAt: new Date().toISOString(),
    });

    // Update household balance
    const household = await getHouseholdByCustomerCode(bill.customerId);
    if (household) {
      await updateDoc(doc(db, 'households', household.id), {
        currentBalance: Math.max(0, (household.currentBalance || 0) + diff),
        updatedAt: new Date().toISOString(),
      });
    }

    await createAuditLog(
      'CORRECT_BILL',
      'Bill',
      billId,
      `Adjusted bill ${bill.billNumber} from NPR ${bill.totalAmount} to NPR ${adjustedTotal}. Reason: ${reason}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Update Bill Status (e.g. CANCELLED, PENDING verification, OVERDUE)
 */
export async function updateBillStatus(billId: string, newStatus: BillStatus, reason: string): Promise<void> {
  const path = `bills/${billId}`;
  try {
    const billRef = doc(db, 'bills', billId);
    const snap = await getDoc(billRef);
    if (!snap.exists()) throw new Error('Bill not found.');
    const bill = snap.data() as Bill;

    await updateDoc(billRef, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });

    await createAuditLog(
      'UPDATE_BILL_STATUS',
      'Bill',
      billId,
      `Updated bill ${bill.billNumber} status to ${newStatus}. Reason: ${reason}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface EditBillInput {
  billId: string;
  monthlyCharge: number;
  sanitationCharge: number;
  penaltyAmount: number;
  discountAmount: number;
  dueDate: string;
  billingMonth: string;
  billingYear: string;
  nepaliMonthYear: string;
  reason: string;
  operatorEmail?: string;
}

/**
 * Super Admin Comprehensive Bill Correction with before-and-after audit logging
 * and household balance reconciliation.
 */
export async function editBillDetails(input: EditBillInput): Promise<Bill> {
  const {
    billId,
    monthlyCharge,
    sanitationCharge,
    penaltyAmount,
    discountAmount,
    dueDate,
    billingMonth,
    billingYear,
    nepaliMonthYear,
    reason,
  } = input;
  const path = `bills/${billId}`;
  try {
    const billRef = doc(db, 'bills', billId);
    const snap = await getDoc(billRef);
    if (!snap.exists()) throw new Error('Bill not found.');
    const bill = snap.data() as Bill;

    // Check duplicate active bill for this customer if period changed
    if (bill.billingMonth !== billingMonth || bill.billingYear !== billingYear) {
      const q = query(
        collection(db, 'bills'),
        where('customerId', '==', bill.customerId),
        where('billingMonth', '==', billingMonth),
        where('billingYear', '==', billingYear)
      );
      const duplicateSnap = await getDocs(q);
      const otherDuplicates = duplicateSnap.docs.filter((d) => d.id !== billId);
      if (otherDuplicates.length > 0) {
        throw new Error(`A bill already exists for customer ${bill.customerId} for period ${billingMonth} ${billingYear}.`);
      }
    }

    const previousBalance = bill.previousBalance || 0;
    const newTotalAmount = Math.max(0, monthlyCharge + sanitationCharge + penaltyAmount - discountAmount + previousBalance);

    if (bill.paidAmount > 0 && newTotalAmount < bill.paidAmount) {
      throw new Error(`New total amount (NPR ${newTotalAmount}) cannot be less than already paid amount (NPR ${bill.paidAmount}). Please use authorized adjustment workflow.`);
    }

    const newBalanceDue = Math.max(0, newTotalAmount - (bill.paidAmount || 0));
    let newStatus = bill.status;
    if (newBalanceDue === 0 && newTotalAmount > 0) {
      newStatus = 'PAID';
    } else if (bill.paidAmount > 0 && newBalanceDue > 0) {
      newStatus = 'PARTIALLY_PAID';
    } else if (bill.status === 'PAID' && newBalanceDue > 0) {
      newStatus = 'UNPAID';
    }

    const diff = newTotalAmount - bill.totalAmount;

    const beforeSnapshot = {
      monthlyCharge: bill.monthlyCharge,
      sanitationCharge: bill.sanitationCharge,
      penaltyAmount: bill.penaltyAmount,
      discountAmount: bill.discountAmount,
      totalAmount: bill.totalAmount,
      balanceDue: bill.balanceDue,
      dueDate: bill.dueDate,
      billingMonth: bill.billingMonth,
      billingYear: bill.billingYear,
    };

    const afterSnapshot = {
      monthlyCharge,
      sanitationCharge,
      penaltyAmount,
      discountAmount,
      totalAmount: newTotalAmount,
      balanceDue: newBalanceDue,
      dueDate,
      billingMonth,
      billingYear,
    };

    await updateDoc(billRef, {
      monthlyCharge,
      sanitationCharge,
      penaltyAmount,
      discountAmount,
      totalAmount: newTotalAmount,
      balanceDue: newBalanceDue,
      dueDate,
      billingMonth,
      billingYear,
      nepaliMonthYear,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });

    // Update household balance consistently
    if (diff !== 0) {
      const household = await getHouseholdByCustomerCode(bill.customerId);
      if (household) {
        await updateDoc(doc(db, 'households', household.id), {
          currentBalance: Math.max(0, (household.currentBalance || 0) + diff),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await createAuditLog(
      'EDIT_BILL',
      'Bill',
      billId,
      `SuperAdmin edited bill ${bill.billNumber} (${bill.customerName}). Diff: NPR ${diff}. Reason: ${reason}. Before: ${JSON.stringify(beforeSnapshot)}, After: ${JSON.stringify(afterSnapshot)}`
    );

    return {
      ...bill,
      ...afterSnapshot,
      nepaliMonthYear,
      status: newStatus,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}


/**
 * Check if a bill can be safely deleted without violating financial integrity.
 * Strictly prevents deleting bills with recorded payments or completed transactions.
 */
export function canDeleteBill(bill: Bill, payments?: Payment[]): { canDelete: boolean; reason?: string } {
  if (bill.paidAmount > 0 || bill.status === 'PAID' || bill.status === 'PARTIALLY_PAID') {
    return {
      canDelete: false,
      reason: 'यो बिलमा भुक्तानी भइसकेको वा आंशिक भुक्तानी भएको कारण वित्तीय लेखा नियम अनुसार मेटाउन मिल्दैन। (Cannot delete bill with recorded payments)',
    };
  }
  if (payments && payments.length > 0) {
    const hasPayment = payments.some(
      (p) => p.billId === bill.id && (p.status === 'COMPLETED' || p.status === 'PENDING')
    );
    if (hasPayment) {
      return {
        canDelete: false,
        reason: 'यो बिलसँग सम्बन्धित भुक्तानी रसिद (Payment Receipt) फेला परेकोले मेटाउन सुरक्षित छैन। (Receipt exists)',
      };
    }
  }
  return { canDelete: true };
}

/**
 * Delete a single mistakenly generated unpaid bill.
 * Only Super Admin / Main Admin can perform this.
 * Reconciles household balance and leaves an audit trail.
 */
export async function deleteSingleBill(
  bill: Bill,
  reason: string,
  operatorEmail: string,
  payments?: Payment[]
): Promise<void> {
  const safety = canDeleteBill(bill, payments);
  if (!safety.canDelete) {
    throw new Error(safety.reason || 'Cannot delete bill due to financial safety rules.');
  }

  const path = `bills/${bill.id}`;
  try {
    // 1. Delete the Bill document
    await deleteDoc(doc(db, 'bills', bill.id));

    // 2. Reconcile household balance safely
    const household = await getHouseholdByCustomerCode(bill.customerId);
    if (household) {
      const chargeAdded = Math.max(0, (bill.totalAmount || 0) - (bill.previousBalance || 0));
      const newBalance = Math.max(0, (household.currentBalance || 0) - chargeAdded);
      await updateDoc(doc(db, 'households', household.id), {
        currentBalance: newBalance,
        updatedAt: new Date().toISOString(),
      });
    }

    // 3. Cancel or delete associated unpaid vouchers if any exist
    try {
      const voucherSnap = await getDocs(
        query(collection(db, 'vouchers'), where('billId', '==', bill.id))
      );
      for (const vDoc of voucherSnap.docs) {
        await deleteDoc(vDoc.ref);
      }
    } catch (vErr) {
      console.warn('Voucher cleanup note:', vErr);
    }

    // 4. Record append-only audit log
    await createAuditLog(
      'DELETE_BILL',
      'Bill',
      bill.id,
      `Main Admin (${operatorEmail}) deleted unpaid bill ${bill.billNumber} (${bill.nepaliMonthYear || bill.billingMonth}) of NPR ${bill.totalAmount} for ${bill.customerName} (${bill.customerId}). Reason: ${reason}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Bulk delete mistakenly generated unpaid bills.
 * Only Super Admin / Main Admin can perform this.
 * Reconciles household balances per unique consumer and creates a batch audit log.
 */
export async function deleteBillsBulk(
  billsToDelete: Bill[],
  reason: string,
  operatorEmail: string,
  payments?: Payment[]
): Promise<{ deletedCount: number; skippedCount: number; errors: string[] }> {
  let deletedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  // Group by customer to update household balances efficiently
  const householdDeductions = new Map<string, number>();
  const deletedBillNumbers: string[] = [];

  for (const bill of billsToDelete) {
    const safety = canDeleteBill(bill, payments);
    if (!safety.canDelete) {
      skippedCount++;
      errors.push(`Bill ${bill.billNumber}: ${safety.reason}`);
      continue;
    }

    try {
      await deleteDoc(doc(db, 'bills', bill.id));
      deletedCount++;
      deletedBillNumbers.push(bill.billNumber);

      const chargeAdded = Math.max(0, (bill.totalAmount || 0) - (bill.previousBalance || 0));
      const prevDeduction = householdDeductions.get(bill.customerId) || 0;
      householdDeductions.set(bill.customerId, prevDeduction + chargeAdded);

      // Clean up voucher
      try {
        const vSnap = await getDocs(query(collection(db, 'vouchers'), where('billId', '==', bill.id)));
        for (const vDoc of vSnap.docs) {
          await deleteDoc(vDoc.ref);
        }
      } catch (err) {
        // ignore voucher cleanup error
      }
    } catch (err: any) {
      skippedCount++;
      errors.push(`Bill ${bill.billNumber}: ${err.message || 'Deletion failed'}`);
    }
  }

  // Update household balances
  for (const [customerCode, totalDeduction] of householdDeductions.entries()) {
    try {
      const household = await getHouseholdByCustomerCode(customerCode);
      if (household) {
        const newBalance = Math.max(0, (household.currentBalance || 0) - totalDeduction);
        await updateDoc(doc(db, 'households', household.id), {
          currentBalance: newBalance,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn(`Failed to update balance for ${customerCode}:`, err);
    }
  }

  if (deletedCount > 0) {
    await createAuditLog(
      'BULK_DELETE_BILLS',
      'Bill',
      `bulk-${Date.now()}`,
      `Main Admin (${operatorEmail}) bulk-deleted ${deletedCount} bills (${deletedBillNumbers.slice(0, 5).join(', ')}${deletedBillNumbers.length > 5 ? '...' : ''}). Skipped: ${skippedCount}. Reason: ${reason}`
    );
  }

  return { deletedCount, skippedCount, errors };
}

// ----------------------------------------------------------------------
// Payment Vouchers (Counter & Bank Deposit Slips)
// ----------------------------------------------------------------------
export async function getVouchers(): Promise<Voucher[]> {
  const path = 'vouchers';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Voucher));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function createVoucher(bill: Bill, household: Household): Promise<Voucher> {
  const path = 'vouchers';
  const voucherNumber = `VCH-${bill.billingYear}-${household.customerCode}-${Math.floor(1000 + Math.random() * 9000)}`;
  const voucherId = `VCH-${bill.id}`;

  const voucher: Voucher = {
    id: voucherId,
    voucherNumber,
    customerId: household.customerCode,
    householdId: household.id,
    householdNumber: household.householdNumber,
    customerName: household.ownerName,
    ward: household.ward,
    tole: household.tole,
    billId: bill.id,
    billNumber: bill.billNumber,
    billingPeriod: bill.nepaliMonthYear || `${bill.billingMonth} ${bill.billingYear}`,
    amountDue: bill.balanceDue,
    outstandingBalance: household.currentBalance || 0,
    issueDate: new Date().toISOString().split('T')[0],
    expiryDate: bill.dueDate,
    status: 'UNPAID',
    instructions: 'Please present this voucher at the committee office cashier desk for payment recording.',
    createdAt: new Date().toISOString(),
    userId: household.userId,
  };

  try {
    const docRef = doc(db, path, voucherId);
    await setDoc(docRef, removeUndefined(voucher), { merge: true });
    return voucher;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return voucher;
  }
}

// ----------------------------------------------------------------------
// Payment & Receipts (Manual Counter Payments Only)
// ----------------------------------------------------------------------
export async function getPayments(): Promise<Payment[]> {
  const path = 'payments';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getPaymentsForCustomer(customerId: string): Promise<Payment[]> {
  const path = 'payments';
  try {
    const q = query(collection(db, path), where('customerId', '==', customerId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export interface RecordPaymentInput {
  household: Household;
  amount: number;
  paymentMethod: Payment['paymentMethod'];
  transactionReference: string;
  remarks?: string;
  date: string;
  targetBillId?: string;
}

export async function recordCounterPayment(input: RecordPaymentInput): Promise<Payment> {
  const { household, amount, paymentMethod, transactionReference, remarks, date, targetBillId } = input;
  const path = 'payments';

  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  // Generate unique sequential-style receipt number
  const receiptNumber = `RCP-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
  const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const payment: Payment = {
    id: paymentId,
    receiptNumber,
    customerId: household.customerCode,
    householdId: household.id,
    householdNumber: household.householdNumber,
    customerName: household.ownerName,
    ward: household.ward,
    category: household.category || 'Residential',
    billId: targetBillId || '',
    amount,
    paymentMethod,
    transactionReference: transactionReference.trim() || `COUNTER-${Date.now()}`,
    status: 'COMPLETED',
    receivedBy: auth.currentUser?.uid || 'staff-counter',
    staffName: auth.currentUser?.displayName || auth.currentUser?.email || 'Authorized Cashier',
    remarks: remarks || 'Official Counter Payment Received',
    date,
    userId: household.userId,
    createdAt: new Date().toISOString(),
  };

  try {
    // Save Payment document (append-only ledger)
    const paymentRef = doc(db, 'payments', paymentId);
    await setDoc(paymentRef, removeUndefined(payment));

    // Allocate payment against outstanding bills
    const billsQuery = query(
      collection(db, 'bills'),
      where('customerId', '==', household.customerCode),
      where('status', 'in', ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'])
    );
    const billsSnap = await getDocs(billsQuery);

    let remainingPayment = amount;

    // Sort bills by issueDate ascending (oldest first)
    const unpaidBills = billsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Bill))
      .sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());

    for (const bill of unpaidBills) {
      if (remainingPayment <= 0) break;
      const currentDue = bill.balanceDue;
      const paymentToThisBill = Math.min(remainingPayment, currentDue);

      const newPaid = bill.paidAmount + paymentToThisBill;
      const newDue = Math.max(0, bill.totalAmount - newPaid);
      const newStatus = newDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

      await updateDoc(doc(db, 'bills', bill.id), {
        paidAmount: newPaid,
        balanceDue: newDue,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      remainingPayment -= paymentToThisBill;
    }

    // Update household balance
    const newHouseholdBalance = Math.max(0, (household.currentBalance || 0) - amount);
    await updateDoc(doc(db, 'households', household.id), {
      currentBalance: newHouseholdBalance,
      updatedAt: new Date().toISOString(),
    });

    await createAuditLog(
      'RECORD_PAYMENT',
      'Payment',
      paymentId,
      `Recorded ${paymentMethod} receipt #${receiptNumber} of NPR ${amount} for ${household.ownerName} (${household.customerCode}). Remaining balance: NPR ${newHouseholdBalance}`
    );

    return payment;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ----------------------------------------------------------------------
// User Profiles & Staff Management
// ----------------------------------------------------------------------
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserProfile(user: UserProfile): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const cleanUser = removeUndefined({ ...user, updatedAt: new Date().toISOString() });
    await setDoc(doc(db, 'users', user.uid), cleanUser, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => ({ ...d.data(), uid: d.id } as UserProfile));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Sequence generator for permanent, non-reusable Staff IDs (e.g. STF-001, STF-002).
 * Reads the permanent sequence document in Firestore (systemSequences/staffId),
 * updates the sequence counter monotonically, and registers the ID so that
 * even if a staff member is deleted or deactivated, that ID is NEVER recycled.
 */
export async function getNextPermanentStaffId(): Promise<string> {
  const seqDocRef = doc(db, 'systemSequences', 'staffId');
  try {
    const snap = await getDoc(seqDocRef);
    let lastNumber = 0;
    let issuedIds: string[] = [];
    let retiredIds: string[] = [];

    if (snap.exists()) {
      const data = snap.data();
      lastNumber = data.lastNumber || 0;
      issuedIds = data.issuedIds || [];
      retiredIds = data.retiredIds || [];
    }

    // Also inspect existing users to guarantee we never duplicate any existing number
    const allUsers = await getAllUsers();
    allUsers.forEach((u) => {
      if (u.staffId) {
        const match = u.staffId.match(/STF-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > lastNumber) {
            lastNumber = num;
          }
        }
      }
    });

    // Also check retired IDs
    retiredIds.forEach((rid) => {
      const match = rid.match(/STF-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > lastNumber) {
          lastNumber = num;
        }
      }
    });

    const nextNumber = lastNumber + 1;
    const nextStaffId = `STF-${nextNumber.toString().padStart(3, '0')}`;

    // Persist counter immediately so concurrent additions never get the same ID
    await setDoc(seqDocRef, {
      lastNumber: nextNumber,
      issuedIds: Array.from(new Set([...issuedIds, nextStaffId])),
      retiredIds,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return nextStaffId;
  } catch (err) {
    console.warn('Error fetching staff sequence, using calculated unique fallback:', err);
    const allUsers = await getAllUsers();
    return generateUniqueStaffId(allUsers);
  }
}

/**
 * Synchronous helper to estimate next Staff ID from list of active users
 */
export function generateUniqueStaffId(existingUsers: UserProfile[]): string {
  let highestNum = 0;
  existingUsers.forEach((u) => {
    if (!u.staffId) return;
    const match = u.staffId.match(/STF-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > highestNum) {
        highestNum = num;
      }
    }
  });

  const nextNum = highestNum + 1;
  return `STF-${nextNum.toString().padStart(3, '0')}`;
}

export async function updateStaffUser(
  uid: string,
  role: UserRole,
  assignedWards: string[],
  assignedToles: string[],
  isActive: boolean,
  designation: string,
  staffId?: string
): Promise<void> {
  const path = `users/${uid}`;
  try {
    // Security Invariant: Only Permanent Super Admin can manage staff privileges
    const callerEmail = auth.currentUser?.email?.toLowerCase();
    if (callerEmail !== BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      throw new Error('Authorization Denied: Only the Permanent Super Admin (hayutarkhanepani@gmail.com) is authorized to modify staff roles or privileges.');
    }

    const userDoc = await getDoc(doc(db, 'users', uid));
    const userData = userDoc.exists() ? userDoc.data() : null;
    const targetEmail = userData?.email?.toLowerCase() || '';
    const isTargetMainAdmin = targetEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

    // Security Protection: Permanent Main Admin can NEVER be deactivated or demoted
    if (isTargetMainAdmin) {
      if (role !== 'SUPER_ADMIN' || !isActive) {
        throw new Error('Security Violation: The designated Permanent Main Administrator (hayutarkhanepani@gmail.com) cannot be deactivated or downgraded.');
      }
    }

    // Role Invariant: SUPER_ADMIN role can NEVER be assigned to any email other than hayutarkhanepani@gmail.com
    if (role === 'SUPER_ADMIN' && !isTargetMainAdmin) {
      throw new Error('Security Violation: The SUPER_ADMIN role is unique and permanently bound to hayutarkhanepani@gmail.com. Other administrators should be assigned the ADMIN role.');
    }

    const updateData: any = {
      role,
      assignedWards,
      assignedToles,
      isActive,
      designation,
      isApproved: true,
      updatedAt: new Date().toISOString(),
    };
    if (staffId) {
      updateData.staffId = staffId;
    }

    await updateDoc(doc(db, 'users', uid), updateData);

    // Update admins collection: strictly for permanent super admin
    if (isTargetMainAdmin && isActive) {
      await setDoc(doc(db, 'admins', uid), {
        email: targetEmail,
        role: 'SUPER_ADMIN',
        addedAt: new Date().toISOString(),
      }, { merge: true });
    } else {
      // Remove any non-permanent admin doc from admins collection
      try {
        if (!isTargetMainAdmin) {
          await deleteDoc(doc(db, 'admins', uid));
        }
      } catch {
        // Ignored
      }
    }

    await createAuditLog(
      'UPDATE_STAFF',
      'User',
      uid,
      `Updated staff ${staffId || uid} (${userData?.displayName || 'Staff'}) role to ${role}, status: ${isActive ? 'ACTIVE' : 'DEACTIVATED'}, wards: [${assignedWards.join(',')}]`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete a staff record through Main Admin authorization.
 * Subject to audit and statutory record-retention requirements:
 * - Permanent Main Admin account cannot be deleted.
/**
 * Checks if a staff member has historical ties (payments received, bills handled, audit actions)
 * to prevent accidental deletion and preserve statutory auditability.
 */
export async function checkStaffHistoricalDependencies(staffMember: UserProfile): Promise<{
  hasDependencies: boolean;
  paymentCount: number;
  billCount: number;
  auditCount: number;
  summary: string;
}> {
  let paymentCount = 0;
  let billCount = 0;
  let auditCount = 0;

  try {
    // Check payments
    const paymentsSnap = await getDocs(collection(db, 'payments'));
    paymentsSnap.forEach((d) => {
      const p = d.data() as Payment;
      if (
        p.receivedBy === staffMember.uid ||
        (staffMember.staffId && p.receivedBy === staffMember.staffId) ||
        (staffMember.displayName && p.staffName?.toLowerCase() === staffMember.displayName.toLowerCase())
      ) {
        paymentCount++;
      }
    });

    // Check bills
    const billsSnap = await getDocs(collection(db, 'bills'));
    billsSnap.forEach((d) => {
      const b = d.data() as Bill;
      if (
        b.cancelledBy === staffMember.uid ||
        (staffMember.email && b.cancelledBy === staffMember.email)
      ) {
        billCount++;
      }
    });

    // Check audit logs
    const auditSnap = await getDocs(collection(db, 'auditLogs'));
    auditSnap.forEach((d) => {
      const a = d.data() as AuditLog;
      if (
        (staffMember.email && a.userEmail?.toLowerCase() === staffMember.email.toLowerCase()) ||
        (staffMember.displayName && a.performedBy?.toLowerCase().includes(staffMember.displayName.toLowerCase())) ||
        (staffMember.staffId && a.details?.includes(staffMember.staffId))
      ) {
        auditCount++;
      }
    });
  } catch (err) {
    console.warn('Dependency check scan error:', err);
  }

  const hasDependencies = paymentCount > 0 || billCount > 0 || auditCount > 0;
  const summary = hasDependencies
    ? `Staff member has ${paymentCount} recorded payment receipt(s), ${billCount} bill action(s), and ${auditCount} audit event(s).`
    : 'No historical dependencies found.';

  return { hasDependencies, paymentCount, billCount, auditCount, summary };
}

/**
 * Safe Deactivation / Archival of a staff account:
 * - Marks status as INACTIVE.
 * - Prevents new operations by setting isActive: false.
 * - Retains full historical transaction identity, bills, receipts, and audit history.
 */
export async function deactivateStaffUser(
  staffUid: string,
  staffMember: UserProfile,
  operatorEmail: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  if (staffMember.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Security Violation: The designated Permanent Main Administrator (hayutarkhanepani@gmail.com) cannot be deactivated.');
  }

  if (operatorEmail.toLowerCase() !== BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Authorization Denied: Only the Permanent Super Admin (hayutarkhanepani@gmail.com) can deactivate staff accounts.');
  }

  const path = `users/${staffUid}`;
  try {
    const timestamp = new Date().toISOString();
    await updateDoc(doc(db, 'users', staffUid), {
      isActive: false,
      accountStatus: 'INACTIVE',
      deactivatedAt: timestamp,
      deactivatedBy: operatorEmail,
      deactivationReason: reason.trim() || 'Deactivated by Main Administrator',
      updatedAt: timestamp,
    });

    // Remove from admins collection if present
    try {
      await deleteDoc(doc(db, 'admins', staffUid));
    } catch {
      // Ignored
    }

    await createAuditLog(
      'DEACTIVATE_STAFF',
      'User',
      staffUid,
      `Super Admin (${operatorEmail}) deactivated staff account ${staffMember.displayName || 'Staff'} (ID: ${staffMember.staffId || 'N/A'}, Role: ${staffMember.role}). Reason: ${reason}. Access revoked; all historical financial records securely preserved.`
    );

    return {
      success: true,
      message: `Staff member ${staffMember.displayName} (${staffMember.staffId}) safely deactivated. System access revoked while retaining historical records.`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Restore or Reactivate a deactivated staff member:
 * - Restores isActive to true, accountStatus to ACTIVE.
 * - Restores only previously authorized operational role (never grants SUPER_ADMIN).
 */
export async function reactivateStaffUser(
  staffUid: string,
  staffMember: UserProfile,
  operatorEmail: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  if (operatorEmail.toLowerCase() !== BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Authorization Denied: Only the Permanent Super Admin (hayutarkhanepani@gmail.com) can reactivate staff accounts.');
  }

  const path = `users/${staffUid}`;
  try {
    const timestamp = new Date().toISOString();
    await updateDoc(doc(db, 'users', staffUid), {
      isActive: true,
      accountStatus: 'ACTIVE',
      reactivatedAt: timestamp,
      reactivatedBy: operatorEmail,
      reactivationReason: (reason || '').trim(),
      updatedAt: timestamp,
    });

    await createAuditLog(
      'REACTIVATE_STAFF',
      'User',
      staffUid,
      `Super Admin (${operatorEmail}) reactivated staff account ${staffMember.displayName || 'Staff'} (ID: ${staffMember.staffId || 'N/A'}, Role: ${staffMember.role}). Access restored. Reason: ${reason || 'Account reactivated by administrator.'}`
    );

    return {
      success: true,
      message: `Staff account ${staffMember.displayName} (${staffMember.staffId}) successfully reactivated with assigned role ${staffMember.role}.`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Comprehensive Edit Staff Profile & Permissions:
 * - Updates name, phone number, address, designation, notes, assigned wards/toles.
 * - Only Super Admin can change role or privileges.
 * - Prevents self-elevation or assigning SUPER_ADMIN.
 * - Records detailed audit log with old and new values.
 */
export async function editStaffProfile(
  staffUid: string,
  currentStaff: UserProfile,
  updates: {
    displayName?: string;
    phoneNumber?: string;
    address?: string;
    designation?: string;
    notes?: string;
    role?: UserRole;
    assignedWards?: string[];
    assignedToles?: string[];
    accountStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  },
  operatorEmail: string,
  editReason?: string
): Promise<{ success: boolean; message: string }> {
  const isSuperAdmin = operatorEmail.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
  const isTargetSuperAdmin = currentStaff.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  // If changing role or permissions, caller MUST be Super Admin
  const isRoleChanging = updates.role && updates.role !== currentStaff.role;
  if (isRoleChanging && !isSuperAdmin) {
    throw new Error('Authorization Denied: Only the Permanent Super Admin (hayutarkhanepani@gmail.com) can change staff roles or administrative privileges.');
  }

  // Target Super Admin cannot be downgraded or made inactive
  if (isTargetSuperAdmin) {
    if (updates.role && updates.role !== 'SUPER_ADMIN') {
      throw new Error('Security Violation: The designated Permanent Main Administrator (hayutarkhanepani@gmail.com) cannot be changed from SUPER_ADMIN.');
    }
    if (updates.accountStatus && updates.accountStatus !== 'ACTIVE') {
      throw new Error('Security Violation: The designated Permanent Main Administrator cannot be deactivated.');
    }
  }

  // Nobody else can be given SUPER_ADMIN
  if (updates.role === 'SUPER_ADMIN' && !isTargetSuperAdmin) {
    throw new Error('Security Violation: The SUPER_ADMIN role is unique and permanently bound to hayutarkhanepani@gmail.com.');
  }

  const path = `users/${staffUid}`;
  try {
    const timestamp = new Date().toISOString();
    const updatePayload: any = {
      updatedAt: timestamp,
    };

    if (updates.displayName !== undefined) updatePayload.displayName = updates.displayName.trim();
    if (updates.phoneNumber !== undefined) updatePayload.phoneNumber = updates.phoneNumber.trim();
    if (updates.address !== undefined) updatePayload.address = updates.address.trim();
    if (updates.designation !== undefined) updatePayload.designation = updates.designation.trim();
    if (updates.notes !== undefined) updatePayload.notes = updates.notes.trim();
    if (updates.assignedWards !== undefined) updatePayload.assignedWards = updates.assignedWards;
    if (updates.assignedToles !== undefined) updatePayload.assignedToles = updates.assignedToles;
    if (updates.role !== undefined) updatePayload.role = updates.role;
    if (updates.accountStatus !== undefined) {
      updatePayload.accountStatus = updates.accountStatus;
      updatePayload.isActive = updates.accountStatus === 'ACTIVE';
    }

    await updateDoc(doc(db, 'users', staffUid), removeUndefined(updatePayload));

    // Keep admins collection consistent
    if (isTargetSuperAdmin) {
      await setDoc(doc(db, 'admins', staffUid), {
        email: currentStaff.email,
        role: 'SUPER_ADMIN',
        updatedAt: timestamp,
      }, { merge: true });
    } else {
      try {
        await deleteDoc(doc(db, 'admins', staffUid));
      } catch {
        // Ignored
      }
    }

    // Build changes summary for audit log
    const changedFields: string[] = [];
    if (updates.displayName && updates.displayName !== currentStaff.displayName) {
      changedFields.push(`Name: '${currentStaff.displayName}' -> '${updates.displayName}'`);
    }
    if (updates.role && updates.role !== currentStaff.role) {
      changedFields.push(`Role: '${currentStaff.role}' -> '${updates.role}'`);
    }
    if (updates.designation && updates.designation !== currentStaff.designation) {
      changedFields.push(`Designation: '${currentStaff.designation || 'None'}' -> '${updates.designation}'`);
    }
    if (updates.accountStatus && (currentStaff.isActive ? 'ACTIVE' : 'INACTIVE') !== updates.accountStatus) {
      changedFields.push(`Status: '${currentStaff.isActive ? 'ACTIVE' : 'INACTIVE'}' -> '${updates.accountStatus}'`);
    }
    if (updates.assignedWards) {
      changedFields.push(`Wards: [${(currentStaff.assignedWards || []).join(',')}] -> [${updates.assignedWards.join(',')}]`);
    }

    await createAuditLog(
      'UPDATE_STAFF_PROFILE',
      'User',
      staffUid,
      `User (${operatorEmail}) updated staff member ${currentStaff.displayName || 'Staff'} (ID: ${currentStaff.staffId || 'N/A'}). Changes: ${changedFields.join('; ') || 'Contact & metadata'}. Reason: ${editReason || 'Administrative update.'}`
    );

    return {
      success: true,
      message: `Staff profile for ${updates.displayName || currentStaff.displayName} successfully updated.`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Delete a staff record through Main Admin authorization with dependency verification.
 * Subject to audit and statutory record-retention requirements:
 * - Permanent Main Admin account cannot be deleted.
 * - Permanent Staff ID is permanently retired and recorded so it is NEVER reused.
 * - Accounts with linked financial transactions cannot be deleted; must use safe archival.
 */
export async function deleteStaffUser(
  staffUid: string,
  staffMember: UserProfile,
  operatorEmail: string
): Promise<{ success: boolean; message: string }> {
  // Main admin protection: hayutarkhanepani@gmail.com can NEVER be deleted
  if (staffMember.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Security Violation: The designated Permanent Main Administrator (hayutarkhanepani@gmail.com) cannot be deleted.');
  }

  // Operator check: only Main Admin can delete staff
  if (operatorEmail.toLowerCase() !== BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Authorization Denied: Only the Main Administrator is authorized to delete staff records.');
  }

  // Mandatory dependency check
  const deps = await checkStaffHistoricalDependencies(staffMember);
  if (deps.hasDependencies) {
    throw new Error(
      `Cannot permanently delete staff member ${staffMember.displayName || 'Staff'} (${staffMember.staffId || 'N/A'}) because they have ${deps.paymentCount} payment receipts and ${deps.auditCount} audit events recorded. To protect financial integrity and accountability, please use 'Safe Deactivation/Archival' instead.`
    );
  }

  const path = `users/${staffUid}`;
  try {
    // 1. Record the audit log entry FIRST (Audit logs are append-only and cannot be deleted)
    await createAuditLog(
      'DELETE_STAFF_RECORD',
      'User',
      staffUid,
      `Main Admin (${operatorEmail}) permanently deleted non-historical staff record for ${staffMember.displayName || 'Staff Member'} (Permanent Staff ID: ${staffMember.staffId || 'N/A'}, Email: ${staffMember.email}). Zero financial dependencies verified.`
    );

    // 2. Mark the Staff ID as permanently retired in the system sequence
    if (staffMember.staffId) {
      try {
        const seqDocRef = doc(db, 'systemSequences', 'staffId');
        const snap = await getDoc(seqDocRef);
        const retiredIds = snap.exists() ? (snap.data().retiredIds || []) : [];
        await setDoc(seqDocRef, {
          retiredIds: Array.from(new Set([...retiredIds, staffMember.staffId])),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (seqErr) {
        console.warn('Retired ID tracking notice:', seqErr);
      }
    }

    // 3. Remove from admins collection if present
    try {
      await deleteDoc(doc(db, 'admins', staffUid));
    } catch {
      // Ignored if not present in admins
    }

    // 4. Delete the user document from users collection
    await deleteDoc(doc(db, 'users', staffUid));

    return {
      success: true,
      message: `Staff record ${staffMember.displayName} (${staffMember.staffId}) deleted successfully. Staff ID retired.`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

/**
 * Retrieve audit logs associated with a specific staff member
 */
export async function getStaffAuditLogs(
  staffEmail: string,
  staffName?: string,
  staffId?: string
): Promise<AuditLog[]> {
  try {
    const allLogs = await getAuditLogs(200);
    const emailLower = staffEmail.toLowerCase();
    return allLogs.filter((log) => {
      const matchEmail = log.userEmail?.toLowerCase() === emailLower;
      const matchPerformer = staffName && log.performedBy?.toLowerCase().includes(staffName.toLowerCase());
      const matchDetails =
        (staffId && log.details?.includes(staffId)) ||
        (staffEmail && log.details?.toLowerCase().includes(emailLower));
      return matchEmail || matchPerformer || matchDetails;
    });
  } catch (err) {
    console.error('Error fetching staff audit logs:', err);
    return [];
  }
}

// ----------------------------------------------------------------------
// Staff Cash Handover & Financial Reconciliation Services
// ----------------------------------------------------------------------

export async function getStaffReconciliations(): Promise<StaffCashHandover[]> {
  const path = 'staffReconciliations';
  try {
    const snap = await getDocs(collection(db, path));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as StaffCashHandover));
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function saveStaffCashHandover(
  handover: Omit<StaffCashHandover, 'id' | 'createdAt' | 'status'> & { id?: string; status?: HandoverStatus }
): Promise<StaffCashHandover> {
  const path = 'staffReconciliations';
  const handoverId = handover.id || `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const record: StaffCashHandover = {
    ...handover,
    id: handoverId,
    status: handover.status || 'PENDING_REVIEW',
    difference: Number(handover.actualCountedCash) - Number(handover.expectedClosingCash),
    createdAt: now,
    updatedAt: now,
  };

  try {
    const docRef = doc(db, path, handoverId);
    await setDoc(docRef, removeUndefined(record), { merge: true });

    await createAuditLog(
      'RECORD_CASH_HANDOVER',
      'StaffReconciliation',
      handoverId,
      `Recorded cash handover for ${handover.staffName} (${handover.staffId || handover.staffEmail}): Expected Cash NPR ${handover.expectedClosingCash}, Actual Counted NPR ${handover.actualCountedCash}, Difference NPR ${record.difference}`
    );

    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function reviewStaffReconciliation(
  handoverId: string,
  newStatus: HandoverStatus,
  reviewerNotes: string
): Promise<void> {
  const path = `staffReconciliations/${handoverId}`;
  const now = new Date().toISOString();
  const reviewerEmail = auth.currentUser?.email || 'hayutarkhanepani@gmail.com';
  const reviewerName = auth.currentUser?.displayName || 'Super Admin';

  try {
    const docRef = doc(db, 'staffReconciliations', handoverId);
    await updateDoc(docRef, {
      status: newStatus,
      reviewedBy: reviewerName,
      reviewedByEmail: reviewerEmail,
      reviewedAt: now,
      reviewerNotes: reviewerNotes || '',
      updatedAt: now,
    });

    await createAuditLog(
      'REVIEW_CASH_HANDOVER',
      'StaffReconciliation',
      handoverId,
      `Super Admin reviewed reconciliation record ${handoverId}: Status set to ${newStatus}. Notes: ${reviewerNotes || 'Approved'}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// ----------------------------------------------------------------------
// Consumer Self-Registration & Approval Workflow
// ----------------------------------------------------------------------

export async function createConsumerRegistrationRequest(
  data: Omit<ConsumerRegistrationRequest, 'id' | 'createdAt' | 'status'>
): Promise<ConsumerRegistrationRequest> {
  const path = 'registrationRequests';
  const reqId = `REQ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const request: ConsumerRegistrationRequest = {
    ...data,
    id: reqId,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };

  try {
    const docRef = doc(db, path, reqId);
    await setDoc(docRef, removeUndefined(request));

    await createAuditLog(
      'SUBMIT_REGISTRATION_REQUEST',
      'RegistrationRequest',
      reqId,
      `Applicant ${request.fullName} (${request.phoneNumber}, Ward: ${request.ward}) submitted ${request.requestType} request`
    );

    return request;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function getConsumerRegistrationRequests(): Promise<ConsumerRegistrationRequest[]> {
  const path = 'registrationRequests';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ConsumerRegistrationRequest));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function approveRegistrationRequest(
  request: ConsumerRegistrationRequest,
  assignedCustomerCode: string,
  adminNotes?: string
): Promise<void> {
  const path = `registrationRequests/${request.id}`;
  const now = new Date().toISOString();
  const reviewerEmail = auth.currentUser?.email || 'hayutarkhanepani@gmail.com';
  const reviewerName = auth.currentUser?.displayName || 'Committee Admin';

  try {
    let householdId = request.assignedHouseholdId;

    if (request.requestType === 'NEW_CONNECTION') {
      householdId = `h-${Date.now()}`;
      const newHousehold: Household = {
        id: householdId,
        customerCode: assignedCustomerCode,
        householdNumber: `H-${Math.floor(100 + Math.random() * 900)}`,
        ownerName: request.fullName.trim(),
        ward: request.ward || '1',
        tole: request.tole || '',
        address: request.address || `वडा नं ${request.ward}`,
        phoneNumber: request.phoneNumber || '',
        email: request.email || '',
        category: 'Residential',
        connectionNumber: `TAP-${assignedCustomerCode.replace('HYT-', '')}`,
        meterNumber: request.meterNumber || `M-${assignedCustomerCode}`,
        status: 'ACTIVE',
        monthlyFixedCharge: 150,
        registrationDate: new Date().toISOString().split('T')[0],
        connectionDate: new Date().toISOString().split('T')[0],
        tariffId: 'tariff-domestic',
        openingBalance: 0,
        currentBalance: 0,
        userId: request.userId,
        createdAt: now,
        updatedAt: now,
      };

      await saveHousehold(newHousehold);
    } else if (request.requestType === 'EXISTING_HOUSEHOLD_LINK') {
      const existing = await getHouseholdByCustomerCode(assignedCustomerCode);
      if (existing) {
        householdId = existing.id;
        await updateHousehold(existing.id, {
          userId: request.userId,
          email: request.email || existing.email,
          phoneNumber: request.phoneNumber || existing.phoneNumber,
        });
      }
    }

    // Link user profile if applicant has an account
    if (request.userId) {
      try {
        const userRef = doc(db, 'users', request.userId);
        await updateDoc(userRef, {
          customerId: assignedCustomerCode,
          isApproved: true,
          updatedAt: now,
        });
      } catch (err) {
        console.warn('Could not update user profile after request approval:', err);
      }
    }

    // Update request document
    const reqRef = doc(db, 'registrationRequests', request.id);
    await updateDoc(reqRef, {
      status: 'APPROVED',
      assignedCustomerCode,
      assignedHouseholdId: householdId,
      reviewedBy: reviewerName,
      reviewedByEmail: reviewerEmail,
      reviewedAt: now,
      updatedAt: now,
      adminNotes: adminNotes || 'Approved by Water Committee Admin',
    });

    await createAuditLog(
      'APPROVE_REGISTRATION_REQUEST',
      'RegistrationRequest',
      request.id,
      `Approved request for ${request.fullName}. Assigned permanent ID: ${assignedCustomerCode}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function rejectRegistrationRequest(
  requestId: string,
  rejectionReason: string
): Promise<void> {
  const path = `registrationRequests/${requestId}`;
  const now = new Date().toISOString();
  const reviewerEmail = auth.currentUser?.email || 'hayutarkhanepani@gmail.com';
  const reviewerName = auth.currentUser?.displayName || 'Committee Admin';

  try {
    const reqRef = doc(db, 'registrationRequests', requestId);
    await updateDoc(reqRef, {
      status: 'REJECTED',
      rejectionReason: rejectionReason || 'Information not verified',
      reviewedBy: reviewerName,
      reviewedByEmail: reviewerEmail,
      reviewedAt: now,
      updatedAt: now,
    });

    await createAuditLog(
      'REJECT_REGISTRATION_REQUEST',
      'RegistrationRequest',
      requestId,
      `Rejected registration request ${requestId}. Reason: ${rejectionReason}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// ----------------------------------------------------------------------
// Permission-Controlled Manual Date Correction with Audit Trail
// ----------------------------------------------------------------------

export async function correctPaymentDate(
  paymentId: string,
  newDate: string,
  correctionReason: string
): Promise<void> {
  const path = `payments/${paymentId}`;
  const now = new Date().toISOString();
  const correctorEmail = auth.currentUser?.email || 'hayutarkhanepani@gmail.com';
  const correctorName = auth.currentUser?.displayName || 'Authorized Admin';

  try {
    const payRef = doc(db, 'payments', paymentId);
    const snap = await getDoc(payRef);
    if (!snap.exists()) {
      throw new Error(`Payment #${paymentId} not found`);
    }
    const currentPayment = snap.data() as Payment;

    await updateDoc(payRef, {
      date: newDate,
      correctedDate: newDate,
      correctionReason,
      correctedBy: `${correctorName} (${correctorEmail})`,
      correctedAt: now,
      updatedAt: now,
    });

    await createAuditLog(
      'DATE_CORRECTION',
      'Payment',
      paymentId,
      `Corrected transaction date for Receipt ${currentPayment.receiptNumber} (${currentPayment.customerName}, ${currentPayment.customerId}) from "${currentPayment.date}" to "${newDate}". Reason: ${correctionReason}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

