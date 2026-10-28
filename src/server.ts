import express, { json, NextFunction, Request, Response, Router, urlencoded } from 'express';
import type { Server as HttpServer } from 'node:http';
import Deps from './utils/deps';
import { Config } from './config';
import { COLORS } from './utils/colors.utils';
import { MockReader } from './mock-reader';
import { Utils } from './utils/utils.utils';
import { MockV3 } from './mockV3';
import { OpenAPI } from './types/openapi.types';
import { BaseMock } from './types/mock.types';
import { MockV2 } from './mockV2';

export class Server {
  private readonly CONFIG = Deps.get(Config).getConfig();

  private readonly app: express.Express;
  private httpServer?: HttpServer;

  constructor() {
    this.app = express();
    this.app.use(json());
    this.app.use(urlencoded({ extended: true }));

    this.setMiddlewares();
  }

  initServer(): HttpServer {
    this.httpServer = this.app.listen(this.CONFIG.port, () => {
      console.info(
        `${COLORS.BOLD}SERVER RUNNING ON ${COLORS.YELLOW}${this.CONFIG.localUrl}:${this.CONFIG.port}${COLORS.RESET}`,
      );
    });

    return this.httpServer;
  }

  closeServer(): Promise<void> {
    if (!this.httpServer) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.httpServer!.close(error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private setMiddlewares(): void {
    this.app.use((req, res, next) => {
      const corsOrigin = this.CONFIG.corsOrigin;
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
      res.setHeader('Access-Control-Allow-Methods', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      if (this.CONFIG.corsCredentials && corsOrigin !== '*') {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      res.setHeader('Access-Control-Expose-Headers', '*');
      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
      } else {
        next();
      }
    });
  }

  setMainRoutes(): void {
    Deps.get(MockReader).mocksList.forEach((mockDocument) => {
      const mock: BaseMock = 'swagger' in mockDocument ? new MockV2(mockDocument) : new MockV3(mockDocument);

      const mockUrl = mock.getBaseUrl();
      let routePath = this.getRoutePath(mockUrl);

      if (this.CONFIG.url) {
        if (mockUrl.includes(this.CONFIG.url)) {
          routePath = this.getRoutePath(mockUrl.replace(this.CONFIG.url, this.CONFIG.localUrl));
        } else {
          console.warn(
            `${COLORS.YELLOW}Warning:${COLORS.RESET} No server base URL matching with ${this.CONFIG.url} in mock ${mock.mock.info.title}. Setting ${this.CONFIG.localUrl} to default URL`,
          );
          console.info(`${COLORS.RED}Swagger base URL${COLORS.RESET}: ${mockUrl}`);
        }
      }

      if (!routePath) {
        console.warn(
          `${COLORS.YELLOW}Warning:${COLORS.RESET} No path found in base URL for mock ${mock.mock.info.title}. Using root URL`,
        );
      }
      routePath ||= '/';
      console.info(`${COLORS.BLUE}Mock base URL${COLORS.RESET} ${COLORS.RED}v${mock.getVersion()}${COLORS.RESET} ${this.CONFIG.localUrl}:${this.CONFIG.port}${routePath}`)

      this.app.use(routePath, this.getSwaggerRoutes(mock));
    });

    this.setErrorHandler();
  }

  private setErrorHandler(): void {
    this.app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
      if (res.headersSent) {
        next(error);
        return;
      }

      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    });
  }

  private getRoutePath(baseUrl: string): string {
    if (!baseUrl) {
      return '';
    }

    try {
      return new URL(baseUrl, 'http://swaggers-to-mock.local').pathname.replace(/\/$/, '');
    } catch {
      const pathStart = baseUrl.indexOf('/', baseUrl.indexOf('//') + 2);
      return pathStart >= 0 ? baseUrl.slice(pathStart).replace(/\/$/, '') : '';
    }
  }

  private getSwaggerRoutes(mock: BaseMock): Router {
    const router = Router();
    const paths = mock.mock.paths;

    if (!paths) {
      console.warn(`${COLORS.YELLOW}Warning:${COLORS.RESET} No paths found in OpenAPI document ${mock.mock.info.title}.`);
      return router;
    }

    Object.entries(paths).forEach(([path, methods]) => {
      // Express format: /users/{userId} -> /users/:userId
      const formattedPath = Utils.formatUrlPath(path);

      Object.keys(methods).forEach(method => {
        if (!Utils.isHttpMethod(method)) return;
        console.info(`${method.toUpperCase()} -> ${formattedPath}`);
        router[method](formattedPath, (req: Request, res: Response) => this.setRouterOperation(req, res, methods[method as keyof OpenAPI.HttpMethods], mock));
      })
    });

    return router;
  }

  private getStatusCodeResponse(operation: OpenAPI.OperationObject): string | undefined {
    return this.getStatusCodeResponseFor(operation, this.CONFIG.status.default);
  }

  private getStatusCodeResponseFor(operation: OpenAPI.OperationObject, statusPattern: string): string | undefined {
    const statusCodes = Object.keys(operation.responses);
    if (!statusCodes) return undefined;

    return Utils.getFirstMatchingStatusCode(statusCodes, statusPattern)
      ?? statusCodes.find(statusCode => /^\d{3}$/.test(statusCode))
      ?? (statusCodes.includes('default') ? 'default' : undefined);
  }

  private getHttpStatusCode(statusCode: string): number {
    if (/^[1-5]\d{2}$/.test(statusCode)) {
      return Number(statusCode);
    }

    if (/^[1-5]XX$/i.test(statusCode)) {
      return Number(statusCode[0]) * 100;
    }

    return 200;
  }

  private setRouterOperation(req: Request, res: Response, method: OpenAPI.OperationObject, mock: BaseMock): void {
    const requestError = this.validateRequest(req, method);
    if (requestError) {
      const errorStatus = this.getStatusCodeResponseFor(method, this.CONFIG.status.error);
      res.status(errorStatus ? this.getHttpStatusCode(errorStatus) : 400).json({
        error: 'Bad Request',
        message: requestError,
      });
      return;
    }

    // Checking & setting status code
    let statusCode = this.getStatusCodeResponse(method);
    if (!statusCode) {
      statusCode = Object.keys(method.responses)[0] ?? this.CONFIG.status.default;
      console.warn(`${COLORS.YELLOW}Warning:${COLORS.RESET} No valid status code found for operation ${COLORS.YELLOW}${method.operationId ?? method.description ?? 'unknown'}${COLORS.RESET}. Returning ${COLORS.YELLOW}${statusCode}${COLORS.RESET} as first status founded.`);
    }
    res.status(this.getHttpStatusCode(statusCode));

    // Getting full response
    const responseMock = method.responses[statusCode];
    let responseMockContent = responseMock;
    if (responseMockContent && '$ref' in responseMockContent) {
      const refPath = responseMockContent.$ref.split('/');
      refPath.shift();
      responseMockContent = mock.getObjectFromRef(refPath);
    }

    if (!responseMockContent) {
      throw new Error(`${COLORS.RED}Error:${COLORS.RESET} No content found for status code ${statusCode} in operation ${COLORS.YELLOW}${method.operationId ?? method.description ?? 'unknown'}${COLORS.RESET}.`);
    }

    // Checking & setting content type
    const availableContentTypes = this.getResponseContentTypes(responseMockContent);
    const acceptedContentType = this.getAcceptedContentType(req.headers.accept, availableContentTypes);
    if (req.headers.accept && availableContentTypes.length > 0) {
      res.setHeader('Vary', 'Accept');
    }
    if (availableContentTypes.length > 0 && req.headers.accept && !acceptedContentType) {
      res.status(406).json({ error: 'Not Acceptable' });
      return;
    }

    let contentType = acceptedContentType ?? mock.getContentTypeResponse(method, statusCode);
    if (!contentType) {
      contentType = availableContentTypes[0] ?? this.CONFIG.contentType;
      console.warn(`${COLORS.YELLOW}Warning:${COLORS.RESET} No valid Content-Type found for operation ${COLORS.YELLOW}${method.operationId ?? method.description ?? 'unknown'}${COLORS.RESET}. Returning ${COLORS.YELLOW}${contentType}${COLORS.RESET} as first Content-Type founded.`);
    }
    res.setHeader('Content-Type', contentType);

    // Checking & setting response body
    const responseBody = mock.getContentResponse(responseMockContent, contentType);

    setTimeout(() => {
      res.send(responseBody);
    }, this.CONFIG.delay);
  }

  private getResponseContentTypes(response: OpenAPI.ResponseObject | OpenAPI.ReferenceObject): string[] {
    if ('content' in response && response.content) {
      return Object.keys(response.content);
    }
    return [];
  }

  private validateRequest(req: Request, operation: OpenAPI.OperationObject): string | undefined {
    if ('parameters' in operation && operation.parameters) {
      for (const parameter of operation.parameters) {
        if ('$ref' in parameter || !parameter.required) continue;

        let value: unknown;
        if (parameter.in === 'path') value = req.params[parameter.name];
        if (parameter.in === 'query') value = req.query[parameter.name];
        if (parameter.in === 'header') value = req.headers[parameter.name.toLowerCase()];
        if (parameter.in === 'cookie') value = req.headers.cookie;
        if (parameter.in === 'body') value = req.body;

        if (value === undefined || value === null || value === '') {
          return `Missing required parameter: ${parameter.name}`;
        }
      }
    }

    if ('requestBody' in operation && operation.requestBody && !('$ref' in operation.requestBody)
      && operation.requestBody.required && (req.body === undefined || req.body === null)) {
      return 'Missing required request body';
    }

    return undefined;
  }

  private getAcceptedContentType(acceptHeader: string | undefined, availableContentTypes: string[]): string | undefined {
    if (!acceptHeader || availableContentTypes.length === 0) {
      return undefined;
    }

    const acceptedTypes = acceptHeader
      .split(',')
      .map((value, index) => {
        const [mediaType, ...parameters] = value.split(';');
        const qualityParameter = parameters.find(parameter => parameter.trim().toLowerCase().startsWith('q='));
        const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
        return {
          mediaType: mediaType.trim().toLowerCase(),
          quality: Number.isFinite(quality) ? quality : 0,
          index,
        };
      })
      .filter(acceptedType => acceptedType.mediaType && acceptedType.quality > 0)
      .sort((left, right) => right.quality - left.quality || left.index - right.index);

    for (const acceptedType of acceptedTypes) {
      const matchingContentType = availableContentTypes.find(contentType => {
        if (acceptedType.mediaType === '*/*') return true;
        if (acceptedType.mediaType.endsWith('/*')) {
          return contentType.toLowerCase().startsWith(acceptedType.mediaType.slice(0, -1));
        }
        return acceptedType.mediaType === contentType.toLowerCase();
      });

      if (matchingContentType) {
        return matchingContentType;
      }
    }

    return undefined;
  }
}
