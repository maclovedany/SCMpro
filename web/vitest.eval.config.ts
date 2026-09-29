import { defineConfig } from "vitest/config";
import path from "path";
/** AI Agent 평가 (R-AI-09, D-081): 실제 DB(읽기만)와 실제 모델을 쓴다 — 평소 테스트(npm test)에는 들어가지 않는다. 실행: npm run eval:ai */
export default defineConfig({
  test: { environment: "node", include: ["tests/eval/**/*.eval.ts"], globals: true, testTimeout: 180_000, hookTimeout: 120_000, fileParallelism: false },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
