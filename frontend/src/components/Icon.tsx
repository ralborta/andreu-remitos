import {
  FileText,
  Route,
  MapPin,
  TriangleAlert,
  ReceiptText,
  Clock,
  ClipboardCheck,
  MessageSquareWarning,
  ChartColumnBig,
  Radio,
  Navigation,
  Banknote,
  Scale,
  Megaphone,
  Wallet,
  Handshake,
  type LucideProps,
} from "lucide-react";

const MAP = {
  FileText,
  Route,
  MapPin,
  TriangleAlert,
  ReceiptText,
  Clock,
  ClipboardCheck,
  MessageSquareWarning,
  ChartColumnBig,
  Radio,
  Navigation,
  Banknote,
  Scale,
  Megaphone,
  Wallet,
  Handshake,
} as const;

export type IconName = keyof typeof MAP;

export function AgentIcon({
  name,
  ...props
}: { name: string } & LucideProps) {
  const Cmp = MAP[name as IconName] ?? FileText;
  return <Cmp {...props} />;
}
