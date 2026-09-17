const SUPABASE_URL = "https://wuxuxxdikaacggwqivmm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CSAhfjltolelqD_LgpB9gQ_EkxjkEhp";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function exigirSessao() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}
