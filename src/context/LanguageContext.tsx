import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ne' | 'en';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<string, { en: string; ne: string }> = {
  // App Header & Branding
  appName: { en: 'Water Supply Billing Management System', ne: 'खानेपानी उपभोक्ता समिति महसुल व्यवस्थापन प्रणाली' },
  committeeDefaultName: { en: 'Hayutar Drinking Water & Sanitation Consumer Committee', ne: 'श्री हायुटार खानेपानी तथा सरसफाइ उपभोक्ता समिति' },
  tagline: { en: 'Clean, Safe Drinking Water for Every Household', ne: 'प्रत्येक घरधुरीमा स्वच्छ तथा सुरक्षित खानेपानी सेवा' },

  // Navigation
  navHome: { en: 'Home', ne: 'गृहपृष्ठ' },
  navHouseholds: { en: 'Households', ne: 'घरधुरी व्यवस्थापन' },
  navBilling: { en: 'Billing Engine', ne: 'महसुल बिलिङ' },
  navCounterPayment: { en: 'Counter Payment', ne: 'काउन्टर भुक्तानी' },
  navReports: { en: 'Financial Reports', ne: 'आर्थिक प्रतिवेदन' },
  navTariff: { en: 'Tariff & Rules', ne: 'महसुल दररेट' },
  navAudit: { en: 'Audit Logs', ne: 'अडिट लग' },
  navMyAccount: { en: 'My Household', ne: 'मेरो घरधुरी' },
  navLogin: { en: 'Login', ne: 'लगइन' },
  navRegister: { en: 'Create ID', ne: 'नयाँ खाता खोल्नुहोस्' },
  navAdminLogin: { en: 'Admin Portal', ne: 'समिति प्रशासन' },
  navCustomerLogin: { en: 'Customer Portal', ne: 'उपभोक्ता पोर्टल' },
  navLogout: { en: 'Logout', ne: 'लगआउट' },

  // Household fields
  customerCode: { en: 'Customer Code', ne: 'ग्राहक नं' },
  householdNumber: { en: 'Household No.', ne: 'घर नं' },
  ownerName: { en: 'Consumer / Owner Name', ne: 'उपभोक्ताको नाम' },
  ward: { en: 'Ward', ne: 'वडा नं' },
  tole: { en: 'Tole / Village', ne: 'टोल / बस्ती' },
  address: { en: 'Address', ne: 'ठेगाना' },
  phoneNumber: { en: 'Mobile Number', ne: 'सम्पर्क मोबाइल नं' },
  meterNumber: { en: 'Meter No.', ne: 'मिटर नम्बर' },
  status: { en: 'Status', ne: 'स्थिति' },
  active: { en: 'Active', ne: 'सक्रिय' },
  inactive: { en: 'Inactive', ne: 'निष्क्रिय' },
  connectionDate: { en: 'Connection Date', ne: 'धारा जडान मिति' },
  currentBalance: { en: 'Current Balance', ne: 'हालको बाँकी रकम' },

  // Billing fields
  billNumber: { en: 'Bill No.', ne: 'बिल नं' },
  billingPeriod: { en: 'Billing Month', ne: 'बिलिङ महिना' },
  previousReading: { en: 'Previous Reading', ne: 'अघिल्लो रिडिङ' },
  currentReading: { en: 'Current Reading', ne: 'हालको रिडिङ' },
  unitsConsumed: { en: 'Units (Liters/Units)', ne: 'खपत युनिट' },
  minCharge: { en: 'Minimum Charge', ne: 'न्यूनतम महसुल' },
  meterCharge: { en: 'Consumption Charge', ne: 'अतिरिक्त युनिट महसुल' },
  sanitationCharge: { en: 'Sanitation Fee', ne: 'सरसफाइ शुल्क' },
  penalty: { en: 'Late Penalty', ne: 'विलम्ब शुल्क' },
  discount: { en: 'Early Discount', ne: 'छुट रकम' },
  totalDue: { en: 'Total Amount Due', ne: 'कुल बुझाउनुपर्ने रकम' },
  paidAmount: { en: 'Paid Amount', ne: 'बुझाइएको रकम' },
  balanceDue: { en: 'Remaining Balance', ne: 'बाँकी बक्यौता' },
  dueDate: { en: 'Due Date', ne: 'बुझाउने अन्तिम मिति' },
  generateBill: { en: 'Generate Monthly Bills', ne: 'मासिक बिल जारी गर्नुहोस्' },

  // Statuses
  unpaid: { en: 'Unpaid', ne: 'बुझाउन बाँकी' },
  paid: { en: 'Paid', ne: 'चुक्ता भएको' },
  partiallyPaid: { en: 'Partially Paid', ne: 'आंशिक भुक्तानी' },
  overdue: { en: 'Overdue', ne: 'म्याद नाघेको' },
  cancelled: { en: 'Cancelled', ne: 'रद्द गरिएको' },

  // Payments & Vouchers
  recordPayment: { en: 'Record Counter Payment', ne: 'काउन्टर रसिद काट्नुहोस्' },
  receiptNumber: { en: 'Receipt No.', ne: 'रसिद नं' },
  generateVoucher: { en: 'Generate Payment Voucher', ne: 'भुक्तानी भौचर सिर्जना गर्नुहोस्' },
  payNow: { en: 'Pay Online', ne: 'अनलाइन भुक्तानी गर्नुहोस्' },
  printBill: { en: 'Print Bill', ne: 'बिल छाप्नुहोस्' },
  printReceipt: { en: 'Print Receipt', ne: 'रसिद छाप्नुहोस्' },
  searchHousehold: { en: 'Search by Customer Code, Household No., or Name', ne: 'ग्राहक नं, घर नं वा नामबाट खोज्नुहोस्' },

  // Buttons & Actions
  save: { en: 'Save', ne: 'सुरक्षित गर्नुहोस्' },
  cancel: { en: 'Cancel', ne: 'रद्द गर्नुहोस्' },
  confirm: { en: 'Confirm', ne: 'निश्चित गर्नुहोस्' },
  exportCSV: { en: 'Export to CSV', ne: 'CSV मा डाउनलोड गर्नुहोस्' },
  importCSV: { en: 'Import CSV', ne: 'CSV बाट आयात गर्नुहोस्' },
  filter: { en: 'Filter', ne: 'छान्नुहोस्' },
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'ne',
  setLang: () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('ws_lang');
    return (saved === 'en' || saved === 'ne') ? saved : 'ne';
  });

  useEffect(() => {
    localStorage.setItem('ws_lang', lang);
  }, [lang]);

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][lang] || translations[key].en;
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
