export namespace OpenAPIV3 {
  export function isOpenApi3(mock: any): mock is Document {
    return mock && mock.openapi?.startsWith("3.");
  }

  export type Document = {
    openapi: string;
    info: InfoObject;
    servers?: ServerObject[];
    paths: PathsObject;
    components?: ComponentsObject;
    security?: SecurityRequirementObject[];
    tags?: TagObject[];
    externalDocs?: ExternalDocumentationObject;
    "x-ibm-configuration"?: IbmConfigurationObject;
    "x-ibm-endpoints"?: any;
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

  export type ServerObject = {
    url: string;
    description?: string;
    variables?: { [variable: string]: ServerVariableObject };
  }

  export type ServerVariableObject = {
    enum?: string[];
    default: string;
    description?: string;
  }

  export type HttpMethods = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

  export type PathsObject = {
    [path: string]: PathItemObject;
  }

  export type PathItemObject =  & { [key in HttpMethods]?: OperationObject; } & {
    $ref?: string;
    summary?: string;
    description?: string;
    servers?: ServerObject[];
    parameters?: (ParameterObject | ReferenceObject)[];
  }

  export type OperationObject = {
    tags?: string[];
    summary?: string;
    description?: string;
    externalDocs?: ExternalDocumentationObject;
    operationId?: string;
    parameters?: (ParameterObject | ReferenceObject)[];
    requestBody?: RequestBodyObject | ReferenceObject;
    responses: ResponsesObject;
    callbacks?: { [name: string]: CallbackObject | ReferenceObject };
    deprecated?: boolean;
    security?: SecurityRequirementObject[];
    servers?: ServerObject[];
  }

  export type ParameterObject = {
    name: string;
    in: "query" | "header" | "path" | "cookie";
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    allowEmptyValue?: boolean;
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
    schema?: SchemaObject | ReferenceObject;
    example?: any;
    examples?: { [media: string]: ExampleObject | ReferenceObject };
    content?: { [media: string]: MediaTypeObject };
  }

  export type ReferenceObject = {
    $ref: string;
  }

  export type RequestBodyObject = {
    description?: string;
    content: { [media: string]: MediaTypeObject };
    required?: boolean;
  }

  export type MediaTypeObject = {
    schema?: SchemaObject | ReferenceObject;
    example?: any;
    examples?: { [media: string]: ExampleObject | ReferenceObject };
    encoding?: { [property: string]: EncodingObject };
  }

  export type EncodingObject = {
    contentType?: string;
    headers?: { [header: string]: HeaderObject | ReferenceObject };
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
  }

  export type ResponsesObject = {
    [statusCode: string]: ResponseObject | ReferenceObject;
  }

  export type ResponseObject = {
    description: string;
    headers?: { [header: string]: HeaderObject | ReferenceObject };
    content?: { [media: string]: MediaTypeObject };
    links?: { [link: string]: LinkObject | ReferenceObject };
  }

  export type CallbackObject = {
    [expression: string]: PathItemObject;
  }

  export type ExampleObject = {
    summary?: string;
    description?: string;
    value?: any;
    externalValue?: string;
  }

  export type LinkObject = {
    operationRef?: string;
    operationId?: string;
    parameters?: { [parameter: string]: any };
    requestBody?: any;
    description?: string;
    server?: ServerObject;
  }

  export type HeaderObject = ParameterObject & { }

  export type TagObject = {
    name: string;
    description?: string;
    externalDocs?: ExternalDocumentationObject;
  }

  export type ExternalDocumentationObject = {
    description?: string;
    url: string;
  }

  export type ComponentsObject = {
    schemas?: { [key: string]: SchemaObject | ReferenceObject };
    responses?: { [key: string]: ResponseObject | ReferenceObject };
    parameters?: { [key: string]: ParameterObject | ReferenceObject };
    examples?: { [key: string]: ExampleObject | ReferenceObject };
    requestBodies?: { [key: string]: RequestBodyObject | ReferenceObject };
    headers?: { [key: string]: HeaderObject | ReferenceObject };
    securitySchemes?: { [key: string]: SecuritySchemeObject | ReferenceObject };
    links?: { [key: string]: LinkObject | ReferenceObject };
    callbacks?: { [key: string]: CallbackObject | ReferenceObject };
  }

  export type SecuritySchemeObject = {
    type: "apiKey" | "http" | "oauth2" | "openIdConnect";
    description?: string;
    name?: string;
    in?: "query" | "header" | "cookie";
    scheme?: string;
    bearerFormat?: string;
    flows?: OAuthFlowsObject;
    openIdConnectUrl?: string;
  }

  export type OAuthFlowsObject = {
    implicit?: OAuthFlowObject;
    password?: OAuthFlowObject;
    clientCredentials?: OAuthFlowObject;
    authorizationCode?: OAuthFlowObject;
  }

  export type OAuthFlowObject = {
    authorizationUrl: string;
    tokenUrl: string;
    refreshUrl?: string;
    scopes: { [scope: string]: string };
  }

  export type SecurityRequirementObject = {
    [name: string]: string[];
  }

  export type SchemaObject = {
    $ref?: string;
    type?: "string" | "number" | "integer" | "boolean" | "array" | "object";
    format?: string;
    title?: string;
    description?: string;
    default?: any;
    multipleOf?: number;
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
    maxProperties?: number;
    minProperties?: number;
    required?: string[];
    enum?: any[];
    items?: SchemaObject | ReferenceObject | (SchemaObject | ReferenceObject)[];
    allOf?: (SchemaObject | ReferenceObject)[];
    oneOf?: (SchemaObject | ReferenceObject)[];
    anyOf?: (SchemaObject | ReferenceObject)[];
    not?: SchemaObject | ReferenceObject;
    properties?: { [propertyName: string]: SchemaObject | ReferenceObject };
    additionalProperties?: boolean | SchemaObject | ReferenceObject;
    nullable?: boolean;
    discriminator?: DiscriminatorObject;
    readOnly?: boolean;
    writeOnly?: boolean;
    xml?: XMLObject;
    externalDocs?: ExternalDocumentationObject;
    example?: any;
    deprecated?: boolean;
  }

  export type DiscriminatorObject = {
    propertyName: string;
    mapping?: { [key: string]: string };
  }

  export type XMLObject = {
    name?: string;
    namespace?: string;
    prefix?: string;
    attribute?: boolean;
    wrapped?: boolean;
  }

  export type IbmConfigurationObject = {
    assembly?: any;
    cors?: any;
    enforced?: boolean;
    testable?: boolean;
    phase?: string;
    gateway?: string;
    properties?: any;
    [key: string]: any;
  }
}