const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❗ SUPABASE_URL or SUPABASE_ANON_KEY not set in environment');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
