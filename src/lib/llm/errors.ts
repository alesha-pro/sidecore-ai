/**
 * Secure error handling for LLM API requests
 * ERR-03 requirement: Never expose API keys, headers, or raw error bodies
 */

export type LLMErrorType =
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'rate_limit'
  | 'server_error'
  | 'timeout'
  | 'network'
  | 'unknown';

export class LLMError extends Error {
  public readonly userMessage: string;
  public readonly statusCode?: number;
  public readonly errorType: LLMErrorType;
  private readonly internalDetails: string;

  constructor(
    userMessage: string,
    errorType: LLMErrorType,
    internalDetails: string,
    statusCode?: number
  ) {
    super(userMessage);
    this.name = 'LLMError';
    this.userMessage = userMessage;
    this.errorType = errorType;
    this.internalDetails = internalDetails;
    this.statusCode = statusCode;
  }

  /**
   * Returns detailed error information for logging only.
   * NEVER display this to the user - it may contain sensitive information.
   */
  toLogString(): string {
    return `LLMError[${this.errorType}]: ${this.userMessage} | Details: ${this.internalDetails} | Status: ${this.statusCode || 'N/A'}`;
  }
}

/**
 * Maps HTTP response to user-friendly error message
 * IMPORTANT: Never exposes API keys, headers, or raw error bodies
 */
export async function createLLMError(response: Response): Promise<LLMError> {
  const status = response.status;
  let internalDetails = `HTTP ${status} ${response.statusText}`;

  // Try to parse response body for logging (but don't expose to user)
  try {
    const body = await response.text();
    internalDetails += ` | Body: ${body.substring(0, 200)}`;
  } catch {
    // If body parsing fails, continue with basic details
  }

  // Map status codes to user-friendly messages
  switch (status) {
    case 401:
      return new LLMError(
        'Invalid API key. Please check your settings.',
        'auth',
        internalDetails,
        status
      );

    case 403:
      return new LLMError(
        'Access denied. Your API key may not have permission for this model.',
        'forbidden',
        internalDetails,
        status
      );

    case 404:
      return new LLMError(
        'Model or endpoint not found. Please verify your Base URL and model selection.',
        'not_found',
        internalDetails,
        status
      );

    case 429:
      return new LLMError(
        'Rate limit exceeded. Please wait a moment and try again.',
        'rate_limit',
        internalDetails,
        status
      );

    case 500:
    case 502:
    case 503:
      return new LLMError(
        'The AI service is temporarily unavailable. Please try again later.',
        'server_error',
        internalDetails,
        status
      );

    default:
      return new LLMError(
        'An unexpected error occurred. Please try again.',
        'unknown',
        internalDetails,
        status
      );
  }
}

/**
 * Handles network errors and timeouts
 */
export function createNetworkError(error: Error): LLMError {
  const isTimeout = error.name === 'AbortError';

  if (isTimeout) {
    return new LLMError(
      'Request timed out. Please check your connection and try again.',
      'timeout',
      error.message
    );
  }

  return new LLMError(
    'Network error. Please check your internet connection.',
    'network',
    error.message
  );
}
