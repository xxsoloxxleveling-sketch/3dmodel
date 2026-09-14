/**
 * Player Entity with First-Person / Third-Person Camera, 3D Avatar,
 * Gravity, Collision Detection, and Stair Climbing.
 */
class Player {
    constructor(scene, camera, controls) {
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;

        // Player Physical Dimensions (meters)
        this.height = 1.75;
        this.eyeHeight = 1.65;
        this.radius = 0.35;

        // Initial Position (Front yard facing the porch entrance)
        this.position = new THREE.Vector3(0, 0.45, 23.0);
        this.velocity = new THREE.Vector3();

        // States
        this.isGrounded = false;
        this.isThirdPerson = false;
        this.walkSpeed = 3.6;
        this.sprintSpeed = 6.8;
        this.gravity = -18.0;
        this.jumpForce = 6.0;

        // Collision meshes
        this.collisionMeshes = [];

        // Raycasters for ground and wall collision
        this.downRay = new THREE.Raycaster();
        this.downRay.ray.direction.set(0, -1, 0);

        this.horizontalRays = [
            new THREE.Vector3(0, 0, -1), // Forward
            new THREE.Vector3(0, 0, 1),  // Backward
            new THREE.Vector3(-1, 0, 0), // Left
            new THREE.Vector3(1, 0, 0),  // Right
            new THREE.Vector3(0.707, 0, -0.707),
            new THREE.Vector3(-0.707, 0, -0.707),
        ];

        // Third-Person Camera offsets
        this.thirdPersonOffset = new THREE.Vector3(0, 1.8, 3.2);

        // Build 3D Character Avatar
        this.avatar = this.createAvatar();
        this.scene.add(this.avatar);

        // Walking animation phase
        this.walkPhase = 0;

        // Initial facing towards house (-Z)
        this.controls.yaw = 0;
    }

    setCollisionMeshes(meshes) {
        this.collisionMeshes = meshes;
    }

    createAvatar() {
        const group = new THREE.Group();

        // Materials
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xe2a77a });
        const shirtMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 });
        const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
        const hairMat = new THREE.MeshLambertMaterial({ color: 0x332211 });

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
        // Limit max delta to prevent tunneling on lag spikes
        delta = Math.min(delta, 0.1);

        // Calculate Move Direction from Yaw
        const moveInput = this.controls.getMovementVector();
        const isMoving = (moveInput.x !== 0 || moveInput.z !== 0);

        // Movement Speed
        const speed = this.controls.isSprinting ? this.sprintSpeed : this.walkSpeed;

        // Camera Yaw rotation matrix
        const sinYaw = Math.sin(this.controls.yaw);
        const cosYaw = Math.cos(this.controls.yaw);

        // World-space desired movement vector
        const forwardX = -sinYaw;
        const forwardZ = -cosYaw;
        const rightX = cosYaw;
        const rightZ = -sinYaw;

        const targetVelX = (rightX * moveInput.x + forwardX * moveInput.z) * speed;
        const targetVelZ = (rightZ * moveInput.x + forwardZ * moveInput.z) * speed;

        // Smooth horizontal acceleration & deceleration
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
        const dx = this.velocity.x * delta;
        const dz = this.velocity.z * delta;

        // Step-up / Stairs Assist & Horizontal Collision
        this.handleHorizontalMovement(dx, dz);

        // Vertical movement & Ground Collision
        this.position.y += this.velocity.y * delta;
        this.handleVerticalMovement();

        // Boundary Clamp (prevent falling through world floor)
        if (this.position.y < -2.0) {
            this.position.set(0, 0.45, 23.0);
            this.velocity.set(0, 0, 0);
        }

        // Update Avatar Position and Animation
        this.updateAvatar(isMoving, delta);

        // Update Camera Position & Rotation
        this.updateCamera();
    }

    handleHorizontalMovement(dx, dz) {
        if (dx === 0 && dz === 0) return;

        const nextX = this.position.x + dx;
        const nextZ = this.position.z + dz;

        // Check stair step-up: Cast ray downwards from slightly ahead and above
        const stepCheckOrigin = new THREE.Vector3(nextX, this.position.y + 0.45, nextZ);
        this.downRay.ray.origin.copy(stepCheckOrigin);
        this.downRay.far = 1.0;

        if (this.collisionMeshes.length > 0) {
            const hits = this.downRay.intersectObjects(this.collisionMeshes, true);
            if (hits.length > 0) {
                const stepHeight = hits[0].point.y;
                const diff = stepHeight - this.position.y;
                // If it's a climbable stair step (up to 0.38m higher)
                if (diff > 0.02 && diff <= 0.38) {
                    this.position.y = stepHeight;
                    this.velocity.y = 0;
                    this.isGrounded = true;
                }
            }
        }

        this.position.x = nextX;
        this.position.z = nextZ;
    }

    handleVerticalMovement() {
        if (this.collisionMeshes.length === 0) {
            // Default terrain floor at Y = 0
            if (this.position.y <= 0) {
                this.position.y = 0;
                this.velocity.y = 0;
                this.isGrounded = true;
            }
            return;
        }

        // Cast ray from waist height downwards
        const rayOrigin = new THREE.Vector3(this.position.x, this.position.y + 0.8, this.position.z);
        this.downRay.ray.origin.copy(rayOrigin);
        this.downRay.far = 1.2;

        const hits = this.downRay.intersectObjects(this.collisionMeshes, true);
        if (hits.length > 0) {
            const groundY = hits[0].point.y;
            if (this.position.y <= groundY + 0.05) {
                this.position.y = groundY;
                this.velocity.y = 0;
                this.isGrounded = true;
                return;
            }
        }

        // Terrain fallback
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
            // Idle stance
            this.leftArm.rotation.x = 0;
            this.rightArm.rotation.x = 0;
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
        }
    }

    updateCamera() {
        if (!this.isThirdPerson) {
            // First Person: Camera placed at player's eye level
            this.camera.position.set(
                this.position.x,
                this.position.y + this.eyeHeight,
                this.position.z
            );

            // Apply Euler Rotation (Yaw then Pitch)
            this.camera.rotation.order = 'YXZ';
            this.camera.rotation.y = this.controls.yaw;
            this.camera.rotation.x = this.controls.pitch;
            this.camera.rotation.z = 0;
        } else {
            // Third Person: Camera follows behind player avatar
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
