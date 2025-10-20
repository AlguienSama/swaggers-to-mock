import { OpenAPIV2 } from "./openapi2.types";
import { OpenAPIV3 } from "./openapi3.types";

export namespace OpenAPI {
  export type Document = OpenAPIV2.Document | OpenAPIV3.Document;
  export type OperationObject = OpenAPIV2.OperationObject | OpenAPIV3.OperationObject;
  export type ResponseObject = OpenAPIV2.ResponseObject | OpenAPIV3.ResponseObject;
  export type HttpMethods = OpenAPIV2.HttpMethods | OpenAPIV3.HttpMethods
  export type SchemaObject = OpenAPIV2.SchemaObject | OpenAPIV3.SchemaObject;
  export type ReferenceObject = OpenAPIV2.ReferenceObject | OpenAPIV3.ReferenceObject;
  export type PathItemObject = OpenAPIV2.PathItemObject | OpenAPIV3.PathItemObject;
}

export const HTTP_METHODS: Array<OpenAPI.HttpMethods> = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
