# SWAGGERS TO MOCK

Just run `npm i swaggers-to-mock` and use it.

You can create a `.swagtomockrc` file or use command line options to personalize the server.

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

- **contentType**: `'*/*'`
  Default accepted content type.

- **status**:
  - **default**: `'2XX'`
    Default HTTP status code for successful responses.

  - **error**: `'4XX'`
    Default HTTP status code for error responses.
