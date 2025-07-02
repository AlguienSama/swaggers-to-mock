import { Config } from "./config";
import { BaseMock } from "./types/mock.types";
import { OpenAPIV2 } from "./types/openapi2.types";
import Deps from "./utils/deps";
import { Utils } from "./utils/utils.utils";

export class MockV2 implements BaseMock {
  constructor(readonly mock: OpenAPIV2.Document) { }

  getBaseUrl(): string {
    let url = '';
    if (this.mock.host) url += this.mock.host;
    if (this.mock.basePath) url += this.mock.basePath;

    return url;
  }

  getContentResponse(object: OpenAPIV2.ResponseObject | OpenAPIV2.ReferenceObject) {
    if ('$ref' in object) {
      return this.getOutputSchema(object, []);
    } else if (object.schema) {
      return this.getOutputSchema(object.schema, []);
    }
    return undefined;
  };

  getObjectFromRef<T>(ref: string | string[]): T {
    if (typeof ref === 'string') {
      ref = ref.split('/');
      ref.shift(); // Remove the leading '#'
    }
    return Utils.getObjectFromRef<T>(this.mock as unknown as Record<string, unknown>, ref);
  }

  getOutputSchema(schema: OpenAPIV2.SchemaObject | OpenAPIV2.ReferenceObject, mockRefs: string[]): Record<string, unknown> | unknown[] {
    // Manejo de objetos
    if ('$ref' in schema) {
      return this.resolveRef(schema.$ref!, mockRefs) ?? {};
    } else if (schema.type === 'object' || !schema.type) {
      const formattedSchema: Record<string, unknown> = {};

      // Si el esquema tiene propiedades, iteramos sobre ellas
      if (!schema.properties) {
        return formattedSchema;
      }
      for (const key of Object.keys(schema.properties)) {
        const property = schema.properties[key];
        if ('$ref' in property) {
          const result = this.resolveRef(property.$ref!, mockRefs);
          if (result !== undefined) formattedSchema[key] = result;
        } else if (property.type === 'object' || !property.type) {
          formattedSchema[key] = this.getOutputSchema(property, [...mockRefs]);
        } else if (property.type === 'array') {
          if (property.items && '$ref' in property.items) {
            const result = this.resolveRef(property.items.$ref!, mockRefs);
            if (result !== undefined) formattedSchema[key] = [result];
          } else if (Array.isArray(property.items)) {
            formattedSchema[key] = property.items.map(item => this.getOutputSchema(item, [...mockRefs]));
          } else if ((property.items && property.items.type === 'object') || !property.items?.type) {
            formattedSchema[key] = [this.getOutputSchema(property.items!, [...mockRefs])];
          }
        } else {
          formattedSchema[key] = Utils.getPropertyValue(property);
        }
      }
      return formattedSchema;
    }
    else if (schema.type === 'array') {
      if (schema.items && '$ref' in schema.items) {
        const result = this.resolveRef(schema.items.$ref!, mockRefs);
        if (result !== undefined) return result;
        return {};
      } else if (Array.isArray(schema.items)) {
        return [...schema.items.map(item => this.getOutputSchema(item, [...mockRefs]))];
      } else if (schema.items?.properties) {
        const value: Record<string, unknown> = {};
        for (const key of Object.keys(schema.items.properties)) {
          const item = (schema.items as OpenAPIV2.SchemaObject).properties![key];
          if ('$ref' in item) {
            const result = this.resolveRef(item.$ref!, mockRefs);
            if (result !== undefined) value[key] = result;
          } else if (item.type === 'object' || !schema.type) {
            value[key] = this.getOutputSchema(item, [...mockRefs]);
          } else if (item.type === 'array') {
            if (!item.items) return [];
            if ('$ref' in item.items) {
              const result = this.resolveRef(item.items.$ref!, mockRefs);
              if (result !== undefined) value[key] = [result];
            } else if (Array.isArray(item.items)) {
              value[key] = [...item.items.map(itemItem => this.getOutputSchema(itemItem, [...mockRefs]))];
            } else if (item.items.type === 'object' || !item.items.type) {
              value[key] = [this.getOutputSchema(item.items, [...mockRefs])];
            }
          } else {
            value[key] = Utils.getPropertyValue(item);
          }
        }
        return [value];
      }
    }
    else { return Utils.getPropertyValue(schema); }

    return {}
  }

  getContentTypeResponse(responseSchema: OpenAPIV2.OperationObject): string | undefined {
    const configContentType = Deps.get(Config).getConfig().contentType;

    return responseSchema.produces?.includes(configContentType) ? configContentType : undefined;
  };

  private resolveRef(ref: string, refList: string[] = []): Record<string, unknown> | unknown[] | undefined {
    const refPath = ref.split('/');
    refPath.shift(); // Remove the leading '#'
    if (!Utils.canLoopRef(refPath, refList)) { return undefined; }
    refList.push(refPath.join('/'));
    return this.getOutputSchema(this.getObjectFromRef(refPath), refList);
  }
}