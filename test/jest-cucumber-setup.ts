import { loadFeatures, autoBindSteps } from "jest-cucumber";
import { cliSteps } from "./steps/cli.steps";

const features = loadFeatures("test/features/**/*.feature", { tagFilter: "not @skip" });
autoBindSteps(features, [cliSteps]);
