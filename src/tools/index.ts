import { createRegistry } from "../registry.js";
import { searchWeb } from "./search-web.js";
import { fetchPage } from "./fetch-page.js";
import { saveReport } from "./save-report.js";

export const registry = createRegistry([searchWeb, fetchPage, saveReport]);
