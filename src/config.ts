import rc from 'rc';
import { ConfigFile } from './types/config.types';

export class Config {
  static readonly url = '';
  static readonly port = 3000;
  static readonly folder = './yamls';
  static readonly maxLoops = 2;
  static readonly arrayItems = 2;
  static readonly contentType = '*/*';
  static readonly status = {
    default: '2XX',
    error: '4XX',
  };

  private config?: ConfigFile;

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
    return rc('swagtomock', {
      url: Config.url,
      port: Config.port,
      folder: Config.folder,
      maxLoops: Config.maxLoops,
      arrayItems: Config.arrayItems,
      contentType: Config.contentType,
      status: {
        default: Config.status.default,
        error: Config.status.error,
      },
    });
  }
}
