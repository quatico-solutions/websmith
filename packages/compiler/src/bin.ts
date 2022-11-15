#!/usr/bin/env ts-node
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { Command } from "commander";
import { addCompileCommand } from "./command";

addCompileCommand(new Command()).parse(process.argv);
