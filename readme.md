# SWAGGERS TO MOCK

Mock server for Swagger 2.0 and OpenAPI 3.x documents.

## Usage

Install the package and place one or more OpenAPI documents in `./yamls`:

```bash
npm i swaggers-to-mock
npx swaggers-to-mock
```

The reader accepts `.yaml`, `.yml` and `.json` files. Files without an
`openapi` or `swagger` root property are treated as auxiliary files and can be
used by external `$ref` values.

For local development:

```bash
npm install
npm start -- --port=3000
```

You can create a `.swagtomockrc` file or use command line options to personalize the server.

Example `.swagtomockrc`:

```json
{
  "port": 3000,
  "folder": "./yamls",
  "arrayItems": 2,
  "contentType": "*/*",
  "corsOrigin": "*",
  "corsCredentials": false
}
```

External references are resolved relative to the document that contains them:

```yaml
$ref: './components.yaml#/components/schemas/User'
```

## Default Configuration

Below are the default configuration options for the mock server:

- **url**: `''`
  The server URL of the OpenAPI to be replaced. Default is empty.

- **localUrl**: `'localhost'`
  The url where the mock server will run.

- **port**: `3000`
  The port where the mock server will run.

- **folder**: `'./yamls'`
  Local folder where OpenAPI files are stored.

- **maxLoops**: `2`
  Maximum number of circular references allowed when processing schemas.

- **arrayItems**: `2`
  Default number of items generated in mocked arrays.

- **delay**: `0`
  Delay in milliseconds before sending the response (useful to simulate slow requests).

- **contentType**: `'*/*'`
  Default accepted content type.

- **corsOrigin**: `'*'`
  Value for the `Access-Control-Allow-Origin` response header.

- **corsCredentials**: `false`
  Enables credentialed CORS responses when `corsOrigin` is not `'*'`.

- **Accept header**
  When a request includes `Accept`, the server negotiates the available
  response content type, including MIME wildcards and `q` quality values. If
  there is no match, it returns `406 Not Acceptable`.

- **status**:
  - **default**: `'2XX'`
    Default HTTP status code for successful responses.

  - **error**: `'4XX'`
    Default HTTP status code for error responses.

## Tests

Run the build, unit checks and HTTP end-to-end check with:

```bash
npm test
```
