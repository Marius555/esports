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
import type { Question } from "@/app/api/tournament/[game]/route"

interface UserAnswer {
  $id: string
  userId: string
  questionId: string
  tournamentId: string
  answer: boolean
}

const GAME_LABEL: Record<string, string> = {
  dota2: "Dota 2",
  leagueoflegends: "League of Legends",
  counterstrike: "CS2",
}

const GAME_COLOR: Record<string, string> = {
  dota2: "#e84c21",
  leagueoflegends: "#C89B3C",
  counterstrike: "#f5a623",
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function StatusBadge({
  userAnswer,
  correctAnswer,
}: {
  userAnswer: boolean | undefined
  correctAnswer: boolean | null | undefined
}) {
  if (userAnswer === undefined) {
    return (
      <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted/50">
        No answer
      </span>
    )
  }

  if (correctAnswer === null || correctAnswer === undefined) {
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
  if (!token) redirect("/login")

  const session = await verifyToken(token)
  if (!session || session.userId !== id) redirect("/login")

  const { tablesDB } = createAdminClient()

  // Fetch questions and user answers in parallel
  const [questionsRes, answersRes] = await Promise.all([
    tablesDB.listRows({
      databaseId: DB_ID,
      tableId: QUESTIONS_TABLE_ID,
      queries: [Query.equal("tournamentId", tournamentId), Query.limit(50)],
    }),
    tablesDB.listRows({
      databaseId: DB_ID,
      tableId: USER_ANSWERS_TABLE_ID,
      queries: [
        Query.equal("userId", session.userId),
        Query.equal("tournamentId", tournamentId),
        Query.limit(50),
      ],
    }),
  ])

  const questions = questionsRes.rows as unknown as Question[]
  const answers = answersRes.rows as unknown as UserAnswer[]

  const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]))

  const game = questions[0]?.game ?? ""
  const accent = GAME_COLOR[game] ?? "#888"

  const total = questions.length
  const resolved = questions.filter(
    (q) => q.correctAnswer !== null && q.correctAnswer !== undefined
  ).length
  const correct = questions.filter((q) => {
    const ua = answerMap.get(q.$id)
    return (
      ua !== undefined &&
      q.correctAnswer !== null &&
      q.correctAnswer !== undefined &&
      ua === q.correctAnswer
    )
  }).length
  const wrong = resolved - correct

  return (
    <div className="[--header-height:3.5rem]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar userId={session.userId} user={{ name: session.username, email: "" }} />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-5 p-4">
              {/* Back link + heading */}
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

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total", value: total, color: "text-foreground" },
                  { label: "Correct", value: correct, color: "text-green-500" },
                  { label: "Wrong", value: wrong, color: "text-red-500" },
                  { label: "Pending", value: total - resolved, color: "text-muted-foreground" },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-xl border bg-card p-3 flex flex-col gap-0.5"
                  >
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={`text-2xl font-bold tabular-nums ${color}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Questions table */}
              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                {questions.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                    No questions found for this tournament.
                  </div>
                ) : (
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
                      {questions.map((q, i) => {
                        const userAnswer = answerMap.get(q.$id)
                        return (
                          <TableRow key={q.$id} className="hover:bg-muted/20">
                            <TableCell className="text-xs text-muted-foreground tabular-nums">
                              {i + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-sm text-foreground leading-snug whitespace-normal">
                                  {q.questionText}
                                </span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                  {q.referenceType} · {q.referenceName}
                                  {q.matchScheduledAt ? (
                                    <> · match on {formatDate(q.matchScheduledAt)}</>
                                  ) : q.resolveBy ? (
                                    <> · resolves {formatDate(q.resolveBy)}</>
                                  ) : null}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {userAnswer !== undefined ? (
                                <AnswerChip answer={userAnswer} />
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {q.correctAnswer !== null && q.correctAnswer !== undefined ? (
                                <AnswerChip answer={q.correctAnswer} />
                              ) : (
                                <span className="text-xs text-muted-foreground">Pending</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <StatusBadge
                                userAnswer={userAnswer}
                                correctAnswer={q.correctAnswer}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}
