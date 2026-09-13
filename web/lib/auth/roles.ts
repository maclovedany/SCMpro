export type Role = "item_manager" | "scm_lead" | "sales" | "marketing" | "service" | "biz_enable" | "admin";
export const ROLE_LABEL: Record<Role, string> = {
  item_manager: "SCM 품목담당자", scm_lead: "SCM팀장", sales: "영업부", marketing: "마케팅부",
  service: "서비스부", biz_enable: "사업강화부", admin: "관리자",
};
export const ALL: Role[] = ["item_manager", "scm_lead", "sales", "marketing", "service", "biz_enable", "admin"];
const SCM: Role[] = ["item_manager", "scm_lead", "admin"];
const MASTER: Role[] = ["item_manager", "admin"];
export type MenuItem = { href: string; label: string; icon: string; roles: Role[]; badge?: "approvals" | "unread" };
export type MenuGroup = { key: string; label: string; items: MenuItem[]; bottom?: boolean };
/** 사이드바 그룹 (R-UI-11): 업무 흐름 기준 6그룹 고정. 새 화면은 반드시 여기 배속. 역할별로 항목을 거르고 빈 그룹은 숨긴다 */
export const MENU_GROUPS: MenuGroup[] = [
  { key: "status", label: "현황", items: [
    { href: "/dashboard", label: "대시보드", icon: "LayoutDashboard", roles: ALL },
    { href: "/notifications", label: "알림", icon: "Bell", roles: ALL, badge: "unread" },
  ] },
  { key: "plan", label: "계획", items: [
    { href: "/items", label: "품목", icon: "Package", roles: ALL },
    { href: "/forecast", label: "예측", icon: "TrendingUp", roles: ALL },
    { href: "/orders", label: "발주 계획", icon: "ClipboardList", roles: ALL },
    { href: "/extra-demand", label: "추가 수요", icon: "PlusSquare", roles: ALL },
  ] },
  { key: "ops", label: "운영", items: [
    { href: "/sales-orders", label: "영업 주문", icon: "ShoppingCart", roles: ALL },
    { href: "/allocation", label: "재고 배정", icon: "Boxes", roles: SCM },
    { href: "/allocation/priority", label: "배정 우선순위", icon: "ListOrdered", roles: ["biz_enable", "scm_lead", "admin"] },
    { href: "/schedule", label: "일정·제출", icon: "CalendarClock", roles: ALL },
  ] },
  { key: "approve", label: "결재", items: [
    { href: "/approvals", label: "승인함", icon: "CheckSquare", roles: SCM, badge: "approvals" },
  ] },
  { key: "data", label: "데이터", items: [
    { href: "/upload", label: "데이터 업로드", icon: "Upload", roles: SCM },
    { href: "/admin/item-settings", label: "품목 설정", icon: "SlidersHorizontal", roles: MASTER },
    { href: "/admin/forecast-methods", label: "예측 기법", icon: "FlaskConical", roles: MASTER },
  ] },
  { key: "admin", label: "관리", bottom: true, items: [
    { href: "/admin/settings", label: "시스템 설정", icon: "Settings", roles: ["admin"] },
    { href: "/admin/suppliers", label: "공급처", icon: "Truck", roles: MASTER },
    { href: "/admin/holidays", label: "공휴일", icon: "Calendar", roles: MASTER },
    { href: "/admin/eol", label: "EOL/EOS", icon: "Clock", roles: MASTER },
    { href: "/admin/ai-stats", label: "AI 질문 통계", icon: "BarChart3", roles: ["admin"] },
  ] },
];
/** 역할별 그룹 (빈 그룹 제외) */
export function menuGroupsForRole(role: Role): MenuGroup[] {
  return MENU_GROUPS.map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(role)) })).filter(g => g.items.length > 0);
}
/** 역할별 평면 메뉴 (접근 검사·테스트용) */
export function menuForRole(role: Role): MenuItem[] { return menuGroupsForRole(role).flatMap(g => g.items); }
export const canWriteMaster = (r: Role) => r === "admin" || r === "item_manager";
export const canApprove = (r: Role) => r === "admin" || r === "scm_lead";
export const canUpload = (r: Role) => r === "admin" || r === "item_manager" || r === "scm_lead";
export function canAccessPath(role: Role, pathname: string): boolean {
  return menuForRole(role).some(m => pathname === m.href || pathname.startsWith(m.href + "/")) || pathname.startsWith("/items/");
}
