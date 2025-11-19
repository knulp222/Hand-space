
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';
import { GameSettings, PhysicsObject, HandPoint } from '../types';
import { ControlPanel } from './ControlPanel';

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [0, 9], [9, 10], [10, 11], [11, 12], // Middle
  [0, 13], [13, 14], [14, 15], [15, 16], // Ring
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13], [13, 17], [0, 17] // Palm
];

const INITIAL_SETTINGS: GameSettings = {
  gravity: 0, // Zero gravity for floating effect
  friction: 0.995, 
  bounce: 0.9, // Bouncy
  pinchThreshold: 60,
  throwForce: 1.5,
  handColor: '#00ff9d',
  showSkeleton: true,
  debug: false,
  enableCollisions: true,
  fusionChance: 0, // DISABLED BY DEFAULT to prevent blobs
  blobFactor: 5,
};

export const HandPhysicsGame: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(INITIAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(true);
  
  // Logic state
  const wasPinchingRef = useRef<boolean[]>([false, false]); 
  const lastShotTimeRef = useRef<number>(0);
  
  // Physics State
  const objectsRef = useRef<PhysicsObject[]>([]);
  const prevHandPosRef = useRef<{[key: number]: HandPoint}>({}); 
  const requestRef = useRef<number>();

  const spawnObjects = useCallback((count = 15, x?: number, y?: number, vx?: number, vy?: number, radius?: number, color?: string, grabbedBy?: number) => {
    const colors = ['#f43f5e', '#3b82f6', '#eab308', '#a855f7', '#ec4899', '#06b6d4', '#10b981', '#f97316'];
    const width = window.innerWidth;
    const height = window.innerHeight;
    const newObjects: PhysicsObject[] = [];

    // Safety counter to prevent infinite loops during spawn
    let totalAttempts = 0;
    const maxAttempts = count * 50;

    while (newObjects.length < count && totalAttempts < maxAttempts) {
      totalAttempts++;
      
      let finalX = x ?? 0;
      let finalY = y ?? 0;
      const finalRadius = radius ?? (20 + Math.random() * 25); // Smaller balls by default
      
      // Find safe spot
      if (x === undefined || y === undefined) {
          finalX = Math.random() * (width - 200) + 100;
          finalY = Math.random() * (height - 200) + 100;
          
          // Collision Check against existing world
          let safe = true;
          for (const obj of objectsRef.current) {
              const dist = Math.hypot(obj.x - finalX, obj.y - finalY);
              if (dist < obj.radius + finalRadius + 5) {
                  safe = false;
                  break;
              }
          }
          // Check against currently spawning batch
          if (safe) {
               for (const obj of newObjects) {
                  const dist = Math.hypot(obj.x - finalX, obj.y - finalY);
                  if (dist < obj.radius + finalRadius + 5) {
                      safe = false;
                      break;
                  }
              }
          }
          if (!safe) continue; // Retry this iteration
      }

      newObjects.push({
        id: Date.now() + Math.random(),
        x: finalX,
        y: finalY,
        vx: vx ?? (Math.random() - 0.5) * 6, // Little bit of initial movement
        vy: vy ?? (Math.random() - 0.5) * 6,
        radius: finalRadius,
        color: color ?? colors[Math.floor(Math.random() * colors.length)],
        isGrabbed: grabbedBy !== undefined,
        grabbedByHandIndex: grabbedBy ?? null,
        wobblePhase: Math.random() * Math.PI * 2,
        createdAt: performance.now(),
      });
    }
    objectsRef.current = [...objectsRef.current, ...newObjects];
  }, []);

  useEffect(() => {
    // Clear existing and spawn new set
    objectsRef.current = [];
    spawnObjects(12); 
  }, [spawnObjects]); 

  // Load MediaPipe Models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        const hl = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });

        const fl = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
             modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
             delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1
        });

        setHandLandmarker(hl);
        setFaceLandmarker(fl);
        setLoading(false);
      } catch (error) {
        console.error("Error loading landmarkers:", error);
      }
    };
    loadModels();
  }, []);

  // Camera Management
  const startCamera = useCallback(async () => {
    if (videoRef.current) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720, facingMode: "user" }
            });
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play();
            };
        } catch (e) {
            console.error("Camera access denied", e);
            setIsCameraActive(false);
        }
    }
  }, []);

  const stopCamera = useCallback(() => {
      if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
      }
  }, []);

  useEffect(() => {
    if (isCameraActive && handLandmarker && faceLandmarker) {
        startCamera();
    } else {
        stopCamera();
    }
  }, [isCameraActive, handLandmarker, faceLandmarker, startCamera, stopCamera]);

  // Helper: Check Gun Gesture
  const isGunGesture = (landmarks: any[]) => {
      // 0: Wrist
      // 4: Thumb Tip
      // 8: Index Tip
      // 12, 16, 20: Middle, Ring, Pinky Tips
      // 10, 14, 18: Middle, Ring, Pinky PIP (knuckles)

      // 1. Index should be extended (distance from wrist to tip > wrist to PIP)
      // Better check: Angle of index finger is straight
      
      // Simple heuristic:
      // Index Tip (8) far from wrist (0)
      // Middle Tip (12) close to Palm/Wrist (0)
      // Ring Tip (16) close to Palm/Wrist (0)
      // Pinky Tip (20) close to Palm/Wrist (0)
      
      const d = (i: number, j: number) => {
          const p1 = landmarks[i];
          const p2 = landmarks[j];
          return Math.hypot(p1.x - p2.x, p1.y - p2.y);
      };

      const wristToIndex = d(0, 8);
      const wristToMiddle = d(0, 12);
      const wristToRing = d(0, 16);
      const wristToPinky = d(0, 20);
      
      // Thumb should be somewhat extended (gun hammer)
      const wristToThumb = d(0, 4);

      // Conditions for Gun:
      // Index is the longest extension
      // Other fingers are curled (distance significantly shorter than index)
      const isIndexExtended = wristToIndex > 0.2; // Normalized coords
      const areOthersCurled = (wristToMiddle < wristToIndex * 0.6) && 
                              (wristToRing < wristToIndex * 0.6) && 
                              (wristToPinky < wristToIndex * 0.6);
      
      return isIndexExtended && areOthersCurled;
  };

  // Helper: Draw Blobby Circle
  const drawBlob = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, phase: number) => {
    ctx.beginPath();
    const points = 12;
    const time = performance.now() / 200;
    
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const wobble = settings.blobFactor > 0 
        ? Math.sin(angle * 3 + time + phase) * settings.blobFactor 
        : 0;
      const r = radius + wobble;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const gradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius + settings.blobFactor);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.3, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  // Main Loop
  const loop = useCallback(() => {
    if (!canvasRef.current || !videoRef.current || !handLandmarker || !faceLandmarker) {
      requestRef.current = requestAnimationFrame(loop);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        if (video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // AR Background
    if (isCameraActive) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        ctx.filter = 'brightness(0.5) contrast(1.2)';
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
        ctx.restore();
    } else {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.font = '20px sans-serif';
        ctx.fillText("Caméra désactivée", canvas.width / 2, canvas.height / 2);
    }

    const currentTime = performance.now();
    let handResult;
    let faceResult;
    
    if (isCameraActive && video.currentTime > 0) {
        try {
            handResult = handLandmarker.detectForVideo(video, currentTime);
            faceResult = faceLandmarker.detectForVideo(video, currentTime);
        } catch(e) {}
    }

    // --- MOUTH LOGIC ---
    let mouthCenter = { x: 0, y: 0 };
    let isMouthOpen = false;
    let mouthWidth = 0;

    if (faceResult && faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
        const landmarks = faceResult.faceLandmarks[0];
        const upperLip = { x: (1 - landmarks[13].x) * canvas.width, y: landmarks[13].y * canvas.height };
        const lowerLip = { x: (1 - landmarks[14].x) * canvas.width, y: landmarks[14].y * canvas.height };
        const leftCorner = { x: (1 - landmarks[78].x) * canvas.width, y: landmarks[78].y * canvas.height };
        const rightCorner = { x: (1 - landmarks[308].x) * canvas.width, y: landmarks[308].y * canvas.height };

        mouthCenter = {
            x: (upperLip.x + lowerLip.x) / 2,
            y: (upperLip.y + lowerLip.y) / 2
        };

        const mouthHeight = Math.hypot(upperLip.x - lowerLip.x, upperLip.y - lowerLip.y);
        mouthWidth = Math.hypot(leftCorner.x - rightCorner.x, leftCorner.y - rightCorner.y);
        
        isMouthOpen = mouthHeight > (mouthWidth * 0.2);

        if (settings.debug) {
            ctx.beginPath();
            ctx.arc(mouthCenter.x, mouthCenter.y, mouthWidth / 2, 0, Math.PI * 2);
            ctx.strokeStyle = isMouthOpen ? 'lime' : 'red';
            ctx.stroke();
        }
    }

    const objectsToRemove = new Set<number>();
    const objects = objectsRef.current;

    // --- HAND LOGIC PREP ---
    const handPositions: {[key:number]: {x: number, y: number, isPinching: boolean, isGun: boolean, tipX: number, tipY: number, velocityY: number}} = {};
    
    if (handResult && handResult.landmarks) {
      handResult.landmarks.forEach((landmarks, handIndex) => {
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];
        const ix = (1 - indexTip.x) * canvas.width;
        const iy = indexTip.y * canvas.height;
        const tx = (1 - thumbTip.x) * canvas.width;
        const ty = thumbTip.y * canvas.height;

        const pinchX = (ix + tx) / 2;
        const pinchY = (iy + ty) / 2;
        const pinchDist = Math.hypot(ix - tx, iy - ty);
        const isPinching = pinchDist < settings.pinchThreshold;
        
        const isGun = isGunGesture(landmarks);

        // Calculate hand velocity for gesture detection (Flick Up)
        let velocityY = 0;
        const prevPos = prevHandPosRef.current[handIndex];
        if (prevPos) {
            velocityY = pinchY - prevPos.y;
        }

        handPositions[handIndex] = { x: pinchX, y: pinchY, isPinching, isGun, tipX: ix, tipY: iy, velocityY };

        // Draw Skeleton
        if (settings.showSkeleton && isCameraActive) {
            ctx.strokeStyle = isGun ? '#ff0055' : settings.handColor;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            HAND_CONNECTIONS.forEach(([start, end]) => {
               const p1 = landmarks[start];
               const p2 = landmarks[end];
               ctx.beginPath();
               ctx.moveTo((1 - p1.x) * canvas.width, p1.y * canvas.height);
               ctx.lineTo((1 - p2.x) * canvas.width, p2.y * canvas.height);
               ctx.stroke();
            });
            
            if (isPinching) {
                ctx.beginPath();
                ctx.arc(pinchX, pinchY, 10, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fill();
            }
        }

        // 1. MAGICIAN SPAWN
        if (isMouthOpen && isPinching && !wasPinchingRef.current[handIndex]) {
            const distToMouth = Math.hypot(pinchX - mouthCenter.x, pinchY - mouthCenter.y);
            if (distToMouth < mouthWidth * 2.0) {
                spawnObjects(1, pinchX, pinchY, 0, 0, 45, undefined, handIndex);
            }
        }

        // 2. GUN GESTURE SHOOTING
        if (isGun) {
             // Detect sharp upward movement (Flick)
             if (velocityY < -15) { // Negative Y is Up
                 const now = performance.now();
                 if (now - lastShotTimeRef.current > 300) { // Cooldown
                     // Shoot from index tip
                     spawnObjects(1, ix, iy, 0, -25, 10, '#FFD700'); // Gold bullet, fast upward
                     lastShotTimeRef.current = now;
                 }
             }
        }
        
        wasPinchingRef.current[handIndex] = isPinching;
      });
    }

    // --- CRITICAL FIX: RESET & RE-EVALUATE GRABS ---
    // Instead of relying on sticky state, we calculate interaction frame-by-frame
    // But we must persist ownership if the hold is valid.
    
    // 1. Identify Double Grabs for this frame
    const currentDoubleGrabs = new Set<number>();
    
    if (handPositions[0] && handPositions[1] && handPositions[0].isPinching && handPositions[1].isPinching) {
        const h0 = handPositions[0];
        const h1 = handPositions[1];
        const currentDist = Math.hypot(h1.x - h0.x, h1.y - h0.y);

        objects.forEach(obj => {
            const d0 = Math.hypot(obj.x - h0.x, obj.y - h0.y);
            const d1 = Math.hypot(obj.x - h1.x, obj.y - h1.y);
            const grabRadius = obj.radius + 40;
            
            // If previously held by one, we check if the other joined
            const isHeldBy0 = obj.isGrabbed && obj.grabbedByHandIndex === 0;
            const isHeldBy1 = obj.isGrabbed && obj.grabbedByHandIndex === 1;
            
            // Check if both hands are close enough OR one holds and other is close
            if ((d0 < grabRadius && d1 < grabRadius) || (isHeldBy0 && d1 < grabRadius) || (isHeldBy1 && d0 < grabRadius)) {
                currentDoubleGrabs.add(obj.id);
                
                // FORCE LOGIC: Double Grab overrides everything
                obj.isGrabbed = true;
                obj.grabbedByHandIndex = null; // Null means "shared"
                obj.x = (h0.x + h1.x) / 2;
                obj.y = (h0.y + h1.y) / 2;
                obj.vx = 0;
                obj.vy = 0;

                // RESIZE
                const prevH0 = prevHandPosRef.current[0];
                const prevH1 = prevHandPosRef.current[1];
                if (prevH0 && prevH1) {
                    const prevDist = Math.hypot(prevH1.x - prevH0.x, prevH1.y - prevH0.y);
                    const delta = currentDist - prevDist;
                    obj.radius += delta * 0.6;
                    if (obj.radius < 15) obj.radius = 15;
                    if (obj.radius > 150) obj.radius = 150;
                }
            }
        });
    }

    // 2. Single Hand Logic (Only for objects NOT in currentDoubleGrabs)
    if (handResult && handResult.landmarks) {
        handResult.landmarks.forEach((_, handIndex) => {
            const hand = handPositions[handIndex];
            const prevPos = prevHandPosRef.current[handIndex];
            if (!hand || !prevPos) return;

            const handVx = hand.x - prevPos.x;
            const handVy = hand.y - prevPos.y;

            if (hand.isPinching) {
                 objects.forEach(obj => {
                    if (currentDoubleGrabs.has(obj.id)) return; // Skip double grabbed

                    // If already held by THIS hand, move it
                    if (obj.isGrabbed && obj.grabbedByHandIndex === handIndex) {
                        obj.x = hand.x;
                        obj.y = hand.y;
                        obj.vx = handVx * settings.throwForce;
                        obj.vy = handVy * settings.throwForce;
                        return;
                    }

                    // If held by OTHER hand, skip (unless we are stealing, but let's simple logic first)
                    if (obj.isGrabbed && obj.grabbedByHandIndex !== null && obj.grabbedByHandIndex !== handIndex) return;

                    // Try to grab free object
                    const dist = Math.hypot(obj.x - hand.x, obj.y - hand.y);
                    if (dist < obj.radius + 40) {
                        obj.isGrabbed = true;
                        obj.grabbedByHandIndex = handIndex;
                    }
                 });
            } else {
                // Release anything held by this hand
                objects.forEach(obj => {
                    if (obj.isGrabbed && obj.grabbedByHandIndex === handIndex) {
                         if (!currentDoubleGrabs.has(obj.id)) {
                            obj.isGrabbed = false;
                            obj.grabbedByHandIndex = null;
                         }
                    }
                });
            }
        });
    }
    
    // Cleanup Stale Double Grabs
    // If an object was marked as double grabbed but isn't anymore, ensure it's released properly
    objects.forEach(obj => {
        if (obj.grabbedByHandIndex === null && obj.isGrabbed) {
            // It thinks it is double grabbed
            if (!currentDoubleGrabs.has(obj.id)) {
                // It is NO LONGER double grabbed. Release it.
                obj.isGrabbed = false;
            }
        }
    });

    // Update Previous Hand Positions
    if (handPositions[0]) prevHandPosRef.current[0] = { x: handPositions[0].x, y: handPositions[0].y };
    if (handPositions[1]) prevHandPosRef.current[1] = { x: handPositions[1].x, y: handPositions[1].y };

    // --- PHYSICS & COLLISIONS ---
    if (settings.enableCollisions) {
        for (let i = 0; i < objects.length; i++) {
            for (let j = i + 1; j < objects.length; j++) {
                const o1 = objects[i];
                const o2 = objects[j];
                
                if (o1.isGrabbed || o2.isGrabbed) continue; 
                if (objectsToRemove.has(o1.id) || objectsToRemove.has(o2.id)) continue;

                const dx = o2.x - o1.x;
                const dy = o2.y - o1.y;
                const dist = Math.hypot(dx, dy);
                const minDist = o1.radius + o2.radius;

                if (dist < minDist) {
                    // FUSION LOGIC
                    const now = performance.now();
                    const canFuse = settings.fusionChance > 0 && // Strict check on setting
                                    (Math.random() < settings.fusionChance) &&
                                    (now - o1.createdAt > 2000) && 
                                    (now - o2.createdAt > 2000);

                    if (canFuse) {
                        if (o1.radius >= o2.radius) {
                            o1.radius += o2.radius * 0.4; 
                            objectsToRemove.add(o2.id);
                        } else {
                            o2.radius += o1.radius * 0.4;
                            objectsToRemove.add(o1.id);
                        }
                    } else {
                        // BOUNCE & SEPARATION
                        const angle = Math.atan2(dy, dx);
                        const sin = Math.sin(angle);
                        const cos = Math.cos(angle);

                        // 1. Position Correction (CRITICAL for preventing sticking)
                        const overlap = (minDist - dist) + 1; // +1 extra buffer
                        const separationX = (overlap / 2) * Math.cos(angle);
                        const separationY = (overlap / 2) * Math.sin(angle);
                        
                        o1.x -= separationX;
                        o1.y -= separationY;
                        o2.x += separationX;
                        o2.y += separationY;

                        // 2. Velocity Resolution
                        const vx1 = o1.vx * cos + o1.vy * sin;
                        const vy1 = o1.vy * cos - o1.vx * sin;
                        const vx2 = o2.vx * cos + o2.vy * sin;
                        const vy2 = o2.vy * cos - o2.vx * sin;

                        const vx1Final = ((o1.radius - o2.radius) * vx1 + 2 * o2.radius * vx2) / (o1.radius + o2.radius);
                        const vx2Final = ((o2.radius - o1.radius) * vx2 + 2 * o1.radius * vx1) / (o1.radius + o2.radius);
                        
                        const bounceFactor = settings.bounce; 

                        o1.vx = (vx1Final * cos - vy1 * sin) * bounceFactor;
                        o1.vy = (vy1 * cos + vx1Final * sin) * bounceFactor;
                        o2.vx = (vx2Final * cos - vy2 * sin) * bounceFactor;
                        o2.vy = (vy2 * cos + vx2Final * sin) * bounceFactor;
                    }
                }
            }
        }
    }

    // Movement & Eating
    objects.forEach(obj => {
        if (objectsToRemove.has(obj.id)) return;

        if (!obj.isGrabbed) {
            obj.vy += settings.gravity;
            obj.x += obj.vx;
            obj.y += obj.vy;
            obj.vx *= settings.friction;
            obj.vy *= settings.friction;

            // Wall Bounces
            if (obj.x - obj.radius < 0) { 
                obj.x = obj.radius; 
                obj.vx = Math.abs(obj.vx) * settings.bounce; 
            }
            if (obj.x + obj.radius > canvas.width) { 
                obj.x = canvas.width - obj.radius; 
                obj.vx = -Math.abs(obj.vx) * settings.bounce; 
            }
            if (obj.y - obj.radius < 0) { 
                obj.y = obj.radius; 
                obj.vy = Math.abs(obj.vy) * settings.bounce; 
            }
            if (obj.y + obj.radius > canvas.height) { 
                obj.y = canvas.height - obj.radius; 
                obj.vy = -Math.abs(obj.vy) * settings.bounce; 
            }
        }

        // EATING LOGIC
        if (isMouthOpen && !obj.isGrabbed && (performance.now() - obj.createdAt > 2000)) {
            const distToMouth = Math.hypot(obj.x - mouthCenter.x, obj.y - mouthCenter.y);
            if (distToMouth < (mouthWidth / 2)) {
                objectsToRemove.add(obj.id);
            }
        }

        drawBlob(ctx, obj.x, obj.y, obj.radius, obj.color, obj.wobblePhase);
    });

    if (objectsToRemove.size > 0) {
        objectsRef.current = objectsRef.current.filter(o => !objectsToRemove.has(o.id));
    }

    requestRef.current = requestAnimationFrame(loop);
  }, [handLandmarker, faceLandmarker, settings, spawnObjects, isCameraActive]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  return (
    <div className="relative w-full h-full font-sans">
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-neutral-900 text-white">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-lg animate-pulse">Chargement de la Vision par Ordinateur...</p>
        </div>
      )}

      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block touch-none cursor-none" />

      {/* UI Layer */}
      <div className="absolute top-0 left-0 p-6 z-10 pointer-events-none select-none">
        <h1 className="text-3xl font-black text-white/80 tracking-tighter drop-shadow-lg">
          HAND <span className="text-emerald-400">SPACE</span>
        </h1>
        <p className="text-white/50 text-sm mt-1 max-w-md leading-relaxed">
          <span className="text-emerald-400 font-bold">Pincer:</span> Attraper | 
          <span className="text-emerald-400 font-bold ml-2">Deux mains:</span> Redimensionner<br/>
          <span className="text-emerald-400 font-bold">Pistolet (Index+Pouce) & Flick Haut:</span> Tirer<br/>
          <span className="text-emerald-400 font-bold">Bouche Ouverte + Pincer:</span> Sortir une boule
        </p>
      </div>
      
      {/* Camera Toggle on Screen (if menu closed) */}
      {!isMenuOpen && (
         <button 
            onClick={() => setIsCameraActive(!isCameraActive)}
            className={`absolute bottom-6 right-6 z-20 p-3 rounded-full transition-all shadow-lg pointer-events-auto ${isCameraActive ? 'bg-neutral-800/50 text-white hover:bg-red-500/80' : 'bg-red-600 text-white hover:bg-red-500 animate-pulse'}`}
            title={isCameraActive ? "Couper Caméra" : "Activer Caméra"}
         >
            {isCameraActive ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M21 21l-9-9m-2-2l-6-6"></path><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3.5"></path><circle cx="12" cy="13" r="4"></circle></svg>
            )}
         </button>
      )}

      {/* Menu Toggle */}
      {!isMenuOpen && (
        <button 
            onClick={() => setIsMenuOpen(true)}
            className="absolute top-6 right-6 z-20 text-white/30 hover:text-white/90 transition-colors p-2 rounded-full hover:bg-white/10 pointer-events-auto"
        >
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <circle cx="12" cy="12" r="3"></circle>
             <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
           </svg>
        </button>
      )}

      {isMenuOpen && (
        <ControlPanel 
            settings={settings} 
            onUpdate={setSettings} 
            onClose={() => setIsMenuOpen(false)}
            onResetObjects={() => {
                objectsRef.current = [];
                spawnObjects(12);
            }}
            isCameraOn={isCameraActive}
            onToggleCamera={() => setIsCameraActive(!isCameraActive)}
        />
      )}
    </div>
  );
};
