import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import FeatureImportance from "./FeatureImportance.jsx";
import * as client from "../api/client.js";

const models = [{ id: "random_forest", name: "Random Forest", type: "supervised" }];

test("shows the importance chart once the API answers", async () => {
  vi.spyOn(client, "getExplain").mockResolvedValue({
    features: ["throughput", "latency"], test_rows: 201,
    models: [{ id: "random_forest", baseline_auc: 0.99, importance: { throughput: 0.7, latency: 0.3 } }],
  });
  render(<FeatureImportance models={models} />);
  expect(screen.getByText(/calculating/i)).toBeInTheDocument();
  expect(await screen.findByRole("combobox")).toBeInTheDocument();
  expect(screen.queryByText(/calculating/i)).not.toBeInTheDocument();
});

test("shows the API error", async () => {
  vi.spyOn(client, "getExplain").mockRejectedValue(new Error("needs stream_sample.csv"));
  render(<FeatureImportance models={models} />);
  expect(await screen.findByText("needs stream_sample.csv")).toBeInTheDocument();
});
