// Tipado básico para Swagger OpenAPI 2.0

export interface Swagger2 {
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

export interface InfoObject {
  title: string;
  description?: string;
  termsOfService?: string;
  contact?: ContactObject;
  license?: LicenseObject;
  version: string;
}

export interface ContactObject {
  name?: string;
  url?: string;
  email?: string;
}

export interface LicenseObject {
  name: string;
  url?: string;
}

export interface PathsObject {
  [path: string]: PathItemObject;
}

export interface PathItemObject {
  $ref?: string;
  get?: OperationObject;
  put?: OperationObject;
  post?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  patch?: OperationObject;
  parameters?: (ParameterObject | ReferenceObject)[];
}

export interface OperationObject {
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

export interface ParameterObject {
  name: string;
  in: "query" | "header" | "path" | "formData" | "body";
  description?: string;
  required?: boolean;
  type?: string;
  schema?: SchemaObject;
  // Otros campos según el tipo
}

export interface ReferenceObject {
  $ref: string;
}

export interface ResponseObject {
  description: string;
  schema?: SchemaObject | ReferenceObject;
  headers?: { [name: string]: HeaderObject };
  examples?: { [mimeType: string]: any };
}

export interface HeaderObject {
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

export interface ItemsObject {
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

export interface SchemaObject {
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
  // Otros campos según la especificación
}

export interface DefinitionsObject {
  [name: string]: SchemaObject;
}

export interface SecuritySchemeObject {
  type: string;
  description?: string;
  name?: string;
  in?: string;
  flow?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  scopes?: { [scopeName: string]: string };
}

export interface SecurityRequirementObject {
  [name: string]: string[];
}

export interface TagObject {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentationObject;
}

export interface ExternalDocumentationObject {
  description?: string;
  url: string;
}