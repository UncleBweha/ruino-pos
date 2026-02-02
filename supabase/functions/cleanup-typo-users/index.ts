import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Find all users with @ruino.local (typo domain)
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) throw listError

    const typoUsers = users.users.filter(u => u.email?.endsWith('@ruino.local'))
    const results = []

    for (const user of typoUsers) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
      results.push({
        email: user.email,
        success: !error,
        error: error?.message
      })
    }

    return new Response(
      JSON.stringify({ 
        message: `Deleted ${results.filter(r => r.success).length} users with @ruino.local`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
