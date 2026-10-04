import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}