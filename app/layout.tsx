import React from 'react';

export const metadata = {
  title: 'Research Compass V24',
  description: 'AI-driven Research Analysis',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            tailwind.config = {
              darkMode: 'class',
              theme: {
                extend: {
                  colors: {
                    primary: {
                      50: '#f0f9ff',
                      100: '#e0f2fe',
                      500: '#0ea5e9',
                      600: '#0284c7',
                      700: '#0369a1',
                    }
                  }
                }
              }
            }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}