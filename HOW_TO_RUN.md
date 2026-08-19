# HOW TO RUN: Installation & Usage Guide

This guide explains how to install, configure, and run the PaymentsOptimizer browser extension and optimization engine.

---

## 1. Prerequisites

Before starting, ensure you have the following installed on your machine:
*   **Node.js**: Version 20 or higher
*   **pnpm**: Version 10 or higher
*   **Google Chrome** (or any Chromium-based browser like Brave or Edge)

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

### Step 1: Set Up Your Wallet Cards
1.  Click the extension icon in your Chrome toolbar to open the popup.
2.  Switch to the **MY CARDS** tab.
3.  Use the form to add your payment cards (e.g., card issuer, product name, network type, and annual spend to date).
4.  Navigate to the **SETTINGS** tab to customize point valuations (e.g., 1 HDFC point = ₹0.25) or adjust the algorithm weights (Immediate Savings vs. Future Rewards vs. Workflow Simplicity).

### Step 2: Automatic Recommendations
1.  Navigate to a supported online merchant (such as `https://www.amazon.in` or `https://www.flipkart.com`).
2.  Add items to your shopping cart.
3.  Open the **PaymentsOptimizer** extension popup.
4.  The content script automatically extracts the current cart parameters securely, and the background engine instantly calculates the optimal routing strategy.
5.  The popup displays:
    *   The recommended payment route (e.g., HDFC Card + specific coupon).
    *   Step-by-step instructions.
    *   Immediate savings, reward values, and the final net effective cost.
    *   Alternative card options ranked by value.

### Step 3: What-If Simulation
1.  Click the **Open What-If Simulator** button in the popup.
2.  Enter any hypothetical transaction amount.
3.  Watch the recommendations adjust dynamically in real-time.

### Step 4: AI Explanation Overlay
1.  Click the **💡 Why?** button next to the recommended strategy banner.
2.  If you haven't configured a Gemini key, follow the instructions to grab a free key from Google AI Studio.
3.  Paste the key into the **AI Explanation** panel of the **SETTINGS** tab.
4.  Click **💡 Why?** again to retrieve a natural language description explaining why the recommendation beats the other wallet cards.

---

## 5. Development Diagnostics & Benchmarks

From the project root directory, you can run the following diagnostic commands:

```bash
# Run the complete test suite (includes service worker fuzz-testing)
pnpm run test

# Run the CLI transaction recommendation trace simulation
pnpm run milestone1

# Run the dominance pruner performance benchmark
pnpm --filter benchmark-tool perf
```
