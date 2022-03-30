#!/usr/bin/env node
import { Command } from "commander";
import { addCompileCommand } from "./command";

addCompileCommand(new Command()).parse(process.argv);
