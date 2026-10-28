import { Config } from "./config";
import { BaseMock } from "./types/mock.types";
import { OpenAPIV2 } from "./types/openapi2.types";
import Deps from "./utils/deps";
import { Utils } from "./utils/utils.utils";

export class MockV2 implements BaseMock {
  constructor(readonly mock: OpenAPIV2.Document) { }

  getVersion(): string {
    return this.mock.swagger;
  }

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
    if ('$ref' in schema) {
      return this.resolveRef(schema.$ref!, mockRefs) ?? {};
    } else if (schema.type === 'object' || !schema.type) {
      const formattedSchema: Record<string, unknown> = {};

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
          const items = property.items;
          if (items && '$ref' in items) {
            formattedSchema[key] = this.createArrayItems(() => this.resolveRef(items.$ref!, [...mockRefs]));
          } else if (Array.isArray(items)) {
            formattedSchema[key] = items.map(item => this.getOutputSchema(item, [...mockRefs]));
          } else if (items && (items.type === 'object' || !items.type)) {
            formattedSchema[key] = this.createArrayItems(() => this.getOutputSchema(items, [...mockRefs]));
          } else if (items) {
            formattedSchema[key] = this.createArrayItems(() => this.getOutputSchema(items, [...mockRefs]));
          }
        } else {
          formattedSchema[key] = Utils.getPropertyValue(property);
        }
      }
      return formattedSchema;
    }
    else if (schema.type === 'array') {
      const items = schema.items;
      if (items && '$ref' in items) {
        return this.createArrayItems(() => this.resolveRef(items.$ref!, [...mockRefs]));
      } else if (Array.isArray(items)) {
        return [...items.map(item => this.getOutputSchema(item, [...mockRefs]))];
      } else if (items?.properties) {
        const value: Record<string, unknown> = {};
        for (const key of Object.keys(items.properties)) {
          const item = items.properties[key];
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
        return this.createArrayItems(() => value);
      } else if (items) {
        return this.createArrayItems(() => this.getOutputSchema(items, [...mockRefs]));
      }
    }
    else { return Utils.getPropertyValue(schema); }

    return {}
  }

  private createArrayItems<T>(factory: () => T): T[] {
    const length = Math.max(0, Math.floor(Deps.get(Config).getConfig().arrayItems));
    return Array.from({ length }, factory);
  }

  getContentTypeResponse(responseSchema: OpenAPIV2.OperationObject): string | undefined {
    const configContentType = Deps.get(Config).getConfig().contentType;

    const contentTypes = responseSchema.produces ?? this.mock.produces ?? [];
    if (contentTypes.length === 0) {
      return undefined;
    }

    return configContentType !== '*/*' && contentTypes.includes(configContentType)
      ? configContentType
      : contentTypes[0];
  };

  private resolveRef(ref: string, refList: string[] = []): Record<string, unknown> | unknown[] | undefined {
    const refPath = ref.split('/');
    refPath.shift(); // Remove the leading '#'
    if (!Utils.canLoopRef(refPath, refList)) { return undefined; }
    refList.push(refPath.join('/'));
    return this.getOutputSchema(this.getObjectFromRef(refPath), refList);
  }
}
