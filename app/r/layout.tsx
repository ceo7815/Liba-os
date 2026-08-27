export default function PublicReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-[#F4F1EA]">{children}</div>;
}
