/**
 * Sanitize user input to prevent XSS attacks
 * Escapes HTML special characters
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
};

/**
 * Sanitize text for display (removes HTML tags and escapes special characters)
 */
export const sanitizeForDisplay = (text) => {
  if (typeof text !== 'string') return text;
  
  // Remove any HTML tags and escape special characters
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

