/**
 * Automated Guided Tour Manager
 * Seamless cinematic camera glide through the entire farmhouse with room narrative.
 */
class TourManager {
    constructor(camera, player, onRoomChange) {
        this.camera = camera;
        this.player = player;
        this.onRoomChange = onRoomChange;

        this.isActive = false;
        this.isPaused = false;
        this.currentWaypointIndex = 0;
        this.progress = 0; // 0.0 to 1.0 along current segment
        this.speed = 0.16; // Travel speed along spline

        // Define the architectural tour sequence
        this.waypoints = [
            {
                name: "Exterior Front Yard",
                floor: "Ground Level",
                pos: new THREE.Vector3(0.0, 2.2, 28.0),
                target: new THREE.Vector3(0.0, 3.5, 14.0),
                duration: 6.0,
                desc: "Welcome to Jay Osborne's Starter Farmhouse! Classic American vernacular architecture featuring a symmetrical gabled roof and generous front porch."
            },
            {
                name: "Front Porch",
                floor: "Floor 1 (Downstairs)",
                pos: new THREE.Vector3(0.0, 1.8, 19.5),
                target: new THREE.Vector3(0.0, 1.8, 14.0),
                duration: 5.5,
                desc: "A wide, covered front porch protects the entrance from weather and provides a classic outdoor gathering space."
            },
            {
                name: "Living Room & Hearth",
                floor: "Floor 1 (Downstairs)",
                pos: new THREE.Vector3(-1.8, 1.7, 16.0),
                target: new THREE.Vector3(-2.0, 1.5, 12.0),
                duration: 6.5,
                desc: "The spacious open-concept living room receives abundant daylight from front windows and includes a dedicated hearth for a woodstove."
            },
            {
                name: "Kitchen & Dining",
                floor: "Floor 1 (Downstairs)",
                pos: new THREE.Vector3(2.0, 1.7, 14.5),
                target: new THREE.Vector3(0.5, 1.5, 11.5),
                duration: 6.0,
                desc: "Efficient kitchen layout with room for a dining table or center island. Open sightlines keep the downstairs feeling expansive."
            },
            {
                name: "Staircase Ascent",
                floor: "Transition (Floor 1 to 2)",
                pos: new THREE.Vector3(-0.4, 2.2, 13.0),
                target: new THREE.Vector3(-0.4, 3.2, 11.0),
                duration: 5.5,
                desc: "A compact, straight-run staircase designed for space efficiency while offering easy furniture movement to the second floor."
            },
            {
                name: "Upstairs Landing",
                floor: "Floor 2 (Upstairs)",
                pos: new THREE.Vector3(0.0, 4.3, 13.2),
                target: new THREE.Vector3(-1.5, 4.0, 15.5),
                duration: 5.0,
                desc: "The second floor landing acts as an efficient distribution core with direct access to both bedrooms and the upper bathroom."
            },
            {
                name: "Master Bedroom",
                floor: "Floor 2 (Upstairs)",
                pos: new THREE.Vector3(-2.2, 4.2, 15.8),
                target: new THREE.Vector3(-1.0, 4.0, 18.0),
                duration: 6.5,
                desc: "Spacious master bedroom with vaulted ceiling framing. Generous closet space and cross-ventilating double windows."
            },
            {
                name: "Bedroom 2 / Office",
                floor: "Floor 2 (Upstairs)",
                pos: new THREE.Vector3(2.2, 4.2, 15.8),
                target: new THREE.Vector3(1.0, 4.0, 18.0),
                duration: 6.0,
                desc: "Second bedroom perfectly sized for children, guests, or a dedicated sunlit work-from-home office."
            },
            {
                name: "Upstairs Full Bathroom",
                floor: "Floor 2 (Upstairs)",
                pos: new THREE.Vector3(0.0, 4.2, 10.5),
                target: new THREE.Vector3(0.0, 4.0, 8.5),
                duration: 5.0,
                desc: "Full second-floor bath featuring stacked plumbing above the first-floor utilities to reduce construction and piping costs."
            },
            {
                name: "Rear Deck & Backyard",
                floor: "Ground Level",
                pos: new THREE.Vector3(0.0, 2.5, 4.0),
                target: new THREE.Vector3(0.0, 3.0, 12.0),
                duration: 6.5,
                desc: "Rear elevation view showcasing clean siding details, rear garden access, and the optional expandable rear addition footprint."
            }
        ];

        // Spline path for camera
        this.cameraSpline = new THREE.CatmullRomCurve3(
            this.waypoints.map(w => w.pos),
            true // closed loop
        );

        this.targetSpline = new THREE.CatmullRomCurve3(
            this.waypoints.map(w => w.target),
            true
        );
    }

    start() {
        this.isActive = true;
        this.isPaused = false;
        this.currentWaypointIndex = 0;
        this.progress = 0;

        // Hide player avatar during cinematic tour
        this.player.avatar.visible = false;

        this.updateRoomHUD();
    }

    stop() {
        this.isActive = false;
        this.isPaused = false;

        // Restore player position to current tour spot
        const curWp = this.waypoints[this.currentWaypointIndex];
        this.player.position.set(curWp.pos.x, Math.max(0.45, curWp.pos.y - 1.65), curWp.pos.z);
        this.player.avatar.visible = this.player.isThirdPerson;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    nextWaypoint() {
        this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
        this.progress = this.currentWaypointIndex / this.waypoints.length;
        this.updateRoomHUD();
    }

    prevWaypoint() {
        this.currentWaypointIndex = (this.currentWaypointIndex - 1 + this.waypoints.length) % this.waypoints.length;
        this.progress = this.currentWaypointIndex / this.waypoints.length;
        this.updateRoomHUD();
    }

    update(delta) {
        if (!this.isActive || this.isPaused) return;

        const currentWp = this.waypoints[this.currentWaypointIndex];
        const step = (delta / currentWp.duration) * (1 / this.waypoints.length);
        this.progress = (this.progress + step) % 1.0;

        // Interpolate camera position & target
        const currentPos = this.cameraSpline.getPointAt(this.progress);
        const currentTarget = this.targetSpline.getPointAt(this.progress);

        this.camera.position.copy(currentPos);
        this.camera.lookAt(currentTarget);

        // Keep player tracked to camera position for minimap sync
        this.player.position.set(currentPos.x, currentPos.y - 1.65, currentPos.z);

        // Check if entered new waypoint zone
        const newIndex = Math.floor(this.progress * this.waypoints.length);
        if (newIndex !== this.currentWaypointIndex) {
            this.currentWaypointIndex = newIndex;
            this.updateRoomHUD();
        }
    }

    updateRoomHUD() {
        const wp = this.waypoints[this.currentWaypointIndex];
        if (this.onRoomChange) {
            this.onRoomChange(wp.name, wp.floor, wp.desc);
        }
    }
}
