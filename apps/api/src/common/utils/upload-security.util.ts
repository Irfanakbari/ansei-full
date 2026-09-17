import { UnsupportedMediaTypeException } from '@nestjs/common';
import { extname } from 'node:path';

export type SupportedUploadKind =
  'png' | 'jpeg' | 'pdf' | 'xlsx' | 'gif' | 'webp' | 'mp4' | 'webm' | 'ogg';

const MIME_TYPES: Record<SupportedUploadKind, readonly string[]> = {
  png: ['image/png'],
  jpeg: ['image/jpeg'],
  pdf: ['application/pdf'],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ],
  gif: ['image/gif'],
  webp: ['image/webp'],
  mp4: ['video/mp4'],
  webm: ['video/webm'],
  ogg: ['video/ogg', 'application/ogg'],
};

const EXTENSIONS: Record<SupportedUploadKind, readonly string[]> = {
  png: ['png'],
  jpeg: ['jpg', 'jpeg'],
  pdf: ['pdf'],
  xlsx: ['xlsx'],
  gif: ['gif'],
  webp: ['webp'],
  mp4: ['mp4'],
  webm: ['webm'],
  ogg: ['ogg', 'ogv'],
};

function hasBytes(
  buffer: Buffer,
  offset: number,
  bytes: readonly number[],
): boolean {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function hasAscii(buffer: Buffer, offset: number, value: string): boolean {
  return (
    buffer.subarray(offset, offset + value.length).toString('ascii') === value
  );
}

function matchesSignature(kind: SupportedUploadKind, buffer: Buffer): boolean {
  switch (kind) {
    case 'png':
      return hasBytes(
        buffer,
        0,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      );
    case 'jpeg':
      return hasBytes(buffer, 0, [0xff, 0xd8, 0xff]) && buffer.length >= 4;
    case 'pdf':
      return hasAscii(buffer, 0, '%PDF-');
    case 'xlsx':
      return (
        hasBytes(buffer, 0, [0x50, 0x4b, 0x03, 0x04]) &&
        buffer.includes(Buffer.from('[Content_Types].xml')) &&
        buffer.includes(Buffer.from('xl/'))
      );
    case 'gif':
      return hasAscii(buffer, 0, 'GIF87a') || hasAscii(buffer, 0, 'GIF89a');
    case 'webp':
      return hasAscii(buffer, 0, 'RIFF') && hasAscii(buffer, 8, 'WEBP');
    case 'mp4':
      return buffer.length >= 12 && hasAscii(buffer, 4, 'ftyp');
    case 'webm':
      return hasBytes(buffer, 0, [0x1a, 0x45, 0xdf, 0xa3]);
    case 'ogg':
      return hasAscii(buffer, 0, 'OggS');
  }
}

export function validateUploadContent(
  file: Express.Multer.File,
  allowedKinds: readonly SupportedUploadKind[],
): SupportedUploadKind {
  const extension = extname(file.originalname).slice(1).toLowerCase();
  const kind = allowedKinds.find((candidate) =>
    EXTENSIONS[candidate].includes(extension),
  );

  if (
    !kind ||
    !MIME_TYPES[kind].includes(file.mimetype.toLowerCase()) ||
    !matchesSignature(kind, file.buffer)
  ) {
    throw new UnsupportedMediaTypeException(
      `File extension, MIME type, and content signature must match. Supported extensions: ${allowedKinds.flatMap((candidate) => EXTENSIONS[candidate]).join(', ')}`,
    );
  }

  return kind;
}
