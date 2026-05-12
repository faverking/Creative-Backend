const MOJIBAKE_PATTERN = /[\u00C0-\u00FF]/;

export function normalizeMediaFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return 'unnamed-file';
  }

  if (!MOJIBAKE_PATTERN.test(trimmed)) {
    return trimmed;
  }

  try {
    const decoded = Buffer.from(trimmed, 'latin1').toString('utf8').trim();
    if (decoded && !decoded.includes('\uFFFD')) {
      return decoded;
    }
  } catch {
    // Ignore decode failures and fall back to the original file name.
  }

  return trimmed;
}

export function encodeContentDispositionFileName(fileName: string, fallbackFileName: string): string {
  const normalized = normalizeMediaFileName(fileName);
  return encodeURIComponent(normalized || fallbackFileName);
}
