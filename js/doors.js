/**
 * Interactive Openable Door System
 * Realistic 3D doors with hinge pivot swinging, collision toggling,
 * proximity interaction prompts, and synthesized latch sounds.
 */
class DoorManager {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.doors = [];
        this.nearestDoor = null;
        this.interactionDistance = 2.2; // meters

        // Audio Context for door creak and latch sounds
        this.audioCtx = null;

        // UI Prompt element
        this.promptEl = document.getElementById('door-prompt');
        this.mobileDoorBtn = document.getElementById('mbtn-door');

        this.initDoors();
    }

    initAudio() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playDoorSound(isOpen) {
        this.initAudio();
        if (!this.audioCtx) return;

        try {
            const t = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            if (isOpen) {
                // Wooden creak & latch click
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(140, t);
                osc.frequency.exponentialRampToValueAtTime(80, t + 0.25);
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            } else {
                // Thud / shut latch
                osc.type = 'sine';
                osc.frequency.setValueAtTime(90, t);
                osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
                gain.gain.setValueAtTime(0.18, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            }

            osc.start(t);
            osc.stop(t + 0.35);
        } catch (e) {
            // Audio policy fallback
        }
    }

    initDoors() {
        // Shared Wood Door Material
        const doorWoodMat = new THREE.MeshStandardMaterial({
            color: 0x8b5a2b, // warm cedar / chestnut wood
            roughness: 0.6,
            metalness: 0.05
        });

        // Shared Brass Knob Material
        const knobMat = new THREE.MeshStandardMaterial({
            color: 0xd4af37, // brass gold
            roughness: 0.25,
            metalness: 0.85
        });

        // Standard door configurations for the farmhouse
        const doorConfigs = [
            {
                id: 'front_door',
                name: 'Front Entry Door',
                x: 0.0, y: 0.44, z: 18.0, // Main front doorway into living room
                width: 0.96, height: 2.15, thickness: 0.05,
                hingeSide: -1, // -1 = left hinge, 1 = right hinge
                openAngle: -Math.PI / 2, // swings inward into room
                rotY: 0
            },
            {
                id: 'back_door',
                name: 'Rear Deck Door',
                x: 0.0, y: 0.44, z: 8.5, // Back doorway onto rear yard/deck
                width: 0.92, height: 2.15, thickness: 0.05,
                hingeSide: 1,
                openAngle: Math.PI / 2,
                rotY: 0
            },
            {
                id: 'powder_door',
                name: 'Downstairs Bath Door',
                x: 2.2, y: 0.44, z: 12.0,
                width: 0.80, height: 2.05, thickness: 0.045,
                hingeSide: -1,
                openAngle: -Math.PI / 2,
                rotY: Math.PI / 2
            },
            {
                id: 'master_bed_door',
                name: 'Master Bedroom Door',
                x: -0.6, y: 2.82, z: 13.5, // 2nd floor landing to master
                width: 0.82, height: 2.05, thickness: 0.045,
                hingeSide: -1,
                openAngle: -Math.PI / 2,
                rotY: 0
            },
            {
                id: 'bed2_door',
                name: 'Bedroom 2 Door',
                x: 0.6, y: 2.82, z: 13.5, // 2nd floor landing to bed 2
                width: 0.82, height: 2.05, thickness: 0.045,
                hingeSide: 1,
                openAngle: Math.PI / 2,
                rotY: 0
            },
            {
                id: 'upstairs_bath_door',
                name: 'Upstairs Bath Door',
                x: 0.0, y: 2.82, z: 11.2, // 2nd floor bath
                width: 0.80, height: 2.05, thickness: 0.045,
                hingeSide: -1,
                openAngle: -Math.PI / 2,
                rotY: 0
            }
        ];

        doorConfigs.forEach(cfg => {
            const doorObj = this.createDoorMesh(cfg, doorWoodMat, knobMat);
            this.scene.add(doorObj.pivot);
            this.doors.push(doorObj);
        });
    }

    createDoorMesh(cfg, woodMat, knobMat) {
        // Pivot group positioned at the hinge edge
        const pivot = new THREE.Group();
        pivot.position.set(cfg.x, cfg.y, cfg.z);
        pivot.rotation.y = cfg.rotY;

        // Door Panel
        const panelGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.thickness);
        const panel = new THREE.Mesh(panelGeo, woodMat);
        panel.castShadow = true;
        panel.receiveShadow = true;

        // Shift panel so pivot is at the hinge
        const hingeOffset = (cfg.hingeSide === -1) ? (cfg.width / 2) : (-cfg.width / 2);
        panel.position.set(hingeOffset, cfg.height / 2, 0);
        pivot.add(panel);

        // Door Handle / Knob
        const knobGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.08, 12);
        const knob = new THREE.Mesh(knobGeo, knobMat);
        knob.rotation.x = Math.PI / 2;
        const knobX = (cfg.hingeSide === -1) ? (cfg.width * 0.4) : (-cfg.width * 0.4);
        knob.position.set(knobX, 0, 0.05);
        panel.add(knob);

        // Collision box for closed door
        const collisionBox = new THREE.Box3();
        const updateBox = () => {
            collisionBox.setFromObject(panel);
        };
        updateBox();

        return {
            id: cfg.id,
            name: cfg.name,
            pivot: pivot,
            panel: panel,
            collisionBox: collisionBox,
            updateBox: updateBox,
            isOpen: false,
            currentAngle: 0,
            targetAngle: 0,
            openAngle: cfg.openAngle,
            centerPos: new THREE.Vector3(cfg.x, cfg.y + cfg.height / 2, cfg.z),
            width: cfg.width,
            height: cfg.height
        };
    }

    toggleNearestDoor() {
        if (!this.nearestDoor) return;

        this.nearestDoor.isOpen = !this.nearestDoor.isOpen;
        this.nearestDoor.targetAngle = this.nearestDoor.isOpen ? this.nearestDoor.openAngle : 0;
        this.playDoorSound(this.nearestDoor.isOpen);
        this.updateHUD();
    }

    update(delta, playerPos) {
        // 1. Find nearest door to player
        let minDist = Infinity;
        let closest = null;

        this.doors.forEach(door => {
            // Animate door swing towards target angle
            if (Math.abs(door.currentAngle - door.targetAngle) > 0.001) {
                door.currentAngle += (door.targetAngle - door.currentAngle) * 8.0 * delta;
                door.pivot.rotation.y = door.currentAngle;
                door.updateBox();
            }

            const dist = playerPos.distanceTo(door.centerPos);
            if (dist < minDist) {
                minDist = dist;
                closest = door;
            }
        });

        if (minDist <= this.interactionDistance) {
            this.nearestDoor = closest;
            this.showPrompt(true);
        } else {
            this.nearestDoor = null;
            this.showPrompt(false);
        }
    }

    showPrompt(visible) {
        if (this.promptEl) {
            if (visible && this.nearestDoor) {
                const action = this.nearestDoor.isOpen ? "Close" : "Open";
                this.promptEl.innerHTML = `🚪 Press <b>[E]</b> or <b>Tap</b> to ${action} ${this.nearestDoor.name}`;
                this.promptEl.style.display = 'block';
            } else {
                this.promptEl.style.display = 'none';
            }
        }

        if (this.mobileDoorBtn) {
            this.mobileDoorBtn.style.display = visible ? 'flex' : 'none';
            if (visible && this.nearestDoor) {
                this.mobileDoorBtn.textContent = this.nearestDoor.isOpen ? 'CLOSE' : 'OPEN';
            }
        }
    }

    updateHUD() {
        if (this.nearestDoor) {
            this.showPrompt(true);
        }
    }

    // Check collision against closed doors
    checkDoorCollision(x, y, z, radius) {
        const playerSphere = new THREE.Sphere(new THREE.Vector3(x, y + 0.9, z), radius);
        for (const door of this.doors) {
            if (!door.isOpen) {
                // If door is closed, test collision
                if (door.collisionBox.intersectsSphere(playerSphere)) {
                    return true;
                }
            }
        }
        return false;
    }
}
