export type ConfigFile = {
  url: string;
  localUrl: string;
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
