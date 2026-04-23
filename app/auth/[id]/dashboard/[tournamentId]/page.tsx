import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import Link from "next/link"
import { verifyToken } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  createAdminClient,
  DB_ID,
  QUESTIONS_TABLE_ID,
  USER_ANSWERS_TABLE_ID,
  KNOWLEDGE_QUESTIONS_TABLE_ID,
  USER_ROUND_ASSIGNMENTS_TABLE_ID,
  Query,
} from "@/lib/appwrite"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Question, UserRoundAssignment } from "@/app/api/tournament/[game]/route"
import { RefreshOnMount } from "@/components/refresh-on-mount"

interface UserAnswer {
  $id: string
  userId: string
  questionId: string
  tournamentId: string
  answer: boolean
}

interface KnowledgeQuestion {
  $id: string
  questionText: string
  correctAnswer: boolean
  category: string
  difficulty: string
}

interface DisplayQuestion {
  id: string
  questionText: string
  referenceType: string
  referenceName: string
  matchScheduledAt?: string | null
  resolveBy?: string
  correctAnswer: boolean | null
  userAnswer: boolean | undefined
}

interface RoundData {
  roundNumber: number
  roundType: "skill" | "esports"
  questions: DisplayQuestion[]
}

const GAME_LABEL: Record<string, string> = {
  dota2: "Dota 2",
  valorant: "Valorant",
  counterstrike: "CS2",
}

const GAME_COLOR: Record<string, string> = {
  dota2: "#e84c21",
  valorant: "#FF4655",
  counterstrike: "#f5a623",
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function StatusBadge({
  userAnswer,
  correctAnswer,
}: {
  userAnswer: boolean | undefined
  correctAnswer: boolean | null
}) {
  if (userAnswer === undefined) {
    return (
      <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted/50">
        No answer
      </span>
    )
  }
  if (correctAnswer === null) {
    return (
      <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted/50">
        ⏳ Pending
      </span>
    )
  }
  const isCorrect = userAnswer === correctAnswer
  return isCorrect ? (
    <span className="text-xs font-semibold text-green-500 px-2 py-0.5 rounded bg-green-500/10">
      ✓ Correct
    </span>
  ) : (
    <span className="text-xs font-semibold text-red-500 px-2 py-0.5 rounded bg-red-500/10">
      ✗ Wrong
    </span>
  )
}

function AnswerChip({ answer }: { answer: boolean }) {
  return answer ? (
    <span className="text-xs font-bold text-green-400">YES</span>
  ) : (
    <span className="text-xs font-bold text-red-400">NO</span>
  )
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string; tournamentId: string }>
}) {
  const { id, tournamentId } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get("esports_session")?.value
  if (!token) redirect("/")

  const session = await verifyToken(token)
  if (!session || session.userId !== id) redirect("/")

  const { tablesDB } = createAdminClient()

  // Fetch assignments and answers in parallel
  const [assignmentsRes, answersRes] = await Promise.all([
    tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USER_ROUND_ASSIGNMENTS_TABLE_ID,
      queries: [
        Query.equal("userId", session.userId),
        Query.equal("tournamentId", tournamentId),
        Query.orderAsc("roundNumber"),
        Query.limit(50),
      ],
    }).catch(() => null),
    tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USER_ANSWERS_TABLE_ID,
      queries: [
        Query.equal("userId", session.userId),
        Query.equal("tournamentId", tournamentId),
        Query.limit(500),
      ],
    }).catch(() => null),
  ])

  const assignments = (assignmentsRes?.rows ?? []) as unknown as UserRoundAssignment[]
  const answers = (answersRes?.rows ?? []) as unknown as UserAnswer[]
  const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]))

  // Fetch questions for each round from the correct table
  const rounds: RoundData[] = []

  for (const assignment of assignments) {
    let ids: string[] = []
    try {
      ids = JSON.parse(assignment.questionIds) as string[]
    } catch {
      continue
    }

    if (assignment.roundType === "skill") {
      const kqRes = await tablesDB.listRows({
        databaseId: DB_ID,
        tableId: KNOWLEDGE_QUESTIONS_TABLE_ID,
        queries: [Query.equal("$id", ids), Query.limit(ids.length + 5)],
      }).catch(() => null)

      const kqMap = new Map(
        ((kqRes?.rows ?? []) as unknown as KnowledgeQuestion[]).map((q) => [q.$id, q])
      )

      rounds.push({
        roundNumber: assignment.roundNumber,
        roundType: "skill",
        questions: ids.map((qid) => {
          const kq = kqMap.get(qid)
          return {
            id: qid,
            questionText: kq?.questionText ?? "—",
            referenceType: "knowledge",
            referenceName: kq?.category ?? "",
            matchScheduledAt: null,
            resolveBy: undefined,
            correctAnswer: kq?.correctAnswer ?? null,
            userAnswer: answerMap.get(qid),
          }
        }),
      })
    } else {
      const qRes = await tablesDB.listRows({
        databaseId: DB_ID,
        tableId: QUESTIONS_TABLE_ID,
        queries: [Query.equal("$id", ids), Query.limit(ids.length + 5)],
      }).catch(() => null)

      const qMap = new Map(
        ((qRes?.rows ?? []) as unknown as Question[]).map((q) => [q.$id, q])
      )

      rounds.push({
        roundNumber: assignment.roundNumber,
        roundType: "esports",
        questions: ids.map((qid) => {
          const q = qMap.get(qid)
          return {
            id: qid,
            questionText: q?.questionText ?? "—",
            referenceType: q?.referenceType ?? "esports",
            referenceName: q?.referenceName ?? "",
            matchScheduledAt: q?.matchScheduledAt,
            resolveBy: q?.resolveBy,
            correctAnswer: q?.correctAnswer ?? null,
            userAnswer: answerMap.get(qid),
          }
        }),
      })
    }
  }

  const game = tournamentId.split("-")[0]
  const accent = GAME_COLOR[game] ?? "#888"

  // Compute aggregate stats across all rounds
  const allQuestions = rounds.flatMap((r) => r.questions)
  const total = allQuestions.length
  const correct = allQuestions.filter(
    (q) => q.userAnswer !== undefined && q.correctAnswer !== null && q.userAnswer === q.correctAnswer
  ).length
  const wrong = allQuestions.filter(
    (q) => q.userAnswer !== undefined && q.correctAnswer !== null && q.userAnswer !== q.correctAnswer
  ).length
  const pending = allQuestions.filter((q) => q.correctAnswer === null).length

  return (
    <div className="[--header-height:3.5rem]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar userId={session.userId} user={{ email: session.email, tier: session.tier }} />
          <SidebarInset>
            <RefreshOnMount />
            <div className="flex flex-1 flex-col gap-5 p-4">
              {/* Back + heading */}
              <div className="flex flex-col gap-1">
                <Link
                  href={`/auth/${id}/dashboard`}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
                  Back to Dashboard
                </Link>
                <div className="flex items-center gap-3 mt-1">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
                  />
                  <h1 className="font-heading font-bold text-xl tracking-tight">
                    {tournamentId}
                  </h1>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded"
                    style={{ background: accent + "22", color: accent }}
                  >
                    {GAME_LABEL[game] ?? game}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total", value: total, color: "text-foreground" },
                  { label: "Correct", value: correct, color: "text-green-500" },
                  { label: "Wrong", value: wrong, color: "text-red-500" },
                  { label: "Pending", value: pending, color: "text-muted-foreground" },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-xl border bg-card p-3 flex flex-col gap-0.5"
                  >
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Rounds */}
              {rounds.length === 0 ? (
                <div className="rounded-2xl border bg-card flex items-center justify-center py-12 text-muted-foreground text-sm">
                  No rounds completed yet.
                </div>
              ) : (
                rounds.map((round) => (
                  <div key={round.roundNumber} className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                    {/* Round header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Round {round.roundNumber}
                      </span>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={
                          round.roundType === "skill"
                            ? { background: "rgba(34,211,238,0.12)", color: "#22d3ee" }
                            : { background: "rgba(168,85,247,0.12)", color: "#a855f7" }
                        }
                      >
                        {round.roundType === "skill" ? "Knowledge" : "Forecasting"}
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>Question</TableHead>
                          <TableHead className="w-24 text-center">Your Answer</TableHead>
                          <TableHead className="w-28 text-center">Correct Answer</TableHead>
                          <TableHead className="w-28 text-center">Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {round.questions.map((q, i) => (
                          <TableRow key={q.id} className="hover:bg-muted/20">
                            <TableCell className="text-xs text-muted-foreground tabular-nums">
                              {i + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-sm text-foreground leading-snug whitespace-normal">
                                  {q.questionText}
                                </span>
                                {(q.referenceName || q.matchScheduledAt || q.resolveBy) && (
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                    {q.referenceName}
                                    {q.matchScheduledAt ? (
                                      <> · match on {formatDate(q.matchScheduledAt)}</>
                                    ) : q.resolveBy ? (
                                      <> · resolves {formatDate(q.resolveBy)}</>
                                    ) : null}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {q.userAnswer !== undefined ? (
                                <AnswerChip answer={q.userAnswer} />
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {q.correctAnswer !== null ? (
                                <AnswerChip answer={q.correctAnswer} />
                              ) : (
                                <span className="text-xs text-muted-foreground">Pending</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <StatusBadge
                                userAnswer={q.userAnswer}
                                correctAnswer={q.correctAnswer}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))
              )}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}
