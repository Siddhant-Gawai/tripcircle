import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=process.env;
if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for this server-side script only.');
const client=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const destinations=JSON.parse(await readFile(new URL('../supabase/destinations.json',import.meta.url),'utf8'));
const {error}=await client.from('tripcircle_destinations').upsert(destinations);if(error)throw error;
const {error:planError}=await client.from('tripcircle_plan').upsert({id:1,title:'Ahmedabad escapes',dates:'30 Oct–1 Nov or 20–22 Nov 2026',notes:'6–7 friends. Simple private stays. No resorts. Confirm accommodation, transport and access before booking.'});if(planError)throw planError;
console.log('TripCircle seed saved.');
