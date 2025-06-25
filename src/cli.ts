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
