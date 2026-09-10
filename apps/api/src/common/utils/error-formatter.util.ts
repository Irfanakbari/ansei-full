/**
 * Format Prisma/database errors into user-friendly messages
 * @param error - The original error object
 * @returns User-friendly error message string
 */
export function formatErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown error occurred';
  }

  const errorMessage = error.message;

  // Prisma P2002 = Unique constraint violation
  if (errorMessage.includes('P2002')) {
    return 'Duplicate entry: A record with this identifier already exists';
  }

  // Prisma P2003 = Foreign key constraint violation
  if (errorMessage.includes('P2003')) {
    return 'Invalid reference: Related data does not exist in the system';
  }

  // Prisma P2025 = Record not found
  if (errorMessage.includes('P2025')) {
    return 'Record not found: The requested data does not exist';
  }

  // Invalid Date error
  if (
    errorMessage.includes('Invalid Date') ||
    errorMessage.includes('Expected Date')
  ) {
    return 'Invalid date format: Please check date field formats';
  }

  // Prisma validation error - Argument
  if (errorMessage.includes('Argument')) {
    const argMatch = errorMessage.match(/Argument `(\w+)`/);
    if (argMatch) {
      return `Invalid value for field: ${argMatch[1]}. Please check input data format`;
    }
    return 'Invalid data format: Please check your input';
  }

  // Generic Prisma client error
  if (
    errorMessage.includes('PrismaClientKnownRequestError') ||
    errorMessage.includes('Invalid `') ||
    errorMessage.includes('this.prisma.')
  ) {
    return 'Database operation failed: Please check your input data format';
  }

  // Unique constraint in MongoDB/others
  if (
    errorMessage.includes('E11000') ||
    errorMessage.includes('duplicate key')
  ) {
    return 'Duplicate entry: A record with this identifier already exists';
  }

  // Connection errors
  if (
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('Connection refused')
  ) {
    return 'Database connection failed: Please try again later';
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
    return 'Operation timed out: Please try again';
  }

  // Default: use original message if short enough
  if (errorMessage.length < 150) {
    return errorMessage;
  }

  // Truncate long error messages
  return errorMessage.substring(0, 150) + '...';
}

/**
 * Create a structured error response object
 * @param error - The original error object
 * @returns Object with success: false and formatted message
 */
export function createErrorResponse(error: unknown): {
  success: false;
  message: string;
  originalError?: string;
} {
  const formattedMessage = formatErrorMessage(error);
  const originalError = error instanceof Error ? error.message : undefined;

  return {
    success: false,
    message: formattedMessage,
    ...(process.env.NODE_ENV === 'development' && originalError
      ? { originalError }
      : {}),
  };
}
