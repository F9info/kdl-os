// What the account step hands to the join flow. Kept in memory only (never storage): it may hold a
// password. A reload loses it and the join page sends the visitor back to the account step.
export interface JoinAccount {
  full_name?: string
  mobile?: string
  email?: string
  password?: string
  verification_token?: string
  provider?: string
}
let pending: JoinAccount | null = null
export const getJoinAccount = () => pending
export const setJoinAccount = (a: JoinAccount | null) => {
  pending = a
}
