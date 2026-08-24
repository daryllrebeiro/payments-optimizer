# HOW TO RUN: Installation & Usage Guide

This guide explains how to install, configure, and run the PaymentsOptimizer browser extension and optimization engine.

---

## 1. Prerequisites

Before starting, ensure you have the following installed on your machine:

- **Node.js**: Version 20 or higher
- **pnpm**: Version 10 or higher
- **Google Chrome** (or any Chromium-based browser like Brave or Edge)

---

## 2. Installation & Build

Compile the packages and build the extension distribution folder:

```bash
# 1. Clone the repository and navigate to the project root
cd payments-optimizer

# 2. Install all dependencies across workspaces
pnpm install

# 3. Compile all packages and build the Chrome extension assets
pnpm run build
```

The compiled extension assets will be generated in `apps/extension/dist/`.

---

## 3. Installing the Extension in Google Chrome

To load the unpacked extension in Chrome:

1.  Open Chrome and navigate to: `chrome://extensions/`
2.  In the top-right corner, toggle the **Developer mode** switch to **ON**.
3.  In the top-left corner, click the **Load unpacked** button.
4.  Navigate to your workspace directory and select the build folder:
    `payments-optimizer/apps/extension/dist/`
5.  The **PaymentsOptimizer** extension card should appear on the extensions page.

---

## 4. Basic Usage Flow

### Step 1: Set Up Your Benefits Wallet & Memberships

1.  Click the extension icon in your Chrome toolbar to open the popup.
2.  Switch to the **BENEFITS** tab.
3.  Under **MEMBERSHIPS**, link any active programs you belong to (e.g., _Amazon Prime, Accor ALL, Swiggy One, Marriott Bonvoy, Tata Neu_).
4.  Under **VOUCHERS**, record any vouchers or coupons you possess (e.g., _Myntra ₹500 voucher with 3-day expiry_).
5.  Review the **"WHAT DO I HAVE?"** overview for a summary of your active stored value and a **🔥 Expiring Soon** warning banner for benefits expiring within 7 days.

### Step 2: Set Up Your Payment Cards

1.  Switch to the **MY CARDS** tab.
2.  Add your credit and debit cards (e.g., _SBI Cashback, HDFC Millennia, Axis Atlas_).
3.  In the **VALUATIONS** (Settings) tab, customize your reward point valuations (e.g., _1 HDFC Point = ₹0.25_) and optimization weight preferences (Immediate Savings vs. Future Rewards vs. Expiry Urgency).

### Step 3: Automatic Multi-Step Purchase Recommendations

1.  Navigate to a supported online merchant (such as `https://www.myntra.com` or `https://www.amazon.in`).
2.  Add items to your cart.
3.  Open the **PaymentsOptimizer** extension popup.
4.  The background engine executes the **Benefits Intelligence & Unified Optimizer**, computing the optimal sequence:
    - **Step 1**: Apply stored voucher (e.g., Myntra ₹500 voucher).
    - **Step 2**: Activate partner promo (e.g., Accor ALL 10% member discount).
    - **Step 3**: Pay remaining balance with the highest-earning card (e.g., SBI Cashback 5%).
    - **Step 4**: Earn post-transaction reward points.
5.  The popup displays:
    - **Recommended Sequence** with actionable instructions and coupon/voucher codes.
    - **Savings breakdown** (Voucher savings + Partner perk + Card rewards).
    - **Final net effective cost** and total savings.

### Step 4: What-If Simulator & AI Explanations

1.  Click the **Open What-If Simulator** button in the popup to simulate different purchase totals.
2.  Click the **💡 Why?** button to view a natural language breakdown of why the recommended multi-step sequence outperforms direct card payments.

---

## 5. Development Diagnostics & Benchmarks

From the project root directory, run any of the following diagnostic commands:

```bash
# Run the complete test suite across all 13 workspace projects
pnpm run test

# Run TypeScript dry-run checks
pnpm run typecheck

# Run the CLI transaction recommendation trace simulation
pnpm run milestone1

# Run the code linter and formatter validation
pnpm run lint
pnpm run format
```
