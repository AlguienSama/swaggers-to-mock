import { Config } from "./config";
import { BaseMock, BaseMockStatic } from "./types/mock.types";
import { OpenAPIV3 } from "./types/openapi3.types";
import Deps from "./utils/deps";
import { setBaseMockStatic } from "./utils/mock.utils";
import { Utils } from "./utils/utils.utils";

@setBaseMockStatic<BaseMockStatic<OpenAPIV3.Document>>()
export class MockV3 implements BaseMock {
  constructor(readonly mock: OpenAPIV3.Document) { }

  static getUrl(mock: OpenAPIV3.Document): string {
    return mock.servers?.[0]?.url || mock['x-ibm-configuration']?.servers?.[0]?.url || '';
  }

  getContentResponse(object: object) {
    return undefined;
  };

  getObjectFromRef<T>(ref: string[]): T {
    return Utils.getObjectFromRef<T>(this.mock as unknown as Record<string, unknown>, ref);
  }

  getOutputSchema(schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject, mockRefs: string[]): Record<string, unknown> | unknown[] {
    if (!schema) {
      return {};
    }

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
        } else if (property.type === 'object' || !schema.type) {
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

    // Manejo de arrays
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
          const item = (schema.items as OpenAPIV3.SchemaObject).properties![key];
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

    // Caso base: tipo primitivo
    else return Utils.getPropertyValue(schema);

    return {};
  }

  getContentTypeResponse(responseSchema: OpenAPIV3.ResponseObject['content']): string | undefined {
    const contentTypes = Object.keys(responseSchema ?? {});
    const configContentType = Deps.get(Config).getConfig().contentType;

    return contentTypes.includes(configContentType) ? configContentType : undefined;
  }

  private resolveRef(ref: string, refList: string[] = []): Record<string, unknown> | unknown[] | undefined {
    const refPath = ref.split('/');
    refPath.shift(); // Remove the leading '#'
    if (!Utils.canLoopRef(refPath, refList)) { return undefined; }
    refList.push(refPath.join('/'));
    return this.getOutputSchema(this.getObjectFromRef(refPath), refList);
  }
}