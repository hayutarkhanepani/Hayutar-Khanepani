export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'AREA_STAFF' | 'BILLING_STAFF' | 'CUSTOMER';

export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber?: string | null;
  address?: string;
  notes?: string;
  role: UserRole;
  staffId?: string; // Unique permanent staff ID (e.g. STF-001)
  customerId?: string; // Links to Household customerCode or ID
  householdNumber?: string;
  isApproved?: boolean;
  isActive?: boolean;
  accountStatus?: AccountStatus;
  assignedWards?: string[]; // Used by AREA_STAFF (e.g. ["1", "2"])
  assignedToles?: string[]; // Used by AREA_STAFF (e.g. ["Bazar Tole"])
  designation?: string; // e.g. "Water Supply Secretary", "Area Meter Reader"
  deactivatedAt?: string;
  deactivatedBy?: string;
  deactivationReason?: string;
  reactivatedAt?: string;
  reactivatedBy?: string;
  reactivationReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type HouseholdStatus = 'ACTIVE' | 'INACTIVE';
export type TariffCategory = 'DOMESTIC' | 'COMMERCIAL' | 'INSTITUTIONAL';

export interface ConsumerCategory {
  id: string;
  code: string; // e.g. RESIDENTIAL, COMMERCIAL, INSTITUTIONAL, GOVERNMENT, OTHER
  name: string; // e.g. Residential, Commercial
  nameNepali: string; // e.g. घरेलु / आवासीय, व्यापारिक
  standardMonthlyCharge: number;
  latePenaltyPercentage: number;
  earlyDiscountPercentage: number;
  sanitationFee: number;
  maintenanceFee: number;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Household {
  id: string;
  customerCode: string; // Permanent unique customer code e.g. HYT-00101
  householdNumber: string; // e.g. H-104 or १-२३
  ownerName: string;
  ward: string; // e.g. "1", "2", "3"
  tole: string; // e.g. "Bazar Tole", "Dharapani"
  address: string;
  phoneNumber: string;
  email?: string;
  category?: string; // e.g. 'Residential', 'Commercial', 'Institutional', 'Government', 'Other'
  connectionNumber?: string; // धारा जडान नं
  meterNumber: string;
  status: HouseholdStatus;
  monthlyFixedCharge: number; // Fixed monthly fee (e.g. 150)
  registrationDate: string; // YYYY-MM-DD or BS date
  connectionDate: string;
  tariffId: string;
  openingBalance: number;
  currentBalance: number;
  lastMeterReading?: number;
  userId?: string; // Linked Firebase Auth UID
  needsVerification?: boolean; // Flagged when duplicate name or review required
  verificationReason?: string;
  duplicateNameFlag?: boolean;
  cardPrintedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WardInfo {
  id: string;
  wardNumber: string; // "1", "2", ...
  name: string; // "वडा नं १ (Ward 1)"
  toles: string[];
  inchargeStaffId?: string;
  inchargeStaffName?: string;
  householdCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Tariff {
  id: string;
  name: string;
  nameNepali: string;
  category: TariffCategory;
  standardMonthlyCharge: number; // Fixed monthly fee
  minUnits?: number;
  perUnitRate?: number;
  sanitationFee: number;
  maintenanceFee?: number;
  latePenaltyPercentage: number;
  earlyDiscountPercentage: number;
  effectiveStartDate: string;
  inactiveHouseholdCharge: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type BillStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED';

export interface Bill {
  id: string;
  billNumber: string; // e.g. BIL-2082-01-0001
  customerId: string; // customerCode or household id
  householdId: string;
  householdNumber: string;
  customerName: string;
  ward: string;
  tole?: string;
  category?: string;
  billingMonth: string; // e.g. "Baishakh"
  billingYear: string; // e.g. "2082"
  nepaliMonthYear: string; // e.g. "बैशाख २०८२"
  previousReading?: number;
  currentReading?: number;
  unitsConsumed?: number;
  previousBalance: number;
  monthlyCharge: number; // Fixed monthly charge
  minCharge?: number;
  meterCharge?: number;
  sanitationCharge: number;
  additionalCharges?: { name: string; amount: number }[];
  penaltyAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  issueDate: string;
  dueDate: string;
  status: BillStatus;
  tariffId?: string;
  tariffSnapshot?: {
    name: string;
    standardMonthlyCharge: number;
    sanitationFee: number;
    latePenaltyPercentage: number;
    earlyDiscountPercentage: number;
  };
  adjustmentAmount?: number;
  maintenanceFee?: number;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PaymentMethod = 'CASH' | 'CHEQUE' | 'BANK_DEPOSIT' | 'BANK_TRANSFER' | 'ESEWA' | 'KHALTI' | 'CONNECT_IPS';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Payment {
  id: string;
  receiptNumber: string; // e.g. RCP-2082-0001
  customerId: string;
  householdId?: string;
  householdNumber: string;
  customerName: string;
  ward?: string;
  category?: string;
  billId?: string;
  billNumber?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionReference: string; // Bank slip no, Cash voucher no, Cheque no
  status: PaymentStatus;
  receivedBy: string; // UID or Staff ID of cashier/admin
  staffName: string;
  remarks?: string;
  notes?: string;
  date: string; // Nepali/English date
  createdAt?: string;
  userId?: string;
  // Audit correction fields
  correctedDate?: string;
  correctionReason?: string;
  correctedBy?: string;
  correctedAt?: string;
}

export interface Voucher {
  id: string;
  voucherNumber: string; // VCH-2082-0001
  customerId: string;
  householdId?: string;
  householdNumber: string;
  customerName: string;
  ward?: string;
  tole?: string;
  billId?: string;
  billNumber?: string;
  billingPeriod: string;
  amountDue: number;
  outstandingBalance: number;
  issueDate: string;
  expiryDate: string;
  status: 'UNPAID' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  instructions?: string;
  createdAt?: string;
  userId?: string;
}

export interface DateTimeSettings {
  timeZone: string; // e.g. "Asia/Kathmandu"
  dateFormatPreference: 'BS_PRIMARY_AD_SECONDARY' | 'BS_ONLY' | 'AD_ONLY' | 'BOTH_SIDE_BY_SIDE';
  timeFormatPreference: '12H' | '24H';
  displayCalendar: 'BS' | 'AD';
}

export interface ReceiptTemplateSettings {
  receiptTitleNepali: string; // e.g. "नगद / महसुल भुक्तानी आधिकारिक रसिद"
  receiptTitleEnglish: string; // e.g. "Official Payment Receipt"
  waterProjectNameNepali?: string; // e.g. "हायुटार बृहत् खानेपानी तथा सरसफाइ आयोजना"
  headerAddressNepali?: string; // e.g. "वडा कार्यालय परिसर, हायुटार, नेपाल"
  phone?: string;
  panNumber?: string;
  registrationNumber?: string;
  showLogo?: boolean;
  logoUrl?: string;
  showQrCode?: boolean;
  paperLayout: 'DUAL_A4' | 'SINGLE_A4' | 'POS80'; // Dual A4 = 2 copies on 1 A4 sheet
  officeCopyLabelNepali?: string; // "कार्यालय प्रति (OFFICE COPY)"
  customerCopyLabelNepali?: string; // "ग्राहक प्रति (CUSTOMER COPY)"
  showCutLine?: boolean;
  receiptNotice?: string;
  termsAndConditions?: string;
  cashierTitleNepali?: string; // "रकम बुझिलिने (क्यासियर)"
  accountantTitleNepali?: string; // "लेखापाल / काउन्टर प्रमुख"
  chairpersonTitleNepali?: string; // "अध्यक्ष / संयोजक"
  showSignatures?: boolean;
  showSealSpace?: boolean;
  showPreviousDueBreakdown?: boolean;
  showAdvanceBalance?: boolean;
  density: 'compact' | 'normal' | 'spacious';
  borderStyle: 'solid' | 'double' | 'clean';
}

export type RegistrationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ConsumerRegistrationRequest {
  id: string;
  requestType: 'NEW_CONNECTION' | 'EXISTING_HOUSEHOLD_LINK';
  fullName: string;
  phoneNumber: string;
  email?: string;
  ward: string;
  tole?: string;
  address?: string;
  meterNumber?: string;
  existingCustomerCode?: string; // If claiming existing household
  applicantNotes?: string;
  status: RegistrationRequestStatus;
  reviewedBy?: string;
  reviewedByEmail?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  assignedCustomerCode?: string;
  assignedHouseholdId?: string;
  userId?: string; // Auth UID
  createdAt: string;
  updatedAt?: string;
}

export interface BillTemplateSettings {
  headerTitleNepali?: string;
  headerTitleEnglish?: string;
  tagline?: string;
  showLogo?: boolean;
  logoUrl?: string;
  showQrCode?: boolean;
  paperSize?: 'A4' | 'A5' | 'POS80';
  termsAndConditions?: string;
  preparedByTitle?: string;
  approvedByTitle?: string;
  accountantTitle?: string;
  showSignatures?: boolean;
  showSealSpace?: boolean;
  // Receipt Template Fields
  receiptTitleNepali?: string;
  receiptTitleEnglish?: string;
  receiptNotice?: string;
  receiptCashierTitle?: string;
}

export interface CommitteeSettings {
  id: string;
  committeeName: string;
  committeeNameNepali: string;
  registrationNumber: string;
  address: string;
  phone: string;
  email: string;
  currentFiscalYear: string; // e.g. 2081/82
  standardMonthlyCharge: number; // default monthly fixed fee
  effectiveStartDate: string;
  billingDueDayOfMonth: number; // e.g. 20th
  latePenaltyDays: number;
  latePenaltyPercentage: number;
  earlyDiscountDays: number;
  earlyDiscountPercentage: number;
  sanitationFee: number;
  maintenanceFee: number;
  inactiveHouseholdCharge: number; // rule for inactive households
  allowPartialPayments: boolean;

  // Counter & Office Details (Admin Settings)
  counterOpeningTime?: string; // e.g. "बिहान १०:०० (10:00 AM)"
  counterClosingTime?: string; // e.g. "दिउँसो ४:०० (4:00 PM)"
  counterWorkingDays?: string; // e.g. "आइतबार देखि शुक्रबार (सार्वजनिक बिदा बाहेक)"
  panNumber?: string;
  logoUrl?: string;
  tagline?: string;

  // Public Notice / Announcement Banner
  publicNotice?: string;
  publicNoticeActive?: boolean;
  publicNoticeType?: 'info' | 'warning' | 'urgent';

  // Bill & Receipt Template Settings
  billTemplate?: BillTemplateSettings;
  receiptTemplate?: ReceiptTemplateSettings;
  dateTimeSettings?: DateTimeSettings;

  // Future Payment Gateways & Bank details configuration (disabled by default)
  onlineGatewaysActive?: boolean; // Must remain false until explicitly enabled
  bankVouchersActive?: boolean; // Must remain false until explicitly enabled
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  bankAccountHolder?: string;
  esewaMerchantCode?: string;
  khaltiPublicKey?: string;
  connectIpsMerchantId?: string;
  gatewaysEnabled?: {
    esewa: boolean;
    khalti: boolean;
    connectIps: boolean;
  };
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  performedBy: string;
  userEmail: string;
  details: string;
  timestamp: string;
  createdAt?: string;
  actorUid?: string;
  staffId?: string;
}

export type HandoverStatus = 'PENDING_REVIEW' | 'APPROVED' | 'DISCREPANCY_FLAGGED';

export interface StaffCashHandover {
  id: string;
  staffUid: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  reconciliationDate: string;
  periodStart: string;
  periodEnd: string;
  shift?: 'MORNING' | 'DAY' | 'EVENING' | 'FULL_DAY';
  openingBalance: number;
  cashCollected: number;
  bankCollected: number;
  onlineCollected: number;
  totalCollected: number;
  refundsOrReversals: number;
  expectedClosingCash: number;
  actualCountedCash: number;
  difference: number;
  staffExplanation?: string;
  status: HandoverStatus;
  reviewedBy?: string;
  reviewedByEmail?: string;
  reviewedAt?: string;
  reviewerNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StaffActivitySummary {
  staffUid: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  role: UserRole | string;
  accountStatus: AccountStatus | string;
  billsCreatedCount: number;
  billsCreatedTotal: number;
  billsCancelledCount: number;
  billsCancelledTotal: number;
  billsCorrectedCount: number;
  paymentsCount: number;
  paymentsTotal: number;
  cashPaymentsTotal: number;
  bankPaymentsTotal: number;
  onlinePaymentsTotal: number;
  receiptsIssuedCount: number;
  receiptsCancelledCount: number;
  consumersCreatedCount: number;
  consumersUpdatedCount: number;
  handoversCount: number;
  totalCountedCashHandedOver: number;
  totalDiscrepancyAmount: number;
  pendingReviewsCount: number;
  activitiesCount: number;
}


// Column mapping for Excel/CSV import
export interface ColumnMapping {
  customerCode: string;
  householdNumber: string;
  ownerName: string;
  ward: string;
  tole: string;
  address: string;
  phoneNumber: string;
  email: string;
  category: string;
  connectionNumber: string;
  monthlyFixedCharge: string;
  status: string;
  registrationDate: string;
  openingBalance: string;
}
