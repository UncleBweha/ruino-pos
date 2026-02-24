import { createClient } from 'npm:@supabase/supabase-js@2'

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

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('Request received:', req.method, req.url)

    // Get the authorization header to verify the requester is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Verify the requester
    const { data: { user: requester }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !requester) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Check if requester is an admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requester.id)
      .single()

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const body = await req.json()
    const { userId } = body
    console.log('Target userId:', userId)

    if (!userId) {
      console.error('UserId is missing in request body')
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Prevent self-deletion
    if (userId === requester.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete your own account' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Instead of deleting the user, we deactivate them by removing their role
    // and updating their profile, while preserving the auth user for audit trail (sales records)

    // 1. Remove user roles
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)

    if (roleError) {
      return new Response(
        JSON.stringify({ error: `Failed to remove roles: ${roleError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 2. Update profile name to indicate deactivation (optional but helpful for audit)
    // First get current profile
    console.log('Fetching profile for user_id:', userId)
    const { data: profile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('user_id', userId)
      .single()

    if (profileFetchError) {
      console.error('Error fetching profile:', profileFetchError)
    }

    if (profile && !profile.full_name.includes('[DEACTIVATED]')) {
      console.log('Deactivating profile for:', profile.full_name)
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ full_name: `${profile.full_name} [DEACTIVATED]` })
        .eq('user_id', userId)

      if (updateError) {
        console.error('Error updating profile:', updateError)
      }
    }

    console.log('User deactivated successfully')

    return new Response(
      JSON.stringify({ success: true, message: 'User deactivated successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error in delete-user:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
