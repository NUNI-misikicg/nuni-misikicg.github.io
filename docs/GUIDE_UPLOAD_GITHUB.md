# 📤 GUIDE D'UPLOAD — Déployer le nouveau index.html

## ⚡ RÉSUMÉ RAPIDE
1. Copier `/mnt/user-data/outputs/index.html`
2. Aller sur GitHub upload page
3. Glisser-déposer le fichier
4. Valider le commit
5. Attendre 2-3 min → LIVE! ✅

---

## 📋 INSTRUCTIONS DÉTAILLÉES

### **Étape 1: Préparation du fichier**
```
Fichier à uploader:
📁 /mnt/user-data/outputs/index.html
Taille: 30 KB
```

### **Étape 2: Accéder à GitHub**
1. Aller à: **https://github.com/NUNI-misikicg/nuni-misikicg.github.io**
2. Cliquer sur le bouton vert **"Code"** en haut à droite
3. Dans le menu, cliquer **"Add file"** → **"Upload files"**
4. Alternative rapide: Aller directement à
   ```
   https://github.com/NUNI-misikicg/nuni-misikicg.github.io/upload/main
   ```

### **Étape 3: Uploader le fichier**
1. Sur la page d'upload, voir la zone grise: **"Drag files here to add them to your repository"**
2. **Deux options:**
   
   **Option A (Drag & Drop — Recommandé)**
   - Ouvrir l'explorateur de fichiers sur votre ordinateur
   - Naviguer à `/mnt/user-data/outputs/`
   - Trouver `index.html`
   - Glisser-déposer sur la zone grise de GitHub
   - ✅ Le fichier apparaît dans la liste
   
   **Option B (Cliquer)**
   - Cliquer sur **"Or choose your files"** (lien bleu)
   - Naviguer à `/mnt/user-data/outputs/index.html`
   - Sélectionner et confirmer
   - ✅ Le fichier apparaît dans la liste

### **Étape 4: Confirmer le remplacement**
- GitHub demande: **"Confirmer le remplacement de index.html?"**
- Cliquer **"Yes"** (il faut remplacer l'ancien fichier)

### **Étape 5: Message de commit**
Dans le champ **"Commit message"**, écrire:
```
🎯 Fix: Complete website rebuild with signup/login/dashboard
- ✅ Formulaire d'inscription complet
- ✅ Formulaire de connexion
- ✅ Dashboard utilisateur
- ✅ Gestion des Pass (Gratuit/Consommateur/Artiste)
- ✅ Déblocage par code promo
- ✅ Footer avec contact (Email + WhatsApp)
- ✅ Design moderne & responsive
```

### **Étape 6: Description (optionnel)**
Dans le champ **"Extended description"** (optionnel):
```
Refonte complète du site NUNI avec tous les formulaires, modales,
et fonctionnalités de gestion des Pass. Intégration complète avec
le backend Railway. Site prêt pour les tests bêta.
```

### **Étape 7: Commit final**
- Sélectionner: **"Commit directly to the main branch"**
- Cliquer le bouton vert: **"Commit changes"**
- ✅ Attendre la validation (2-3 secondes)

### **Étape 8: Vérifier le déploiement**
1. GitHub affiche: **"Successfully deployed to github.pages"** (vert)
2. Attendre **2-3 minutes** pour la propagation DNS
3. Aller à: **https://nuni-misikicg.github.io/**
4. Rafraîchir (Ctrl+Shift+R pour forcer le cache)
5. ✅ Voir la nouvelle page d'accueil!

---

## ✅ CHECKLIST DE TEST POST-UPLOAD

### **Test 1: Page d'accueil**
- [ ] Logo NUNI apparaît en haut à gauche
- [ ] Titre "La musique congolaise mérite son envol" visible
- [ ] 3 cartes Pass affichées (Découverte, Consommateur, Artiste)
- [ ] Boutons "Créer un compte" & "Se connecter" visibles

### **Test 2: Inscription**
- [ ] Cliquer "Créer un compte"
- [ ] Modal d'inscription s'ouvre
- [ ] Remplir: Nom, Email, Mot de passe, Confirmation
- [ ] Cliquer "Créer mon compte"
- [ ] Message de succès apparaît
- [ ] Redirection vers choix Pass après 1.5s

### **Test 3: Choix Pass**
- [ ] Modal "Choisir votre Pass" s'ouvre
- [ ] Pass créé automatiquement: **Essayer NUNI (Gratuit - 24h)**
- [ ] Cliquer "Confirmer"
- [ ] Redirection vers Dashboard

### **Test 4: Dashboard**
- [ ] Accueil: **"Bienvenue, [Nom]!"**
- [ ] Pass actif affiché: **"free"**
- [ ] Section "Vos statistiques" visible (0 titres, 0h, 0 artistes)
- [ ] Boutons "Explorer le catalogue", "Ouvrir le tuner", "NUNI DJ"
- [ ] Section "Débloquer par code" visible
- [ ] Bouton "Déconnexion" en haut à droite

### **Test 5: Fonctionnalités**
- [ ] Taper un code promo (ex: NUNI15) dans le champ
- [ ] Cliquer "Appliquer"
- [ ] Message d'erreur ou de succès s'affiche
- [ ] Cliquer "Déconnexion"
- [ ] Redirection vers page d'accueil

### **Test 6: Reconnexion**
- [ ] Cliquer "Se connecter"
- [ ] Entrer email & mot de passe
- [ ] Cliquer "Se connecter"
- [ ] Redirection vers Dashboard immédiatement
- [ ] Profil mémorisé ✅

### **Test 7: Responsive (mobile)**
- [ ] Ouvrir sur téléphone: **https://nuni-misikicg.github.io/**
- [ ] Les cartes Pass s'empilent verticalement
- [ ] Boutons sont cliquables et lisibles
- [ ] Input fields sont accessibles
- [ ] Footer s'affiche correctement
- [ ] Contact (Email + WhatsApp) est cliquable

### **Test 8: Footer**
- [ ] Section "À PROPOS" visible
- [ ] Sections "LIENS" & "LÉGAL"
- [ ] Section "CONTACT":
  - [ ] Email: `nunimisiki@gmail.com` cliquable
  - [ ] WhatsApp: `+242 06 895 16 00` cliquable
- [ ] Copyright © 2026 NUNI visible

---

## 🔍 EN CAS DE PROBLÈME

### **Page blanche ou erreur 404**
1. Aller à: **https://github.com/NUNI-misikicg/nuni-misikicg.github.io/settings/pages**
2. Vérifier: **"Source" → "main" → "/" (root)**
3. Vérifier: **"Custom domain"** est VIDE (ne pas mettre de domaine)
4. Attendre 5 min et rafraîchir

### **Vieux design s'affiche encore**
1. Forcer le rechargement: **Ctrl+Shift+R** (Windows) ou **Cmd+Shift+R** (Mac)
2. Vider le cache du navigateur
3. Essayer en navigation privée (Ctrl+Shift+P)

### **Site lent ou qui bug**
1. Vérifier la console (F12 → Console)
2. Voir s'il y a des erreurs JavaScript
3. Vérifier que le backend est en ligne:
   - Aller à: **https://nuni-backend-production-cf8e.up.railway.app/api/health**
   - Doit retourner: `{"status":"ok"}`

### **Formulaire ne fonctionne pas**
1. Vérifier la connexion internet
2. Vérifier que le backend est accessible
3. F12 → Network → Voir les requêtes POST
4. Si erreur CORS, contacter Admin

---

## 📱 LIENS DE TEST

Après upload, tester sur:

**Desktop:**
- https://nuni-misikicg.github.io/
- https://nuni-misikicg.github.io/ (via Chrome)
- https://nuni-misikicg.github.io/ (via Firefox)
- https://nuni-misikicg.github.io/ (via Safari si Mac)

**Mobile:**
- https://nuni-misikicg.github.io/ (via téléphone Android)
- https://nuni-misikicg.github.io/ (via iPhone si disponible)

**Tablet:**
- https://nuni-misikicg.github.io/ (zoom sur tablette)

---

## 🎉 SUCCÈS!

Une fois tous les tests passés ✅, le site est **PRÊT À PARTAGER!**

Partager le lien:
```
https://nuni-misikicg.github.io/

Message d'invitation:
"🎵 Bienvenue sur NUNI!
Découvrez la plateforme musicale congolaise qui finance directement les artistes.
✨ Créez un compte en 30 secondes
✨ Essayez gratuitement pendant 24 heures
✨ Explorez le meilleur de la musique congolaise

https://nuni-misikicg.github.io/"
```

---

## 📞 SUPPORT

Si vous avez des questions ou des problèmes lors de l'upload:
- Email: `nunimisiki@gmail.com`
- WhatsApp: `+242 06 895 16 00`
- Consultez le `RESUME_COMPLET_NUNI.md` pour plus de détails

**Bon déploiement! 🚀**
