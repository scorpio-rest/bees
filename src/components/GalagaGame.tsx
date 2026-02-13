import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Heart, Play, RotateCcw, Zap, Shield, PlusCircle } from 'lucide-react';
import { audio } from '../utils/audio';

// --- 常數與類型定義 ---
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const PLAYER_SIZE = 40;
const ENEMY_SIZE = 30;
const BULLET_SIZE = 4;
const POWERUP_SIZE = 25;

type PowerUpType = 'DOUBLE_SHOT' | 'SHIELD' | 'LIFE';

interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Bullet extends Entity {
  active: boolean;
  fromPlayer: boolean;
}

interface Enemy extends Entity {
  alive: boolean;
  type: 'RED' | 'PURPLE' | 'YELLOW';
  hp: number;
  originX: number;
  originY: number;
  isDiving: boolean;
  diveAngle: number;
  scoreValue: number;
}

interface PowerUp extends Entity {
  type: PowerUpType;
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const GalagaGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(Number(localStorage.getItem('galaga-highscore')) || 0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [activePowerUp, setActivePowerUp] = useState<PowerUpType | null>(null);
  const [shieldActive, setShieldActive] = useState(false);

  // 遊戲物件 Refs
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

  // 初始化星空
  useEffect(() => {
    starsRef.current = Array.from({ length: 100 }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: Math.random() * 2,
      speed: Math.random() * 2 + 1
    }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const initGame = () => {
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
    spawnEnemies(1);
    setGameState('PLAYING');
  };

  const spawnEnemies = (lvl: number) => {
    const enemies: Enemy[] = [];
    const rows = 4;
    const cols = 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let type: 'RED' | 'PURPLE' | 'YELLOW' = 'RED';
        let hp = 1;
        let scoreValue = 100;
        
        if (r === 0) { type = 'YELLOW'; hp = 2; scoreValue = 400; }
        else if (r === 1) { type = 'PURPLE'; hp = 1; scoreValue = 200; }

        enemies.push({
          x: c * 45 + 70,
          y: r * 40 + 80,
          originX: c * 45 + 70,
          originY: r * 40 + 80,
          width: ENEMY_SIZE,
          height: ENEMY_SIZE,
          alive: true,
          type,
          hp,
          isDiving: false,
          diveAngle: 0,
          scoreValue
        });
      }
    }
    enemiesRef.current = enemies;
  };

  const createParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1,
        color
      });
    }
  };

  const gameLoop = () => {
    if (gameState !== 'PLAYING') return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // 震動效果
    ctx.save();
    if (screenShake.current > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake.current, (Math.random() - 0.5) * screenShake.current);
      screenShake.current -= 0.5;
    }

    updateBackground(ctx);
    updatePlayer();
    updateEnemies();
    updateBullets();
    updatePowerUps();
    updateParticles();
    
    checkCollisions();

    drawPlayer(ctx);
    drawEnemies(ctx);
    drawBullets(ctx);
    drawPowerUps(ctx);
    drawParticles(ctx);

    ctx.restore();

    if (enemiesRef.current.every(e => !e.alive)) {
      setLevel(prev => prev + 1);
      spawnEnemies(level + 1);
      audio.playPowerUp();
    }

    requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    if (gameState === 'PLAYING') {
      const frame = requestAnimationFrame(gameLoop);
      return () => cancelAnimationFrame(frame);
    }
  }, [gameState]);

  // --- 更新邏輯 ---

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
    const fireRate = activePowerUp === 'DOUBLE_SHOT' ? 150 : 300;
    
    if (keysRef.current.has('Space') && now - lastShotRef.current > fireRate) {
      if (activePowerUp === 'DOUBLE_SHOT') {
        bulletsRef.current.push(
          { x: playerRef.current.x + 5, y: playerRef.current.y, width: BULLET_SIZE, height: 12, active: true, fromPlayer: true },
          { x: playerRef.current.x + PLAYER_SIZE - 10, y: playerRef.current.y, width: BULLET_SIZE, height: 12, active: true, fromPlayer: true }
        );
      } else {
        bulletsRef.current.push({
          x: playerRef.current.x + PLAYER_SIZE / 2 - BULLET_SIZE / 2,
          y: playerRef.current.y, width: BULLET_SIZE, height: 12, active: true, fromPlayer: true
        });
      }
      audio.playShoot();
      lastShotRef.current = now;
    }
  };

  const updateEnemies = () => {
    formationOffset.current += 0.05 * formationDir.current;
    if (Math.abs(formationOffset.current) > 30) formationDir.current *= -1;

    enemiesRef.current.forEach(enemy => {
      if (!enemy.alive) return;

      if (enemy.isDiving) {
        // 俯衝邏輯
        enemy.y += 5;
        enemy.x += Math.sin(enemy.diveAngle) * 4;
        enemy.diveAngle += 0.1;
        if (enemy.y > CANVAS_HEIGHT) {
          enemy.y = -50;
          enemy.isDiving = false;
        }
      } else {
        enemy.x = enemy.originX + Math.sin(formationOffset.current) * 20;
        // 隨機俯衝
        if (enemy.type === 'PURPLE' && Math.random() < 0.001) {
          enemy.isDiving = true;
          enemy.diveAngle = 0;
        }
      }

      // 隨機射擊
      if (Math.random() < 0.002 + (level * 0.001)) {
        bulletsRef.current.push({
          x: enemy.x + enemy.width/2, y: enemy.y + enemy.height,
          width: BULLET_SIZE, height: 8, active: true, fromPlayer: false
        });
      }
    });
  };

  const updateBullets = () => {
    bulletsRef.current.forEach(b => {
      b.y += b.fromPlayer ? -8 : (4 + level * 0.5);
    });
    bulletsRef.current = bulletsRef.current.filter(b => b.y > -20 && b.y < CANVAS_HEIGHT + 20 && b.active);
  };

  const updatePowerUps = () => {
    powerUpsRef.current.forEach(p => p.y += 3);
    powerUpsRef.current = powerUpsRef.current.filter(p => p.y < CANVAS_HEIGHT && p.active);
  };

  const updateParticles = () => {
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };

  const checkCollisions = () => {
    // 玩家子彈擊中敵人
    bulletsRef.current.filter(b => b.fromPlayer).forEach(bullet => {
      enemiesRef.current.filter(e => e.alive).forEach(enemy => {
        if (rectIntersect(bullet, enemy)) {
          bullet.active = false;
          enemy.hp--;
          if (enemy.hp <= 0) {
            enemy.alive = false;
            createParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, getEnemyColor(enemy.type));
            audio.playExplosion();
            const newScore = score + enemy.scoreValue;
            setScore(newScore);
            if (newScore > highScore) {
              setHighScore(newScore);
              localStorage.setItem('galaga-highscore', newScore.toString());
            }
            // 掉落道具
            if (Math.random() < 0.1) spawnPowerUp(enemy.x, enemy.y);
          }
        }
      });
    });

    // 敵人或子彈擊中玩家
    const playerBox = { ...playerRef.current, width: PLAYER_SIZE, height: PLAYER_SIZE };
    
    bulletsRef.current.filter(b => !b.fromPlayer).forEach(bullet => {
      if (rectIntersect(bullet, playerBox)) {
        bullet.active = false;
        handlePlayerHit();
      }
    });

    enemiesRef.current.filter(e => e.alive).forEach(enemy => {
      if (rectIntersect(enemy, playerBox)) {
        enemy.alive = false;
        handlePlayerHit();
      }
    });

    // 道具收集
    powerUpsRef.current.filter(p => p.active).forEach(p => {
      if (rectIntersect(p, playerBox)) {
        p.active = false;
        applyPowerUp(p.type);
      }
    });
  };

  const rectIntersect = (a: Entity, b: Entity) => (
    a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y
  );

  const handlePlayerHit = () => {
    if (shieldActive) {
      setShieldActive(false);
      audio.playPowerUp();
      return;
    }
    screenShake.current = 15;
    setLives(l => {
      if (l <= 1) {
        setGameState('GAMEOVER');
        audio.playGameOver();
        return 0;
      }
      audio.playExplosion();
      return l - 1;
    });
  };

  const spawnPowerUp = (x: number, y: number) => {
    const types: PowerUpType[] = ['DOUBLE_SHOT', 'SHIELD', 'LIFE'];
    const type = types[Math.floor(Math.random() * types.length)];
    powerUpsRef.current.push({ x, y, width: POWERUP_SIZE, height: POWERUP_SIZE, type, active: true });
  };

  const applyPowerUp = (type: PowerUpType) => {
    audio.playPowerUp();
    if (type === 'LIFE') setLives(l => Math.min(l + 1, 5));
    else if (type === 'SHIELD') setShieldActive(true);
    else {
      setActivePowerUp(type);
      setTimeout(() => setActivePowerUp(null), 8000);
    }
  };

  const getEnemyColor = (type: string) => {
    if (type === 'YELLOW') return '#FFEB3B';
    if (type === 'PURPLE') return '#E040FB';
    return '#FF5252';
  };

  // --- 繪製邏輯 ---

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    const { x, y } = playerRef.current;
    // 戰機主體
    ctx.fillStyle = '#00D4FF';
    ctx.beginPath();
    ctx.moveTo(x + PLAYER_SIZE/2, y);
    ctx.lineTo(x, y + PLAYER_SIZE);
    ctx.lineTo(x + PLAYER_SIZE, y + PLAYER_SIZE);
    ctx.closePath();
    ctx.fill();
    
    // 防護罩
    if (shieldActive) {
      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x + PLAYER_SIZE/2, y + PLAYER_SIZE/2, PLAYER_SIZE/1.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#00FFFF';
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  };

  const drawEnemies = (ctx: CanvasRenderingContext2D) => {
    enemiesRef.current.forEach(e => {
      if (!e.alive) return;
      ctx.fillStyle = getEnemyColor(e.type);
      if (e.isDiving) ctx.shadowBlur = 15, ctx.shadowColor = ctx.fillStyle;
      
      // 繪製更有層次的敵機
      ctx.fillRect(e.x, e.y, e.width, e.height);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(e.x + 5, e.y + 5, 5, 5);
      ctx.fillRect(e.x + e.width - 10, e.y + 5, 5, 5);
      
      ctx.shadowBlur = 0;
    });
  };

  const drawBullets = (ctx: CanvasRenderingContext2D) => {
    bulletsRef.current.forEach(b => {
      ctx.fillStyle = b.fromPlayer ? '#00FFFF' : '#FF0000';
      ctx.shadowBlur = 5;
      ctx.shadowColor = ctx.fillStyle;
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.shadowBlur = 0;
    });
  };

  const drawPowerUps = (ctx: CanvasRenderingContext2D) => {
    powerUpsRef.current.forEach(p => {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.x + p.width/2, p.y + p.height/2, p.width/2, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#FFD700';
      ctx.stroke();
    });
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1.0;
  };

  return (
    <div className="flex flex-col items-center select-none">
      {/* HUD */}
      <div className="w-[480px] flex justify-between items-end mb-2 text-white font-mono px-2">
        <div>
          <div className="text-gray-400 text-xs uppercase tracking-widest">High Score</div>
          <div className="text-2xl text-yellow-400">{highScore.toLocaleString().padStart(6, '0')}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 text-xs uppercase tracking-widest">Level</div>
          <div className="text-xl text-blue-400 font-bold">{level}</div>
        </div>
        <div className="text-right">
          <div className="text-gray-400 text-xs uppercase tracking-widest">Score</div>
          <div className="text-2xl text-white">{score.toLocaleString().padStart(6, '0')}</div>
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-gray-800 bg-black">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

        {/* 狀態列 */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          {[...Array(5)].map((_, i) => (
            <Heart key={i} className={`w-5 h-5 transition-all ${i < lives ? 'text-red-500 fill-red-500 scale-110' : 'text-gray-800 scale-90'}`} />
          ))}
        </div>

        {/* 道具指示器 */}
        <div className="absolute bottom-4 right-4 flex gap-3">
          {activePowerUp === 'DOUBLE_SHOT' && <Zap className="text-yellow-400 animate-pulse" />}
          {shieldActive && <Shield className="text-blue-400 animate-pulse" />}
        </div>

        {/* 遊戲覆蓋層 */}
        {gameState === 'START' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
            <div className="mb-4 flex gap-4">
              <div className="w-8 h-8 bg-[#FF5252] animate-bounce" />
              <div className="w-8 h-8 bg-[#E040FB] animate-bounce delay-75" />
              <div className="w-8 h-8 bg-[#FFEB3B] animate-bounce delay-150" />
            </div>
            <h1 className="text-6xl font-black text-white mb-2 italic tracking-tighter">BEES</h1>
            <p className="text-blue-500 font-bold tracking-[0.3em] mb-12">GALACTIC DEFENSE</p>
            <button onClick={initGame} className="px-12 py-4 bg-blue-600 text-white rounded-full font-black hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-500/50">
              LAUNCH MISSION
            </button>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md">
            <h2 className="text-6xl font-black text-white mb-4">MISSION FAILED</h2>
            <div className="text-center mb-12">
              <p className="text-red-400 uppercase tracking-widest text-sm mb-1">Final Score</p>
              <p className="text-4xl text-white font-mono">{score.toLocaleString()}</p>
            </div>
            <button onClick={initGame} className="flex items-center gap-3 px-10 py-4 bg-white text-red-600 rounded-full font-black hover:bg-gray-100 transition-all">
              <RotateCcw /> TRY AGAIN
            </button>
          </div>
        )}
      </div>

      {/* 操作提示 */}
      <div className="mt-6 grid grid-cols-3 gap-8 text-gray-500 font-mono text-[10px] uppercase tracking-tighter">
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-1"><div className="px-2 py-1 border border-gray-700 rounded">←</div><div className="px-2 py-1 border border-gray-700 rounded">→</div></div>
          MOVE SHIP
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="px-6 py-1 border border-gray-700 rounded text-center">SPACE</div>
          FIRE LASER
        </div>
        <div className="flex flex-col items-center gap-2 text-yellow-500/50">
          <div className="flex gap-2"><Zap size={14}/><Shield size={14}/><PlusCircle size={14}/></div>
          POWER UPS
        </div>
      </div>
    </div>
  );
};

export default GalagaGame;