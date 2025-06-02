/* eslint-disable no-console */
import express, { json, Request, Response, Router, urlencoded } from 'express';
import Deps from './utils/deps';
import { Config } from './config';
import { COLORS } from './utils/colors';
import { MockReader } from './mock-reader';
import { OpenAPIV3 } from './types/openapi';
import { Utils } from './utils/utils';
import { Mock } from './mock';

export class Server {
  private readonly CONFIG = Deps.get(Config).getConfig();

  private readonly app: express.Express;

  constructor() {
    this.app = express();
    this.app.use(json());
    this.app.use(urlencoded({ extended: true }));
  }

  initServer(): void {
    this.app.listen(this.CONFIG.port, () => {
      console.info(
        `${COLORS.BOLD}SERVER RUNNING ON ${COLORS.YELLOW}http://localhost:${this.CONFIG.port}${COLORS.RESET}`,
      );
    });
  }

  setMainRoutes(): void {
    Deps.get(MockReader).mocksList.forEach((mock: OpenAPIV3.Document) => {
      const mockUrl = mock.servers?.[0]?.url || mock['x-ibm-configuration']?.servers?.[0]?.url;
      let url = '';

      if (!mockUrl?.includes(this.CONFIG.url)) {
        console.warn(
          `${COLORS.YELLOW}Warning:${COLORS.RESET} No server URL matching with ${this.CONFIG.url} in mock ${mock.info.title}. Setting / to default URL`,
        );
      } else {
        url = mockUrl.replace(this.CONFIG.url, '');
      }

      this.app.use(url, this.getDocumentRoutes(new Mock(mock)));
    });
  }

  private getDocumentRoutes(mock: Mock): Router {
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
    const contentTypes = Object.keys(operation!);

    return contentTypes.includes(this.CONFIG.contentType) ? this.CONFIG.contentType : undefined;
  }

  private setRouterOperation(_: Request, res: Response, method: OpenAPIV3.OperationObject, mock: Mock): void {
    // Checking & setting status code
    let statusCode = this.getStatusCodeResponse(method);
    if (!statusCode) {
      statusCode = Object.keys(method.responses)[0];
      console.warn(`${COLORS.YELLOW}Warning:${COLORS.RESET} No valid status code found for operation ${method.operationId || 'unknown'}. Returning ${statusCode} as first status founded.`);
    }
    res.status(parseInt(statusCode, 10));

    const responseMock = (method.responses[statusCode] as OpenAPIV3.ResponseObject).content;
    if (!responseMock) {
      throw new Error(`${COLORS.RED}Error:${COLORS.RESET} No response content found for operation ${method.operationId || 'unknown'}.`);
    }

    // Checking & setting content type
    let contentType = this.getContentTypeResponse(responseMock);
    if (!contentType) {
      contentType = Object.keys(responseMock)[0];
      console.warn(`${COLORS.YELLOW}Warning:${COLORS.RESET} No valid Content-Type found for operation ${method.operationId || 'unknown'}. Returning ${contentType} as first Content-Type founded.`);
    }
    res.setHeader('Content-Type', contentType);

    // Checking & setting response body
    let responseBody: unknown = null;
    const mockSchema = responseMock[contentType].schema;
    if (mockSchema && '$ref' in mockSchema) {
      const refPath = mockSchema.$ref.split('/');
      refPath.shift();
      const refHistory = [refPath.join('/')];
      const refSchema = mock.getObjectFromRef(refPath) as OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject;
      responseBody = mock.getOutputSchema(refSchema, refHistory);
    } else {
      responseBody = responseMock[contentType].example;
    }

    res.send(responseBody);
  }
}
