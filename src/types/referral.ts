export type Referral = {
  id: string
  dateReferralReceived: string
  patientName: string
  dob: string
  phoneNumber: string
  insurance: string
  referringProvider: string
  reason: string
  formsSent: boolean
  formReceived: boolean
  calledToSchedule: boolean
  prepInstructionSent: boolean
  firstPatientCommunication: string
  secondPatientCommunication: string
  thirdPatientCommunication: string
  apptDateTime: string
  notes: string
}
