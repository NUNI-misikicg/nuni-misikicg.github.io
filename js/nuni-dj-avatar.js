/* ============================================================
   NUNI — Avatar DJ afro animé, réactif à l'audio en temps réel
   ------------------------------------------------------------
   - Analyse Web Audio (volume, bandes basse/médium/aigu, détection
     de battements) → pilote un SVG léger (pas de WebGL, pas de
     modèle 3D importé) via de simples transforms CSS/SVG.
   - Lip-sync approximatif basé sur l'énergie (pas de vraie
     reconnaissance phonétique — impossible en temps réel de façon
     fiable et légère), mouvements de tête pilotés par les
     battements détectés (BPM estimé en continu).
   - "Mode DJ" : expressions plus marquées (clignements, sourcils,
     sourire, halo des écouteurs qui pulse).
   - Aucune dépendance externe. ~10 Ko, tourne en requestAnimationFrame.
============================================================ */

(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  // ---------- Suiveur d'enveloppe simple (attaque rapide / relâché lent) ----------
  class Envelope {
    constructor(attack = 0.55, release = 0.08) {
      this.attack = attack;
      this.release = release;
      this.value = 0;
    }
    update(target) {
      const k = target > this.value ? this.attack : this.release;
      this.value += (target - this.value) * k;
      return this.value;
    }
  }

  // ---------- Ressort critique amorti (pour le rebond de tête au battement) ----------
  class Spring {
    constructor(stiffness = 90, damping = 12) {
      this.k = stiffness;
      this.d = damping;
      this.pos = 0;
      this.vel = 0;
    }
    impulse(v) { this.vel += v; }
    step(dt) {
      const acc = -this.k * this.pos - this.d * this.vel;
      this.vel += acc * dt;
      this.pos += this.vel * dt;
      return this.pos;
    }
  }

  class NuniDJAvatar {
    /**
     * @param {HTMLElement} container - élément qui recevra l'avatar SVG
     * @param {Object} opts
     *   djMode {boolean} - démarre en mode DJ expressif
     *   size {number} - taille en px (carré), défaut 220
     */
    constructor(container, opts = {}) {
      this.container = container;
      this.djMode = !!opts.djMode;
      this.size = opts.size || 220;

      this._buildDOM();
      this._buildAudioGraph();

      // États d'animation
      this.bounce = new Spring(70, 9);       // rebond vertical (nod)
      this.turn = new Spring(55, 10);        // rotation légère (pivot)
      this.mouthEnv = new Envelope(0.6, 0.18);
      this.bassEnv = new Envelope(0.5, 0.12);
      this.trebleEnv = new Envelope(0.6, 0.2);
      this.volEnv = new Envelope(0.5, 0.15);

      // Détection de battement
      this._energyHistory = [];
      this._lastBeatT = 0;
      this._beatIntervals = [];
      this.bpm = 0;

      // Clignement / sourcils (mode DJ)
      this._nextBlinkAt = 0;
      this._blinkUntil = 0;
      this._browPulseUntil = 0;
      this._transitionUntil = 0;

      this._lastT = performance.now();
      this._running = false;
      this._loop = this._loop.bind(this);
    }

    // ---------- Construction du SVG ----------
    _buildDOM() {
      const wrap = document.createElement('div');
      wrap.className = 'nuni-dj-avatar-stage';
      wrap.style.width = this.size + 'px';
      wrap.style.height = this.size + 'px';

      const svg = el('svg', {
        viewBox: '0 0 300 300',
        class: 'nuni-dj-avatar-svg',
      });

      // Halo derrière la tête, pulse avec la basse
      this.halo = el('circle', { cx: 150, cy: 150, r: 118, class: 'dja-halo' }, svg);

      const head = el('g', { class: 'dja-head' }, svg);
      this.headGroup = head;

      // Afro (silhouette simplifiée, texture via petits cercles)
      const hair = el('g', { class: 'dja-hair' }, head);
      el('path', {
        d: 'M75 120 C55 40 120 5 150 5 C180 5 245 40 225 120 C230 90 205 55 150 55 C95 55 70 90 75 120 Z',
        class: 'dja-hair-fill',
      }, hair);
      // petites boucles
      const puffs = [
        [88, 55, 16], [110, 30, 17], [140, 18, 18], [170, 20, 17],
        [198, 33, 16], [216, 60, 15], [70, 85, 13], [230, 88, 13],
      ];
      puffs.forEach(([cx, cy, r]) => el('circle', { cx, cy, r, class: 'dja-hair-puff' }, hair));

      // Visage
      el('ellipse', { cx: 150, cy: 168, rx: 78, ry: 88, class: 'dja-face' }, head);

      // Sourcils (translatables pour l'étonnement / le clin d'oeil)
      this.browL = el('path', { d: 'M96 128 Q116 118 138 126', class: 'dja-brow' }, head);
      this.browR = el('path', { d: 'M162 126 Q184 118 204 128', class: 'dja-brow' }, head);

      // Lunettes rondes dorées (cachent les yeux — cohérent avec le visuel de référence)
      const glasses = el('g', { class: 'dja-glasses' }, head);
      el('line', { x1: 130, y1: 150, x2: 170, y2: 150, class: 'dja-glasses-bridge' }, glasses);
      this.lensL = el('circle', { cx: 112, cy: 152, r: 30, class: 'dja-lens' }, glasses);
      this.lensR = el('circle', { cx: 188, cy: 152, r: 30, class: 'dja-lens' }, glasses);
      el('circle', { cx: 112, cy: 152, r: 30, class: 'dja-lens-ring' }, glasses);
      el('circle', { cx: 188, cy: 152, r: 30, class: 'dja-lens-ring' }, glasses);
      // reflet (sert aussi de "clin d'oeil" visuel au clignement)
      this.glintL = el('ellipse', { cx: 102, cy: 142, rx: 7, ry: 4, class: 'dja-glint' }, glasses);
      this.glintR = el('ellipse', { cx: 178, cy: 142, rx: 7, ry: 4, class: 'dja-glint' }, glasses);

      // Nez
      el('path', { d: 'M148 165 Q142 195 150 205 Q158 202 154 190', class: 'dja-nose' }, head);

      // Moustache + bouc
      el('path', { d: 'M110 218 Q150 232 190 218 Q150 226 110 218 Z', class: 'dja-mustache' }, head);
      el('path', { d: 'M132 244 Q150 268 168 244 Q150 256 132 244 Z', class: 'dja-goatee' }, head);

      // Bouche (cavité qui s'ouvre pour le lip-sync)
      const mouthGroup = el('g', { class: 'dja-mouth-group' }, head);
      el('path', { d: 'M124 226 Q150 220 176 226 Q150 238 124 226 Z', class: 'dja-lips' }, mouthGroup);
      this.mouthCavity = el('ellipse', { cx: 150, cy: 228, rx: 20, ry: 2, class: 'dja-mouth-cavity' }, mouthGroup);
      this.mouthGroup = mouthGroup;

      // Écouteurs (bande + oreillettes dorées/noires)
      const phones = el('g', { class: 'dja-headphones' }, head);
      el('path', { d: 'M62 150 Q150 20 238 150', class: 'dja-band-outer' }, phones);
      el('path', { d: 'M62 150 Q150 34 238 150', class: 'dja-band-inner' }, phones);
      this.cupL = el('g', { class: 'dja-cup' }, phones);
      el('ellipse', { cx: 56, cy: 168, rx: 26, ry: 46, class: 'dja-cup-ring' }, this.cupL);
      el('ellipse', { cx: 56, cy: 168, rx: 17, ry: 35, class: 'dja-cup-pad' }, this.cupL);
      this.cupR = el('g', { class: 'dja-cup' }, phones);
      el('ellipse', { cx: 244, cy: 168, rx: 26, ry: 46, class: 'dja-cup-ring' }, this.cupR);
      el('ellipse', { cx: 244, cy: 168, rx: 17, ry: 35, class: 'dja-cup-pad' }, this.cupR);

      wrap.appendChild(svg);
      this.container.appendChild(wrap);
      this.stage = wrap;
      this.svg = svg;

      if (this.djMode) wrap.classList.add('is-dj-mode');
    }

    // ---------- Graphe Web Audio ----------
    _buildAudioGraph() {
      this.ctx = null;
      this.analyser = null;
      this.freqData = null;
      this.timeData = null;
      this.sourceNode = null;
    }

    /**
     * Connecte l'avatar à une source audio.
     * @param {HTMLMediaElement|MediaStream} source - <audio>/<video> en cours de lecture, ou flux micro
     */
    connect(source) {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.35;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeData = new Uint8Array(this.analyser.fftSize);
      }
      if (this.sourceNode) {
        try { this.sourceNode.disconnect(); } catch (e) {}
      }
      if (source instanceof MediaStream) {
        this.sourceNode = this.ctx.createMediaStreamSource(source);
      } else {
        // Un même <audio>/<video> ne peut être capté qu'une seule fois par
        // createMediaElementSource : on réutilise l'instance si déjà créée.
        if (!source._njAvatarSourceNode) {
          source._njAvatarSourceNode = this.ctx.createMediaElementSource(source);
          source._njAvatarSourceNode.connect(this.ctx.destination);
        }
        this.sourceNode = source._njAvatarSourceNode;
      }
      this.sourceNode.connect(this.analyser);
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.start();
    }

    disconnect() {
      if (this.sourceNode) {
        try { this.sourceNode.disconnect(this.analyser); } catch (e) {}
      }
    }

    setDJMode(on) {
      this.djMode = !!on;
      this.stage.classList.toggle('is-dj-mode', this.djMode);
    }

    /** À appeler lors d'un changement de morceau / transition de playlist. */
    triggerTransition() {
      const now = performance.now();
      this._transitionUntil = now + 1400;
      this.turn.impulse(this.djMode ? 5.5 : 3);
      this._browPulseUntil = now + 700;
    }

    start() {
      if (this._running) return;
      this._running = true;
      this._lastT = performance.now();
      requestAnimationFrame(this._loop);
    }

    stop() {
      this._running = false;
    }

    destroy() {
      this.stop();
      this.disconnect();
      if (this.stage && this.stage.parentNode) this.stage.parentNode.removeChild(this.stage);
    }

    // ---------- Bandes de fréquences ----------
    _bandEnergy(loHz, hiHz) {
      if (!this.ctx) return 0;
      const nyquist = this.ctx.sampleRate / 2;
      const binHz = nyquist / this.freqData.length;
      const loBin = Math.max(0, Math.floor(loHz / binHz));
      const hiBin = Math.min(this.freqData.length - 1, Math.ceil(hiHz / binHz));
      let sum = 0, n = 0;
      for (let i = loBin; i <= hiBin; i++) { sum += this.freqData[i]; n++; }
      return n ? (sum / n) / 255 : 0;
    }

    _rmsVolume() {
      let sum = 0;
      for (let i = 0; i < this.timeData.length; i++) {
        const v = (this.timeData[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / this.timeData.length);
    }

    // ---------- Détection de battement + BPM ----------
    _detectBeat(bassEnergy, now) {
      const hist = this._energyHistory;
      hist.push(bassEnergy);
      if (hist.length > 43) hist.shift(); // ~ 0.7s à 60fps

      if (hist.length < 8) return false;
      const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
      const variance = hist.reduce((a, b) => a + (b - avg) * (b - avg), 0) / hist.length;
      const threshold = avg * 1.22 + variance * 1.5;

      const minInterval = 260; // ms → borne haute ~230 BPM
      if (bassEnergy > threshold && bassEnergy > 0.12 && now - this._lastBeatT > minInterval) {
        if (this._lastBeatT) {
          const interval = now - this._lastBeatT;
          this._beatIntervals.push(interval);
          if (this._beatIntervals.length > 8) this._beatIntervals.shift();
          const sorted = [...this._beatIntervals].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          const bpm = 60000 / median;
          if (bpm >= 55 && bpm <= 200) this.bpm = Math.round(bpm);
        }
        this._lastBeatT = now;
        return true;
      }
      return false;
    }

    // ---------- Boucle d'animation ----------
    _loop(t) {
      if (!this._running) return;
      const dt = Math.min(0.05, (t - this._lastT) / 1000);
      this._lastT = t;

      let bass = 0, mid = 0, treble = 0, vol = 0, beat = false;

      if (this.ctx && this.analyser) {
        this.analyser.getByteFrequencyData(this.freqData);
        this.analyser.getByteTimeDomainData(this.timeData);
        bass = this._bandEnergy(30, 160);
        mid = this._bandEnergy(160, 2200);
        treble = this._bandEnergy(2200, 9000);
        vol = this._rmsVolume();
        beat = this._detectBeat(bass, t);
      }

      const bassS = this.bassEnv.update(bass);
      const trebleS = this.trebleEnv.update(treble);
      const volS = this.volEnv.update(vol);
      const mouthTarget = Math.min(1, mid * 1.3 + volS * 0.9);
      const mouthS = this.mouthEnv.update(mouthTarget);

      if (beat) {
        const strength = 1 + bassS * 1.6;
        this.bounce.impulse(-(this.djMode ? 30 : 20) * strength);
        this.turn.impulse((Math.random() > 0.5 ? 1 : -1) * (this.djMode ? 9 : 6) * strength);
      }

      const bouncePos = this.bounce.step(dt);
      const turnPos = this.turn.step(dt);

      // Balancement idle doux quand il n'y a (presque) pas de signal
      const idlePhase = t / 1000;
      const idle = (this.ctx ? Math.max(0, 1 - vol * 8) : 1);
      const idleSway = Math.sin(idlePhase * 0.9) * 2.2 * idle;
      const idleBob = Math.sin(idlePhase * 0.9 + 1.2) * 1.6 * idle;

      // ---- Tête : nod + pivot + léger rebond vertical ----
      const nodDeg = bouncePos * 0.9 + idleBob;
      const turnDeg = turnPos * 0.6 + idleSway;
      const liftPx = -Math.abs(bouncePos) * 0.35;
      this.headGroup.setAttribute(
        'transform',
        `translate(150 168) rotate(${nodDeg.toFixed(2)}) skewX(${(turnDeg * 0.35).toFixed(2)}) translate(-150 -168) translate(0 ${liftPx.toFixed(2)})`
      );

      // ---- Bouche : ouverture pilotée par l'énergie (lip-sync approximatif) ----
      const openRy = 2 + mouthS * 20 + (this.djMode ? trebleS * 4 : 0);
      this.mouthCavity.setAttribute('ry', openRy.toFixed(1));
      this.mouthCavity.setAttribute('rx', (18 + mouthS * 6).toFixed(1));

      // ---- Halo : pulse avec la basse ----
      const haloScale = 1 + bassS * 0.10 + (this.djMode ? 0.03 : 0);
      const haloOpacity = 0.18 + bassS * 0.35;
      this.halo.setAttribute('transform', `translate(150 150) scale(${haloScale.toFixed(3)}) translate(-150 -150)`);
      this.halo.style.opacity = haloOpacity.toFixed(2);

      // ---- Écouteurs : léger pulse d'anneau doré avec les aigus ----
      const cupGlow = 0.4 + trebleS * 0.6;
      this.cupL.style.filter = `drop-shadow(0 0 ${(4 + trebleS * 10).toFixed(1)}px rgba(201,162,75,${cupGlow.toFixed(2)}))`;
      this.cupR.style.filter = this.cupL.style.filter;

      // ---- Sourcils : légère élévation avec les aigus, plus marquée en mode DJ ----
      const browPulse = t < this._browPulseUntil ? 1 : 0;
      const browLift = trebleS * (this.djMode ? 10 : 4) + browPulse * 8;
      this.browL.setAttribute('transform', `translate(0 ${(-browLift).toFixed(1)})`);
      this.browR.setAttribute('transform', `translate(0 ${(-browLift).toFixed(1)})`);

      // ---- Clignement (mode DJ uniquement, sinon trop statique car lunettes) ----
      if (this.djMode) {
        if (t > this._nextBlinkAt && t > this._blinkUntil) {
          this._blinkUntil = t + 140;
          this._nextBlinkAt = t + 2200 + Math.random() * 3200;
        }
        const blinking = t < this._blinkUntil ? 1 : 0;
        const glintScale = blinking ? 0.15 : 1;
        this.glintL.setAttribute('transform', `translate(102 142) scale(1 ${glintScale}) translate(-102 -142)`);
        this.glintR.setAttribute('transform', `translate(178 142) scale(1 ${glintScale}) translate(-178 -142)`);
      } else {
        this.glintL.removeAttribute('transform');
        this.glintR.removeAttribute('transform');
      }

      // ---- Transition de morceau : petit "sourire" flash ----
      if (t < this._transitionUntil) {
        this.mouthGroup.setAttribute('transform', 'translate(150 226) scale(1.06 1.0) translate(-150 -226)');
      } else {
        this.mouthGroup.removeAttribute('transform');
      }

      requestAnimationFrame(this._loop);
    }
  }

  global.NuniDJAvatar = NuniDJAvatar;
})(window);
