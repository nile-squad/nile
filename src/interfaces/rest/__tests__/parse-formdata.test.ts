import { describe, expect, it } from 'vitest';
import {
  collectFiles,
  parseFormData,
  parseFormDataFlat,
  detectMixedKeys,
  validateFilenameLength,
  validateZeroByteFiles,
  validateMinFileSize,
  validateFileCount,
  validateFileSize,
  validateTotalSize,
  validateAllowlist,
  validateFiles,
} from '../uploads/parse-formdata';

// Helper to create mock File objects
function createMockFile(
  name: string,
  size: number,
  type: string = 'image/png'
): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
}

// Helper to create FormData with fields and files
function createFormData(
  fields: Record<string, string | string[]>,
  files: Record<string, File | File[]>
): FormData {
  const formData = new FormData();

  // Add fields
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        formData.append(key, v);
      }
    } else {
      formData.append(key, value);
    }
  }

  // Add files
  for (const [key, value] of Object.entries(files)) {
    if (Array.isArray(value)) {
      for (const file of value) {
        formData.append(key, file);
      }
    } else {
      formData.append(key, value);
    }
  }

  return formData;
}

describe('parse-formdata utility', () => {
  describe('collectFiles', () => {
    it('should extract all File objects from FormData', () => {
      const file1 = createMockFile('test1.png', 100);
      const file2 = createMockFile('test2.jpg', 200);
      const formData = createFormData(
        { name: 'John', email: 'john@example.com' },
        { avatar: file1, document: file2 }
      );

      const files = collectFiles(formData);

      expect(files).toHaveLength(2);
      expect(files[0].name).toBe('test1.png');
      expect(files[1].name).toBe('test2.jpg');
    });

    it('should return empty array when no files present', () => {
      const formData = createFormData({ name: 'John' }, {});
      const files = collectFiles(formData);
      expect(files).toHaveLength(0);
    });

    it('should handle multiple files with same field name', () => {
      const file1 = createMockFile('doc1.pdf', 100);
      const file2 = createMockFile('doc2.pdf', 200);
      const formData = new FormData();
      formData.append('documents', file1);
      formData.append('documents', file2);

      const files = collectFiles(formData);

      expect(files).toHaveLength(2);
    });
  });

  describe('parseFormData', () => {
    it('should separate fields and files', () => {
      const file = createMockFile('avatar.png', 100);
      const formData = createFormData(
        { name: 'John', email: 'john@example.com' },
        { avatar: file }
      );

      const payload = parseFormData(formData);

      expect(payload).toEqual({
        fields: {
          name: 'John',
          email: 'john@example.com',
        },
        files: {
          avatar: file,
        },
      });
    });

    it('should aggregate duplicate field names into arrays', () => {
      const formData = new FormData();
      formData.append('tags', 'javascript');
      formData.append('tags', 'typescript');
      formData.append('tags', 'nodejs');

      const payload = parseFormData(formData);

      expect(payload).toEqual({
        fields: {
          tags: ['javascript', 'typescript', 'nodejs'],
        },
        files: {},
      });
    });

    it('should aggregate duplicate files into arrays', () => {
      const file1 = createMockFile('doc1.pdf', 100);
      const file2 = createMockFile('doc2.pdf', 200);
      const formData = new FormData();
      formData.append('documents', file1);
      formData.append('documents', file2);

      const payload = parseFormData(formData);

      expect(payload).toEqual({
        fields: {},
        files: {
          documents: [file1, file2],
        },
      });
    });

    it('should exclude action field', () => {
      const formData = createFormData({ action: 'upload', name: 'John' }, {});

      const payload = parseFormData(formData);

      expect(payload).toEqual({
        fields: { name: 'John' },
        files: {},
      });
    });
  });

  describe('validateFilenameLength', () => {
    it('should pass for filenames within limit', () => {
      const files = [
        createMockFile('short.png', 100),
        createMockFile('medium_length_file.jpg', 200),
      ];

      const result = validateFilenameLength(files, 128);

      expect(result.status).toBe(true);
    });

    it('should fail for filenames exceeding limit', () => {
      const longName = 'a'.repeat(200) + '.png';
      const files = [createMockFile(longName, 100)];

      const result = validateFilenameLength(files, 128);

      expect(result.status).toBe(false);
      expect(result.message).toBe('file name too long');
      expect(result.data.error_category).toBe('validation');
      expect(result.data.maxLength).toBe(128);
      expect(result.data.files).toContain(longName);
    });
  });

  describe('validateZeroByteFiles', () => {
    it('should pass for files with content', () => {
      const files = [createMockFile('file1.png', 100), createMockFile('file2.jpg', 200)];

      const result = validateZeroByteFiles(files);

      expect(result.status).toBe(true);
    });

    it('should fail for zero-byte files', () => {
      const files = [createMockFile('empty.png', 0), createMockFile('valid.jpg', 100)];

      const result = validateZeroByteFiles(files);

      expect(result.status).toBe(false);
      expect(result.message).toBe('empty file not allowed');
      expect(result.data.error_category).toBe('validation');
      expect(result.data.files).toContain('empty.png');
    });
  });

  describe('validateMinFileSize', () => {
    it('should pass when all files meet minimum size', () => {
      const files = [createMockFile('file1.png', 1024), createMockFile('file2.jpg', 2048)];

      const result = validateMinFileSize(files, 512);

      expect(result.status).toBe(true);
    });

    it('should fail when files are below minimum size', () => {
      const files = [createMockFile('small.png', 100), createMockFile('valid.jpg', 2048)];

      const result = validateMinFileSize(files, 512);

      expect(result.status).toBe(false);
      expect(result.message).toBe('file too small');
      expect(result.data.error_category).toBe('validation');
      expect(result.data.limit).toBe('minFileSize');
      expect(result.data.min).toBe(512);
      expect(result.data.files).toHaveLength(1);
      expect(result.data.files[0].name).toBe('small.png');
      expect(result.data.files[0].size).toBe(100);
    });

    it('should pass when minimum size is 0', () => {
      const files = [createMockFile('tiny.png', 1)];

      const result = validateMinFileSize(files, 0);

      expect(result.status).toBe(true);
    });
  });

  describe('validateFileCount', () => {
    it('should pass when file count is within limit', () => {
      const files = [
        createMockFile('file1.png', 100),
        createMockFile('file2.png', 100),
      ];

      const result = validateFileCount(files, 10);

      expect(result.status).toBe(true);
    });

    it('should fail when file count exceeds limit', () => {
      const files = Array.from({ length: 15 }, (_, i) =>
        createMockFile(`file${i}.png`, 100)
      );

      const result = validateFileCount(files, 10);

      expect(result.status).toBe(false);
      expect(result.message).toBe('upload limit exceeded');
      expect(result.data.limit).toBe('maxFiles');
      expect(result.data.max).toBe(10);
      expect(result.data.received).toBe(15);
    });
  });

  describe('validateFileSize', () => {
    it('should pass when all files are within size limit', () => {
      const files = [
        createMockFile('file1.png', 5 * 1024 * 1024), // 5MB
        createMockFile('file2.png', 3 * 1024 * 1024), // 3MB
      ];

      const result = validateFileSize(files, 10 * 1024 * 1024); // 10MB limit

      expect(result.status).toBe(true);
    });

    it('should fail when any file exceeds size limit', () => {
      const files = [
        createMockFile('small.png', 1024),
        createMockFile('huge.png', 15 * 1024 * 1024), // 15MB
      ];

      const result = validateFileSize(files, 10 * 1024 * 1024); // 10MB limit

      expect(result.status).toBe(false);
      expect(result.message).toBe('upload limit exceeded');
      expect(result.data.limit).toBe('maxFileSize');
      expect(result.data.files[0].name).toBe('huge.png');
    });
  });

  describe('validateTotalSize', () => {
    it('should pass when total size is within limit', () => {
      const files = [
        createMockFile('file1.png', 5 * 1024 * 1024), // 5MB
        createMockFile('file2.png', 5 * 1024 * 1024), // 5MB
      ];

      const result = validateTotalSize(files, 20 * 1024 * 1024); // 20MB limit

      expect(result.status).toBe(true);
    });

    it('should fail when total size exceeds limit', () => {
      const files = [
        createMockFile('file1.png', 10 * 1024 * 1024), // 10MB
        createMockFile('file2.png', 15 * 1024 * 1024), // 15MB
      ];

      const result = validateTotalSize(files, 20 * 1024 * 1024); // 20MB limit

      expect(result.status).toBe(false);
      expect(result.message).toBe('upload limit exceeded');
      expect(result.data.limit).toBe('maxTotalSize');
      expect(result.data.total).toBe(25 * 1024 * 1024);
    });
  });

  describe('validateAllowlist', () => {
    it('should pass for allowed mime types and extensions', () => {
      const files = [
        createMockFile('image.png', 100, 'image/png'),
        createMockFile('photo.jpg', 100, 'image/jpeg'),
        createMockFile('document.pdf', 100, 'application/pdf'),
      ];

      const result = validateAllowlist(
        files,
        ['image/png', 'image/jpeg', 'application/pdf'],
        ['.png', '.jpg', '.jpeg', '.pdf']
      );

      expect(result.status).toBe(true);
    });

    it('should fail for disallowed mime type', () => {
      const files = [
        createMockFile('video.mp4', 100, 'video/mp4'),
        createMockFile('image.png', 100, 'image/png'),
      ];

      const result = validateAllowlist(
        files,
        ['image/png', 'image/jpeg'],
        ['.png', '.jpg']
      );

      expect(result.status).toBe(false);
      expect(result.message).toBe('file type not allowed');
      expect(result.data.rejected[0].name).toBe('video.mp4');
    });

    it('should fail for disallowed extension', () => {
      const files = [createMockFile('script.exe', 100, 'application/x-msdownload')];

      const result = validateAllowlist(
        files,
        ['image/png', 'image/jpeg'],
        ['.png', '.jpg']
      );

      expect(result.status).toBe(false);
      expect(result.data.rejected[0].name).toBe('script.exe');
    });

    it('should handle case-insensitive extension matching', () => {
      const files = [createMockFile('IMAGE.PNG', 100, 'image/png')];

      const result = validateAllowlist(files, ['image/png'], ['.png']);

      expect(result.status).toBe(true);
    });
  });

  describe('validateFiles - integrated validation', () => {
    it('should pass all validations for valid files', () => {
      const files = [
        createMockFile('photo.jpg', 1024 * 1024, 'image/jpeg'),
        createMockFile('document.pdf', 2 * 1024 * 1024, 'application/pdf'),
      ];

      const result = validateFiles(files, {
        limits: {
          maxFiles: 10,
          maxFileSize: 10 * 1024 * 1024,
          maxTotalSize: 20 * 1024 * 1024,
          maxFilenameLength: 128,
        },
        allow: {
          mimeTypes: ['image/jpeg', 'application/pdf'],
          extensions: ['.jpg', '.pdf'],
        },
      });

      expect(result.status).toBe(true);
    });

    it('should use default limits when not specified', () => {
      const files = [createMockFile('image.png', 1024, 'image/png')];

      const result = validateFiles(files, {});

      expect(result.status).toBe(true);
    });

    it('should fail fast on first validation error (filename length)', () => {
      const longName = 'a'.repeat(200) + '.png';
      const files = [
        createMockFile(longName, 0, 'image/png'), // Also zero-byte and valid type
      ];

      const result = validateFiles(files, {
        limits: { maxFilenameLength: 128 },
      });

      expect(result.status).toBe(false);
      expect(result.message).toBe('file name too long');
    });

    it('should fail on zero-byte after filename check passes', () => {
      const files = [createMockFile('valid.png', 0, 'image/png')];

      const result = validateFiles(files, {});

      expect(result.status).toBe(false);
      expect(result.message).toBe('empty file not allowed');
    });

    it('should fail on file count after size checks pass', () => {
      const files = Array.from({ length: 15 }, (_, i) =>
        createMockFile(`file${i}.png`, 1024, 'image/png')
      );

      const result = validateFiles(files, {
        limits: { maxFiles: 5 },
      });

      expect(result.status).toBe(false);
      expect(result.data.limit).toBe('maxFiles');
    });

    it('should return success for empty file array', () => {
      const result = validateFiles([], {});

      expect(result.status).toBe(true);
    });
  });

  describe('detectMixedKeys', () => {
    it('should return empty array when no conflicts', () => {
      const file = createMockFile('avatar.png', 100);
      const formData = createFormData(
        { name: 'John', email: 'john@example.com' },
        { avatar: file }
      );

      const conflicts = detectMixedKeys(formData);

      expect(conflicts).toEqual([]);
    });

    it('should detect key used for both file and field', () => {
      const file = createMockFile('avatar.png', 100);
      const formData = new FormData();
      formData.append('upload', 'metadata');
      formData.append('upload', file);

      const conflicts = detectMixedKeys(formData);

      expect(conflicts).toEqual(['upload']);
    });

    it('should ignore action field in conflict detection', () => {
      const formData = new FormData();
      formData.append('action', 'upload');
      formData.append('name', 'John');

      const conflicts = detectMixedKeys(formData);

      expect(conflicts).toEqual([]);
    });

    it('should detect multiple conflicts', () => {
      const file1 = createMockFile('doc1.pdf', 100);
      const file2 = createMockFile('doc2.pdf', 100);
      const formData = new FormData();
      formData.append('item1', 'text');
      formData.append('item1', file1);
      formData.append('item2', 'text');
      formData.append('item2', file2);

      const conflicts = detectMixedKeys(formData);

      expect(conflicts).toContain('item1');
      expect(conflicts).toContain('item2');
      expect(conflicts).toHaveLength(2);
    });
  });

  describe('parseFormDataFlat', () => {
    it('should parse flat payload without conflicts', () => {
      const file = createMockFile('avatar.png', 100);
      const formData = createFormData(
        { name: 'John', email: 'john@example.com' },
        { avatar: file }
      );

      const result = parseFormDataFlat(formData);

      expect(result.status).toBe(true);
      expect(result.data).toEqual({
        fields: {
          name: 'John',
          email: 'john@example.com',
        },
        files: {
          avatar: file,
        },
      });
    });

    it('should aggregate duplicate keys into arrays', () => {
      const file1 = createMockFile('doc1.pdf', 100);
      const file2 = createMockFile('doc2.pdf', 200);
      const formData = new FormData();
      formData.append('tags', 'javascript');
      formData.append('tags', 'typescript');
      formData.append('documents', file1);
      formData.append('documents', file2);

      const result = parseFormDataFlat(formData);

      expect(result.status).toBe(true);
      expect(result.data?.fields).toEqual({
        tags: ['javascript', 'typescript'],
      });
      expect(result.data?.files).toEqual({
        documents: [file1, file2],
      });
    });

    it('should reject mixed key types with validation error', () => {
      const file = createMockFile('avatar.png', 100);
      const formData = new FormData();
      formData.append('upload', 'metadata');
      formData.append('upload', file);

      const result = parseFormDataFlat(formData);

      expect(result.status).toBe(false);
      expect(result.message).toBe('mixed key types not allowed');
      expect(result.data?.error_category).toBe('validation');
      expect(result.data?.conflicts).toEqual(['upload']);
      expect(result.data?.hint).toBe('Same key cannot be used for both files and fields');
    });

    it('should exclude action field', () => {
      const formData = createFormData({ action: 'upload', name: 'John' }, {});

      const result = parseFormDataFlat(formData);

      expect(result.status).toBe(true);
      expect(result.data?.fields).toEqual({ name: 'John' });
      expect(result.data?.files).toEqual({});
    });

    it('should handle empty FormData', () => {
      const formData = new FormData();

      const result = parseFormDataFlat(formData);

      expect(result.status).toBe(true);
      expect(result.data).toEqual({
        fields: {},
        files: {},
      });
    });

    it('should handle only files', () => {
      const file1 = createMockFile('doc1.pdf', 100);
      const file2 = createMockFile('doc2.pdf', 200);
      const formData = createFormData({}, { doc1: file1, doc2: file2 });

      const result = parseFormDataFlat(formData);

      expect(result.status).toBe(true);
      expect(result.data?.fields).toEqual({});
      expect(result.data?.files).toEqual({
        doc1: file1,
        doc2: file2,
      });
    });

    it('should handle only fields', () => {
      const formData = createFormData({ name: 'John', age: '30' }, {});

      const result = parseFormDataFlat(formData);

      expect(result.status).toBe(true);
      expect(result.data?.fields).toEqual({
        name: 'John',
        age: '30',
      });
      expect(result.data?.files).toEqual({});
    });
  });
});

