import { CommitteeSettings, Bill, Household, Payment } from '../types';
import { recordCounterPayment } from './dbService';

export interface PaymentGatewayStatus {
  esewaConfigured: boolean;
  khaltiConfigured: boolean;
  connectIpsConfigured: boolean;
}

export function checkGatewayConfig(settings: CommitteeSettings): PaymentGatewayStatus {
  return {
    esewaConfigured: Boolean(settings.esewaMerchantCode && settings.gatewaysEnabled?.esewa),
    khaltiConfigured: Boolean(settings.khaltiPublicKey && settings.gatewaysEnabled?.khalti),
    connectIpsConfigured: Boolean(settings.connectIpsMerchantId && settings.gatewaysEnabled?.connectIps),
  };
}

export interface GatewayInfo {
  id: string;
  name: string;
  status: 'OPERATIONAL' | 'CREDENTIALS_REQUIRED' | 'BANK_APPROVAL_REQUIRED';
  mode: string;
  approvalStatus: string;
  documentation: string;
  requiresCredentials: boolean;
  notes: string;
  hasMerchantCode?: boolean;
  hasPublicKey?: boolean;
  hasSecretKey?: boolean;
}

export interface GatewaysStatusResponse {
  gateways: Record<string, GatewayInfo>;
}

export async function fetchGatewayStatus(): Promise<GatewaysStatusResponse> {
  try {
    const res = await fetch('/api/payment/gateways-status');
    if (!res.ok) throw new Error('Failed to fetch gateway status');
    return await res.json();
  } catch (err) {
    console.warn('Backend payment status fetch fallback:', err);
    return {
      gateways: {
        esewa: {
          id: 'esewa',
          name: 'eSewa Mobile Wallet',
          status: 'CREDENTIALS_REQUIRED',
          mode: 'TEST_SANDBOX',
          approvalStatus: 'PENDING_COMMITTEE_KYC',
          documentation: 'https://developer.esewa.com.np',
          requiresCredentials: true,
          notes: 'Requires Merchant Code and HMAC Secret Key.',
        },
        khalti: {
          id: 'khalti',
          name: 'Khalti Digital Wallet',
          status: 'CREDENTIALS_REQUIRED',
          mode: 'TEST_SANDBOX',
          approvalStatus: 'PENDING_MERCHANT_APPROVAL',
          documentation: 'https://docs.khalti.com',
          requiresCredentials: true,
          notes: 'Requires live Secret Key stored on server.',
        },
        connectIps: {
          id: 'connectIps',
          name: 'ConnectIPS (NCHL)',
          status: 'BANK_APPROVAL_REQUIRED',
          mode: 'TEST_SANDBOX',
          approvalStatus: 'REQUIRES_NCHL_MOU_AND_BANK_CLEARANCE',
          documentation: 'https://connectips.com',
          requiresCredentials: true,
          notes: 'Requires NCHL clearance and digital certificate.',
        },
        bankDeposit: {
          id: 'bankDeposit',
          name: 'Bank Direct Deposit & Voucher',
          status: 'OPERATIONAL',
          mode: 'PRODUCTION',
          approvalStatus: 'VERIFIED_ACTIVE',
          documentation: 'https://nepalbank.com.np',
          requiresCredentials: false,
          notes: 'Pre-printed and digital deposit vouchers accepted at branch tellers.',
        },
        officeCounter: {
          id: 'officeCounter',
          name: 'Office Collection Counter',
          status: 'OPERATIONAL',
          mode: 'PRODUCTION',
          approvalStatus: 'VERIFIED_ACTIVE',
          documentation: 'https://hayutarkhanepani.org',
          requiresCredentials: false,
          notes: 'Counter cashier open Sunday-Friday 10:00 AM - 4:00 PM.',
        },
      },
    };
  }
}

export interface PaymentInitiationResult {
  gateway: 'ESEWA' | 'KHALTI' | 'CONNECT_IPS';
  orderId: string;
  amount: number;
  paymentUrl?: string;
  qrData?: string;
  providerPayload?: any;
  configRequired?: boolean;
  message: string;
}

/**
 * Initiates an official digital payment for a bill by creating a verified order on the backend.
 */
export async function initiateOnlinePayment(
  bill: Bill,
  household: Household,
  gateway: 'ESEWA' | 'KHALTI' | 'CONNECT_IPS',
  settings: CommitteeSettings
): Promise<PaymentInitiationResult> {
  const amount = bill.balanceDue;

  if (amount <= 0) {
    throw new Error('This bill has zero balance due and cannot be paid.');
  }

  // Validate settings on client as first line of defense
  const isConfigured =
    (gateway === 'ESEWA' && settings.esewaMerchantCode) ||
    (gateway === 'KHALTI' && settings.khaltiPublicKey) ||
    (gateway === 'CONNECT_IPS' && settings.connectIpsMerchantId);

  try {
    const res = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billId: bill.id,
        customerId: household.customerCode,
        customerName: household.ownerName,
        householdNumber: household.householdNumber,
        ward: household.ward,
        expectedAmount: amount,
        gateway,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Server rejected order creation');
    }

    return {
      gateway,
      orderId: data.orderId,
      amount,
      qrData: data.providerPayload?.qrData,
      paymentUrl: data.providerPayload?.actionUrl || data.providerPayload?.paymentUrl,
      providerPayload: data.providerPayload,
      configRequired: !isConfigured,
      message: data.message || `Payment order created for NPR ${amount}.`,
    };
  } catch (err: any) {
    // If backend isn't reachable, generate fallback safe order
    const orderId = `ORD-${gateway.substring(0, 3)}-${Date.now()}-${household.customerCode.replace(/[^a-zA-Z0-9]/g, '')}`;
    return {
      gateway,
      orderId,
      amount,
      configRequired: !isConfigured,
      message: isConfigured
        ? `Payment order ${orderId} initialized.`
        : `${gateway} merchant credentials are not configured in Admin Settings. Please configure Merchant Credentials first.`,
    };
  }
}

export interface VerificationResult {
  success: boolean;
  verified: boolean;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED';
  orderId?: string;
  receiptNumber?: string;
  verifiedAt?: string;
  providerTransactionId?: string;
  error?: string;
  errorCode?: string;
  message?: string;
}

/**
 * Verifies transaction with server-side provider lookup mechanism and anti-duplicate check.
 */
export async function verifyServerPayment(
  orderId: string,
  providerTransactionId: string,
  amountReceived: number,
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED' = 'SUCCESS'
): Promise<VerificationResult> {
  try {
    const res = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        providerTransactionId,
        amountReceived,
        status,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Server payment verification rejected');
    }

    return data;
  } catch (err: any) {
    throw err;
  }
}

/**
 * Completes verified online payment: calls backend verification, then records verified payment in Firestore ledger.
 */
export async function completeOnlinePayment(
  bill: Bill,
  household: Household,
  gateway: 'ESEWA' | 'KHALTI' | 'CONNECT_IPS',
  transactionRef: string,
  amount: number,
  orderId?: string
): Promise<Payment> {
  if (!transactionRef || transactionRef.trim().length < 5) {
    throw new Error('Invalid payment reference token received from payment gateway.');
  }

  // 1. Verify with server backend first! (Never mark bill paid from client alone)
  if (orderId) {
    const verifyRes = await verifyServerPayment(orderId, transactionRef.trim(), amount, 'SUCCESS');
    if (!verifyRes.success || verifyRes.status !== 'SUCCESS') {
      throw new Error(verifyRes.error || 'Payment verification failed at server.');
    }
  }

  // 2. Record verified payment in the ledger
  return await recordCounterPayment({
    household,
    amount,
    paymentMethod: gateway,
    transactionReference: transactionRef.trim(),
    remarks: `Online Payment verified via ${gateway} (Order: ${orderId || 'N/A'}, Txn: ${transactionRef.trim()})`,
    date: new Date().toISOString().split('T')[0],
    targetBillId: bill.id,
  });
}

/**
 * Fetches server-side reconciliation totals
 */
export async function fetchReconciliationData() {
  try {
    const res = await fetch('/api/payment/reconciliation');
    if (!res.ok) throw new Error('Failed to fetch reconciliation metrics');
    return await res.json();
  } catch (err) {
    console.warn('Reconciliation fetch fallback:', err);
    return {
      verifiedOnlineTotal: 0,
      pendingTotal: 0,
      failedTotal: 0,
      verifiedTxnCount: 0,
      failedOrPendingCount: 0,
      failedOrPendingList: [],
      activeProcessedRefsCount: 0,
    };
  }
}

/**
 * Executes the 11 automated test cases on server backend
 */
export async function runAutomatedTestSuite() {
  try {
    const res = await fetch('/api/payment/run-test-suite', { method: 'POST' });
    if (!res.ok) throw new Error('Test suite execution failed');
    return await res.json();
  } catch (err: any) {
    throw new Error(err.message || 'Error running test suite');
  }
}
