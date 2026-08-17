console.log(' NUNI app.js chargé — version K4 (Vrai système de clips : publication, partage, vues uniques)');

// ============ OUVERTURE WHATSAPP — sans écran blanc sur mobile ============
// Avant : window.open(url, '_blank') partout. Sur ordinateur ça marche, mais sur mobile
// (surtout iOS/PWA), '_blank' réserve un nouvel onglet Safari AVANT que le lien wa.me ne
// bascule vers l'app WhatsApp elle-même — cet onglet réservé ne reçoit jamais de contenu et
// reste blanc, abandonné derrière l'app WhatsApp qui s'ouvre. Ici : sur mobile, on navigue
// directement dans l'onglet en cours (pas de nouvel onglet à abandonner) ; sur ordinateur,
// on garde le nouvel onglet (WhatsApp Web s'y ouvre normalement, NUNI reste ouvert derrière).
function openWhatsApp(url){
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if(isMobile){ window.location.href = url; }
  else{ window.open(url, '_blank'); }
}

/* ============ ÉCRAN PLEIN ÉCRAN — PASS EXPIRÉ ============
   Façon plateforme premium (Spotify, Netflix...) : dès que l'abonnement d'un compte n'est
   plus réellement actif (Pass Auditeur/Artiste expiré, ou essai Pass Découverte de 24h
   terminé), TOUT le reste de l'app reste inaccessible derrière cet écran. Jamais fermable
   par un clic extérieur ou la touche Échap — seule une vraie action (renouveler sur
   WhatsApp, saisir un nouveau code d'accès, ou se déconnecter) permet d'en sortir. Se
   déclenche à la connexion, à la restauration de session, ET en direct pendant une session
   déjà ouverte si le Pass expire pendant que la personne est en train d'utiliser NUNI (voir
   startAccountStatusWatcher, qui vérifie le vrai statut toutes les 2 minutes). */
/* ============ VÉRIFICATION D'EMAIL — nudge non bloquant ============
   Contrairement à l'écran plein écran "Pass expiré" (vraiment bloquant), celui-ci se ferme
   librement — la personne peut continuer à explorer le catalogue. Mais la vraie écoute reste
   verrouillée côté serveur tant que le code n'est pas confirmé (voir hasStreamingAccess dans
   server.js) : dès qu'elle essaiera de lancer un morceau, playTrack() la ramènera ici. */
function ensureEmailVerifyStyles(){
  if(document.getElementById('email-verify-styles')) return;
  const style = document.createElement('style');
  style.id = 'email-verify-styles';
  style.textContent = `
    #email-verify-overlay{position:fixed; inset:0; z-index:99000; background:rgba(0,0,0,.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; opacity:0; transition:opacity .2s ease;}
    #email-verify-overlay.show{opacity:1;}
    #ev-card{width:100%; max-width:360px; background:var(--bg-elev); border:1px solid var(--border); border-radius:20px; padding:26px 24px; text-align:center; box-shadow:0 24px 60px -16px rgba(0,0,0,.55);}
    #ev-card .ev-icon{width:52px; height:52px; margin:0 auto 16px; border-radius:50%; background:var(--grad-envol); display:flex; align-items:center; justify-content:center; color:#241708;}
    #ev-card .ev-icon svg{width:24px; height:24px;}
    #ev-card h4{font-size:17px; font-weight:700; margin:0 0 8px;}
    #ev-card p{font-size:13px; color:var(--text-dim); line-height:1.55; margin:0 0 18px;}
    #ev-card input{width:100%; box-sizing:border-box; padding:13px; border-radius:12px; border:1px solid var(--border); background:var(--bg-card); color:var(--text); font-size:20px; font-weight:700; letter-spacing:6px; text-align:center; margin-bottom:14px;}
    #ev-card input:focus{ outline:none; border-color:var(--accent); }
    #ev-card .ev-btn-primary{width:100%; padding:13px; border-radius:999px; border:none; cursor:pointer; background:var(--grad-envol); color:#241708; font-weight:700; font-size:14px; margin-bottom:10px;}
    #ev-card .ev-btn-primary:disabled{opacity:.6; cursor:default;}
    #ev-card .ev-resend{background:none; border:none; color:var(--accent); font-size:12.5px; cursor:pointer; font-weight:600;}
    #ev-card .ev-later{display:block; margin:14px auto 0; background:none; border:none; color:var(--text-faint); font-size:12px; text-decoration:underline; cursor:pointer;}
    #ev-card .ev-feedback{font-size:12.5px; margin-bottom:10px; min-height:16px;}
  `;
  document.head.appendChild(style);
}
function openEmailVerifyModal(){
  // Garde explicite : les comptes Label n'ont pas de Pass Découverte au sens
  // Consommateur/Artiste — cette modale ne les concerne jamais, même si un enchaînement de
  // conditions ailleurs venait à changer.
  if(!currentUser || currentUser.email_verified || currentUser.account_type === 'label') return;
  ensureEmailVerifyStyles();
  let overlay = document.getElementById('email-verify-overlay');
  if(overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'email-verify-overlay';
  overlay.innerHTML = `
    <div id="ev-card">
      <div class="ev-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/></svg></div>
      <h4>Confirmez votre email</h4>
      <p>On vient d'envoyer un code à <b>${esc(currentUser.email||'')}</b>. Entrez-le pour débloquer l'écoute complète de votre Pass Découverte.</p>
      <div class="ev-feedback" id="ev-feedback"></div>
      <input type="text" id="ev-code-input" maxlength="6" inputmode="numeric" placeholder="••••••">
      <button class="ev-btn-primary" id="ev-submit-btn">Confirmer</button>
      <button class="ev-resend" id="ev-resend-btn">Je n'ai pas reçu de code — renvoyer</button>
      <button class="ev-later" id="ev-later-btn">Plus tard</button>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=> overlay.classList.add('show'));
  overlay.onclick = (e)=>{ if(e.target === overlay) closeEmailVerifyModal(); };
  document.getElementById('ev-later-btn').onclick = closeEmailVerifyModal;
  document.getElementById('ev-code-input').focus();
  document.getElementById('ev-code-input').onkeydown = (e)=>{ if(e.key === 'Enter') submitEmailVerifyCode(); };
  document.getElementById('ev-submit-btn').onclick = submitEmailVerifyCode;
  document.getElementById('ev-resend-btn').onclick = resendEmailVerifyCode;
}
function closeEmailVerifyModal(){
  const overlay = document.getElementById('email-verify-overlay');
  if(!overlay) return;
  overlay.classList.remove('show');
  setTimeout(()=> overlay.remove(), 200);
}
async function submitEmailVerifyCode(){
  const feedback = document.getElementById('ev-feedback');
  const btn = document.getElementById('ev-submit-btn');
  const code = document.getElementById('ev-code-input').value.trim();
  if(!code){ feedback.style.color = 'var(--rose-braise)'; feedback.textContent = 'Entrez le code reçu par email.'; return; }
  btn.disabled = true;
  feedback.style.color = 'var(--text-faint)';
  feedback.textContent = 'Vérification…';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/auth/verify-email', {
      method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+realAuthToken},
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    btn.disabled = false;
    if(!res.ok){ feedback.style.color = 'var(--rose-braise)'; feedback.textContent = data.error; return; }
    currentUser = data.user || currentUser;
    if(currentUser) currentUser.email_verified = true;
    saveSession(realAuthToken, currentUser, true);
    toast('Email confirmé — bienvenue sur NUNI en intégralité !');
    closeEmailVerifyModal();
    loadRealTracks(); // débloque enfin l'écoute réelle — même raison que pour l'activation d'un Pass
  }catch(e){ btn.disabled = false; feedback.style.color = 'var(--rose-braise)'; feedback.textContent = 'Impossible de contacter le serveur NUNI.'; }
}
async function resendEmailVerifyCode(){
  const feedback = document.getElementById('ev-feedback');
  feedback.style.color = 'var(--text-faint)';
  feedback.textContent = 'Envoi en cours…';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/auth/resend-verification', {
      method:'POST', headers:{'Authorization':'Bearer '+realAuthToken},
    });
    const data = await res.json();
    feedback.style.color = res.ok ? '#7FC79A' : 'var(--rose-braise)';
    feedback.textContent = data.message || data.error;
  }catch(e){ feedback.style.color = 'var(--rose-braise)'; feedback.textContent = 'Impossible de contacter le serveur NUNI.'; }
}

function ensurePassExpiredStyles(){
  if(document.getElementById('pass-expired-styles')) return;
  const style = document.createElement('style');
  style.id = 'pass-expired-styles';
  style.textContent = `
    #pass-expired-overlay{
      position:fixed; inset:0; z-index:100000; background:#0A0A10;
      display:flex; align-items:center; justify-content:center; padding:24px;
      opacity:0; transition:opacity .3s ease;
    }
    #pass-expired-overlay.show{ opacity:1; }
    #pass-expired-overlay::before{
      content:''; position:absolute; inset:0;
      background:radial-gradient(60% 50% at 50% 0%, rgba(212,175,106,.14) 0%, transparent 70%);
      pointer-events:none;
    }
    .pex-card{ position:relative; max-width:420px; width:100%; text-align:center; animation:pexPopIn .4s cubic-bezier(.22,1,.36,1); }
    @keyframes pexPopIn{ from{ opacity:0; transform:translateY(12px) scale(.97); } to{ opacity:1; transform:translateY(0) scale(1); } }
    .pex-icon{ width:64px; height:64px; margin:0 auto 22px; border-radius:50%; background:linear-gradient(135deg,#C9667A,#6E45A8); display:flex; align-items:center; justify-content:center; box-shadow:0 12px 30px -10px rgba(201,102,122,.5); }
    .pex-icon svg{ width:30px; height:30px; color:#fff; }
    .pex-title{ font-family:var(--font-display); font-size:24px; font-weight:700; color:#fff; margin-bottom:10px; }
    .pex-sub{ font-size:14px; color:#9a9aa5; line-height:1.6; margin-bottom:30px; }
    .pex-sub b{ color:#D4AF6A; }
    .pex-btn-primary{
      width:100%; padding:14px; border-radius:999px; border:none; cursor:pointer;
      background:linear-gradient(135deg,#25D366,#1DA851); color:#fff; font-weight:700; font-size:14.5px;
      display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:12px;
      font-family:var(--font-body);
    }
    .pex-btn-primary:hover{ filter:brightness(1.08); }
    .pex-btn-secondary{
      width:100%; padding:13px; border-radius:999px; cursor:pointer;
      background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); color:#fff;
      font-weight:600; font-size:13.5px; margin-bottom:22px; font-family:var(--font-body);
    }
    .pex-btn-secondary:hover{ background:rgba(255,255,255,.1); }
    .pex-logout{ font-size:12.5px; color:#6a6a75; text-decoration:underline; cursor:pointer; background:none; border:none; font-family:var(--font-body); }
    .pex-logout:hover{ color:#9a9aa5; }
  `;
  document.head.appendChild(style);
}
function showPassExpiredOverlay(){
  // Garde explicite : un compte Label suit son abonnement via labels.subscription_expires_at
  // (colonne à part, gérée par l'admin) — pas via users.subscription_status comme
  // Consommateur/Artiste. Cet écran ne les concerne jamais, même par accident.
  if(!currentUser || currentUser.account_type === 'label' || document.getElementById('pass-expired-overlay')) return; // jamais dupliqué
  ensurePassExpiredStyles();
  stopAllPlayback(); // un Pass expiré bloque vraiment tout, y compris un son déjà en cours
  const isDiscovery = currentUser.plan === 'discovery';
  const planLabel = isDiscovery ? 'Votre essai gratuit' : (currentUser.plan === 'artist' ? 'Votre Pass Artiste' : 'Votre Pass Auditeur');
  const expLabel = currentUser.subscription_expires_at
    ? new Date(currentUser.subscription_expires_at).toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'})
    : null;

  const overlay = document.createElement('div');
  overlay.id = 'pass-expired-overlay';
  overlay.innerHTML = `
    <div class="pex-card">
      <div class="pex-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div>
      <div class="pex-title">${isDiscovery ? 'Votre essai gratuit est terminé' : 'Votre Pass a expiré'}</div>
      <div class="pex-sub">${esc(planLabel)}${expLabel ? ` a expiré le <b>${expLabel}</b>` : " n'est plus actif"}. Réactivez-le pour continuer à profiter de NUNI en intégralité.</div>
      <button class="pex-btn-primary" id="pex-renew-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A11 11 0 0 0 3 17L2 22l5.2-1.4A11 11 0 1 0 20.5 3.5z"/></svg>
        Renouveler sur WhatsApp
      </button>
      <button class="pex-btn-secondary" id="pex-code-btn">J'ai déjà un code d'accès</button>
      <button class="pex-logout" id="pex-logout-btn">Se déconnecter</button>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(()=> overlay.classList.add('show'));

  document.getElementById('pex-renew-btn').onclick = ()=>{
    if(currentUser) choosePlan(currentUser.account_type === 'artist' ? 'artist' : 'consumer', isDiscovery);
  };
  document.getElementById('pex-code-btn').onclick = ()=>{
    hidePassExpiredOverlay(); // laisse revenir taper un nouveau code déjà reçu par WhatsApp
    goTo('plans');
  };
  document.getElementById('pex-logout-btn').onclick = ()=>{
    hidePassExpiredOverlay();
    logoutUser();
  };
  // Volontairement AUCUN moyen de fermer par un clic extérieur ou la touche Échap — un Pass
  // expiré bloque vraiment tout, comme sur les plateformes premium (Spotify, Netflix...).
}
function hidePassExpiredOverlay(){
  const overlay = document.getElementById('pass-expired-overlay');
  if(!overlay) return;
  overlay.classList.remove('show');
  document.body.style.overflow = '';
  setTimeout(()=> overlay.remove(), 300);
}

/* ============ POSITIONNEMENT RÉEL DE LA BULLE MIMI ============
   Avant : la distance du bas dépendait d'une classe CSS "no-player" à synchroniser
   manuellement à chaque endroit où la barre lecteur apparaît/disparaît — facile à
   oublier, et ça finissait par faire flotter Mimi au milieu du contenu (ex. par-dessus
   le texte de la bannière NUNI Radio) au lieu de rester juste au-dessus des vraies
   barres visibles. Ici : on mesure la vraie hauteur des barres réellement affichées
   (tabbar mobile + barre lecteur, uniquement si visibles) et on positionne Mimi
   juste au-dessus, à chaque changement d'état — plus de désynchronisation possible. */
function positionMimiWidget(){
  const widget = document.getElementById('mimi-widget');
  if(!widget) return;
  const tabbar = document.getElementById('mobile-tabbar');
  const playerBar = document.getElementById('player-bar');
  let clearance = 20;
  if(tabbar && getComputedStyle(tabbar).display !== 'none' && tabbar.offsetHeight){
    clearance = tabbar.offsetHeight + 14;
  }
  if(playerBar && getComputedStyle(playerBar).display !== 'none' && playerBar.offsetHeight){
    clearance += playerBar.offsetHeight + 14;
  }
  widget.style.bottom = `calc(${clearance}px + env(safe-area-inset-bottom,0))`;
}
window.addEventListener('load', positionMimiWidget);
window.addEventListener('resize', positionMimiWidget);
positionMimiWidget(); // premier calcul immédiat (le DOM est déjà prêt à ce point du script)
// Filet de sécurité : si jamais l'affichage de la tabbar ou de la barre lecteur change
// sans passer par un endroit connu, on se recale quand même automatiquement.
['mobile-tabbar','player-bar'].forEach(id=>{
  const el = document.getElementById(id);
  if(el) new MutationObserver(positionMimiWidget).observe(el, { attributes:true, attributeFilter:['style','class'] });
});

/* ============ ÉCRAN DE CHARGEMENT (SPLASH) ============
   Logo figé, aucune animation — juste une courte pause premium (façon Spotify/Apple
   Music) le temps que la restauration de session se termine, plafonnée pour ne jamais
   bloquer l'utilisateur si le réseau est lent. */
let sessionRestorePromise = null; // rempli plus bas, dès que restoreSession() démarre — lu par le splash ci-dessous
function runSplashSequence(){
  const el = document.getElementById('splash-screen');
  if(!el) return;
  // Attend que la vérification de session (reconnexion automatique) soit terminée avant de
  // révéler quoi que ce soit derrière l'écran de démarrage — évite le "flash" de l'écran
  // d'accueil avant de retrouver directement son compte. Plafonné à 1,2s max.
  const waitFor = sessionRestorePromise
    ? Promise.race([sessionRestorePromise, new Promise(r=> setTimeout(r, 1200))])
    : new Promise(r=> setTimeout(r, 700)); // pause premium minimale même hors ligne, comme un vrai écran de lancement
  waitFor.then(()=>{
    setTimeout(()=>{
      el.classList.add('fade-out');
      setTimeout(()=> el.remove(), 650);
    }, 260);
  });
}
runSplashSequence();
window.addEventListener('offline', ()=> toast('Connexion perdue — mode hors ligne, contenu limité à ce qui est déjà chargé.'));
window.addEventListener('online', ()=> toast('Connexion rétablie ️'));
/* ============ HELPERS ============ */
function ico(name){
  if(name==='check') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>';
  return '';
}
// resolve the ${ico('check')} placeholders inserted as literal text (since this is plain HTML, not templated)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.plan-card li, .badge-verified').forEach(el=>{
    el.innerHTML = el.innerHTML.replace(/\$\{ico\('check'\)\}/g, ico('check'));
  });
  // split wordmark letters so they can pulse to the rhythm when music plays
  document.querySelectorAll('.wordmark').forEach(el=>{
    const text = el.textContent;
    el.innerHTML = '';
    [...text].forEach((ch,i)=>{
      const span = document.createElement('span');
      span.className = 'beat-letter';
      span.style.setProperty('--i', i);
      span.textContent = ch;
      el.appendChild(span);
    });
  });
});

/* ============ THEME — automatique selon l'heure de l'appareil ============
   Avant : bascule manuelle clair/sombre choisie une fois par la personne, mémorisée en
   localStorage, jamais réévaluée ensuite. Maintenant : entièrement automatique — clair le
   jour (6h-18h, heure de l'appareil), sombre la nuit, réévalué toutes les 5 minutes pour
   suivre le vrai passage jour/nuit si l'app reste ouverte longtemps. Le bouton de bascule
   manuelle reste dans le DOM (au cas où) mais est masqué en CSS — plus aucune action de la
   personne n'est nécessaire ni possible pour changer le thème. */
const NUNI_THEME_KEY = 'nuni_theme';
let theme = 'dark';
function computeAutoTheme(){
  const hour = new Date().getHours();
  return (hour >= 6 && hour < 18) ? 'light' : 'dark';
}
function applyAutoTheme(){
  const next = computeAutoTheme();
  if(next === theme) return;
  theme = next;
  document.documentElement.setAttribute('data-theme', theme);
  applyThemeIcon();
}
theme = computeAutoTheme();
document.documentElement.setAttribute('data-theme', theme);
function applyThemeIcon(){
  const isDark = theme === 'dark';
  document.querySelectorAll('#theme-icon-home, #theme-icon-app').forEach(svg=>{
    svg.innerHTML = isDark
      ? '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>'
      : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  });
}
applyThemeIcon();
setInterval(applyAutoTheme, 5 * 60 * 1000);

/* ============ ROTATING MESSAGES ============ */
const messages = [
  "Chaque écoute change une vie.",
  "Chaque artiste mérite son public.",
  "Votre abonnement construit l'avenir de notre musique.",
  "La culture se protège en la soutenant.",
  "Plus NUNI grandit, plus la valeur de chaque stream augmente."
];
let msgIndex = 0;
setInterval(()=>{
  msgIndex = (msgIndex+1) % messages.length;
  const el = document.getElementById('rotating-msg');
  el.style.opacity = 0;
  setTimeout(()=>{ el.textContent = messages[msgIndex]; el.style.opacity = 1; }, 400);
}, 3200);

/* ============ ÉCHAPPEMENT HTML — CORRECTIF SÉCURITÉ CRITIQUE ============
   Avant : aucune donnée saisie par un compte (titre de morceau, nom d'artiste, bio,
   description de playlist, nom de concert...) n'était jamais échappée avant d'être injectée
   directement en HTML (innerHTML/insertAdjacentHTML) — visible par TOUS les visiteurs du
   site, pas seulement l'admin. N'importe quel compte artiste pouvait donc placer un script
   dans le titre d'un morceau ou sa bio, qui s'exécutait dans le navigateur de CHAQUE
   personne consultant cette page (catalogue, recherche, page artiste...), avec accès à sa
   session (realAuthToken en localStorage). Toute donnée venant d'un compte utilisateur doit
   désormais passer par esc() avant d'être insérée dans un template HTML. */
function esc(v){
  if(v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============ TOAST ============ */
let toastTimer;
function toast(text){
  const t = document.getElementById('toast');
  document.getElementById('toast-text').textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove('show'), 3200);
}

/* ============ NAVIGATION ============ */
function goTo(screen){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('app-shell').classList.remove('active');
  document.getElementById('player-bar').style.display = 'none';
  document.documentElement.classList.remove('has-player-bar');
  document.getElementById('mobile-tabbar').style.display = 'none';
  document.getElementById('demo-nav').classList.add('no-player');
  document.getElementById('mimi-widget').classList.add('no-player');
  if(screen==='home'){
    const homeScreen = document.getElementById('screen-home');
    homeScreen.classList.add('active');
    // Rejoue l'effet d'entrée à chaque fois (ex: après une déconnexion) — purement
    // cosmétique, retiré après coup ; le contenu reste visible même si ça ne joue pas.
    homeScreen.classList.remove('play-intro');
    void homeScreen.offsetWidth; // force le navigateur à "oublier" l'état précédent avant de rejouer
    homeScreen.classList.add('play-intro');
  }
  if(screen==='plans'){ document.getElementById('screen-plans').classList.add('active'); }
  window.scrollTo({top:0, behavior:'smooth'});
}

let pendingPlanType = null;

/* ============ SYSTÈME DE CODES PROMO (vraie vérification côté serveur) ============ */
const BASE_PRICE_TRIM = 650; // Pass Auditeur trimestriel
let appliedPromo = null;

async function applyPromoCode(){
  const input = document.getElementById('promo-input');
  const code = input.value.trim().toUpperCase();
  const feedback = document.getElementById('promo-feedback');
  feedback.className = '';
  feedback.innerHTML = '';

  if(!code){ feedback.className='error'; feedback.textContent='Entrez un code promotionnel.'; return; }

  feedback.textContent = 'Vérification en cours…';

  let data, ok;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/promo/validate', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ code, plan: 'consumer' })
    });
    data = await res.json();
    ok = res.ok;
  }catch(e){
    feedback.className = 'error';
    feedback.textContent = 'Impossible de vérifier ce code — vérifiez votre connexion internet.';
    return;
  }

  if(!ok){
    feedback.className = 'error';
    feedback.textContent = data.error || 'Code promotionnel invalide ou expiré.';
    document.getElementById('promo-price-trim').textContent = '650 FCFA';
    appliedPromo = null;
    return;
  }

  appliedPromo = { code: data.code, pct: data.discount_pct };
  const discount = Math.round(BASE_PRICE_TRIM * data.discount_pct / 100);
  const newPrice = BASE_PRICE_TRIM - discount;
  document.getElementById('promo-price-trim').innerHTML = `<span class="old-price">650 FCFA</span> <span class="new-price">${newPrice.toLocaleString('fr-FR')} FCFA</span>`;

  feedback.className = 'success';
  feedback.innerHTML = `
    <span class="promo-badge"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg> -${data.discount_pct}% appliqué</span>
    <div class="promo-breakdown">
      Prix initial : 650 FCFA<br>
      Réduction : -${data.discount_pct}%<br>
      Total : <b>${newPrice.toLocaleString('fr-FR')} FCFA</b> / trimestre
    </div>`;
  toast(`Code ${data.code} appliqué — ${data.discount_pct}% de réduction sur le trimestre.`);
}

/* ============ CONNEXION AU VRAI SERVEUR NUNI (Railway) ============ */
const NUNI_API_BASE = 'https://nuni-backend.onrender.com';
let realAuthToken = null;
let realUserId = null;
let currentUser = null; // infos complètes (prénom, nom...) de la personne connectée

/* ============ SESSION PERSISTANTE ============ */
// "Se souvenir de moi" coché -> localStorage (survit à la fermeture du navigateur)
// décoché -> sessionStorage (effacé à la fermeture de l'onglet)
const NUNI_SESSION_KEY = 'nuni_session';
function saveSession(token, user, remember){
  try{
    const payload = JSON.stringify({ token, userId: user.id });
    if(remember){
      localStorage.setItem(NUNI_SESSION_KEY, payload);
      sessionStorage.removeItem(NUNI_SESSION_KEY);
    } else {
      sessionStorage.setItem(NUNI_SESSION_KEY, payload);
      localStorage.removeItem(NUNI_SESSION_KEY);
    }
  }catch(e){ /* stockage indisponible (navigation privée très restrictive) : tant pis, pas bloquant */ }
}
function clearSession(){
  try{
    localStorage.removeItem(NUNI_SESSION_KEY);
    sessionStorage.removeItem(NUNI_SESSION_KEY);
  }catch(e){}
}
function readStoredSession(){
  try{
    const raw = localStorage.getItem(NUNI_SESSION_KEY) || sessionStorage.getItem(NUNI_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
async function restoreSession(){
  const stored = readStoredSession();
  if(!stored || !stored.token){
    // Personne n'est connecté : s'assurer que la tabbar mobile, la barre lecteur et Mimi
    // restent cachées sur l'écran de connexion (avant, rien ne les cachait explicitement
    // au tout premier chargement — elles ne l'étaient qu'après une déconnexion manuelle).
    goTo('home');
    return;
  }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me', { headers:{ 'Authorization':'Bearer ' + stored.token } });
    if(!res.ok){
      // Compte suspendu/supprimé DEPUIS l'émission du token : on le détecte ici, à la toute
      // première requête de la session, pas seulement à la reconnexion manuelle. On informe
      // clairement plutôt que de renvoyer silencieusement vers l'accueil sans explication.
      const errData = await res.json().catch(()=>({}));
      clearSession();
 if(res.status === 403 && errData.error){ toast(' ' + errData.error); }
      return;
    }
    const data = await res.json();
    realAuthToken = stored.token;
    startAccountStatusWatcher();
    syncLikedTracksFromServer();
    loadProgress();
    // Le tout premier loadRealTracks() (déclenché au chargement du script, avant que cette
    // restauration de session asynchrone n'ait fini) tournait sans jeton — le catalogue
    // affichait donc des liens audio vides même pour un compte réellement actif, jusqu'à un
    // rechargement manuel. On le relance maintenant que realAuthToken est confirmé.
    loadRealTracks();
    // Avant : loadFeaturedArtists() se lançait au tout premier chargement du script, bien
    // avant que cette reconnexion automatique n'ait fini de vérifier qui est connecté —
    // realAuthToken valait encore null à ce moment-là, donc le vrai statut "déjà suivi ?"
    // n'était jamais vérifié, et le bouton restait coincé sur "Suivre" toute la session
    // même pour des artistes réellement suivis. On la relance ici, une fois qu'on sait
    // vraiment qui est connecté.
    loadFeaturedArtists();
    realUserId = stored.userId;
    currentUser = data.user;
    demoOverride = false; // une vraie session (connexion/inscription/restauration) prime toujours sur un ancien essai du bouton démo
    applyAccountType();
    if(currentUser.account_type === 'label'){
      enterApp('dashboard');
 toast(`Bon retour, ${currentUser.first_name} `);
    } else if(currentUser.subscription_status === 'active'){
      enterApp('catalog');
 toast(`Bon retour, ${currentUser.first_name} `);
      if(currentUser.plan === 'discovery'){
        startDiscoveryFromServer();
        if(!currentUser.email_verified) setTimeout(openEmailVerifyModal, 800); // rappel si toujours pas confirmé
      }
      handleSharedTrackLink(); // reprend un lien partagé en attente, si la personne y était arrivée avant de se connecter
    } else if(currentUser.subscription_status === 'expired'){
      // Distinct d'un Pass jamais activé (branche suivante) : ici, la personne avait bien un
      // vrai accès qui vient de se terminer — écran de blocage plein écran plutôt que le
      // simple flux d'inscription, façon plateforme premium.
      goTo('plans');
      showPassExpiredOverlay();
    } else if(currentUser.plan && currentUser.plan !== 'discovery'){
      choosePlan(currentUser.plan); // Pass déjà connu : pas besoin de re-remplir l'inscription
      toast(`Bon retour, ${currentUser.first_name} — votre Pass n'est plus actif, réactivez-le.`);
    } else {
      goTo('plans');
    }
  }catch(e){ /* pas de réseau : on laisse l'écran d'accueil, l'utilisateur pourra réessayer */ }
}
// Coupe complètement la lecture en cours — appelée à la déconnexion pour qu'aucun son d'un
// compte ne continue de jouer une fois passé sur un autre compte (chaque session doit repartir
// de zéro, sans musique héritée de la session précédente).
function stopAllPlayback(){
  try{
    clearInterval(progressTimer);
    realAudio.pause();
    realAudio.removeAttribute('src');
    usingRealAudio = false;
    playing = false;
    elapsed = 0;
    // Élément fantôme de la sphère audio — jamais indispensable, mais autant le stopper
    // proprement en même temps plutôt que de le laisser tourner dans le vide.
    try{ nuniAnalysisAudio.pause(); }catch(e){ /* pas bloquant */ }
    document.documentElement.classList.remove('is-playing');
    if(typeof NuniAura !== 'undefined') NuniAura.stop();
    const icon = document.getElementById('play-icon');
    if(icon) icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    const fpIcon = document.getElementById('fp-play-icon');
    if(fpIcon) fpIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    const playerBar = document.getElementById('player-bar');
    if(playerBar) playerBar.style.display = 'none';
    document.documentElement.classList.remove('has-player-bar');
    closeFullPlayer();
    // Le mode DJ/Radio (et sa file de lecture) ne s'arrêtait pas ici — un compte qui se
    // connectait juste après quelqu'un resté en mode DJ héritait silencieusement de sa file
    // de morceaux et de son état, sans jamais avoir activé le DJ lui-même.
    djMode = false; radioMode = false; genreRadioActive = null;
    djPlaying = false; tunerPlaying = false;
    djQueue = []; djQueuePos = 0;
    clearInterval(djTimer);
    if(djFadeTimer){ clearInterval(djFadeTimer); djFadeTimer = null; }
    if(djFadeAudio) djFadeAudio.pause();
    djCrossfadeTriggered = false;
    if(djAvatarInstance) djAvatarInstance.stop();
    if('speechSynthesis' in window) window.speechSynthesis.cancel();
    if(djVoiceClipAudio) djVoiceClipAudio.pause();
    if(djDuckRampTimer){ clearInterval(djDuckRampTimer); djDuckRampTimer = null; }
    realAudio.volume = userVolume; // même filet de sécurité que dans djTogglePlay — sinon un volume resté coincé bas (annonce DJ interrompue) restait bas indéfiniment, même après déconnexion/changement de compte
    setRadioLiveBadge(false);
  }catch(e){ /* pas bloquant si un élément du lecteur n'existe pas encore au moment de l'appel */ }
}
// Vérification périodique en arrière-plan : si l'admin suspend/supprime ce compte pendant
// qu'il est déjà connecté (pas juste au prochain login), on le détecte dans les 2 minutes
// et on déconnecte immédiatement, plutôt que d'attendre l'expiration du token (30 jours).
let accountStatusCheckTimer = null;
function startAccountStatusWatcher(){
  clearInterval(accountStatusCheckTimer);
  accountStatusCheckTimer = setInterval(async ()=>{
    if(!realAuthToken) return;
    if(!navigator.onLine) return; // pas de réseau du tout : inutile de tenter, on réessaiera au prochain cycle
    try{
      const res = await fetch(NUNI_API_BASE + '/api/me', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
      if(res.status === 401 || res.status === 403){
        const errData = await res.json().catch(()=>({}));
        clearInterval(accountStatusCheckTimer);
 toast(' ' + (errData.error || 'Session invalide.'));
        logoutUser();
        return;
      }
      if(res.ok){
        // Avant : cette vérification périodique ne servait qu'à détecter une suspension —
        // elle récupérait bien les vraies données à jour du compte, mais les jetait sans
        // jamais les appliquer. Résultat : un client déjà connecté au moment où l'admin
        // active son Pass ne voyait jamais son compte passer "actif" tout seul, même après
        // plusieurs minutes — il fallait se déconnecter/reconnecter pour que ça se mette à jour.
        const data = await res.json();
        const isLabelAccount = data.user && data.user.account_type === 'label';
        const wasActive = currentUser && currentUser.subscription_status === 'active';
        const nowActive = data.user && data.user.subscription_status === 'active';
        const nowExpired = data.user && data.user.subscription_status === 'expired';
        // Pour un compte Découverte, subscription_status reste "active" tout du long de
        // l'essai, que l'email soit confirmé ou non — donc wasActive/nowActive ne bougent
        // jamais pour CETTE transition précise. Vérifiée séparément : email confirmé entre-
        // temps (ex. sur un autre onglet/appareil), pendant que cette session reste ouverte ici.
        const wasVerified = currentUser && currentUser.email_verified;
        const nowVerified = data.user && data.user.email_verified;
        currentUser = data.user;
        demoOverride = false; // une vraie session (connexion/inscription/restauration) prime toujours sur un ancien essai du bouton démo
        saveSession(realAuthToken, currentUser, true);
        applyAccountType();
        // Un compte Label suit son abonnement via labels.subscription_expires_at (colonne à
        // part, gérée par l'admin) — jamais via users.subscription_status comme
        // Consommateur/Artiste. On ignore volontairement cette donnée non pertinente pour lui.
        if(isLabelAccount){ /* rien à faire ici — voir loadLabelDashboardStatus pour son propre polling dédié */ }
        else if(!wasActive && nowActive){
 toast(' Votre Pass est maintenant actif — bienvenue sur NUNI en intégralité !');
          hidePassExpiredOverlay(); // au cas où l'écran de blocage était encore affiché
          loadRealTracks(); // même raison qu'après validation d'un code : les liens audio doivent apparaître sans rechargement manuel
        } else if(!wasVerified && nowVerified){
          toast(' Email confirmé — bienvenue sur NUNI en intégralité !');
          closeEmailVerifyModal();
          loadRealTracks();
        } else if(nowExpired){
          // Le Pass vient d'expirer PENDANT que la personne utilise déjà NUNI (pas
          // seulement détecté à la connexion) — écran de blocage immédiat, où qu'elle soit.
          showPassExpiredOverlay();
        }
      }
    }catch(e){ /* pas de réseau : on ne déconnecte pas sur un simple souci de connexion */ }
  }, 120000); // toutes les 2 minutes
}

function logoutUser(){
  clearInterval(accountStatusCheckTimer);
  clearInterval(heroRotateTimer);
  stopAllPlayback();
  clearSession();
  realAuthToken = null;
  realUserId = null;
  currentUser = null;
  demoOverride = false;
  // Remise à zéro complète de tout ce qui vit en mémoire côté compte — sans ça, le compte
  // suivant qui se connecte sur ce même appareil pouvait hériter des favoris, de
  // l'historique d'écoute, ou déclencher une fausse animation "passage de niveau" si son
  // vrai niveau se trouvait être plus haut que le dernier niveau vu pour le compte précédent.
  lastKnownLevel = null;
  favoritesPlaylist = [];
  listeningHistory = [];
  // Idem pour la Bibliothèque : les vrais artistes suivis et la catégorie active sont
  // propres à un compte, jamais à réutiliser pour le suivant sur le même appareil.
  libraryPlaylistsCache = null;
  libraryArtistsCache = null;
  libraryActiveCategory = 'liked';
  libraryActiveSort = 'recent';
  const badgesRow = document.getElementById('badges-row');
  if(badgesRow) badgesRow.innerHTML = '';
  const levelWrap = document.getElementById('level-progress-wrap');
  if(levelWrap) levelWrap.innerHTML = '';
  closeProfileMenu();
  applyAccountType();
  goTo('home');
  toast('Vous avez été déconnecté.');
}
function togglePasswordVisibility(inputId, btn){
  const input = document.getElementById(inputId);
  if(!input) return;
  const nowVisible = input.type === 'password';
  input.type = nowVisible ? 'text' : 'password';
  btn.innerHTML = nowVisible
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 7 11 7a21.7 21.7 0 0 1-2.61 3.65M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
}
/* ============ MOT DE PASSE OUBLIÉ — vrai système, avant totalement absent ============
   Un compte au mot de passe oublié restait bloqué pour toujours, aucun moyen de le
   récupérer. Même principe qu'un code d'accès : un vrai code temporaire envoyé par email,
   à usage unique, expire en 30 minutes. */
function openForgotPasswordModal(){
  document.getElementById('fp-feedback').innerHTML = '';
  document.getElementById('fp-email').value = '';
  document.getElementById('fp-code').value = '';
  document.getElementById('fp-new-password').value = '';
  document.getElementById('fp-step-request').style.display = '';
  document.getElementById('fp-step-reset').style.display = 'none';
  document.getElementById('fp-modal-title').textContent = 'Mot de passe oublié';
  document.getElementById('forgot-password-overlay').classList.add('show');
}
function closeForgotPasswordModal(){
  document.getElementById('forgot-password-overlay').classList.remove('show');
}
async function submitForgotPassword(){
  const email = document.getElementById('fp-email').value.trim();
  const feedback = document.getElementById('fp-feedback');
  const btn = document.getElementById('fp-request-btn');
 if(!email){ feedback.style.color = 'var(--rose-braise)'; feedback.textContent = ' Entrez votre email.'; return; }
  btn.disabled = true;
  feedback.style.color = 'var(--text-faint)';
  feedback.textContent = 'Envoi en cours…';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/auth/forgot-password', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email })
    });
    const data = await res.json();
    btn.disabled = false;
    feedback.style.color = '#7FC79A';
 feedback.textContent = ' ' + data.message;
    document.getElementById('fp-step-request').style.display = 'none';
    document.getElementById('fp-step-reset').style.display = '';
    document.getElementById('fp-modal-title').textContent = 'Entrez votre code';
  }catch(e){
    btn.disabled = false;
    feedback.style.color = 'var(--rose-braise)';
 feedback.textContent = ' Impossible de contacter le serveur NUNI.';
  }
}
async function submitResetPassword(){
  const email = document.getElementById('fp-email').value.trim();
  const code = document.getElementById('fp-code').value.trim();
  const newPassword = document.getElementById('fp-new-password').value;
  const feedback = document.getElementById('fp-feedback');
  const btn = document.getElementById('fp-reset-btn');
 if(!code || !newPassword){ feedback.style.color = 'var(--rose-braise)'; feedback.textContent = ' Entrez le code et votre nouveau mot de passe.'; return; }
  btn.disabled = true;
  feedback.style.color = 'var(--text-faint)';
  feedback.textContent = 'Vérification…';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/auth/reset-password', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, code, newPassword })
    });
    const data = await res.json();
    btn.disabled = false;
 if(!res.ok){ feedback.style.color = 'var(--rose-braise)'; feedback.textContent = ' ' + data.error; return; }
    feedback.style.color = '#7FC79A';
 feedback.textContent = ' ' + data.message;
    setTimeout(()=>{ closeForgotPasswordModal(); openLoginModal(); document.getElementById('login-email').value = email; toast('Mot de passe réinitialisé — connectez-vous.'); }, 1200);
  }catch(e){
    btn.disabled = false;
    feedback.style.color = 'var(--rose-braise)';
 feedback.textContent = ' Impossible de contacter le serveur NUNI.';
  }
}
function openLoginModal(){
  document.getElementById('login-feedback').innerHTML = '';
  // Même filet de sécurité que pour l'inscription — voir le commentaire dans choosePlan().
  lastKnownLevel = null;
  favoritesPlaylist = [];
  listeningHistory = [];
  const badgesRowReset = document.getElementById('badges-row');
  if(badgesRowReset) badgesRowReset.innerHTML = '';
  const levelWrapReset = document.getElementById('level-progress-wrap');
  if(levelWrapReset) levelWrapReset.innerHTML = '';
  const overlay = document.getElementById('login-overlay');
  overlay.classList.add('show');
  overlay.classList.add('is-preparing');
  setTimeout(()=> overlay.classList.remove('is-preparing'), 550);
  // Réveille le serveur Render dès l'ouverture — voir le même commentaire dans openRedeemModal.
  fetch(NUNI_API_BASE + '/api/stats/public').catch(()=>{});
}
function closeLoginModal(){
  document.getElementById('login-overlay').classList.remove('show');
}
async function submitLogin(){
  const feedback = document.getElementById('login-feedback');
  const btn = document.getElementById('login-submit-btn');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if(!email || !password){
    feedback.style.color = 'var(--rose-braise)';
    feedback.textContent = 'Merci de renseigner votre email et votre mot de passe.';
    return;
  }

  feedback.style.color = 'var(--text-dim)';
  feedback.textContent = 'Connexion en cours…';
  btn.disabled = true;

  try{
    const res = await fetchWithRetry(NUNI_API_BASE + '/api/login',
      { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) },
      ()=>{ feedback.textContent = 'Le serveur se réveille, nouvel essai dans quelques secondes…'; }
    );
    const data = await res.json();
    if(!res.ok){
      feedback.style.color = 'var(--rose-braise)';
 feedback.textContent = ' ' + data.error;
      btn.disabled = false;
      return;
    }
    realAuthToken = data.token;
    loadProgress();
    startAccountStatusWatcher();
    syncLikedTracksFromServer();
    loadRealTracks(); // recharge avec le jeton maintenant disponible — sinon liens audio vides malgré la connexion
    realUserId = data.user.id;
    currentUser = data.user;
    demoOverride = false; // une vraie session (connexion/inscription/restauration) prime toujours sur un ancien essai du bouton démo
    const rememberBox = document.getElementById('login-remember');
    saveSession(data.token, data.user, !rememberBox || rememberBox.checked);

    feedback.style.color = '#7FC79A';
 feedback.textContent = ' Connexion réussie — bon retour ' + currentUser.first_name + ' !';
    btn.disabled = false;
    applyAccountType();
    setTimeout(()=>{
      closeLoginModal();
      // Un compte Label n'a ni subscription_status ni plan au sens Pass Auditeur/Artiste
      // (il a son propre système : labels.verification_status) — le router en premier, avant
      // toute logique ci-dessous qui ne concerne que les comptes consumer/artist.
      if(currentUser.account_type === 'label'){
        enterApp('dashboard');
      } else if(currentUser.subscription_status === 'active'){
        enterApp('catalog');
        if(currentUser.plan === 'discovery'){
          startDiscoveryFromServer();
          if(!currentUser.email_verified) setTimeout(openEmailVerifyModal, 800);
        }
      handleSharedTrackLink(); // reprend un lien partagé en attente, si la personne y était arrivée avant de se connecter
      } else if(currentUser.subscription_status === 'expired'){
        goTo('plans');
        showPassExpiredOverlay();
      } else if(currentUser.plan && currentUser.plan !== 'discovery'){
        choosePlan(currentUser.plan);
      } else {
        goTo('plans');
      }
    }, 600);
  }catch(e){
    feedback.style.color = 'var(--rose-braise)';
 feedback.textContent = ' Impossible de contacter le serveur NUNI.';
    btn.disabled = false;
  }
}

let pendingIsDiscovery = false;
let pendingDurationDays = null;
let pendingAmountFcfa = null;
async function choosePlan(type, isDiscovery){
  pendingPlanType = type;
  pendingIsDiscovery = !!isDiscovery;
  // Compte déjà existant et connecté : pas besoin de repasser par le formulaire d'inscription
  // complet — on redemande juste le Pass, puis on l'envoie directement sur WhatsApp payer,
  // et il n'aura plus qu'à saisir son nouveau code d'accès une fois le paiement confirmé.
  // IMPORTANT : uniquement si le compte connecté est bien du MÊME type que le Pass choisi —
  // un Label (ou un Artiste cliquant sur Pass Auditeur, etc.) qui clique sur un Pass qui
  // ne correspond pas à son propre compte ne doit jamais atterrir sur WhatsApp sans
  // explication : il faut d'abord clairement lui dire qu'il doit se déconnecter.
  if(currentUser && realAuthToken && currentUser.account_type === type){
    // Ce chemin ne passe jamais par renderDurationOptions() (pas de formulaire ici) — on
    // efface toute durée choisie lors d'une inscription précédente pour ne jamais la laisser
    // apparaître à tort dans CE message-ci (renouvellement, pas nouvelle inscription).
    pendingDurationDays = null;
    pendingAmountFcfa = null;
    try{
      await fetch(NUNI_API_BASE + '/api/subscribe/request', {
        method:'POST',
        headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
        body: JSON.stringify({ plan: type })
      });
    }catch(e){ /* pas bloquant : on affiche WhatsApp même si cet appel échoue */ }
    document.getElementById('whatsapp-modal-overlay').classList.add('show');
    return;
  }
  if(currentUser && realAuthToken && currentUser.account_type !== type){
    const typeLabels = { consumer: 'Consommateur', artist: 'Artiste', label: 'Label' };
    const wantsLogout = confirm(
      `Vous êtes déjà connecté avec un compte ${typeLabels[currentUser.account_type] || currentUser.account_type} (${currentUser.email || currentUser.first_name}).\n\n` +
      `Pour créer un compte ${typeLabels[type] || type} distinct, il faut d'abord vous déconnecter.\n\nSe déconnecter maintenant ?`
    );
    if(wantsLogout){ logoutUser(); }
    return;
  }
  // Filet de sécurité supplémentaire : quelle que soit la façon exacte dont on arrive ici,
  // on repart sur une base vraiment vierge — sinon un reste de progression (niveau, favoris,
  // historique) d'un compte précédent utilisé sur ce même appareil pouvait continuer à
  // s'afficher un court instant pour le nouveau compte tout juste créé.
  lastKnownLevel = null;
  favoritesPlaylist = [];
  listeningHistory = [];
  const badgesRowReset = document.getElementById('badges-row');
  if(badgesRowReset) badgesRowReset.innerHTML = '';
  const levelWrapReset = document.getElementById('level-progress-wrap');
  if(levelWrapReset) levelWrapReset.innerHTML = '';

  document.getElementById('rr-title').textContent = pendingIsDiscovery
    ? (type === 'artist' ? 'Créer mon compte Découverte (Artiste)' : 'Créer mon compte Découverte (Auditeur)')
    : (type === 'artist' ? 'Créer mon compte Artiste' : 'Créer mon compte Auditeur');
  document.getElementById('rr-artist-fields').style.display = type === 'artist' ? 'block' : 'none';
  renderDurationOptions(type);
  document.getElementById('rr-feedback').innerHTML = '';
  document.getElementById('real-register-overlay').classList.add('show');
}
// ---------- Sélecteur de durée/montant à l'inscription ----------
// Avant : la durée souhaitée n'était jamais demandée au client — l'équipe WhatsApp devait
// systématiquement lui redemander une fois sur place, avant même de pouvoir démarrer le
// paiement. Maintenant : la personne choisit directement dans le formulaire, et ce choix
// est repris tel quel dans le message WhatsApp pré-rempli (voir confirmPlanViaWhatsApp) —
// l'opérateur voit déjà le Pass, la durée ET le montant dès l'ouverture de la conversation.
const RR_DURATION_OPTIONS = {
  consumer: [
    { days:30, label:'1 mois', price:750 },
    { days:90, label:'3 mois', price:650, badge:'Le plus économique' },
    { days:365, label:'1 an', price:1250 },
  ],
  artist: [
    { days:90, label:'3 mois', price:5000 },
    { days:365, label:'1 an', price:10000, badge:'Meilleure valeur' },
  ],
};
function renderDurationOptions(type){
  const wrap = document.getElementById('rr-duration-fields');
  const grid = document.getElementById('rr-duration-options');
  if(pendingIsDiscovery){ wrap.style.display = 'none'; pendingDurationDays = null; pendingAmountFcfa = null; return; }
  wrap.style.display = 'block';
  const opts = RR_DURATION_OPTIONS[type] || RR_DURATION_OPTIONS.consumer;
  grid.innerHTML = '';
  opts.forEach((opt, i)=>{
    const el = document.createElement('div');
    el.className = 'rr-duration-opt' + (i === 0 ? ' selected' : '');
    el.innerHTML = `<div class="rd-label">${opt.label}</div><div class="rd-price">${opt.price.toLocaleString('fr-FR')} FCFA</div>${opt.badge ? `<div class="rd-badge">${opt.badge}</div>` : ''}`;
    el.onclick = ()=>{
      grid.querySelectorAll('.rr-duration-opt').forEach(o=> o.classList.remove('selected'));
      el.classList.add('selected');
      pendingDurationDays = opt.days;
      pendingAmountFcfa = opt.price;
    };
    grid.appendChild(el);
  });
  // Première option sélectionnée par défaut, sans attendre un clic — évite qu'une personne
  // pressée valide sans jamais avoir vraiment choisi.
  pendingDurationDays = opts[0].days;
  pendingAmountFcfa = opts[0].price;
}
function closeRealRegister(){
  document.getElementById('real-register-overlay').classList.remove('show');
}
// ---------- Vérification en direct du domaine email (au blur du champ) ----------
// Avant : seul le format était vérifié côté client (input type="email"), rien ne détectait
// une adresse avec un domaine bidon ou mal orthographié avant la soumission finale. Retour
// immédiat ici — mais la vraie vérification reste toujours refaite côté serveur à la
// soumission (voir emailDomainCanReceiveMail dans server.js), ce contrôle n'est qu'un confort.
async function checkEmailDomainLive(inputId, feedbackId){
  const input = document.getElementById(inputId);
  const feedback = document.getElementById(feedbackId);
  if(!input || !feedback) return;
  const email = input.value.trim();
  input.dataset.emailInvalid = ''; // toujours repartir de zéro à chaque nouvelle vérification
  if(!email){ feedback.textContent = ''; return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ feedback.textContent = ''; return; } // format invalide : le navigateur l'affiche déjà, inutile de dupliquer
  feedback.style.color = 'var(--text-faint)';
  feedback.textContent = 'Vérification…';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/auth/check-email-domain?email=' + encodeURIComponent(email));
    const data = await res.json();
    if(data.valid){
      feedback.style.color = '#7FC79A';
      feedback.textContent = '✓ Adresse valide';
    } else {
      feedback.style.color = 'var(--rose-braise)';
      feedback.textContent = "Cette adresse email n'existe pas — vérifiez l'orthographe.";
      input.dataset.emailInvalid = '1';
    }
  }catch(e){ feedback.textContent = ''; } // souci réseau : on ne bloque jamais sur un simple aléa de connexion
}

async function submitRealRegistration(){
  const feedback = document.getElementById('rr-feedback');
  const btn = document.getElementById('rr-submit-btn');
  const rrEmailInput = document.getElementById('rr-email');
  if(rrEmailInput.dataset.emailInvalid === '1'){
    feedback.style.color = 'var(--rose-braise)';
    feedback.textContent = "Corrigez votre adresse email avant de continuer.";
    rrEmailInput.focus();
    return;
  }
  const body = {
    accountType: pendingPlanType,
    firstName: document.getElementById('rr-first').value.trim(),
    lastName: document.getElementById('rr-last').value.trim(),
    email: rrEmailInput.value.trim(),
    password: document.getElementById('rr-password').value,
    age: document.getElementById('rr-age').value,
    phone: document.getElementById('rr-phone').value.trim(),
    address: document.getElementById('rr-address').value.trim(),
    city: document.getElementById('rr-city').value.trim(),
    country: document.getElementById('rr-country').value.trim(),
  };
  if(pendingPlanType === 'artist'){
    body.artistName = document.getElementById('rr-artistname').value.trim();
    body.labelOrManager = document.getElementById('rr-label').value.trim();
  }

  feedback.style.color = 'var(--text-dim)';
  feedback.textContent = 'Connexion au serveur NUNI…';
  btn.disabled = true;

  try{
    const res = await fetch(NUNI_API_BASE + (pendingIsDiscovery ? '/api/register-discovery' : '/api/register'), {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
    });
    const data = await res.json();
    if(!res.ok){
      feedback.style.color = 'var(--rose-braise)';
 feedback.textContent = ' ' + data.error;
      btn.disabled = false;
      return;
    }
    realAuthToken = data.token;
    loadProgress();
    startAccountStatusWatcher();
    syncLikedTracksFromServer();
    realUserId = data.user.id;
    currentUser = data.user;
    demoOverride = false; // une vraie session (connexion/inscription/restauration) prime toujours sur un ancien essai du bouton démo
    saveSession(data.token, data.user, true); // toujours mémorisé après une inscription fraîche

    if(pendingIsDiscovery){
      // Pass Découverte : déjà actif 24h côté serveur dès l'inscription, aucun passage par
      // WhatsApp — accès immédiat, vraie échéance suivie via subscription_expires_at.
      feedback.style.color = '#7FC79A';
 feedback.textContent = ' Compte créé — confirmez votre email pour débloquer l\'écoute !';
      btn.disabled = false;
      setTimeout(()=>{
        closeRealRegister();
        enterApp('catalog');
        startDiscoveryFromServer();
        openEmailVerifyModal(); // nudge immédiat — fermable, mais l'écoute réelle reste verrouillée côté serveur tant que non confirmé
      }, 900);
      return;
    }

    // demande de Pass, tout de suite après la création du compte
    const subRes = await fetch(NUNI_API_BASE + '/api/subscribe/request', {
      method:'POST',
      headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({plan: pendingPlanType, durationDays: pendingDurationDays})
    });
    await subRes.json();

    feedback.style.color = '#7FC79A';
 feedback.textContent = ` Compte créé (id ${realUserId}) — direction WhatsApp pour le paiement.`;
    btn.disabled = false;

    setTimeout(()=>{
      closeRealRegister();
      document.getElementById('whatsapp-modal-overlay').classList.add('show');
    }, 900);
  }catch(e){
    feedback.style.color = 'var(--rose-braise)';
 feedback.textContent = ' Impossible de contacter le serveur NUNI. Vérifiez votre connexion internet.';
    btn.disabled = false;
  }
}

/* ============ INSCRIPTION LABEL (Pass Label — Phase 1) ============ */
// Important : contrairement à la publication d'un morceau (artiste déjà connecté, jeton
// disponible pour un upload direct signé vers Cloudinary), à l'inscription le compte
// n'existe pas encore — aucun jeton disponible. Les fichiers sont donc lus en base64 côté
// navigateur et envoyés dans le corps de la requête ; c'est le SERVEUR qui les envoie à
// Cloudinary avec ses propres identifiants (voir uploadIfDataUri dans server.js), exactement
// comme pour les pochettes de morceaux.
let pendingLabelFiles = { logo: null, idDoc: null, labelDoc: null };
let pendingLabelWhatsAppMessage = null; // non-null uniquement juste après une inscription Label, jusqu'à la fermeture du modal WhatsApp
function openLabelRegister(){
  pendingLabelFiles = { logo: null, idDoc: null, labelDoc: null };
  document.getElementById('lr-feedback').innerHTML = '';
  document.getElementById('label-register-overlay').classList.add('show');
  refreshLabelPlanOptionsFromServer();
}
// ---------- Vrais prix/limites des paliers Label (Phase 6 — configurables depuis l'admin) ----------
async function refreshLabelPlanOptionsFromServer(){
  try{
    const res = await fetch(NUNI_API_BASE + '/api/label-plan-settings');
    if(!res.ok) return;
    const data = await res.json();
    const fmt = n => Number(n).toLocaleString('fr-FR');
    const select = document.getElementById('lr-plan');
    if(select){
      select.querySelector('option[value="start"]').textContent = `Label Start — ${data.maxArtists.start} artistes max — ${fmt(data.prices.start)} FCFA/trimestre`;
      select.querySelector('option[value="pro"]').textContent = `Label Pro — ${data.maxArtists.pro} artistes max — ${fmt(data.prices.pro)} FCFA/trimestre`;
      select.querySelector('option[value="premium"]').textContent = `Label Premium — ${data.maxArtists.premium} artistes max — ${fmt(data.prices.premium)} FCFA/trimestre`;
      select.querySelector('option[value="elite"]').textContent = `Label Elite — artistes illimités — ${fmt(data.prices.elite)} FCFA/trimestre`;
    }
    const priceDisplay = document.getElementById('label-plan-price-display');
    if(priceDisplay){
      priceDisplay.innerHTML = `<b>À partir de ${fmt(data.prices.start)} FCFA</b> / trimestre · Label Start`;
    }
  }catch(e){ /* pas grave — les libellés génériques restent affichés */ }
}
function closeLabelRegister(){
  document.getElementById('label-register-overlay').classList.remove('show');
}
function readFileAsDataUri(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function previewLabelFile(e, previewElId, kind){
  const file = e.target.files[0];
  if(!file) return;
  const dataUri = await readFileAsDataUri(file);
  pendingLabelFiles[kind] = dataUri;
  if(previewElId){
    const preview = document.getElementById(previewElId);
    preview.style.backgroundImage = `url(${dataUri})`;
    preview.textContent = '';
  } else {
    const statusId = kind === 'idDoc' ? 'lr-id-doc-status' : 'lr-label-doc-status';
    document.getElementById(statusId).textContent = file.name + ' — prêt à envoyer';
  }
}
async function submitLabelRegistration(){
  const feedback = document.getElementById('lr-feedback');
  const btn = document.getElementById('lr-submit-btn');
  const labelName = document.getElementById('lr-label-name').value.trim();
  const legalName = document.getElementById('lr-legal-name').value.trim();
  const country = document.getElementById('lr-country').value.trim();
  const city = document.getElementById('lr-city').value.trim();
  const address = document.getElementById('lr-address').value.trim();
  const proPhone = document.getElementById('lr-pro-phone').value.trim();
  const proEmail = document.getElementById('lr-pro-email').value.trim();
  const firstName = document.getElementById('lr-first').value.trim();
  const lastName = document.getElementById('lr-last').value.trim();
  const email = document.getElementById('lr-email').value.trim();
  const password = document.getElementById('lr-password').value;
  if(!labelName || !legalName || !country || !city || !address || !proPhone || !proEmail || !firstName || !lastName || !email || !password){
    feedback.style.color = 'var(--rose-braise)';
 feedback.textContent = ' Merci de remplir tous les champs obligatoires (*).';
    return;
  }
  if(document.getElementById('lr-email').dataset.emailInvalid === '1' || document.getElementById('lr-pro-email').dataset.emailInvalid === '1'){
    feedback.style.color = 'var(--rose-braise)';
    feedback.textContent = 'Corrigez la ou les adresses email signalées avant de continuer.';
    return;
  }
  feedback.style.color = 'var(--text-dim)';
  feedback.textContent = 'Envoi de votre dossier au serveur NUNI…';
  btn.disabled = true;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/register', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        accountType: 'label',
        firstName, lastName, email, password,
        address, city, country,
        labelName, logoUrl: pendingLabelFiles.logo, legalName,
        professionalPhone: proPhone, professionalEmail: proEmail,
        website: document.getElementById('lr-website').value.trim() || null,
        taxId: document.getElementById('lr-tax-id').value.trim() || null,
        labelDescription: document.getElementById('lr-description').value.trim() || null,
        socialLinks: document.getElementById('lr-social').value.trim() || null,
        responsibleName: document.getElementById('lr-responsible-name').value.trim() || null,
        responsibleIdDocUrl: pendingLabelFiles.idDoc, labelDocUrl: pendingLabelFiles.labelDoc,
        labelPlan: document.getElementById('lr-plan').value,
      }),
    });
    const data = await res.json();
    if(!res.ok){
      feedback.style.color = 'var(--rose-braise)';
 feedback.textContent = ' ' + data.error;
      btn.disabled = false;
      return;
    }
    realAuthToken = data.token;
    realUserId = data.user.id;
    currentUser = data.user;
    demoOverride = false; // une vraie session (connexion/inscription/restauration) prime toujours sur un ancien essai du bouton démo
    saveSession(data.token, data.user, true);
    feedback.style.color = '#7FC79A';
 feedback.textContent = ' Demande envoyée ! Finalisons ça sur WhatsApp.';
    btn.disabled = false;
    // ---- Même flux que les autres Pass NUNI : on passe d'abord par WhatsApp (paiement du
    // palier choisi), puis le Dashboard s'ouvre — il affichera "en attente de vérification"
    // et se synchronisera tout seul dès que l'admin approuve (voir le polling automatique
    // dans loadLabelDashboardStatus). ----
    pendingLabelWhatsAppMessage = `Bonjour NUNI, je viens d'inscrire mon Label "${document.getElementById('lr-label-name').value.trim()}" sur NUNI, palier ${data.labelPlanName} (${Number(data.labelPlanPriceFcfa).toLocaleString('fr-FR')} FCFA). Pouvez-vous m'aider à finaliser mon paiement ?`;
    setTimeout(()=>{
      closeLabelRegister();
      document.getElementById('whatsapp-modal-overlay').classList.add('show');
    }, 800);
  }catch(e){
    feedback.style.color = 'var(--rose-braise)';
 feedback.textContent = ' Impossible de contacter le serveur NUNI. Vérifiez votre connexion internet.';
    btn.disabled = false;
  }
}

// ---------- Statut réel du Label, affiché dans son Dashboard (Phase 1) ----------
// Le vrai tableau de bord multi-artistes (streams, revenus, gestion d'équipe...) arrive en
// Phase 2 — pour l'instant, seul le statut de vérification et les infos de base du dossier
// sont affichés, honnêtement, sans rien inventer.
let labelStatusPollTimer = null;
async function loadLabelDashboardStatus(){
  const subtitle = document.getElementById('label-dash-subtitle');
  const card = document.getElementById('label-dash-status-card');
  if(!card || !realAuthToken) return;
  if(!card.dataset.hasLoadedOnce) card.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Chargement…</p>';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/label/me', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    const data = await res.json();
    if(!res.ok){ card.innerHTML = `<p style="color:var(--rose-braise); font-size:13px;">${data.error||'Erreur.'}</p>`; return; }
    card.dataset.hasLoadedOnce = '1';
    const label = data.label;
    if(subtitle) subtitle.textContent = label.label_name;
    const statusMap = {
      pending:      { label: 'En attente de vérification', color: '#D4AF6A', desc: "Votre dossier a bien été reçu. L'équipe NUNI l'examine — délai maximum 24h." },
      verification: { label: 'Vérification en cours', color: '#D4AF6A', desc: "Votre dossier est en cours d'examen par l'équipe NUNI." },
      validated:    { label: 'Compte validé', color: '#3BC26A', desc: 'Votre compte Label est actif.' },
      refused:      { label: 'Demande refusée', color: '#E05252', desc: label.refusal_reason || "Votre demande n'a pas été retenue. Contactez le support pour plus d'informations." },
      suspended:    { label: 'Compte suspendu', color: '#E05252', desc: label.refusal_reason || "Votre compte Label a été suspendu par l'équipe NUNI. Contactez le support pour plus d'informations." },
    };
    const st = statusMap[label.verification_status] || statusMap.pending;
    const planLabels = { start: 'Label Start (2 artistes max)', pro: 'Label Pro (5 artistes max)', premium: 'Label Premium (10 artistes max)', elite: 'Label Elite (illimité)' };
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:12px;">
          ${label.logo_url ? `<div style="width:56px; height:56px; border-radius:12px; background:url(${label.logo_url}); background-size:cover; background-position:center; flex-shrink:0;"></div>` : ''}
          <div>
            <div style="font-weight:700; font-size:16px;">${esc(label.label_name)}</div>
            <div style="font-size:12.5px; color:var(--text-faint);">${esc(label.legal_name || '')}</div>
          </div>
        </div>
        <button class="btn-icon" title="Actualiser le statut" onclick="loadLabelDashboardStatus()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg></button>
      </div>
      <div style="display:inline-flex; align-items:center; gap:8px; padding:6px 14px; border-radius:20px; background:${st.color}22; color:${st.color}; font-weight:700; font-size:13px; margin-bottom:12px;">
        <span style="width:8px; height:8px; border-radius:50%; background:${st.color};"></span> ${st.label}
      </div>
      <p style="font-size:13.5px; color:var(--text-dim); line-height:1.6; margin-bottom:16px;">${st.desc}</p>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; padding-top:16px; border-top:1px solid var(--border);">
        <div><div style="font-size:11px; color:var(--text-faint); text-transform:uppercase;">Palier</div><div style="font-weight:600; font-size:14px;">${planLabels[label.plan] || label.plan}</div></div>
        <div><div style="font-size:11px; color:var(--text-faint); text-transform:uppercase;">Artistes gérés</div><div style="font-weight:600; font-size:14px;">${data.artistCount} / ${data.maxArtists == null ? '∞' : data.maxArtists}</div></div>
      </div>`;
    // ---- Synchronisation automatique : tant que le compte n'est pas encore validé/refusé/
    // suspendu, on revérifie le vrai statut toutes les 20 secondes — inutile de recharger la
    // page à la main pour voir qu'une validation admin vient d'arriver. Le polling s'arrête
    // tout seul dès que le statut change, ou si on quitte la page. ----
    clearTimeout(labelStatusPollTimer);
    const stillWaiting = label.verification_status === 'pending' || label.verification_status === 'verification';
    if(stillWaiting){
      labelStatusPollTimer = setTimeout(()=>{
        const view = document.getElementById('view-dashboard');
        if(view && view.style.display !== 'none') loadLabelDashboardStatus();
      }, 20000);
    }
    // ---- Tant que le compte Label n'est pas validé, rien d'autre à explorer sur NUNI n'a
    // vraiment de sens pour lui — seul le Dashboard (son statut) reste accessible. Une fois
    // validé, la navigation normale revient automatiquement (voir applyAccountType). ----
    document.querySelectorAll('.app-nav-link').forEach(el=>{
      if(el.id !== 'nav-dashboard-link'){
        el.style.display = label.verification_status === 'validated' ? '' : 'none';
      }
    });
    const phase2 = document.getElementById('label-dash-phase2');
    const changePlanCard = document.getElementById('label-change-plan-card');
    if(changePlanCard){
      changePlanCard.style.display = label.verification_status === 'validated' ? 'block' : 'none';
      const sel = document.getElementById('lcp-new-plan');
      if(sel) sel.value = label.plan;
    }
    if(phase2){
      phase2.style.display = label.verification_status === 'validated' ? 'block' : 'none';
      if(label.verification_status === 'validated'){
        loadLabelOverview();
        loadLabelArtists();
        loadLabelPayments();
        loadLabelTeam();
        loadLabelAnalytics();
        loadLabelCatalog();
      }
    }
  }catch(e){
    card.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Impossible de contacter le serveur NUNI.</p>';
  }
}

/* ---------- Côté artiste : invitations reçues d'un Label (Phase 2) ---------- */
async function loadMyLabelInvites(){
  const wrap = document.getElementById('label-invites-wrap');
  if(!wrap || !realAuthToken) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/label-invites', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    if(!res.ok){ wrap.style.display = 'none'; return; }
    const data = await res.json();
    if(!data.invites || !data.invites.length){ wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    wrap.innerHTML = data.invites.map(inv => `
      <div class="card" style="display:flex; align-items:center; gap:14px; border-color:var(--accent);">
        ${inv.logo_url ? `<div style="width:44px; height:44px; border-radius:10px; background:url(${inv.logo_url}); background-size:cover; background-position:center; flex-shrink:0;"></div>` : ''}
        <div style="flex:1;"><b>${esc(inv.label_name)}</b> vous invite à rejoindre son label sur NUNI.</div>
        <button class="btn btn-primary btn-sm" onclick="respondLabelInvite(${inv.id}, true)">Accepter</button>
        <button class="btn btn-ghost btn-sm" onclick="respondLabelInvite(${inv.id}, false)">Refuser</button>
      </div>`).join('');
  }catch(e){ wrap.style.display = 'none'; }
}
async function respondLabelInvite(id, accept){
  try{
    await fetch(NUNI_API_BASE + '/api/me/label-invites/' + id + '/' + (accept ? 'accept' : 'decline'), {
      method:'POST', headers:{ 'Authorization':'Bearer ' + realAuthToken },
    });
    toast(accept ? 'Invitation acceptée.' : 'Invitation refusée.');
    loadMyLabelInvites();
  }catch(e){ toast('Impossible de contacter le serveur.'); }
}

/* ---------- Côté utilisateur : invitations d'équipe reçues d'un Label (Phase 4) ---------- */
async function loadMyLabelTeamInvites(){
  const wrap = document.getElementById('label-team-invites-wrap');
  if(!wrap || !realAuthToken) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/label-team-invites', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    if(!res.ok){ wrap.style.display = 'none'; return; }
    const data = await res.json();
    if(!data.invites || !data.invites.length){ wrap.style.display = 'none'; return; }
    const roleLabels = { admin:'Admin', manager:'Manager', assistant:'Assistant' };
    wrap.style.display = 'block';
    wrap.innerHTML = data.invites.map(inv => `
      <div class="card" style="display:flex; align-items:center; gap:14px; border-color:var(--accent);">
        ${inv.logo_url ? `<div style="width:44px; height:44px; border-radius:10px; background:url(${inv.logo_url}); background-size:cover; background-position:center; flex-shrink:0;"></div>` : ''}
        <div style="flex:1;"><b>${esc(inv.label_name)}</b> vous invite à rejoindre son équipe en tant que <b>${roleLabels[inv.role]||inv.role}</b>.</div>
        <button class="btn btn-primary btn-sm" onclick="respondLabelTeamInvite(${inv.id}, true)">Accepter</button>
        <button class="btn btn-ghost btn-sm" onclick="respondLabelTeamInvite(${inv.id}, false)">Refuser</button>
      </div>`).join('');
  }catch(e){ wrap.style.display = 'none'; }
}
async function respondLabelTeamInvite(id, accept){
  try{
    await fetch(NUNI_API_BASE + '/api/me/label-team-invites/' + id + '/' + (accept ? 'accept' : 'decline'), {
      method:'POST', headers:{ 'Authorization':'Bearer ' + realAuthToken },
    });
    toast(accept ? 'Invitation acceptée.' : 'Invitation refusée.');
    loadMyLabelTeamInvites();
  }catch(e){ toast('Impossible de contacter le serveur.'); }
}

/* ---------- Gestion de l'équipe du Label (Phase 4) ---------- */
async function loadLabelTeam(){
  const list = document.getElementById('label-team-list');
  if(!list || !realAuthToken) return;
  list.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Chargement…</p>';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/label/team', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    const data = await res.json();
    if(!res.ok){ list.innerHTML = `<p style="color:var(--rose-braise); font-size:13px;">${data.error||'Erreur.'}</p>`; return; }
    const canManage = data.myRole === 'owner' || data.myRole === 'admin';
    const inviteForm = document.getElementById('label-team-invite-form');
    if(inviteForm) inviteForm.style.display = canManage ? 'flex' : 'none';
    const roleLabels = { owner:'Propriétaire', admin:'Admin', manager:'Manager', assistant:'Assistant' };
    const statusLabels = { active:'Actif', invited:'Invitation envoyée' };
    let html = `<div class="label-artist-row"><div class="av">${esc((data.owner.first_name||'?').charAt(0))}</div><div class="info"><div class="name">${esc(data.owner.first_name)} ${esc(data.owner.last_name)}</div><div class="meta">${esc(data.owner.email)}</div></div><span class="label-artist-status active">Propriétaire</span></div>`;
    data.members.forEach(m=>{
      const name = m.first_name ? `${esc(m.first_name)} ${esc(m.last_name)}` : esc(m.email);
      html += `<div class="label-artist-row">
        <div class="av">${name.charAt(0).toUpperCase()}</div>
        <div class="info"><div class="name">${esc(name)}</div><div class="meta">${esc(m.email)} · ${esc(roleLabels[m.role]||m.role)}</div></div>
        <span class="label-artist-status ${m.status}">${statusLabels[m.status]||m.status}</span>
        ${canManage ? `<button class="btn-icon" title="Retirer" onclick="removeLabelTeamMember(${m.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>` : ''}
      </div>`;
    });
    list.innerHTML = html;
  }catch(e){
    list.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Impossible de contacter le serveur NUNI.</p>';
  }
}
async function inviteLabelTeamMember(){
  const msg = document.getElementById('label-team-msg');
  const email = document.getElementById('lt-invite-email').value.trim();
  const role = document.getElementById('lt-invite-role').value;
  if(!email){ msg.style.color = 'var(--rose-braise)'; msg.textContent = 'Renseignez un email.'; return; }
  msg.style.color = 'var(--text-dim)'; msg.textContent = 'Envoi de l\'invitation…';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/label/team/invite', {
      method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    if(!res.ok){ msg.style.color = 'var(--rose-braise)'; msg.textContent = data.error; return; }
    msg.style.color = '#7FC79A'; msg.textContent = data.message;
    document.getElementById('lt-invite-email').value = '';
    loadLabelTeam();
  }catch(e){ msg.style.color = 'var(--rose-braise)'; msg.textContent = 'Impossible de contacter le serveur NUNI.'; }
}
async function removeLabelTeamMember(id){
  if(!confirm('Retirer ce membre de l\'équipe ?')) return;
  try{
    await fetch(NUNI_API_BASE + '/api/label/team/' + id, { method:'DELETE', headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    loadLabelTeam();
  }catch(e){ toast('Impossible de contacter le serveur.'); }
}

/* ---------- Analytics du Label (Phase 5) — uniquement de vraies données ---------- */
async function loadLabelAnalytics(){
  const chart = document.getElementById('label-streams-chart');
  const growthEl = document.getElementById('label-growth-val');
  const retentionEl = document.getElementById('label-retention-val');
  const countriesBox = document.getElementById('label-top-countries');
  const citiesBox = document.getElementById('label-top-cities');
  if(!chart || !realAuthToken) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/label/analytics', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    const data = await res.json();
    if(!res.ok) return;
    growthEl.textContent = data.growthPct == null ? '—' : (data.growthPct >= 0 ? '+' : '') + data.growthPct + '%';
    growthEl.style.color = data.growthPct == null ? 'var(--text)' : (data.growthPct >= 0 ? '#3BC26A' : '#E05252');
    retentionEl.textContent = data.retentionPct == null ? '—' : data.retentionPct + '%';

    chart.innerHTML = '';
    if(data.streamsByMonth.length){
      const max = Math.max(1, ...data.streamsByMonth.map(m=>m.streams));
      data.streamsByMonth.forEach(m=>{
        const col = document.createElement('div');
        col.className = 'bar-col';
        col.innerHTML = `<div class="bar-fill" style="height:0%" data-h="${(m.streams/max*100)}" title="${m.streams} streams · ${m.listeners} auditeurs"></div><div class="m-lbl">${m.month}</div>`;
        chart.appendChild(col);
      });
      setTimeout(()=>{ chart.querySelectorAll('.bar-fill').forEach(b=> b.style.height = b.dataset.h + '%'); }, 200);
    } else {
      chart.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Pas encore assez d\'écoutes pour un graphique.</p>';
    }
    const barRow = (label, count, max) => `<div style="margin-bottom:8px;"><div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:3px;"><span>${label}</span><span style="color:var(--text-faint);">${count}</span></div><div style="height:6px; border-radius:4px; background:var(--bg-card);"><div style="height:100%; border-radius:4px; width:${(count/max*100)}%; background:var(--grad-envol);"></div></div></div>`;
    if(data.topCountries.length){
      const maxC = Math.max(...data.topCountries.map(c=>c.plays));
      countriesBox.innerHTML = data.topCountries.map(c=> barRow(c.country, c.plays, maxC)).join('');
    } else { countriesBox.innerHTML = '<p style="color:var(--text-faint); font-size:12.5px;">Pas encore de données.</p>'; }
    if(data.topCities.length){
      const maxV = Math.max(...data.topCities.map(c=>c.plays));
      citiesBox.innerHTML = data.topCities.map(c=> barRow(c.city, c.plays, maxV)).join('');
    } else { citiesBox.innerHTML = '<p style="color:var(--text-faint); font-size:12.5px;">Pas encore de données.</p>'; }
  }catch(e){ /* pas grave si le serveur est momentanément indisponible */ }
}

/* ---------- Catalogue consolidé du Label (Phase 5) ---------- */
let lastLabelCatalogData = null;
let currentLabelCatalogFilter = 'all';
async function loadLabelCatalog(){
  const list = document.getElementById('label-catalog-list');
  if(!list || !realAuthToken) return;
  list.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Chargement…</p>';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/label/catalog', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    const data = await res.json();
    if(!res.ok){ list.innerHTML = `<p style="color:var(--rose-braise); font-size:13px;">${data.error||'Erreur.'}</p>`; return; }
    lastLabelCatalogData = data;
    currentLabelCatalogFilter = 'all';
    document.querySelectorAll('#label-catalog-tabs .concerts-filter-btn').forEach(b=> b.classList.toggle('is-active', b.dataset.cat === 'all'));
    renderLabelCatalogList();
  }catch(e){
    list.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Impossible de contacter le serveur NUNI.</p>';
  }
}
function setLabelCatalogFilter(cat){
  currentLabelCatalogFilter = cat;
  document.querySelectorAll('#label-catalog-tabs .concerts-filter-btn').forEach(b=> b.classList.toggle('is-active', b.dataset.cat === cat));
  renderLabelCatalogList();
}
function renderLabelCatalogList(){
  const list = document.getElementById('label-catalog-list');
  if(!list || !lastLabelCatalogData) return;
  const { tracks, clips, scheduled } = lastLabelCatalogData;
  let items = [];
  if(currentLabelCatalogFilter === 'all'){
    items = [
      ...tracks.map(t=> ({...t, kind:'track'})),
      ...clips.map(c=> ({...c, kind:'clip'})),
    ];
  } else if(currentLabelCatalogFilter === 'Clips'){
    items = clips.map(c=> ({...c, kind:'clip'}));
  } else if(currentLabelCatalogFilter === 'Scheduled'){
    items = scheduled.map(t=> ({...t, kind:'scheduled'}));
  } else {
    items = tracks.filter(t=> (t.release_type||'Single') === currentLabelCatalogFilter).map(t=> ({...t, kind:'track'}));
  }
  if(!items.length){ list.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Rien à afficher dans cette catégorie.</p>'; return; }
  list.innerHTML = items.map(it=>{
    const cover = it.cover_url || it.thumb_url;
    const coverStyle = cover ? `background-image:url(${cover});` : '';
    let metaLine;
    if(it.kind === 'clip') metaLine = `${esc(it.artist_name)} · Clip · ${Number(it.views||0).toLocaleString('fr-FR')} vues`;
    else if(it.kind === 'scheduled') metaLine = `${esc(it.artist_name)} · ${esc(it.release_type||'Single')} · Programmé le ${new Date(it.scheduled_release_at).toLocaleDateString('fr-FR')}`;
    else metaLine = `${esc(it.artist_name)} · ${esc(it.release_type||'Single')} · ${Number(it.streams||0).toLocaleString('fr-FR')} streams`;
    return `<div class="label-artist-row">
      <div class="av" style="border-radius:8px; ${coverStyle}"></div>
      <div class="info"><div class="name">${esc(it.title)}</div><div class="meta">${metaLine}</div></div>
    </div>`;
  }).join('');
}

/* ---------- Vue d'ensemble du Label (Phase 2) ---------- */
/* ---------- Changer de palier (Phase 6+) — calcule le vrai prix (avec 25% de réduction au
   premier changement), puis bascule sur WhatsApp pour finaliser, comme tout Pass NUNI. ---------- */
async function requestLabelPlanChange(){
  const msg = document.getElementById('lcp-msg');
  const newPlan = document.getElementById('lcp-new-plan').value;
  msg.style.color = 'var(--text-dim)'; msg.textContent = 'Calcul du prix…';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/label/change-plan-request', {
      method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({ newPlan }),
    });
    const data = await res.json();
    if(!res.ok){ msg.style.color = 'var(--rose-braise)'; msg.textContent = data.error; return; }
    const fmt = n => Number(n).toLocaleString('fr-FR');
    msg.style.color = 'var(--text)';
    msg.innerHTML = data.discounted
      ? `<b style="color:#3BC26A;">${fmt(data.finalPrice)} FCFA</b> <span style="text-decoration:line-through; color:var(--text-faint);">${fmt(data.fullPrice)} FCFA</span> — 25% de réduction sur votre premier changement de palier ! <a href="${data.whatsapp}?text=${encodeURIComponent(data.whatsappMessage)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent); font-weight:600;">Continuer sur WhatsApp →</a>`
      : `<b>${fmt(data.finalPrice)} FCFA</b> — <a href="${data.whatsapp}?text=${encodeURIComponent(data.whatsappMessage)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent); font-weight:600;">Continuer sur WhatsApp →</a>`;
  }catch(e){ msg.style.color = 'var(--rose-braise)'; msg.textContent = 'Impossible de contacter le serveur NUNI.'; }
}

async function loadLabelOverview(){
  const box = document.getElementById('label-overview-stats');
  if(!box || !realAuthToken) return;
  box.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Chargement…</p>';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/label/overview', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    const s = await res.json();
    if(!res.ok){ box.innerHTML = `<p style="color:var(--rose-braise); font-size:13px;">${s.error||'Erreur.'}</p>`; return; }
    const fmt = n => Number(n||0).toLocaleString('fr-FR');
    const cards = [
      { num: fmt(s.artistCount), lbl: 'Artistes gérés' },
      { num: fmt(s.totalStreams), lbl: 'Streams totaux' },
      { num: fmt(s.estimatedRevenueFcfa) + ' FCFA', lbl: 'Revenus estimés' },
      { num: fmt(s.collectedRevenueFcfa) + ' FCFA', lbl: 'Revenus encaissés' },
      { num: s.topArtist ? s.topArtist.artist_name : '—', lbl: 'Top artiste du label' },
      { num: s.topTrack ? s.topTrack.title : '—', lbl: 'Top morceau du label' },
    ];
    box.innerHTML = cards.map(c=> `<div class="dash-stat-card"><div class="num">${esc(c.num)}</div><div class="lbl">${esc(c.lbl)}</div></div>`).join('');
  }catch(e){
    box.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Impossible de contacter le serveur NUNI.</p>';
  }
}

/* ---------- Gestion des artistes du Label (Phase 2) ---------- */
async function loadLabelArtists(){
  const list = document.getElementById('label-artists-list');
  if(!list || !realAuthToken) return;
  list.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Chargement…</p>';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/label/artists', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    const data = await res.json();
    if(!res.ok){ list.innerHTML = `<p style="color:var(--rose-braise); font-size:13px;">${data.error||'Erreur.'}</p>`; return; }
    if(!data.artists.length){ list.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Aucun artiste rattaché pour l\'instant.</p>'; return; }
    const statusLabels = { active: 'Actif', invited: 'Invitation envoyée', suspended: 'Suspendu' };
    list.innerHTML = '';
    data.artists.forEach(a=>{
      const initials = (a.artist_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const avatarStyle = a.avatar_url ? `background-image:url(${esc(a.avatar_url)});` : '';
      const row = document.createElement('div');
      row.className = 'label-artist-row';
      row.innerHTML = `
        <div class="av" style="${avatarStyle}">${avatarStyle ? '' : initials}</div>
        <div class="info">
          <div class="name">${esc(a.artist_name)}${a.is_verified ? ' ✓' : ''}</div>
          <div class="meta">${a.track_count} titre${a.track_count>1?'s':''} · ${Number(a.total_streams).toLocaleString('fr-FR')} streams</div>
        </div>
        <span class="label-artist-status ${a.affiliation_status}">${esc(statusLabels[a.affiliation_status] || a.affiliation_status)}</span>
        <div style="display:flex; gap:6px;">
          ${a.affiliation_status === 'active' ? `<button class="btn-icon" title="Suspendre" onclick="suspendLabelArtist(${a.affiliation_id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg></button>` : ''}
          ${a.affiliation_status === 'suspended' ? `<button class="btn-icon" title="Réactiver" onclick="reactivateLabelArtist(${a.affiliation_id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14l11-7z"/></svg></button>` : ''}
          <button class="btn-icon" title="Retirer du Label" onclick="removeLabelArtist(${a.affiliation_id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>`;
      list.appendChild(row);
    });
  }catch(e){
    list.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Impossible de contacter le serveur NUNI.</p>';
  }
}
async function createLabelArtist(){
  const msg = document.getElementById('label-artist-form-msg');
  const artistName = document.getElementById('la-create-artistname').value.trim();
  const firstName = document.getElementById('la-create-firstname').value.trim();
  const lastName = document.getElementById('la-create-lastname').value.trim();
  const email = document.getElementById('la-create-email').value.trim();
  const password = document.getElementById('la-create-password').value;
  if(!artistName || !firstName || !lastName || !email || !password){
    msg.style.color = 'var(--rose-braise)'; msg.textContent = 'Merci de remplir tous les champs.';
    return;
  }
  msg.style.color = 'var(--text-dim)'; msg.textContent = 'Création en cours…';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/label/artists/create', {
      method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({ artistName, firstName, lastName, email, password }),
    });
    const data = await res.json();
    if(!res.ok){ msg.style.color = 'var(--rose-braise)'; msg.textContent = data.error; return; }
    msg.style.color = '#7FC79A'; msg.textContent = data.message;
    ['la-create-artistname','la-create-firstname','la-create-lastname','la-create-email','la-create-password'].forEach(id=> document.getElementById(id).value = '');
    loadLabelArtists();
    loadLabelOverview();
  }catch(e){ msg.style.color = 'var(--rose-braise)'; msg.textContent = 'Impossible de contacter le serveur NUNI.'; }
}
async function inviteLabelArtist(){
  const msg = document.getElementById('label-artist-form-msg');
  const email = document.getElementById('la-invite-email').value.trim();
  if(!email){ msg.style.color = 'var(--rose-braise)'; msg.textContent = 'Renseignez un email.'; return; }
  msg.style.color = 'var(--text-dim)'; msg.textContent = 'Envoi de l\'invitation…';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/label/artists/invite', {
      method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if(!res.ok){ msg.style.color = 'var(--rose-braise)'; msg.textContent = data.error; return; }
    msg.style.color = '#7FC79A'; msg.textContent = data.message;
    document.getElementById('la-invite-email').value = '';
    loadLabelArtists();
  }catch(e){ msg.style.color = 'var(--rose-braise)'; msg.textContent = 'Impossible de contacter le serveur NUNI.'; }
}
async function suspendLabelArtist(affId){
  try{
    await fetch(NUNI_API_BASE + '/api/label/artists/' + affId + '/suspend', { method:'POST', headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    loadLabelArtists();
  }catch(e){ toast('Impossible de contacter le serveur.'); }
}
async function reactivateLabelArtist(affId){
  try{
    await fetch(NUNI_API_BASE + '/api/label/artists/' + affId + '/reactivate', { method:'POST', headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    loadLabelArtists();
  }catch(e){ toast('Impossible de contacter le serveur.'); }
}
async function removeLabelArtist(affId){
  if(!confirm('Retirer cet artiste du Label ? Son compte NUNI reste actif et indépendant.')) return;
  try{
    await fetch(NUNI_API_BASE + '/api/label/artists/' + affId, { method:'DELETE', headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    loadLabelArtists();
    loadLabelOverview();
  }catch(e){ toast('Impossible de contacter le serveur.'); }
}

/* ---------- Revenus & versements du Label (Phase 3) ----------
   Vue de rapport sur les VRAIS versements déjà enregistrés (payment_history, alimentée par
   l'admin) — le Label ne fait pas transiter d'argent via NUNI, il consulte l'historique réel
   consolidé de ses artistes. Les données sont gardées en mémoire pour permettre l'export
   sans re-solliciter le serveur. */
let lastLabelPaymentsData = null;
async function loadLabelPayments(){
  const byArtistBox = document.getElementById('label-payments-by-artist');
  const tbody = document.getElementById('label-payments-history-tbody');
  if(!byArtistBox || !realAuthToken) return;
  byArtistBox.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Chargement…</p>';
  if(tbody) tbody.innerHTML = '';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/label/payments', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    const data = await res.json();
    if(!res.ok){ byArtistBox.innerHTML = `<p style="color:var(--rose-braise); font-size:13px;">${data.error||'Erreur.'}</p>`; return; }
    lastLabelPaymentsData = data;
    const fmt = n => Number(n||0).toLocaleString('fr-FR');
    byArtistBox.innerHTML = `<div style="font-weight:700; font-size:15px; margin-bottom:10px;">Total versé à tous vos artistes : ${fmt(data.totalPaidFcfa)} FCFA</div>` +
      data.byArtist.map(a => `
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border); font-size:13px;">
          <span>${esc(a.artist_name)}</span>
          <span style="color:var(--text-dim);">${fmt(a.total_paid_fcfa)} FCFA · ${a.payment_count} versement${a.payment_count>1?'s':''}</span>
        </div>`).join('');
    if(tbody){
      if(!data.history.length){
        tbody.innerHTML = '<tr><td colspan="5" style="padding:14px 6px; color:var(--text-faint);">Aucun versement enregistré pour l\'instant.</td></tr>';
      } else {
        tbody.innerHTML = data.history.map(p => `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px 6px;">${new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
            <td style="padding:8px 6px;">${esc(p.artist_name)}</td>
            <td style="padding:8px 6px;">${fmt(p.amount_fcfa)} FCFA</td>
            <td style="padding:8px 6px;">${fmt(p.streams_covered)}</td>
            <td style="padding:8px 6px;">${esc(p.method || '—')}</td>
          </tr>`).join('');
      }
    }
  }catch(e){
    byArtistBox.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Impossible de contacter le serveur NUNI.</p>';
  }
}
function labelPaymentsExportRows(){
  if(!lastLabelPaymentsData) return null;
  const rows = [['Date', 'Artiste', 'Montant (FCFA)', 'Streams couverts', 'Méthode']];
  lastLabelPaymentsData.history.forEach(p=>{
    rows.push([new Date(p.created_at).toLocaleDateString('fr-FR'), p.artist_name, p.amount_fcfa, p.streams_covered, p.method || '']);
  });
  return rows;
}
function exportLabelPaymentsCSV(){
  const rows = labelPaymentsExportRows();
  if(!rows){ toast('Chargez d\'abord les revenus.'); return; }
  const esc = v => `"${String(v??'').replace(/"/g,'""')}"`;
  const csv = rows.map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nuni-versements-${(currentUser && currentUser.first_name || 'label').toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Export CSV téléchargé.');
}
function exportLabelPaymentsXLSX(){
  const rows = labelPaymentsExportRows();
  if(!rows){ toast('Chargez d\'abord les revenus.'); return; }
  if(typeof XLSX === 'undefined'){ toast('Export Excel momentanément indisponible — utilisez Export CSV.'); return; }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Versements');
  XLSX.writeFile(wb, `nuni-versements-${(currentUser && currentUser.first_name || 'label').toLowerCase()}-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Export Excel téléchargé.');
}

function confirmPlanViaWhatsApp(){
  // ---- Cas Label : message dédié déjà préparé à l'inscription, pas de code d'accès à
  // saisir ensuite (le compte est validé par l'admin, pas par un code) — direction le
  // Dashboard, qui affiche "en attente" et se synchronise tout seul une fois approuvé. ----
  if(pendingLabelWhatsAppMessage){
    openWhatsApp(`https://wa.me/242068951600?text=${encodeURIComponent(pendingLabelWhatsAppMessage)}`);
    pendingLabelWhatsAppMessage = null;
    document.getElementById('whatsapp-modal-overlay').classList.remove('show');
    enterApp('dashboard');
    return;
  }
  const type = pendingPlanType;
  const planLabel = type === 'artist' ? 'Pass Artiste' : 'Pass Auditeur';
  const idNote = realUserId ? ` (mon identifiant NUNI : ${realUserId})` : '';
  // Avant : seul l'identifiant numérique était transmis — l'équipe devait le rechercher
  // manuellement dans l'admin pour retrouver le compte et pouvoir envoyer le code d'accès.
  // Le vrai email saisi à l'inscription est maintenant inclus directement, exploitable
  // immédiatement pour l'envoi du code.
  const emailNote = (currentUser && currentUser.email) ? ` — mon email : ${currentUser.email}` : '';
  // Avant : la durée souhaitée n'apparaissait jamais dans ce message — l'opérateur devait
  // systématiquement redemander "combien de temps voulez-vous ?" avant de pouvoir démarrer
  // le paiement. Le choix fait dans le formulaire (voir renderDurationOptions) est repris
  // ici tel quel : durée ET montant déjà visibles dès l'ouverture de la conversation.
  const durationLabels = { 30: '1 mois', 90: '3 mois', 365: '1 an' };
  const durationNote = pendingDurationDays
    ? `, pour ${durationLabels[pendingDurationDays] || pendingDurationDays + ' jours'} (${(pendingAmountFcfa||0).toLocaleString('fr-FR')} FCFA)`
    : '';
  const msg = encodeURIComponent(`Bonjour NUNI, je souhaite souscrire au ${planLabel}${durationNote}${idNote}${emailNote}. Pouvez-vous m'aider à finaliser mon paiement ?`);
  openWhatsApp(`https://wa.me/242068951600?text=${msg}`);
  document.getElementById('whatsapp-modal-overlay').classList.remove('show');
  toast('Une fois votre paiement confirmé, vous recevrez un code à saisir ci-dessous.');
  openRedeemModal();
}
function closeWhatsAppModal(){
  document.getElementById('whatsapp-modal-overlay').classList.remove('show');
  if(pendingLabelWhatsAppMessage){
    pendingLabelWhatsAppMessage = null;
    enterApp('dashboard');
  }
}

function openRedeemModal(){
  document.getElementById('redeem-feedback').innerHTML = '';
  document.getElementById('redeem-submit-btn').disabled = false; // sinon un ancien essai pouvait laisser le bouton bloqué
  redeemRequestId++; // annule tout essai précédent encore en cours (voir submitRedeem)
  // Réveille le serveur Render (plan gratuit, s'endort après 15 min d'inactivité) dès
  // l'ouverture du modal — le temps que la personne tape son code à 6 caractères, le
  // serveur a de bonnes chances d'être déjà réveillé au moment du vrai clic.
  fetch(NUNI_API_BASE + '/api/stats/public').catch(()=>{});
  if(realAuthToken){
    document.getElementById('redeem-email').closest('.field').style.display = 'none';
    document.getElementById('redeem-password').closest('.field').style.display = 'none';
  } else {
    document.getElementById('redeem-email').closest('.field').style.display = '';
    document.getElementById('redeem-password').closest('.field').style.display = '';
  }
  document.getElementById('redeem-overlay').classList.add('show');
}
function closeRedeemModal(){
  document.getElementById('redeem-overlay').classList.remove('show');
}
let redeemRequestId = 0; // protège contre un essai précédent qui répondrait en retard et écraserait un essai plus récent

// Sur le plan gratuit de Render, le serveur peut mettre 30-50s à se réveiller après une
// période d'inactivité — un premier essai peut échouer pile pendant ce réveil. Plutôt que
// d'afficher tout de suite une erreur, on retente automatiquement une fois après un délai.
async function fetchWithRetry(url, options, onRetrying){
  try{
    return await fetch(url, options);
  }catch(e){
    if(onRetrying) onRetrying();
    await new Promise(r=> setTimeout(r, 4000));
    return await fetch(url, options); // 2e essai — si celui-ci échoue aussi, l'erreur remonte normalement
  }
}

async function submitRedeem(){
  const myRequestId = ++redeemRequestId;
  const feedback = document.getElementById('redeem-feedback');
  const btn = document.getElementById('redeem-submit-btn');
  const code = document.getElementById('redeem-code-input').value.trim().toUpperCase();
  btn.disabled = true;
  feedback.style.color = 'var(--text-dim)';
  feedback.textContent = 'Vérification en cours…';

  try{
    // se connecter d'abord si on n'a pas déjà un token en mémoire
    if(!realAuthToken){
      const email = document.getElementById('redeem-email').value.trim();
      const password = document.getElementById('redeem-password').value;
      const loginRes = await fetchWithRetry(NUNI_API_BASE + '/api/login',
        { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password}) },
        ()=>{ if(myRequestId === redeemRequestId) feedback.textContent = 'Le serveur se réveille, nouvel essai dans quelques secondes…'; }
      );
      const loginData = await loginRes.json();
      if(myRequestId !== redeemRequestId) return; // un essai plus récent a pris le relais entre-temps
      if(!loginRes.ok){
        feedback.style.color = 'var(--rose-braise)';
 feedback.textContent = ' ' + loginData.error;
        btn.disabled = false;
        return;
      }
      realAuthToken = loginData.token;
      loadProgress();
      startAccountStatusWatcher();
      syncLikedTracksFromServer();
      realUserId = loginData.user.id;
      currentUser = loginData.user;
      const rememberBox = document.getElementById('redeem-remember');
      saveSession(loginData.token, loginData.user, !rememberBox || rememberBox.checked);
    }

    const res = await fetchWithRetry(NUNI_API_BASE + '/api/subscribe/redeem',
      { method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken}, body: JSON.stringify({code}) },
      ()=>{ if(myRequestId === redeemRequestId) feedback.textContent = 'Le serveur se réveille, nouvel essai dans quelques secondes…'; }
    );
    const data = await res.json();
    if(myRequestId !== redeemRequestId) return; // un essai plus récent a pris le relais entre-temps
    if(!res.ok){
      feedback.style.color = 'var(--rose-braise)';
 feedback.textContent = ' ' + data.error;
      btn.disabled = false;
      return;
    }
    feedback.style.color = '#7FC79A';
 feedback.textContent = ' ' + data.message;
 toast('Accès débloqué — bienvenue sur NUNI en intégralité ️');
    currentUser = data.user;
    demoOverride = false; // une vraie session (connexion/inscription/restauration) prime toujours sur un ancien essai du bouton démo
    applyAccountType();
    // Moment le plus important pour ce rechargement : c'est exactement ici que le compte
    // passe d'inactif à actif — le catalogue chargé avant (sans lien audio, voir
    // stripAudioIfNoAccess côté serveur) doit être rafraîchi maintenant pour que l'écoute
    // devienne enfin possible, sans attendre un rechargement manuel de la page.
    loadRealTracks();
    setTimeout(()=>{
      closeRedeemModal();
      if(currentUser.account_type === 'artist' && !currentUser.has_seen_artist_contract){
        showArtistContract();
      } else {
        enterApp('catalog');
      }
    }, 1200);
  }catch(e){
    if(myRequestId !== redeemRequestId) return; // un essai plus récent a pris le relais entre-temps
    feedback.style.color = 'var(--rose-braise)';
 feedback.textContent = ' Impossible de contacter le serveur NUNI.';
    btn.disabled = false;
  }
}

/* ============ CONTRAT D'ACCUEIL ARTISTE ============
   Affiché une seule fois, juste après la toute première validation de code d'accès d'un
   compte Artiste — jamais une seconde fois ensuite (has_seen_artist_contract, vrai côté
   serveur). Purement un message de sensibilisation : aucun des deux choix n'a d'impact réel
   sur l'utilisation de la plateforme, les deux mènent à l'interface normale ensuite. */
function ensureArtistContractStyles(){
  if(document.getElementById('artist-contract-styles')) return;
  const style = document.createElement('style');
  style.id = 'artist-contract-styles';
  style.textContent = `
    #artist-contract-overlay{position:fixed; inset:0; z-index:99999; background:#0A0A10; display:flex; align-items:center; justify-content:center; padding:24px; opacity:0; transition:opacity .3s ease;}
    #artist-contract-overlay.show{opacity:1;}
    .ac-card{max-width:520px; width:100%; max-height:88vh; overflow-y:auto; background:linear-gradient(160deg, #12140F, #0A0A10); border:1px solid rgba(212,175,106,0.3); border-radius:20px; padding:32px 28px; box-shadow:0 30px 80px rgba(0,0,0,0.6);}
    .ac-eyebrow{font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#D4AF6A; font-weight:700; margin-bottom:10px;}
    .ac-title{font-size:24px; font-weight:800; color:#fff; margin-bottom:18px; line-height:1.25;}
    .ac-body{font-size:14px; line-height:1.75; color:#D8CDB0;}
    .ac-body b{color:#F3E6C8;}
    .ac-body p{margin-bottom:14px;}
    .ac-choices{margin-top:26px; display:flex; flex-direction:column; gap:12px;}
    .ac-choice-btn{width:100%; text-align:left; padding:16px 18px; border-radius:14px; cursor:pointer; font-size:13.5px; font-weight:600; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.04); color:#EDEDED; transition:all .15s ease;}
    .ac-choice-btn:hover{background:rgba(255,255,255,0.08);}
    .ac-choice-btn.primary{background:linear-gradient(135deg,#1E8449,#0E3D2C); border-color:rgba(212,175,106,0.5); color:#F3E6C8;}
    #artist-contract-goodluck{position:fixed; inset:0; z-index:100000; background:#0A0A10; display:flex; align-items:center; justify-content:center; flex-direction:column; text-align:center; padding:24px; opacity:0; transition:opacity .4s ease;}
    #artist-contract-goodluck.show{opacity:1;}
    .ac-gl-emoji{font-size:52px; margin-bottom:18px;}
    .ac-gl-title{font-size:28px; font-weight:800; background:linear-gradient(135deg,#D4AF6A,#1E8449); -webkit-background-clip:text; background-clip:text; color:transparent;}
  `;
  document.head.appendChild(style);
}
function showArtistContract(){
  ensureArtistContractStyles();
  const overlay = document.createElement('div');
  overlay.id = 'artist-contract-overlay';
  overlay.innerHTML = `
    <div class="ac-card">
      <div class="ac-eyebrow">Bienvenue chez NUNI</div>
      <div class="ac-title">Avant de commencer, un mot d'artiste à artiste.</div>
      <div class="ac-body">
        <p>Vous venez d'ouvrir votre espace sur NUNI. Ce que vous en ferez ne dépend que de vous — mais voici, honnêtement, ce qui fait vraiment décoller un artiste ici :</p>
        <p><b>Prenez votre musique au sérieux.</b> Publiez régulièrement, soignez vos sorties, vos pochettes, vos crédits. Chaque vrai stream compte réellement pour votre rémunération.</p>
        <p><b>Restez actif.</b> Un profil qui dort est un profil que le public oublie. Revenez, publiez, répondez à vos fans.</p>
        <p><b>Mobilisez vraiment votre entourage.</b> Vos proches, votre quartier, votre ville — un vrai soutien de celles et ceux qui vous connaissent déjà fait toute la différence au démarrage.</p>
        <p>NUNI, c'est l'avenir de la musique congolaise — construit ici, pour vous rémunérer directement, plutôt que de laisser votre travail perdu sur des plateformes étrangères qui ne reversent presque rien à la scène locale.</p>
      </div>
      <div class="ac-choices">
        <button class="ac-choice-btn" id="ac-decline">Non, je ne veux pas que NUNI me dise quoi faire</button>
        <button class="ac-choice-btn primary" id="ac-accept">Je valide — je prends mon espace NUNI au sérieux</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=> overlay.classList.add('show'));

  const finish = (showGoodLuck)=>{
    // Aucun des deux choix n'a d'impact réel sur l'utilisation de la plateforme — uniquement
    // un message de sensibilisation, jamais réaffiché une fois passé.
    fetch(NUNI_API_BASE + '/api/me/mark-contract-seen', {
      method:'POST', headers:{ 'Authorization':'Bearer ' + realAuthToken }
    }).catch(()=>{});
    currentUser.has_seen_artist_contract = true;
    overlay.classList.remove('show');
    setTimeout(()=>{
      overlay.remove();
      if(showGoodLuck){
        const gl = document.createElement('div');
        gl.id = 'artist-contract-goodluck';
        gl.innerHTML = `<div class="ac-gl-emoji"><svg class="nuni-ic filled nuni-ic-gold" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.7-4.9 4.5 1.3 6.5L12 16.9 6.1 20.2l1.3-6.5-4.9-4.5 6.6-.7z"/></svg></div><div class="ac-gl-title">Bonne chance, étoile de demain.</div>`;
        document.body.appendChild(gl);
        requestAnimationFrame(()=> gl.classList.add('show'));
        setTimeout(()=>{
          gl.classList.remove('show');
          setTimeout(()=>{ gl.remove(); enterApp('catalog'); }, 400);
        }, 5000);
      } else {
        enterApp('catalog');
      }
    }, 250);
  };
  document.getElementById('ac-accept').onclick = ()=> finish(true);
  document.getElementById('ac-decline').onclick = ()=> finish(false);
}

/* ============ PASS DÉCOUVERTE (essai gratuit 24h, heure du Congo) ============
   Important : ceci reste un essai CÔTÉ NAVIGATEUR (aucun compte n'est créé). Avant, le
   compte à rebours vivait uniquement dans une variable JS — recharger la page, ou rouvrir
   le site plus tard, redonnait 24h fraîches à l'infini, et à l'expiration on affichait juste
   une popup fermable sans jamais réellement bloquer l'accès au catalogue. Maintenant :
   - l'heure de fin est mémorisée dans localStorage, donc un rechargement ne relance pas un
     nouvel essai tant que les 24h ne sont pas vraiment passées ;
   - à l'expiration, l'accès est réellement coupé (retour à l'écran de connexion) avant
     d'afficher la proposition de Pass, au lieu de laisser l'app ouverte en arrière-plan.
   Un vrai blocage à toute épreuve (résistant à la navigation privée / vidage du stockage
   local) demanderait un vrai suivi côté serveur — hors de portée d'un simple correctif ici. */
/* ============ PASS DÉCOUVERTE — vrai compte, vrai suivi serveur (24h + 2h de grâce) ============
   Le compte est réellement créé et activé côté serveur (voir /api/register-discovery). Tout
   se base sur `currentUser.subscription_expires_at`, un vrai instant serveur — plus besoin
   de bricoler un fuseau horaire local, une comparaison d'horodatages absolus suffit et reste
   juste quel que soit le fuseau du visiteur. Passé ce délai, un vrai palier de grâce de 2h
   est affiché (le serveur, lui, supprimera réellement le compte après ce délai si aucun vrai
   Pass n'a été validé — voir enforceDiscoveryDeletion côté serveur). */
let discoveryTimer = null;
function startDiscoveryFromServer(){
  if(!currentUser || currentUser.plan !== 'discovery' || !currentUser.subscription_expires_at) return;
  document.getElementById('discovery-banner').style.display = 'flex';
  updateDiscoveryCountdown();
  clearInterval(discoveryTimer);
  discoveryTimer = setInterval(updateDiscoveryCountdown, 1000);
}
function updateDiscoveryCountdown(){
  if(!currentUser || currentUser.plan !== 'discovery'){ clearInterval(discoveryTimer); return; }
  const expiresAt = new Date(currentUser.subscription_expires_at).getTime();
  const remaining = expiresAt - Date.now();
  const el = document.getElementById('discovery-countdown');
  if(remaining > 0){
    const h = String(Math.floor(remaining/3600000)).padStart(2,'0');
    const m = String(Math.floor((remaining%3600000)/60000)).padStart(2,'0');
    const s = String(Math.floor((remaining%60000)/1000)).padStart(2,'0');
    if(el) el.textContent = `${h}:${m}:${s}`;
    return;
  }
  // Essai terminé : palier de grâce réel de 2h avant suppression définitive du compte côté serveur.
  const graceRemaining = (expiresAt + 2*3600000) - Date.now();
  if(graceRemaining > 0){
    const h = String(Math.floor(graceRemaining/3600000)).padStart(2,'0');
    const m = String(Math.floor((graceRemaining%3600000)/60000)).padStart(2,'0');
    if(el) el.textContent = `Compte supprimé dans ${h}h${m}`;
    document.getElementById('discovery-banner').style.background = 'rgba(200,60,60,.18)';
    showDiscoveryGraceModal();
  } else {
    // Le délai de grâce est aussi passé : le compte a normalement déjà été supprimé côté
    // serveur (la prochaine vérification /api/me ou tentative de connexion le confirmera).
    clearInterval(discoveryTimer);
  }
}
let discoveryGraceModalShown = false;
function showDiscoveryGraceModal(){
  if(discoveryGraceModalShown) return;
  discoveryGraceModalShown = true;
  document.getElementById('ai-modal-overlay').classList.add('show');
}
// Bouton "Terminer maintenant (démo)" du bandeau Pass Découverte — permet de passer
// directement au choix d'un vrai Pass sans attendre la fin des 24h d'essai. Le bouton
// existait déjà dans le HTML mais n'appelait aucune fonction réelle (ReferenceError).
function endDiscovery(){
  clearInterval(discoveryTimer);
  const banner = document.getElementById('discovery-banner');
  if(banner) banner.style.display = 'none';
  goTo('plans');
}
function closeAiModal(){
  document.getElementById('ai-modal-overlay').classList.remove('show');
}

/* ============ MIMI — assistant musique congolaise ============ */
/* ---- Animation de l'avatar : clignement auto + états (écoute/réflexion/parole/content) ---- */
function mimiBlinkLoop(){
  function blink(){
    document.querySelectorAll('.mimi-avatar-stage').forEach(el=>{
      el.classList.add('blink');
      setTimeout(()=>el.classList.remove('blink'), 160);
    });
    setTimeout(blink, 2600 + Math.random()*3200);
  }
  setTimeout(blink, 1200);
}
function mimiFace(state){
  document.querySelectorAll('.mimi-avatar').forEach(el=>{
    el.classList.remove('is-listening','is-thinking','is-talking','is-happy');
    if(state && state !== 'idle') el.classList.add('is-'+state);
  });
}
mimiBlinkLoop();

function toggleMimi(){
  const widget = document.getElementById('mimi-widget');
  widget.classList.toggle('open');
  if(widget.classList.contains('open')){
    mimiFace('happy');
    setTimeout(()=>mimiFace('idle'), 900);
  }
}
// ============ BULLE "LE P" DÉPLAÇABLE (maintien puis glisser) ============
// Un tap court garde son comportement normal (ouvre le chat, via toggleMimi). Un appui
// maintenu (450ms sans bouger) passe en mode "glisser" — la bulle suit le doigt/curseur
// jusqu'au relâchement, où elle reste posée à son nouvel endroit (mémorisé pour la
// prochaine visite). Fonctionne à la souris comme au toucher (Pointer Events).
function initMimiDrag(){
  const widget = document.getElementById('mimi-widget');
  const bubble = document.getElementById('mimi-bubble');
  if(!widget || !bubble) return;
  let holdTimer = null, dragging = false, moved = false, startX = 0, startY = 0, offX = 0, offY = 0;

  // Position mémorisée d'une session à l'autre.
  try{
    const saved = JSON.parse(localStorage.getItem('nuni_mimi_pos') || 'null');
    if(saved && typeof saved.left === 'number' && typeof saved.top === 'number'){
      widget.style.left = saved.left + 'px';
      widget.style.top = saved.top + 'px';
      widget.style.bottom = 'auto';
    }
  }catch(e){ /* pas bloquant */ }

  function clampToViewport(left, top){
    const w = widget.offsetWidth || 56, h = widget.offsetHeight || 56;
    return {
      left: Math.max(6, Math.min(window.innerWidth - w - 6, left)),
      top: Math.max(6, Math.min(window.innerHeight - h - 6, top)),
    };
  }

  bubble.addEventListener('pointerdown', (e)=>{
    if(e.button !== undefined && e.button !== 0) return; // clic droit/molette ignorés
    moved = false;
    startX = e.clientX; startY = e.clientY;
    const rect = widget.getBoundingClientRect();
    offX = startX - rect.left; offY = startY - rect.top;
    holdTimer = setTimeout(()=>{
      dragging = true;
      widget.classList.add('is-dragging');
      try{ bubble.setPointerCapture(e.pointerId); }catch(err){ /* pas bloquant */ }
    }, 450);
  });
  bubble.addEventListener('pointermove', (e)=>{
    if(Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6) moved = true;
    if(!dragging) return;
    e.preventDefault();
    const pos = clampToViewport(e.clientX - offX, e.clientY - offY);
    widget.style.left = pos.left + 'px';
    widget.style.top = pos.top + 'px';
    widget.style.bottom = 'auto';
  });
  function endDrag(e){
    clearTimeout(holdTimer);
    if(dragging){
      dragging = false;
      widget.classList.remove('is-dragging');
      const rect = widget.getBoundingClientRect();
      try{ localStorage.setItem('nuni_mimi_pos', JSON.stringify({ left: rect.left, top: rect.top })); }catch(err){ /* pas bloquant */ }
      // Empêche le tap de relâchement de déclencher aussi une ouverture du chat juste après un glisser.
      moved = true;
    }
  }
  bubble.addEventListener('pointerup', endDrag);
  bubble.addEventListener('pointercancel', endDrag);
  bubble.addEventListener('pointerleave', ()=>{ if(!dragging) clearTimeout(holdTimer); });
  // Le clic normal (tap court, sans glisser) garde son onclick="toggleMimi()" existant dans
  // le HTML — on l'empêche juste explicitement si un glisser vient d'avoir lieu.
  bubble.addEventListener('click', (e)=>{ if(moved){ e.stopImmediatePropagation(); e.preventDefault(); moved = false; } });
}
initMimiDrag();

/* Avant : le bouton "Besoin d'en savoir plus sur cet artiste ?" affichait un texte fixe et
   inventé ("Cet artiste mélange rumba traditionnelle...", recommandant un album "Envol" qui
   n'existe pas forcément) — identique peu importe l'artiste réellement affiché. Maintenant :
   ouvre vraiment "Le P" avec une vraie question sur le vrai artiste de la page. */
function askLePAboutArtist(){
  const nameEl = document.getElementById('artist-page-name');
  const artistName = (nameEl && nameEl.textContent.trim()) || (currentTrack && currentTrack.a) || '';
  const widget = document.getElementById('mimi-widget');
  if(!widget.classList.contains('open')){
    widget.classList.add('open');
    mimiFace('happy');
    setTimeout(()=>mimiFace('idle'), 900);
  }
  const input = document.getElementById('mimi-input');
  if(input){
    input.value = artistName ? `Parle-moi de ${artistName}` : 'Parle-moi de cet artiste';
    setTimeout(()=> mimiSend(), 300); // petit délai pour laisser le widget finir de s'ouvrir visuellement
  }
}
const mimiConversation = [
  { k: ['salut', 'bonjour', 'mbote', 'coucou', 'hello', 'bonsoir'],
 a: " Bonjour ! Comment allez-vous aujourd'hui ? Envie d'écouter quelque chose de précis, ou je vous fais une petite recommandation ?",
    alt: [
 "Mbote ! ️ Content de vous revoir sur NUNI. On écoute quoi aujourd'hui ?",
      "Salut à vous ! Je suis là si vous cherchez un morceau précis, un conseil musical, ou juste papoter un peu de musique congolaise.",
 "Coucou ! Prêt à découvrir quelque chose de nouveau, ou plutôt envie de retrouver vos classiques ?",
    ] },
  { k: ['je vais bien', 'ça va bien', 'ca va bien', 'je vais super', 'nickel', 'très bien'],
 a: "Ravie de l'entendre Voulez-vous découvrir les nouveautés du moment, ou plutôt réécouter vos morceaux favoris ?",
    alt: [
 "Super nouvelle ! Journée parfaite pour découvrir un nouvel artiste, non ?",
 "Content de l'entendre ️ Une bonne ambiance appelle une bonne musique — je vous prépare quoi ?",
    ] },
  { k: ['je suis triste', 'pas bien', 'fatigué', 'fatiguée', 'déprimé', 'déprimée', 'difficile'],
 a: " ️ Je comprends. Je peux vous proposer une sélection plus douce — quelques belles rumba congolaises ou un gospel apaisant — pour vous remonter un peu le moral. Voulez-vous que je lance ça ?",
    alt: [
 "Courage ️ La musique aide parfois plus qu'on ne le croit. Envie de quelque chose de doux et apaisant, ou au contraire d'un titre plus entraînant pour se changer les idées ?",
    ] },
  { k: ['mets du rap', 'du rap', 'rap congolais', 'écouter du rap'],
 a: "Très bon choix Direction la Radio Rap Congo — je vous lance ça. Ouvrez le tuner NUNI Radio et sélectionnez la station 88.9 MHz pour enchaîner uniquement du rap congolais." },
  { k: ['mets de la rumba', 'de la rumba', 'écouter de la rumba', 'j\'aime la rumba'],
 a: "Excellent goût La station 90.3 MHz — NUNI Rumba — est faite pour vous. Ouvrez le tuner NUNI Radio pour en profiter en continu." },
  { k: ['mets du gospel', 'du gospel'],
 a: " Direction la station 91.7 MHz — NUNI Gospel — dans le tuner NUNI Radio, pour une belle sélection continue." },
  { k: ['merci', 'merci beaucoup', 'super merci'],
 a: "Avec plaisir ️ Bonne écoute sur NUNI, et n'hésitez pas à revenir si vous avez une autre question.",
    alt: [
 "C'est moi qui vous remercie de faire vivre la musique congolaise ️ À bientôt !",
 "Toujours un plaisir, ndeko Revenez quand vous voulez.",
    ] },
  { k: ['ça va', 'ca va', 'comment vas-tu', 'comment vas tu'],
 a: "Je vais très bien, merci de demander ️ Et vous, quelle est l'ambiance du jour — plutôt calme ou plutôt festive ?",
    alt: [
 "Toujours en forme quand il y a de la bonne musique dans les parages Et vous, comment se passe votre journée ?",
    ] },
  { k: ['recommande', 'recommandation', 'propose moi', 'suggère'],
    a: "Avec plaisir ! Je vous recommande de découvrir <b>Bibi Mwana</b> pour la rumba moderne, ou la playlist Top Congo dans le catalogue si vous voulez un mix des titres les plus populaires du moment.",
    alt: [
 "Dites-moi « recommande-moi des artistes » et je vous sors de vrais artistes qui cartonnent en ce moment, tirés au sort parmi les meilleurs ",
    ] },
  // Avant : "vas y" (et les relances similaires) n'avait AUCUNE vraie réponse dédiée — tombait
  // toujours sur le message générique de secours, donnant une impression très répétitive.
  { k: ['vas y', 'vas-y', 'd\'accord', 'continue', 'je t\'écoute'],
    a: "Alors, dites-moi : plutôt envie de retrouver un classique, de découvrir un nouvel artiste, ou de me parler d'une ambiance précise (romantique, festive, calme) pour que je vous propose quelque chose de collé à votre humeur ?",
    alt: [
 "Parfait Je peux vous parler d'un artiste précis, vous recommander une ambiance, ou vous donner un vrai chiffre sur votre progression (niveau, favoris, artistes suivis). Sur quoi on part ?",
      "Top ! Demandez-moi par exemple : « qui est Franco ? », « recommande-moi des artistes », ou « quel est mon niveau ? » — je réponds avec de vraies infos à chaque fois.",
 "Alors on y va ️ Un style vous tente en particulier — rumba, soukous, gospel, rap congolais ?",
    ] },
];
const mimiKnowledge = [
  { k: ['papa', 'papas', 'légende', 'légendes', 'fondateur', 'fondateurs'],
 a: "Nos papas de la musique congolaise ! ️ On pense d'abord à <b>Joseph Kabasele</b> dit Grand Kallé, le père de la rumba moderne avec l'African Jazz ; <b>Franco Luambo Makiadi</b>, chef du TP OK Jazz, une légende absolue ; et <b>Tabu Ley Rochereau</b>, immense voix et compositeur du Congo. Voulez-vous en savoir plus sur l'un d'eux ?" },
  { k: ['franco', 'ok jazz', 'luambo'],
    a: "<b>Franco Luambo Makiadi</b> (1938–1989) a fondé le TP OK Jazz et est resté une figure centrale de la rumba congolaise pendant plus de 30 ans, avec une guitare reconnaissable entre mille. On le surnomme parfois 'le sorcier de la guitare'." },
  { k: ['tabu ley', 'rochereau'],
    a: "<b>Tabu Ley Rochereau</b> a marqué la rumba congolaise avec l'African Fiesta, puis Afrisa International. Sa voix et ses mélodies ont influencé des générations de musiciens congolais et africains." },
  { k: ['kallé', 'kabasele', 'african jazz', 'grand kallé'],
    a: "<b>Joseph Kabasele</b>, dit Grand Kallé, a fondé l'African Jazz dans les années 1950 à Kinshasa. Son titre « Indépendance Cha Cha » est devenu un hymne panafricain lors des indépendances." },
  { k: ['papa wemba', 'wemba', 'viva la musica'],
    a: "<b>Papa Wemba</b>, star de la rumba et du soukous avec Viva la Musica, a aussi porté la culture congolaise dans le monde entier à travers le mouvement 'Sapeur' (la SAPE)." },
  { k: ['zaiko', 'langa langa'],
    a: "<b>Zaïko Langa Langa</b>, groupe formé en 1969 à Kinshasa, a modernisé la rumba en y intégrant des rythmes plus rapides — une influence majeure sur le soukous moderne." },
  { k: ['mbilia bel'],
    a: "<b>Mbilia Bel</b> est l'une des plus grandes voix féminines de la rumba congolaise, révélée notamment aux côtés de Tabu Ley Rochereau." },
  { k: ['rumba', "qu'est-ce que la rumba", 'rumba congolaise'],
 a: "La <b>rumba congolaise</b> est née dans les années 1940-50 à Kinshasa et Brazzaville, mêlant influences afro-cubaines et rythmes locaux. Elle est reconnue depuis 2021 au patrimoine culturel immatériel de l'UNESCO — une immense fierté congolaise ." },
  { k: ['soukous'],
    a: "Le <b>soukous</b> est né de l'évolution de la rumba congolaise vers un tempo plus rapide et des guitares plus rythmées, popularisé dans les années 70-80 par des groupes comme Zaïko Langa Langa." },
  { k: ['ndombolo'],
    a: "Le <b>ndombolo</b> est un style de danse et de musique apparu dans les années 90, dérivé du soukous, très festif et toujours très présent dans les fêtes congolaises aujourd'hui." },
  { k: ['sape', 'sapeur', 'sapeurs'],
    a: "La <b>SAPE</b> (Société des Ambianceurs et des Personnes Élégantes) est un mouvement vestimentaire né à Brazzaville puis Kinshasa, intimement lié à la musique congolaise — Papa Wemba en était l'une des grandes figures." },
];
/* ============ MIMI — vraies réponses connectées aux données de la personne ============
   Avant : uniquement des réponses génériques par mot-clé, jamais reliées à de vraies
   données. Ici : un petit lot de questions fréquentes reçoit une vraie réponse construite à
   partir des vraies données déjà chargées (favoris, XP/niveau, historique) — pas de fausse
   promesse de "tout comprendre", juste ce qui est honnêtement réalisable sans vraie IA. */
function mimiRealDataAnswer(q){
  if(/mes favoris|ma playlist favor/.test(q)){
 if(!favoritesPlaylist.length) return "Vous n'avez pas encore de favoris — appuyez sur ️ sur un morceau pour commencer votre playlist Favoris.";
    const list = favoritesPlaylist.slice(0,5).map(t=>`« ${t.t} » — ${t.a}`).join('<br>');
    return `Voici vos ${favoritesPlaylist.length > 5 ? '5 derniers' : ''} favoris :<br>${list}`;
  }
  if(/mon (niveau|xp)|combien.*(xp|niveau)/.test(q)){
    if(!currentUser || !realAuthToken) return "Connectez-vous pour que je puisse vous dire votre niveau et votre XP réels.";
    return "Je vérifie votre vraie progression…"; // remplacé juste après par le vrai chiffre (appel réel ci-dessous)
  }
  if(/dernier son|dernier morceau|qu'est-ce que j'ai écouté|derniere ecoute|dernière écoute/.test(q)){
    if(!listeningHistory.length) return "Vous n'avez encore rien écouté durant cette session.";
    const last = listeningHistory[0].track;
    return `Le dernier morceau que vous avez écouté : « ${last.t} » — ${last.a}.`;
  }
  if(/mon historique|qu'ai-je écouté/.test(q)){
    if(!listeningHistory.length) return "Rien dans votre historique pour l'instant durant cette session.";
    const seen = new Set(); const recent = [];
    for(const h of listeningHistory){ if(!seen.has(h.track.t)){ seen.add(h.track.t); recent.push(h.track); if(recent.length>=5) break; } }
    return `Vos ${recent.length} derniers morceaux écoutés :<br>` + recent.map(t=>`« ${t.t} » — ${t.a}`).join('<br>');
  }
  if(/artistes.*(je suis|suivis)|qui.*(je suis|suis-je)/.test(q)){
    if(!currentUser || !realAuthToken) return "Connectez-vous pour que je puisse vous dire quels artistes vous suivez.";
    return "Je vérifie vos vrais abonnements…"; // remplacé juste après par le vrai appel réseau
  }
  if(/recommande.*artiste|conseill.*artiste|découvrir.*artiste|artiste.*découvrir/i.test(q)){
    return "Je regarde qui cartonne vraiment en ce moment…"; // remplacé juste après par le vrai appel réseau
  }
  if(/(actif|active).*artiste|artiste.*(actif|active)|comment travaille|à quel point.*travaille|comment (il|elle) travaille/i.test(q)){
    return "Je vérifie sa vraie activité sur NUNI…"; // remplacé juste après par le vrai appel réseau
  }
  // Vraie échéance d'abonnement — jamais une date inventée, toujours currentUser.subscription_expires_at réel.
  if(/mon abonnement|mon pass|quand.*(expire|expir)|combien.*jours.*(reste|abonnement)|abonnement.*expir/i.test(q)){
    if(!currentUser || !realAuthToken) return "Connectez-vous pour que je puisse vérifier votre vrai abonnement.";
 if(currentUser.subscription_status !== 'active') return "Vous n'avez pas de Pass actif en ce moment — direction l'écran des Pass pour en choisir un ";
    if(!currentUser.subscription_expires_at) return "Votre Pass est actif, sans date de fin enregistrée pour l'instant.";
    const daysLeft = Math.max(0, Math.ceil((new Date(currentUser.subscription_expires_at) - new Date()) / 86400000));
 if(daysLeft <= 3) return ` ️ Votre Pass expire dans ${daysLeft} jour${daysLeft>1?'s':''} seulement — pensez à le renouveler pour ne pas perdre l'accès.`;
    if(daysLeft <= 10) return `Votre Pass expire dans ${daysLeft} jours — vous avez encore un peu de temps, mais n'attendez pas le dernier moment.`;
 return `Votre Pass est actif pour encore ${daysLeft} jours, tout va bien ️`;
  }
  // Encouragement réel pour un artiste qui doute — pas un conseil générique inventé,
  // rattaché à ses vrais chiffres quand ils sont connus côté frontend.
  if(currentUser && currentUser.account_type === 'artist' && /stagne|pas de followers|ça ne marche pas|découragé|decourage|personne (n')?écoute|aucun stream|je (n')?avance pas/i.test(q)){
    return "Ndeko, sois patient. Sur NUNI comme partout, la croissance d'un artiste prend du vrai temps — publiez régulièrement, soignez chaque sortie, et surtout mobilisez vraiment votre entourage proche en premier : c'est souvent ce vrai noyau qui lance tout le reste. Chaque vrai stream compte déjà pour votre rémunération, même les premiers.";
  }
  // Rappel réel du rôle du consommateur — pas un argument marketing vague, chiffré avec le
  // vrai partage de revenu déjà en place sur la plateforme (75% pour l'artiste).
  if(currentUser && currentUser.account_type === 'consumer' && /pourquoi (payer|m'abonner)|à quoi (ça sert|sert mon)|mon abonnement sert à quoi|utilité de mon pass/i.test(q)){
 return "Excellente question — 75% de chaque vrai stream que vous générez revient directement à l'artiste. En écoutant sur NUNI plutôt qu'ailleurs, vous soutenez concrètement la musique congolaise, pas juste symboliquement. Continuez à écouter, suivre et partager : ça change vraiment quelque chose ️";
  }
  return null;
}
async function mimiAnswerRecommendLive(botMsgEl, question){
  try{
    const genreMatch = ['Rumba','Rap','Gospel','Afro','Hip-Hop','Amapiano','Traditionnel'].find(g=> question.toLowerCase().includes(g.toLowerCase()));
    const url = NUNI_API_BASE + '/api/artists/top-streams' + (genreMatch ? '?genre=' + encodeURIComponent(genreMatch) : '');
    const res = await fetch(url);
    if(!res.ok) return;
    const data = await res.json();
    const pool = (data.artists || []).slice(0, 8); // vrai top 8 par streams réels — pas juste le n°1 à chaque fois
    if(!pool.length){ botMsgEl.textContent = genreMatch ? `Personne ne publie encore vraiment en ${genreMatch} sur NUNI pour l'instant.` : "Aucun artiste avec un vrai Pass actif pour l'instant."; return; }
    // Vrai tirage aléatoire parmi les meilleurs, pas toujours le même en tête — donne
    // une vraie chance à plusieurs vrais artistes qui performent bien, pas seulement au n°1.
    const shuffled = [...pool].sort(()=> Math.random()-0.5);
    const picks = shuffled.slice(0, Math.min(3, shuffled.length));
 const names = picks.map(a=> ` ${esc(a.artist_name || a.first_name)}${a.is_verified ? ' ' : ''} — ${(a.total_streams||0).toLocaleString('fr-FR')} streams`).join('<br>');
    botMsgEl.innerHTML = `${genreMatch ? `En ${genreMatch}, ` : ''}voici de vrais artistes qui performent bien en ce moment :<br>${names}<br><span style="opacity:.7; font-size:12px;">Demandez-moi encore et je vous en proposerai d'autres.</span>`;
  }catch(e){ /* pas grave, le message d'attente reste affiché */ }
}
async function mimiAnswerArtistActivityLive(botMsgEl, question){
  try{
    // Cherche un vrai nom d'artiste réellement présent dans le catalogue, mentionné dans la question.
    const realArtistNames = [...new Set(tracks.filter(t=>t.isReal && t.artistId).map(t=>t.a))];
    const mentioned = realArtistNames.find(name => question.toLowerCase().includes(name.toLowerCase()));
    if(!mentioned){ botMsgEl.textContent = "Précisez le nom d'un vrai artiste NUNI et je vous dirai où il en est."; return; }
    const artistTrack = tracks.find(t=> t.a === mentioned && t.artistId);
    const res = await fetch(NUNI_API_BASE + '/api/artist/' + artistTrack.artistId + '/public-stats');
    if(!res.ok) return;
    const data = await res.json();
    const activityLabel = data.track_count >= 20 ? 'très actif' : data.track_count >= 5 ? 'régulièrement actif' : 'encore en début de parcours';
    botMsgEl.innerHTML = `${mentioned} est ${activityLabel} sur NUNI — ${data.track_count} morceau${data.track_count>1?'x':''} publié${data.track_count>1?'s':''}, suivi par ${(data.follower_count||0).toLocaleString('fr-FR')} personne${data.follower_count>1?'s':''}.`;
  }catch(e){ /* pas grave, le message d'attente reste affiché */ }
}
async function mimiAnswerFollowingLive(botMsgEl){
  if(!realAuthToken) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/following', { headers:{ 'Authorization':'Bearer '+realAuthToken } });
    if(!res.ok) return;
    const data = await res.json();
    const list = data.following || [];
    if(!list.length){ botMsgEl.textContent = "Vous ne suivez encore aucun artiste — allez faire un tour sur une page artiste et appuyez sur « Suivre » !"; return; }
 const names = list.slice(0,8).map(a=> (a.artist_name || a.first_name) + (a.is_verified ? ' ' : '')).join('<br>');
    botMsgEl.innerHTML = `Vous suivez ${list.length} artiste${list.length>1?'s':''} :<br>${names}`;
  }catch(e){ /* pas grave, le message d'attente reste affiché */ }
}
async function mimiAnswerXpLive(botMsgEl){
  if(!realAuthToken) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/progress', { headers:{ 'Authorization':'Bearer '+realAuthToken } });
    if(!res.ok) return;
    const data = await res.json();
 botMsgEl.innerHTML = `Vous êtes niveau ${data.level} — ${data.name}, avec ${data.xp} XP${data.xp_for_next ? ' (encore ' + (data.xp_for_next - data.xp) + ' XP avant le niveau suivant)' : ' (niveau max atteint !)'} `;
  }catch(e){ /* pas grave, le message d'attente reste affiché */ }
}

function mimiAsk(question){
  const box = document.getElementById('mimi-messages');
  const userMsg = document.createElement('div');
  userMsg.className = 'mimi-msg user';
  userMsg.textContent = question;
  box.appendChild(userMsg);
  mimiFace('thinking');

  const q = question.toLowerCase();
  const realAnswer = mimiRealDataAnswer(q);
  let answer = realAnswer || pickVariedFallback();
  let found = !!realAnswer;
  const isLiveXpQuery = /mon (niveau|xp)|combien.*(xp|niveau)/.test(q) && currentUser && realAuthToken;
  const isLiveFollowingQuery = /artistes.*(je suis|suivis)|qui.*(je suis|suis-je)/.test(q) && currentUser && realAuthToken;
  const isLiveRecommendQuery = /recommande.*artiste|conseill.*artiste|découvrir.*artiste|artiste.*découvrir/i.test(q);
  const isLiveArtistActivityQuery = /(actif|active).*artiste|artiste.*(actif|active)|comment travaille|à quel point.*travaille|comment (il|elle) travaille/i.test(q);
  if(!found){
    for(const entry of mimiConversation){
      if(entry.k.some(word => q.includes(word))){ answer = pickVariant(entry); found = true; break; }
    }
  }
  if(!found){
    for(const entry of mimiKnowledge){
      if(entry.k.some(word => q.includes(word))){ answer = pickVariant(entry); break; }
    }
  }
  setTimeout(()=>{
    const botMsg = document.createElement('div');
    botMsg.className = 'mimi-msg bot';
    botMsg.innerHTML = answer;
    box.appendChild(botMsg);
    box.scrollTop = box.scrollHeight;
    mimiFace('talking');
    const plainLen = answer.replace(/<[^>]+>/g,'').length;
    const talkMs = Math.min(3200, Math.max(700, plainLen*35));
    setTimeout(()=>mimiFace('idle'), talkMs);
    if(isLiveXpQuery) mimiAnswerXpLive(botMsg);
    if(isLiveFollowingQuery) mimiAnswerFollowingLive(botMsg);
    if(isLiveRecommendQuery) mimiAnswerRecommendLive(botMsg, question);
    if(isLiveArtistActivityQuery) mimiAnswerArtistActivityLive(botMsg, question);
  }, 450);
  box.scrollTop = box.scrollHeight;
}
// Petites variantes pour ne pas répéter mot pour mot la même phrase — entry.a reste la
// réponse principale, entry.alt (facultatif) ajoute 1-2 autres façons de le dire.
function pickVariant(entry){
  if(entry.alt && entry.alt.length && Math.random() < 0.5){
    return entry.alt[Math.floor(Math.random()*entry.alt.length)];
  }
  return entry.a;
}
const mimiFallbacks = [
 "Pour un début, je peux discuter simplement avec vous, vous recommander de la musique selon votre humeur, ou vous parler de nos grandes figures historiques (Grand Kallé, Franco, Tabu Ley, Papa Wemba...) et des styles comme la rumba ou le soukous ️",
  "Je ne suis pas sûre d'avoir compris — mais je peux vous parler de la musique congolaise, vous recommander un style selon votre humeur, ou vous dire vos favoris/dernier morceau écouté si vous êtes connecté(e).",
 "Essayez de me demander « mes favoris », « mon niveau », ou parlez-moi de la rumba, du soukous, ou d'un artiste comme Franco ou Papa Wemba ",
  "Hmm, reformulez peut-être ? Je suis plus à l'aise avec la musique congolaise, vos vraies stats (niveau, favoris, artistes suivis), ou une vraie recommandation d'artiste.",
 "Je n'ai pas tout saisi, mais dites-moi « recommande-moi des artistes » ou posez-moi une question sur un artiste précis — je vous réponds avec de vraies infos ️",
];
function pickVariedFallback(){ return mimiFallbacks[Math.floor(Math.random()*mimiFallbacks.length)]; }
function mimiSend(){
  const input = document.getElementById('mimi-input');
  const q = input.value.trim();
  if(!q) return;
  mimiAsk(q);
  input.value = '';
}
/* ============ MENTIONS LÉGALES ============ */
const legalContent = {
  privacy: {
    title: 'Politique de confidentialité',
    body: `
      <p>NUNI collecte uniquement les informations nécessaires au fonctionnement du service : identité, contact, ville, historique d'écoute et informations de paiement transmises par votre opérateur Mobile Money.</p>
      <h4>Données collectées</h4>
      <ul><li>Informations de compte (nom, pseudo, email, téléphone, ville)</li><li>Historique d'écoute et préférences musicales</li><li>Informations de paiement (traitées par MTN/Airtel, jamais stockées en clair par NUNI)</li></ul>
      <h4>Utilisation</h4>
      <p>Ces données servent à personnaliser votre expérience, calculer la rémunération des artistes, et améliorer la plateforme. Elles ne sont jamais vendues à des tiers.</p>
      <h4>Vos droits</h4>
      <p>Vous pouvez à tout moment demander l'accès, la correction ou la suppression de vos données depuis Paramètres → Confidentialité.</p>
      <p style="color:var(--text-faint); font-size:12px; margin-top:16px;">Document de démonstration — à faire valider par un juriste avant mise en production.</p>`
  },
  terms: {
    title: "Conditions d'utilisation",
    body: `
      <p>En créant un compte NUNI, vous acceptez les présentes conditions.</p>
      <h4>Compte</h4>
      <p>Vous devez avoir 16 ans ou plus. Les informations fournies doivent être exactes. Un compte est personnel et non transférable.</p>
      <h4>Abonnements et paiement</h4>
      <p>Les Pass Auditeur et Artiste sont facturés par trimestre ou par an via MTN Mobile Money ou Airtel Money. Le Pass Découverte est gratuit pendant 24h, sans engagement.</p>
      <h4>Contenu artiste</h4>
      <p>L'artiste garantit détenir les droits sur tout contenu publié. NUNI se réserve le droit de retirer tout contenu signalé ou en infraction avec le droit d'auteur.</p>
      <h4>Résiliation</h4>
      <p>Vous pouvez résilier votre abonnement à tout moment depuis votre profil ; l'accès reste actif jusqu'à la fin de la période payée.</p>
      <p style="color:var(--text-faint); font-size:12px; margin-top:16px;">Document de démonstration — à faire valider par un juriste avant mise en production.</p>`
  },
  legal: {
    title: 'Mentions légales',
    body: `
      <p><b>Éditeur :</b> NUNI SAS (nom à confirmer)<br><b>Siège :</b> Brazzaville, République du Congo<br><b>Contact :</b> contact@nuni.cg (exemple)</p>
      <h4>Hébergement</h4>
      <p>La plateforme est hébergée sur une infrastructure cloud sécurisée (à préciser selon le prestataire choisi).</p>
      <h4>Propriété intellectuelle</h4>
      <p>Le nom NUNI, le logo et l'identité visuelle sont la propriété exclusive de leurs créateurs. Toute reproduction sans autorisation est interdite.</p>
      <h4>Responsabilité</h4>
      <p>NUNI agit comme intermédiaire technique entre artistes et auditeurs. La responsabilité du contenu publié incombe à l'artiste qui le téléverse.</p>
      <p style="color:var(--text-faint); font-size:12px; margin-top:16px;">Document de démonstration — informations à compléter avec vos données légales réelles.</p>`
  },
  cookies: {
    title: 'Cookies',
    body: `
      <p>NUNI utilise des cookies et technologies similaires pour :</p>
      <ul><li>Vous garder connecté entre deux visites</li><li>Mémoriser vos préférences (thème clair/sombre, volume)</li><li>Mesurer l'audience de façon anonymisée</li></ul>
      <h4>Gestion</h4>
      <p>Vous pouvez désactiver les cookies non essentiels depuis les paramètres de votre navigateur. Les cookies strictement nécessaires au fonctionnement (connexion, sécurité) ne peuvent pas être désactivés.</p>
      <p style="color:var(--text-faint); font-size:12px; margin-top:16px;">Document de démonstration — à adapter selon les outils analytiques réellement utilisés.</p>`
  }
};
function openLegal(type){
  const data = legalContent[type];
  if(!data) return;
  document.getElementById('legal-title').textContent = data.title;
  document.getElementById('legal-body').innerHTML = data.body;
  document.getElementById('legal-modal-overlay').classList.add('show');
}
function closeLegal(){
  document.getElementById('legal-modal-overlay').classList.remove('show');
}
function aiChoosePlan(type){
  closeAiModal();
  goTo('plans'); // affiche d'abord l'écran des Pass en arrière-plan (cohérent visuellement)
  choosePlan(type); // puis ouvre directement le vrai formulaire d'inscription, sans clic supplémentaire
 toast(type==='artist' ? "L'assistant NUNI vous a dirigé vers le Pass Artiste " : "L'assistant NUNI vous a dirigé vers le Pass Auditeur ");
}

function updateGreeting(){
  const titleEl = document.getElementById('catalog-greeting-title');
  const subEl = document.getElementById('catalog-greeting-sub');
  if(!titleEl) return;
  const congoHour = new Date().toLocaleString('en-US', { timeZone: 'Africa/Brazzaville', hour:'2-digit', hour12:false });
  const h = parseInt(congoHour, 10);
  let title, subs;
  if(h >= 5 && h < 12){
    title = 'Mbote, bonjour <svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>';
    subs = ["Un nouveau jour, une nouvelle playlist rien que pour vous.", "Le Congo se réveille en musique — voici de quoi bien commencer.", "Café, soleil et rumba : voici votre matinée idéale."];
  } else if(h >= 12 && h < 17){
    title = 'Bon après-midi <svg class="nuni-ic filled nuni-ic-gold" viewBox="0 0 24 24"><circle cx="7.5" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/><path d="M10 18V5l9.5-2v13"/></svg>';
    subs = ["Une pause musicale bien méritée vous attend.", "Ça bouge au Congo cet après-midi — venez écouter.", "De quoi accompagner le reste de votre journée en beauté."];
  } else if(h >= 17 && h < 21){
    title = 'Bonsoir <svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/></svg>';
    subs = ["Voici ce qui fait vibrer le Congo cette semaine.", "La soirée commence bien avec la bonne musique.", "Installez-vous, on s'occupe de l'ambiance."];
  } else {
    title = 'Bonne nuit, mélomane <svg class="nuni-ic filled nuni-ic-gold" viewBox="0 0 24 24"><path d="M20.8 14.5A8.5 8.5 0 1 1 9.5 3.2a7 7 0 0 0 11.3 11.3z"/></svg>';
    subs = ["Une sélection douce pour finir la journée en beauté.", "Encore quelques titres avant de dormir ?", "La nuit congolaise a aussi sa propre musique."];
  }
  titleEl.innerHTML = title;
  subEl.textContent = subs[Math.floor(Math.random()*subs.length)];
  [titleEl, subEl].forEach(el=>{
    el.classList.remove('greeting-anim'); void el.offsetWidth; el.classList.add('greeting-anim');
  });
}

// ---------- "Écoutés récemment" — avant : basé uniquement sur listeningHistory, une
// mémoire en RAM du navigateur remise à zéro à chaque connexion/rechargement (donc
// invisible dès qu'on revenait sur NUNI). Maintenant : le vrai historique d'écoute
// persistant côté serveur (table plays, /api/me/recently-played) — visible sur n'importe
// quel appareil, à n'importe quel moment, tant qu'un vrai stream a été enregistré.
async function renderContinueListening(){
  const wrap = document.getElementById('shelf-continue-wrap');
  const row = document.getElementById('shelf-continue');
  if(!wrap || !row) return;
  if(!realAuthToken){ wrap.style.display = 'none'; return; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/recently-played?limit=15', { headers:{ 'Authorization':'Bearer '+realAuthToken } });
    if(!res.ok){ wrap.style.display = 'none'; return; }
    const data = await res.json();
    // On réutilise les objets déjà chargés dans `tracks` (même vraie pochette, mêmes vrais
    // streams déjà en mémoire) plutôt que de tout re-mapper depuis zéro — évite deux sources
    // de vérité différentes pour le même morceau. La vraie date d'écoute (last_played_at,
    // déjà renvoyée par le serveur mais jamais exploitée jusqu'ici) est conservée pour
    // afficher un repère "il y a X" réel sur chaque carte, plus immersif.
    const recent = (data.tracks || [])
      .map(r => { const tr = tracks.find(t => t.isReal && t.realId === r.id); return tr ? { tr, lastPlayedAt: r.last_played_at } : null; })
      .filter(Boolean);
    if(!recent.length){ wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    row.innerHTML = '';
    fillShelf('shelf-continue', recent.map(x=>x.tr));
    // FIX : le badge "il y a X" est purement cosmétique — une erreur ici ne doit JAMAIS
    // cacher la section entière alors que les vraies cartes viennent d'être correctement
    // affichées juste au-dessus. Avant, ce bloc n'avait pas son propre try/catch : la
    // moindre erreur (ex. décalage d'index si dedupeAlbums avait fusionné des cartes)
    // remontait au catch englobant, qui mettait wrap.style.display='none' et effaçait tout.
    try{
      const cards = row.querySelectorAll('.track-card');
      recent.forEach((x, i)=>{
        const cover = cards[i] && cards[i].querySelector('.cover');
        if(!cover || !x.lastPlayedAt) return;
        const mins = Math.max(0, Math.round((Date.now() - new Date(x.lastPlayedAt).getTime())/60000));
        const label = mins < 1 ? "à l'instant" : mins < 60 ? `il y a ${mins} min` : mins < 1440 ? `il y a ${Math.round(mins/60)} h` : `il y a ${Math.round(mins/1440)} j`;
        const badge = document.createElement('span');
        badge.className = 'recent-play-badge';
        badge.textContent = label;
        cover.appendChild(badge);
      });
    }catch(e){ console.error('[renderContinueListening] badge ignoré après erreur :', e); }
  }catch(e){ wrap.style.display = 'none'; }
}
// ---------- "Tout voir" de l'historique d'écoute — réutilise openCategoryPage (même
// vitrine que Nouveautés/Top Congo), avec la vraie liste complète du serveur pré-chargée
// avant l'ouverture puisque cette page attend une fonction synchrone.
async function openRecentlyPlayedPage(){
  let recentFull = [];
  if(realAuthToken){
    try{
      const res = await fetch(NUNI_API_BASE + '/api/me/recently-played?limit=60', { headers:{ 'Authorization':'Bearer '+realAuthToken } });
      if(res.ok){
        const data = await res.json();
        recentFull = (data.tracks || [])
          .map(r => tracks.find(t => t.isReal && t.realId === r.id))
          .filter(Boolean);
      }
    }catch(e){ /* la page s'ouvre quand même, juste vide */ }
  }
  openCategoryPage(
    'Écoutés récemment',
    "Votre vrai historique d'écoute sur NUNI, du plus récent au plus ancien.",
    ()=> recentFull,
    false,
  );
}

let isOpeningArtistPage = false; // garde-fou anti-boucle : openArtistPage appelle enterApp('artist'),
                                   // qui sans ce garde-fou rappellerait openArtistPage indéfiniment.
function enterApp(view){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('app-shell').classList.add('active');
  // Comportement façon Apple Music / Spotify : le lecteur n'existe pas visuellement tant
  // qu'aucun son n'a été lancé — pas de barre, pas de bulle, pas d'espace réservé. Il
  // n'apparaît que lorsqu'une vraie lecture démarre (voir togglePlay()), et redevient
  // invisible à la déconnexion (voir stopAllPlayback()). On ne touche donc plus ici à
  // son affichage : s'il était déjà visible parce qu'un son joue, il le reste ; sinon il
  // reste caché, sans jamais le forcer à apparaître à l'entrée dans l'app.
  document.getElementById('mobile-tabbar').style.removeProperty('display');
  document.getElementById('demo-nav').classList.remove('no-player');
  document.getElementById('mimi-widget').classList.remove('no-player');
  loadNotifications();
  if(!window.__notifPollingStarted){ window.__notifPollingStarted = true; setInterval(loadNotifications, 60000); }
  if(view === 'catalog'){ updateGreeting(); renderContinueListening(); loadProgress(); }
  if(view === 'clips') loadRealClips(); // recharge les vrais clips à chaque ouverture (loadRealClips appelle renderClips())
  if(view === 'library') openLibraryHome();
  if(view !== 'dashboard'){ clearTimeout(labelStatusPollTimer); }
  if(view === 'artist' && currentUser && currentUser.account_type === 'artist' && !isOpeningArtistPage){
    openArtistPage(currentUser.artist_name, currentUser.id); // sinon l'onglet ne fait qu'afficher l'ancien contenu, jamais rafraîchi
    return; // openArtistPage rappelle enterApp('artist') lui-même (avec le garde-fou actif) pour finir l'affichage
  }
  if(view === 'dashboard'){
    const labelPlaceholder = document.getElementById('label-dashboard-placeholder');
    const artistBody = document.getElementById('artist-dashboard-body');
    const isLabelAccount = currentUser && currentUser.account_type === 'label';
    if(labelPlaceholder) labelPlaceholder.style.display = isLabelAccount ? 'block' : 'none';
    if(artistBody) artistBody.style.display = isLabelAccount ? 'none' : 'block';
    if(isLabelAccount){
      loadLabelDashboardStatus();
    } else {
      loadArtistStats();
      loadDashboardChart();
      loadPaymentsHistory();
      loadRealPaymentStatus();
      applySavedRevenuePrivacy();
      const momoInput = document.getElementById('momo-number-input');
      if(momoInput) momoInput.value = (currentUser && currentUser.momo_number) || '';
      const bioInput = document.getElementById('artist-bio-input');
      if(bioInput) bioInput.value = (currentUser && currentUser.bio) || '';
      const avatarDash = document.getElementById('avatar-preview-dash');
      if(avatarDash && currentUser && currentUser.avatar_url){
        avatarDash.style.backgroundImage = `url(${currentUser.avatar_url})`;
        avatarDash.textContent = '';
      }
      const coverDash = document.getElementById('cover-preview-dash');
      if(coverDash && currentUser && currentUser.banner_url){
        coverDash.style.backgroundImage = `url(${currentUser.banner_url})`;
      }
      loadFeaturedPicker();
      loadDashboardConcerts();
      loadMyLabelInvites();
      loadMyLabelTeamInvites();
      artistGallerySlotFiles = [null, null, null, null, null];
      renderArtistGallerySlots();
    }
  }
  if(view === 'search'){
    renderSearchViewBrowse();
    const input = document.getElementById('asv-input');
    if(input){ input.value = ''; setTimeout(()=> input.focus(), 50); }
    document.getElementById('asv-clear-btn').style.display = 'none';
  }
  if(view === 'concerts') loadConcertsPage();
  if(view === 'nuniEvents') loadNuniEventsPage();
  ['catalog','clips','ads','library','artist','dashboard','admin','search','concerts','nuniEvents'].forEach(v=>{
    const el = document.getElementById('view-'+v);
    if(!el) return;
    if(v === view){
      el.style.display = 'block';
      // Transition en fondu douce entre les pages — retire puis réapplique la classe pour
      // que l'animation CSS se relance à chaque changement de vue, pas juste la première fois.
      el.classList.remove('app-view-fade-in');
      void el.offsetWidth; // force le navigateur à "oublier" l'état précédent avant de réappliquer la classe
      el.classList.add('app-view-fade-in');
    } else {
      el.style.display = 'none';
    }
  });
  // Le Dashboard est plein de champs de formulaire qui commencent tout près du bord gauche
  // sur mobile — la bulle Mimi (fixe, bas-gauche) finissait par recouvrir leurs libellés
  // (ex: "Titre du projet"). Cette classe permet au CSS de la décaler pendant qu'on est sur
  // cet écran précis, sans la faire disparaître ni casser son comportement ailleurs.
  document.body.classList.toggle('view-is-dashboard', view === 'dashboard');
  // ---- Pendant que la recherche plein écran (ou les pages Concerts/Événements qui en
  // découlent) est active, les autres onglets disparaissent de la navigation (desktop +
  // mobile) — ne reste que "Accueil", comme demandé (même principe que l'onglet Recherche
  // d'Apple Music). ----
  const searchActive = view === 'search' || view === 'concerts' || view === 'nuniEvents';
  document.querySelectorAll('.app-nav-link').forEach(l=>{
    l.style.display = searchActive ? (l.dataset.appLink === 'catalog' ? '' : 'none') : '';
  });
  document.querySelectorAll('.tab-btn').forEach(b=>{
    b.style.display = searchActive ? (b.dataset.tab === 'catalog' ? '' : 'none') : '';
  });
  document.querySelectorAll('.app-nav-link').forEach(l=>{
    l.classList.toggle('is-active', l.dataset.appLink === view);
  });
  document.querySelectorAll('.tab-btn').forEach(b=>{
    b.classList.toggle('is-active', b.dataset.tab === view);
  });
  // IMPORTANT : applyAccountType() lit l'onglet actif (document.querySelector('.app-nav-link.is-active'))
  // pour décider s'il faut rediriger vers le catalogue (compte consumer/label égaré sur une
  // vue réservée aux artistes) — elle doit donc être appelée APRÈS la mise à jour ci-dessus,
  // jamais avant. Avant ce correctif, elle lisait encore l'ancien onglet actif (celui de la
  // vue précédente), ce qui pouvait redéclencher enterApp('catalog') → applyAccountType() →
  // enterApp('catalog') → ... indéfiniment, avec des centaines d'appels réseau en cascade.
  if(!searchActive) applyAccountType(); // restaure les onglets nav-artist-only/nav-consumer-only masqués ci-dessus, selon le vrai type de compte
  window.scrollTo({top:0, behavior:'smooth'});
  setTimeout(initScrollReveal, 60); // laisse le contenu de la vue s'installer avant de repérer les nouvelles sections
}

/* ============ AIDE / SUPPORT ============
   Bouton flottant repurposé (avant : contournait le système de Pass, désormais désactivé
   ailleurs) — vrai contact WhatsApp/email déjà utilisés partout ailleurs sur NUNI, et une
   vraie FAQ honnête, sans rien inventer sur le fonctionnement réel de la plateforme. */
// ============ INSTALLER NUNI EN APPLICATION (PWA) ============
// Android/Chrome : l'installation peut être déclenchée directement via l'événement
// standard 'beforeinstallprompt', capturé dès le chargement de la page. iOS Safari ne
// propose AUCUNE API pour déclencher ça par le code (restriction d'Apple, pas de NUNI) —
// la seule voie est manuelle (Partager → Sur l'écran d'accueil), donc on affiche de vraies
// instructions à la place, avec les bonnes captures selon l'appareil détecté.
let nuniInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  nuniInstallPrompt = e;
});
function isRunningAsInstalledApp(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
async function installNuniApp(){
  document.getElementById('demo-menu').classList.remove('open');
  if(isRunningAsInstalledApp()){
    toast('NUNI est déjà installé sur cet appareil !');
    return;
  }
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document);

  if(nuniInstallPrompt){
    // Android/Chrome/Edge : vraie boîte de dialogue d'installation native du navigateur.
    nuniInstallPrompt.prompt();
    try{ await nuniInstallPrompt.userChoice; }catch(e){ /* pas bloquant */ }
    nuniInstallPrompt = null;
    return;
  }

  if(isIOS){
    document.getElementById('legal-title').textContent = 'Installer NUNI sur iPhone / iPad';
    document.getElementById('legal-body').innerHTML = `
      <p>iOS ne permet pas d'installer une application web automatiquement — voici comment le faire en 2 étapes, directement depuis Safari :</p>
      <h4>1. Appuyez sur le bouton Partager</h4>
      <p>L'icône <b>□ avec une flèche vers le haut</b>, en bas de l'écran dans Safari (ou en haut à côté de la barre d'adresse selon votre modèle).</p>
      <h4>2. Sélectionnez « Sur l'écran d'accueil »</h4>
      <p>Faites défiler la liste si besoin. NUNI apparaîtra ensuite comme une vraie application, avec son icône, sans la barre d'adresse du navigateur.</p>
      <p style="color:var(--text-faint); font-size:12.5px; margin-top:16px;">Cette fonctionnalité doit obligatoirement passer par Safari — elle n'est pas disponible dans Chrome ou une autre app sur iPhone (restriction d'Apple).</p>
    `;
    document.getElementById('legal-modal-overlay').classList.add('show');
    return;
  }

  // Android/desktop sans invite capturée (déjà refusée récemment, ou navigateur qui ne
  // supporte pas beforeinstallprompt) : instructions génériques de repli.
  document.getElementById('legal-title').textContent = 'Installer NUNI';
  document.getElementById('legal-body').innerHTML = `
    <p>Ouvrez le menu de votre navigateur (généralement les trois points en haut à droite) et cherchez <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.</p>
    <p style="color:var(--text-faint); font-size:12.5px; margin-top:16px;">Si l'option n'apparaît pas, votre navigateur ne la propose pas encore — Chrome et Edge sur Android fonctionnent le mieux pour ça.</p>
  `;
  document.getElementById('legal-modal-overlay').classList.add('show');
}
function openHelpWhatsApp(){
  document.getElementById('demo-menu').classList.remove('open');
  openWhatsApp('https://wa.me/242068951600');
}
function openHelpEmail(){
  document.getElementById('demo-menu').classList.remove('open');
  window.location.href = 'mailto:nunimisiki@gmail.com';
}
const faqContent = `
  <h4>Comment fonctionne le Pass Découverte ?</h4>
  <p>Un vrai compte est créé, activé gratuitement 24h. Passé ce délai, vous avez 2h pour choisir un vrai Pass avant que le compte ne soit automatiquement supprimé.</p>
  <h4>Comment fonctionne mon Dashboard (pour les artistes) ?</h4>
  <p>Votre Dashboard suit deux choses séparément, et c'est important de bien comprendre la différence :</p>
  <p><b>Vos streams publics</b> — visibles sur votre profil, dans les classements, sur vos pages morceaux. Ce chiffre ne redescend <b>jamais</b>, même après un paiement. Il représente tout ce que vous avez réellement fait écouter depuis le début.</p>
  <p><b>Vos streams "période en cours"</b> — la partie de vos streams qui n'a pas encore été payée. Dès que NUNI vous verse un paiement, ce compteur repart de zéro et recommence à grimper avec vos nouvelles écoutes, pendant que vos streams publics, eux, continuent d'augmenter sans jamais être affectés.</p>
  <p>Dans la section <b>« Paiements &amp; Revenus »</b> de votre Dashboard, vous voyez toujours : le montant qui vous est dû en ce moment, combien de streams ce montant couvre, la date de votre dernier versement, et l'historique complet de tout ce que vous avez déjà reçu.</p>
  <h4>Comment vais-je recevoir mon argent ?</h4>
  <p>Deux façons de recevoir vos revenus, au choix :</p>
  <p><b>1. En vous rapprochant de l'agence</b> — vous passez récupérer votre versement directement auprès de l'équipe NUNI.</p>
  <p><b>2. Par virement Mobile Money</b> — le montant est envoyé directement sur le numéro Mobile Money que vous avez renseigné dans votre Dashboard.</p>
  <p>Dans les deux cas, le montant est calculé sur vos vraies écoutes uniquement — jamais un chiffre estimé ou arrondi au hasard, et jamais réinitialisé sans qu'un vrai paiement ait eu lieu.</p>
  <h4>Comment gagner plus avec ma musique ?</h4>
  <p>Votre revenu dépend directement du nombre de vraies personnes qui vous écoutent. Plus votre musique touche d'auditeurs, plus votre part grandit — il n'y a pas de raccourci : publier régulièrement, soigner vos sorties et faire grandir votre communauté d'auditeurs est ce qui fait vraiment progresser vos revenus sur NUNI. Chaque écoute compte, alors continuez à travailler votre musique et à élargir votre audience.</p>
  <h4>Comment les artistes sont-ils payés ?</h4>
  <p>Chaque écoute réelle (Pass Auditeur payant) génère un revenu, dont 75% revient directement à l'artiste. Les écoutes en Pass Découverte ne comptent pas tant qu'aucun Pass payant n'est validé.</p>
  <h4>Comment payer mon Pass ?</h4>
  <p>Après avoir choisi un Pass, vous êtes redirigé vers WhatsApp pour finaliser le paiement (Mobile Money). Un code d'accès vous est ensuite envoyé par email pour activer votre compte.</p>
  <h4>J'ai un problème avec mon compte</h4>
  <p>Contactez-nous directement sur WhatsApp ou par email — nous répondons sous 48h.</p>
  <h4>Comment supprimer mon compte ?</h4>
  <p>Contactez le support par WhatsApp ou email, en précisant l'adresse email de votre compte NUNI.</p>
`;
function openHelpFaq(){
  document.getElementById('demo-menu').classList.remove('open');
  document.getElementById('legal-title').textContent = 'Questions fréquentes';
  document.getElementById('legal-body').innerHTML = faqContent;
  document.getElementById('legal-modal-overlay').classList.add('show');
}
document.getElementById('demo-toggle').addEventListener('click', ()=>{
  document.getElementById('demo-menu').classList.toggle('open');
});

/* ============ CATALOG DATA ============ */
const artistProfiles = {
  'Bibi Mwana': { meta:'Rumba · Afro · Kinshasa', bio:"Bibi Mwana réinvente la rumba congolaise avec des arrangements modernes et une voix habitée. Entre Kinshasa et la diaspora, son univers tisse mémoire et avenir — chaque sortie est pensée comme un envol collectif pour la scène locale.", verified:true },
  'Ndombe Junior': { meta:'Afro · Kinshasa', bio:"Ndombe Junior mélange afrobeat et sonorités urbaines congolaises, porté par une énergie scénique reconnue dans toute la sous-région.", verified:true },
  'Kessy Tina': { meta:'Gospel · Pointe-Noire', bio:"Kessy Tina porte un gospel congolais moderne, entre chœurs traditionnels et productions actuelles, avec un message d'espoir au cœur de chaque titre.", verified:false },
  'Mbote System': { meta:'Hip-Hop · Brazzaville', bio:"Collectif hip-hop de Brazzaville, Mbote System raconte le quotidien urbain congolais avec des flows incisifs et des productions denses.", verified:false },
  'Les Anges du Rythme': { meta:'Traditionnel · Kinshasa', bio:"Les Anges du Rythme perpétuent les rythmes traditionnels congolais tout en les rapprochant des oreilles d'aujourd'hui.", verified:true },
  'Tcheza Nation': { meta:'Rap · Brazzaville', bio:"Tcheza Nation s'impose sur la scène rap congolaise avec des textes engagés et une identité sonore urbaine affirmée.", verified:false },
};
let currentArtistPageRealId = null;
// Cache léger { artistId: {avatar_url, bio} } — évite de refaire l'appel réseau à chaque
// changement de morceau du même artiste dans le lecteur plein écran (voir syncFullPlayer).
let artistPublicInfoCache = {};
// ---------- Effet de parallaxe sur la photo du hero de la page artiste ----------
// Au scroll, la photo se translate légèrement vers le bas et s'estompe — même sensation
// que sur les pages artiste de Spotify. Un seul listener posé une fois (dataset flag),
// qui vérifie à chaque scroll si la page artiste est bien celle affichée à l'écran.
let artistHeroParallaxBound = false;
function initArtistHeroParallax(){
  if(artistHeroParallaxBound) return;
  artistHeroParallaxBound = true;
  window.addEventListener('scroll', ()=>{
    const view = document.getElementById('view-artist');
    if(!view || view.style.display === 'none') return;
    const hero = view.querySelector('.ap-hero-photo');
    const heroFg = document.getElementById('artist-page-avatar-fg');
    if(!hero) return;
    const y = Math.min(window.scrollY, 420);
    const t = `translateY(${y * 0.32}px) scale(${1 + y/2400})`;
    const o = String(Math.max(0.15, 1 - y/460));
    hero.style.transform = t;
    hero.style.opacity = o;
    if(heroFg){ heroFg.style.transform = t; heroFg.style.opacity = o; }
  }, { passive:true });
}
// ---------- Photo du hero de la page artiste — s'adapte à N'IMPORTE QUELLE taille/format
// envoyé par l'artiste, sans jamais couper un morceau important de l'image. ----------
// Avant : une seule couche en background-size:cover, qui recadre l'image pour remplir tout
// le cadre — sur une photo carrée ou portrait étirée dans un bandeau large, ça coupait
// n'importe où (bras, épaule…) selon la composition d'origine, sans aucun moyen de deviner
// où se trouve le sujet. Maintenant : deux couches. Une en arrière-plan, floutée et assombrie,
// en cover (remplit tout l'espace, sert juste d'ambiance colorée). Une au premier plan, en
// contain (jamais recadrée, jamais coupée), qui affiche l'image entière quel que soit son
// ratio — portrait, paysage ou carrée.
function setArtistHeroPhoto(url, initials){
  const bg = document.getElementById('artist-page-avatar');
  const fg = document.getElementById('artist-page-avatar-fg');
  if(!bg) return;
  if(url){
    bg.style.backgroundImage = `url(${url})`;
    bg.textContent = '';
    if(fg){ fg.style.backgroundImage = `url(${url})`; fg.style.display = ''; }
  } else {
    bg.style.backgroundImage = '';
    bg.textContent = initials || '';
    if(fg){ fg.style.backgroundImage = ''; fg.style.display = 'none'; }
  }
}
/* ---------- Page artiste — "Artistes qu'il suit" (vraie suggestion pour les auditeurs) ----------
   Basé sur les vrais artistes que CET artiste suit lui-même (même mécanisme de suivi que
   tout le monde) — jamais une recommandation générée, juste ses vrais goûts affichés. */
async function loadArtistFollowsSection(artistId, artistName){
  const section = document.getElementById('artist-follows-section');
  const row = document.getElementById('artist-follows-row');
  const title = document.getElementById('artist-follows-title');
  if(!section || !row) return;
  if(!artistId){ section.style.display = 'none'; return; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/artist/' + artistId + '/follows');
    const data = await res.json();
    const list = data.artists || [];
    if(!list.length){ section.style.display = 'none'; return; }
    if(title) title.textContent = `Les artistes que ${artistName} suit`;
    row.innerHTML = '';
    list.forEach(a=>{
      const name = a.artist_name || 'Artiste NUNI';
      const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const photoStyle = a.avatar_url ? `background-image:url(${a.avatar_url});` : '';
      const card = document.createElement('div');
      card.className = 'artist-suggest-card';
      card.innerHTML = `
        <div class="asc-photo" style="${photoStyle}">
          ${a.avatar_url ? '' : `<div class="asc-initials">${initials}</div>`}
        </div>
        <div class="asc-info">
          <div class="n">${name}${a.is_verified ? ' <svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24" style="width:13px;height:13px;"><path d="M20 6 9 17l-5-5"/></svg>' : ''}</div>
          <div class="g">${a.top_genre || 'Artiste NUNI'}</div>
        </div>`;
      card.onclick = ()=> openArtistPage(name, a.id);
      row.appendChild(card);
    });
    section.style.display = 'block';
  }catch(e){ section.style.display = 'none'; } // pas grave si le serveur est momentanément indisponible
}
function openArtistPage(name, artistId){
  window.scrollTo(0, 0);
  // Avant : cette page était identifiée uniquement par le NOM affiché (chaîne de texte) —
  // rien n'empêche deux vrais comptes artiste différents de choisir le même artist_name à
  // l'inscription, ce qui mélangeait leurs morceaux sur une seule page et pouvait faire
  // "suivre" le mauvais compte au hasard. Maintenant : dès qu'un vrai identifiant est
  // disponible, tout le filtrage se fait par identifiant unique, jamais par texte. Le nom
  // ne sert plus que pour les morceaux de démonstration (sans aucun vrai compte associé),
  // qui n'ont jamais d'identifiant et ne représentent aucun vrai risque de collision.
  artistId = artistId || null;
  const isOwnArtistPage = !!(currentUser && currentUser.account_type === 'artist' && currentUser.id === artistId);
  const profile = artistProfiles[name] || { meta:'Artiste NUNI', bio:"Découvrez l'univers de "+name+" sur NUNI.", verified:false };
  const reallyVerified = isOwnArtistPage ? !!currentUser.is_verified : profile.verified;
  document.getElementById('artist-page-name').textContent = name;
  document.getElementById('artist-page-meta').textContent = profile.meta;
  // Vraie bio si l'artiste en a renseigné une (sur sa propre page, on l'a déjà via currentUser ;
  // pour n'importe quelle autre page, elle arrive juste après via /public-stats). Sinon, on
  // retombe sur le texte de démo/générique en attendant.
  document.getElementById('artist-page-bio').textContent = (isOwnArtistPage && currentUser.bio) ? currentUser.bio : profile.bio;
  const bioEditBtn = document.getElementById('artist-page-bio-edit-btn');
  if(bioEditBtn) bioEditBtn.style.display = isOwnArtistPage ? 'inline-flex' : 'none';
  document.getElementById('artist-page-badge').style.display = reallyVerified ? 'inline-flex' : 'none';
  const artistPageAvatarEl = document.getElementById('artist-page-avatar');
  artistPageAvatarEl.classList.toggle('is-editable', isOwnArtistPage);
  const artistCoverEl = document.querySelector('.artist-cover');
  if(artistCoverEl){
    artistCoverEl.classList.toggle('is-editable', isOwnArtistPage);
    artistCoverEl.style.cursor = isOwnArtistPage ? 'pointer' : '';
    artistCoverEl.onclick = isOwnArtistPage ? ()=> document.getElementById('cover-upload-input').click() : null;
    if(isOwnArtistPage && currentUser.banner_url){
      artistCoverEl.style.backgroundImage = `url(${currentUser.banner_url})`;
    } else if(!isOwnArtistPage){
      artistCoverEl.style.backgroundImage = '';
    }
  }
  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  if(isOwnArtistPage && currentUser.avatar_url){
    setArtistHeroPhoto(currentUser.avatar_url);
  } else {
    setArtistHeroPhoto(null, initials);
  }
  document.getElementById('artist-page-calendar-title').textContent = 'Calendrier des sorties — ' + name;
  renderCertificationButton(isOwnArtistPage, reallyVerified);

  // Vrais morceaux de CET artiste précisément — par identifiant si on le connaît, par nom
  // seulement en dernier recours (morceaux de démo sans compte réel rattaché).
  const artistTracks = artistId ? tracks.filter(t=>t.artistId===artistId) : tracks.filter(t=>t.a===name);

  // Statistiques réelles de l'en-tête artiste (avant : "2,4M" / "186K" / "9 480" codés en dur).
  const statStreamsEl = document.getElementById('artist-stat-streams');
  const statSupportsEl = document.getElementById('artist-stat-supports');
  const realStreamsSum = artistTracks.reduce((sum,t)=> sum + (t.isReal ? Number(t.streams)||0 : 0), 0);
  if(statStreamsEl) statStreamsEl.textContent = realStreamsSum > 0 ? realStreamsSum.toLocaleString('fr-FR') : '0';
  // "Soutiens reçus" n'est relié à aucun vrai système de pourboires/soutiens pour l'instant —
  // on l'affiche honnêtement à "—" plutôt qu'un chiffre inventé.
  if(statSupportsEl) statSupportsEl.textContent = '—';

  currentArtistPageRealId = artistId;
  document.getElementById('artist-page-support-btn').setAttribute('onclick', `openSupportArtistModal(${currentArtistPageRealId || 'null'}, ${JSON.stringify(name)})`);
  loadArtistFollowsSection(currentArtistPageRealId, name);

  // Sons en vedette — sélectionnés par l'artiste lui-même parmi ses morceaux déjà publiés.
  // Section entièrement masquée s'il n'a encore rien choisi (pas de rangée vide inutile).
  const featuredSection = document.getElementById('artist-featured-section');
  const featuredRow = document.getElementById('shelf-artist-featured');
  if(featuredSection && featuredRow){
    if(currentArtistPageRealId){
      fetch(NUNI_API_BASE + '/api/artist/' + currentArtistPageRealId + '/featured-tracks')
        .then(r=>r.json()).then(data=>{
          const list = data.tracks || [];
          featuredRow.innerHTML = '';
          if(!list.length){ featuredSection.style.display = 'none'; return; }
          list.map(r=>({
            t: r.title, a: r.artist_name || name, p:'pal-1', album: r.album || r.title,
            genre: r.genre || 'Afro', streams: String(r.streams||0), likes: r.likes||0,
            cover: r.cover_url || null, audioUrl: r.audio_url || null, isReal:true,
            releaseType: r.release_type || 'Single', realId: r.id, artistId: currentArtistPageRealId,
          })).forEach(tr=>{ try{ featuredRow.appendChild(trackCard(tr)); }catch(e){ console.error('[artist featured] carte ignorée:', e); } });
          featuredSection.style.display = '';
        }).catch(()=>{ featuredSection.style.display = 'none'; });
    } else {
      featuredSection.style.display = 'none';
    }
  }

  // Vrai nombre de followers — visible pour n'importe quel visiteur, pas seulement sur sa
  // propre page. Se met aussi à jour tout de suite après un clic sur "Suivre" (voir toggleFollow).
  const statFollowersEl = document.getElementById('artist-stat-followers');
  const statMonthlyListenersEl = document.getElementById('artist-stat-monthly-listeners');
  if(statFollowersEl){
    if(currentArtistPageRealId){
      fetch(NUNI_API_BASE + '/api/artist/' + currentArtistPageRealId + '/public-stats')
        .then(r=>r.json()).then(data=>{
          if(typeof data.follower_count === 'number') statFollowersEl.textContent = data.follower_count.toLocaleString('fr-FR');
          // Auditeurs par mois — vrai nombre de personnes distinctes ayant réellement écouté
          // depuis le début du mois calendaire en cours. Recalculé côté serveur à chaque
          // visite : monte ou descend tout seul chaque mois selon la vraie activité, sans
          // jamais avoir besoin d'une remise à zéro manuelle.
          if(statMonthlyListenersEl && typeof data.monthly_listeners === 'number') statMonthlyListenersEl.textContent = data.monthly_listeners.toLocaleString('fr-FR');
          if(data.avatar_url && !(isOwnArtistPage && currentUser.avatar_url)){
            setArtistHeroPhoto(data.avatar_url);
          }
          if(data.banner_url && !(isOwnArtistPage && currentUser.banner_url) && artistCoverEl){
            artistCoverEl.style.backgroundImage = `url(${data.banner_url})`;
          }
          // Vraie bio, si l'artiste en a renseigné une — écrase le texte générique affiché
          // en attendant (jamais l'inverse : on ne remplace pas une vraie bio par du vide).
          if(data.bio && !(isOwnArtistPage && currentUser.bio)){
            document.getElementById('artist-page-bio').textContent = data.bio;
          }
          artistPublicInfoCache[currentArtistPageRealId] = { avatar_url: data.avatar_url || null, bio: data.bio || null, about_gallery_urls: data.about_gallery_urls || [] };
        }).catch(()=>{});
    } else {
      statFollowersEl.textContent = '—';
      if(statMonthlyListenersEl) statMonthlyListenersEl.textContent = '—';
    }
  }

  // Vrai statut de suivi — avant, le bouton affichait toujours "Suivre" par défaut, même si
  // le compte connecté suivait déjà cet artiste, faute de vérification à l'ouverture.
  const followBtn = document.getElementById('follow-btn');
  if(followBtn){
    if(isOwnArtistPage){
      followBtn.style.display = 'none';
    } else {
      followBtn.style.display = '';
      followBtn.textContent = 'Suivre';
      followBtn.classList.remove('is-following');
      if(currentArtistPageRealId && realAuthToken){
        fetch(NUNI_API_BASE + '/api/follow/' + currentArtistPageRealId + '/status', {
          headers:{ 'Authorization':'Bearer ' + realAuthToken }
        }).then(r=>r.json()).then(data=>{
 followBtn.textContent = data.following ? 'Suivi ' : 'Suivre';
          followBtn.classList.toggle('is-following', !!data.following);
        }).catch(()=>{});
      }
    }
  }
  ['shelf-artist','shelf-artist-trending','shelf-artist-albums'].forEach(id=>{
    const row = document.getElementById(id);
    if(row) row.innerHTML = '';
  });
  // ---- Boutons "Tout écouter" / "Aléatoire" du hero — jouent les vrais morceaux de cet
  // artiste (le premier de la discographie, ou un tirage aléatoire parmi eux). ----
  const apPlayBtn = document.getElementById('artist-page-play-btn');
  const apShuffleBtn = document.getElementById('artist-page-shuffle-btn');
  if(apPlayBtn){
    apPlayBtn.style.display = artistTracks.length ? '' : 'none';
    apPlayBtn.onclick = ()=>{
      if(!artistTracks.length) return;
      const isArtistPlaying = playing && currentTrack && artistTracks.some(t=>t.t===currentTrack.t);
      if(isArtistPlaying){ togglePlay(); } else { playTrack(artistTracks[0]); }
    };
  }
  if(apShuffleBtn){
    apShuffleBtn.style.display = artistTracks.length > 1 ? '' : 'none';
    apShuffleBtn.onclick = ()=>{
      if(!artistTracks.length) return;
      playTrack(artistTracks[Math.floor(Math.random()*artistTracks.length)]);
      toast('Lecture aléatoire de ' + name);
    };
  }
  initArtistHeroParallax();
  const heroPhotoEl = document.querySelector('#view-artist .ap-hero-photo');
  const heroPhotoFgEl = document.getElementById('artist-page-avatar-fg');
  if(heroPhotoEl){ heroPhotoEl.style.transform = ''; heroPhotoEl.style.opacity = ''; }
  if(heroPhotoFgEl){ heroPhotoFgEl.style.transform = ''; heroPhotoFgEl.style.opacity = ''; }
  if(artistTracks.length){
    fillShelf('shelf-artist', artistTracks);
    fillShelf('shelf-artist-trending', [...artistTracks].sort((a,b)=>(b.likes||0)-(a.likes||0)));
    fillShelf('shelf-artist-albums', artistTracks);
    renderArtistLatestRelease(artistTracks);
    renderArtistTopTracksList(artistTracks);
  } else {
    // Avant : un artiste sans aucun morceau publié affichait ici 4 morceaux d'AUTRES artistes
    // (repli sur tracks.slice(0,4), le début du catalogue global) — trompeur, comme si ces
    // morceaux lui appartenaient. Un vrai état vide honnête vaut mieux qu'une fausse discographie.
    const emptyMsg = `<p style="font-size:12.5px; color:var(--text-faint); padding:8px 0;">${isOwnArtistPage ? "Vous n'avez encore rien publié — utilisez « Importer ma musique » dans le Dashboard." : "Cet artiste n'a encore rien publié sur NUNI."}</p>`;
    ['shelf-artist','shelf-artist-trending','shelf-artist-albums'].forEach(id=>{
      const row = document.getElementById(id);
      if(row) row.innerHTML = emptyMsg;
    });
    document.getElementById('artist-latest-release-section').style.display = 'none';
    document.getElementById('artist-top-tracks-section').style.display = 'none';
  }
  // Avant : un bouton supprimer séparé (cercle gris) était ajouté à côté du menu ⋮ sur
  // chaque pochette de sa propre discographie — doublon avec la vraie option "Supprimer ce
  // morceau" à l'intérieur même du menu ⋮ (réservée au propriétaire). Un seul point d'accès,
  // uniquement les 3 points en haut à droite de la pochette.

  const releaseRow = document.getElementById('artist-release-row');
  if(releaseRow){
    releaseRow.innerHTML = '';
    const scheduledUrl = (isOwnArtistPage && realAuthToken)
      ? NUNI_API_BASE + '/api/artist/scheduled-releases'
      : (currentArtistPageRealId ? NUNI_API_BASE + '/api/artist/' + currentArtistPageRealId + '/scheduled-releases' : null);
    if(scheduledUrl){
      fetch(scheduledUrl, isOwnArtistPage && realAuthToken ? { headers:{ 'Authorization':'Bearer ' + realAuthToken } } : {})
        .then(r=>r.json()).then(data=>{
          const list = data.releases || [];
          if(!list.length){
            releaseRow.innerHTML = `<p style="font-size:12.5px; color:var(--text-faint);">Aucune sortie programmée pour le moment.</p>`;
            return;
          }
          const mapped = list.map(r=>{
            const d = new Date(r.scheduled_release_at);
            const days = Math.max(0, Math.ceil((d - new Date()) / 86400000));
            return {
              d: String(d.getDate()).padStart(2,'0'),
              m: d.toLocaleDateString('fr-FR', {month:'short'}).replace('.',''),
              t: r.title, a: r.release_type || 'Single',
              c: days === 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : `Dans ${days} jours`,
            };
          });
          fillReleaseRow('artist-release-row', mapped);
        }).catch(()=>{
          releaseRow.innerHTML = `<p style="font-size:12.5px; color:var(--text-faint);">Calendrier momentanément indisponible.</p>`;
        });
    }
  }

  // ---- Concerts à venir — visible sur la page de n'importe quel artiste, alimenté
  // automatiquement dès qu'il publie un concert (voir POST /api/dashboard/concerts). ----
  const concertsSection = document.getElementById('artist-concerts-section');
  const concertsGrid = document.getElementById('artist-page-concerts');
  if(concertsSection && concertsGrid){
    concertsSection.style.display = 'none';
    concertsGrid.innerHTML = '';
    if(currentArtistPageRealId){
      fetch(NUNI_API_BASE + '/api/artists/' + currentArtistPageRealId + '/concerts')
        .then(r=>r.json()).then(data=>{
          const list = data.concerts || [];
          if(!list.length) return;
          // concertCardHtml attend artist_name/artist_avatar_url/is_verified — pas renvoyés
          // par cette route (déjà connus ici, pas besoin de les redemander au serveur).
          const enriched = list.map(c => ({ ...c, artist_name: name, artist_avatar_url: (isOwnArtistPage ? currentUser.avatar_url : null), is_verified: reallyVerified }));
          concertsSection.style.display = 'block';
          concertsGrid.innerHTML = enriched.map(concertCardHtml).join('');
        }).catch(()=>{});
    }
  }

  // ---- Événements NUNI auxquels cet artiste participe — filtrés par correspondance de
  // nom (voir featured_artist_names, renseigné par l'admin lors de la création). ----
  const nuniEventsSection = document.getElementById('artist-nuni-events-section');
  const nuniEventsGrid = document.getElementById('artist-page-nuni-events');
  if(nuniEventsSection && nuniEventsGrid){
    nuniEventsSection.style.display = 'none';
    nuniEventsGrid.innerHTML = '';
    fetch(NUNI_API_BASE + '/api/nuni-events')
      .then(r=>r.json()).then(data=>{
        const nameLower = name.trim().toLowerCase();
        const matching = (data.events || []).filter(ev=>
          (ev.featured_artist_names || '').split(',').map(n=>n.trim().toLowerCase()).includes(nameLower)
        );
        if(!matching.length) return;
        nuniEventsSection.style.display = 'block';
        nuniEventsGrid.innerHTML = matching.map(nuniEventCardHtml).join('');
      }).catch(()=>{});
  }

  renderArtistClips(name);

  isOpeningArtistPage = true;
  enterApp('artist');
  isOpeningArtistPage = false;
}
const NUNI_CERT_MIN_TRACKS = 50;
const NUNI_CERT_MIN_FOLLOWERS = 5000;
function renderCertificationButton(isOwnArtistPage, reallyVerified){
  const old = document.getElementById('nuni-cert-wrap');
  if(old) old.remove();
  const badge = document.getElementById('artist-page-badge');
  if(!isOwnArtistPage || reallyVerified || !badge) return;
  const status = currentUser.verification_status || 'none';
  const trackCount = currentUser.track_count || 0;
  const followerCount = currentUser.follower_count || 0;
  const eligible = trackCount >= NUNI_CERT_MIN_TRACKS && followerCount >= NUNI_CERT_MIN_FOLLOWERS;

  const wrap = document.createElement('span');
  wrap.id = 'nuni-cert-wrap';
  wrap.style.cssText = 'display:inline-flex; flex-direction:column; gap:4px; margin-left:10px; vertical-align:middle;';

  const btn = document.createElement('button');
  btn.style.cssText = 'padding:5px 14px; border-radius:16px; font-size:12px; font-weight:700; cursor:pointer; border:1px solid rgba(212,175,106,0.4);';

  if(status === 'pending'){
    btn.textContent = '⏳ Certification en attente';
    btn.disabled = true;
    btn.style.background = 'rgba(255,255,255,0.08)';
    btn.style.color = '#999';
    btn.style.cursor = 'default';
  } else if(!eligible){
 btn.textContent = ' Conditions non remplies';
    btn.disabled = true;
    btn.style.background = 'rgba(255,255,255,0.06)';
    btn.style.color = '#888';
    btn.style.cursor = 'not-allowed';
  } else {
 btn.textContent = status === 'rejected' ? ' Redemander la certification' : ' Demander la certification';
    btn.style.background = 'linear-gradient(135deg,#D4AF6A,#8E63C9)';
    btn.style.color = '#141220';
    btn.onclick = requestVerification;
  }
  wrap.appendChild(btn);

  if(status !== 'pending'){
    const conditions = document.createElement('div');
    conditions.style.cssText = 'font-size:11px; color:#888; line-height:1.5;';
    conditions.innerHTML = `
      <svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><rect x="5.5" y="4.5" width="13" height="17" rx="2"/><path d="M9 4.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5M8.5 11h7M8.5 15h7"/></svg> Conditions : ${trackCount}/${NUNI_CERT_MIN_TRACKS} sons publiés · ${followerCount}/${NUNI_CERT_MIN_FOLLOWERS} abonnés<br>
      <svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M3 12h18M12 8v13"/><path d="M12 8c-1.8 0-4-1-4-3a2.5 2.5 0 0 1 4-2c1.5 0 2.3 1.5 2.3 3M12 8c1.8 0 4-1 4-3a2.5 2.5 0 0 0-4-2c-1.5 0-2.3 1.5-2.3 3"/></svg> Avantages : badge vérifié, codes promo exclusifs, mise en avant, stats avancées`;
    wrap.appendChild(conditions);
  }

  badge.insertAdjacentElement('afterend', wrap);
}
/* ============ SOUTIEN DIRECT (Mobile Money) ============
   Don volontaire d'un fan vers l'artiste, en dehors de NUNI : NUNI n'y touche jamais,
   ne prend aucune commission, se contente d'afficher le numéro que l'artiste a bien
   voulu renseigner (facultatif). Simple transfert Mobile Money classique entre les deux. */
async function openSupportArtistModal(artistId, artistName){
  const title = document.getElementById('support-artist-title');
  const body = document.getElementById('support-artist-body');
  title.textContent = 'Soutenir ' + (artistName || 'cet artiste');
  body.innerHTML = '<p style="color:var(--text-dim); font-size:13px;">Chargement…</p>';
  document.getElementById('support-artist-overlay').classList.add('show');

  if(!artistId){
    body.innerHTML = `<p style="color:var(--text-faint); font-size:13px;">Cet artiste n'est pas encore relié à un vrai compte NUNI — le soutien direct n'est pas disponible pour ce profil de démonstration.</p>`;
    return;
  }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/artist/' + artistId + '/support-info');
    const data = await res.json();
    if(!res.ok){ body.innerHTML = `<p style="color:var(--rose-braise); font-size:13px;">${data.error||'Erreur.'}</p>`; return; }
    if(!data.momo_number){
      body.innerHTML = `<p style="color:var(--text-faint); font-size:13px; line-height:1.6;">${esc(data.artist_name)} n'a pas encore activé le soutien direct Mobile Money sur son profil.</p>`;
      return;
    }
    body.innerHTML = `
      <div class="pi-sub-card" style="text-align:center; margin-bottom:14px;">
        <div style="font-size:11px; color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Numéro Mobile Money</div>
        <div style="font-size:22px; font-weight:700; letter-spacing:1px; color:var(--accent);">${esc(data.momo_number)}</div>
      </div>
      <p style="font-size:12.5px; color:var(--text-dim); line-height:1.65;">
        Envoyez le montant de votre choix directement à ce numéro depuis votre application MTN Mobile Money ou Airtel Money, comme un envoi d'argent classique.
        <br><b>NUNI ne traite pas ce paiement et n'y prélève aucune commission</b> — c'est un don direct, volontaire, entre vous et ${esc(data.artist_name)}.
      </p>`;
  }catch(e){
    body.innerHTML = `<p style="color:var(--rose-braise); font-size:13px;">Impossible de contacter le serveur NUNI.</p>`;
  }
}
function closeSupportArtistModal(){
  document.getElementById('support-artist-overlay').classList.remove('show');
}

async function saveMomoNumber(){
  const input = document.getElementById('momo-number-input');
  const msg = document.getElementById('momo-save-msg');
  if(!realAuthToken){ msg.innerHTML = '<span style="color:var(--rose-braise)">Connectez-vous avec un vrai compte Artiste.</span>'; return; }
  msg.textContent = 'Enregistrement…';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/artist/momo', {
      method:'PUT', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({ momoNumber: input.value.trim() })
    });
    const data = await res.json();
    if(!res.ok){ msg.innerHTML = '<span style="color:var(--rose-braise)"><svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg> ' + data.error + '</span>'; return; }
    msg.innerHTML = '<span style="color:#7FC79A"><svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> ' + data.message + '</span>';
    toast(data.message);
  }catch(e){ msg.innerHTML = '<span style="color:var(--rose-braise)"><svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg> Impossible de contacter le serveur NUNI.</span>'; }
}

// Avant : la bio venait d'un dictionnaire codé en dur, jamais modifiable par le vrai artiste.
// Ici : un vrai champ, enregistré en base, immédiatement reflété sur currentUser pour que la
// page artiste et le lecteur plein écran l'affichent sans recharger la page.
async function saveArtistBio(){
  const input = document.getElementById('artist-bio-input');
  const msg = document.getElementById('artist-bio-save-msg');
  if(!realAuthToken){ msg.innerHTML = '<span style="color:var(--rose-braise)">Connectez-vous avec un vrai compte Artiste.</span>'; return; }
  msg.textContent = 'Enregistrement…';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/artist/bio', {
      method:'PUT', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({ bio: input.value.trim() })
    });
    const data = await res.json();
    if(!res.ok){ msg.innerHTML = '<span style="color:var(--rose-braise)"><svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg> ' + data.error + '</span>'; return; }
    msg.innerHTML = '<span style="color:#7FC79A"><svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> ' + data.message + '</span>';
    toast(data.message);
    if(currentUser){ currentUser.bio = data.bio; }
    artistPublicInfoCache = {}; // vide le cache : la nouvelle bio doit apparaître immédiatement partout
  }catch(e){ msg.innerHTML = '<span style="color:var(--rose-braise)"><svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg> Impossible de contacter le serveur NUNI.</span>'; }
}

/* ============ HISTORIQUE RÉEL DES PAIEMENTS (dashboard) ============
   Avant : deux lignes "Mai 2026" / "Juin 2026" codées en dur. Maintenant : calculé en direct
   à partir des vraies écoutes enregistrées pour les morceaux de cet artiste. */
async function loadPaymentsHistory(){
  const tbody = document.getElementById('pay-history-tbody');
  if(!tbody) return;
  if(!realAuthToken){ tbody.innerHTML = '<tr><td colspan="3" style="color:var(--text-faint); font-size:12.5px;">Connectez-vous avec un vrai compte Artiste.</td></tr>'; return; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/artist/payments-history', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    if(!res.ok) return;
    const data = await res.json();
    if(!data.history || !data.history.length){
      tbody.innerHTML = '<tr><td colspan="3" style="color:var(--text-faint); font-size:12.5px;">Aucune écoute enregistrée pour le moment.</td></tr>';
      return;
    }
    const monthNames = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
    tbody.innerHTML = data.history.map(row=>{
      const [y, m] = row.month.split('-');
      const label = monthNames[Number(m)-1] + ' ' + y;
      return `<tr><td>${label}</td><td class="data">${row.streams.toLocaleString('fr-FR')}</td><td class="data">${row.artist_share_fcfa.toLocaleString('fr-FR')} FCFA</td></tr>`;
    }).join('');
  }catch(e){ /* pas grave si le serveur est momentanément indisponible */ }
}

/* ============ VRAIS VERSEMENTS REÇUS (dashboard) ============
   Différent de loadPaymentsHistory() ci-dessus (qui est une ESTIMATION mensuelle calculée
   en direct sur les écoutes) : ici, ce sont les VRAIS paiements effectivement enregistrés
   par l'admin (table payment_history), avec le vrai montant restant à percevoir. Les
   streams publics du profil ne sont jamais modifiés par ce système. */
// Avant : bouton présent mais sans aucune action — n'exportait littéralement rien. Ici :
// vrai export CSV (ouvrable dans Excel/Sheets), avec les vraies données déjà en base —
// streams mensuels réels + tout l'historique réel de paiements, rien d'inventé.
async function exportArtistReport(){
  if(!realAuthToken){ toast('Connectez-vous avec un vrai compte Artiste.'); return; }
  toast('Préparation du rapport…');
  try{
    const [monthlyRes, historyRes, statusRes] = await Promise.all([
      fetch(NUNI_API_BASE + '/api/artist/payments-history', { headers:{ 'Authorization':'Bearer ' + realAuthToken } }),
      fetch(NUNI_API_BASE + '/api/artist/payment-history', { headers:{ 'Authorization':'Bearer ' + realAuthToken } }),
      fetch(NUNI_API_BASE + '/api/artist/payment-status', { headers:{ 'Authorization':'Bearer ' + realAuthToken } }),
    ]);
    const monthly = monthlyRes.ok ? (await monthlyRes.json()).history || [] : [];
    const history = historyRes.ok ? (await historyRes.json()).history || [] : [];
    const status = statusRes.ok ? await statusRes.json() : null;

    const esc = (v)=> `"${String(v??'').replace(/"/g,'""')}"`;
    const lines = [];
    lines.push(`Rapport NUNI — ${currentUser ? (currentUser.artist_name || currentUser.first_name) : ''} — généré le ${new Date().toLocaleDateString('fr-FR')}`);
    lines.push('');
    if(status){
      lines.push('RÉSUMÉ ACTUEL');
      lines.push(['Montant en attente (FCFA)', 'Streams période en cours', 'Streams totaux', 'Dernier versement'].map(esc).join(','));
      lines.push([status.amount_due_fcfa, status.current_period_streams, status.total_streams, status.last_payment_at ? new Date(status.last_payment_at).toLocaleDateString('fr-FR') : ''].map(esc).join(','));
      lines.push('');
    }
    lines.push('ÉCOUTES PAR MOIS');
    lines.push(['Mois', 'Streams', 'Revenu net (75%) FCFA'].map(esc).join(','));
    monthly.forEach(row=>{
      lines.push([row.month, row.streams, row.artist_share_fcfa].map(esc).join(','));
    });
    lines.push('');
    lines.push('HISTORIQUE DES VERSEMENTS REÇUS');
    lines.push(['Date', 'Montant (FCFA)', 'Streams couverts', 'Méthode'].map(esc).join(','));
    history.forEach(p=>{
      lines.push([new Date(p.created_at).toLocaleDateString('fr-FR'), p.amount_fcfa, p.streams_covered, p.method || ''].map(esc).join(','));
    });

    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nuni-rapport-${(currentUser && currentUser.artist_name || 'artiste').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Rapport téléchargé.');
  }catch(e){ toast('Impossible de générer le rapport — réessayez plus tard.'); }
}

async function loadRealPaymentStatus(){
  const pendingAmountEl = document.getElementById('payout-pending-amount');
  const pendingStreamsEl = document.getElementById('payout-pending-streams');
  const lastDateEl = document.getElementById('payout-last-date');
  const tbody = document.getElementById('real-payment-history-tbody');
  if(!pendingAmountEl || !realAuthToken) return;
  try{
    const [statusRes, historyRes] = await Promise.all([
      fetch(NUNI_API_BASE + '/api/artist/payment-status', { headers:{ 'Authorization':'Bearer ' + realAuthToken } }),
      fetch(NUNI_API_BASE + '/api/artist/payment-history', { headers:{ 'Authorization':'Bearer ' + realAuthToken } }),
    ]);
    if(statusRes.ok){
      const s = await statusRes.json();
      pendingAmountEl.textContent = s.amount_due_fcfa.toLocaleString('fr-FR') + ' FCFA';
      pendingStreamsEl.textContent = s.current_period_streams.toLocaleString('fr-FR');
      lastDateEl.textContent = s.last_payment_at ? new Date(s.last_payment_at).toLocaleDateString('fr-FR') : 'Aucun pour le moment';
    }
    if(historyRes.ok && tbody){
      const h = await historyRes.json();
      const history = h.history || [];
      tbody.innerHTML = history.length
        ? history.map(p=> `<tr><td>${new Date(p.created_at).toLocaleDateString('fr-FR')}</td><td class="data">${p.amount_fcfa.toLocaleString('fr-FR')} FCFA</td><td class="data">${p.streams_covered.toLocaleString('fr-FR')}</td><td>${p.method || '—'}</td></tr>`).join('')
        : '<tr><td colspan="4" style="color:var(--text-faint); font-size:12.5px;">Aucun versement reçu pour le moment.</td></tr>';
    }
  }catch(e){ /* pas grave si le serveur est momentanément indisponible */ }
}

async function requestVerification(){
  if(!realAuthToken){ toast('Connectez-vous avec un vrai compte pour demander la certification.'); return; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/verification/request', {
      method:'POST', headers:{'Authorization':'Bearer ' + realAuthToken}
    });
    const data = await res.json();
 if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
    currentUser.verification_status = 'pending';
 toast(' ' + data.message);
    openArtistPage(currentUser.artist_name, currentUser.id);
 }catch(e){ toast(' Impossible de contacter le serveur NUNI.'); }
}

/* ============================================================
   CARTES DE CATÉGORIES — identité premium par genre
   ------------------------------------------------------------
   Chaque catégorie a : sa propre palette, son pictogramme SVG
   dédié (cohérent avec le style d'icônes déjà utilisé ailleurs
   dans NUNI plutôt que copier un style d'illustration différent),
   et une animation d'ambiance très discrète et continue.
   Les micro-interactions (onde au clic, rebond, vibration) réutilisent
   les utilitaires génériques déjà construits pour le lecteur (spawnRipple,
   bounceEl, hapticPing) — une seule logique, plusieurs endroits.
============================================================ */
/* ============ SPHÈRE AUDIO "TOUT" — visualiseur vivant (Canvas 2D + Web Audio API) ============
   Remplace l'icône + texte de la tuile "Tout" par une sphère de particules qui respire et
   tourne en permanence, et qui réagit en temps réel aux vraies fréquences de la musique en
   cours de lecture (graves/médiums/aigus) dès qu'un vrai son est lancé.
   Choix Canvas 2D plutôt que Three.js/WebGL : rendu visuel équivalent pour une tuile de
   150×96px, sans ajouter ~600 Ko de bibliothèque externe chargée par tout le monde pour un
   seul élément décoratif parmi 9 filtres de genre.

   IMPORTANT — élément audio "fantôme" séparé, jamais realAudio directement :
   Une première version branchait directement realAudio (le vrai lecteur) sur un AnalyserNode
   Web Audio API. Ça fonctionnait, MAIS sur iPhone, dès qu'un <audio> passe par un AudioContext,
   iOS Safari a tendance à couper le son en arrière-plan (app minimisée, téléphone verrouillé)
   même avec MediaSession bien configuré — un vrai régression constatée en test. Ici, un second
   élément <audio> MUET (nuniAnalysisAudio) charge le même fichier uniquement pour l'analyse ;
   realAudio, lui, ne touche plus du tout à Web Audio API et garde son comportement natif fiable
   en arrière-plan. Si l'analyse s'arrête ou échoue pour une raison quelconque, seule la sphère
   en est affectée (retour à la simple respiration) — jamais le son. */
const nuniAnalysisAudio = new Audio();
nuniAnalysisAudio.crossOrigin = 'anonymous';
nuniAnalysisAudio.muted = true;
nuniAnalysisAudio.preload = 'auto';
// Inséré dans le DOM (invisible) — voir le commentaire détaillé au-dessus de realAudio,
// même correctif appliqué ici par cohérence même si cet élément est muet.
nuniAnalysisAudio.style.display = 'none';
document.body.appendChild(nuniAnalysisAudio);
// Avant : au lancement d'un morceau, l'élément fantôme charge son propre fichier séparément
// du vrai lecteur — il met souvent un instant de plus à devenir réellement audible/analysable,
// d'où un décalage visible entre le vrai son et la réaction de la sphère au démarrage. Ici :
// dès que CET élément fantôme devient vraiment prêt à jouer, on le recale immédiatement sur
// la position exacte du vrai lecteur à cet instant précis — au lieu d'attendre la correction
// périodique (qui ne se déclenche que si l'écart dépasse déjà 0.35s, donc après coup).
nuniAnalysisAudio.addEventListener('playing', ()=>{
  if(usingRealAudio) nuniSyncAnalysisAudio(realAudio.src, realAudio.currentTime);
});

let nuniAudioCtx = null, nuniAnalyser = null, nuniFreqData = null, nuniAnalyserFailed = false;
function ensureAudioAnalyser(){
  if(nuniAnalyser || nuniAnalyserFailed) return nuniAnalyser;
  try{
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if(!AudioContextClass) throw new Error('Web Audio API non supportée par ce navigateur.');
    nuniAudioCtx = new AudioContextClass();
    const sourceNode = nuniAudioCtx.createMediaElementSource(nuniAnalysisAudio);
    nuniAnalyser = nuniAudioCtx.createAnalyser();
    nuniAnalyser.fftSize = 128; // 64 valeurs de fréquence — largement assez pour moduler une sphère, sans coût CPU inutile
    nuniAnalyser.smoothingTimeConstant = 0.8; // lisse les à-coups brusques, sinon la sphère tremble au lieu de "battre"
    // Gain à 0 avant la sortie : nuniAnalysisAudio est déjà muted, ce gain est une seconde
    // sécurité pour garantir un silence total même si le mute était un jour retiré par erreur.
    const silentGain = nuniAudioCtx.createGain();
    silentGain.gain.value = 0;
    sourceNode.connect(nuniAnalyser);
    nuniAnalyser.connect(silentGain);
    silentGain.connect(nuniAudioCtx.destination);
    nuniFreqData = new Uint8Array(nuniAnalyser.frequencyBinCount);
  }catch(e){
    console.error('[sphère audio] branchement impossible — la sphère restera en simple respiration, la lecture normale n\'est pas affectée :', e.message);
    nuniAnalyser = null;
    nuniAnalyserFailed = true; // on ne retente pas en boucle à chaque clic play
  }
  return nuniAnalyser;
}
// Appelé depuis togglePlay() (contexte de clic utilisateur, requis par les navigateurs pour
// activer l'audio) — réveille l'AudioContext s'il a été mis en pause automatiquement.
function nuniResumeAudioContextIfNeeded(){
  if(nuniAudioCtx && nuniAudioCtx.state === 'suspended'){ nuniAudioCtx.resume().catch(()=>{}); }
}
// Garde nuniAnalysisAudio calé sur le même morceau que le vrai lecteur, sans jamais bloquer
// ni ralentir celui-ci (tout est best-effort, entouré de catch silencieux).
function nuniSyncAnalysisAudio(src, currentTime){
  try{
    if(nuniAnalysisAudio.src !== src){ nuniAnalysisAudio.src = src; }
    // Seuil resserré (0,35s → 0,08s) : ce flux est muet, donc une resynchronisation fréquente
    // ne s'entend jamais — seule la sphère en profite, en collant vraiment au son réel plutôt
    // que de pouvoir traîner jusqu'à un tiers de seconde derrière.
    if(Math.abs(nuniAnalysisAudio.currentTime - currentTime) > 0.08){ nuniAnalysisAudio.currentTime = currentTime; }
  }catch(e){ /* jamais bloquant */ }
}
function nuniAnalysisAudioPlayPause(shouldPlay){
  try{ if(shouldPlay) nuniAnalysisAudio.play().catch(()=>{}); else nuniAnalysisAudio.pause(); }catch(e){ /* jamais bloquant */ }
}

let nuniSphereRAF = null, nuniSphereObserver = null, nuniSphereTouchT = 0;
function buildNuniAudioSphere(){
  const canvas = document.getElementById('nuni-sphere-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  // Répartition des points sur une sphère façon "spirale de Fibonacci" — bien plus régulière
  // visuellement qu'un tirage aléatoire pur.
  const COUNT = 420;
  const points = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for(let i = 0; i < COUNT; i++){
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y*y));
    const theta = golden * i;
    points.push({
      x: Math.cos(theta) * r, y, z: Math.sin(theta) * r,
      jitterPhase: Math.random() * Math.PI * 2,
      jitterSpeed: 0.6 + Math.random() * 0.8,
    });
  }

  let w = 0, h = 0;
  function resize(){
    const rect = canvas.getBoundingClientRect();
    w = rect.width; h = rect.height;
    canvas.width = w * DPR; canvas.height = h * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  let rotY = 0, t = 0;
  function frame(){
    nuniSphereRAF = requestAnimationFrame(frame);
    t += 0.016;
    rotY += 0.0035; // rotation lente permanente

    // Analyse audio réelle si un son est en cours de lecture — sinon, respiration seule.
    // Resynchronisation à chaque image (jusqu'à 60x/seconde, via ce même frame()) plutôt que
    // de dépendre uniquement du timeupdate du vrai lecteur (~4x/seconde) : la sphère reste
    // collée au son réel image par image, sans décalage perceptible.
    let bass = 0, mid = 0, treble = 0, audioActive = false;
    if(playing && usingRealAudio && nuniAnalyser){
      nuniSyncAnalysisAudio(realAudio.src, realAudio.currentTime);
      nuniAnalyser.getByteFrequencyData(nuniFreqData);
      const n = nuniFreqData.length;
      const bassEnd = Math.floor(n * 0.15), midEnd = Math.floor(n * 0.55);
      let bSum=0,mSum=0,tSum=0;
      for(let i=0;i<bassEnd;i++) bSum += nuniFreqData[i];
      for(let i=bassEnd;i<midEnd;i++) mSum += nuniFreqData[i];
      for(let i=midEnd;i<n;i++) tSum += nuniFreqData[i];
      bass = (bSum/bassEnd)/255; mid = (mSum/(midEnd-bassEnd))/255; treble = (tSum/(n-midEnd))/255;
      audioActive = true;
    }

    // Respiration lente permanente (toujours active, même sans musique) + gonflement réel sur les graves.
    const breathe = 1 + Math.sin(t*0.9)*0.045 + (audioActive ? bass*0.28 : 0);
    // Pulsation résiduelle du toucher (l'onde lumineuse au clic, s'estompe en ~700ms).
    if(nuniSphereTouchT > 0) nuniSphereTouchT = Math.max(0, nuniSphereTouchT - 0.045);
    const touchBoost = Math.sin(nuniSphereTouchT * Math.PI) * 0.22;

    ctx.clearRect(0, 0, w, h);
    const cx = w/2, cy = h/2;
    const baseR = Math.min(w, h) * 0.34;
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

    // Tri par profondeur (peint d'abord ce qui est le plus loin) pour un effet 3D correct.
    const projected = points.map(p=>{
      // Vagues sur les médiums : léger décalage sinusoïdal selon la latitude du point.
      const waveOffset = audioActive ? Math.sin(t*3 + p.y*6)*mid*0.14 : 0;
      // Vibrations rapides sur les aigus + micro-déformation organique permanente.
      const jitter = Math.sin(t*p.jitterSpeed*6 + p.jitterPhase) * (0.02 + (audioActive ? treble*0.09 : 0));
      const rMod = breathe + waveOffset + jitter + touchBoost;
      const x = p.x * rMod, y = p.y * rMod, z = p.z * rMod;
      const xr = x*cosY + z*sinY, zr = -x*sinY + z*cosY;
      const scale = 1 / (1.8 - zr*0.6); // perspective simple
      return { sx: cx + xr*baseR*scale, sy: cy + y*baseR*scale, z: zr, scale };
    }).sort((a,b)=> a.z - b.z);

    projected.forEach(p=>{
      const depth = (p.z + 1) / 2; // 0 = arrière, 1 = avant
      const size = (1.3 + depth*1.8) * p.scale;
      const hue = 255 + depth*45; // violet -> bleu électrique -> magenta selon la profondeur
      const alpha = 0.35 + depth*0.55;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${hue}, 85%, ${62 + depth*15}%, ${alpha})`;
      ctx.arc(p.sx, p.sy, Math.max(0.6, size), 0, Math.PI*2);
      ctx.fill();
    });

    // Léger halo lumineux au centre, plus intense pendant la lecture.
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR*1.5);
    glow.addColorStop(0, `rgba(142, 99, 201, ${audioActive ? 0.16 + bass*0.18 : 0.1})`);
    glow.addColorStop(1, 'rgba(142, 99, 201, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  // Ne tourne que quand la tuile est réellement visible à l'écran — évite de consommer du
  // GPU/de la batterie en continu sur une page fermée ou un onglet en arrière-plan.
  // Recalcule aussi systématiquement la taille à ce moment-là : au tout premier appel de
  // buildNuniAudioSphere(), la page Catalogue est encore cachée (display:none, avant
  // connexion) — getBoundingClientRect() renvoyait alors 0×0 et le canvas restait bloqué à
  // cette taille pour toujours, invisible, même une fois la page réellement affichée.
  nuniSphereObserver = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        if(!nuniSphereRAF){ resize(); frame(); }
      } else if(nuniSphereRAF){
        cancelAnimationFrame(nuniSphereRAF); nuniSphereRAF = null;
      }
    });
  }, { threshold: 0.01 });
  nuniSphereObserver.observe(canvas);
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden && nuniSphereRAF){ cancelAnimationFrame(nuniSphereRAF); nuniSphereRAF = null; }
    else if(!document.hidden && !nuniSphereRAF && canvas.getBoundingClientRect().width > 0){ resize(); frame(); }
  });
}
// Déclenche l'onde lumineuse + le léger gonflement au toucher (voir touchBoost dans frame()).
function nuniSphereTouchPulse(){ nuniSphereTouchT = 1; }

const genres = [
  { n:'Tout', c1:'#6E45A8', c2:'#3A2A5C', anim:'anim-breathe',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 15.2c0-3 2.2-5.2 5.4-5.2 1.1 0 2.1.3 2.9 1L15.4 8l1 .7-1.7 2.1c1 .9 1.6 2.1 1.6 3.5 0 2.9-2.6 5.2-6.4 5.2-3.2 0-6-1.7-6-4.3z"/><circle cx="9.3" cy="10.9" r=".55" fill="currentColor"/></svg>' },
  { n:'Nouveautés', c1:'#E8C77E', c2:'#8A6A2E', anim:'anim-twinkle',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3.2 14.3 9l6.2.5-4.7 4 1.4 6-5.2-3.3L6.8 19.5l1.4-6-4.7-4L9.7 9z"/></svg>' },
  { n:'Top Congo', c1:'#D4AF6A', c2:'#5C3A18', anim:'anim-sheen',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17h16l-1.4-6.4-3.8 3-2.8-5-2.8 5-3.8-3z"/><path d="M6.5 17l1-1.6 1 1.6 1-1.6 1 1.6 1-1.6 1 1.6 1-1.6 1 1.6" stroke-width="1.2"/><path d="M8 20h8"/></svg>' },
  { n:'Rap', c1:'#8B96B0', c2:'#141A38', anim:'anim-pulse-ring',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="10" rx="3"/><path d="M9.5 7h5M9.5 9.3h5"/><path d="M6 11a6 6 0 0 0 12 0"/><path d="M12 17v3M9.5 20h5"/></svg>' },
  { n:'Rumba', c1:'#D98A3D', c2:'#7A4A24', anim:'anim-strum',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 16.3a3.4 3.4 0 1 0 3-5.7"/><path d="M8.7 10.7 18 2"/><path d="M18 2h2.3M18 2v2.3"/></svg>' },
  { n:'Gospel', c1:'#F1ECE3', c2:'#B89355', anim:'anim-rise',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M6 9h12"/></svg>' },
  { n:'Afro', c1:'#1E8449', c2:'#B8860B', anim:'anim-wave',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 4h11L16 9.5H8z"/><path d="M8 9.5 6.5 19.5h11L16 9.5"/><path d="M6.5 4h11"/></svg>' },
  { n:'Hip-Hop', c1:'#4A2E70', c2:'#8B96B0', anim:'anim-bounce',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="14" width="4.3" height="6" rx="2"/><rect x="17.2" y="14" width="4.3" height="6" rx="2"/></svg>' },
  { n:'Traditionnel', c1:'#1F4D2C', c2:'#8C6239', anim:'anim-glow-pulse',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-4.2 0-6.5 3.1-6.5 7.2 0 5 2.7 9 6.5 10.8 3.8-1.8 6.5-5.8 6.5-10.8C18.5 6.1 16.2 3 12 3z"/><path d="M8.7 10h1.8M13.5 10h1.8"/><path d="M12 12.3v2.5"/><path d="M9.3 17.2c1 .8 4.4.8 5.4 0"/></svg>' },
];
const genreGrid = document.getElementById('genre-grid');
genres.forEach((g,i)=>{
  const tile = document.createElement('div');
  tile.className = 'genre-tile' + (i===0 ? ' is-active' : '');
  tile.style.setProperty('--gc1', g.c1);
  tile.style.setProperty('--gc2', g.c2);
  if(g.n === 'Tout'){
    // Pas d'icône ni de texte pour "Tout" — une vraie sphère audio vivante à la place
    // (voir buildNuniAudioSphere plus bas). Le nom reste dans un aria-label pour
    // l'accessibilité, même si rien n'est visible à l'écran.
    tile.setAttribute('aria-label', 'Tout');
    tile.innerHTML = `
      <div class="genre-tile-texture"></div>
      <canvas class="nuni-sphere-canvas" id="nuni-sphere-canvas"></canvas>
      <span class="genre-active-line"></span>`;
  } else {
    tile.innerHTML = `
      <div class="genre-tile-texture"></div>
      <div class="genre-tile-halo"></div>
      <div class="genre-icon ${g.anim}">${g.icon}</div>
      <span class="gname">${g.n}</span>
      <span class="genre-active-line"></span>`;
  }
  tile.addEventListener('click', (e)=>{
    document.querySelectorAll('.genre-tile').forEach(t=>t.classList.remove('is-active'));
    tile.classList.add('is-active');
    if(g.n === 'Tout'){ nuniSphereTouchPulse(); }
    else { bounceEl(tile.querySelector('.genre-icon')); }
    hapticPing();
    if(g.n === 'Tout'){ filterCatalogByGenre('Tout'); }
    else if(g.n === 'Nouveautés'){ openNewReleasesPage(); }
    else if(g.n === 'Top Congo'){ openTopCongoPage(); }
    else { openGenreCategoryPage(g.n); }
  });
  genreGrid.appendChild(tile);
});
buildNuniAudioSphere();



/* ============ BANNIÈRES HERO — gérées uniquement par l'admin ============
   Plusieurs photos possibles par section, tirée au hasard à chaque visite. Repli sur
   l'image statique du dépôt si l'admin n'a encore rien ajouté (jamais d'écran vide). */
async function pickHeroImage(section, fallbackPath){
  try{
    const res = await fetch(NUNI_API_BASE + '/api/hero-images/' + section);
    const data = await res.json();
    if(data.images && data.images.length) return data.images[Math.floor(Math.random() * data.images.length)];
  }catch(e){ /* pas grave, on garde l'image statique */ }
  return fallbackPath;
}
pickHeroImage('accueil', 'assets/hero/hero-accueil.jpg').then(url=>{
  const el = document.getElementById('premium-hero-accueil');
  if(el) el.style.backgroundImage = `url('${url}')`;
});

function filterCatalogByGenre(genreName){
  const shelvesWrap = document.getElementById('genre-filtered-shelf');
  const defaultShelves = document.getElementById('default-shelves');

  if(genreName === 'Tout'){
    defaultShelves.style.display = 'block';
    shelvesWrap.style.display = 'none';
    return;
  }

  let filtered;
  let heading;
  if(genreName === 'Nouveautés'){
    filtered = tracks.filter(t=> t.isReal).slice(0, 8);
    heading = 'Nouveautés';
  } else if(genreName === 'Top Congo'){
    filtered = tracks.filter(t=> t.isReal).sort((a,b)=> parseStreamsCount(b.streams) - parseStreamsCount(a.streams)).slice(0, 8);
    heading = 'Top Congo';
  } else {
    filtered = tracks.filter(t => t.genre === genreName && t.isReal);
    heading = genreName;
  }

  defaultShelves.style.display = 'none';
  shelvesWrap.style.display = 'block';
  document.getElementById('genre-filtered-heading').textContent = heading;

  // Bannière hero uniquement pour Top Congo, avec les vraies données du #1 actuel —
  // jamais de nom ou de chiffre inventé, tout vient de "filtered" (déjà trié par vrais streams).
  const heroEl = document.getElementById('top-congo-hero');
  if(heroEl){
    if(genreName === 'Top Congo' && filtered.length){
      const leader = filtered[0];
      const totalListeners = filtered.reduce((s,t)=> s + parseStreamsCount(t.streams), 0);
      heroEl.style.display = 'flex';
      heroEl.style.backgroundImage = "url('assets/hero/hero-topcongo.jpg')"; // repli immédiat, remplacé dès que le tirage serveur répond
      pickHeroImage('top-congo', 'assets/hero/hero-topcongo.jpg').then(url=>{ heroEl.style.backgroundImage = `url('${url}')`; });
      heroEl.innerHTML = `
        <div class="premium-hero-overlay"></div>
        <div class="premium-hero-content">
          <span class="premium-hero-badge"><svg class="nuni-ic filled nuni-ic-gold" viewBox="0 0 24 24"><path d="M3 8l4 3 5-6 5 6 4-3-2 10H5L3 8z"/><path d="M5 21h14"/></svg> CLASSEMENT OFFICIEL</span>
          <h2 class="premium-hero-title">Top Congo</h2>
          <p class="premium-hero-sub">${formatLikes(totalListeners)} écoutes cumulées cette semaine sur les titres classés.</p>
          <div class="premium-hero-tags"><span style="cursor:default;"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><circle cx="12" cy="14" r="7"/><path d="M8 3h8l-2.5 6h-3L8 3z"/><path d="M11 17.5v-5l-1.3.7"/></svg> En tête : ${leader.a} — « ${leader.t} »</span></div>
          <div class="premium-hero-actions">
            <button class="btn btn-primary" id="top-congo-hero-play-btn"><svg class="nuni-ic filled" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M8 5v14l11-7z"/></svg> Écouter le classement</button>
          </div>
        </div>`;
      document.getElementById('top-congo-hero-play-btn').onclick = ()=>{ playTrack(leader); openFullPlayer(); };
    } else {
      heroEl.style.display = 'none';
      heroEl.innerHTML = '';
    }
  }

  const row = document.getElementById('genre-filtered-row');
  row.innerHTML = '';
  const artistsWrap = document.getElementById('genre-filtered-artists-wrap');
  const artistsRow = document.getElementById('genre-filtered-artists-row');
  const clipsWrap = document.getElementById('genre-filtered-clips-wrap');
  const clipsRow = document.getElementById('genre-filtered-clips-row');
  if(!filtered.length){
    row.innerHTML = `<p style="color:var(--text-faint); font-size:13px;">Aucun titre dans ce genre pour le moment.</p>`;
    if(artistsWrap) artistsWrap.style.display = 'none';
    if(clipsWrap) clipsWrap.style.display = 'none';
    return;
  }
  filtered = dedupeAlbums(filtered);
  filtered.forEach((tr,i)=>{
    // FIX : même protection que fillShelf()/renderTopCongo() — avant, la moindre carte à
    // problème dans ce genre précis faisait planter tout le forEach, laissant la page
    // (Top Congo, Nouveautés, ou n'importe quel genre — Rap, Rumba, Gospel...) partiellement
    // ou totalement vide sans aucune raison visible à l'écran.
    try{
      const card = trackCard(tr);
      card.style.animationDelay = (i*0.05) + 's';
      card.classList.add('reveal-in');
      // ---- Top Congo est un vrai classement (déjà trié par vrais streams) — un badge de
      // rang donne le sentiment de trophée demandé, sans rien changer pour les autres genres
      // qui n'ont pas de notion d'ordre. ----
      if(genreName === 'Top Congo'){
        const rank = i + 1;
        const badge = document.createElement('div');
        badge.className = 'tc-rank-badge' + (rank <= 3 ? ` tc-rank-${rank}` : '');
        badge.innerHTML = rank <= 3 ? '<svg class="nuni-ic nuni-ic-gold filled" viewBox="0 0 24 24" style="width:13px;height:13px;"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M9 21h6M12 15v6"/></svg>' : `#${rank}`;
        const cover = card.querySelector('.cover');
        if(cover) cover.appendChild(badge);
      }
      row.appendChild(card);
    }catch(e){ console.error('[filterCatalogByGenre] carte ignorée après erreur :', e); }
  });

  // ---- Artistes de ce genre — uniquement pour un genre précis (pas Nouveautés/Top Congo,
  // qui mélangent déjà tous les genres). ----
  if(artistsWrap && artistsRow){
    if(genreName === 'Nouveautés' || genreName === 'Top Congo'){
      artistsWrap.style.display = 'none';
    } else {
      const artistNames = [...new Set(tracks.filter(t=>t.genre===genreName && t.isReal).map(t=>t.a))].slice(0, 10);
      if(artistNames.length){
        artistsWrap.style.display = 'block';
        artistsRow.innerHTML = '';
        artistNames.forEach(name=>{
          const t = tracks.find(tr=>tr.a===name);
          const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          const photoStyle = t && t.artistAvatarUrl ? `background-image:url(${t.artistAvatarUrl});` : '';
          const artistId = t && t.artistId ? t.artistId : null;
          const card = document.createElement('div');
          card.className = 'artist-suggest-card';
          card.innerHTML = `
            <div class="asc-photo" style="${photoStyle}">
              ${photoStyle ? '' : `<div class="asc-initials">${initials}</div>`}
            </div>
            <div class="asc-info">
              <div class="n">${name}${t && t.verified ? ' <svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24" style="width:13px;height:13px;"><path d="M20 6 9 17l-5-5"/></svg>' : ''}</div>
              <div class="g">${genreName}</div>
              <button>Voir le profil</button>
            </div>`;
          card.querySelector('.asc-photo').onclick = ()=> openArtistPage(name, artistId);
          card.querySelector('button').onclick = (e)=>{ e.stopPropagation(); openArtistPage(name, artistId); };
          artistsRow.appendChild(card);
        });
      } else {
        artistsWrap.style.display = 'none';
      }
    }
  }

  // ---- Clips de ce genre — approximé via les artistes qui publient dans ce genre (les
  // clips eux-mêmes ne portent pas encore de genre propre côté base de données). ----
  if(clipsWrap && clipsRow){
    if(genreName === 'Nouveautés' || genreName === 'Top Congo'){
      clipsWrap.style.display = 'none';
    } else {
      const genreArtists = new Set(tracks.filter(t=>t.genre===genreName && t.isReal).map(t=>t.a));
      const genreClips = clips.filter(c=> genreArtists.has(c.artist)).slice(0, 8);
      if(genreClips.length){
        clipsWrap.style.display = 'block';
        clipsRow.innerHTML = '';
        genreClips.forEach(c=> clipsRow.appendChild(clipCard(c)));
      } else {
        clipsWrap.style.display = 'none';
      }
    }
  }
}

/* ============ NUNI ADS (espace annonceurs) ============ */
let pendingAdImage = null;
function previewAdImage(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    pendingAdImage = reader.result;
    document.getElementById('ad-preview-img').style.backgroundImage = `url(${reader.result})`;
  };
  reader.readAsDataURL(file);
}
function adCard(name, link, img, desc, icon){
  const card = document.createElement('div');
  card.className = 'ad-card';
  card.innerHTML = `
    <div class="ad-img" style="${img ? `background-image:url(${img})` : ''}">${!img && icon ? `<span class="ad-icon">${icon}</span>` : ''}</div>
    <span class="ad-tag">Sponsorisé</span>
    <div class="ad-name">${name}</div>
    ${desc ? `<div class="ad-desc">${desc}</div>` : ''}
    <div class="ad-link">${link}</div>`;
  card.onclick = ()=> toast(`Annonce « ${name} » — lien : ${link}`);
  return card;
}
const adDurationPrices = { '5j': { label:'5 jours', price:500 }, '2s': { label:'2 semaines', price:1000 }, '1m': { label:'1 mois', price:2000 } };
function updateAdPrice(){
  const selected = document.querySelector('input[name="ad-duration"]:checked').value;
  document.getElementById('ad-submit-price').textContent = adDurationPrices[selected].price.toLocaleString('fr-FR') + ' FCFA';
}
async function submitAdRequest(){
  const name = document.getElementById('ad-name').value.trim();
  const desc = document.getElementById('ad-desc').value.trim();
  const link = document.getElementById('ad-link').value.trim();
  const contact = document.getElementById('ad-contact').value.trim();
  const selected = document.querySelector('input[name="ad-duration"]:checked').value;
  const duration = adDurationPrices[selected];
  const status = document.getElementById('ad-ai-status');

  if(!name || !link || !contact){
    status.className = 'ai-screen-status flag';
 status.textContent = ' ️ Merci de renseigner au minimum le nom du produit, un lien et un contact.';
    return;
  }

  document.getElementById('ad-preview-name').textContent = name;
  document.getElementById('ad-preview-link').textContent = link;

  status.className = 'ai-screen-status checking';
  status.innerHTML = 'Envoi de votre demande…';

  // Avant : ce formulaire simulait un envoi (faux délai "vérification IA" + faux message
  // de succès) — aucun email n'était jamais réellement transmis, ce qui explique qu'aucune
  // demande n'arrivait jamais dans la vraie boîte mail NUNI. Ici : vrai appel serveur,
  // qui envoie un vrai email via le même système que les codes d'accès.
  try{
    const res = await fetch(NUNI_API_BASE + '/api/ads/request', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, desc, link, contact, duration: selected })
    });
    const data = await res.json();
    if(!res.ok){
      status.className = 'ai-screen-status flag';
      status.innerHTML = '<svg class="nuni-ic filled nuni-ic-warn" viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.1"/></svg> ' + (data.error || "La demande n'a pas pu être envoyée.");
 toast(' ' + (data.error || 'Erreur.'));
      return;
    }
    status.className = 'ai-screen-status ok';
    status.innerHTML = `<svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Demande envoyée — reçue à <b>nunimisiki@gmail.com</b><br>
      <span style="color:var(--text-faint)">Formule : ${duration.label} · ${duration.price.toLocaleString('fr-FR')} FCFA · Contact : ${contact}</span><br>
      <span style="color:var(--text-faint)">Vous recevrez une réponse par WhatsApp/email avant toute mise en ligne.</span>`;
    toast(`Demande envoyée pour validation (${duration.label} — ${duration.price} FCFA).`);
  }catch(e){
    status.className = 'ai-screen-status flag';
    status.innerHTML = '<svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg> Impossible de contacter le serveur NUNI — réessayez.';
  }
}
function seedAds(){
  const row = document.getElementById('ads-row');
  if(!row) return;
  // Avant : 3 publicités entièrement inventées ("Café Mboka", "Kin Fashion Store", "Studio
  // Ébène"), avec de faux liens WhatsApp, affichées en permanence peu importe si un vrai
  // annonceur avait payé quoi que ce soit. Aucun vrai système de gestion des pubs approuvées
  // n'existe encore côté admin — un état vide honnête vaut mieux qu'inventer des annonces.
  row.innerHTML = `<p style="font-size:12.5px; color:var(--text-faint); padding:8px 0;">Aucune annonce sponsorisée pour le moment — proposez la vôtre ci-dessous !</p>`;
}
seedAds();

const tracks = [
  {t:'Mokili Ya Sika', a:'Bibi Mwana', p:'pal-1', album:'Envol', genre:'Rumba', year:2026, streams:'412 K', release:'12 Jan 2026', verified:true, likes:18400},
  {t:'Lokito', a:'Ndombe Junior', p:'pal-2', album:'Kin Vibes', genre:'Afro', year:2025, streams:'298 K', release:'03 Sep 2025', verified:true, likes:12750},
  {t:'Ngai Na Yo', a:'Kessy Tina', p:'pal-3', album:'Sango', genre:'Gospel', year:2026, streams:'151 K', release:'20 Fév 2026', verified:false, likes:6320},
  {t:'Nzembo ya Kati', a:'Mbote System', p:'pal-4', album:'Système', genre:'Hip-Hop', year:2025, streams:'87 K', release:'14 Nov 2025', verified:false, likes:3180},
  {t:'Liboso', a:'Les Anges du Rythme', p:'pal-5', album:'Liboso', genre:'Traditionnel', year:2024, streams:'205 K', release:'02 Mai 2024', verified:true, likes:9040},
  {t:'Esengo', a:'Bibi Mwana', p:'pal-6', album:'Envol', genre:'Afro', year:2026, streams:'334 K', release:'12 Jan 2026', verified:true, likes:15200},
  {t:'Boyokani', a:'Tcheza Nation', p:'pal-2', album:'Nation', genre:'Rap', year:2025, streams:'176 K', release:'29 Juin 2025', verified:false, likes:7460},
  {t:'Mabele ya Bapaya', a:'Tcheza Nation', p:'pal-4', album:'Nation', genre:'Rap', year:2025, streams:'142 K', release:'29 Juin 2025', verified:false, likes:6210},
  {t:'Combat Quotidien', a:'Mbote System', p:'pal-1', album:'Système', genre:'Rap', year:2025, streams:'98 K', release:'14 Nov 2025', verified:false, likes:4020},
  {t:'Soki Nakomi', a:'Ndombe Junior', p:'pal-1', album:'Kin Vibes', genre:'Afro', year:2025, streams:'264 K', release:'03 Sep 2025', verified:true, likes:11080},
];
let currentTrack = tracks[0]; // déclaré ici, tout de suite après tracks — trackCard() y fait
                                // référence dès les tout premiers appels à fillShelf() plus bas,
                                // qui plantaient sinon (ReferenceError: accès avant initialisation).
let playing = false; // même raison — trackCard() teste aussi "playing", donc doit exister avant fillShelf()
function formatLikes(n){ return n >= 1000 ? (n/1000).toFixed(1).replace('.0','') + 'K' : n; }
// Format façon Spotify/Apple Music : 0-999 exact, puis K/M/B avec virgule à la française
// (1,2K plutôt que 1.2K). Utilisé partout où un vrai nombre de streams est affiché.
function formatStreams(n){
  n = Number(n) || 0;
  const withComma = (v)=> v.toFixed(1).replace('.0','').replace('.', ',');
  if(n < 1000) return String(n);
  if(n < 1000000) return withComma(n/1000) + 'K';
  if(n < 1000000000) return withComma(n/1000000) + 'M';
  return withComma(n/1000000000) + 'B';
}
function ensureAlbumViewStyles(){
  if(document.getElementById('album-view-styles')) return;
  const style = document.createElement('style');
  style.id = 'album-view-styles';
  style.textContent = `
    #album-view-overlay{position:fixed; inset:0; z-index:9999; background:#0A0A0A; overflow-y:auto; opacity:0; transition:opacity .25s ease;}
    #album-view-overlay.show{opacity:1;}

    /* ---- Bouton retour, en haut à gauche, façon navigation Spotify (plutôt qu'un X) ---- */
    .av-back{position:fixed; top:calc(14px + env(safe-area-inset-top,0)); left:14px; width:36px; height:36px; border-radius:50%; background:rgba(0,0,0,0.5); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); border:none; color:#fff; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center;}
    .av-back:hover{background:rgba(0,0,0,0.7);}

    /* ---- Zone haute : fond teinté par la pochette, qui s'assombrit vers le noir plein,
       comme la page album de Spotify (dégradé issu de la couleur dominante de la pochette) ---- */
    .av-hero{position:relative; padding:calc(64px + env(safe-area-inset-top,0)) 20px 20px; display:flex; flex-direction:column; align-items:center; overflow:hidden;}
    .av-hero-bg{position:absolute; inset:0; background-size:cover; background-position:center; filter:blur(60px) saturate(1.4) brightness(0.55); transform:scale(1.3);}
    .av-hero-fade{position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,0.25) 0%, #0A0A0A 88%);}
    .av-cover{position:relative; width:min(58vw, 240px); height:min(58vw, 240px); border-radius:6px; background-size:cover; background-position:center; box-shadow:0 18px 46px rgba(0,0,0,0.65); flex-shrink:0;}

    /* ---- Bloc titre/artiste, aligné à gauche sous la pochette, comme Spotify ---- */
    .av-info{position:relative; width:100%; max-width:640px; margin:18px auto 0; text-align:left;}
    .av-type{color:#B3B3B3; font-size:13px; font-weight:600;}
    .av-title{color:#fff; font-size:26px; font-weight:800; line-height:1.2; margin:6px 0 10px; word-break:break-word;}
    .av-artist-row{display:flex; align-items:center; gap:8px; cursor:pointer; margin-bottom:4px; width:fit-content;}
    .av-artist-avatar{width:24px; height:24px; border-radius:50%; background:linear-gradient(135deg,#1E8449,#0E3D2C); color:#F3E6C8; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; background-size:cover; background-position:center; flex-shrink:0;}
    .av-artist-name{color:#fff; font-size:14.5px; font-weight:700;}
    .av-meta{color:#B3B3B3; font-size:13px;}

    /* ---- Rangée d'actions : coche/ajouter, télécharger, options … puis aléatoire + gros
       bouton lecture rond, exactement la disposition Spotify (cluster gauche / cluster droite) ---- */
    .av-actions{position:relative; width:100%; max-width:640px; margin:20px auto 0; padding:0 20px; display:flex; align-items:center; gap:18px;}
    .av-actions-left{display:flex; align-items:center; gap:18px;}
    .av-actions-spacer{flex:1;}
    .av-actions-right{display:flex; align-items:center; gap:18px;}
    .av-circle-btn{width:32px; height:32px; border-radius:50%; border:1.5px solid #727272; background:none; color:#B3B3B3; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:border-color .15s ease, color .15s ease, transform .1s ease;}
    .av-circle-btn:hover{border-color:#fff; color:#fff;}
    .av-circle-btn:active{transform:scale(0.92);}
    .av-circle-btn.is-active{border-color:transparent; background:linear-gradient(135deg,#1E8449,#0E3D2C); color:#F3E6C8;}
    .av-more-btn{width:32px; height:32px; border:none; background:none; color:#B3B3B3; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:color .15s ease, transform .1s ease;}
    .av-more-btn:hover{color:#fff;}
    .av-more-btn:active{transform:scale(0.92);}
    .av-shuffle-btn{border:none; background:none; color:#D4AF6A; cursor:pointer; width:26px; height:26px; display:flex; align-items:center; justify-content:center; transition:color .15s ease, transform .1s ease;}
    .av-shuffle-btn:hover{color:#F3E6C8;}
    .av-play-all{width:52px; height:52px; border-radius:50%; border:none; background:linear-gradient(135deg,#1E8449,#0E3D2C); color:#F3E6C8; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 20px rgba(30,132,73,0.4); transition:transform .12s ease;}
    .av-play-all:hover{transform:scale(1.05);}
    .av-play-all:active{transform:scale(0.96);}

    /* ---- Liste des pistes : deux lignes (titre + artiste), sans numéro, menu "…" à droite,
       exactement le motif de rangée utilisé sur les pages album de Spotify ---- */
    .av-list{max-width:640px; margin:22px auto calc(120px + env(safe-area-inset-bottom,0)); padding:0 20px;}
    .av-total-duration{font-size:12px; color:#727272; margin-top:14px; padding:0 20px;}
    .av-followed-section{max-width:640px; margin:36px auto 40px; padding:24px 20px 0; border-top:1px solid rgba(255,255,255,.08);}
    .av-followed-title{color:#fff; font-size:14px; font-weight:700; margin-bottom:14px;}
    .av-followed-row{display:flex; gap:16px; overflow-x:auto; -webkit-overflow-scrolling:touch; padding-bottom:4px;}
    .av-followed-card{flex-shrink:0; width:84px; text-align:center; cursor:pointer;}
    .av-followed-photo{width:72px; height:72px; border-radius:50%; margin:0 auto 8px; background:var(--grad-envol); background-size:cover; background-position:center; box-shadow:0 6px 16px -6px rgba(0,0,0,.5);}
    .av-followed-name{color:#e6e6e6; font-size:11.5px; font-weight:600; line-height:1.3; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;}
    .av-list-panel{display:flex; flex-direction:column;}
    .av-row{display:flex; align-items:center; gap:12px; padding:9px 4px; border-radius:4px; cursor:pointer; opacity:0; animation:avRowIn .3s ease forwards;}
    @keyframes avRowIn{ from{opacity:0; transform:translateY(4px);} to{opacity:1; transform:translateY(0);} }
    .av-row:hover{background:rgba(255,255,255,0.06);}
    .av-row-body{flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;}
    .av-row-title{color:#fff; font-size:15px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
    .av-row-artist{color:#B3B3B3; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
    .av-row.is-playing .av-row-title{color:#3BC26A;}
    .av-row-eq{display:flex; align-items:flex-end; gap:2px; width:14px; height:14px; flex-shrink:0;}
    .av-row-eq span{width:3px; background:#3BC26A; border-radius:1px; animation:avEqBounce 0.9s ease-in-out infinite;}
    .av-row-eq span:nth-child(1){height:40%; animation-delay:0s;}
    .av-row-eq span:nth-child(2){height:100%; animation-delay:.2s;}
    .av-row-eq span:nth-child(3){height:65%; animation-delay:.4s;}
    @keyframes avEqBounce{ 0%,100%{transform:scaleY(0.4);} 50%{transform:scaleY(1);} }
    .av-row-lyrics{font-size:11px; color:#D4AF6A; opacity:.85; flex-shrink:0;}
    .av-row-streams{font-size:11px; color:#727272; white-space:nowrap; flex-shrink:0;}
    .av-row-menu-btn{width:30px; height:30px; border:none; background:none; color:#B3B3B3; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:color .15s ease;}
    .av-row-menu-btn:hover{color:#fff;}
  `;
  document.head.appendChild(style);
}
function ensureNavStyles(){
  if(document.getElementById('nuni-nav-styles')) return;
  const style = document.createElement('style');
  style.id = 'nuni-nav-styles';
  style.textContent = `
    .app-nav-link{position:relative; transition:color .25s ease;}
    .app-nav-link.is-active{color:var(--accent, #D4AF6A) !important;}
    .app-nav-link.is-active::after{content:''; position:absolute; left:2px; right:2px; bottom:-9px; height:2px; border-radius:2px; background:var(--accent, #D4AF6A); animation:nuniNavIn .25s ease;}
    .tab-btn{transition:color .2s ease, transform .2s ease;}
    .tab-btn.is-active{color:var(--accent, #D4AF6A) !important; transform:translateY(-1px);}
    @keyframes nuniNavIn{ from{ transform:scaleX(0); opacity:0; } to{ transform:scaleX(1); opacity:1; } }
  `;
  document.head.appendChild(style);
}
ensureNavStyles();
document.addEventListener('click', (e)=>{
  const link = e.target.closest('.app-nav-link[data-app-link="artist"], .tab-btn[data-tab="artist"]');
  if(link && currentUser && currentUser.account_type === 'artist' && currentUser.artist_name){
    e.preventDefault();
    e.stopPropagation();
    openArtistPage(currentUser.artist_name, currentUser.id);
  }
}, true);

/* ============ RADIO DÉSACTIVÉE (temporairement, code conservé pour réactivation future) ============ */
// Le mode DJ reste actif. Seule la Radio est retirée de la navigation ; tout son code
// (openTuner, tunerStations, startTunerPlayback, etc.) reste inchangé ci-dessous.
// Bascule le badge "EN DIRECT" — vit maintenant uniquement sur la tuile Radio & DJ de la
// recherche (l'ancienne bannière d'accueil a été retirée). Un seul point d'entrée pour tous
// les appelants, plutôt que de dupliquer la logique à chaque endroit.
function setRadioLiveBadge(visible){
  const badge = document.getElementById('asv-radio-badge');
  if(badge) badge.style.display = visible ? 'inline-flex' : 'none';
}
function ensureRadioHiddenFromNav(){
  // Force toute ouverture du tuner à atterrir sur l'onglet DJ, jamais Radio
  const originalOpenTuner = window.openTuner;
  window.openTuner = function(){ return originalOpenTuner('dj'); };

  // Cache le bouton/lien "Ouvrir le tuner" (radio) partout où il apparaît, sans toucher au reste
  document.querySelectorAll('button, a').forEach(el=>{
    const txt = (el.textContent || '').trim().toLowerCase();
    if(txt.includes('ouvrir le tuner')) el.style.display = 'none';
  });
  // Cache l'onglet "Radio" à l'intérieur du sélecteur tuner (si jamais il s'ouvre autrement)
  const radioTab = document.getElementById('tuner-tab-radio');
  if(radioTab) radioTab.style.display = 'none';
  // Cache l'indicateur "radio en direct" sur le lecteur
  setRadioLiveBadge(false);
}
ensureRadioHiddenFromNav();
setTimeout(ensureRadioHiddenFromNav, 500); // sécurité si certains éléments se rendent un peu après
function ensureBadgeStyles(){
  if(document.getElementById('nuni-badge-styles')) return;
  const style = document.createElement('style');
  style.id = 'nuni-badge-styles';
  style.textContent = `
    .nuni-type-badge{position:absolute; top:8px; left:8px; z-index:2; display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; background:linear-gradient(135deg,#E8C77E,#B98A3D); color:#241708; font-family:Georgia,'Times New Roman',serif; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:1.4px; box-shadow:0 3px 10px rgba(212,175,106,0.4); border:1px solid rgba(255,255,255,0.25);}
    .av-icon-btn{width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); color:#EDEDED; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s ease, color .15s ease, transform .15s ease;}
    .av-icon-btn:hover{background:rgba(212,175,106,0.18); color:#D4AF6A; transform:translateY(-1px);}
    .av-icon-btn.is-active{background:#D4AF6A; color:#0A0A10; border-color:#D4AF6A;}
  `;
  document.head.appendChild(style);
}
ensureBadgeStyles();
function handleTrackCardClick(tr){
  if(tr.releaseType && tr.releaseType !== 'Single'){ openAlbumView(tr); }
  else { playTrack(tr); }
}
/* Durée totale réelle d'un album — mesurée sur les vrais fichiers audio (métadonnées
   chargées en arrière-plan, jamais une estimation ou une valeur inventée). Visible pour
   tout le monde (artiste comme consommateur), contrairement aux écoutes par morceau. */
async function loadRealAlbumDuration(albumTracks, releaseDateLabel, creditsText){
  const el = document.getElementById('av-total-duration');
  if(!el) return;
  const count = albumTracks.length;
  const countLabel = `${count} titre${count>1?'s':''}`;
  const creditsLine = creditsText ? ' ' + creditsText : '';
  const baseLine = [releaseDateLabel, countLabel].filter(Boolean).join(' · ');
  el.textContent = baseLine + creditsLine; // affiché tout de suite ; la durée vient compléter juste après
  const withAudio = albumTracks.filter(t=>t.audioUrl);
  if(!withAudio.length) return;
  try{
    const durations = await Promise.all(withAudio.map(t=> new Promise(resolve=>{
      const probe = new Audio();
      probe.preload = 'metadata';
      probe.src = t.audioUrl;
      probe.addEventListener('loadedmetadata', ()=> resolve(isFinite(probe.duration) ? probe.duration : 0));
      probe.addEventListener('error', ()=> resolve(0));
      setTimeout(()=> resolve(0), 8000); // sécurité : ne bloque jamais indéfiniment sur un fichier lent
    })));
    const totalSeconds = durations.reduce((a,b)=>a+b, 0);
    if(!totalSeconds) return;
    const h = Math.floor(totalSeconds/3600);
    const m = Math.round((totalSeconds%3600)/60);
    const durationLabel = `${h > 0 ? h+'h ' : ''}${m}min`;
    el.textContent = [releaseDateLabel, `${countLabel}, ${durationLabel}`].filter(Boolean).join(' · ') + creditsLine;
  }catch(e){ /* la ligne de base (date · nb titres + crédits) reste affichée, pas grave */ }
}
/* Vrais artistes suivis par l'artiste de cet album (table follows) — jamais une
   recommandation générique, uniquement ce qu'il suit lui-même réellement. */
async function loadArtistFollowedArtists(artistId){
  const section = document.getElementById('av-followed-section');
  const row = document.getElementById('av-followed-row');
  if(!section || !row || !artistId) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/artist/' + artistId + '/follows');
    const data = await res.json();
    const list = data.artists || [];
    if(!list.length) return; // rien à montrer plutôt qu'une section vide
    row.innerHTML = list.map(a=>{
      const photoStyle = a.avatar_url ? `background-image:url(${a.avatar_url});` : '';
      return `<div class="av-followed-card" data-id="${a.id}" data-name="${(a.artist_name||'').replace(/"/g,'&quot;')}">
        <div class="av-followed-photo ${a.avatar_url ? '' : 'pal-1'}" style="${photoStyle}"></div>
        <div class="av-followed-name">${esc(a.artist_name||'')}${a.is_verified ? ' <svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24" style="width:11px;height:11px;"><path d="M20 6 9 17l-5-5"/></svg>' : ''}</div>
      </div>`;
    }).join('');
    row.querySelectorAll('.av-followed-card').forEach(card=>{
      card.onclick = ()=>{ openArtistPage(card.dataset.name, Number(card.dataset.id)); };
    });
    section.style.display = 'block';
  }catch(e){ /* pas grave — la section reste simplement masquée */ }
}
function openAlbumView(tr){
  const albumTracks = tracks.filter(t => t.album === tr.album && t.a === tr.a);
  if(albumTracks.length <= 1){ playTrack(tr); return; } // un seul morceau trouvé : on joue direct par sécurité
  ensureAlbumViewStyles();
  ensurePlaylistViewStyles(); // réutilise les styles de la carte "Le P" et du rail similaire, déjà écrits pour la page Playlist
  let overlay = document.getElementById('album-view-overlay');
  if(overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'album-view-overlay';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const coverStyle = tr.cover ? `background-image:url(${tr.cover});` : `background:linear-gradient(135deg,#1E8449,#0E3D2C);`;
  const closeOverlay = ()=>{ overlay.classList.remove('show'); document.body.style.overflow = ''; setTimeout(()=> overlay.remove(), 200); };
  const artistAvatarStyle = tr.artistAvatar ? `background-image:url(${tr.artistAvatar});` : '';
  const artistInitial = (tr.a || '?').charAt(0).toUpperCase();
  const releaseYear = tr.release ? String(tr.release).slice(-4) : '';

  overlay.innerHTML = `
    <button class="av-back" title="Retour"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
    <div class="av-hero">
      <div class="av-hero-bg" style="${coverStyle}"></div>
      <div class="av-hero-fade"></div>
      <div class="av-cover" style="${coverStyle}"></div>
      <div class="av-info">
        <div class="av-type">${tr.releaseType || 'Album'}</div>
        <div class="av-title">${tr.album}</div>
        <div class="av-artist-row av-artist-link">
          <div class="av-artist-avatar" style="${artistAvatarStyle}">${artistAvatarStyle ? '' : artistInitial}</div>
          <span class="av-artist-name">${esc(tr.a)}</span>
        </div>
        <div class="av-meta">${tr.releaseType || 'Album'} · ${albumTracks.length} titre${albumTracks.length>1?'s':''}${releaseYear ? ' · ' + releaseYear : ''}</div>
      </div>
    </div>
    <div class="av-actions">
      <div class="av-actions-left">
        <button class="av-circle-btn av-fav-btn" title="Ajouter à Votre bibliothèque"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></button>
        <button class="av-circle-btn av-download-btn" title="Télécharger"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg></button>
        <button class="av-more-btn av-more-album-btn" title="Plus d'options"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>
      </div>
      <div class="av-actions-spacer"></div>
      <div class="av-actions-right">
        <button class="av-shuffle-btn" title="Écouter en aléatoire"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h3.5a3 3 0 0 1 2.4 1.2L15 15a3 3 0 0 0 2.4 1.2H20M4 18h3.5a3 3 0 0 0 2.4-1.2l1-1.3M16.5 6H20M16.5 18H20"/><path d="M18 3l3 3-3 3M18 15l3 3-3 3"/></svg></button>
        <button class="av-play-all" title="Tout écouter"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
      </div>
    </div>
    <div class="av-list">
      <div class="av-list-panel"></div>
      <div class="av-total-duration" id="av-total-duration">Calcul de la durée totale…</div>
    </div>
    <div class="av-followed-section" id="av-followed-section" style="display:none;">
      <div class="av-followed-title">Artistes suivis par ${esc(tr.a)}</div>
      <div class="av-followed-row" id="av-followed-row"></div>
    </div>
  `;

  overlay.querySelector('.av-back').onclick = closeOverlay;
  overlay.querySelector('.av-artist-link').onclick = ()=>{ closeOverlay(); openArtistPage(tr.a, tr.artistId); };
  overlay.querySelector('.av-play-all').onclick = ()=>{
    const albumIsPlaying = playing && currentTrack && albumTracks.some(t=> t.t === currentTrack.t);
    if(albumIsPlaying){ togglePlay(); } else { playTrack(albumTracks[0]); }
    refreshAvRowHighlights();
  };
  overlay.querySelector('.av-shuffle-btn').onclick = ()=>{
    const randomTrack = albumTracks[Math.floor(Math.random()*albumTracks.length)];
    playTrack(randomTrack);
    refreshAvRowHighlights();
    toast('Lecture aléatoire de « ' + tr.album + ' »');
  };
  const favBtn = overlay.querySelector('.av-fav-btn');
  const albumAlreadyFav = albumTracks.every(t => favoritesPlaylist.some(f => f.t === t.t));
  favBtn.classList.toggle('is-active', albumAlreadyFav);
  favBtn.onclick = ()=>{
    const nowFav = !favBtn.classList.contains('is-active');
    favBtn.classList.toggle('is-active', nowFav);
    albumTracks.forEach(t=>{
      const already = favoritesPlaylist.find(f=>f.t===t.t);
      if(nowFav && !already) favoritesPlaylist.unshift(t);
      if(!nowFav && already) favoritesPlaylist = favoritesPlaylist.filter(f=>f.t!==t.t);
    });
    toast(nowFav ? 'Ajouté à Votre bibliothèque.' : 'Retiré de Votre bibliothèque.');
  };
  overlay.querySelector('.av-download-btn').onclick = ()=>{
    let count = 0;
    albumTracks.forEach(t=>{
      if(!t.audioUrl) return;
      const a = document.createElement('a');
      a.href = t.audioUrl;
      a.download = t.t.replace(/[^\w\s-]/g,'') + '.mp3';
      document.body.appendChild(a);
      a.click();
      a.remove();
      logDownload(t);
      count++;
    });
    toast(count ? `Téléchargement de ${count} fichier(s) lancé.` : 'Aucun fichier audio disponible pour le téléchargement.');
  };
  // "…" au niveau de l'album entier : réutilise le même tiroir d'options qu'un morceau,
  // ouvert sur le premier titre (mêmes actions : file d'attente, favoris, voir l'artiste).
  overlay.querySelector('.av-more-album-btn').onclick = (e)=>{ openTrackCardMenu(albumTracks[0], e.currentTarget); };

  const list = overlay.querySelector('.av-list-panel');
  const PLAY_ICON_PATH = 'M8 5v14l11-7z';
  const PAUSE_ICON_PATH = 'M6 5h4v14H6zM14 5h4v14h-4z';
  function refreshAvRowHighlights(){
    list.querySelectorAll('.av-row').forEach((row, i)=>{
      const t = albumTracks[i];
      const isPlaying = playing && currentTrack && currentTrack.t === t.t;
      row.classList.toggle('is-playing', isPlaying);
      const existingEq = row.querySelector('.av-row-eq');
      if(isPlaying && !existingEq) row.querySelector('.av-row-body').insertAdjacentHTML('beforebegin', '<div class="av-row-eq"><span></span><span></span><span></span></div>');
      if(!isPlaying && existingEq) existingEq.remove();
    });
    refreshAvPlayAllIcon();
  }
  function refreshAvPlayAllIcon(){
    const btn = overlay.querySelector('.av-play-all');
    const icon = btn.querySelector('svg path');
    const albumIsPlaying = playing && currentTrack && albumTracks.some(t=> t.t === currentTrack.t);
    icon.setAttribute('d', albumIsPlaying ? PAUSE_ICON_PATH : PLAY_ICON_PATH);
  }
  albumTracks.forEach((t, i)=>{
    const row = document.createElement('div');
    const isPlaying = playing && currentTrack && currentTrack.t === t.t;
    row.className = 'av-row' + (isPlaying ? ' is-playing' : '');
    row.style.animationDelay = (i * 0.04) + 's';
    // Vraies infos par morceau — vrai nombre d'écoutes déjà en base, vrai indicateur si des
    // paroles ont réellement été renseignées pour ce titre (jamais une fausse mention).
    // Les écoutes détaillées par morceau ne sont visibles que pour un compte Artiste — un
    // consommateur qui veut voir la popularité d'un artiste va sur sa page profil publique
    // (où le vrai total cumulé reste affiché pour tout le monde).
    const canSeeStreams = currentUser && currentUser.account_type === 'artist';
    const realStreams = (canSeeStreams && t.isReal) ? Number(t.streams)||0 : null;
    row.innerHTML = `
      ${isPlaying ? '<div class="av-row-eq"><span></span><span></span><span></span></div>' : ''}
      <div class="av-row-body">
        <div class="av-row-title">${t.t}</div>
        <div class="av-row-artist">${t.a}</div>
      </div>
      ${t.lyrics ? '<span class="av-row-lyrics" title="Paroles disponibles">🅻</span>' : ''}
      ${realStreams !== null ? `<span class="av-row-streams">${realStreams.toLocaleString('fr-FR')}</span>` : ''}
      <button class="av-row-menu-btn" title="Plus d'options"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>`;
    row.onclick = (e)=>{
      if(e.target.closest('.av-row-menu-btn')) return; // le menu gère son propre clic, ne joue pas le morceau en plus
      const isThisPlaying = playing && currentTrack && currentTrack.t === t.t;
      if(isThisPlaying){ togglePlay(); } else { playTrack(t); }
      refreshAvRowHighlights();
    };
    row.querySelector('.av-row-menu-btn').onclick = (e)=>{ e.stopPropagation(); openTrackCardMenu(t, e.currentTarget); };
    list.appendChild(row);
  });

  refreshAvRowHighlights(); // état correct dès l'ouverture, pas seulement après un clic
  // Crédits — pris sur le premier morceau de l'album qui en a renseigné (en pratique, tous
  // les morceaux d'un même album partagent la même mention, saisie une fois par l'artiste).
  const albumCredits = albumTracks.find(t => t.credits)?.credits || null;
  loadRealAlbumDuration(albumTracks, tr.release, albumCredits);
  loadArtistFollowedArtists(tr.artistId);
  renderSimilarTracksRow(overlay, tr, albumTracks);

  requestAnimationFrame(()=> overlay.classList.add('show'));
  attachSwipeDownToClose(overlay, closeOverlay);
}
/* Vrai rail "Sons similaires" — vrais autres morceaux du même genre réel, cet album exclu.
   Jamais une recommandation inventée : uniquement de vrais morceaux déjà publiés sur NUNI. */
function renderSimilarTracksRow(overlay, tr, albumTracks){
  const albumTitles = new Set(albumTracks.map(t=>t.t));
  const similar = tracks.filter(t=> t.isReal && t.genre === tr.genre && !albumTitles.has(t.t)).slice(0, 10);
  if(!similar.length) return;
  const section = document.createElement('div');
  section.className = 'plv-similar';
  section.innerHTML = `<h3 class="plv-similar-title">Sons similaires</h3><div class="plv-similar-row"></div>`;
  overlay.querySelector('.av-list').parentElement.insertAdjacentElement('beforeend', section);
  const row = section.querySelector('.plv-similar-row');
  similar.forEach(t=>{
    const card = document.createElement('div');
    card.className = 'plv-similar-card';
    card.innerHTML = `
      <div class="plv-similar-cover" style="${t.cover ? `background-image:url(${t.cover})` : ''}"></div>
      <div class="plv-similar-name">${t.t}</div>
      <div class="plv-similar-count">${t.a}</div>`;
    card.onclick = ()=>{ playTrack(t); };
    row.appendChild(card);
  });
}
function trackKeyOf(tr){ return (tr.t||'') + '|' + (tr.a||''); }
function updateNowPlayingCards(){
  const key = currentTrack ? trackKeyOf(currentTrack) : null;
  document.querySelectorAll('.track-card').forEach(card=>{
    card.classList.toggle('is-now-playing', !!(key && playing && card.dataset.trackKey === key));
  });
}
// ============ FILE D'ATTENTE PERSONNELLE ============
// Avant : "File d'attente" n'était qu'une suggestion automatique dérivée du pool de lecture
// (genre/radio en cours) — impossible d'y ajouter soi-même un morceau précis. Ici : une vraie
// file contrôlée par la personne, prioritaire sur les suggestions automatiques.
let userQueue = [];
function addToQueue(tr){
  userQueue.push(tr);
  toast(`« ${tr.t} » ajouté à votre file d'attente.`);
  renderQueuePanel();
}
function removeFromQueue(index){
  userQueue.splice(index,1);
  renderQueuePanel();
}

function trackCard(tr){
  // Avant : ce style ne se chargeait qu'au tout premier clic sur un menu ⋮ (dans
  // openTrackCardMenu). En attendant ce premier clic, le bouton n'avait AUCUNE position
  // définie et tombait simplement en bas à droite de la pochette (comportement par défaut
  // du conteneur flex) au lieu d'être ancré en haut à droite comme prévu. Chargé ici, il
  // est déjà en place dès l'affichage de la toute première pochette de la page.
  ensureTrackCardMenuStyles();
  const card = document.createElement('div');
  card.className = 'track-card';
  if(tr.realId) card.dataset.trackId = tr.realId;
  card.dataset.trackKey = trackKeyOf(tr);
  // CORRECTIF DÉFINITIF : avant, l'URL de la pochette était injectée directement dans une
  // chaîne de caractères formant l'attribut style="background-image:url(...)" via
  // innerHTML. Une pochette dont l'URL Cloudinary contient un caractère spécial hérité du
  // TITRE du morceau (crochets "[FREE]", underscores "__", point médian "·", apostrophe,
  // guillemet...) pouvait casser l'attribut HTML en plein milieu — l'image ne s'appliquait
  // alors jamais, silencieusement, sans erreur visible. Les photos d'artistes (noms plus
  // simples) échappaient au problème par simple chance de contenu, pas par une vraie
  // protection. Ici : la pochette n'est plus jamais dans la chaîne HTML — juste une div
  // vide, son image est assignée juste après via la propriété DOM .style.backgroundImage,
  // qui gère nativement n'importe quel caractère dans l'URL sans échappement manuel.
  const coverInner = `<div class="cover ${tr.cover ? '' : tr.p}">${tr.cover ? '' : '<div class="cover-glyph pal-pattern"></div>'}`;
  const isMultiTrack = tr.releaseType && tr.releaseType !== 'Single';
  card.innerHTML = `
    ${coverInner}
      ${(tr.artistId && currentUser && currentUser.id === tr.artistId) ? '<span class="imported-badge" title="Votre import">Vous</span>' : ''}
      ${isMultiTrack ? `<span class="nuni-type-badge" title="${tr.releaseType}"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.3"/></svg> ${tr.releaseType}</span>` : ''}
      <button class="track-card-menu-btn" aria-label="Options">⋮</button>
      <div class="play-fab">
        <svg viewBox="0 0 24 24" class="play-fab-icon"><path d="M8 5v14l11-7z"/></svg>
        <span class="eq play-fab-eq"><i></i><i></i><i></i></span>
      </div>
    </div>
    <div class="ttl">${esc(tr.t)}</div>
    <div class="art" style="cursor:pointer;">${esc(tr.a)}</div>
    ${tr.isReal ? `<div class="stream-count-line"><svg class="nuni-ic" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> ${formatStreams(tr.streams||0)} écoutes</div>` : ''}
    <div class="likes">${currentUser && currentUser.account_type === 'artist' ? `<svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.6" y="14" width="4.4" height="6" rx="2"/><rect x="17" y="14" width="4.4" height="6" rx="2"/></svg> <span class="streams-count">${tr.streams||0}</span> · ` : ''}<svg class="nuni-ic filled nuni-ic-err" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg> <span class="likes-count">${formatLikes(tr.likes||0)}</span></div>`;
  card.querySelector('.cover').onclick = ()=> handleTrackCardClick(tr);
  card.querySelector('.ttl').onclick = ()=> handleTrackCardClick(tr);
  card.querySelector('.art').onclick = (e)=>{ e.stopPropagation(); openArtistPage(tr.a, tr.artistId); };
  card.querySelector('.track-card-menu-btn').onclick = (e)=>{ e.stopPropagation(); openTrackCardMenu(tr, e.currentTarget); };
  // CORRECTIF DÉFINITIF (suite) : assignation via l'API DOM, jamais via une chaîne HTML —
  // gère nativement n'importe quel caractère spécial dans l'URL (crochets, underscores,
  // point médian, apostrophe, guillemet...) sans jamais avoir besoin de les échapper à la
  // main. Un vrai filet de repli visuel est en place si le fichier échoue quand même à
  // charger (URL cassée, image supprimée côté Cloudinary...) — jamais un cadre vide et
  // silencieux : on retombe sur le motif de couleur générique déjà utilisé pour les
  // morceaux sans pochette du tout.
  if(tr.cover){
    const coverEl = card.querySelector('.cover');
    const probe = new Image();
    probe.onload = ()=>{
      coverEl.style.backgroundImage = `url("${tr.cover}")`; coverEl.style.backgroundSize = 'cover'; coverEl.style.backgroundPosition = 'center';
      // Alimente le moteur d'ambiance de l'accueil (voir initHomeAmbientEngine) avec la
      // vraie couleur dominante de cette vraie pochette — jamais une couleur inventée.
      if(typeof NuniPalette !== 'undefined'){
        NuniPalette.extract(tr.cover).then(palette=>{ card.dataset.ambientColor = palette.dominant; });
      }
    };
    probe.onerror = ()=>{ coverEl.classList.add(tr.p || 'pal-1'); coverEl.innerHTML = '<div class="cover-glyph pal-pattern"></div>' + coverEl.innerHTML; };
    probe.src = tr.cover;
  }
  if(currentTrack && playing && trackKeyOf(currentTrack) === trackKeyOf(tr)) card.classList.add('is-now-playing');
  // ---- Accessibilité clavier — avant, cette carte n'était activable qu'à la souris (les
  // gestionnaires de clic vivaient sur des <div> internes, jamais focusables). Toute la
  // carte devient un vrai arrêt de tabulation, activable au clavier comme à la souris.
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${esc(tr.t)} — ${esc(tr.a)}`);
  card.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); handleTrackCardClick(tr); }
  });
  return card;
}
/* Petit popover léger (zone d'appui 44px min, conforme aux recommandations mobiles) — ancré
   près du bouton cliqué plutôt qu'une feuille plein écran avec fond assombri, pour rester
   discret. Vraies actions : ajouter à la file d'attente, aimer/retirer des favoris, voir
   l'artiste. */
function ensureTrackCardMenuStyles(){
  if(document.getElementById('track-card-menu-styles')) return;
  const style = document.createElement('style');
  style.id = 'track-card-menu-styles';
  style.textContent = `
    .track-card-menu-btn{position:absolute; top:6px; right:6px; z-index:5; width:30px; height:30px; min-width:30px; border-radius:50%; background:rgba(0,0,0,.55); color:#fff; border:none; font-size:16px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center;}
    .track-card-menu-btn:hover{ background:rgba(0,0,0,.75); }
    #tcm-sheet{
      position:fixed; z-index:9999; width:240px; background:var(--bg-elev,#1a1a22);
      border:1px solid var(--border-strong,rgba(255,255,255,.1)); border-radius:16px; padding:6px;
      box-shadow:0 16px 40px -10px rgba(0,0,0,.55); animation:tcmPopIn .16s ease-out;
    }
    @keyframes tcmPopIn{ from{ opacity:0; transform:scale(.94) translateY(-4px); } to{ opacity:1; transform:scale(1) translateY(0); } }
    #tcm-sheet .tcm-title{ font-size:12px; font-weight:600; color:var(--text-faint,#9aa); padding:8px 34px 6px 10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    #tcm-close{ position:absolute; top:6px; right:6px; width:26px; height:26px; border-radius:50%; background:none; border:none; color:var(--text-faint,#9aa); display:flex; align-items:center; justify-content:center; cursor:pointer; }
    #tcm-close svg{ width:15px; height:15px; }
    #tcm-close:hover{ background:rgba(255,255,255,.08); color:#fff; }
    #tcm-sheet button{ width:100%; text-align:left; padding:10px; min-height:40px; border-radius:10px; background:none; border:none; color:var(--text,#fff); font-size:13.5px; display:flex; align-items:center; gap:10px; cursor:pointer; }
    #tcm-sheet button:hover, #tcm-sheet button:active{ background:rgba(255,255,255,.06); }
    #tcm-sheet button.danger{ color:var(--rose-braise,#C9667A); border-top:1px solid var(--border,rgba(255,255,255,.08)); margin-top:4px; padding-top:12px; }
    @media(max-width:520px){
      /* Sur petit écran tactile, reste un popover léger — mais collé au bord le plus proche
         plutôt qu'ancré pile sous un bouton parfois trop près du bord de l'écran. */
      #tcm-sheet{ width:min(260px, calc(100vw - 24px)); }
    }
  `;
  document.head.appendChild(style);
}
function closeTrackCardMenu(){
  const overlay = document.getElementById('tcm-overlay');
  const sheet = document.getElementById('tcm-sheet');
  if(overlay) overlay.remove();
  if(sheet) sheet.remove();
  document.removeEventListener('click', outsideClickCloseTcm);
}
function openTrackCardMenu(tr, anchorEl){
  ensureTrackCardMenuStyles();
  closeTrackCardMenu();
  const isLiked = favoritesPlaylist.some(f=> f.t === tr.t);
  // Seul le vrai propriétaire du morceau (artiste connecté = artiste du morceau) voit
  // l'option supprimer — jamais visible pour qui que ce soit d'autre, même sur son propre
  // profil public visité par un tiers.
  const isOwner = !!(tr.realId && currentUser && currentUser.account_type === 'artist' && currentUser.id === tr.artistId);
  const sheet = document.createElement('div');
  sheet.id = 'tcm-sheet';
  sheet.innerHTML = `
    <button id="tcm-close" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    <div class="tcm-title">${esc(tr.t)} — ${esc(tr.a)}</div>
    <button id="tcm-queue"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> <span>Ajouter à la file d'attente</span></button>
    <button id="tcm-fav" class="${isLiked ? 'liked' : ''}">${isLiked ? '<svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg> <span>Retirer des favoris</span>' : '<svg class="nuni-ic filled nuni-ic-err" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg> <span>Ajouter aux favoris</span>'}</button>
    <button id="tcm-addlist"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="14" height="14" rx="2"/><path d="M17 9v5M14.5 11.5h5"/></svg> <span>Ajouter à une playlist</span></button>
    <button id="tcm-artist"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg> <span>Voir l'artiste</span></button>
    ${isOwner ? `<button id="tcm-delete" class="danger"><svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7"/></svg> <span>Supprimer ce morceau</span></button>` : ''}
  `;
  document.body.appendChild(sheet);
  // Ancrage près du bouton cliqué (petit popover), avec repli intelligent pour ne jamais
  // déborder de l'écran — sinon centré en bas comme avant si aucun bouton n'est fourni.
  if(anchorEl){
    const rect = anchorEl.getBoundingClientRect();
    const sw = sheet.offsetWidth, sh = sheet.offsetHeight;
    let left = rect.right - sw;
    let top = rect.bottom + 6;
    if(left < 10) left = 10;
    if(left + sw > window.innerWidth - 10) left = window.innerWidth - sw - 10;
    if(top + sh > window.innerHeight - 10) top = rect.top - sh - 6; // pas assez de place en dessous : ouvre vers le haut
    sheet.style.left = left + 'px';
    sheet.style.top = top + 'px';
  } else {
    sheet.style.left = '50%';
    sheet.style.bottom = 'calc(20px + env(safe-area-inset-bottom,0))';
    sheet.style.transform = 'translateX(-50%)';
  }
  // Avant : une couche invisible plein écran captait le clic pour fermer le menu au clic
  // extérieur — mais elle bloquait aussi le clic vers un AUTRE bouton ⋮ juste en dessous
  // (le clic touchait la couche, jamais le vrai bouton), obligeant à cliquer deux fois pour
  // changer de morceau. Plus fiable : un vrai gestionnaire "clic à l'extérieur du menu",
  // qui laisse les autres boutons parfaitement cliquables normalement.
  // Se ferme aussi automatiquement au scroll, pour ne jamais rester détaché du bouton.
  setTimeout(()=>{
    document.addEventListener('click', outsideClickCloseTcm);
    window.addEventListener('scroll', closeTrackCardMenu, { capture:true, once:true, passive:true });
  }, 0);

  document.getElementById('tcm-close').onclick = closeTrackCardMenu;
  document.getElementById('tcm-queue').onclick = ()=>{ addToQueue(tr); closeTrackCardMenu(); };
  document.getElementById('tcm-fav').onclick = (e)=>{ toggleLike(e.currentTarget, tr); closeTrackCardMenu(); };
  document.getElementById('tcm-addlist').onclick = ()=>{ closeTrackCardMenu(); openAddToPlaylistPicker(tr); };
  document.getElementById('tcm-artist').onclick = ()=>{ openArtistPage(tr.a, tr.artistId); closeTrackCardMenu(); };
  const deleteBtn = document.getElementById('tcm-delete');
  if(deleteBtn) deleteBtn.onclick = ()=>{ closeTrackCardMenu(); confirmDeleteTrack(tr); };
}
function outsideClickCloseTcm(e){
  const sheet = document.getElementById('tcm-sheet');
  if(!sheet) return;
  if(sheet.contains(e.target)) return; // clic à l'intérieur du menu : rien à faire ici
  closeTrackCardMenu(); // clic ailleurs, y compris sur un autre bouton ⋮ — celui-ci ouvrira son propre menu juste après, normalement
}
// Vraie suppression côté serveur (avec confirmation) — jamais accessible depuis le menu
// pour qui que ce soit d'autre que le propriétaire réel du morceau (voir isOwner plus haut).
async function confirmDeleteTrack(tr){
  if(!confirm(`Supprimer définitivement "${tr.t}" ? Cette action est irréversible.`)) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/tracks/' + tr.realId, {
      method:'DELETE', headers:{ 'Authorization':'Bearer ' + realAuthToken }
    });
    const data = await res.json();
    if(!res.ok){ toast('❌ ' + (data.error || 'Suppression impossible.')); return; }
    toast('Morceau supprimé.');
    if(currentArtistPageRealId) openArtistPage(currentUser.artist_name, currentUser.id);
  }catch(e){ toast("Impossible de contacter le serveur NUNI."); }
}
function dedupeAlbums(list){
  const seen = new Map(); // clé album → morceau actuellement retenu pour la représenter
  const order = [];
  list.forEach(tr=>{
    if(tr.releaseType && tr.releaseType !== 'Single'){
      const key = tr.a + '::' + tr.album;
      const current = seen.get(key);
      if(!current){
        seen.set(key, tr);
        order.push(key);
      } else if(!current.cover && tr.cover){
        // Le morceau déjà retenu n'a pas de vraie pochette, mais celui-ci en a une —
        // avant : le tout premier morceau rencontré représentait l'album même sans
        // couverture, ce qui affichait un aplat de couleur générique au lieu de la vraie
        // pochette dès qu'un autre morceau du même album en avait bien une.
        seen.set(key, tr);
      }
    } else {
      seen.set('single::' + tr.t + '::' + tr.a, tr);
      order.push('single::' + tr.t + '::' + tr.a);
    }
  });
  return order.map(key => seen.get(key));
}
/* ---------- Page artiste — "Dernière version" en vedette (façon Apple Music) ----------
   Repère la sortie la plus récente (album ou single) parmi les vrais morceaux de l'artiste,
   et l'affiche dans une grande carte plutôt que noyée dans la grille de discographie. */
function renderArtistLatestRelease(artistTracks){
  const section = document.getElementById('artist-latest-release-section');
  const box = document.getElementById('artist-latest-release-card');
  if(!section || !box) return;
  const deduped = dedupeAlbums([...artistTracks].sort((a,b)=> (b.releaseTs||0) - (a.releaseTs||0)));
  const latest = deduped[0];
  if(!latest){ section.style.display = 'none'; return; }
  const albumTrackCount = latest.releaseType && latest.releaseType !== 'Single'
    ? artistTracks.filter(t=> t.a === latest.a && t.album === latest.album).length
    : 1;
  const coverStyle = latest.cover ? `background-image:url(${latest.cover});` : '';
  box.innerHTML = `
    <div class="artist-latest-card">
      <div class="artist-latest-cover ${latest.cover ? '' : (latest.p||'')}" style="${coverStyle}">
        <div class="play-ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
      </div>
      <div class="artist-latest-info">
        <div class="date">${latest.release}</div>
        <div class="title">${latest.releaseType && latest.releaseType !== 'Single' ? latest.album : latest.t}</div>
        <div class="meta">${latest.releaseType || 'Single'}${albumTrackCount>1 ? ' · ' + albumTrackCount + ' chansons' : ''}</div>
      </div>
    </div>`;
  box.querySelector('.artist-latest-card').onclick = ()=>{
    if(latest.releaseType && latest.releaseType !== 'Single') openAlbumView(latest);
    else { playTrack(latest); openFullPlayer(); }
  };
  section.style.display = 'block';
}

/* ---------- Page artiste — "Meilleurs titres" en liste compacte (façon Apple Music) ----------
   Contrairement à la Discographie (une carte par ALBUM), cette liste montre les morceaux
   individuels les plus streamés, tous types confondus — une autre façon de parcourir les
   mêmes vraies données, pas un doublon inventé. */
function renderArtistTopTracksList(artistTracks){
  const section = document.getElementById('artist-top-tracks-section');
  const box = document.getElementById('artist-top-tracks-list');
  if(!section || !box) return;
  if(!artistTracks.length){ section.style.display = 'none'; return; }
  const top = [...artistTracks].sort((a,b)=> parseStreamsCount(b.streams) - parseStreamsCount(a.streams)).slice(0, 6);
  box.innerHTML = top.map((t,i)=>{
    const coverStyle = t.cover ? `background-image:url(${t.cover});` : '';
    return `
    <div class="artist-top-tracks-row" data-idx="${i}">
      <div class="rank">${i+1}</div>
      <div class="thumb ${t.cover ? '' : (t.p||'')}" style="${coverStyle}"></div>
      <div class="info">
        <div class="t">${t.t}${t.releaseType && t.releaseType !== 'Single' ? '' : ''}</div>
        <div class="s">${t.album && t.album !== t.t ? t.album + ' · ' : ''}${t.year||''}</div>
      </div>
      <div class="plays">${t.streams} écoutes</div>
      <button class="btn-icon row-menu-btn" aria-label="Options" onclick="event.stopPropagation(); openTrackCardMenu(window.__artistTopTracksCache[${i}], this);"><svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button>
    </div>`;
  }).join('');
  box.querySelectorAll('.artist-top-tracks-row').forEach(row=>{
    row.onclick = (e)=>{
      if(e.target.closest('.row-menu-btn')) return;
      playTrack(top[Number(row.dataset.idx)]); openFullPlayer();
    };
  });
  window.__artistTopTracksCache = top; // référencé par les onclick des boutons ⋮ ci-dessus
  section.style.display = 'block';
}

function fillShelf(id, list){
  const row = document.getElementById(id);
  // Avant : une seule carte malformée (donnée inattendue) faisait planter tout le forEach —
  // silencieusement avalé par le catch() englobant de loadRealTracks(), ce qui coupait aussi
  // net tous les rendus suivants dans la même chaîne (Top Congo, tendance régionale,
  // Découvertes...). Chaque carte est maintenant isolée : une erreur sur l'une n'empêche
  // jamais les autres de s'afficher.
  dedupeAlbums(list).forEach((tr,i) => {
    try{
      const card = trackCard(tr);
      card.style.animationDelay = (i*0.06) + 's';
      card.classList.add('reveal-in');
      row.appendChild(card);
    }catch(e){ console.error('[fillShelf] carte ignorée après erreur :', e); }
  });
}
// ---------- Nouveautés — composition éditoriale asymétrique (une grande pochette + deux
// plus petites), plutôt qu'une rangée uniforme de cartes identiques. Sur les vraies sorties
// récentes uniquement (mêmes données que fillShelf, juste une mise en page différente). ----------
function fillNouveautesAsymmetric(id, list){
  const row = document.getElementById(id);
  if(!row) return;
  row.innerHTML = '';
  row.classList.add('release-grid');
  const items = dedupeAlbums(list).slice(0, 3);
  items.forEach((tr,i) => {
    try{
      const el = document.createElement('article');
      el.className = 'release-card' + (i===0 ? ' is-lead' : '');
      const coverInner = tr.cover ? '' : `<div class="cover-glyph pal-pattern"></div>`;
      el.innerHTML = `
        <div class="release-card-art ${tr.cover ? '' : (tr.p||'pal-1')}">${coverInner}</div>
        <div class="release-card-info">
          <span class="release-card-tag"></span>
          <h3 class="release-card-title"></h3>
          <p class="release-card-artist"></p>
        </div>`;
      el.querySelector('.release-card-tag').textContent = tr.releaseType || 'Single';
      el.querySelector('.release-card-title').textContent = tr.t;
      el.querySelector('.release-card-artist').textContent = tr.a;
      if(tr.cover){
        const artEl = el.querySelector('.release-card-art');
        const probe = new Image();
        probe.onload = ()=>{ artEl.style.backgroundImage = `url("${tr.cover}")`; artEl.style.backgroundSize = 'cover'; artEl.style.backgroundPosition = 'center'; };
        probe.onerror = ()=>{ artEl.classList.add(tr.p||'pal-1'); artEl.innerHTML = '<div class="cover-glyph pal-pattern"></div>'; };
        probe.src = tr.cover;
      }
      el.addEventListener('click', ()=> handleTrackCardClick(tr));
      row.appendChild(el);
    }catch(e){ console.error('[fillNouveautesAsymmetric] carte ignorée après erreur :', e); }
  });
}
function parseStreamsCount(v){
  if(typeof v === 'number') return v;
  const s = String(v||'0').trim().toUpperCase();
  if(s.endsWith('K')) return Math.round(parseFloat(s) * 1000);
  if(s.endsWith('M')) return Math.round(parseFloat(s) * 1000000);
  return parseInt(s.replace(/[^\d]/g,''), 10) || 0;
}
// "Top Congo" — avant : [...tracks].reverse().slice(0,5), qui ne trie par AUCUN critère réel
// (juste l'ordre inverse du tableau), et mélangeait des morceaux de démo aux streams
// inventés (ex: "264 K") avec les vrais morceaux (streams réels, souvent à 0 pour l'instant).
// Ici : uniquement les VRAIS morceaux, triés par leur vrai nombre de streams, décroissant.
function getTopStreamedTracks(n){
  return tracks
    .filter(t=> t.isReal)
    .slice()
    .sort((a,b)=> parseStreamsCount(b.streams) - parseStreamsCount(a.streams))
    .slice(0, n);
}
// ---------- Écoute automatique au survol — desktop uniquement (le survol n'existe pas
// au doigt), et jamais si ce morceau précis est déjà la vraie lecture en cours (on ne veut
// jamais deux sons superposés). Un seul aperçu à la fois : en survoler un nouveau coupe
// net l'aperçu précédent. Volume réduit et coupure automatique après 20s — un aperçu,
// jamais un moyen d'écouter le morceau entier gratuitement en survolant.
const HOVER_PREVIEW_SUPPORTED = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
let hoverPreviewAudio = null, hoverPreviewTimer = null, hoverPreviewCard = null, hoverPreviewDelay = null;
function stopHoverPreview(){
  if(hoverPreviewDelay){ clearTimeout(hoverPreviewDelay); hoverPreviewDelay = null; }
  if(hoverPreviewTimer){ clearTimeout(hoverPreviewTimer); hoverPreviewTimer = null; }
  if(hoverPreviewAudio){ hoverPreviewAudio.pause(); }
  if(hoverPreviewCard){ hoverPreviewCard.classList.remove('is-preview-playing'); hoverPreviewCard = null; }
}
function wireHoverPreview(card, tr){
  if(!HOVER_PREVIEW_SUPPORTED || !tr.isReal || !tr.audioUrl) return;
  card.addEventListener('mouseenter', ()=>{
    // Léger délai avant de démarrer — évite de charger/jouer un extrait à chaque survol
    // rapide en balayant la rangée du regard (même principe que Spotify).
    hoverPreviewDelay = setTimeout(()=>{
      stopHoverPreview();
      // Jamais de double son si ce morceau précis est déjà la vraie lecture en cours.
      if(currentTrack && trackKeyOf(currentTrack) === trackKeyOf(tr) && playing) return;
      if(!hoverPreviewAudio){
        hoverPreviewAudio = document.createElement('audio');
        hoverPreviewAudio.preload = 'none';
        hoverPreviewAudio.volume = 0.55;
      }
      hoverPreviewAudio.src = tr.audioUrl;
      hoverPreviewAudio.currentTime = 0;
      hoverPreviewAudio.play().then(()=>{
        card.classList.add('is-preview-playing');
        hoverPreviewCard = card;
        hoverPreviewTimer = setTimeout(stopHoverPreview, 20000); // 20s d'extrait max
      }).catch(()=>{ /* autoplay refusé par le navigateur — silencieux, jamais d'erreur visible */ });
    }, 350);
  });
  card.addEventListener('mouseleave', stopHoverPreview);
}
// ---------- Parallax léger au scroll — accueil connecté (effet "antigravité") ----------
// Le fond bouge un peu plus lentement que le contenu au défilement (voir --parallax-y en
// CSS), donnant une impression de profondeur. Throttle via requestAnimationFrame pour
// rester fluide, et désactivé si la personne a demandé moins d'animations.
(function initHomeParallax(){
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduceMotion) return;
  let ticking = false;
  window.addEventListener('scroll', ()=>{
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{
      const view = document.getElementById('view-catalog');
      // FIX : avant, --parallax-y valait window.scrollY sans aucune limite — sur une longue
      // page, un élément proche du bas (comme la carte NUNI Talent) subissait un décalage
      // visuel énorme (150px+ à x0.06) une fois beaucoup scrollé, glissant dans le contenu
      // en dessous (le pied de page). Plafonné à 400px : garde l'effet de profondeur subtil
      // voulu pour les tout premiers pixels de scroll, sans jamais casser la mise en page
      // plus bas dans la page.
      if(view && view.style.display !== 'none') view.style.setProperty('--parallax-y', Math.min(window.scrollY, 400) + 'px');
      ticking = false;
    });
  }, { passive:true });
})();

// ---------- Scroll intelligent — mini-lecteur + navigation qui s'effacent/reviennent
// avec le sens du scroll (signature NUNI) ----------
// Composant global réutilisable : on lui donne une liste d'ids, il se charge de leur
// ajouter/retirer la classe .hide-for-scroll (translateY + opacity en CSS, jamais
// display/height — pas de reflow) selon le sens réel du scroll. Un seuil minimum évite un
// tremblement sur de tout petits mouvements, et rien ne se réaffiche automatiquement après
// un délai : l'état reste figé tant que la personne ne remonte pas vraiment. Respecte
// prefers-reduced-motion (le CSS neutralise alors la classe, voir style.css).
function attachScrollHideReveal(elementIds, opts){
  opts = opts || {};
  const threshold = opts.threshold != null ? opts.threshold : 8; // px avant de considérer que ça a vraiment bougé
  const minY = opts.minY != null ? opts.minY : 40; // ne jamais cacher tant qu'on est encore près du haut de la page
  let lastY = window.scrollY;
  let hidden = false;
  let ticking = false;
  window.addEventListener('scroll', ()=>{
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{
      const y = window.scrollY;
      const delta = y - lastY;
      if(Math.abs(delta) > threshold){
        const shouldHide = delta > 0 && y > minY; // vers le bas ET assez loin du haut
        if(shouldHide !== hidden){
          hidden = shouldHide;
          elementIds.forEach(id=>{
            const el = document.getElementById(id);
            if(el) el.classList.toggle('hide-for-scroll', hidden);
          });
        }
        lastY = y;
      }
      ticking = false;
    });
  }, { passive:true });
}
attachScrollHideReveal(['player-bar', 'mobile-tabbar']);

function renderTopCongo(){
  const row = document.getElementById('shelf-top');
  if(!row) return;
  row.innerHTML = '';
  row.classList.remove('rank-list');
  row.classList.add('chart-flex');
  const top = getTopStreamedTracks(10);
  if(!top.length){
    row.innerHTML = `<p style="font-size:12.5px; color:var(--text-faint);">Pas encore assez d'écoutes réelles pour établir un classement — revenez bientôt !</p>`;
    return;
  }
  const setCover = (el, tr)=>{
    if(tr.cover){
      const probe = new Image();
      probe.onload = ()=>{ el.style.backgroundImage = `url("${tr.cover}")`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; };
      probe.onerror = ()=>{ el.classList.add(tr.p||'pal-1'); el.innerHTML = '<div class="cover-glyph pal-pattern"></div>'; };
      probe.src = tr.cover;
    } else {
      el.classList.add(tr.p||'pal-1');
      el.innerHTML = '<div class="cover-glyph pal-pattern"></div>';
    }
  };

  // #1 — grande pochette, point focal du classement (comme sur les plateformes musicales
  // premium : le morceau le plus écouté doit se voir immédiatement, pas être noyé dans une
  // liste uniforme).
  try{
    const leader = top[0];
    const leaderEl = document.createElement('div');
    leaderEl.className = 'chart-leader';
    leaderEl.innerHTML = `
      <div class="chart-leader-cover"><span class="chart-leader-rank">01</span></div>
      <h3></h3><p></p>`;
    leaderEl.querySelector('h3').textContent = leader.t;
    leaderEl.querySelector('p').textContent = leader.a;
    setCover(leaderEl.querySelector('.chart-leader-cover'), leader);
    leaderEl.addEventListener('click', ()=> handleTrackCardClick(leader));
    row.appendChild(leaderEl);
  }catch(e){ console.error('[renderTopCongo] leader ignoré après erreur :', e); }

  // 02 à 10 — rail de mini-pochettes classées, chacune protégée individuellement.
  const railEl = document.createElement('div');
  railEl.className = 'chart-rail';
  top.slice(1).forEach((tr, i)=>{
    try{
      const el = document.createElement('article');
      el.className = 'chart-mini';
      el.innerHTML = `
        <div class="chart-mini-cover"><span class="chart-mini-rank">${String(i+2).padStart(2,'0')}</span></div>
        <div class="chart-mini-title"></div><div class="chart-mini-artist"></div>`;
      el.querySelector('.chart-mini-title').textContent = tr.t;
      el.querySelector('.chart-mini-artist').textContent = tr.a;
      setCover(el.querySelector('.chart-mini-cover'), tr);
      el.addEventListener('click', ()=> handleTrackCardClick(tr));
      railEl.appendChild(el);
    }catch(e){ console.error('[renderTopCongo] entrée ignorée après erreur :', e); }
  });
  row.appendChild(railEl);
}
fillNouveautesAsymmetric('shelf-new', tracks.filter(t=>t.isReal).slice(0,3));
renderTopCongo();
fillShelf('shelf-artist', tracks.filter(t=>t.a==='Bibi Mwana').concat(tracks.slice(0,4)));
fillShelf('shelf-artist-trending', [...tracks.filter(t=>t.a==='Bibi Mwana')].sort((a,b)=> b.likes - a.likes));
fillShelf('shelf-artist-albums', tracks.filter(t=>t.a==='Bibi Mwana'));

/* ============ VRAIS MORCEAUX PUBLIÉS (serveur NUNI) ============ */
function refreshMainShelves(){
  // FIX : chaque section est maintenant isolée dans son propre bloc — avant, si l'une
  // d'entre elles levait une erreur inattendue, TOUTES les suivantes dans cette liste
  // n'étaient jamais exécutées (une seule exception coupait net toute la chaîne).
  const row = document.getElementById('shelf-new');
  if(row) row.innerHTML = '';
  try{ fillNouveautesAsymmetric('shelf-new', tracks.filter(t=>t.isReal).slice(0,3)); }catch(e){ console.error('[refreshMainShelves] shelf-new:', e); }
  // Filet de sécurité final : si malgré tout ça la section reste visuellement vide alors que
  // de vrais morceaux existent bien en mémoire, on retente une fois après un court délai —
  // couvre le cas où le DOM n'était pas encore tout à fait prêt au moment du tout premier essai.
  setTimeout(()=>{
    const rowNow = document.getElementById('shelf-new');
    const realCount = tracks.filter(t=>t.isReal).length;
    if(rowNow && rowNow.children.length === 0 && realCount > 0){
      try{ fillNouveautesAsymmetric('shelf-new', tracks.filter(t=>t.isReal).slice(0,3)); }catch(e){ console.error('[refreshMainShelves] shelf-new (retry):', e); }
    }
  }, 400);
  try{ renderTopCongo(); }catch(e){ console.error('[refreshMainShelves] renderTopCongo:', e); }
  try{ renderTrendingRegion(); }catch(e){ console.error('[refreshMainShelves] renderTrendingRegion:', e); }
  try{ renderForYouShelf(); }catch(e){ console.error('[refreshMainShelves] renderForYouShelf:', e); }
  try{ renderContinueListening(); }catch(e){ console.error('[refreshMainShelves] renderContinueListening:', e); }
  try{ renderResumeListening(); }catch(e){ console.error('[refreshMainShelves] renderResumeListening:', e); }
  try{ renderNuniSelection(); }catch(e){ console.error('[refreshMainShelves] renderNuniSelection:', e); }
  initShelfScrollReveal();
  setTimeout(initShelfScrollReveal, 800); // couvre les sections qui se remplissent de façon asynchrone, un peu après
}
// ---------- Apparition des sections au défilement — chaque bloc .shelf de l'accueil entre
// en douceur (fondu + léger déplacement) quand il devient visible, plutôt que d'apparaître
// brutalement. Idempotent : peut être rappelée sans risque, ignore les sections déjà
// observées (data-reveal-bound), donc sûr à appeler plusieurs fois pendant le chargement.
let shelfRevealObserver = null;
function initShelfScrollReveal(){
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduceMotion) return; // respecte le réglage système, pas d'animation forcée
  if(!shelfRevealObserver){
    shelfRevealObserver = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          shelfRevealObserver.unobserve(entry.target); // une seule apparition, jamais répétée en re-scrollant
        }
      });
    }, { threshold:0.12, rootMargin:'0px 0px -40px 0px' });
  }
  document.querySelectorAll('#view-catalog .shelf:not([data-reveal-bound])').forEach(el=>{
    el.dataset.revealBound = '1';
    el.classList.add('scroll-reveal');
    shelfRevealObserver.observe(el);
  });
}
// ---------- "Tendance dans votre région" — vraies écoutes de vrais auditeurs du même pays
// que la personne connectée (voir /api/tracks/trending-region côté serveur). Jamais affichée
// s'il n'existe pas encore de vraies données pour ce pays — pas de contenu générique ou
// dupliqué du Top Congo pour remplir l'espace. Prépare l'arrivée de futurs auditeurs hors
// Congo : chacun verra sa propre tendance réelle, pas un contenu identique pour tout le monde.
async function renderTrendingRegion(){
  const wrap = document.getElementById('shelf-trending-region-wrap');
  const row = document.getElementById('shelf-trending-region');
  if(!wrap || !row) return;
  if(!currentUser || !currentUser.country){ wrap.style.display = 'none'; return; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/tracks/trending-region?country=' + encodeURIComponent(currentUser.country), {
      headers: realAuthToken ? { 'Authorization': 'Bearer ' + realAuthToken } : {},
    });
    if(!res.ok){ wrap.style.display = 'none'; return; }
    const data = await res.json();
    if(!data.tracks || !data.tracks.length){ wrap.style.display = 'none'; return; }
    // Ne montre jamais un doublon strict du Top Congo : si le pays du visiteur est "Congo"
    // et que le classement régional est identique au Top Congo global (cas fréquent tant
    // que la quasi-totalité des auditeurs sont congolais), inutile d'afficher deux fois la
    // même chose — cette section ne prend tout son sens qu'une fois de vrais auditeurs
    // d'autres pays présents.
    const mapped = data.tracks.map(mapPlaylistTrack).map((tr,i)=>{ tr.realId = data.tracks[i].id; return tr; });
    const topIds = new Set(getTopStreamedTracks(12).map(t=>t.realId));
    const isDuplicateOfTopCongo = mapped.every(tr => topIds.has(tr.realId));
    if(isDuplicateOfTopCongo){ wrap.style.display = 'none'; return; }
    document.getElementById('shelf-trending-region-title').textContent = `Tendance en ce moment — ${esc(currentUser.country)}`;
    wrap.style.display = 'block';
    row.innerHTML = '';
    fillShelf('shelf-trending-region', mapped);
  }catch(e){ wrap.style.display = 'none'; }
}
// ---------- "Reprendre l'écoute" — vraie position de lecture sauvegardée côté serveur.
// La progression affichée vient de la vraie durée du fichier (chargée via les métadonnées
// audio, jamais une estimation) — si elle n'a pas encore fini de charger, la carte
// s'affiche quand même, juste sans barre de progression tant que la vraie durée est inconnue.
async function renderResumeListening(){
  const wrap = document.getElementById('shelf-resume-wrap');
  const row = document.getElementById('resume-row');
  if(!wrap || !row) return;
  if(!realAuthToken){ wrap.style.display = 'none'; return; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/resume', { headers:{ 'Authorization':'Bearer '+realAuthToken } });
    if(!res.ok){ wrap.style.display = 'none'; return; }
    const data = await res.json();
    const resumes = (data.resumes || [])
      .map(r => ({ tr: tracks.find(t => t.isReal && t.realId === r.track_id), positionSeconds: r.position_seconds }))
      .filter(x => x.tr);
    if(!resumes.length){ wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    row.innerHTML = '';
    resumes.forEach(({ tr, positionSeconds })=>{
      const card = document.createElement('div');
      card.className = 'resume-card';
      const coverStyle = tr.cover ? `background-image:url(${tr.cover});` : '';
      card.innerHTML = `
        <div class="resume-cover ${tr.cover ? '' : (tr.p||'')}" style="${coverStyle}"></div>
        <div class="resume-info">
          <div class="t">${esc(tr.t)}</div>
          <div class="a">${esc(tr.a)}</div>
          <div class="resume-progress-track"><div class="resume-progress-fill"></div></div>
        </div>
        <button class="resume-play-btn" aria-label="Reprendre"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>`;
      card.querySelector('.resume-play-btn').onclick = (e)=>{ e.stopPropagation(); resumeTrackAt(tr, positionSeconds); };
      card.onclick = ()=> resumeTrackAt(tr, positionSeconds);
      row.appendChild(card);
      // Vraie durée uniquement — chargée à la volée pour ce morceau précis, sans jouer le
      // son (preload='metadata' ne télécharge que l'en-tête du fichier, pas l'audio entier).
      if(tr.audioUrl){
        const probe = new Audio();
        probe.preload = 'metadata';
        probe.src = tr.audioUrl;
        probe.addEventListener('loadedmetadata', ()=>{
          if(isFinite(probe.duration) && probe.duration > 0){
            const pct = Math.min(100, (positionSeconds / probe.duration) * 100);
            const fill = card.querySelector('.resume-progress-fill');
            if(fill) fill.style.width = pct + '%';
          }
        }, { once:true });
      }
    });
  }catch(e){ wrap.style.display = 'none'; }
}
// ---------- "Votre sélection NUNI" — grande carte éditoriale basée sur les vrais genres
// que ce compte écoute le plus (voir /api/me/selection). Reste masquée tant qu'il n'y a pas
// assez d'historique réel pour en tirer quoi que ce soit — jamais une sélection générique
// déguisée en "personnalisée".
let nuniSelectionTracks = [];
async function renderNuniSelection(){
  const hero = document.getElementById('nuni-selection-hero');
  if(!hero) return;
  if(!realAuthToken){ hero.style.display = 'none'; return; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/selection', { headers:{ 'Authorization':'Bearer '+realAuthToken } });
    if(!res.ok){ hero.style.display = 'none'; return; }
    const data = await res.json();
    const mapped = (data.tracks || [])
      .map(r => tracks.find(t => t.isReal && t.realId === r.id))
      .filter(Boolean);
    if(!mapped.length){ hero.style.display = 'none'; return; }
    nuniSelectionTracks = mapped;
    const genreLabel = (data.genres || []).join(', ');
    const first = mapped[0];
    hero.className = 'premium-hero';
    hero.style.display = 'flex';
    hero.style.backgroundImage = first.cover ? `url('${first.cover}')` : '';
    hero.innerHTML = `
      <div class="premium-hero-overlay"></div>
      <div class="premium-hero-content">
        <span class="premium-hero-badge"><svg class="nuni-ic filled nuni-ic-gold" viewBox="0 0 24 24"><path d="M12 2 9 9l-7 1 5 5-1.5 7L12 18l6.5 4L17 15l5-5-7-1z"/></svg> POUR VOUS</span>
        <h2 class="premium-hero-title">Votre sélection NUNI</h2>
        <p class="premium-hero-sub">Basée sur ce que vous écoutez vraiment — ${genreLabel}.</p>
        <div class="premium-hero-actions">
          <button class="btn btn-primary" id="nuni-selection-play-btn"><svg class="nuni-ic filled" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M8 5v14l11-7z"/></svg> Écouter la sélection</button>
          <button class="btn btn-ghost" id="nuni-selection-seeall-btn">Tout voir</button>
        </div>
      </div>`;
    document.getElementById('nuni-selection-play-btn').onclick = ()=>{ playTrack(first); openFullPlayer(); };
    document.getElementById('nuni-selection-seeall-btn').onclick = ()=>{
      openCategoryPage('Votre sélection NUNI', `Basée sur ce que vous écoutez vraiment — ${genreLabel}.`, ()=> nuniSelectionTracks, false);
    };
  }catch(e){ hero.style.display = 'none'; }
}
// ---------- "Découvertes pour vous" — vraie personnalisation, basée sur les artistes que
// la personne suit réellement (table follows), jamais un algorithme inventé. Le bloc entier
// reste masqué (display:none, posé dans le HTML) tant qu'il n'y a rien de réel à montrer :
// visiteur non connecté, personne ne suit encore d'artiste, ou aucun morceau réel chez eux.
async function renderForYouShelf(){
  const wrap = document.getElementById('shelf-for-you-wrap');
  if(!wrap) return;
  if(!realAuthToken){ wrap.style.display = 'none'; return; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/following', { headers:{ 'Authorization':'Bearer '+realAuthToken } });
    if(!res.ok){ wrap.style.display = 'none'; return; }
    const data = await res.json();
    const followedIds = new Set((data.following||[]).map(a=>a.id));
    if(!followedIds.size){ wrap.style.display = 'none'; return; }
    const picks = tracks
      .filter(t=> t.isReal && followedIds.has(t.artistId))
      .sort((a,b)=> b.releaseTs - a.releaseTs)
      .slice(0, 10);
    if(!picks.length){ wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    const row = document.getElementById('shelf-for-you');
    row.innerHTML = '';
    picks.forEach(tr=>{ try{ row.appendChild(trackCard(tr)); }catch(e){ console.error('[renderForYouShelf] carte ignorée:', e); } });
  }catch(e){ wrap.style.display = 'none'; }
}
/* ============ RESYNCHRONISATION DES LIKES APRÈS CONNEXION ============
   Avant : les cœurs (Favoris) vivaient uniquement dans un tableau en mémoire du navigateur,
   remis à zéro à chaque rechargement de page ou changement d'appareil. Maintenant : on va
   chercher la vraie liste des morceaux likés en base au moment de la connexion, et on la
   fusionne avec les morceaux déjà chargés — les cœurs reflètent enfin la vérité serveur,
   partout où vous vous connectez. */
async function syncLikedTracksFromServer(){
  if(!realAuthToken) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/liked-tracks', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    if(!res.ok) return;
    const data = await res.json();
    const likedIds = new Set(data.track_ids || []);
    // Vraie date de like par morceau (liked_at renvoyé par le serveur) — sert à trier
    // "Ajouts récents" dans la Bibliothèque par récence réelle, pas par ordre d'arrivée.
    const likedAtMap = new Map((data.likes || []).map(l => [l.track_id, new Date(l.liked_at).getTime()]));
    tracks.forEach(tr=>{
      if(tr.isReal && tr.realId && likedIds.has(tr.realId)){
        tr.likedAt = likedAtMap.get(tr.realId) || tr.likedAt || Date.now();
        if(!favoritesPlaylist.find(f=>f.t===tr.t)) favoritesPlaylist.unshift(tr);
      }
    });
    syncLikeButtons(currentTrack);
    renderLibraryRecentGrid(); // rafraîchit "Ajouts récents" si la Bibliothèque est déjà ouverte
  }catch(e){ /* pas grave si le serveur est momentanément indisponible */ }
}

async function loadArtistStats(){
  const elTotal = document.getElementById('dash-streams-total');
  const elTrend = document.getElementById('dash-streams-trend');
  const elGross = document.getElementById('dash-gross');
  const elPlatform = document.getElementById('dash-platform-share');
  const elArtist = document.getElementById('dash-artist-share');
  if(!elTotal) return;
  if(!realAuthToken){ elTotal.textContent = '—'; return; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/artist/stats', {
      headers:{ 'Authorization':'Bearer ' + realAuthToken }
    });
    if(!res.ok) return;
    const s = await res.json();
    const fmt = n => Number(n).toLocaleString('fr-FR');
    elTotal.textContent = fmt(s.total_streams);
    elTrend.textContent = `${fmt(s.streams_last_30_days)} sur les 30 derniers jours`;
    elGross.textContent = fmt(s.gross_fcfa) + ' FCFA';
    elPlatform.textContent = '−' + fmt(s.platform_share_fcfa) + ' FCFA';
    elArtist.textContent = fmt(s.artist_share_fcfa) + ' FCFA';
  }catch(e){ /* pas grave si le serveur est momentanément indisponible */ }
}
let loadRealTracksGen = 0;
async function loadRealTracks(attempt){
  attempt = attempt || 0;
  const myGen = attempt === 0 ? ++loadRealTracksGen : loadRealTracksGen; // une chaîne de tentatives garde le même "ticket" tout du long
  const maxAttempts = 5;
  const retryDelays = [3000, 6000, 10000, 15000]; // ~34s de marge au total, le temps qu'un serveur Render endormi se réveille
  try{
    // FIX CRITIQUE : avant, ce fetch n'envoyait jamais le jeton de connexion — cet endpoint
    // était historiquement public, donc jamais besoin d'authentification. Depuis que le
    // serveur ne renvoie le vrai lien audio qu'aux comptes réellement actifs (voir
    // hasStreamingAccess dans server.js), l'absence d'en-tête Authorization faisait passer
    // TOUT LE MONDE pour anonyme aux yeux du serveur — même un Pass payant et actif se
    // voyait donc refuser l'écoute, malgré un abonnement parfaitement valide.
    const res = await fetch(NUNI_API_BASE + '/api/tracks', {
      headers: realAuthToken ? { 'Authorization': 'Bearer ' + realAuthToken } : {},
    });
    if(!res.ok){
      if(attempt < maxAttempts - 1 && myGen === loadRealTracksGen){
        await new Promise(r=> setTimeout(r, retryDelays[attempt] || 15000));
        return loadRealTracks(attempt + 1);
      }
      return;
    }
    const data = await res.json();
    if(!data.tracks || !data.tracks.length){
      // RESTAURÉ : avant, une réponse vide arrêtait tout net — c'était justement le
      // symptôme visible (Nouveautés/Écoutés récemment/Top Congo vides) quand Render
      // répondait déjà mais avec un catalogue pas encore tout à fait prêt juste après un
      // redémarrage. On retente avec le même mécanisme que pour une requête qui échoue.
      if(attempt < maxAttempts - 1 && myGen === loadRealTracksGen){
        await new Promise(r=> setTimeout(r, retryDelays[attempt] || 15000));
        return loadRealTracks(attempt + 1);
      }
      return;
    }
    // FIX : avec les nombreux points d'appel ajoutés cette session (connexion, restauration
    // de session, validation de code, vérification email, surveillance en direct toutes les
    // 2 min), plusieurs CHAÎNES de tentatives peuvent désormais se chevaucher dans le temps.
    // Sans cette protection, une chaîne plus ANCIENNE qui finissait après une plus RÉCENTE
    // pouvait écraser son résultat déjà à jour — seule la toute dernière chaîne lancée a
    // maintenant le droit de mettre à jour l'affichage, les autres s'arrêtent proprement ici.
    if(myGen !== loadRealTracksGen) return;
    // retire les vrais morceaux déjà chargés avant de réinjecter (évite les doublons)
    for(let i = tracks.length - 1; i >= 0; i--){ if(tracks[i].isReal) tracks.splice(i, 1); }
    const mapped = data.tracks.map(r => ({
      t: r.title, a: r.artist_name || 'Artiste NUNI', p: 'pal-1',
      album: r.album || r.title, genre: r.genre || 'Afro',
      year: new Date(r.created_at).getFullYear(),
      streams: String(r.streams || 0),
      release: (r.release_date ? new Date(r.release_date) : new Date(r.created_at)).toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'}),
      releaseTs: (r.release_date ? new Date(r.release_date) : new Date(r.created_at)).getTime(),
      verified: !!r.is_verified, likes: r.likes || 0,
      cover: r.cover_url || null, audioUrl: r.audio_url || null, isReal: true,
      releaseType: r.release_type || 'Single',
      artistId: r.artist_id, artistAvatarUrl: r.artist_avatar_url || null,
      lyrics: r.lyrics || null,
      composer: r.composer || null, featuring: r.featuring || null, studio: r.studio || null, description: r.description || null, credits: r.credits || null,
      realId: r.id,
    }));
    tracks.unshift(...mapped);
    refreshMainShelves();
    renderHomeHero();
    // Avant : si l'utilisateur cherchait pendant que le serveur se réveillait encore (plan
    // gratuit, jusqu'à 30 secondes), la recherche ne portait que sur les 10 morceaux de
    // démonstration fictifs — aucun vrai artiste ni morceau réel n'était encore chargé.
    // Ici : dès que les vraies données arrivent, on relance la recherche si un texte est
    // toujours dans le champ, pour que les vrais résultats apparaissent sans avoir à retaper.
    const searchViewInputEl = document.getElementById('asv-input');
    if(searchViewInputEl && searchViewInputEl.value.trim()) runSearchView(searchViewInputEl.value);
    // Le lecteur démarrait sur un morceau de démo sans vrai fichier audio (silence simulé si
    // on appuyait sur ▶ avant d'avoir cliqué un vrai morceau) — dès que de vrais morceaux sont
    // chargés, et si rien n'a encore été lancé, on bascule le lecteur sur le premier vrai son.
    if(!playing && !usingRealAudio && !currentTrack.isReal && mapped.length){
      currentTrack = mapped[0];
      updateMiniPlayerNowPlaying(currentTrack);
      applyCoverTo(document.getElementById('player-cover'), currentTrack);
      syncFullPlayer();
    }
    handleSharedTrackLink();
  }catch(e){
    if(attempt < maxAttempts - 1 && myGen === loadRealTracksGen){
      await new Promise(r=> setTimeout(r, retryDelays[attempt] || 15000));
      return loadRealTracks(attempt + 1);
    }
    /* pas grave si le serveur reste indisponible après tous les essais, le catalogue de démo reste affiché */
  }
}
// Avant : la bannière hero affichait toujours la même image statique (le logo NUNI en grand),
// jamais liée au vrai contenu de la plateforme. Ici : la vraie pochette + le vrai titre/artiste
// du morceau le plus streamé du moment — la musique devient la vedette, pas le logo. Repli
// silencieux sur l'image statique tant qu'aucun morceau réel n'a encore assez d'écoutes.
let heroRotateTimer = null, heroRotateIndex = 0, heroRotatePool = [];
/* ---------- "Afrique en direct" — vraies écoutes par pays/ville, plateforme entière ---------- */
/* ---------- "Afrique en direct" — drapeaux, régions et tendances réelles ---------- */
// Table de correspondance pays → code ISO (pour générer un vrai drapeau emoji, sans charger
// aucune image) — centrée sur les pays les plus probables pour l'audience de NUNI. Un pays
// non reconnu affiche simplement 🌍 plutôt qu'un drapeau incorrect.
const COUNTRY_ISO = {
  'congo':'CG','republique du congo':'CG','rdc':'CD','republique democratique du congo':'CD','rd congo':'CD',
  'gabon':'GA','cameroun':'CM','tchad':'TD','centrafrique':'CF','guinee equatoriale':'GQ',
  'senegal':'SN','cote d\'ivoire':'CI','ivoire':'CI','mali':'ML','burkina faso':'BF','guinee':'GN',
  'benin':'BJ','togo':'TG','niger':'NE','nigeria':'NG','ghana':'GH','sierra leone':'SL','liberia':'LR',
  'kenya':'KE','tanzanie':'TZ','ouganda':'UG','ethiopie':'ET','rwanda':'RW','burundi':'BI',
  'afrique du sud':'ZA','zimbabwe':'ZW','zambie':'ZM','namibie':'NA','angola':'AO','mozambique':'MZ',
  'maroc':'MA','algerie':'DZ','tunisie':'TN','egypte':'EG','libye':'LY',
  'france':'FR','belgique':'BE','allemagne':'DE','royaume-uni':'GB','angleterre':'GB','suisse':'CH',
  'italie':'IT','espagne':'ES','portugal':'PT','pays-bas':'NL','suede':'SE','norvege':'NO',
  'etats-unis':'US','usa':'US','canada':'CA','mexique':'MX','bresil':'BR',
  'jamaique':'JM','haiti':'HT','cuba':'CU',
  'chine':'CN','inde':'IN','japon':'JP','coree du sud':'KR','emirats arabes unis':'AE',
  'australie':'AU','nouvelle-zelande':'NZ',
};
function normalizeCountryKeyFront(name){
  return (name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}
function countryFlag(name){
  const iso = COUNTRY_ISO[normalizeCountryKeyFront(name)];
  if(!iso) return '🌍';
  return String.fromCodePoint(...[...iso].map(c=> 127397 + c.charCodeAt(0)));
}
// Format compact K/M façon "892K", "2.48M" — juste une présentation différente du même vrai
// nombre, jamais un chiffre recalculé ou arrondi de façon trompeuse.
function formatK(n){
  n = Number(n||0);
  if(n >= 1000000) return (n/1000000).toFixed(2).replace(/\.?0+$/,'') + 'M';
  if(n >= 1000) return (n/1000).toFixed(1).replace(/\.0$/,'') + 'K';
  return String(n);
}
let lastAfroliveData = null;
function renderAfroliveInto(prefix, data){
  const fmt = n => Number(n||0).toLocaleString('fr-FR');
  const regionsEl = document.getElementById(prefix + '-regions');
  const countriesEl = document.getElementById(prefix + '-countries');
  const citiesEl = document.getElementById(prefix + '-cities');
  // ---- Les badges de tendance (▲▼) ont été retirés de ces listes compactes : avec encore
  // très peu de vraies écoutes, un pourcentage donnait une impression de précision
  // statistique trompeuse (ex: -58% sur une poignée d'écoutes réelles). On garde uniquement
  // le vrai chiffre, honnête et lisible. La tendance globale reste visible sur la carte
  // "Écoutes totales" du globe, où le contexte (mois complet) la rend plus significative.
  if(regionsEl){
    regionsEl.innerHTML = data.topRegions.length
      ? data.topRegions.map(r=> `<div class="afrolive-row"><span class="ar-name"><svg class="nuni-ic" viewBox="0 0 24 24" style="width:13px;height:13px;vertical-align:-2px;margin-right:3px;"><path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>${r.region}</span><span class="plays">${fmt(r.plays)}</span></div>`).join('')
      : '<p style="font-size:12.5px; color:var(--text-faint);">Pas encore assez de données.</p>';
  }
  if(countriesEl){
    countriesEl.innerHTML = data.topCountries.length
      ? data.topCountries.map(c=> `<div class="afrolive-row" data-key="${c.country}"><span class="ar-name">${countryFlag(c.country)} ${c.country}</span><span class="plays">${fmt(c.plays)}</span></div>`).join('')
      : '<p style="font-size:12.5px; color:var(--text-faint);">Pas encore assez de données.</p>';
  }
  if(citiesEl){
    citiesEl.innerHTML = data.topCities.length
      ? data.topCities.map(c=> `<div class="afrolive-row" data-key="${c.city}"><span class="ar-name">${countryFlag(c.country)} ${c.city}</span><span class="plays">${fmt(c.plays)}</span></div>`).join('')
      : '<p style="font-size:12.5px; color:var(--text-faint);">Pas encore assez de données.</p>';
  }
  // ---- Carte "Écoutes totales" du globe — vrai total, vraie tendance mensuelle. ----
  const statBox = document.getElementById('globe3d-stat');
  if(statBox && data.totalTrend){
    document.getElementById('g3-stat-value').textContent = formatK(data.totalPlays);
    const t = data.totalTrend;
    const trendEl = document.getElementById('g3-stat-trend');
    trendEl.innerHTML = t.direction === 'new' ? '<span style="color:var(--or-2);">Nouveau ce mois-ci</span>'
      : t.direction === 'up' ? `<span style="color:#3BC26A;">▲ +${t.pct}% vs mois précédent</span>`
      : t.direction === 'down' ? `<span style="color:#E05252;">▼ ${t.pct}% vs mois précédent</span>`
      : '<span style="color:var(--text-faint);">➡ Stable vs mois précédent</span>';
    statBox.style.display = 'block';
  }
}
async function loadAfroliveStats(isRefresh){
  const section = document.getElementById('afrolive-section');
  if(!section) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/stats/geo');
    if(!res.ok) return;
    const data = await res.json();
    if(!data.topCountries.length && !data.topCities.length) return; // pas encore assez de vraies données, section masquée plutôt qu'un cadre vide
    const fmt = n => Number(n||0).toLocaleString('fr-FR');
    document.getElementById('afrolive-total-plays').textContent = fmt(data.totalPlays);
    document.getElementById('afrolive-total-countries').textContent = fmt(data.totalCountries);
    renderAfroliveInto('afrolive', data);
    // ---- Note d'honnêteté : ceci n'est PAS un vrai flux temps réel poussé par le serveur à
    // chaque écoute individuelle (ça demanderait une infrastructure WebSocket que NUNI n'a
    // pas). C'est un rafraîchissement périodique qui, lui, est bien réel — et une ligne dont
    // le chiffre a changé reçoit une impulsion lumineuse pour donner la sensation de vie.
    if(isRefresh && lastAfroliveData){
      document.querySelectorAll('#afrolive-countries .afrolive-row, #afrolive-cities .afrolive-row').forEach(row=>{
        const key = row.dataset.key;
        const before = lastAfroliveData.topCountries.find(c=>c.country===key) || lastAfroliveData.topCities.find(c=>c.city===key);
        const after = data.topCountries.find(c=>c.country===key) || data.topCities.find(c=>c.city===key);
        if(before && after && before.plays !== after.plays){
          row.classList.add('ar-pulse');
          setTimeout(()=> row.classList.remove('ar-pulse'), 1100);
        }
      });
    }
    lastAfroliveData = data;
    section.style.display = 'block';
  }catch(e){ /* pas grave si le serveur est momentanément indisponible — la section reste simplement masquée */ }
}
loadAfroliveStats();
setInterval(()=> loadAfroliveStats(true), 45000); // rafraîchissement réel toutes les 45s — pas un vrai push, mais un vrai recalcul à chaque fois

/* ============================================================
   RÉCAP PERSONNEL — "Ton mois en musique". Vrais artistes/morceaux
   classés par vrai nombre d'écoutes réelles ce mois-ci. Pas de
   minutes affichées : cette donnée n'existe pas dans NUNI aujourd'hui
   (ni les morceaux ni les écoutes n'ont de durée enregistrée) — plutôt
   qu'inventer un chiffre, on montre le vrai nombre d'écoutes.
============================================================ */
let recapData = null;
async function openRecapModal(){
  if(!realAuthToken){ toast('Connectez-vous pour voir votre récap personnel.'); return; }
  document.getElementById('recap-modal-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  document.getElementById('recap-headline').textContent = 'Chargement…';
  document.getElementById('recap-months').innerHTML = '';
  document.getElementById('recap-body').innerHTML = '';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/recap', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    recapData = await res.json();
    if(!recapData.months.length){
      document.getElementById('recap-headline').textContent = "Rien à montrer pour l'instant — écoutez quelques morceaux et revenez ici !";
      return;
    }
    renderRecapMonths();
    renderRecapBody(recapData.targetMonth);
  }catch(e){
    document.getElementById('recap-headline').textContent = 'Impossible de charger votre récap pour le moment.';
  }
}
function closeRecapModal(){
  document.getElementById('recap-modal-overlay').classList.remove('show');
  document.body.style.overflow = '';
}
function renderRecapMonths(){
  const wrap = document.getElementById('recap-months');
  const monthNames = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  wrap.innerHTML = recapData.months.slice().reverse().map(m=>{
    const d = new Date(m);
    const label = monthNames[d.getMonth()];
    const isActive = m === recapData.targetMonth;
    return `<button class="recap-month-btn${isActive?' is-active':''}" data-month="${m}">${label}</button>`;
  }).join('');
  wrap.querySelectorAll('.recap-month-btn').forEach(btn=>{
    btn.onclick = async ()=>{
      const month = btn.dataset.month;
      const res = await fetch(NUNI_API_BASE + '/api/me/recap?month=' + encodeURIComponent(month), { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
      recapData = await res.json();
      wrap.querySelectorAll('.recap-month-btn').forEach(b=> b.classList.toggle('is-active', b.dataset.month === month));
      renderRecapBody(month);
    };
  });
}
function renderRecapBody(month){
  const monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const d = new Date(month);
  const headline = document.getElementById('recap-headline');
  headline.innerHTML = `Vous avez écouté <b>${recapData.totalPlays}</b> fois de la musique en ${monthNames[d.getMonth()]}.`;
  const body = document.getElementById('recap-body');
  let html = '';
  if(recapData.topArtists.length){
    html += `<div class="recap-section-title"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M9 21h6M12 15v6"/></svg> Vos artistes du mois</div><div class="recap-artists-row">`;
    html += recapData.topArtists.map((a,i)=>{
      const photo = a.avatar_url ? `background-image:url(${a.avatar_url});` : '';
      return `<div class="recap-artist-card" style="${photo}" data-artist-id="${a.id}" data-artist-name="${(a.artist_name||'').replace(/"/g,'&quot;')}">
        <div class="recap-artist-scrim"></div>
        <div class="recap-artist-rank">${i+1}</div>
        <div class="recap-artist-info">
          <div class="recap-artist-name">${esc(a.artist_name||'')}</div>
          <div class="recap-artist-plays">${a.plays} écoute${a.plays>1?'s':''}</div>
        </div>
      </div>`;
    }).join('');
    html += `</div>`;
  }
  if(recapData.topTracks.length){
    html += `<div class="recap-section-title"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/><path d="M10 18V5l9.5-2v13"/></svg> Vos morceaux du mois</div><div>`;
    html += recapData.topTracks.map(t=>{
      const cover = t.cover_url ? `background-image:url(${t.cover_url});` : '';
      return `<div class="recap-track-row">
        <div class="recap-track-cover" style="${cover}"></div>
        <div class="recap-track-info"><div class="recap-track-title">${esc(t.title)}</div><div class="recap-track-artist">${esc(t.artist_name||'')}</div></div>
        <div class="recap-track-plays">${t.plays} écoute${t.plays>1?'s':''}</div>
      </div>`;
    }).join('');
    html += `</div>`;
  }
  if(!html) html = '<p style="font-size:12.5px; color:var(--text-faint);">Rien pour ce mois-ci.</p>';
  body.innerHTML = html;
  body.querySelectorAll('.recap-artist-card').forEach(card=>{
    card.onclick = ()=>{ closeRecapModal(); openArtistPage(card.dataset.artistName, Number(card.dataset.artistId)); };
  });
}

function openWorldModal(){
  if(lastAfroliveData) renderAfroliveInto('world-modal', lastAfroliveData);
  document.getElementById('world-modal-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  initGlobe3D();
}
function closeWorldModal(){
  document.getElementById('world-modal-overlay').classList.remove('show');
  document.body.style.overflow = '';
  if(globe3dState) globe3dState.paused = true; // pas la peine de continuer à faire tourner le globe hors écran
}

/* ============================================================
   GLOBE 3D — chargé UNIQUEMENT au premier clic sur "Voir le monde",
   jamais au chargement de la page (coût WebGL évité pour qui ne
   l'utilise jamais). Vraies données (voir lastAfroliveData, déjà
   chargées par loadAfroliveStats) positionnées sur une sphère à leurs
   vraies coordonnées approximatives — aucun point inventé.
============================================================ */
// Coordonnées approximatives (capitale ou grande ville) — suffisant pour situer un pays sur
// le globe, pas une précision cartographique de haute exactitude.
const COUNTRY_LATLNG = {
  'congo':[-4.26,15.28],'republique du congo':[-4.26,15.28],'rdc':[-4.32,15.31],'republique democratique du congo':[-4.32,15.31],
  'gabon':[0.42,9.45],'cameroun':[3.85,11.50],'tchad':[12.11,15.05],'centrafrique':[4.36,18.56],'guinee equatoriale':[3.75,8.78],
  'senegal':[14.69,-17.44],'cote d\'ivoire':[6.83,-5.29],'ivoire':[6.83,-5.29],'mali':[12.65,-8.00],'burkina faso':[12.37,-1.53],
  'guinee':[9.51,-13.71],'benin':[6.37,2.42],'togo':[6.13,1.22],'niger':[13.51,2.11],'nigeria':[9.08,7.40],'ghana':[5.55,-0.20],
  'sierra leone':[8.48,-13.23],'liberia':[6.31,-10.80],
  'kenya':[-1.29,36.82],'tanzanie':[-6.79,39.21],'ouganda':[0.35,32.58],'ethiopie':[9.03,38.74],'rwanda':[-1.94,30.06],'burundi':[-3.38,29.36],
  'afrique du sud':[-25.75,28.19],'zimbabwe':[-17.83,31.05],'zambie':[-15.39,28.32],'namibie':[-22.56,17.08],'angola':[-8.84,13.23],'mozambique':[-25.97,32.57],
  'maroc':[34.02,-6.83],'algerie':[36.75,3.06],'tunisie':[36.81,10.18],'egypte':[30.04,31.24],'libye':[32.89,13.19],
  'france':[48.86,2.35],'belgique':[50.85,4.35],'allemagne':[52.52,13.40],'royaume-uni':[51.51,-0.13],'angleterre':[51.51,-0.13],
  'suisse':[46.95,7.45],'italie':[41.90,12.50],'espagne':[40.42,-3.70],'portugal':[38.72,-9.14],'pays-bas':[52.37,4.90],'suede':[59.33,18.07],'norvege':[59.91,10.75],
  'etats-unis':[38.90,-77.04],'usa':[38.90,-77.04],'canada':[45.42,-75.70],'mexique':[19.43,-99.13],'bresil':[-15.79,-47.88],
  'jamaique':[18.02,-76.80],'haiti':[18.53,-72.34],'cuba':[23.13,-82.38],
  'chine':[39.90,116.40],'inde':[28.61,77.21],'japon':[35.68,139.69],'coree du sud':[37.57,126.98],'emirats arabes unis':[24.47,54.37],
  'australie':[-35.28,149.13],'nouvelle-zelande':[-41.29,174.78],
};
let globe3dState = null;
function latLngToVec3(lat, lng, radius, THREE){
  const phi = (90 - lat) * (Math.PI/180);
  const theta = (lng + 180) * (Math.PI/180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}
function loadThreeJs(){
  if(window.THREE) return Promise.resolve();
  if(window.__threeLoadingPromise) return window.__threeLoadingPromise;
  window.__threeLoadingPromise = new Promise((resolve, reject)=>{
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return window.__threeLoadingPromise;
}
let globe3dInitializing = false; // garde-fou anti double-clic rapide, avant même que globe3dState existe
async function initGlobe3D(){
  const wrap = document.getElementById('globe3d-wrap');
  const loading = document.getElementById('globe3d-loading');
  if(!wrap || !lastAfroliveData) return;
  if(globe3dState){ globe3dState.paused = false; return; } // déjà initialisé — juste relancer l'animation
  if(globe3dInitializing) return; // un chargement est déjà en cours (ex: double-clic rapide) — ne jamais en démarrer un second
  globe3dInitializing = true;
  try{
    await loadThreeJs();
  }catch(e){
    globe3dInitializing = false;
    if(loading) loading.textContent = 'Globe 3D indisponible pour le moment — voir les classements ci-dessous.';
    return;
  }
  const THREE = window.THREE;
  const canvas = document.getElementById('globe3d-canvas');
  const tooltip = document.getElementById('globe3d-tooltip');
  const w = wrap.clientWidth, h = wrap.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 100);
  camera.position.z = 6.4;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // Sphère filaire dorée — sert de grille par-dessus la texture (ou seule, en repli).
  const wireGeo = new THREE.SphereGeometry(2.6, 28, 22);
  const wireMat = new THREE.MeshBasicMaterial({ color:0xD4AF6A, wireframe:true, transparent:true, opacity:.28 });
  const wireSphere = new THREE.Mesh(wireGeo, wireMat);
  scene.add(wireSphere);
  // Sphère intérieure — tente une vraie texture Terre (source stable, hébergée par le projet
  // three.js lui-même) ; si ça échoue pour une raison quelconque (réseau, CDN indisponible),
  // repli automatique et silencieux sur un matériau sombre uni, jamais un globe cassé/vide.
  const coreGeo = new THREE.SphereGeometry(2.56, 28, 22);
  const coreMat = new THREE.MeshPhongMaterial({ color:0x2a2015, shininess:6, transparent:true, opacity:.95 });
  const coreSphere = new THREE.Mesh(coreGeo, coreMat);
  scene.add(coreSphere);
  try{
    new THREE.TextureLoader().load(
      'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
      (texture)=>{ coreMat.map = texture; coreMat.color.set(0xffffff); coreMat.needsUpdate = true; wireMat.opacity = .16; },
      undefined,
      ()=>{ /* échec silencieux — le matériau sombre uni déjà en place reste tel quel */ },
    );
  }catch(e){ /* navigateur très ancien sans TextureLoader — pas grave, repli déjà en place */ }

  // Éclairage doré premium — une lumière ambiante douce + une "lumière du soleil" dorée
  // qui vient d'un coin, pour du relief plutôt qu'un rendu plat.
  scene.add(new THREE.AmbientLight(0x4a3a20, 1.1));
  const sunLight = new THREE.DirectionalLight(0xE8C77E, 1.4);
  sunLight.position.set(4, 3, 5);
  scene.add(sunLight);

  // ---- Points de données RÉELS — un point par pays réellement présent dans les vraies
  // écoutes (lastAfroliveData.topCountries), positionné à ses vraies coordonnées
  // approximatives, avec une taille proportionnelle au vrai nombre d'écoutes.
  const group = new THREE.Group();
  scene.add(group);
  wireSphere.add(coreSphere); // rotation groupée
  const dataPoints = [];
  const maxPlays = Math.max(1, ...lastAfroliveData.topCountries.map(c=>c.plays));
  lastAfroliveData.topCountries.forEach((c, i)=>{
    const coords = COUNTRY_LATLNG[normalizeCountryKeyFront(c.country)];
    if(!coords) return; // pays réel mais coordonnées inconnues — pas de point inventé au hasard
    const pos = latLngToVec3(coords[0], coords[1], 2.62, THREE);
    const ratio = c.plays / maxPlays; // vraie proportion par rapport au pays le plus écouté — cohérent avec la légende (Élevée/Moyenne/Faible)
    const size = 0.032 + ratio * 0.09;
    const color = ratio >= 0.66 ? 0xE8C77E : ratio >= 0.33 ? 0xE08A3C : 0x8a6a3e;
    const dotGeo = new THREE.SphereGeometry(size, 10, 10);
    const dotMat = new THREE.MeshBasicMaterial({ color });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(pos);
    dot.userData = { country: c.country, plays: c.plays };
    wireSphere.add(dot);
    dataPoints.push(dot);
  });

  let dragging = false, lastX = 0, lastY = 0, rotY = 0, rotX = 0, velX = 0;
  canvas.addEventListener('pointerdown', (e)=>{ dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('pointerup', ()=>{ dragging = false; });
  window.addEventListener('pointermove', (e)=>{
    if(!dragging) return;
    velX = (e.clientX - lastX) * 0.005;
    rotY += velX;
    rotX = Math.max(-1, Math.min(1, rotX + (e.clientY - lastY) * 0.004));
    lastX = e.clientX; lastY = e.clientY;
  });
  // Survol : affiche le vrai nombre d'écoutes du pays visé, jamais un chiffre inventé.
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  canvas.addEventListener('pointermove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left)/rect.width)*2 - 1;
    mouse.y = -((e.clientY - rect.top)/rect.height)*2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(dataPoints);
    if(hits.length){
      const d = hits[0].object.userData;
      tooltip.innerHTML = `${d.country} — <b>${d.plays.toLocaleString('fr-FR')}</b> écoutes`;
      tooltip.style.left = (e.clientX - rect.left) + 'px';
      tooltip.style.top = (e.clientY - rect.top) + 'px';
      tooltip.style.display = 'block';
    } else { tooltip.style.display = 'none'; }
  });
  canvas.addEventListener('pointerleave', ()=>{ tooltip.style.display = 'none'; });

  globe3dState = { paused:false };
  globe3dInitializing = false;
  function animate(){
    requestAnimationFrame(animate);
    if(globe3dState.paused) return;
    if(!dragging){ rotY += 0.0016 + velX*0; velX *= 0.92; rotY += velX; } // légère rotation continue, ralentit après un glissement
    wireSphere.rotation.y = rotY;
    wireSphere.rotation.x = rotX;
    renderer.render(scene, camera);
  }
  animate();
  window.addEventListener('resize', ()=>{
    if(!wrap.clientWidth) return;
    camera.aspect = wrap.clientWidth/wrap.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  });
  if(loading) loading.classList.add('hide');

  // ---- Contrôles réels — zoom avant/arrière borné, réinitialisation complète de la vue.
  const CAM_Z_DEFAULT = 6.4, CAM_Z_MIN = 3.6, CAM_Z_MAX = 9.5;
  const zoomInBtn = document.getElementById('g3-zoom-in');
  const zoomOutBtn = document.getElementById('g3-zoom-out');
  const resetBtn = document.getElementById('g3-reset');
  if(zoomInBtn) zoomInBtn.onclick = ()=>{ camera.position.z = Math.max(CAM_Z_MIN, camera.position.z - 0.8); };
  if(zoomOutBtn) zoomOutBtn.onclick = ()=>{ camera.position.z = Math.min(CAM_Z_MAX, camera.position.z + 0.8); };
  if(resetBtn) resetBtn.onclick = ()=>{ camera.position.z = CAM_Z_DEFAULT; rotX = 0; };
  canvas.addEventListener('wheel', (e)=>{
    e.preventDefault();
    camera.position.z = Math.max(CAM_Z_MIN, Math.min(CAM_Z_MAX, camera.position.z + e.deltaY * 0.003));
  }, { passive:false });
  const legend = document.getElementById('globe3d-legend');
  const controls = document.getElementById('globe3d-controls');
  if(legend) legend.style.display = 'block';
  if(controls) controls.style.display = 'flex';
}

function renderHomeHero(){
  const hero = document.getElementById('premium-hero-accueil');
  const titleEl = document.getElementById('premium-hero-title');
  const subEl = document.getElementById('premium-hero-sub');
  const badgeEl = document.getElementById('premium-hero-badge');
  const playBtn = document.getElementById('premium-hero-play-btn');
  const coverEl = document.getElementById('premium-hero-cover');
  const liveCountEl = document.getElementById('premium-hero-live-count');
  const shareBtn = document.getElementById('premium-hero-share-btn');
  if(!hero) return;
  const top5 = getTopStreamedTracks(5);
  if(!top5.length){
    // Pas encore assez de vraies écoutes pour établir un Top — on garde le texte/l'image
    // d'accroche par défaut plutôt qu'un écran vide, mais le badge reste honnête.
    if(badgeEl) badgeEl.innerHTML = '<span class="phb-dot"></span>Bienvenue sur NUNI';
    return;
  }
  // Vrai tirage aléatoire (pas juste le même ordre à chaque rechargement) parmi les 5
  // vrais morceaux les plus streamés — la bannière change de visage sans jamais montrer
  // un morceau inventé ou un chiffre de streams fictif.
  heroRotatePool = [...top5].sort(()=> Math.random()-0.5);
  heroRotateIndex = 0;
  applyHeroTrack(heroRotatePool[0], hero, titleEl, subEl, playBtn, coverEl, liveCountEl, shareBtn);
  clearInterval(heroRotateTimer);
  if(heroRotatePool.length > 1){
    heroRotateTimer = setInterval(()=>{
      heroRotateIndex = (heroRotateIndex + 1) % heroRotatePool.length;
      hero.classList.add('hero-fading');
      setTimeout(()=>{
        applyHeroTrack(heroRotatePool[heroRotateIndex], hero, titleEl, subEl, playBtn, coverEl, liveCountEl, shareBtn);
        hero.classList.remove('hero-fading');
      }, 420);
    }, 8000);
  }
}
/* ---- Scène du Hero — quelques particules très discrètes qui dérivent lentement vers le
   haut, façon poussière de lumière. Génération peu fréquente et peu nombreuse : jamais plus
   de 4-5 en même temps, pas de coût de performance notable. ---- */
/* ============================================================
   NUNI AURA ENGINE V2 — signature NUNI, structurée pour être réutilisée
   plus tard par les clips, albums, playlists et profils artistes.

   ├── Color Extraction    → NuniPalette.extract (déjà utilisé par le Hero/lecteur, pas de doublon)
   ├── Emotional Profiles   → NuniAura.PROFILES (vitesse/flou/intensité selon le genre)
   ├── Transition System    → NuniAura.applyTrack (fondu-sortie puis fondu-entrée, jamais un
   │                          changement instantané — "une vague", comme demandé)
   ├── Audio Reaction       → NuniAura.startLiveLoop (RÉELLE, pas simulée : réutilise
   │                          nuniAnalyser/nuniFreqData, déjà branché pour la sphère audio
   │                          des tuiles de genre — mêmes vraies données de fréquence,
   │                          aucun second graphe audio créé)
   ├── Background Influence → #nuni-aura-ambient
   ├── Player Reflection    → .play-pause / .fp-play (voir style.css)
   └── Cover Glow           → .track-card.is-now-playing (voir style.css)
============================================================ */
const NuniAura = {
  // Vitesse de pulsation + flou selon l'ambiance du genre — pas juste une couleur qui
  // change, une vraie sensation différente. Les genres absents utilisent PROFILES.default.
  PROFILES: {
    'Rap':       { pulse:'2.1s', blur:'100px' },
    'Afro':      { pulse:'2.4s', blur:'105px' },
    'Amapiano':  { pulse:'2.1s', blur:'100px' },
    'RnB':       { pulse:'5.2s', blur:'145px' },
    'Soul':      { pulse:'5.4s', blur:'150px' },
    'Gospel':    { pulse:'5.6s', blur:'150px' },
    'Trap':      { pulse:'3.6s', blur:'85px'  },
    'Drill':     { pulse:'3.4s', blur:'80px'  },
    default:     { pulse:'3.4s', blur:'120px' },
  },
  _liveRAF: null,
  _restingApplied: false,

  profileFor(genre){ return this.PROFILES[genre] || this.PROFILES.default; },

  setColorVars(colorHsl, genre){
    const root = document.documentElement.style;
    root.setProperty('--nuni-aura-color', colorHsl);
    const profile = this.profileFor(genre);
    root.setProperty('--nuni-aura-pulse-speed', profile.pulse);
    root.setProperty('--nuni-aura-blur', profile.blur);
  },

  // ---- Lecture réelle d'un morceau : transition "en vague" plutôt qu'un changement net.
  // L'ancienne aura s'efface, un court instant de calme, puis la nouvelle arrive.
  applyTrack(tr){
    const ambient = document.getElementById('nuni-aura-ambient');
    if(!ambient) return;
    ambient.classList.remove('is-resting');
    if(!tr || !tr.cover || typeof NuniPalette === 'undefined'){ this.stop(); return; }
    const wasActive = ambient.classList.contains('is-active');
    ambient.classList.remove('is-active'); // fondu-sortie de l'ancienne couleur
    NuniPalette.extract(tr.cover).then(palette=>{
      const reveal = ()=>{
        this.setColorVars(palette.accent, tr.genre);
        ambient.classList.add('is-active'); // la nouvelle arrive comme une vague
      };
      wasActive ? setTimeout(reveal, 320) : reveal(); // instant de calme seulement s'il y avait déjà une aura à effacer
      this.startLiveLoop();
    }).catch(()=> this.stop());
  },

  // ---- Aucune lecture en cours : juste la sortie mise en avant du Hero, à peine perceptible
  // — la plateforme semble "déjà allumée" même avant d'appuyer sur Play.
  applyRestingHero(coverUrl){
    const ambient = document.getElementById('nuni-aura-ambient');
    if(!ambient || this._restingApplied || !coverUrl || typeof NuniPalette === 'undefined') return;
    NuniPalette.extract(coverUrl).then(palette=>{
      if(ambient.classList.contains('is-active')) return; // une vraie lecture a démarré entre-temps, ne pas écraser
      this.setColorVars(palette.accent, null);
      ambient.classList.add('is-resting');
      this._restingApplied = true;
    }).catch(()=>{});
  },

  stop(){
    const ambient = document.getElementById('nuni-aura-ambient');
    if(ambient) ambient.classList.remove('is-active');
    this.stopLiveLoop();
  },

  // ---- Réactivité audio RÉELLE (pas un visualiseur qui "danse" — une respiration organique
  // dont l'amplitude suit les vraies basses). Réutilise l'analyseur déjà actif pour la sphère
  // des tuiles de genre : mêmes données, aucune connexion audio supplémentaire créée. Si
  // l'analyseur n'est pas disponible (navigateur non supporté, échec silencieux déjà géré
  // ailleurs), l'aura garde simplement sa respiration de base sans le boost — jamais d'erreur
  // visible, jamais d'impact sur la vraie lecture du son.
  startLiveLoop(){
    if(this._liveRAF) return; // déjà en cours
    const tick = ()=>{
      this._liveRAF = requestAnimationFrame(tick);
      if(!playing || !usingRealAudio || !nuniAnalyser || !nuniFreqData){
        document.documentElement.style.setProperty('--nuni-aura-live-boost', '0');
        return;
      }
      nuniAnalyser.getByteFrequencyData(nuniFreqData);
      const bassEnd = Math.floor(nuniFreqData.length * 0.15);
      let bSum = 0;
      for(let i=0;i<bassEnd;i++) bSum += nuniFreqData[i];
      const bass = (bSum/bassEnd)/255; // 0 (silence) à 1 (basse pleine puissance)
      // Boost doux et plafonné — "augmente légèrement", jamais un clignotement agressif.
      // Le fond ambiant du lecteur plein écran (.full-player::before) réagit ainsi
      // légèrement au rythme du vrai morceau en cours d'écoute.
      document.documentElement.style.setProperty('--nuni-aura-live-boost', (bass*0.22).toFixed(3));
    };
    tick();
  },
  stopLiveLoop(){
    if(this._liveRAF){ cancelAnimationFrame(this._liveRAF); this._liveRAF = null; }
    document.documentElement.style.setProperty('--nuni-aura-live-boost', '0');
  },
};
// Conservé pour compatibilité : l'ancien nom d'appel (playTrack l'utilise) délègue au moteur.
function applyMusicAura(tr){ NuniAura.applyTrack(tr); }

// ---------- Moteur d'ambiance au scroll — la scène entière reste éclairée par la vraie
// pochette la plus proche du centre de l'écran, comme une "scène qui se transforme
// progressivement" plutôt qu'une succession de blocs. Alimenté par card.dataset.ambientColor
// (voir trackCard(), déjà posé depuis la vraie couleur extraite de chaque vraie pochette —
// jamais une couleur inventée). Une vraie lecture en cours prime toujours : ce moteur ne
// s'active que lorsque rien ne joue, en mode "resting" déjà existant sur #nuni-aura-ambient,
// réutilisant sa transition CSS douce déjà en place (transition:background 1.1s ease) —
// aucun nouveau moteur de lerp parallèle à maintenir.
function initHomeAmbientScrollEngine(){
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduceMotion) return;
  const ambient = document.getElementById('nuni-aura-ambient');
  if(!ambient) return;
  let ticking = false;
  function pickNearestCardColor(){
    if(playing) return; // une vraie lecture en cours prime toujours — jamais interrompue par un simple défilement
    const cards = document.querySelectorAll('.track-card[data-ambient-color]');
    if(!cards.length) return;
    const vh = window.innerHeight;
    const centerY = vh / 2;
    let bestColor = null, bestDist = Infinity;
    cards.forEach(c=>{
      const r = c.getBoundingClientRect();
      if(r.bottom < 0 || r.top > vh) return; // hors du champ visible, ne fait pas partie de la scène actuelle
      const elCenter = r.top + r.height / 2;
      const dist = Math.abs(elCenter - centerY);
      if(dist < bestDist){ bestDist = dist; bestColor = c.dataset.ambientColor; }
    });
    if(bestColor){
      document.documentElement.style.setProperty('--nuni-aura-color', bestColor);
      ambient.classList.add('is-resting');
    }
  }
  window.addEventListener('scroll', ()=>{
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{ pickNearestCardColor(); ticking = false; });
  }, { passive:true });
  pickNearestCardColor(); // premier calcul au chargement, sans attendre un premier scroll
}
initHomeAmbientScrollEngine();

// ---------- Parallaxe très subtile sur le hero — le fond et la pochette bougent légèrement
// au mouvement de la souris, pas pour "faire bouger toute l'interface" mais pour donner une
// vraie impression de profondeur. Retiré automatiquement au repos (mouseleave). ----------
(function initHeroParallax(){
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduceMotion) return;
  const hero = document.getElementById('premium-hero-accueil');
  const cover = document.getElementById('premium-hero-cover');
  if(!hero) return;
  hero.addEventListener('mousemove', (e)=>{
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    hero.style.backgroundPosition = `calc(50% + ${x * -10}px) calc(50% + ${y * -8}px)`;
    if(cover) cover.style.transform = `translate(${x * 12}px, ${y * 10}px)`;
  });
  hero.addEventListener('mouseleave', ()=>{
    hero.style.backgroundPosition = '';
    if(cover) cover.style.transform = '';
  });
})();

function applyHeroTrack(top, hero, titleEl, subEl, playBtn, coverEl, liveCountEl, shareBtn){
  if(top.cover && coverEl) coverEl.style.backgroundImage = `url(${top.cover})`;
  if(titleEl) titleEl.innerHTML = `<em>${top.t}</em>`;
  if(subEl) subEl.textContent = `${top.a} · parmi les morceaux les plus écoutés cette semaine`;
  if(playBtn) playBtn.onclick = ()=>{ playTrack(top); openFullPlayer(); };
  // Vrai nombre d'écoutes du morceau, jamais un compteur "temps réel" inventé — juste le
  // vrai total déjà connu, formaté comme partout ailleurs sur NUNI.
  if(liveCountEl) liveCountEl.textContent = `${formatStreams(top.streams||0)} écoutes`;
  if(shareBtn){
    shareBtn.onclick = ()=>{
      const url = window.location.origin + window.location.pathname;
      const text = `Écoutez "${top.t}" de ${top.a} sur NUNI 🎵`;
      if(navigator.share){ navigator.share({ title: top.t + ' — ' + top.a, text, url }).catch(()=>{}); }
      else { navigator.clipboard.writeText(`${text} ${url}`).then(()=> toast('Lien copié !')); }
    };
  }
  // Halo de couleur dynamique — la teinte du Hero suit la pochette affichée, en réutilisant
  // le même système d'extraction que le lecteur plein écran (voir NuniPalette).
  if(top.cover && typeof NuniPalette !== 'undefined'){
    NuniPalette.extract(top.cover).then(palette=>{
      hero.style.setProperty('--nuni-hero-glow', palette.accent);
    });
  }
  if(top.cover && typeof NuniAura !== 'undefined') NuniAura.applyRestingHero(top.cover);
}
// ---------- Nav qui se voile progressivement au défilement — plus translucide tout en
// haut (laisse respirer le hero), plus opaque/floutée une fois qu'on a défilé un peu.
// Throttlé via requestAnimationFrame pour ne jamais recalculer le style à chaque pixel. ----------
(function initTopnavScrollVeil(){
  let ticking = false;
  const apply = ()=>{
    document.querySelectorAll('.app-topnav').forEach(nav=>{
      nav.classList.toggle('is-scrolled', window.scrollY > 24);
    });
    ticking = false;
  };
  window.addEventListener('scroll', ()=>{
    if(!ticking){ requestAnimationFrame(apply); ticking = true; }
  }, { passive:true });
})();

loadRealTracks();

// ---------- Filet de sécurité permanent — sections jamais vides si de vraies données
// existent ---------- Après plusieurs incidents différents ayant chacun vidé une section
// pour une raison distincte (course entre appels, aléa réseau, bug ponctuel dans un ajout
// cosmétique...), ce filet vérifie en continu, indépendamment de la cause exacte : si de
// vrais morceaux sont bien chargés en mémoire (tracks) mais qu'une section censée les
// afficher est visuellement vide, elle est automatiquement repeuplée. Tourne toutes les 4
// secondes pendant les 90 premières secondes (couvre largement un réveil Render, jusqu'à
// ~55s dans les pires cas), puis s'arrête tout seul — inutile de continuer à vérifier
// indéfiniment une fois la page stabilisée.
(function watchNeverEmptyShelves(){
  let elapsed = 0;
  const intervalMs = 4000;
  const maxDurationMs = 90000;
  const check = ()=>{
    elapsed += intervalMs;
    const realCount = tracks.filter(t=>t.isReal).length;
    if(realCount > 0){
      const newRow = document.getElementById('shelf-new');
      if(newRow && newRow.children.length === 0){
        try{ fillNouveautesAsymmetric('shelf-new', tracks.filter(t=>t.isReal).slice(0,3)); }
        catch(e){ console.error('[watchNeverEmptyShelves] shelf-new:', e); }
      }
      const topRow = document.getElementById('shelf-top');
      if(topRow && topRow.children.length === 0){
        try{ renderTopCongo(); }
        catch(e){ console.error('[watchNeverEmptyShelves] shelf-top:', e); }
      }
    }
    // "Écoutés récemment" dépend de son propre appel serveur (pas seulement de tracks) —
    // si la section est censée être affichée (wrap visible) mais que sa rangée est vide,
    // on relance simplement son propre chargement plutôt que de deviner pourquoi.
    if(realAuthToken){
      const continueWrap = document.getElementById('shelf-continue-wrap');
      const continueRow = document.getElementById('shelf-continue');
      if(continueWrap && continueRow && continueWrap.style.display !== 'none' && continueRow.children.length === 0){
        try{ renderContinueListening(); }
        catch(e){ console.error('[watchNeverEmptyShelves] shelf-continue:', e); }
      }
    }
    if(elapsed < maxDurationMs) setTimeout(check, intervalMs);
  };
  setTimeout(check, intervalMs);
})();

/* ============ PHASE 2 DA — tilt 3D des pochettes au survol ============
   Un seul listener délégué sur tout le document plutôt qu'un par carte : la souris peut
   survoler des centaines de pochettes sans jamais multiplier les écouteurs d'événements.
   Désactivé sur tactile (pas de vrai "survol" au doigt, --tilt-x/y restent à 0deg). */
if(window.matchMedia && window.matchMedia('(hover: hover)').matches){
  let tiltRaf = null;
  document.addEventListener('mousemove', (e)=>{
    if(tiltRaf) return; // un seul calcul par frame d'affichage, jamais plus
    tiltRaf = requestAnimationFrame(()=>{
      tiltRaf = null;
      const cover = e.target.closest && e.target.closest('.track-card .cover');
      if(!cover) return;
      const rect = cover.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      const maxTilt = 7; // degrés — volontairement discret, pas un effet gadget
      cover.style.setProperty('--tilt-y', (px * maxTilt).toFixed(2) + 'deg');
      cover.style.setProperty('--tilt-x', (-py * maxTilt).toFixed(2) + 'deg');
    });
  }, { passive:true });
}

/* ============================================================
   CURSEUR NUNI — halo qui suit la souris + aimantation sur quelques
   CTA principaux seulement (pas toutes les pochettes, ça deviendrait
   fatiguant). Un seul écouteur mousemove délégué, comme le tilt
   ci-dessus. Désactivé sur tactile et si prefers-reduced-motion
   (déjà géré côté CSS via `display:none`, donc ce JS ne coûte rien
   dans ces cas — juste un peu de calcul inutile évité en amont).
============================================================ */
if(window.matchMedia && window.matchMedia('(hover: hover)').matches && !(window.matchMedia('(prefers-reduced-motion: reduce)').matches)){
  const cursorEl = document.getElementById('nuni-cursor');
  if(cursorEl){
    let cursorRaf = null, cx = 0, cy = 0, curX = 0, curY = 0, activated = false;
    document.addEventListener('mousemove', (e)=>{
      cx = e.clientX; cy = e.clientY;
      if(!activated){ activated = true; cursorEl.classList.add('is-active'); curX = cx; curY = cy; }
      const isInteractive = e.target.closest && e.target.closest('button, a, .track-card, [role="button"], input, select, .asv-genre-tile, .genre-tile');
      const isMagnetic = e.target.closest && e.target.closest('.nc-magnetic');
      cursorEl.classList.toggle('is-hover', !!isInteractive);
      cursorEl.classList.toggle('is-magnetic', !!isMagnetic);
      if(cursorRaf) return;
      cursorRaf = requestAnimationFrame(function tick(){
        // Léger amorti (lerp) façon "traîne douce" plutôt qu'un curseur qui saute
        // brutalement à chaque pixel — sensation plus organique, coût quasi nul.
        curX += (cx - curX) * 0.25;
        curY += (cy - curY) * 0.25;
        cursorEl.style.transform = `translate(${curX}px, ${curY}px)`;
        if(Math.abs(cx-curX) > 0.5 || Math.abs(cy-curY) > 0.5){ cursorRaf = requestAnimationFrame(tick); }
        else { cursorRaf = null; }
      });
    }, { passive:true });
    document.addEventListener('mouseleave', ()=> cursorEl.classList.remove('is-active'));
  }
  // ---- Aimantation — uniquement sur les CTA marqués .nc-magnetic (voir index.html : bouton
  // Play du Hero, bouton Play principal du mini-lecteur). L'élément se déplace très
  // légèrement vers le curseur, comme attiré par lui. Toujours borné, jamais un déplacement
  // brutal ou disproportionné. */
  document.addEventListener('mousemove', (e)=>{
    const magnet = e.target.closest && e.target.closest('.nc-magnetic');
    document.querySelectorAll('.nc-magnetic.nc-magnet-active').forEach(el=>{
      if(el !== magnet) el.style.transform = '';
    });
    if(!magnet) return;
    magnet.classList.add('nc-magnet-active');
    const rect = magnet.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width/2);
    const relY = e.clientY - (rect.top + rect.height/2);
    const maxPull = 8; // pixels — volontairement discret
    magnet.style.transform = `translate(${(relX*0.2).toFixed(1)}px, ${(relY*0.2).toFixed(1)}px)`;
  }, { passive:true });
  document.addEventListener('mouseout', (e)=>{
    const magnet = e.target.closest && e.target.closest('.nc-magnetic');
    if(magnet && !magnet.contains(e.relatedTarget)){ magnet.style.transform = ''; magnet.classList.remove('nc-magnet-active'); }
  }, { passive:true });
}

/* ============ RELEASE CALENDAR — vraies sorties, toute la plateforme ============ */
function loadUpcomingReleases(){
  const row = document.getElementById('release-row');
  if(!row) return;
  if(!navigator.onLine) return; // pas de réseau du tout : inutile de tenter, on réessaiera au prochain cycle
  fetch(NUNI_API_BASE + '/api/releases/upcoming').then(r=>r.json()).then(data=>{
    const list = data.releases || [];
    row.innerHTML = '';
    if(!list.length){
      row.innerHTML = `<p style="font-size:12.5px; color:var(--text-faint);">Aucune sortie programmée pour le moment.</p>`;
      return;
    }
    const mapped = list.map(r=>{
      const d = new Date(r.scheduled_release_at);
      const days = Math.max(0, Math.ceil((d - new Date()) / 86400000));
      return {
        d: String(d.getDate()).padStart(2,'0'),
        m: d.toLocaleDateString('fr-FR', {month:'short'}).replace('.',''),
        t: r.title, a: r.artist_name || r.first_name || 'Artiste NUNI',
        c: days === 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : `Dans ${days} jours`,
      };
    });
    fillReleaseRow('release-row', mapped);
  }).catch(()=>{
    row.innerHTML = `<p style="font-size:12.5px; color:var(--text-faint);">Calendrier momentanément indisponible.</p>`;
  });
}
function fillReleaseRow(id, list){
  const row = document.getElementById(id);
  if(!row) return;
  list.forEach(r=>{
    const card = document.createElement('div');
    card.className = 'release-card';
    card.innerHTML = `
      <div class="release-date"><div class="d data">${r.d}</div><div class="m">${r.m}</div></div>
      <div class="release-info"><div class="t">${r.t}</div><div class="a">${r.a}</div><div class="c">${r.c}</div></div>`;
    row.appendChild(card);
  });
}
loadUpcomingReleases();
setInterval(loadUpcomingReleases, 60000); // se resynchronise avec les vraies dates toutes les 60s
// Le calendrier de la page artiste ('artist-release-row') se remplit désormais dynamiquement
// avec les vraies sorties programmées, dans openArtistPage() — plus de données factices ici.

/* ============ PLAYER LOGIC ============ */
// Clic sur la pochette du mini-lecteur : ouvre toujours le lecteur plein écran (le mini-
// lecteur n'existe de toute façon que pendant une vraie lecture — voir togglePlay()).
function handlePlayerTrackClick(){
  openFullPlayer();
}

let progressTimer, elapsed = 0, duration = 204; // 3:24
let playbackSpeed = 1, qualityIndex = 1;
try{
  const savedSpeed = parseFloat(localStorage.getItem('nuni_playback_speed'));
  if([1, 1.25, 1.5, 0.75].includes(savedSpeed)) playbackSpeed = savedSpeed;
}catch(e){ /* pas bloquant */ }
let usingRealAudio = false;
const realAudio = new Audio();
// Nécessaire pour que l'AnalyserNode (sphère audio "Tout") puisse lire les fréquences des
// fichiers Cloudinary sans être bloqué par la sécurité du navigateur — doit être posé AVANT
// tout chargement de fichier (voir ensureAudioAnalyser plus bas). Cloudinary autorise déjà
// les requêtes cross-origin par défaut, donc ceci ne change rien à la lecture normale.
realAudio.crossOrigin = 'anonymous';
realAudio.volume = 1;
realAudio.preload = 'auto';
// ---------- Correctif bug volume physique (boutons du téléphone sans effet) ----------
// realAudio était créé via new Audio() mais jamais inséré dans le DOM. Sur mobile
// (Android en particulier, et PWA installées), un <audio> hors du DOM n'est pas toujours
// rattaché correctement par l'OS au flux "média" (STREAM_MUSIC) — les boutons physiques
// de volume du téléphone n'ont alors aucun effet sur la lecture. L'insérer (invisible,
// display:none) dans le DOM permet au navigateur/à l'OS de le reconnaître comme le vrai
// lecteur média actif, exactement comme le fait n'importe quel lecteur audio natif.
realAudio.style.display = 'none';
document.body.appendChild(realAudio);
realAudio.addEventListener('loadedmetadata', ()=>{
  if(usingRealAudio && isFinite(realAudio.duration)){ duration = realAudio.duration; updateProgress(); }
});
realAudio.addEventListener('timeupdate', ()=>{
  if(usingRealAudio){ elapsed = realAudio.currentTime; updateProgress(); }
  // Recalage périodique de l'élément fantôme de la sphère audio (jamais indispensable,
  // purement cosmétique — un décalage éventuel ne serait visible que sur la sphère, jamais
  // sur le son réel).
  if(usingRealAudio && nuniAnalyser){ nuniSyncAnalysisAudio(realAudio.src, realAudio.currentTime); }
  // Fondu enchaîné façon Apple Music, uniquement en mode DJ : dès qu'il reste moins que la
  // durée de fondu du mode actif (ou du réglage manuel choisi), on lance la transition —
  // bien avant que le morceau ne se termine vraiment, contrairement à l'ancien comportement
  // (coupure nette à 'ended').
  if(djMode && usingRealAudio && !djCrossfadeTriggered && isFinite(duration) && duration > 0){
    const remaining = duration - elapsed;
    if(remaining > 0 && remaining <= currentDjCrossfadeSeconds()){
      djCrossfadeTriggered = true;
      startDjCrossfade();
    }
  }
  if(usingRealAudio) savePlaybackPositionThrottled();
});
realAudio.addEventListener('ended', ()=>{
  if(usingRealAudio){
    handleTrackEnded();
    // Le morceau est allé au bout naturellement — plus rien à "reprendre" pour lui.
    if(currentTrack && currentTrack.isReal && currentTrack.realId && realAuthToken){
      fetch(NUNI_API_BASE + '/api/me/playback-position/' + currentTrack.realId, {
        method:'DELETE', headers:{ 'Authorization':'Bearer ' + realAuthToken }
      }).catch(()=>{});
    }
  }
});
// ---------- Sauvegarde de la vraie position de lecture (pour "Reprendre l'écoute") ----------
// Appelée à chaque timeupdate (plusieurs fois par seconde), mais un throttle interne limite
// le vrai appel réseau à une fois toutes les ~10s — jamais bloquant pour la lecture elle-même.
let lastSavedPositionAt = 0;
function savePlaybackPositionThrottled(){
  if(!currentTrack || !currentTrack.isReal || !currentTrack.realId || !realAuthToken) return;
  const now = Date.now();
  if(now - lastSavedPositionAt < 10000) return;
  lastSavedPositionAt = now;
  fetch(NUNI_API_BASE + '/api/me/playback-position', {
    method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken },
    body: JSON.stringify({ trackId: currentTrack.realId, positionSeconds: Math.round(elapsed) }),
    keepalive: true, // la requête part quand même si la personne change de page juste après
  }).catch(()=>{});
}
// Avant : le bouton passait instantanément sur "Pause" dès le clic, même si le son mettait
// encore plusieurs secondes à charger (taille du fichier, qualité de connexion) — donnant
// l'impression que la lecture avait planté. Ici : un vrai état "chargement" honnête pendant
// que ça mémorise réellement, remplacé par l'icône pause seulement quand le son démarre pour de vrai.
function setPlayerLoadingState(isLoading){
  document.querySelectorAll('.play-pause, .fp-play').forEach(el=> el.classList.toggle('is-buffering', isLoading));
}
realAudio.addEventListener('waiting', ()=>{ if(usingRealAudio && playing) setPlayerLoadingState(true); });
realAudio.addEventListener('playing', ()=> setPlayerLoadingState(false));
realAudio.addEventListener('canplay', ()=> setPlayerLoadingState(false));
realAudio.addEventListener('error', ()=>{
  if(!usingRealAudio) return;
  const codes = {1:'lecture annulée', 2:'erreur réseau', 3:'fichier illisible (décodage impossible)', 4:'format audio non supporté par le navigateur'};
  const reason = codes[realAudio.error && realAudio.error.code] || 'erreur inconnue';
  toast('Lecture impossible — ' + reason + '. Essayez un fichier MP3 ou WAV.');
});
// Débloque le son : la 1ère interaction de l'utilisateur "amorce" l'élément audio
// pour que les navigateurs autorisent ensuite la lecture programmatique (politique autoplay).
let audioUnlocked = false;
function unlockAudioOnce(){
  if(audioUnlocked) return;
  audioUnlocked = true;
  const silentTry = realAudio.play();
  if(silentTry && silentTry.then){ silentTry.then(()=> realAudio.pause()).catch(()=>{}); }
}
document.addEventListener('click', unlockAudioOnce, {once:true});
document.addEventListener('touchstart', unlockAudioOnce, {once:true});
const qualities = ['Standard', 'Haute qualité', 'Sans perte'];
const palGradients = {
  'pal-1':'linear-gradient(135deg,#6E45A8,#141A38)',
  'pal-2':'linear-gradient(135deg,#D4AF6A,#7A4E2A)',
  'pal-3':'linear-gradient(135deg,#C9667A,#3A1530)',
  'pal-4':'linear-gradient(135deg,#1D2550,#0A0A10)',
  'pal-5':'linear-gradient(135deg,#8E63C9,#D4AF6A)',
  'pal-6':'linear-gradient(135deg,#2E7D6B,#0F2D27)',
};

/* ============================================================
   NuniPalette — utilitaire réutilisable d'extraction de couleurs
   ------------------------------------------------------------
   Objectif : à partir d'une image de pochette, produire une palette
   de 5 couleurs harmonieuses (dominante, secondaire, accent, sombre,
   claire) utilisables pour n'importe quel composant NUNI : lecteur
   plein écran aujourd'hui, mini-lecteur / cartes album / pages
   artiste / playlists plus tard.

   - Chaque palette est mise en cache par URL d'image : une pochette
     n'est jamais analysée deux fois.
   - Le calcul se fait sur une image réduite à 40×40 pixels : coût
     CPU négligeable, même sur un appareil modeste.
   - Si l'image ne peut pas être lue (restriction de sécurité CORS,
     pochette absente), une palette de secours cohérente avec
     l'identité NUNI est renvoyée à la place — jamais d'erreur visible.
   - Les niveaux de luminosité de la couleur "sombre" sont bornés
     pour rester lisibles avec du texte clair par-dessus (accessibilité).
============================================================ */
const NuniPalette = (function(){
  const cache = new Map();
  const FALLBACK = {
    dominant:'hsl(262, 45%, 40%)', secondary:'hsl(230, 40%, 18%)',
    accent:'hsl(38, 65%, 62%)', dark:'hsl(250, 35%, 11%)', light:'hsl(38, 40%, 72%)'
  };

  function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }

  function rgbToHsl(r, g, b){
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    let h, s, l=(max+min)/2;
    if(max===min){ h=0; s=0; }
    else{
      const d = max-min;
      s = l>0.5 ? d/(2-max-min) : d/(max+min);
      switch(max){
        case r: h=(g-b)/d+(g<b?6:0); break;
        case g: h=(b-r)/d+2; break;
        default: h=(r-g)/d+4;
      }
      h/=6;
    }
    return [h*360, s, l];
  }
  function hslCss(h, s, l){ return `hsl(${Math.round(h)}, ${Math.round(clamp(s,0,1)*100)}%, ${Math.round(clamp(l,0,1)*100)}%)`; }

  // Analyse les pixels d'une image (réduite à 40x40) et regroupe les couleurs proches en "buckets"
  function quantize(img){
    const size = 40;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently:true });
    ctx.drawImage(img, 0, 0, size, size);
    let data;
    try{ data = ctx.getImageData(0, 0, size, size).data; }
    catch(e){ return null; } // image protégée (CORS) : on utilisera la palette de secours

    const buckets = new Map();
    for(let i=0;i<data.length;i+=4){
      const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3];
      if(a<80) continue;
      const lum = 0.299*r + 0.587*g + 0.114*b;
      if(lum<14 || lum>246) continue; // ignore les noirs/blancs quasi purs (peu utiles pour un dégradé)
      const key = Math.round(r/24)+','+Math.round(g/24)+','+Math.round(b/24);
      const entry = buckets.get(key);
      if(entry) entry.count++; else buckets.set(key, {r,g,b,count:1});
    }
    const sorted = [...buckets.values()].sort((a,b)=> b.count - a.count);
    return sorted.length ? sorted : null;
  }

  function buildPalette(sorted){
    const dominant = sorted[0];
    const [dh] = rgbToHsl(dominant.r, dominant.g, dominant.b);
    // Couleur secondaire : la plus fréquente qui soit visuellement distincte de la dominante
    const secondary = sorted.find(c=>{
      const [h] = rgbToHsl(c.r, c.g, c.b);
      const dist = Math.abs(c.r-dominant.r) + Math.abs(c.g-dominant.g) + Math.abs(c.b-dominant.b);
      return Math.abs(h-dh) > 20 || dist > 90;
    }) || sorted[Math.min(1, sorted.length-1)];
    // Couleur accent : la plus saturée parmi les couleurs fréquentes
    const accent = sorted.slice(0, 12).sort((a,b)=> rgbToHsl(b.r,b.g,b.b)[1] - rgbToHsl(a.r,a.g,a.b)[1])[0] || dominant;

    const [dh2, ds2, dl2] = rgbToHsl(dominant.r, dominant.g, dominant.b);
    const [sh2, ss2, sl2] = rgbToHsl(secondary.r, secondary.g, secondary.b);
    const [ah2, as2, al2] = rgbToHsl(accent.r, accent.g, accent.b);

    return {
      dominant: hslCss(dh2, clamp(ds2, 0.35, 0.75), clamp(dl2, 0.26, 0.48)),
      secondary: hslCss(sh2, clamp(ss2, 0.28, 0.7), clamp(sl2, 0.16, 0.4)),
      accent: hslCss(ah2, clamp(as2, 0.45, 0.85), clamp(al2, 0.45, 0.66)),
      // "sombre" bornée entre 8% et 20% de luminosité : garantit un fond assez foncé
      // pour que le texte clair du lecteur reste toujours lisible par-dessus (accessibilité)
      dark: hslCss(dh2, clamp(ds2, 0.3, 0.55), clamp(Math.min(dl2, 0.2), 0.08, 0.2)),
      light: hslCss(dh2, clamp(ds2*0.55, 0.08, 0.35), clamp(Math.max(dl2, 0.68), 0.6, 0.8)),
    };
  }

  // Garde-fou mémoire : au-delà de cette taille (~1,8 Mo réels), on n'analyse pas l'image en direct.
  // Une photo de téléphone non compressée peut peser plusieurs Mo une fois décodée en mémoire ;
  // l'analyser en plus de son affichage normal peut faire planter l'onglet sur un appareil modeste.
  // Dans ce cas, la palette de secours est utilisée à la place — jamais de risque de plantage.
  const MAX_ANALYZABLE_LENGTH = 2500000;

  function extract(imageUrl){
    if(!imageUrl) return Promise.resolve(FALLBACK);
    if(cache.has(imageUrl)) return Promise.resolve(cache.get(imageUrl)); // déjà calculée : aucun recalcul
    if(typeof imageUrl === 'string' && imageUrl.length > MAX_ANALYZABLE_LENGTH){
      cache.set(imageUrl, FALLBACK);
      return Promise.resolve(FALLBACK);
    }
    return new Promise((resolve)=>{
      const finish = (palette)=>{ cache.set(imageUrl, palette); resolve(palette); };
      const legacyDecode = ()=>{
        // Repli pour navigateurs plus anciens ou en cas d'échec de la méthode économe ci-dessous
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = ()=>{ const sorted = quantize(img); finish(sorted ? buildPalette(sorted) : FALLBACK); };
        img.onerror = ()=> finish(FALLBACK);
        img.src = imageUrl;
      };
      if(!('createImageBitmap' in window)){ legacyDecode(); return; }
      fetch(imageUrl)
        .then(r=> r.blob())
        .then(blob=> createImageBitmap(blob, { resizeWidth:40, resizeHeight:40, resizeQuality:'low' }))
        .then(bitmap=>{
          const sorted = quantize(bitmap);
          if(bitmap.close) bitmap.close(); // libère immédiatement la mémoire du bitmap, pas d'attente du ramasse-miettes
          finish(sorted ? buildPalette(sorted) : FALLBACK);
        })
        .catch(legacyDecode);
    });
  }

  function forPaletteClass(palClass){
    // Palette de secours pour les pochettes générées (pal-1 à pal-6), cohérente avec leurs dégradés existants
    const map = {
      'pal-1': { dominant:'#6E45A8', secondary:'#141A38', accent:'#A98AD6', dark:'#141A38', light:'#A98AD6' },
      'pal-2': { dominant:'#D4AF6A', secondary:'#7A4E2A', accent:'#E8C77E', dark:'#3D2712', light:'#F2DDA8' },
      'pal-3': { dominant:'#C9667A', secondary:'#3A1530', accent:'#E497A8', dark:'#2A0F22', light:'#E9AFBC' },
      'pal-4': { dominant:'#1D2550', secondary:'#0A0A10', accent:'#8E63C9', dark:'#0A0A10', light:'#A98AD6' },
      'pal-5': { dominant:'#8E63C9', secondary:'#D4AF6A', accent:'#E8C77E', dark:'#2A1D40', light:'#F2DDA8' },
      'pal-6': { dominant:'#2E7D6B', secondary:'#0F2D27', accent:'#5FBBA0', dark:'#0F2D27', light:'#9FDFCC' },
    };
    return map[palClass] || FALLBACK;
  }

  function toGradientCss(palette, angle){
    return `linear-gradient(${angle || 135}deg, ${palette.dominant} 0%, ${palette.secondary} 100%)`;
  }

  return { extract, forPaletteClass, toGradientCss, FALLBACK };
})();

function fmt(s){ const m = Math.floor(s/60); const sec = String(Math.floor(s%60)).padStart(2,'0'); return `${m}:${sec}`; }

function applyCoverTo(el, tr){
  if(tr.cover){
    el.className = 'cover player-cover';
    el.style.backgroundImage = `url(${tr.cover})`;
    el.innerHTML = '';
  } else {
    el.style.backgroundImage = '';
    el.className = 'cover player-cover ' + tr.p;
    el.innerHTML = '<div class="cover-glyph pal-pattern"></div>';
  }
}

let listeningHistory = [];
let favoritesPlaylist = [];
/* ============ ÉCRAN VERROUILLÉ / CENTRE DE CONTRÔLE — vraie intégration MediaSession ============
   Avant : rien n'était branché, le téléphone affichait un titre générique et aucune vraie
   pochette sur l'écran verrouillé/les notifications média. L'API MediaSession (standard web,
   supportée par Safari iOS et Chrome Android) permet d'afficher les vraies infos et de
   contrôler la lecture depuis l'écran verrouillé, sans avoir besoin d'une app native. */
function updateMediaSession(tr){
  if(!('mediaSession' in navigator)) return;
  const artwork = tr.cover ? [
    { src: tr.cover, sizes: '96x96', type: 'image/jpeg' },
    { src: tr.cover, sizes: '256x256', type: 'image/jpeg' },
    { src: tr.cover, sizes: '512x512', type: 'image/jpeg' },
  ] : [
    { src: 'assets/logo-clean.png', sizes: '512x512', type: 'image/png' },
  ];
  navigator.mediaSession.metadata = new MediaMetadata({
    title: tr.t || 'NUNI',
    artist: tr.a || 'NUNI Music',
    album: tr.album || '',
    artwork,
  });
}
function setupMediaSessionHandlers(){
  if(!('mediaSession' in navigator)) return;
  navigator.mediaSession.setActionHandler('play', ()=>{ if(!playing) togglePlay(); });
  navigator.mediaSession.setActionHandler('pause', ()=>{ if(playing) togglePlay(); });
  navigator.mediaSession.setActionHandler('previoustrack', ()=> prevTrack());
  navigator.mediaSession.setActionHandler('nexttrack', ()=> nextTrack());
  try{
    navigator.mediaSession.setActionHandler('seekto', (details)=>{
      if(details.seekTime == null) return;
      elapsed = details.seekTime;
      if(usingRealAudio) realAudio.currentTime = elapsed;
      updateProgress();
    });
  }catch(e){ /* pas supporté sur tous les navigateurs, pas bloquant */ }
}
setupMediaSessionHandlers();

// ---------- Mini-lecteur : titre + artiste + featuring fusionnés sur une seule ligne ----------
// Avant : deux lignes séparées (titre en gras, artiste en dessous), et le featuring
// n'apparaissait nulle part sur le mini-lecteur alors qu'il existe bien en base (tr.featuring,
// renseigné par l'artiste lui-même). Maintenant : une seule ligne fluide "Titre · Artiste
// feat. X", avec un vrai défilement automatique (marquee) quand le texte est plus long que
// l'espace disponible — jamais de texte tronqué brutalement, jamais d'animation superflue
// pour un titre déjà court.
function updateMiniPlayerNowPlaying(tr){
  const track = document.getElementById('player-title-track');
  if(!track || !tr) return;
  const feat = tr.featuring ? `<span class="mp-feat">feat. ${tr.featuring}</span>` : '';
  track.innerHTML = `<span class="mp-title">${esc(tr.t)}</span><span class="mp-sep">·</span><span class="mp-artist">${esc(tr.a)}</span>${feat}`;
  // Le calcul du débordement doit attendre que le nouveau texte soit bien rendu dans le DOM.
  requestAnimationFrame(refreshMiniPlayerMarquee);
}
function refreshMiniPlayerMarquee(){
  const viewport = document.querySelector('.mp-marquee-viewport');
  const track = document.getElementById('player-title-track');
  if(!viewport || !track) return;
  // Toujours repartir de zéro pour ce nouveau texte — sinon le navigateur ne relance pas
  // proprement l'animation si elle était déjà active pour le morceau précédent.
  track.classList.remove('is-marquee');
  void track.offsetWidth; // force le recalcul de mise en page avant de relancer
  const overflow = track.scrollWidth > viewport.clientWidth + 2;
  if(overflow){
    // Vitesse de défilement constante quel que soit le débordement réel (texte plus long
    // = trajet plus long = animation plus longue), plutôt qu'une durée fixe qui accélérerait
    // artificiellement les titres très longs.
    const distance = track.scrollWidth - viewport.clientWidth;
    track.style.setProperty('--mp-marquee-distance', '-' + distance + 'px');
    track.style.setProperty('--mp-marquee-duration', Math.max(6, distance / 28) + 's');
    track.classList.add('is-marquee');
  } else {
    track.style.removeProperty('--mp-marquee-distance');
  }
}
window.addEventListener('resize', ()=> refreshMiniPlayerMarquee());

function playTrack(tr){
  // Avant : un vrai morceau (tr.isReal) sans lien audio (accès refusé côté serveur — voir
  // stripAudioIfNoAccess dans server.js : visiteur non connecté ou Pass expiré) basculait
  // silencieusement sur le mode "lecture simulée" des morceaux de démo — l'interface
  // affichait une barre de progression qui avance normalement, sans jamais produire de son,
  // sans jamais expliquer pourquoi. Maintenant : message clair, et jamais de fausse lecture.
  if(tr.isReal && tr.realId && !tr.audioUrl){
    if(!realAuthToken){
      toast('Connectez-vous pour écouter ce morceau en entier.');
      openLoginModal();
    } else if(currentUser && currentUser.plan === 'discovery' && !currentUser.email_verified){
      toast('Confirmez votre email pour débloquer l\'écoute de votre Pass Découverte.');
      openEmailVerifyModal();
    } else {
      toast('Votre Pass a expiré — réactivez-le pour continuer à écouter.');
      goTo('plans');
    }
    return;
  }
  // Un morceau change (manuellement, ou via le crossfade lui-même) : on annule tout
  // fondu enchaîné encore en cours pour ne jamais superposer deux transitions.
  if(djFadeTimer){ clearInterval(djFadeTimer); djFadeTimer = null; }
  if(djFadeAudio){ djFadeAudio.pause(); }
  djCrossfadeTriggered = false;

  currentTrack = tr;
  updateMiniPlayerNowPlaying(tr);
  applyCoverTo(document.getElementById('player-cover'), tr);
  syncLikeButtons(tr);
  updateMediaSession(tr);
  realAudio.volume = userVolume; // garantit un volume normal, même si un ducking DJ précédent n'a pas été restauré proprement

  // Petit mouvement de tête / pulsation des sourcils de l'avatar DJ à chaque changement de
  // morceau — seulement en mode DJ, là où l'avatar est visible et connecté.
  if(djMode && djAvatarInstance) djAvatarInstance.triggerTransition();
  if(djMode) djSpeak(false);

  listeningHistory.unshift({ track: tr, at: Date.now() });
  listeningHistory = listeningHistory.slice(0, 60);

  // Enregistre une vraie écoute (pour les statistiques et revenus de l'artiste) — jamais bloquant.
  if(tr.isReal && tr.realId){
    fetch(NUNI_API_BASE + '/api/tracks/' + tr.realId + '/play', {
      method:'POST',
      headers: realAuthToken ? {'Authorization':'Bearer ' + realAuthToken} : {}
    }).then(r=> r.json()).then(data=>{
      if(typeof data.streams === 'number'){
        tr.streams = String(data.streams);
        document.querySelectorAll('.track-card').forEach(card=>{
          if(card.dataset.trackId === String(tr.realId)){
            const streamsSpan = card.querySelector('.streams-count');
            if(streamsSpan) streamsSpan.textContent = data.streams; // absent pour un compte Consommateur — pas grave, rien à mettre à jour dans ce cas
          }
        });
      }
    }).catch(()=>{});
  }

  clearInterval(progressTimer);
  realAudio.pause();
  usingRealAudio = !!tr.audioUrl;
  elapsed = 0;
  duration = 204;
  if(usingRealAudio){
    realAudio.src = tr.audioUrl;
    realAudio.currentTime = 0;
    realAudio.playbackRate = playbackSpeed; // le navigateur remet sinon la vitesse à 1× à chaque nouveau morceau
    // Filet de sécurité supplémentaire : si un fondu/une baisse de volume DJ a été interrompu
    // au mauvais moment ailleurs, le volume aurait pu rester coincé bas — ici, chaque
    // nouveau morceau redémarre toujours au vrai niveau voulu par la personne.
    if(!djDuckRampTimer) realAudio.volume = userVolume;
    // Calé sur le même morceau pour la sphère audio "Tout" — élément séparé, muet, qui ne
    // touche jamais à realAudio ni à la lecture réelle (voir nuniSyncAnalysisAudio plus haut).
    nuniSyncAnalysisAudio(tr.audioUrl, 0);
  }
  updateProgress();
  syncFullPlayer();
  applyMusicAura(tr);
  playing = false;
  togglePlay();
}
// ---------- "Reprendre l'écoute" — relance le morceau puis saute à la vraie position
// laissée la dernière fois (jamais un saut à 0 suivi d'une correction visible). ----------
function resumeTrackAt(tr, seconds){
  playTrack(tr);
  if(!usingRealAudio) return;
  const seekToSavedPosition = ()=>{
    realAudio.currentTime = seconds;
    elapsed = seconds;
    updateProgress();
  };
  if(realAudio.readyState >= 1) seekToSavedPosition();
  else realAudio.addEventListener('loadedmetadata', seekToSavedPosition, { once:true });
}
function togglePlay(){
  playing = !playing;
  // Le mini-lecteur n'existe pas tant qu'aucun son n'a été lancé. Dès la première vraie
  // lecture, il apparaît (et le reste jusqu'à la déconnexion — voir stopAllPlayback()).
  if(playing){
    document.getElementById('player-bar').style.display = 'flex';
    document.documentElement.classList.add('has-player-bar'); // reflète sa vraie présence à l'écran, pas juste l'état play/pause — sert à ajuster le padding bas du contenu (voir style.css)
  }
  document.documentElement.classList.toggle('is-playing', playing);
  updateNowPlayingCards();
  if('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  const iconPath = playing
    ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'
    : '<path d="M8 5v14l11-7z"/>';
  document.getElementById('play-icon').innerHTML = iconPath;
  const fpIcon = document.getElementById('fp-play-icon');
  if(fpIcon) fpIcon.innerHTML = iconPath;
  if(usingRealAudio){
    if(playing){
      setPlayerLoadingState(true);
      // Branché une seule fois pour toute la session, dans le contexte du clic (requis par
      // les navigateurs) — voir ensureAudioAnalyser(). Tout ceci porte sur nuniAnalysisAudio,
      // l'élément fantôme muet : n'affecte jamais realAudio ni la lecture réelle, y compris
      // en arrière-plan sur iPhone.
      ensureAudioAnalyser();
      nuniResumeAudioContextIfNeeded();
      nuniSyncAnalysisAudio(realAudio.src, realAudio.currentTime);
      nuniAnalysisAudioPlayPause(true);
      realAudio.play().then(()=> setPlayerLoadingState(false)).catch(err => { setPlayerLoadingState(false); toast('Le navigateur a bloqué la lecture automatique — appuyez sur ▶ pour lancer le son manuellement.'); });
    } else {
      setPlayerLoadingState(false);
      realAudio.pause();
      nuniAnalysisAudioPlayPause(false);
    }
    return;
  }
  if(playing){
    progressTimer = setInterval(()=>{
      elapsed += 1;
      if(elapsed >= duration){ handleTrackEnded(); return; }
      updateProgress();
    }, 1000);
  } else {
    clearInterval(progressTimer);
  }
}
function updateProgress(){
  document.getElementById('time-elapsed').textContent = fmt(elapsed);
  document.getElementById('time-total').textContent = fmt(duration);
  document.getElementById('progress-fill').style.width = (elapsed/duration*100) + '%';
  const slimFill = document.getElementById('player-bar-slim-fill');
  if(slimFill) slimFill.style.width = (elapsed/duration*100) + '%';
  const fpFill = document.getElementById('fp-progress-fill');
  if(fpFill){
    const pct = (elapsed/duration*100);
    fpFill.style.width = pct + '%';
    const fpThumb = document.getElementById('fp-progress-thumb');
    if(fpThumb) fpThumb.style.left = pct + '%';
    document.getElementById('fp-time-elapsed').textContent = fmt(elapsed);
    document.getElementById('fp-time-total').textContent = fmt(duration);
  }
  updateLyricsHighlight();
  if('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && isFinite(duration) && duration > 0){
    try{ navigator.mediaSession.setPositionState({ duration, playbackRate: playbackSpeed || 1, position: Math.min(elapsed, duration) }); }catch(e){ /* pas bloquant */ }
  }
}
/* ============ MICRO-INTERACTIONS RÉUTILISABLES (ondes, rebonds, pulsations, haptique) ============ */
function spawnRipple(e, el){
  const rect = el.getBoundingClientRect();
  const x = (e.clientX ?? (rect.left + rect.width/2)) - rect.left;
  const y = (e.clientY ?? (rect.top + rect.height/2)) - rect.top;
  const span = document.createElement('span');
  span.className = 'nuni-ripple';
  span.style.setProperty('--rx', x + 'px');
  span.style.setProperty('--ry', y + 'px');
  el.appendChild(span);
  setTimeout(()=> span.remove(), 600);
}
document.addEventListener('click', (e)=>{
  const el = e.target.closest('.btn-icon, .fp-pill, .player-controls button, .artist-suggest-card button, #follow-btn, .genre-tile');
  if(el) spawnRipple(e, el);
}, true);
function bounceEl(el){ el.classList.remove('is-bouncing'); void el.offsetWidth; el.classList.add('is-bouncing'); setTimeout(()=> el.classList.remove('is-bouncing'), 520); }
function pulseEl(el){ el.classList.remove('is-pulsing'); void el.offsetWidth; el.classList.add('is-pulsing'); setTimeout(()=> el.classList.remove('is-pulsing'), 440); }
function hapticPing(){ if(navigator.vibrate){ try{ navigator.vibrate(12); }catch(e){} } }
function spawnFlyPing(fromEl, iconHtml){
  const rect = fromEl.getBoundingClientRect();
  const span = document.createElement('span');
  span.className = 'fp-fly-ping';
  span.innerHTML = iconHtml;
  span.style.left = (rect.left + rect.width/2) + 'px';
  span.style.top = (rect.top + rect.height/2) + 'px';
  document.body.appendChild(span);
  setTimeout(()=> span.remove(), 850);
}

function seek(e){
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  elapsed = Math.max(0, Math.min(duration, pct*duration));
  if(usingRealAudio) realAudio.currentTime = elapsed;
  updateProgress();
}
/* Barre de progression interactive : grossit au survol, affiche une pastille de temps, se laisse "scrubber" */
function setupFpProgressScrub(){
  const track = document.getElementById('fp-progress-track');
  const tip = document.getElementById('fp-scrub-tip');
  if(!track || !tip) return;
  let dragging = false;
  const posToTime = (clientX)=>{
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return { pct, time: pct * duration };
  };
  const showTip = (clientX)=>{
    const { pct, time } = posToTime(clientX);
    tip.textContent = fmt(time);
    tip.style.left = (pct*100) + '%';
    tip.classList.add('show');
  };
  const startDrag = (clientX)=>{
    dragging = true;
    track.classList.add('is-scrubbing');
    showTip(clientX);
    const { time } = posToTime(clientX);
    elapsed = Math.max(0, Math.min(duration, time));
    if(usingRealAudio) realAudio.currentTime = elapsed;
    updateProgress();
  };
  const moveDrag = (clientX)=>{
    if(!dragging) return;
    showTip(clientX);
    const { time } = posToTime(clientX);
    elapsed = Math.max(0, Math.min(duration, time));
    if(usingRealAudio) realAudio.currentTime = elapsed;
    updateProgress();
  };
  const endDrag = ()=>{
    if(!dragging) return;
    dragging = false;
    track.classList.remove('is-scrubbing');
    tip.classList.remove('show');
  };

  track.addEventListener('mousemove', (e)=>{ if(!dragging) showTip(e.clientX); });
  track.addEventListener('mouseleave', ()=>{ if(!dragging) tip.classList.remove('show'); });
  track.addEventListener('mousedown', (e)=> startDrag(e.clientX));
  window.addEventListener('mousemove', (e)=> moveDrag(e.clientX));
  window.addEventListener('mouseup', endDrag);

  // Avant : seuls les événements souris étaient gérés — impossible de faire glisser cette
  // barre au doigt sur mobile/tablette (le tap fonctionnait via seek(), mais jamais le
  // vrai glissé continu pour viser précisément un instant du morceau).
  track.addEventListener('touchstart', (e)=>{ startDrag(e.touches[0].clientX); }, { passive:true });
  track.addEventListener('touchmove', (e)=>{ moveDrag(e.touches[0].clientX); }, { passive:true });
  track.addEventListener('touchend', endDrag);
  track.addEventListener('touchcancel', endDrag);
}
setupFpProgressScrub();

/* ============ GLISSER VERS LE BAS POUR FERMER (lecteur plein écran) ============
   Avant : aucun geste tactile n'existait pour fermer le lecteur — seul le bouton flèche
   fonctionnait. Attaché uniquement à la barre du haut (fp-topbar), jamais à la zone de
   contenu défilante, pour ne jamais entrer en conflit avec le scroll normal (paroles, file
   d'attente, bio...). Suit vraiment le doigt en temps réel, avec un vrai seuil de fermeture
   basé sur la distance ET la vitesse du geste (comme sur une vraie app native). */
function setupFullPlayerSwipeToClose(){
  const topbar = document.querySelector('.fp-topbar');
  const panel = document.getElementById('full-player');
  if(!topbar || !panel) return;
  let startY = 0, startTime = 0, dragging = false;
  topbar.addEventListener('touchstart', (e)=>{
    startY = e.touches[0].clientY;
    startTime = Date.now();
    dragging = true;
    panel.style.transition = 'none';
  }, { passive:true });
  topbar.addEventListener('touchmove', (e)=>{
    if(!dragging) return;
    const dy = Math.max(0, e.touches[0].clientY - startY); // ne suit que vers le bas
    panel.style.transform = `translateY(${dy}px)`;
    panel.style.opacity = String(Math.max(0.4, 1 - dy / 600));
  }, { passive:true });
  const endSwipe = (e)=>{
    if(!dragging) return;
    dragging = false;
    panel.style.transition = '';
    const endY = (e.changedTouches && e.changedTouches[0].clientY) || startY;
    const dy = endY - startY;
    const elapsedMs = Date.now() - startTime;
    const velocity = dy / Math.max(elapsedMs, 1); // px/ms
    // Fermeture si glissé assez loin (>110px) OU geste rapide vers le bas (flick), même court.
    if(dy > 110 || (dy > 30 && velocity > 0.5)){
      closeFullPlayer();
    }
    panel.style.transform = '';
    panel.style.opacity = '';
  };
  topbar.addEventListener('touchend', endSwipe);
  topbar.addEventListener('touchcancel', endSwipe);
}
setupFullPlayerSwipeToClose();

/* ============ GLISSER VERS LE BAS POUR FERMER — réutilisable pour toutes les fenêtres
   plein écran (catégories, playlists, Top 100, vue album, lecteur de clip). Ne se déclenche
   que si on part du tout haut de la fenêtre (scrollTop à 0), pour ne jamais gêner le
   défilement normal du contenu en dessous. */
function attachSwipeDownToClose(overlay, closeFn){
  if(!overlay) return;
  let startY = 0, startTime = 0, dragging = false;
  overlay.addEventListener('touchstart', (e)=>{
    if(overlay.scrollTop > 4) return; // pas tout en haut : geste normal de défilement, pas de fermeture
    startY = e.touches[0].clientY;
    startTime = Date.now();
    dragging = true;
  }, { passive:true });
  overlay.addEventListener('touchmove', (e)=>{
    if(!dragging) return;
    const dy = e.touches[0].clientY - startY;
    if(dy < 0){ dragging = false; return; } // remonte : on laisse faire, ce n'est pas un geste de fermeture
    overlay.style.transform = `translateY(${dy}px)`;
    overlay.style.opacity = String(Math.max(0.4, 1 - dy / 600));
  }, { passive:true });
  const endSwipe = (e)=>{
    if(!dragging) return;
    dragging = false;
    const endY = (e.changedTouches && e.changedTouches[0].clientY) || startY;
    const dy = endY - startY;
    const velocity = dy / Math.max(Date.now() - startTime, 1);
    overlay.style.transform = '';
    overlay.style.opacity = '';
    if(dy > 110 || (dy > 30 && velocity > 0.5)) closeFn();
  };
  overlay.addEventListener('touchend', endSwipe);
  overlay.addEventListener('touchcancel', endSwipe);
}
let userVolume = 1; // vrai niveau voulu par la personne — jamais écrasé par le ducking du DJ
try{
  const savedVolume = parseFloat(localStorage.getItem('nuni_volume'));
  if(!isNaN(savedVolume) && savedVolume >= 0 && savedVolume <= 1){ userVolume = savedVolume; realAudio.volume = savedVolume; }
}catch(e){ /* stockage indisponible : on garde le volume par défaut, pas bloquant */ }
document.querySelectorAll('#volume-fill, #volume-fill-fp').forEach(v=> v.style.width = (userVolume*100) + '%');
function setVolume(e){
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  document.querySelectorAll('#volume-fill, #volume-fill-fp').forEach(v=> v.style.width = (pct*100) + '%');
  realAudio.volume = pct;
  userVolume = pct;
  try{ localStorage.setItem('nuni_volume', String(pct)); }catch(e){ /* pas bloquant */ }
}
let genreRadioFilter = null;
function getCurrentPlaybackPool(){
  // Le lecteur ne doit jamais avancer sur une maquette de démonstration sans vrai fichier
  // audio (silence simulé) — uniquement de vrais morceaux publiés sur NUNI.
  const realTracks = tracks.filter(t=>t.isReal);
  return genreRadioFilter ? realTracks.filter(t=>t.genre===genreRadioFilter) : realTracks;
}
// En mode DJ, avance dans la vraie file mélangée de l'ambiance choisie (djQueue) plutôt que
// dans le catalogue entier — avant, dès le 2e morceau, le DJ "oubliait" son ambiance et
// repassait sur n'importe quel morceau du catalogue, dans l'ordre brut. Quand la file est
// épuisée, elle est re-mélangée pour continuer indéfiniment sans jamais se répéter à
// l'identique d'un tour à l'autre (et sans recoller le dernier morceau joué au premier du tour suivant).
function djAdvanceQueue(){
  djQueuePos++;
  if(djQueuePos >= djQueue.length){
    const m = djModes.find(x=>x.id===djModeId);
    const last = djQueue[djQueue.length-1];
    const reshuffled = m.filter();
    if(reshuffled.length > 1 && reshuffled[0].t === last.t && reshuffled[0].a === last.a){
      reshuffled.push(reshuffled.shift());
    }
    djQueue = reshuffled;
    djQueuePos = 0;
  }
  return djQueue[djQueuePos];
}
// Fin naturelle d'un morceau : respecte "Répéter" (relance le même son). Le bouton "Suivant"
// cliqué manuellement, lui, avance toujours réellement — comme sur Spotify/Apple Music,
// "Répéter" n'empêche jamais un skip volontaire, seulement la fin naturelle du morceau.
function handleTrackEnded(){
  if(repeatOn){ playTrack(currentTrack); return; }
  nextTrack();
}
function nextTrack(){
  if(djMode && djQueue.length){
    playTrack(djAdvanceQueue());
    return;
  }
  // La vraie file d'attente personnelle est toujours prioritaire sur la suggestion
  // automatique — c'est justement le but d'y ajouter un morceau soi-même.
  if(userQueue.length){
    const next = userQueue.shift();
    playTrack(next);
    return;
  }
  const pool = getCurrentPlaybackPool();
  if(shuffleOn && pool.length > 1){
    // Vraie lecture aléatoire — jamais le même morceau deux fois de suite par hasard.
    let next;
    do{ next = pool[Math.floor(Math.random() * pool.length)]; } while(next.t === currentTrack.t && pool.length > 1);
    playTrack(next);
    return;
  }
  const i = pool.findIndex(t=>t.t===currentTrack.t);
  playTrack(pool[(i+1) % pool.length] || pool[0]);
}
function prevTrack(){
  if(djMode && djQueue.length){
    djQueuePos = (djQueuePos - 1 + djQueue.length) % djQueue.length;
    playTrack(djQueue[djQueuePos]);
    return;
  }
  const pool = getCurrentPlaybackPool();
  const i = pool.findIndex(t=>t.t===currentTrack.t);
  playTrack(pool[(i-1+pool.length) % pool.length] || pool[0]);
}
function syncLikeButtons(tr){
  const isLiked = favoritesPlaylist.some(f=> f.t === tr.t);
  document.querySelectorAll('#player-like-btn, #fp-like-btn').forEach(b=> b.classList.toggle('liked', isLiked));
}
async function toggleLike(btn, trackOverride){
  // Avant : cette fonction dépendait toujours de la variable globale currentTrack — impossible
  // de liker un morceau depuis un menu (ex: le "..." d'une carte) sans risquer de liker le
  // morceau ACTUELLEMENT EN LECTURE à la place. Le second paramètre permet de cibler
  // précisément le bon morceau, currentTrack restant le comportement par défaut.
  const tr = trackOverride || currentTrack;
  bounceEl(btn);
  hapticPing();

  // Morceau réel + compte connecté : vrai like persisté en base, partagé entre tous vos
  // appareils. Avant, ceci ne touchait jamais le serveur — un simple tableau en mémoire,
  // remis à zéro à chaque rechargement de page.
  if(tr.isReal && tr.realId && realAuthToken){
    btn.disabled = true;
    try{
      const res = await fetch(NUNI_API_BASE + '/api/tracks/' + tr.realId + '/like', {
        method:'POST', headers:{ 'Authorization':'Bearer ' + realAuthToken }
      });
      const data = await res.json();
      btn.disabled = false;
 if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
      tr.likes = data.likes;
      if(data.liked){
        tr.likedAt = Date.now(); // vrai instant de l'ajout, confirmé par le serveur juste au-dessus
        if(!favoritesPlaylist.find(t=>t.t===tr.t)) favoritesPlaylist.unshift(tr);
        spawnFlyPing(btn, '<svg class="nuni-ic filled nuni-ic-err" viewBox="0 0 24 24" style="width:28px;height:28px;"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>');
      } else {
        favoritesPlaylist = favoritesPlaylist.filter(t=>t.t!==tr.t);
      }
      if(tr === currentTrack) syncLikeButtons(tr);
      renderLibraryRecentGrid(); // rafraîchit "Ajouts récents" tout de suite, sans attendre un rechargement
      document.querySelectorAll('.track-card').forEach(card=>{
        if(card.dataset.trackId === String(tr.realId)){
          const likeSpan = card.querySelector('.likes-count');
          if(likeSpan) likeSpan.textContent = formatLikes(data.likes);
        }
      });
      toast(data.liked ? 'Ajouté à votre playlist Favoris — visible dans Bibliothèque.' : 'Retiré de votre playlist Favoris.');
    }catch(e){
      btn.disabled = false;
 toast(' Impossible de contacter le serveur NUNI.');
    }
    return;
  }

  // Morceau de démonstration, ou visiteur non connecté : comportement local uniquement,
  // comme avant (pas de vrai compte pour rattacher un like persistant).
  const willLike = !btn.classList.contains('liked');
  if(willLike){
    if(!favoritesPlaylist.find(t=>t.t===tr.t)) favoritesPlaylist.unshift(tr);
    spawnFlyPing(btn, '<svg class="nuni-ic filled nuni-ic-err" viewBox="0 0 24 24" style="width:28px;height:28px;"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>');
  } else {
    favoritesPlaylist = favoritesPlaylist.filter(t=>t.t!==tr.t);
  }
  if(tr === currentTrack) syncLikeButtons(tr);
  toast(willLike ? 'Ajouté à votre playlist Favoris — visible dans Bibliothèque.' : 'Retiré de votre playlist Favoris.');
}
/* Avant : ces deux boutons ne faisaient QUE changer leur propre couleur (juste celui cliqué,
   mini-lecteur et plein écran désynchronisés entre eux) — aucun effet réel sur la lecture.
   Ici : un vrai état partagé, qui influence vraiment nextTrack() et la fin de lecture, et
   les deux boutons (mini + plein écran) restent toujours synchronisés visuellement. */
let shuffleOn = false;
let repeatOn = false;
function syncShuffleRepeatButtons(){
  document.querySelectorAll('[aria-label="Lecture aléatoire"]').forEach(b=> b.classList.toggle('is-toggled-on', shuffleOn));
  document.querySelectorAll('[aria-label="Répéter"]').forEach(b=> b.classList.toggle('is-toggled-on', repeatOn));
}
function shuffleToggle(btn){
  shuffleOn = !shuffleOn;
  syncShuffleRepeatButtons();
  if(shuffleOn){ pulseEl(btn); hapticPing(); toast('Lecture aléatoire activée.'); }
  else{ toast('Lecture aléatoire désactivée.'); }
}
function repeatToggle(btn){
  repeatOn = !repeatOn;
  syncShuffleRepeatButtons();
  if(repeatOn){ pulseEl(btn); hapticPing(); toast('Répéter ce morceau activé.'); }
  else{ toast('Répéter désactivé.'); }
}
function toggleFollow(btn){
 const following = btn.textContent.trim() === 'Suivi ';
  bounceEl(btn);
  if(currentArtistPageRealId && realAuthToken){
    btn.disabled = true;
    fetch(NUNI_API_BASE + '/api/follow', {
      method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({ artistId: currentArtistPageRealId })
    }).then(r=>r.json()).then(data=>{
      btn.disabled = false;
 if(data.error){ toast(' ' + data.error); return; }
 btn.textContent = data.following ? 'Suivi ' : 'Suivre';
      btn.classList.toggle('is-following', !!data.following);
      if(data.following) hapticPing();
      // Le cache Bibliothèque (artistes suivis) est invalidé pour se resynchroniser avec la
      // vraie date de suivi renvoyée par le serveur — sinon "Ajouts récents" et l'onglet
      // Artistes continueraient d'afficher l'ancienne liste jusqu'au prochain rechargement.
      libraryArtistsCache = null;
      renderLibraryRecentGrid();
      // Le compteur de followers affiché sur le profil se met à jour tout de suite, sans
      // attendre un rechargement — avant, ce chiffre renvoyé par le serveur était ignoré.
      const statFollowersEl = document.getElementById('artist-stat-followers');
      if(statFollowersEl && typeof data.followersCount === 'number') statFollowersEl.textContent = data.followersCount.toLocaleString('fr-FR');
      toast(data.following ? 'Vous suivez maintenant cet artiste.' : 'Vous ne suivez plus cet artiste.');
 }).catch(()=>{ btn.disabled = false; toast(' Impossible de contacter le serveur NUNI.'); });
    return;
  }
 btn.textContent = following ? 'Suivre' : 'Suivi ';
  btn.classList.toggle('is-following', !following);
  toast(following ? 'Vous ne suivez plus Bibi Mwana.' : 'Vous suivez maintenant Bibi Mwana.');
}
/* Avant : ce réglage n'était jamais mémorisé — un artiste qui masquait ses revenus pour la
   confidentialité les revoyait affichés au rechargement suivant, sans s'en rendre compte.
   Plus sensible qu'un simple confort (vraie question de vie privée), donc mémorisé comme
   thème/langue/volume. */
const NUNI_REVENUE_PRIVACY_KEY = 'nuni_revenue_hidden';
function toggleRevenuePrivacy(){
  const btn = document.getElementById('privacy-toggle');
  const hidden = !btn.classList.contains('is-on');
  btn.classList.toggle('is-on', hidden);
  document.querySelectorAll('.revenue-figure .val').forEach(v=> v.classList.toggle('is-hidden', hidden));
  try{ localStorage.setItem(NUNI_REVENUE_PRIVACY_KEY, hidden ? '1' : '0'); }catch(e){ /* pas bloquant */ }
  toast(hidden ? 'Vos revenus sont désormais masqués sur votre profil public.' : 'Vos revenus sont de nouveau visibles.');
}
function applySavedRevenuePrivacy(){
  let hidden = false;
  try{ hidden = localStorage.getItem(NUNI_REVENUE_PRIVACY_KEY) === '1'; }catch(e){}
  const btn = document.getElementById('privacy-toggle');
  if(!btn) return;
  btn.classList.toggle('is-on', hidden);
  document.querySelectorAll('.revenue-figure .val').forEach(v=> v.classList.toggle('is-hidden', hidden));
}

/* ============ IMPORT FICHIERS (musique & photos) ============ */
let currentReleaseType = 'Single';
function setReleaseType(btn){
  document.querySelectorAll('.rt-btn').forEach(b=> b.classList.remove('is-active'));
  btn.classList.add('is-active');
  currentReleaseType = btn.dataset.type;
  document.getElementById('release-type-echo').textContent = currentReleaseType.toLowerCase();
}
let pendingCoverFile = null;
function handleReleaseCover(e){
  const file = e.target.files[0];
  if(!file) return;
  pendingCoverFile = file;
  const reader = new FileReader();
  reader.onload = ()=>{
    const preview = document.getElementById('release-cover-preview');
    preview.style.backgroundImage = `url(${reader.result})`;
    preview.innerHTML = '';
    toast(`Pochette sélectionnée pour votre ${currentReleaseType.toLowerCase()}.`);
  };
  reader.readAsDataURL(file); // uniquement pour l'aperçu visuel — le vrai fichier est gardé dans pendingCoverFile
  e.target.value = '';
}

/* ============ UPLOAD DIRECT NAVIGATEUR → CLOUDINARY ============
   Les gros fichiers (audio, vidéo) partent DIRECTEMENT vers Cloudinary depuis le navigateur,
   sans jamais être convertis en base64 ni transiter par notre serveur. Ça évite les plantages
   "Out of Memory" sur les fichiers volumineux (WAV, FLAC, clips de plusieurs dizaines de Mo).
   Le serveur ne fournit qu'une signature temporaire, sans jamais exposer de clé secrète. */
async function uploadFileToCloudinary(file, resourceType, onProgress){
  if(!realAuthToken) throw new Error('Connectez-vous pour publier un fichier.');
  const sigRes = await fetch(NUNI_API_BASE + '/api/upload-signature', {
    headers: { 'Authorization': 'Bearer ' + realAuthToken }
  });
  if(!sigRes.ok){
    const err = await sigRes.json().catch(()=>({}));
    throw new Error(err.error || 'Impossible d\'obtenir une autorisation d\'envoi.');
  }
  const sig = await sigRes.json();

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', sig.timestamp);
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);

  return new Promise((resolve, reject)=>{
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`);
    xhr.upload.onprogress = (e)=>{
      if(onProgress && e.lengthComputable) onProgress(Math.round((e.loaded/e.total)*100));
    };
    xhr.onload = ()=>{
      if(xhr.status >= 200 && xhr.status < 300){
        try{ resolve(JSON.parse(xhr.responseText).secure_url); }
        catch(err){ reject(new Error('Réponse Cloudinary illisible.')); }
      } else {
        reject(new Error('Envoi refusé par Cloudinary (statut ' + xhr.status + ').'));
      }
    };
    xhr.onerror = ()=> reject(new Error('Connexion à Cloudinary impossible.'));
    xhr.send(form);
  });
}

/* ============ CLIPS — publication + système aléatoire ============ */
let clips = [];
let pendingClipVideoFile = null;
let pendingClipThumbFile = null;
function handleClipThumb(e){
  const file = e.target.files[0];
  if(!file) return;
  pendingClipThumbFile = file;
  const reader = new FileReader();
  reader.onload = ()=>{
    const preview = document.getElementById('clip-thumb-preview');
    preview.style.backgroundImage = `url(${reader.result})`;
    preview.innerHTML = '';
  };
  reader.readAsDataURL(file); // uniquement pour l'aperçu visuel
  e.target.value = '';
}
function handleClipVideo(e){
  const file = e.target.files[0];
  if(!file) return;
  pendingClipVideoFile = file;
  const status = document.getElementById('clip-upload-status');
  const sizeMb = (file.size / (1024*1024)).toFixed(1);
  status.innerHTML = `<div class="upload-item"><div class="ui-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 10l5-3v10l-5-3M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/></svg></div><div class="ui-info"><div class="ui-name">${esc(file.name)} (${sizeMb} Mo)</div></div><div class="ui-status" style="color:var(--accent)">Prêt à publier</div></div>`;
  if(!document.getElementById('clip-title-input').value) document.getElementById('clip-title-input').value = file.name.replace(/\.[^/.]+$/, '');
}
async function publishClip(){
  const title = document.getElementById('clip-title-input').value.trim();
  const thumbPreview = document.getElementById('clip-thumb-preview');
  const thumbData = thumbPreview.style.backgroundImage;
  const hasThumb = thumbData && thumbData !== '';
  if(!pendingClipVideoFile){ toast('Importez un fichier vidéo avant de publier.'); return; }
  if(!title){ toast('Donnez un titre à votre clip avant de publier.'); return; }
  if(!hasThumb || !pendingClipThumbFile){ toast('Choisissez une miniature avant de publier.'); return; }

  const thumbPreviewUrl = thumbData.slice(5, -2); // aperçu local immédiat, en attendant l'envoi réel
  const artistDisplayName = (currentUser && currentUser.artist_name) ? currentUser.artist_name : 'Bibi Mwana';
  const localVideoUrl = URL.createObjectURL(pendingClipVideoFile);
  const newClip = {
    id: 'clip_' + Date.now(), title, artist: artistDisplayName, thumb: thumbPreviewUrl,
    videoUrl: localVideoUrl, views: 0,
    likes: 0, date: new Date().toLocaleDateString('fr-FR', {day:'2-digit', month:'short'}), dur:'—:—'
  };
  clips.unshift(newClip);
  renderClips();
  renderArtistClips(artistDisplayName);

  const videoFile = pendingClipVideoFile;
  const thumbFile = pendingClipThumbFile;
  document.getElementById('clip-title-input').value = '';
  document.getElementById('clip-upload-status').innerHTML = '';
  pendingClipVideoFile = null;
  pendingClipThumbFile = null;
  thumbPreview.style.backgroundImage = '';
  thumbPreview.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 16l4.5-4.5a2 2 0 0 1 2.8 0L16 16M14 14l1.5-1.5a2 2 0 0 1 2.8 0L20 14M4 6h16v12H4z"/></svg>';

  // Envoi réel au serveur NUNI, pour que le clip soit visible par tous les auditeurs
  if(!realAuthToken){
    toast(`Clip "${title}" visible uniquement dans votre navigateur (connectez-vous pour le partager avec tous).`);
    return;
  }
  toast(`Clip "${title}" — envoi vers Cloudinary en cours…`);
  try{
    const [thumbUrl, videoUrl] = await Promise.all([
      uploadFileToCloudinary(thumbFile, 'image'),
      uploadFileToCloudinary(videoFile, 'video'),
    ]);
    const res = await fetch(NUNI_API_BASE + '/api/clips', {
      method:'POST',
      headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({ title, thumbUrl, videoUrl })
    });
    if(res.ok){
      toast(`Clip "${title}" bien envoyé sur le serveur NUNI — visible par tous les auditeurs.`);
      loadRealClips();
    } else {
      const err = await res.json().catch(()=>({}));
 toast(` Le clip n'a pas pu être envoyé au serveur : ${err.error || 'erreur inconnue'}. Il reste visible uniquement dans votre navigateur.`);
    }
  }catch(e){
 toast(' Impossible de contacter le serveur — le clip reste visible uniquement dans votre navigateur (vidéo peut-être trop lourde).');
  }
}
function ensureClipWatchStyles(){
  if(document.getElementById('nuni-clipwatch-styles')) return;
  const style = document.createElement('style');
  style.id = 'nuni-clipwatch-styles';
  style.textContent = `
    #clip-watch-overlay{position:fixed; inset:0; z-index:9999; background:#0A0A10; overflow-y:auto; opacity:0; transition:opacity .25s ease;}
    #clip-watch-overlay.show{opacity:1;}
    .cw-close{position:fixed; top:calc(18px + env(safe-area-inset-top,0)); right:22px; width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14); color:#fff; font-size:17px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center;}
    .cw-close:hover{background:rgba(255,255,255,0.16);}
    .cw-wrap{max-width:1360px; margin:0 auto; padding:60px 24px 80px; display:grid; grid-template-columns:minmax(0,1fr) 380px; gap:32px; align-items:start;}
    .cw-main{min-width:0;}
    .cw-sidebar{min-width:0;}
    @media (max-width:960px){ .cw-wrap{grid-template-columns:1fr;} }
    .cw-video-wrap{width:100%; aspect-ratio:16/9; background:#000; border-radius:14px; overflow:hidden; display:flex; align-items:center; justify-content:center; box-shadow:0 20px 50px rgba(0,0,0,0.5);}
    .cw-video-wrap video{width:100%; height:100%; object-fit:contain; background:#000;}
    .cw-video-placeholder{color:#6b6b78; font-size:14px; text-align:center; padding:24px;}
    .cw-title{color:#fff; font-size:20px; font-weight:800; margin:18px 0 4px; line-height:1.3;}
    .cw-meta{color:#8a8a94; font-size:13px; margin-bottom:16px;}
    .cw-subrow{display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; padding:14px 0; border-top:1px solid rgba(255,255,255,0.08); border-bottom:1px solid rgba(255,255,255,0.08);}
    .cw-artist-block{display:flex; align-items:center; gap:12px; cursor:pointer;}
    .cw-avatar{width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,#6E45A8,#D4AF6A); display:flex; align-items:center; justify-content:center; color:#0A0A10; font-weight:700; font-size:15px; flex-shrink:0;}
    .cw-artist-name{color:#fff; font-weight:700; font-size:14.5px;}
    .cw-follow-btn{background:#fff; color:#0A0A10; border:none; border-radius:20px; padding:8px 18px; font-weight:700; font-size:13px; cursor:pointer; white-space:nowrap;}
    .cw-follow-btn.is-following{background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.25);}
    .cw-actions{display:flex; gap:10px;}
    .cw-related-title{color:#fff; font-size:15px; font-weight:700; margin:0 0 14px;}
    .cw-related-item{display:flex; gap:12px; padding:8px; border-radius:10px; cursor:pointer; transition:background .15s ease;}
    .cw-related-item:hover{background:rgba(255,255,255,0.05);}
    .cw-related-thumb{width:130px; height:74px; border-radius:8px; background-size:cover; background-position:center; flex-shrink:0; position:relative; overflow:hidden;}
    .cw-related-thumb .dur{position:absolute; bottom:4px; right:5px; background:rgba(0,0,0,0.75); color:#fff; font-size:10px; padding:1px 5px; border-radius:4px; font-family:var(--font-data, monospace);}
    .cw-related-info .t{color:#eee; font-size:13.5px; font-weight:600; line-height:1.35; margin-bottom:4px;}
    .cw-related-info .a{color:#8a8a94; font-size:12px;}
  `;
  document.head.appendChild(style);
}
function openClipWatchPage(clip){
  ensureClipWatchStyles();
  // Une seule source multimédia active à la fois : si un morceau audio joue, on le met en
  // pause avant de lancer la vidéo (sinon les deux sons se superposent).
  if(playing) togglePlay();
  setImmersiveMode(true);
  if(clip.isReal && clip.realId){
    fetch(NUNI_API_BASE + '/api/clips/' + clip.realId + '/view', {
      method:'POST',
      headers: realAuthToken ? {'Authorization':'Bearer ' + realAuthToken} : {}
    }).then(r=> r.json()).then(data=>{
      // Le serveur renvoie le vrai total à jour (compté ou pas selon les règles anti-triche/doublon).
      // On met à jour partout où ce chiffre est affiché, sans attendre un rechargement de page.
      if(typeof data.views === 'number'){
        clip.views = data.views;
        const metaEl = document.querySelector('#clip-watch-overlay .cw-meta');
        if(metaEl) metaEl.textContent = `${formatLikes(clip.views)} vues · ${clip.date || "aujourd'hui"}`;
        document.querySelectorAll('.clip-card').forEach(card=>{
          if(card.dataset.clipId === String(clip.id)){
            const viewsSpan = card.querySelector('.meta span');
 if(viewsSpan) viewsSpan.textContent = ` ️ ${formatLikes(clip.views)} vues`;
          }
        });
      }
    }).catch(()=>{});
  } else {
    clip.views = (clip.views || 0) + 1; // clips de démonstration uniquement : compteur local simple
  }
  let overlay = document.getElementById('clip-watch-overlay');
  if(overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'clip-watch-overlay';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const closeOverlay = ()=>{
    const v = overlay.querySelector('video');
    if(v) v.pause();
    overlay.classList.remove('show');
    document.body.style.overflow = '';
    setImmersiveMode(false);
    setTimeout(()=> overlay.remove(), 200);
  };

  const initials = clip.artist.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const avatarInner = clip.artistAvatarUrl
    ? `style="background-image:url(${clip.artistAvatarUrl}); background-size:cover; background-position:center;"`
    : '';
  const videoInner = clip.videoUrl
    ? `<video src="${clip.videoUrl}" controls autoplay playsinline></video>`
    : `<div class="cw-video-placeholder"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg> Aperçu vidéo non fourni pour ce clip de démonstration.</div>`;

  overlay.innerHTML = `
    <button class="cw-close" title="Fermer"><svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    <div class="cw-wrap">
      <div class="cw-main">
        <div class="cw-video-wrap">${videoInner}</div>
        <div class="cw-title">${esc(clip.title)}</div>
        <div class="cw-meta">${formatLikes(clip.views)} vues · ${clip.date || "aujourd'hui"}</div>
        <div class="cw-subrow">
          <div class="cw-artist-block">
            <div class="cw-avatar" ${avatarInner}>${clip.artistAvatarUrl ? '' : initials}</div>
            <div class="cw-artist-name">${esc(clip.artist)}</div>
            <button class="cw-follow-btn">Suivre</button>
          </div>
          <div class="cw-actions">
            <button class="av-icon-btn cw-like-btn" title="J'aime">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
              <span class="cw-reaction-count">${clip.likes ? formatLikes(clip.likes) : ''}</span>
            </button>
            <button class="av-icon-btn cw-dislike-btn" title="Je n'aime pas">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transform:scaleY(-1);"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
              <span class="cw-reaction-count">${clip.dislikes ? formatLikes(clip.dislikes) : ''}</span>
            </button>
            <button class="av-icon-btn cw-share-btn" title="Partager"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-3.9M8.6 13.5l6.8 3.9"/></svg></button>
          </div>
        </div>
      </div>
      <div class="cw-sidebar">
        <div class="cw-related-title">À suivre</div>
        <div class="cw-related-list"></div>
      </div>
    </div>
  `;
  ensureBadgeStyles(); // réutilise av-icon-btn déjà stylé par l'album view

  overlay.querySelector('.cw-close').onclick = closeOverlay;
  overlay.querySelector('.cw-artist-block').onclick = (e)=>{
    if(e.target.closest('.cw-follow-btn')) return;
    closeOverlay();
    openArtistPage(clip.artist, clip.artistId);
  };
  const followBtn = overlay.querySelector('.cw-follow-btn');
  // Avant : ce bouton ne faisait QUE basculer une classe locale et afficher "Vous suivez
  // maintenant..." — un faux message de succès, aucun vrai suivi n'était jamais enregistré
  // en base. Corrigé pour de vrai, même comportement que partout ailleurs sur NUNI.
  if(realAuthToken && clip.artistId){
    fetch(NUNI_API_BASE + '/api/follow/' + clip.artistId + '/status', { headers:{ 'Authorization':'Bearer ' + realAuthToken } })
 .then(r=>r.json()).then(d=>{ followBtn.textContent = d.following ? 'Suivi ' : 'Suivre'; followBtn.classList.toggle('is-following', d.following); })
      .catch(()=>{});
  }
  followBtn.onclick = async (e)=>{
    e.stopPropagation();
    if(!realAuthToken || !clip.artistId){ toast('Connectez-vous pour suivre un artiste.'); return; }
    followBtn.disabled = true;
    try{
      const res = await fetch(NUNI_API_BASE + '/api/follow', {
        method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
        body: JSON.stringify({ artistId: clip.artistId })
      });
      const data = await res.json();
      followBtn.disabled = false;
 if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
      followBtn.classList.toggle('is-following', data.following);
 followBtn.textContent = data.following ? 'Suivi ' : 'Suivre';
      toast(data.following ? `Vous suivez maintenant ${clip.artist}.` : `Vous ne suivez plus ${clip.artist}.`);
 }catch(e){ followBtn.disabled = false; toast(' Impossible de contacter le serveur NUNI.'); }
  };
  const likeBtn = overlay.querySelector('.cw-like-btn');
  const dislikeBtn = overlay.querySelector('.cw-dislike-btn');

  // Précharge le vrai statut (déjà aimé / déjà pas-aimé) pour afficher les bons boutons actifs
  // dès l'ouverture, plutôt que de toujours repartir de zéro visuellement.
  if(clip.isReal && clip.realId && realAuthToken){
    fetch(NUNI_API_BASE + '/api/clips/' + clip.realId + '/my-reaction', {
      headers:{ 'Authorization':'Bearer ' + realAuthToken }
    }).then(r=>r.json()).then(data=>{
      likeBtn.classList.toggle('is-active', !!data.liked);
      dislikeBtn.classList.toggle('is-active', !!data.disliked);
    }).catch(()=>{});
  }

  likeBtn.onclick = async ()=>{
    bounceEl(likeBtn);
    hapticPing();
    if(clip.isReal && clip.realId && realAuthToken){
      likeBtn.disabled = true; dislikeBtn.disabled = true;
      try{
        const res = await fetch(NUNI_API_BASE + '/api/clips/' + clip.realId + '/like', {
          method:'POST', headers:{ 'Authorization':'Bearer ' + realAuthToken }
        });
        const data = await res.json();
        likeBtn.disabled = false; dislikeBtn.disabled = false;
 if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
        clip.likes = data.likes; clip.dislikes = data.dislikes;
        likeBtn.classList.toggle('is-active', data.liked);
        dislikeBtn.classList.remove('is-active'); // exclusion mutuelle
        likeBtn.querySelector('.cw-reaction-count').textContent = clip.likes ? formatLikes(clip.likes) : '';
        dislikeBtn.querySelector('.cw-reaction-count').textContent = clip.dislikes ? formatLikes(clip.dislikes) : '';
 }catch(e){ likeBtn.disabled = false; dislikeBtn.disabled = false; toast(' Impossible de contacter le serveur NUNI.'); }
      return;
    }
    // Clip de démonstration, ou visiteur non connecté : comportement local uniquement
    const liked = likeBtn.classList.toggle('is-active');
    clip.likes += liked ? 1 : -1;
    if(liked) dislikeBtn.classList.remove('is-active');
  };

  dislikeBtn.onclick = async ()=>{
    bounceEl(dislikeBtn);
    hapticPing();
    if(clip.isReal && clip.realId && realAuthToken){
      likeBtn.disabled = true; dislikeBtn.disabled = true;
      try{
        const res = await fetch(NUNI_API_BASE + '/api/clips/' + clip.realId + '/dislike', {
          method:'POST', headers:{ 'Authorization':'Bearer ' + realAuthToken }
        });
        const data = await res.json();
        likeBtn.disabled = false; dislikeBtn.disabled = false;
 if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
        clip.likes = data.likes; clip.dislikes = data.dislikes;
        dislikeBtn.classList.toggle('is-active', data.disliked);
        likeBtn.classList.remove('is-active'); // exclusion mutuelle
        likeBtn.querySelector('.cw-reaction-count').textContent = clip.likes ? formatLikes(clip.likes) : '';
        dislikeBtn.querySelector('.cw-reaction-count').textContent = clip.dislikes ? formatLikes(clip.dislikes) : '';
 }catch(e){ likeBtn.disabled = false; dislikeBtn.disabled = false; toast(' Impossible de contacter le serveur NUNI.'); }
      return;
    }
    const disliked = dislikeBtn.classList.toggle('is-active');
    clip.dislikes = (clip.dislikes || 0) + (disliked ? 1 : -1);
    if(disliked) likeBtn.classList.remove('is-active');
  };
  overlay.querySelector('.cw-share-btn').onclick = ()=>{
 toast('Lien du clip copié — partagez-le où vous voulez ️');
  };

  const related = clips.filter(c=>c!==clip).sort((a,b)=>{
    const aSame = a.artist===clip.artist ? 0 : 1;
    const bSame = b.artist===clip.artist ? 0 : 1;
    return aSame - bSame;
  }).slice(0, 8);
  const relatedList = overlay.querySelector('.cw-related-list');
  related.forEach(rc=>{
    const item = document.createElement('div');
    item.className = 'cw-related-item';
    const thumbStyle = rc.thumb ? `background-image:url(${rc.thumb});` : `background:linear-gradient(135deg,#6E45A8,#141A38);`;
    item.innerHTML = `
      <div class="cw-related-thumb" style="${thumbStyle}"><span class="dur">${rc.dur||'—:—'}</span></div>
      <div class="cw-related-info"><div class="t">${esc(rc.title)}</div><div class="a">${esc(rc.artist)} · ${formatLikes(rc.views)} vues</div></div>`;
    item.onclick = ()=> openClipWatchPage(rc);
    relatedList.appendChild(item);
  });

  requestAnimationFrame(()=> overlay.classList.add('show'));
  attachSwipeDownToClose(overlay, closeOverlay);
}

/* ============ STORIES NUNI — plein écran façon TikTok ============
   Réutilise les vrais clips déjà chargés (mêmes données que l'onglet Clips et le Dashboard
   artiste) : aucune "story" séparée à créer côté artiste, aucune donnée inventée. Navigation
   par tap (droite = suivant, gauche = précédent) et swipe vers le bas pour fermer — mêmes
   conventions que Instagram/TikTok. Chaque story avance automatiquement à la fin du clip. */
function ensureStoriesStyles(){
  if(document.getElementById('stories-styles')) return;
  const style = document.createElement('style');
  style.id = 'stories-styles';
  style.textContent = `
    #stories-overlay{ position:fixed; inset:0; z-index:10000; background:#000; opacity:0; transition:opacity .25s ease; }
    #stories-overlay.show{ opacity:1; }
    .stories-stage{ position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; }
    .stories-video{ max-width:100%; max-height:100%; width:auto; height:100%; object-fit:contain; background:#000; }
    .stories-placeholder{ color:rgba(255,255,255,.6); font-size:13.5px; text-align:center; padding:0 30px; }
    .stories-progress-row{ position:absolute; top:calc(10px + env(safe-area-inset-top,0)); left:10px; right:10px; display:flex; gap:4px; z-index:3; }
    .stories-progress-seg{ flex:1; height:2.5px; border-radius:2px; background:rgba(255,255,255,.28); overflow:hidden; }
    .stories-progress-fill{ height:100%; width:0%; background:#fff; border-radius:2px; }
    .stories-progress-seg.is-done .stories-progress-fill{ width:100%; }
    .stories-header{ position:absolute; top:calc(24px + env(safe-area-inset-top,0)); left:14px; right:50px; display:flex; align-items:center; gap:10px; z-index:3; }
    .stories-avatar{ width:34px; height:34px; border-radius:50%; border:1.5px solid rgba(255,255,255,.7); background-size:cover; background-position:center; background:var(--grad-envol); display:flex; align-items:center; justify-content:center; color:#0A0A10; font-weight:700; font-size:12px; flex-shrink:0; }
    .stories-artist-name{ color:#fff; font-weight:700; font-size:13.5px; text-shadow:0 1px 4px rgba(0,0,0,.5); }
    .stories-follow-btn{ background:rgba(255,255,255,.16); backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,.3); color:#fff; font-weight:700; font-size:11.5px; padding:5px 12px; border-radius:999px; cursor:pointer; flex-shrink:0; }
    .stories-follow-btn.is-following{ background:var(--grad-envol); color:#241708; border-color:transparent; }
    .stories-close{ position:absolute; top:calc(20px + env(safe-area-inset-top,0)); right:14px; z-index:3; width:34px; height:34px; border-radius:50%; background:rgba(0,0,0,.4); color:#fff; display:flex; align-items:center; justify-content:center; }
    .stories-tapzone{ position:absolute; top:0; bottom:0; width:34%; z-index:2; }
    .stories-tapzone.left{ left:0; } .stories-tapzone.right{ right:0; }
    .stories-footer{ position:absolute; left:14px; right:14px; bottom:calc(22px + env(safe-area-inset-bottom,0)); z-index:3; display:flex; align-items:flex-end; justify-content:space-between; gap:12px; pointer-events:none; }
    .stories-title{ color:#fff; font-weight:600; font-size:13.5px; text-shadow:0 1px 4px rgba(0,0,0,.5); max-width:70%; }
    .stories-meta{ color:rgba(255,255,255,.75); font-size:12px; margin-top:3px; }
    .stories-like-btn{ pointer-events:auto; display:flex; flex-direction:column; align-items:center; gap:3px; color:#fff; background:rgba(0,0,0,.35); width:44px; height:44px; border-radius:50%; flex-shrink:0; }
    .stories-like-btn svg{ width:20px; height:20px; }
    .stories-like-btn.is-active svg{ fill:var(--rouge-nuni,#C0392B); stroke:var(--rouge-nuni,#C0392B); }
    .stories-like-count{ font-size:9.5px; font-weight:700; }
  `;
  document.head.appendChild(style);
}
function openStoriesViewer(startIndex){
  ensureStoriesStyles();
  const realClips = clips.filter(c=>c.isReal && c.videoUrl);
  if(!realClips.length){ toast('Aucun clip disponible pour le moment.'); return; }
  let idx = Math.max(0, Math.min(startIndex||0, realClips.length-1));
  if(playing) togglePlay(); // jamais deux sons superposés
  setImmersiveMode(true);

  let overlay = document.getElementById('stories-overlay');
  if(overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'stories-overlay';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const closeOverlay = ()=>{
    const v = overlay.querySelector('video');
    if(v) v.pause();
    overlay.classList.remove('show');
    document.body.style.overflow = '';
    setImmersiveMode(false);
    setTimeout(()=> overlay.remove(), 200);
  };

  overlay.innerHTML = `
    <div class="stories-progress-row" id="stories-progress-row"></div>
    <button class="stories-close" aria-label="Fermer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    <div class="stories-header" id="stories-header"></div>
    <div class="stories-stage" id="stories-stage">
      <div class="stories-tapzone left"></div>
      <div class="stories-tapzone right"></div>
    </div>
    <div class="stories-footer" id="stories-footer"></div>`;

  const progressRow = overlay.querySelector('#stories-progress-row');
  realClips.forEach(()=>{
    const seg = document.createElement('div');
    seg.className = 'stories-progress-seg';
    seg.innerHTML = '<div class="stories-progress-fill"></div>';
    progressRow.appendChild(seg);
  });

  function renderStory(){
    const clip = realClips[idx];
    // Vraie vue comptée, exactement comme le lecteur de clip classique.
    if(clip.realId){
      fetch(NUNI_API_BASE + '/api/clips/' + clip.realId + '/view', {
        method:'POST', headers: realAuthToken ? {'Authorization':'Bearer ' + realAuthToken} : {}
      }).then(r=>r.json()).then(data=>{ if(typeof data.views === 'number') clip.views = data.views; }).catch(()=>{});
    }
    progressRow.querySelectorAll('.stories-progress-seg').forEach((seg, i)=>{
      seg.classList.toggle('is-done', i < idx);
      const fill = seg.querySelector('.stories-progress-fill');
      fill.style.width = i < idx ? '100%' : '0%';
    });
    const initials = (clip.artist||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const avatarStyle = clip.artistAvatarUrl ? `background-image:url(${clip.artistAvatarUrl}); background-size:cover; background-position:center;` : '';
    overlay.querySelector('#stories-header').innerHTML = `
      <div class="stories-avatar" style="${avatarStyle}">${clip.artistAvatarUrl ? '' : initials}</div>
      <div class="stories-artist-name">${esc(clip.artist)}</div>
      <button class="stories-follow-btn">Suivre</button>`;
    overlay.querySelector('#stories-header .stories-avatar').onclick = ()=>{ closeOverlay(); openArtistPage(clip.artist, clip.artistId); };
    const followBtn = overlay.querySelector('.stories-follow-btn');
    if(clip.artistId && realAuthToken){
      fetch(NUNI_API_BASE + '/api/follow/' + clip.artistId + '/status', { headers:{ 'Authorization':'Bearer ' + realAuthToken } })
        .then(r=>r.json()).then(d=>{ followBtn.textContent = d.following ? 'Suivi' : 'Suivre'; followBtn.classList.toggle('is-following', d.following); }).catch(()=>{});
    }
    followBtn.onclick = ()=>{
      if(!realAuthToken){ toast('Connectez-vous pour suivre un artiste.'); return; }
      if(!clip.artistId) return;
      followBtn.disabled = true;
      fetch(NUNI_API_BASE + '/api/follow', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer ' + realAuthToken}, body: JSON.stringify({ artistId: clip.artistId }) })
        .then(r=>r.json()).then(data=>{
          followBtn.disabled = false;
          if(data.error){ toast(' ' + data.error); return; }
          followBtn.textContent = data.following ? 'Suivi' : 'Suivre';
          followBtn.classList.toggle('is-following', !!data.following);
        }).catch(()=>{ followBtn.disabled = false; });
    };
    overlay.querySelector('#stories-footer').innerHTML = `
      <div>
        <div class="stories-title">${esc(clip.title)}</div>
        <div class="stories-meta">${formatLikes(clip.views||0)} vues</div>
      </div>
      <button class="stories-like-btn" aria-label="J'aime">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
        <span class="stories-like-count">${clip.likes ? formatLikes(clip.likes) : ''}</span>
      </button>`;
    const likeBtn = overlay.querySelector('.stories-like-btn');
    if(clip.realId && realAuthToken){
      fetch(NUNI_API_BASE + '/api/clips/' + clip.realId + '/my-reaction', { headers:{ 'Authorization':'Bearer ' + realAuthToken } })
        .then(r=>r.json()).then(d=> likeBtn.classList.toggle('is-active', !!d.liked)).catch(()=>{});
    }
    likeBtn.onclick = async (e)=>{
      e.stopPropagation();
      bounceEl(likeBtn); hapticPing();
      if(clip.realId && realAuthToken){
        likeBtn.disabled = true;
        try{
          const res = await fetch(NUNI_API_BASE + '/api/clips/' + clip.realId + '/like', { method:'POST', headers:{ 'Authorization':'Bearer ' + realAuthToken } });
          const data = await res.json();
          likeBtn.disabled = false;
          if(!res.ok){ toast(' ' + (data.error||'Erreur.')); return; }
          clip.likes = data.likes;
          likeBtn.classList.toggle('is-active', data.liked);
          likeBtn.querySelector('.stories-like-count').textContent = clip.likes ? formatLikes(clip.likes) : '';
        }catch(err){ likeBtn.disabled = false; }
        return;
      }
      if(!realAuthToken) toast('Connectez-vous pour aimer ce clip.');
    };

    const stage = overlay.querySelector('#stories-stage');
    stage.querySelectorAll('video, .stories-placeholder').forEach(el=> el.remove());
    const video = document.createElement('video');
    video.className = 'stories-video';
    video.src = clip.videoUrl; video.autoplay = true; video.playsInline = true;
    video.addEventListener('timeupdate', ()=>{
      if(!video.duration) return;
      const fill = progressRow.children[idx].querySelector('.stories-progress-fill');
      fill.style.width = Math.min(100, (video.currentTime/video.duration)*100) + '%';
    });
    video.addEventListener('ended', goNext);
    stage.insertBefore(video, stage.querySelector('.stories-tapzone.left'));
  }
  function goNext(){
    if(idx >= realClips.length-1){ closeOverlay(); return; }
    idx++; renderStory();
  }
  function goPrev(){
    if(idx <= 0) return;
    idx--; renderStory();
  }
  overlay.querySelector('.stories-tapzone.left').onclick = goPrev;
  overlay.querySelector('.stories-tapzone.right').onclick = goNext;
  overlay.querySelector('.stories-close').onclick = closeOverlay;

  renderStory();
  requestAnimationFrame(()=> overlay.classList.add('show'));
  attachSwipeDownToClose(overlay, closeOverlay);
}

function clipCard(clip){
  const card = document.createElement('div');
  card.className = 'clip-card';
  card.dataset.clipId = clip.id;
  const thumbStyle = clip.thumb ? `background-image:url(${clip.thumb}); background-size:cover; background-position:center;` : '';
  const palClass = clip.thumb ? '' : (clip.pal || 'pal-1');
  const initials = (clip.artist||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const avatarStyle = clip.artistAvatarUrl
    ? `background-image:url(${clip.artistAvatarUrl}); background-size:cover; background-position:center;`
    : `background:var(--grad-envol); display:flex; align-items:center; justify-content:center; color:#0A0A10; font-weight:700; font-size:11px; font-family:var(--font-data);`;
  card.innerHTML = `
    <div class="clip-thumb ${palClass}" style="${thumbStyle}; position:relative;">
      <div class="play-fab"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
      <span class="dur">${clip.dur||'—:—'}</span>
      <div class="clip-artist-avatar" title="Voir le profil de ${esc(clip.artist)}" style="position:absolute; bottom:8px; left:8px; width:30px; height:30px; border-radius:50%; border:2px solid rgba(255,255,255,.85); box-shadow:0 2px 8px rgba(0,0,0,.4); cursor:pointer; z-index:2; ${avatarStyle}">${clip.artistAvatarUrl ? '' : initials}</div>
    </div>
    <div class="clip-info">
      <div class="t">${esc(clip.title)}</div>
      <div class="a">${esc(clip.artist)}</div>
      <div class="meta"><span><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg> ${formatLikes(clip.views)} vues</span><span><svg class="nuni-ic filled nuni-ic-err" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg> ${formatLikes(clip.likes)}</span></div>
    </div>`;
  card.querySelector('.clip-artist-avatar').onclick = (e)=>{ e.stopPropagation(); openArtistPage(clip.artist, clip.artistId); };
  card.onclick = ()=> openClipWatchPage(clip);
  return card;
}
function shuffleArray(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function renderClips(){
  const grid = document.getElementById('clips-grid');
  if(!grid) return;
  grid.innerHTML = '';
  if(!clips.length){
    grid.innerHTML = `<p style="grid-column:1/-1; color:var(--text-faint); font-size:13px;">Aucun clip publié pour le moment sur NUNI — revenez bientôt !</p>`;
    return;
  }
  shuffleArray(clips).forEach(c=> grid.appendChild(clipCard(c)));
}
function renderArtistClips(artistName){
  const grid = document.getElementById('artist-page-clips');
  if(!grid) return;
  grid.innerHTML = '';
  const mine = clips.filter(c=>c.artist===artistName);
  if(!mine.length){
    grid.innerHTML = `<p style="grid-column:1/-1; color:var(--text-faint); font-size:13px;">Aucun clip publié pour le moment.</p>`;
    return;
  }
  mine.forEach(c=> grid.appendChild(clipCard(c)));
}
// Avant : 6 clips factices ("Bibi Mwana", "Ndombe Junior"...) toujours affichés, mélangés
// aux vrais clips publiés par les artistes. Retiré — seuls les vrais clips (loadRealClips,
// plus bas) doivent apparaître sur cet onglet.

async function loadRealClips(){
  try{
    const res = await fetch(NUNI_API_BASE + '/api/clips');
    if(!res.ok) return;
    const data = await res.json();
    if(!data.clips || !data.clips.length) return;
    // retire les vrais clips déjà chargés avant de réinjecter (évite les doublons)
    for(let i = clips.length - 1; i >= 0; i--){ if(clips[i].isReal) clips.splice(i, 1); }
    const mapped = data.clips.map(c => ({
      id: 'real_' + c.id, realId: c.id, title: c.title, artist: c.artist_name || 'Artiste NUNI',
      thumb: c.thumb_url || null, pal: 'pal-1', videoUrl: c.video_url || null,
      views: c.views || 0, likes: c.likes || 0, dislikes: c.dislikes || 0, isReal: true,
      date: '', dur: '—:—',
      artistId: c.artist_id, artistAvatarUrl: c.artist_avatar_url || null,
    }));
    clips.unshift(...mapped);
    renderClips();
    renderHomeClipsShelf();
  }catch(e){ /* pas grave si le serveur est indisponible, les clips de démo restent affichés */ }
}
loadRealClips();

// ---------- Rangée "Clips" sur l'accueil, juste après "Nouveautés" ----------
// Réutilise clipCard() (même carte que l'onglet Clips complet) — seuls les vrais clips
// publiés apparaissent ici, jamais de contenu inventé. Voir #shelf-clips-home en CSS pour
// la largeur fixe qui permet à ces cartes (pensées pour une grille) de s'aligner en
// rangée horizontale comme les autres étagères de l'accueil.
function renderHomeClipsShelf(){
  const row = document.getElementById('shelf-clips-home');
  if(!row) return;
  row.innerHTML = '';
  const real = clips.filter(c=>c.isReal).slice(0,10);
  if(!real.length){
    row.innerHTML = `<p style="font-size:12.5px; color:var(--text-faint);">Aucun clip publié pour le moment.</p>`;
    return;
  }
  real.forEach(c=> row.appendChild(clipCard(c)));
}

/* ============ LECTEUR VIDÉO CLIP (style iOS) ============ */
let currentClip = null;
function openClipPlayer(clip){
  currentClip = clip;
  document.getElementById('clip-player-title').textContent = clip.title;
  document.getElementById('clip-player-artist').textContent = clip.artist;
  document.getElementById('clip-player-likes').textContent = formatLikes(clip.likes);
  document.getElementById('clip-player-views').textContent = formatLikes(clip.views);
  const video = document.getElementById('clip-player-video');
  const likeBtn = document.querySelector('.clip-player-actions button');
  likeBtn.classList.remove('liked');
  if(clip.videoUrl){
    video.src = clip.videoUrl;
    video.style.display = '';
    video.play().catch(()=>{});
  } else {
    video.removeAttribute('src');
    video.style.display = 'none';
    toast(`Aperçu du clip « ${clip.title} » — vidéo non fournie dans cette démo.`);
  }
  document.getElementById('clip-player-overlay').classList.add('show');
}
function closeClipPlayer(){
  const video = document.getElementById('clip-player-video');
  video.pause();
  document.getElementById('clip-player-overlay').classList.remove('show');
}
async function toggleClipLike(btn){
  if(!currentClip) return;
  if(currentClip.isReal && currentClip.realId && realAuthToken){
    btn.disabled = true;
    try{
      const res = await fetch(NUNI_API_BASE + '/api/clips/' + currentClip.realId + '/like', {
        method:'POST', headers:{ 'Authorization':'Bearer ' + realAuthToken }
      });
      const data = await res.json();
      btn.disabled = false;
 if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
      currentClip.likes = data.likes;
      btn.classList.toggle('liked', data.liked);
      document.getElementById('clip-player-likes').textContent = formatLikes(currentClip.likes);
 }catch(e){ btn.disabled = false; toast(' Impossible de contacter le serveur NUNI.'); }
    return;
  }
  const liked = btn.classList.toggle('liked');
  currentClip.likes += liked ? 1 : -1;
  document.getElementById('clip-player-likes').textContent = formatLikes(currentClip.likes);
}

let uploadedFiles = [];
function fileToDataURL(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function publishRelease(){
  const hasAudio = uploadedFiles.length > 0;
  const titre = document.getElementById('rf-titre').value.trim();
  const coverPreview = document.getElementById('release-cover-preview');
  const coverData = coverPreview.style.backgroundImage;
  const hasCover = coverData && coverData !== '';
  const droitsOk = document.getElementById('rf-droits').checked;

  if(!hasAudio){ toast('Importez au moins un fichier audio avant de publier.'); return; }
  if(!titre){ toast('Donnez un titre à votre projet avant de publier.'); document.getElementById('rf-titre').focus(); return; }
  if(!hasCover){ toast('Choisissez une pochette avant de publier.'); return; }
  if(!droitsOk){ toast('Vous devez confirmer détenir les droits sur ce contenu.'); return; }

  const coverUrl = coverData.slice(5, -2); // strip url("...") — aperçu local immédiat
  const coverFile = pendingCoverFile; // vrai fichier, pour l'envoi direct vers Cloudinary
  const genre = document.getElementById('rf-genre').value;
  const paroles = document.getElementById('rf-paroles').value.trim();
  const dateVal = document.getElementById('rf-date').value;
  const releaseLabel = dateVal ? new Date(dateVal).toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'}) : "aujourd'hui";
  // Programmation réelle — avant, ce champ ne servait qu'à afficher une étiquette de date,
  // jamais envoyé au serveur comme vraie date de sortie : un morceau daté du futur était en
  // réalité publié immédiatement, sans aucune vraie programmation.
  const isScheduledForFuture = !!(dateVal && new Date(dateVal) > new Date());
  // Crédits réels — avant, ces 4 champs étaient affichés dans le formulaire mais jamais lus
  // ni envoyés au serveur (seuls titre/genre/paroles/date étaient utilisés).
  const description = document.getElementById('rf-description').value.trim();
  const featuring = document.getElementById('rf-feat').value.trim();
  const composer = document.getElementById('rf-auteur').value.trim();
  const studio = document.getElementById('rf-studio').value.trim();
  const credits = document.getElementById('rf-credits').value.trim();

  const artistDisplayName = (currentUser && currentUser.artist_name) ? currentUser.artist_name : 'Bibi Mwana';
  const filesForUpload = [...uploadedFiles];
  // Avant : chaque morceau d'un Album/EP se voyait imposer "Titre du projet · Piste N",
  // écrasant le vrai nom que l'artiste avait donné à son fichier (ou renommé lui-même dans
  // le formulaire). Ici : le vrai titre saisi/affiché pour CE fichier précis est relu
  // directement depuis son champ, et reste le sien à la publication.
  const trackTitleFor = (fileIndex, fallbackIndex)=>{
    const input = document.querySelector(`.ui-name-input[data-file-index="${fileIndex}"]`);
    const real = input && input.value.trim();
    return real || (filesForUpload.length > 1 ? `${titre} · Piste ${fallbackIndex+1}` : titre);
  };
  // Capturé maintenant (pas relu plus tard) : le formulaire est vidé avant même que l'envoi
  // réel au serveur (asynchrone, plus bas) n'ait fini — relire le DOM à ce moment-là aurait
  // toujours retrouvé des champs vides, et serait retombé sur l'ancien "Piste N" générique
  // pour les VRAIES données sauvegardées, même si l'aperçu local affichait le bon titre.
  const capturedTitles = filesForUpload.map((_, i) => trackTitleFor(i, i));
  const newTracks = filesForUpload.map((file, i)=>{
    const trackTitle = capturedTitles[i];
    return {
      t: trackTitle, a: artistDisplayName, p: 'pal-1', album: titre, genre: genre, year: new Date().getFullYear(),
      streams: '0', release: releaseLabel, verified: true, likes: 0,
      cover: coverUrl, audioUrl: URL.createObjectURL(file), releaseType: currentReleaseType,
      lyrics: paroles || null,
      description: description || null, featuring: featuring || null, composer: composer || null, studio: studio || null, credits: credits || null,
      isReal: true, // aperçu local déjà considéré comme réel — sinon exclu du pool suivant/précédent/aléatoire juste après publication
    };
  });

  // Un morceau programmé pour une date future ne doit apparaître NULLE PART publiquement
  // avant cette date (ni dans la discographie locale, ni lu automatiquement) — seul le
  // calendrier des sorties doit le montrer, en "à venir".
  if(isScheduledForFuture){
    toast(`"${titre}" (${currentReleaseType}) programmé pour le ${releaseLabel} — il sera publié automatiquement à cette date, visible dès maintenant dans votre calendrier des sorties.`);
  } else {
    tracks.unshift(...newTracks);
    // figure automatiquement dans la zone artiste (discographie + tendances)
    const isGroupedRelease = newTracks.length > 1 && newTracks[0].releaseType && newTracks[0].releaseType !== 'Single';
    ['shelf-artist','shelf-artist-trending','shelf-new'].forEach(id=>{
      const row = document.getElementById(id);
      if(!row) return;
      try{
        if(isGroupedRelease){
          row.prepend(trackCard(newTracks[0])); // une seule pochette représente tout l'album/EP/mixtape
        } else {
          newTracks.slice().reverse().forEach(tr=> row.prepend(trackCard(tr)));
        }
      }catch(e){ console.error('[publishTrack] carte ignorée:', e); }
    });
    toast(`"${titre}" (${currentReleaseType}) publié — disponible dans votre discographie. Lecture en cours…`);
  }

  // Envoi réel au serveur NUNI — scheduledReleaseAt fait la vraie différence : le serveur
  // garde le morceau non-publié (published=0) jusqu'à cette date, puis le publie lui-même
  // automatiquement (job en arrière-plan côté serveur, vérifié chaque minute).
  if(realAuthToken){
    (async ()=>{
      let successCount = 0;
      let failCount = 0;
      let lastError = '';
      let cloudCoverUrl = null;
      try{
        cloudCoverUrl = await uploadFileToCloudinary(coverFile, 'image');
      }catch(e){
 toast(` Envoi de la pochette impossible : ${e.message}. ${isScheduledForFuture ? 'La programmation a échoué.' : 'Les morceaux restent visibles uniquement dans votre navigateur.'}`);
        currentUser.track_count = (currentUser.track_count || 0);
        return;
      }
      for(const file of filesForUpload){
        try{
          const fileIndex = filesForUpload.indexOf(file);
          const perTrackTitle = capturedTitles[fileIndex];
          const cloudAudioUrl = await uploadFileToCloudinary(file, 'video'); // Cloudinary traite l'audio sous "video"
          const res = await fetch(NUNI_API_BASE + '/api/tracks', {
            method:'POST',
            headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
            body: JSON.stringify({
              title: perTrackTitle, album: titre, genre: genre, releaseType: currentReleaseType,
              coverUrl: cloudCoverUrl, audioUrl: cloudAudioUrl, lyrics: paroles || null,
              composer: composer || null, featuring: featuring || null, studio: studio || null, credits: credits || null,
              description: description || null, releaseDate: dateVal || null,
              scheduledReleaseAt: isScheduledForFuture ? dateVal : null,
            })
          });
          if(res.ok){
            successCount++;
          } else {
            failCount++;
            const errData = await res.json().catch(()=>({}));
            lastError = errData.error || ('Erreur serveur (' + res.status + ')');
          }
        }catch(e){ failCount++; lastError = e.message || 'Connexion au serveur impossible.'; }
      }
      if(failCount === 0){
        toast(isScheduledForFuture
          ? 'Programmation confirmée sur le serveur NUNI.'
          : 'Vos morceaux ont bien été envoyés sur le serveur NUNI — visibles par tous les auditeurs.');
      } else if(successCount > 0){
 toast(` ️ ${successCount} morceau(x) envoyé(s), ${failCount} échec(s) : ${lastError}`);
      } else {
 toast(` Aucun morceau envoyé au serveur : ${lastError}.`);
      }
      currentUser.track_count = (currentUser.track_count || 0) + (isScheduledForFuture ? 0 : successCount);
      // Retire les morceaux "temporaires" (aperçu local immédiat à la publication) une fois
      // que loadRealTracks() a rechargé la vraie version depuis le serveur — sinon les deux
      // coexistaient indéfiniment dans `tracks`, causant un doublon visuel (même morceau
      // affiché deux fois, partout où `tracks` est utilisé : page artiste, accueil, etc.)
      newTracks.forEach(nt=>{
        const idx = tracks.indexOf(nt);
        if(idx !== -1) tracks.splice(idx, 1);
      });
      await loadRealTracks();
      refreshMainShelves();
      if(currentUser && currentUser.account_type === 'artist' && document.getElementById('view-artist').style.display !== 'none'){
        openArtistPage(currentUser.artist_name, currentUser.id); // reconstruit proprement la page si elle est déjà ouverte (recharge aussi le calendrier)
      }
    })();
  }

  // reset form for the next upload
  document.getElementById('rf-titre').value = '';
  document.getElementById('rf-description').value = '';
  document.getElementById('rf-feat').value = '';
  document.getElementById('rf-auteur').value = '';
  document.getElementById('rf-studio').value = '';
  document.getElementById('rf-credits').value = '';
  document.getElementById('rf-paroles').value = '';
  document.getElementById('rf-date').value = '';
  document.getElementById('rf-explicit').checked = false;
  document.getElementById('rf-droits').checked = false;
  document.getElementById('audio-upload-list').innerHTML = '';
  uploadedFiles = [];
  pendingCoverFile = null;
  coverPreview.style.backgroundImage = '';
  coverPreview.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 16l4.5-4.5a2 2 0 0 1 2.8 0L16 16M14 14l1.5-1.5a2 2 0 0 1 2.8 0L20 14M4 6h16v12H4z"/></svg>';

  // Le son continue de jouer en fond (mini-lecteur) pour confirmer que l'import fonctionne
  // bien — mais sans plus ouvrir le lecteur plein écran automatiquement, qui coupait la vue
  // sur la vraie publication. À la place : retour direct sur sa propre page pour voir
  // immédiatement le morceau apparaître dans sa discographie.
  if(!isScheduledForFuture){
    playTrack(newTracks[0]);
    if(currentUser && currentUser.account_type === 'artist'){
      openArtistPage(currentUser.artist_name, currentUser.id);
    }
  }
}
function handleAudioUpload(e){
  let files = Array.from(e.target.files || []);
  const list = document.getElementById('audio-upload-list');

  if(currentReleaseType === 'Single'){
    // Un Single ne prend qu'un seul fichier : on remplace ce qui était déjà importé
    if(files.length > 1){ toast('Un Single ne contient qu\'un seul fichier audio — seul le premier a été gardé.'); files = files.slice(0,1); }
    uploadedFiles = [];
    list.innerHTML = '';
  } else {
    const remaining = 20 - uploadedFiles.length;
    if(files.length > remaining){
      toast(`Limite de 20 fichiers audio par ${currentReleaseType.toLowerCase()} — seuls les ${Math.max(remaining,0)} premiers ont été ajoutés.`);
      files = files.slice(0, Math.max(remaining,0));
    }
  }

  files.forEach(file=>{
    uploadedFiles.push(file);
    const fileIndex = uploadedFiles.length - 1; // vraie position dans uploadedFiles — sert à retrouver le bon titre à la publication
    const item = document.createElement('div');
    item.className = 'upload-item';
    item.dataset.fileIndex = fileIndex;
    const name = file.name.replace(/\.[^/.]+$/, '');
    const previewUrl = URL.createObjectURL(file);
    item.innerHTML = `
      <div class="ui-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13M9 9l12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
      <div class="ui-info">
        <input class="ui-name-input" type="text" value="${name.replace(/"/g,'&quot;')}" placeholder="Titre de ce morceau" data-file-index="${fileIndex}">
        <div class="ui-bar"><div class="ui-bar-fill"></div></div>
        <audio class="ui-native-preview" controls preload="metadata" src="${previewUrl}"></audio>
      </div>
      <div class="ui-status">Import…</div>`;
    list.prepend(item);
    const fill = item.querySelector('.ui-bar-fill');
    const status = item.querySelector('.ui-status');
    setTimeout(()=>{ fill.style.width = '100%'; }, 50);
    setTimeout(()=>{ status.textContent = 'Prêt à publier'; status.style.color = 'var(--accent)'; }, 1500);
    if(!document.getElementById('rf-titre').value) document.getElementById('rf-titre').value = name;
  });
  if(files.length) toast(`${files.length} fichier(s) audio importé(s) — testez le son avec le lecteur ci-dessous avant de publier.`);
  e.target.value = '';
}
async function handlePhotoUpload(e, kind){
  const file = e.target.files[0];
  if(!file) return;

  // Aperçu local immédiat, en attendant l'envoi réel
  const reader = new FileReader();
  const localPreviewUrl = await new Promise(resolve=>{
    reader.onload = ()=> resolve(reader.result);
    reader.readAsDataURL(file);
  });
  if(kind === 'avatar'){
    applyAvatarEverywhere(localPreviewUrl);
  } else {
    applyBannerEverywhere(localPreviewUrl);
  }
  e.target.value = '';

  // Envoi réel — avant, cette photo restait purement locale : elle disparaissait dès qu'on
  // quittait l'onglet Artiste puis qu'on y revenait (openArtistPage réaffichait toujours le
  // dégradé par défaut), et n'était jamais visible pour les autres visiteurs ni après un rechargement.
  if(kind !== 'avatar'){
    if(!realAuthToken){
      toast('Connectez-vous avec un vrai compte Artiste pour que cette photo soit enregistrée.');
      return;
    }
    toast('Envoi de la photo de couverture en cours…');
    try{
      const cloudUrl = await uploadFileToCloudinary(file, 'image');
      const res = await fetch(NUNI_API_BASE + '/api/artist/banner', {
        method:'PUT', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
        body: JSON.stringify({ bannerUrl: cloudUrl })
      });
      const data = await res.json();
 if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
      currentUser.banner_url = cloudUrl;
      applyBannerEverywhere(cloudUrl);
 toast(' Photo de couverture enregistrée — visible sur votre page artiste.');
    }catch(e){
 toast(' Impossible d\'envoyer la photo : ' + (e.message || 'erreur inconnue'));
    }
    return;
  }
  if(!realAuthToken){
    toast('Connectez-vous avec un vrai compte Artiste pour que cette photo soit enregistrée.');
    return;
  }
  toast('Envoi de la photo en cours…');
  try{
    const cloudUrl = await uploadFileToCloudinary(file, 'image');
    const res = await fetch(NUNI_API_BASE + '/api/artist/avatar', {
      method:'PUT', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({ avatarUrl: cloudUrl })
    });
    const data = await res.json();
 if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
    currentUser.avatar_url = cloudUrl;
    applyAvatarEverywhere(cloudUrl);
 toast(' Photo de profil enregistrée — visible partout sur NUNI.');
  }catch(e){
 toast(' Impossible d\'envoyer la photo : ' + (e.message || 'erreur inconnue'));
  }
}
function applyAvatarEverywhere(url){
  document.querySelectorAll('.artist-avatar, .user-chip .avatar').forEach(el=>{
    el.style.backgroundImage = `url(${url})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';
  });
  const avatarDash = document.getElementById('avatar-preview-dash');
  if(avatarDash){ avatarDash.style.backgroundImage = `url(${url})`; avatarDash.textContent = ''; }
}
function applyBannerEverywhere(url){
  const dash = document.getElementById('cover-preview-dash');
  if(dash){ dash.style.backgroundImage = `url(${url})`; }
  const cover = document.querySelector('.artist-cover');
  if(cover){ cover.style.backgroundImage = `url(${url})`; }
}

// ============ SONS EN VEDETTE — l'artiste choisit lui-même quoi mettre en avant ============
// Avant : aucune sélection possible, la page artiste ne montrait que la Discographie
// complète, sans que l'artiste puisse choisir de mettre certains morceaux/albums en avant.
let featuredTrackIds = []; // sélection en cours dans le panneau du Dashboard
function renderFeaturedPicker(){
  const list = document.getElementById('featured-picker-list');
  if(!list) return;
  const myTracks = dedupeAlbums(tracks.filter(t=> t.isReal && currentUser && t.artistId === currentUser.id));
  if(!myTracks.length){
    list.innerHTML = `<p style="font-size:12.5px; color:var(--text-faint);">Publiez d'abord un morceau pour pouvoir le mettre en vedette.</p>`;
    return;
  }
  list.innerHTML = myTracks.map(t=>`
    <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--border); border-radius:10px; cursor:pointer;">
      <input type="checkbox" value="${t.realId}" ${featuredTrackIds.includes(t.realId) ? 'checked' : ''} onchange="toggleFeaturedTrack(${t.realId}, this.checked)">
      <div style="width:34px; height:34px; border-radius:8px; background-image:url(${t.cover||''}); background-size:cover; background-position:center; flex-shrink:0;"></div>
      <span style="font-size:13.5px;">${t.t}</span>
    </label>`).join('');
}
function toggleFeaturedTrack(id, checked){
  if(checked){
    if(featuredTrackIds.length >= 6){
      toast('Maximum 6 sons en vedette — décochez-en un avant d\'en ajouter un autre.');
      renderFeaturedPicker(); // remet la case décochée à l'écran
      return;
    }
    featuredTrackIds.push(id);
  } else {
    featuredTrackIds = featuredTrackIds.filter(x=> x !== id);
  }
}
async function loadFeaturedPicker(){
  if(!currentUser || currentUser.account_type !== 'artist') return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/artist/' + currentUser.id + '/featured-tracks');
    if(res.ok){
      const data = await res.json();
      featuredTrackIds = (data.tracks || []).map(t=> t.id);
    }
  }catch(e){ /* pas grave si le serveur est momentanément indisponible */ }
  renderFeaturedPicker();
}
async function saveFeaturedTracks(){
  if(!realAuthToken){ toast('Connectez-vous pour enregistrer votre sélection.'); return; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/artist/featured-tracks', {
      method:'PUT', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({ trackIds: featuredTrackIds })
    });
    const data = await res.json();
 if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
 toast(' Sélection enregistrée — visible sur votre page artiste.');
  }catch(e){
 toast(' Impossible d\'enregistrer la sélection : ' + (e.message || 'erreur inconnue'));
  }
}
// Suppression d'un morceau — notamment utile pour corriger une publication en double.
async function deleteMyTrack(trackId){
  if(!trackId || !realAuthToken) return;
  if(!confirm('Supprimer définitivement ce morceau ? Cette action est irréversible.')) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/tracks/' + trackId, {
      method:'DELETE', headers:{ 'Authorization':'Bearer ' + realAuthToken }
    });
    const data = await res.json();
 if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
 toast(' Morceau supprimé.');
    await loadRealTracks();
    refreshMainShelves();
    if(currentUser && currentUser.account_type === 'artist') openArtistPage(currentUser.artist_name, currentUser.id);
  }catch(e){
 toast(' Suppression impossible : ' + (e.message || 'erreur inconnue'));
  }
}

/* ============ CONCERTS (Phase 2) ============
   Publication directe par l'artiste — dès qu'il publie, le concert est visible dans l'onglet
   Concerts de la recherche, sans validation d'équipe (voir POST /api/dashboard/concerts). */
let pendingConcertFlyerFile = null;
function previewConcertFlyer(e){
  const file = e.target.files[0];
  if(!file) return;
  pendingConcertFlyerFile = file;
  const reader = new FileReader();
  reader.onload = ()=>{
    const preview = document.getElementById('concert-flyer-preview');
    preview.style.backgroundImage = `url(${reader.result})`;
    preview.textContent = '';
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
async function publishConcert(){
  if(!realAuthToken){ toast('Connectez-vous pour publier un concert.'); return; }
  const title = document.getElementById('concert-title').value.trim();
  const eventDate = document.getElementById('concert-date').value;
  const city = document.getElementById('concert-city').value.trim();
  const country = document.getElementById('concert-country').value.trim();
  if(!title || !eventDate || !city || !country){
    toast('Titre, date, ville et pays sont obligatoires.');
    return;
  }
  toast('Publication du concert en cours…');
  try{
    let flyerUrl = null;
    if(pendingConcertFlyerFile){
      flyerUrl = await uploadFileToCloudinary(pendingConcertFlyerFile, 'image');
    }
    const capacityVal = document.getElementById('concert-capacity').value;
    const latVal = document.getElementById('concert-gps-lat').value;
    const lngVal = document.getElementById('concert-gps-lng').value;
    const res = await fetch(NUNI_API_BASE + '/api/dashboard/concerts', {
      method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({
        title, eventDate, city, country,
        eventType: document.getElementById('concert-event-type').value,
        description: document.getElementById('concert-description').value.trim() || null,
        tourName: document.getElementById('concert-tour-name').value.trim() || null,
        startTime: document.getElementById('concert-start-time').value || null,
        endTime: document.getElementById('concert-end-time').value || null,
        venue: document.getElementById('concert-venue').value.trim() || null,
        address: document.getElementById('concert-address').value.trim() || null,
        gpsLat: latVal ? Number(latVal) : null,
        gpsLng: lngVal ? Number(lngVal) : null,
        ticketPriceVip: document.getElementById('concert-ticket-price-vip').value.trim() || null,
        ticketPriceStandard: document.getElementById('concert-ticket-price-standard').value.trim() || null,
        capacity: capacityVal ? Number(capacityVal) : null,
        purchaseLocations: document.getElementById('concert-purchase-locations').value.trim() || null,
        purchasePhoneNumbers: document.getElementById('concert-purchase-phones').value.trim() || null,
        purchaseLink: document.getElementById('concert-purchase-link').value.trim() || null,
        flyerUrl,
      }),
    });
    const data = await res.json();
    if(!res.ok){ toast(data.error || 'Impossible de publier.'); return; }
    toast('Publié — visible dans la recherche.');
    ['concert-title','concert-tour-name','concert-description','concert-date','concert-start-time','concert-end-time',
     'concert-city','concert-country','concert-venue','concert-address','concert-gps-lat','concert-gps-lng',
     'concert-ticket-price-vip','concert-ticket-price-standard','concert-capacity','concert-purchase-locations',
     'concert-purchase-phones','concert-purchase-link'].forEach(id=>{
      const el = document.getElementById(id); if(el) el.value = '';
    });
    document.getElementById('concert-event-type').value = 'concert';
    pendingConcertFlyerFile = null;
    const preview = document.getElementById('concert-flyer-preview');
    preview.style.backgroundImage = ''; preview.textContent = 'Choisir une image';
    loadDashboardConcerts();
  }catch(e){
    toast('Publication impossible : ' + (e.message || 'erreur inconnue'));
  }
}
async function loadDashboardConcerts(){
  const list = document.getElementById('dashboard-concerts-list');
  if(!list || !realAuthToken) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/dashboard/concerts', { headers:{ 'Authorization':'Bearer ' + realAuthToken } });
    if(!res.ok) return;
    const data = await res.json();
    list.innerHTML = '';
    if(!data.concerts || !data.concerts.length){
      list.innerHTML = '<p style="font-size:12.5px; color:var(--text-faint);">Aucun concert publié pour le moment.</p>';
      return;
    }
    data.concerts.forEach(c=>{
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:12px; padding:10px; border-radius:10px; background:var(--bg-card); border:1px solid var(--border);';
      const dateLabel = new Date(c.event_date).toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'});
      row.innerHTML = `
        <div style="width:48px; height:60px; border-radius:6px; background:${c.flyer_url ? `url(${c.flyer_url})` : 'var(--grad-envol)'}; background-size:cover; background-position:center; flex-shrink:0;"></div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; font-size:13.5px;">${esc(c.title)}</div>
          <div style="font-size:11.5px; color:var(--text-faint);">${dateLabel} · ${c.city}, ${c.country}${c.places_restantes != null ? ' · ' + c.places_restantes + ' places restantes' : ''}</div>
        </div>
        <button class="btn-icon" title="Supprimer" onclick="deleteConcert(${c.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7"/></svg></button>`;
      list.appendChild(row);
    });
  }catch(e){ /* pas grave si le serveur est momentanément indisponible */ }
}
async function deleteConcert(id){
  if(!confirm('Supprimer définitivement ce concert ?')) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/dashboard/concerts/' + id, {
      method:'DELETE', headers:{ 'Authorization':'Bearer ' + realAuthToken }
    });
    const data = await res.json();
    if(!res.ok){ toast(data.error || 'Suppression impossible.'); return; }
    toast('Concert supprimé.');
    loadDashboardConcerts();
  }catch(e){ toast('Suppression impossible : ' + (e.message || 'erreur inconnue')); }
}

// ---------- Page Concerts (publique) — alimentée automatiquement dès qu'un artiste publie.
// Les dates d'une même tournée (même artiste + même tour_name) sont regroupées et affichées
// sous forme de timeline plutôt qu'en cartes séparées répétitives. ----------
function concertMapsUrl(c){
  if(c.gps_lat && c.gps_lng) return `https://www.google.com/maps/search/?api=1&query=${c.gps_lat},${c.gps_lng}`;
  const q = encodeURIComponent([c.venue, c.address, c.city, c.country].filter(Boolean).join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
// Registre des concerts déjà rendus à l'écran (par id) — permet au bouton "Acheter un
// ticket" d'ouvrir le modal avec les bonnes infos sans avoir à tout redemander au serveur.
let concertsRegistry = {};
function concertCardHtml(c){
  concertsRegistry[c.id] = c;
  const dateLabel = new Date(c.event_date).toLocaleDateString('fr-FR', {weekday:'short', day:'2-digit', month:'short', year:'numeric'});
  const timeLabel = [c.start_time, c.end_time].filter(Boolean).join(' – ');
  const initials = (c.artist_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const avatarStyle = c.artist_avatar_url ? `background-image:url(${c.artist_avatar_url}); background-size:cover; background-position:center;` : '';
  const isShowcase = c.event_type === 'showcase';
  const hasPurchaseInfo = c.purchase_locations || c.purchase_phone_numbers || c.purchase_link;
  return `
    <div class="concert-card">
      <div class="concert-flyer">
        ${c.flyer_url ? `<img src="${c.flyer_url}" alt="" loading="lazy" decoding="async">` : ''}
        ${isShowcase ? '<span class="concert-type-badge"><svg class="nuni-ic" viewBox="0 0 24 24" style="width:12px;height:12px;vertical-align:-2px;margin-right:3px;"><path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z"/><path d="M3 8l2-4h4l-2 4M9 8l2-4h4l-2 4M15 8l2-4h4l-2 4"/></svg>Showcase</span>' : ''}
      </div>
      <div class="concert-body">
        <div class="concert-artist-row">
          <div class="concert-artist-av" style="${avatarStyle}">${avatarStyle ? '' : initials}</div>
          <span>${esc(c.artist_name)}${c.is_verified ? ' <svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24" style="width:12px;height:12px;"><path d="M20 6 9 17l-5-5"/></svg>' : ''}</span>
        </div>
        <h3 class="concert-title">${esc(c.title)}</h3>
        <div class="concert-meta-row"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> ${dateLabel}${timeLabel ? ' · ' + timeLabel : ''}</div>
        <div class="concert-meta-row"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg> ${[c.venue, c.city, c.country].filter(Boolean).join(', ')}</div>
        ${c.description ? `<p class="concert-desc">${esc(c.description)}</p>` : ''}
        ${(c.ticket_price_vip || c.ticket_price_standard) ? `<div class="concert-tiers">
          ${c.ticket_price_vip ? `<span class="concert-tier is-vip"><svg class="nuni-ic filled" viewBox="0 0 24 24" style="width:12px;height:12px;vertical-align:-2px;margin-right:3px;"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9L5.7 21l1.7-7L2 9.2l7.1-.6z"/></svg>VIP — ${c.ticket_price_vip}</span>` : ''}
          ${c.ticket_price_standard ? `<span class="concert-tier">Standard — ${c.ticket_price_standard}</span>` : ''}
        </div>` : ''}
        <div class="concert-foot-row">
          <span></span>
          ${c.places_restantes != null ? `<span class="concert-places">${c.places_restantes} place${c.places_restantes>1?'s':''} restante${c.places_restantes>1?'s':''}</span>` : ''}
        </div>
        <div class="concert-actions">
          ${hasPurchaseInfo ? `<button class="btn btn-primary btn-sm" onclick="openTicketInfoModal(${c.id})">Acheter un ticket</button>` : ''}
          <a class="btn btn-ghost btn-sm" href="${concertMapsUrl(c)}" target="_blank" rel="noopener noreferrer">Voir l'emplacement</a>
        </div>
      </div>
    </div>`;
}
// ---------- Modal "Se procurer un ticket" — affiche tout ce que l'artiste a renseigné :
// lieux physiques, numéros à contacter, et/ou lien en ligne. Jamais de paiement traité par
// NUNI directement, exactement comme pour le soutien direct aux artistes. ----------
let nuniInfoCache = null;
async function fetchNuniInfo(){
  if(nuniInfoCache) return nuniInfoCache;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/nuni-info');
    if(res.ok) nuniInfoCache = await res.json();
  }catch(e){ /* pas grave */ }
  return nuniInfoCache;
}
async function openTicketInfoModal(concertId){
  const c = concertsRegistry[concertId];
  const title = document.getElementById('ticket-info-title');
  const body = document.getElementById('ticket-info-body');
  if(!c){ return; }
  title.textContent = c.title;
  let html = '';
  if(c.purchase_locations){
    html += `<div class="pi-sub-card" style="margin-bottom:12px;">
      <div style="font-size:11px; color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Points de vente</div>
      <div style="font-size:13.5px; color:var(--text); line-height:1.6; white-space:pre-line;">${c.purchase_locations}</div>
    </div>`;
  }
  if(c.purchase_phone_numbers){
    const numbers = c.purchase_phone_numbers.split(',').map(n=>n.trim()).filter(Boolean);
    html += `<div class="pi-sub-card" style="margin-bottom:12px;">
      <div style="font-size:11px; color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Numéros à contacter</div>
      ${numbers.map(n=> `<div style="font-size:16px; font-weight:700; color:var(--accent); letter-spacing:0.5px; margin-bottom:4px;">${n}</div>`).join('')}
    </div>`;
  }
  // ---- Événement NUNI (pas un concert d'artiste) sans lien d'achat renseigné : on montre
  // les vraies coordonnées officielles NUNI (locaux, service client) plutôt qu'un message
  // générique — ça a du sens ici puisque l'événement appartient à la plateforme elle-même. ----
  const isNuniEvent = typeof concertId === 'string' && concertId.startsWith('ev_');
  const hasOwnPurchaseInfo = c.purchase_locations || c.purchase_phone_numbers || c.purchase_link;
  if(isNuniEvent && !hasOwnPurchaseInfo){
    const info = await fetchNuniInfo();
    if(info && (info.locations || info.phone || info.email)){
      if(info.locations){
        html += `<div class="pi-sub-card" style="margin-bottom:12px;">
          <div style="font-size:11px; color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Nos locaux</div>
          <div style="font-size:13.5px; color:var(--text); line-height:1.6; white-space:pre-line;">${info.locations}</div>
        </div>`;
      }
      if(info.phone){
        html += `<div class="pi-sub-card" style="margin-bottom:12px;">
          <div style="font-size:11px; color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Service client</div>
          <div style="font-size:16px; font-weight:700; color:var(--accent); letter-spacing:0.5px;">${info.phone}</div>
        </div>`;
      }
      if(info.email){
        html += `<div class="pi-sub-card" style="margin-bottom:12px;">
          <div style="font-size:11px; color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Email</div>
          <div style="font-size:14px; color:var(--text);">${esc(info.email)}</div>
        </div>`;
      }
    } else {
      html += `<button class="btn btn-primary" style="width:100%; margin-top:4px;" onclick="toast('Achat en ligne bientôt disponible pour cet événement.')">Acheter en ligne</button>`;
    }
  } else {
    html += c.purchase_link
      ? `<a class="btn btn-primary" style="width:100%; text-align:center; display:block; text-decoration:none; margin-top:4px;" href="${c.purchase_link}" target="_blank" rel="noopener noreferrer">Acheter en ligne</a>`
      : `<button class="btn btn-primary" style="width:100%; margin-top:4px;" onclick="toast('Achat en ligne bientôt disponible pour ce concert.')">Acheter en ligne</button>`;
  }
  if(!html){
    html = `<p style="color:var(--text-faint); font-size:13px;">Aucune information de billetterie renseignée pour le moment.</p>`;
  }
  body.innerHTML = html;
  document.getElementById('ticket-info-overlay').classList.add('show');
}
function closeTicketInfoModal(){
  document.getElementById('ticket-info-overlay').classList.remove('show');
}

/* ============ "À PROPOS" COMPLET — carrousel photo + bio intégrale (façon Spotify) ============ */
let apabImages = [];
let apabIndex = 0;
function openArtistAboutModal(){
  const isOwn = currentArtistPageRealId && currentUser && currentUser.id === currentArtistPageRealId;
  let gallery = [];
  if(isOwn){
    gallery = (currentUser.about_gallery_urls || '').split(',').filter(Boolean);
  } else if(currentArtistPageRealId && artistPublicInfoCache[currentArtistPageRealId]){
    gallery = artistPublicInfoCache[currentArtistPageRealId].about_gallery_urls || [];
  }
  // Repli honnête : si l'artiste n'a pas encore ajouté de galerie, on montre au moins sa
  // vraie photo de profil plutôt qu'un cadre vide.
  const heroPhoto = document.getElementById('artist-page-avatar');
  const fallback = heroPhoto ? heroPhoto.style.backgroundImage.replace(/^url\(["']?/,'').replace(/["']?\)$/,'') : '';
  apabImages = gallery.length ? gallery : (fallback ? [fallback] : []);
  apabIndex = 0;
  document.getElementById('apab-name').textContent = document.getElementById('artist-page-name').textContent;
  document.getElementById('apab-monthly-listeners').textContent = document.getElementById('artist-stat-monthly-listeners').textContent;
  document.getElementById('apab-bio').textContent = document.getElementById('artist-page-bio').textContent;
  document.getElementById('apab-stat-streams').textContent = document.getElementById('artist-stat-streams').textContent;
  document.getElementById('apab-stat-followers').textContent = document.getElementById('artist-stat-followers').textContent;
  // Le bouton Suivre du modal reflète le vrai état du vrai bouton de la page (voir
  // apabProxyFollow ci-dessous) — pas de logique de suivi dupliquée.
  const realFollowBtn = document.getElementById('follow-btn');
  const modalFollowBtn = document.getElementById('apab-follow-btn');
  if(realFollowBtn && modalFollowBtn){
    modalFollowBtn.style.display = isOwn ? 'none' : '';
    modalFollowBtn.classList.toggle('is-following', realFollowBtn.classList.contains('is-following'));
    modalFollowBtn.innerHTML = realFollowBtn.classList.contains('is-following')
      ? 'Suivi <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>'
      : 'Suivre <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>';
  }
  apabRenderImage();
  document.getElementById('apab-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function apabProxyFollow(){
  const realFollowBtn = document.getElementById('follow-btn');
  if(realFollowBtn) realFollowBtn.click();
  // Redonne au bouton du modal le même texte/état juste après, le temps que toggleFollow() se termine.
  setTimeout(()=>{
    const modalFollowBtn = document.getElementById('apab-follow-btn');
    if(realFollowBtn && modalFollowBtn){
      modalFollowBtn.classList.toggle('is-following', realFollowBtn.classList.contains('is-following'));
      modalFollowBtn.innerHTML = realFollowBtn.classList.contains('is-following')
        ? 'Suivi <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>'
        : 'Suivre <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>';
    }
  }, 400);
}
function closeArtistAboutModal(){
  document.getElementById('apab-overlay').classList.remove('show');
  document.body.style.overflow = '';
}
function apabRenderImage(){
  const img = document.getElementById('apab-carousel-img');
  const dots = document.getElementById('apab-dots');
  const arrowLeft = document.querySelector('.apab-arrow.left');
  const arrowRight = document.querySelector('.apab-arrow.right');
  const multi = apabImages.length > 1;
  if(arrowLeft) arrowLeft.style.display = multi ? '' : 'none';
  if(arrowRight) arrowRight.style.display = multi ? '' : 'none';
  img.style.backgroundImage = apabImages[apabIndex] ? `url(${apabImages[apabIndex]})` : '';
  if(!apabImages[apabIndex]) img.style.background = 'var(--grad-envol)';
  dots.innerHTML = multi ? apabImages.map((_,i)=> `<span class="${i===apabIndex?'is-active':''}"></span>`).join('') : '';
}
function apabPrevImage(){
  if(!apabImages.length) return;
  apabIndex = (apabIndex - 1 + apabImages.length) % apabImages.length;
  apabRenderImage();
}
function apabNextImage(){
  if(!apabImages.length) return;
  apabIndex = (apabIndex + 1) % apabImages.length;
  apabRenderImage();
}

/* ---------- Dashboard artiste — gestion de la galerie "À propos" (5 emplacements) ---------- */
let artistGallerySlotFiles = [null, null, null, null, null]; // data-URI (nouvelle) ou URL existante (inchangée) ou null (vide)
function renderArtistGallerySlots(){
  const wrap = document.getElementById('artist-gallery-slots');
  if(!wrap) return;
  const existing = (currentUser && currentUser.about_gallery_urls) ? currentUser.about_gallery_urls.split(',').filter(Boolean) : [];
  for(let i=0;i<5;i++){ if(artistGallerySlotFiles[i] === undefined) artistGallerySlotFiles[i] = existing[i] || null; }
  wrap.innerHTML = '';
  for(let i=0;i<5;i++){
    const slot = document.createElement('div');
    const url = artistGallerySlotFiles[i];
    slot.style.cssText = `position:relative; aspect-ratio:1; border-radius:10px; background:${url ? `url(${url})` : 'var(--bg-card)'}; background-size:cover; background-position:center; border:1px dashed var(--border-strong); cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-faint); font-size:11px;`;
    slot.innerHTML = url ? `<button style="position:absolute; top:4px; right:4px; width:22px; height:22px; border-radius:50%; background:rgba(0,0,0,0.6); border:none; color:#fff; cursor:pointer;" onclick="event.stopPropagation(); artistGallerySlotFiles[${i}]=null; renderArtistGallerySlots();">✕</button>` : '+ Photo';
    slot.onclick = ()=>{
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = (e)=>{
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = ()=>{ artistGallerySlotFiles[i] = reader.result; renderArtistGallerySlots(); };
        reader.readAsDataURL(file);
      };
      input.click();
    };
    wrap.appendChild(slot);
  }
}
async function saveArtistGallery(){
  const msg = document.getElementById('artist-gallery-msg');
  msg.style.color = 'var(--text-dim)'; msg.textContent = 'Enregistrement…';
  try{
    const images = artistGallerySlotFiles.filter(Boolean);
    const res = await fetch(NUNI_API_BASE + '/api/artist/about-gallery', {
      method:'PUT', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({ images }),
    });
    const data = await res.json();
    if(!res.ok){ msg.style.color = 'var(--rose-braise)'; msg.textContent = data.error; return; }
    currentUser.about_gallery_urls = data.gallery.join(',');
    saveSession(realAuthToken, currentUser, true);
    artistGallerySlotFiles = [...data.gallery, null, null, null, null].slice(0, 5);
    renderArtistGallerySlots();
    msg.style.color = '#7FC79A'; msg.textContent = 'Galerie enregistrée.';
  }catch(e){ msg.style.color = 'var(--rose-braise)'; msg.textContent = 'Impossible de contacter le serveur NUNI.'; }
}

let allConcertsCache = [];
let currentConcertsFilter = 'all';
async function loadConcertsPage(){
  const box = document.getElementById('concerts-list');
  if(!box) return;
  box.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Chargement des concerts…</p>';
  currentConcertsFilter = 'all';
  document.querySelectorAll('.concerts-filter-btn').forEach(b=> b.classList.toggle('is-active', b.dataset.filter === 'all'));
  const cityInput = document.getElementById('concerts-city-filter');
  const dateInput = document.getElementById('concerts-date-from-filter');
  if(cityInput) cityInput.value = '';
  if(dateInput) dateInput.value = '';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/concerts');
    if(!res.ok) throw new Error();
    const data = await res.json();
    allConcertsCache = data.concerts || [];
    renderConcertsList(allConcertsCache);
  }catch(e){
    box.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Impossible de charger les concerts pour le moment.</p>';
  }
}
function setConcertsFilter(type){
  currentConcertsFilter = type;
  document.querySelectorAll('.concerts-filter-btn').forEach(b=> b.classList.toggle('is-active', b.dataset.filter === type));
  renderConcertsList(getFilteredConcerts());
}
// Ville (recherche partielle, insensible à la casse) + date de début — appliqués en plus du
// filtre Tout/Concerts/Showcases déjà actif, sans jamais re-fetch le serveur.
function getFilteredConcerts(){
  let list = currentConcertsFilter === 'all' ? allConcertsCache : allConcertsCache.filter(c=> (c.event_type || 'concert') === currentConcertsFilter);
  const cityQuery = (document.getElementById('concerts-city-filter')?.value || '').trim().toLowerCase();
  const dateFrom = document.getElementById('concerts-date-from-filter')?.value || '';
  if(cityQuery) list = list.filter(c=> (c.city||'').toLowerCase().includes(cityQuery) || (c.country||'').toLowerCase().includes(cityQuery));
  if(dateFrom) list = list.filter(c=> c.event_date >= dateFrom);
  return list;
}
function applyConcertsSearchFilters(){
  renderConcertsList(getFilteredConcerts());
}
function resetConcertsSearchFilters(){
  document.getElementById('concerts-city-filter').value = '';
  document.getElementById('concerts-date-from-filter').value = '';
  applyConcertsSearchFilters();
}
function renderConcertsList(concerts){
  const box = document.getElementById('concerts-list');
  if(!box) return;
  if(!concerts.length){
    box.innerHTML = '<p style="color:var(--text-faint); font-size:13px; padding:30px 0;">Rien à afficher pour le moment — revenez bientôt.</p>';
    return;
  }
  // Regroupement par tournée : même artiste + même tour_name renseigné.
  const tourGroups = {};
  const standalone = [];
  concerts.forEach(c=>{
    if(c.tour_name){
      const key = c.artist_id + '::' + c.tour_name;
      (tourGroups[key] = tourGroups[key] || []).push(c);
    } else {
      standalone.push(c);
    }
  });

  let html = '';
  Object.values(tourGroups).forEach(dates=>{
    dates.sort((a,b)=> new Date(a.event_date) - new Date(b.event_date));
    const first = dates[0];
    html += `<div class="concert-tour-block">
      <h3 class="concert-tour-title"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> ${esc(first.tour_name)} — ${esc(first.artist_name)}</h3>
      <div class="concert-timeline">
        ${dates.map(c=>{
          const dateLabel = new Date(c.event_date).toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'});
          return `<div class="concert-timeline-item">
            <div class="concert-timeline-dot"></div>
            <div class="concert-timeline-date">${dateLabel}</div>
            <div class="concert-timeline-place">${[c.venue, c.city, c.country].filter(Boolean).join(', ')}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="concert-grid">${dates.map(concertCardHtml).join('')}</div>
    </div>`;
  });
  if(standalone.length){
    html += `<div class="concert-grid">${standalone.map(concertCardHtml).join('')}</div>`;
  }
  box.innerHTML = html;
  // Clic sur le nom/avatar de l'artiste → sa page profil (association par ordre de rendu).
  const orderedConcerts = [...Object.values(tourGroups).flat(), ...standalone];
  box.querySelectorAll('.concert-card').forEach((card, i)=>{
    const c = orderedConcerts[i];
    if(!c) return;
    const row = card.querySelector('.concert-artist-row');
    if(row){ row.style.cursor = 'pointer'; row.onclick = ()=> openArtistPage(c.artist_name, c.artist_id); }
  });
}

// ============ NUNI ÉVÉNEMENTS (Phase 3) — publique ============
// Gérés uniquement par l'équipe NUNI depuis admin.html. Réutilise le même modal de
// billetterie que les concerts pour "Acheter" (openTicketInfoModal attend purchase_link /
// purchase_locations / purchase_phone_numbers — un événement NUNI n'a qu'un lien direct,
// donc on adapte l'objet avant de l'enregistrer dans le registre).
function nuniEventCardHtml(ev){
  concertsRegistry['ev_' + ev.id] = { id: 'ev_' + ev.id, title: ev.title, purchase_link: ev.purchase_link, purchase_locations: ev.purchase_locations || null, purchase_phone_numbers: ev.purchase_phone_numbers || null };
  const dateLabel = new Date(ev.event_date).toLocaleDateString('fr-FR', {weekday:'short', day:'2-digit', month:'short', year:'numeric'});
  const gallery = (ev.gallery_urls || '').split(',').map(u=>u.trim()).filter(Boolean);
  return `
    <div class="concert-card">
      <div class="concert-flyer">
        ${ev.flyer_url ? `<img src="${ev.flyer_url}" alt="" loading="lazy" decoding="async">` : ''}
        <span class="concert-type-badge">${ev.category}</span>
      </div>
      <div class="concert-body">
        <h3 class="concert-title">${esc(ev.title)}</h3>
        <div class="concert-meta-row"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> ${dateLabel}${ev.start_time ? ' · ' + ev.start_time : ''}</div>
        ${ev.venue || ev.address ? `<div class="concert-meta-row"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg> ${[ev.venue, ev.address].filter(Boolean).join(', ')}</div>` : ''}
        ${ev.description ? `<p class="concert-desc">${esc(ev.description)}</p>` : ''}
        ${gallery.length ? `<div class="ev-gallery-row">${gallery.slice(0,4).map(u=> `<img class="ev-gallery-thumb" src="${u}" alt="" loading="lazy" decoding="async">`).join('')}</div>` : ''}
        ${ev.promo_video_url ? `<video class="ev-promo-video" src="${ev.promo_video_url}" controls preload="metadata"></video>` : ''}
        <div class="concert-foot-row">
          ${ev.price ? `<span class="concert-price">${ev.price}</span>` : '<span></span>'}
          ${ev.places_restantes != null ? `<span class="concert-places">${ev.places_restantes} place${ev.places_restantes>1?'s':''} restante${ev.places_restantes>1?'s':''}</span>` : ''}
        </div>
        <div class="concert-actions">
          <button class="btn btn-primary btn-sm" onclick="openTicketInfoModal('ev_${ev.id}')">Acheter</button>
          ${(ev.gps_lat && ev.gps_lng) || ev.address || ev.venue ? `<a class="btn btn-ghost btn-sm" href="${ev.gps_lat && ev.gps_lng ? `https://www.google.com/maps/search/?api=1&query=${ev.gps_lat},${ev.gps_lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([ev.venue, ev.address].filter(Boolean).join(', '))}`}" target="_blank" rel="noopener noreferrer">Voir l'emplacement</a>` : ''}
        </div>
      </div>
    </div>`;
}
let allNuniEventsCache = [];
function renderNuniEventsList(events){
  const box = document.getElementById('nuni-events-list');
  if(!box) return;
  if(!events.length){
    box.innerHTML = '<p style="color:var(--text-faint); font-size:13px; padding:30px 0;">Rien à afficher pour le moment.</p>';
    return;
  }
  box.innerHTML = `<div class="concert-grid">${events.map(nuniEventCardHtml).join('')}</div>`;
}
function getFilteredNuniEvents(){
  let list = allNuniEventsCache;
  const cityQuery = (document.getElementById('nuni-events-city-filter')?.value || '').trim().toLowerCase();
  const dateFrom = document.getElementById('nuni-events-date-from-filter')?.value || '';
  const category = document.getElementById('nuni-events-category-filter')?.value || '';
  if(cityQuery) list = list.filter(ev=> (ev.venue||'').toLowerCase().includes(cityQuery) || (ev.address||'').toLowerCase().includes(cityQuery));
  if(dateFrom) list = list.filter(ev=> ev.event_date >= dateFrom);
  if(category) list = list.filter(ev=> ev.category === category);
  return list;
}
function applyNuniEventsSearchFilters(){
  renderNuniEventsList(getFilteredNuniEvents());
}
function resetNuniEventsSearchFilters(){
  document.getElementById('nuni-events-city-filter').value = '';
  document.getElementById('nuni-events-date-from-filter').value = '';
  document.getElementById('nuni-events-category-filter').value = '';
  applyNuniEventsSearchFilters();
}
async function loadNuniEventsPage(){
  const box = document.getElementById('nuni-events-list');
  if(!box) return;
  box.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Chargement des événements…</p>';
  const cityInput = document.getElementById('nuni-events-city-filter');
  const dateInput = document.getElementById('nuni-events-date-from-filter');
  const catInput = document.getElementById('nuni-events-category-filter');
  if(cityInput) cityInput.value = '';
  if(dateInput) dateInput.value = '';
  if(catInput) catInput.value = '';
  try{
    const res = await fetch(NUNI_API_BASE + '/api/nuni-events');
    if(!res.ok) throw new Error();
    const data = await res.json();
    allNuniEventsCache = data.events || [];
    if(!allNuniEventsCache.length){
      box.innerHTML = '<p style="color:var(--text-faint); font-size:13px; padding:30px 0;">Aucun événement NUNI programmé pour le moment — revenez bientôt.</p>';
      return;
    }
    renderNuniEventsList(allNuniEventsCache);
  }catch(e){
    box.innerHTML = '<p style="color:var(--text-faint); font-size:13px;">Impossible de charger les événements pour le moment.</p>';
  }
}

// Point d'entrée unique pour changer sa photo de profil, quel que soit le bouton utilisé
// (menu profil en haut à droite, ou "Photos de mon profil artiste" dans le Dashboard) —
// avant, ces deux boutons ne se parlaient jamais : chacun ne mettait à jour qu'un seul
// endroit à l'écran, sans jamais rien enregistrer réellement ni synchroniser le reste.
async function handleProfileAvatarUpload(e){
  const file = e.target.files[0];
  if(!file) return;

  const reader = new FileReader();
  const localPreviewUrl = await new Promise(resolve=>{
    reader.onload = ()=> resolve(reader.result);
    reader.readAsDataURL(file);
  });
  applyAvatarEverywhere(localPreviewUrl); // aperçu immédiat, partout
  e.target.value = '';

  if(!realAuthToken){
    toast('Connectez-vous pour que cette photo soit enregistrée.');
    return;
  }
  if(currentUser && currentUser.account_type !== 'artist'){
    toast('Photo mise à jour pour cette session — l\'enregistrement permanent est pour l\'instant réservé aux comptes Artiste.');
    return;
  }
  toast('Envoi de la photo en cours…');
  try{
    const cloudUrl = await uploadFileToCloudinary(file, 'image');
    const res = await fetch(NUNI_API_BASE + '/api/artist/avatar', {
      method:'PUT', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({ avatarUrl: cloudUrl })
    });
    const data = await res.json();
 if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
    currentUser.avatar_url = cloudUrl;
    applyAvatarEverywhere(cloudUrl); // remplace l'aperçu local par la vraie URL définitive
 toast(' Photo de profil enregistrée — visible partout sur NUNI.');
  }catch(e){
 toast(' Impossible d\'envoyer la photo : ' + (e.message || 'erreur inconnue'));
  }
}

/* ============ FULL-SCREEN PLAYER ============ */
let lyricsOpen = false, immersionOn = false;

function openFullPlayer(showLyrics){
  document.getElementById('full-player').classList.add('open');
  document.body.style.overflow = 'hidden';
  setImmersiveMode(true);
  syncFullPlayer();
  if(showLyrics && !lyricsOpen) toggleLyrics();
  initFpScrollCollapse();
}
// Le bandeau du haut du lecteur plein écran passe d'un fond transparent à un fond flouté
// dès qu'on défile un peu la page, avec les mini-infos (pochette/titre/artiste/lecture) qui
// se révèlent progressivement — même principe que le mini-lecteur en bas de l'app, mais
// propre au lecteur plein écran. Un seul écouteur posé une fois (pas à chaque ouverture).
let fpScrollCollapseInit = false;
function initFpScrollCollapse(){
  if(fpScrollCollapseInit) return;
  fpScrollCollapseInit = true;
  const scrollEl = document.getElementById('fp-scroll');
  const topbar = document.querySelector('.fp-topbar');
  if(!scrollEl || !topbar) return;
  let ticking = false;
  const coverWrap = document.getElementById('fp-cover-wrap');
  const titleEl = document.getElementById('fp-title');
  const COLLAPSE_DISTANCE = 200;
  scrollEl.addEventListener('scroll', ()=>{
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{
      const y = scrollEl.scrollTop;
      const scrolled = y > 40;
      topbar.classList.toggle('fp2-scrolled', scrolled);
      if(scrolled) syncFpMiniInfo();
      // Pochette qui rétrécit et remonte progressivement — uniquement transform/opacity,
      // jamais de recalcul de mise en page à chaque frame, pour un geste fluide même sur
      // un téléphone modeste.
      if(coverWrap){
        const p = Math.min(1, Math.max(0, y / COLLAPSE_DISTANCE));
        coverWrap.style.transform = `scale(${1 - 0.45*p}) translateY(${-p*12}px)`;
        coverWrap.style.opacity = 1 - p*0.1;
        if(titleEl) titleEl.style.fontSize = `${22 - p*3}px`;
      }
      ticking = false;
    });
  }, { passive:true });
}
// Recopie l'état réel du lecteur principal (pochette/titre/artiste/icône lecture) dans les
// mini-infos du bandeau — jamais une info différente ou périmée par rapport à ce qui joue
// vraiment, puisque c'est une simple recopie du DOM déjà à jour, pas une donnée séparée.
function syncFpMiniInfo(){
  const mainCover = document.getElementById('fp-cover');
  const miniCover = document.getElementById('fp-mini-cover');
  const miniTitle = document.getElementById('fp-mini-title');
  const miniArtist = document.getElementById('fp-mini-artist');
  const mainIcon = document.getElementById('fp-play-icon');
  const miniIcon = document.getElementById('fp-mini-play-icon');
  if(mainCover && miniCover) miniCover.style.backgroundImage = mainCover.style.backgroundImage || '';
  if(miniTitle && currentTrack) miniTitle.textContent = currentTrack.t;
  if(miniArtist && currentTrack) miniArtist.textContent = currentTrack.a;
  if(mainIcon && miniIcon) miniIcon.innerHTML = mainIcon.innerHTML;
}
function closeFullPlayer(){
  document.getElementById('full-player').classList.remove('open');
  document.getElementById('full-player').classList.remove('immersion');
  closeFpSheets(); // évite de retrouver Paroles/File resté ouvert à la prochaine ouverture
  immersionOn = false;
  document.body.style.overflow = '';
  setImmersiveMode(false);
}
// ============ MODE IMMERSIF — une seule source multimédia visible à la fois ============
// Appelée par le lecteur plein écran, le lecteur de clip vidéo et le tuner NUNI Radio/DJ :
// masque le mini-lecteur, la nav du haut, la barre d'onglets mobile et les boutons flottants
// tant qu'une de ces vues plein écran est ouverte (voir la règle .nuni-immersive dans
// style.css). Un compteur (pas juste un booléen) gère le cas où deux de ces vues
// s'ouvriraient l'une par-dessus l'autre sans se fermer dans l'ordre inverse exact.
let immersiveModeDepth = 0;
function setImmersiveMode(active){
  immersiveModeDepth = Math.max(0, immersiveModeDepth + (active ? 1 : -1));
  document.documentElement.classList.toggle('nuni-immersive', immersiveModeDepth > 0);
}
function toggleImmersion(){
  immersionOn = !immersionOn;
  document.getElementById('full-player').classList.toggle('immersion', immersionOn);
  if(immersionOn && !lyricsOpen) toggleLyrics();
}
/* Avant : ce bouton changeait seulement son étiquette (1× → 1.25× → 1.5× → 0.75×) sans
   jamais toucher à la vraie vitesse de lecture du son — 100% décoratif. Maintenant : appliqué
   réellement à l'élément audio, et mémorisé comme les autres préférences. */
const NUNI_SPEED_KEY = 'nuni_playback_speed';
function applyPlaybackSpeed(){
  if(usingRealAudio) realAudio.playbackRate = playbackSpeed;
  const label = document.getElementById('fp-speed-menu-label');
  if(label) label.textContent = 'Vitesse de lecture (' + playbackSpeed + '×)';
}
function cycleSpeed(){
  const speeds = [1, 1.25, 1.5, 0.75];
  playbackSpeed = speeds[(speeds.indexOf(playbackSpeed)+1) % speeds.length];
  applyPlaybackSpeed();
  try{ localStorage.setItem(NUNI_SPEED_KEY, String(playbackSpeed)); }catch(e){ /* pas bloquant */ }
  toast('Vitesse de lecture : ' + playbackSpeed + '×');
}
function toggleLyrics(){
  lyricsOpen = !lyricsOpen;
  document.getElementById('fp-lyrics').classList.toggle('open', lyricsOpen);
  document.getElementById('lyrics-toggle-btn').classList.toggle('is-active', lyricsOpen);
  document.getElementById('fp-sheet-backdrop').classList.toggle('show', lyricsOpen);
}
// ---------- Diffusion — interface prête à connecter, pas encore de vraie fonctionnalité de
// cast chez NUNI. Seul "Cet appareil" (l'appareil réel sur lequel la personne navigue) est
// marqué sélectionné — jamais un faux statut "connecté" pour un appareil qui ne l'est pas
// réellement ; les autres types d'appareils sont clairement étiquetés "Bientôt".
// ============ APPAREIL DE LECTURE — source de vérité unique ============
// Avant : la fenêtre Diffusion était purement visuelle — "Cet appareil" affichait
// "selected: true" codé en dur, aucun clic possible sur aucun appareil, aucune notion
// d'état partagée avec le vrai lecteur. Ici : un vrai état currentPlaybackDevice, unique
// source de vérité, que le lecteur ET la fenêtre Diffusion lisent tous les deux — jamais
// deux états différents qui pourraient se désynchroniser. NUNI n'a pas encore de vraie
// infrastructure de diffusion (AirPlay/Chromecast) : seul "Cet appareil" (l'appareil réel
// sur lequel la personne écoute déjà) est donc réellement sélectionnable. Les autres
// restent honnêtement "Bientôt" — jamais une fausse connexion simulée au clic.
const currentPlaybackDevice = {
  id: 'this-device',
  name: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'Cet appareil (mobile)' : 'Cet appareil (ordinateur)',
  status: 'active',
};
function selectPlaybackDevice(deviceId){
  if(deviceId !== 'this-device'){
    // Défense en profondeur : ces appareils ne sont jamais rendus cliquables (voir
    // renderCastDevices), mais si jamais cette fonction était appelée directement, elle ne
    // doit surtout pas prétendre qu'une vraie connexion a eu lieu.
    toast('Diffusion vers cet appareil arrive bientôt sur NUNI.');
    return;
  }
  currentPlaybackDevice.status = 'active';
  renderCastDevices(); // reflète immédiatement la (re)sélection dans le panneau ouvert
}
function renderCastDevices(){
  const list = document.getElementById('fp-cast-list');
  if(!list) return;
  const devices = [
    { id: currentPlaybackDevice.id, name: currentPlaybackDevice.name, selected: true, soon: false, icon: '<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M9 18h6"/>' },
    { id: 'living-room-tv', name: 'TV du salon', selected: false, soon: true, icon: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>' },
    { id: 'speaker', name: 'Enceinte', selected: false, soon: true, icon: '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="14" r="4"/><circle cx="12" cy="6" r="1"/>' },
    { id: 'headphones', name: 'Casque', selected: false, soon: true, icon: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>' },
  ];
  list.innerHTML = devices.map(d => `
    <div class="fp-cast-device ${d.selected ? 'is-selected' : ''} ${d.soon ? 'is-disabled' : ''}" ${d.soon ? '' : `onclick="selectPlaybackDevice('${d.id}')" role="button" tabindex="0"`}>
      <div class="fp-cast-device-left">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d.icon}</svg>
        ${esc(d.name)}
        ${d.selected ? '<span class="fp-cast-active-label">Actif</span>' : ''}
      </div>
      ${d.soon ? '<span class="fp-cast-soon-tag">Bientôt</span>' : '<div class="fp-cast-device-dot"></div>'}
    </div>
  `).join('');
}
function toggleCastPanel(){
  const panel = document.getElementById('fp-cast');
  const btn = document.getElementById('fp-cast-btn');
  const willOpen = !panel.classList.contains('open');
  panel.classList.toggle('open', willOpen);
  if(btn) btn.classList.toggle('is-active', willOpen);
  document.getElementById('fp-sheet-backdrop').classList.toggle('show', willOpen);
  // Ouverture/fermeture du panneau : jamais de conséquence sur la vraie lecture — pas de
  // pause, pas de reset de progression, pas de changement de volume. On affiche juste l'état
  // réel actuel, sans jamais y toucher.
  if(willOpen) renderCastDevices();
}
// Ferme n'importe quelle feuille du lecteur actuellement ouverte (Paroles, Diffusion ou
// File) — appelé au clic sur le fond assombri, ou en fermant le lecteur plein écran lui-même.
function closeFpSheets(){
  if(lyricsOpen) toggleLyrics();
  const castPanel = document.getElementById('fp-cast');
  if(castPanel && castPanel.classList.contains('open')) toggleCastPanel();
}
let currentLyricLines = [];
/* Construit les lignes de paroles du morceau en cours.
   - Si l'artiste a fourni un vrai texte : réparti dans le temps de façon régulière sur la durée du morceau
     (on n'a pas de minutage précis ligne par ligne, donc c'est une répartition égale plutôt qu'un vrai
     minutage — un vrai éditeur de paroles synchronisées serait un chantier à part, plus ambitieux).
   - Sinon, pour l'unique morceau de démonstration d'origine : on garde son texte spécifique.
   - Sinon : aucune parole disponible, message clair plutôt qu'un texte qui n'a rien à voir. */
function buildLyricLinesFor(tr){
  if(tr && tr.lyrics){
    const rawLines = tr.lyrics.split('\n').map(s=>s.trim()).filter(Boolean);
    if(rawLines.length){
      const total = (usingRealAudio && duration) ? duration : (duration || 204);
      const step = total / (rawLines.length + 1);
      return rawLines.map((text,i)=> ({ time: Math.round(step*(i+1)), text }));
    }
  }
  if(tr && tr.t === 'Mokili Ya Sika' && tr.a === 'Bibi Mwana'){
    return [
      {time:0,   text:"Ce soir la ville respire au rythme du tambour"},
      {time:26,  text:"Chaque voix qui s'élève trouve enfin son retour"},
      {time:52,  text:"Nos rêves prennent racine dans la terre et le son"},
      {time:78,  text:"Mokili ya sika, un monde en chanson"},
      {time:104, text:"On se lève ensemble quand la musique appelle"},
      {time:130, text:"Le Congo dans le cœur, l'envol sous nos ailes"},
      {time:156, text:"Écoute, soutiens, fais grandir notre histoire"},
      {time:180, text:"Nuni nous rassemble, longue vie à la mémoire"},
    ];
  }
  return [];
}
function renderLyrics(){
  const box = document.getElementById('fp-lyrics-lines');
  if(!box) return;
  box.innerHTML = '';
  currentLyricLines = buildLyricLinesFor(currentTrack);
  if(!currentLyricLines.length){
    box.innerHTML = `<p style="cursor:default; color:var(--text-faint); font-size:14px;">Paroles non fournies pour ce morceau.</p>`;
    return;
  }
  currentLyricLines.forEach((l,i)=>{
    const p = document.createElement('p');
    p.textContent = l.text;
    p.dataset.time = l.time;
    p.onclick = ()=>{ elapsed = l.time; updateProgress(); };
    box.appendChild(p);
  });
}
function updateLyricsHighlight(){
  const box = document.getElementById('fp-lyrics-lines');
  if(!box || !currentLyricLines.length) return;
  const lines = box.querySelectorAll('p');
  let current = 0;
  currentLyricLines.forEach((l,i)=>{ if(elapsed >= l.time) current = i; });
  lines.forEach((p,i)=> p.classList.toggle('is-current', i===current));
}
function syncFullPlayer(){
  applyPlaybackSpeed(); // vitesse de lecture mémorisée, appliquée au vrai <audio>, même si le sélecteur visuel a été retiré du nouveau design
  const tr = currentTrack;
  document.getElementById('fp-title').textContent = tr.t;
  document.getElementById('fp-artist').textContent = tr.a;
  document.getElementById('fp-verified').style.display = tr.verified ? 'inline-flex' : 'none';
  applyPlayerVisuals(tr);
  syncFpMiniInfo();
  renderLyrics();
  updateLyricsHighlight();
  renderQueuePanel();
}

/* ============ PARTAGE / TÉLÉCHARGEMENT / SIGNALEMENT — vrais comportements ============
   Avant : les trois boutons affichaient un message de succès sans jamais rien faire de réel
   (pas de lien copié, pas de fichier téléchargé, pas de signalement enregistré). */
function shareCurrentTrack(){
  const tr = currentTrack;
  if(!tr.isReal || !tr.realId){
    toast("Ce morceau de démonstration n'a pas de lien partageable.");
    return;
  }
  const url = `${location.origin}${location.pathname}?track=${tr.realId}`;
  if(navigator.share){
    navigator.share({ title: tr.t + ' — ' + tr.a, text: `Écoutez "${tr.t}" de ${tr.a} sur NUNI <svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M4 13c1-4 4.5-7 9-7 4 0 7 2.7 7.5 6.3.3 2-.3 3.7-1.5 3.7-1.5 0-1.5-2-3-2-1 0-1.3 1-2.7 1-1.7 0-2.3-1.5-4-1.5-2.3 0-3.5 2-5.3 1.5-1-.3-.7-1.3 0-2z"/><circle cx="16.3" cy="9.3" r=".6" fill="currentColor" stroke="none"/></svg>`, url }).catch(()=>{});
    return;
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(()=>{
      toast('Lien copié — il ouvre directement ce morceau sur NUNI.');
    }).catch(()=>{
      toast('Voici le lien à partager : ' + url);
    });
  } else {
    toast('Voici le lien à partager : ' + url);
  }
}
/* ============ HISTORIQUE DES TÉLÉCHARGEMENTS — vrai suivi local ============
   Avant : "Téléchargements" affichait un message générique ("apparaîtront ici"), rien
   n'était jamais suivi nulle part. Ici : chaque vrai téléchargement (lecteur ou album) est
   enregistré localement sur cet appareil (localStorage — aucun serveur ne suit ça, c'est un
   vrai historique côté appareil, pas une donnée inventée). */
const NUNI_DOWNLOADS_KEY = 'nuni_downloads';
function logDownload(tr){
  try{
    let list = JSON.parse(localStorage.getItem(NUNI_DOWNLOADS_KEY) || '[]');
    list = list.filter(d=> d.t !== tr.t || d.a !== tr.a); // évite les doublons, remonte en tête si déjà présent
    list.unshift({ t:tr.t, a:tr.a, cover:tr.cover||null, at: Date.now() });
    localStorage.setItem(NUNI_DOWNLOADS_KEY, JSON.stringify(list.slice(0, 50)));
  }catch(e){ /* stockage indisponible : pas bloquant */ }
}
function getDownloadHistory(){
  try{ return JSON.parse(localStorage.getItem(NUNI_DOWNLOADS_KEY) || '[]'); }catch(e){ return []; }
}
function downloadCurrentTrack(){
  const tr = currentTrack;
  if(!tr.audioUrl){
    toast('Aucun fichier audio disponible pour ce titre.');
    return;
  }
  const a = document.createElement('a');
  a.href = tr.audioUrl;
  a.download = (tr.t || 'nuni-son').replace(/[^\w\s-]/g,'') + '.mp3';
  document.body.appendChild(a);
  a.click();
  a.remove();
  logDownload(tr);
  toast('Téléchargement lancé — "' + tr.t + '".');
}
async function reportCurrentTrack(){
  closeQuickMenu();
  const tr = currentTrack;
  if(!tr.isReal || !tr.realId){
    toast("Ce morceau de démonstration ne peut pas être signalé.");
    return;
  }
  const reason = prompt('Pourquoi signalez-vous ce morceau ? (facultatif)');
  if(reason === null) return; // annulé
  try{
    const res = await fetch(NUNI_API_BASE + '/api/tracks/' + tr.realId + '/report', {
      method:'POST',
      headers: Object.assign({'Content-Type':'application/json'}, realAuthToken ? {'Authorization':'Bearer '+realAuthToken} : {}),
      body: JSON.stringify({ reason: reason || null })
    });
    const data = await res.json();
 if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
 toast(' ' + data.message);
 }catch(e){ toast(' Impossible de contacter le serveur NUNI.'); }
}

/* Ouverture directe d'un morceau partagé (?track=ID dans l'URL) — dès que le vrai catalogue
   est chargé, on cherche ce morceau précis et on l'ouvre en plein écran automatiquement.
   Si la personne n'est pas encore connectée, le lien reste en attente (l'URL n'est pas
   nettoyée) : il sera repris juste après une connexion/inscription réussie. */
function handleSharedTrackLink(){
  const params = new URLSearchParams(location.search);
  const sharedId = params.get('track');
  if(!sharedId) return;
  if(!currentUser || currentUser.subscription_status !== 'active'){
    toast('Connectez-vous pour écouter le morceau partagé.');
    return;
  }
  const found = tracks.find(t=> t.isReal && String(t.realId) === String(sharedId));
  if(found){
    enterApp('catalog');
    playTrack(found);
    openFullPlayer();
    // Nettoie l'URL pour éviter de rouvrir le même morceau à chaque navigation ultérieure.
    history.replaceState(null, '', location.pathname);
  }
}

/* ============ VISUELS DU LECTEUR : pochette + couleur d'ambiance (via NuniPalette) ============ */
let fpLastCoverKey = null; // évite de relancer toute l'animation si le morceau n'a pas vraiment changé de visuel
function applyPlayerVisuals(tr){
  const coverKey = tr.cover || tr.p;
  const coverEl = document.getElementById('fp-cover');
  const isSameVisual = coverKey === fpLastCoverKey;

  // --- Pochette : petite transition en fondu, seulement si elle change vraiment ---
  const updateCoverEl = ()=>{
    if(tr.cover){
      coverEl.className = 'cover fp-cover';
      coverEl.style.backgroundImage = `url(${tr.cover})`;
      coverEl.innerHTML = '';
    } else {
      coverEl.style.backgroundImage = '';
      coverEl.className = 'cover fp-cover ' + tr.p;
      coverEl.innerHTML = '<div class="fp-cover-placeholder"><div class="fp-cover-mark">NUNI</div></div>';
    }
  };
  if(isSameVisual){
    updateCoverEl();
  } else {
    coverEl.style.opacity = '0';
    coverEl.style.transform = 'scale(.94)';
    setTimeout(()=>{
      updateCoverEl();
      coverEl.style.opacity = '1';
      coverEl.style.transform = 'scale(1)';
    }, 180);
  }

  // --- Couleur d'ambiance : posée sur --nuni-aura-color, utilisée par le fond ambiant
  // (.full-player::before) — recalcul seulement si le visuel a vraiment changé. La
  // transition visuelle douce vient du CSS (transition:background 1s ease), pas d'un
  // fondu manuel entre deux calques comme avant.
  const applyPalette = (palette)=>{
    document.documentElement.style.setProperty('--nuni-aura-color', palette.dominant);
  };

  if(isSameVisual) return; // même pochette qu'avant : on ne relance ni le calcul ni le fondu du fond
  fpLastCoverKey = coverKey;

  if(tr.cover){
    NuniPalette.extract(tr.cover).then(applyPalette);
  } else {
    applyPalette(NuniPalette.forPaletteClass(tr.p));
  }
}

/* ============ FILE D'ATTENTE ============
   Simplification assumée : la file reflète l'ordre réel de lecture (pool de morceaux courant,
   selon le mode radio/DJ/genre en cours) plutôt qu'un ordre librement réorganisable à la souris.
   Cliquer sur un morceau "à suivre" le lance immédiatement. Un vrai glisser-déposer demanderait
   de repenser toute la logique de rotation Radio/DJ NUNI — proposé comme chantier à part si voulu. */
function queueRowHtml(tr, extra){
  const cov = tr.cover ? `style="background-image:url(${tr.cover})"` : `style="background:${palGradients[tr.p]||palGradients['pal-1']}"`;
  return `<div class="fp-queue-cov" ${cov}></div><div class="fp-queue-info"><div class="t">${esc(tr.t)}</div><div class="a">${esc(tr.a)}</div></div>${extra||''}`;
}
let fpQueueUpcoming = [];
let fpQueueHistoryList = [];
function renderQueuePanel(){
  const pool = getCurrentPlaybackPool();
  const i = pool.findIndex(t=> t.t === currentTrack.t);
  const next = document.getElementById('fp-queue-next');
  const hist = document.getElementById('fp-queue-history');
  const histGroup = document.getElementById('fp-queue-history-group');
  if(!next || !hist) return;

  // Vraie file personnelle (ajoutée depuis le menu "..." d'un morceau) — toujours affichée
  // en premier, clairement distincte des suggestions automatiques du pool en cours.
  const userQueueHtml = userQueue.length
    ? `<div class="fp-queue-section-lbl">Votre file d'attente</div>` +
      userQueue.map((tr, idx)=> `<div class="fp-queue-item" data-queue-kind="user" data-queue-idx="${idx}">${queueRowHtml(tr, '<button class="fp-queue-remove" data-remove-idx="'+idx+'" title="Retirer"><svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>')}</div>`).join('')
    : '';

  fpQueueUpcoming = [];
  for(let k=1; k<=5 && k<pool.length; k++) fpQueueUpcoming.push(pool[(i+k) % pool.length]);
  const autoHtml = fpQueueUpcoming.length
    ? (userQueue.length ? `<div class="fp-queue-section-lbl">À suivre</div>` : '') +
      fpQueueUpcoming.map((tr, idx)=> `<div class="fp-queue-item" data-queue-kind="next" data-queue-idx="${idx}">${queueRowHtml(tr)}</div>`).join('')
    : (userQueue.length ? '' : `<div class="fp-queue-empty">Rien d'autre à suivre pour le moment.</div>`);
  next.innerHTML = userQueueHtml + autoHtml;

  fpQueueHistoryList = listeningHistory.filter(h=> h.track.t !== currentTrack.t).slice(0, 5).map(h=> h.track);
  if(histGroup) histGroup.style.display = fpQueueHistoryList.length ? '' : 'none'; // jamais de section "récemment écouté" vide affichée pour rien
  hist.innerHTML = fpQueueHistoryList.map((tr, idx)=> `<div class="fp-queue-item" data-queue-kind="history" data-queue-idx="${idx}">${queueRowHtml(tr)}</div>`).join('');
}
document.addEventListener('click', (e)=>{
  const removeBtn = e.target.closest('.fp-queue-remove');
  if(removeBtn){ e.stopPropagation(); removeFromQueue(Number(removeBtn.dataset.removeIdx)); return; }
  const item = e.target.closest('.fp-queue-item[data-queue-kind]');
  if(!item) return;
  const kind = item.dataset.queueKind;
  const idx = Number(item.dataset.queueIdx);
  let tr;
  if(kind === 'user'){ tr = userQueue[idx]; if(tr) userQueue.splice(idx,1); }
  else if(kind === 'next'){ tr = fpQueueUpcoming[idx]; }
  else { tr = fpQueueHistoryList[idx]; }
  if(tr){
    playTrack(tr);
    // La file reste maintenant visible en défilant (plus une feuille à fermer) — on remonte
    // simplement en haut pour que le vrai changement (pochette/titre) soit immédiatement visible.
    const scrollEl = document.getElementById('fp-scroll');
    if(scrollEl) scrollEl.scrollTo({ top:0, behavior:'smooth' });
  }
});
function toggleQueuePanel(){
  const panel = document.getElementById('fp-queue');
  if(!panel) return;
  panel.scrollIntoView({ behavior:'smooth', block:'start' });
}

/* ============ MENU RAPIDE (⋯) ============ */
function toggleQuickMenu(e){
  e.stopPropagation();
  document.getElementById('fp-quick-menu').classList.toggle('open');
}
function closeQuickMenu(){
  const m = document.getElementById('fp-quick-menu');
  if(m) m.classList.remove('open');
}
document.addEventListener('click', (e)=>{
  const wrap = document.querySelector('.fp-quick-menu-wrap');
  if(wrap && !wrap.contains(e.target)) closeQuickMenu();
});
function openFpAlbum(){
  closeQuickMenu();
  const tr = currentTrack;
  const albumTracks = tracks.filter(t=> t.album === tr.album && t.a === tr.a);
  if(albumTracks.length > 1){ closeFullPlayer(); openAlbumView(tr); }
  else { toast('Ce morceau ne fait pas partie d\'un album multi-titres.'); }
}
function openFpCredits(){
  closeQuickMenu();
  const tr = currentTrack;
  const body = document.getElementById('credits-body');
  body.innerHTML = `
    <div class="pi-sub-card">
      <div class="pi-sub-row"><span>Artiste principal</span><b>${esc(tr.a)}</b></div>
      <div class="pi-sub-row"><span>Featuring</span><b>${tr.featuring || '—'}</b></div>
      <div class="pi-sub-row"><span>Compositeur / Auteur</span><b>${tr.composer || '—'}</b></div>
      <div class="pi-sub-row"><span>Studio d'enregistrement</span><b>${tr.studio || '—'}</b></div>
      <div class="pi-sub-row"><span>Album / Sortie</span><b>${tr.album || '—'}</b></div>
      <div class="pi-sub-row"><span>Genre</span><b>${tr.genre || '—'}</b></div>
      <div class="pi-sub-row"><span>Année</span><b>${tr.year || '—'}</b></div>
      <div class="pi-sub-row"><span>Type de sortie</span><b>${tr.releaseType || 'Single'}</b></div>
      <div class="pi-sub-row"><span>Distribution</span><b>NUNI</b></div>
    </div>
    ${tr.description ? `<p style="color:var(--text-dim); font-size:13px; margin-top:14px; line-height:1.5;">${esc(tr.description)}</p>` : ''}`;
  document.getElementById('credits-modal-overlay').classList.add('show');
}
function closeFpCredits(){
  document.getElementById('credits-modal-overlay').classList.remove('show');
}

/* ============ LÉGÈRE PROFONDEUR 3D SUR LA POCHETTE (souris, ordinateur uniquement) ============ */
function setupFpCoverTilt(){
  const wrap = document.getElementById('fp-cover-wrap');
  if(!wrap) return;
  const canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if(!canHover) return; // mobile/tactile : on n'ajoute pas cet effet, inutile et parfois gênant
  wrap.addEventListener('mousemove', (e)=>{
    const rect = wrap.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    const rotateY = px * 12; // rotation max ~6° de chaque côté, effet volontairement discret
    const rotateX = py * -12;
    wrap.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });
  wrap.addEventListener('mouseleave', ()=>{
    wrap.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
  });
}
setupFpCoverTilt();

/* ============ DASHBOARD CHART — vrais streams par mois, plus de données inventées ============
   Avant : const monthly = [{m:'Jan', v:31}, ...] codé en dur, identique pour tout le monde.
   Maintenant : vrai regroupement des écoutes de CET artiste par mois, via le nouvel endpoint
   /api/artist/stats/monthly (6 derniers mois, y compris les mois à 0 écoute). */
async function loadDashboardChart(){
  const chart = document.getElementById('bar-chart');
  if(!chart) return;
  chart.innerHTML = '';
  if(!realAuthToken) return;
  let monthly;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/artist/stats/monthly', {
      headers:{ 'Authorization':'Bearer ' + realAuthToken }
    });
    if(!res.ok) return;
    const data = await res.json();
    monthly = data.monthly;
  }catch(e){ return; /* pas grave si le serveur est momentanément indisponible */ }
  if(!monthly || !monthly.length) return;

  const max = Math.max(1, ...monthly.map(m=>m.v));
  monthly.forEach(m=>{
    const col = document.createElement('div');
    col.className = 'bar-col';
    col.innerHTML = `<div class="bar-fill" style="height:0%" data-h="${(m.v/max*100)}"></div><div class="m-lbl">${m.m}</div>`;
    chart.appendChild(col);
  });
  setTimeout(()=>{
    document.querySelectorAll('#bar-chart .bar-fill').forEach(b=> b.style.height = b.dataset.h + '%');
  }, 300);
}

updateProgress();

/* ============ COMPTEUR D'AUDITEURS ACTIFS (accueil) — VRAI chiffre, plus de simulation ============
   Avant : un compteur de démo qui partait d'un nombre inventé (184 320) et s'incrémentait
   au hasard toutes les 2,2s, sans aucun rapport avec la réalité. Maintenant : le vrai nombre
   de comptes (Consommateur + Artiste) dont le Pass est actuellement actif, tiré directement
   de la base de données. Rafraîchi régulièrement pour rester à jour sans devoir recharger la page. */
const impactEl = document.getElementById('impact-value');
function formatFCFA(n){ return Math.round(n).toLocaleString('fr-FR'); }
// ---------- Animation de comptage progressif — micro-interaction premium sur un vrai
// chiffre (pas une valeur inventée) : au lieu de remplacer le texte d'un coup, le compteur
// défile du dernier chiffre affiché jusqu'au nouveau, comme les compteurs d'impact des
// grandes apps. Respecte prefers-reduced-motion (saute directement à la valeur finale).
function animateCountUp(el, from, to, duration = 700){
  if(from === to || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)){
    el.textContent = formatFCFA(to);
    return;
  }
  const start = performance.now();
  function tick(now){
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
    el.textContent = formatFCFA(from + (to - from) * eased);
    if(p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
let lastActiveUsersValue = null;
async function refreshActiveUsersCount(){
  if(!impactEl) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/stats/public');
    if(!res.ok) return;
    const data = await res.json();
    if(typeof data.active_users === 'number'){
      const from = lastActiveUsersValue != null ? lastActiveUsersValue : data.active_users;
      animateCountUp(impactEl, from, data.active_users);
      lastActiveUsersValue = data.active_users;
    }
  }catch(e){ /* pas grave si le serveur est momentanément indisponible — l'ancien chiffre reste affiché */ }
}
refreshActiveUsersCount();
setInterval(refreshActiveUsersCount, 3000); // quasi instantané, sans surcharger le serveur gratuit

/* ============ NUNI RADIO TUNER (12 stations) ============ */
const tunerStations = [
  { freq:'87.5', name:'NUNI Hits', desc:'Les morceaux les plus populaires de la plateforme.', filter: ()=>[...tracks].sort((a,b)=>(b.likes||0)-(a.likes||0)) },
  { freq:'88.9', name:'NUNI Rap Congo', desc:'Rap, drill et trap congolais.', filter: ()=> tracks.filter(t=>t.genre==='Rap') },
  { freq:'90.3', name:'NUNI Rumba', desc:'Rumba congolaise classique et moderne.', filter: ()=> tracks.filter(t=>t.genre==='Rumba') },
  { freq:'91.7', name:'NUNI Gospel', desc:'Gospel congolais, entre tradition et modernité.', filter: ()=> tracks.filter(t=>t.genre==='Gospel') },
  { freq:'93.1', name:'NUNI Afro', desc:'Le meilleur de l\'afrobeat congolais.', filter: ()=> tracks.filter(t=>t.genre==='Afro') },
  { freq:'94.8', name:'NUNI Urban', desc:'Hip-hop et sonorités urbaines congolaises.', filter: ()=> tracks.filter(t=>t.genre==='Hip-Hop') },
  { freq:'96.4', name:'NUNI Amapiano', desc:'Amapiano et sons électroniques africains.', filter: ()=> [...tracks].sort(()=>Math.random()-0.5) },
  { freq:'98.2', name:'NUNI Love', desc:'Titres doux, pour les cœurs romantiques.', filter: ()=> [...tracks].sort(()=>Math.random()-0.5) },
  { freq:'100.5', name:'NUNI Live', desc:'Sessions et performances live.', filter: ()=> [...tracks].sort(()=>Math.random()-0.5) },
  { freq:'102.8', name:'NUNI Découverte', desc:'Nouveaux artistes à découvrir en premier.', filter: ()=> [...tracks].sort((a,b)=>(a.likes||0)-(b.likes||0)) },
  { freq:'104.4', name:'NUNI Classics', desc:'Musique traditionnelle congolaise intemporelle.', filter: ()=> tracks.filter(t=>t.genre==='Traditionnel') },
  { freq:'106.9', name:'NUNI Night', desc:'Ambiance nocturne, mix continu.', filter: ()=> [...tracks].sort(()=>Math.random()-0.5) },
];
let tunerIndex = 0;
let tunerPlaying = false;
let tunerQueue = [];
let tunerQueuePos = 0;
let stationChangeTimer = null;

function openTuner(tab){
  document.getElementById('tuner-modal-overlay').classList.add('show');
  setImmersiveMode(true);
  renderTunerStationList();
  renderTunerStation(false);
  switchTunerTab(tab || 'radio');
}
function closeTuner(){
  document.getElementById('tuner-modal-overlay').classList.remove('show');
  setImmersiveMode(false);
}

/* ============ NUNI TALENT — TOP 100 (vraies écoutes + vrais votes hebdomadaires) ============ */
let talentTop100 = null;
let talentMyVoteArtistId = null;
// ============ NUNI TALENT — rail sur l'accueil (accueil, après Défis) ============
// Reprend exactement les mêmes vraies données que le classement complet NUNI Talent
// (/api/talent/top100 — vrais streams + vrais votes de la semaine, jamais inventés).
// Jusqu'à 30 artistes, cartes verticales avec la vraie photo de profil en fond.
let loadHomeTalentRowInFlight = false;
async function loadHomeTalentRow(){
  if(loadHomeTalentRowInFlight) return;
  loadHomeTalentRowInFlight = true;
  try{ await loadHomeTalentRowInner(); } finally { loadHomeTalentRowInFlight = false; }
}
async function loadHomeTalentRowInner(){
  const wrap = document.getElementById('shelf-home-talent');
  const row = document.getElementById('home-talent-row');
  if(!wrap || !row) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/talent/top100');
    if(!res.ok) return;
    const data = await res.json();
    const list = (data.artists || []).slice(0, 30);
    if(!list.length){ wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    row.innerHTML = '';
    list.forEach(a=>{
      const name = a.artist_name || a.first_name;
      const card = document.createElement('div');
      card.className = 'htal-card' + (a.rank <= 3 ? ` htal-podium-${a.rank}` : '');
      if(a.avatar_url) card.style.backgroundImage = `url(${a.avatar_url})`;
      const votedBadge = (data.my_vote_artist_id === a.id)
        ? `<div class="htal-voted" title="Vous avez voté"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></div>` : '';
      const crown = a.rank === 1 ? '<div class="htal-crown"><svg class="nuni-ic nuni-ic-gold filled" viewBox="0 0 24 24" style="width:100%;height:100%;"><path d="M4 18h16l1-9-5 3-4-6-4 6-5-3 1 9z"/></svg></div>' : '';
      card.innerHTML = `
        ${crown}
        <div class="htal-scrim"></div>
        <div class="htal-rank">#${a.rank}</div>
        ${votedBadge}
        <div class="htal-info">
          <div class="htal-name">${name}${a.is_verified ? ' <svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>' : ''}</div>
          <div class="htal-votes">${(a.votes_this_week||0)} vote${a.votes_this_week>1?'s':''} cette semaine</div>
        </div>`;
      card.onclick = ()=> openArtistPage(name, a.id);
      row.appendChild(card);
    });
  }catch(e){ /* pas grave si le serveur est momentanément indisponible */ }
}
async function openTalentModal(){
  const wrap = document.getElementById('talent-rank-list');
  wrap.innerHTML = '<p style="color:var(--text-faint); font-size:13px; text-align:center; padding:20px 0;">Chargement…</p>';
  spawnTalentBubbles();
  document.getElementById('talent-modal-overlay').classList.add('show');

  try{
    const headers = realAuthToken ? { 'Authorization':'Bearer ' + realAuthToken } : {};
    const res = await fetch(NUNI_API_BASE + '/api/talent/top100', { headers });
    const data = await res.json();
    talentTop100 = data.artists || [];
    talentMyVoteArtistId = data.my_vote_artist_id || null;

    wrap.innerHTML = '';
    if(!talentTop100.length){
      wrap.innerHTML = `<p style="color:var(--text-faint); font-size:13px; text-align:center; padding:20px 0;">Aucun artiste avec un Pass actif pour le moment.</p>`;
    }
    talentTop100.forEach(a=>{
      const name = a.artist_name || a.first_name;
      const item = document.createElement('div');
      item.className = 'talent-rank-item' + (a.rank<=3 ? ' top3' : '');
      const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const avatarStyle = a.avatar_url ? `background-image:url(${a.avatar_url}); background-size:cover; background-position:center;` : '';
      const alreadyVotedThis = talentMyVoteArtistId === a.id;
      const votedElsewhere = talentMyVoteArtistId && talentMyVoteArtistId !== a.id;
      item.innerHTML = `
        <div class="talent-rank-num">${a.rank<=3 ? ['<svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><circle cx="12" cy="14" r="7"/><path d="M8 3h8l-2.5 6h-3L8 3z"/><path d="M11 17.5v-5l-1.3.7"/></svg>','<svg class="nuni-ic nuni-ic-ivory" viewBox="0 0 24 24"><circle cx="12" cy="14" r="7"/><path d="M8 3h8l-2.5 6h-3L8 3z"/><path d="M10 16.5c0-1.3 3-1.3 3-3 0-.8-.7-1.2-1.5-1.2-.7 0-1.2.3-1.4.9M10 17.5h3.2"/></svg>','<svg class="nuni-ic nuni-ic-copper" viewBox="0 0 24 24"><circle cx="12" cy="14" r="7"/><path d="M8 3h8l-2.5 6h-3L8 3z"/><path d="M10.3 12.5c.3-.6.9-.8 1.5-.8.9 0 1.5.5 1.5 1.1 0 .5-.5.9-1 1 .6.1 1.1.5 1.1 1.1 0 .7-.7 1.2-1.6 1.2-.7 0-1.3-.3-1.6-.8"/></svg>'][a.rank-1] : '#'+a.rank}</div>
        <div class="talent-rank-av" style="${avatarStyle}">${a.avatar_url ? '' : initials}</div>
        <div class="talent-rank-info">
          <div class="talent-rank-name">${name}</div>
          <div class="talent-rank-meta">${a.genre || 'Artiste NUNI'} · ${formatLikes(a.total_streams)} écoutes${a.votes_this_week ? ' · ' + a.votes_this_week + ' vote(s) cette semaine' : ''}</div>
        </div>
        <button class="talent-vote-btn ${alreadyVotedThis?'voted':''}" ${votedElsewhere ? 'disabled' : ''} onclick="voteForArtist(${a.id}, this)">${alreadyVotedThis ? '<svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Voté' : 'Voter'}</button>`;
      wrap.appendChild(item);
    });
    renderWeeklyWinner(data.weekly_winner);
  }catch(e){
    wrap.innerHTML = `<p style="color:var(--text-faint); font-size:13px; text-align:center; padding:20px 0;">Classement momentanément indisponible.</p>`;
  }
}
function closeTalentModal(){
  document.getElementById('talent-modal-overlay').classList.remove('show');
}
function renderWeeklyWinner(winner){
  const card = document.getElementById('talent-winner-card');
  if(!card) return;
  if(!winner){ card.innerHTML = ''; return; }
  const name = winner.artist_name || winner.first_name;
  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const avatarStyle = winner.avatar_url ? `background-image:url(${winner.avatar_url}); background-size:cover; background-position:center;` : '';
  card.innerHTML = `
    <div class="av" style="${avatarStyle}">${winner.avatar_url ? '' : initials}</div>
    <div>
      <span class="badge"><svg class="nuni-ic filled nuni-ic-gold" viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4"/><path d="M12 13v3M9 20h6M10 20v-2.5h4V20"/></svg> Artiste le plus aimé &amp; voté cette semaine</span>
      <div class="name">${name}</div>
      <div class="meta">${winner.votes_this_week || 0} vote(s) cette semaine</div>
    </div>`;
}
async function voteForArtist(artistId, btn){
  if(!realAuthToken){ toast('Connectez-vous pour voter.'); return; }
  if(btn) btn.disabled = true;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/talent/vote', {
      method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
      body: JSON.stringify({ artistId })
    });
    const data = await res.json();
 if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); if(btn) btn.disabled = false; return; }
    if(btn){
      const rect = btn.getBoundingClientRect();
      spawnVoteBubble(rect.left + rect.width/2, rect.top + rect.height/2);
    }
    toast(data.message || 'Vote enregistré !');
    openTalentModal(); // recharge le vrai classement à jour
 }catch(e){ if(btn) btn.disabled = false; toast(' Impossible de contacter le serveur NUNI.'); }
}
function spawnVoteBubble(x, y){
  for(let i=0;i<5;i++){
    const b = document.createElement('div');
    b.className = 'vote-bubble-pop';
    const size = 8 + Math.random()*14;
    b.style.width = size+'px'; b.style.height = size+'px';
    b.style.left = (x + (Math.random()*40-20)) + 'px';
    b.style.top = (y + (Math.random()*10-5)) + 'px';
    b.style.animationDelay = (i*0.05)+'s';
    document.body.appendChild(b);
    setTimeout(()=> b.remove(), 900);
  }
}
function spawnTalentBubbles(){
  const layer = document.getElementById('talent-bubbles');
  layer.innerHTML = '';
  for(let i=0;i<10;i++){
    const b = document.createElement('div');
    b.className = 'talent-bubble';
    const size = 14 + Math.random()*36;
    b.style.width = size+'px'; b.style.height = size+'px';
    b.style.left = (Math.random()*100)+'%';
    b.style.animationDuration = (7+Math.random()*8)+'s';
    b.style.animationDelay = (Math.random()*8)+'s';
    layer.appendChild(b);
  }
}

function switchTunerTab(tab){
  document.getElementById('tuner-tab-radio').classList.toggle('is-active', tab==='radio');
  document.getElementById('tuner-tab-dj').classList.toggle('is-active', tab==='dj');
  document.getElementById('tuner-pane-radio').style.display = tab==='radio' ? 'block' : 'none';
  document.getElementById('tuner-pane-dj').style.display = tab==='dj' ? 'block' : 'none';
}
function renderTunerStationList(){
  const list = document.getElementById('tuner-station-list');
  list.innerHTML = '';
  tunerStations.forEach((s,i)=>{
    const chip = document.createElement('button');
    chip.className = 'tuner-station-chip' + (i===tunerIndex ? ' is-active' : '');
    chip.textContent = s.freq;
    chip.onclick = ()=>{ tunerIndex = i; renderTunerStation(true); };
    list.appendChild(chip);
  });
}
function renderTunerStation(withFlicker){
  const s = tunerStations[tunerIndex];
  const noise = document.getElementById('tuner-noise');
  if(withFlicker){
    noise.classList.remove('flicker'); void noise.offsetWidth; noise.classList.add('flicker');
  }
  document.getElementById('tuner-freq').innerHTML = s.freq + ' <span>MHz</span>';
  document.getElementById('tuner-station-name').textContent = s.name;
  document.getElementById('tuner-station-desc').textContent = s.desc;
  renderTunerStationList();
  if(tunerPlaying) startTunerPlayback();
}
function tunerStep(dir){
  tunerIndex = (tunerIndex + dir + tunerStations.length) % tunerStations.length;
  renderTunerStation(true);
}
const RADIO_FALLBACK_STREAM = 'https://radio.garden/api/ara/content/listen/O90IGaKD/channel.mp3';
const RADIO_FALLBACK_NAME = 'Radio Congo (flux de secours)';
async function fetchLocalRadioStation(){
  const endpoints = [
    'https://de1.api.radio-browser.info/json/stations/search?country=Democratic%20Republic%20of%20the%20Congo&limit=8&hidebroken=true',
    'https://de1.api.radio-browser.info/json/stations/search?country=Congo&limit=8&hidebroken=true',
  ];
  for(const url of endpoints){
    try{
      const res = await fetch(url);
      if(!res.ok) continue;
      const stations = await res.json();
      const valid = stations.find(s => s.url_resolved || s.url);
      if(valid) return { name: valid.name || 'Radio locale', url: valid.url_resolved || valid.url };
    }catch(e){ /* essaie l'endpoint suivant */ }
  }
  return null;
}
async function startTunerPlayback(){
  const s = tunerStations[tunerIndex];
  tunerQueue = s.filter();
  radioMode = true; genreRadioActive = null; djMode = false;

  // priorité aux vrais fichiers importés correspondant à la station (son réel)
  const realTrack = tunerQueue.find(t => t.audioUrl);
  if(realTrack){
    usingRealAudio = false;
    playTrack(realTrack);
    setRadioLiveBadge(true);
    updateTunerNowPlaying();
    return;
  }

  // sinon : flux radio réel en direct, pour un vrai son
  toast('Connexion à un flux radio réel…');
  let station = null;
  try{ station = await fetchLocalRadioStation(); }catch(e){ station = null; }
  if(!station) station = { name: RADIO_FALLBACK_NAME, url: RADIO_FALLBACK_STREAM };

  clearInterval(progressTimer);
  usingRealAudio = true;
  realAudio.pause();
  realAudio.src = station.url;
  currentTrack = { t: s.name, a: `En direct — ${station.name}`, p: 'pal-4', audioUrl: station.url };
  updateMiniPlayerNowPlaying(currentTrack);
  applyCoverTo(document.getElementById('player-cover'), currentTrack);
  syncFullPlayer();
  realAudio.play().then(()=>{
 toast(` Son en direct — ${station.name}`);
  }).catch(()=>{
    toast('Lecture bloquée par le navigateur — appuyez sur ▶ dans le lecteur pour démarrer le son manuellement.');
  });
  playing = true;
  document.documentElement.classList.add('is-playing');
  document.getElementById('play-icon').innerHTML = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';
  const fpIcon = document.getElementById('fp-play-icon');
  if(fpIcon) fpIcon.innerHTML = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';
  setRadioLiveBadge(true);
  updateTunerNowPlaying();
}
function updateTunerNowPlaying(){
  const tr = currentTrack;
  document.getElementById('tuner-track-t').textContent = tr ? tr.t : '—';
  document.getElementById('tuner-track-a').textContent = tr ? tr.a : '—';
  const cover = document.getElementById('tuner-cover');
  if(tr && tr.cover){ cover.style.backgroundImage = `url(${tr.cover})`; }
  else{ cover.style.backgroundImage = ''; cover.style.background = 'var(--grad-envol)'; }
}
function tunerTogglePlay(){
  tunerPlaying = !tunerPlaying;
  const btn = document.getElementById('tuner-play-btn');
  if(tunerPlaying){
    btn.innerHTML = '<svg class="nuni-ic filled" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg> Station en cours';
    startTunerPlayback();
  } else {
    btn.innerHTML = '<svg class="nuni-ic filled" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M8 5v14l11-7z"/></svg> Écouter cette station';
    radioMode = false;
    setRadioLiveBadge(false);
    if(playing) togglePlay();
  }
}

/* ============ NUNI DJ (6 modes) ============ */
// Ne sélectionne que des morceaux avec un vrai fichier audio — les morceaux de démonstration
// du catalogue (Mokili Ya Sika, Lokito...) n'ont pas de vrai son (pas de tr.audioUrl) : si le
// DJ tombait dessus, on entendait la voix du DJ mais aucune musique (silence simulé).
// Deux instrumentaux fournis directement (hébergés en statique dans le dépôt Nuni site,
// pas via Cloudinary — évite tout souci CORS pour ces fichiers-là). Classés "Afro" d'après
// leur nom de fichier (AFRO_TYPE_BEAT, Instru Afro Mélodique) — à corriger si le genre ne
// correspond pas une fois entendu.
const DJ_BONUS_TRACKS = [
  { t: 'Maasai (Afro Drill)', a: 'NUNI DJ Set', p: 'pal-4', genre: 'Afro', likes: 0, streams: '0',
    audioUrl: 'assets/dj-tracks/maasai-afro-drill.mp3', isReal: false },
  { t: 'Boucan (Instru Afro Mélodique)', a: 'NUNI DJ Set', p: 'pal-6', genre: 'Afro', likes: 0, streams: '0',
    audioUrl: 'assets/dj-tracks/boucan-afro-melodique.mp3', isReal: false },
];
function realPlayableTracks(){ return tracks.filter(t=> !!t.audioUrl).concat(DJ_BONUS_TRACKS); }
const djModes = [
  { id:'club', name:'Club', bpm:126, transition:'Beat Sync', crossfade:3, filter: ()=> shuffleArray(realPlayableTracks()) },
  { id:'festival', name:'Festival', bpm:132, transition:'Drop enchaîné', crossfade:2.5, filter: ()=> [...realPlayableTracks()].sort((a,b)=>(b.likes||0)-(a.likes||0)) },
  { id:'chill', name:'Chill', bpm:92, transition:'Fondu doux', crossfade:6, filter: ()=>{
      const all = realPlayableTracks();
      const pool = all.filter(t=>t.genre==='Gospel' || t.genre==='Traditionnel');
      return shuffleArray(pool.length ? pool : all);
    } },
  { id:'afro', name:'Afro Party', bpm:118, transition:'Crossfade rythmé', crossfade:4, filter: ()=>{
      const all = realPlayableTracks();
      const pool = all.filter(t=>['Afro','Traditionnel'].includes(t.genre));
      return shuffleArray(pool.length ? pool : all);
    } },
  { id:'rapcongo', name:'Rap Congo', bpm:96, transition:'Cut sec', crossfade:1.5, filter: ()=>{
      const all = realPlayableTracks();
      const pool = all.filter(t=>t.genre==='Rap');
      return shuffleArray(pool.length ? pool : all);
    } },
  { id:'rumba', name:'Rumba Lounge', bpm:100, transition:'Mix très doux', crossfade:7, filter: ()=>{
      const all = realPlayableTracks();
      const pool = all.filter(t=>t.genre==='Rumba');
      return shuffleArray(pool.length ? pool : all);
    } },
];
let djModeId = 'club';
let djPlaying = false;
let djQueue = [];
let djQueuePos = 0; // position actuelle dans djQueue — permet à nextTrack/prevTrack de rester dans la vraie file du mode DJ
let djTimer = null;

function renderDjModes(){
  const wrap = document.getElementById('dj-modes');
  wrap.innerHTML = '';
  djModes.forEach(m=>{
    const chip = document.createElement('button');
    chip.className = 'dj-mode-chip' + (m.id===djModeId ? ' is-active' : '');
    chip.textContent = m.name;
    chip.onclick = ()=>{ djModeId = m.id; renderDjModes(); updateDjLabels(); if(djPlaying) startDjPlayback(); };
    wrap.appendChild(chip);
  });
}
// Couleurs par ambiance — cohérentes avec le mood de chaque mode DJ (violet nocturne pour
// Club, rose/or plus vif pour Festival, tons chauds et doux pour Chill/Rumba, etc.)
const DJ_FX_THEMES = {
  club:      { c1:'#6E45A8', c2:'#D4AF6A' },
  festival:  { c1:'#C9667A', c2:'#E8C77E' },
  chill:     { c1:'#1E8449', c2:'#D4AF6A' },
  afro:      { c1:'#1E8449', c2:'#E8C77E' },
  rapcongo:  { c1:'#7A1E14', c2:'#1D2550' },
  rumba:     { c1:'#C0392B', c2:'#D4AF6A' },
};
function applyDjFxTheme(){
  const stage = document.getElementById('dj-fx-stage');
  const m = djModes.find(x=>x.id===djModeId);
  if(!stage || !m) return;
  const theme = DJ_FX_THEMES[m.id] || DJ_FX_THEMES.club;
  stage.style.setProperty('--dj-fx-c1', theme.c1);
  stage.style.setProperty('--dj-fx-c2', theme.c2);
  stage.style.setProperty('--dj-beat-duration', (60 / m.bpm) + 's');
}
function updateDjLabels(){
  const m = djModes.find(x=>x.id===djModeId);
  document.getElementById('dj-mode-label').textContent = m.name;
  document.getElementById('dj-transition-label').textContent = m.transition;
  document.getElementById('dj-bpm-label').textContent = m.bpm;
  updateDjCrossfadeLabel();
  applyDjFxTheme();
}
let djAvatarInstance = null; // instance unique de NuniDJAvatar, créée à la première activation du mode DJ
function startDjPlayback(){
  const m = djModes.find(x=>x.id===djModeId);
  djQueue = m.filter();
  if(!djQueue.length){ toast('Aucun titre disponible pour ce mode pour le moment.'); return; }
  djQueuePos = 0;
  radioMode = false; genreRadioActive = null; djMode = true;
  usingRealAudio = false;
  playTrack(djQueue[0]);
  updateDjNowPlaying();
  clearInterval(djTimer);
  djTimer = setInterval(updateDjNowPlaying, 1000);

  // Avatar DJ animé, réactif en temps réel au vrai son en cours de lecture (analyse Web
  // Audio) — remplace visuellement la pochette statique par un visage qui bouge avec la
  // musique. Créé une seule fois, reconnecté à chaque activation du mode DJ.
  if(typeof NuniDJAvatar !== 'undefined'){
    const container = document.getElementById('dj-avatar-container');
    if(container){
      try{
        if(!djAvatarInstance) djAvatarInstance = new NuniDJAvatar(container, { djMode:true, size:180 });
        // Volontairement PAS connecté au vrai son (djAvatarInstance.connect(realAudio)) :
        // Cloudinary ne renvoie pas les en-têtes CORS nécessaires pour ces fichiers, et une
        // fois un graphe Web Audio branché sur une source cross-origin non autorisée, Chrome
        // ne se contente pas de couper l'analyse — il coupe le SON RÉEL joué (confirmé en
        // console : "MediaElementAudioSource outputs zeroes due to CORS access restrictions").
        // L'avatar garde son animation de base (respiration, clignements, mode DJ) sans être
        // piloté précisément par l'audio, en échange d'un son garanti.
        djAvatarInstance.start();
      }catch(e){
        console.warn('Avatar DJ non démarré (son réel non affecté) :', e);
      }
    }
  }
}
function updateDjNowPlaying(){
  const tr = currentTrack;
  document.getElementById('dj-track-t').textContent = tr ? tr.t : '—';
  document.getElementById('dj-track-a').textContent = tr ? tr.a : '—';
  const cover = document.getElementById('dj-cover');
  if(tr && tr.cover){ cover.style.backgroundImage = `url(${tr.cover})`; }
  else{ cover.style.backgroundImage = ''; cover.style.background = 'var(--grad-envol)'; }
  const idx = djQueue.findIndex(t=>t.t===tr?.t);
  const next = djQueue[(idx+1) % djQueue.length];
  document.getElementById('dj-next-label').textContent = next ? next.t : '—';
  const remaining = Math.max(0, duration - elapsed);
  document.getElementById('dj-remaining-label').textContent = fmt(remaining);
}
// ---------- Voix du DJ NUNI (synthèse vocale du navigateur, sans API payante) ----------
// 10 phrases d'ambiance, jamais deux fois de suite la même tant que les 10 n'ont pas toutes
// été dites au moins une fois. La musique baisse brièvement pendant l'annonce, comme un vrai
// micro de boîte de nuit qui coupe le son ambiant, puis remonte automatiquement après.
const djVoiceLines = [
  "Yo yo, NUNI DJ dans la place, on lâche rien !",
  "Big up à tout Kin et Brazza ce soir !",
  "Ambiance ya bien, tout le monde bouge !",
  "One love, on garde le good vibe !",
  "La sauce est chaude, restez avec nous !",
  "Jah bless, on monte encore d'un cran !",
  "242, 243, tout le monde répond présent !",
  "Irie ! Le prochain son va faire mal !",
  "On n'arrête rien, NUNI DJ tient le mic !",
  "Respect à tous les vrais, la fête continue !",
];
let djVoiceUsedIndexes = new Set();
// Vraies notes vocales du DJ (hébergées en statique dans Nuni site, assets/dj-voice/) — la
// synthèse vocale du navigateur ne sert plus qu'en repli si ces fichiers ne sont pas encore
// en place (ex: juste après une mise à jour, le temps que le déploiement se termine).
const djVoiceClips = [
  'assets/dj-voice/voice-01.mp3',
  'assets/dj-voice/voice-02.mp3',
  'assets/dj-voice/voice-03.mp3',
  'assets/dj-voice/voice-04.mp3',
  'assets/dj-voice/voice-05.mp3',
  'assets/dj-voice/voice-06.mp3',
  'assets/dj-voice/voice-07.mp3',
  'assets/dj-voice/voice-08.mp3',
];
// Set "hype" catégorisé — découpé aux vraies pauses de silence détectées dans l'enregistrement
// (analyse réelle du signal), la catégorie de chaque morceau est une estimation basée sur le
// texte fourni et l'ordre chronologique, pas une transcription mot-à-mot vérifiée.
const djVoiceCategories = {
  intro: ['assets/dj-voice-hype/intro-01.mp3'],
  hype: ['assets/dj-voice-hype/hype-01.mp3'],
  crowd: ['assets/dj-voice-hype/crowd-01.mp3', 'assets/dj-voice-hype/crowd-02.mp3'],
  drop: ['assets/dj-voice-hype/drop-01.mp3', 'assets/dj-voice-hype/drop-02.mp3'],
  outro: ['assets/dj-voice-hype/outro-01.mp3'],
};
// Ducking musique/voix précis : -8 dB pendant la voix, fondu d'entrée 200ms, fondu de
// sortie 300ms — plutôt qu'une coupure nette de volume.
const DJ_DUCK_DB = -8;
const DJ_DUCK_FACTOR = Math.pow(10, DJ_DUCK_DB / 20); // ≈ 0.398
let djDuckRampTimer = null;
function rampRealAudioVolume(to, ms){
  if(djDuckRampTimer) clearInterval(djDuckRampTimer);
  const from = realAudio.volume;
  const steps = Math.max(4, Math.round(ms / 25));
  let i = 0;
  djDuckRampTimer = setInterval(()=>{
    i++;
    realAudio.volume = from + (to - from) * (i / steps);
    if(i >= steps){ clearInterval(djDuckRampTimer); djDuckRampTimer = null; realAudio.volume = to; }
  }, 25);
}
function duckMusicForVoice(){ if(usingRealAudio) rampRealAudioVolume(userVolume * DJ_DUCK_FACTOR, 200); }
function restoreMusicAfterVoice(){ if(usingRealAudio) rampRealAudioVolume(userVolume, 300); }

let djVoiceClipAudio = null;
let djVoiceClipUsedIndexes = new Set();
function djSpeak(force){
  if(!djMode) return;
  if(!force && Math.random() > 0.4) return; // ne parle pas à chaque morceau, sinon ça devient vite lassant

  // Tout lancement du DJ : une intro dédiée si disponible, plutôt qu'une phrase au hasard.
  if(force && djVoiceCategories.intro.length){
    playDjVoiceClip(djVoiceCategories.intro[0]);
    return;
  }

  // Sinon : tirage dans hype/crowd/drop (catégorisé) + le set générique, sans répéter le
  // même clip tant que le stock n'est pas épuisé.
  const pool = [...djVoiceCategories.hype, ...djVoiceCategories.crowd, ...djVoiceCategories.drop, ...djVoiceClips];
  if(pool.length){
    if(djVoiceClipUsedIndexes.size >= pool.length) djVoiceClipUsedIndexes.clear();
    let idx;
    do { idx = Math.floor(Math.random() * pool.length); } while(djVoiceClipUsedIndexes.has(idx));
    djVoiceClipUsedIndexes.add(idx);
    playDjVoiceClip(pool[idx]);
    return;
  }
  djSpeakFallbackTTS(force);
}
function playDjVoiceClip(src){
  if(!djVoiceClipAudio){ djVoiceClipAudio = new Audio(); djVoiceClipAudio.style.display = 'none'; document.body.appendChild(djVoiceClipAudio); }
  djVoiceClipAudio.pause();
  djVoiceClipAudio.src = src;
  djVoiceClipAudio.currentTime = 0;
  djVoiceClipAudio.onplay = duckMusicForVoice;
  djVoiceClipAudio.onended = restoreMusicAfterVoice;
  djVoiceClipAudio.onerror = ()=>{ restoreMusicAfterVoice(); djSpeakFallbackTTS(false); }; // fichier introuvable : repli TTS
  djVoiceClipAudio.play().catch(()=>{ restoreMusicAfterVoice(); djSpeakFallbackTTS(false); });
}
function djSpeakFallbackTTS(force){
  if(!('speechSynthesis' in window)) return;
  if(djVoiceUsedIndexes.size >= djVoiceLines.length) djVoiceUsedIndexes.clear();
  let idx;
  do { idx = Math.floor(Math.random() * djVoiceLines.length); } while(djVoiceUsedIndexes.has(idx));
  djVoiceUsedIndexes.add(idx);

  try{
    window.speechSynthesis.cancel(); // évite d'empiler plusieurs annonces si on parle trop vite
    const utter = new SpeechSynthesisUtterance(djVoiceLines[idx]);
    utter.lang = 'fr-FR';
    utter.pitch = 0.9;
    utter.rate = 1.05;
    utter.onstart = duckMusicForVoice;
    utter.onend = restoreMusicAfterVoice;
    utter.onerror = restoreMusicAfterVoice;
    window.speechSynthesis.speak(utter);
  }catch(e){ /* synthèse vocale indisponible sur ce navigateur : pas bloquant */ }
}

// ---------- Fondu enchaîné (crossfade) façon Apple Music DJ ----------
// Quelques secondes avant la fin du morceau en cours, le morceau suivant démarre en
// parallèle sur un second élément audio dédié, à volume 0. Les deux volumes se croisent
// progressivement, puis on "passe la main" au vrai lecteur (realAudio) exactement à la
// même position — aucune coupure nette, aucun redémarrage audible à 0.
let djCrossfadeOverride = 'auto'; // 'auto' | 2 | 4 | 6 | 8 — réglage choisi dans les paramètres DJ
let djCrossfadeTriggered = false;
let djFadeAudio = null;
let djFadeTimer = null;
function currentDjCrossfadeSeconds(){
  if(djCrossfadeOverride !== 'auto') return Number(djCrossfadeOverride);
  const mode = djModes.find(x=>x.id===djModeId);
  return (mode && mode.crossfade) || 4;
}
function startDjCrossfade(){
  if(!djMode || djQueue.length < 2) return; // pas de morceau suivant : le 'ended' naturel prendra le relais
  const nextTr = djQueue[(djQueuePos + 1) % djQueue.length];
  if(!nextTr || !nextTr.audioUrl) return; // repli sur le comportement naturel si le suivant n'est pas jouable

  if(!djFadeAudio){ djFadeAudio = new Audio(); djFadeAudio.style.display = 'none'; document.body.appendChild(djFadeAudio); }
  djFadeAudio.src = nextTr.audioUrl;
  djFadeAudio.currentTime = 0;
  djFadeAudio.volume = 0;
  djFadeAudio.play().catch(()=>{});
  // Signal visuel + couleur de l'aura qui commence déjà à basculer vers le prochain morceau,
  // pendant que le fondu audio est en cours — la transition se voit autant qu'elle s'entend.
  document.documentElement.classList.add('dj-transitioning');
  if(typeof NuniAura !== 'undefined') NuniAura.applyTrack(nextTr);

  const crossfadeSeconds = currentDjCrossfadeSeconds();
  const steps = Math.round(crossfadeSeconds * 7); // ~7 pas/seconde, fluide sans être excessif
  const stepMs = (crossfadeSeconds * 1000) / steps;
  let i = 0;
  djFadeTimer = setInterval(()=>{
    i++;
    const t = i / steps;
    realAudio.volume = Math.max(0, userVolume * (1 - t));
    djFadeAudio.volume = Math.min(userVolume, userVolume * t);
    if(i >= steps){
      clearInterval(djFadeTimer);
      djFadeTimer = null;
      document.documentElement.classList.remove('dj-transitioning');
      const handoffTime = djFadeAudio.currentTime;
      const tr = djAdvanceQueue(); // fait vraiment avancer la file (mêmes règles anti-répétition qu'ailleurs)
      playTrack(tr); // remet tout en ordre : métadonnées, vrai stream compté, historique, avatar, voix…
      realAudio.currentTime = handoffTime; // reprend exactement où le fondu s'est arrêté, pas de saut à 0
      realAudio.volume = userVolume;
    }
  }, stepMs);
}

// ---------- Ajout d'un son local pendant le DJ ----------
// Insère un fichier audio depuis l'ordinateur directement dans la file du mode DJ en cours,
// juste après le morceau en train de jouer — sans passer par tout le formulaire de
// publication (titre/genre/pochette/droits). Reste purement local à cette session : pas
// envoyé à Cloudinary, pas ajouté au catalogue partagé, pas de vrai stream compté (puisque
// ce n'est pas un vrai morceau publié par un artiste).
function handleDjLocalUpload(e){
  const file = e.target.files[0];
  e.target.value = '';
  if(!file) return;
  if(!djMode || !djPlaying){
    toast('Lancez d\'abord le DJ avant d\'ajouter un son local.');
    return;
  }
  const localTrack = {
    t: file.name.replace(/\.[^/.]+$/, ''),
    a: 'Import local',
    p: 'pal-1',
    genre: djModes.find(x=>x.id===djModeId).name,
    likes: 0,
    streams: '0',
    audioUrl: URL.createObjectURL(file),
    isReal: false, // pas de vrai stream compté : fichier local, non publié
  };
  djQueue.splice(djQueuePos + 1, 0, localTrack);
  toast(`"${localTrack.t}" ajouté à la file — jouera juste après le morceau en cours.`);
}

function djTogglePlay(){
  djPlaying = !djPlaying;
  const btn = document.getElementById('dj-play-btn');
  const playerDjBtn = document.getElementById('fp-dj-toggle-btn');
  if(djPlaying){
    btn.innerHTML = '<svg class="nuni-ic filled" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg> DJ en cours';
    if(playerDjBtn){ playerDjBtn.classList.add('is-dj-active'); playerDjBtn.innerHTML = playerDjBtn.innerHTML.replace('DJ', 'DJ ACTIVÉ'); }
    startDjPlayback();
    djVoiceUsedIndexes.clear();
    djSpeak(true); // annonce toujours au lancement
    toast('NUNI DJ activé — enchaînement automatique selon le mode ' + djModes.find(x=>x.id===djModeId).name + '.');
  } else {
    btn.innerHTML = '<svg class="nuni-ic filled" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M8 5v14l11-7z"/></svg> Lancer le DJ';
    if(playerDjBtn){ playerDjBtn.classList.remove('is-dj-active'); playerDjBtn.innerHTML = playerDjBtn.innerHTML.replace('DJ ACTIVÉ', 'DJ'); }
    djMode = false;
    clearInterval(djTimer);
    if(djFadeTimer){ clearInterval(djFadeTimer); djFadeTimer = null; }
    if(djFadeAudio) djFadeAudio.pause();
    djCrossfadeTriggered = false;
    document.documentElement.classList.remove('dj-transitioning');
    if(djAvatarInstance) djAvatarInstance.stop();
    if('speechSynthesis' in window) window.speechSynthesis.cancel();
    if(djVoiceClipAudio) djVoiceClipAudio.pause();
    if(djVoiceCategories.outro.length) playDjVoiceClip(djVoiceCategories.outro[0]); // petit mot de fin, si dispo
    if(djDuckRampTimer){ clearInterval(djDuckRampTimer); djDuckRampTimer = null; }
    realAudio.volume = userVolume; // filet de sécurité : jamais de volume coincé bas si on coupe le DJ en pleine phrase
    if(playing) togglePlay();
    toast('NUNI DJ arrêté.');
  }
}
// ---------- Réglages du fondu enchaîné — vrai choix, pas décoratif (voir currentDjCrossfadeSeconds) ----------
function updateDjCrossfadeLabel(){
  const label = document.getElementById('dj-crossfade-label');
  if(label) label.textContent = currentDjCrossfadeSeconds() + ' s';
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.dj-cf-opt').forEach(btn=>{
    btn.onclick = ()=>{
      djCrossfadeOverride = btn.dataset.cf === 'auto' ? 'auto' : Number(btn.dataset.cf);
      document.querySelectorAll('.dj-cf-opt').forEach(b=> b.classList.toggle('is-active', b === btn));
      updateDjCrossfadeLabel();
    };
  });
});
renderDjModes();
updateDjLabels();

let radioMode = false;
let djMode = false;
let genreRadioActive = null;

/* ============ ARTISTES À SUIVRE ============
   artist-suggest-row est rempli dynamiquement par loadFeaturedArtists() plus bas
   (l'ancien tableau statique suggestedArtists n'était plus utilisé nulle part). */

/* ============ PROGRESSION RÉELLE (niveau, XP, badges) ============
   Avant : listenerBadges était un tableau codé en dur, identique pour tout le monde,
   jamais branché à aucune vraie donnée. Ici : tout vient de /api/me/progress, calculé
   en direct côté serveur à partir des vraies écoutes, genres, artistes suivis, etc. */
let lastKnownLevel = null; // sert à détecter un vrai passage de niveau entre deux rafraîchissements
// Icônes des badges d'auditeur — trait fin, cohérentes avec le reste de l'interface (nav,
// classement…), plutôt que des emoji dont le rendu varie d'un appareil/OS à l'autre.
const BADGE_ICONS = {
  star: '<path d="M12 3.5 14.5 9l5.5.6-4 3.8 1 5.6L12 16l-5 3 1-5.6-4-3.8L9.5 9z"/>',
  headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4.5" height="7" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="7" rx="1.5"/>',
  flame: '<path d="M12 3c1.2 3 -1.5 4.3-1.5 7a3.5 3.5 0 0 0 7 0c0-1.4-.7-2.4-1.5-3 .6 2.3-.9 4-2.5 4-1.8 0-3-1.5-3-3.4C10.5 5.3 12 4 12 3z"/><path d="M9 14a4 4 0 0 0 8 0"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.2 3.5 5.2 3.5 8.5s-1.2 6.3-3.5 8.5c-2.3-2.2-3.5-5.2-3.5-8.5S9.7 5.7 12 3.5z"/>',
  heart: '<path d="M20.5 5.2a5 5 0 0 0-7.1 0L12 6.6l-1.4-1.4a5 5 0 1 0-7.1 7.1L12 21l8.5-8.7a5 5 0 0 0 0-7.1z"/>',
  trophy: '<path d="M7.5 4h9v4.5a4.5 4.5 0 0 1-9 0V4z"/><path d="M7.5 5.5H5a2.2 2.2 0 0 0 2.5 4.3M16.5 5.5H19A2.2 2.2 0 0 1 16.5 9.8"/><path d="M12 12.5V16M9 20h6"/>',
};
function badgeIconSvg(key){
  const inner = BADGE_ICONS[key] || BADGE_ICONS.star;
  return `<svg class="nuni-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
let loadProgressInFlight = false;
async function loadProgress(){
  if(loadProgressInFlight) return; // un appel est déjà en cours — jamais en lancer un second par-dessus
  loadProgressInFlight = true;
  try{
    await loadProgressInner();
  } finally {
    loadProgressInFlight = false;
  }
}
async function loadProgressInner(){
  const badgesRow = document.getElementById('badges-row');
  const levelWrap = document.getElementById('level-progress-wrap');
  if(!badgesRow && !levelWrap) return;
  if(!realAuthToken) return; // besoin d'être connecté pour avoir une vraie progression
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/progress', {
      headers:{ 'Authorization':'Bearer ' + realAuthToken }
    });
    if(!res.ok) return;
    const data = await res.json();

    if(badgesRow){
      badgesRow.innerHTML = '';
      // Icônes SVG (même style que le reste du site : trait, pas d'emoji) plutôt que les
      // emoji envoyés par certains navigateurs/OS de façon incohérente (rendu différent
      // selon l'appareil) — voir badgeIconSvg juste au-dessus de loadProgress.
      data.badges.forEach(b=>{
        const chip = document.createElement('div');
        chip.className = 'badge-chip' + (b.locked ? ' locked' : '');
        chip.innerHTML = `<div class="ic">${badgeIconSvg(b.icon)}</div><div class="n">${b.n}</div><div class="d">${b.d}</div>`;
        badgesRow.appendChild(chip);
      });
    }
    if(levelWrap){
      levelWrap.style.display = '';
      levelWrap.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
          <span style="font-weight:700; color:var(--text);">Niveau ${data.level} — ${data.name}</span>
          <span style="font-size:12px; color:var(--text-faint);">${data.xp} XP${data.xp_for_next ? ' / ' + data.xp_for_next + ' XP' : ' (niveau max)'}</span>
        </div>
        <div style="height:8px; border-radius:999px; background:rgba(244,238,225,0.1); overflow:hidden;">
          <div style="height:100%; width:${data.progress_pct}%; background:var(--grad-envol); border-radius:999px; transition:width .6s ease;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
          ${data.next_level_name ? `<p style="font-size:11px; color:var(--text-faint); margin:0;">Prochain niveau : ${data.next_level_name}</p>` : '<span></span>'}
        </div>`;
    }
    // Vrai passage de niveau détecté (pas juste au tout premier chargement) — célébration visuelle.
    if(lastKnownLevel !== null && data.level > lastKnownLevel){
      celebrateLevelUp(data.level, data.name);
    }
    lastKnownLevel = data.level;
  }catch(e){ /* pas grave si le serveur est momentanément indisponible */ }
  loadChallenges();
  loadHomeTalentRow();
  loadLeaderboard();
}
loadProgress();

/* Confettis + carte animée au passage de niveau — bien plus marquant qu'un simple toast
   pour le moment le plus gratifiant de la progression. */
function celebrateLevelUp(level, name){
  const overlay = document.getElementById('levelup-overlay');
  if(!overlay) return;
  overlay.innerHTML = `
    <div class="levelup-card">
      <div class="lu-eyebrow">Niveau supérieur</div>
      <div class="lu-title">Niveau ${level} — ${name}</div>
    </div>`;
  const colors = ['#D4AF6A','#1E8449','#C0392B','#8E63C9','#E8C77E'];
  for(let i=0;i<24;i++){
    const c = document.createElement('span');
    c.className = 'levelup-confetti';
    const angle = Math.random()*Math.PI*2;
    const dist = 120 + Math.random()*160;
    c.style.setProperty('--cx', Math.cos(angle)*dist + 'px');
    c.style.setProperty('--cy', Math.sin(angle)*dist + 'px');
    c.style.setProperty('--cr', (Math.random()*720-360) + 'deg');
    c.style.background = colors[Math.floor(Math.random()*colors.length)];
    c.style.animationDelay = (Math.random()*0.15) + 's';
    overlay.appendChild(c);
  }
  overlay.classList.add('show');
 toast(` Niveau ${level} atteint — ${name} !`);
  hapticPing();
  setTimeout(()=>{ overlay.classList.remove('show'); setTimeout(()=>{ overlay.innerHTML = ''; }, 350); }, 2600);
}

/* ============ CLASSEMENT PUBLIC (XP) ============
   Étape 5 de la gamification. Top 5 affiché sur l'accueil, avec médaille pour le podium.
   Le propre rang de la personne connectée est affiché en dessous si elle n'est pas dans
   le top (pas besoin d'être connecté pour voir le classement, juste pour voir son rang). */
let loadLeaderboardInFlight = false;
async function loadLeaderboard(){
  if(loadLeaderboardInFlight) return;
  loadLeaderboardInFlight = true;
  try{ await loadLeaderboardInner(); } finally { loadLeaderboardInFlight = false; }
}
async function loadLeaderboardInner(){
  const wrap = document.getElementById('shelf-leaderboard');
  const list = document.getElementById('leaderboard-list');
  const myRankEl = document.getElementById('leaderboard-my-rank');
  if(!wrap || !list) return;
  try{
    const headers = realAuthToken ? { 'Authorization':'Bearer ' + realAuthToken } : {};
    const res = await fetch(NUNI_API_BASE + '/api/leaderboard', { headers });
    if(!res.ok) return;
    const data = await res.json();
    if(!data.top || !data.top.length){ wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    const medals = { 1:'<svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><circle cx="12" cy="14" r="7"/><path d="M8 3h8l-2.5 6h-3L8 3z"/><path d="M11 17.5v-5l-1.3.7"/></svg>', 2:'<svg class="nuni-ic nuni-ic-ivory" viewBox="0 0 24 24"><circle cx="12" cy="14" r="7"/><path d="M8 3h8l-2.5 6h-3L8 3z"/><path d="M10 16.5c0-1.3 3-1.3 3-3 0-.8-.7-1.2-1.5-1.2-.7 0-1.2.3-1.4.9M10 17.5h3.2"/></svg>', 3:'<svg class="nuni-ic nuni-ic-copper" viewBox="0 0 24 24"><circle cx="12" cy="14" r="7"/><path d="M8 3h8l-2.5 6h-3L8 3z"/><path d="M10.3 12.5c.3-.6.9-.8 1.5-.8.9 0 1.5.5 1.5 1.1 0 .5-.5.9-1 1 .6.1 1.1.5 1.1 1.1 0 .7-.7 1.2-1.6 1.2-.7 0-1.3-.3-1.6-.8"/></svg>' };
    list.innerHTML = data.top.slice(0, 5).map(r=>{
      const initial = (r.name || '?').charAt(0).toUpperCase();
      const avatar = r.avatar_url
        ? `<img class="lb-avatar" src="${r.avatar_url}" alt="">`
        : `<div class="lb-avatar">${initial}</div>`;
      return `
        <div class="leaderboard-row${r.rank <= 3 ? ' is-medal' : ''}">
          <div class="lb-rank">${medals[r.rank] || '#' + r.rank}</div>
          ${avatar}
          <div class="lb-name">${esc(r.name)}</div>
          <div class="lb-xp">${r.xp} XP</div>
        </div>`;
    }).join('');
    if(myRankEl){
      if(data.my_rank){
        myRankEl.style.display = '';
        myRankEl.textContent = `Votre rang : #${data.my_rank.rank} — ${data.my_rank.xp} XP`;
      } else {
        myRankEl.style.display = 'none';
      }
    }
  }catch(e){ /* pas grave si le serveur est momentanément indisponible */ }
}

/* ============ DÉFIS QUOTIDIENS / HEBDOMADAIRES ============
   Étape 3 de la gamification. Récompense en XP, cliquée manuellement une fois le défi
   complété (bouton "Récupérer"), pour donner un vrai geste de gratification. */
async function loadChallenges(){
  const wrap = document.getElementById('shelf-challenges');
  const row = document.getElementById('challenges-row');
  if(!wrap || !row) return;
  if(!realAuthToken){ wrap.style.display = 'none'; return; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/challenges', {
      headers:{ 'Authorization':'Bearer ' + realAuthToken }
    });
    if(!res.ok) return;
    const data = await res.json();
    wrap.style.display = '';
    row.innerHTML = '';
    data.challenges.forEach(c=>{
      const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
      const card = document.createElement('div');
      card.className = 'challenge-card' + (c.claimed ? ' is-claimed' : c.completed ? ' is-ready' : '');
      card.innerHTML = `
        <div class="cc-top">
          <span class="cc-tag">${c.period === 'weekly' ? 'Hebdo' : 'Quotidien'}</span>
          <span class="cc-xp">+${c.xp} XP</span>
        </div>
        <div class="cc-title">${esc(c.title)}</div>
        <div class="cc-bar-track"><div class="cc-bar-fill" style="width:${pct}%;"></div></div>
        <div class="cc-foot">
          <span>${c.progress}/${c.target}</span>
          ${c.claimed
            ? '<span><svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Récupéré</span>'
            : c.completed
              ? `<button class="cc-claim" onclick="claimChallenge('${c.key}', this)">Récupérer</button>`
              : '<span>En cours</span>'}
        </div>`;
      row.appendChild(card);
    });
  }catch(e){ /* pas grave si le serveur est momentanément indisponible */ }
}

async function claimChallenge(key, btn){
  if(btn) btn.disabled = true;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/challenges/' + key + '/claim', {
      method:'POST',
      headers:{ 'Authorization':'Bearer ' + realAuthToken }
    });
    const data = await res.json();
    if(!res.ok){ toast(data.error || 'Impossible de récupérer la récompense.'); if(btn) btn.disabled = false; return; }
    toast(data.message || 'Récompense récupérée !');
    loadProgress();
  }catch(e){ toast('Impossible de contacter le serveur.'); if(btn) btn.disabled = false; }
}
// ---------- Top 100 artistes — vrai classement par abonnés ----------
// Ouvert depuis "Tout voir" sous "Artistes à suivre". Réservé aux vrais comptes avec un
// Pass Artiste actif, classés par leur vrai nombre d'abonnés (table follows côté serveur).
function ensureTop100Styles(){
  if(document.getElementById('top100-styles')) return;
  const style = document.createElement('style');
  style.id = 'top100-styles';
  style.textContent = `
    #top100-overlay{position:fixed; inset:0; z-index:9999; background:#0A0A10; overflow-y:auto; opacity:0; transition:opacity .25s ease;}
    #top100-overlay.show{opacity:1;}
    .t100-close{position:fixed; top:calc(18px + env(safe-area-inset-top,0)); right:22px; width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14); color:#fff; font-size:17px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center;}
    .t100-close:hover{background:rgba(255,255,255,0.16);}
    .t100-wrap{max-width:720px; margin:0 auto; padding:60px 24px 80px;}
    .t100-title{color:#fff; font-size:26px; font-weight:800; margin-bottom:6px;}
    .t100-sub{color:#8a8a94; font-size:13px; margin-bottom:28px;}
    .t100-row{display:flex; align-items:center; gap:14px; padding:12px 14px; border-radius:12px; background:rgba(255,255,255,0.04); margin-bottom:8px;}
    .t100-rank{width:32px; text-align:center; font-weight:700; color:#8a8a94; font-family:var(--font-data, monospace); flex-shrink:0;}
    .t100-av{width:42px; height:42px; border-radius:50%; background:var(--grad-envol); display:flex; align-items:center; justify-content:center; color:#0A0A10; font-weight:700; font-size:14px; flex-shrink:0; background-size:cover; background-position:center; cursor:pointer;}
    .t100-info{flex:1; min-width:0; cursor:pointer;}
    .t100-name{color:#fff; font-weight:700; font-size:14px;}
    .t100-meta{color:#8a8a94; font-size:12px;}
    .t100-followers{color:var(--accent,#D4AF6A); font-weight:700; font-size:13px; white-space:nowrap;}
    .t100-follow-btn{background:var(--grad-envol); border:none; color:#241708; font-weight:700; font-size:12px; padding:7px 14px; border-radius:999px; cursor:pointer; white-space:nowrap;}
    .t100-follow-btn.is-following{background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.25);}
    .t100-empty{color:var(--text-faint,#8a8a94); font-size:13px; text-align:center; padding:40px 0;}
  `;
  document.head.appendChild(style);
}
async function openTop100ArtistsPage(){
  ensureTop100Styles();
  let overlay = document.getElementById('top100-overlay');
  if(overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'top100-overlay';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const closeOverlay = ()=>{ overlay.classList.remove('show'); document.body.style.overflow = ''; setTimeout(()=> overlay.remove(), 200); };

  overlay.innerHTML = `
    <button class="t100-close" title="Fermer"><svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    <div class="t100-wrap">
      <div class="t100-title">Top 100 artistes NUNI</div>
      <div class="t100-sub">Classement réel par nombre d'abonnés — uniquement les comptes avec un Pass Artiste actif.</div>
      <div id="t100-list">Chargement…</div>
    </div>`;
  overlay.querySelector('.t100-close').onclick = closeOverlay;
  requestAnimationFrame(()=> overlay.classList.add('show'));
  attachSwipeDownToClose(overlay, closeOverlay);

  try{
    const res = await fetch(NUNI_API_BASE + '/api/artists/top100');
    const data = await res.json();
    const list = document.getElementById('t100-list');
    if(!list) return; // overlay fermé entre-temps
    const artists = data.artists || [];
    if(!artists.length){
      list.innerHTML = `<div class="t100-empty">Aucun artiste avec un Pass actif pour le moment.</div>`;
      return;
    }
    list.innerHTML = '';
    artists.forEach(a=>{
      const name = a.artist_name || a.first_name;
      const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const avatarStyle = a.avatar_url ? `background-image:url(${a.avatar_url});` : '';
      const row = document.createElement('div');
      row.className = 't100-row';
      row.innerHTML = `
        <div class="t100-rank">#${a.rnk}</div>
        <div class="t100-av" style="${avatarStyle}">${a.avatar_url ? '' : initials}</div>
        <div class="t100-info">
          <div class="t100-name">${name}${a.is_verified ? ' <svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>' : ''}</div>
          <div class="t100-meta">${a.top_genre || 'Artiste NUNI'}</div>
        </div>
        <div class="t100-followers">${(a.follower_count||0).toLocaleString('fr-FR')} abonnés</div>
        <button class="t100-follow-btn">Suivre</button>`;
      const goToArtist = ()=>{ closeOverlay(); openArtistPage(name, a.id); };
      row.querySelector('.t100-av').onclick = goToArtist;
      row.querySelector('.t100-info').onclick = goToArtist;
      const followBtn = row.querySelector('.t100-follow-btn');
      if(realAuthToken){
        fetch(NUNI_API_BASE + '/api/follow/' + a.id + '/status', { headers:{ 'Authorization':'Bearer ' + realAuthToken } })
 .then(r=>r.json()).then(d=>{ followBtn.textContent = d.following ? 'Suivi ' : 'Suivre'; followBtn.classList.toggle('is-following', d.following); })
          .catch(()=>{});
      }
      followBtn.onclick = async ()=>{
        if(!realAuthToken){ toast('Connectez-vous pour suivre un artiste.'); return; }
        followBtn.disabled = true;
        try{
          const res2 = await fetch(NUNI_API_BASE + '/api/follow', {
            method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
            body: JSON.stringify({ artistId: a.id })
          });
          const data2 = await res2.json();
          followBtn.disabled = false;
 if(!res2.ok){ toast(' ' + (data2.error || 'Erreur.')); return; }
 followBtn.textContent = data2.following ? 'Suivi ' : 'Suivre';
          followBtn.classList.toggle('is-following', data2.following);
 }catch(e){ followBtn.disabled = false; toast(' Impossible de contacter le serveur NUNI.'); }
      };
      list.appendChild(row);
    });
  }catch(e){
    const list = document.getElementById('t100-list');
    if(list) list.innerHTML = `<div class="t100-empty">Classement momentanément indisponible.</div>`;
  }
}

async function loadFeaturedArtists(){
  const row = document.getElementById('artist-suggest-row');
  if(!row) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/artists/featured');
    const data = await res.json();
    const list = data.artists || [];
    row.innerHTML = '';
    if(!list.length){
      row.innerHTML = `<p style="font-size:12.5px; color:var(--text-faint);">Aucun artiste avec un Pass actif pour le moment — revenez bientôt !</p>`;
      return;
    }
    list.forEach(a=>{
      const name = a.artist_name || a.first_name;
      const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const photoStyle = a.avatar_url ? `background-image:url(${a.avatar_url});` : '';
      const card = document.createElement('div');
      card.className = 'artist-suggest-card';
      card.innerHTML = `
        <div class="asc-photo" style="${photoStyle}">
          ${a.avatar_url ? '' : `<div class="asc-initials">${initials}</div>`}
        </div>
        <div class="asc-info">
          <div class="n">${name}${a.is_verified ? ' <svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24" style="width:13px;height:13px;"><path d="M20 6 9 17l-5-5"/></svg>' : ''}</div>
          <div class="g">${a.top_genre || 'Artiste NUNI'}</div>
          <button>Suivre</button>
        </div>`;
      card.querySelector('.asc-photo').onclick = ()=> openArtistPage(name, a.id);
      const followBtn = card.querySelector('button');
      // Avant : ce bouton affichait toujours "Suivre" par défaut, même si le compte connecté
      // suivait déjà cet artiste — jamais vérifié contre la vraie base à l'ouverture (même
      // bug déjà corrigé ailleurs pour le Top 100 et la page artiste, oublié ici).
      if(realAuthToken){
        fetch(NUNI_API_BASE + '/api/follow/' + a.id + '/status', { headers:{ 'Authorization':'Bearer ' + realAuthToken } })
 .then(r=>r.json()).then(d=>{ followBtn.textContent = d.following ? 'Suivi ' : 'Suivre'; followBtn.classList.toggle('is-following', d.following); })
          .catch(()=>{});
      }
      // Vrai suivi, envoyé au serveur — avant, ce bouton ne faisait que basculer un texte
      // localement, sans jamais toucher la base de données.
      followBtn.onclick = async ()=>{
        if(!realAuthToken){ toast('Connectez-vous pour suivre un artiste et le soutenir.'); return; }
        followBtn.disabled = true;
        try{
          const res2 = await fetch(NUNI_API_BASE + '/api/follow', {
            method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
            body: JSON.stringify({ artistId: a.id })
          });
          const data2 = await res2.json();
          followBtn.disabled = false;
 if(!res2.ok){ toast(' ' + (data2.error || 'Erreur.')); return; }
          followBtn.classList.toggle('is-following', data2.following);
 followBtn.textContent = data2.following ? 'Suivi ' : 'Suivre';
          toast(data2.following ? `Vous suivez maintenant ${name}.` : `Vous ne suivez plus ${name}.`);
 }catch(e){ followBtn.disabled = false; toast(' Impossible de contacter le serveur NUNI.'); }
      };
      row.appendChild(card);
    });
  }catch(e){
    row.innerHTML = `<p style="font-size:12.5px; color:var(--text-faint);">Suggestions momentanément indisponibles.</p>`;
  }
}
loadFeaturedArtists();
// Le serveur change déjà sa sélection tout seul toutes les 30 min (basé sur l'heure) —
// ce setInterval sert juste à rafraîchir l'affichage pour quelqu'un qui reste longtemps
// sur la page sans la recharger.
setInterval(loadFeaturedArtists, 30*60*1000);

// ---------- Pages catégorie — grille plein écran réutilisable ----------
// Avant : "Tout voir" ne faisait rien (Nouveautés, Top Congo) ou se contentait d'un
// filtre inline sans titre dédié (genres). Ici : une seule fonction réutilisable pour
// toutes les catégories, toujours de vrais morceaux (t.isReal), jamais de données inventées.
let categoryShuffleTimer = null;
function ensureCategoryPageStyles(){
  if(document.getElementById('categorypage-styles')) return;
  const style = document.createElement('style');
  style.id = 'categorypage-styles';
  style.textContent = `
    #categorypage-overlay{position:fixed; inset:0; z-index:9999; background:#0A0A10; overflow-y:auto; opacity:0; transition:opacity .25s ease;}
    #categorypage-overlay.show{opacity:1;}
    .cp-close{position:fixed; top:calc(18px + env(safe-area-inset-top,0)); right:22px; width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14); color:#fff; font-size:17px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center;}
    .cp-close:hover{background:rgba(255,255,255,0.16);}
    /* Décor "âme de NUNI" — de vraies pochettes d'artistes dérivent lentement en fond,
       plutôt qu'un simple aplat noir. Halo or/émeraude par-dessus, comme le reste du site. */
    .cp-hero{position:relative; height:220px; overflow:hidden; margin-bottom:8px;}
    .cp-hero-covers{position:absolute; inset:-10% -10%; filter:blur(2px) brightness(0.55) saturate(1.15);}
    .cp-hero-cover{position:absolute; width:120px; height:120px; border-radius:16px; background-size:cover; background-position:center; opacity:.85; animation:cpCoverDrift linear infinite;}
    @keyframes cpCoverDrift{
      0%{ transform:translate(0,0) rotate(0deg); }
      50%{ transform:translate(24px,-16px) rotate(3deg); }
      100%{ transform:translate(0,0) rotate(0deg); }
    }
    .cp-hero-fade{position:absolute; inset:0; background:
      radial-gradient(60% 70% at 20% 20%, rgba(30,132,73,.28), transparent 60%),
      radial-gradient(55% 65% at 85% 30%, rgba(212,175,106,.22), transparent 60%),
      linear-gradient(180deg, rgba(10,10,16,.35) 0%, #0A0A10 92%);
    }
    .cp-hero-content{position:absolute; left:0; right:0; bottom:22px; padding:0 24px; max-width:1080px; margin:0 auto;}
    .cp-wrap{max-width:1080px; margin:0 auto; padding:0 24px calc(120px + env(safe-area-inset-bottom,0));}
    .cp-title{color:#fff; font-family:var(--font-display,inherit); font-size:34px; font-weight:800; line-height:1.1; margin-bottom:6px; text-shadow:0 4px 20px rgba(0,0,0,.5);}
    .cp-sub{color:#D8CDB0; font-size:13.5px; text-shadow:0 2px 10px rgba(0,0,0,.5);}
    .cp-grid{display:grid; grid-template-columns:1fr; gap:2px; padding-top:28px; max-width:1080px; margin:0 auto;}
    @media(min-width:820px){ .cp-grid{ grid-template-columns:1fr 1fr; gap:2px 32px; } }
    .cp-row{ display:flex; align-items:center; gap:14px; padding:9px 10px; border-radius:10px; cursor:pointer; transition:background .15s ease; }
    .cp-row:hover{ background:rgba(255,255,255,.05); }
    .cp-row .thumb{ width:48px; height:48px; border-radius:8px; flex-shrink:0; background-size:cover; background-position:center; }
    .cp-row .info{ flex:1; min-width:0; }
    .cp-row .info .t{ font-size:14px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .cp-row .info .s{ font-size:12px; color:#9a9aa4; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
    .cp-row .menu-btn{ flex-shrink:0; opacity:0; transition:opacity .15s ease; background:none; border:none; color:#9a9aa4; cursor:pointer; padding:6px; }
    .cp-row:hover .menu-btn{ opacity:1; }
    .cp-empty{color:var(--text-faint,#8a8a94); font-size:13px; text-align:center; padding:40px 0; grid-column:1/-1;}
  `;
  document.head.appendChild(style);
}
function renderCategoryGrid(getList, shuffle){
  const grid = document.getElementById('cp-grid');
  if(!grid) return;
  const list = shuffle ? shuffleArray(getList()) : getList();
  grid.innerHTML = '';
  if(!list.length){
    grid.innerHTML = `<div class="cp-empty">Rien à afficher dans cette catégorie pour le moment — revenez bientôt !</div>`;
    return;
  }
  dedupeAlbums(list).forEach((tr,i)=>{
    const row = document.createElement('div');
    row.className = 'cp-row reveal-in';
    row.style.animationDelay = (i*0.03) + 's';
    const coverStyle = tr.cover ? `background-image:url(${tr.cover});` : '';
    row.innerHTML = `
      <div class="thumb ${tr.cover ? '' : (tr.p||'')}" style="${coverStyle}"></div>
      <div class="info"><div class="t">${esc(tr.t)}</div><div class="s">${esc(tr.a)}</div></div>
      <button class="menu-btn" aria-label="Options"><svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button>`;
    row.querySelector('.info').onclick = ()=> handleTrackCardClick(tr);
    row.querySelector('.thumb').onclick = ()=> handleTrackCardClick(tr);
    row.querySelector('.menu-btn').onclick = (e)=>{ e.stopPropagation(); openTrackCardMenu(tr, e.currentTarget); };
    grid.appendChild(row);
  });
  // De vraies pochettes (parmi celles réellement affichées) dérivent lentement dans le
  // décor de l'en-tête — jamais d'image inventée, seulement ce qui existe vraiment ici.
  const coversLayer = document.getElementById('cp-hero-covers');
  if(coversLayer && !coversLayer.dataset.filled){
    const withCover = list.filter(t=>t.cover);
    if(withCover.length){
      coversLayer.dataset.filled = '1';
      const positions = [
        {top:'-4%', left:'4%'}, {top:'8%', left:'42%'}, {top:'-6%', left:'78%'},
        {top:'40%', left:'18%'}, {top:'35%', left:'62%'}, {top:'44%', left:'90%'},
      ];
      for(let i=0; i<Math.min(6, positions.length); i++){
        const tr = withCover[i % withCover.length];
        const d = document.createElement('div');
        d.className = 'cp-hero-cover';
        d.style.backgroundImage = `url(${tr.cover})`;
        d.style.top = positions[i].top; d.style.left = positions[i].left;
        d.style.animationDuration = (14 + i*3) + 's';
        d.style.animationDelay = (i*-2) + 's';
        coversLayer.appendChild(d);
      }
    }
  }
}
/* getList : fonction qui retourne le tableau de vrais morceaux au moment de l'appel (pas
   un tableau figé) — permet de rester à jour si de nouveaux morceaux arrivent pendant que
   la page est ouverte. shuffle=true fait tourner l'ordre toutes les 20s (ex: Nouveautés). */
function openCategoryPage(title, description, getList, shuffle){
  ensureCategoryPageStyles();
  let overlay = document.getElementById('categorypage-overlay');
  if(overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'categorypage-overlay';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const closeOverlay = ()=>{
    clearInterval(categoryShuffleTimer);
    overlay.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(()=> overlay.remove(), 200);
  };
  overlay.innerHTML = `
    <button class="cp-close" title="Fermer"><svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    <div class="cp-hero">
      <div class="cp-hero-covers" id="cp-hero-covers"></div>
      <div class="cp-hero-fade"></div>
      <div class="cp-hero-content">
        <div class="cp-title">${title}</div>
        <div class="cp-sub">${description}</div>
      </div>
    </div>
    <div class="cp-wrap">
      <div class="cp-grid" id="cp-grid"></div>
    </div>`;
  overlay.querySelector('.cp-close').onclick = closeOverlay;
  requestAnimationFrame(()=> overlay.classList.add('show'));
  attachSwipeDownToClose(overlay, closeOverlay);
  renderCategoryGrid(getList, shuffle);
  clearInterval(categoryShuffleTimer);
  if(shuffle) categoryShuffleTimer = setInterval(()=> renderCategoryGrid(getList, true), 20000);
}
function openNewReleasesPage(){
  openCategoryPage(
    'Nouveautés',
    "Ce que le Congo écoute en ce moment — de vrais sons, fraîchement publiés par de vrais artistes NUNI.",
    ()=> tracks.filter(t=> t.isReal),
    true,
  );
}
function openTopCongoPage(){
  openCategoryPage(
    'Top Congo',
    'Le classement réel des morceaux les plus écoutés sur NUNI, par vrais streams.',
    ()=> getTopStreamedTracks(100),
    false,
  );
}
function openGenreCategoryPage(genreName){
  openCategoryPage(
    genreName,
    `Tous les vrais morceaux ${genreName} publiés sur NUNI.`,
    ()=> tracks.filter(t=> t.isReal && t.genre === genreName),
    false,
  );
}

// ---------- Playlists NUNI — vraies playlists curées par l'équipe (admin.html) ----------
function mapPlaylistTrack(r){
  return {
    t: r.title, a: r.artist_name || r.first_name || 'Artiste NUNI', p: 'pal-1',
    genre: r.genre || 'Afro', streams: String(r.streams || 0), likes: r.likes || 0,
    cover: r.cover_url || null, audioUrl: r.audio_url || null, isReal: true,
    releaseType: r.release_type || 'Single', realId: r.id, artistId: r.artist_id,
    verified: !!r.is_verified,
  };
}
function playlistCard(p){
  const card = document.createElement('div');
  card.className = 'poster-card';
  const coverStyle = p.cover_url ? `background-image:url(${p.cover_url});` : '';
  const coverClass = p.cover_url ? '' : 'pal-1';
  card.innerHTML = `
    <div class="poster-cover ${coverClass}" style="${coverStyle}">
      <div class="poster-glow"></div>
      <div class="poster-grain"></div>
      <div class="poster-scrim"></div>
      <button class="poster-play-fab" aria-label="Écouter"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
      <div class="poster-content">
        <span class="poster-badge">NUNI</span>
        <div class="poster-title">${esc(p.title)}</div>
        <div class="poster-meta">${p.track_count} titre${p.track_count>1?'s':''}</div>
      </div>
    </div>`;
  card.querySelector('.poster-cover').onclick = ()=> openPlaylistPage(p.id);
  card.querySelector('.poster-play-fab').onclick = (e)=>{ e.stopPropagation(); openPlaylistPage(p.id); };
  return card;
}
async function loadPlaylistsShelf(){
  const row = document.getElementById('shelf-playlists');
  if(!row) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/playlists');
    const data = await res.json();
    const list = data.playlists || [];
    row.innerHTML = '';
    if(!list.length){
      row.innerHTML = `<p style="font-size:12.5px; color:var(--text-faint);">Aucune playlist NUNI publiée pour le moment.</p>`;
      return;
    }
    list.forEach(p=> row.appendChild(playlistCard(p)));
  }catch(e){
    row.innerHTML = `<p style="font-size:12.5px; color:var(--text-faint);">Playlists momentanément indisponibles.</p>`;
  }
}
loadPlaylistsShelf();

function ensurePlaylistViewStyles(){
  if(document.getElementById('plv-styles')) return;
  const style = document.createElement('style');
  style.id = 'plv-styles';
  style.textContent = `
    #plv-overlay{position:fixed; inset:0; z-index:9999; background:#0A0A10; overflow-y:auto; opacity:0; transition:opacity .25s ease;}
    #plv-overlay.show{opacity:1;}
    .plv-close{position:fixed; top:calc(18px + env(safe-area-inset-top,0)); right:22px; width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14); color:#fff; font-size:17px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center;}
    .plv-close:hover{background:rgba(255,255,255,0.16);}
    .plv-hero{position:relative; min-height:420px; display:flex; align-items:flex-end; padding:56px 24px 40px; overflow:hidden;}
    .plv-hero-bg{position:absolute; inset:0; background-size:cover; background-position:center; filter:blur(38px) saturate(1.3) brightness(0.5); transform:scale(1.15);}
    .plv-hero-fade{position:absolute; inset:0; background:linear-gradient(180deg, rgba(10,10,16,0.15) 0%, #0A0A10 92%);}
    .plv-hero-content{position:relative; max-width:760px; margin:0 auto; display:flex; gap:24px; align-items:flex-end; flex-wrap:wrap;}
    .plv-cover{width:220px; height:220px; border-radius:20px; background-size:cover; background-position:center; flex-shrink:0; box-shadow:0 24px 60px rgba(0,0,0,0.6); border:1px solid rgba(212,175,106,0.3); animation:plvCoverFloat 6s ease-in-out infinite;}
    @keyframes plvCoverFloat{ 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-8px);} }
    @media(max-width:560px){ .plv-cover{ width:150px; height:150px; } }
    .plv-badge{display:inline-flex; align-items:center; gap:6px; background:rgba(212,175,106,0.16); backdrop-filter:blur(6px); color:#E8C77E; border:1px solid rgba(212,175,106,0.45); font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:4px 10px; border-radius:20px; margin-bottom:10px;}
    .plv-title{color:#fff; font-size:28px; font-weight:800; line-height:1.15; margin:0 0 8px;}
    .plv-meta{color:#B9C2B4; font-size:13.5px;}
    .plv-actions{max-width:760px; margin:22px auto 0; padding:0 24px; display:flex; gap:14px; align-items:center;}
    .plv-play-all{background:linear-gradient(135deg,#1E8449,#0E3D2C); color:#F3E6C8; border:1px solid rgba(212,175,106,0.5); font-weight:700; font-size:14px; padding:12px 26px; border-radius:30px; cursor:pointer; display:flex; align-items:center; gap:8px;}
    .plv-shuffle-btn{width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.14); color:#EDEDED; cursor:pointer; display:flex; align-items:center; justify-content:center;}
    .plv-shuffle-btn:hover{background:rgba(212,175,106,0.18); color:#D4AF6A;}
    .plv-list{max-width:760px; margin:26px auto calc(120px + env(safe-area-inset-bottom,0)); padding:0 24px;}
    .plv-row{display:flex; align-items:center; gap:14px; padding:10px; border-radius:10px; cursor:pointer; transition:background .15s ease, transform .15s ease, box-shadow .15s ease; opacity:0; animation:plvRowIn .35s ease forwards;}
    @keyframes plvRowIn{ from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:translateY(0);} }
    .plv-row:hover{background:rgba(212,175,106,0.09); transform:translateX(2px); box-shadow:0 4px 20px rgba(212,175,106,0.08);}
    .plv-row-thumb{width:48px; height:48px; border-radius:8px; background-size:cover; background-position:center; flex-shrink:0; background-color:#1a1a22;}
    .plv-row-info{flex:1; min-width:0;}
    .plv-row-title{color:#EDEDED; font-size:14.5px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
    .plv-row-artist{color:#8a8a94; font-size:12.5px; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
    .plv-row.is-playing{background:linear-gradient(90deg, rgba(212,175,106,0.16), transparent);}
    .plv-row.is-playing .plv-row-title{color:#F3E6C8;}
    .plv-row-dot{width:6px; height:6px; border-radius:50%; background:#D4AF6A; box-shadow:0 0 6px #D4AF6A; flex-shrink:0;}
    .plv-empty{color:#8a8a94; font-size:13px; text-align:center; padding:40px 0;}
    /* Carte "Le P" — vraie suggestion, pas un message figé */
    .plv-lep-card{max-width:760px; margin:0 auto 30px; padding:0 24px; display:flex; gap:14px; align-items:flex-start;}
    .plv-lep-avatar{width:44px; height:44px; border-radius:50%; overflow:hidden; flex-shrink:0; border:1px solid rgba(212,175,106,0.4);}
    .plv-lep-avatar img{width:100%; height:100%; object-fit:cover;}
    .plv-lep-body{background:rgba(255,255,255,0.04); border:1px solid rgba(212,175,106,0.18); border-radius:16px; padding:14px 16px; flex:1;}
    .plv-lep-name{font-size:12.5px; font-weight:700; color:#D4AF6A; margin-bottom:4px;}
    .plv-lep-msg{font-size:13px; color:#D8CDB0; line-height:1.5; margin-bottom:10px;}
    .plv-lep-btn{background:rgba(212,175,106,0.15); border:1px solid rgba(212,175,106,0.4); color:#F3E6C8; font-size:12px; font-weight:600; padding:7px 14px; border-radius:20px; cursor:pointer;}
    .plv-lep-btn:hover{background:rgba(212,175,106,0.25);}
    /* Rail "D'autres playlists NUNI" façon Netflix */
    .plv-similar{max-width:1080px; margin:10px auto calc(120px + env(safe-area-inset-bottom,0)); padding:0 24px;}
    .plv-similar-title{color:#fff; font-size:16px; font-weight:700; margin-bottom:14px;}
    .plv-similar-row{display:flex; gap:16px; overflow-x:auto; -webkit-overflow-scrolling:touch; padding-bottom:6px;}
    .plv-similar-card{flex-shrink:0; width:140px; cursor:pointer;}
    .plv-similar-cover{width:140px; height:140px; border-radius:12px; background-size:cover; background-position:center; background-color:#1a1a22; margin-bottom:8px; transition:transform .2s ease;}
    .plv-similar-card:hover .plv-similar-cover{transform:scale(1.04);}
    .plv-similar-name{color:#EDEDED; font-size:13px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
    .plv-similar-count{color:#8a8a94; font-size:11.5px; margin-top:2px;}
  `;
  document.head.appendChild(style);
}
async function openPlaylistPage(id){
  ensurePlaylistViewStyles();
  let overlay = document.getElementById('plv-overlay');
  if(overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'plv-overlay';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const closeOverlay = ()=>{ overlay.classList.remove('show'); document.body.style.overflow = ''; setTimeout(()=> overlay.remove(), 200); };
  overlay.innerHTML = `<button class="plv-close" title="Fermer"><svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button><div class="plv-hero"><div class="plv-hero-fade"></div><div class="plv-hero-content"><div class="plv-cover"></div><div><span class="plv-badge"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.6" y="14" width="4.4" height="6" rx="2"/><rect x="17" y="14" width="4.4" height="6" rx="2"/></svg> Playlist NUNI</span><h2 class="plv-title">Chargement…</h2><div class="plv-meta"></div></div></div></div><div class="plv-actions"><button class="plv-play-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Tout écouter</button><button class="plv-shuffle-btn" title="Aléatoire"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h3.5a3 3 0 0 1 2.4 1.2L15 15a3 3 0 0 0 2.4 1.2H20M4 18h3.5a3 3 0 0 0 2.4-1.2l1-1.3M16.5 6H20M16.5 18H20"/><path d="M18 3l3 3-3 3M18 15l3 3-3 3"/></svg></button></div><div class="plv-list"></div>`;
  overlay.querySelector('.plv-close').onclick = closeOverlay;
  requestAnimationFrame(()=> overlay.classList.add('show'));
  attachSwipeDownToClose(overlay, closeOverlay);

  try{
    const res = await fetch(NUNI_API_BASE + '/api/playlists/' + id, {
      headers: realAuthToken ? { 'Authorization': 'Bearer ' + realAuthToken } : {},
    });
    const data = await res.json();
 if(!res.ok){ toast(' ' + (data.error || 'Playlist introuvable.')); closeOverlay(); return; }
    const mapped = (data.tracks || []).map(mapPlaylistTrack);
    const cover = mapped.find(t=>t.cover) ? mapped.find(t=>t.cover).cover : null;

    const heroBg = overlay.querySelector('.plv-hero');
    if(cover) heroBg.insertAdjacentHTML('afterbegin', `<div class="plv-hero-bg" style="background-image:url(${cover})"></div>`);
    overlay.querySelector('.plv-cover').style.backgroundImage = cover ? `url(${cover})` : 'linear-gradient(135deg,#1E8449,#0E3D2C)';
    overlay.querySelector('.plv-title').textContent = data.playlist.title;
    const updatedDate = data.playlist.updated_at ? new Date(data.playlist.updated_at).toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'}) : null;
    overlay.querySelector('.plv-meta').innerHTML = `${esc(data.playlist.description) || 'Sélection curée par l\'équipe NUNI'} · ${mapped.length} titre${mapped.length>1?'s':''}<br><span style="font-size:12px; opacity:.8;"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg> Créateur : NUNI${updatedDate ? ` · <svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg> Mis à jour le ${updatedDate}` : ''}</span>`;
    // Teinte de fond biaisée selon le vrai genre dominant réellement présent dans la
    // playlist (Rumba → or/ivoire, Amapiano → bleu/violet, sinon la couleur réelle de la
    // pochette prend le dessus) — jamais un genre inventé, toujours calculé depuis les
    // vrais morceaux qui composent CETTE playlist précise.
    const genreCounts = mapped.reduce((acc,t)=>{ acc[t.genre]=(acc[t.genre]||0)+1; return acc; },{});
    const dominantGenre = Object.entries(genreCounts).sort((a,b)=>b[1]-a[1])[0];
    const genreTintMap = {
      'Rumba': 'rgba(212,175,106,.28)', 'Amapiano': 'rgba(94,84,196,.28)',
      'Gospel': 'rgba(232,199,126,.24)', 'Afro': 'rgba(30,132,73,.26)',
      'Rap': 'rgba(200,60,60,.22)', 'Hip-Hop': 'rgba(200,60,60,.22)',
    };
    if(dominantGenre && genreTintMap[dominantGenre[0]]){
      overlay.querySelector('.plv-hero-fade').style.background = `
        radial-gradient(70% 80% at 30% 10%, ${genreTintMap[dominantGenre[0]]}, transparent 65%),
        linear-gradient(180deg, rgba(10,10,16,0.2) 0%, #0A0A10 92%)`;
    }

    const list = overlay.querySelector('.plv-list');
    function refreshPlvRowHighlights(){
      list.querySelectorAll('.plv-row').forEach((row, i)=>{
        const tr = mapped[i];
        const isPlaying = playing && currentTrack && currentTrack.t === tr.t;
        row.classList.toggle('is-playing', isPlaying);
        const existingDot = row.querySelector('.eq');
        if(isPlaying && !existingDot) row.insertAdjacentHTML('beforeend', '<span class="eq"><i></i><i></i><i></i></span>');
        if(!isPlaying && existingDot) existingDot.remove();
      });
    }
    if(!mapped.length){
      list.innerHTML = `<div class="plv-empty">Cette playlist ne contient aucun morceau pour le moment.</div>`;
    } else {
      mapped.forEach((tr,i)=>{
        const row = document.createElement('div');
        const isPlaying = playing && currentTrack && currentTrack.t === tr.t;
        row.className = 'plv-row' + (isPlaying ? ' is-playing' : '');
        row.style.animationDelay = (i*0.04) + 's';
        row.innerHTML = `
          <div class="plv-row-thumb" style="${tr.cover ? `background-image:url(${tr.cover})` : ''}"></div>
          <div class="plv-row-info"><div class="plv-row-title">${esc(tr.t)}</div><div class="plv-row-artist">${esc(tr.a)}</div></div>
          ${isPlaying ? '<span class="eq"><i></i><i></i><i></i></span>' : ''}`;
        row.onclick = ()=>{ playTrack(tr); refreshPlvRowHighlights(); };
        list.appendChild(row);
      });
    }
    overlay.querySelector('.plv-play-all').onclick = ()=>{ if(mapped.length){ playTrack(mapped[0]); refreshPlvRowHighlights(); } };
    overlay.querySelector('.plv-shuffle-btn').onclick = ()=>{
      if(!mapped.length) return;
      const random = mapped[Math.floor(Math.random()*mapped.length)];
      playTrack(random);
      refreshPlvRowHighlights();
      toast('Lecture aléatoire de « ' + data.playlist.title + ' »');
    };
    renderSimilarPlaylistsRow(overlay, id, mapped);
 }catch(e){ toast(' Impossible de contacter le serveur NUNI.'); closeOverlay(); }
}

// ---------- Détail d'une playlist PERSONNELLE — même habillage que les playlists NUNI
// officielles (openPlaylistPage ci-dessus), mais avec retrait de morceau et suppression de
// la playlist, réservés au propriétaire (déjà vérifié côté serveur à chaque appel). ----------
async function openMyPlaylistPage(id){
  ensurePlaylistViewStyles();
  let overlay = document.getElementById('plv-overlay');
  if(overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'plv-overlay';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const closeOverlay = ()=>{ overlay.classList.remove('show'); document.body.style.overflow = ''; setTimeout(()=> overlay.remove(), 200); };
  overlay.innerHTML = `<button class="plv-close" title="Fermer"><svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button><div class="plv-hero"><div class="plv-hero-fade"></div><div class="plv-hero-content"><div class="plv-cover"></div><div><span class="plv-badge"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg> Ma playlist</span><h2 class="plv-title">Chargement…</h2><div class="plv-meta"></div></div></div></div><div class="plv-actions"><button class="plv-play-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Tout écouter</button><button class="plv-shuffle-btn" title="Aléatoire"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h3.5a3 3 0 0 1 2.4 1.2L15 15a3 3 0 0 0 2.4 1.2H20M4 18h3.5a3 3 0 0 0 2.4-1.2l1-1.3M16.5 6H20M16.5 18H20"/><path d="M18 3l3 3-3 3M18 15l3 3-3 3"/></svg></button><button class="plv-delete-btn" title="Supprimer la playlist"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7"/></svg></button></div><div class="plv-list"></div>`;
  overlay.querySelector('.plv-close').onclick = closeOverlay;
  requestAnimationFrame(()=> overlay.classList.add('show'));
  attachSwipeDownToClose(overlay, closeOverlay);

  async function loadAndRender(){
    try{
      const res = await fetch(NUNI_API_BASE + '/api/me/playlists/' + id, { headers:{ 'Authorization':'Bearer '+realAuthToken } });
      const data = await res.json();
      if(!res.ok){ toast(' ' + (data.error || 'Playlist introuvable.')); closeOverlay(); return; }
      const mapped = (data.tracks || []).map(mapPlaylistTrack).map((tr,i)=>{ tr.realId = data.tracks[i].id; return tr; });
      const cover = mapped.find(t=>t.cover) ? mapped.find(t=>t.cover).cover : null;

      const heroBg = overlay.querySelector('.plv-hero');
      const existingBg = overlay.querySelector('.plv-hero-bg');
      if(existingBg) existingBg.remove();
      if(cover) heroBg.insertAdjacentHTML('afterbegin', `<div class="plv-hero-bg" style="background-image:url(${cover})"></div>`);
      overlay.querySelector('.plv-cover').style.backgroundImage = cover ? `url(${cover})` : 'linear-gradient(135deg,#5E54C4,#241C6B)';
      overlay.querySelector('.plv-title').textContent = data.playlist.title;
      overlay.querySelector('.plv-meta').innerHTML = `Playlist personnelle · ${mapped.length} titre${mapped.length>1?'s':''}`;

      const list = overlay.querySelector('.plv-list');
      list.innerHTML = '';
      if(!mapped.length){
        list.innerHTML = `<div class="plv-empty">Cette playlist est vide.<br>Depuis le menu « ⋮ » d'un morceau, choisissez « Ajouter à une playlist » pour la remplir.</div>`;
      } else {
        mapped.forEach((tr,i)=>{
          const row = document.createElement('div');
          const isPlaying = playing && currentTrack && currentTrack.t === tr.t;
          row.className = 'plv-row' + (isPlaying ? ' is-playing' : '');
          row.style.animationDelay = (i*0.04) + 's';
          row.innerHTML = `
            <div class="plv-row-thumb" style="${tr.cover ? `background-image:url(${tr.cover})` : ''}"></div>
            <div class="plv-row-info"><div class="plv-row-title">${esc(tr.t)}</div><div class="plv-row-artist">${esc(tr.a)}</div></div>
            ${isPlaying ? '<span class="eq"><i></i><i></i><i></i></span>' : ''}
            <button class="plv-row-remove" title="Retirer de la playlist"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
          row.querySelector('.plv-row-thumb').onclick = ()=> playTrack(tr);
          row.querySelector('.plv-row-info').onclick = ()=> playTrack(tr);
          row.querySelector('.plv-row-remove').onclick = async (e)=>{
            e.stopPropagation();
            try{
              await fetch(NUNI_API_BASE + '/api/me/playlists/' + id + '/tracks/' + tr.realId, { method:'DELETE', headers:{ 'Authorization':'Bearer '+realAuthToken } });
              libraryMyPlaylistsCache = null;
              toast('Retiré de « ' + data.playlist.title + ' ».');
              loadAndRender();
            }catch(err){ toast(' Impossible de contacter le serveur NUNI.'); }
          };
          list.appendChild(row);
        });
      }
      overlay.querySelector('.plv-play-all').onclick = ()=>{ if(mapped.length) playTrack(mapped[0]); };
      overlay.querySelector('.plv-shuffle-btn').onclick = ()=>{
        if(!mapped.length) return;
        playTrack(mapped[Math.floor(Math.random()*mapped.length)]);
        toast('Lecture aléatoire de « ' + data.playlist.title + ' »');
      };
      overlay.querySelector('.plv-delete-btn').onclick = async ()=>{
        try{
          await fetch(NUNI_API_BASE + '/api/me/playlists/' + id, { method:'DELETE', headers:{ 'Authorization':'Bearer '+realAuthToken } });
          libraryMyPlaylistsCache = null;
          toast('Playlist supprimée.');
          closeOverlay();
        }catch(e){ toast(' Impossible de contacter le serveur NUNI.'); }
      };
    }catch(e){ toast(' Impossible de contacter le serveur NUNI.'); closeOverlay(); }
  }
  loadAndRender();
}

// ---------- "Ajouter à une playlist" — picker ouvert depuis le menu "⋮" d'un morceau ----------
function ensureAddToPlaylistStyles(){
  if(document.getElementById('atp-styles')) return;
  const style = document.createElement('style');
  style.id = 'atp-styles';
  style.textContent = `
    #atp-overlay{position:fixed; inset:0; z-index:10050; background:rgba(0,0,0,.55); backdrop-filter:blur(4px); display:flex; align-items:flex-end; justify-content:center; opacity:0; transition:opacity .2s ease;}
    #atp-overlay.show{opacity:1;}
    #atp-card{width:100%; max-width:440px; max-height:70vh; overflow-y:auto; background:var(--bg-elev); border-radius:20px 20px 0 0; padding:18px; box-shadow:0 -20px 50px -12px rgba(0,0,0,.5);}
    #atp-card h4{font-size:15px; font-weight:700; margin:0 0 14px;}
    .atp-row{display:flex; align-items:center; gap:12px; padding:11px 6px; border-radius:12px; cursor:pointer;}
    .atp-row:hover{ background:var(--bg-card); }
    .atp-row-ic{width:36px; height:36px; border-radius:9px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:var(--bg-card); color:var(--accent);}
    .atp-row-ic svg{width:18px; height:18px;}
    .atp-row-t{font-size:13.5px; font-weight:600;}
    .atp-row-s{font-size:11.5px; color:var(--text-faint); margin-top:1px;}
  `;
  document.head.appendChild(style);
}
async function openAddToPlaylistPicker(tr){
  if(!realAuthToken){ toast('Connectez-vous pour ajouter un morceau à une playlist.'); return; }
  if(!tr.isReal || !tr.realId){ toast("Ce morceau de démonstration ne peut pas être ajouté à une playlist."); return; }
  ensureAddToPlaylistStyles();
  const overlay = document.createElement('div'); overlay.id = 'atp-overlay';
  overlay.innerHTML = `<div id="atp-card"><h4>Ajouter « ${esc(tr.t)} » à…</h4><div id="atp-list">Chargement…</div></div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=> overlay.classList.add('show'));
  const close = ()=>{ overlay.classList.remove('show'); setTimeout(()=> overlay.remove(), 180); };
  overlay.onclick = (e)=>{ if(e.target === overlay) close(); };

  const list = overlay.querySelector('#atp-list');
  const mine = await loadLibraryMyPlaylistsIfNeeded(true);
  list.innerHTML = '';

  const newRow = document.createElement('div'); newRow.className = 'atp-row';
  newRow.innerHTML = `<div class="atp-row-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></div><div><div class="atp-row-t">Nouvelle playlist</div></div>`;
  newRow.onclick = async ()=>{
    const title = await askForPlaylistName();
    if(!title) return;
    try{
      const res = await fetch(NUNI_API_BASE + '/api/me/playlists', {
        method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+realAuthToken },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
      await fetch(NUNI_API_BASE + '/api/me/playlists/' + data.playlist.id + '/tracks', {
        method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+realAuthToken },
        body: JSON.stringify({ trackId: tr.realId }),
      });
      libraryMyPlaylistsCache = null;
      toast('« ' + tr.t + ' » ajouté à « ' + title + ' ».');
      close();
    }catch(e){ toast(' Impossible de contacter le serveur NUNI.'); }
  };
  list.appendChild(newRow);

  if(!mine.length){
    const empty = document.createElement('div'); empty.className = 'atp-row-s'; empty.style.padding = '8px 6px';
    empty.textContent = "Vous n'avez pas encore de playlist personnelle — créez-en une ci-dessus.";
    list.appendChild(empty);
    return;
  }
  mine.forEach(pl=>{
    const row = document.createElement('div'); row.className = 'atp-row';
    const covStyle = pl.cover_url ? `background-image:url(${pl.cover_url}); background-size:cover; background-position:center;` : '';
    row.innerHTML = `<div class="atp-row-ic" style="${covStyle}">${pl.cover_url ? '' : '<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><rect x=\"3\" y=\"4\" width=\"14\" height=\"14\" rx=\"2\"/></svg>'}</div><div><div class="atp-row-t">${esc(pl.title)}</div><div class="atp-row-s">${pl.track_count || 0} titre${(pl.track_count||0)>1?'s':''}</div></div>`;
    row.onclick = async ()=>{
      try{
        await fetch(NUNI_API_BASE + '/api/me/playlists/' + pl.id + '/tracks', {
          method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+realAuthToken },
          body: JSON.stringify({ trackId: tr.realId }),
        });
        libraryMyPlaylistsCache = null;
        toast('« ' + tr.t + ' » ajouté à « ' + pl.title + ' ».');
        close();
      }catch(e){ toast(' Impossible de contacter le serveur NUNI.'); }
    };
    list.appendChild(row);
  });
}

/* Vraie suggestion contextuelle "Le P" — pas un message inventé et figé : s'appuie sur les
   vrais genres réellement présents dans CETTE playlist (comptés depuis les vrais morceaux). */
function renderLeSuggestionCard(overlay, playlistData, mapped){
  const genres = mapped.map(t=>t.genre).filter(Boolean);
  const topGenre = genres.length
    ? Object.entries(genres.reduce((acc,g)=>{ acc[g]=(acc[g]||0)+1; return acc; },{})).sort((a,b)=>b[1]-a[1])[0][0]
    : null;
  const card = document.createElement('div');
  card.className = 'plv-lep-card';
  card.innerHTML = `
    <div class="plv-lep-avatar"><img src="assets/mimi-avatar.png" alt="Le P"></div>
    <div class="plv-lep-body">
      <div class="plv-lep-name">Le P</div>
      <div class="plv-lep-msg">Mbote moninga <svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/></svg> « ${esc(playlistData.title)} »${topGenre ? `, plutôt dans l'ambiance ${topGenre}` : ''} — envie de découvrir des artistes dans le même esprit ?</div>
      <button class="plv-lep-btn">Me suggérer des artistes</button>
    </div>`;
  overlay.querySelector('.plv-list').insertAdjacentElement('afterend', card);
  card.querySelector('.plv-lep-btn').onclick = ()=>{
    const widget = document.getElementById('mimi-widget');
    if(!widget.classList.contains('open')){ widget.classList.add('open'); mimiFace('happy'); setTimeout(()=>mimiFace('idle'), 900); }
    const input = document.getElementById('mimi-input');
    if(input){
      input.value = topGenre ? `Recommande-moi des artistes ${topGenre}` : 'Recommande-moi des artistes à découvrir';
      setTimeout(()=> mimiSend(), 300);
    }
  };
}
/* Vrai rail "Playlists similaires" façon Netflix — d'autres vraies playlists existantes
   (jamais inventées), la playlist actuelle exclue. */
async function renderSimilarPlaylistsRow(overlay, currentId, mapped){
  try{
    const res = await fetch(NUNI_API_BASE + '/api/playlists');
    const data = await res.json();
    const others = (data.playlists || []).filter(p=> p.id !== currentId).slice(0, 8);
    if(!others.length) return;
    const section = document.createElement('div');
    section.className = 'plv-similar';
    section.innerHTML = `<h3 class="plv-similar-title">D'autres playlists NUNI</h3><div class="plv-similar-row"></div>`;
    overlay.querySelector('.plv-list').parentElement.insertAdjacentElement('beforeend', section);
    const row = section.querySelector('.plv-similar-row');
    others.forEach(p=>{
      const card = document.createElement('div');
      card.className = 'plv-similar-card';
      card.innerHTML = `
        <div class="plv-similar-cover" style="${p.cover_url ? `background-image:url(${p.cover_url})` : ''}"></div>
        <div class="plv-similar-name">${esc(p.title)}</div>
        <div class="plv-similar-count">${p.track_count || 0} titre${p.track_count>1?'s':''}</div>`;
      card.onclick = ()=> openPlaylistPage(p.id);
      row.appendChild(card);
    });
  }catch(e){ /* pas grave, le rail reste simplement absent */ }
}

function ensurePlaylistsPageStyles(){
  if(document.getElementById('allplaylists-styles')) return;
  const style = document.createElement('style');
  style.id = 'allplaylists-styles';
  style.textContent = `
    #allplaylists-overlay{position:fixed; inset:0; z-index:9999; background:#0A0A10; overflow-y:auto; opacity:0; transition:opacity .25s ease;}
    #allplaylists-overlay.show{opacity:1;}
    .apl-close{position:fixed; top:calc(18px + env(safe-area-inset-top,0)); right:22px; width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14); color:#fff; font-size:17px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center;}
    .apl-close:hover{background:rgba(255,255,255,0.16);}
    .apl-wrap{max-width:1080px; margin:0 auto; padding:60px 24px 80px;}
    .apl-title{color:#fff; font-size:26px; font-weight:800; margin-bottom:6px;}
    .apl-sub{color:#8a8a94; font-size:13px; margin-bottom:28px;}
    .apl-grid{display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:22px; justify-items:center;}
    .apl-empty{color:var(--text-faint,#8a8a94); font-size:13px; text-align:center; padding:40px 0; grid-column:1/-1;}
  `;
  document.head.appendChild(style);
}
async function openAllPlaylistsPage(){
  ensurePlaylistsPageStyles();
  let overlay = document.getElementById('allplaylists-overlay');
  if(overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'allplaylists-overlay';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const closeOverlay = ()=>{ overlay.classList.remove('show'); document.body.style.overflow = ''; setTimeout(()=> overlay.remove(), 200); };
  overlay.innerHTML = `
    <button class="apl-close" title="Fermer"><svg class="nuni-ic nuni-ic-err" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    <div class="apl-wrap">
      <div class="apl-title">Playlists NUNI</div>
      <div class="apl-sub">Nos sélections, curées à la main pour partager nos goûts avec vous.</div>
      <div class="apl-grid" id="apl-grid">Chargement…</div>
    </div>`;
  overlay.querySelector('.apl-close').onclick = closeOverlay;
  requestAnimationFrame(()=> overlay.classList.add('show'));
  attachSwipeDownToClose(overlay, closeOverlay);
  try{
    const res = await fetch(NUNI_API_BASE + '/api/playlists');
    const data = await res.json();
    const grid = document.getElementById('apl-grid');
    if(!grid) return;
    const list = data.playlists || [];
    grid.innerHTML = '';
    if(!list.length){
      grid.innerHTML = `<div class="apl-empty">Aucune playlist NUNI publiée pour le moment.</div>`;
      return;
    }
    list.forEach(p=> grid.appendChild(playlistCard(p)));
  }catch(e){
    const grid = document.getElementById('apl-grid');
    if(grid) grid.innerHTML = `<div class="apl-empty">Playlists momentanément indisponibles.</div>`;
  }
}

/* ============ MOBILE TAB BAR ============ */
function tabNav(view){
  enterApp(view);
  document.querySelectorAll('.tab-btn').forEach(b=> b.classList.toggle('is-active', b.dataset.tab===view));
}

/* ============ RECHERCHE PLEIN ÉCRAN — état "Parcourir" (façon Apple Music) ============
   Affiché quand le champ est vide : une grille colorée de genres, pour parcourir sans avoir
   à taper. Couleurs fixes par genre (pas de génération aléatoire) pour rester reconnaissable
   d'une visite à l'autre. */
const ASV_GENRE_COLORS = {
  'Afro': '#1E8449', 'Rap': '#8E2DE2', 'Rumba': '#B3512E', 'Gospel': '#1976D2',
  'Hip-Hop': '#C0392B', 'Top Congo': '#B98A3D', 'Nouveautés': '#0E3D2C',
};
// Concerts et NUNI Événements sont désormais tous les deux fonctionnels (Phases 2 et 3).
function renderSearchViewBrowse(){
  const box = document.getElementById('asv-results');
  if(!box) return;
  const genres = Object.keys(ASV_GENRE_COLORS);
  // "Extraits populaires" — vrais morceaux les plus streamés (même classement que Top
  // Congo, voir getTopStreamedTracks) : jamais de faux badge "Trending" ni de chiffre
  // inventé, seulement les vraies écoutes déjà comptabilisées.
  const trending = getTopStreamedTracks(10);
  // ---- Tuiles de genre "premium" — avant : simple aplat de couleur avec juste le nom.
  // Maintenant : pochette du morceau le plus streamé du genre (au lieu d'une couleur plate),
  // vrai nombre de morceaux publiés, et vrai top artiste du genre par streams cumulés.
  // Un genre sans aucun vrai morceau garde son ancien rendu (couleur unie, rien d'inventé).
  function genreStats(g){
    const inGenre = tracks.filter(t=> t.isReal && t.genre === g);
    if(!inGenre.length) return null;
    const withCover = [...inGenre].sort((a,b)=> parseStreamsCount(b.streams) - parseStreamsCount(a.streams));
    const byArtist = {};
    inGenre.forEach(t=>{ byArtist[t.a] = (byArtist[t.a]||0) + parseStreamsCount(t.streams); });
    const topArtist = Object.entries(byArtist).sort((a,b)=> b[1]-a[1])[0][0];
    return { count: inGenre.length, cover: withCover[0].cover || null, topArtist };
  }
  box.innerHTML = `
    ${trending.length ? `
    <div class="asv-trending-block">
      <div class="asv-browse-title" style="margin-bottom:14px;">Extraits populaires</div>
      <div class="shelf-row" id="asv-trending-row"></div>
    </div>` : ''}
    <div class="asv-browse-title">Parcourir</div>
    <div class="asv-genre-grid">
      <div class="asv-genre-tile asv-radio-tile" data-radio="1">
        <div class="asv-radio-eq" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
        <span class="asv-radio-badge" id="asv-radio-badge"><span class="dot"></span>EN DIRECT</span>
        <span class="asv-radio-title"><svg class="nuni-ic" viewBox="0 0 24 24" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.6" y="14" width="4.4" height="6" rx="2"/><rect x="17" y="14" width="4.4" height="6" rx="2"/></svg>NUNI Radio &amp; DJ</span>
      </div>
      <div class="asv-genre-tile" style="background:#6E45A8;" data-concerts="1"><svg class="nuni-ic" viewBox="0 0 24 24" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 21v-3"/></svg>Concerts</div>
      <div class="asv-genre-tile" style="background:#B3512E;" data-nuni-events="1"><svg class="nuni-ic" viewBox="0 0 24 24" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V9z"/></svg>NUNI Événements</div>
      <div class="asv-genre-tile" style="background:#1976D2;" data-top="1"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><path d="M4 21V10M11 21V4M18 21v-7"/><path d="M2 21h20"/></svg>Top</div>
      <div class="asv-genre-tile" style="background:linear-gradient(135deg,#C0392B,#6E45A8);" data-stories="1"><svg class="nuni-ic" viewBox="0 0 24 24" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/></svg>Stories</div>
      ${genres.map(g => {
        const st = genreStats(g);
        if(!st) return `<div class="asv-genre-tile" style="background:${ASV_GENRE_COLORS[g]};" data-genre="${g}">${g}</div>`;
        const bg = st.cover ? `background-image:linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.82) 100%), url(${st.cover}); background-size:cover; background-position:center;` : `background:${ASV_GENRE_COLORS[g]};`;
        return `<div class="asv-genre-tile asv-genre-tile-premium" style="${bg}" data-genre="${g}">
          <div>
            <div>${g}</div>
            <div class="asv-genre-tile-meta">${st.count} morceau${st.count>1?'x':''} · ${st.topArtist}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${renderRecentSearchesRow()}`;
  if(trending.length){
    const trow = document.getElementById('asv-trending-row');
    trending.forEach(tr=>{
      const card = trackCard(tr);
      wireHoverPreview(card, tr);
      trow.appendChild(card);
    });
  }
  box.querySelector('[data-radio]').onclick = ()=> openTuner('radio');
  box.querySelector('[data-concerts]').onclick = ()=> enterApp('concerts');
  box.querySelector('[data-nuni-events]').onclick = ()=> enterApp('nuniEvents');
  box.querySelector('[data-top]').onclick = ()=> window.location.href = 'top.html';
  box.querySelector('[data-stories]').onclick = ()=> openStoriesViewer(0);
  box.querySelectorAll('.asv-genre-tile[data-genre]').forEach(tile=>{
    tile.onclick = ()=>{
      const g = tile.dataset.genre;
      enterApp('catalog');
      filterCatalogByGenre(g);
      document.querySelectorAll('.genre-tile').forEach(t=>t.classList.toggle('is-active', t.querySelector('.gname') && t.querySelector('.gname').textContent === g));
    };
  });
  box.querySelectorAll('.asv-recent-chip').forEach(chip=>{
    chip.onclick = ()=>{
      const term = chip.dataset.term;
      const input = document.getElementById('asv-input');
      if(input) input.value = term;
      document.getElementById('asv-clear-btn').style.display = '';
      runSearchView(term);
    };
  });
}
function clearSearchView(){
  const input = document.getElementById('asv-input');
  if(input) input.value = '';
  document.getElementById('asv-clear-btn').style.display = 'none';
  renderSearchViewBrowse();
  if(input) input.focus();
}
function debouncedRunSearchView(q){
  document.getElementById('asv-clear-btn').style.display = q.trim() ? '' : 'none';
  clearTimeout(searchViewDebounceTimer);
  searchViewDebounceTimer = setTimeout(()=>{
    runSearchView(q);
    if(q.trim().length >= 2) logRecentSearch(q.trim());
  }, 200);
}
let searchViewDebounceTimer = null;

/* ============ HISTORIQUE DE RECHERCHE — dernières 24h, 5 max ============
   Stocké en local sur l'appareil (localStorage), jamais envoyé au serveur — c'est une
   préférence purement personnelle, pas une donnée à synchroniser entre appareils. */
const RECENT_SEARCHES_KEY = 'nuniRecentSearches';
const RECENT_SEARCHES_MAX = 5;
const RECENT_SEARCHES_WINDOW_MS = 24 * 60 * 60 * 1000;
function getRecentSearches(){
  try{
    const raw = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    const now = Date.now();
    // Ne garde que les 24 dernières heures — un terme cherché hier ne doit plus traîner.
    return raw.filter(entry => now - entry.ts < RECENT_SEARCHES_WINDOW_MS);
  }catch(e){ return []; }
}
function logRecentSearch(term){
  let list = getRecentSearches();
  // Un même terme retapé remonte en tête plutôt que de créer un doublon.
  list = list.filter(entry => entry.term.toLowerCase() !== term.toLowerCase());
  list.unshift({ term, ts: Date.now() });
  list = list.slice(0, RECENT_SEARCHES_MAX);
  try{ localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list)); }catch(e){ /* stockage plein ou indisponible, pas grave */ }
}
function clearRecentSearches(){
  try{ localStorage.removeItem(RECENT_SEARCHES_KEY); }catch(e){}
  renderSearchViewBrowse();
}
function renderRecentSearchesRow(){
  const recent = getRecentSearches();
  if(!recent.length) return '';
  return `
    <div class="asv-recent-wrap">
      <div class="asv-recent-head">
        <span class="asv-browse-title" style="margin:0;">Recherches récentes</span>
        <button class="asv-recent-clear" onclick="clearRecentSearches()">Effacer</button>
      </div>
      <div class="asv-recent-row">
        ${recent.map(entry => `<button class="asv-recent-chip" data-term="${entry.term.replace(/"/g,'&quot;')}">${entry.term}</button>`).join('')}
      </div>
    </div>`;
}
function runSearchView(q){
  const box = document.getElementById('asv-results');
  if(!box) return;
  const query = q.trim().toLowerCase();
  if(!query){ renderSearchViewBrowse(); return; }

  const artistNames = [...new Set(tracks.map(t=>t.a||''))].filter(Boolean);
  const artistMatches = artistNames.filter(a => a.toLowerCase().includes(query)).slice(0, 6);
  // Albums/EP — un morceau par album unique (artiste + titre d'album), pour retrouver un
  // projet entier plutôt que juste ses morceaux un par un. Les Singles ne comptent pas comme
  // "album" ici (ils apparaissent déjà dans la section Morceaux).
  const albumGroups = new Map(); // clé album → tous les morceaux correspondants de cet album
  tracks.forEach(t=>{
    if(!t.album || t.releaseType === 'Single') return;
    const matches = (t.album||'').toLowerCase().includes(query) || (t.a||'').toLowerCase().includes(query);
    if(!matches) return;
    const key = t.a + '::' + t.album;
    if(!albumGroups.has(key)) albumGroups.set(key, []);
    albumGroups.get(key).push(t);
  });
  // Représente chaque album par un de ses morceaux qui a réellement une couverture, plutôt
  // que simplement le premier trouvé (qui pouvait très bien ne pas en avoir).
  const albumMatches = [...albumGroups.values()]
    .map(groupTracks => groupTracks.find(t=>t.cover) || groupTracks[0])
    .slice(0, 6);
  // ---- Morceaux — inclut maintenant les featurings (un artiste en "feat." sur le titre de
  // quelqu'un d'autre doit remonter quand on cherche son nom, pas seulement l'artiste
  // principal) — puis trié pour une recherche qui se sent vivante : les vrais sons du
  // moment d'abord (mêmes vraies écoutes que "Extraits populaires"), les sorties les plus
  // récentes ensuite, et le reste trié par popularité réelle plutôt que dans un ordre au
  // hasard.
  const trendingSet = new Set(getTopStreamedTracks(15));
  function searchTier(t){
    if(trendingSet.has(t)) return 0; // en tendance réelle
    const days = t.releaseTs ? (Date.now() - t.releaseTs) / 86400000 : Infinity;
    if(days <= 30) return 1; // sortie récente
    return 2; // le reste
  }
  const trackMatches = tracks.filter(t =>
    (t.t||'').toLowerCase().includes(query) || (t.a||'').toLowerCase().includes(query) ||
    (t.album||'').toLowerCase().includes(query) || (t.featuring||'').toLowerCase().includes(query)
  ).sort((a,b)=>{
    const tierDiff = searchTier(a) - searchTier(b);
    if(tierDiff !== 0) return tierDiff;
    if(searchTier(a) === 1) return (b.releaseTs||0) - (a.releaseTs||0); // nouveautés : la plus récente d'abord
    return parseStreamsCount(b.streams) - parseStreamsCount(a.streams); // tendances + le reste : la plus écoutée d'abord
  }).slice(0, 15);
  const clipMatches = clips.filter(c =>
    (c.title||'').toLowerCase().includes(query) || (c.artist||'').toLowerCase().includes(query)
  ).slice(0, 6);

  if(!artistMatches.length && !albumMatches.length && !trackMatches.length && !clipMatches.length){
    box.innerHTML = `<div class="asv-empty">Aucun résultat pour « ${q} ».</div>`;
    return;
  }

  let html = '';
  // ---- Carte artiste "vedette" — quand la recherche correspond clairement à un seul
  // artiste (nom exact, ou seul résultat), on sort du simple listing pour donner un vrai
  // moment immersif : grande photo, vrais abonnés, vrai genre — plutôt qu'une ligne parmi
  // d'autres. Cet artiste est alors retiré de la liste "Artistes" plus bas pour ne pas se
  // répéter.
  const spotlightName = artistMatches.find(n => n.toLowerCase() === query) || (artistMatches.length === 1 ? artistMatches[0] : null);
  if(spotlightName){
    const spotlightTrack = tracks.find(t => t.a === spotlightName);
    const initials = spotlightName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const avatarUrl = spotlightTrack && spotlightTrack.artistAvatarUrl;
    const bgStyle = avatarUrl ? `background-image:linear-gradient(0deg, rgba(0,0,0,.75) 0%, rgba(0,0,0,.15) 55%), url(${avatarUrl}); background-size:cover; background-position:center 20%;` : '';
    html += `
    <div class="asv-spotlight" id="asv-spotlight-card" style="${bgStyle}">
      ${!avatarUrl ? `<div class="asv-spotlight-fallback">${initials}</div>` : ''}
      <div class="asv-spotlight-info">
        <div class="asv-spotlight-eyebrow">Artiste</div>
        <div class="asv-spotlight-name">${spotlightName}</div>
        <div class="asv-spotlight-meta" id="asv-spotlight-meta">…</div>
      </div>
    </div>`;
  }
  const artistListMatches = artistMatches.filter(n => n !== spotlightName);
  if(artistListMatches.length){
    html += `<div class="asv-section"><div class="asv-section-title">Artistes</div>${artistListMatches.map(name=>{
      const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      // Vraie photo de profil si un morceau de cet artiste en a déjà ramené une (voir
      // artistAvatarUrl dans loadRealTracks) — sinon repli honnête sur les initiales.
      const artistTrackWithAvatar = tracks.find(t => t.a === name && t.artistAvatarUrl);
      const avatarUrl = artistTrackWithAvatar ? artistTrackWithAvatar.artistAvatarUrl : null;
      const avatarStyle = avatarUrl ? `background-image:url(${avatarUrl}); background-size:cover; background-position:center;` : 'background:var(--grad-envol);';
      return `<div class="asv-row" data-kind="artist" data-name="${name.replace(/"/g,'&quot;')}">
        <div class="asv-row-cover is-round" style="${avatarStyle}">${avatarUrl ? '' : initials}</div>
        <div><div class="asv-row-title">${name}</div><div class="asv-row-sub">Artiste</div></div>
      </div>`;
    }).join('')}</div>`;
  }
  if(albumMatches.length){
    html += `<div class="asv-section"><div class="asv-section-title">Albums</div>${albumMatches.map(t=>{
      const coverStyle = t.cover ? `background-image:url(${t.cover});` : '';
      return `<div class="asv-row" data-kind="album" data-idx="${tracks.indexOf(t)}">
        <div class="asv-row-cover ${t.cover ? '' : (t.p||'')}" style="${coverStyle}"></div>
        <div><div class="asv-row-title">${t.album}</div><div class="asv-row-sub">${t.releaseType || 'Album'} · ${t.a}</div></div>
      </div>`;
    }).join('')}</div>`;
  }
  if(trackMatches.length){
    html += `<div class="asv-section"><div class="asv-section-title">Morceaux</div>${trackMatches.map((t,i)=>{
      const coverStyle = t.cover ? `background-image:url(${t.cover});` : '';
      const tier = searchTier(t);
      const tierBadge = tier === 0 ? '<span class="asv-tier-badge is-trending">🔥 Tendance</span>' : tier === 1 ? '<span class="asv-tier-badge is-new">🆕 Nouveauté</span>' : '';
      // Si ce résultat vient d'un featuring (le nom cherché n'est pas l'artiste principal),
      // on le précise plutôt que d'afficher juste l'artiste principal sans contexte.
      const matchedViaFeaturing = !(t.a||'').toLowerCase().includes(query) && (t.featuring||'').toLowerCase().includes(query);
      const sub = matchedViaFeaturing ? `${t.a} · avec ${t.featuring}` : `${t.a}${t.album ? ' · ' + t.album : ''}`;
      return `<div class="asv-row" data-kind="track" data-idx="${tracks.indexOf(t)}">
        <div class="asv-row-cover ${t.cover ? '' : (t.p||'')}" style="${coverStyle}"></div>
        <div><div class="asv-row-title">${t.t} ${tierBadge}</div><div class="asv-row-sub">${sub}</div></div>
      </div>`;
    }).join('')}</div>`;
  }
  if(clipMatches.length){
    html += `<div class="asv-section"><div class="asv-section-title">Clips</div>${clipMatches.map(c=>{
      const coverStyle = c.thumb ? `background-image:url(${c.thumb});` : '';
      return `<div class="asv-row" data-kind="clip" data-idx="${clips.indexOf(c)}">
        <div class="asv-row-cover ${c.thumb ? '' : (c.pal||'pal-1')}" style="${coverStyle}"></div>
        <div><div class="asv-row-title">${esc(c.title)}</div><div class="asv-row-sub">${esc(c.artist)}</div></div>
      </div>`;
    }).join('')}</div>`;
  }
  box.innerHTML = html;

  if(spotlightName){
    const spotlightTrack = tracks.find(t => t.a === spotlightName);
    const card = document.getElementById('asv-spotlight-card');
    if(card){
      card.onclick = ()=>{ enterApp('catalog'); openArtistPage(spotlightName, spotlightTrack && spotlightTrack.artistId); };
      if(spotlightTrack && spotlightTrack.artistId){
        fetch(NUNI_API_BASE + '/api/artist/' + spotlightTrack.artistId + '/public-stats')
          .then(r=>r.json()).then(data=>{
            const metaEl = document.getElementById('asv-spotlight-meta');
            if(!metaEl) return;
            const genre = spotlightTrack.genre ? spotlightTrack.genre + ' · ' : '';
            metaEl.textContent = `${genre}${(data.follower_count||0).toLocaleString('fr-FR')} abonnés`;
          }).catch(()=>{});
      }
    }
  }

  box.querySelectorAll('.asv-row[data-kind="artist"]').forEach(row=>{
    row.onclick = ()=>{
      const name = row.dataset.name;
      const topTrack = tracks.find(t=>t.a===name);
      enterApp('catalog');
      openArtistPage(name, topTrack && topTrack.artistId);
    };
  });
  box.querySelectorAll('.asv-row[data-kind="album"]').forEach(row=>{
    row.onclick = ()=>{ const t = tracks[Number(row.dataset.idx)]; enterApp('catalog'); openAlbumView(t); };
  });
  box.querySelectorAll('.asv-row[data-kind="track"]').forEach(row=>{
    row.onclick = ()=>{ const t = tracks[Number(row.dataset.idx)]; enterApp('catalog'); handleTrackCardClick(t); };
  });
  box.querySelectorAll('.asv-row[data-kind="clip"]').forEach(row=>{
    row.onclick = ()=>{ const c = clips[Number(row.dataset.idx)]; enterApp('clips'); openClipWatchPage(c); };
  });
}

/* ============ SÉPARATION INTERFACE CONSOMMATEUR / ARTISTE ============ */
let accountType = 'artist'; // 'artist' ou 'consumer' — démo : on part en vue Artiste (Bibi Mwana)
let demoOverride = false; // true = le bouton démo a été utilisé manuellement, on ignore le vrai compte
let applyAccountTypeRunning = false; // garde-fou anti-boucle : voir l'appel à enterApp() plus bas dans cette fonction
function applyAccountType(){
  if(applyAccountTypeRunning) return; // déjà en cours d'exécution plus haut dans la pile — ne jamais s'imbriquer
  applyAccountTypeRunning = true;
  try{
    applyAccountTypeInner();
  } finally {
    applyAccountTypeRunning = false;
  }
}
function applyAccountTypeInner(){
  if(!demoOverride && currentUser){ accountType = currentUser.account_type; }
  const isArtist = accountType === 'artist';
  const isLabel = accountType === 'label';
  const hasActivePass = currentUser ? (currentUser.subscription_status === 'active') : true; // true en mode démo
  document.querySelectorAll('.nav-artist-only').forEach(el=> el.style.display = isArtist ? '' : 'none');
  document.querySelectorAll('.nav-consumer-only').forEach(el=> el.style.display = (isArtist || isLabel) ? 'none' : '');
  document.querySelectorAll('.tab-artist-only').forEach(el=> el.style.display = isArtist ? '' : 'none');
  document.querySelectorAll('.tab-consumer-only').forEach(el=> el.style.display = (isArtist || isLabel) ? 'none' : '');
  // Le Dashboard reste accessible à un compte Label (écran dédié — voir enterApp), même s'il
  // n'a pas accès aux autres éléments réservés aux artistes (page Artiste publique, "Mon
  // profil" au sens artiste...).
  const dashboardLink = document.getElementById('nav-dashboard-link');
  if(dashboardLink) dashboardLink.style.display = (isArtist || isLabel) ? '' : 'none';
  const chipLabel = document.querySelector('.user-chip span');
  if(chipLabel){
    if(!currentUser){
      chipLabel.textContent = isArtist ? 'Bibi M.' : 'Auditeur';
    } else if(isArtist && currentUser.artist_name){
      chipLabel.textContent = currentUser.artist_name; // un artiste doit se reconnaître par son nom de scène, pas prénom+initiale
    } else {
      chipLabel.textContent = currentUser.first_name + ' ' + currentUser.last_name.charAt(0) + '.';
    }
  }
  if(currentUser && currentUser.avatar_url){ applyAvatarEverywhere(currentUser.avatar_url); }
  const artistMenuItem = document.getElementById('profile-menu-artist-space');
  if(artistMenuItem) artistMenuItem.style.display = isArtist ? '' : 'none';
  const switchBtn = document.getElementById('account-switch-btn');
  if(switchBtn) switchBtn.textContent = isArtist ? ' Passer en vue Consommateur' : ' Passer en vue Artiste';
  // Avant : ce bouton venait du mode démo pré-connexion (avant l'existence des vrais
  // comptes, pour prévisualiser les deux expériences) — mais il restait affiché même pour
  // un VRAI compte connecté. Un Pass Auditeur pouvait donc littéralement voir et
  // naviguer dans l'interface Artiste (Dashboard, page Artiste...), ce qui n'a aucun sens :
  // seul le type de compte réel doit déterminer l'accès. Masqué dès qu'un vrai compte est
  // connecté — ne reste utile que pendant la démo, avant inscription.
  if(switchBtn) switchBtn.style.display = currentUser ? 'none' : '';
  // si l'écran courant n'existe pas côté consommateur, on revient au catalogue — mais
  // uniquement Dashboard/admin, jamais 'artist' : visiter la page d'un AUTRE artiste (via
  // openArtistPage) utilise cette même vue 'artist', et c'est une navigation normale et
  // publique pour n'importe quel type de compte, pas un accès à protéger.
  if(!isArtist && !isLabel){
    const activeLink = document.querySelector('.app-nav-link.is-active');
    if(activeLink && ['dashboard','admin'].includes(activeLink.dataset.appLink)) enterApp('catalog');
  }
}
function switchAccountType(){
  demoOverride = true;
  accountType = accountType === 'artist' ? 'consumer' : 'artist';
  applyAccountType();
  closeProfileMenu();
  toast(accountType === 'artist' ? 'Vue Pass Artiste activée — menu Accueil, Opportunités, Artiste, Dashboard.' : 'Vue Pass Auditeur activée — menu Accueil, Opportunités, Clips, Bibliothèque.');
  if(accountType === 'consumer') enterApp('catalog');
}
/* ============ BIBLIOTHÈQUE (cartes + liste filtrable) ============ */
let libraryActiveCategory = 'liked';
let libraryActiveSort = 'recent';
let libraryPlaylistsCache = null; // vraies playlists NUNI (curées, /api/playlists)
let libraryArtistsCache = null;   // vrais artistes suivis (/api/me/following)
let libraryMyPlaylistsCache = null; // vraies playlists personnelles créées par l'utilisateur (/api/me/playlists)
let libraryRecentlyPlayedCache = null; // vrai historique d'écoute persistant côté serveur (/api/me/recently-played)
let libraryRecentPollTimer = null; // actualise "Écoutés récemment" tant que cette catégorie reste ouverte

function setLibraryCategory(cat){
  libraryActiveCategory = cat;
  const sortMenu = document.getElementById('lib-sort-menu');
  if(sortMenu) sortMenu.style.display = 'none';
  const home = document.getElementById('lib-home');
  const detail = document.getElementById('lib-detail');
  if(home) home.style.display = 'none';
  if(detail) detail.style.display = '';
  renderLibrary();
  if(cat === 'recent') startLibraryRecentPolling(); else stopLibraryRecentPolling();
}
// Retour à l'écran d'accueil de la Bibliothèque (liste rapide + Ajouts récents), façon
// bouton "‹ Bibliothèque" d'Apple Music en haut d'une liste ouverte.
function closeLibraryDetail(){
  const home = document.getElementById('lib-home');
  const detail = document.getElementById('lib-detail');
  if(detail) detail.style.display = 'none';
  if(home) home.style.display = '';
  stopLibraryRecentPolling();
  renderLibraryRecentGrid(); // au cas où un like/suivi a eu lieu pendant qu'on était dans le détail
}
// Réinitialise sur l'écran d'accueil à chaque entrée dans l'onglet Bibliothèque (appelé
// depuis enterApp) — évite de rester coincé dans le détail d'une catégorie précédente.
function openLibraryHome(){
  const home = document.getElementById('lib-home');
  const detail = document.getElementById('lib-detail');
  if(detail) detail.style.display = 'none';
  if(home) home.style.display = '';
  stopLibraryRecentPolling();
  renderLibraryRecentGrid();
}
// ---------- "Ajouts récents" — vraie fusion des titres aimés et artistes suivis, triée par
// vraie date d'ajout (likedAt / followedAt), façon écran d'accueil Bibliothèque d'Apple Music.
// Jamais de contenu inventé : si rien n'a encore été aimé ou suivi, la grille reste vide avec
// un message clair plutôt que d'afficher un exemple fictif.
function buildRecentlyAdded(limit){
  const items = [];
  favoritesPlaylist.forEach(tr=>{
    if(tr.likedAt) items.push({ kind:'track', at: tr.likedAt, track: tr });
  });
  (libraryArtistsCache || []).forEach(ar=>{
    if(ar.followedAt) items.push({ kind:'artist', at: ar.followedAt, artist: ar });
  });
  items.sort((a,b)=> b.at - a.at);
  return items.slice(0, limit || 12);
}
async function renderLibraryRecentGrid(){
  const grid = document.getElementById('lib-recent-grid');
  if(!grid) return;
  await loadLibraryArtistsIfNeeded();
  const items = buildRecentlyAdded(12);
  if(!items.length){
    grid.innerHTML = `<div class="pi-empty">Rien ajouté pour l'instant.<br>Aimez un titre ou suivez un artiste pour le voir apparaître ici.</div>`;
    return;
  }
  grid.innerHTML = '';
  items.forEach(it=>{
    const tile = document.createElement('div'); tile.className = 'lib-recent-tile';
    let coverForGlow = null;
    if(it.kind === 'track'){
      const tr = it.track;
      const covStyle = tr.cover ? `background-image:url(${tr.cover})` : '';
      tile.innerHTML = `
        <div class="lib-recent-cov ${tr.cover?'':tr.p}" style="${covStyle}"></div>
        <div class="lib-recent-t">${esc(tr.t)}</div>
        <div class="lib-recent-s">Titre · ${esc(tr.a)}</div>`;
      tile.onclick = ()=> handleTrackCardClick(tr);
      coverForGlow = tr.cover;
    } else {
      const ar = it.artist;
      const name = ar.artist_name || ar.first_name;
      const covStyle = ar.avatar_url ? `background-image:url(${ar.avatar_url})` : '';
      tile.innerHTML = `
        <div class="lib-recent-cov lib-recent-cov-round" style="${covStyle}"></div>
        <div class="lib-recent-t">${name}</div>
        <div class="lib-recent-s">Artiste</div>`;
      tile.onclick = ()=> openArtistPage(name, ar.id);
      coverForGlow = ar.avatar_url;
    }
    grid.appendChild(tile);
    // Fusion pochette ↔ tuile : la vraie couleur dominante de CETTE image précise irrigue
    // à la fois un halo derrière la pochette et un léger fond de tuile — jamais une couleur
    // générique appliquée à toutes les tuiles indifféremment.
    if(coverForGlow && typeof NuniPalette !== 'undefined'){
      NuniPalette.extract(coverForGlow).then(palette=>{
        const cov = tile.querySelector('.lib-recent-cov');
        if(cov) cov.style.boxShadow = `0 10px 26px -10px rgba(0,0,0,.55), 0 0 30px -6px ${palette.accent}`;
        tile.style.background = `radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, ${palette.dominant} 20%, transparent) 0%, transparent 70%)`;
        tile.style.borderRadius = '14px';
      }).catch(()=>{});
    }
  });
}
function toggleLibrarySortMenu(){
  const menu = document.getElementById('lib-sort-menu');
  if(menu) menu.style.display = (menu.style.display === 'none') ? 'flex' : 'none';
}
function setLibrarySort(sort){
  libraryActiveSort = sort;
  const menu = document.getElementById('lib-sort-menu');
  if(menu) menu.style.display = 'none';
  renderLibrary();
}
function sortTrackList(list){
  const arr = [...list];
  if(libraryActiveSort === 'az') arr.sort((a,b)=> (a.t||'').localeCompare(b.t||''));
  else if(libraryActiveSort === 'artist') arr.sort((a,b)=> (a.a||'').localeCompare(b.a||''));
  return arr; // 'recent' = ordre déjà chronologique (le plus récent en premier)
}
// ---------- Fusion visuelle pochette ↔ interface, réutilisée dans toute la Bibliothèque ----------
// S'appuie sur NuniPalette (déjà utilisée par le lecteur plein écran et le mini-lecteur) :
// aucune nouvelle extraction de couleur inventée, juste la même vraie couleur dominante de
// CETTE pochette précise, appliquée en halo derrière son propre élément visuel — jamais une
// couleur générique partagée par tous les éléments.
function applyCoverGlow(el, coverUrl){
  if(!el || !coverUrl || typeof NuniPalette === 'undefined') return;
  NuniPalette.extract(coverUrl).then(palette=>{
    el.style.boxShadow = `0 8px 22px -10px rgba(0,0,0,.55), 0 0 24px -6px ${palette.accent}`;
  }).catch(()=>{});
}
function buildLibraryTrackRow(tr, subtitleSuffix){
  const item = document.createElement('div'); item.className = 'pi-item lib-track-row';
  const covStyle = tr.cover ? `background-image:url(${tr.cover})` : '';
  item.innerHTML = `
    <div class="cov ${tr.cover?'':tr.p}" style="${covStyle}"></div>
    <div class="lib-track-info"><div class="t">${esc(tr.t)}</div><div class="s">${esc(tr.a)}${subtitleSuffix||''}</div></div>
    <button class="btn-icon lib-track-menu-btn" aria-label="Options">
      <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
    </button>`;
  item.querySelector('.cov').onclick = ()=> handleTrackCardClick(tr);
  item.querySelector('.lib-track-info').onclick = ()=> handleTrackCardClick(tr);
  item.querySelector('.lib-track-menu-btn').onclick = (e)=>{ e.stopPropagation(); openTrackCardMenu(tr, e.currentTarget); };
  if(tr.cover) applyCoverGlow(item.querySelector('.cov'), tr.cover);
  return item;
}
async function loadLibraryMyPlaylistsIfNeeded(force){
  if(libraryMyPlaylistsCache && !force) return libraryMyPlaylistsCache;
  if(!realAuthToken){ libraryMyPlaylistsCache = []; return libraryMyPlaylistsCache; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/playlists', { headers:{ 'Authorization':'Bearer '+realAuthToken } });
    const data = await res.json();
    libraryMyPlaylistsCache = data.playlists || [];
  }catch(e){ libraryMyPlaylistsCache = []; }
  return libraryMyPlaylistsCache;
}
// Petite modale légère (construite à la volée, comme le menu "..." d'un morceau) pour
// nommer une nouvelle playlist personnelle — pas de saisie native window.prompt(), pour
// rester cohérent avec le reste de l'habillage NUNI.
function ensureSimplePromptStyles(){
  if(document.getElementById('simple-prompt-styles')) return;
  const style = document.createElement('style');
  style.id = 'simple-prompt-styles';
  style.textContent = `
    #simple-prompt-overlay{position:fixed; inset:0; z-index:10050; background:rgba(0,0,0,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; opacity:0; transition:opacity .2s ease;}
    #simple-prompt-overlay.show{opacity:1;}
    #simple-prompt-card{width:100%; max-width:340px; background:var(--bg-elev); border:1px solid var(--border); border-radius:18px; padding:20px; box-shadow:0 20px 50px -12px rgba(0,0,0,.5);}
    #simple-prompt-card h4{font-size:15px; font-weight:700; margin:0 0 12px;}
    #simple-prompt-card input{width:100%; box-sizing:border-box; padding:11px 13px; border-radius:11px; border:1px solid var(--border); background:var(--bg-card); color:var(--text); font-size:14px; margin-bottom:14px;}
    #simple-prompt-card input:focus{ outline:none; border-color:var(--accent); }
    #simple-prompt-actions{display:flex; gap:10px; justify-content:flex-end;}
    #simple-prompt-actions button{padding:9px 16px; border-radius:999px; border:none; font-size:13px; font-weight:600; cursor:pointer;}
    #simple-prompt-cancel{background:var(--bg-card); color:var(--text-dim);}
    #simple-prompt-confirm{background:var(--grad-envol); color:#241708;}
  `;
  document.head.appendChild(style);
}
// Renvoie une Promise résolue avec le texte saisi, ou null si annulé — permet à l'appelant
// d'utiliser await comme avec window.prompt(), mais avec l'habillage visuel de NUNI.
function askForPlaylistName(defaultVal){
  ensureSimplePromptStyles();
  return new Promise(resolve=>{
    const overlay = document.createElement('div');
    overlay.id = 'simple-prompt-overlay';
    overlay.innerHTML = `
      <div id="simple-prompt-card">
        <h4>Nom de la playlist</h4>
        <input id="simple-prompt-input" type="text" maxlength="100" placeholder="Ex. Ambiance Rumba" value="${defaultVal||''}">
        <div id="simple-prompt-actions">
          <button id="simple-prompt-cancel">Annuler</button>
          <button id="simple-prompt-confirm">Créer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(()=> overlay.classList.add('show'));
    const input = overlay.querySelector('#simple-prompt-input');
    input.focus();
    const finish = (val)=>{ overlay.classList.remove('show'); setTimeout(()=> overlay.remove(), 150); resolve(val); };
    overlay.querySelector('#simple-prompt-cancel').onclick = ()=> finish(null);
    overlay.querySelector('#simple-prompt-confirm').onclick = ()=> finish(input.value.trim() || null);
    input.onkeydown = (e)=>{ if(e.key === 'Enter') finish(input.value.trim() || null); if(e.key === 'Escape') finish(null); };
  });
}
async function createPlaylistPrompt(){
  if(!realAuthToken){ toast('Connectez-vous pour créer une playlist.'); return; }
  const title = await askForPlaylistName();
  if(!title) return;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/playlists', {
      method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+realAuthToken },
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    if(!res.ok){ toast(' ' + (data.error || 'Erreur.')); return; }
    libraryMyPlaylistsCache = null; // resynchronisation propre depuis le serveur au prochain rendu
    toast('Playlist « ' + title + ' » créée.');
    renderLibrary();
  }catch(e){ toast(' Impossible de contacter le serveur NUNI.'); }
}
async function renderLibraryPlaylists(listEl){
  listEl.innerHTML = `<div class="pi-empty">Chargement…</div>`;
  const [official] = await Promise.all([
    (async ()=>{ if(!libraryPlaylistsCache){ try{ const res = await fetch(NUNI_API_BASE + '/api/playlists'); const data = await res.json(); libraryPlaylistsCache = data.playlists || []; }catch(e){ libraryPlaylistsCache = []; } } return libraryPlaylistsCache; })(),
    loadLibraryMyPlaylistsIfNeeded(),
  ]);
  if(libraryActiveCategory !== 'playlists') return; // la catégorie a pu changer pendant le chargement
  listEl.innerHTML = '';

  // Toujours visible en premier — jamais de cul-de-sac vide même sans playlist existante.
  const createRow = document.createElement('div'); createRow.className = 'pi-item lib-create-playlist-row';
  createRow.innerHTML = `<div class="cov lib-create-playlist-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></div><div><div class="t">Créer une playlist</div><div class="s">Ajoutez-y vos morceaux préférés</div></div>`;
  createRow.onclick = createPlaylistPrompt;
  listEl.appendChild(createRow);

  if(libraryMyPlaylistsCache.length){
    const label = document.createElement('div'); label.className = 'lib-sub-label'; label.textContent = 'Mes playlists';
    listEl.appendChild(label);
    libraryMyPlaylistsCache.forEach(pl=>{
      const item = document.createElement('div'); item.className = 'pi-item';
      const covStyle = pl.cover_url ? `background-image:url(${pl.cover_url})` : '';
      item.innerHTML = `<div class="cov pal-2" style="${covStyle}"></div><div><div class="t">${esc(pl.title)}</div><div class="s">${pl.track_count || 0} titre${(pl.track_count||0) > 1 ? 's' : ''} · Ma playlist</div></div>`;
      item.onclick = ()=> openMyPlaylistPage(pl.id);
      if(pl.cover_url) applyCoverGlow(item.querySelector('.cov'), pl.cover_url);
      listEl.appendChild(item);
    });
  }
  if(libraryPlaylistsCache.length){
    const label = document.createElement('div'); label.className = 'lib-sub-label'; label.textContent = 'Playlists NUNI';
    listEl.appendChild(label);
    libraryPlaylistsCache.forEach(pl=>{
      const item = document.createElement('div'); item.className = 'pi-item';
      const covStyle = pl.cover_url ? `background-image:url(${pl.cover_url})` : '';
      item.innerHTML = `<div class="cov pal-1" style="${covStyle}"></div><div><div class="t">${esc(pl.title)}</div><div class="s">${pl.track_count || 0} titre${(pl.track_count||0) > 1 ? 's' : ''}</div></div>`;
      item.onclick = ()=> openPlaylistPage(pl.id);
      if(pl.cover_url) applyCoverGlow(item.querySelector('.cov'), pl.cover_url);
      listEl.appendChild(item);
    });
  }
}
// Réutilisée par le détail "Artistes" ET par la grille "Ajouts récents" — un seul point de
// chargement, pour ne jamais afficher deux versions différentes de la même vraie liste.
async function loadLibraryArtistsIfNeeded(){
  if(libraryArtistsCache) return libraryArtistsCache;
  if(!realAuthToken){ libraryArtistsCache = []; return libraryArtistsCache; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/following', { headers:{'Authorization':'Bearer '+realAuthToken} });
    const data = await res.json();
    // followedAt = vraie date de suivi (followed_at renvoyé par le serveur), convertie en
    // timestamp pour pouvoir trier "Ajouts récents" avec les titres aimés sur la même échelle.
    libraryArtistsCache = (data.following || []).map(ar => ({ ...ar, followedAt: ar.followed_at ? new Date(ar.followed_at).getTime() : 0 }));
  }catch(e){ libraryArtistsCache = []; }
  return libraryArtistsCache;
}
async function renderLibraryArtists(listEl){
  if(!libraryArtistsCache){
    listEl.innerHTML = `<div class="pi-empty">Chargement…</div>`;
    await loadLibraryArtistsIfNeeded();
  }
  if(libraryActiveCategory !== 'artists') return;
  listEl.innerHTML = '';
  if(!libraryArtistsCache.length){
    await renderLibrarySuggestedArtists(listEl);
    return;
  }
  libraryArtistsCache.forEach(ar=>{
    const name = ar.artist_name || ar.first_name;
    const item = document.createElement('div'); item.className = 'pi-item';
    const covStyle = ar.avatar_url ? `background-image:url(${ar.avatar_url})` : '';
    item.innerHTML = `<div class="cov pal-1" style="${covStyle}; border-radius:50%;"></div><div><div class="t">${name}${ar.is_verified?' <svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>':''}</div><div class="s">Artiste NUNI</div></div>`;
    item.onclick = ()=> openArtistPage(name, ar.id);
    if(ar.avatar_url) applyCoverGlow(item.querySelector('.cov'), ar.avatar_url);
    listEl.appendChild(item);
  });
}
// Vraies suggestions d'artistes à suivre (même source que la section homepage "Artistes à
// suivre", /api/artists/featured) — jamais un message vide sans action possible : dès que
// l'utilisateur ne suit encore personne, on lui propose tout de suite de vrais comptes à
// découvrir, avec un vrai bouton Suivre qui appelle le serveur.
async function renderLibrarySuggestedArtists(listEl){
  listEl.innerHTML = `<div class="pi-empty">Vous ne suivez encore aucun artiste — voici quelques suggestions :</div>`;
  try{
    const res = await fetch(NUNI_API_BASE + '/api/artists/featured');
    const data = await res.json();
    const list = data.artists || [];
    if(libraryActiveCategory !== 'artists') return;
    if(!list.length) return; // le message d'accroche ci-dessus suffit s'il n'y a vraiment aucun artiste actif
    const label = document.createElement('div'); label.className = 'lib-sub-label'; label.textContent = 'Suggestions';
    listEl.appendChild(label);
    list.forEach(ar=>{
      const name = ar.artist_name || ar.first_name;
      const item = document.createElement('div'); item.className = 'pi-item';
      const covStyle = ar.avatar_url ? `background-image:url(${ar.avatar_url})` : '';
      item.innerHTML = `
        <div class="cov pal-1" style="${covStyle}; border-radius:50%;"></div>
        <div class="pi-info-flex"><div class="t">${name}${ar.is_verified?' <svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>':''}</div><div class="s">${ar.top_genre || 'Artiste NUNI'}</div></div>
        <button class="lib-suggest-follow-btn">Suivre</button>`;
      item.querySelector('.cov').onclick = ()=> openArtistPage(name, ar.id);
      item.querySelector('.pi-info-flex').onclick = ()=> openArtistPage(name, ar.id);
      const followBtn = item.querySelector('.lib-suggest-follow-btn');
      followBtn.onclick = async (e)=>{
        e.stopPropagation();
        if(!realAuthToken){ toast('Connectez-vous pour suivre un artiste.'); return; }
        followBtn.disabled = true;
        try{
          const res2 = await fetch(NUNI_API_BASE + '/api/follow', {
            method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + realAuthToken},
            body: JSON.stringify({ artistId: ar.id })
          });
          const data2 = await res2.json();
          followBtn.disabled = false;
          if(!data2.error && data2.following){
            libraryArtistsCache = null; // resynchronisation propre — l'artiste va maintenant apparaître dans la vraie liste "suivis"
            toast(`Vous suivez maintenant ${name}.`);
            renderLibrary();
            renderLibraryRecentGrid();
          } else if(data2.error){ toast(' ' + data2.error); }
        }catch(err){ followBtn.disabled = false; toast(' Impossible de contacter le serveur NUNI.'); }
      };
      listEl.appendChild(item);
    });
  }catch(e){ /* le message d'accroche suffit si les suggestions sont indisponibles */ }
}
function renderLibrary(){
  const listEl = document.getElementById('library-list');
  const titleEl = document.getElementById('lib-list-title');
  if(!listEl) return;
  listEl.innerHTML = '';


  if(libraryActiveCategory === 'liked'){
    titleEl.textContent = 'Titres aimés';
    if(!favoritesPlaylist.length){
      listEl.innerHTML = `<div class="pi-empty">Aucun titre aimé pour l'instant.<br>Appuyez sur <svg class="nuni-ic filled nuni-ic-err" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg> sur un morceau pour le retrouver ici.</div>`;
      return;
    }
    sortTrackList(favoritesPlaylist).forEach(tr=> listEl.appendChild(buildLibraryTrackRow(tr)));
  } else if(libraryActiveCategory === 'recent'){
    titleEl.textContent = 'Écoutés récemment';
    renderLibraryRecent(listEl);
  } else if(libraryActiveCategory === 'playlists'){
    titleEl.textContent = 'Playlists NUNI';
    renderLibraryPlaylists(listEl);
  } else if(libraryActiveCategory === 'artists'){
    titleEl.textContent = 'Artistes suivis';
    renderLibraryArtists(listEl);
  }
}
// ---------- "Écoutés récemment" — avant : basé UNIQUEMENT sur listeningHistory, une mémoire
// de session remise à zéro à chaque rechargement de page (invisible dès qu'on revenait sur
// NUNI). Maintenant : le vrai historique persistant côté serveur (/api/me/recently-played,
// déjà utilisé sur l'accueil), fusionné avec les écoutes de LA session en cours pour un
// affichage immédiat sans attendre un aller-retour serveur — puis actualisé périodiquement
// (toutes les 20s tant que cette catégorie reste ouverte) pour rester synchronisé.
async function loadLibraryRecentlyPlayedIfNeeded(force){
  if(libraryRecentlyPlayedCache && !force) return libraryRecentlyPlayedCache;
  if(!realAuthToken){ libraryRecentlyPlayedCache = []; return libraryRecentlyPlayedCache; }
  try{
    const res = await fetch(NUNI_API_BASE + '/api/me/recently-played?limit=60', { headers:{ 'Authorization':'Bearer '+realAuthToken } });
    if(!res.ok){ libraryRecentlyPlayedCache = libraryRecentlyPlayedCache || []; return libraryRecentlyPlayedCache; }
    const data = await res.json();
    libraryRecentlyPlayedCache = (data.tracks || [])
      .map(r => ({ track: tracks.find(t => t.isReal && t.realId === r.id), at: new Date(r.last_played_at).getTime() }))
      .filter(e => e.track);
  }catch(e){ libraryRecentlyPlayedCache = libraryRecentlyPlayedCache || []; }
  return libraryRecentlyPlayedCache;
}
function buildMergedRecentlyPlayed(){
  // Fusionne le vrai historique serveur (persistant) avec les écoutes de la session en cours
  // (instantané, avant même que le serveur ait fini d'enregistrer le stream) — un même
  // morceau garde son horodatage le PLUS RÉCENT entre les deux sources.
  const byKey = new Map();
  (libraryRecentlyPlayedCache || []).forEach(e=>{
    const key = e.track.realId != null ? 'r'+e.track.realId : e.track.t;
    byKey.set(key, { track: e.track, at: e.at });
  });
  listeningHistory.forEach(h=>{
    const key = h.track.realId != null ? 'r'+h.track.realId : h.track.t;
    const existing = byKey.get(key);
    if(!existing || h.at > existing.at) byKey.set(key, { track: h.track, at: h.at });
  });
  return [...byKey.values()].sort((a,b)=> b.at - a.at);
}
async function renderLibraryRecent(listEl){
  await loadLibraryRecentlyPlayedIfNeeded();
  if(libraryActiveCategory !== 'recent') return;
  const merged = buildMergedRecentlyPlayed();
  if(!merged.length){
    listEl.innerHTML = `<div class="pi-empty">Rien écouté pour l'instant.<br>Votre historique réel apparaîtra ici dès votre première écoute.</div>`;
    return;
  }
  listEl.innerHTML = '';
  const entries = libraryActiveSort === 'recent'
    ? merged
    : sortTrackList(merged.map(e=>e.track)).map(t=> merged.find(e=>e.track===t));
  entries.forEach(e=>{
    const mins = Math.max(0, Math.round((Date.now()-e.at)/60000));
    const label = mins === 0 ? "à l'instant" : mins < 60 ? 'il y a ' + mins + ' min' : 'il y a ' + Math.round(mins/60) + 'h';
    listEl.appendChild(buildLibraryTrackRow(e.track, ' · ' + label));
  });
}
function startLibraryRecentPolling(){
  stopLibraryRecentPolling();
  libraryRecentPollTimer = setInterval(async ()=>{
    if(libraryActiveCategory !== 'recent') { stopLibraryRecentPolling(); return; }
    await loadLibraryRecentlyPlayedIfNeeded(true);
    const listEl = document.getElementById('library-list');
    if(listEl && libraryActiveCategory === 'recent') renderLibraryRecent(listEl);
  }, 20000);
}
function stopLibraryRecentPolling(){
  if(libraryRecentPollTimer){ clearInterval(libraryRecentPollTimer); libraryRecentPollTimer = null; }
}

/* ============ MENU PROFIL ============ */
function toggleProfileMenu(){
  document.getElementById('profile-menu').classList.toggle('open');
}
function closeProfileMenu(){
  document.getElementById('profile-menu').classList.remove('open');
}
document.addEventListener('click', (e)=>{
  const wrap = document.querySelector('.profile-menu-wrap');
  if(wrap && !wrap.contains(e.target)) closeProfileMenu();
});
// Même principe pour "Le P" — se ferme dès qu'on clique n'importe où en dehors du widget,
// pas seulement via son bouton de fermeture explicite.
document.addEventListener('click', (e)=>{
  const mimiWidget = document.getElementById('mimi-widget');
  if(!mimiWidget || !mimiWidget.classList.contains('open')) return;
  if(!mimiWidget.contains(e.target)) mimiWidget.classList.remove('open');
});
applyAccountType();
refreshLabelPlanOptionsFromServer();
sessionRestorePromise = restoreSession();

/* ============================================================
   PHASE 4 DA — le scroll raconte une histoire : chaque section (shelf)
   apparaît en douceur en entrant dans le cadre, une seule fois. Un seul
   IntersectionObserver partagé pour toute la page, jamais un par
   section — reste léger même avec des dizaines de sections au fil de
   la navigation. Rappelé à chaque changement de vue (voir enterApp)
   pour repérer les nouvelles sections qui viennent d'apparaître.
============================================================ */
/* ============================================================
   MASQUER LE LECTEUR SUR MOBILE PENDANT UNE INTERFACE PLEIN ÉCRAN —
   comportement Spotify/Apple Music : le mini-lecteur ne reste jamais
   visible par-dessus une page ouverte (Album, Playlist, À propos,
   Voir le monde, Récap...). Toutes ces interfaces basculent déjà
   document.body.style.overflow entre 'hidden' et '' à l'ouverture/
   fermeture (pattern déjà utilisé partout) — un seul observateur ici
   suffit, plutôt que de dupliquer la logique dans chaque fonction.
   Ne change rien en desktop (voir la media query dans style.css).
============================================================ */
const playerBarVisibilityObserver = new MutationObserver(()=>{
  const playerBar = document.getElementById('player-bar');
  if(!playerBar) return;
  const overlayOpen = document.body.style.overflow === 'hidden';
  playerBar.classList.toggle('hide-for-overlay', overlayOpen);
});
playerBarVisibilityObserver.observe(document.body, { attributes:true, attributeFilter:['style'] });

let scrollRevealObserver = null;
function initScrollReveal(){
  if(!scrollRevealObserver){
    if(typeof IntersectionObserver === 'undefined') return; // navigateur très ancien : pas grave, tout reste simplement visible
    scrollRevealObserver = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          scrollRevealObserver.unobserve(entry.target); // une seule révélation, jamais de va-et-vient au re-scroll
        }
      });
    }, { threshold:0.12, rootMargin:'0px 0px -60px 0px' });
  }
  document.querySelectorAll('.shelf:not([data-scroll-observed])').forEach(el=>{
    el.dataset.scrollObserved = '1';
    el.classList.add('scroll-chapter');
    scrollRevealObserver.observe(el);
  });
}
initScrollReveal();

/* ============================================================
   PARALLAX du Hero — la pochette en fond bouge plus lentement que le
   scroll, comme un décor qui reste derrière le premier plan. Calcul
   limité à une fois par frame d'affichage (requestAnimationFrame), et
   totalement ignoré si le Hero n'est même pas visible à l'écran —
   aucun coût quand on est ailleurs dans l'app.
============================================================ */
if(!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)){
  let heroParallaxRaf = null;
  document.addEventListener('scroll', ()=>{
    if(heroParallaxRaf) return;
    heroParallaxRaf = requestAnimationFrame(()=>{
      heroParallaxRaf = null;
      const hero = document.getElementById('premium-hero-accueil');
      if(!hero || hero.offsetParent === null) return; // masqué (autre vue affichée) : rien à faire
      const rect = hero.getBoundingClientRect();
      if(rect.bottom < 0 || rect.top > window.innerHeight) return; // hors du cadre visible : pas la peine de calculer
      const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height); // 0 en entrant, 1 en sortant
      const shift = (progress - 0.5) * 34; // léger déplacement vertical, jamais brutal
      hero.style.backgroundPosition = `center ${50 + shift}%`;
    });
  }, { passive:true });
}

/* ============ REPRISE APRÈS RETOUR EN ARRIÈRE-PLAN (ex: WhatsApp) ============
   Avant : rien ne se passait quand on revenait sur l'onglet NUNI après être parti sur
   WhatsApp valider un paiement — sur mobile, le navigateur suspend/gèle parfois l'onglet en
   arrière-plan, et au retour l'écran restait bloqué/blanc tant qu'on ne rechargeait pas
   manuellement. Ici : uniquement si l'écran semble vraiment resté bloqué (aucun écran
   normal affiché alors qu'une session existe), on relance une vraie vérification — sans
   perturber un simple changement d'onglet classique pendant une utilisation normale.
   Le rappel périodique du compte (2 min) reste lui aussi actif comme avant. */
let lastVisibilityCheckAt = Date.now();
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState !== 'visible') return;
  if(Date.now() - lastVisibilityCheckAt < 3000) return; // anti-rebond
  lastVisibilityCheckAt = Date.now();

  const appShellVisible = document.getElementById('app-shell').classList.contains('active');
  const anyScreenVisible = document.querySelector('.screen.active') !== null;
  // Ni l'app normale ni l'écran de connexion ne sont affichés alors qu'une session existe
  // (ou qu'aucune des deux vues attendues n'est visible) : l'écran est probablement resté
  // bloqué après le retour en arrière-plan — on force une vraie reprise.
  if(!appShellVisible && !anyScreenVisible){
    restoreSession();
  } else if(realAuthToken){
    // Cas normal (juste changé d'onglet) : pas besoin de tout recharger, juste vérifier
    // discrètement si le compte est toujours actif (déjà fait périodiquement de toute façon).
    startAccountStatusWatcher();
  }
});

/* ============ CONTENU DU MENU PROFIL ============ */
/* Avant : le choix de langue n'était jamais mémorisé — repartait toujours en français au
   rechargement, même après l'avoir explicitement changé. */
const NUNI_LANG_KEY = 'nuni_language';
let currentLanguage = 'fr';
try{
  const savedLang = localStorage.getItem(NUNI_LANG_KEY);
  if(savedLang) currentLanguage = savedLang;
}catch(e){ /* pas bloquant */ }
const languages = [
  { code:'fr', name:'Français', native:'Français' },
  { code:'en', name:'English', native:'English' },
];
const homeTranslations = {
  fr: { eyebrow:"La plateforme qui finance directement la musique congolaise", title:"La musique congolaise", em:"mérite son envol." },
  en: { eyebrow:"The platform that pays Congolese musicians directly", title:"Congolese music", em:"deserves its moment." },
};
function applyLanguage(code){
  currentLanguage = code;
  try{ localStorage.setItem(NUNI_LANG_KEY, code); }catch(e){ /* pas bloquant */ }
  const t = homeTranslations[code];
  const eyebrow = document.querySelector('.home-eyebrow');
  const titleEm = document.querySelector('.home-title em');
  const titleText = document.querySelector('.home-title');
  if(eyebrow) eyebrow.textContent = t.eyebrow;
  if(titleText && titleEm){
    titleText.childNodes[0].textContent = t.title + ' ';
    titleEm.textContent = t.em;
  }
}
if(currentLanguage !== 'fr') applyLanguage(currentLanguage); // ré-applique la vraie langue mémorisée dès le chargement

function openProfileInfo(type){
  const icon = document.getElementById('profile-info-icon');
  const title = document.getElementById('profile-info-title');
  const body = document.getElementById('profile-info-body');
  body.innerHTML = '';

  if(type === 'playlists'){
 icon.innerHTML = '<svg class="nuni-ic filled" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>'; title.textContent = 'Mes playlists';
    if(!favoritesPlaylist.length){
      body.innerHTML = `<div class="pi-empty">Aucune playlist pour l'instant.<br>Appuyez sur <svg class="nuni-ic filled nuni-ic-err" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg> sur un titre pour créer votre playlist <b>Favoris</b>.</div>`;
    } else {
      const list = document.createElement('div'); list.className = 'pi-list';
      list.innerHTML = `<div style="font-size:11.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Favoris — ${favoritesPlaylist.length} titre(s)</div>`;
      favoritesPlaylist.forEach(tr=>{
        const item = document.createElement('div'); item.className = 'pi-item';
        const covStyle = tr.cover ? `background-image:url(${tr.cover})` : '';
        item.innerHTML = `<div class="cov ${tr.cover?'':tr.p}" style="${covStyle}"></div><div><div class="t">${esc(tr.t)}</div><div class="s">${esc(tr.a)}</div></div>`;
        item.onclick = ()=>{ playTrack(tr); closeProfileInfo(); };
        list.appendChild(item);
      });
      body.appendChild(list);
    }
  }

  else if(type === 'history'){
 icon.innerHTML = '<svg class="nuni-ic filled" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2" stroke="var(--bg)" stroke-width="1.5"/></svg>'; title.textContent = 'Historique';
    const cutoff = Date.now() - 30*60*1000;
    const recent = listeningHistory.filter(h => h.at >= cutoff);
    if(!recent.length){
      body.innerHTML = `<div class="pi-empty">Rien écouté dans les 30 dernières minutes.<br>Lancez un titre pour qu'il apparaisse ici.</div>`;
    } else {
      const list = document.createElement('div'); list.className = 'pi-list';
      list.innerHTML = `<div style="font-size:11.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Dans les 30 dernières minutes</div>`;
      recent.forEach(h=>{
        const tr = h.track;
        const mins = Math.max(0, Math.round((Date.now()-h.at)/60000));
        const item = document.createElement('div'); item.className = 'pi-item';
        const covStyle = tr.cover ? `background-image:url(${tr.cover})` : '';
        item.innerHTML = `<div class="cov ${tr.cover?'':tr.p}" style="${covStyle}"></div><div><div class="t">${esc(tr.t)}</div><div class="s">${esc(tr.a)} · il y a ${mins==0?'moins d\'1 min':mins+' min'}</div></div>`;
        item.onclick = ()=>{ playTrack(tr); closeProfileInfo(); };
        list.appendChild(item);
      });
      body.appendChild(list);
    }
  }

  else if(type === 'subscription'){
 icon.innerHTML = '<svg class="nuni-ic filled" viewBox="0 0 24 24"><rect x="2.5" y="5.5" width="19" height="13" rx="2"/></svg>'; title.textContent = 'Mon abonnement';
    if(!currentUser){
      body.innerHTML = `<div class="pi-empty">Connectez-vous pour voir votre abonnement.</div>`;
    } else {
      const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'}) : '—';
      const isActive = currentUser.subscription_status === 'active';
      const expiryDate = currentUser.subscription_expires_at ? new Date(currentUser.subscription_expires_at) : null;
      const daysLeft = expiryDate ? Math.max(0, Math.ceil((expiryDate - new Date()) / 86400000)) : null;
      const planLabel = currentUser.account_type === 'artist' ? 'Pass Artiste' : 'Pass Auditeur';
      const statusLabel = isActive ? '● Actif' : (currentUser.subscription_status === 'expired' ? '● Expiré' : '● Inactif');
      body.innerHTML = `
        <div class="pi-sub-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <b>${planLabel}</b><span class="pi-status-badge">${statusLabel}</span>
          </div>
          <div class="pi-sub-row"><span>Membre depuis</span><b>${fmtDate(currentUser.created_at)}</b></div>
          <div class="pi-sub-row"><span>${isActive ? 'Expiration' : 'Dernière expiration'}</span><b>${fmtDate(currentUser.subscription_expires_at)}</b></div>
          ${daysLeft !== null && isActive ? `<div class="pi-sub-row"><span>Jours restants</span><b>${daysLeft} jours</b></div>` : ''}
        </div>
        <button class="btn btn-primary" style="width:100%; margin-top:16px;" onclick="closeProfileInfo(); goTo('plans');">Renouveler / changer de Pass</button>`;
    }
  }

  else if(type === 'payments'){
 icon.innerHTML = '<svg class="nuni-ic filled" viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9z"/></svg>'; title.textContent = 'Paiements';
    body.innerHTML = `
      <div class="pi-sub-card" style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <b><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.6" y="14" width="4.4" height="6" rx="2"/><rect x="17" y="14" width="4.4" height="6" rx="2"/></svg> Pass Auditeur</b>
        </div>
        <div class="pi-sub-row"><span>Mensuel</span><b>750 FCFA</b></div>
        <div class="pi-sub-row"><span>Trimestriel</span><b>650 FCFA</b></div>
        <div class="pi-sub-row"><span>Annuel</span><b>1 250 FCFA</b></div>
      </div>
      <div class="pi-sub-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <b><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.5M9 21h6"/></svg> Pass Artiste</b>
        </div>
        <div class="pi-sub-row"><span>Trimestriel</span><b>5 000 FCFA</b></div>
        <div class="pi-sub-row"><span>Annuel</span><b>10 000 FCFA</b></div>
      </div>
      <button class="btn btn-primary" style="width:100%; margin-top:16px;" onclick="closeProfileInfo(); goTo('plans');">Voir les Pass</button>`;
  }

  else if(type === 'promo'){
 icon.innerHTML = '<svg class="nuni-ic filled" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M3 12h18" stroke="var(--bg)" stroke-width="1.5"/></svg>'; title.textContent = 'Codes promo';
    body.innerHTML = `<p style="font-size:12.5px; color:var(--text-faint);">Chargement…</p>`;
    // Codes personnels d'abord (attribués manuellement par NUNI, en récompense) — puis le
    // code général si un est actif. Les deux peuvent coexister, ou aucun des deux.
    Promise.all([
      realAuthToken ? fetch(NUNI_API_BASE + '/api/me/promo-codes', { headers:{ 'Authorization':'Bearer ' + realAuthToken } }).then(r=> r.ok ? r.json() : {codes:[]}).catch(()=>({codes:[]})) : Promise.resolve({codes:[]}),
      fetch(NUNI_API_BASE + '/api/promo/NUNI30/status').then(r=> r.ok ? r.json() : null).catch(()=>null),
    ]).then(([personal, general])=>{
      const myCodes = personal.codes || [];
      let html = '';
      if(myCodes.length){
        html += `<div style="font-size:11.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Rien que pour vous</div>`;
        myCodes.forEach(c=>{
          html += `<div class="pi-promo-counter" style="margin-bottom:10px;">
            <div class="n" style="letter-spacing:2px;">${c.code}</div>
            <div class="l">-${c.discount_pct}% sur votre prochain Pass${c.note ? ' — ' + esc(c.note) : ''}</div>
          </div>`;
        });
        html += `<button class="btn btn-primary" style="width:100%; margin-bottom:18px;" onclick="closeProfileInfo(); goTo('plans');">Utiliser mon code</button>`;
      }
      if(general){
        const remaining = Math.max(0, general.max_uses - general.used_count);
        html += `
          <div class="pi-promo-counter">
            <div class="n">${general.used_count} / ${general.max_uses}</div>
            <div class="l">codes déjà attribués aux ${general.max_uses} premiers inscrits</div>
          </div>
          <p style="font-size:12.5px; color:var(--text-dim); line-height:1.6; margin-bottom:14px;">Le code <b style="color:var(--accent)">${general.code}</b> offre <b>-${general.discount_pct}%</b> et n'est réservé qu'aux <b>${general.max_uses} premiers utilisateurs</b> connectés sur la plateforme.${remaining > 0 ? ` Il reste <b style="color:var(--accent)">${remaining} places</b>.` : ' Il n\'y a plus de places disponibles.'}</p>
          <button class="btn btn-ghost" style="width:100%;" onclick="closeProfileInfo(); goTo('plans');">Utiliser ce code sur un Pass</button>`;
      }
      if(!myCodes.length && !general){
        html = `<div class="pi-empty">Aucun code promo actif pour le moment — revenez bientôt !</div>`;
      }
      body.innerHTML = html;
    });
  }

  else if(type === 'language'){
 icon.innerHTML = '<svg class="nuni-ic filled" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>'; title.textContent = 'Langue';
    const wrap = document.createElement('div'); wrap.className = 'pi-lang-row';
    languages.forEach(l=>{
      const opt = document.createElement('div');
      opt.className = 'pi-lang-opt' + (l.code===currentLanguage ? ' is-active' : '');
      opt.innerHTML = `<div><div class="name">${l.name}</div><div class="native">${l.native}</div></div>${l.code===currentLanguage ? '<svg class="nuni-ic nuni-ic-ok" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>' : ''}`;
      opt.onclick = ()=>{
        applyLanguage(l.code);
        toast(`Langue changée : ${l.name}`);
        openProfileInfo('language');
      };
      wrap.appendChild(opt);
    });
    body.appendChild(wrap);
    const note = document.createElement('p');
    note.style.cssText = 'font-size:11.5px; color:var(--text-faint); margin-top:14px; line-height:1.5;';
    note.textContent = "La traduction complète de l'application arrive progressivement — l'accueil est déjà disponible dans ces 2 langues.";
    body.appendChild(note);
  }

  else if(type === 'contact'){
 icon.innerHTML = '<svg class="nuni-ic filled" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/></svg>'; title.textContent = 'Nous contacter';
    body.innerHTML = `
      <a class="pi-contact-row" href="mailto:nunimisiki@gmail.com"><span class="ic"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/></svg></span><div><div class="t">nunimisiki@gmail.com</div><div class="s">Réponse sous 48h</div></div></a>
      <a class="pi-contact-row" href="https://wa.me/242068951600" onclick="event.preventDefault(); openWhatsApp('https://wa.me/242068951600');"><span class="ic"><svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/></svg></span><div><div class="t">+242 06 895 16 00</div><div class="s">WhatsApp — service client</div></div></a>
 <a class="pi-contact-row" href="#" onclick="event.preventDefault(); toast('Instagram NUNI — bientôt en ligne.')"><span class="ic"> </span><div><div class="t">Instagram</div><div class="s">@nunimusic</div></div></a>
 <a class="pi-contact-row" href="#" onclick="event.preventDefault(); toast('Facebook NUNI — bientôt en ligne.')"><span class="ic"> </span><div><div class="t">Facebook</div><div class="s">NUNI Music</div></div></a>
 <a class="pi-contact-row" href="#" onclick="event.preventDefault(); toast('TikTok NUNI — bientôt en ligne.')"><span class="ic"> </span><div><div class="t">TikTok</div><div class="s">@nunimusic</div></div></a>`;
  }

  else if(type === 'downloads'){
    icon.innerHTML = '<svg class="nuni-ic filled" viewBox="0 0 24 24"><path d="M12 3v13m0 0 5-5m-5 5-5-5"/><path d="M4 19h16" stroke-linecap="round"/></svg>'; title.textContent = 'Téléchargements';
    const downloads = getDownloadHistory();
    if(!downloads.length){
      body.innerHTML = `<div class="pi-empty">Aucun téléchargement pour l'instant sur cet appareil.<br>Téléchargez un morceau depuis le lecteur pour qu'il apparaisse ici.</div>`;
    } else {
      const list = document.createElement('div'); list.className = 'pi-list';
      list.innerHTML = `<div style="font-size:11.5px; color:var(--text-faint); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Sur cet appareil — ${downloads.length} téléchargement(s)</div>`;
      downloads.forEach(d=>{
        const daysAgo = Math.floor((Date.now()-d.at)/86400000);
        const when = daysAgo === 0 ? "aujourd'hui" : daysAgo === 1 ? 'hier' : `il y a ${daysAgo} jours`;
        const item = document.createElement('div'); item.className = 'pi-item';
        const covStyle = d.cover ? `background-image:url(${d.cover})` : '';
        item.innerHTML = `<div class="cov" style="${covStyle}"></div><div><div class="t">${d.t}</div><div class="s">${d.a} · ${when}</div></div>`;
        list.appendChild(item);
      });
      body.appendChild(list);
    }
  }

  document.getElementById('profile-info-overlay').classList.add('show');
}
function closeProfileInfo(){
  document.getElementById('profile-info-overlay').classList.remove('show');
}

/* ============ NOTIFICATIONS — vraies données ============
   Avant : 3 notifications codées en dur, identiques pour tout le monde, badge toujours
   à "3". Ici : vraie liste chargée depuis /api/notifications, vrai badge non-lu, marquées
   lues à l'ouverture du panneau. */
function timeAgoFr(dateStr){
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if(mins < 1) return "à l'instant";
  if(mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if(hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}
const notifIcons = { follower:'<svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>', new_release:'<svg class="nuni-ic filled nuni-ic-gold" viewBox="0 0 24 24"><circle cx="7.5" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/><path d="M10 18V5l9.5-2v13"/></svg>', follower_milestone:'<svg class="nuni-ic filled nuni-ic-gold" viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4"/><path d="M12 13v3M9 20h6M10 20v-2.5h4V20"/></svg>', absence_reminder:'<svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/></svg>', opportunites_reminder:'<svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M3 10v4a1 1 0 0 0 1 1h2.5l5 3.5v-13L6.5 9H4a1 1 0 0 0-1 1z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19.5 6a9 9 0 0 1 0 12"/></svg>' };
async function loadNotifications(){
  if(!realAuthToken) return;
  if(!navigator.onLine) return; // pas de réseau du tout : inutile de tenter, on réessaiera au prochain cycle
  try{
    const res = await fetch(NUNI_API_BASE + '/api/notifications', { headers:{ 'Authorization':'Bearer '+realAuthToken } });
    if(!res.ok) return;
    const data = await res.json();
    const panel = document.getElementById('notif-panel');
    const head = panel.querySelector('.notif-head');
    panel.querySelectorAll('.notif-item').forEach(el=>el.remove());
    if(!data.notifications.length){
      panel.insertAdjacentHTML('beforeend', `<div class="notif-item"><div><p style="margin:0;">Aucune notification pour l'instant.</p></div></div>`);
    } else {
      data.notifications.forEach(n=>{
        head.insertAdjacentHTML('afterend', `<div class="notif-item" data-link="${n.link||''}" style="${n.link ? 'cursor:pointer;' : ''}"><span class="ic">${notifIcons[n.type]||'<svg class="nuni-ic nuni-ic-gold" viewBox="0 0 24 24"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>'}</span><div><b>${esc(n.title)}</b><p>${esc(n.body)} · ${timeAgoFr(n.created_at)}</p></div></div>`);
      });
      // Avant : le lien enregistré avec chaque notification (n.link) n'était jamais
      // utilisé — cliquer dessus ne faisait littéralement rien. Maintenant, un clic amène
      // vraiment à la bonne section (utile pour le rappel Opportunités notamment).
      panel.querySelectorAll('.notif-item[data-link]').forEach(el=>{
        const link = el.dataset.link;
        if(!link) return;
        el.onclick = ()=>{
          document.getElementById('notif-panel').classList.remove('open');
          if(link.includes('opportunites')) enterApp('ads');
          else if(link.startsWith('/')) enterApp(link.slice(1));
        };
      });
    }
  }catch(e){ console.error('Impossible de charger les notifications :', e); }

  try{
    const res2 = await fetch(NUNI_API_BASE + '/api/notifications/unread-count', { headers:{ 'Authorization':'Bearer '+realAuthToken } });
    if(res2.ok){
      const { count } = await res2.json();
      const dot = document.getElementById('notif-dot');
      if(count > 0){ dot.textContent = count > 9 ? '9+' : String(count); dot.style.display = ''; }
      else { dot.style.display = 'none'; }
    }
  }catch(e){ /* pas grave, le badge reste tel quel */ }
}

function toggleNotifPanel(){
  const panel = document.getElementById('notif-panel');
  panel.classList.toggle('open');
  if(panel.classList.contains('open')){
    document.getElementById('notif-dot').style.display = 'none';
    if(realAuthToken){
      fetch(NUNI_API_BASE + '/api/notifications/mark-read', { method:'POST', headers:{ 'Authorization':'Bearer '+realAuthToken } }).catch(()=>{});
    }
  }
}
document.addEventListener('click', (e)=>{
  const wrap = document.querySelector('.notif-wrap');
  if(wrap && !wrap.contains(e.target)) document.getElementById('notif-panel').classList.remove('open');
});

/* ============ FULL-SCREEN PLAYER INIT ============ */
syncFullPlayer();

/* ============ PWA — enregistrement du service worker ============ */
if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

/* ============ NOTIFICATIONS PUSH RÉELLES (Web Push) ============
   Fonctionne sur Android Chrome directement, et sur iPhone à partir d'iOS 16.4 — mais
   Apple impose que le site soit d'abord "ajouté à l'écran d'accueil" (installé en PWA) : un
   simple onglet Safari ne peut pas recevoir de vraies notifications push, c'est une
   restriction du système, pas de NUNI. On le précise honnêtement si la demande échoue pour
   cette raison plutôt que de laisser croire à un bug. */
function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
async function updatePushToggleLabel(){
  const label = document.getElementById('push-toggle-label');
  if(!label) return;
  if(!('serviceWorker' in navigator) || !('PushManager' in window)){
    label.textContent = 'Notifications push non supportées sur ce navigateur';
    return;
  }
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    label.textContent = sub ? 'Désactiver les notifications push' : 'Activer les notifications push';
  }catch(e){ /* pas grave, le libellé par défaut reste affiché */ }
}
async function togglePushNotifications(){
  if(!realAuthToken){ toast('Connectez-vous pour activer les notifications push.'); return; }
  if(!('serviceWorker' in navigator) || !('PushManager' in window)){
    toast('Notifications push non supportées sur ce navigateur.');
    return;
  }
  try{
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if(existing){
      await fetch(NUNI_API_BASE + '/api/push/unsubscribe', {
        method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+realAuthToken},
        body: JSON.stringify({ endpoint: existing.endpoint })
      });
      await existing.unsubscribe();
      toast('Notifications push désactivées.');
      updatePushToggleLabel();
      return;
    }
    const permission = await Notification.requestPermission();
    if(permission !== 'granted'){
      toast(permission === 'denied'
        ? "Notifications bloquées — autorisez-les dans les réglages du navigateur pour NUNI."
        : "Notifications non activées.");
      return;
    }
    const keyRes = await fetch(NUNI_API_BASE + '/api/push/public-key');
    const { publicKey } = await keyRes.json();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const subJson = sub.toJSON();
    await fetch(NUNI_API_BASE + '/api/push/subscribe', {
      method:'POST', headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+realAuthToken},
      body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys })
    });
 toast(' Notifications push activées — vous recevrez les vraies alertes NUNI même app fermée.');
    updatePushToggleLabel();
  }catch(e){
    console.error(e);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast(isIOS
      ? "Sur iPhone, ajoutez d'abord NUNI à l'écran d'accueil (Partager → Sur l'écran d'accueil) avant d'activer les notifications push — c'est une exigence d'Apple."
      : "Impossible d'activer les notifications push pour l'instant.");
  }
}
if('serviceWorker' in navigator) navigator.serviceWorker.ready.then(updatePushToggleLabel).catch(()=>{});
