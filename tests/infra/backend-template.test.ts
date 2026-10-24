import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const template = JSON.parse(
  readFileSync("infra/backend.template.json", "utf8"),
);
it("provisions encrypted durable state, TTL and restore, throttled WebSocket routes and bounded functions", () => {
  expect(template.Transform).toBe("AWS::Serverless-2016-10-31");
  const resources = template.Resources;
  expect(resources.RelayTable.Properties.SSESpecification.SSEEnabled).toBe(
    true,
  );
  expect(resources.RelayTable.Properties.TimeToLiveSpecification).toEqual({
    AttributeName: "ttl",
    Enabled: true,
  });
  expect(
    resources.RelayTable.Properties.PointInTimeRecoverySpecification
      .PointInTimeRecoveryEnabled,
  ).toBe(true);
  expect(resources.RelayTable.DeletionPolicy).toBe("Retain");
  expect(
    ["Connect", "Disconnect", "Message"].map(
      (name) => resources[`${name}Route`].Properties.RouteKey,
    ),
  ).toEqual(["$connect", "$disconnect", "$default"]);
  expect(
    resources.RelayStage.Properties.DefaultRouteSettings.ThrottlingRateLimit,
  ).toBe(20);
  for (const name of ["RelayFunction", "HintFunction"]) {
    expect(resources[name].Properties.Runtime).toBe("nodejs22.x");
    expect(resources[name].Properties.Timeout).toBeLessThanOrEqual(10);
    expect(
      resources[name].Properties.ReservedConcurrentExecutions,
    ).toBeLessThanOrEqual(10);
  }
});
it("grants only the configured model and table, no wildcard-resource AWS policy or browser credentials", () => {
  const resources = template.Resources;
  for (const name of ["RelayFunction", "HintFunction"]) {
    for (const statement of resources[name].Properties.Policies[0].Statement)
      expect(statement.Resource).not.toBe("*");
  }
  const bedrock = resources.HintFunction.Properties.Policies[0].Statement.find(
    (statement: { Action: string[] }) =>
      statement.Action.includes("bedrock:InvokeModel"),
  );
  expect(bedrock.Resource).toEqual({ Ref: "TextModelArn" });
  expect(template.Parameters.LiveHintsEnabled.Default).toBe("false");
  expect(
    resources.HintFunction.Properties.Events.HintRequest.Properties.Path,
  ).toBe("/v1/hints");
  expect(JSON.stringify(template)).not.toMatch(
    /AccessKeyId|SecretAccessKey|DataTraceEnabled/,
  );
});
