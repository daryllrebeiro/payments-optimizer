export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ValidationSummary {
  private errors: ValidationError[] = [];

  add(error: ValidationError): void {
    this.errors.push(error);
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): ValidationError[] {
    return [...this.errors];
  }

  getFirstError(): ValidationError | undefined {
    return this.errors[0];
  }

  getErrorMessage(): string {
    if (this.errors.length === 0) {
      return 'Validation successful';
    }

    if (this.errors.length === 1) {
      return this.errors[0].message;
    }

    return `Multiple validation errors:\n${this.errors.map((e) => `  - ${e.message}`).join('\n')}`;
  }

  clear(): void {
    this.errors = [];
  }
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
