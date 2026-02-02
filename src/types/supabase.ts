export type ReferralRecord = {
  id: string
  user_id: string
  specialty: string
  archived: boolean
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}
