import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Heart, Play, RotateCcw } from 'lucide-react';

// --- 常數定義 ---
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;
const PLAYER_SIZE = 40;
const ENEMY_SIZE = 30;
const BULLET_SIZE = 4;
const ENEMY_ROWS = 4;
const ENEMY_COLS = 8;

interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Bullet extends Entity {
  active: boolean;
}

interface Enemy extends Entity {
  alive: boolean;
  type: number; // 不同分數的敵人
}

const GalagaGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER'>('START');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);

  // 遊戲物件的 Refs (避免 React 頻繁重新渲染影響效能)
  const playerRef = useRef({ x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, y: CANVAS_HEIGHT - 60 });
  const bulletsRef = useRef<Bullet[]>([]);
  const enemyBulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const lastShotRef = useRef(0);
  const enemyMoveDir = useRef(1); // 1 為右, -1 為左
  const enemyStepDown = useRef(false);
  const starsRef = useRef<{x: number, y: number, size: number, speed: number}[]>([]);

  // 初始化星空
  useEffect(() => {
    const stars = Array.from({ length: 100 }, () => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      size: Math.random() * 2,
      speed: Math.random() * 2 + 1
    }));
    starsRef.current = stars;
  }, []);

  // 鍵盤監聽
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
    enemyBulletsRef.current = [];
    setScore(0);
    setLives(3);
    setLevel(1);
    spawnEnemies(1);
    setGameState('PLAYING');
  };

  const spawnEnemies = (lvl: number) => {
    const enemies: Enemy[] = [];
    for (let r = 0; r < ENEMY_ROWS; r++) {
      for (let c = 0; c < ENEMY_COLS; c++) {
        enemies.push({
          x: c * (ENEMY_SIZE + 15) + 50,
          y: r * (ENEMY_SIZE + 15) + 80,
          width: ENEMY_SIZE,
          height: ENEMY_SIZE,
          alive: true,
          type: 3 - r // 越高分的在越後面
        });
      }
    }
    enemiesRef.current = enemies;
    enemyMoveDir.current = 1;
  };

  const gameLoop = () => {
    if (gameState !== 'PLAYING') return;

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // 1. 更新背景
    updateBackground(ctx);

    // 2. 更新玩家
    updatePlayer();
    drawPlayer(ctx);

    // 3. 更新敵人
    updateEnemies();
    drawEnemies(ctx);

    // 4. 更新子彈
    updateBullets();
    drawBullets(ctx);

    // 5. 碰撞檢測
    checkCollisions();

    // 6. 檢查關卡完成
    if (enemiesRef.current.every(e => !e.alive)) {
      setLevel(prev => prev + 1);
      spawnEnemies(level + 1);
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
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const updatePlayer = () => {
    const speed = 5;
    if (keysRef.current.has('ArrowLeft') && playerRef.current.x > 0) {
      playerRef.current.x -= speed;
    }
    if (keysRef.current.has('ArrowRight') && playerRef.current.x < CANVAS_WIDTH - PLAYER_SIZE) {
      playerRef.current.x += speed;
    }
    
    // 射擊
    const now = Date.now();
    if (keysRef.current.has('Space') && now - lastShotRef.current > 300) {
      bulletsRef.current.push({
        x: playerRef.current.x + PLAYER_SIZE / 2 - BULLET_SIZE / 2,
        y: playerRef.current.y,
        width: BULLET_SIZE,
        height: 12,
        active: true
      });
      lastShotRef.current = now;
    }
  };

  const updateEnemies = () => {
    let shouldChangeDir = false;
    const speed = 1 + level * 0.2;

    enemiesRef.current.forEach(enemy => {
      if (!enemy.alive) return;
      enemy.x += speed * enemyMoveDir.current;
      if (enemy.x <= 10 || enemy.x >= CANVAS_WIDTH - ENEMY_SIZE - 10) {
        shouldChangeDir = true;
      }
    });

    if (shouldChangeDir) {
      enemyMoveDir.current *= -1;
      enemiesRef.current.forEach(enemy => {
        enemy.y += 10;
        if (enemy.y > playerRef.current.y && enemy.alive) {
          setGameState('GAMEOVER');
        }
      });
    }

    // 敵人隨機射擊
    if (Math.random() < 0.01 + (level * 0.005)) {
      const activeEnemies = enemiesRef.current.filter(e => e.alive);
      if (activeEnemies.length > 0) {
        const shooter = activeEnemies[Math.floor(Math.random() * activeEnemies.length)];
        enemyBulletsRef.current.push({
          x: shooter.x + ENEMY_SIZE / 2,
          y: shooter.y + ENEMY_SIZE,
          width: BULLET_SIZE,
          height: 8,
          active: true
        });
      }
    }
  };

  const updateBullets = () => {
    bulletsRef.current.forEach(b => b.y -= 7);
    bulletsRef.current = bulletsRef.current.filter(b => b.y > -20 && b.active);

    enemyBulletsRef.current.forEach(b => b.y += 4 + level * 0.5);
    enemyBulletsRef.current = enemyBulletsRef.current.filter(b => b.y < CANVAS_HEIGHT + 20 && b.active);
  };

  const checkCollisions = () => {
    // 玩家子彈打中敵人
    bulletsRef.current.forEach(bullet => {
      enemiesRef.current.forEach(enemy => {
        if (enemy.alive && 
            bullet.x < enemy.x + enemy.width &&
            bullet.x + bullet.width > enemy.x &&
            bullet.y < enemy.y + enemy.height &&
            bullet.y + bullet.height > enemy.y) {
          enemy.alive = false;
          bullet.active = false;
          setScore(s => s + (enemy.type * 100));
        }
      });
    });

    // 敵人子彈打中玩家
    enemyBulletsRef.current.forEach(bullet => {
      if (bullet.x < playerRef.current.x + PLAYER_SIZE &&
          bullet.x + bullet.width > playerRef.current.x &&
          bullet.y < playerRef.current.y + PLAYER_SIZE &&
          bullet.y + bullet.height > playerRef.current.y) {
        bullet.active = false;
        handlePlayerHit();
      }
    });
  };

  const handlePlayerHit = () => {
    setLives(l => {
      if (l <= 1) {
        setGameState('GAMEOVER');
        return 0;
      }
      return l - 1;
    });
  };

  // --- 繪製邏輯 ---

  const drawPlayer = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#00D4FF';
    // 簡單的戰機形狀
    ctx.beginPath();
    ctx.moveTo(playerRef.current.x + PLAYER_SIZE / 2, playerRef.current.y);
    ctx.lineTo(playerRef.current.x, playerRef.current.y + PLAYER_SIZE);
    ctx.lineTo(playerRef.current.x + PLAYER_SIZE, playerRef.current.y + PLAYER_SIZE);
    ctx.closePath();
    ctx.fill();
    // 引擎火焰感
    ctx.fillStyle = '#FF4D00';
    ctx.fillRect(playerRef.current.x + PLAYER_SIZE / 2 - 2, playerRef.current.y + PLAYER_SIZE, 4, 5);
  };

  const drawEnemies = (ctx: CanvasRenderingContext2D) => {
    enemiesRef.current.forEach(enemy => {
      if (!enemy.alive) return;
      const colors = ['#FF0055', '#FFCC00', '#00FF99'];
      ctx.fillStyle = colors[enemy.type % colors.length];
      
      // 敵人形狀
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(enemy.x + 5, enemy.y + 5, 5, 5);
      ctx.fillRect(enemy.x + enemy.width - 10, enemy.y + 5, 5, 5);
    });
  };

  const drawBullets = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#FFFF00';
    bulletsRef.current.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));
    
    ctx.fillStyle = '#FF0000';
    enemyBulletsRef.current.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));
  };

  return (
    <div className="flex flex-col items-center">
      {/* 頂部資訊欄 */}
      <div className="w-[480px] flex justify-between items-center mb-4 text-white font-mono bg-gray-900/50 p-3 rounded-lg border border-gray-700">
        <div className="flex items-center gap-2">
          <Trophy className="text-yellow-400 w-5 h-5" />
          <span className="text-xl">{score.toLocaleString().padStart(6, '0')}</span>
        </div>
        <div className="text-blue-400 font-bold">LEVEL {level}</div>
        <div className="flex items-center gap-1">
          {[...Array(3)].map((_, i) => (
            <Heart key={i} className={`w-5 h-5 ${i < lives ? 'text-red-500 fill-red-500' : 'text-gray-600'}`} />
          ))}
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-blue-500/20 border-4 border-gray-800">
        <canvas 
          ref={canvasRef} 
          width={CANVAS_WIDTH} 
          height={CANVAS_HEIGHT}
          className="bg-black"
        />

        {/* 覆蓋層：開始與結束 */}
        {gameState === 'START' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-blue-700 mb-8 tracking-tighter italic">
              GALAGA NEXT
            </h1>
            <button 
              onClick={initGame}
              className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-bold transition-all transform hover:scale-105"
            >
              <Play className="fill-white" />
              開始任務
            </button>
            <p className="mt-8 text-gray-400 text-sm animate-pulse">使用 方向鍵 移動，空白鍵 射擊</p>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-sm">
            <h2 className="text-5xl font-black text-red-500 mb-2">任務失敗</h2>
            <p className="text-gray-300 mb-8">最終得分: {score}</p>
            <button 
              onClick={initGame}
              className="flex items-center gap-2 bg-white text-red-600 px-8 py-4 rounded-full font-bold hover:bg-gray-100 transition-all transform hover:scale-105"
            >
              <RotateCcw />
              重新開始
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 text-gray-500 text-xs font-mono">
        &copy; 2026 GALAGA NEXT - POWERED BY GEMINI CLI
      </div>
    </div>
  );
};

export default GalagaGame;
