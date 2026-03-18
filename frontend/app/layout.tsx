import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Intv Demo',
    description: 'Hello World Demo App',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ko">
            <body>{children}</body>
        </html>
    )
}
