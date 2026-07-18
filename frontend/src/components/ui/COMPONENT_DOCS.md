# Component Docs — KDL Starter Kit UI Reference

**Deliverable 9 of KDL-261 (Phase E1).** Single, code-accurate reference for the Frontend Coder.
Source of truth: `frontend/src/components/ui/*` and `frontend/src/components/shared/*` as of 2026-07-18.
Design-system context: B1 tokens (`tokens-doc`), B2 spec (`component-spec`), B3 doc (`ia-doc`).

> **Accuracy contract.** Every prop, variant, and export below is copied from the current source.
> If a component changes, update this doc in the same PR. If a snippet no longer compiles against
> `components/ui/*`, treat it as a bug and file it.

---

## 0. How to read this doc

Each primitive lists: **import** · **props/variants** · **states** · **do / don't** · **tokens** ·
**motion** · **copy-paste snippet**. All primitives are built on **Tailwind + Radix + CVA** and
consume **semantic tokens**, never raw hex. Never hardcode a color, radius, or spacing value —
if the token you need doesn't exist, escalate to the design-system owner (see §Token model).

### Token model (read once)

Semantic tokens resolve as `hsl(var(--token))` with a Template-Engine branding override layered on
top (`var(--branding_*, hsl(var(--token)))`). You reference them through **Tailwind color classes**,
not the raw vars:

| Purpose                            | Tailwind class                                   | Backing var                       |
| ---------------------------------- | ------------------------------------------------ | --------------------------------- |
| Page background / surface          | `bg-background`                                  | `--background`                    |
| Primary text                       | `text-foreground`                                | `--foreground`                    |
| Brand action (fill)                | `bg-primary` / `text-primary-foreground`         | `--primary`                       |
| Secondary action                   | `bg-secondary` / `text-secondary-foreground`     | `--secondary`                     |
| Muted surface / de-emphasized text | `bg-muted` / `text-muted-foreground`             | `--muted`                         |
| Hover / active accent              | `bg-accent` / `text-accent-foreground`           | `--accent`                        |
| Danger / error                     | `bg-destructive` / `text-destructive-foreground` | `--destructive`                   |
| Card surface                       | `bg-card` / `text-card-foreground`               | `--card`                          |
| Popover/overlay surface            | `bg-popover` / `text-popover-foreground`         | `--popover`                       |
| Field border                       | `border-input`                                   | `--input`                         |
| Divider / generic border           | `border-border` (`bg-border`)                    | `--border`                        |
| Focus ring                         | `ring-ring`                                      | `--ring`                          |
| Corner radius                      | `rounded-lg/md/sm`                               | `--radius` (md = −2px, sm = −4px) |

**Template-Engine `te-*` classes.** Several primitives (`Button`, `Input`, `Card`, `Table`, `Alert`,
`Dialog`) carry `te-*` classes (e.g. `te-btn`, `te-input`, `te-card`, `te-popup`). These pull
height/padding/radius/border/severity color from the Template Engine panes (`te-components.css`,
KDL-213) so a client can re-skin the kit without touching component code. **Do not strip or override
`te-*` classes** — they are the branding contract. Layer app-specific overrides via `className`
(width, margins, grid placement) only.

### Motion rules (global)

- **Doherty threshold:** every interaction gives feedback in <400ms; hover/focus transitions land ~150ms.
- Radix enter/exit uses `tailwindcss-animate` (`data-[state=open]:animate-in` / `animate-out`,
  `fade`/`zoom`/`slide`). Default ~150ms; `Dialog` uses `duration-200`.
- Color/opacity changes use `transition-colors` / `transition-opacity`, not `transition-all` where avoidable.
- **Respect reduced motion:** never add motion that conveys meaning the static state doesn't. The animate
  utilities degrade gracefully; don't reintroduce large-travel slides for users who opted out.

### States checklist (apply to every interactive primitive)

`default` · `hover` · `focus-visible` · `active` · `disabled` · `loading` · `error/invalid` · `empty`.
If a primitive can't express a state itself (e.g. loading for a form field), compose the state kit
(`LoadingState` / `ErrorState` / `EmptyState`, §16) around it.

---

## 1. Button

```tsx
import { Button, buttonVariants } from '@/components/ui/button'
```

**Props**

| Prop      | Type                                                              | Default   | Notes                                                 |
| --------- | ----------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| `variant` | `default \| destructive \| outline \| secondary \| ghost \| link` | `default` |                                                       |
| `size`    | `default \| sm \| lg \| icon`                                     | `default` | `icon` = 40×40 square                                 |
| `asChild` | `boolean`                                                         | `false`   | Render as child (Radix `Slot`) — e.g. wrap a `<Link>` |
| …rest     | `React.ButtonHTMLAttributes`                                      |           | `disabled`, `onClick`, `type`, etc.                   |

**States**

- **hover:** `destructive` → `bg-destructive/90`; `ghost` → `bg-accent`; `link` → underline. Filled
  variant hover chrome comes from `te-btn*`.
- **focus-visible:** `ring-2 ring-ring ring-offset-2` (keyboard only — not on mouse click).
- **disabled:** `opacity-50 pointer-events-none`.
- **loading:** Button has no built-in spinner — compose one and disable while pending (snippet below).

**Do**

- Use one **primary** (`default`) button per view/section — the single most important action.
- Use `destructive` only for irreversible/data-losing actions; pair with a confirm `Dialog`.
- Use `asChild` to make a link look like a button — keeps semantics correct (`<a>` navigates).

**Don't**

- Don't stack multiple `default` buttons side by side — demote the rest to `secondary`/`outline`/`ghost`.
- Don't put `onClick`-navigation on a `<Button>` when a link is meant; use `asChild` + `<Link>`.
- Don't hand-set height/padding to “match” a button — that's what `size` + `te-btn` own.

**Tokens:** `bg-primary`/`text-primary-foreground` (default), `bg-destructive`/… (destructive),
`bg-secondary` (secondary), `bg-accent` (ghost hover). Size/radius/font from `te-btn*`.

**Motion:** `transition-colors` on hover (~150ms). Focus ring appears instantly.

```tsx
// Standard + loading pattern (Button has no loading prop — compose it)
import { Loader2 } from 'lucide-react'

;<Button onClick={save} disabled={isSaving}>
  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
  {isSaving ? 'Saving…' : 'Save changes'}
</Button>

// Link that looks like a button
import Link from 'next/link'
;<Button asChild variant="outline">
  <Link href="/settings">Settings</Link>
</Button>

// Icon-only button — always give it an accessible name
import { Trash2 } from 'lucide-react'
;<Button size="icon" variant="ghost" aria-label="Delete">
  <Trash2 className="h-4 w-4" />
</Button>
```

---

## 2. Input

```tsx
import { Input } from '@/components/ui/input' // type InputProps
```

Plain `<input>` forwarding all native attrs (`type`, `placeholder`, `value`, `onChange`, `disabled`,
`readOnly`, etc.). Height/padding/border/radius/placeholder color come from `te-input` (Forms pane).

**States**

- **focus-visible:** `ring-2 ring-ring ring-offset-2`.
- **disabled:** `cursor-not-allowed opacity-50`.
- **error/invalid:** driven by `aria-invalid="true"` → `border-destructive` + destructive focus ring.
  You rarely set this by hand — wrap in `FormField` (§15) and it injects `aria-invalid` from `error`.

**Do**

- Always pair with a `<Label htmlFor>` or wrap in `FormField` — never a placeholder-only field.
- Set the right `type` (`email`, `tel`, `number`, `password`) so mobile keyboards/validation adapt.
- Signal invalidity via `aria-invalid` (or `FormField error`), not by manually recoloring the border.

**Don't**

- Don't use placeholder text as the label (fails recognition-over-recall + a11y).
- Don't hardcode a red border for errors — the `aria-[invalid=true]` path already does it via tokens.

**Tokens:** `border-input`, `bg-background`, `text-muted-foreground` (placeholder), `ring-ring`,
`border-destructive` (invalid) — all via `te-input` + the aria-invalid utilities.

**Motion:** none beyond the focus ring (instant).

```tsx
<FormField label="Work email" required error={errors.email}>
  <Input type="email" placeholder="you@company.com" {...register('email')} />
</FormField>
```

---

## 3. Textarea

```tsx
import { Textarea } from '@/components/ui/textarea' // type TextareaProps
```

`min-h-[80px]`, `border-input`, `bg-background`, resizable by default. Same `aria-invalid` error path
as `Input`. Forwards all native `<textarea>` attrs.

**States:** focus ring, `disabled` (`cursor-not-allowed opacity-50`), invalid (`aria-invalid` →
`border-destructive`).

**Do:** cap length with `maxLength` and show a counter for hard limits; wrap in `FormField`.
**Don't:** disable resize unless the layout truly can't tolerate it; don't use for single-line input.

**Tokens:** identical to Input. **Motion:** focus ring only.

```tsx
<FormField label="Description" hint="Markdown supported" error={errors.description}>
  <Textarea rows={4} placeholder="Describe the item…" {...register('description')} />
</FormField>
```

---

## 4. Select

```tsx
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select'
```

Radix Select. `SelectContent` defaults to `position="popper"` and portals to `<body>`. Selected item
shows a `Check` indicator.

**States:** trigger focus ring (`focus:ring-2 ring-ring`); `disabled` trigger dims; item hover/keyboard
→ `bg-accent`; disabled item → `opacity-50 pointer-events-none`; checked item shows `Check`.

**Do**

- Use for **4–15** mutually-exclusive options. Under ~4, prefer radios/segmented; over ~15 use `Command` (§14) with search.
- Always render a `SelectValue placeholder="…"` so the empty state reads clearly.
- Group long lists with `SelectGroup` + `SelectLabel`.

**Don't**

- Don't use a Select for a yes/no toggle — use `Switch` (§12).
- Don't nest interactive controls inside `SelectItem`.

**Tokens:** `border-input`/`bg-background` (trigger), `bg-popover`/`text-popover-foreground` (content),
`bg-accent` (focused item), `bg-muted` (separator).

**Motion:** content `data-[state=open]:animate-in fade-in zoom-in-95` + side slide; exit reverse.

```tsx
<Select value={role} onValueChange={setRole}>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="Select a role" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Roles</SelectLabel>
      <SelectItem value="admin">Admin</SelectItem>
      <SelectItem value="editor">Editor</SelectItem>
      <SelectItem value="viewer">Viewer</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

---

## 5. Card

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
```

`te-card` owns background/border/radius/padding/shadow (Cards pane, KDL-209/213). `CardHeader`/
`CardContent`/`CardFooter` provide `te-card-*` internal spacing. `CardTitle` is `text-2xl font-semibold`.

**States:** static surface (no interactive states of its own). For clickable cards, wrap the whole card
in a link/button and add `hover:` chrome via `className` — don't fake it on `Card`.

**Do:** keep header (title + description), content, and footer (actions) in their slots for consistent
rhythm. Right-align footer actions.
**Don't:** override the card's padding/shadow inline — that's the `te-card` contract; only add layout
(`className="w-full"`, grid span).

**Tokens:** `bg-card`/`text-card-foreground` via `te-card`; `text-muted-foreground` for `CardDescription`.

**Motion:** none by default.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Team plan</CardTitle>
    <CardDescription>Billed annually</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-3xl font-bold">
      $29<span className="text-sm text-muted-foreground">/mo</span>
    </p>
  </CardContent>
  <CardFooter className="justify-end">
    <Button>Upgrade</Button>
  </CardFooter>
</Card>
```

---

## 6. Dialog

```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
```

Radix Dialog. `DialogContent` (`te-popup`) is centered, `max-w-lg` by default, with a built-in close `X`
(top-right) and an overlay (`te-popup-overlay`). Focus is trapped; `Esc` and overlay-click close.

**States:** open/closed animated; close button hover `opacity-100`, focus ring. Overlay fades.

**Do**

- Always include a `DialogTitle` (Radix requires an accessible name; use `sr-only` if visually hidden — see `CommandDialog`).
- Add `DialogDescription` for context. Put actions in `DialogFooter`, primary action rightmost.
- Override width via `className="max-w-md"` etc. — that's the intended app-level API.

**Don't**

- Don't nest a Dialog inside a Dialog. Don't use for non-blocking notices — that's `Toast` (§9).
- Don't remove the close affordance or block `Esc` for dismissible dialogs (forgiveness heuristic).

**Tokens:** `te-popup` (surface), `te-popup-overlay` (scrim), `bg-accent` (close active).

**Motion:** `duration-200`, `zoom-in-95` + `slide-in-from-top-[48%]` on open; overlay `fade-in`.

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </DialogTrigger>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Delete project?</DialogTitle>
      <DialogDescription>This permanently removes the project and its data.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <Button variant="destructive" onClick={confirmDelete}>
        Delete
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 7. Table (primitive) + DataTable (composed)

**Primitive** — `import { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from '@/components/ui/table'`

Semantic table parts. `Table` wraps a `<table>` in an `overflow-auto` div. Header background + row
borders come from the Tables pane via `te-table-*`. Row hover → `bg-muted/50`; selected row
(`data-[state=selected]`) → `bg-muted`.

**DataTable (use this for real lists)** — `import { DataTable } from '@/components/shared/DataTable'`

TanStack-Table wrapper that folds in loading, error, empty, and pagination so screens don't re-implement them.

| Prop           | Type                                 | Notes                                                     |
| -------------- | ------------------------------------ | --------------------------------------------------------- |
| `columns`      | `ColumnDef<T>[]`                     | TanStack column defs                                      |
| `data`         | `T[]`                                | current page rows                                         |
| `isLoading`    | `boolean`                            | renders `Skeleton` rows                                   |
| `error`        | `unknown`                            | renders `ErrorState` in place of rows                     |
| `onRetry`      | `() => void`                         | retry handler for the error state                         |
| `pagination`   | `{ page; totalPages; onPageChange }` | manual pagination (server-driven)                         |
| `emptyMessage` | `string`                             | text for the `EmptyState` (default `"No results found."`) |

**Do:** use `DataTable` for any fetched list — it already wires the state kit precedence (error →
loading → empty → rows). Use the raw `Table` parts only for static/layout tables.
**Don't:** re-invent loading/empty/error around a bare `Table` when `DataTable` gives them for free.

**Tokens:** `te-table-*` (header/borders), `bg-muted/50` (row hover), `text-muted-foreground` (caption).
**Motion:** `transition-colors` on row hover.

```tsx
const columns: ColumnDef<User>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
]

<DataTable
  columns={columns}
  data={query.data?.items ?? []}
  isLoading={query.isLoading}
  error={query.error}
  onRetry={query.refetch}
  pagination={{ page, totalPages, onPageChange: setPage }}
  emptyMessage="No users yet."
/>
```

---

## 8. Badge

```tsx
import { Badge, badgeVariants } from '@/components/ui/badge'
```

**Variant:** `default | secondary | destructive | outline` (default). Pill shape (`rounded-full`,
`text-xs font-semibold`).

**States:** hover dims fill (`bg-primary/80` etc.); focus ring for focusable use. Otherwise static.

**Do:** use for short status/labels (1–2 words). Map status→variant consistently across the app
(e.g. active=default, pending=secondary, failed=destructive).
**Don't:** put buttons/links inside a Badge; don't use it as a clickable control (use `Button size="sm"`).
Don't invent per-status colors outside the four variants — extend the design system instead.

**Tokens:** `bg-primary`/`bg-secondary`/`bg-destructive` + matching `-foreground`; `outline` = `text-foreground`.
**Motion:** `transition-colors` on hover.

```tsx
<Badge variant={user.active ? 'default' : 'secondary'}>{user.active ? 'Active' : 'Inactive'}</Badge>
```

---

## 9. Toast

```tsx
import { useToast } from '@/hooks/use-toast' // toast() also exported
// Mount <Toaster /> once at the app root:
import { Toaster } from '@/components/ui/toaster'
```

Radix Toast + a global store. Call `toast({...})`; it returns `{ id, dismiss, update }`.

| Field         | Type                     | Notes                          |
| ------------- | ------------------------ | ------------------------------ |
| `title`       | `ReactNode`              | short headline                 |
| `description` | `ReactNode`              | body                           |
| `variant`     | `default \| destructive` | destructive = error styling    |
| `action`      | `ToastActionElement`     | a `<ToastAction>` (undo/retry) |

> **Note:** the store keeps `TOAST_LIMIT = 1` (one visible at a time) and a long
> `TOAST_REMOVE_DELAY` — dismiss manually or via `action`. Don't rely on auto-timeout for critical info.

**Do:** use for non-blocking confirmations ("Saved", "Copied") and recoverable errors with an undo/retry
`action`. Keep copy to one line.
**Don't:** use a toast for anything the user must act on to proceed (use `Dialog`), or for inline form
validation (use `FormField`). Don't stack many — the limit is 1.

**Tokens:** `bg-background`/`text-foreground` (default), `bg-destructive`/… (destructive), `shadow-lg`.
**Motion:** slide in from top (mobile) / bottom-right (desktop); swipe-to-dismiss; `animate-out` on close.

```tsx
const { toast } = useToast()

toast({ title: 'Saved', description: 'Your changes are live.' })

toast({
  variant: 'destructive',
  title: 'Upload failed',
  description: 'Network error.',
  action: (
    <ToastAction altText="Retry" onClick={retry}>
      Retry
    </ToastAction>
  ),
})
```

---

## 10. Alert

```tsx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
// Composed helper for API/form errors:
import { ErrorAlert } from '@/components/shared/ErrorAlert'
```

**Variant:** `default | destructive | success | warning | info`. Shape + per-severity colors come from
the Alerts pane via `te-alert*`. Put a leading Lucide icon as the first child (auto-positioned).

**States:** static, `role="alert"`. Use `ErrorAlert` when you have an axios/`Error`/string to render a
message (same extraction as `ErrorState`).

**Do:** use inline within a page/section for persistent, contextual messages. Choose the variant that
matches severity. Keep title short, description actionable.
**Don't:** use `Alert` for transient feedback (toast) or full-screen failures (`ErrorState`). Don't
recolor per-severity inline — the `te-alert-*` variants own it.

**Tokens:** `te-alert-error/success/warning/info`; default = `bg-background`/`text-foreground`.
**Motion:** none.

```tsx
<Alert variant="warning">
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>Heads up</AlertTitle>
  <AlertDescription>Your trial ends in 3 days.</AlertDescription>
</Alert>

// From a caught error:
<ErrorAlert error={mutation.error} />
```

---

## 11. Avatar

```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
```

Radix Avatar, `h-10 w-10 rounded-full`. `AvatarFallback` shows while/if the image fails (initials on
`bg-muted`).

**Do:** always provide a `AvatarFallback` (initials) and `alt` on `AvatarImage`. Resize via `className`
(`h-8 w-8`).
**Don't:** rely on the image alone — network failures leave an empty circle without a fallback.

**Tokens:** `bg-muted`/`text-sm font-medium` (fallback). **Motion:** none.

```tsx
<Avatar>
  <AvatarImage src={user.avatarUrl} alt={user.name} />
  <AvatarFallback>{initials(user.name)}</AvatarFallback>
</Avatar>
```

---

## 12. Switch

```tsx
import { Switch } from '@/components/ui/switch'
```

Radix Switch. Checked → `bg-primary`; unchecked → `bg-input`. Focus ring, `disabled` dims.

**Do:** use for an **instant** binary setting (on/off, applied immediately). Pair with a `<Label>`.
**Don't:** use for a form value that only applies on submit — use a checkbox pattern. Don't use for
mutually-exclusive multi-options (that's radio/Select).

**Tokens:** `bg-primary` (on), `bg-input` (off), `bg-background` (thumb), `ring-ring`.
**Motion:** `transition-colors` (track) + `transition-transform` (thumb slides `translate-x-5`).

```tsx
<div className="flex items-center gap-2">
  <Switch id="notify" checked={notify} onCheckedChange={setNotify} />
  <Label htmlFor="notify">Email notifications</Label>
</div>
```

---

## 13. Tooltip

```tsx
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
```

Radix Tooltip. Wrap the app (or subtree) once in `<TooltipProvider>`. `sideOffset` defaults to 4.

**Do:** use for supplementary hints on icon-only controls. Keep to a few words. Still give the trigger a
real `aria-label` — tooltips aren't announced reliably and don't show on touch.
**Don't:** put essential info or interactive content only in a tooltip. Don't use on touch-primary flows
as the sole affordance.

**Tokens:** `bg-popover`/`text-popover-foreground`, `border`, `shadow-md`.
**Motion:** `animate-in fade-in zoom-in-95` + side slide.

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button size="icon" variant="ghost" aria-label="Filters">
        <Filter className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Filters</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## 14. Dropdown Menu & Command (Command Palette)

**DropdownMenu** — `@/components/ui/dropdown-menu` — exports `DropdownMenu`, `DropdownMenuTrigger`,
`DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`,
`DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuGroup`,
`DropdownMenuSub*`, `DropdownMenuRadioGroup`. Item hover/keyboard → `bg-accent`; `inset` prop pads for
alignment with checkbox/radio items; `disabled` item dims.

**Command** — `@/components/ui/command` — `cmdk`-based. `CommandDialog` requires a `label` prop (backs a
visually-hidden `DialogTitle`). Parts: `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`,
`CommandItem`, `CommandSeparator`, `CommandShortcut`.

**Do:** use `DropdownMenu` for a small set of contextual actions on a trigger; use `Command`/
`CommandDialog` for searchable navigation/actions (⌘K) or long option lists (>15).
**Don't:** use a DropdownMenu as a form Select (§4). Don't omit `CommandDialog`'s `label` (a11y).

**Tokens:** `bg-popover`/`text-popover-foreground`, `bg-accent` (active item), `bg-border`/`bg-muted`
(separators). **Motion:** popover `fade-in zoom-in-95` + side slide.

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button size="icon" variant="ghost" aria-label="Row actions"><MoreHorizontal className="h-4 w-4" /></Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Actions</DropdownMenuLabel>
    <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-destructive" onSelect={onDelete}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

<CommandDialog label="Command palette" open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Search…" />
  <CommandList>
    <CommandEmpty>No results.</CommandEmpty>
    <CommandGroup heading="Pages">
      <CommandItem onSelect={() => go('/settings')}>Settings</CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

---

## 15. Label & FormField (form composition)

**Label** — `@/components/ui/label` — Radix Label, `text-sm font-medium`. Dims when its `peer` control
is disabled. Always set `htmlFor`.

**FormField** — `@/components/shared/FormField` — the standard field wrapper. It generates ids, renders
the `<Label>`, a required `*`, an optional `hint`, and the `error`, and **injects `id` + `aria-invalid`

- `aria-describedby` into the child control** so `Input`/`Textarea`/`Select` light up their destructive
  styling automatically.

| Prop       | Type      | Notes                                       |
| ---------- | --------- | ------------------------------------------- |
| `label`    | `string`  | required                                    |
| `error`    | `string`  | shows message + flips child to invalid      |
| `required` | `boolean` | renders `*`                                 |
| `hint`     | `string`  | helper text (hidden when `error` present)   |
| `children` | control   | `Input`, `Textarea`, `Select` trigger, etc. |

**Do:** wrap every form control in `FormField` — it's the single source of a11y wiring and error display.
**Don't:** hand-roll `<Label>` + error `<p>` per field, or set `aria-invalid` manually when `FormField`
does it.

```tsx
<FormField label="Full name" required error={errors.name} hint="As it appears on your ID">
  <Input {...register('name')} />
</FormField>
```

---

## 16. State kit — LoadingState / ErrorState / EmptyState

`@/components/ui/{loading-state,error-state,empty-state}`. Canonical non-happy-path renders. Full rules:
`components/ui/STATE_KIT.md`.

- **LoadingState** — `variant?: 'spinner' | 'skeleton'` (default `spinner`), `label?`, `rows?` (skeleton
  lines, default 3). `role="status" aria-live="polite"`. Use `skeleton` once you know the content shape.
- **ErrorState** — `title?` (default "Something went wrong"), `error?` (axios/`Error`/string → message),
  `description?` (overrides), `onRetry?`, `retryLabel?`. `role="alert" aria-live="assertive"`.
- **EmptyState** — `icon?` (Lucide, default `Inbox`), `title`, `description?`, `action?`. `role="status"`.

**Precedence (always this order):** `error` → `isLoading` → `items.length === 0` → real content.
Don't flash an empty state while still loading.

**Do:** give `EmptyState` a view-specific `title` ("No files here") and an `action` when the user can fix
it. Pass `error`/`onRetry` to `ErrorState` rather than a bare string.
**Don't:** use these for inline field validation (that's `FormField`) or transient errors (toast).

```tsx
{
  error ? (
    <ErrorState error={error} onRetry={refetch} />
  ) : isLoading ? (
    <LoadingState variant="skeleton" rows={5} />
  ) : items.length === 0 ? (
    <EmptyState
      title="No files here"
      description="Upload one to get started."
      action={<Button onClick={openUpload}>Upload</Button>}
    />
  ) : (
    <ItemGrid items={items} />
  )
}
```

---

## 17. Utility primitives

- **Separator** — `@/components/ui/separator`. `orientation?: 'horizontal' | 'vertical'` (default
  horizontal), `decorative?` (default true → `role=none`). `bg-border`, 1px. Set `decorative={false}`
  when it separates semantically distinct groups for AT.
- **Skeleton** — `@/components/ui/skeleton`. `animate-pulse rounded-md bg-muted`. Compose exact-shape
  placeholders; prefer over a bare spinner once the layout is known. `aria-hidden` the shapes and carry
  the announcement on the parent `LoadingState`.

```tsx
<Separator className="my-4" />
<div className="space-y-2">
  <Skeleton className="h-4 w-1/2" />
  <Skeleton className="h-4 w-full" />
</div>
```

---

## 18. Gaps & follow-ups (not yet in `components/ui`)

The B2 spec references some primitives that **do not exist in the current library**. Do not invent
one-offs — flag to the design-system owner / Frontend Architect and track as E2 work:

- **`Tabs`** — no `tabs.tsx` primitive exists. If a tabbed surface is needed, add a Radix-Tabs-based
  primitive with `te-*` tokens first; don't hand-roll per screen.
- **Checkbox / Radio (standalone)** — RBAC/checkbox behavior currently lives inside `DropdownMenu`
  (`DropdownMenuCheckboxItem`) and Command; there's no form `Checkbox`/`RadioGroup` primitive. Add before
  building multi-select forms.
- **Popover (generic, non-menu)** — only `DropdownMenu`/`Select`/`Dialog`/`Tooltip` exist. Add a plain
  Radix `Popover` if a non-menu floating panel is required.

Any of the above = a **system-level proposal** (new primitive + tokens), reviewed before use — not a
quiet inline component.

---

## 19. Handoff checklist for the Frontend Coder

Before shipping a screen, confirm:

- [ ] Every color/radius/spacing comes from a token/`te-*` class — zero hardcoded hex.
- [ ] Every interactive control has visible `focus-visible` + an accessible name (label/`aria-label`).
- [ ] Fetched lists use `DataTable` **or** the state-kit precedence (error → loading → empty → content).
- [ ] Every form control is wrapped in `FormField`; errors flow through `error`, not manual borders.
- [ ] One primary `Button` per section; destructive actions confirmed via `Dialog`.
- [ ] Dialogs have a `DialogTitle`; Command palettes have a `label`.
- [ ] Contrast ≥ WCAG AA in both light and dark; verified at 1440×900 and 390×844.
- [ ] No new primitive invented where §18 says to escalate.

---

_Maintained by the UI/UX/DX Design Engineer. Keep code-accurate with `components/ui/*` — update in the
same PR as any component change. Unblocks E2 rollout._
