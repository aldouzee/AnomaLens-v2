import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";
import About from "./About.jsx";

test("renders the headline and the five section headings", () => {
  render(<About />);
  expect(screen.getByRole("heading", { level: 1, name: /spot network trouble/i })).toBeInTheDocument();
  for (const name of ["The problem", "Our solution", "The dataset", "Significant features", "Honest limits"]) {
    expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
  }
});

test("shows the seven personas and navigates from the hero buttons", async () => {
  const onNavigate = vi.fn();
  render(<About onNavigate={onNavigate} />);
  for (const p of ["Torvalds", "Babbage", "Turing", "Ritchie", "Shannon", "Dijkstra", "Hopper"]) {
    expect(screen.getByRole("heading", { level: 3, name: p })).toBeInTheDocument();
  }
  await userEvent.click(screen.getByRole("button", { name: /open the dashboard/i }));
  expect(onNavigate).toHaveBeenCalledWith("dashboard");
});

test("reads the best F1 and recall from the loaded metrics", () => {
  const models = [
    { id: "stacking", name: "Stacking", metrics: { f1: 0.9, recall: 0.82 } },
    { id: "boosting", name: "Boosting", metrics: { f1: 0.84, recall: 0.94 } },
  ];
  render(<About info={{ models }} />);
  expect(screen.getByText(/F1 of 0.90/)).toBeInTheDocument();
  expect(screen.getByText(/recall of 0.94/)).toBeInTheDocument();
});
