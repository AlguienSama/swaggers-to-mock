import { OpenAPI } from "./openapi.types";

export type BaseMock = {
  mock: OpenAPI.Document;
  getVersion: () => string;
  getBaseUrl: () => string;
  getObjectFromRef: <T>(ref: string[]) => T;
  getOutputSchema: (schema: object, mockRefs: string[]) => Record<string, unknown> | unknown[];
  getContentTypeResponse: (responseSchema: any, status?: string) => string | undefined;
  getContentResponse: (response: any, contentType?: string) => unknown;
};
