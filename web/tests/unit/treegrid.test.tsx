import { it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TreeGrid } from "@/components/tables/TreeGrid";
const rows = [{ id: "p", label: "부품", level: 0, values: { "2026-01": 10, "2026-02": 20 },
  children: [{ id: "c", label: "556K59129", level: 1, values: { "2026-01": 4, "2026-02": 6 } }] }];
it("collapses and expands children", () => {
  render(<TreeGrid months={["2026-01","2026-02"]} rows={rows} pastUntil="2026-01" />);
  expect(screen.getByText("556K59129")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "부품" }));
  expect(screen.queryByText("556K59129")).toBeNull();
});
