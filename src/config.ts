import rc from 'rc';
import { ConfigFile } from './types/config.types';

export class Config {
  static readonly url = '';
  static readonly localUrl = 'localhost';
  static readonly port = 3000;
  static readonly folder = './yamls';
  static readonly maxLoops = 2;
  static readonly arrayItems = 2;
  static readonly delay = 0;
  static readonly contentType = '*/*';
  static readonly corsOrigin = '*';
  static readonly corsCredentials = false;
  static readonly status = {
    default: '2XX',
    error: '4XX',
  };

  private config?: ConfigFile;

  private parseInteger(value: unknown, name: string, minimum: number, maximum?: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || (maximum !== undefined && parsed > maximum)) {
      const range = maximum === undefined ? `at least ${minimum}` : `between ${minimum} and ${maximum}`;
      throw new Error(`Invalid configuration value for ${name}: expected an integer ${range}`);
    }
    return parsed;
  }

  private parseBoolean(value: unknown, name: string): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
    }

    throw new Error(`Invalid configuration value for ${name}: expected true or false`);
  }

  init() {
    this.config = this.loadConfig();
  }

  getConfig(): ConfigFile {
    if (!this.config) {
      this.config = this.loadConfig();
      if (!this.config) {
        throw new Error('Failed to load configuration');
      }
    }
    return this.config;
  }

  private loadConfig(): ConfigFile {
    const config = rc('swagtomock', {
      url: Config.url,
      localUrl: Config.localUrl,
      port: Config.port,
      folder: Config.folder,
      maxLoops: Config.maxLoops,
      arrayItems: Config.arrayItems,
      delay: Config.delay,
      contentType: Config.contentType,
      corsOrigin: Config.corsOrigin,
      corsCredentials: Config.corsCredentials,
      status: {
        default: Config.status.default,
        error: Config.status.error,
      },
    });

    return {
      ...config,
      port: this.parseInteger(config.port, 'port', 1, 65535),
      maxLoops: this.parseInteger(config.maxLoops, 'maxLoops', 0),
      arrayItems: this.parseInteger(config.arrayItems, 'arrayItems', 0),
      delay: this.parseInteger(config.delay, 'delay', 0),
      corsCredentials: this.parseBoolean(config.corsCredentials, 'corsCredentials'),
    };
  }
}
