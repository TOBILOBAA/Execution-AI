export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(0,108,74,0.08), transparent 30%), linear-gradient(180deg, #f4f6f4 0%, #eef3ef 100%)",
      }}
    >
      {children}
    </div>
  );
}
