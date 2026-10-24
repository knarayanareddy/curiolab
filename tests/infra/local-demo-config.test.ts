import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parse } from "yaml";
it("Compose wires all three health-gated services with server-side container URLs and loopback-only host ports", () => {
  const compose = parse(readFileSync("docker-compose.yml", "utf8"), {
    merge: true,
  });
  expect(Object.keys(compose.services).sort()).toEqual([
    "content",
    "firetv",
    "session-relay",
  ]);
  for (const [service, port] of [
    ["session-relay", 8080],
    ["content", 8081],
    ["firetv", 5173],
  ] as const) {
    expect(compose.services[service].ports).toEqual([
      `127.0.0.1:${port}:${port}`,
    ]);
    expect(compose.services[service].healthcheck.retries).toBeGreaterThan(0);
    expect(compose.services[service].build).toBe(".");
  }
  expect(compose.services.firetv.environment).toEqual({
    RELAY_URL: "http://session-relay:8080",
    CONTENT_URL: "http://content:8081",
  });
  expect(compose.services.firetv.depends_on.content.condition).toBe(
    "service_healthy",
  );
  expect(compose.services.firetv.depends_on["session-relay"].condition).toBe(
    "service_healthy",
  );
  const dockerfile = readFileSync("Dockerfile", "utf8");
  for (const line of dockerfile
    .split("\n")
    .filter((line) => line.startsWith("COPY "))) {
    for (const input of line.split(" ").slice(1, -1))
      expect(existsSync(input), `Docker COPY source ${input}`).toBe(true);
  }
  expect(dockerfile).toContain("openjdk-17-jre-headless");
  expect(dockerfile).toContain("pnpm install --frozen-lockfile");
});
it("Pages deploys only built static assets after checks with scoped deployment permissions", () => {
  const workflow = parse(readFileSync(".github/workflows/pages.yml", "utf8"));
  expect(workflow.on.push.branches).toEqual(["main"]);
  expect(workflow.permissions).toEqual({ contents: "read" });
  expect(workflow.jobs.deploy.permissions).toEqual({
    pages: "write",
    "id-token": "write",
  });
  expect(workflow.jobs.deploy.steps[0].uses).toBe("actions/deploy-pages@v4");
  expect(
    workflow.jobs.build.steps.find(
      (step: { uses?: string }) =>
        step.uses === "actions/upload-pages-artifact@v3",
    ).with.path,
  ).toBe("build/pages");
  expect(readFileSync("apps/firetv/vite.config.ts", "utf8")).toContain(
    'base: "/curiolab/"',
  );
});
