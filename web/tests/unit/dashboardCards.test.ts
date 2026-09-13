import { it, expect } from "vitest";
import { cardsFromSummary } from "@/lib/queries/dashboard";
const s = { items_by_category: { PART: 6001, SUPPLY: 634, OPTION: 3070, SW: 520 }, dummy_ratio: 1, pending_approvals: 2,
  last_upload: { file_name: "inv.csv", uploaded_at: "2026-09-13T10:00:00Z", ok_count: 10, error_count: 2 }, snapshot_date: "2026-08-31", missing_target_dos: 0 };
it("every card has href and drill filters", () => {
  const cards = cardsFromSummary(s);
  expect(cards).toHaveLength(6);
  cards.forEach(c => expect(c.href.startsWith("/")).toBe(true));
  expect(cards[2].href).toBe("/approvals?status=pending");
  expect(cards[3].tone).toBe("warn");
  expect(cards[5].href).toBe("/items?target_dos=missing");
  expect(cards[0].value).toBe("9,705");   // SW 제외 합
});
