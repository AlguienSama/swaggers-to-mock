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
      const content = object.content[contentType];

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
      if (content.example) {
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
    if (schema.allOf) return this.mergeAllOfSchemas(schema.allOf, mockRefs);
    if (schema.oneOf) return this.getOutputSchema(schema.oneOf[0], mockRefs);
    if (schema.anyOf) return this.getOutputSchema(schema.anyOf[0], mockRefs);

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
    if (!property.items) return [];

    // Handle reference in items
    if ('$ref' in property.items) {
      const result = this.resolveRef(property.items.$ref!, mockRefs);
      return result === undefined ? [] : [result];
    }

    // Handle tuple-like arrays
    if (Array.isArray(property.items)) {
      return property.items.map(item => this.getOutputSchema(item, [...mockRefs]));
    }

    // Handle object items
    if (property.items.type === 'object' || !property.items.type) {
      return [this.getOutputSchema(property.items, [...mockRefs])];
    }

    return [];
  }

  private processArraySchema(schema: OpenAPIV3.SchemaObject, mockRefs: string[]): unknown[] | Record<string, unknown> {
    if (!schema.items) return [];

    // Handle reference in items
    if ('$ref' in schema.items) {
      const result = this.resolveRef(schema.items.$ref!, mockRefs);
      return result ?? {};
    }

    // Handle tuple-like arrays
    if (Array.isArray(schema.items)) {
      return schema.items.map(item => this.getOutputSchema(item, [...mockRefs]));
    }

    // Handle items with properties (array of objects)
    if (schema.items.properties) {
      return [this.processObjectFromProperties(schema.items.properties, schema.type, mockRefs)];
    }

    return [];
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

    return contentTypes.includes(configContentType) ? configContentType : undefined;
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
