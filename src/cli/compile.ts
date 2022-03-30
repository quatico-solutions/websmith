#!/usr/bin/env node
import { Command } from "commander";
import { addCompileCommand } from "./command";

const command = new Command();
addCompileCommand(command);
command.parse(process.argv);
