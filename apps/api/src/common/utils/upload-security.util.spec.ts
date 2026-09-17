import { UnsupportedMediaTypeException } from '@nestjs/common';
import { validateUploadContent } from './upload-security.util';

function file(
  name: string,
  mimetype: string,
  buffer: Buffer,
): Express.Multer.File {
  return {
    originalname: name,
    mimetype,
    buffer,
    size: buffer.length,
  } as Express.Multer.File;
}

describe('validateUploadContent', () => {
  it('accepts a valid PNG signature', () => {
    const upload = file(
      'image.png',
      'image/png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(validateUploadContent(upload, ['png'])).toBe('png');
  });

  it('rejects spoofed content', () => {
    expect(() =>
      validateUploadContent(
        file('document.pdf', 'application/pdf', Buffer.from('not a pdf')),
        ['pdf'],
      ),
    ).toThrow(UnsupportedMediaTypeException);
  });

  it('rejects extension and MIME mismatch', () => {
    expect(() =>
      validateUploadContent(
        file('image.jpg', 'image/png', Buffer.from([0xff, 0xd8, 0xff, 0xd9])),
        ['jpeg'],
      ),
    ).toThrow(UnsupportedMediaTypeException);
  });

  it.each([
    ['gif', 'image.gif', 'image/gif', Buffer.from('GIF89a')],
    [
      'webp',
      'image.webp',
      'image/webp',
      Buffer.concat([Buffer.from('RIFF0000WEBP'), Buffer.alloc(4)]),
    ],
    [
      'mp4',
      'video.mp4',
      'video/mp4',
      Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom')]),
    ],
    ['webm', 'video.webm', 'video/webm', Buffer.from([0x1a, 0x45, 0xdf, 0xa3])],
    ['ogg', 'video.ogg', 'video/ogg', Buffer.from('OggS')],
  ] as const)('accepts valid %s content', (kind, name, mimetype, buffer) => {
    expect(validateUploadContent(file(name, mimetype, buffer), [kind])).toBe(
      kind,
    );
  });
});
