import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Camera Animation Tool',
  description: 'Create camera animations for 3D models',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
