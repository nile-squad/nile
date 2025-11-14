/**
 * Multipart/form-data parsing and validation utilities
 * Uses structured mode: separates fields and files with array aggregation
 */

export type StructuredPayload = {
  fields: Record<string, string | string[]>;
  files: Record<string, File | File[]>;
};

type ValidationResult = {
  status: boolean;
  message?: string;
  data?: any;
};

type UploadsConfig = {
  enforceContentType?: boolean;
  limits?: {
    maxFiles?: number;
    maxFileSize?: number;
    maxTotalSize?: number;
    maxFilenameLength?: number;
  };
  allow?: {
    mimeTypes?: string[];
    extensions?: string[];
  };
  diagnostics?: boolean;
};

// Default configuration values
const DEFAULT_MAX_FILES = 10;
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB
const DEFAULT_MAX_FILENAME_LENGTH = 128;
const DEFAULT_ALLOWED_MIMES = ['image/png', 'image/jpeg', 'application/pdf'];
const DEFAULT_ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf'];

/**
 * Collect all File objects from FormData
 * @param formData - The FormData instance to extract files from
 * @returns Array of File objects
 */
export function collectFiles(formData: FormData): File[] {
  const files: File[] = [];

  formData.forEach((value) => {
    if (value instanceof File) {
      files.push(value);
    }
  });

  return files;
}

/**
 * Validate filename length
 * @param files - Array of File objects to validate
 * @param maxLength - Maximum allowed filename length
 * @returns Validation result
 */
export function validateFilenameLength(
  files: File[],
  maxLength: number
): ValidationResult {
  const tooLong = files.filter((file) => file.name.length > maxLength);

  if (tooLong.length > 0) {
    return {
      status: false,
      message: 'file name too long',
      data: {
        error_category: 'validation',
        files: tooLong.map((f) => f.name),
        maxLength,
      },
    };
  }

  return { status: true };
}

/**
 * Validate against zero-byte files
 * @param files - Array of File objects to validate
 * @returns Validation result
 */
export function validateZeroByteFiles(files: File[]): ValidationResult {
  const emptyFiles = files.filter((file) => file.size === 0);

  if (emptyFiles.length > 0) {
    return {
      status: false,
      message: 'empty file not allowed',
      data: {
        error_category: 'validation',
        files: emptyFiles.map((f) => f.name),
      },
    };
  }

  return { status: true };
}

/**
 * Validate file count limit
 * @param files - Array of File objects to validate
 * @param maxFiles - Maximum allowed number of files
 * @returns Validation result
 */
export function validateFileCount(
  files: File[],
  maxFiles: number
): ValidationResult {
  if (files.length > maxFiles) {
    return {
      status: false,
      message: 'upload limit exceeded',
      data: {
        error_category: 'validation',
        limit: 'maxFiles',
        max: maxFiles,
        received: files.length,
      },
    };
  }

  return { status: true };
}

/**
 * Validate individual file size limit
 * @param files - Array of File objects to validate
 * @param maxFileSize - Maximum allowed size per file
 * @returns Validation result
 */
export function validateFileSize(
  files: File[],
  maxFileSize: number
): ValidationResult {
  const oversized = files.filter((file) => file.size > maxFileSize);

  if (oversized.length > 0) {
    return {
      status: false,
      message: 'upload limit exceeded',
      data: {
        error_category: 'validation',
        limit: 'maxFileSize',
        max: maxFileSize,
        files: oversized.map((f) => ({ name: f.name, size: f.size })),
      },
    };
  }

  return { status: true };
}

/**
 * Validate total upload size limit
 * @param files - Array of File objects to validate
 * @param maxTotalSize - Maximum allowed total size
 * @returns Validation result
 */
export function validateTotalSize(
  files: File[],
  maxTotalSize: number
): ValidationResult {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  if (totalSize > maxTotalSize) {
    return {
      status: false,
      message: 'upload limit exceeded',
      data: {
        error_category: 'validation',
        limit: 'maxTotalSize',
        max: maxTotalSize,
        total: totalSize,
      },
    };
  }

  return { status: true };
}

/**
 * Validate files against allowlist (mime types and extensions)
 * @param files - Array of File objects to validate
 * @param allowedMimes - Allowed mime types
 * @param allowedExtensions - Allowed file extensions
 * @returns Validation result
 */
export function validateAllowlist(
  files: File[],
  allowedMimes: string[],
  allowedExtensions: string[]
): ValidationResult {
  const rejected = files.filter((file) => {
    const matchesMime = allowedMimes.includes(file.type);
    const matchesExt = allowedExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext.toLowerCase())
    );
    return !(matchesMime && matchesExt);
  });

  if (rejected.length > 0) {
    return {
      status: false,
      message: 'file type not allowed',
      data: {
        error_category: 'validation',
        rejected: rejected.map((f) => ({
          name: f.name,
          type: f.type,
        })),
        allowed: {
          mimeTypes: allowedMimes,
          extensions: allowedExtensions,
        },
      },
    };
  }

  return { status: true };
}

/**
 * Perform all file validations in sequence
 * @param files - Array of File objects to validate
 * @param config - Upload configuration
 * @returns Validation result (fails on first error)
 */
export function validateFiles(
  files: File[],
  config: UploadsConfig
): ValidationResult {
  // Early return if no files
  if (files.length === 0) {
    return { status: true };
  }

  // Extract limits with defaults
  const maxFiles = config.limits?.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileSize = config.limits?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const maxTotalSize = config.limits?.maxTotalSize ?? DEFAULT_MAX_TOTAL_SIZE;
  const maxFilenameLength =
    config.limits?.maxFilenameLength ?? DEFAULT_MAX_FILENAME_LENGTH;

  // Extract allowlist with defaults
  const allowedMimes = config.allow?.mimeTypes ?? DEFAULT_ALLOWED_MIMES;
  const allowedExtensions =
    config.allow?.extensions ?? DEFAULT_ALLOWED_EXTENSIONS;

  // Validation sequence: fail fast on first error
  const filenameCheck = validateFilenameLength(files, maxFilenameLength);
  if (!filenameCheck.status) {
    return filenameCheck;
  }

  const zeroByteCheck = validateZeroByteFiles(files);
  if (!zeroByteCheck.status) {
    return zeroByteCheck;
  }

  const countCheck = validateFileCount(files, maxFiles);
  if (!countCheck.status) {
    return countCheck;
  }

  const sizeCheck = validateFileSize(files, maxFileSize);
  if (!sizeCheck.status) {
    return sizeCheck;
  }

  const totalSizeCheck = validateTotalSize(files, maxTotalSize);
  if (!totalSizeCheck.status) {
    return totalSizeCheck;
  }

  const allowlistCheck = validateAllowlist(
    files,
    allowedMimes,
    allowedExtensions
  );
  if (!allowlistCheck.status) {
    return allowlistCheck;
  }

  return { status: true };
}

/**
 * Parse FormData into structured payload
 * Separates fields and files, aggregates duplicate keys into arrays
 * @param formData - The FormData instance to parse
 * @returns Structured payload with separate fields and files
 */
export function parseFormData(formData: FormData): StructuredPayload {
  const fields: Record<string, string | string[]> = {};
  const files: Record<string, File | File[]> = {};

  formData.forEach((value, key) => {
    if (key === 'action') {
      return;
    }

    if (value instanceof File) {
      // Handle file
      if (key in files) {
        // Aggregate to array
        if (Array.isArray(files[key])) {
          (files[key] as File[]).push(value);
        } else {
          files[key] = [files[key] as File, value];
        }
      } else {
        files[key] = value;
      }
    } else {
      // Handle field (string)
      const strValue = String(value);
      if (key in fields) {
        // Aggregate to array
        if (Array.isArray(fields[key])) {
          (fields[key] as string[]).push(strValue);
        } else {
          fields[key] = [fields[key] as string, strValue];
        }
      } else {
        fields[key] = strValue;
      }
    }
  });

  return { fields, files };
}

/**
 * Detect keys used for both files and fields (conflict)
 * @param formData - The FormData instance to check
 * @returns Array of conflicting keys
 */
export function detectMixedKeys(formData: FormData): string[] {
  const keyTypes = new Map<string, Set<'file' | 'field'>>();

  formData.forEach((value, key) => {
    if (key === 'action') {
      return;
    }

    if (!keyTypes.has(key)) {
      keyTypes.set(key, new Set());
    }

    const types = keyTypes.get(key);
    if (types) {
      types.add(value instanceof File ? 'file' : 'field');
    }
  });

  // Find keys with both types
  const conflicts: string[] = [];
  keyTypes.forEach((types, key) => {
    if (types.size > 1) {
      conflicts.push(key);
    }
  });

  return conflicts;
}

/**
 * Parse FormData in flat mode with conflict detection
 * Allows mixed submission but normalizes to structured payload
 * Rejects same key used for both files and fields
 * @param formData - The FormData instance to parse
 * @returns Validation result with structured payload or error
 */
export function parseFormDataFlat(
  formData: FormData
): ValidationResult & { data?: StructuredPayload | any } {
  // First detect conflicts
  const conflicts = detectMixedKeys(formData);
  if (conflicts.length > 0) {
    return {
      status: false,
      message: 'mixed key types not allowed',
      data: {
        error_category: 'validation',
        conflicts,
        hint: 'Same key cannot be used for both files and fields',
      },
    };
  }

  // Parse into structured format (same as parseFormData)
  const fields: Record<string, string | string[]> = {};
  const files: Record<string, File | File[]> = {};

  formData.forEach((value, key) => {
    if (key === 'action') {
      return;
    }

    if (value instanceof File) {
      // Handle file
      if (key in files) {
        // Aggregate to array
        if (Array.isArray(files[key])) {
          (files[key] as File[]).push(value);
        } else {
          files[key] = [files[key] as File, value];
        }
      } else {
        files[key] = value;
      }
    } else {
      // Handle field (string)
      const strValue = String(value);
      if (key in fields) {
        // Aggregate to array
        if (Array.isArray(fields[key])) {
          (fields[key] as string[]).push(strValue);
        } else {
          fields[key] = [fields[key] as string, strValue];
        }
      } else {
        fields[key] = strValue;
      }
    }
  });

  return {
    status: true,
    data: { fields, files },
  };
}

/**
 * Enforce content-type validation against action's isSpecial.contentType
 * @param action - The action object with potential isSpecial.contentType
 * @param contentType - The actual content-type from request header
 * @param enforceContentType - Whether enforcement is enabled
 * @returns Validation result with 415 status if mismatch
 */
export function enforceActionContentType(
  action: any,
  contentType: string,
  enforceContentType: boolean
): ValidationResult & { statusCode?: 415 } {
  // Skip enforcement if disabled or no contentType specified
  if (!(enforceContentType && action.isSpecial?.contentType)) {
    return { status: true };
  }

  const expected = Array.isArray(action.isSpecial.contentType)
    ? action.isSpecial.contentType
    : [action.isSpecial.contentType];

  const matches = expected.some((ct: string) =>
    contentType.toLowerCase().includes(ct.toLowerCase())
  );

  if (!matches) {
    return {
      status: false,
      statusCode: 415,
      message: 'unsupported content type',
      data: {
        error_category: 'validation',
        expected,
        received: contentType,
      },
    };
  }

  return { status: true };
}

/**
 * Parse request body using Hono's parseBody(), then restructure into our format
 * This uses Hono's internal parsing which may handle different HTTP clients better
 * @param c - Hono context with request
 * @returns Validation result with structured payload or error
 */
export async function parseBodyToStructured(
  c: any
): Promise<ValidationResult & { data?: StructuredPayload | any }> {
  try {
    // Use Hono's parseBody with all option to handle multiple values
    const body = await c.req.parseBody({ all: true });

    // Skip 'action' field and separate files from fields
    const fields: Record<string, string | string[]> = {};
    const files: Record<string, File | File[]> = {};
    const conflicts: string[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (key === 'action') {
        continue;
      }

      // Check if value is array
      if (Array.isArray(value)) {
        // Check if mixed array (both files and strings)
        const hasFiles = value.some((v) => v instanceof File);
        const hasStrings = value.some((v) => typeof v === 'string');

        if (hasFiles && hasStrings) {
          conflicts.push(key);
          continue;
        }

        if (hasFiles) {
          files[key] = value.filter((v) => v instanceof File) as File[];
        } else {
          fields[key] = value.map((v) => String(v));
        }
      } else if (value instanceof File) {
        // Single file
        files[key] = value;
      } else {
        // Single field
        fields[key] = String(value);
      }
    }

    // Check for conflicts
    if (conflicts.length > 0) {
      return {
        status: false,
        message: 'mixed key types not allowed',
        data: {
          error_category: 'validation',
          conflicts,
          hint: 'Same key cannot be used for both files and fields',
        },
      };
    }

    return {
      status: true,
      data: { fields, files },
    };
  } catch (error) {
    return {
      status: false,
      message: 'failed to parse request body',
      data: {
        error_category: 'parsing',
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
