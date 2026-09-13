import { describe, it, expect } from "vitest";
import { menuForRole } from "@/lib/auth/roles";
describe("menuForRole", () => {
  it("sales sees only common menus", () => {
    expect(menuForRole("sales").map(m => m.href)).toEqual(["/dashboard", "/items", "/forecast", "/orders", "/extra-demand", "/sales-orders", "/notifications"]);
  });
  it("admin sees admin menus", () => {
    const hrefs = menuForRole("admin").map(m => m.href);
    expect(hrefs).toContain("/admin/settings");
    expect(hrefs).toContain("/upload");
    expect(hrefs).toContain("/approvals");
  });
  it("item_manager sees item-settings but not system settings", () => {
    const hrefs = menuForRole("item_manager").map(m => m.href);
    expect(hrefs).toContain("/admin/item-settings");
    expect(hrefs).not.toContain("/admin/settings");
  });
});
