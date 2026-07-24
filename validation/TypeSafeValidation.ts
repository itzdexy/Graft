/**
 * Type-Safe Validation
 * Inspired by PydanticAI's type-safe validation with runtime type checking
 * Provides schema validation, type inference, and structured data validation
 */

export interface Schema<T = unknown> {
  type: SchemaType;
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: unknown[];
  required?: string[];
  default?: unknown;
  description?: string;
  examples?: unknown[];
  constraints?: ValidationConstraints;
  metadata?: SchemaMetadata;
}

export type SchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null'
  | 'any'
  | 'custom';

export interface ValidationConstraints {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  format?: string;
}

export interface SchemaMetadata {
  title?: string;
  category?: string;
  tags: string[];
  deprecated?: boolean;
}

export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string[];
  message: string;
  code: ErrorCode;
  value?: unknown;
}

export type ErrorCode =
  | 'type_error'
  | 'required'
  | 'enum_mismatch'
  | 'pattern_mismatch'
  | 'range_error'
  | 'length_error'
  | 'custom_error'
  | 'unknown_field';

export interface ValidationWarning {
  path: string[];
  message: string;
  code: string;
}

export interface Validator<T> {
  schema: Schema<T>;
  validate(data: unknown): ValidationResult<T>;
  validateAsync(data: unknown): Promise<ValidationResult<T>>;
  parse(data: unknown): T;
  parseAsync(data: unknown): Promise<T>;
}

export interface CustomValidator<T> {
  name: string;
  validate: (value: unknown) => boolean | Promise<boolean>;
  message: string;
}

class TypeSafeValidator<T = unknown> implements Validator<T> {
  schema: Schema<T>;
  customValidators: Map<string, CustomValidator<unknown>> = new Map();

  constructor(schema: Schema<T>) {
    this.schema = schema;
  }

  /**
   * Validate data synchronously
   */
  validate(data: unknown): ValidationResult<T> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const result = this.validateValue(data, this.schema, [], errors, warnings);

    if (errors.length === 0) {
      return {
        success: true,
        data: result as T,
        errors: [],
        warnings,
      };
    }

    return {
      success: false,
      errors,
      warnings,
    };
  }

  /**
   * Validate data asynchronously
   */
  async validateAsync(data: unknown): Promise<ValidationResult<T>> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const result = await this.validateValueAsync(data, this.schema, [], errors, warnings);

    if (errors.length === 0) {
      return {
        success: true,
        data: result as T,
        errors: [],
        warnings,
      };
    }

    return {
      success: false,
      errors,
      warnings,
    };
  }

  /**
   * Parse and return validated data, throw on error
   */
  parse(data: unknown): T {
    const result = this.validate(data);
    if (!result.success) {
      throw new ValidationErrorError(result.errors);
    }
    return result.data!;
  }

  /**
   * Parse and return validated data asynchronously, throw on error
   */
  async parseAsync(data: unknown): Promise<T> {
    const result = await this.validateAsync(data);
    if (!result.success) {
      throw new ValidationErrorError(result.errors);
    }
    return result.data!;
  }

  /**
   * Register a custom validator
   */
  registerCustomValidator(validator: CustomValidator<unknown>): void {
    this.customValidators.set(validator.name, validator);
  }

  // Private methods

  private validateValue(
    value: unknown,
    schema: Schema,
    path: string[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): unknown {
    // Check null
    if (value === null) {
      if (schema.type === 'null') {
        return null;
      }
      if (schema.type === 'any') {
        return null;
      }
      errors.push({
        path,
        message: `Expected ${schema.type}, got null`,
        code: 'type_error',
        value,
      });
      return value;
    }

    // Check undefined
    if (value === undefined) {
      if (schema.default !== undefined) {
        return schema.default;
      }
      return value;
    }

    // Type validation
    switch (schema.type) {
      case 'string':
        return this.validateString(value, schema, path, errors, warnings);

      case 'number':
      case 'integer':
        return this.validateNumber(value, schema, path, errors, warnings);

      case 'boolean':
        return this.validateBoolean(value, schema, path, errors);

      case 'object':
        return this.validateObject(value, schema, path, errors, warnings);

      case 'array':
        return this.validateArray(value, schema, path, errors, warnings);

      case 'any':
        return value;

      case 'custom':
        return this.validateCustom(value, schema, path, errors);

      default:
        return value;
    }
  }

  private async validateValueAsync(
    value: unknown,
    schema: Schema,
    path: string[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<unknown> {
    // Check null
    if (value === null) {
      if (schema.type === 'null' || schema.type === 'any') {
        return null;
      }
      errors.push({
        path,
        message: `Expected ${schema.type}, got null`,
        code: 'type_error',
        value,
      });
      return value;
    }

    // Check undefined
    if (value === undefined) {
      if (schema.default !== undefined) {
        return schema.default;
      }
      return value;
    }

    // Type validation
    switch (schema.type) {
      case 'string':
        return this.validateString(value, schema, path, errors, warnings);

      case 'number':
      case 'integer':
        return this.validateNumber(value, schema, path, errors, warnings);

      case 'boolean':
        return this.validateBoolean(value, schema, path, errors);

      case 'object':
        return this.validateObject(value, schema, path, errors, warnings);

      case 'array':
        return this.validateArray(value, schema, path, errors, warnings);

      case 'any':
        return value;

      case 'custom':
        return await this.validateCustomAsync(value, schema, path, errors);

      default:
        return value;
    }
  }

  private validateString(
    value: unknown,
    schema: Schema,
    path: string[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): unknown {
    if (typeof value !== 'string') {
      errors.push({
        path,
        message: `Expected string, got ${typeof value}`,
        code: 'type_error',
        value,
      });
      return value;
    }

    const str = value as string;

    // Enum validation
    if (schema.enum && !schema.enum.includes(str)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        code: 'enum_mismatch',
        value: str,
      });
    }

    // Constraints
    if (schema.constraints) {
      if (schema.constraints.minLength !== undefined && str.length < schema.constraints.minLength) {
        errors.push({
          path,
          message: `String must be at least ${schema.constraints.minLength} characters`,
          code: 'length_error',
          value: str,
        });
      }

      if (schema.constraints.maxLength !== undefined && str.length > schema.constraints.maxLength) {
        errors.push({
          path,
          message: `String must be at most ${schema.constraints.maxLength} characters`,
          code: 'length_error',
          value: str,
        });
      }

      if (schema.constraints.pattern && !new RegExp(schema.constraints.pattern).test(str)) {
        errors.push({
          path,
          message: `String does not match pattern: ${schema.constraints.pattern}`,
          code: 'pattern_mismatch',
          value: str,
        });
      }
    }

    return str;
  }

  private validateNumber(
    value: unknown,
    schema: Schema,
    path: string[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): unknown {
    if (typeof value !== 'number' || isNaN(value)) {
      errors.push({
        path,
        message: `Expected number, got ${typeof value}`,
        code: 'type_error',
        value,
      });
      return value;
    }

    const num = value as number;

    // Integer check
    if (schema.type === 'integer' && !Number.isInteger(num)) {
      errors.push({
        path,
        message: `Expected integer, got float`,
        code: 'type_error',
        value: num,
      });
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(num)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        code: 'enum_mismatch',
        value: num,
      });
    }

    // Constraints
    if (schema.constraints) {
      if (schema.constraints.minimum !== undefined && num < schema.constraints.minimum) {
        errors.push({
          path,
          message: `Value must be at least ${schema.constraints.minimum}`,
          code: 'range_error',
          value: num,
        });
      }

      if (schema.constraints.maximum !== undefined && num > schema.constraints.maximum) {
        errors.push({
          path,
          message: `Value must be at most ${schema.constraints.maximum}`,
          code: 'range_error',
          value: num,
        });
      }

      if (schema.constraints.exclusiveMinimum !== undefined && num <= schema.constraints.exclusiveMinimum) {
        errors.push({
          path,
          message: `Value must be greater than ${schema.constraints.exclusiveMinimum}`,
          code: 'range_error',
          value: num,
        });
      }

      if (schema.constraints.exclusiveMaximum !== undefined && num >= schema.constraints.exclusiveMaximum) {
        errors.push({
          path,
          message: `Value must be less than ${schema.constraints.exclusiveMaximum}`,
          code: 'range_error',
          value: num,
        });
      }

      if (schema.constraints.multipleOf !== undefined && num % schema.constraints.multipleOf !== 0) {
        errors.push({
          path,
          message: `Value must be a multiple of ${schema.constraints.multipleOf}`,
          code: 'range_error',
          value: num,
        });
      }
    }

    return num;
  }

  private validateBoolean(
    value: unknown,
    schema: Schema,
    path: string[],
    errors: ValidationError[]
  ): unknown {
    if (typeof value !== 'boolean') {
      errors.push({
        path,
        message: `Expected boolean, got ${typeof value}`,
        code: 'type_error',
        value,
      });
    }
    return value;
  }

  private validateObject(
    value: unknown,
    schema: Schema,
    path: string[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): unknown {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push({
        path,
        message: `Expected object, got ${typeof value}`,
        code: 'type_error',
        value,
      });
      return value;
    }

    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    // Validate properties
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const propPath = [...path, key];
        const propValue = obj[key];

        // Check required
        if (propValue === undefined && schema.required?.includes(key)) {
          errors.push({
            path: propPath,
            message: 'Required field is missing',
            code: 'required',
          });
          continue;
        }

        // Validate property
        if (propValue !== undefined) {
          result[key] = this.validateValue(propValue, propSchema, propPath, errors, warnings);
        } else if (propSchema.default !== undefined) {
          result[key] = propSchema.default;
        }
      }
    }

    // Check for unknown fields
    const knownFields = new Set(Object.keys(schema.properties || {}));
    for (const key of Object.keys(obj)) {
      if (!knownFields.has(key)) {
        warnings.push({
          path: [...path, key],
          message: 'Unknown field',
          code: 'unknown_field',
        });
      }
    }

    return result;
  }

  private validateArray(
    value: unknown,
    schema: Schema,
    path: string[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): unknown {
    if (!Array.isArray(value)) {
      errors.push({
        path,
        message: `Expected array, got ${typeof value}`,
        code: 'type_error',
        value,
      });
      return value;
    }

    const arr = value as unknown[];
    const result: unknown[] = [];

    // Validate items
    if (schema.items) {
      for (let i = 0; i < arr.length; i++) {
        const itemPath = [...path, i.toString()];
        result.push(this.validateValue(arr[i], schema.items!, itemPath, errors, warnings));
      }
    } else {
      result.push(...arr);
    }

    // Constraints
    if (schema.constraints) {
      if (schema.constraints.minItems !== undefined && arr.length < schema.constraints.minItems) {
        errors.push({
          path,
          message: `Array must have at least ${schema.constraints.minItems} items`,
          code: 'length_error',
          value: arr,
        });
      }

      if (schema.constraints.maxItems !== undefined && arr.length > schema.constraints.maxItems) {
        errors.push({
          path,
          message: `Array must have at most ${schema.constraints.maxItems} items`,
          code: 'length_error',
          value: arr,
        });
      }

      if (schema.constraints.uniqueItems && new Set(arr).size !== arr.length) {
        errors.push({
          path,
          message: 'Array items must be unique',
          code: 'custom_error',
          value: arr,
        });
      }
    }

    return result;
  }

  private validateCustom(
    value: unknown,
    schema: Schema,
    path: string[],
    errors: ValidationError[]
  ): unknown {
    const validator = this.customValidators.get(schema.metadata?.tags[0] || 'default');
    if (validator) {
      const result = validator.validate(value);
      if (!result) {
        errors.push({
          path,
          message: validator.message,
          code: 'custom_error',
          value,
        });
      }
    }
    return value;
  }

  private async validateCustomAsync(
    value: unknown,
    schema: Schema,
    path: string[],
    errors: ValidationError[]
  ): Promise<unknown> {
    const validator = this.customValidators.get(schema.metadata?.tags[0] || 'default');
    if (validator) {
      const result = await validator.validate(value);
      if (!result) {
        errors.push({
          path,
          message: validator.message,
          code: 'custom_error',
          value,
        });
      }
    }
    return value;
  }
}

export class ValidationErrorError extends Error {
  errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super('Validation failed');
    this.name = 'ValidationErrorError';
    this.errors = errors;
  }
}

// Helper functions to create schemas
export function stringSchema(constraints?: ValidationConstraints): Schema<string> {
  return { type: 'string', constraints, metadata: { tags: [] } };
}

export function numberSchema(constraints?: ValidationConstraints): Schema<number> {
  return { type: 'number', constraints, metadata: { tags: [] } };
}

export function integerSchema(constraints?: ValidationConstraints): Schema<number> {
  return { type: 'integer', constraints, metadata: { tags: [] } };
}

export function booleanSchema(): Schema<boolean> {
  return { type: 'boolean', metadata: { tags: [] } };
}

export function objectSchema<T extends Record<string, Schema>>(properties: T, required?: string[]): Schema<T> {
  return { type: 'object', properties, required, metadata: { tags: [] } };
}

export function arraySchema<T>(items: Schema<T>, constraints?: ValidationConstraints): Schema<T[]> {
  return { type: 'array', items, constraints, metadata: { tags: [] } };
}

export function enumSchema<T extends readonly unknown[]>(values: T): Schema<T[number]> {
  return { type: 'string', enum: [...values], metadata: { tags: [] } };
}

export function createValidator<T>(schema: Schema<T>): Validator<T> {
  return new TypeSafeValidator<T>(schema);
}

export function validate<T>(data: unknown, schema: Schema<T>): ValidationResult<T> {
  const validator = new TypeSafeValidator<T>(schema);
  return validator.validate(data);
}

export async function validateAsync<T>(data: unknown, schema: Schema<T>): Promise<ValidationResult<T>> {
  const validator = new TypeSafeValidator<T>(schema);
  return validator.validateAsync(data);
}

export function parse<T>(data: unknown, schema: Schema<T>): T {
  const validator = new TypeSafeValidator<T>(schema);
  return validator.parse(data);
}

export async function parseAsync<T>(data: unknown, schema: Schema<T>): Promise<T> {
  const validator = new TypeSafeValidator<T>(schema);
  return validator.parseAsync(data);
}
