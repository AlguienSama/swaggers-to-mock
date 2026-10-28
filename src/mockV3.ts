import { Config } from "./config";
import { BaseMock } from "./types/mock.types";
import { OpenAPIV3 } from "./types/openapi3.types";
import Deps from "./utils/deps";
import { Utils } from "./utils/utils.utils";

export class MockV3 implements BaseMock {
  private readonly CONFIG = Deps.get(Config).getConfig();
  constructor(readonly mock: OpenAPIV3.Document) { }

  getVersion(): string {
    return this.mock.openapi;
  }

  getBaseUrl(): string {
    return this.mock.servers?.[0]?.url || this.mock['x-ibm-configuration']?.servers?.[0]?.url || '';
  }

  getContentResponse(object: OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject, contentType = this.CONFIG.contentType) {
    if ('$ref' in object) {
      return this.getOutputSchema(object, []);
    } else if (object.content) {
      const content = object.content[contentType] ?? object.content[Object.keys(object.content)[0]];
      if (!content) {
        return undefined;
      }

      // First, check if there are examples defined at the response level
      if (content.examples) {
        const exampleKeys = Object.keys(content.examples);
        if (exampleKeys.length > 0) {
          const firstExample = content.examples[exampleKeys[0]];
          if ('value' in firstExample) {
            return firstExample.value;
          }
        }
      }

      // If no examples, check for a single example
      if (Object.prototype.hasOwnProperty.call(content, 'example')) {
        return content.example;
      }

      // Otherwise, generate from schema
      return this.getOutputSchema(content.schema ?? {}, []);
    }
    return undefined;
  };

  getObjectFromRef<T>(ref: string[]): T {
    return Utils.getObjectFromRef<T>(this.mock as unknown as Record<string, unknown>, ref);
  }

  getOutputSchema(schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject, mockRefs: string[]): Record<string, unknown> | unknown[] {
    // Handle references
    if ('$ref' in schema) {
      return this.resolveRef(schema.$ref!, mockRefs) ?? {};
    }

    // Handle schema composition keywords
    if (schema.allOf?.length) return this.mergeAllOfSchemas(schema.allOf, mockRefs);
    if (schema.oneOf?.length) return this.getOutputSchema(schema.oneOf[0], mockRefs);
    if (schema.anyOf?.length) return this.getOutputSchema(schema.anyOf[0], mockRefs);

    // Handle different schema types
    if (schema.type === 'object' || !schema.type) {
      return this.processObjectSchema(schema, mockRefs);
    }

    if (schema.type === 'array') {
      return this.processArraySchema(schema, mockRefs);
    }

    // Handle primitive types
    return Utils.getPropertyValue(schema);
  }
  private processObjectSchema(schema: OpenAPIV3.SchemaObject, mockRefs: string[]): Record<string, unknown> {
    const formattedSchema: Record<string, unknown> = {};

    if (!schema.properties) {
      // Return example if available, otherwise empty object
      return ('example' in schema && schema.example)
        ? schema.example as Record<string, unknown>
        : formattedSchema;
    }

    for (const key of Object.keys(schema.properties)) {
      const property = schema.properties[key];
      formattedSchema[key] = this.processProperty(property, schema.type, mockRefs);
    }

    return formattedSchema;
  }

  private processProperty(property: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject, parentType: string | undefined, mockRefs: string[]): unknown {
    // Handle reference
    if ('$ref' in property) {
      const result = this.resolveRef(property.$ref!, mockRefs);
      return result ?? undefined;
    }

    // Handle object type
    if (property.type === 'object' || !parentType) {
      return this.getOutputSchema(property, [...mockRefs]);
    }

    // Handle array type
    if (property.type === 'array') {
      return this.processArrayProperty(property, mockRefs);
    }

    // Handle primitive types
    return Utils.getPropertyValue(property);
  }

  private processArrayProperty(property: OpenAPIV3.SchemaObject, mockRefs: string[]): unknown[] {
    const items = property.items;
    if (!items) return [];

    // Handle reference in items
    if ('$ref' in items) {
      return this.createArrayItems(() => this.resolveRef(items.$ref!, [...mockRefs]), property);
    }

    // Handle tuple-like arrays
    if (Array.isArray(items)) {
      return items.map(item => this.getOutputSchema(item, [...mockRefs]));
    }

    // Handle object items
    if (items.type === 'object' || !items.type) {
      return this.createArrayItems(() => this.getOutputSchema(items, [...mockRefs]), property);
    }

    return this.createArrayItems(() => this.getOutputSchema(items, [...mockRefs]), property);
  }

  private processArraySchema(schema: OpenAPIV3.SchemaObject, mockRefs: string[]): unknown[] | Record<string, unknown> {
    const items = schema.items;
    if (!items) return [];

    // Handle reference in items
    if ('$ref' in items) {
      return this.createArrayItems(() => this.resolveRef(items.$ref!, [...mockRefs]), schema);
    }

    // Handle tuple-like arrays
    if (Array.isArray(items)) {
      return items.map(item => this.getOutputSchema(item, [...mockRefs]));
    }

    // Handle items with properties (array of objects)
    if (items.properties) {
      const properties = items.properties;
      return this.createArrayItems(() => this.processObjectFromProperties(properties, schema.type, [...mockRefs]), schema);
    }

    return this.createArrayItems(() => this.getOutputSchema(items, [...mockRefs]), schema);
  }

  private createArrayItems<T>(factory: () => T, schema?: { minItems?: number; maxItems?: number }): T[] {
    let length = Math.max(0, Math.floor(this.CONFIG.arrayItems));
    if (schema?.minItems !== undefined) {
      length = Math.max(length, schema.minItems);
    }
    if (schema?.maxItems !== undefined) {
      length = Math.min(length, schema.maxItems);
    }
    return Array.from({ length }, factory);
  }

  private processObjectFromProperties(properties: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject>, parentType: string | undefined, mockRefs: string[]): Record<string, unknown> {
    const value: Record<string, unknown> = {};

    for (const key of Object.keys(properties)) {
      const item = properties[key];
      const processedValue = this.processProperty(item, parentType, mockRefs);
      if (processedValue !== undefined) {
        value[key] = processedValue;
      }
    }

    return value;
  }

  getContentTypeResponse(responseSchema: OpenAPIV3.OperationObject, status = this.CONFIG.status.default): string | undefined {
    const responsesObject = responseSchema.responses[status] ?? responseSchema.responses[Object.keys(responseSchema.responses)[0]];
    let responseObject: OpenAPIV3.ResponseObject | OpenAPIV3.ReferenceObject;
    if ('$ref' in responsesObject) {
      responseObject = this.getObjectFromRef<OpenAPIV3.ResponseObject>([responsesObject.$ref.split('/').slice(1).join('/')]);
    } else {
      responseObject = responsesObject;
    }
    const contentTypes = Object.keys(responseObject.content ?? {});
    const configContentType = this.CONFIG.contentType;

    if (contentTypes.length === 0) {
      return undefined;
    }

    return configContentType !== '*/*' && contentTypes.includes(configContentType)
      ? configContentType
      : contentTypes[0];
  }

  private resolveRef(ref: string, refList: string[] = []): Record<string, unknown> | unknown[] | undefined {
    const refPath = ref.split('/');
    refPath.shift(); // Remove the leading '#'
    if (!Utils.canLoopRef(refPath, refList)) { return undefined; }
    refList.push(refPath.join('/'));
    return this.getOutputSchema(this.getObjectFromRef(refPath), refList);
  }

  private mergeAllOfSchemas(allOf: (OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject)[], mockRefs: string[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    for (const schemaOrRef of allOf) {
      let schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject = schemaOrRef;

      // Resolve reference if needed
      if ('$ref' in schema && schema.$ref) {
        const refPath = schema.$ref.split('/');
        refPath.shift(); // Remove the leading '#'
        schema = this.getObjectFromRef(refPath);
      }

      // Get the output for this schema
      const result = this.getOutputSchema(schema, [...mockRefs]);

      // Merge the result into the merged object
      if (typeof result === 'object' && !Array.isArray(result)) {
        Object.assign(merged, result);
      }
    }

    return merged;
  }
}
