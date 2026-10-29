export interface NepaliMonth {
  index: number;
  en: string;
  ne: string;
}

export const NEPALI_MONTHS: NepaliMonth[] = [
  { index: 1, en: 'Baishakh', ne: 'बैशाख' },
  { index: 2, en: 'Jestha', ne: 'जेठ' },
  { index: 3, en: 'Ashadh', ne: 'असार' },
  { index: 4, en: 'Shrawan', ne: 'साउन' },
  { index: 5, en: 'Bhadra', ne: 'भदौ' },
  { index: 6, en: 'Ashwin', ne: 'असोज' },
  { index: 7, en: 'Kartik', ne: 'कात्तिक' },
  { index: 8, en: 'Mangsir', ne: 'मंसिर' },
  { index: 9, en: 'Poush', ne: 'पुष' },
  { index: 10, en: 'Magh', ne: 'माघ' },
  { index: 11, en: 'Falgun', ne: 'फागुन' },
  { index: 12, en: 'Chaitra', ne: 'चैत' },
];

export const NEPALI_YEARS = ['2080', '2081', '2082', '2083', '2084'];

const NEPALI_NUMERALS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

export function toNepaliNumerals(num: number | string): string {
  if (num === undefined || num === null) return '';
  const str = String(num);
  return str.replace(/[0-9]/g, (digit) => NEPALI_NUMERALS[parseInt(digit, 10)]);
}

export function formatNPR(amount: number, language: 'en' | 'ne' = 'en'): string {
  const formattedNumber = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

  if (language === 'ne') {
    return `रु ${toNepaliNumerals(formattedNumber)}`;
  }
  return `NPR ${formattedNumber}`;
}

export function getCurrentBSMonthYear(): { year: string; monthIndex: number; monthEn: string; monthNe: string; label: string } {
  // Rough Gregorian to Bikram Sambat approximation:
  // BS is ~56 years and 8.5 months ahead of AD.
  // Today in 2026 October corresponds to BS 2083 Ashwin/Kartik
  const date = new Date();
  const adYear = date.getFullYear();
  const adMonth = date.getMonth(); // 0-indexed (0=Jan, 9=Oct)

  // In mid-April, BS year increments.
  let bsYear = adYear + 56;
  let bsMonthIndex = 1;

  if (adMonth >= 3) {
    // April is month 3
    if (adMonth === 3 && date.getDate() < 14) {
      bsYear = adYear + 56;
      bsMonthIndex = 12; // Chaitra
    } else {
      bsYear = adYear + 57;
      // Map Gregorian month to approximate BS month
      const mapping = [0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // April=1 (Baishakh), May=2, ...
      bsMonthIndex = mapping[adMonth] || 1;
    }
  } else {
    // Jan, Feb, Mar
    bsYear = adYear + 56;
    const mapping = [9, 10, 11]; // Jan=Poush/Magh, Feb=Magh/Falgun, Mar=Falgun/Chaitra
    bsMonthIndex = mapping[adMonth] || 10;
  }

  // Bound to reasonable BS range
  const yearStr = String(bsYear);
  const monthObj = NEPALI_MONTHS[bsMonthIndex - 1] || NEPALI_MONTHS[0];

  return {
    year: yearStr,
    monthIndex: monthObj.index,
    monthEn: monthObj.en,
    monthNe: monthObj.ne,
    label: `${monthObj.ne} ${toNepaliNumerals(yearStr)} (${monthObj.en} ${yearStr})`,
  };
}

export function getTodayBSDateString(): string {
  const { year, monthIndex } = getCurrentBSMonthYear();
  const day = new Date().getDate();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${year}-${pad(monthIndex)}-${pad(day)}`;
}

export const DEFAULT_DATETIME_SETTINGS: {
  timeZone: string;
  dateFormatPreference: 'BS_PRIMARY_AD_SECONDARY' | 'BS_ONLY' | 'AD_ONLY' | 'BOTH_SIDE_BY_SIDE';
  timeFormatPreference: '12H' | '24H';
  displayCalendar: 'BS' | 'AD';
} = {
  timeZone: 'Asia/Kathmandu',
  dateFormatPreference: 'BS_PRIMARY_AD_SECONDARY',
  timeFormatPreference: '12H',
  displayCalendar: 'BS',
};

/**
 * Converts a Gregorian date object to approximate Bikram Sambat date
 */
export function convertADtoApproxBS(adDate: Date): { year: number; month: number; day: number; bsDateString: string } {
  const adYear = adDate.getFullYear();
  const adMonth = adDate.getMonth(); // 0-11
  const adDay = adDate.getDate();

  let bsYear = adYear + 56;
  let bsMonth = 1;
  let bsDay = adDay;

  // Approximate Nepal BS calendar conversion
  if (adMonth >= 3) {
    if (adMonth === 3 && adDay < 14) {
      bsYear = adYear + 56;
      bsMonth = 12; // Chaitra
      bsDay = adDay + 17;
    } else {
      bsYear = adYear + 57;
      const monthOffsets = [0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      bsMonth = monthOffsets[adMonth] || 1;
      // Day offset: around mid-month in Gregorian marks start of Nepali month (14-17th)
      if (adDay >= 15) {
        bsDay = adDay - 14;
      } else {
        bsMonth = bsMonth > 1 ? bsMonth - 1 : 12;
        bsDay = adDay + 16;
      }
    }
  } else {
    bsYear = adYear + 56;
    const winterMonths = [9, 10, 11]; // Jan, Feb, Mar
    bsMonth = winterMonths[adMonth] || 10;
    if (adDay >= 15) {
      bsDay = adDay - 14;
    } else {
      bsMonth = bsMonth > 1 ? bsMonth - 1 : 12;
      bsDay = adDay + 16;
    }
  }

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return {
    year: bsYear,
    month: bsMonth,
    day: bsDay,
    bsDateString: `${bsYear}-${pad(bsMonth)}-${pad(bsDay)}`,
  };
}

/**
 * Formats system date and time according to committee settings
 */
export function formatSystemDateTime(
  dateInput?: string | Date | null,
  options: {
    settings?: {
      timeZone?: string;
      dateFormatPreference?: 'BS_PRIMARY_AD_SECONDARY' | 'BS_ONLY' | 'AD_ONLY' | 'BOTH_SIDE_BY_SIDE';
      timeFormatPreference?: '12H' | '24H';
      displayCalendar?: 'BS' | 'AD';
    };
    includeTime?: boolean;
    lang?: 'en' | 'ne';
  } = {}
): string {
  if (!dateInput) return '-';

  const { settings = DEFAULT_DATETIME_SETTINGS, includeTime = false, lang = 'ne' } = options;
  const pref = settings.dateFormatPreference || 'BS_PRIMARY_AD_SECONDARY';
  const timePref = settings.timeFormatPreference || '12H';

  // If dateInput is pure BS date string e.g. "2081-05-12" or "2081/05/12"
  if (typeof dateInput === 'string' && /^(20[7-9]\d)[-/](\d{1,2})[-/](\d{1,2})/.test(dateInput.trim())) {
    const parts = dateInput.trim().split(/[-/]/);
    const bsY = parts[0];
    const bsM = parts[1].padStart(2, '0');
    const bsD = parts[2].split(' ')[0].padStart(2, '0');
    const bsFormatted = `${bsY}/${bsM}/${bsD}`;

    if (pref === 'BS_ONLY') {
      return lang === 'ne' ? toNepaliNumerals(bsFormatted) : bsFormatted;
    }
    if (pref === 'BOTH_SIDE_BY_SIDE') {
      return lang === 'ne'
        ? `वि.सं. ${toNepaliNumerals(bsFormatted)}`
        : `BS ${bsFormatted}`;
    }
    return lang === 'ne' ? toNepaliNumerals(bsFormatted) : bsFormatted;
  }

  // Parse as AD Date
  let parsedDate: Date;
  if (dateInput instanceof Date) {
    parsedDate = dateInput;
  } else {
    parsedDate = new Date(dateInput);
    if (isNaN(parsedDate.getTime())) {
      return String(dateInput);
    }
  }

  // Calculate BS representation
  const bs = convertADtoApproxBS(parsedDate);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const adFormatted = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`;
  const bsFormatted = `${bs.year}/${pad(bs.month)}/${pad(bs.day)}`;

  let datePart = '';
  switch (pref) {
    case 'BS_ONLY':
      datePart = lang === 'ne' ? toNepaliNumerals(bsFormatted) : bsFormatted;
      break;
    case 'AD_ONLY':
      datePart = adFormatted;
      break;
    case 'BOTH_SIDE_BY_SIDE':
      datePart =
        lang === 'ne'
          ? `वि.सं. ${toNepaliNumerals(bsFormatted)} / सन् ${adFormatted}`
          : `BS ${bsFormatted} / AD ${adFormatted}`;
      break;
    case 'BS_PRIMARY_AD_SECONDARY':
    default:
      datePart =
        lang === 'ne'
          ? `${toNepaliNumerals(bsFormatted)} (${adFormatted})`
          : `${bsFormatted} (${adFormatted})`;
      break;
  }

  if (!includeTime) {
    return datePart;
  }

  // Time formatting in Kathmandu timezone
  try {
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: timePref === '12H',
      timeZone: settings.timeZone || 'Asia/Kathmandu',
    };
    const timeStr = new Intl.DateTimeFormat('en-US', timeOptions).format(parsedDate);
    const timeFormatted = lang === 'ne' ? toNepaliNumerals(timeStr) : timeStr;
    return `${datePart} ${timeFormatted}`;
  } catch {
    const hours = parsedDate.getHours();
    const minutes = parsedDate.getMinutes();
    const timeStr = `${pad(hours)}:${pad(minutes)}`;
    return `${datePart} ${timeStr}`;
  }
}
