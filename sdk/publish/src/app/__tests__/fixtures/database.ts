export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  data: {
    Tables: {
      companies: {
        Row: {
          domain: string | null
          id: number
          name: string
        }
        Insert: {
          domain?: string | null
          id?: never
          name: string
        }
        Update: {
          domain?: string | null
          id?: never
          name?: string
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          company_id: number
          summary: string | null
        }
        Insert: {
          company_id: number
          summary?: string | null
        }
        Update: {
          company_id?: number
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          attributes: Record<string, string | null> | null
          email: string
          embedding: string | null
          id: number
        }
        Insert: {
          attributes?: string | null
          email: string
          embedding?: string | null
          id?: never
        }
        Update: {
          attributes?: string | null
          email?: string
          embedding?: string | null
          id?: never
        }
        Relationships: []
      }
      deal_notes: {
        Row: {
          body: string
          body_length: number | null
          deal_id: string
          id: number
        }
        Insert: {
          body: string
          body_length?: never
          deal_id: string
          id?: number
        }
        Update: {
          body?: string
          body_length?: never
          deal_id?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          amount: number
          company_id: number | null
          details: Json | null
          id: string
          name: string
          owner_id: string
          stage: string
          tags: string[]
        }
        Insert: {
          amount?: number
          company_id?: number | null
          details?: Json | null
          id?: string
          name: string
          owner_id: string
          stage?: string
          tags?: string[]
        }
        Update: {
          amount?: number
          company_id?: number | null
          details?: Json | null
          id?: string
          name?: string
          owner_id?: string
          stage?: string
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      open_deals: {
        Row: {
          amount: number | null
          id: string | null
          name: string | null
          owner_id: string | null
        }
      }
    }
    Functions: {
      deal_count: {
        Args: {
          wanted: string
        }
        Returns: number | null
      }
    }
  }
}
