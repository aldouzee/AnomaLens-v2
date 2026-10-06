import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import PredictionForm from "./PredictionForm.jsx";
import * as client from "../api/client.js";

const models = [{ id: "random_forest", name: "Random Forest", type: "supervised" }];
const features = ["throughput", "latency"];

test("submits the record and shows the verdict badge", async () => {
  vi.spyOn(client, "predict").mockResolvedValue({ model: "random_forest", prediction: "anomaly", score: 0.91, latency_ms: 4.2 });
  render(<PredictionForm features={features} models={models} />);
  await userEvent.click(screen.getByRole("button", { name: /predict/i }));
  await waitFor(() => expect(screen.getByText("Anomaly")).toBeInTheDocument());
  expect(client.predict).toHaveBeenCalledWith("random_forest", expect.objectContaining({ throughput: 2, latency: 7 }));
});

test("reports scored records to the caller", async () => {
  vi.spyOn(client, "predict").mockResolvedValue({ model: "random_forest", prediction: "normal", score: 0.1, latency_ms: 1 });
  const onScored = vi.fn();
  render(<PredictionForm features={features} models={models} onScored={onScored} />);
  await userEvent.click(screen.getByRole("button", { name: /predict/i }));
  await waitFor(() => expect(onScored).toHaveBeenCalledWith([
    expect.objectContaining({ model: "random_forest", score: 0.1, source: "manual", features: { throughput: 2, latency: 7 } }),
  ]));
});

test("shows API errors", async () => {
  vi.spyOn(client, "predict").mockRejectedValue(new Error("Unknown model"));
  render(<PredictionForm features={features} models={models} />);
  await userEvent.click(screen.getByRole("button", { name: /predict/i }));
  await waitFor(() => expect(screen.getByText("Unknown model")).toBeInTheDocument());
});
