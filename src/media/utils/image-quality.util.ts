export interface StoredImageMeta {
  width: number;
  height: number;
}

export const IMAGE_FORMATS = ['png', 'gif', 'jpeg', 'webp'] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

export interface ImageQualityView extends StoredImageMeta {
  resolution: string;
  qualityLabel: string;
}

export interface ParsedImageBuffer extends StoredImageMeta {
  format: ImageFormat;
  mimeType: string;
  extension: string;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF87A_SIGNATURE = Buffer.from('GIF87a');
const GIF89A_SIGNATURE = Buffer.from('GIF89a');
const JPEG_START_MARKER = Buffer.from([0xff, 0xd8]);
const WEBP_RIFF_SIGNATURE = Buffer.from('RIFF');
const WEBP_SIGNATURE = Buffer.from('WEBP');

export function extractImageMeta(buffer: Buffer, mimeType?: string): StoredImageMeta | undefined {
  return parseImageBuffer(buffer, mimeType);
}

export function toImageQualityView(imageMeta?: StoredImageMeta | null): ImageQualityView | undefined {
  if (!imageMeta || imageMeta.width <= 0 || imageMeta.height <= 0) {
    return undefined;
  }

  return {
    width: imageMeta.width,
    height: imageMeta.height,
    resolution: `${imageMeta.width}x${imageMeta.height}`,
    qualityLabel: resolveImageQualityLabel(imageMeta.width, imageMeta.height),
  };
}

function resolveImageQualityLabel(width: number, height: number): string {
  const maxEdge = Math.max(width, height);

  if (maxEdge >= 7680) {
    return '8K';
  }

  if (maxEdge >= 5120) {
    return '5K';
  }

  if (maxEdge >= 3840) {
    return '4K';
  }

  if (maxEdge >= 2560) {
    return '2K';
  }

  if (maxEdge >= 1920) {
    return '1080P';
  }

  if (maxEdge >= 1280) {
    return '720P';
  }

  if (maxEdge >= 854) {
    return '480P';
  }

  return 'SD';
}

export function parseImageBuffer(buffer: Buffer, mimeType?: string): ParsedImageBuffer | undefined {
  const format = detectImageFormat(buffer, mimeType);
  if (!format) {
    return undefined;
  }

  const imageMeta = extractImageMetaByFormat(buffer, format);
  if (!imageMeta) {
    return undefined;
  }

  return {
    ...imageMeta,
    format,
    mimeType: resolveImageMimeType(format),
    extension: resolveImageExtension(format),
  };
}

function hasSignature(buffer: Buffer, signature: Buffer): boolean {
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
}

function detectImageFormat(buffer: Buffer, mimeType?: string): ImageFormat | undefined {
  if (buffer.length >= PNG_SIGNATURE.length && hasSignature(buffer, PNG_SIGNATURE)) {
    return 'png';
  }

  if (buffer.length >= GIF87A_SIGNATURE.length && (hasSignature(buffer, GIF87A_SIGNATURE) || hasSignature(buffer, GIF89A_SIGNATURE))) {
    return 'gif';
  }

  if (buffer.length >= JPEG_START_MARKER.length && hasSignature(buffer, JPEG_START_MARKER)) {
    return 'jpeg';
  }

  if (
    buffer.length >= 12 &&
    hasSignature(buffer, WEBP_RIFF_SIGNATURE) &&
    buffer.subarray(8, 12).equals(WEBP_SIGNATURE)
  ) {
    return 'webp';
  }

  return resolveImageFormatFromMimeType(mimeType);
}

function resolveImageFormatFromMimeType(mimeType?: string): ImageFormat | undefined {
  switch (mimeType?.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/jpeg':
      return 'jpeg';
    case 'image/webp':
      return 'webp';
    default:
      return undefined;
  }
}

function resolveImageMimeType(format: ImageFormat): string {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
  }
}

function resolveImageExtension(format: ImageFormat): string {
  switch (format) {
    case 'png':
      return '.png';
    case 'gif':
      return '.gif';
    case 'jpeg':
      return '.jpg';
    case 'webp':
      return '.webp';
  }
}

function extractImageMetaByFormat(buffer: Buffer, format: ImageFormat): StoredImageMeta | undefined {
  switch (format) {
    case 'png':
      return extractPngMeta(buffer);
    case 'gif':
      return extractGifMeta(buffer);
    case 'jpeg':
      return extractJpegMeta(buffer);
    case 'webp':
      return extractWebpMeta(buffer);
  }
}

function extractPngMeta(buffer: Buffer): StoredImageMeta | undefined {
  if (buffer.length < 24 || !hasSignature(buffer, PNG_SIGNATURE)) {
    return undefined;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function extractGifMeta(buffer: Buffer): StoredImageMeta | undefined {
  if (buffer.length < 10) {
    return undefined;
  }

  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

function extractJpegMeta(buffer: Buffer): StoredImageMeta | undefined {
  if (buffer.length < 4 || !hasSignature(buffer, JPEG_START_MARKER)) {
    return undefined;
  }

  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    let markerOffset = offset + 1;
    while (markerOffset < buffer.length && buffer[markerOffset] === 0xff) {
      markerOffset += 1;
    }

    if (markerOffset >= buffer.length) {
      return undefined;
    }

    const marker = buffer[markerOffset];
    offset = markerOffset + 1;

    if (marker === 0xd8 || marker === 0x01) {
      continue;
    }

    if (marker === 0xd9 || marker === 0xda) {
      return undefined;
    }

    if (offset + 1 >= buffer.length) {
      return undefined;
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      return undefined;
    }

    if (isSofMarker(marker)) {
      if (offset + 7 >= buffer.length) {
        return undefined;
      }

      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3),
      };
    }

    offset += segmentLength;
  }

  return undefined;
}

function isSofMarker(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function extractWebpMeta(buffer: Buffer): StoredImageMeta | undefined {
  if (buffer.length < 30 || !hasSignature(buffer, WEBP_RIFF_SIGNATURE) || !buffer.subarray(8, 12).equals(WEBP_SIGNATURE)) {
    return undefined;
  }

  const chunkType = buffer.toString('ascii', 12, 16);

  if (chunkType === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (chunkType === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkType === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
    const byte1 = buffer[21];
    const byte2 = buffer[22];
    const byte3 = buffer[23];
    const byte4 = buffer[24];

    return {
      width: 1 + (((byte2 & 0x3f) << 8) | byte1),
      height: 1 + (((byte4 & 0x0f) << 10) | (byte3 << 2) | ((byte2 & 0xc0) >> 6)),
    };
  }

  return undefined;
}
