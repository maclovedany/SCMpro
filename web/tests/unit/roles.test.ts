import { describe, it, expect } from "vitest";
import { menuForRole, menuGroupsForRole } from "@/lib/auth/roles";
describe("menuForRole", () => {
  it("sales sees only common menus", () => {
    expect(menuForRole("sales").map(m => m.href)).toEqual(["/dashboard", "/notifications", "/items", "/forecast", "/orders", "/extra-demand", "/sales-orders", "/sales-orders/customers", "/schedule"]);
  });
  it("admin sees admin menus", () => {
    const hrefs = menuForRole("admin").map(m => m.href);
    expect(hrefs).toContain("/admin/settings");
    expect(hrefs).toContain("/upload");
    expect(hrefs).toContain("/approvals");
  });
  it("groups hide empty and put admin at bottom", () => {
    const g = menuGroupsForRole("sales");
    expect(g.map(x => x.key)).toEqual(["status", "plan", "ops"]);
    const a = menuGroupsForRole("admin");
    expect(a.map(x => x.key)).toEqual(["status", "plan", "ops", "approve", "data", "admin"]);
    expect(a.find(x => x.key === "admin")?.bottom).toBe(true);
    expect(menuGroupsForRole("biz_enable").find(x => x.key === "ops")?.items.map(i => i.href)).toContain("/allocation/priority");
    expect(menuForRole("biz_enable").map(m => m.href)).toContain("/allocation/force");        // 강제배정 (R-AL-53)
    expect(menuForRole("sales").map(m => m.href)).not.toContain("/allocation/force");
    expect(menuForRole("admin").map(m => m.href)).toEqual(expect.arrayContaining(["/admin/customers", "/admin/item-groups"]));
  });
  it("item_manager sees item-settings but not system settings", () => {
    const hrefs = menuForRole("item_manager").map(m => m.href);
    expect(hrefs).toContain("/admin/item-settings");
    expect(hrefs).not.toContain("/admin/settings");
  });
});
