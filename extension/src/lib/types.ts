export type Settings = {
  provider: string
  model_name: string
  api_key: string
  full_name: string | null
  contact_email: string | null
  phone: string | null
  location: string | null
}

export type ContactInfo = {
  full_name: string | null
  contact_email: string | null
  phone: string | null
  location: string | null
}

export type CV = {
  id: string
  name: string
  cv_text: string
}

export type TailoredBullet = {
  text: string
  source_span: string
}

export type TailoredCV = {
  summary: string
  bullets: TailoredBullet[]
}
