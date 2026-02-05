export type Role = 'admin' | 'editor' | 'guest'
export type Location = 'CH_Elko' | 'CH_LakeHavasu' | 'CH_Pahrump'

export type UserAccess = {
  role: Role
  location: Location | null
}
