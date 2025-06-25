import { OpenAPI } from "./openapi.types";

export type BaseMock = {
  getObjectFromRef: <T>(ref: string[]) => T;
  getOutputSchema: <T extends OpenAPI.SchemaObject>(schema: T, mockRefs: string[]) => Record<string, unknown> | unknown[];
};

export type BaseMockStatic<T extends OpenAPI.Document> = {
  new (mock: T): BaseMock;
  getUrl(mock: T): string;
}
