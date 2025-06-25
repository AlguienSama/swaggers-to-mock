import fs from 'fs';
import path from 'path';
import jsYaml from 'js-yaml';
import Deps from './utils/deps';
import { Config } from './config';
import { COLORS } from './utils/colors.utils';
import { OpenAPI } from './types/openapi.types';

export class MockReader {
  private readonly CONFIG = Deps.get(Config).getConfig();
  private readonly fullPath: string;
  mocksList: OpenAPI.Document[] = [];

  constructor() {
    this.fullPath = path.join(path.resolve(), this.CONFIG.folder);
    if (!this.fullPath) {
      throw new Error(`Folder not found! Default forlder name is ${COLORS.YELLOW}${Config.folder}${COLORS.RESET}`);
    }
  }

  init(): void {
    const folderFiles = fs.readdirSync(this.fullPath);
    if (folderFiles.length === 0) {
      throw new Error(`Folder "${this.CONFIG.folder}" is empty!`);
    }

    const mockData: MockReader['mocksList'] = folderFiles
      .filter(file => file.toLowerCase().endsWith('.yaml'))
      .map(file => {
        const filePath = path.join(this.fullPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const yamlData = jsYaml.load(fileContent);
        return yamlData as MockReader['mocksList'][number];
      });

    if (mockData.length === 0) {
      throw new Error(
        `No valid ${COLORS.RED}.yaml${COLORS.RESET} files found in folder ${COLORS.YELLOW}${this.CONFIG.folder}${COLORS.RESET}!`,
      );
    }

    this.mocksList = mockData;
    console.info(
      `${COLORS.BOLD}Loaded ${COLORS.YELLOW}${this.mocksList.length}${COLORS.RESET} mock data files from ${COLORS.YELLOW}${this.CONFIG.folder}${COLORS.RESET}`,
    );
  }

  getBodySchema = (
    schema: OpenAPI.SchemaObject,
    mock: Record<string, unknown>,
    mockRefs: string[],
  ): Record<string, unknown> | unknown | unknown[] => {
    if (!schema) {
      return null;
    } else if (Array.isArray(schema)) {
      const items = schema.map(item => this.getBodySchema(item, mock, mockRefs));
      return items.length > 0 ? items : [];
    } else if ('$ref' in schema) {
      // Handle $ref schema
    }

    return void 0;
  }
}
