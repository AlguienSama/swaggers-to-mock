import { OpenAPIV3 } from "./types/openapi";
import { Utils } from "./utils/utils";

export class Mock {
  constructor(readonly mock: OpenAPIV3.Document) { }

  getObjectFromRef<T>(ref: string[]): T {
    return Utils.getObjectFromRef<T>(this.mock as unknown as Record<string, unknown>, ref);
  }

  getOutputSchema(schema: OpenAPIV3.NonArraySchemaObject | OpenAPIV3.ArraySchemaObject, mockRefs: string[]): Record<string, unknown> | unknown[] {
    if (!schema) {
      return {};
    }

    // Manejo de objetos
    if (schema.type === 'object') {
      const formattedSchema: Record<string, unknown> = {};
      for (const key of Object.keys(schema.properties || {})) {
        const property = schema.properties![key];
        if ('$ref' in property) {
          const result = this.resolveRef(property.$ref, mockRefs);
          if (result !== undefined) formattedSchema[key] = result;
        } else if (property.type === 'object') {
          formattedSchema[key] = this.getOutputSchema(property, [...mockRefs]);
        } else if (property.type === 'array') {
          if (property.items && '$ref' in property.items) {
            const result = this.resolveRef(property.items.$ref, mockRefs);
            if (result !== undefined) formattedSchema[key] = [result];
          } else if ((property.items && property.items.type === 'object') || !property.items.type) {
            formattedSchema[key] = [this.getOutputSchema(property.items, [...mockRefs])];
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
        const result = this.resolveRef(schema.items.$ref, mockRefs);
        if (result !== undefined) return result;
        return {};
      } else if (schema.items.properties) {
        const value: Record<string, unknown> = {};
        for (const key of Object.keys(schema.items.properties)) {
          const item = (schema.items as OpenAPIV3.SchemaObject).properties![key];
          if ('$ref' in item) {
            const result = this.resolveRef(item.$ref, mockRefs);
            if (result !== undefined) value[key] = result;
          } else if (item.type === 'object') {
            value[key] = this.getOutputSchema(item, [...mockRefs]);
          } else if (item.type === 'array') {
            if (item.items && '$ref' in item.items) {
              const result = this.resolveRef(item.items.$ref, mockRefs);
              if (result !== undefined) value[key] = [result];
            } else if ((item.items && item.items.type === 'object') || !item.items.type) {
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

  private resolveRef(ref: string, refList: string[] = []): Record<string, unknown> | unknown[] | undefined {
    const refPath = ref.split('/');
    refPath.shift(); // Remove the leading '#'
    if (!Utils.canLoopRef(refPath, refList)) { return undefined; }
    refList.push(refPath.join('/'));
    return this.getOutputSchema(this.getObjectFromRef(refPath), refList);
  }
}