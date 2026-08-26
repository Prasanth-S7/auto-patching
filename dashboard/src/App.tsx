import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Activity, CheckCircle2, CircleDot, RefreshCw, Search, Server, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Workflow = 'sanity_reboot' | 'patch'
type Stage = { status?: string; updatedAt?: string; [key: string]: unknown }
type Report = {
  host: string
  runId: string
  workflow: Workflow
  status?: string
  currentStage?: string
  stages?: Record<string, Stage>
  startedAt?: string
  updatedAt?: string
  [key: string]: unknown
}

const lambdaApiUrl = (import.meta.env.VITE_LAMBDA_API_URL ?? 'https://qugbbgezz4.execute-api.ap-south-1.amazonaws.com').replace(/\/$/, '')
const endpoints: Record<Workflow, string> = {
  sanity_reboot: `${lambdaApiUrl}/sanity-reboot-status`,
  patch: `${lambdaApiUrl}/patch-status`,
}

const workflowLabels: Record<Workflow, string> = {
  sanity_reboot: 'Sanity reboot',
  patch: 'Patch',
}

const formatDate = (value?: string) => value ? new Date(value).toLocaleString() : '—'
const formatStage = (value: string) => value.replaceAll('_', ' ')

function StatusBadge({ status = 'pending' }: { status?: string }) {
  const normalized = status.toLowerCase()
  const variant = normalized === 'failed' ? 'destructive' : normalized === 'completed' || normalized === 'success' ? 'secondary' : 'outline'
  return <Badge variant={variant}>{normalized === 'in_progress' ? <CircleDot data-icon="inline-start" /> : normalized === 'failed' ? <XCircle data-icon="inline-start" /> : <CheckCircle2 data-icon="inline-start" />}{formatStage(normalized)}</Badge>
}

function App() {
  const [workflow, setWorkflow] = useState<Workflow>('sanity_reboot')
  const [reports, setReports] = useState<Report[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadReports = useCallback(() => {
    setLoading(true)
    setError('')
    fetch(`${endpoints[workflow]}?t=${Date.now()}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load ${workflowLabels[workflow].toLowerCase()} reports.`)
        return response.json() as Promise<Report[]>
      })
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch((loadError: Error) => { setReports([]); setError(loadError.message) })
      .finally(() => setLoading(false))
  }, [workflow])

  useEffect(() => {
    const timer = window.setTimeout(loadReports, 0)
    return () => window.clearTimeout(timer)
  }, [loadReports])

  const runs = useMemo(() => Array.from(new Map(reports.map((report) => [report.runId, report])).values()).sort((a, b) => {
    const dateDifference = new Date(b.startedAt ?? b.runId).getTime() - new Date(a.startedAt ?? a.runId).getTime()
    return Number.isNaN(dateDifference) ? b.runId.localeCompare(a.runId) : dateDifference
  }), [reports])
  const activeRunId = runs.some((run) => run.runId === selectedRunId) ? selectedRunId : runs[0]?.runId || ''
  const selectedReports = useMemo(() => reports.filter((report) => report.runId === activeRunId).filter((report) => {
    const term = query.trim().toLowerCase()
    return !term || report.host.toLowerCase().includes(term)
  }), [reports, activeRunId, query])
  const stageNames = runs.find((run) => run.runId === activeRunId)?.stages ? Object.keys(runs.find((run) => run.runId === activeRunId)?.stages ?? {}) : []
  const selectedRun = runs.find((run) => run.runId === activeRunId)
  const successful = selectedReports.filter((report) => report.status === 'completed').length

  return (
    <main className="min-h-screen bg-muted/30">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Execution dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a workflow and inspect host progress and stage results.
          </p>
        </div>

        <Card>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Workflow
              </label>
              <Select
                value={workflow}
                onValueChange={(value) => {
                  if (value) setWorkflow(value as Workflow);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sanity_reboot">Sanity reboot</SelectItem>
                  <SelectItem value="patch">Patch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Run
              </label>
              <Select
                value={activeRunId}
                onValueChange={(value) => setSelectedRunId(value ?? '')}
                disabled={runs.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      runs.length ? 'Select a run' : 'No runs available'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((run, index) => (
                    <SelectItem key={run.runId} value={run.runId}>
                      {index === 0 ? 'Latest · ' : ''}
                      {run.runId} · {formatDate(run.startedAt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <XCircle />
                  </EmptyMedia>
                  <EmptyTitle>Unable to load reports</EmptyTitle>
                  <EmptyDescription>{error}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : !selectedRun ? (
          <Card>
            <CardContent>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Server />
                  </EmptyMedia>
                  <EmptyTitle>No runs available</EmptyTitle>
                  <EmptyDescription>
                    Run the selected Ansible workflow to create a report.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="border-b sm:flex sm:items-center sm:justify-between">
                <div>
                  <CardTitle>{workflowLabels[workflow]} results</CardTitle>
                  <CardDescription>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                      {activeRunId}
                    </code>{' '}
                    · Started {formatDate(selectedRun.startedAt)}
                  </CardDescription>
                </div>
                <div>
                  <Button variant="outline" size="sm" onClick={loadReports}>
                    <RefreshCw data-icon="inline-start" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex p-4">
                  <div className="relative w-full max-w-sm">
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Filter hosts"
                    />
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Host</TableHead>
                      <TableHead>Overall status</TableHead>
                      <TableHead>Current stage</TableHead>
                      {stageNames.map((stage) => (
                        <TableHead key={stage}>{formatStage(stage)}</TableHead>
                      ))}
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedReports.map((report) => (
                      <TableRow key={report.host}>
                        <TableCell className="font-medium">
                          {report.host}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={report.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatStage(report.currentStage ?? 'pending')}
                        </TableCell>
                        {stageNames.map((stage) => (
                          <TableCell key={stage}>
                            <StatusBadge status={report.stages?.[stage]?.status} />
                          </TableCell>
                        ))}
                        <TableCell className="text-muted-foreground">
                          {formatDate(report.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {selectedReports.length === 0 && (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Search />
                      </EmptyMedia>
                      <EmptyTitle>No hosts found</EmptyTitle>
                      <EmptyDescription>
                        No hosts match your filter.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
              <CardFooter className="border-t text-xs text-muted-foreground">
                Showing{' '}
                <strong className="mx-1 text-foreground">
                  {selectedReports.length}
                </strong>{' '}
                hosts · {successful} completed
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Selected run data</CardTitle>
                <CardDescription>
                  Complete report payload returned by the Lambda endpoint.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs leading-5">
                  {JSON.stringify(selectedReports, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) { return <Card><CardContent className="flex items-center gap-3 p-4"><div className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div><div><p className="text-xs text-muted-foreground">{label}</p><p className="font-heading text-lg font-semibold capitalize">{value}</p></div></CardContent></Card> }

export default App
