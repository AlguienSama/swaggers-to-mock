import express, { json, Request, Response, Router, urlencoded } from 'express';
import Deps from './utils/deps';
import { Config } from './config';
import { COLORS } from './utils/colors.utils';
import { MockReader } from './mock-reader';
import { Utils } from './utils/utils.utils';
import { MockV3 } from './mockV3';
import { OpenAPIV3 } from './types/openapi3.types';
import { OpenAPIV2 } from './types/openapi2.types';
import { OpenAPI } from './types/openapi.types';
import { BaseMock } from './types/mock.types';
import { MockV2 } from './mockV2';

export class Server {
  private readonly CONFIG = Deps.get(Config).getConfig();

  private readonly app: express.Express;

  constructor() {
    this.app = express();
    this.app.use(json());
    this.app.use(urlencoded({ extended: true }));

    this.setMiddlewares();
  }

  initServer(): void {
    this.app.listen(this.CONFIG.port, () => {
      console.info(
        `${COLORS.BOLD}SERVER RUNNING ON ${COLORS.YELLOW}http://localhost:${this.CONFIG.port}${COLORS.RESET}`,
      );
    });
  }

  private setMiddlewares(): void {
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', '*');
      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
      } else {
        next();
      }
    });
  }

  setMainRoutes(): void {
    Deps.get(MockReader).mocksList.forEach((mock) => {
      let mockUrl = '';
      if ('swagger' in mock) {
        mockUrl = MockV2.getUrl(mock);
      } else if ('openapi' in mock) {
        mockUrl = MockV3.getUrl(mock);
      } else {
        throw new Error(`${COLORS.RED}Error:${COLORS.RESET} Invalid OpenAPI document format in mock ${mock}. Expected OpenAPI 2.0 or 3.0.`);
      }
      let url = this.CONFIG.localUrl;

      if (!mockUrl?.includes(this.CONFIG.url)) {
        console.warn(
          `${COLORS.YELLOW}Warning:${COLORS.RESET} No server base URL matching with ${this.CONFIG.url} in mock ${mock.info.title}. Setting ${this.CONFIG.localUrl}/ to default URL`,
        );
      } else {
        url = mockUrl.replace(this.CONFIG.url, this.CONFIG.localUrl);
        console.info(`Swagger base URL: ${mockUrl}`);
      }
      console.info(`Mock base URL: ${url}`)

      this.app.use(url, this.getSwaggerRoutes(mock));
    });
  }

  private getSwaggerRoutes(mock: OpenAPI.Document): Router {
    const router = Router();
    const paths = mock.paths;

    if (!paths) {
      console.warn(`${COLORS.YELLOW}Warning:${COLORS.RESET} No paths found in OpenAPI document ${mock.info.title}.`);
      return router;
    }

    Object.entries(paths).forEach(([path, methods]) => {
      // Use Express-style parameters: /users/{userId} -> /users/:userId
      const formattedPath = path.replace(/{/g, ':').replace(/}/g, '');

      Object.keys(methods!).forEach(method => {
        router[method as keyof (OpenAPI.HttpMethods)](formattedPath, (req: Request, res: Response) => this.setRouterOperation(req, res, methods![method as keyof (OpenAPI.HttpMethods)]!, mock));
      })
    });

    return router;
  }

  private getStatusCodeResponse(operation: OpenAPI.OperationObject): string | undefined {
    const statusCodes = Object.keys(operation.responses);
    if (!statusCodes) return undefined;

    return Utils.getFirstMatchingStatusCode(statusCodes, this.CONFIG.status.default);
  }

  private setRouterOperation(_: Request, res: Response, method: OpenAPI.OperationObject, mockDocument: OpenAPI.Document): void {
    // Checking & setting status code
    let statusCode = this.getStatusCodeResponse(method);
    if (!statusCode) {
      statusCode = Object.keys(method.responses)[0] ?? this.CONFIG.status.default;
      console.warn(`${COLORS.YELLOW}Warning:${COLORS.RESET} No valid status code found for operation ${COLORS.YELLOW}${method.operationId ?? method.description ?? 'unknown'}${COLORS.RESET}. Returning ${COLORS.YELLOW}${statusCode}${COLORS.RESET} as first status founded.`);
    }
    res.status(parseInt(statusCode, 10));

    const mock: BaseMock = 'swagger' in mockDocument ? new MockV2(mockDocument) : new MockV3(mockDocument);

    // Getting full response
    const responseMock = method.responses[statusCode];
    let responseMockContent = responseMock;
    if (!responseMockContent) {
      const refPath = ((responseMock as OpenAPIV3.ReferenceObject).$ref ?? (responseMock as OpenAPIV3.ReferenceObject & { schema: OpenAPIV3.ReferenceObject }).schema.$ref).split('/');
      refPath.shift();
      responseMockContent = mock.getObjectFromRef(refPath);
    }

    if (!responseMockContent) {
      throw new Error(`${COLORS.RED}Error:${COLORS.RESET} No content found for status code ${statusCode} in operation ${COLORS.YELLOW}${method.operationId ?? method.description ?? 'unknown'}${COLORS.RESET}.`);
    }

    // Checking & setting content type
    let contentType = mock.getContentTypeResponse(responseMockContent);
    if (!contentType) {
      contentType = this.CONFIG.contentType ?? Object.keys(responseMockContent)[0];
      console.warn(`${COLORS.YELLOW}Warning:${COLORS.RESET} No valid Content-Type found for operation ${COLORS.YELLOW}${method.operationId ?? method.description ?? 'unknown'}${COLORS.RESET}. Returning ${COLORS.YELLOW}${contentType}${COLORS.RESET} as first Content-Type founded.`);
    }
    res.setHeader('Content-Type', contentType);

    // Checking & setting response body
    let responseBody: unknown = null;
    const mockSchema = responseMockContent[contentType]?.schema;
    if (mockSchema && '$ref' in mockSchema) {
      const refPath = mockSchema.$ref!.split('/');
      refPath.shift();
      const refHistory = [refPath.join('/')];
      const refSchema = mock.getObjectFromRef(refPath) as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject;
      responseBody = mock.getOutputSchema(refSchema, refHistory);
    } else {
      responseBody = mock.getOutputSchema(responseMockContent, []);
    }

    res.send(responseBody);
  }
}
