import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToIR, toAgentToolDescriptors } from "@copilotkit/channels";
import { renderBlockKit } from "@copilotkit/channels/slack";
import { barChart } from "../src/bar-chart.js";

test("bar chart renders a native Slack data visualization", async () => {
  const node = await barChart.render(
    {
      title: "Requests by service",
      seriesName: "Requests",
      xLabel: "Service",
      yLabel: "Count",
      bars: [
        { label: "API", value: 120 },
        { label: "Gateway", value: 80 },
      ],
    },
    { platform: "slack", signal: AbortSignal.timeout(1_000) },
  );

  assert.deepEqual(renderBlockKit(renderToIR(node)), [
    {
      type: "data_visualization",
      title: "Requests by service",
      chart: {
        type: "bar",
        series: [
          {
            name: "Requests",
            data: [
              { label: "API", value: 120 },
              { label: "Gateway", value: 80 },
            ],
          },
        ],
        axis_config: {
          categories: ["API", "Gateway"],
          x_label: "Service",
          y_label: "Count",
        },
      },
    },
  ]);
});

test("bar chart is exposed to the agent as a component tool", () => {
  const [descriptor] = toAgentToolDescriptors([
    {
      name: barChart.name,
      description: barChart.description,
      parameters: barChart.parameters,
      handler: () => undefined,
    },
  ]);

  assert.equal(descriptor?.name, "show_bar_chart");
  assert.equal(descriptor?.parameters.type, "object");
  assert.deepEqual(descriptor?.parameters.required, ["title", "bars"]);
});
