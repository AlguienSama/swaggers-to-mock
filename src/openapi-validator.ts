import { OpenAPI } from './types/openapi.types';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

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

  return document as OpenAPI.Document;
};
