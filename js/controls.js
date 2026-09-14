/**
 * Unified Controls Manager for PC (Keyboard/Mouse) and Mobile (Touch/Joystick)
 */
class ControlsManager {
    constructor(canvas, onPointerLockChange) {
        this.canvas = canvas;
        this.onPointerLockChange = onPointerLockChange;

        // Movement State
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isSprinting = false;
        this.jumpRequested = false;

        // Camera Rotation (Euler angles: yaw & pitch)
        this.yaw = 0; // Horizontal (radians)
        this.pitch = 0; // Vertical (radians)
        this.lookSensitivity = 0.0022;

        // Touch Look sensitivity
        this.touchLookSensitivity = 0.004;

        // Mobile Touch tracking
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (this.isTouchDevice) {
            document.body.classList.add('touch-enabled');
        }

        this.joystickTouchId = null;
        this.lookTouchId = null;
        this.joystickOrigin = { x: 0, y: 0 };
        this.joystickDelta = { x: 0, y: 0 };
        this.lastTouchLookPos = { x: 0, y: 0 };

        this.isPointerLocked = false;

        // Callbacks for special toggles
        this.onToggleCamera = null;
        this.onToggleTour = null;
        this.onToggleMinimap = null;
        this.onToggleLights = null;

        this.initKeyboardMouse();
        this.initMobileTouch();
    }

    initKeyboardMouse() {
        // Keyboard Down
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;

            switch (e.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.moveForward = true;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    this.moveBackward = true;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    this.moveLeft = true;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.moveRight = true;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.isSprinting = true;
                    break;
                case 'Space':
                    this.jumpRequested = true;
                    e.preventDefault();
                    break;
                case 'KeyC':
                    if (this.onToggleCamera) this.onToggleCamera();
                    break;
                case 'KeyT':
                    if (this.onToggleTour) this.onToggleTour();
                    break;
                case 'KeyM':
                    if (this.onToggleMinimap) this.onToggleMinimap();
                    break;
                case 'KeyL':
                    if (this.onToggleLights) this.onToggleLights();
                    break;
            }
        });

        // Keyboard Up
        window.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.moveForward = false;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    this.moveBackward = false;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    this.moveLeft = false;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.moveRight = false;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.isSprinting = false;
                    break;
            }
        });

        // Pointer Lock on Canvas click
        this.canvas.addEventListener('click', () => {
            if (!this.isTouchDevice && !this.isPointerLocked) {
                this.canvas.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = (document.pointerLockElement === this.canvas);
            if (this.onPointerLockChange) {
                this.onPointerLockChange(this.isPointerLocked);
            }
        });

        // Mouse Move for Camera Looking
        document.addEventListener('mousemove', (e) => {
            if (this.isPointerLocked) {
                this.yaw -= e.movementX * this.lookSensitivity;
                this.pitch -= e.movementY * this.lookSensitivity;
                // Clamp pitch to avoid neck break (-85 deg to +85 deg)
                const limit = Math.PI / 2 - 0.05;
                this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
            }
        });
    }

    initMobileTouch() {
        const joystickZone = document.getElementById('joystick-zone');
        const joystickThumb = document.getElementById('joystick-thumb');
        const touchLookZone = document.getElementById('touch-look-zone');

        if (!joystickZone || !touchLookZone) return;

        const maxRadius = 50;

        // Joystick Touch Start
        joystickZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            this.joystickTouchId = touch.identifier;
            const rect = joystickZone.getBoundingClientRect();
            this.joystickOrigin = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            this.updateJoystick(touch.clientX, touch.clientY, maxRadius, joystickThumb);
        }, { passive: false });

        // Joystick Touch Move
        window.addEventListener('touchmove', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === this.joystickTouchId) {
                    e.preventDefault();
                    this.updateJoystick(touch.clientX, touch.clientY, maxRadius, joystickThumb);
                } else if (touch.identifier === this.lookTouchId) {
                    e.preventDefault();
                    const dx = touch.clientX - this.lastTouchLookPos.x;
                    const dy = touch.clientY - this.lastTouchLookPos.y;
                    this.lastTouchLookPos = { x: touch.clientX, y: touch.clientY };

                    this.yaw -= dx * this.touchLookSensitivity;
                    this.pitch -= dy * this.touchLookSensitivity;
                    const limit = Math.PI / 2 - 0.05;
                    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
                }
            }
        }, { passive: false });

        // Touch End / Cancel
        const endTouch = (touch) => {
            if (touch.identifier === this.joystickTouchId) {
                this.joystickTouchId = null;
                this.joystickDelta = { x: 0, y: 0 };
                this.moveForward = false;
                this.moveBackward = false;
                this.moveLeft = false;
                this.moveRight = false;
                if (joystickThumb) {
                    joystickThumb.style.transform = 'translate(0px, 0px)';
                }
            }
            if (touch.identifier === this.lookTouchId) {
                this.lookTouchId = null;
            }
        };

        window.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                endTouch(e.changedTouches[i]);
            }
        });
        window.addEventListener('touchcancel', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                endTouch(e.changedTouches[i]);
            }
        });

        // Touch Look Zone Start
        touchLookZone.addEventListener('touchstart', (e) => {
            if (this.lookTouchId === null) {
                const touch = e.changedTouches[0];
                this.lookTouchId = touch.identifier;
                this.lastTouchLookPos = { x: touch.clientX, y: touch.clientY };
            }
        }, { passive: false });
    }

    updateJoystick(clientX, clientY, maxRadius, thumb) {
        let dx = clientX - this.joystickOrigin.x;
        let dy = clientY - this.joystickOrigin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
        }

        if (thumb) {
            thumb.style.transform = `translate(${dx}px, ${dy}px)`;
        }

        // Normalized delta (-1 to 1)
        const normX = dx / maxRadius;
        const normY = dy / maxRadius;

        const deadzone = 0.15;
        this.moveForward = normY < -deadzone;
        this.moveBackward = normY > deadzone;
        this.moveLeft = normX < -deadzone;
        this.moveRight = normX > deadzone;

        this.joystickDelta = { x: normX, y: normY };
    }

    // Returns movement vector in local camera space
    getMovementVector() {
        const moveVec = { x: 0, z: 0 };

        if (this.joystickTouchId !== null) {
            moveVec.x = this.joystickDelta.x;
            moveVec.z = this.joystickDelta.y;
        } else {
            if (this.moveForward) moveVec.z -= 1;
            if (this.moveBackward) moveVec.z += 1;
            if (this.moveLeft) moveVec.x -= 1;
            if (this.moveRight) moveVec.x += 1;

            // Normalize diagonal movement
            const len = Math.sqrt(moveVec.x * moveVec.x + moveVec.z * moveVec.z);
            if (len > 0) {
                moveVec.x /= len;
                moveVec.z /= len;
            }
        }

        return moveVec;
    }
}
