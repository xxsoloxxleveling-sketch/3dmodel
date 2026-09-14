/**
 * 2D Floor Plan Minimap Radar HUD
 * Automatically switches between Downstairs (Floor 1) and Upstairs (Floor 2)
 * and renders a real-time top-down schematic with player position & vision cone.
 */
class Minimap {
    constructor(canvasId, headerId) {
        this.canvas = document.getElementById(canvasId);
        this.header = document.getElementById(headerId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.isVisible = true;

        // Minimap world bounds (in meters)
        // House spans X: -7.5m to +7.5m, Z: 5.0m to 22.0m
        this.worldMinX = -8.5;
        this.worldMaxX = 8.5;
        this.worldMinZ = 4.0;
        this.worldMaxZ = 24.0;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * (window.devicePixelRatio || 1);
        this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    }

    toggle() {
        this.isVisible = !this.isVisible;
        const container = document.getElementById('minimap-container');
        if (container) {
            container.style.display = this.isVisible ? 'flex' : 'none';
        }
        return this.isVisible;
    }

    worldToMap(x, z) {
        const normX = (x - this.worldMinX) / (this.worldMaxX - this.worldMinX);
        const normZ = (z - this.worldMinZ) / (this.worldMaxZ - this.worldMinZ);

        return {
            x: normX * this.canvas.width,
            // Invert Z so Front of house (+Z) is at bottom/front of radar
            y: (1.0 - normZ) * this.canvas.height
        };
    }

    update(playerX, playerY, playerZ, playerYaw) {
        if (!this.isVisible || !this.ctx) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        const isUpstairs = (playerY >= 2.3);
        if (this.header) {
            this.header.textContent = isUpstairs ? "Floor 2 • Upstairs" : "Floor 1 • Downstairs";
        }

        // 1. Background grid
        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        const step = w / 6;
        for (let x = 0; x < w; x += step) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, h);
            this.ctx.stroke();
        }
        for (let y = 0; y < h; y += step) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(w, y);
            this.ctx.stroke();
        }

        // 2. Draw House Outer Perimeter & Walls
        this.drawFloorPlan(isUpstairs);

        // 3. Draw Player Dot & Vision Cone
        const pMap = this.worldToMap(playerX, playerZ);

        // Vision Cone
        const coneLength = 32 * (window.devicePixelRatio || 1);
        const fov = 0.55; // radians (~32 deg half-angle)

        // Note: playerYaw = 0 is looking towards -Z (North/Top of map)
        const angle = -playerYaw - Math.PI / 2;

        const grad = this.ctx.createRadialGradient(pMap.x, pMap.y, 2, pMap.x, pMap.y, coneLength);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.moveTo(pMap.x, pMap.y);
        this.ctx.arc(pMap.x, pMap.y, coneLength, angle - fov, angle + fov);
        this.ctx.closePath();
        this.ctx.fill();

        // Player Circle
        this.ctx.fillStyle = '#38bdf8';
        this.ctx.beginPath();
        this.ctx.arc(pMap.x, pMap.y, 4.5 * (window.devicePixelRatio || 1), 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
    }

    drawFloorPlan(isUpstairs) {
        this.ctx.strokeStyle = '#64748b';
        this.ctx.lineWidth = 2 * (window.devicePixelRatio || 1);

        if (!isUpstairs) {
            // Downstairs: Front Porch + Main Body + Rear Deck
            // Main body: X [-4.5, 4.5], Z [8.5, 18.0]
            const p1 = this.worldToMap(-4.5, 18.0);
            const p2 = this.worldToMap(4.5, 8.5);
            this.ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

            // Front Porch: X [-4.5, 4.5], Z [18.0, 21.0]
            this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
            const pp1 = this.worldToMap(-4.5, 21.0);
            const pp2 = this.worldToMap(4.5, 18.0);
            this.ctx.strokeRect(pp1.x, pp1.y, pp2.x - pp1.x, pp2.y - pp1.y);

            // Interior Divider: Living / Kitchen (Center Line at X = 0)
            this.ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
            const d1 = this.worldToMap(0, 18.0);
            const d2 = this.worldToMap(0, 13.0);
            this.ctx.beginPath();
            this.ctx.moveTo(d1.x, d1.y);
            this.ctx.lineTo(d2.x, d2.y);
            this.ctx.stroke();

            // Room labels
            this.drawLabel("Porch", 0, 19.5, 'rgba(56, 189, 248, 0.8)');
            this.drawLabel("Living", -2.2, 15.5, '#94a3b8');
            this.drawLabel("Kitchen", 2.2, 15.5, '#94a3b8');
            this.drawLabel("Stairs", 0, 11.5, '#64748b');
        } else {
            // Upstairs: 2 Bedrooms, Bath, Landing
            const p1 = this.worldToMap(-4.5, 18.0);
            const p2 = this.worldToMap(4.5, 8.5);
            this.ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);

            // Bedroom 1 / Bedroom 2 divider
            this.ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
            const d1 = this.worldToMap(0, 18.0);
            const d2 = this.worldToMap(0, 13.5);
            this.ctx.beginPath();
            this.ctx.moveTo(d1.x, d1.y);
            this.ctx.lineTo(d2.x, d2.y);
            this.ctx.stroke();

            this.drawLabel("Master Bed", -2.2, 16.0, '#94a3b8');
            this.drawLabel("Bed 2", 2.2, 16.0, '#94a3b8');
            this.drawLabel("Landing", 0, 13.0, '#64748b');
            this.drawLabel("Bath", 0, 10.0, '#64748b');
        }
    }

    drawLabel(text, worldX, worldZ, color) {
        const p = this.worldToMap(worldX, worldZ);
        this.ctx.font = `${9 * (window.devicePixelRatio || 1)}px sans-serif`;
        this.ctx.fillStyle = color;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, p.x, p.y);
    }
}
