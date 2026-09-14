/**
 * Player Entity with Dual-Camera (1P / 3P), Avatar Mesh,
 * Solid Horizontal Wall Collision (Wall-Sliding Physics),
 * Stair Climbing, Footstep Audio, and Head Bobbing.
 */
class Player {
    constructor(scene, camera, controls) {
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;

        // Player Dimensions (meters)
        this.height = 1.75;
        this.eyeHeight = 1.65;
        this.radius = 0.38;

        // Initial Position (In front yard facing the house porch)
        this.position = new THREE.Vector3(0, 0.45, 23.0);
        this.velocity = new THREE.Vector3();

        // Movement Configuration
        this.isGrounded = false;
        this.isThirdPerson = false;
        this.walkSpeed = 3.6;
        this.sprintSpeed = 6.8;
        this.gravity = -18.0;
        this.jumpForce = 6.2;

        // Collision detection references
        this.collisionMeshes = [];
        this.doorManager = null;

        // Raycasters
        this.downRay = new THREE.Raycaster();
        this.downRay.ray.direction.set(0, -1, 0);

        this.horizontalRay = new THREE.Raycaster();

        // 3D Avatar
        this.avatar = this.createAvatar();
        this.scene.add(this.avatar);

        // Animation & Immersion
        this.walkPhase = 0;
        this.headBobTimer = 0;
        this.footstepTimer = 0;

        // Web Audio for Footsteps
        this.audioCtx = null;

        // Look facing towards the front of the house
        this.controls.yaw = 0;
    }

    setCollisionMeshes(meshes) {
        this.collisionMeshes = meshes;
    }

    setDoorManager(doorManager) {
        this.doorManager = doorManager;
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

    playFootstepSound(isIndoor) {
        this.initAudio();
        if (!this.audioCtx) return;

        try {
            const t = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            if (isIndoor) {
                // Wooden floor hollow thud
                osc.type = 'sine';
                osc.frequency.setValueAtTime(120, t);
                osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);
                gain.gain.setValueAtTime(0.08, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
            } else {
                // Outdoor grass / dirt soft rustle
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(80, t);
                osc.frequency.exponentialRampToValueAtTime(30, t + 0.07);
                gain.gain.setValueAtTime(0.04, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            }

            osc.start(t);
            osc.stop(t + 0.1);
        } catch (e) {
            // Audio policy ignore
        }
    }

    createAvatar() {
        const group = new THREE.Group();

        const skinMat = new THREE.MeshStandardMaterial({ color: 0xe2a77a, roughness: 0.6 });
        const shirtMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 });
        const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.9 });

        // Head
        const headGeo = new THREE.BoxGeometry(0.24, 0.26, 0.24);
        const head = new THREE.Mesh(headGeo, skinMat);
        head.position.y = 1.55;
        group.add(head);

        // Hair
        const hairGeo = new THREE.BoxGeometry(0.26, 0.1, 0.26);
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.y = 0.12;
        head.add(hair);

        // Torso
        const torsoGeo = new THREE.BoxGeometry(0.38, 0.55, 0.22);
        const torso = new THREE.Mesh(torsoGeo, shirtMat);
        torso.position.y = 1.15;
        group.add(torso);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
        this.leftArm = new THREE.Mesh(armGeo, skinMat);
        this.leftArm.position.set(-0.25, 1.15, 0);
        group.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeo, skinMat);
        this.rightArm.position.set(0.25, 1.15, 0);
        group.add(this.rightArm);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.15, 0.65, 0.15);
        this.leftLeg = new THREE.Mesh(legGeo, pantsMat);
        this.leftLeg.position.set(-0.11, 0.5, 0);
        group.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(legGeo, pantsMat);
        this.rightLeg.position.set(0.11, 0.5, 0);
        group.add(this.rightLeg);

        group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = false;
            }
        });

        group.visible = this.isThirdPerson;
        return group;
    }

    toggleCameraMode() {
        this.isThirdPerson = !this.isThirdPerson;
        this.avatar.visible = this.isThirdPerson;
        return this.isThirdPerson;
    }

    update(delta) {
        delta = Math.min(delta, 0.08);

        // Movement input: forward (+1 for forward, -1 for backward), right (+1 right, -1 left)
        const moveInput = this.controls.getMovementVector();
        const isMoving = (moveInput.forward !== 0 || moveInput.right !== 0);

        const speed = this.controls.isSprinting ? this.sprintSpeed : this.walkSpeed;

        // Camera Forward & Right Vectors on Horizontal XZ Plane
        const sinYaw = Math.sin(this.controls.yaw);
        const cosYaw = Math.cos(this.controls.yaw);

        // Looking towards -Z when yaw is 0
        const forwardX = -sinYaw;
        const forwardZ = -cosYaw;
        const rightX = cosYaw;
        const rightZ = -sinYaw;

        // Target Velocity: Forward adds in looking direction
        const targetVelX = (forwardX * moveInput.forward + rightX * moveInput.right) * speed;
        const targetVelZ = (forwardZ * moveInput.forward + rightZ * moveInput.right) * speed;

        // Acceleration damping
        const lerpFactor = this.isGrounded ? 12.0 : 3.0;
        this.velocity.x += (targetVelX - this.velocity.x) * lerpFactor * delta;
        this.velocity.z += (targetVelZ - this.velocity.z) * lerpFactor * delta;

        // Gravity
        this.velocity.y += this.gravity * delta;

        // Jump
        if (this.controls.jumpRequested && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            this.controls.jumpRequested = false;
        } else {
            this.controls.jumpRequested = false;
        }

        // Horizontal displacement attempt
        let dx = this.velocity.x * delta;
        let dz = this.velocity.z * delta;

        // Solid Wall Collision & Stair Step-Up
        const resolved = this.handleCollisionAndMovement(dx, dz);
        this.position.x = resolved.x;
        this.position.z = resolved.z;

        // Vertical Movement & Floor Collision
        this.position.y += this.velocity.y * delta;
        this.handleVerticalMovement();

        // Floor boundaries
        if (this.position.y < -2.0) {
            this.position.set(0, 0.45, 23.0);
            this.velocity.set(0, 0, 0);
        }

        // Footsteps Audio & Head Bobbing
        if (isMoving && this.isGrounded) {
            const stepInterval = this.controls.isSprinting ? 0.28 : 0.44;
            this.footstepTimer += delta;
            if (this.footstepTimer >= stepInterval) {
                this.footstepTimer = 0;
                const isIndoor = (this.position.z < 17.8 && this.position.z > 8.0);
                this.playFootstepSound(isIndoor);
            }

            this.headBobTimer += delta * (this.controls.isSprinting ? 14 : 9);
        } else {
            this.headBobTimer = 0;
        }

        this.updateAvatar(isMoving, delta);
        this.updateCamera();
    }

    /**
     * Solid Wall Collision with Wall-Sliding Physics & Stair Step-Up
     */
    handleCollisionAndMovement(dx, dz) {
        if (dx === 0 && dz === 0) return { x: this.position.x, z: this.position.z };

        let nextX = this.position.x + dx;
        let nextZ = this.position.z + dz;

        // 1. Check Door Collision (if walking into closed door)
        if (this.doorManager && this.doorManager.checkDoorCollision(nextX, this.position.y, nextZ, this.radius)) {
            // Door is closed and blocking
            return { x: this.position.x, z: this.position.z };
        }

        // 2. Stair Step-Up Check (Test ahead for climbable stairs)
        if (this.collisionMeshes.length > 0) {
            const stepOrigin = new THREE.Vector3(nextX, this.position.y + 0.48, nextZ);
            this.downRay.ray.origin.copy(stepOrigin);
            this.downRay.far = 1.0;

            const hits = this.downRay.intersectObjects(this.collisionMeshes, true);
            if (hits.length > 0) {
                const stepHeight = hits[0].point.y;
                const diff = stepHeight - this.position.y;
                if (diff > 0.03 && diff <= 0.38) {
                    // Step up smoothly onto stair
                    this.position.y = stepHeight;
                    this.velocity.y = 0;
                    this.isGrounded = true;
                    return { x: nextX, z: nextZ };
                }
            }
        }

        // 3. Multi-Ray Horizontal Wall Collision with Wall-Sliding
        const moveDist = Math.sqrt(dx * dx + dz * dz);
        if (moveDist > 1e-5 && this.collisionMeshes.length > 0) {
            const moveDir = new THREE.Vector3(dx / moveDist, 0, dz / moveDist);
            const checkHeights = [0.4, 0.95, 1.5]; // Feet, waist, chest

            for (const h of checkHeights) {
                const origin = new THREE.Vector3(this.position.x, this.position.y + h, this.position.z);
                this.horizontalRay.set(origin, moveDir);
                this.horizontalRay.far = this.radius + moveDist + 0.05;

                const hits = this.horizontalRay.intersectObjects(this.collisionMeshes, true);
                if (hits.length > 0) {
                    const hit = hits[0];
                    if (hit.face) {
                        const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);

                        // Only consider steep vertical surfaces as walls (|normal.y| < 0.6)
                        if (Math.abs(normal.y) < 0.6) {
                            const n = new THREE.Vector2(normal.x, normal.z).normalize();
                            const v = new THREE.Vector2(dx, dz);

                            // Project velocity along wall surface (sliding collision)
                            const dot = v.dot(n);
                            if (dot < 0) {
                                // Moving into the wall: cancel the perpendicular component
                                v.sub(n.clone().multiplyScalar(dot));
                                dx = v.x;
                                dz = v.y;
                                nextX = this.position.x + dx;
                                nextZ = this.position.z + dz;
                            }
                        }
                    }
                }
            }
        }

        return { x: nextX, z: nextZ };
    }

    handleVerticalMovement() {
        if (this.collisionMeshes.length === 0) {
            if (this.position.y <= 0) {
                this.position.y = 0;
                this.velocity.y = 0;
                this.isGrounded = true;
            }
            return;
        }

        // Cast ray downwards from waist
        const rayOrigin = new THREE.Vector3(this.position.x, this.position.y + 0.85, this.position.z);
        this.downRay.ray.origin.copy(rayOrigin);
        this.downRay.far = 1.3;

        const hits = this.downRay.intersectObjects(this.collisionMeshes, true);
        if (hits.length > 0) {
            const groundY = hits[0].point.y;
            if (this.position.y <= groundY + 0.06) {
                this.position.y = groundY;
                this.velocity.y = 0;
                this.isGrounded = true;
                return;
            }
        }

        // Ground lawn level fallback
        if (this.position.y <= 0) {
            this.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }
    }

    updateAvatar(isMoving, delta) {
        this.avatar.position.copy(this.position);
        this.avatar.rotation.y = this.controls.yaw;

        if (isMoving && this.isGrounded) {
            this.walkPhase += delta * (this.controls.isSprinting ? 14 : 9);
            const limbAngle = Math.sin(this.walkPhase) * 0.45;
            this.leftArm.rotation.x = limbAngle;
            this.rightArm.rotation.x = -limbAngle;
            this.leftLeg.rotation.x = -limbAngle;
            this.rightLeg.rotation.x = limbAngle;
        } else {
            this.leftArm.rotation.x = 0;
            this.rightArm.rotation.x = 0;
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
        }
    }

    updateCamera() {
        // Head Bobbing calculation
        const bobOffset = (this.headBobTimer > 0) ? Math.sin(this.headBobTimer) * 0.035 : 0;

        if (!this.isThirdPerson) {
            // First Person: Camera at eye level
            this.camera.position.set(
                this.position.x,
                this.position.y + this.eyeHeight + bobOffset,
                this.position.z
            );

            this.camera.rotation.order = 'YXZ';
            this.camera.rotation.y = this.controls.yaw;
            this.camera.rotation.x = this.controls.pitch;
            this.camera.rotation.z = 0;
        } else {
            // Third Person: Camera behind avatar
            const sinYaw = Math.sin(this.controls.yaw);
            const cosYaw = Math.cos(this.controls.yaw);
            const cosPitch = Math.cos(this.controls.pitch);
            const sinPitch = Math.sin(this.controls.pitch);

            const dist = 3.2;
            const camX = this.position.x + sinYaw * dist * cosPitch;
            const camY = this.position.y + this.eyeHeight + Math.max(-0.4, sinPitch * dist);
            const camZ = this.position.z + cosYaw * dist * cosPitch;

            this.camera.position.set(camX, camY, camZ);
            const lookTarget = new THREE.Vector3(
                this.position.x,
                this.position.y + this.eyeHeight * 0.9,
                this.position.z
            );
            this.camera.lookAt(lookTarget);
        }
    }

    teleportTo(x, y, z, yaw = 0) {
        this.position.set(x, y, z);
        this.velocity.set(0, 0, 0);
        this.controls.yaw = yaw;
        this.controls.pitch = 0;
    }
}
