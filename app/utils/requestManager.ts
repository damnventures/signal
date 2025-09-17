/**
 * Simple global state to prevent duplicate wrap requests
 */
let isWrapRequestActive = false;
let lastWrapRequestTime = 0;

/**
 * Simple function to ensure only one wrap request at a time
 */
export async function executeWrapRequest(
  requestFn: () => Promise<any>,
  source: string,
  minInterval: number = 2000
): Promise<any> {
  console.log(`[WrapRequest] ${source} - checking if can proceed`);

  // If request is already active, skip
  if (isWrapRequestActive) {
    console.log(`[WrapRequest] ${source} - skipping, request already active`);
    throw new Error('Wrap request already in progress');
  }

  // Check rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastWrapRequestTime;
  if (timeSinceLastRequest < minInterval) {
    console.log(`[WrapRequest] ${source} - rate limited, wait ${minInterval - timeSinceLastRequest}ms`);
    throw new Error('Rate limited');
  }

  // Mark as active and execute
  isWrapRequestActive = true;
  lastWrapRequestTime = now;
  console.log(`[WrapRequest] ${source} - starting request`);

  try {
    const result = await requestFn();
    console.log(`[WrapRequest] ${source} - completed`);
    return result;
  } catch (error) {
    console.error(`[WrapRequest] ${source} - failed:`, error);
    throw error;
  } finally {
    isWrapRequestActive = false;
  }
}

/**
 * Simple retry for 3040 errors only
 */
export async function retryOn3040<T>(fn: () => Promise<T>, maxRetries: number = 2): Promise<T> {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Only retry on 3040 errors
      const is3040Error = error instanceof Error &&
        (error.message.includes('3040') || error.message.includes('temporarily overloaded'));

      if (!is3040Error || attempt === maxRetries) {
        throw error;
      }

      const delay = 1000 * (attempt + 1); // 1s, 2s, 3s
      console.log(`[Retry] Attempt ${attempt + 1} failed with 3040, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}