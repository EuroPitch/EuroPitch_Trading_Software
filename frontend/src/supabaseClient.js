import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://ldnulhfgydllhmjwzchm.supabase.co"
const supabaseAnonKey = "sb_publishable_6_OGwp0MbLW9nxB3iQuncA_35rO1sd-"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)