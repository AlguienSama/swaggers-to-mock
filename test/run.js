const assert = require('assert').strict;
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const { MockV2 } = require('../dist/mockV2.js');
const { MockV3 } = require('../dist/mockV3.js');
const { Config } = require('../dist/config.js');
const { Server } = require('../dist/server.js');
const { validateOpenAPIDocument } = require('../dist/openapi-validator.js');
const { Utils } = require('../dist/utils/utils.utils.js');

const port = 32123;
const root = path.resolve(__dirname, '..');
const fixtureDirectory = path.resolve(__dirname, 'fixtures');

function requestHealth(accept, requestPath = '/api/health') {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: 'localhost',
      port,
      path: requestPath,
      method: 'GET',
      headers: accept ? { Accept: accept } : {},
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode, body }));
    });
    request.on('error', reject);
    request.end();
  });
}

async function waitForHealth(retries = 30) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await requestHealth();
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Mock server did not start in time');
}

async function servesOpenApiResponseOverHttp() {
  const server = spawn(process.execPath, [path.join(root, 'dist', 'cli.js'), `--port=${port}`], {
    cwd: fixtureDirectory,
    stdio: 'ignore',
  });

  try {
    const response = await waitForHealth();
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
    const acceptedResponse = await requestHealth('application/json');
    assert.equal(acceptedResponse.statusCode, 200);
    const rejectedResponse = await requestHealth('text/plain');
    assert.equal(rejectedResponse.statusCode, 406);
    const brokenResponse = await requestHealth(undefined, '/api/broken');
    assert.equal(brokenResponse.statusCode, 500);
    assert.deepEqual(JSON.parse(brokenResponse.body), { error: 'Internal Server Error' });
  } finally {
    server.kill();
    if (server.exitCode === null) {
      await new Promise(resolve => server.once('exit', resolve));
    }
  }
}

const tests = [
  ['matches wildcard HTTP status codes correctly', () => {
    assert.equal(Utils.getFirstMatchingStatusCode(['400', '200'], '2XX'), '200');
    assert.equal(Utils.getFirstMatchingStatusCode(['200', '404'], '4XX'), '404');
  }],
  ['uses enum and preserves falsy default/example values', () => {
    assert.equal(Utils.getPropertyValue({ type: 'string', enum: ['admin', 'user'] }), 'admin');
    assert.equal(Utils.getPropertyValue({ type: 'boolean', default: false }), false);
    assert.equal(Utils.getPropertyValue({ type: 'number', default: 0 }), 0);
    assert.equal(Utils.getPropertyValue({ type: 'string', example: '' }), '');
  }],
  ['generates null for nullable schemas without an explicit value', () => {
    assert.equal(Utils.getPropertyValue({ type: 'string', nullable: true }), null);
    assert.equal(Utils.getPropertyValue({ type: 'string', nullable: true, default: 'value' }), 'value');
  }],
  ['generates deterministic values for common formats', () => {
    assert.equal(Utils.getPropertyValue({ type: 'string', format: 'date' }), '2020-01-01');
    assert.equal(Utils.getPropertyValue({ type: 'string', format: 'uuid' }), '00000000-0000-4000-8000-000000000000');
    assert.equal(Utils.getPropertyValue({ type: 'string', format: 'email' }), 'user@example.com');
    assert.equal(Utils.getPropertyValue({ type: 'string', format: 'date', example: '2024-01-01' }), '2024-01-01');
  }],
  ['loads valid numeric configuration', () => {
    const config = new Config().getConfig();
    assert.equal(Number.isInteger(config.port), true);
    assert.equal(config.port >= 1 && config.port <= 65535, true);
    assert.equal(Number.isInteger(config.arrayItems), true);
    assert.equal(config.arrayItems >= 0, true);
    assert.equal(Number.isInteger(config.delay), true);
    assert.equal(config.delay >= 0, true);
  }],
  ['normalizes default and ranged HTTP status codes', () => {
    const server = new Server();
    assert.equal(server.getHttpStatusCode('200'), 200);
    assert.equal(server.getHttpStatusCode('2XX'), 200);
    assert.equal(server.getHttpStatusCode('default'), 200);
  }],
  ['honors Accept quality values', () => {
    const server = new Server();
    assert.equal(
      server.getAcceptedContentType('text/plain;q=0.9, application/json;q=1', ['text/plain', 'application/json']),
      'application/json',
    );
    assert.equal(server.getAcceptedContentType('application/json;q=0', ['application/json']), undefined);
  }],
  ['handles empty schema compositions safely', () => {
    const mock = new MockV3({ openapi: '3.0.0', info: { title: 'v3', version: '1' }, paths: {} });
    assert.deepEqual(mock.getOutputSchema({ type: 'object', oneOf: [], properties: { ok: { type: 'boolean' } } }, []), { ok: false });
    assert.deepEqual(mock.getOutputSchema({ type: 'object', anyOf: [], properties: { ok: { type: 'boolean' } } }, []), { ok: false });
  }],
  ['reports missing references clearly', () => {
    assert.throws(
      () => Utils.getObjectFromRef({}, ['components', 'schemas', 'Missing']),
      /Reference path not found: #\/components/,
    );
  }],
  ['generates representative map values from additionalProperties', () => {
    const v2 = new MockV2({ swagger: '2.0', info: { title: 'v2', version: '1' }, paths: {} });
    const v3 = new MockV3({ openapi: '3.0.0', info: { title: 'v3', version: '1' }, paths: {} });
    assert.deepEqual(v2.getOutputSchema({ type: 'object', additionalProperties: { type: 'string' } }, []), { additionalProperty: '' });
    assert.deepEqual(v3.getOutputSchema({ type: 'object', additionalProperties: { type: 'integer' } }, []), { additionalProperty: 0 });
  }],
  ['generates arrays with the configured length', () => {
    const v2 = new MockV2({ swagger: '2.0', info: { title: 'v2', version: '1' }, paths: {} });
    const v3 = new MockV3({ openapi: '3.0.0', info: { title: 'v3', version: '1' }, paths: {} });

    assert.equal(v2.getOutputSchema({ type: 'array', items: { type: 'string' } }, []).length, 2);
    assert.equal(v3.getOutputSchema({ type: 'array', items: { type: 'integer' } }, []).length, 2);
    assert.equal(v3.getOutputSchema({ type: 'array', minItems: 4, items: { type: 'integer' } }, []).length, 4);
    assert.equal(v2.getOutputSchema({ type: 'array', maxItems: 1, items: { type: 'string' } }, []).length, 1);
  }],
  ['uses global produces in Swagger 2', () => {
    const mock = new MockV2({
      swagger: '2.0',
      info: { title: 'v2', version: '1' },
      produces: ['application/json'],
      paths: {},
    });

    assert.equal(mock.getContentTypeResponse({ responses: { '200': { description: 'ok' } } }), 'application/json');
  }],
  ['validates OpenAPI documents', () => {
    const document = validateOpenAPIDocument({
      openapi: '3.0.0',
      info: { title: 'valid', version: '1' },
      paths: {},
    }, 'valid.yaml');
    assert.equal(document.openapi, '3.0.0');
    assert.throws(
      () => validateOpenAPIDocument({ swagger: '1.2' }, 'invalid.yaml'),
      /invalid\.yaml.*supported versions/,
    );
    assert.throws(
      () => validateOpenAPIDocument({ openapi: '3.0.0', info: {}, paths: {} }, 'missing-info.yaml'),
      /missing-info\.yaml.*info\.title and info\.version are required/,
    );
    assert.throws(
      () => validateOpenAPIDocument({ openapi: '3.0.0', info: { title: 'invalid', version: '1' }, paths: { '/health': { get: {} } } }, 'missing-responses.yaml'),
      /missing-responses\.yaml.*GET \/health must define responses/,
    );
    assert.throws(
      () => validateOpenAPIDocument({ openapi: '3.0.0', info: { title: 'invalid', version: '1' }, paths: { '/health': { get: { responses: { invalid: { description: 'bad' } } } } } }, 'invalid-status.yaml'),
      /invalid-status\.yaml.*invalid response status "invalid"/,
    );
    assert.throws(
      () => validateOpenAPIDocument({ openapi: '3.0.0', info: { title: 'invalid', version: '1' }, paths: { '/health': { get: { responses: { '200': {} } } } } }, 'missing-description.yaml'),
      /missing-description\.yaml.*response "200".*must define description/,
    );
  }],
  ['serves an OpenAPI response over HTTP', servesOpenApiResponseOverHttp],
];

(async () => {
  for (const [name, run] of tests) {
    await run();
    console.info(`PASS ${name}`);
  }
  console.info(`PASS ${tests.length} tests`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
