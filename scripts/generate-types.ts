import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or Anon Key in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateTypes() {
  try {
    const { data, error } = await supabase.rpc('get_types', {});
    
    if (error) {
      console.error('Error generating types:', error);
      process.exit(1);
    }

    const typesPath = path.join(process.cwd(), 'src/types/supabase.ts');
    fs.writeFileSync(typesPath, `// Generated on ${new Date().toISOString()}\n\n`);
    fs.appendFileSync(typesPath, 'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]\n\n');
    
    fs.appendFileSync(typesPath, 'export interface Database {\n  public: {\n    Tables: {\n');
    
    // Add your table types here based on the data from get_types
    // This is a simplified example - you'll need to adjust based on your actual database schema
    fs.appendFileSync(typesPath, `      users: {\n`);
    fs.appendFileSync(typesPath, `        Row: {\n`);
    fs.appendFileSync(typesPath, `          id: string\n`);
    fs.appendFileSync(typesPath, `          email: string\n`);
    fs.appendFileSync(typesPath, `          senha: string\n`);
    fs.appendFileSync(typesPath, `          nome: string | null\n`);
    fs.appendFileSync(typesPath, `          telefone: string | null\n`);
    fs.appendFileSync(typesPath, `          avatar: string | null\n`);
    fs.appendFileSync(typesPath, `          created_at: string\n`);
    fs.appendFileSync(typesPath, `          updated_at: string | null\n`);
    fs.appendFileSync(typesPath, `        }\n`);
    fs.appendFileSync(typesPath, `        Insert: {\n`);
    fs.appendFileSync(typesPath, `          id?: string\n`);
    fs.appendFileSync(typesPath, `          email: string\n`);
    fs.appendFileSync(typesPath, `          senha: string\n`);
    fs.appendFileSync(typesPath, `          nome?: string | null\n`);
    fs.appendFileSync(typesPath, `          telefone?: string | null\n`);
    fs.appendFileSync(typesPath, `          avatar?: string | null\n`);
    fs.appendFileSync(typesPath, `          created_at?: string\n`);
    fs.appendFileSync(typesPath, `          updated_at?: string | null\n`);
    fs.appendFileSync(typesPath, `        }\n`);
    fs.appendFileSync(typesPath, `        Update: {\n`);
    fs.appendFileSync(typesPath, `          id?: string\n`);
    fs.appendFileSync(typesPath, `          email?: string\n`);
    fs.appendFileSync(typesPath, `          senha?: string\n`);
    fs.appendFileSync(typesPath, `          nome?: string | null\n`);
    fs.appendFileSync(typesPath, `          telefone?: string | null\n`);
    fs.appendFileSync(typesPath, `          avatar?: string | null\n`);
    fs.appendFileSync(typesPath, `          created_at?: string\n`);
    fs.appendFileSync(typesPath, `          updated_at?: string | null\n`);
    fs.appendFileSync(typesPath, `        }\n`);
    fs.appendFileSync(typesPath, `      }\n`);
    
    fs.appendFileSync(typesPath, '    }\n');
    fs.appendFileSync(typesPath, '  }\n');
    fs.appendFileSync(typesPath, '}\n');
    
    console.log('Types generated successfully at src/types/supabase.ts');
  } catch (error) {
    console.error('Error generating types:', error);
    process.exit(1);
  }
}

generateTypes();
