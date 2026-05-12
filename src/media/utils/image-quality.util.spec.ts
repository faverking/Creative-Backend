import { parseImageBuffer, toImageQualityView } from './image-quality.util';

describe('image-quality.util', () => {
  it('prefers file signature over mime type when parsing image metadata', () => {
    const buffer = Buffer.alloc(24);
    buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    buffer.writeUInt32BE(3840, 16);
    buffer.writeUInt32BE(2160, 20);

    const parsed = parseImageBuffer(buffer, 'image/jpeg');

    expect(parsed).toEqual({
      format: 'png',
      mimeType: 'image/png',
      extension: '.png',
      width: 3840,
      height: 2160,
    });
  });

  it('parses jpeg metadata and normalizes output', () => {
    const buffer = Buffer.from([
      0xff, 0xd8,
      0xff, 0xe0, 0x00, 0x10,
      0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x04, 0x38, 0x07, 0x80, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11,
      0x01, 0x03, 0x11, 0x01,
    ]);

    const parsed = parseImageBuffer(buffer);

    expect(parsed).toEqual({
      format: 'jpeg',
      mimeType: 'image/jpeg',
      extension: '.jpg',
      width: 1920,
      height: 1080,
    });
  });

  it('returns undefined for invalid image buffers', () => {
    expect(parseImageBuffer(Buffer.from('not-an-image'), 'image/png')).toBeUndefined();
  });

  it('maps image metadata to quality labels', () => {
    expect(toImageQualityView({ width: 3840, height: 2160 })).toMatchObject({
      resolution: '3840x2160',
      qualityLabel: '4K',
    });
    expect(toImageQualityView({ width: 1920, height: 1080 })).toMatchObject({
      qualityLabel: '1080P',
    });
    expect(toImageQualityView({ width: 800, height: 600 })).toMatchObject({
      qualityLabel: 'SD',
    });
  });
});
