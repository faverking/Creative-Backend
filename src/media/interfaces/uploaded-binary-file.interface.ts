export interface UploadedBinaryFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}