const GAME_GRAPHICS = {
    // Projectiles
    wand_missile: (ctx, p, game) => {
        if(Math.random()<0.3) game.particles.push(new Particle(game, p.x, p.y, '#4da6ff', 2, -20, 0.3));
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createLinearGradient(0, 0, -30*p.area, 0);
        grad.addColorStop(0, 'rgba(77, 166, 255, 0.8)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(0, -5*p.area); ctx.lineTo(-35*p.area, 0); ctx.lineTo(0, 5*p.area); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.shadowColor = '#4da6ff'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, 5*p.area, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    },
    axe: (ctx, p, game) => {
        ctx.save();
        ctx.globalAlpha = 0.3; ctx.fillStyle = '#aaa';
        ctx.beginPath(); ctx.arc(p.x - p.vx*0.02, p.y - p.vy*0.02, p.r, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.scale(p.area, p.area); 
        ctx.fillStyle = '#532'; ctx.fillRect(-2, -20, 4, 40);
        const bg = ctx.createLinearGradient(0, -20, 0, 20); bg.addColorStop(0, '#e0e0e0'); bg.addColorStop(1, '#888');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, 20, Math.PI * 0.2, Math.PI * 1.8, true); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.arc(-5, 0, 12, 0, Math.PI*2); ctx.fill();
        ctx.restore(); ctx.restore();
    },
    cross: (ctx, p, game) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(p.area, p.area);
        
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 15;
        
        // --- Draw four sharp blades instead of rectangles ---
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            
            // Create a metallic gradient for each blade
            const grad = ctx.createLinearGradient(0, 0, 0, -25);
            grad.addColorStop(0, '#c0c0c0'); // Darker base
            grad.addColorStop(1, '#ffffff'); // Sharp, white edge
            ctx.fillStyle = grad;
            
            // Draw a single, sharp blade shape
            ctx.beginPath();
            ctx.moveTo(0, -5);
            ctx.lineTo(8, -15);
            ctx.lineTo(0, -25);
            ctx.lineTo(-8, -15);
            ctx.closePath();
            ctx.fill();
            
            // Add a dark outline for definition
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Central holy gem
        ctx.fillStyle = '#990000';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#cfa538'; // Gold setting
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
    },
    silver_stake: (ctx, p, game) => {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        // Create a metallic-looking gradient for the stake
        const grad = ctx.createLinearGradient(-15, 0, 15, 0);
        grad.addColorStop(0, '#aab'); grad.addColorStop(0.4, '#fff'); grad.addColorStop(0.6, '#fff'); grad.addColorStop(1, '#99a');
        ctx.fillStyle = grad;
        // Draw a more defined stake shape
        ctx.beginPath(); ctx.moveTo(15,0); ctx.lineTo(5, -4); ctx.lineTo(-15, -2); ctx.lineTo(-15, 2); ctx.lineTo(5, 4); ctx.closePath(); ctx.fill();
        // Add a small glint
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(5, -1.5, 5, 3);
        ctx.restore();
    },
    holy_water_vial: (ctx, p, game) => { ctx.fillStyle = '#87ceeb'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill(); },
    behemoth_rock: (ctx, proj, game) => {
    // Save the current canvas state (position, rotation, etc.)
    ctx.save();

    // THIS IS THE CRITICAL FIX:
    // Move the canvas origin to the projectile's actual position.
    ctx.translate(proj.x, proj.y);

    // Now, draw the rock at the new (0,0) origin.
    ctx.fillStyle = '#6a5d5d';
    ctx.strokeStyle = '#2a2323';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, proj.r, 0, Math.PI * 2); // Draw at (0,0) relative to the new position
    ctx.fill();
    ctx.stroke();

    // Restore the canvas state to what it was before this function was called.
    ctx.restore();
},
    blood_orb: (ctx, p, game) => { ctx.fillStyle = '#8a0303'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill(); },
    frost_shard: (ctx, p, game) => {
        if(Math.random() < 0.2) game.particles.push(new Particle(game, p.x, p.y, '#e0ffff', 1, -10, 0.2));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.scale(p.area, p.area);
        // Inner glow effect
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
        grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(173, 216, 230, 0.8)');
        ctx.fillStyle = grad;
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 15;
        // More complex, faceted crystal shape
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-5, -8); ctx.lineTo(-10, -3); ctx.lineTo(-5, 0); ctx.lineTo(-10, 3); ctx.lineTo(-5, 8); ctx.closePath(); ctx.fill();
        ctx.restore();
    },
    ghostly_bolt: (ctx, p, game) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 1 + Math.sin(game.animTime * 20) * 0.2;
        const r = p.r * pulse;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        grad.addColorStop(0, 'rgba(255, 220, 255, 0.9)'); // Bright, almost white lavender center
        grad.addColorStop(0.7, 'rgba(200, 100, 255, 0.5)'); // Mid-range purple
        grad.addColorStop(1, 'rgba(150, 50, 255, 0)');   // Outer glow, deep violet
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },
    chain_link: (ctx, p, game) => {
        ctx.strokeStyle = '#999'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(game.player.x, game.player.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    },
    storm_bolt_draw: (ctx, p) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.strokeStyle = '#aaffff';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(0, 0);
    ctx.lineTo(5, 4);
    ctx.lineTo(10, 0);
    ctx.stroke();
    ctx.restore();
},
electric_nova_draw: (ctx, effect, game) => {
    // THE FIX: The 'radius' is now a property of the 'effect' object ('effect.r').
    const grad = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, effect.r);
    const alpha = 0.2 + Math.sin(game.animTime * 10) * 0.1;
    grad.addColorStop(0, `rgba(170, 255, 255, ${alpha * 0.5})`);
    grad.addColorStop(0.8, `rgba(100, 200, 255, ${alpha})`);
    grad.addColorStop(1, `rgba(50, 150, 255, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, effect.r, 0, Math.PI * 2);
    ctx.fill();

    // Add some lightning arcs for effect
    ctx.strokeStyle = `rgba(200, 255, 255, ${0.5 + Math.sin(game.animTime * 15) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#aaffff';
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const startAngle = game.animTime * 2 + i * (Math.PI * 2 / 3);
        const endAngle = startAngle + M.rand(0.5, 1.5);
        ctx.arc(effect.x, effect.y, effect.r * M.rand(0.8, 0.95), startAngle, endAngle);
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
},

    // Enemies
    bat_draw: (ctx, e, game) => {
        // --- Animation: A more frantic, leathery flap ---
        const flapCycle = game.animTime * 25 + e.animOff;
        const flap = Math.sin(flapCycle) * e.r * 1.2;
        ctx.translate(0, -e.r * 0.8 + flap * 0.1); // Bobbing motion

        // --- Color Setup ---
        const bodyColor = e.flash > 0 ? '#fff' : '#4a3a4a';
        const wingColor = e.flash > 0 ? '#fff' : '#3d293d';

        // --- Drawing (from back to front) ---

        // Wings with skeletal structure
        ctx.fillStyle = wingColor;
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 2;

        [-1, 1].forEach(side => { // Draw both left and right wings
            ctx.beginPath();
            ctx.moveTo(side * e.r * 0.3, -e.r * 0.2); // Connect to body
            // Top "arm" of the wing
            const p1x = side * e.r * 1.5;
            const p1y = -e.r * 1.5 + flap;
            ctx.lineTo(p1x, p1y);
            // Outer tip of the wing
            const p2x = side * e.r * 2.5;
            const p2y = -e.r * 0.5 + flap * 1.2;
            ctx.quadraticCurveTo(p1x, p1y + flap*0.2, p2x, p2y);
            // Bottom edge connecting back to body
            ctx.quadraticCurveTo(side * e.r * 1.5, e.r * 0.8, side * e.r * 0.3, e.r * 0.5);
            ctx.closePath();
            ctx.fill();
            // Draw "finger" bones in the wings
            ctx.beginPath();
            ctx.moveTo(p1x, p1y);
            ctx.lineTo(side * e.r * 1.8, e.r * 0.2);
            ctx.stroke();
        });

        // Furry Body (ADJUSTED)
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        // Replaced the larger ellipse with a smaller, more circular arc
        ctx.arc(0, 0, e.r * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Head with Ears and Fangs
        ctx.beginPath();
        ctx.arc(0, -e.r * 0.9, e.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        // Ears
        ctx.beginPath();
        ctx.moveTo(-e.r*0.1, -e.r*1.4); ctx.lineTo(-e.r*0.5, -e.r*1.6); ctx.lineTo(-e.r*0.4, -e.r*1.3); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(e.r*0.1, -e.r*1.4); ctx.lineTo(e.r*0.5, -e.r*1.6); ctx.lineTo(e.r*0.4, -e.r*1.3); ctx.fill();
        
        if (e.flash <= 0) {
            // Eyes
            ctx.fillStyle = '#f00';
            ctx.fillRect(e.r*0.15, -e.r, 2, 2);
            ctx.fillRect(-e.r*0.25, -e.r, 2, 2);
            // Fangs
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(-e.r*0.1, -e.r*0.6); ctx.lineTo(-e.r*0.2, -e.r*0.4); ctx.lineTo(0, -e.r*0.6); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(e.r*0.1, -e.r*0.6); ctx.lineTo(e.r*0.2, -e.r*0.4); ctx.lineTo(0, -e.r*0.6); ctx.fill();
        }
    },

    zombie_draw: (ctx, e, game) => {
        // --- CONCEPT: THE RISEN CORPSE ---
        // A classic zombie, defined by its broken, decaying body.
        // The animation is heavy and pained, the details are gruesome and anatomical.

        // --- ANIMATION: The Agonizing Plod ---
        const plodCycle = game.animTime * 2.5 + e.animOff;
        const lurch = Math.sin(plodCycle);
        const bodyBob = (1 - Math.cos(plodCycle)) * -5;
        const bodySway = lurch * 4;
        const armSwing = lurch * 0.3;

        // Dust effect from the heavy stomps.
        if (Math.cos(plodCycle) > 0.95) {
            game.particles.push(new Particle(game, e.x + M.rand(-e.r, e.r), e.y + e.r, '#5a4a4a', 2, -10, 0.4));
        }

        // Apply global animations
        ctx.translate(bodySway, bodyBob);

        // --- Enhanced Color Palette ---
        const skinGrad = ctx.createLinearGradient(0, -e.r * 2, 0, e.r * 2);
        skinGrad.addColorStop(0, e.flash > 0 ? '#fff' : '#689468'); // Brighter green
        skinGrad.addColorStop(1, e.flash > 0 ? '#fff' : '#487448'); // Deeper green
        
        const bruiseColor = e.flash > 0 ? 'rgba(0,0,0,0)' : '#593a59'; // More distinct purple
        const clothesColor = e.flash > 0 ? '#fff' : '#3a5a8a'; // Richer blue
        const boneColor = e.flash > 0 ? '#fff' : '#d8d8c0'; // Aged ivory
        const darkVoid = '#111';

        // --- DRAWING: Layered for a Visceral, 3D Feel ---

        // 1. Back Arm
        ctx.save();
        ctx.translate(e.r * 0.6, -e.r * 0.5);
        ctx.rotate(-armSwing);
        ctx.fillStyle = skinGrad;
        ctx.fillRect(-e.r * 0.15, 0, e.r * 0.3, e.r * 1.5);
        ctx.restore();

        // 2. Legs
        ctx.fillStyle = skinGrad;
        ctx.fillRect(-e.r * 0.7, e.r * 0.8, e.r * 0.5, e.r * 1.5 + lurch * e.r * 0.4);
        ctx.fillRect(e.r * 0.2, e.r * 0.8, e.r * 0.5, e.r * 1.5 - lurch * e.r * 0.4);

        // 3. The Torso: A Canvas of Decay
        // Base flesh layer
        ctx.fillStyle = skinGrad;
        ctx.beginPath();
        // --- FIX: Reshaped the torso's top to be a curve instead of a flat rectangle ---
        ctx.moveTo(-e.r * 0.8, -e.r * 1.2); // Start at left shoulder
        ctx.quadraticCurveTo(0, -e.r * 1.7, e.r * 0.8, -e.r * 1.2); // Create a hunched curve for the shoulders/neck
        ctx.lineTo(e.r * 0.9, e.r); // Right side
        ctx.lineTo(-e.r * 0.9, e.r); // Left side
        ctx.closePath();
        ctx.fill();

        // Add bruising for more color depth
        ctx.fillStyle = bruiseColor;
        ctx.fillRect(-e.r * 0.8, e.r * 0.5, e.r * 1.6, e.r * 0.5);

        // Gaping Torso Hole
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(e.r * 0.2, -e.r * 1.2);
        ctx.quadraticCurveTo(e.r * 1.2, -e.r * 0.5, e.r * 0.3, e.r * 0.5);
        ctx.quadraticCurveTo(e.r * -0.2, -e.r * 0.2, e.r * 0.2, -e.r * 1.2);
        ctx.fill();
        ctx.restore();

        // Exposed Spine
        if (e.flash <= 0) {
            ctx.fillStyle = boneColor;
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.ellipse(e.r * 0.4, -e.r * 0.8 + i * e.r * 0.4, e.r * 0.2, e.r * 0.15, 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 4. Tattered Clothing (shaped around the hole)
        ctx.fillStyle = clothesColor;
        ctx.beginPath();
        ctx.moveTo(-e.r, -e.r);
        ctx.quadraticCurveTo(0, -e.r * 1.5, e.r * 0.2, -e.r * 1.2); // Adjusted to match new torso curve
        ctx.quadraticCurveTo(e.r * 0, -e.r * 0.2, e.r * 0.3, e.r * 0.5);
        ctx.lineTo(e.r * 0.8, e.r * 1.5);
        ctx.lineTo(e.r * 0.2, e.r * 1.2);
        ctx.lineTo(-e.r * 0.3, e.r * 1.6);
        ctx.lineTo(-e.r * 0.8, e.r * 1.2);
        ctx.closePath();
        ctx.fill();

        // 5. The Head: A Hollowed Husk
        ctx.save();
        ctx.translate(0, -e.r * 1.6); // Positioned perfectly on the new torso curve
        ctx.fillStyle = skinGrad;
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        if (e.flash <= 0) {
            ctx.fillStyle = darkVoid;
            ctx.beginPath();
            ctx.arc(-e.r * 0.25, 0, e.r * 0.15, 0, Math.PI * 2);
            ctx.arc(e.r * 0.25, 0, e.r * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // 6. Front Arm
        ctx.save();
        ctx.translate(-e.r * 0.7, -e.r * 0.6);
        ctx.rotate(armSwing);
        ctx.fillStyle = skinGrad;
        ctx.fillRect(-e.r * 0.2, 0, e.r * 0.4, e.r * 1.8);
        ctx.fillStyle = bruiseColor;
        ctx.fillRect(-e.r * 0.25, e.r * 1.6, e.r * 0.5, e.r * 0.3);
        ctx.restore();
    },
    skeleton_draw: (ctx, e, game) => {
        const bob = Math.sin(game.animTime * 8 + e.animOff) * 2;
        const swing = Math.sin(game.animTime * 4 + e.animOff);
        if (e.flash > 0) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; } else { ctx.fillStyle = '#e0e0d1'; ctx.strokeStyle = '#4a4a3f'; }
        ctx.lineWidth = 2;
        ctx.translate(0, bob - e.r);
        // Pelvis & Legs
        ctx.fillRect(-e.r * 0.4, e.r, e.r * 0.8, e.r * 0.4);
        ctx.strokeRect(-e.r * 0.4, e.r, e.r * 0.8, e.r * 0.4);
        ctx.fillRect(-e.r * 0.5, e.r * 1.4, e.r * 0.2, e.r); // Left leg
        ctx.fillRect(e.r * 0.3, e.r * 1.4, e.r * 0.2, e.r + swing*2); // Right leg (swinging)
        // Torso (Spine & Ribs)
        ctx.fillRect(-e.r * 0.1, e.r * 0.2, e.r * 0.2, e.r); // Spine
        for (let i = 0; i < 3; i++) { ctx.fillRect(-e.r * 0.5, e.r * 0.4 + i * 0.2 * e.r, e.r, e.r * 0.1); } // Ribs
        // Arms
        ctx.fillRect(-e.r * 0.8, e.r * 0.2 - swing*2, e.r * 0.2, e.r); // Left arm
        ctx.fillRect(e.r * 0.6, e.r * 0.2 + swing*2, e.r * 0.2, e.r); // Right arm
        // Skull
        ctx.beginPath(); ctx.arc(0, -e.r * 0.2, e.r * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillRect(-e.r * 0.3, e.r * 0.1, e.r * 0.6, e.r * 0.2); // Jaw
        // Eyes
        ctx.fillStyle = '#a00'; ctx.shadowColor = '#f00'; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(-e.r * 0.15, -e.r * 0.2, 2, 0, Math.PI * 2); ctx.arc(e.r * 0.15, -e.r * 0.2, 2, 0, Math.PI * 2); ctx.fill();
    },
    reaper_draw: (ctx, e, game) => {
        // --- Animation Setup ---
        const walkCycle = game.animTime * 7 + e.animOff; // A clattering, faster pace
        const bob = Math.abs(Math.cos(walkCycle)) * -3; // A slight, jerky bob
        const rattleX = Math.sin(walkCycle * 3) * 1;   // A side-to-side rattle
        
        // Limb angles for a stiff, marionette-like walk
        const frontLegAngle = Math.sin(walkCycle) * 0.3;
        const frontCalfAngle = Math.max(0, Math.sin(walkCycle + 1.5) * 0.5);
        const backLegAngle = -frontLegAngle;
        const backCalfAngle = Math.max(0, Math.sin(walkCycle - 1.5) * 0.5);
        
        const frontArmAngle = Math.sin(walkCycle - 1) * 0.4;
        const backArmAngle = -frontArmAngle;

        // Apply global animations
        ctx.translate(rattleX, bob - e.r * 0.5); // Start drawing from higher up

        // --- Color Setup ---
        const boneColor = e.flash > 0 ? '#fff' : '#e0e0d1';
        const darkColor = e.flash > 0 ? '#fff' : '#4a4a3f';
        const swordColor = e.flash > 0 ? '#fff' : '#5c616c';
        const rustColor = e.flash > 0 ? '#fff' : '#7d4a2f';

        ctx.strokeStyle = darkColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round'; // Use rounded ends for bones

        // --- Drawing Functions for Body Parts ---
        const drawLimb = (angle, length, childLimb = null) => {
            ctx.save();
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, length);
            ctx.stroke();
            ctx.translate(0, length);
            if (childLimb) childLimb();
            ctx.restore();
        };

        // --- Drawing (from back to front) ---
        ctx.fillStyle = boneColor;

        // Back Leg
        drawLimb(backLegAngle, e.r * 1.2, () => {
            drawLimb(backCalfAngle, e.r);
        });
        
        // Back Arm
        drawLimb(backArmAngle, e.r, () => {
            drawLimb(0.2, e.r); // Slightly bent elbow
        });

        // Torso: Pelvis, Spine, and Rib Cage
        ctx.fillRect(-e.r * 0.6, 0, e.r * 1.2, e.r * 0.4); // Pelvis
        ctx.beginPath(); // Spine
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(e.r * 0.2, -e.r * 1.2, 0, -e.r * 2);
        ctx.stroke();
        for (let i = 0; i < 4; i++) { // Ribs
            const y = -e.r * (0.4 + i * 0.4);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.quadraticCurveTo(e.r * (0.8 - i*0.1), y, 0, y - e.r*0.1);
            ctx.moveTo(0, y);
            ctx.quadraticCurveTo(-e.r * (0.8 - i*0.1), y, 0, y - e.r*0.1);
            ctx.stroke();
        }

        // Front Leg
        drawLimb(frontLegAngle, e.r * 1.2, () => {
            drawLimb(frontCalfAngle, e.r);
        });

        // Front Arm (with Sword)
        drawLimb(frontArmAngle, e.r, () => {
            drawLimb(0.5, e.r, () => { // Bent elbow, holding sword
                ctx.rotate(-0.8); // Angle the sword
                ctx.lineWidth = 1;
                // Sword Hilt
                ctx.fillStyle = darkColor;
                ctx.fillRect(-e.r * 0.2, 0, e.r * 0.4, e.r * 0.2);
                ctx.fillRect(-e.r * 0.6, e.r * 0.2, e.r * 1.2, e.r * 0.2);
                // Sword Blade
                ctx.fillStyle = swordColor;
                ctx.beginPath();
                ctx.moveTo(0, e.r * 0.4);
                ctx.lineTo(-e.r * 0.2, e.r * 2.5);
                ctx.lineTo(e.r * 0.2, e.r * 2.5);
                ctx.closePath();
                ctx.fill();
                // Rust/Chip details
                ctx.fillStyle = rustColor;
                ctx.fillRect(-e.r*0.1, e.r*1.5, e.r*0.2, e.r*0.4);
            });
        });

        // Head
        ctx.save();
        ctx.translate(0, -e.r * 2.2); // Position head on top of spine
        ctx.beginPath(); // Skull
        ctx.ellipse(0, 0, e.r * 0.6, e.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(-e.r * 0.4, e.r * 0.5, e.r * 0.8, e.r * 0.3); // Jaw
        
        if (e.flash <= 0) {
            // Eye Sockets
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(-e.r * 0.2, -e.r * 0.1, e.r * 0.2, 0, Math.PI * 2);
            ctx.arc(e.r * 0.2, -e.r * 0.1, e.r * 0.2, 0, Math.PI * 2);
            ctx.fill();
            // Glowing Eyes
            ctx.fillStyle = '#f00';
            ctx.shadowColor = '#f00';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(-e.r * 0.2, -e.r * 0.1, 2, 0, Math.PI * 2);
            ctx.arc(e.r * 0.2, -e.r * 0.1, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    abomination_draw: (ctx, e, game) => {
        // --- CONCEPT: THE ABOMINATION ---
        // A crudely stitched-together brute. Its horror is in its unnatural construction
        // and the immense weight of its dominant, grotesque arm. ZERO glowing parts.

        // --- ANIMATION: The Heavy Drag ---
        const plodCycle = game.animTime * 2.5 + e.animOff;
        const lurch = Math.sin(plodCycle);
        const bodyBob = (1 - Math.cos(plodCycle)) * -4; // A heavy, rhythmic drop
        
        // The entire body sways to counterbalance the weight of the massive arm.
        const bodySway = lurch * -5;

        // The massive arm has a delayed, heavy swing, driven by momentum.
        const maulArmAngle = Math.sin(plodCycle - 0.8) * 0.2;

        // The atrophied arm has a slight, dead-weight twitch.
        const deadArmAngle = lurch * 0.1;

        // Dust effect from the dragging foot.
        if (Math.cos(plodCycle) > 0.95) {
            game.particles.push(new Particle(game, e.x + M.rand(-e.r, e.r), e.y + e.r, '#5a4a3a', 2, -5, 0.3));
        }

        // Apply global animations
        ctx.translate(bodySway, bodyBob);

        // --- COLOR PALETTE: Bruised, Dead & Rusted ---
        const skinColor = e.flash > 0 ? '#fff' : '#6a606b'; // Dead, grayish-mauve
        const maulArmColor = e.flash > 0 ? '#fff' : '#5a4a5a'; // Bruised, dark purple
        const clothesColor = e.flash > 0 ? '#fff' : '#4a3a2a'; // Faded, dirty brown
        const stapleColor = e.flash > 0 ? '#fff' : '#444';
        const stitchColor = e.flash > 0 ? '#fff' : '#111';

        // --- DRAWING: A Masterclass in Monstrous Asymmetry ---

        // 1. The Atrophied Back Arm
        ctx.save();
        ctx.translate(e.r * 0.6, -e.r * 0.8);
        ctx.rotate(deadArmAngle);
        ctx.fillStyle = skinColor;
        ctx.fillRect(-e.r * 0.1, 0, e.r * 0.2, e.r * 1.2); // Thin, useless arm
        ctx.restore();

        // 2. The Torso: A Canvas of Mutilation
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.moveTo(-e.r * 0.8, -e.r * 1.5); // Normal shoulder
        ctx.lineTo(e.r * 1.2, -e.r * 1.8);  // Grotesquely oversized shoulder
        ctx.lineTo(e.r * 1.1, e.r);
        ctx.lineTo(-e.r * 0.9, e.r);
        ctx.closePath();
        ctx.fill();

        // 3. Legs & Tattered Trousers
        ctx.fillStyle = clothesColor;
        ctx.fillRect(-e.r * 0.7, e.r * 0.8, e.r * 0.5, e.r * 1.5 + lurch * e.r * 0.4);
        ctx.fillRect(e.r * 0.2, e.r * 0.8, e.r * 0.5, e.r * 1.5 - lurch * e.r * 0.4);

        // 4. The Head: A Stapled-On Nightmare
        ctx.save();
        ctx.translate(0, -e.r * 1.6);
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        if (e.flash <= 0) {
            // Dark, empty eye sockets
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(-e.r * 0.25, 0, e.r * 0.15, 0, Math.PI * 2);
            ctx.arc(e.r * 0.25, 0, e.r * 0.15, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // 5. The Maul Arm: The Centerpiece of Brutality
        ctx.save();
        ctx.translate(e.r * 0.8, -e.r * 0.5); // Pivot from the huge shoulder
        ctx.rotate(maulArmAngle);
        ctx.fillStyle = maulArmColor;
        // A huge, lumpy, club-like shape. Not a circle.
        ctx.beginPath();
        ctx.moveTo(0, -e.r * 1.5);
        ctx.quadraticCurveTo(e.r * 1.5, e.r * 0.5, 0, e.r * 2.2);
        ctx.quadraticCurveTo(-e.r * 1.2, e.r * 0.5, 0, -e.r * 1.5);
        ctx.fill();
        ctx.restore();

        // 6. The Details: Staples & Stitches (The Final Layer of Horror)
        if (e.flash <= 0) {
            // Helper function for drawing staples
            const drawStaple = (x, y, size, angle) => {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle);
                ctx.fillRect(-size / 2, -1.5, size, 3); // The bar
                ctx.fillRect(-size / 2, -1.5, 3, 8);    // Left prong
                ctx.fillRect(size / 2 - 3, -1.5, 3, 8); // Right prong
                ctx.restore();
            };
            
            ctx.fillStyle = stapleColor;
            // Staples holding the head on
            drawStaple(0, -e.r * 1.1, e.r * 0.8, 0);
            // Staples holding the maul arm to the torso
            drawStaple(e.r * 0.5, -e.r * 1.2, e.r, 0.8);
            drawStaple(e.r * 0.9, -e.r * 0.2, e.r, 0.6);

            // Crude stitches across the chest
            ctx.strokeStyle = stitchColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-e.r * 0.7, -e.r * 0.5);
            ctx.lineTo(e.r * 0.2, -e.r * 0.8);
            ctx.stroke();
            for(let i=0; i<4; i++) {
                const p = i/3;
                const x = -e.r*0.7 + p * (e.r*0.9);
                const y = -e.r*0.5 + p * (-e.r*0.3);
                ctx.beginPath();
                ctx.moveTo(x - 5, y + 5);
                ctx.lineTo(x + 5, y - 5);
                ctx.stroke();
            }
        }
    },

    _generic_ethereal_draw: (ctx, e, game, color, alpha) => {
        ctx.globalAlpha *= alpha;

        // --- Animation: Unsettling drift and distortion ---
        const float = Math.sin(game.animTime * 3 + e.animOff) * 5;
        const stretch = Math.sin(game.animTime * 4 + e.animOff) * 0.1;
        ctx.translate(0, -e.r + float);
        ctx.scale(1 + stretch, 1 - stretch);

        // --- Main Body (glowing from within) ---
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r * 2);
        if (e.flash > 0) {
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
        } else {
            grad.addColorStop(0, color + 'ff'); // Solid core
            grad.addColorStop(0.5, color + 'aa'); // Fading middle
            grad.addColorStop(1, color + '00'); // Transparent edge
        }
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // --- Wispy, Trailing Tendrils ---
        const waveTime = game.animTime * 10;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            const startX = (i - 2) * (e.r * 0.5);
            ctx.moveTo(startX, e.r * 0.5);
            const len = e.r * (1.5 + Math.sin(waveTime*0.5 + i) * 0.5);
            const sway = Math.sin(waveTime + i * 2 + e.animOff) * e.r * 0.5;
            ctx.quadraticCurveTo(startX + sway * 0.5, e.r * 0.5 + len * 0.5, startX + sway, e.r * 0.5 + len);
            ctx.strokeStyle = e.flash > 0 ? 'rgba(255,255,255,0.5)' : color + '88';
            ctx.lineWidth = 4 - i%2; // Varying thickness
            ctx.stroke();
        }

        // --- Hollow Eyes ---
        if (e.flash <= 0) {
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(-e.r * 0.4, -e.r * 0.5, e.r * 0.2, 0, Math.PI * 2);
            ctx.arc(e.r * 0.4, -e.r * 0.5, e.r * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    ghost_draw: (ctx, e, game) => { GAME_GRAPHICS._generic_ethereal_draw(ctx, e, game, '#aaccff', 0.7); },

    phaser_draw: (ctx, e, game) => {
        // Add a flickering effect for the phaser
        ctx.globalAlpha *= 0.5 + Math.sin(game.animTime * 30 + e.animOff) * 0.4;
        GAME_GRAPHICS._generic_ethereal_draw(ctx, e, game, '#f0e6ff', 0.5);
    },

    golem_draw: (ctx, e, game) => {
        // --- Animation: A slow, heavy stomp ---
        const stepCycle = game.animTime * 1.5 + e.animOff;
        const bob = Math.abs(Math.sin(stepCycle)) * 4; // Heavy vertical bob
        const sway = Math.sin(stepCycle * 0.5) * 3;   // Slow side-to-side sway

        ctx.translate(sway, bob);

        // --- Color Setup ---
        const stoneColor = e.flash > 0 ? '#fff' : '#5a5a6a';
        const crackColor = e.flash > 0 ? '#fff' : '#222';
        const mossColor = e.flash > 0 ? '#fff' : '#3a5a3a';
        const coreColor = '#ff8800';

        // --- Drawing (as individual, overlapping stones) ---
        ctx.fillStyle = stoneColor;
        ctx.strokeStyle = crackColor;
        ctx.lineWidth = 1.5;

        // Helper to draw a rocky shape
        const drawStone = (x, y, size, points) => {
            ctx.beginPath();
            ctx.moveTo(x + size * Math.cos(0), y + size * Math.sin(0));
            for (let i = 1; i <= points; i++) {
                const angle = (i / points) * Math.PI * 2;
                ctx.lineTo(x + size * Math.cos(angle) * (0.8 + Math.random()*0.4), y + size * Math.sin(angle) * (0.8 + Math.random()*0.4));
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };

        // Legs
        drawStone(-e.r * 0.6, e.r * 0.5, e.r * 0.8, 5);
        drawStone(e.r * 0.6, e.r * 0.5, e.r * 0.8, 6);

        // Massive Arms
        const armSway = Math.sin(stepCycle) * 3;
        drawStone(-e.r * 1.2, -e.r * 0.2 + armSway, e.r, 7); // Back arm
        drawStone(e.r * 1.2, -e.r * 0.2 - armSway, e.r, 6); // Front arm

        // Torso
        drawStone(0, 0, e.r * 1.4, 8);
        
        // Head/Shoulders
        drawStone(0, -e.r * 1.5, e.r, 7);

        // Glowing Core/Eye
        ctx.shadowColor = coreColor;
        ctx.shadowBlur = 15;
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        // A crack in the head stone where the light shines through
        ctx.moveTo(-e.r * 0.3, -e.r * 1.5);
        ctx.lineTo(e.r * 0.3, -e.r * 1.6);
        ctx.lineTo(e.r * 0.2, -e.r * 1.4);
        ctx.lineTo(-e.r * 0.2, -e.r * 1.4);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Moss Details
        if (e.flash <= 0) {
            ctx.fillStyle = mossColor;
            ctx.fillRect(e.r * 0.8, -e.r * 1.2, e.r * 0.4, e.r * 0.3); // Shoulder moss
            ctx.fillRect(-e.r * 0.5, e.r * 0.8, e.r * 0.3, e.r * 0.2); // Leg moss
        }
    },

    imp_draw: (ctx, e, game) => {
        // --- Animation ---
        const flapCycle = game.animTime * 20 + e.animOff;
        const flap = Math.sin(flapCycle) * 4;
        const tailWhip = Math.sin(game.animTime * 10 + e.animOff) * e.r;
        ctx.translate(0, -e.r + flap);

        // --- Color Setup ---
        const skinColor = e.flash > 0 ? '#fff' : '#c75fd4';
        const wingColor = e.flash > 0 ? '#fff' : '#a14aa8';

        // --- Drawing (from back to front) ---

        // Lashing Tail
        ctx.strokeStyle = skinColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, e.r * 1.2);
        ctx.quadraticCurveTo(tailWhip, e.r * 1.8, tailWhip * 0.5, e.r * 2.5);
        ctx.stroke();
        // Tail Spade
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.moveTo(tailWhip * 0.5, e.r * 2.5);
        ctx.lineTo(tailWhip * 0.5 - 5, e.r * 2.5 - 5);
        ctx.lineTo(tailWhip * 0.5 + 5, e.r * 2.5 - 5);
        ctx.closePath();
        ctx.fill();

        // Wings
        ctx.fillStyle = wingColor;
        ctx.beginPath(); ctx.moveTo(-e.r*0.5, 0); ctx.lineTo(-e.r * 2, -flap - e.r*0.5); ctx.lineTo(-e.r, e.r); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(e.r*0.5, 0); ctx.lineTo(e.r * 2, -flap - e.r*0.5); ctx.lineTo(e.r, e.r); ctx.closePath(); ctx.fill();
        
        // Body
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.ellipse(0, e.r * 0.5, e.r, e.r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head with curved horns
        ctx.beginPath(); ctx.arc(0, -e.r*0.2, e.r*0.7, 0, Math.PI*2); ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = skinColor;
        ctx.beginPath(); ctx.moveTo(-e.r*0.4, -e.r*0.6); ctx.quadraticCurveTo(-e.r*0.8, -e.r*1.2, -e.r*0.5, -e.r*1.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(e.r*0.4, -e.r*0.6); ctx.quadraticCurveTo(e.r*0.8, -e.r*1.2, e.r*0.5, -e.r*1.3); ctx.stroke();

        if (e.flash <= 0) {
            // Eyes and Grin
            ctx.fillStyle = '#ff0';
            ctx.beginPath(); ctx.arc(-e.r*0.25, -e.r*0.2, 2, 0, Math.PI*2); ctx.arc(e.r*0.25, -e.r*0.2, 2, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, e.r * 0.3, 0.2 * Math.PI, 0.8 * Math.PI);
            ctx.stroke();
        }
    },

    _generic_slime_draw: (ctx, e, game) => {
        // --- Animation ---
        const stretch = Math.sin(game.animTime * 5 + e.animOff);
        ctx.scale(1 + stretch * 0.1, 1 - stretch * 0.1);

        // --- Color Setup ---
        if (e.flash > 0) {
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#fff';
        } else {
            const grad = ctx.createRadialGradient(0, -e.r, 0, 0, 0, e.r * 2);
            grad.addColorStop(0, '#b3ffb3');
            grad.addColorStop(1, '#3d993d');
            ctx.fillStyle = grad;
            ctx.strokeStyle = '#080';
        }
        ctx.globalAlpha *= 0.85;
        ctx.lineWidth = 2;

        // --- Main Body with Puddling Base ---
        ctx.beginPath();
        ctx.arc(0, 0, e.r, Math.PI, 0); // Top semi-circle
        // Puddling bottom edge instead of a straight line
        ctx.quadraticCurveTo(e.r * 0.5, e.r * 0.3, 0, e.r * 0.1);
        ctx.quadraticCurveTo(-e.r * 0.5, e.r * 0.3, -e.r, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // --- Animated Drip ---
        const dripLength = e.r * 0.5 + stretch * e.r * 0.4;
        ctx.beginPath();
        ctx.moveTo(e.r * 0.6, e.r * -0.2);
        ctx.quadraticCurveTo(e.r * 0.6, e.r * 0.2, e.r * 0.5, dripLength);
        ctx.arc(e.r * 0.5, dripLength, e.r * 0.15, 0, Math.PI * 2);
        ctx.fill();

        if (e.flash <= 0) {
            // Internal bubbles
            ctx.fillStyle = 'rgba(200, 255, 200, 0.5)';
            ctx.beginPath();
            ctx.arc(e.r*0.3, -e.r*0.2, e.r*0.15, 0, Math.PI*2);
            ctx.arc(-e.r*0.4, -e.r*0.1, e.r*0.1, 0, Math.PI*2);
            ctx.fill();

            // Improved Specular Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath();
            ctx.moveTo(-e.r * 0.6, -e.r * 0.4);
            ctx.quadraticCurveTo(-e.r * 0.2, -e.r * 0.8, 0, -e.r * 0.5);
            ctx.quadraticCurveTo(-e.r * 0.3, -e.r * 0.3, -e.r * 0.6, -e.r * 0.4);
            ctx.fill();
        }
    },

    slime_draw: (ctx, e, game) => { GAME_GRAPHICS._generic_slime_draw(ctx, e, game); },

    mini_slime_draw: (ctx, e, game) => { GAME_GRAPHICS._generic_slime_draw(ctx, e, game); },

    shaman_draw: (ctx, e, game) => {
        // --- Animation: A smooth, magical float ---
        const float = Math.sin(game.animTime * 2 + e.animOff) * 8;
        ctx.translate(0, float);

        // --- Color Setup ---
        const robeColor = e.flash > 0 ? '#fff' : '#7d2c96';
        const darkVoidColor = e.flash > 0 ? '#fff' : '#111';
        const eyeColor = '#ff00ff';
        const runeColor = '#ff00ff';

        // --- Orbiting Runes ---
        if (e.flash <= 0) {
            ctx.save();
            ctx.strokeStyle = runeColor;
            ctx.shadowColor = runeColor;
            ctx.shadowBlur = 10;
            ctx.lineWidth = 2;
            const runeCount = 3;
            for (let i = 0; i < runeCount; i++) {
                const angle = game.animTime * 1.5 + (i / runeCount) * Math.PI * 2 + e.animOff;
                const orbitRadius = e.r * (1.8 + Math.sin(angle * 3) * 0.2);
                const x = Math.cos(angle) * orbitRadius;
                const y = Math.sin(angle) * orbitRadius * 0.5 - e.r; // Elliptical orbit
                const size = e.r * 0.2;
                
                // Draw a simple rune shape
                ctx.beginPath();
                ctx.moveTo(x, y - size);
                ctx.lineTo(x, y + size);
                ctx.moveTo(x - size, y);
                ctx.lineTo(x + size, y);
                ctx.stroke();
            }
            ctx.restore();
        }

        // --- Flowing Robe ---
        ctx.fillStyle = robeColor;
        ctx.beginPath();
        ctx.moveTo(0, -e.r * 1.8); // Taller, more pointed hood
        ctx.lineTo(e.r * 1.2, e.r);
        // Make the bottom edge wave dynamically
        const waveCycle = game.animTime * 8 + e.animOff;
        ctx.quadraticCurveTo(0, e.r * 1.5 + Math.sin(waveCycle) * 4, -e.r * 1.2, e.r);
        ctx.closePath();
        ctx.fill();

        // --- Hooded Void ---
        ctx.fillStyle = darkVoidColor;
        ctx.beginPath();
        ctx.arc(0, -e.r * 1.1, e.r * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // --- Glowing Eyes ---
        if (e.flash <= 0) {
            ctx.fillStyle = eyeColor;
            ctx.shadowColor = eyeColor;
            ctx.shadowBlur = 12;
            const eyePulse = 2 + Math.sin(game.animTime * 5 + e.animOff) * 1;
            // Draw eyes as small glowing points with flare lines
            ctx.beginPath();
            ctx.arc(-e.r * 0.25, -e.r * 1.1, eyePulse, 0, Math.PI * 2);
            ctx.arc(e.r * 0.25, -e.r * 1.1, eyePulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-e.r * 0.25 - eyePulse*2, -e.r * 1.1 - 1, eyePulse*4, 2);
            ctx.fillRect(e.r * 0.25 - eyePulse*2, -e.r * 1.1 - 1, eyePulse*4, 2);
        }
    },

   behemoth_draw: (ctx, e, game) => {
        // --- Animation: A heavy, ground-shaking stomp ---
        const stompCycle = game.animTime * 2 + e.animOff;
        const heavyBob = Math.abs(Math.sin(stompCycle)) * 5;
        const heavySway = Math.sin(stompCycle * 0.5) * 4;

        // On the "down" part of the bob, create a dust/shake effect
        if (Math.sin(stompCycle) > 0.95 && Math.random() < 0.5) {
            game.particles.push(new Particle(game, e.x + M.rand(-e.r, e.r), e.y + e.r, '#555', 3, -10, 0.3));
        }

        ctx.translate(heavySway, heavyBob);

        // --- Color Setup ---
        const fleshColor = e.flash > 0 ? '#fff' : '#4a3a3a';
        const armorColor = e.flash > 0 ? '#fff' : '#5a5a6a';
        const boneColor = e.flash > 0 ? '#fff' : '#b0b0a1';
        const eyeColor = '#f00';

        // --- Drawing (from back to front) ---
        
        // Withered Back Arm
        ctx.fillStyle = fleshColor;
        ctx.fillRect(e.r * 0.6, -e.r * 0.5, e.r * 0.5, e.r * 1.2);

        // Thick Legs
        ctx.fillRect(-e.r * 0.9, e.r * 0.8, e.r * 0.8, e.r * 1.2);
        ctx.fillRect(e.r * 0.1, e.r * 0.8, e.r * 0.8, e.r * 1.2);

        // Massive, Hunched Torso
        ctx.beginPath();
        ctx.moveTo(-e.r, -e.r * 1.5);
        ctx.quadraticCurveTo(0, -e.r * 2, e.r * 1.2, -e.r * 1.2);
        ctx.lineTo(e.r * 1.2, e.r);
        ctx.lineTo(-e.r, e.r * 1.2);
        ctx.closePath();
        ctx.fill();

        // Exposed Ribs
        if (e.flash <= 0) {
            ctx.strokeStyle = boneColor;
            ctx.lineWidth = 4;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(e.r * 0.5, -e.r * 0.5 + i * e.r * 0.3);
                ctx.lineTo(e.r, -e.r * 0.4 + i * e.r * 0.3);
                ctx.stroke();
            }
        }

        // Huge Front Arm/Club
        ctx.fillStyle = fleshColor;
        ctx.beginPath();
        ctx.moveTo(-e.r * 0.5, -e.r);
        ctx.lineTo(-e.r * 2, e.r * 1.5); // Wider at the bottom
        ctx.lineTo(-e.r * 1.5, e.r * 1.8);
        ctx.lineTo(-e.r * 0.2, -e.r * 0.8);
        ctx.closePath();
        ctx.fill();

        // Head with Bony Armor Plates
        ctx.fillStyle = armorColor;
        ctx.fillRect(-e.r * 0.8, -e.r * 1.8, e.r * 1.6, e.r);
        ctx.fillStyle = fleshColor;
        ctx.fillRect(-e.r * 0.6, -e.r * 1.7, e.r * 1.2, e.r);

        // Single Glowing Eye Slit
        if (e.flash <= 0) {
            ctx.fillStyle = eyeColor;
            ctx.shadowColor = eyeColor;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.ellipse(0, -e.r * 1.3, e.r * 0.4, e.r * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    revenant_draw: (ctx, e, game) => {
        // --- Animation: A smooth, inexorable float ---
        const floatCycle = game.animTime * 1.5 + e.animOff;
        const float = Math.sin(floatCycle) * 4;
        ctx.translate(0, float - e.r * 0.5);

        // --- Color Setup ---
        const shadowColor = e.flash > 0 ? '#fff' : '#1a1a2a';
        const coreColor = '#ff00ff';

        // --- Flowing Shadow Cloak (multiple layers for depth) ---
        for (let i = 0; i < 3; i++) {
            const wave = game.animTime * (5 - i) + e.animOff;
            ctx.fillStyle = shadowColor;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.moveTo(0, -e.r * 2); // Tall, pointed hood
            ctx.quadraticCurveTo(e.r * (1.5 - i*0.2), 0, e.r * (1.2 - i*0.2), e.r * 1.8 + Math.sin(wave) * 5);
            ctx.lineTo(-e.r * (1.2 - i*0.2), e.r * 1.8 + Math.cos(wave) * 5);
            ctx.quadraticCurveTo(-e.r * (1.5 - i*0.2), 0, 0, -e.r * 2);
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // --- Pulsing Core ---
        if (e.flash <= 0) {
            const pulse = 1 + Math.sin(game.animTime * 5 + e.animOff) * 0.2;
            const grad = ctx.createRadialGradient(0, -e.r * 0.5, 0, 0, -e.r * 0.5, e.r * 0.6 * pulse);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(0.3, coreColor);
            grad.addColorStop(1, 'rgba(255,0,255,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, -e.r * 0.5, e.r * 0.6 * pulse, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Detached, Menacing Claws ---
        const clawSway = Math.sin(floatCycle * 2) * e.r * 0.2;
        ctx.fillStyle = shadowColor;
        // Right Claw
        ctx.beginPath();
        ctx.moveTo(e.r * 0.8 + clawSway, e.r * 0.2);
        ctx.lineTo(e.r * 1.2 + clawSway, e.r * 0.3);
        ctx.lineTo(e.r * 1.3 + clawSway, e.r * 0.8);
        ctx.lineTo(e.r * 0.9 + clawSway, e.r * 0.7);
        ctx.closePath();
        ctx.fill();
        // Left Claw
        ctx.beginPath();
        ctx.moveTo(-e.r * 0.8 - clawSway, e.r * 0.2);
        ctx.lineTo(-e.r * 1.2 - clawSway, e.r * 0.3);
        ctx.lineTo(-e.r * 1.3 - clawSway, e.r * 0.8);
        ctx.lineTo(-e.r * 0.9 - clawSway, e.r * 0.7);
        ctx.closePath();
        ctx.fill();
    },

    // Ally visuals
    skeleton_ally_draw: (ally, ctx, game) => {
        ally.drawShadow(ctx); ctx.save(); ctx.translate(ally.x, ally.y);
        const bob = Math.sin(game.animTime * 6 + ally.animOff) * 2;
        ctx.fillStyle = '#d1d1e0'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        ctx.translate(0, bob-ally.r);
        // Draw skeleton body (similar to enemy but with different colors)
        ctx.beginPath(); ctx.arc(0, 0, ally.r/2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillRect(-ally.r*0.2, ally.r/2, ally.r*0.4, ally.r);
        ctx.fillRect(-ally.r*0.4, ally.r*1.5, ally.r*0.2, ally.r*0.8);
        ctx.fillRect(ally.r*0.2, ally.r*1.5, ally.r*0.2, ally.r*0.8);
        // Add a crude shield for visual distinction
        ctx.fillStyle = '#705a41';
        ctx.beginPath(); ctx.ellipse(-ally.r*0.7, ally.r, ally.r*0.4, ally.r*0.6, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.arc(-ally.r*0.7, ally.r, ally.r*0.1, 0, Math.PI*2); ctx.fill();
        // Eyes
        ctx.fillStyle = '#0ff'; ctx.shadowColor = '#0ff'; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(-ally.r*0.15, 0, 2, 0, Math.PI*2); ctx.arc(ally.r*0.15, 0, 2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    },
    spirit_ally_draw: (ally, ctx, game) => {
        ctx.save();
        const pulse = 1 + Math.sin(game.animTime * 4 + ally.animOff) * 0.1;
        ctx.globalAlpha = 0.7;
        // Create a glowing, pulsing core
        const grad = ctx.createRadialGradient(ally.x, ally.y, 0, ally.x, ally.y, ally.r * pulse);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.5, 'rgba(224, 224, 224, 0.8)');
        grad.addColorStop(1, 'rgba(200, 200, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(ally.x, ally.y, ally.r * pulse, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    },
    orbit_blade_draw: (ctx, x, y, size, rotation) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rotation * 2);
        ctx.fillStyle = '#cfa538'; ctx.beginPath(); ctx.moveTo(0, -size*1.5); ctx.lineTo(-size, size); ctx.lineTo(size, size); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -size*1.2); ctx.lineTo(-size*0.8, size*0.8); ctx.lineTo(size*0.8, size*0.8); ctx.closePath(); ctx.fill();
        ctx.restore();
    },
    garlic_aura_draw: (ctx, aura, game) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = 1 + Math.sin(game.animTime*8)*0.05; 
        const rr = aura.r * pulse; 
        const grad = ctx.createRadialGradient(aura.x, aura.y - 10, rr*0.7, aura.x, aura.y - 10, rr);
        grad.addColorStop(0, 'rgba(100, 0, 0, 0)'); grad.addColorStop(0.8, 'rgba(200, 20, 20, 0.3)'); grad.addColorStop(1, 'rgba(255, 50, 50, 0.6)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(aura.x, aura.y - 10, rr, 0, Math.PI*2); ctx.fill();
        ctx.translate(aura.x, aura.y - 10); ctx.rotate(game.animTime);
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)'; ctx.lineWidth = 2;
        for(let i=0; i<6; i++){
            ctx.rotate(Math.PI/3); ctx.beginPath(); ctx.moveTo(rr-10, -5); ctx.lineTo(rr, 0); ctx.lineTo(rr-10, 5); ctx.stroke();
        }
        ctx.restore();
    },
    laser_beam_draw: (ctx, player, angle, area, game) => {
        const w = C.WIDTH*2; const h = 40 * area * (0.5 + Math.random()*0.5);
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(angle);
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createLinearGradient(0, -h/2, 0, h/2);
        grad.addColorStop(0, 'rgba(255, 100, 255, 0)'); grad.addColorStop(0.2, 'rgba(255, 200, 255, 0.8)'); grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.8, 'rgba(255, 200, 255, 0.8)'); grad.addColorStop(1, 'rgba(255, 100, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, -h/2, w, h);
        ctx.restore();
    },
    holy_ground_draw: (ctx, effect, game) => {
    const r = effect.r;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const holyAlpha = Math.sin(effect.life * Math.PI / effect.maxLife) * 0.4;
    const holyGrad = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, r);
    holyGrad.addColorStop(0, `rgba(255, 255, 150, ${holyAlpha})`);
    holyGrad.addColorStop(1, `rgba(255, 215, 0, 0)`);
    ctx.fillStyle = holyGrad;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
},

poison_puddle_draw: (ctx, effect, game) => {
    const r = effect.r;
    const cfg = GAME_DATA.CONFIG.STATUS_EFFECTS.poisonPuddle;
    ctx.save();
    const puddleAlpha = Math.min(1, effect.life / 2.0) * 0.6;
    ctx.globalAlpha = puddleAlpha;
    const poisonGrad = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, r);
    poisonGrad.addColorStop(0.5, cfg.color);
    poisonGrad.addColorStop(1, 'rgba(102, 204, 0, 0)');
    ctx.fillStyle = poisonGrad;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
},
    //Status Effect Visuals
    status_shielded: (ctx, e, game) => {
        ctx.fillStyle = 'rgba(100,100,255,0.5)';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 1.2, 0, Math.PI * 2);
        ctx.fill();
    },
    status_cursed: (ctx, e, game) => {
        ctx.fillStyle = 'rgba(138,43,226, 0.5)';
        ctx.beginPath();
        ctx.moveTo(e.x, e.y - e.r);
        ctx.lineTo(e.x + 5, e.y - e.r - 5);
        ctx.lineTo(e.x - 5, e.y - e.r - 5);
        ctx.closePath();
        ctx.fill();
    },
    status_chilled_ground: (ctx, e, game) => {
        const pulse = Math.sin(game.animTime * 5) * 0.15 + 0.85;
        ctx.fillStyle = `rgba(173, 216, 230, ${0.4 * pulse})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        },

    // =========================================================================
    // ENGINE & CORE ENTITY VISUALS
    // =========================================================================
    
    // Generic shadow for all entities
    entity_draw_shadow: (entity, ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(entity.x, entity.y + entity.r*0.6, entity.r, entity.r*0.4, 0, 0, Math.PI*2);
        ctx.fill();
    },

    // Player character
    player_draw: (player, ctx, game) => {
        if (player.invulnTimer > 0 && Math.floor(game.time * 15) % 2 === 0) return;
        GAME_GRAPHICS.entity_draw_shadow(player, ctx);
        ctx.save();
        ctx.translate(Math.floor(player.x), Math.floor(player.y));
        ctx.scale(player.facingX, 1);
        const bob = Math.sin(player.walkFrame) * 2;
        const legSwing = Math.sin(player.walkFrame);
        ctx.fillStyle = '#1a0505';
        ctx.beginPath();
        ctx.moveTo(-6, -18 + bob);
        ctx.lineTo(-12, 10);
        ctx.lineTo(12, 10);
        ctx.lineTo(6, -18 + bob);
        ctx.fill();
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(-4, 5, 3, 10 + legSwing * 3);
        ctx.fillRect(1, 5, 3, 10 - legSwing * 3);
        ctx.fillStyle = '#333';
        ctx.fillRect(-5, -10 + bob, 10, 15);
        ctx.fillStyle = '#cfa538';
        ctx.fillRect(-1, -10 + bob, 2, 15);
        ctx.fillRect(-5, -1 + bob, 10, 2);
        ctx.fillStyle = '#e0c0a0';
        ctx.beginPath();
        ctx.arc(0, -16 + bob, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.ellipse(0, -20 + bob, 10, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-5, -26 + bob, 10, 6);
        ctx.fillStyle = '#800';
        ctx.fillRect(-5, -22 + bob, 10, 2);
        ctx.fillStyle = '#2a0a0a';
        ctx.beginPath();
        ctx.moveTo(-5, -10 + bob);
        ctx.lineTo(-10, 8);
        ctx.lineTo(-5, 5);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(5, -10 + bob);
        ctx.lineTo(10, 8);
        ctx.lineTo(5, 5);
        ctx.fill();
        ctx.restore();
        if (player.rechargeShield > 0) {
            ctx.strokeStyle = '#cfa538';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.r * 1.5, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (player.tempShield > 0) {
            ctx.fillStyle = `rgba(173, 216, 230, ${0.2 + (player.tempShield / 10) * 0.4})`;
            ctx.beginPath();
            ctx.arc(player.x, player.y, player.r * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // Particle effect
    particle_draw: (p, ctx) => {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
    },

    // Floating damage numbers
    damage_text_draw: (dt, ctx) => {
        const cx = dt.x;
        const cy = dt.y;
        ctx.save();
        ctx.font = `bold ${dt.size}px 'Crimson Pro'`;
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        ctx.globalAlpha = Math.min(1, dt.life*2);
        ctx.strokeText(dt.text, cx, cy);
        ctx.fillStyle = dt.color;
        ctx.fillText(dt.text, cx, cy);
        ctx.restore();
    },

    // Lightning visual effect
    lightning_effect_draw: (effect, ctx) => {
        ctx.save();
        const fade = effect.life / 0.3;
        const flicker = fade * M.rand(0.8, 1.0);
        ctx.globalCompositeOperation = 'lighter';
        const fullPath = [effect.startPoint, ...effect.path];
        if (fullPath.length < 2) {
            ctx.restore();
            return;
        }
        for (let i = 1; i < fullPath.length; i++) {
            const startNode = fullPath[i - 1];
            const endNode = fullPath[i];
            const startX = startNode.x;
            const startY = startNode.y;
            const endX = endNode.x;
            const endY = endNode.y;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            const segments = 5;
            for (let j = 1; j < segments; j++) {
                const p = j / segments;
                const iX = M.lerp(startX, endX, p);
                const iY = M.lerp(startY, endY, p);
                const a = M.angle(startX, startY, endX, endY) + Math.PI / 2;
                const offset = M.rand(-15, 15);
                ctx.lineTo(iX + Math.cos(a) * offset, iY + Math.sin(a) * offset);
            }
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = `rgba(255, 255, 150, ${flicker * 0.8})`;
            ctx.lineWidth = 8;
            ctx.stroke();
            ctx.strokeStyle = `rgba(255, 255, 255, ${flicker})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        ctx.restore();
    }
    
};
// =========================================================================
// OTHER DYNAMIC VISUALS
// =========================================================================

function generateBackgroundPattern(tileSize) {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = tileSize;
    bgCanvas.height = tileSize;
    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.fillStyle = '#2a2a30';
    bgCtx.fillRect(0, 0, tileSize, tileSize);
    bgCtx.strokeStyle = '#15151a';
    bgCtx.lineWidth = 2;
    for (let y = 0; y < tileSize; y += 64) {
        for (let x = 0; x < tileSize; x += 64) {
            bgCtx.fillStyle = Math.random() > 0.5 ? '#2e2e34' : '#27272c';
            const off = () => (Math.random() - 0.5) * 8;
            bgCtx.beginPath();
            bgCtx.moveTo(x + off(), y + off());
            bgCtx.lineTo(x + 64 + off(), y + off());
            bgCtx.lineTo(x + 64 + off(), y + 64 + off());
            bgCtx.lineTo(x + off(), y + 64 + off());
            bgCtx.closePath();
            bgCtx.fill();
            bgCtx.stroke();
            if (Math.random() > 0.7) {
                bgCtx.fillStyle = '#111';
                for (let i = 0; i < 5; i++) bgCtx.fillRect(x + Math.random() * 60, y + Math.random() * 60, 2, 2);
            }
        }
    }
    return bgCtx.createPattern(bgCanvas, 'repeat');
}

GAME_GRAPHICS.experience_orb_draw = (orb, ctx, game) => {
    GAME_GRAPHICS.entity_draw_shadow(orb, ctx);
    const hover = Math.sin(game.animTime * 3 + orb.animOff) * 4;
    ctx.save();
    ctx.translate(orb.x, orb.y + hover - 5);
    ctx.beginPath();
    ctx.moveTo(0, -orb.r);
    ctx.lineTo(orb.r * 0.7, 0);
    ctx.lineTo(0, orb.r);
    ctx.lineTo(-orb.r * 0.7, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(-orb.r, -orb.r, orb.r, orb.r);
    g.addColorStop(0, orb.cols[0]);
    g.addColorStop(1, orb.cols[1]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -orb.r);
    ctx.lineTo(0, orb.r);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-orb.r * 0.7, 0);
    ctx.lineTo(orb.r * 0.7, 0);
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = orb.cols[0];
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, orb.r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
};

GAME_GRAPHICS.chest_draw = (chest, ctx, game) => {
    if (Math.random() < 0.05) game.particles.push(new Particle(game, chest.x + M.rand(-15, 15), chest.y, '#ffd700', 2, -50, 0.5));
    ctx.globalAlpha = Math.min(1, chest.life);
    GAME_GRAPHICS.entity_draw_shadow(chest, ctx);
    const hover = Math.sin(game.animTime * 2 + chest.animOff) * 3;
    ctx.save();
    ctx.translate(chest.x, chest.y + hover - 10);
    ctx.fillStyle = '#6d4c22';
    ctx.fillRect(-20, -10, 40, 25);
    ctx.fillStyle = '#412d14';
    ctx.fillRect(-22, -12, 44, 5);
    ctx.fillStyle = '#cfa538';
    ctx.fillRect(-24, -15, 48, 5);
    ctx.fillRect(-24, 13, 48, 4);
    ctx.fillRect(-24, -15, 4, 32);
    ctx.fillRect(20, -15, 4, 32);
    ctx.fillStyle = '#222';
    ctx.fillRect(-5, 2, 10, 10);
    ctx.restore();
    ctx.globalAlpha = 1;
};

GAME_GRAPHICS.cursed_doubloon_draw = (doubloon, ctx, game) => {
    GAME_GRAPHICS.entity_draw_shadow(doubloon, ctx);
    const hover = Math.sin(game.animTime * 4 + doubloon.animOff) * 3;
    ctx.save();
    ctx.translate(doubloon.x, doubloon.y + hover - doubloon.r * 0.5);
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(0, 0, doubloon.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(0, 0, doubloon.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
};


const GAME_AUDIO_BANK = {
    'axe': (sfx) => { const filt = sfx.ctx.createBiquadFilter(); filt.type='lowpass'; filt.Q.value=5; filt.frequency.setValueAtTime(200, sfx.ctx.currentTime); filt.frequency.linearRampToValueAtTime(800, sfx.ctx.currentTime+0.15); filt.frequency.linearRampToValueAtTime(200, sfx.ctx.currentTime+0.3); const e = sfx.env(sfx.sfxGain, 0.05, 0.25, 0, 0, 0.5);  filt.connect(e); sfx.noise(filt).stop(sfx.ctx.currentTime+0.35); },
    'bloodtome': (sfx) => { sfx.osc(110, 'sawtooth', sfx.env(sfx.sfxGain, 0.01, 0.1, 0, 0.1, 0.3)).stop(sfx.ctx.currentTime + 0.25); },
    'cardhover': (sfx) => { const filt = sfx.ctx.createBiquadFilter(); filt.type='bandpass'; filt.frequency.value=3000; filt.Q.value=10; filt.connect(sfx.env(sfx.sfxGain, 0, 0.02, 0, 0, 0.1)); sfx.noise(filt).stop(sfx.ctx.currentTime+0.03); },
    'chest': (sfx) => { [659.25, 783.99, 987.77].forEach((f, i) => { const t = sfx.ctx.currentTime + i*0.1; sfx.osc(f, 'triangle', sfx.env(sfx.sfxGain, 0.01, 0.3, 0, 0, 0.4, t), t).stop(t+0.4); }); },
    'gameover': (sfx) => { const e = sfx.env(sfx.sfxGain, 0.1, 2, 0.5, 1, 0.2); const o1 = sfx.osc(196, 'sawtooth', e); const o2 = sfx.osc(138.59, 'sawtooth', e); o1.frequency.exponentialRampToValueAtTime(49, sfx.ctx.currentTime+3); o2.frequency.exponentialRampToValueAtTime(34, sfx.ctx.currentTime+3); o1.stop(sfx.ctx.currentTime+3.5); o2.stop(sfx.ctx.currentTime+3.5); },
    'garlic': (sfx) => { sfx.osc(55, 'sine', sfx.env(sfx.sfxGain, 0.05, 0.1, 0, 0, 0.3)).stop(sfx.ctx.currentTime+0.2); },
    'gem': (sfx) => { const e = sfx.env(sfx.sfxGain, 0.005, 0.05, 0.5, 0.1, 0.3); sfx.osc(987.77, 'triangle', e).stop(sfx.ctx.currentTime+0.08); sfx.osc(1318.51, 'sine', e, sfx.ctx.currentTime+0.08).stop(sfx.ctx.currentTime+0.3); },
    'heal': (sfx) => { const o = sfx.osc(220, 'triangle', sfx.env(sfx.sfxGain, 0.1, 0.4, 0, 0, 0.4)); o.frequency.linearRampToValueAtTime(440, sfx.ctx.currentTime+0.5); o.stop(sfx.ctx.currentTime+0.55); },
    'hit': (sfx) => { const filt = sfx.ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.setValueAtTime(600,sfx.ctx.currentTime); filt.frequency.exponentialRampToValueAtTime(100,sfx.ctx.currentTime+0.1); const e = sfx.env(sfx.sfxGain, 0.001, 0.1, 0, 0, 1.4); filt.connect(e); sfx.noise(filt).stop(sfx.ctx.currentTime+0.15); },
    'hurt': (sfx) => { const e = sfx.env(sfx.sfxGain, 0.01, 0.2, 0, 0, 0.6); sfx.noise(e).stop(sfx.ctx.currentTime+0.25); sfx.osc(150, 'sawtooth', sfx.env(sfx.sfxGain,0.05,0.3,0,0, 0.5)).frequency.exponentialRampToValueAtTime(50, sfx.ctx.currentTime+0.3); },
    'levelup': (sfx) => { [261.63, 329.63, 392.00, 523.25].forEach((f,i) => { const t = sfx.ctx.currentTime + i*0.08; sfx.osc(f, 'triangle', sfx.env(sfx.sfxGain, 0.02, 0.4, 0, 0, 0.4, t), t).stop(t+0.5); sfx.osc(f*2, 'sine', sfx.env(sfx.sfxGain, 0.02, 0.3, 0, 0, 0.2, t), t).stop(t+0.4); }); },
    'lightning': (sfx) => { const filt = sfx.ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 4000; filt.Q.value = 20; const e = sfx.env(sfx.sfxGain, 0.01, 0.1, 0, 0.1, 1.5); filt.connect(e); sfx.noise(filt).stop(sfx.ctx.currentTime + 0.2); },
    'start': (sfx) => { sfx.osc(880, 'square', sfx.env(sfx.sfxGain, 0.005, 0.05, 0, 0, 0.3)).stop(sfx.ctx.currentTime+0.1); },
    'summon': (sfx) => { const e = sfx.env(sfx.sfxGain, 0.1, 0.5, 0, 0.2, 0.05); const o1 = sfx.osc(100, 'sawtooth', e); const o2 = sfx.osc(102, 'sawtooth', e); o1.stop(sfx.ctx.currentTime+0.8); o2.stop(sfx.ctx.currentTime+0.8); },
    'ui': (sfx) => { sfx.osc(880, 'square', sfx.env(sfx.sfxGain, 0.005, 0.05, 0, 0, 0.3)).stop(sfx.ctx.currentTime+0.1); },
    'wand': (sfx) => { const o = sfx.osc(880, 'sine', sfx.env(sfx.sfxGain, 0.01, 0.2, 0, 0, 0.4));  o.frequency.exponentialRampToValueAtTime(440, sfx.ctx.currentTime+0.2); o.stop(sfx.ctx.currentTime+0.25); },
    'whip': (sfx) => { const filt = sfx.ctx.createBiquadFilter(); filt.type='highpass'; filt.frequency.value=2000; const e = sfx.env(sfx.sfxGain, 0.001, 0.05, 0, 0.1, 0.4); filt.connect(e); sfx.noise(filt).stop(sfx.ctx.currentTime+0.2); const o = sfx.osc(1500, 'sawtooth', sfx.env(sfx.sfxGain,0,0.1,0,0, 0.3)); o.frequency.exponentialRampToValueAtTime(200, sfx.ctx.currentTime+0.1); o.stop(sfx.ctx.currentTime+0.1); },
};