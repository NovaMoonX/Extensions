// Check if input is a URL
export function isURL(input) {
  try {
    // Try to parse as URL
    new URL(input);
    return true;
  } catch {
    // Try adding https:// if it looks like a domain
    if (input.includes('.') && !input.includes(' ')) {
      try {
        new URL(`https://${input}`);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

// Normalize URL to proper format
export function normalizeURL(input) {
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }
  return `https://${input}`;
}