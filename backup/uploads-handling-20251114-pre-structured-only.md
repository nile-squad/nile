# File Upload Handling in REST-RPC

**Version:** 1.0  
**Date:** November 14, 2025  
**Author:** Hussein Kizz

## 1. Overview

Nile provides comprehensive support for handling multipart/form-data file uploads with configurable validation, size limits, and security controls.

This document provides a complete guide to implementing file upload functionality in your Nile services, including configuration options, validation strategies, security best practices, and migration patterns.

## 2. Configuration

File upload handling is configured through the `uploads` block in your server configuration:

```typescript
const config: ServerConfig = {
  // ... other config
  uploads: {
    mode: 'flat',                      // 'flat' | 'structured' (default: 'flat')
    enforceContentType: true,          // Enforce action content-type requirements (default: true)
    limits: {
      maxFiles: 10,                    // Maximum number of files per request (default: 10)
      maxFileSize: 10 * 1024 * 1024,   // Maximum size per file in bytes (default: 10MB)
      maxTotalSize: 20 * 1024 * 1024,  // Maximum total upload size (default: 20MB)
      maxFilenameLength: 128           // Maximum filename length (default: 128)
    },
    allow: {
      mimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],  // Allowed MIME types
      extensions: ['.png', '.jpg', '.jpeg', '.pdf']               // Allowed file extensions
    },
    diagnostics: true                  // Enable upload diagnostics (honors global diagnostics)
  }
};
```

### 2.1. Configuration Options

**`mode`**: Controls how files and fields are structured in the payload

- **`flat`** (default): Backward compatible, files/fields merged into single object
- **`structured`**: Separates `{ fields: {...}, files: {...} }` with array aggregation

**`enforceContentType`**: Validates action content-type requirements

- **`true`** (default): Rejects requests with mismatched content types
- **`false`**: Allows any content type regardless of action requirements

**`limits`**: Size and count restrictions

- **`maxFiles`**: Maximum number of files per request (default: 10)
- **`maxFileSize`**: Maximum size per individual file in bytes (default: 10MB)
- **`maxTotalSize`**: Maximum total upload size for all files (default: 20MB)
- **`maxFilenameLength`**: Maximum filename length (default: 128 characters)

**`allow`**: File type allowlist

- **`mimeTypes`**: Array of allowed MIME types (e.g., `['image/png', 'application/pdf']`)
- **`extensions`**: Array of allowed file extensions (e.g., `['.png', '.pdf']`)
- Both MIME type and extension must match for a file to be accepted

**`diagnostics`**: Upload debugging information

- **`true`**: Enables detailed upload diagnostics (respects global diagnostics setting)
- **`false`**: Disables upload diagnostics

## 3. Upload Modes

### 3.1. Flat Mode (Default)

In flat mode, files and fields are merged into a single payload object. For duplicate keys, the last value wins. This mode is backward compatible with existing implementations.

**Request:**

```bash
curl -X POST \
  localhost:9000/testing/api/v1/services/users \
  -H "Content-Type: multipart/form-data" \
  -F "action=updateProfile" \
  -F "name=John Doe" \
  -F "avatar=@profile.jpg"
```

**Payload received by handler:**

```typescript
{
  name: "John Doe",
  avatar: File { name: "profile.jpg", type: "image/jpeg", size: 45231 }
}
```

**Use Cases:**

- Single file uploads per field
- Simple form data with files
- Backward compatible with existing handlers
- When you don't need to distinguish between fields and files

### 3.2. Structured Mode

In structured mode, fields and files are separated into distinct objects, and duplicate keys automatically aggregate into arrays.

**Configuration:**

```typescript
uploads: {
  mode: 'structured'
}
```

**Request:**

```bash
curl -X POST \
  localhost:9000/testing/api/v1/services/documents \
  -H "Content-Type: multipart/form-data" \
  -F "action=uploadDocuments" \
  -F "title=Project Files" \
  -F "tags=work" \
  -F "tags=important" \
  -F "document=@file1.pdf" \
  -F "document=@file2.pdf"
```

**Payload received by handler:**

```typescript
{
  fields: {
    title: "Project Files",
    tags: ["work", "important"]  // Multiple values with same key
  },
  files: {
    document: [File { ... }, File { ... }]  // Multiple files with same key
  }
}
```

**Use Cases:**

- Multiple files per field
- Clear separation between form data and file data
- When you need to handle arrays of files
- Complex forms with repeated field names

## 4. Action Content-Type Enforcement

Actions can specify required content types using the `isSpecial.contentType` metadata:

```typescript
const uploadAction: Action = {
  name: 'uploadAvatar',
  isSpecial: {
    contentType: 'multipart/form-data'  // or ['multipart/form-data', 'application/json']
  },
  handler: async (data) => {
    // Handler code
  }
};
```

### 4.1. Single Content-Type

```typescript
isSpecial: {
  contentType: 'multipart/form-data'
}
```

Only allows `multipart/form-data` requests when `enforceContentType: true`.

### 4.2. Multiple Content-Types

```typescript
isSpecial: {
  contentType: ['multipart/form-data', 'application/json']
}
```

Allows both `multipart/form-data` and `application/json` requests.

### 4.3. Enforcement Behavior

**When `enforceContentType: true` (default):**

- Requests with mismatched content types receive a 415 Unsupported Media Type response
- Actions without `contentType` metadata accept any content type
- Provides clear error messages for content-type mismatches

**When `enforceContentType: false`:**

- All content types are accepted regardless of action configuration
- Use when you want to handle content-type validation in your handlers

## 5. Validation Sequence

File uploads are validated in the following order using a fail-fast approach. The first validation failure immediately returns an error response without processing further:

### 5.1. Filename Length Validation

**Trigger:** Any filename exceeds `maxFilenameLength` (default: 128 characters)

**Response:** 400 Bad Request

**Purpose:** Prevents filesystem attacks with extremely long filenames

**Error Example:**

```json
{
  "status": false,
  "message": "file name too long",
  "data": {
    "error_category": "validation",
    "file": "very_long_filename_that_exceeds_128_characters...",
    "maxLength": 128
  }
}
```

### 5.2. Zero-Byte File Validation

**Trigger:** Any file has 0 bytes

**Response:** 400 Bad Request

**Purpose:** Ensures only valid file content is processed

**Error Example:**

```json
{
  "status": false,
  "message": "empty file not allowed",
  "data": {
    "error_category": "validation",
    "files": ["empty.txt", "blank.pdf"]
  }
}
```

### 5.3. File Count Validation

**Trigger:** Total number of files exceeds `maxFiles` (default: 10)

**Response:** 400 Bad Request

**Purpose:** Prevents memory exhaustion from excessive file uploads

**Error Example:**

```json
{
  "status": false,
  "message": "file count limit exceeded",
  "data": {
    "error_category": "validation",
    "limit": "maxFiles",
    "allowed": 10,
    "received": 15
  }
}
```

### 5.4. Individual File Size Validation

**Trigger:** Any single file exceeds `maxFileSize` (default: 10MB)

**Response:** 400 Bad Request

**Purpose:** Prevents large file attacks

**Error Example:**

```json
{
  "status": false,
  "message": "file size limit exceeded",
  "data": {
    "error_category": "validation",
    "limit": "maxFileSize",
    "allowed": 10485760,
    "file": "large_video.mp4",
    "size": 52428800
  }
}
```

### 5.5. Total Upload Size Validation

**Trigger:** Combined size of all files exceeds `maxTotalSize` (default: 20MB)

**Response:** 400 Bad Request

**Purpose:** Protects against cumulative memory pressure

**Error Example:**

```json
{
  "status": false,
  "message": "total upload size exceeded",
  "data": {
    "error_category": "validation",
    "limit": "maxTotalSize",
    "allowed": 20971520,
    "received": 31457280
  }
}
```

### 5.6. Allowlist Validation

**Trigger:** File MIME type or extension not in allowlist

**Response:** 400 Bad Request

**Purpose:** Prevents malicious file uploads

**Error Example:**

```json
{
  "status": false,
  "message": "file type not allowed",
  "data": {
    "error_category": "validation",
    "rejected": ["malicious.exe", "script.sh"],
    "allowedTypes": ["image/png", "image/jpeg", "application/pdf"],
    "allowedExtensions": [".png", ".jpg", ".jpeg", ".pdf"]
  }
}
```

**Validation Requirements:**

- Both MIME type AND extension must be in the allowlist
- Case-insensitive extension matching
- Extensions must include the leading dot (e.g., `.pdf` not `pdf`)

## 6. Error Responses

### 6.1. Content-Type Mismatch (415)

**Trigger:** Request content-type doesn't match action requirements when `enforceContentType: true`

```json
{
  "status": false,
  "message": "unsupported content type",
  "data": {
    "error_category": "validation",
    "expected": ["multipart/form-data"],
    "received": "application/json"
  }
}
```

### 6.2. All Validation Errors (400)

All validation failures (filename length, zero-byte files, file count, file size, total size, allowlist) return 400 Bad Request with a structured error response containing:

- **`status`**: `false`
- **`message`**: Human-readable error description
- **`data`**: Object with error details including:
  - **`error_category`**: `"validation"`
  - Context-specific fields (limit values, received values, rejected files, etc.)

## 7. Handler Implementation

### 7.1. Flat Mode Handler

```typescript
const uploadAction: Action = {
  name: 'uploadAvatar',
  isSpecial: {
    contentType: 'multipart/form-data'
  },
  handler: async (data, context) => {
    const file = data.avatar as File;  // Direct access to File object
    
    if (!file) {
      return safeError('No file provided', 'no-file');
    }
    
    // Validate file (additional business logic)
    if (file.size < 1024) {
      return safeError('File too small', 'file-too-small');
    }
    
    // Process file (save to storage, resize, etc.)
    const url = await saveToStorage(file, context.user.id);
    
    return Ok({ avatarUrl: url }, 'Avatar uploaded successfully');
  }
};
```

### 7.2. Structured Mode Handler

```typescript
const uploadAction: Action = {
  name: 'uploadDocuments',
  isSpecial: {
    contentType: 'multipart/form-data'
  },
  handler: async (data, context) => {
    const { fields, files } = data;
    
    // Access form fields
    const title = fields.title as string;
    const tags = Array.isArray(fields.tags) ? fields.tags : [fields.tags];
    
    // Access files (handle both single file and array)
    const documents = Array.isArray(files.documents) 
      ? files.documents 
      : [files.documents];
    
    // Validate files
    for (const doc of documents) {
      if (!isValidPDF(doc)) {
        return safeError('Invalid PDF file', 'invalid-pdf');
      }
    }
    
    // Process multiple files
    const urls = await Promise.all(
      documents.map(file => saveToStorage(file, context.user.id))
    );
    
    return Ok({ 
      title, 
      tags,
      documentUrls: urls 
    }, 'Documents uploaded successfully');
  }
};
```

### 7.3. Mixed Content-Type Handler

```typescript
const flexibleAction: Action = {
  name: 'createPost',
  isSpecial: {
    contentType: ['multipart/form-data', 'application/json']
  },
  handler: async (data, context) => {
    // Check if request included files (multipart) or was JSON
    const hasFiles = data.files !== undefined;
    
    if (hasFiles) {
      // Handle multipart/form-data
      const { fields, files } = data;
      const content = fields.content as string;
      const image = files.image as File;
      
      const imageUrl = image ? await saveToStorage(image, context.user.id) : null;
      
      return Ok({ content, imageUrl }, 'Post created with image');
    } else {
      // Handle application/json
      const { content } = data;
      
      return Ok({ content, imageUrl: null }, 'Post created without image');
    }
  }
};
```

## 8. Security Best Practices

### 8.1. Always Configure Limits

```typescript
uploads: {
  limits: {
    maxFiles: 5,                      // Restrict based on your use case
    maxFileSize: 5 * 1024 * 1024,     // 5MB per file
    maxTotalSize: 10 * 1024 * 1024,   // 10MB total
    maxFilenameLength: 64             // Conservative filename length
  }
}
```

**Guidelines:**

- Set limits based on your application's actual needs
- Smaller limits reduce attack surface
- Consider storage costs and processing time
- Monitor and adjust based on usage patterns

### 8.2. Use Strict Allowlists

```typescript
uploads: {
  allow: {
    mimeTypes: ['image/png', 'image/jpeg'],  // Only what you need
    extensions: ['.png', '.jpg', '.jpeg']     // Double validation
  }
}
```

**Guidelines:**

- Only allow file types your application actually uses
- Both MIME type and extension must match
- Don't use wildcards or broad categories
- Regularly review and update allowlists

### 8.3. Enforce Content-Type

```typescript
uploads: {
  enforceContentType: true  // Always validate content-type
}
```

**Guidelines:**

- Keep enforcement enabled unless you have a specific reason to disable it
- Set explicit content-type requirements on actions
- Provide clear error messages for mismatched content types

### 8.4. Validate in Handler

```typescript
handler: async (data) => {
  const file = data.document as File;
  
  // Additional business logic validation
  if (file.size < 1024) {
    return safeError('File too small', 'file-too-small');
  }
  
  // Verify file content (not just extension)
  const buffer = await file.arrayBuffer();
  if (!isValidPDF(buffer)) {
    return safeError('Invalid PDF file', 'invalid-pdf');
  }
  
  // Check file signature/magic bytes
  if (!verifyFileSignature(buffer, 'PDF')) {
    return safeError('File signature mismatch', 'signature-mismatch');
  }
  
  // Process file...
}
```

**Guidelines:**

- Don't rely solely on MIME type and extension
- Verify file content and structure
- Check file signatures/magic bytes
- Validate file content against expected format
- Scan for malicious content if needed

### 8.5. Secure File Storage

```typescript
async function saveToStorage(file: File, userId: string): Promise<string> {
  // Generate secure, random filename
  const safeFilename = `${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
  
  // Store outside web root
  const storagePath = path.join(UPLOAD_DIR, userId, safeFilename);
  
  // Set restrictive permissions
  await writeFile(storagePath, buffer, { mode: 0o600 });
  
  // Return URL (not filesystem path)
  return `/uploads/${userId}/${safeFilename}`;
}

function sanitizeFilename(filename: string): string {
  // Remove dangerous characters
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}
```

**Guidelines:**

- Generate unique, random filenames
- Store files outside web root
- Set restrictive file permissions
- Never expose filesystem paths to clients
- Implement access control for file retrieval

## 9. Migration Guide

### 9.1. Existing Applications (No Changes Required)

Your existing handlers continue to work without modification. Flat mode is the default and preserves existing behavior:

```typescript
// Your existing handler works as-is
handler: async (data) => {
  const file = data.avatar as File;
  // Process file...
}
```

**No changes needed if:**

- You're using flat mode (default)
- You're not using the `uploads` configuration
- Your handlers expect files directly in the data object

### 9.2. Adopting Structured Mode

**Step 1:** Update configuration:

```typescript
uploads: { 
  mode: 'structured' 
}
```

**Step 2:** Update handlers to use new payload structure:

```typescript
// Before (flat mode)
handler: async (data) => {
  const name = data.name;
  const avatar = data.avatar;
}

// After (structured mode)
handler: async (data) => {
  const name = data.fields.name;
  const avatar = data.files.avatar;
}
```

**Step 3:** Handle multiple files/fields:

```typescript
// Before (flat mode - last value wins)
handler: async (data) => {
  const tag = data.tag;  // Only gets last tag
}

// After (structured mode - all values in array)
handler: async (data) => {
  const tags = Array.isArray(data.fields.tag) 
    ? data.fields.tag 
    : [data.fields.tag];
}
```

### 9.3. Adding Upload Configuration

**Step 1:** Add basic limits:

```typescript
uploads: {
  limits: {
    maxFiles: 10,
    maxFileSize: 10 * 1024 * 1024,
    maxTotalSize: 20 * 1024 * 1024
  }
}
```

**Step 2:** Add allowlist (recommended):

```typescript
uploads: {
  limits: { /* ... */ },
  allow: {
    mimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
    extensions: ['.png', '.jpg', '.jpeg', '.pdf']
  }
}
```

**Step 3:** Enable content-type enforcement:

```typescript
// Add to actions that require file uploads
const action: Action = {
  name: 'uploadAvatar',
  isSpecial: {
    contentType: 'multipart/form-data'
  },
  handler: async (data) => { /* ... */ }
};
```

## 10. Advanced Use Cases

### 10.1. Progressive File Processing

```typescript
handler: async (data, context) => {
  const file = data.video as File;
  
  // Process file in chunks to avoid memory issues
  const reader = file.stream().getReader();
  let processedSize = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    await processChunk(value);
    processedSize += value.length;
    
    // Report progress
    await updateProgress(context.user.id, processedSize / file.size);
  }
  
  return Ok({ videoId: 'generated-id' }, 'Video processed');
};
```

### 10.2. Multiple File Categories

```typescript
handler: async (data, context) => {
  const { fields, files } = data;
  
  // Handle different file categories
  const avatar = files.avatar as File;
  const documents = Array.isArray(files.documents) 
    ? files.documents 
    : [files.documents];
  const images = Array.isArray(files.images) 
    ? files.images 
    : [files.images];
  
  // Process each category differently
  const avatarUrl = await processAvatar(avatar);
  const documentUrls = await Promise.all(documents.map(processDocument));
  const imageUrls = await Promise.all(images.map(processImage));
  
  return Ok({ avatarUrl, documentUrls, imageUrls }, 'All files processed');
};
```

### 10.3. Conditional File Requirements

```typescript
handler: async (data, context) => {
  const { fields, files } = data;
  const postType = fields.type as string;
  
  if (postType === 'image-post') {
    // Image is required
    if (!files.image) {
      return safeError('Image required for image posts', 'missing-image');
    }
    
    const imageUrl = await saveToStorage(files.image as File, context.user.id);
    return Ok({ type: 'image-post', imageUrl }, 'Image post created');
  }
  
  if (postType === 'text-post') {
    // No file required
    const content = fields.content as string;
    return Ok({ type: 'text-post', content }, 'Text post created');
  }
  
  return safeError('Invalid post type', 'invalid-type');
};
```

## 11. Testing

### 11.1. Unit Testing File Handlers

```typescript
import { describe, it, expect } from 'vitest';
import { uploadAvatarAction } from './actions';

describe('uploadAvatar action', () => {
  it('should process valid image file', async () => {
    const mockFile = new File(['image data'], 'avatar.png', {
      type: 'image/png'
    });
    
    const result = await uploadAvatarAction.handler(
      { avatar: mockFile },
      { user: { id: 'user-123' } }
    );
    
    expect(result.status).toBe(true);
    expect(result.data.avatarUrl).toBeDefined();
  });
  
  it('should reject missing file', async () => {
    const result = await uploadAvatarAction.handler(
      {},
      { user: { id: 'user-123' } }
    );
    
    expect(result.status).toBe(false);
    expect(result.message).toBe('No file provided');
  });
});
```

### 11.2. Integration Testing with REST Interface

```typescript
import { describe, it, expect } from 'vitest';
import { testRequest } from './test-utils';

describe('File upload integration', () => {
  it('should upload file via multipart/form-data', async () => {
    const formData = new FormData();
    formData.append('action', 'uploadAvatar');
    formData.append('avatar', new File(['data'], 'avatar.png', {
      type: 'image/png'
    }));
    
    const response = await testRequest('/services/users', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: formData
    });
    
    expect(response.status).toBe(true);
  });
  
  it('should reject oversized file', async () => {
    const largeFile = new File(
      [new Uint8Array(20 * 1024 * 1024)], // 20MB
      'large.png',
      { type: 'image/png' }
    );
    
    const formData = new FormData();
    formData.append('action', 'uploadAvatar');
    formData.append('avatar', largeFile);
    
    const response = await testRequest('/services/users', {
      method: 'POST',
      body: formData
    });
    
    expect(response.status).toBe(false);
    expect(response.message).toBe('file size limit exceeded');
  });
});
```

## 12. Troubleshooting

### 12.1. Common Issues

**Issue:** Files not appearing in handler

**Solution:** Check that:
- Request has `Content-Type: multipart/form-data` header
- Form fields use correct names matching handler expectations
- Files are properly attached to FormData

**Issue:** Content-type mismatch error

**Solution:**
- Verify action has `isSpecial.contentType` configured
- Check that `enforceContentType` is not accidentally enabled
- Ensure client sends correct `Content-Type` header

**Issue:** Allowlist validation failing

**Solution:**
- Verify both MIME type AND extension are in allowlist
- Check for typos in allowlist configuration
- Ensure extensions include leading dot (`.png` not `png`)

**Issue:** File count/size limits too restrictive

**Solution:**
- Adjust limits in `uploads.limits` configuration
- Consider your application's actual needs
- Monitor and tune based on usage patterns

### 12.2. Debugging

Enable upload diagnostics for detailed logging:

```typescript
uploads: {
  diagnostics: true
}
```

This provides:
- File count and sizes
- Validation step results
- MIME type and extension matches
- Processing time

## 13. Related Documentation

- [REST-RPC Specification](./rest-rpc.spec.md) - Complete protocol specification
- [Action Execution Lifecycle](./action-execution-lifecycle.md) - Request processing pipeline
- [Authentication & Authorization](./auth.md) - Security and access control
- [Error Handling](./error-handling.md) - Error patterns and best practices

**Author:** [Hussein Kizz](https://github.com/Hussseinkizz) at Nile Squad Labz

*This specification reflects the current implementation and is subject to evolution. Contributions and feedback are welcome.*
