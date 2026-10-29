import { Bill, Household, Payment } from '../types';
import { NEPALI_MONTHS } from './nepaliCalendar';

/**
 * Get 1-based index (1-12) for a Nepali month in either English (Baishakh) or Nepali (बैशाख).
 */
export function getNepaliMonthIndex(monthStr?: string): number {
  if (!monthStr) return 1;
  const clean = monthStr.trim().toLowerCase();
  const found = NEPALI_MONTHS.find(
    (m) => m.en.toLowerCase() === clean || m.ne.toLowerCase() === clean
  );
  return found ? found.index : 1;
}

/**
 * Returns a strictly monotonic numeric score for any Nepali billing period.
 * e.g. Year 2081, Month Baishakh (1) -> 208101
 *      Year 2081, Month Jestha (2)   -> 208102
 *      Year 2082, Month Baishakh (1) -> 208201
 */
export function getPeriodScore(year: string | number, monthStr: string): number {
  const y = typeof year === 'string' ? parseInt(year.replace(/\D/g, ''), 10) || 2080 : year;
  const m = getNepaliMonthIndex(monthStr);
  return y * 100 + m;
}

/**
 * Sort bills strictly chronologically from oldest period to newest period.
 */
export function sortBillsChronologically(bills: Bill[]): Bill[] {
  return [...bills].sort((a, b) => {
    const scoreA = getPeriodScore(a.billingYear, a.billingMonth);
    const scoreB = getPeriodScore(b.billingYear, b.billingMonth);
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    // Secondary sort by creation timestamp
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
}

/**
 * Calculates the pure periodic charges for a specific bill cycle.
 * Does NOT include past dues (previousBalance).
 */
export function calculateBillPeriodicCharge(b: Partial<Bill>): number {
  const monthly = Number(b.monthlyCharge) || 0;
  const sanitation = Number(b.sanitationCharge) || 0;
  const maintenance = Number(b.maintenanceFee) || 0;
  const penalty = Number(b.penaltyAmount) || 0;
  const discount = Number(b.discountAmount) || 0;
  const adjustment = Number(b.adjustmentAmount) || 0;

  return Math.max(0, monthly + sanitation + maintenance + penalty - discount + adjustment);
}

export interface ReconciledLedgerResult {
  openingBalance: number;
  totalValidPeriodicCharges: number;
  totalPayments: number;
  netOutstandingBalance: number;
  reconciledBills: Bill[];
  billsRequiringUpdate: Bill[];
}

/**
 * Pure ledger cascade reconciliation for a single customer.
 *
 * Rules:
 * 1. Cancelled bills have 0 effective charges and do not roll over into subsequent bills.
 * 2. Previous balance for bill (i) is strictly the unpaid residual prior to bill (i).
 * 3. Total amount for bill (i) = previousBalance + currentPeriodCharge.
 * 4. Payments reduce the customer's balance and allocate to bills.
 * 5. Eliminates any legacy compounding errors from mistakenly generated bulk bills.
 */
export function reconcileCustomerLedgerInMem(
  household: Household,
  customerBills: Bill[],
  customerPayments: Payment[]
): ReconciledLedgerResult {
  const sortedBills = sortBillsChronologically(customerBills);
  const validPayments = customerPayments.filter((p) => p.status === 'COMPLETED' || !p.status);
  const totalPaymentsAmount = validPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const openingBalance = Number(household.openingBalance) || 0;
  let runningUnpaidBalance = openingBalance;
  let remainingPaymentPool = totalPaymentsAmount;
  let totalValidPeriodicCharges = 0;

  const reconciledBills: Bill[] = [];
  const billsRequiringUpdate: Bill[] = [];

  for (const b of sortedBills) {
    if (b.status === 'CANCELLED') {
      // Cancelled bills do NOT advance running balance and do not carry charges forward.
      const updated: Bill = {
        ...b,
        balanceDue: 0,
        status: 'CANCELLED',
      };
      reconciledBills.push(updated);
      if (b.balanceDue !== 0) {
        billsRequiringUpdate.push(updated);
      }
      continue;
    }

    // Active bill
    const currentPeriodCharge = calculateBillPeriodicCharge(b);
    totalValidPeriodicCharges += currentPeriodCharge;

    const correctPreviousBalance = Math.max(0, runningUnpaidBalance);
    const correctTotalAmount = correctPreviousBalance + currentPeriodCharge;

    // Allocate available customer payment pool to this bill
    const billPayment = Math.min(correctTotalAmount, remainingPaymentPool);
    remainingPaymentPool = Math.max(0, remainingPaymentPool - billPayment);

    const correctBalanceDue = Math.max(0, correctTotalAmount - billPayment);

    let correctStatus = b.status;
    if (correctBalanceDue === 0 && correctTotalAmount > 0) {
      correctStatus = 'PAID';
    } else if (billPayment > 0 && correctBalanceDue > 0) {
      correctStatus = 'PARTIALLY_PAID';
    } else if (b.status === 'PAID' && correctBalanceDue > 0) {
      correctStatus = 'UNPAID';
    }

    const updated: Bill = {
      ...b,
      previousBalance: correctPreviousBalance,
      totalAmount: correctTotalAmount,
      paidAmount: billPayment,
      balanceDue: correctBalanceDue,
      status: correctStatus,
    };

    reconciledBills.push(updated);

    // Check if values differed from persisted document
    if (
      b.previousBalance !== correctPreviousBalance ||
      b.totalAmount !== correctTotalAmount ||
      b.balanceDue !== correctBalanceDue ||
      b.paidAmount !== billPayment ||
      b.status !== correctStatus
    ) {
      billsRequiringUpdate.push(updated);
    }

    // Running balance advances to the unpaid remainder of this bill
    runningUnpaidBalance = correctBalanceDue;
  }

  const netOutstandingBalance = Math.max(0, openingBalance + totalValidPeriodicCharges - totalPaymentsAmount);

  return {
    openingBalance,
    totalValidPeriodicCharges,
    totalPayments: totalPaymentsAmount,
    netOutstandingBalance,
    reconciledBills,
    billsRequiringUpdate,
  };
}
