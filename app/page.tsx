import type { Metadata } from "next";
import FamilyApp from "./components/FamilyApp";

export const metadata: Metadata = {
  title: "함께가정 | 사전·사후 진단",
  description: "함께카드로 우리 가족의 역할을 살펴보고 30일의 변화를 기록합니다.",
};

export default function Home() {
  return <FamilyApp />;
}
