class AudioManager {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createOscillator(freq: number, type: OscillatorType = 'square') {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    
    osc.type = type;
    osc.connect(gain);
    gain.connect(this.ctx!.destination);
    
    return { osc, gain };
  }

  playShoot() {
    const { osc, gain } = this.createOscillator(880, 'triangle');
    const now = this.ctx!.currentTime;
    
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.start();
    osc.stop(now + 0.1);
  }

  playExplosion() {
    const { osc, gain } = this.createOscillator(100, 'sawtooth');
    const now = this.ctx!.currentTime;
    
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    
    osc.start();
    osc.stop(now + 0.3);
  }

  playPowerUp() {
    const { osc, gain } = this.createOscillator(440, 'sine');
    const now = this.ctx!.currentTime;
    
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.2);
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc.start();
    osc.stop(now + 0.2);
  }

  playGameOver() {
    const { osc, gain } = this.createOscillator(220, 'square');
    const now = this.ctx!.currentTime;
    
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(55, now + 0.5);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
    
    osc.start();
    osc.stop(now + 0.5);
  }
}

export const audio = new AudioManager();
