import { defineConfig, configDefaults } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// tsconfig 의 "@/*" → 프로젝트 루트 alias 를 Vitest 에도 동일 적용
const root = path.dirname(fileURLToPath(import.meta.url)).replace(/\\/g, "/");

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: `${root}/` }],
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // .claude/worktrees(에이전트 격리 워크트리)의 테스트 복사본을 수집하지 않는다 —
    // 그 복사본은 "@/" alias 가 메인 소스를 가리켜 유령 실패를 낸다.
    exclude: [...configDefaults.exclude, "**/.claude/**"],
  },
});
