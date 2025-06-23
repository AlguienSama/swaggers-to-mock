import { Config } from '../config';
import { OpenAPIV3 } from '../types/openapi';
import { SchemaObject } from '../types/openapi3';
import { COLORS } from './colors';
import Deps from './deps';

export class Utils {
  /**
   * Get default value for a property based on its type.
   * If the property has a default value, it will be returned.
   * @param property - OpenAPI Schema Object
   * @returns default value for the property
   */
  static getPropertyValue = (property: SchemaObject) => {
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
    return property.default ?? property.example ?? defaultValue;
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
  static getObjectFromRef = <T>(object: Record<string, unknown>, ref: string[]): T => {
    const key = ref.shift();
    if (!key) return object as T;
    return Utils.getObjectFromRef(object[key] as Record<string, unknown>, ref);
  };

  /**
   * Check if a reference is valid and does not create a loop.
   * If the reference is found more than MAX_LOOPS times, it is considered a loop.
   * @param ref - Reference path as an array of strings
   * @param mockRefs - Array of previously seen references
   * @returns true if the reference is valid, false otherwise
   */
  static canLoopRef = (ref: string[], mockRefs: string[]): boolean => {
    const parsedRef = ref.join('/');
    if (mockRefs.filter(r => r === parsedRef).length > Deps.get(Config).getConfig().maxLoops) {
      console.warn(`Loop detected in ref: ${COLORS.RED}${parsedRef}${COLORS.RESET}`);
      return false;
    }
    return true;
  };

  static isValidStatusCode = (statusCode: string): boolean => {
    statusCode = statusCode.trim().toUpperCase();

    // Check if the status is a valid HTTP status code
    if (!statusCode || !statusCode.match(/^([1-5]|X)(\d|X){2}?$/)) {
      throw new Error(`Invalid status code: ${COLORS.RED}${statusCode}${COLORS.RESET}`);
    }
    return true;
  }

  static getFirstMatchingStatusCode = (statusCodes: string[], statusToMatch: string): string | undefined => {
    statusToMatch = statusToMatch.trim().toUpperCase();
    if (!this.isValidStatusCode(statusToMatch)) {
      return undefined;
    }

    const indexToMatch = [...statusToMatch.split('').keys()].filter(index => statusToMatch[index] !== 'X');

    // Find the first matching status code
    return statusCodes.find(statusCode => {
      const trimmedStatusCode = statusCode.trim().toUpperCase();

      indexToMatch.forEach(index => {
        if (trimmedStatusCode[index] !== statusToMatch[index]) {
          return false;
        }
      });
      return true;
    });
  }
}
