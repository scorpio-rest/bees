import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Heart, Play, RotateCcw, Zap, Shield, Skull, Info } from 'lucide-react';
import { audio } from '../utils/audio';

// --- 常數與類型定義 ---
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const PLAYER_SIZE = 40;
const ENEMY_SIZE = 30;
const BOSS_SIZE = 120;
const BULLET_SIZE = 4;

type PowerUpType = 'DOUBLE_SHOT' | 'SHIELD' | 'LIFE';

const PIXEL_DATA = {
  PLAYER: [[0,0,0,1,1,0,0,0],[0,0,1,1,1,1,0,0],[0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1],[1,1,0,1,1,0,1,1],[1,0,0,1,1,0,0,1],[1,0,0,1,1,0,0,1]],
  ENEMY_RED: [[0,0,1,0,0,1,0,0],[0,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1],[1,0,1,1,1,1,0,1],[1,1,1,1,1,1,1,1],[0,0,1,0,0,1,0,0],[0,1,0,1,1,0,1,0],[1,0,1,0,0,1,0,1]],
  ENEMY_PURPLE: [[0,1,1,0,0,1,1,0],[1,1,1,1,1,1,1,1],[1,0,1,1,1,1,0,1],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,0],[0,0,1,0,0,1,0,0],[0,1,1,0,0,1,1,0],[1,1,0,0,0,0,1,1]],
  BOSS: [[0,0,0,1,1,1,1,0,0,0],[0,0,1,1,1,1,1,1,0,0],[0,1,1,0,1,1,0,1,1,0],[1,1,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1,0,1],[1,1,1,0,0,0,0,1,1,1],[0,1,1,1,1,1,1,1,1,0],[0,0,1,0,1,1,0,1,0,0]]
};

interface Entity { x: number; y: number; width: number; height: number; }
interface Bullet extends Entity { active: boolean; fromPlayer: boolean; color: string; vx: number; vy: number; }
interface Enemy extends Entity { alive: boolean; type: 'RED' | 'PURPLE' | 'YELLOW' | 'BOSS'; hp: number; maxHp: number; originX: number; originY: number; isDiving: boolean; diveAngle: number; scoreValue: number; }
interface PowerUp extends Entity { type: PowerUpType; active: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }

const GalagaGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(Number(localStorage.getItem('galaga-highscore')) || 0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [activePowerUp, setActivePowerUp] = useState<PowerUpType | null>(null);
  const [shieldActive, setShieldActive] = useState(false);

  const playerRef = useRef({ x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, y: CANVAS_HEIGHT - 60 });
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const lastShotRef = useRef(0);
  const formationOffset = useRef(0);
  const formationDir = useRef(1);
  const starsRef = useRef<{x: number, y: number, size: number, speed: number}[]>([]);
  const screenShake = useRef(0);
  const bossActive = useRef(false);
  const requestRef = useRef<number>();

  useEffect(() => {
    starsRef.current = Array.from({ length: 80 }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: Math.random() * 2,
      speed: Math.random() * 3 + 1
    }));
    
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const initGame = () => {
    // 重設所有狀態
    playerRef.current = { x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, y: CANVAS_HEIGHT - 60 };
    bulletsRef.current = [];
    enemiesRef.current = [];
    powerUpsRef.current = [];
    particlesRef.current = [];
    setScore(0);
    setLives(3);
    setLevel(1);
    setActivePowerUp(null);
    setShieldActive(false);
    bossActive.current = false;
    formationOffset.current = 0;
    
    spawnEnemies(1);
    setGameState('PLAYING');
    audio.playBGM();
  };

  const spawnEnemies = (lvl: number) => {
    if (lvl % 5 === 0) {
      spawnBoss();
      return;
    }
    bossActive.current = false;
    const enemies: Enemy[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        let type: 'RED' | 'PURPLE' | 'YELLOW' = 'RED';
        if (r === 0) type = 'YELLOW';
        else if (r === 1) type = 'PURPLE';
        enemies.push({
          x: c * 45 + 70, y: r * 40 + 80, originX: c * 45 + 70, originY: r * 40 + 80,
          width: ENEMY_SIZE, height: ENEMY_SIZE, alive: true, type,
          hp: r === 0 ? 2 : 1, maxHp: r === 0 ? 2 : 1, isDiving: false, diveAngle: 0, scoreValue: (3-r)*100
        });
      }
    }
    enemiesRef.current = enemies;
  };

  const spawnBoss = () => {
    bossActive.current = true;
    audio.playBossSpawn();
    enemiesRef.current = [{
      x: CANVAS_WIDTH / 2 - BOSS_SIZE / 2, y: -150, originX: CANVAS_WIDTH / 2 - BOSS_SIZE / 2, originY: 100,
      width: BOSS_SIZE, height: BOSS_SIZE, alive: true, type: 'BOSS',
      hp: 20 + level * 5, maxHp: 20 + level * 5, isDiving: false, diveAngle: 0, scoreValue: 5000
    }];
  };

  const update = () => {
    if (gameState !== 'PLAYING') return;

    updatePlayer();
    updateEnemies();
    updateBullets();
    updatePowerUps();
    updateParticles();
    checkCollisions();

    if (enemiesRef.current.length > 0 && enemiesRef.current.every(e => !e.alive)) {
      setLevel(prev => {
        const nextLvl = prev + 1;
        spawnEnemies(nextLvl);
        return nextLvl;
      });
      audio.playPowerUp();
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    if (screenShake.current > 0) {
      ctx.translate((Math.random()-0.5)*screenShake.current, (Math.random()-0.5)*screenShake.current);
      screenShake.current *= 0.9;
    }

    updateBackground(ctx);
    drawPlayer(ctx);
    drawEnemies(ctx);
    drawBullets(ctx);
    drawPowerUps(ctx);
    drawParticles(ctx);
    ctx.restore();
  };

  const gameLoop = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (gameState === 'PLAYING') {
      update();
    }
    
    draw(ctx);
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  // 確保只有一個 loop 在跑
  useEffect(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);

  const updateBackground = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#000814';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#ffffff';
    starsRef.current.forEach(star => {
      star.y += star.speed;
      if (star.y > CANVAS_HEIGHT) star.y = 0;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });
  };

  const updatePlayer = () => {
    const speed = 6;
    if (keysRef.current.has('ArrowLeft') && playerRef.current.x > 0) playerRef.current.x -= speed;
    if (keysRef.current.has('ArrowRight') && playerRef.current.x < CANVAS_WIDTH - PLAYER_SIZE) playerRef.current.x += speed;

    const now = Date.now();
    if (keysRef.current.has('Space') && now - lastShotRef.current > (activePowerUp === 'DOUBLE_SHOT' ? 150 : 300)) {
      const bColor = '#00FFFF';
      if (activePowerUp === 'DOUBLE_SHOT') {
        bulletsRef.current.push(
          { x: playerRef.current.x + 5, y: playerRef.current.y, width: 4, height: 12, active: true, fromPlayer: true, color: bColor, vx: 0, vy: -10 },
          { x: playerRef.current.x + PLAYER_SIZE - 10, y: playerRef.current.y, width: 4, height: 12, active: true, fromPlayer: true, color: bColor, vx: 0, vy: -10 }
        );
      } else {
        bulletsRef.current.push({ x: playerRef.current.x + PLAYER_SIZE/2 - 2, y: playerRef.current.y, width: 4, height: 12, active: true, fromPlayer: true, color: bColor, vx: 0, vy: -10 });
      }
      audio.playShoot();
      lastShotRef.current = now;
    }
  };

  const updateEnemies = () => {
    formationOffset.current += 0.05 * formationDir.current;
    if (Math.abs(formationOffset.current) > 30) formationDir.current *= -1;

    enemiesRef.current.forEach(e => {
      if (!e.alive) return;
      if (e.type === 'BOSS') {
        if (e.y < e.originY) e.y += 2;
        e.x = e.originX + Math.sin(Date.now()/1000) * 100;
        if (Math.random() < 0.05) {
          const angle = (Math.random() * Math.PI) / 2 + Math.PI / 4;
          bulletsRef.current.push({ x: e.x + e.width/2, y: e.y + e.height - 20, width: 6, height: 6, active: true, fromPlayer: false, color: '#FF00FF', vx: Math.cos(angle) * 5, vy: Math.sin(angle) * 5 });
        }
      } else if (e.isDiving) {
        e.y += 5; e.x += Math.sin(e.diveAngle) * 4; e.diveAngle += 0.1;
        if (e.y > CANVAS_HEIGHT) { e.y = -50; e.isDiving = false; }
      } else {
        e.x = e.originX + Math.sin(formationOffset.current) * 20;
        if (e.type === 'PURPLE' && Math.random() < 0.001) { e.isDiving = true; e.diveAngle = 0; }
      }
      if (Math.random() < 0.002 + (level * 0.001) && e.type !== 'BOSS') {
        bulletsRef.current.push({ x: e.x + e.width/2, y: e.y + e.height, width: 4, height: 8, active: true, fromPlayer: false, color: '#FF0000', vx: 0, vy: 5 });
      }
    });
  };

  const updateBullets = () => {
    bulletsRef.current.forEach(b => { b.x += b.vx; b.y += b.vy; });
    bulletsRef.current = bulletsRef.current.filter(b => b.y > -50 && b.y < CANVAS_HEIGHT + 50 && b.x > -50 && b.x < CANVAS_WIDTH + 50 && b.active);
  };

  const updatePowerUps = () => {
    powerUpsRef.current.forEach(p => p.y += 3);
    powerUpsRef.current = powerUpsRef.current.filter(p => p.y < CANVAS_HEIGHT && p.active);
  };

  const updateParticles = () => {
    particlesRef.current.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.02; });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };

  const checkCollisions = () => {
    bulletsRef.current.filter(b => b.fromPlayer).forEach(bullet => {
      enemiesRef.current.filter(e => e.alive).forEach(enemy => {
        if (rectIntersect(bullet, enemy)) {
          bullet.active = false;
          enemy.hp--;
          screenShake.current = enemy.type === 'BOSS' ? 2 : 5;
          if (enemy.hp <= 0) {
            enemy.alive = false;
            createExplosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.type === 'BOSS' ? 30 : 10);
            audio.playExplosion();
            setScore(s => {
              const ns = s + enemy.scoreValue;
              if (ns > highScore) { setHighScore(ns); localStorage.setItem('galaga-highscore', ns.toString()); }
              return ns;
            });
            if (Math.random() < 0.2 || enemy.type === 'BOSS') spawnPowerUp(enemy.x + enemy.width/2, enemy.y);
          }
        }
      });
    });

    const playerBox = { ...playerRef.current, width: PLAYER_SIZE, height: PLAYER_SIZE };
    bulletsRef.current.filter(b => !b.fromPlayer).forEach(b => { if (rectIntersect(b, playerBox)) { b.active = false; handlePlayerHit(); } });
    enemiesRef.current.filter(e => e.alive).forEach(e => { if (rectIntersect(e, playerBox)) { handlePlayerHit(); } });
    powerUpsRef.current.filter(p => p.active).forEach(p => { if (rectIntersect(p, playerBox)) { p.active = false; applyPowerUp(p.type); } });
  };

  const rectIntersect = (a: any, b: any) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  const handlePlayerHit = () => {
    if (shieldActive) { setShieldActive(false); audio.playPowerUp(); return; }
    screenShake.current = 20;
    setLives(l => {
      if (l <= 1) { setGameState('GAMEOVER'); audio.playGameOver(); return 0; }
      audio.playExplosion();
      return l - 1;
    });
  };

  const createExplosion = (x: number, y: number, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x, y, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12, life: 1, color: `hsl(${Math.random()*60 + 10}, 100%, 50%)`
      });
    }
  };

  const spawnPowerUp = (x: number, y: number) => {
    const types: PowerUpType[] = ['DOUBLE_SHOT', 'SHIELD', 'LIFE'];
    const type = types[Math.floor(Math.random()*types.length)];
    powerUpsRef.current.push({ x, y, width: 20, height: 20, type, active: true });
  };

  const applyPowerUp = (type: PowerUpType) => {
    audio.playPowerUp();
    if (type === 'LIFE') setLives(l => Math.min(l + 1, 5));
    else if (type === 'SHIELD') setShieldActive(true);
    else { setActivePowerUp(type); setTimeout(() => setActivePowerUp(null), 8000); }
  };

  const drawPixelArt = (ctx: CanvasRenderingContext2D, data: number[][], x: number, y: number, size: number, color: string) => {
    const pSize = size / data[0].length;
    ctx.fillStyle = color;
    data.forEach((row, i) => {
      row.forEach((pixel, j) => {
        if (pixel) ctx.fillRect(x + j * pSize, y + i * pSize, pSize + 0.5, pSize + 0.5);
      });
    });
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const { x, y } = playerRef.current;
    drawPixelArt(ctx, PIXEL_DATA.PLAYER, x, y, PLAYER_SIZE, '#00D4FF');
    if (shieldActive) {
      ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.arc(x+PLAYER_SIZE/2, y+PLAYER_SIZE/2, PLAYER_SIZE*0.8, 0, Math.PI*2); ctx.stroke();
    }
  };

  const drawEnemies = (ctx: CanvasRenderingContext2D) => {
    enemiesRef.current.forEach(e => {
      if (!e.alive) return;
      let color = '#FF5252';
      let data = PIXEL_DATA.ENEMY_RED;
      if (e.type === 'PURPLE') { color = '#E040FB'; data = PIXEL_DATA.ENEMY_PURPLE; }
      if (e.type === 'YELLOW') color = '#FFEB3B';
      if (e.type === 'BOSS') { color = '#FF0055'; data = PIXEL_DATA.BOSS; }
      drawPixelArt(ctx, data, e.x, e.y, e.width, color);
      if (e.type === 'BOSS') {
        ctx.fillStyle = '#333'; ctx.fillRect(e.x, e.y - 20, e.width, 10);
        ctx.fillStyle = '#FF0055'; ctx.fillRect(e.x, e.y - 20, e.width * (e.hp/e.maxHp), 10);
      }
    });
  };

  const drawBullets = (ctx: CanvasRenderingContext2D) => {
    bulletsRef.current.forEach(b => {
      ctx.fillStyle = b.color; ctx.shadowBlur = 8; ctx.shadowColor = b.color;
      ctx.fillRect(b.x, b.y, b.width, b.height); ctx.shadowBlur = 0;
    });
  };

  const drawPowerUps = (ctx: CanvasRenderingContext2D) => {
    powerUpsRef.current.forEach(p => {
      ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(p.x+10, p.y+10, 10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = p.type === 'LIFE' ? '#F00' : p.type === 'SHIELD' ? '#00F' : '#FF0';
      ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillText(p.type === 'LIFE' ? 'H' : p.type === 'SHIELD' ? 'S' : 'W', p.x+10, p.y+14);
    });
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    particlesRef.current.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); });
    ctx.globalAlpha = 1.0;
  };

  return (
    <div className="flex flex-col items-center select-none scale-90 sm:scale-100">
      <div className="w-[480px] flex justify-between items-end mb-2 text-white font-mono px-2">
        <div><div className="text-gray-400 text-[10px] uppercase">High Score</div><div className="text-xl text-yellow-400">{highScore.toLocaleString()}</div></div>
        <div className="text-center">{bossActive.current ? <Skull className="text-red-500 animate-pulse" /> : <div className="text-blue-400 font-bold italic">LVL {level}</div>}</div>
        <div className="text-right"><div className="text-gray-400 text-[10px] uppercase">Score</div><div className="text-xl text-white">{score.toLocaleString()}</div></div>
      </div>

      <div className="relative rounded-lg overflow-hidden shadow-[0_0_50px_rgba(0,100,255,0.3)] border-4 border-gray-900 bg-black">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
        
        <div className="absolute bottom-4 left-4 flex gap-1">
          {[...Array(lives)].map((_, i) => <Heart key={i} size={16} className="text-red-500 fill-red-500 animate-pulse" />)}
        </div>

        <div className="absolute bottom-4 right-4 flex gap-2">
          {activePowerUp && <Zap size={20} className="text-yellow-400" />}
          {shieldActive && <Shield size={20} className="text-blue-400" />}
        </div>

        {gameState === 'START' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 px-8">
            <h1 className="text-7xl font-black text-white italic tracking-tighter mb-4">BEES</h1>
            
            <div className="w-full max-w-xs bg-gray-900/50 p-4 rounded-xl border border-gray-800 mb-8">
              <div className="flex items-center gap-2 mb-3 text-blue-400 text-sm font-bold"><Info size={16}/> 道具說明</div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-yellow-600 font-bold text-xs">W</div>
                  <div className="text-gray-300 text-xs"><span className="text-yellow-400 font-bold">雙倍火力</span>：提升射速並一次發射兩發子彈</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-blue-600 font-bold text-xs">S</div>
                  <div className="text-gray-300 text-xs"><span className="text-blue-400 font-bold">電漿護盾</span>：抵擋一次敵人的撞擊或子彈</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-red-600 font-bold text-xs">H</div>
                  <div className="text-gray-300 text-xs"><span className="text-red-400 font-bold">額外生命</span>：增加一架備用戰機</div>
                </div>
              </div>
            </div>

            <button onClick={initGame} className="group relative px-12 py-4 bg-white text-black font-black text-xl hover:bg-blue-500 hover:text-white transition-all transform hover:scale-110">
              START MISSION
            </button>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/95 backdrop-blur-md">
            <h2 className="text-6xl font-black text-white mb-2">CRASHED</h2>
            <div className="bg-black/50 p-6 rounded-lg border border-red-500/30 mb-12 text-center w-64">
              <p className="text-gray-400 text-xs uppercase tracking-widest">FINAL SCORE</p>
              <p className="text-4xl text-white font-mono">{score.toLocaleString()}</p>
            </div>
            <button onClick={initGame} className="px-10 py-4 bg-white text-red-600 rounded-full font-black hover:bg-red-500 hover:text-white transition-all">
              REDEPLOY
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GalagaGame;