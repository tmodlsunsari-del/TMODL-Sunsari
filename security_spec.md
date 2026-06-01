# Firestore Security Specification & Data Invariants

This specification outlines the data validation rules, security invariants, and test coverage to secure the Transport Management Office LRMS database against structural anomalies, invalid schemas, and unauthorized writes.

## 1. Data Invariants

The `/lrms_system/admin_accounts_doc` document stores administrative systems and staff accounts. The core security guarantees are:
- **Strict Identity Invariant**: The document name must be exactly `admin_accounts_doc`. No other system documents can be created or queried.
- **Strict Keys**: No "Ghost" or "Shadow" properties are allowed beyond `accounts` and `lastUpdated`.
- **Integrity**: `accounts` must be a list containing valid account maps, and `lastUpdated` must be a string.

---

## 2. The "Dirty Dozen" Payloads

These 12 malicious payloads represent attempts to compromise system integrity. The Firestore Security Rules must deny all of them.

### Payload 1: ID Poisoning / Path Bypass
Attempting to write to a non-existent system directory with a giant, malformed ID.
- **Path**: `/lrms_system/invalid_sys_id_junk_37283278_238@#$`
- **Payload**: `{"accounts": []}`

### Payload 2: Missing Required Key
Missing the essential `accounts` list property.
- **Path**: `/lrms_system/admin_accounts_doc`
- **Payload**: `{"lastUpdated": "2026-05-31T02:44:00Z"}`

### Payload 3: Shadow Keys Injection / Ghost Fields
Attempting to inject a backdoor field (e.g. bypass validation indicator) into the system configuration.
- **Path**: `/lrms_system/admin_accounts_doc`
- **Payload**: `{"accounts": [], "lastUpdated": "2026-05-31T02:44:00Z", "isVerifiedSecurityBypass": true}`

### Payload 4: Invalid Field Type for accounts
Defining `accounts` as a boolean instead of an array/list.
- **Path**: `/lrms_system/admin_accounts_doc`
- **Payload**: `{"accounts": true, "lastUpdated": "2026-05-31T02:44:00Z"}`

### Payload 5: Invalid Field Type for lastUpdated
Defining `lastUpdated` as a numeric timestamp instead of a string.
- **Path**: `/lrms_system/admin_accounts_doc`
- **Payload**: `{"accounts": [], "lastUpdated": 1780195418}`

### Payload 6: Overflow String Injection
Injecting a massive payload string (e.g. 1MB of text) in the `lastUpdated` field to exploit parsing limitations or exhaust resources.
- **Path**: `/lrms_system/admin_accounts_doc`
- **Payload**: `{"accounts": [], "lastUpdated": "A".repeat(1000000)}`

### Payload 7: Double Key Anomaly / Field Modification
Writing invalid empty objects inside the accounts list.
- **Path**: `/lrms_system/admin_accounts_doc`
- **Payload**: `{"accounts": [{}], "lastUpdated": "2026-05-31T02:44:00Z"}`

### Payload 8: Corrupted Account Item Structure
Setting accounts with invalid property values.
- **Path**: `/lrms_system/admin_accounts_doc`
- **Payload**: `{"accounts": [{"username": "malicious", "role": "root"}], "lastUpdated": "2026-05-31T02:44:00Z"}`

### Payload 9: Empty Document Creation
Creating an entirely empty root document.
- **Path**: `/lrms_system/admin_accounts_doc`
- **Payload**: `{}`

### Payload 10: Nested Path Escapes
Attempting to write to sub-collections inside the lrms_system root.
- **Path**: `/lrms_system/admin_accounts_doc/nested_sub_collection/hack`
- **Payload**: `{"data": "compromise"}`

### Payload 11: Extreme Boundary Check on List Size
Providing a listing of 5000 mock accounts to overflow the Firestore document limits (max 1MB).
- **Path**: `/lrms_system/admin_accounts_doc`
- **Payload**: `{"accounts": Array(5000).fill({username: "attacker"}), "lastUpdated": "2026-05-31T02:44:00Z"}`

### Payload 12: Hijacking Non-Config Collections
Creating root level databases outside specified scopes.
- **Path**: `/admins/attacker`
- **Payload**: `{"isAdmin": true}`

---

## 3. Test Runner Design (`firestore.rules.test.ts`)

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

describe("LRMS System Firewall Rules", () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "uplifted-adapter-lh7sp",
      firestore: {
        rules: `
          rules_version = '2';
          service cloud.firestore {
            match /databases/{database}/documents {
              match /{document=**} {
                allow read, write: if false;
              }
              match /lrms_system/{systemId} {
                allow read: if true;
                allow write: if systemId == 'admin_accounts_doc' &&
                  request.resource.data.keys().hasAll(['accounts']) &&
                  request.resource.data.keys().size() <= 2 &&
                  request.resource.data.accounts is list &&
                  (request.resource.data.get('lastUpdated', '') is string);
              }
            }
          }
        `
      }
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it("should block Payload 1 (wrong systemId)", async () => {
    const context = testEnv.unauthenticatedContext();
    const db = context.firestore();
    const docRef = doc(db, "lrms_system", "invalid_sys_id_junk_37283278_238");
    await assertFails(setDoc(docRef, { accounts: [] }));
  });

  it("should allow correct payload under system id admin_accounts_doc", async () => {
    const context = testEnv.unauthenticatedContext();
    const db = context.firestore();
    const docRef = doc(db, "lrms_system", "admin_accounts_doc");
    await assertSucceeds(setDoc(docRef, { accounts: [], lastUpdated: "2026-05-31T02:44:00Z" }));
  });

  it("should fail Payload 3 shadow keys", async () => {
    const context = testEnv.unauthenticatedContext();
    const db = context.firestore();
    const docRef = doc(db, "lrms_system", "admin_accounts_doc");
    await assertFails(setDoc(docRef, { accounts: [], lastUpdated: "2026-05-31T02:44:00Z", isVerifiedSecurityBypass: true }));
  });
});
```
