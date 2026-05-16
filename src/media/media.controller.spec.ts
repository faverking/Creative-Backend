import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { rm } from 'node:fs/promises';
import request = require('supertest');
import { attachTraceId } from '../common/middleware/request-context.middleware';
import { MediaApplicationService } from './application/media.application';
import { MediaController } from './media.controller';

describe('MediaController uploads', () => {
  let app: INestApplication;
  const mediaApplicationService = {
    uploadImages: jest.fn(),
    uploadAudio: jest.fn(),
    uploadZip: jest.fn(),
    listMedia: jest.fn(),
    resolveMedia: jest.fn(),
    prepareBatchImageDownload: jest.fn(),
    prepareDirectZipDownload: jest.fn(),
    prepareZipDownload: jest.fn(),
    getMediaDetail: jest.fn(),
    preparePreview: jest.fn(),
    prepareDownload: jest.fn(),
    createReadStream: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaApplicationService,
          useValue: mediaApplicationService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              switch (key) {
                case 'media.batchUploadLimit':
                  return 20;
                case 'media.imageMaxFileSize':
                  return 1024;
                case 'media.audioMaxFileSize':
                  return 512;
                case 'media.zipMaxFileSize':
                  return 1024;
                default:
                  return defaultValue;
              }
            }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(attachTraceId);
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = {
        userId: 'user-1',
        roles: ['user'],
        passwordVersion: 1,
        status: 'active',
        name: 'Tester',
      };
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
    return rm('.tmp-uploads', { recursive: true, force: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('uploads multiple images within the configured limit', async () => {
    mediaApplicationService.uploadImages.mockResolvedValue({
      items: [{ id: 'media-1' }, { id: 'media-2' }],
      total: 2,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/media/images/upload')
      .attach('files', Buffer.alloc(128, 1), { filename: 'a.png', contentType: 'image/png' })
      .attach('files', Buffer.alloc(256, 2), { filename: 'b.png', contentType: 'image/png' });

    expect(response.status).toBe(201);
    expect(mediaApplicationService.uploadImages).toHaveBeenCalledTimes(1);
    expect(mediaApplicationService.uploadImages.mock.calls[0][0]).toHaveLength(2);
    expect(mediaApplicationService.uploadImages.mock.calls[0][0][0].path).toEqual(expect.any(String));
    expect(mediaApplicationService.uploadImages.mock.calls[0][0][0].buffer).toBeUndefined();
    expect(mediaApplicationService.uploadImages.mock.calls[0][1]).toBe('user-1');
  });

  it('rejects image uploads that exceed the configured file count limit', async () => {
    const req = request(app.getHttpServer()).post('/api/v1/media/images/upload');
    for (let index = 0; index < 21; index += 1) {
      req.attach('files', Buffer.alloc(64, index), {
        filename: `image-${index}.png`,
        contentType: 'image/png',
      });
    }

    const response = await req;

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('count exceeds limit of 20');
    expect(mediaApplicationService.uploadImages).not.toHaveBeenCalled();
  });

  it('rejects image uploads that exceed the configured single-file size limit', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/media/images/upload')
      .attach('files', Buffer.alloc(2048, 1), { filename: 'oversize.png', contentType: 'image/png' });

    expect(response.status).toBe(413);
    expect(response.body.message).toContain('Image file exceeds size limit of 1024 bytes');
    expect(mediaApplicationService.uploadImages).not.toHaveBeenCalled();
  });

  it('rejects audio uploads that exceed the configured size limit', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/media/audio/upload')
      .attach('file', Buffer.alloc(1024, 1), { filename: 'oversize.mp3', contentType: 'audio/mpeg' });

    expect(response.status).toBe(413);
    expect(response.body.message).toContain('Audio file exceeds size limit of 512 bytes');
    expect(mediaApplicationService.uploadAudio).not.toHaveBeenCalled();
  });

  it('rejects zip uploads that exceed the configured size limit', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/media/zip/upload')
      .attach('file', Buffer.alloc(2048, 1), { filename: 'oversize.zip', contentType: 'application/zip' });

    expect(response.status).toBe(413);
    expect(response.body.message).toContain('ZIP file exceeds size limit of 1024 bytes');
    expect(mediaApplicationService.uploadZip).not.toHaveBeenCalled();
  });
});
