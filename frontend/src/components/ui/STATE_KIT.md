# State kit convention (KDL-291)

Three components in `components/ui` cover every non-happy-path render for a
list/detail screen: `<LoadingState>`, `<ErrorState>`, `<EmptyState>`. All are
token-driven (no hardcoded colors — `bg-muted`, `text-muted-foreground`,
`bg-destructive/10`, etc.), so they're dark-mode correct for free.

## Which one, when

- **`LoadingState` variant="spinner"** — the request is short and/or the
  eventual content's shape is unknown (a drawer, a panel, a page you can't
  usefully skeleton). Default choice for "isLoading" on first mount.
- **`LoadingState` variant="skeleton"`** — you already know the shape of what's
coming (a table, a card grid, a list of rows) and can approximate it with
placeholder blocks. Prefer this over a spinner once you know the layout —
it reduces perceived latency and avoids a layout jump when data lands.
Table-shaped content (e.g. `DataTable`) still composes its own per-cell
`<Skeleton>`rows rather than this component, since the row/column shape is
table-specific — but it's the same underlying`Skeleton` primitive.
- **`ErrorState`** — a query or mutation that a user is blocked by failed
  (list fetch, detail fetch). Pass `error` (axios error, `Error`, or string)
  and it extracts a message the same way `ErrorAlert` does; pass `onRetry` to
  show a retry button. Not for inline form-field validation — that's still
  `<FormField error=.../>` — and not for transient toast-level mutation
  errors, which stay on `<ErrorAlert>`/`toast()`.
- **`EmptyState`** — the request succeeded and returned zero items. Always
  pair with a `title` that's specific to the view ("No files here", "No
  roles found") over a generic "No results", and an `action` (e.g. an Upload
  or Create button) when the user can immediately fix the emptiness.

## Precedence when composing

Check in this order and render only the first that applies: `error` →
`isLoading` → `items.length === 0` → the real content. Don't show a stale
empty-state flash while a query is still loading (see the media library
retrofit for the reference `mediaQuery`/`trashQuery` composition).

## a11y

- `LoadingState` and `EmptyState` use `role="status"` (`aria-live="polite"`
  on `LoadingState`) so assistive tech announces the transition without
  stealing focus.
- `ErrorState` uses `role="alert"` (`aria-live="assertive"`) since a failed
  request is more urgent than a normal status update.
- Icons are `aria-hidden` — the text content carries the meaning.

## Example

```tsx
{
  error ? (
    <ErrorState error={error} onRetry={() => refetch()} />
  ) : isLoading ? (
    <LoadingState variant="skeleton" rows={5} />
  ) : items.length === 0 ? (
    <EmptyState
      title="No files here"
      description="Upload a file or drag one onto this window."
      action={<Button onClick={openUploadDialog}>Upload</Button>}
    />
  ) : (
    <ItemGrid items={items} />
  );
}
```
