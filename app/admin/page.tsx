import type { Metadata } from "next";
import AdminApp from "../components/AdminApp";

export const metadata: Metadata = {
  title: "관리자 | 반반한 가정",
  description: "반반한 가정 참여 현황과 집안일 카드 관리",
};

export default function AdminPage() {
  return <AdminApp />;
}
