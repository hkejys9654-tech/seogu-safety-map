import type { Metadata } from "next";
import AdminApp from "../components/AdminApp";

export const metadata: Metadata = {
  title: "함께가정 관리자",
  description: "가정별 사전·사후 응답과 진행 현황을 확인합니다.",
};

export default function AdminPage() {
  return <AdminApp />;
}
