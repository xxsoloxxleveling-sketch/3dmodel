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
        this.initDoorsForHouse('caroline');
    }

    initDoorsForHouse(houseId) {
        // Clean up previous doors from scene
        if (this.doors) {
            this.doors.forEach(d => {
                if (d.pivot && d.pivot.parent) {
                    d.pivot.parent.remove(d.pivot);
                }
            });
        }
        this.doors = [];
        this.nearestDoor = null;

        // Shared Rich Wood Door Material with raised panel texture
        const texLoader = new THREE.TextureLoader();
        const doorTex = texLoader.load('assets/textures/door_wood_diffuse.png');
        doorTex.wrapS = THREE.RepeatWrapping;
        doorTex.wrapT = THREE.RepeatWrapping;

        const doorWoodMat = new THREE.MeshStandardMaterial({
            map: doorTex,
            color: 0xffffff,
            roughness: 0.4,
            metalness: 0.05
        });

        // Shared Brass Lever/Knob Material
        const knobMat = new THREE.MeshStandardMaterial({
            color: 0xd4af37, // polished brass
            roughness: 0.25,
            metalness: 0.85
        });

        // Model-specific architectural door placements
        const houseDoorConfigs = {
            'georgia': [
                {
                    id: 'front_door',
                    name: 'Front Entry Door',
                    x: 2.75, y: 0.44, z: 17.11, // Front doorway on right side of porch
                    width: 0.92, height: 2.15, thickness: 0.05,
                    hingeSide: -1,
                    openAngle: -Math.PI / 2,
                    rotY: 0
                },
                {
                    id: 'rear_door',
                    name: 'Rear Addition Door',
                    x: 3.55, y: 0.44, z: 12.25,
                    width: 0.88, height: 2.10, thickness: 0.045,
                    hingeSide: 1,
                    openAngle: Math.PI / 2,
                    rotY: Math.PI / 2
                },
                {
                    id: 'powder_door',
                    name: 'Downstairs Bath Door',
                    x: 1.70, y: 0.44, z: 12.42,
                    width: 0.80, height: 2.05, thickness: 0.045,
                    hingeSide: -1,
                    openAngle: -Math.PI / 2,
                    rotY: 0
                },
                {
                    id: 'master_bed_door',
                    name: 'Master Bedroom Door',
                    x: 0.55, y: 2.82, z: 13.93,
                    width: 0.82, height: 2.05, thickness: 0.045,
                    hingeSide: -1,
                    openAngle: -Math.PI / 2,
                    rotY: 0
                },
                {
                    id: 'bed2_door',
                    name: 'Bedroom 2 Door',
                    x: -1.25, y: 2.82, z: 13.93,
                    width: 0.82, height: 2.05, thickness: 0.045,
                    hingeSide: 1,
                    openAngle: Math.PI / 2,
                    rotY: 0
                }
            ],
            'caroline': [
                {
                    id: 'front_door',
                    name: 'Front Entry Door',
                    x: 0.0, y: 0.44, z: 17.11, // Central front entry
                    width: 0.96, height: 2.15, thickness: 0.05,
                    hingeSide: -1,
                    openAngle: -Math.PI / 2,
                    rotY: 0
                },
                {
                    id: 'back_door',
                    name: 'Rear Deck Door',
                    x: 0.0, y: 0.44, z: 9.1,
                    width: 0.92, height: 2.15, thickness: 0.05,
                    hingeSide: 1,
                    openAngle: Math.PI / 2,
                    rotY: 0
                },
                {
                    id: 'master_bed_door',
                    name: 'Master Bedroom Door',
                    x: -0.6, y: 2.82, z: 13.5,
                    width: 0.82, height: 2.05, thickness: 0.045,
                    hingeSide: -1,
                    openAngle: -Math.PI / 2,
                    rotY: 0
                },
                {
                    id: 'bed2_door',
                    name: 'Bedroom 2 Door',
                    x: 0.6, y: 2.82, z: 13.5,
                    width: 0.82, height: 2.05, thickness: 0.045,
                    hingeSide: 1,
                    openAngle: Math.PI / 2,
                    rotY: 0
                }
            ],
            'marilyn': [
                {
                    id: 'front_door',
                    name: 'Front Entry Door',
                    x: 0.0, y: 0.44, z: 17.11,
                    width: 0.96, height: 2.15, thickness: 0.05,
                    hingeSide: -1,
                    openAngle: -Math.PI / 2,
                    rotY: 0
                },
                {
                    id: 'back_door',
                    name: 'Rear Deck Door',
                    x: 0.0, y: 0.44, z: 9.1,
                    width: 0.92, height: 2.15, thickness: 0.05,
                    hingeSide: 1,
                    openAngle: Math.PI / 2,
                    rotY: 0
                }
            ],
            'virginia': [
                {
                    id: 'front_door',
                    name: 'Front Entry Door',
                    x: 2.75, y: 0.44, z: 17.11,
                    width: 0.92, height: 2.15, thickness: 0.05,
                    hingeSide: -1,
                    openAngle: -Math.PI / 2,
                    rotY: 0
                },
                {
                    id: 'rear_door',
                    name: 'Rear Addition Door',
                    x: 3.55, y: 0.44, z: 12.25,
                    width: 0.88, height: 2.10, thickness: 0.045,
                    hingeSide: 1,
                    openAngle: Math.PI / 2,
                    rotY: Math.PI / 2
                },
                {
                    id: 'master_bed_door',
                    name: 'Master Bedroom Door',
                    x: 0.55, y: 2.82, z: 13.93,
                    width: 0.82, height: 2.05, thickness: 0.045,
                    hingeSide: -1,
                    openAngle: -Math.PI / 2,
                    rotY: 0
                },
                {
                    id: 'bed2_door',
                    name: 'Bedroom 2 Door',
                    x: -1.25, y: 2.82, z: 13.93,
                    width: 0.82, height: 2.05, thickness: 0.045,
                    hingeSide: 1,
                    openAngle: Math.PI / 2,
                    rotY: 0
                }
            ]
        };

        const configs = houseDoorConfigs[houseId] || houseDoorConfigs['caroline'];
        configs.forEach(cfg => {
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
            rotY: cfg.rotY || 0,
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
                door.pivot.rotation.y = door.rotY + door.currentAngle;
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
