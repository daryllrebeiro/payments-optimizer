/**
 * Accessibility utilities and constants for WCAG AA compliance
 */

/**
 * Screen reader announcements
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcer = document.getElementById('sr-announcer') || createAnnouncer();
  announcer.setAttribute('aria-live', priority);
  announcer.textContent = message;
  
  // Clear after announcement
  setTimeout(() => {
    announcer.textContent = '';
  }, 1000);
}

function createAnnouncer(): HTMLElement {
  const announcer = document.createElement('div');
  announcer.id = 'sr-announcer';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  announcer.style.position = 'absolute';
  announcer.style.left = '-10000px';
  announcer.style.width = '1px';
  announcer.style.height = '1px';
  announcer.style.overflow = 'hidden';
  document.body.appendChild(announcer);
  return announcer;
}

/**
 * Keyboard navigation handler
 */
export function handleKeyboardNavigation(
  event: React.KeyboardEvent,
  onEnter?: () => void,
  onEscape?: () => void
): void {
  if (event.key === 'Enter' && onEnter) {
    event.preventDefault();
    onEnter();
  } else if (event.key === 'Escape' && onEscape) {
    event.preventDefault();
    onEscape();
  }
}

/**
 * Focus trap for modals
 */
export function createFocusTrap(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };
  
  container.addEventListener('keydown', handleTabKey);
  firstElement?.focus();
  
  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
}

/**
 * Format currency for screen readers
 */
export function formatCurrencyForSR(amount: bigint, currency: string): string {
  const major = amount / 100n;
  const minor = amount % 100n;
  const formatted = `${major}.${minor.toString().padStart(2, '0')}`;
  
  switch (currency) {
    case 'INR':
      return `${formatted} rupees`;
    case 'USD':
      return `${formatted} dollars`;
    case 'EUR':
      return `${formatted} euros`;
    case 'GBP':
      return `${formatted} pounds`;
    default:
      return `${formatted} ${currency}`;
  }
}

/**
 * ARIA labels for common UI elements
 */
export const ARIA_LABELS = {
  // Navigation
  mainNav: 'Main navigation',
  closeModal: 'Close dialog',
  previousStep: 'Go to previous step',
  nextStep: 'Go to next step',
  
  // Actions
  addCard: 'Add new credit card',
  removeCard: 'Remove credit card',
  addMembership: 'Add new membership',
  addVoucher: 'Add new voucher',
  exportProfile: 'Export your profile data',
  importProfile: 'Import profile data',
  
  // Views
  dashboard: 'View dashboard',
  benefits: 'View benefits and memberships',
  cards: 'View credit cards',
  savings: 'View savings history',
  settings: 'View settings',
  diagnostics: 'View diagnostics',
  
  // Status
  loading: 'Loading',
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
};

/**
 * Generate descriptive text for strategies
 */
export function describeStrategy(
  totalBenefit: bigint,
  currency: string,
  stepCount: number
): string {
  const benefit = formatCurrencyForSR(totalBenefit, currency);
  return `Save ${benefit} with ${stepCount} ${stepCount === 1 ? 'step' : 'steps'}`;
}
