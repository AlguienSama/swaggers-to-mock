export type ConfigFile = {
  url: string;
  port: number;
  folder: string;
  maxLoops: number;
  arrayItems: number;
  status: {
    default: string;
    error: string;
  };
  contentType: string;
  [key: string]: any;
};
