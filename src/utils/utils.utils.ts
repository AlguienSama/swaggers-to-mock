import { Config } from '../config';
import { HTTP_METHODS, OpenAPI } from '../types/openapi.types';
import { COLORS } from './colors.utils';
import Deps from './deps';

export class Utils {
  /**
   * Get default value for a property based on its type.
   * If the property has a default value, it will be returned.
   * @param property - OpenAPI Schema Object
   * @returns default value for the property
   */
  static readonly getPropertyValue = (property: OpenAPI.SchemaObject) => {
    let defaultValue: unknown = null;
    if (property.type === 'boolean') {
      defaultValue = false;
    } else if (property.type === 'number') {
      defaultValue = 0;
    } else if (property.type === 'string') {
      defaultValue = '';
    } else if (property.type === 'integer') {
      defaultValue = 0;
    }

    if (Object.prototype.hasOwnProperty.call(property, 'default')) {
      return property.default;
    }

    if ('example' in property) {
      return property.example;
    }

    if (property.enum && property.enum.length > 0) {
      return property.enum[0];
    }

    if ('nullable' in property && property.nullable) {
      return null;
    }

    if (property.type === 'number' || property.type === 'integer') {
      let numericValue = defaultValue as number;
      const minimum = property.minimum;
      const maximum = property.maximum;
      const exclusiveStep = (value: number) => Math.max(1, Math.abs(value)) * Number.EPSILON * 2;

      if (minimum !== undefined) {
        const candidate = property.exclusiveMinimum
          ? property.type === 'integer' ? minimum + 1 : minimum + exclusiveStep(minimum)
          : minimum;
        numericValue = Math.max(numericValue, candidate);
      }
      if (maximum !== undefined) {
        const candidate = property.exclusiveMaximum
          ? property.type === 'integer' ? maximum - 1 : maximum - exclusiveStep(maximum)
          : maximum;
        numericValue = Math.min(numericValue, candidate);
      }

      if (property.multipleOf !== undefined && property.multipleOf > 0) {
        const multipleOf = property.multipleOf;
        const nextMultiple = Math.ceil(numericValue / multipleOf) * multipleOf;
        numericValue = nextMultiple;

        if (maximum !== undefined && numericValue > maximum) {
          numericValue = Math.floor(maximum / multipleOf) * multipleOf;
        }
      }

      return numericValue;
    }

    if (property.type === 'string') {
      const formatValues: Record<string, string> = {
        date: '2020-01-01',
        'date-time': '2020-01-01T00:00:00.000Z',
        email: 'user@example.com',
        uri: 'https://example.com',
        url: 'https://example.com',
        uuid: '00000000-0000-4000-8000-000000000000',
      };

      let stringValue = property.format && formatValues[property.format]
        ? formatValues[property.format]
        : defaultValue;

      if (typeof stringValue === 'string') {
        let normalizedValue = stringValue;
        if (property.minLength !== undefined) {
          normalizedValue += 'x'.repeat(Math.max(0, property.minLength - normalizedValue.length));
        }
        if (property.maxLength !== undefined) {
          normalizedValue = normalizedValue.slice(0, property.maxLength);
        }

        if (property.pattern) {
          try {
            const pattern = new RegExp(property.pattern);
            if (!pattern.test(normalizedValue)) {
              const candidates = ['A', 'a', '0', 'x', 'foo-0', 'user@example.com'];
              const matchingCandidate = candidates
                .map(candidate => {
                  let value = candidate;
                  if (property.minLength !== undefined) {
                    value += 'x'.repeat(Math.max(0, property.minLength - value.length));
                  }
                  if (property.maxLength !== undefined) {
                    value = value.slice(0, property.maxLength);
                  }
                  return value;
                })
                .find(candidate => pattern.test(candidate));
              if (matchingCandidate !== undefined) normalizedValue = matchingCandidate;
            }
          } catch {
            // Invalid patterns are reported by document validation when applicable.
          }
        }

        stringValue = normalizedValue;
      }

      return stringValue;
    }

    return defaultValue;
  };

  /**
   * Get an object from a reference path.
   * The reference path is an array of strings that represents the path to the object.
   * @param object - The object to get the value from
   * @param ref - Reference path as an array of strings
   * @returns The value at the reference path
   * @example
   * getObjectFromRef({ a: { b: { c: 1 } } }, ['a', 'b', 'c']) // returns 1
   */
  static readonly getObjectFromRef = <T>(object: Record<string, unknown>, ref: string[], currentPath: string[] = []): T => {
    const key = ref.shift();
    if (!key) return object as T;

    if (!object || typeof object !== 'object' || !(key in object)) {
      throw new Error(`Reference path not found: #/${[...currentPath, key].join('/')}`);
    }

    return Utils.getObjectFromRef(object[key] as Record<string, unknown>, ref, [...currentPath, key]);
  };

  /**
   * Check if a reference is valid and does not create a loop.
   * If the reference is found more than MAX_LOOPS times, it is considered a loop.
   * @param ref - Reference path as an array of strings
   * @param mockRefs - Array of previously seen references
   * @returns true if the reference is valid, false otherwise
   */
  static readonly canLoopRef = (ref: string[], mockRefs: string[]): boolean => {
    const parsedRef = ref.join('/');
    if (mockRefs.filter(r => r === parsedRef).length >= Deps.get(Config).getConfig().maxLoops) {
      console.warn(`Loop detected in ref: ${COLORS.RED}${parsedRef}${COLORS.RESET}`);
      return false;
    }
    return true;
  };

  static readonly isHttpMethod = (method: string): method is OpenAPI.HttpMethods => {
    return HTTP_METHODS.includes(method as OpenAPI.HttpMethods);
  }

  static readonly isValidStatusCode = (statusCode: string): boolean => {
    statusCode = statusCode.trim().toUpperCase();

    // Check if the status is a valid HTTP status code
    if (!statusCode || !statusCode.match(/^([1-5]|X)(\d|X){2}?$/)) {
      throw new Error(`Invalid status code: ${COLORS.RED}${statusCode}${COLORS.RESET}`);
    }
    return true;
  }

  static readonly getFirstMatchingStatusCode = (statusCodes: string[], statusToMatch: string): string | undefined => {
    statusToMatch = statusToMatch.trim().toUpperCase();
    if (!this.isValidStatusCode(statusToMatch)) {
      return undefined;
    }

    const indexToMatch = [...statusToMatch.split('').keys()].filter(index => statusToMatch[index] !== 'X');

    // Find the first matching status code
    return statusCodes.find(statusCode => {
      const trimmedStatusCode = statusCode.trim().toUpperCase();

      return trimmedStatusCode.length === statusToMatch.length
        && indexToMatch.every(index => trimmedStatusCode[index] === statusToMatch[index]);
    });
  }

  static readonly formatUrlPath = (path: string): string => {
    return path.replace(/{/g, ':').replace(/}/g, '');
  };
}
