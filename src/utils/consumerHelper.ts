import { Household, Bill, Payment, Voucher } from '../types';

export interface ResolvedConsumerInfo {
  fullName: string;
  customerCode: string;
  householdNumber: string;
  connectionNumber: string;
  meterNumber: string;
  ward: string;
  tole: string;
  address: string;
  phoneNumber: string;
  email: string;
  category: string;
  status: string;
  monthlyFixedCharge: number;
  currentBalance: number;
  openingBalance: number;
  registrationDate: string;
  isVerified: boolean;
  verificationStatusText: string;
}

/**
 * Robust extractor that inspects multiple possible field names across
 * Firestore document schemas (e.g. ownerName vs customerName vs name vs fullName).
 */
export function extractConsumerField(obj: any, keys: string[], defaultVal = ''): string {
  if (!obj || typeof obj !== 'object') return defaultVal;
  for (const k of keys) {
    const val = obj[k];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return defaultVal;
}

/**
 * Resolves full consumer identity by combining record fields with the matching
 * Household document from the database or cache.
 */
export function resolveConsumerInfo(
  target: Partial<Bill> | Partial<Payment> | Partial<Voucher> | Partial<Household> | Record<string, any> | null | undefined,
  households: Household[] = []
): ResolvedConsumerInfo {
  if (!target) {
    return {
      fullName: 'उपलब्ध छैन',
      customerCode: 'उपलब्ध छैन',
      householdNumber: 'उपलब्ध छैन',
      connectionNumber: 'उपलब्ध छैन',
      meterNumber: 'उपलब्ध छैन',
      ward: 'उपलब्ध छैन',
      tole: '',
      address: 'उपलब्ध छैन',
      phoneNumber: 'उपलब्ध छैन',
      email: 'उपलब्ध छैन',
      category: 'Residential',
      status: 'ACTIVE',
      monthlyFixedCharge: 150,
      currentBalance: 0,
      openingBalance: 0,
      registrationDate: 'उपलब्ध छैन',
      isVerified: true,
      verificationStatusText: 'प्रमाणित',
    };
  }

  // 1. Identify primary lookup codes
  const candidateCode = extractConsumerField(target, [
    'customerCode',
    'customerId',
    'consumerCode',
    'consumerId',
    'code',
  ]);

  const candidateHouseholdId = extractConsumerField(target, ['householdId', 'id']);
  const candidateHouseNo = extractConsumerField(target, ['householdNumber', 'houseNumber', 'hhdNumber']);

  // 2. Lookup matching household from available households list
  const matchedHousehold = households.find((h) => {
    if (candidateCode && (h.customerCode === candidateCode || (h as any).customerId === candidateCode || h.id === candidateCode)) {
      return true;
    }
    if (candidateHouseholdId && (h.id === candidateHouseholdId || h.customerCode === candidateHouseholdId)) {
      return true;
    }
    if (candidateHouseNo && h.householdNumber && h.householdNumber === candidateHouseNo) {
      return true;
    }
    return false;
  });

  // 3. Extract Full Name with prioritized fallbacks
  const fullName =
    extractConsumerField(matchedHousehold, ['ownerName', 'customerName', 'name', 'fullName', 'consumerName']) ||
    extractConsumerField(target, ['customerName', 'ownerName', 'name', 'fullName', 'consumerName']) ||
    'उपलब्ध छैन';

  // 4. Permanent Customer Code
  const customerCode =
    extractConsumerField(matchedHousehold, ['customerCode', 'customerId', 'consumerCode']) ||
    candidateCode ||
    'उपलब्ध छैन';

  // 5. Household / House No
  const householdNumber =
    extractConsumerField(matchedHousehold, ['householdNumber', 'houseNumber', 'hhdNumber']) ||
    candidateHouseNo ||
    'उपलब्ध छैन';

  // 6. Connection / Tap No
  const connectionNumber =
    extractConsumerField(matchedHousehold, ['connectionNumber', 'connectionNo', 'tapNumber', 'tapNo']) ||
    extractConsumerField(target, ['connectionNumber', 'connectionNo']) ||
    householdNumber;

  // 7. Meter No
  const meterNumber =
    extractConsumerField(matchedHousehold, ['meterNumber', 'meterNo']) ||
    extractConsumerField(target, ['meterNumber', 'meterNo']) ||
    (customerCode !== 'उपलब्ध छैन' ? `M-${customerCode}` : 'उपलब्ध छैन');

  // 8. Ward & Tole
  const ward =
    extractConsumerField(matchedHousehold, ['ward', 'wardNumber', 'wardNo']) ||
    extractConsumerField(target, ['ward', 'wardNumber', 'wardNo']) ||
    'उपलब्ध छैन';

  const tole =
    extractConsumerField(matchedHousehold, ['tole', 'toleName']) ||
    extractConsumerField(target, ['tole', 'toleName']) ||
    '';

  // 9. Full Address
  const address =
    extractConsumerField(matchedHousehold, ['address', 'fullAddress']) ||
    extractConsumerField(target, ['address', 'fullAddress']) ||
    (ward !== 'उपलब्ध छैन' ? `वडा नं ${ward}${tole ? `, ${tole}` : ''}, हायुटार` : 'उपलब्ध छैन');

  // 10. Phone & Email
  const phoneNumber =
    extractConsumerField(matchedHousehold, ['phoneNumber', 'phone', 'mobile', 'contactNumber']) ||
    extractConsumerField(target, ['phoneNumber', 'phone', 'mobile']) ||
    'उपलब्ध छैन';

  const email =
    extractConsumerField(matchedHousehold, ['email', 'emailAddress']) ||
    extractConsumerField(target, ['email']) ||
    'उपलब्ध छैन';

  // 11. Category & Tariffs
  const category =
    extractConsumerField(matchedHousehold, ['category', 'consumerCategory']) ||
    extractConsumerField(target, ['category', 'consumerCategory']) ||
    'Residential';

  const status =
    extractConsumerField(matchedHousehold, ['status']) ||
    extractConsumerField(target, ['status']) ||
    'ACTIVE';

  const monthlyFixedCharge =
    Number(matchedHousehold?.monthlyFixedCharge) ||
    Number((target as any)?.monthlyCharge) ||
    150;

  const currentBalance =
    matchedHousehold?.currentBalance !== undefined
      ? Number(matchedHousehold.currentBalance)
      : (target as any)?.currentBalance !== undefined
      ? Number((target as any).currentBalance)
      : (target as any)?.balanceDue !== undefined
      ? Number((target as any).balanceDue)
      : 0;

  const openingBalance =
    Number(matchedHousehold?.openingBalance) ||
    Number((target as any)?.openingBalance) ||
    0;

  const registrationDate =
    extractConsumerField(matchedHousehold, ['registrationDate', 'createdAt', 'connectionDate']) ||
    extractConsumerField(target, ['registrationDate', 'createdAt', 'issueDate']) ||
    'उपलब्ध छैन';

  const isVerified = !(matchedHousehold?.needsVerification || matchedHousehold?.duplicateNameFlag);
  const verificationStatusText = isVerified ? 'प्रमाणित (Verified)' : 'पुष्टि गर्न बाँकी (Verification Pending)';

  return {
    fullName,
    customerCode,
    householdNumber,
    connectionNumber,
    meterNumber,
    ward,
    tole,
    address,
    phoneNumber,
    email,
    category,
    status,
    monthlyFixedCharge,
    currentBalance,
    openingBalance,
    registrationDate,
    isVerified,
    verificationStatusText,
  };
}
