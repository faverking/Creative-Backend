export function isMediaUploadDebugEnabled(): boolean {
  return process.env.MEDIA_UPLOAD_DEBUG === 'true' || process.env.MEDIA_UPLOAD_DEBUG === 'break';
}

export function maybeBreakMediaUpload(phase: string, payload: Record<string, unknown>): void {
  if (process.env.MEDIA_UPLOAD_DEBUG !== 'break') {
    return;
  }

  void phase;
  void payload;
  debugger;
}
