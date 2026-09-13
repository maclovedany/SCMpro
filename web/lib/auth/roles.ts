export type Role = "item_manager" | "scm_lead" | "sales" | "marketing" | "service" | "biz_enable" | "admin";
export const ROLE_LABEL: Record<Role, string> = {
  item_manager: "SCM 품목담당자", scm_lead: "SCM팀장", sales: "영업부", marketing: "마케팅부",
  service: "서비스부", biz_enable: "사업강화부", admin: "관리자",
};
export type MenuItem = { href: string; label: string; icon: string };
const COMMON: MenuItem[] = [
  { href: "/dashboard", label: "대시보드", icon: "LayoutDashboard" },
  { href: "/items", label: "품목", icon: "Package" },
  { href: "/forecast", label: "예측", icon: "TrendingUp" },
  { href: "/orders", label: "발주 계획", icon: "ClipboardList" },
  { href: "/extra-demand", label: "추가 수요", icon: "PlusSquare" },
  { href: "/sales-orders", label: "영업 주문", icon: "ShoppingCart" },
  { href: "/notifications", label: "알림", icon: "Bell" },
];
const BIZ: MenuItem[] = [{ href: "/allocation/priority", label: "배정 우선순위", icon: "ListOrdered" }];
const SCM: MenuItem[] = [
  { href: "/allocation", label: "재고 배정", icon: "Boxes" },
  { href: "/allocation/priority", label: "배정 우선순위", icon: "ListOrdered" },
  { href: "/upload", label: "데이터 업로드", icon: "Upload" },
  { href: "/approvals", label: "승인함", icon: "CheckSquare" },
  { href: "/admin/item-settings", label: "품목 설정", icon: "SlidersHorizontal" },
  { href: "/admin/forecast-methods", label: "예측 기법", icon: "FlaskConical" },
];
const ADMIN: MenuItem[] = [
  { href: "/admin/settings", label: "시스템 설정", icon: "Settings" },
  { href: "/admin/suppliers", label: "공급처", icon: "Truck" },
  { href: "/admin/holidays", label: "공휴일", icon: "Calendar" },
  { href: "/admin/eol", label: "EOL/EOS", icon: "Clock" },
];
export function menuForRole(role: Role): MenuItem[] {
  if (role === "admin") return [...COMMON, ...SCM, ...ADMIN];
  if (role === "scm_lead" || role === "item_manager") return [...COMMON, ...SCM];
  if (role === "biz_enable") return [...COMMON, ...BIZ];
  return COMMON;
}
export const canWriteMaster = (r: Role) => r === "admin" || r === "item_manager";
export const canApprove = (r: Role) => r === "admin" || r === "scm_lead";
export const canUpload = (r: Role) => r === "admin" || r === "item_manager" || r === "scm_lead";
/** 경로 접근 허용 여부 (proxy·레이아웃 공용) */
export function canAccessPath(role: Role, pathname: string): boolean {
  return menuForRole(role).some(m => pathname === m.href || pathname.startsWith(m.href + "/")) || pathname.startsWith("/items/");
}
