import { configJson, graphJson } from './sample';
import { completeStage, startRun } from './runState';

const result = startRun("123", graphJson, configJson);
console.log("Result: " + result);

const newRes = completeStage("123", "stage_install");
console.log(newRes);
