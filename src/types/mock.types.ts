import { OpenAPI } from "./openapi.types";

export type BaseMock = {
  mock: OpenAPI.Document;
  getBaseUrl: () => string;
  getObjectFromRef: <T>(ref: string[]) => T;
  getOutputSchema: (schema: object, mockRefs: string[]) => Record<string, unknown> | unknown[];
  getContentTypeResponse: (responseSchema: any) => string | undefined;
  getContentResponse: (response: any) => unknown;
};

export type BaseMockStatic<T extends OpenAPI.Document> = {
  new (mock: T): BaseMock;
  getUrl(mock: T): string;
}
