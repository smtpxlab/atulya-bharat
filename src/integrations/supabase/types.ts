export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          activity_date: string
          activity_type: string | null
          average_speed_mps: number | null
          distance_km: number
          elapsed_time_seconds: number | null
          id: string
          logged_at: string
          moving_time_seconds: number | null
          name: string | null
          polyline: string | null
          raw_payload: Json | null
          registration_id: string | null
          source: Database["public"]["Enums"]["activity_source"]
          sport_type: string | null
          start_date: string | null
          strava_activity_id: number | null
          user_id: string
        }
        Insert: {
          activity_date: string
          activity_type?: string | null
          average_speed_mps?: number | null
          distance_km: number
          elapsed_time_seconds?: number | null
          id?: string
          logged_at?: string
          moving_time_seconds?: number | null
          name?: string | null
          polyline?: string | null
          raw_payload?: Json | null
          registration_id?: string | null
          source?: Database["public"]["Enums"]["activity_source"]
          sport_type?: string | null
          start_date?: string | null
          strava_activity_id?: number | null
          user_id: string
        }
        Update: {
          activity_date?: string
          activity_type?: string | null
          average_speed_mps?: number | null
          distance_km?: number
          elapsed_time_seconds?: number | null
          id?: string
          logged_at?: string
          moving_time_seconds?: number | null
          name?: string | null
          polyline?: string | null
          raw_payload?: Json | null
          registration_id?: string | null
          source?: Database["public"]["Enums"]["activity_source"]
          sport_type?: string | null
          start_date?: string | null
          strava_activity_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author: string | null
          author_id: string | null
          content_html: string | null
          content_md: string | null
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_published: boolean | null
          meta_description: string | null
          meta_keywords: string[]
          meta_title: string | null
          published_at: string | null
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          author_id?: string | null
          content_html?: string | null
          content_md?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          meta_keywords?: string[]
          meta_title?: string | null
          published_at?: string | null
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          author_id?: string | null
          content_html?: string | null
          content_md?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          meta_description?: string | null
          meta_keywords?: string[]
          meta_title?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_milestones: {
        Row: {
          audio_url: string | null
          challenge_id: string
          coords_updated_at: string | null
          coords_updated_by: string | null
          created_at: string
          custom_label_position: string | null
          description: string
          distance: number
          id: string
          marker_color: string | null
          marker_icon: string | null
          marker_size: string | null
          sort_order: number
          spot_image_url: string | null
          spot_name: string
          status: boolean
          updated_at: string
          x_percent: number | null
          y_percent: number | null
        }
        Insert: {
          audio_url?: string | null
          challenge_id: string
          coords_updated_at?: string | null
          coords_updated_by?: string | null
          created_at?: string
          custom_label_position?: string | null
          description: string
          distance: number
          id?: string
          marker_color?: string | null
          marker_icon?: string | null
          marker_size?: string | null
          sort_order?: number
          spot_image_url?: string | null
          spot_name: string
          status?: boolean
          updated_at?: string
          x_percent?: number | null
          y_percent?: number | null
        }
        Update: {
          audio_url?: string | null
          challenge_id?: string
          coords_updated_at?: string | null
          coords_updated_by?: string | null
          created_at?: string
          custom_label_position?: string | null
          description?: string
          distance?: number
          id?: string
          marker_color?: string | null
          marker_icon?: string | null
          marker_size?: string | null
          sort_order?: number
          spot_image_url?: string | null
          spot_name?: string
          status?: boolean
          updated_at?: string
          x_percent?: number | null
          y_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_tickets: {
        Row: {
          allow_certificate: boolean
          challenge_id: string
          created_at: string
          id: string
          shipping_cost: number
          sort_order: number
          ticket_inclusions: string | null
          ticket_name: string
          ticket_price: number
          updated_at: string
        }
        Insert: {
          allow_certificate?: boolean
          challenge_id: string
          created_at?: string
          id?: string
          shipping_cost?: number
          sort_order?: number
          ticket_inclusions?: string | null
          ticket_name: string
          ticket_price?: number
          updated_at?: string
        }
        Update: {
          allow_certificate?: boolean
          challenge_id?: string
          created_at?: string
          id?: string
          shipping_cost?: number
          sort_order?: number
          ticket_inclusions?: string | null
          ticket_name?: string
          ticket_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_tickets_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          about_map_image_url: string | null
          bib_image_url: string | null
          bib_overlay_config: Json | null
          category: string
          certificate_image_url: string | null
          challenge_type: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          creative_image_url: string | null
          description: string | null
          distance: number
          end_at: string | null
          id: string
          max_duration_days: number | null
          meta_description: string | null
          meta_keywords: string[]
          meta_title: string | null
          name: string
          route_map_image_url: string | null
          slug: string
          start_at: string | null
          status: boolean
          tags: string[]
          updated_at: string
        }
        Insert: {
          about_map_image_url?: string | null
          bib_image_url?: string | null
          bib_overlay_config?: Json | null
          category?: string
          certificate_image_url?: string | null
          challenge_type?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          creative_image_url?: string | null
          description?: string | null
          distance: number
          end_at?: string | null
          id?: string
          max_duration_days?: number | null
          meta_description?: string | null
          meta_keywords?: string[]
          meta_title?: string | null
          name: string
          route_map_image_url?: string | null
          slug: string
          start_at?: string | null
          status?: boolean
          tags?: string[]
          updated_at?: string
        }
        Update: {
          about_map_image_url?: string | null
          bib_image_url?: string | null
          bib_overlay_config?: Json | null
          category?: string
          certificate_image_url?: string | null
          challenge_type?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          creative_image_url?: string | null
          description?: string | null
          distance?: number
          end_at?: string | null
          id?: string
          max_duration_days?: number | null
          meta_description?: string | null
          meta_keywords?: string[]
          meta_title?: string | null
          name?: string
          route_map_image_url?: string | null
          slug?: string
          start_at?: string | null
          status?: boolean
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Insert: {
          club_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["club_role"]
          user_id: string
        }
        Update: {
          club_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["club_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_social_links: {
        Row: {
          club_id: string
          created_at: string
          id: string
          platform: string
          url: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          platform: string
          url: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          platform?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_social_links_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          banner_url: string | null
          category_id: string | null
          club_type: string | null
          created_at: string
          created_by: string | null
          description: string | null
          discount_cart_percent: number
          discount_challenge_percent: number
          established_at: string | null
          id: string
          is_public: boolean
          logo_url: string | null
          member_count: number
          meta_description: string | null
          meta_keywords: string[]
          meta_title: string | null
          name: string
          priority: number
          promoter_address: string | null
          promoter_city: string | null
          promoter_description: string | null
          promoter_dob: string | null
          promoter_email: string | null
          promoter_id: string | null
          promoter_name: string | null
          promoter_phone: string | null
          promoter_state: string | null
          referral_code: string | null
          registration_code: string | null
          slug: string
          social_links: Json
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          category_id?: string | null
          club_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_cart_percent?: number
          discount_challenge_percent?: number
          established_at?: string | null
          id?: string
          is_public?: boolean
          logo_url?: string | null
          member_count?: number
          meta_description?: string | null
          meta_keywords?: string[]
          meta_title?: string | null
          name: string
          priority?: number
          promoter_address?: string | null
          promoter_city?: string | null
          promoter_description?: string | null
          promoter_dob?: string | null
          promoter_email?: string | null
          promoter_id?: string | null
          promoter_name?: string | null
          promoter_phone?: string | null
          promoter_state?: string | null
          referral_code?: string | null
          registration_code?: string | null
          slug: string
          social_links?: Json
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          category_id?: string | null
          club_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_cart_percent?: number
          discount_challenge_percent?: number
          established_at?: string | null
          id?: string
          is_public?: boolean
          logo_url?: string | null
          member_count?: number
          meta_description?: string | null
          meta_keywords?: string[]
          meta_title?: string | null
          name?: string
          priority?: number
          promoter_address?: string | null
          promoter_city?: string | null
          promoter_description?: string | null
          promoter_dob?: string | null
          promoter_email?: string | null
          promoter_id?: string | null
          promoter_name?: string | null
          promoter_phone?: string | null
          promoter_state?: string | null
          referral_code?: string | null
          registration_code?: string | null
          slug?: string
          social_links?: Json
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_promoter_id_fkey"
            columns: ["promoter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_enquiries: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string
          submitter_ip: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject: string
          submitter_ip?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string
          submitter_ip?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          coupon_frequency: number
          coupon_name: string
          coupon_type: string
          coupon_used: number
          coupon_value: number
          created_at: string
          details: string | null
          expires_at: string | null
          id: string
          minimum_order_amount: number
          status: boolean
          updated_at: string
        }
        Insert: {
          coupon_frequency?: number
          coupon_name: string
          coupon_type: string
          coupon_used?: number
          coupon_value: number
          created_at?: string
          details?: string | null
          expires_at?: string | null
          id?: string
          minimum_order_amount?: number
          status?: boolean
          updated_at?: string
        }
        Update: {
          coupon_frequency?: number
          coupon_name?: string
          coupon_type?: string
          coupon_used?: number
          coupon_value?: number
          created_at?: string
          details?: string | null
          expires_at?: string | null
          id?: string
          minimum_order_amount?: number
          status?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          sort_order: number
          status: boolean
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          sort_order?: number
          status?: boolean
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          sort_order?: number
          status?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      gallery_images: {
        Row: {
          caption: string | null
          challenge_id: string | null
          created_at: string
          event_name: string | null
          id: string
          image_url: string | null
          sort_order: number
          storage_url: string
          uploaded_at: string
        }
        Insert: {
          caption?: string | null
          challenge_id?: string | null
          created_at?: string
          event_name?: string | null
          id?: string
          image_url?: string | null
          sort_order?: number
          storage_url: string
          uploaded_at?: string
        }
        Update: {
          caption?: string | null
          challenge_id?: string | null
          created_at?: string
          event_name?: string | null
          id?: string
          image_url?: string | null
          sort_order?: number
          storage_url?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_images_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_media: {
        Row: {
          caption: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          is_primary: boolean
          language: string
          media_type: Database["public"]["Enums"]["media_type"]
          milestone_id: string
          sort_order: number
          storage_url: string
        }
        Insert: {
          caption?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          is_primary?: boolean
          language?: string
          media_type: Database["public"]["Enums"]["media_type"]
          milestone_id: string
          sort_order?: number
          storage_url: string
        }
        Update: {
          caption?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          is_primary?: boolean
          language?: string
          media_type?: Database["public"]["Enums"]["media_type"]
          milestone_id?: string
          sort_order?: number
          storage_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_media_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "challenge_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
          status: Database["public"]["Enums"]["newsletter_status"]
          subscribed_at: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
          status?: Database["public"]["Enums"]["newsletter_status"]
          subscribed_at?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          status?: Database["public"]["Enums"]["newsletter_status"]
          subscribed_at?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          message: string
          shared_count: number
          status: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          message: string
          shared_count?: number
          status?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          message?: string
          shared_count?: number
          status?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_paise: number
          booking_number: string | null
          challenge_id: string | null
          club_discount_paise: number
          coupon_code: string | null
          coupon_discount_paise: number
          created_at: string
          currency: string
          discount_amount_paise: number | null
          final_amount_paise: number | null
          gateway: string
          gateway_mode: string | null
          gateway_response_json: Json | null
          id: string
          original_amount_paise: number | null
          paid_at: string | null
          payment_status: string
          promoter_discount_paise: number
          quantity: number
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          registration_id: string | null
          signature_verified: boolean
          status: Database["public"]["Enums"]["order_status"]
          subtotal_paise: number | null
          ticket_id: string | null
          user_id: string
        }
        Insert: {
          amount_paise: number
          booking_number?: string | null
          challenge_id?: string | null
          club_discount_paise?: number
          coupon_code?: string | null
          coupon_discount_paise?: number
          created_at?: string
          currency?: string
          discount_amount_paise?: number | null
          final_amount_paise?: number | null
          gateway?: string
          gateway_mode?: string | null
          gateway_response_json?: Json | null
          id?: string
          original_amount_paise?: number | null
          paid_at?: string | null
          payment_status?: string
          promoter_discount_paise?: number
          quantity?: number
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          registration_id?: string | null
          signature_verified?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_paise?: number | null
          ticket_id?: string | null
          user_id: string
        }
        Update: {
          amount_paise?: number
          booking_number?: string | null
          challenge_id?: string | null
          club_discount_paise?: number
          coupon_code?: string | null
          coupon_discount_paise?: number
          created_at?: string
          currency?: string
          discount_amount_paise?: number | null
          final_amount_paise?: number | null
          gateway?: string
          gateway_mode?: string | null
          gateway_response_json?: Json | null
          id?: string
          original_amount_paise?: number | null
          paid_at?: string | null
          payment_status?: string
          promoter_discount_paise?: number
          quantity?: number
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          registration_id?: string | null
          signature_verified?: boolean
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_paise?: number | null
          ticket_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "challenge_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_id: string
          key_secret: string
          last_enabled_at: string | null
          other_details: Json | null
          payment_name: string
          provider: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_id: string
          key_secret: string
          last_enabled_at?: string | null
          other_details?: Json | null
          payment_name: string
          provider?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_id?: string
          key_secret?: string
          last_enabled_at?: string | null
          other_details?: Json | null
          payment_name?: string
          provider?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          challenges_completed: number
          city: string | null
          country: string | null
          created_at: string
          dob: string | null
          email: string | null
          full_name: string | null
          gender: string | null
          house_no: string | null
          id: string
          mobile: string | null
          pincode: string | null
          shop_name: string | null
          state: string | null
          total_km_logged: number
          updated_at: string
          username: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          challenges_completed?: number
          city?: string | null
          country?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          house_no?: string | null
          id: string
          mobile?: string | null
          pincode?: string | null
          shop_name?: string | null
          state?: string | null
          total_km_logged?: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          challenges_completed?: number
          city?: string | null
          country?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          house_no?: string | null
          id?: string
          mobile?: string | null
          pincode?: string | null
          shop_name?: string | null
          state?: string | null
          total_km_logged?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      registrations: {
        Row: {
          activity_mode: Database["public"]["Enums"]["activity_mode"] | null
          bib_number: string | null
          certificate_number: string | null
          challenge_id: string
          completed_at: string | null
          id: string
          participation_photo_url: string | null
          registered_at: string
          status: Database["public"]["Enums"]["registration_status"]
          target_days: number | null
          ticket_id: string | null
          total_km_logged: number
          user_id: string
        }
        Insert: {
          activity_mode?: Database["public"]["Enums"]["activity_mode"] | null
          bib_number?: string | null
          certificate_number?: string | null
          challenge_id: string
          completed_at?: string | null
          id?: string
          participation_photo_url?: string | null
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          target_days?: number | null
          ticket_id?: string | null
          total_km_logged?: number
          user_id: string
        }
        Update: {
          activity_mode?: Database["public"]["Enums"]["activity_mode"] | null
          bib_number?: string | null
          certificate_number?: string | null
          challenge_id?: string
          completed_at?: string | null
          id?: string
          participation_photo_url?: string | null
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          target_days?: number | null
          ticket_id?: string | null
          total_km_logged?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "challenge_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strava_subscription_health: {
        Row: {
          callback_url: string | null
          checked_at: string
          error: string | null
          id: string
          raw: Json | null
          status: string
          subscription_id: number | null
        }
        Insert: {
          callback_url?: string | null
          checked_at?: string
          error?: string | null
          id?: string
          raw?: Json | null
          status: string
          subscription_id?: number | null
        }
        Update: {
          callback_url?: string | null
          checked_at?: string
          error?: string | null
          id?: string
          raw?: Json | null
          status?: string
          subscription_id?: number | null
        }
        Relationships: []
      }
      strava_sync_runs: {
        Row: {
          completed: boolean
          created_at: string
          details: Json | null
          duplicate: number
          error: string | null
          fetched: number
          finished_at: string | null
          id: string
          imported: number
          milestones_unlocked: number
          outside_window: number
          reason: string | null
          source: string
          started_at: string
          status: string
          user_id: string
          wrong_sport: number
        }
        Insert: {
          completed?: boolean
          created_at?: string
          details?: Json | null
          duplicate?: number
          error?: string | null
          fetched?: number
          finished_at?: string | null
          id?: string
          imported?: number
          milestones_unlocked?: number
          outside_window?: number
          reason?: string | null
          source: string
          started_at?: string
          status?: string
          user_id: string
          wrong_sport?: number
        }
        Update: {
          completed?: boolean
          created_at?: string
          details?: Json | null
          duplicate?: number
          error?: string | null
          fetched?: number
          finished_at?: string | null
          id?: string
          imported?: number
          milestones_unlocked?: number
          outside_window?: number
          reason?: string | null
          source?: string
          started_at?: string
          status?: string
          user_id?: string
          wrong_sport?: number
        }
        Relationships: []
      }
      strava_tokens: {
        Row: {
          access_token: string
          athlete_avatar_url: string | null
          athlete_city: string | null
          athlete_country: string | null
          athlete_first_name: string | null
          athlete_last_name: string | null
          athlete_username: string | null
          connected_at: string
          expires_at: string
          id: string
          last_synced_at: string | null
          refresh_failed_at: string | null
          refresh_token: string
          scope: string | null
          strava_athlete_id: number | null
          user_id: string
        }
        Insert: {
          access_token: string
          athlete_avatar_url?: string | null
          athlete_city?: string | null
          athlete_country?: string | null
          athlete_first_name?: string | null
          athlete_last_name?: string | null
          athlete_username?: string | null
          connected_at?: string
          expires_at: string
          id?: string
          last_synced_at?: string | null
          refresh_failed_at?: string | null
          refresh_token: string
          scope?: string | null
          strava_athlete_id?: number | null
          user_id: string
        }
        Update: {
          access_token?: string
          athlete_avatar_url?: string | null
          athlete_city?: string | null
          athlete_country?: string | null
          athlete_first_name?: string | null
          athlete_last_name?: string | null
          athlete_username?: string | null
          connected_at?: string
          expires_at?: string
          id?: string
          last_synced_at?: string | null
          refresh_failed_at?: string | null
          refresh_token?: string
          scope?: string | null
          strava_athlete_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strava_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strava_webhook_events: {
        Row: {
          aspect_type: string
          error: string | null
          event_time: number
          id: string
          object_id: number
          object_type: string
          owner_id: number | null
          processed_at: string | null
          received_at: string
          updates: Json | null
        }
        Insert: {
          aspect_type: string
          error?: string | null
          event_time: number
          id?: string
          object_id: number
          object_type: string
          owner_id?: number | null
          processed_at?: string | null
          received_at?: string
          updates?: Json | null
        }
        Update: {
          aspect_type?: string
          error?: string | null
          event_time?: number
          id?: string
          object_id?: number
          object_type?: string
          owner_id?: number | null
          processed_at?: string | null
          received_at?: string
          updates?: Json | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          author_name: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          author_name: string
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          author_name?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_milestones: {
        Row: {
          id: string
          km_at_unlock: number | null
          milestone_id: string
          registration_id: string | null
          share_count: number
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          km_at_unlock?: number | null
          milestone_id: string
          registration_id?: string | null
          share_count?: number
          unlocked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          km_at_unlock?: number | null
          milestone_id?: string
          registration_id?: string | null
          share_count?: number
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_milestones_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "challenge_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_milestones_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_milestones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string
          created_at: string
          icon: string | null
          id: string
          link_url: string | null
          metadata: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          icon?: string | null
          id?: string
          link_url?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          icon?: string | null
          id?: string
          link_url?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      strava_connection_status: {
        Row: {
          athlete_avatar_url: string | null
          athlete_city: string | null
          athlete_country: string | null
          athlete_first_name: string | null
          athlete_last_name: string | null
          athlete_username: string | null
          expires_at: string | null
          last_synced_at: string | null
          refresh_failed_at: string | null
          scope: string | null
          strava_athlete_id: number | null
          user_id: string | null
        }
        Insert: {
          athlete_avatar_url?: string | null
          athlete_city?: string | null
          athlete_country?: string | null
          athlete_first_name?: string | null
          athlete_last_name?: string | null
          athlete_username?: string | null
          expires_at?: string | null
          last_synced_at?: string | null
          refresh_failed_at?: string | null
          scope?: string | null
          strava_athlete_id?: number | null
          user_id?: string | null
        }
        Update: {
          athlete_avatar_url?: string | null
          athlete_city?: string | null
          athlete_country?: string | null
          athlete_first_name?: string | null
          athlete_last_name?: string | null
          athlete_username?: string | null
          expires_at?: string | null
          last_synced_at?: string | null
          refresh_failed_at?: string | null
          scope?: string | null
          strava_athlete_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strava_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _activity_type_matches_mode: {
        Args: { _activity_type: string; _mode: string }
        Returns: boolean
      }
      _registration_logged_km: {
        Args: { _registration_id: string }
        Returns: number
      }
      active_registration: {
        Args: { _user_id: string }
        Returns: {
          activity_mode: string
          challenge_id: string
          challenge_name: string
          challenge_slug: string
          cover_image_url: string
          distance_target_km: number
          registered_at: string
          registration_id: string
          total_km_logged: number
          window_end: string
        }[]
      }
      admin_booking_stats: { Args: { _challenge_id: string }; Returns: Json }
      admin_challenge_participant_stats: {
        Args: { _challenge_id: string }
        Returns: Json
      }
      admin_force_complete_registration: {
        Args: { _registration_id: string }
        Returns: Json
      }
      admin_list_challenge_participants: {
        Args: {
          _challenge_id: string
          _limit?: number
          _offset?: number
          _search?: string
          _status?: string
        }
        Returns: {
          activities_count: number
          activity_mode: string
          amount_paise: number
          avatar_url: string
          booking_number: string
          certificate_number: string
          completed_at: string
          distance_logged_km: number
          distance_remaining_km: number
          distance_target_km: number
          email: string
          full_name: string
          milestones_total: number
          milestones_unlocked: number
          order_id: string
          payment_status: string
          pct_complete: number
          registered_at: string
          registration_id: string
          status: string
          total_count: number
          user_id: string
        }[]
      }
      cancel_active_registration: { Args: never; Returns: Json }
      challenge_leaderboard: {
        Args: { _challenge_id: string; _limit?: number; _offset?: number }
        Returns: {
          activity_mode: string
          avatar_url: string
          full_name: string
          km_logged: number
          milestones_unlocked: number
          pct_complete: number
          user_id: string
        }[]
      }
      challenge_progress: {
        Args: { _challenge_id: string; _user_id: string }
        Returns: {
          activities_count: number
          activity_mode: string
          distance_logged_km: number
          distance_remaining_km: number
          distance_target_km: number
          first_activity_date: string
          is_complete: boolean
          last_activity_date: string
          milestones_total: number
          milestones_unlocked: number
          pct_complete: number
          registered_at: string
          window_end: string
          window_start: string
        }[]
      }
      challenge_progress_by_registration: {
        Args: { _registration_id: string }
        Returns: {
          activities_count: number
          activity_mode: string
          challenge_id: string
          days_left: number
          distance_logged_km: number
          distance_remaining_km: number
          distance_target_km: number
          first_activity_date: string
          is_complete: boolean
          last_activity_date: string
          milestones_total: number
          milestones_unlocked: number
          pct_complete: number
          registered_at: string
          registration_id: string
          user_id: string
          window_end: string
          window_start: string
        }[]
      }
      delete_strava_activity: {
        Args: { _strava_activity_id: number; _user_id: string }
        Returns: Json
      }
      expire_registrations: { Args: { _user_id?: string }; Returns: number }
      get_public_club_by_slug: {
        Args: { _slug: string }
        Returns: {
          banner_url: string
          category_id: string
          club_type: string
          created_at: string
          created_by: string
          description: string
          discount_cart_percent: number
          discount_challenge_percent: number
          established_at: string
          id: string
          is_public: boolean
          logo_url: string
          member_count: number
          meta_description: string
          meta_keywords: string[]
          meta_title: string
          name: string
          priority: number
          promoter_city: string
          promoter_description: string
          promoter_id: string
          promoter_name: string
          promoter_state: string
          slug: string
          social_links: Json
          status: string
          tags: string[]
          updated_at: string
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      global_leaderboard: {
        Args: { _limit?: number; _offset?: number }
        Returns: {
          avatar_url: string
          challenges_completed: number
          city: string
          full_name: string
          km_all_time: number
          km_this_month: number
          user_id: string
        }[]
      }
      hall_of_fame: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          challenge_id: string
          challenge_name: string
          challenge_slug: string
          full_name: string
          unlocked_at: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_usage: { Args: { _code: string }; Returns: Json }
      ingest_strava_activities: {
        Args: { _activities: Json; _user_id: string }
        Returns: Json
      }
      ingest_strava_activity: {
        Args: { _activity: Json; _user_id: string }
        Returns: Json
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_club_member: {
        Args: { _club_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      last_strava_sync_run: {
        Args: { _user_id: string }
        Returns: {
          completed: boolean
          duplicate: number
          error: string
          fetched: number
          finished_at: string
          id: string
          imported: number
          milestones_unlocked: number
          outside_window: number
          reason: string
          source: string
          started_at: string
          status: string
          wrong_sport: number
        }[]
      }
      list_club_members: {
        Args: { _club_id: string }
        Returns: {
          activities_count: number
          avatar_url: string
          challenges_completed: number
          city: string
          full_name: string
          is_owner: boolean
          joined_at: string
          membership_id: string
          role: string
          total_distance_km: number
          user_id: string
        }[]
      }
      list_public_clubs: {
        Args: never
        Returns: {
          banner_url: string
          category_id: string
          club_type: string
          created_at: string
          created_by: string
          description: string
          discount_cart_percent: number
          discount_challenge_percent: number
          established_at: string
          id: string
          is_public: boolean
          logo_url: string
          member_count: number
          meta_description: string
          meta_keywords: string[]
          meta_title: string
          name: string
          priority: number
          promoter_city: string
          promoter_description: string
          promoter_id: string
          promoter_name: string
          promoter_state: string
          slug: string
          social_links: Json
          status: string
          tags: string[]
          updated_at: string
        }[]
      }
      log_manual_activity: {
        Args: {
          _activity_date: string
          _activity_type: string
          _distance_km: number
          _notes?: string
          _registration_id: string
        }
        Returns: Json
      }
      recent_strava_sync_runs: {
        Args: { _limit?: number; _user_id: string }
        Returns: {
          completed: boolean
          duplicate: number
          error: string
          fetched: number
          finished_at: string
          id: string
          imported: number
          milestones_unlocked: number
          outside_window: number
          reason: string
          source: string
          started_at: string
          status: string
          wrong_sport: number
        }[]
      }
      recompute_club_member_count: {
        Args: { _club_id?: string }
        Returns: number
      }
      register_for_challenge: {
        Args: {
          _activity_mode: string
          _challenge_id: string
          _target_days: number
          _ticket_id: string
          _user_id: string
        }
        Returns: Json
      }
      subscribe_to_newsletter: {
        Args: { _email: string; _source?: string }
        Returns: Json
      }
      validate_coupon: {
        Args: { _code: string; _subtotal: number }
        Returns: Json
      }
    }
    Enums: {
      activity_mode: "run" | "walk" | "ride" | "any"
      activity_source: "strava" | "manual" | "abr_app"
      app_role:
        | "admin"
        | "user"
        | "club_owner"
        | "content_manager"
        | "super_admin"
      club_role: "member" | "admin" | "owner"
      media_type: "image" | "audio" | "video"
      newsletter_status: "subscribed" | "unsubscribed"
      order_status: "created" | "paid" | "failed" | "refunded"
      registration_status:
        | "pending_payment"
        | "active"
        | "completed"
        | "abandoned"
        | "expired"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_mode: ["run", "walk", "ride", "any"],
      activity_source: ["strava", "manual", "abr_app"],
      app_role: [
        "admin",
        "user",
        "club_owner",
        "content_manager",
        "super_admin",
      ],
      club_role: ["member", "admin", "owner"],
      media_type: ["image", "audio", "video"],
      newsletter_status: ["subscribed", "unsubscribed"],
      order_status: ["created", "paid", "failed", "refunded"],
      registration_status: [
        "pending_payment",
        "active",
        "completed",
        "abandoned",
        "expired",
        "cancelled",
      ],
    },
  },
} as const
