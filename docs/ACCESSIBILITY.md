# Accessibility Guide

Payment Optimizer is designed to be accessible to all users, including those using assistive technologies. This guide documents our accessibility features and compliance with WCAG 2.1 Level AA standards.

## Table of Contents

1. [Accessibility Features](#accessibility-features)
2. [Keyboard Navigation](#keyboard-navigation)
3. [Screen Reader Support](#screen-reader-support)
4. [Color and Contrast](#color-and-contrast)
5. [Testing](#testing)
6. [Known Issues](#known-issues)
7. [Reporting Issues](#reporting-issues)

---

## Accessibility Features

### ARIA Labels and Roles

All interactive elements include appropriate ARIA labels:

```tsx
// Navigation buttons
<button
  aria-label="Navigate to dashboard"
  aria-current="page"
>
  DASHBOARD
</button>

// Modal dialogs
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  {/* Modal content */}
</div>

// Status updates
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  Savings calculated
</div>
```

### Semantic HTML

We use semantic HTML5 elements throughout:

- `<header>` for page header
- `<nav>` for navigation
- `<main>` for main content
- `<button>` for clickable actions (never `<div onclick>`)
- `<h1>`, `<h2>`, etc. with proper hierarchy

### Focus Management

- Visible focus indicators on all interactive elements
- Focus trap in modal dialogs
- Logical focus order follows visual layout
- Skip links for keyboard navigation

---

## Keyboard Navigation

### Global Shortcuts

| Key               | Action                               |
| ----------------- | ------------------------------------ |
| `Tab`             | Move to next interactive element     |
| `Shift + Tab`     | Move to previous interactive element |
| `Enter` / `Space` | Activate button or link              |
| `Escape`          | Close modal or dialog                |
| `Arrow Keys`      | Navigate within lists                |

### Navigation Bar

```
Tab → Focus first navigation button
Arrow Right/Left → Move between navigation buttons
Enter → Activate navigation button
```

### Modal Dialogs

When a modal opens:

1. Focus moves to the first interactive element
2. Tab navigation is trapped within modal
3. Escape key closes modal
4. Focus returns to trigger element on close

**Example:**

```tsx
import { createFocusTrap } from './accessibility';

useEffect(() => {
  if (showModal && modalRef.current) {
    const cleanup = createFocusTrap(modalRef.current);
    return cleanup;
  }
}, [showModal]);
```

### Forms

- All form fields have associated labels
- Tab order is logical
- Error messages are announced to screen readers
- Required fields are clearly marked

---

## Screen Reader Support

### Live Regions

Dynamic content updates are announced via ARIA live regions:

```tsx
import { announce } from './accessibility';

// Announce navigation
announce('Navigated to savings view');

// Announce success
announce('Card added successfully', 'assertive');

// Announce errors
announce('Failed to load profile', 'assertive');
```

### Content Descriptions

#### Strategy Cards

```tsx
// Visual: "Save ₹1,250 with 3 steps"
// Screen Reader: "Save 12.50 rupees with 3 steps"

import { formatCurrencyForSR, describeStrategy } from './accessibility';

const description = describeStrategy(
  125000n, // amountMinor
  'INR',
  3 // step count
);
```

#### Status Messages

```tsx
// Loading state
<div role="status" aria-label="Loading savings history">
  <div className="spinner" aria-hidden="true" />
  <span className="sr-only">Loading...</span>
</div>

// Empty state
<div role="status">
  No savings history available yet
</div>
```

### Decorative Content

Purely decorative elements are hidden from screen readers:

```tsx
// Decorative icons
<span aria-hidden="true">💰</span>

// Decorative images
<img src="icon.svg" alt="" role="presentation" />
```

---

## Color and Contrast

### WCAG AA Compliance

All text meets WCAG 2.1 Level AA contrast requirements:

| Element        | Foreground | Background | Ratio   | Required |
| -------------- | ---------- | ---------- | ------- | -------- |
| Body text      | `#e5e7eb`  | `#1a1a2e`  | 12.63:1 | 4.5:1 ✓  |
| Headings       | `#ffffff`  | `#1a1a2e`  | 15.29:1 | 3:1 ✓    |
| Primary button | `#ffffff`  | `#6366f1`  | 4.53:1  | 3:1 ✓    |
| Links          | `#818cf8`  | `#1a1a2e`  | 8.12:1  | 4.5:1 ✓  |
| Success        | `#34d399`  | `#1a1a2e`  | 9.41:1  | 3:1 ✓    |
| Warning        | `#fbbf24`  | `#1a1a2e`  | 12.72:1 | 3:1 ✓    |
| Error          | `#f87171`  | `#1a1a2e`  | 6.83:1  | 3:1 ✓    |

### Color Independence

Information is never conveyed by color alone:

```tsx
// ✅ Good: Icon + color + text
<div className="status-success">
  <span role="img" aria-label="Success">✓</span>
  <span>Card added successfully</span>
</div>

// ❌ Bad: Color only
<div style={{ color: 'green' }}>Success</div>
```

### Dark Mode

The extension uses a dark theme with:

- Reduced blue light emission
- Comfortable contrast ratios
- No pure white (`#ffffff` on backgrounds)

---

## Testing

### Manual Testing

#### Keyboard Navigation Test

1. Use only keyboard (no mouse)
2. Tab through all interactive elements
3. Verify focus is always visible
4. Verify all functions work via keyboard
5. Verify Escape closes modals

#### Screen Reader Test

1. **NVDA** (Windows): Download from nvaccess.org
2. **JAWS** (Windows): Trial from freedomscientific.com
3. **VoiceOver** (macOS): Built-in, Cmd+F5 to enable

**Test checklist:**

- [ ] All buttons announce correctly
- [ ] Navigation changes are announced
- [ ] Form fields have labels
- [ ] Error messages are announced
- [ ] Live regions work
- [ ] Modal dialogs are announced

#### Color Contrast Test

Use browser DevTools:

1. Open DevTools → Elements
2. Select element with text
3. Look for contrast ratio in Styles pane
4. Verify ratio meets WCAG AA

Or use online tools:

- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Coolors Contrast Checker: https://coolors.co/contrast-checker

### Automated Testing

```bash
# Install axe-core
pnpm add -D @axe-core/react

# Run in development
# Accessibility violations logged to console
```

**Example test:**

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Dashboard Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<Dashboard />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

---

## Known Issues

### Current Limitations

1. **Chart Accessibility**: Savings charts use canvas without text alternative
   - **Workaround**: Data tables provided alongside charts
   - **Status**: Planned for v0.8.0

2. **Drag and Drop**: Card reordering not fully keyboard accessible
   - **Workaround**: Use arrow keys or context menu
   - **Status**: In progress

3. **Complex Animations**: Some transitions may affect motion-sensitive users
   - **Workaround**: Browser's "reduce motion" setting is respected
   - **Status**: Complete

### Browser Compatibility

| Browser | Screen Reader | Status            |
| ------- | ------------- | ----------------- |
| Chrome  | NVDA          | ✓ Full support    |
| Chrome  | JAWS          | ✓ Full support    |
| Firefox | NVDA          | ✓ Full support    |
| Edge    | Narrator      | ⚠ Partial support |
| Safari  | VoiceOver     | ✓ Full support    |

---

## Best Practices for Contributors

### When Adding UI Components

1. **Use semantic HTML**

   ```tsx
   // ✅ Good
   <button onClick={handleClick}>Click me</button>

   // ❌ Bad
   <div onClick={handleClick}>Click me</div>
   ```

2. **Add ARIA labels**

   ```tsx
   <button aria-label="Close dialog">×</button>
   ```

3. **Manage focus**

   ```tsx
   useEffect(() => {
     if (isOpen) {
       modalRef.current?.focus();
     }
   }, [isOpen]);
   ```

4. **Test with keyboard only**
   - Can you navigate?
   - Can you activate all functions?
   - Is focus always visible?

5. **Check color contrast**
   - Use DevTools
   - Verify 4.5:1 for text
   - Verify 3:1 for UI components

### Common Patterns

**Modal Dialog:**

```tsx
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={dialogRef}>
  <h2 id="dialog-title">Dialog Title</h2>
  {/* Content */}
  <button onClick={onClose} aria-label="Close dialog">
    ×
  </button>
</div>
```

**Loading State:**

```tsx
<div role="status" aria-live="polite">
  {loading ? (
    <>
      <div className="spinner" aria-hidden="true" />
      <span className="sr-only">Loading...</span>
    </>
  ) : (
    <span>Loaded</span>
  )}
</div>
```

**Form Field:**

```tsx
<div>
  <label htmlFor="card-name">
    Card Name
    <span aria-label="required">*</span>
  </label>
  <input
    id="card-name"
    type="text"
    required
    aria-required="true"
    aria-describedby="card-name-error"
  />
  <div id="card-name-error" role="alert">
    {error && `Error: ${error}`}
  </div>
</div>
```

---

## Reporting Issues

Found an accessibility issue? Please report it!

### Where to Report

- **GitHub Issues**: https://github.com/daryllrebeiro/payments-optimizer/issues
- **Label**: `accessibility`
- **Template**: Use "Accessibility Issue" template

### What to Include

1. **Environment**
   - Browser and version
   - Screen reader and version (if applicable)
   - Operating system

2. **Description**
   - What you expected
   - What actually happened
   - Steps to reproduce

3. **Impact**
   - Who is affected
   - Severity (blocker, major, minor)

4. **Screenshots/Video** (if applicable)

### Example Report

```markdown
**Title**: Dashboard "Why?" button not accessible via keyboard

**Environment**:

- Chrome 120
- NVDA 2023.3
- Windows 11

**Description**:
The "Why?" explanation button on the dashboard cannot be focused
via keyboard navigation.

**Steps to Reproduce**:

1. Navigate to Dashboard
2. Press Tab repeatedly
3. Observe that button is skipped

**Expected**: Button receives focus and can be activated with Enter

**Actual**: Button is never focused

**Impact**: Blocker for keyboard-only users
```

---

## Resources

### WCAG Guidelines

- [WCAG 2.1 Overview](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM WCAG Checklist](https://webaim.org/standards/wcag/checklist)

### Testing Tools

- [NVDA Screen Reader](https://www.nvaccess.org/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)

### Further Reading

- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11y Project](https://www.a11yproject.com/)
- [Inclusive Components](https://inclusive-components.design/)

---

## Commitment

We are committed to making Payment Optimizer accessible to everyone. Accessibility is not a feature—it's a requirement. We continuously improve based on user feedback and evolving standards.

**Last Updated**: September 5, 2026  
**WCAG Version**: 2.1 Level AA  
**Conformance**: Partial (working towards full compliance)
