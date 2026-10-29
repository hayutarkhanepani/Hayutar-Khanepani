# Security Specification: Water Supply Billing Management System

## 1. Data Invariants
1. **Admin Master Gate**: Only verified users designated in `/admins/{uid}` or committee staff can create, update, or cancel bills, modify tariffs, approve households, or record counter payments.
2. **Customer Isolation**: Non-admin consumers can ONLY read their own user profile (`/users/{uid}`) and their linked household document (`/households/{householdId}` where `userId == request.auth.uid`), their own bills (`/bills/{billId}` where `customerId == request.auth.uid` or matches household customerCode), vouchers, and payments.
3. **No Self-Assigned Privileges**: Users cannot grant themselves the 'admin' or 'staff' role during user registration or update.
4. **Financial Immutability**: Payments and Audit Logs are write-once append-only; updates and deletions are strictly forbidden to ensure audit integrity.
5. **No Negative Balances or Overwrites**: Customers cannot alter bill amounts, status, or paidAmount directly via client SDK.
6. **Unique Household Claiming Guard**: A customer cannot claim an arbitrary household without linking authorization verified against the customer's verified phone/email or admin approval.

## 2. The "Dirty Dozen" Malicious Payloads

1. **Payload 1 (Privilege Escalation on User Profile)**:
   A standard user tries to write `role: "admin"` to `/users/{uid}`.
   *Expected Result*: PERMISSION_DENIED.

2. **Payload 2 (Ghost Field Attack / Shadow Field)**:
   A user injects `isAdmin: true` or `isSuperUser: true` into a profile update.
   *Expected Result*: PERMISSION_DENIED.

3. **Payload 3 (Cross-Household Bill Snooping)**:
   Customer A attempts to `get` or `list` bills belonging to Customer B.
   *Expected Result*: PERMISSION_DENIED.

4. **Payload 4 (Client-Side Bill Mark-As-Paid)**:
   Customer A attempts to update `/bills/{billId}` with `status: "PAID"` and `paidAmount: 500`.
   *Expected Result*: PERMISSION_DENIED.

5. **Payload 5 (Tariff Rate Tampering)**:
   An unauthenticated or non-admin user attempts to reduce `perUnitRate` in `/tariffs/standard` to 0.
   *Expected Result*: PERMISSION_DENIED.

6. **Payload 6 (Payment Record Deletion / Ledger Tampering)**:
   A user tries to call `deleteDoc` on `/payments/{paymentId}` to erase transaction history.
   *Expected Result*: PERMISSION_DENIED.

7. **Payload 7 (Audit Log Destruction)**:
   An attacker calls `deleteDoc` or `updateDoc` on `/auditLogs/{logId}`.
   *Expected Result*: PERMISSION_DENIED.

8. **Payload 8 (Denial-of-Wallet String Inflation)**:
   Attacker sends a 1MB payload string in `ownerName` or `instructions` to inflate storage costs.
   *Expected Result*: PERMISSION_DENIED.

9. **Payload 9 (Unauthenticated Admin Creation)**:
   Attacker attempts to create a document in `/admins/{newUid}`.
   *Expected Result*: PERMISSION_DENIED.

10. **Payload 10 (Direct Counter Payment Forgery)**:
    Non-staff customer attempts to directly write a `CASH` payment into `/payments/{paymentId}` without admin authorization.
    *Expected Result*: PERMISSION_DENIED.

11. **Payload 11 (ID Traversal / Junk-Character ID Poisoning)**:
    Attacker passes an invalid or oversized document ID with directory traversal or script tags.
    *Expected Result*: PERMISSION_DENIED.

12. **Payload 12 (Household Hijack via ID Overwrite)**:
    Customer B attempts to overwrite Customer A's `userId` in `/households/{householdId}`.
    *Expected Result*: PERMISSION_DENIED.
