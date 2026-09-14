/**
 * Main 3D House Game Engine (Three.js)
 * Manages rendering, lighting, model loading, time-of-day, and the game loop.
 */
class HouseGame {
    constructor() {
        this.container = document.getElementById('game-container');
        this.canvas = document.getElementById('canvas3d');

        // Three.js Core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        // Lighting & Environment
        this.sunLight = null;
        this.hemiLight = null;
        this.interiorLights = [];
        this.skyMesh = null;
        this.timeOfDay = 'day'; // 'day', 'sunset', 'night'

        // House Models
        this.currentHouseId = 'caroline';
        this.houseGroup = null;
        this.collisionMeshes = [];

        // Subsystems
        this.controls = null;
        this.player = null;
        this.tour = null;
        this.minimap = null;

        // UI elements
        this.loadingScreen = document.getElementById('loading-screen');
        this.loadingSubtext = document.getElementById('loading-subtext');
        this.roomTitle = document.getElementById('room-title');
        this.roomDesc = document.getElementById('room-desc');
        this.roomBanner = document.getElementById('room-banner');
        this.tourControls = document.getElementById('tour-controls');
        this.helpModal = document.getElementById('help-modal');

        this.init();
    }

    init() {
        // 1. Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.FogExp2(0xcce0ff, 0.008);

        // 2. Camera setup
        this.camera = new THREE.PerspectiveCamera(
            68,
            window.innerWidth / window.innerHeight,
            0.1,
            250
        );

        // 3. Renderer setup
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        // 4. Input & Player Controls
        this.controls = new ControlsManager(this.canvas, (isLocked) => {
            if (isLocked) {
                if (this.helpModal) this.helpModal.style.display = 'none';
            }
        });

        this.player = new Player(this.scene, this.camera, this.controls);

        // 5. Tour & Minimap
        this.tour = new TourManager(this.camera, this.player, (roomName, floor, desc) => {
            if (this.roomTitle && this.roomDesc) {
                this.roomTitle.textContent = `${roomName} (${floor})`;
                this.roomDesc.textContent = desc;
            }
        });

        this.minimap = new Minimap('minimap-canvas', 'minimap-header');

        // Hook Toggles
        this.controls.onToggleCamera = () => this.toggleCamera();
        this.controls.onToggleTour = () => this.toggleTour();
        this.controls.onToggleMinimap = () => this.minimap.toggle();
        this.controls.onToggleLights = () => this.cycleLighting();

        // 6. Build Environment & Lighting
        this.buildEnvironment();
        this.setupLighting();

        // 7. Load House Model
        this.houseGroup = new THREE.Group();
        this.scene.add(this.houseGroup);
        this.loadHouseModel(this.currentHouseId);

        // 8. Bind UI Events
        this.bindUI();

        // 9. Resize listener
        window.addEventListener('resize', () => this.onResize());

        // 10. Start Animation Loop
        this.animate();
    }

    buildEnvironment() {
        // Grassy Ground Plane
        const groundGeo = new THREE.PlaneGeometry(160, 160);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x476b38,
            roughness: 0.9,
            metalness: 0.05
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Driveway / Pathway to front porch
        const pathGeo = new THREE.PlaneGeometry(3.6, 26);
        const pathMat = new THREE.MeshStandardMaterial({
            color: 0x948772, // gravel / paver color
            roughness: 0.85
        });
        const path = new THREE.Mesh(pathGeo, pathMat);
        path.rotation.x = -Math.PI / 2;
        path.position.set(0, 0.02, 30);
        path.receiveShadow = true;
        this.scene.add(path);

        // Landscaping trees / greenery
        this.buildTrees();
    }

    buildTrees() {
        const treeGroup = new THREE.Group();
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3d28 });
        const foliageMat = new THREE.MeshLambertMaterial({ color: 0x2e5927 });

        const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 3.5, 8);
        const foliageGeo = new THREE.ConeGeometry(2.2, 5.0, 8);

        const treeCoords = [
            [-16, 22], [16, 22], [-18, 12], [18, 12],
            [-16, 2], [16, 2], [-14, -8], [14, -8],
            [-10, 32], [10, 32]
        ];

        treeCoords.forEach(([x, z]) => {
            const tree = new THREE.Group();
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 1.75;
            trunk.castShadow = true;
            tree.add(trunk);

            const foliage = new THREE.Mesh(foliageGeo, foliageMat);
            foliage.position.y = 4.8;
            foliage.castShadow = true;
            tree.add(foliage);

            tree.position.set(x, 0, z);
            treeGroup.add(tree);
        });

        this.scene.add(treeGroup);
    }

    setupLighting() {
        // Sunlight (Directional)
        this.sunLight = new THREE.DirectionalLight(0xfff8e7, 1.4);
        this.sunLight.position.set(25, 35, 30);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 120;
        const d = 26;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.bias = -0.0005;
        this.scene.add(this.sunLight);

        // Hemisphere Sky/Ground Ambient
        this.hemiLight = new THREE.HemisphereLight(0xdaf0ff, 0x3d4b30, 0.7);
        this.hemiLight.position.set(0, 50, 0);
        this.scene.add(this.hemiLight);

        // Cozy Interior Warm Point Lights
        const lightPositions = [
            { pos: [0, 1.9, 19.5], color: 0xffe0a3, intensity: 1.2, dist: 8 },  // Porch light
            { pos: [-2, 2.2, 15.0], color: 0xffd180, intensity: 1.5, dist: 9 }, // Living room
            { pos: [2, 2.2, 14.0], color: 0xffecc4, intensity: 1.6, dist: 9 },  // Kitchen
            { pos: [0, 2.2, 11.0], color: 0xffe8c6, intensity: 1.2, dist: 7 },  // Downstairs hall
            { pos: [-2, 4.4, 15.5], color: 0xffe0b2, intensity: 1.4, dist: 9 }, // Master bed
            { pos: [2, 4.4, 15.5], color: 0xffe0b2, intensity: 1.4, dist: 9 },  // Bed 2
        ];

        lightPositions.forEach(cfg => {
            const light = new THREE.PointLight(cfg.color, cfg.intensity, cfg.dist, 1.5);
            light.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
            light.castShadow = false;
            this.interiorLights.push(light);
            this.scene.add(light);
        });
    }

    loadHouseModel(houseId) {
        if (this.loadingScreen) {
            this.loadingScreen.classList.remove('hidden');
            if (this.loadingSubtext) this.loadingSubtext.textContent = `Loading ${houseId.toUpperCase()} 3D Model...`;
        }

        // Clear existing model
        while (this.houseGroup.children.length > 0) {
            const obj = this.houseGroup.children[0];
            this.houseGroup.remove(obj);
        }
        this.collisionMeshes = [];

        const loader = new THREE.GLTFLoader();
        const modelUrl = `assets/models/${houseId}.glb`;

        loader.load(
            modelUrl,
            (gltf) => {
                const model = gltf.scene;

                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        this.collisionMeshes.push(child);

                        // Enhance materials for realism
                        if (child.material) {
                            child.material.side = THREE.DoubleSide;
                            if (child.material.map) {
                                child.material.map.anisotropy = 8;
                            }
                            if (child.material.name.includes('Glass') || child.material.opacity < 0.9) {
                                child.material.transparent = true;
                                child.material.roughness = 0.1;
                                child.material.metalness = 0.1;
                            }
                        }
                    }
                });

                this.houseGroup.add(model);
                this.player.setCollisionMeshes(this.collisionMeshes);

                // Teleport player to entrance
                this.player.teleportTo(0, 0.45, 23.0, 0);

                if (this.loadingScreen) {
                    this.loadingScreen.classList.add('hidden');
                }
            },
            (xhr) => {
                if (xhr.lengthComputable && this.loadingSubtext) {
                    const percent = Math.round((xhr.loaded / xhr.total) * 100);
                    this.loadingSubtext.textContent = `Loading ${percent}%...`;
                }
            },
            (error) => {
                console.error("Error loading model:", error);
                if (this.loadingSubtext) this.loadingSubtext.textContent = "Error loading model.";
            }
        );
    }

    cycleLighting() {
        if (this.timeOfDay === 'day') {
            // Switch to Sunset
            this.timeOfDay = 'sunset';
            this.scene.background.set(0xfb923c);
            this.scene.fog.color.set(0xfdba74);
            this.sunLight.color.set(0xff7733);
            this.sunLight.intensity = 1.0;
            this.sunLight.position.set(40, 12, -10);
            this.hemiLight.color.set(0xffeedd);
            this.hemiLight.groundColor.set(0x332211);
            this.hemiLight.intensity = 0.5;
            this.interiorLights.forEach(l => l.intensity = 2.0);
        } else if (this.timeOfDay === 'sunset') {
            // Switch to Night
            this.timeOfDay = 'night';
            this.scene.background.set(0x050814);
            this.scene.fog.color.set(0x0b1329);
            this.sunLight.color.set(0x4466aa);
            this.sunLight.intensity = 0.2;
            this.hemiLight.color.set(0x1a2b4c);
            this.hemiLight.groundColor.set(0x050814);
            this.hemiLight.intensity = 0.25;
            this.interiorLights.forEach(l => l.intensity = 2.8);
        } else {
            // Switch to Day
            this.timeOfDay = 'day';
            this.scene.background.set(0x87ceeb);
            this.scene.fog.color.set(0xcce0ff);
            this.sunLight.color.set(0xfff8e7);
            this.sunLight.intensity = 1.4;
            this.sunLight.position.set(25, 35, 30);
            this.hemiLight.color.set(0xdaf0ff);
            this.hemiLight.groundColor.set(0x3d4b30);
            this.hemiLight.intensity = 0.7;
            this.interiorLights.forEach(l => l.intensity = 1.2);
        }

        const btn = document.getElementById('btn-lights');
        if (btn) btn.innerHTML = `💡 ${this.timeOfDay.toUpperCase()}`;
    }

    toggleCamera() {
        const is3rd = this.player.toggleCameraMode();
        const crosshair = document.getElementById('crosshair');
        if (crosshair) crosshair.style.opacity = is3rd ? '0' : '1';

        const btn = document.getElementById('btn-cam');
        if (btn) btn.classList.toggle('active', is3rd);
        const mobileBtn = document.getElementById('mbtn-view');
        if (mobileBtn) mobileBtn.textContent = is3rd ? '3P' : '1P';
    }

    toggleTour() {
        if (!this.tour.isActive) {
            this.tour.start();
            if (this.tourControls) this.tourControls.classList.add('visible');
            const btn = document.getElementById('btn-tour');
            if (btn) btn.classList.add('active');
        } else {
            this.tour.stop();
            if (this.tourControls) this.tourControls.classList.remove('visible');
            const btn = document.getElementById('btn-tour');
            if (btn) btn.classList.remove('active');
        }
    }

    bindUI() {
        // Start Game Button in Help Modal
        const startBtn = document.getElementById('btn-start-game');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (this.helpModal) this.helpModal.style.display = 'none';
                if (!this.controls.isTouchDevice) {
                    this.canvas.requestPointerLock();
                }
            });
        }

        // House Model Dropdown Selector
        const modelSelect = document.getElementById('house-select');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                this.currentHouseId = e.target.value;
                this.loadHouseModel(this.currentHouseId);
            });
        }

        // HUD Buttons
        const btnCam = document.getElementById('btn-cam');
        if (btnCam) btnCam.addEventListener('click', () => this.toggleCamera());

        const btnTour = document.getElementById('btn-tour');
        if (btnTour) btnTour.addEventListener('click', () => this.toggleTour());

        const btnLights = document.getElementById('btn-lights');
        if (btnLights) btnLights.addEventListener('click', () => this.cycleLighting());

        const btnMap = document.getElementById('btn-map');
        if (btnMap) btnMap.addEventListener('click', () => this.minimap.toggle());

        const btnHelp = document.getElementById('btn-help');
        if (btnHelp) {
            btnHelp.addEventListener('click', () => {
                if (this.helpModal) {
                    this.helpModal.style.display = (this.helpModal.style.display === 'none') ? 'block' : 'none';
                }
            });
        }

        // Tour On-Screen Navigation Buttons
        const tourPrev = document.getElementById('tour-prev');
        if (tourPrev) tourPrev.addEventListener('click', () => this.tour.prevWaypoint());

        const tourNext = document.getElementById('tour-next');
        if (tourNext) tourNext.addEventListener('click', () => this.tour.nextWaypoint());

        const tourPause = document.getElementById('tour-pause');
        if (tourPause) {
            tourPause.addEventListener('click', () => {
                const paused = this.tour.togglePause();
                tourPause.textContent = paused ? "▶ Resume" : "⏸ Pause";
            });
        }

        const tourStop = document.getElementById('tour-stop');
        if (tourStop) tourStop.addEventListener('click', () => this.toggleTour());

        // Mobile Floating Action Buttons
        const mbtnJump = document.getElementById('mbtn-jump');
        if (mbtnJump) {
            mbtnJump.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.controls.jumpRequested = true;
            });
        }

        const mbtnSprint = document.getElementById('mbtn-sprint');
        if (mbtnSprint) {
            mbtnSprint.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.controls.isSprinting = !this.controls.isSprinting;
                mbtnSprint.style.background = this.controls.isSprinting ? '#0284c7' : 'rgba(30, 41, 59, 0.85)';
            });
        }

        const mbtnView = document.getElementById('mbtn-view');
        if (mbtnView) {
            mbtnView.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.toggleCamera();
            });
        }
    }

    detectPlayerRoom() {
        if (this.tour.isActive) return;

        const x = this.player.position.x;
        const y = this.player.position.y;
        const z = this.player.position.z;

        let name = "Front Yard";
        let floor = "Ground Level";
        let desc = "Enjoy the front yard and classic farmhouse facade.";

        if (z > 21.0) {
            name = "Driveway & Front Yard";
            floor = "Ground Level";
            desc = "Driveway and approach to the welcoming covered porch.";
        } else if (z >= 18.0 && z <= 21.0 && Math.abs(x) < 5.0) {
            name = "Front Porch";
            floor = "Floor 1 (Downstairs)";
            desc = "Full-width covered front porch protecting the main entryway.";
        } else if (y >= 2.3) {
            floor = "Floor 2 (Upstairs)";
            if (z > 14.0 && x < 0) {
                name = "Master Bedroom";
                desc = "Master bedroom with cathedral vaulted ceilings and abundant sunlight.";
            } else if (z > 14.0 && x >= 0) {
                name = "Bedroom 2 / Office";
                desc = "Second bedroom with dual dormers, suited for guests or study.";
            } else if (z <= 12.0) {
                name = "Upstairs Bathroom";
                desc = "Full bathroom situated above core utilities.";
            } else {
                name = "Upstairs Landing";
                desc = "Stairway landing and hallway connecting bedrooms.";
            }
        } else if (z >= 7.0 && z < 18.0) {
            floor = "Floor 1 (Downstairs)";
            if (x < -0.5) {
                name = "Living Room & Hearth";
                desc = "Open-concept living room with hearth location for woodstove.";
            } else if (x > 0.5) {
                name = "Kitchen & Dining";
                desc = "Spacious kitchen with open sightlines across the lower floor.";
            } else {
                name = "Entry & Staircase";
                desc = "Direct access to the straight-run wooden staircase.";
            }
        } else if (z < 7.0) {
            name = "Backyard & Rear Deck";
            floor = "Ground Level";
            desc = "Private backyard with space for garden, patio, or future addition.";
        }

        if (this.roomTitle && this.roomDesc) {
            this.roomTitle.textContent = `${name} (${floor})`;
            this.roomDesc.textContent = desc;
        }
    }

    onResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        // Update active movement or tour
        if (this.tour.isActive) {
            this.tour.update(delta);
        } else {
            this.player.update(delta);
            this.detectPlayerRoom();
        }

        // Update 2D Minimap
        this.minimap.update(
            this.player.position.x,
            this.player.position.y,
            this.player.position.z,
            this.controls.yaw
        );

        // Render Frame
        this.renderer.render(this.scene, this.camera);
    }
}

// Bootstrap once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    new HouseGame();
});
