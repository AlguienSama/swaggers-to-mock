#!/usr/bin/env node

import { Config } from "./config";
import { MockReader } from "./mock-reader";
import { Server } from "./server";
import Deps from "./utils/deps";

const server = Deps.set(Server, new Server());
Deps.set(Config, new Config()).init();
Deps.set(MockReader, new MockReader()).init();

server.setMainRoutes();
server.initServer();

const shutdown = async () => {
  try {
    await server.closeServer();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
