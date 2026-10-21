import { defineConfig } from "vitest/config";
// Each suite applies migrations; serialize suites on the disposable database.
export default defineConfig({ test: { fileParallelism: false } });
