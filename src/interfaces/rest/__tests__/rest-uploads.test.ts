import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { createRestRPC } from '../rest-server';
import type { ServerConfig } from '../rest-server';
import type { Service } from '../../../types/actions';
import { Ok } from '../../../utils/safe-try';

// Helper to create mock File for FormData
function createMockFile(
  name: string,
  size: number,
  type: string = 'image/png'
): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
}

describe('REST File Uploads Integration', () => {
  let serverInstance: any;
  let baseUrl: string;
  const testPort = 9882;

  // Test service with upload action
  const uploadService: Service = {
    name: 'uploads',
    description: 'File upload test service',
    actions: [
      {
        name: 'uploadAvatar',
        description: 'Upload user avatar',
        isProtected: false,
        handler: async (payload: any) => {
          // Structured mode: payload.fields and payload.files
          return Ok({ uploaded: true, payload });
        },
        validation: {},
        meta: {},
        isSpecial: {
          contentType: 'multipart/form-data',
        },
      },
      {
        name: 'uploadDocuments',
        description: 'Upload multiple documents',
        isProtected: false,
        handler: async (payload: any) => {
          return Ok({ uploaded: true, payload });
        },
        validation: {},
        meta: {},
        isSpecial: {
          contentType: 'multipart/form-data',
        },
      },
      {
        name: 'textOnly',
        description: 'Should reject file uploads',
        isProtected: false,
        handler: async (payload: any) => {
          return Ok({ success: true, payload });
        },
        validation: {},
        meta: {},
        isSpecial: {
          contentType: 'application/json',
        },
      },
    ],
  };

  describe('Structured Mode (Default)', () => {
    beforeAll(async () => {
      const serverConfig: ServerConfig = {
        serverName: 'Upload Test Server',
        baseUrl: '/test',
        apiVersion: 'v1',
        services: [uploadService],
        host: 'localhost',
        port: testPort.toString(),
        allowedOrigins: ['*'],
        uploads: {
          limits: {
            maxFiles: 5,
            maxFileSize: 2 * 1024 * 1024, // 2MB
            maxTotalSize: 5 * 1024 * 1024, // 5MB
            maxFilenameLength: 100,
          },
          allow: {
            mimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
            extensions: ['.png', '.jpg', '.jpeg', '.pdf'],
          },
        },
      };

      const { app } = createRestRPC(serverConfig);
      serverInstance = serve(
        {
          fetch: app.fetch,
          port: testPort,
        },
        () => {
          console.log(`Upload test server running on http://localhost:${testPort}`);
        }
      );

      baseUrl = `http://localhost:${testPort}/test/v1/services`;
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    afterAll(async () => {
      if (serverInstance) {
        serverInstance.close();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should successfully upload a file with structured payload', async () => {
      const formData = new FormData();
      formData.append('action', 'uploadAvatar');
      formData.append('name', 'John Doe');
      formData.append('avatar', createMockFile('avatar.png', 1024, 'image/png'));

      const response = await fetch(`${baseUrl}/uploads`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe(true);
      expect(data.data.uploaded).toBe(true);
      expect(data.data.payload.fields.name).toBe('John Doe');
      // In structured mode, File object is in payload.files
      expect(data.data.payload.files.avatar).toBeDefined();
    });

    it('should reject file with name too long', async () => {
      const longName = 'a'.repeat(150) + '.png';
      const formData = new FormData();
      formData.append('action', 'uploadAvatar');
      formData.append('avatar', createMockFile(longName, 1024, 'image/png'));

      const response = await fetch(`${baseUrl}/uploads`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.status).toBe(false);
      expect(data.message).toBe('file name too long');
      expect(data.data.error_category).toBe('validation');
    });

    it('should reject zero-byte files', async () => {
      const formData = new FormData();
      formData.append('action', 'uploadAvatar');
      formData.append('avatar', createMockFile('empty.png', 0, 'image/png'));

      const response = await fetch(`${baseUrl}/uploads`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.status).toBe(false);
      expect(data.message).toBe('empty file not allowed');
      expect(data.data.error_category).toBe('validation');
    });

    it('should reject when file count exceeds limit', async () => {
      const formData = new FormData();
      formData.append('action', 'uploadDocuments');

      // Upload 6 files (limit is 5)
      for (let i = 0; i < 6; i++) {
        formData.append(`file${i}`, createMockFile(`doc${i}.pdf`, 1024, 'application/pdf'));
      }

      const response = await fetch(`${baseUrl}/uploads`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.status).toBe(false);
      expect(data.message).toBe('upload limit exceeded');
      expect(data.data.limit).toBe('maxFiles');
    });

    it('should reject when file size exceeds limit', async () => {
      const formData = new FormData();
      formData.append('action', 'uploadAvatar');
      // 3MB file (limit is 2MB)
      formData.append('avatar', createMockFile('large.png', 3 * 1024 * 1024, 'image/png'));

      const response = await fetch(`${baseUrl}/uploads`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.status).toBe(false);
      expect(data.message).toBe('upload limit exceeded');
      expect(data.data.limit).toBe('maxFileSize');
    });

    it('should reject when total size exceeds limit', async () => {
      const formData = new FormData();
      formData.append('action', 'uploadDocuments');

      // 3 files of 2MB each = 6MB total (limit is 5MB)
      for (let i = 0; i < 3; i++) {
        formData.append(
          `file${i}`,
          createMockFile(`doc${i}.pdf`, 2 * 1024 * 1024, 'application/pdf')
        );
      }

      const response = await fetch(`${baseUrl}/uploads`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.status).toBe(false);
      expect(data.message).toBe('upload limit exceeded');
      expect(data.data.limit).toBe('maxTotalSize');
    });

    it('should reject disallowed file types', async () => {
      const formData = new FormData();
      formData.append('action', 'uploadAvatar');
      formData.append('avatar', createMockFile('script.exe', 1024, 'application/x-msdownload'));

      const response = await fetch(`${baseUrl}/uploads`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.status).toBe(false);
      expect(data.message).toBe('file type not allowed');
      expect(data.data.error_category).toBe('validation');
    });

    it('should handle uploads with no files (fields only)', async () => {
      const formData = new FormData();
      formData.append('action', 'uploadAvatar');
      formData.append('name', 'John Doe');
      formData.append('email', 'john@example.com');

      const response = await fetch(`${baseUrl}/uploads`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe(true);
      expect(data.data.payload.fields.name).toBe('John Doe');
      expect(data.data.payload.fields.email).toBe('john@example.com');
    });

    it('should aggregate duplicate field names into arrays', async () => {
      const formData = new FormData();
      formData.append('action', 'uploadDocuments');
      formData.append('tags', 'important');
      formData.append('tags', 'urgent');
      formData.append('tags', 'review');

      const response = await fetch(`${baseUrl}/uploads`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe(true);
      expect(Array.isArray(data.data.payload.fields.tags)).toBe(true);
      expect(data.data.payload.fields.tags).toEqual(['important', 'urgent', 'review']);
    });

    it('should aggregate duplicate files into arrays', async () => {
      const formData = new FormData();
      formData.append('action', 'uploadDocuments');
      formData.append('documents', createMockFile('doc1.pdf', 1024, 'application/pdf'));
      formData.append('documents', createMockFile('doc2.pdf', 1024, 'application/pdf'));
      formData.append('documents', createMockFile('doc3.pdf', 1024, 'application/pdf'));

      const response = await fetch(`${baseUrl}/uploads`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe(true);
      expect(Array.isArray(data.data.payload.files.documents)).toBe(true);
      expect(data.data.payload.files.documents.length).toBe(3);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without uploads config (no validation)', async () => {
      const serverConfig: ServerConfig = {
        serverName: 'No Config Server',
        baseUrl: '/test',
        apiVersion: 'v1',
        services: [uploadService],
        host: 'localhost',
        port: '9884',
        allowedOrigins: ['*'],
        // No uploads config
      };

      const { app } = createRestRPC(serverConfig);
      const server = serve(
        {
          fetch: app.fetch,
          port: 9884,
        },
        () => {}
      );

      const baseUrl = 'http://localhost:9884/test/v1/services';
      await new Promise((resolve) => setTimeout(resolve, 500));

      const formData = new FormData();
      formData.append('action', 'uploadAvatar');
      formData.append('name', 'Test User');
      formData.append('avatar', createMockFile('avatar.png', 1024, 'image/png'));

      const response = await fetch(`${baseUrl}/uploads`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe(true);

      server.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });
});
