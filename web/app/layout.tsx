export const metadata = {
  title: 'Toyota Kiosk & Queue Console',
  description: 'Internal MVP for Toyota Kiosk / Queue System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f4f6f8' }}>
        {children}
      </body>
    </html>
  );
}
