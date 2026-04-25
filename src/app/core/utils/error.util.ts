export function resolveErrorMessage(error: any, fallback: string): string {
  if (error?.error) {
    const outerErr = error.error;
    if (typeof outerErr === 'string' && outerErr.trim().length > 0) {
      return outerErr;
    }
    const innerErr = outerErr?.error;
    if (typeof innerErr === 'string' && innerErr.trim().length > 0) {
      return innerErr;
    }
    if (typeof innerErr?.message === 'string' && innerErr.message.trim().length > 0) {
      return innerErr.message;
    }
    if (typeof outerErr?.message === 'string' && outerErr.message.trim().length > 0) {
      return outerErr.message;
    }
  }
  if (typeof error?.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}
