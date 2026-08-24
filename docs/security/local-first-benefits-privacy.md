# Security & Privacy: Local-First Benefits Architecture

## Privacy Guarantees

1. **Zero Cloud Exfiltration**:
   - User memberships, loyalty account numbers, stored vouchers, coupon codes, and point balances are stored locally in the browser's extension storage (`chrome.storage.local` / IndexedDB).
   - No user profile information is transmitted over the network during merchant detection, graph traversal, or optimization.

2. **Public / Private Boundary**:
   - **Public Data**: Program definitions, standard partner affiliations, public promo rules, and merchant catalogs are bundled client-side.
   - **Private Data**: Active user memberships, owned voucher inventory, point balances, and spending histories.
   - Optimization runs locally inside the service worker with zero external API calls.

3. **AES-GCM PBKDF2 Export Encryption**:
   - User profile backups can be encrypted using AES-256-GCM with PBKDF2-derived keys, ensuring safe portable backups.
