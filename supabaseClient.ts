
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grnwpolxrwscmumshmrs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdybndwb2x4cndzY211bXNobXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0MjE3OTgsImV4cCI6MjA4Mjk5Nzc5OH0.H-ekbgday8zRI8-D-qbrbOQ6X4NFa1ORrkMv0AtPPO4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
