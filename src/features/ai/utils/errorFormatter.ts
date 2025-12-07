export const formatAiError = (error: any): string => {
  let errorObj = error;

  // 1. If error is a string, try to parse it as JSON first
  if (typeof error === 'string') {
    try {
      errorObj = JSON.parse(error);
    } catch {
      // If not JSON, it might be a simple error message string
      return error;
    }
  }

  // 2. Extract meaningful data structure
  const errorData = errorObj.response?.data || errorObj;
  
  // If errorData is still a string (e.g. nested stringified JSON in response.data), try parse again
  let parsedErrorData = errorData;
  if (typeof errorData === 'string') {
      try {
        parsedErrorData = JSON.parse(errorData);
      } catch {
        return errorData;
      }
  }

  // 3. Handle Gemini/Google specific format
  const innerError = parsedErrorData.error || parsedErrorData;

  if (innerError?.status === 'RESOURCE_EXHAUSTED' || innerError?.code === 429) {
    const details = innerError.details || [];
    const retryInfo = details.find((d: any) => d['@type']?.includes('RetryInfo'));
    
    let message = "You have exceeded the daily free quota for AI generation.";
    if (retryInfo?.retryDelay) {
      const delay = retryInfo.retryDelay.replace('s', '');
      const seconds = Math.ceil(parseFloat(delay));
      message += ` Please retry in ${seconds} seconds.`;
    } else {
      message += " Please try again later.";
    }
    return message;
  }

  // 4. Handle other common error message fields
  if (typeof innerError === 'string') return innerError;
  
  if (parsedErrorData.error?.message) {
    return parsedErrorData.error.message;
  }
  
  if (parsedErrorData.message) {
    return parsedErrorData.message;
  }

  // 5. Fallback
  return error.message || "An unexpected error occurred during AI generation";
};
