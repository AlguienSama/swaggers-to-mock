import { Config } from "./config";
import { BaseMock, BaseMockStatic } from "./types/mock.types";
import { OpenAPIV2 } from "./types/openapi2.types";
import Deps from "./utils/deps";
import { setBaseMockStatic } from "./utils/mock.utils";
import { Utils } from "./utils/utils.utils";

@setBaseMockStatic<BaseMockStatic<OpenAPIV2.Document>>()
export class MockV2 implements BaseMock {
  constructor(readonly mock: OpenAPIV2.Document) { }

  static getUrl(mock: OpenAPIV2.Document): string {
    let url = '';
    if (mock.host) url += mock.host;
    if (mock.basePath) url += mock.basePath;

    return url;
  }

  getContentResponse(response: OpenAPIV2.ResponseObject | OpenAPIV2.ReferenceObject ) {
    return undefined;
  };

  getObjectFromRef<T>(ref: string[]): T {
    return Utils.getObjectFromRef<T>(this.mock as unknown as Record<string, unknown>, ref);
  }

  getOutputSchema(schema: OpenAPIV2.SchemaObject | OpenAPIV2.ReferenceObject, mockRefs: string[]): Record<string, unknown> | unknown[] {
    return {};
  }

  getContentTypeResponse(responseSchema: string[]): string | undefined {
    const configContentType = Deps.get(Config).getConfig().contentType;

    return responseSchema.includes(configContentType) ? configContentType : undefined;
  };
}