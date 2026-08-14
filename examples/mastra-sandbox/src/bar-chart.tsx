import { defineChannelComponent } from "@copilotkit/channels";
import { Slack } from "@copilotkit/channels/slack";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";

const shortText = (maximum: number) =>
  v.pipe(v.string(), v.minLength(1), v.maxLength(maximum));

const barSchema = v.object({
  label: v.pipe(
    shortText(20),
    v.description("The category label shown below this bar."),
  ),
  value: v.pipe(
    v.number(),
    v.description("The numeric value represented by this bar."),
  ),
});

const barChartSchema = v.object({
  title: v.pipe(shortText(50), v.description("A concise chart title.")),
  seriesName: v.optional(
    v.pipe(shortText(20), v.description("The name of the measured series.")),
  ),
  xLabel: v.optional(
    v.pipe(shortText(50), v.description("An optional x-axis label.")),
  ),
  yLabel: v.optional(
    v.pipe(shortText(50), v.description("An optional y-axis label.")),
  ),
  bars: v.pipe(
    v.array(barSchema),
    v.minLength(1),
    v.maxLength(20),
    v.description("One to twenty labeled values to plot."),
  ),
});

export const barChart = defineChannelComponent({
  name: "show_bar_chart",
  description:
    "Show a bar chart in Slack when numeric values are easier to compare visually.",
  parameters: toStandardJsonSchema(barChartSchema),
  render({ title, seriesName, xLabel, yLabel, bars }) {
    return (
      <Slack.Block.DataVisualization
        title={title}
        chart={{
          type: "bar",
          series: [
            {
              name: seriesName ?? "Value",
              data: bars,
            },
          ],
          axis_config: {
            categories: bars.map(({ label }) => label),
            ...(xLabel ? { x_label: xLabel } : {}),
            ...(yLabel ? { y_label: yLabel } : {}),
          },
        }}
      />
    );
  },
});
