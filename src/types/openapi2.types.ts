export namespace OpenAPIV2 {
  export function isOpenApi2(mock: any): mock is Document {
    return mock && mock.swagger === "2.0";
  }

  export type Document = {
    swagger: "2.0";
    info: InfoObject;
    host?: string;
    basePath?: string;
    schemes?: ("http" | "https" | "ws" | "wss")[];
    consumes?: string[];
    produces?: string[];
    paths: PathsObject;
    definitions?: DefinitionsObject;
    parameters?: { [name: string]: ParameterObject };
    responses?: { [name: string]: ResponseObject };
    securityDefinitions?: { [name: string]: SecuritySchemeObject };
    security?: SecurityRequirementObject[];
    tags?: TagObject[];
    externalDocs?: ExternalDocumentationObject;
  }

  export type InfoObject = {
    title: string;
    description?: string;
    termsOfService?: string;
    contact?: ContactObject;
    license?: LicenseObject;
    version: string;
  }

  export type ContactObject = {
    name?: string;
    url?: string;
    email?: string;
  }

  export type LicenseObject = {
    name: string;
    url?: string;
  }

  export type HttpMethods = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

  export type PathsObject = {
    [path: string]: PathItemObject;
  }

  export type PathItemObject = {
    $ref?: string;
    parameters?: (ParameterObject | ReferenceObject)[];
  } & { [key in HttpMethods]?: OperationObject; }

  export type OperationObject = {
    tags?: string[];
    summary?: string;
    description?: string;
    externalDocs?: ExternalDocumentationObject;
    operationId?: string;
    consumes?: string[];
    produces?: string[];
    parameters?: (ParameterObject | ReferenceObject)[];
    responses: { [statusCode: string]: ResponseObject | ReferenceObject };
    schemes?: ("http" | "https" | "ws" | "wss")[];
    deprecated?: boolean;
    security?: SecurityRequirementObject[];
  }

  export type ParameterObject = {
    name: string;
    in: "query" | "header" | "path" | "formData" | "body";
    description?: string;
    required?: boolean;
    type?: string;
    schema?: SchemaObject;
  }

  export type ReferenceObject = {
    $ref: string;
  }

  export type ResponseObject = {
    description: string;
    schema?: SchemaObject | ReferenceObject;
    headers?: { [name: string]: HeaderObject };
    examples?: { [mimeType: string]: any };
  }

  export type HeaderObject = {
    description?: string;
    type: string;
    format?: string;
    items?: ItemsObject;
    collectionFormat?: string;
    default?: any;
    maximum?: number;
    exclusiveMaximum?: boolean;
    minimum?: number;
    exclusiveMinimum?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    enum?: any[];
    multipleOf?: number;
  }

  export type ItemsObject = {
    type: string;
    format?: string;
    items?: ItemsObject;
    collectionFormat?: string;
    default?: any;
    maximum?: number;
    exclusiveMaximum?: boolean;
    minimum?: number;
    exclusiveMinimum?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    enum?: any[];
    multipleOf?: number;
  }

  export type SchemaObject = {
    $ref?: string;
    type?: string;
    format?: string;
    required?: string[];
    properties?: { [propertyName: string]: SchemaObject };
    items?: SchemaObject | SchemaObject[];
    allOf?: (SchemaObject | ReferenceObject)[];
    additionalProperties?: boolean | SchemaObject | ReferenceObject;
    description?: string;
    default?: any;
    enum?: any[];
  }

  export type DefinitionsObject = {
    [name: string]: SchemaObject;
  }

  export type SecuritySchemeObject = {
    type: string;
    description?: string;
    name?: string;
    in?: string;
    flow?: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    scopes?: { [scopeName: string]: string };
  }

  export type SecurityRequirementObject = {
    [name: string]: string[];
  }

  export type TagObject = {
    name: string;
    description?: string;
    externalDocs?: ExternalDocumentationObject;
  }

  export type ExternalDocumentationObject = {
    description?: string;
    url: string;
  }
};
