import type { Metadata } from "next";
import FamilyApp from "./components/FamilyApp";

export const metadata: Metadata = {
  title: "반반한 가정 | 우리집 워크북",
  description: "집안일도 마음도 반반하게 나누는 전남광주통합특별시 가족실천 워크북",
};

export default function Home() {
  return <FamilyApp />;
}
