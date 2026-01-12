import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Radio, Library, Users, Activity } from "lucide-react"

// Mock data for now, will replace with DB calls
async function getStats() {
  return [
    { name: "Total Shiurim", value: "120", icon: Radio, change: "+4 this week" },
    { name: "Total Series", value: "12", icon: Library, change: "+1 this month" },
    { name: "Active Users", value: "573", icon: Users, change: "+201 since last hour" },
    { name: "Total Plays", value: "45.2k", icon: Activity, change: "+19% from last month" },
  ]
}

export default async function AdminDashboard() {
  const stats = await getStats()

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {/* Placeholder for Chart */}
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Chart goes here
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {/* Placeholder for Activity Feed */}
              <div className="flex items-center">
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                </span>
                <p className="text-sm text-muted-foreground">New shiur uploaded: "Parshas Vayigash"</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

