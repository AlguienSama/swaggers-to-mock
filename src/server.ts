import express, { json, Request, Response, Router, urlencoded } from 'express';
import Deps from './utils/deps';
import { Config } from './config';
import { COLORS } from './utils/colors';
import { MockReader } from './mock-reader';
import { Utils } from './utils/utils';
import { MockV3 } from './mockV3';
import { OpenAPI3 } from './types/openapi3';

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
        // Swagger 2.0
      } else if ('openapi' in mock) {
        mockUrl = MockV3.getUrl(mock);
      } else {
        throw new Error(`${COLORS.RED}Error:${COLORS.RESET} Invalid OpenAPI document format in mock ${mock}. Expected OpenAPI 2.0 or 3.0.`);
      }
      let url = '';

      if (!mockUrl?.includes(this.CONFIG.url)) {
        console.warn(
          `${COLORS.YELLOW}Warning:${COLORS.RESET} No server URL matching with ${this.CONFIG.url} in mock ${mock.info.title}. Setting / to default URL`,
        );
      } else {
        url = mockUrl.replace(this.CONFIG.url, '');
      }

      this.app.use(url, this.getDocumentRoutes(new MockV3(mock)));
    });
  }

  private getDocumentRoutes(mock: MockV3): Router {
    const router = Router();
    const paths = mock.mock.paths;

    if (!paths) {
      console.warn(`${COLORS.YELLOW}Warning:${COLORS.RESET} No paths found in OpenAPI document ${mock.mock.info.title}.`);
      return router;
    }

    Object.entries(paths).forEach(([path, methods]) => {
      // Format the path to use Express-style parameters
      // e.g. /users/{userId} -> /users/:userId
      const formattedPath = path.replace(/{/g, ':').replace(/}/g, '');

      Object.keys(methods!).forEach(method => {
        router[method as OpenAPIV3.HttpMethods](formattedPath, (req: Request, res: Response) => this.setRouterOperation(req, res, methods![method as OpenAPIV3.HttpMethods]!, mock));
      })
    });

    return router;
  }

  private getStatusCodeResponse(operation: OpenAPIV3.OperationObject): string | undefined {
    const statusCodes = Object.keys(operation.responses);
    if (!statusCodes) return undefined;

    return Utils.getFirstMatchingStatusCode(statusCodes, this.CONFIG.status.default);
  }

  private getContentTypeResponse(operation: OpenAPIV3.ResponseObject['content']): string | undefined {
    const contentTypes = Object.keys(operation ?? {});

    return contentTypes.includes(this.CONFIG.contentType) ? this.CONFIG.contentType : undefined;
  }

  private setRouterOperation(_: Request, res: Response, method: OpenAPIV3.OperationObject, mock: Mock): void {
    // Checking & setting status code
    let statusCode = this.getStatusCodeResponse(method);
    if (!statusCode) {
      statusCode = Object.keys(method.responses)[0] ?? this.CONFIG.status.default;
      console.warn(`${COLORS.YELLOW}Warning:${COLORS.RESET} No valid status code found for operation ${COLORS.YELLOW}${method.operationId ?? method.description ?? 'unknown'}${COLORS.RESET}. Returning ${COLORS.YELLOW}${statusCode}${COLORS.RESET} as first status founded.`);
    }
    res.status(parseInt(statusCode, 10));

    const responseMock = method.responses[statusCode];
    let responseMockContent = (responseMock as OpenAPIV3.ResponseObject).content;
    if (!responseMockContent) {
      const refPath = ((responseMock as OpenAPIV3.ReferenceObject).$ref ?? (responseMock as OpenAPIV3.ReferenceObject & { schema: OpenAPIV3.ReferenceObject }).schema.$ref).split('/');
      refPath.shift();
      responseMockContent = mock.getObjectFromRef(refPath);
    }

    if (!responseMockContent) {
      throw new Error(`${COLORS.RED}Error:${COLORS.RESET} No content found for status code ${statusCode} in operation ${COLORS.YELLOW}${method.operationId ?? method.description ?? 'unknown'}${COLORS.RESET}.`);
    }

    // Checking & setting content type
    let contentType = this.getContentTypeResponse(responseMockContent);
    if (!contentType) {
      contentType = this.CONFIG.contentType ?? Object.keys(responseMockContent)[0];
      console.warn(`${COLORS.YELLOW}Warning:${COLORS.RESET} No valid Content-Type found for operation ${COLORS.YELLOW}${method.operationId ?? method.description ?? 'unknown'}${COLORS.RESET}. Returning ${COLORS.YELLOW}${contentType}${COLORS.RESET} as first Content-Type founded.`);
    }
    res.setHeader('Content-Type', contentType);

    // Checking & setting response body
    let responseBody: unknown = null;
    const mockSchema = responseMockContent[contentType]?.schema;
    if (mockSchema && '$ref' in mockSchema) {
      const refPath = mockSchema.$ref.split('/');
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
