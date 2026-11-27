'use client'

// DevFest "Play" games beside Match the shapes: Bug Hunt (tap the buggy line), Tech Sprint (a
// 60-second quiz) and Bit Flip (binary to a target number). Questions and code snippets are block
// fields, so they are edited in the admin page editor. Best scores stay on the device.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import { Gdg, area, shapePath, sfx, text, type AnyBlock } from './lib'

// ─── Shared ──────────────────────────────────────────────────────────────────

const readBest = (key: string) => {
  try {
    return Number(localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}
const saveBest = (key: string, score: number) => {
  const prev = readBest(key)
  if (score <= prev) return false
  try {
    localStorage.setItem(key, String(score))
  } catch {
    /* storage blocked */
  }
  return true
}
const shuffled = <T,>(a: T[]) =>
  a
    .map((x) => ({ x, r: Math.random() }))
    .sort((p, q) => p.r - q.r)
    .map(({ x }) => x)

/** Counts down once a second while `running`; calls `onEnd` at zero. */
function useCountdown(running: boolean, onEnd: () => void) {
  const [left, setLeft] = useState(0)
  const end = useRef(onEnd)
  end.current = onEnd
  useEffect(() => {
    if (!running) return
    const t = setInterval(
      () =>
        setLeft((s) => {
          if (s <= 1) {
            clearInterval(t)
            setTimeout(() => end.current(), 0)
            return 0
          }
          return s - 1
        }),
      1000
    )
    return () => clearInterval(t)
  }, [running])
  return [left, setLeft] as const
}

function Panel({
  id,
  tone,
  title,
  sub,
  stats,
  children,
}: {
  id: string
  tone: string
  title: string
  sub: string
  stats: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Gdg>
      <section id={id} className="block" aria-labelledby={`${id}-h`}>
        <div className={`game-panel ${tone}`}>
          <div className="game-head">
            <div>
              <h2 id={`${id}-h`}>{title}</h2>
              <p className="sub">{sub}</p>
            </div>
            <div className="game-stats">{stats}</div>
          </div>
          {children}
        </div>
      </section>
    </Gdg>
  )
}

// ─── Bug Hunt ────────────────────────────────────────────────────────────────

interface Snippet {
  lang: string
  why: string
  code: string[]
  bug: number
}

/** Snippets are separated by a line "---". First line "language | why it is a bug"; the buggy line starts with "!!". */
function parseSnippets(src: string): Snippet[] {
  return src
    .split(/^\s*---\s*$/m)
    .map((block) => block.replace(/^\n+|\n+$/g, '').split('\n'))
    .map(([head = '', ...rest]) => {
      const cut = head.indexOf('|')
      const code = rest.map((l) => l.replace(/\s+$/, ''))
      const bug = code.findIndex((l) => l.startsWith('!!'))
      return {
        lang: (cut >= 0 ? head.slice(0, cut) : head).trim(),
        why: cut >= 0 ? head.slice(cut + 1).trim() : '',
        code: code.map((l) => (l.startsWith('!!') ? l.slice(2) : l)),
        bug,
      }
    })
    .filter((s) => s.code.length > 1 && s.bug >= 0)
}

const BUGS = `javascript | "=" assigns instead of comparing, so every user passes as admin. Use "===".
function isAdmin(user) {
!!  if (user.role = 'admin') {
    return true
  }
  return false
}
---
python | The default list is made once and shared by every call, so tags pile up. Default to None and create the list inside.
!!def add_tag(tag, tags=[]):
    tags.append(tag)
    return tags
print(add_tag("ai"))
print(add_tag("web"))  # ['ai', 'web'] ?!
---
javascript | "<=" goes one step too far and reads scores[3], which is undefined, so the average is NaN. Use "<".
const scores = [90, 72, 85]
let total = 0
!!for (let i = 0; i <= scores.length; i++) {
  total += scores[i]
}
console.log(total / scores.length)
---
kotlin | name can be null, so name.length does not compile. Use name?.length ?: 0.
fun greet(name: String?) {
!!    val size = name.length
    println("Hello $name ($size letters)")
}
---
dart | Without await, user is a Future, not a User, so user.name fails. Write: final user = await fetchUser();
Future<void> showProfile() async {
!!  final user = fetchUser();
  print(user.name);
}
---
sql | WHERE runs before grouping, so it cannot use COUNT(*). Filter groups with HAVING after GROUP BY.
SELECT city, COUNT(*) AS members
FROM attendees
!!WHERE COUNT(*) > 50
GROUP BY city;
---
javascript | forEach does not wait for async callbacks, so "done" prints before anything is saved. Use for...of with await.
async function saveAll(items) {
!!  items.forEach(async (item) => {
    await save(item)
  })
  console.log('done')
}
---
go | range gives a copy of each player, so p.Score++ changes the copy only. Use players[i].Score++.
players := []Player{{"Asha", 1}, {"Ravi", 2}}
for _, p := range players {
!!    p.Score++
}
fmt.Println(players)
---
javascript | sort() compares items as text, so 10 comes before 3. Pass a compare function: ages.sort((a, b) => a - b).
const ages = [25, 3, 10]
!!ages.sort()
console.log(ages) // want [3, 10, 25]
---
python | You cannot add a number to a string, so this raises a TypeError. Use f"You are {age} years old".
age = 21
name = "Asha"
!!print("You are " + age + " years old")
print(f"Welcome, {name}")
---
html | The image has no alt text, so screen readers cannot describe it. Add alt="…".
<figure>
!!  <img src="/devfest.jpg">
  <figcaption>DevFest Vizag crowd</figcaption>
</figure>`

type BugProps = { title: string; sub: string; rounds: string; snippets: string }
const BUG_BEST = 'devfest-vizag-bughunt-best'

const GdgBugHunt: ComponentConfig<BugProps> = {
  label: 'GDG Bug Hunt Game',
  fields: {
    title: text('Title'),
    sub: area('Intro'),
    rounds: text('Rounds per game'),
    snippets: area(
      'Code snippets, separated by a line "---". First line: "language | why it is a bug". Mark the buggy line with !! at the start.'
    ),
  },
  defaultProps: {
    title: 'Bug hunt',
    sub: 'Each snippet has one bug. Tap the line with the bug, fast. Faster finds score more.',
    rounds: '6',
    snippets: BUGS,
  },
  render: function Render({ title, sub, rounds, snippets }) {
    const pool = useMemo(() => parseSnippets(snippets), [snippets])
    const total = Math.max(1, Math.min(pool.length, Number(rounds) || 6))
    const [deck, setDeck] = useState<Snippet[]>([])
    const [round, setRound] = useState(0)
    const [score, setScore] = useState(0)
    const [found, setFound] = useState(0)
    const [picked, setPicked] = useState<number | null>(null)
    const [best, setBest] = useState(0)
    const [msg, setMsg] = useState('')
    const started = useRef(0)

    const newGame = () => {
      setDeck(shuffled(pool).slice(0, total))
      setRound(0)
      setScore(0)
      setFound(0)
      setPicked(null)
      setMsg('')
      setBest(readBest(BUG_BEST))
      started.current = Date.now()
    }
    // Shuffle on the client only, so server and client markup match.
    useEffect(newGame, [pool, total])

    const s = deck[round]
    const over = round >= deck.length && deck.length > 0
    const pick = (i: number) => {
      if (!s || picked !== null) return
      setPicked(i)
      if (i === s.bug) {
        const secs = (Date.now() - started.current) / 1000
        const pts = 100 + Math.max(0, Math.round(50 - secs * 4))
        setScore((v) => v + pts)
        setFound((v) => v + 1)
        sfx('match')
        setMsg(`Got it, +${pts}. ${s.why}`)
      } else {
        sfx('flip')
        setMsg(`Not that one. The bug is on line ${s.bug + 1}. ${s.why}`)
      }
    }
    const next = () => {
      const n = round + 1
      setRound(n)
      setPicked(null)
      started.current = Date.now()
      if (n >= deck.length) {
        const record = saveBest(BUG_BEST, score)
        setBest(readBest(BUG_BEST))
        sfx('win')
        setMsg(
          `You found ${found} of ${deck.length} bugs for ${score} points.${record ? ' New best!' : ''}`
        )
      } else setMsg('')
    }

    return (
      <Panel
        id="bughunt"
        tone="tone-red"
        title={title}
        sub={sub}
        stats={
          <>
            <span>
              {over ? 'Done' : `Bug ${Math.min(round + 1, deck.length)} of ${deck.length}`}
            </span>
            <span>{`${score} pts`}</span>
            <span>{best ? `Best: ${best}` : 'Best: none yet'}</span>
            <button className="btn btn-sm btn-tonal" type="button" onClick={newGame}>
              New game
            </button>
          </>
        }
      >
        {s && !over ? (
          <div className="bug-card">
            <div className="bug-bar">
              <span className="bug-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>{s.lang}</span>
            </div>
            <ol
              className="bug-code"
              aria-label={`${s.lang} snippet. Choose the line with the bug.`}
            >
              {s.code.map((line, i) => {
                const state =
                  picked === null ? '' : i === s.bug ? ' is-bug' : i === picked ? ' is-wrong' : ''
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className={`bug-line${state}`}
                      disabled={picked !== null}
                      onClick={() => pick(i)}
                      aria-label={`Line ${i + 1}: ${line.trim() || 'blank'}`}
                    >
                      <span className="ln">{i + 1}</span>
                      <code>{line || ' '}</code>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        ) : null}
        <div className="game-foot">
          <p className="note" role="status">
            {msg}
          </p>
          {picked !== null && !over ? (
            <button className="btn btn-sm" type="button" onClick={next}>
              {round + 1 >= deck.length ? 'See score' : 'Next bug'}
            </button>
          ) : null}
          {over ? (
            <button className="btn btn-sm" type="button" onClick={newGame}>
              Play again
            </button>
          ) : null}
        </div>
      </Panel>
    )
  },
}

// ─── Tech Sprint (60-second quiz) ────────────────────────────────────────────

interface Question {
  q: string
  options: string[]
  answer: string
  fact: string
}

/** One per line: "Question | right answer | wrong | wrong | wrong | fact (optional, starts with i:)". */
function parseQuestions(src: string): Question[] {
  return src
    .split('\n')
    .map((l) => l.split('|').map((x) => x.trim()))
    .filter((c) => c.length >= 3 && c[0] && c[1])
    .map((c) => {
      const fact = c[c.length - 1]?.startsWith('i:') ? (c.pop() ?? '').slice(2).trim() : ''
      const [q = '', answer = '', ...wrong] = c
      return { q, answer, options: [answer, ...wrong.filter(Boolean)], fact }
    })
}

const QUESTIONS = `Which language are Flutter apps written in? | Dart | Kotlin | Swift | Go | i: Flutter apps are written in Dart.
Since 2019 Google calls Android development ... first. | Kotlin | Java | C++ | Python | i: Google announced Kotlin-first Android at I/O 2019.
Which company created the Go language? | Google | Mozilla | Microsoft | Meta
What is Chrome's JavaScript engine called? | V8 | SpiderMonkey | JavaScriptCore | Chakra
Which project did Google open-source in 2014 to run containers at scale? | Kubernetes | Docker | Terraform | Ansible
Gemma is ... | A family of open models from Google | A CSS framework | A Flutter widget | A database
Where can you try Gemini models in the browser? | Google AI Studio | Android Studio | Looker Studio | Cloud Shell
Cloud Firestore is a ... | NoSQL document database | Relational SQL database | Message queue | CDN
Jetpack Compose is a toolkit for ... | Android UI | Backend APIs | Machine learning | Databases
New Play Store apps are published as ... | Android App Bundles (.aab) | .ipa files | .exe files | .deb packages | i: New apps must use the App Bundle format since August 2021.
HTTP status 404 means ... | Not Found | Server error | Unauthorized | Moved permanently
HTTP status 418 is the joke status ... | I'm a teapot | Too many requests | Gone | Payment required | i: 418 comes from an April Fools' RFC from 1998.
HTTPS uses which port by default? | 443 | 80 | 8080 | 22
In JavaScript, typeof null is ... | "object" | "null" | "undefined" | "number" | i: A bug from the first version of JavaScript that was never changed.
In JavaScript, 0.1 + 0.2 === 0.3 is ... | false | true | NaN | an error | i: Floating point makes the sum 0.30000000000000004.
In Python, [1, 2, 3][-1] is ... | 3 | 1 | -1 | an error
Which Git command creates a branch and switches to it? | git switch -c | git branch -m | git merge | git stash
Which SQL clause filters groups after GROUP BY? | HAVING | WHERE | ORDER BY | LIMIT
Binary search on a sorted list takes ... | O(log n) | O(n) | O(n log n) | O(1)
JSON stands for ... | JavaScript Object Notation | Java Serialized Object Network | Joined Script Over Network | JavaScript Online Node
TensorFlow was first released by ... | Google | Meta | OpenAI | Microsoft
CSS stands for ... | Cascading Style Sheets | Computer Style Syntax | Creative Styling System | Colour Sheet Script`

type QuizProps = { title: string; sub: string; seconds: string; questions: string }
const QUIZ_BEST = 'devfest-vizag-sprint-best'

const GdgTechSprint: ComponentConfig<QuizProps> = {
  label: 'GDG Tech Sprint Quiz',
  fields: {
    title: text('Title'),
    sub: area('Intro'),
    seconds: text('Seconds per game'),
    questions: area(
      'Questions, one per line: "Question | right answer | wrong | wrong | wrong | i: fun fact (optional)"'
    ),
  },
  defaultProps: {
    title: 'Tech sprint',
    sub: 'Answer as many as you can in 60 seconds. Three right in a row doubles your points.',
    seconds: '60',
    questions: QUESTIONS,
  },
  render: function Render({ title, sub, seconds, questions }) {
    const pool = useMemo(() => parseQuestions(questions), [questions])
    const limit = Math.max(15, Math.min(300, Number(seconds) || 60))
    const [deck, setDeck] = useState<Question[]>([])
    const [i, setI] = useState(0)
    const [score, setScore] = useState(0)
    const [streak, setStreak] = useState(0)
    const [right, setRight] = useState(0)
    const [missed, setMissed] = useState<Question[]>([])
    const [flash, setFlash] = useState<{ pick: string; ok: boolean } | null>(null)
    const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready')
    const [best, setBest] = useState(0)
    const [record, setRecord] = useState(false)
    const scoreRef = useRef(0)
    scoreRef.current = score

    const finish = () => {
      setPhase('over')
      setRecord(saveBest(QUIZ_BEST, scoreRef.current))
      setBest(readBest(QUIZ_BEST))
      sfx('win')
    }
    const [left, setLeft] = useCountdown(phase === 'play', finish)
    useEffect(() => setBest(readBest(QUIZ_BEST)), [])

    const start = () => {
      setDeck(shuffled(pool).map((q) => ({ ...q, options: shuffled(q.options) })))
      setI(0)
      setScore(0)
      setStreak(0)
      setRight(0)
      setMissed([])
      setFlash(null)
      setRecord(false)
      setLeft(limit)
      setPhase('play')
      sfx('tick')
    }
    const q = deck[i]
    const mult = streak >= 3 ? 2 : 1
    const answer = (opt: string) => {
      if (!q || flash || phase !== 'play') return
      const ok = opt === q.answer
      setFlash({ pick: opt, ok })
      if (ok) {
        setScore((v) => v + 10 * mult)
        setStreak((v) => v + 1)
        setRight((v) => v + 1)
        sfx('match')
      } else {
        setStreak(0)
        setMissed((m) => [...m, q])
        sfx('flip')
      }
      setTimeout(
        () => {
          setFlash(null)
          if (i + 1 >= deck.length) finish()
          else setI(i + 1)
        },
        ok ? 450 : 900
      )
    }

    return (
      <Panel
        id="sprint"
        tone="tone-blue"
        title={title}
        sub={sub}
        stats={
          <>
            <span>{phase === 'play' ? `${left}s left` : `${limit}s`}</span>
            <span>{`${score} pts`}</span>
            {phase === 'play' && mult > 1 ? <span className="hot">x2 streak</span> : null}
            <span>{best ? `Best: ${best}` : 'Best: none yet'}</span>
          </>
        }
      >
        {phase === 'ready' ? (
          <div className="quiz-start">
            <p>{`${pool.length} questions on Google developer tech, the web and code.`}</p>
            <button className="btn" type="button" onClick={start}>
              Start the sprint
            </button>
          </div>
        ) : null}
        {phase === 'play' && q ? (
          <div className="quiz">
            <div className="quiz-time" aria-hidden="true">
              <i style={{ width: `${(left / limit) * 100}%` }} />
            </div>
            <p className="quiz-q" aria-live="polite">
              {q.q}
            </p>
            <div className="quiz-opts" role="group" aria-label="Answers">
              {q.options.map((o) => {
                const cls = !flash
                  ? ''
                  : o === q.answer
                    ? ' is-right'
                    : o === flash.pick
                      ? ' is-wrong'
                      : ''
                return (
                  <button
                    key={o}
                    type="button"
                    className={`quiz-opt${cls}`}
                    onClick={() => answer(o)}
                  >
                    {o}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
        {phase === 'over' ? (
          <div className="quiz-end">
            <p className="quiz-q">{`${score} points · ${right} right${record ? ' · New best!' : ''}`}</p>
            {missed.length ? (
              <ul className="quiz-review">
                {missed.slice(0, 6).map((m) => (
                  <li key={m.q}>
                    <b>{m.q}</b> {m.answer}
                    {m.fact ? <small>{m.fact}</small> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Clean run. Nothing missed.</p>
            )}
            <button className="btn" type="button" onClick={start}>
              Sprint again
            </button>
          </div>
        ) : null}
      </Panel>
    )
  },
}

// ─── Bit Flip ────────────────────────────────────────────────────────────────

type BitProps = { title: string; sub: string; seconds: string }
const BIT_BEST = 'devfest-vizag-bitflip-best'
const BIT_COLORS = ['#4285f4', '#ea4335', '#fbbc04', '#34a853']
const BIT_SHAPES: [number, number][] = [
  [8, 0.07],
  [5, 0.16],
  [6, 0.12],
  [4, 0.2],
]
const bitsFor = (solved: number) => (solved < 3 ? 4 : solved < 7 ? 6 : 8)
const newTarget = (n: number) => 1 + Math.floor(Math.random() * (2 ** n - 1))

const GdgBitFlip: ComponentConfig<BitProps> = {
  label: 'GDG Bit Flip Game',
  fields: { title: text('Title'), sub: area('Intro'), seconds: text('Seconds per game') },
  defaultProps: {
    title: 'Bit flip',
    sub: 'Flip the bits until they add up to the target number. Every hit adds 2 seconds, and the numbers grow.',
    seconds: '60',
  },
  render: function Render({ title, sub, seconds }) {
    const limit = Math.max(15, Math.min(300, Number(seconds) || 60))
    const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready')
    const [solved, setSolved] = useState(0)
    const [target, setTarget] = useState(0)
    const [on, setOn] = useState<boolean[]>([])
    const [best, setBest] = useState(0)
    const [record, setRecord] = useState(false)
    const [pop, setPop] = useState(false)
    const solvedRef = useRef(0)
    solvedRef.current = solved

    const finish = () => {
      setPhase('over')
      setRecord(saveBest(BIT_BEST, solvedRef.current))
      setBest(readBest(BIT_BEST))
      sfx('win')
    }
    const [left, setLeft] = useCountdown(phase === 'play', finish)
    useEffect(() => setBest(readBest(BIT_BEST)), [])

    const n = bitsFor(solved)
    const values = Array.from({ length: n }, (_, k) => 2 ** (n - 1 - k))
    const sum = values.reduce((acc, v, k) => acc + (on[k] ? v : 0), 0)

    const start = () => {
      setSolved(0)
      setOn(Array(4).fill(false))
      setTarget(newTarget(4))
      setRecord(false)
      setLeft(limit)
      setPhase('play')
      sfx('tick')
    }
    const toggle = (k: number) => {
      if (phase !== 'play') return
      const nextOn = values.map((_, j) => (j === k ? !on[j] : !!on[j]))
      const total = values.reduce((acc, v, j) => acc + (nextOn[j] ? v : 0), 0)
      if (total === target) {
        const s = solved + 1
        const bits = bitsFor(s)
        setSolved(s)
        setOn(Array(bits).fill(false))
        setTarget(newTarget(bits))
        setLeft((t) => t + 2)
        setPop(true)
        setTimeout(() => setPop(false), 350)
        sfx('match')
      } else {
        setOn(nextOn)
        sfx('flip')
      }
    }

    return (
      <Panel
        id="bitflip"
        tone="tone-green"
        title={title}
        sub={sub}
        stats={
          <>
            <span>{phase === 'play' ? `${left}s left` : `${limit}s`}</span>
            <span>{`${solved} solved`}</span>
            <span>{best ? `Best: ${best}` : 'Best: none yet'}</span>
          </>
        }
      >
        {phase === 'play' ? (
          <div className="bits">
            <div className={`bits-target${pop ? ' pop' : ''}`}>
              <small>Target</small>
              <b>{target}</b>
              <small>{`You have ${sum} · ${values.map((_, k) => (on[k] ? 1 : 0)).join('')}`}</small>
            </div>
            <div
              className="bits-row"
              style={{ ['--cols' as string]: n === 6 ? 3 : 4 }}
              role="group"
              aria-label={`Bits, target ${target}, now ${sum}`}
            >
              {values.map((v, k) => {
                const [sides, amp] = BIT_SHAPES[k % 4] ?? [8, 0.07]
                const color = BIT_COLORS[k % 4] ?? '#4285f4'
                return (
                  <button
                    key={`${n}-${k}`}
                    type="button"
                    className={`bit${on[k] ? ' on' : ''}`}
                    aria-pressed={!!on[k]}
                    aria-label={`${v}`}
                    onClick={() => toggle(k)}
                  >
                    <svg viewBox="-122 -122 244 244" aria-hidden="true">
                      <path
                        d={shapePath(sides, amp)}
                        fill={on[k] ? color : 'none'}
                        stroke={color}
                        strokeWidth={10}
                      />
                      <text y={18} textAnchor="middle">
                        {on[k] ? 1 : 0}
                      </text>
                    </svg>
                    <span>{v}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="quiz-start">
            {phase === 'over' ? (
              <p className="quiz-q">{`${solved} solved${record ? ' · New best!' : ''}`}</p>
            ) : (
              <p>Each bit is worth double the one on its right: 8, 4, 2, 1 and up.</p>
            )}
            <button className="btn" type="button" onClick={start}>
              {phase === 'over' ? 'Play again' : 'Start flipping'}
            </button>
          </div>
        )}
      </Panel>
    )
  },
}

export const gameComponents: Record<string, AnyBlock> = {
  GdgBugHunt,
  GdgTechSprint,
  GdgBitFlip,
}
