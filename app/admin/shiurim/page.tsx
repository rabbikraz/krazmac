import Link from 'next/link'
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react"
import { getDb, getD1Database } from "@/lib/db"
import { shiurim as shiurimSchema } from "@/lib/schema"
import { desc } from "drizzle-orm"
import { safeISOString, formatDate } from "@/lib/utils"

// Mock data until DB connection is verified locally
const mockShiurim = [
    { id: 1, title: 'Parshas Vayigash', series: 'Parsha Hashavua', date: '2024-01-04', views: 124 },
    { id: 2, title: 'Bitachon Series 14', series: 'Bitachon', date: '2024-01-02', views: 89 },
    { id: 3, title: 'Chanukah Outlook', series: 'Chanukah', date: '2023-12-10', views: 342 },
]

export default async function ShiurimPage() {
    let shiurim = []
    try {
        const d1 = await getD1Database()
        if (d1) {
            const db = await getDb(d1)
            const rawShiurim = await db.select().from(shiurimSchema).orderBy(desc(shiurimSchema.date)).all()

            shiurim = rawShiurim.map((s: any) => ({
                ...s,
                date: safeISOString(s.date) || new Date().toISOString(),
                createdAt: safeISOString(s.createdAt),
                updatedAt: safeISOString(s.updatedAt)
            }))
        }
    } catch (e) {
        console.error("Failed to fetch shiurim for admin:", e)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Shiurim</h1>
                <Button asChild>
                    <Link href="/admin/shiurim/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Add New Shiur
                    </Link>
                </Button>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Series</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Views</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {shiurim.map((shiur: any) => (
                            <TableRow key={shiur.id}>
                                <TableCell className="font-medium">{shiur.title}</TableCell>
                                <TableCell>{shiur.series}</TableCell>
                                <TableCell>{formatDate(shiur.date)}</TableCell>
                                <TableCell>{shiur.views}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" asChild>
                                            <a href="#" target="_blank">
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </Button>
                                        <Button variant="ghost" size="icon">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
