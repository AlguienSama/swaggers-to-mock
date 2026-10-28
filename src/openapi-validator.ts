import { OpenAPI } from './types/openapi.types';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

export const validateOpenAPIDocument = (document: unknown, source = 'document'): OpenAPI.Document => {
  if (!isRecord(document)) {
    throw new Error(`Invalid OpenAPI document in "${source}": the root value must be an object`);
  }

  const isOpenAPI2 = document.swagger === '2.0';
  const isOpenAPI3 = typeof document.openapi === 'string' && document.openapi.startsWith('3.');
  if (!isOpenAPI2 && !isOpenAPI3) {
    throw new Error(`Invalid OpenAPI document in "${source}": supported versions are Swagger 2.0 and OpenAPI 3.x`);
  }

  if (!isRecord(document.info)
    || typeof document.info.title !== 'string'
    || typeof document.info.version !== 'string') {
    throw new Error(`Invalid OpenAPI document in "${source}": info.title and info.version are required`);
  }

  if (!isRecord(document.paths)) {
    throw new Error(`Invalid OpenAPI document in "${source}": paths must be an object`);
  }

  for (const [path, pathItem] of Object.entries(document.paths)) {
    if (!path.startsWith('/')) {
      throw new Error(`Invalid OpenAPI document in "${source}": path "${path}" must start with "/"`);
    }

    if (!isRecord(pathItem)) {
      throw new Error(`Invalid OpenAPI document in "${source}": path "${path}" must be an object`);
    }

    for (const method of HTTP_METHODS) {
      if (!(method in pathItem)) continue;
      const operation = pathItem[method];
      if (!isRecord(operation) || !isRecord(operation.responses)) {
        throw new Error(`Invalid OpenAPI document in "${source}": ${method.toUpperCase()} ${path} must define responses`);
      }

      for (const [statusCode, response] of Object.entries(operation.responses)) {
        if (statusCode !== 'default' && !/^[1-5](?:\d{2}|XX)$/.test(statusCode)) {
          throw new Error(`Invalid OpenAPI document in "${source}": invalid response status "${statusCode}" in ${method.toUpperCase()} ${path}`);
        }

        if (!isRecord(response)) {
          throw new Error(`Invalid OpenAPI document in "${source}": response "${statusCode}" in ${method.toUpperCase()} ${path} must be an object`);
        }

        if (!('$ref' in response) && typeof response.description !== 'string') {
          throw new Error(`Invalid OpenAPI document in "${source}": response "${statusCode}" in ${method.toUpperCase()} ${path} must define description`);
        }
      }
    }
  }

  return document as OpenAPI.Document;
};
