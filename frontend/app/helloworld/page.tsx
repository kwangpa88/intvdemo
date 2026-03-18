'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function HelloWorldPage() {
    const [message, setMessage] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchHello = async () => {
        setLoading(true)
        setError(null)
        setMessage(null)
        try {
            const res = await fetch('/api/hello')
            if (!res.ok) throw new Error(`서버 오류: ${res.status}`)
            const data: { message: string } = await res.json()
            setMessage(data.message)
        } catch (err) {
            setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-background gap-8">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold tracking-tight text-foreground">Hello World Demo</h1>
                <p className="text-muted-foreground text-sm">
                    버튼을 클릭하면 백엔드 API를 호출합니다.
                </p>
            </div>

            <Button onClick={fetchHello} disabled={loading} size="lg">
                {loading ? '로딩 중...' : 'API 호출하기'}
            </Button>

            {message && (
                <div className="px-8 py-5 rounded-xl border bg-primary/10 border-primary/30 text-center shadow-sm">
                    <p className="text-2xl font-semibold text-primary">{message}</p>
                </div>
            )}

            {error && (
                <div className="px-8 py-5 rounded-xl border bg-destructive/10 border-destructive/30 text-center shadow-sm">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            )}
        </main>
    )
}
