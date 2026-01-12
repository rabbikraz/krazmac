import { AdminSidebar } from '@/components/AdminSidebar'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen w-full">
            <AdminSidebar />
            <main className="flex-1 flex flex-col min-h-screen bg-background">
                <div className="flex-1 p-4 md:p-6 lg:p-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
