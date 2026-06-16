const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

let lastTime = 0;

let triangles = [];
let rotation = 0;

// Init all matrices to make them in memory just once
const modelMatrix = mat4.create();
const viewMatrix = mat4.create();
const projectionMatrix = mat4.create();
const viewProjMatrix = mat4.create();
const mvpMatrix = mat4.create();

const tempNormalMatrix = mat3.create();
const tempTransformedNormal = vec3.create();
const tempViewDir = vec3.create();
const tempClipVec4 = vec4.create();
const tempDepthVec4 = vec4.create();
const cameraTarget = vec3.create();

const globalLightDirection = vec3.fromValues(-0.5, 0.5, 1);
vec3.normalize(globalLightDirection, globalLightDirection);

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;

    canvas.logicalWidth = window.innerWidth;
    canvas.logicalHeight = window.innerHeight;

    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    context.scale(dpr, dpr);

    mat4.perspective(
        projectionMatrix,
        45 * Math.PI / 180,
        canvas.logicalWidth / canvas.logicalHeight,
        0.1,
        100.0
    );
}

resizeCanvas();

window.addEventListener("resize", resizeCanvas);

window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) keys[key] = true;
});
window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) keys[key] = false;
});
window.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== canvas) return;

    const sensitivity = 0.1;
    yaw += event.movementX * sensitivity;
    pitch -= event.movementY * sensitivity;

    if (pitch > 89) pitch = 89;
    if (pitch < -89) pitch = -89;
});

function setup() {
    triangles = [
        new Triangle(
            new Vertex(-0.5,  0.5,  0.5),
            new Vertex( 0.5, -0.5,  0.5),
            new Vertex(-0.5, -0.5,  0.5),
            vec3.fromValues(0, 0, 1)
        ),
        new Triangle(
            new Vertex(-0.5,  0.5,  0.5),
            new Vertex( 0.5,  0.5,  0.5),
            new Vertex( 0.5, -0.5,  0.5),
            vec3.fromValues(0, 0, 1)
        ),
        new Triangle(
            new Vertex( 0.5,  0.5, -0.5),
            new Vertex(-0.5, -0.5, -0.5),
            new Vertex( 0.5, -0.5, -0.5),
            vec3.fromValues(0, 0, -1)
        ),
        new Triangle(
            new Vertex( 0.5,  0.5, -0.5),
            new Vertex(-0.5,  0.5, -0.5),
            new Vertex(-0.5, -0.5, -0.5),
            vec3.fromValues(0, 0, -1)
        ),
        new Triangle(
            new Vertex(-0.5,  0.5, -0.5),
            new Vertex(-0.5, -0.5,  0.5),
            new Vertex(-0.5, -0.5, -0.5),
            vec3.fromValues(-1, 0, 0)
        ),
        new Triangle(
            new Vertex(-0.5,  0.5, -0.5),
            new Vertex(-0.5,  0.5,  0.5),
            new Vertex(-0.5, -0.5,  0.5),
            vec3.fromValues(-1, 0, 0)
        ),
        new Triangle(
            new Vertex( 0.5,  0.5,  0.5),
            new Vertex( 0.5, -0.5, -0.5),
            new Vertex( 0.5, -0.5,  0.5),
            vec3.fromValues(1, 0, 0)
        ),
        new Triangle(
            new Vertex( 0.5,  0.5,  0.5),
            new Vertex( 0.5,  0.5, -0.5),
            new Vertex( 0.5, -0.5, -0.5),
            vec3.fromValues(1, 0, 0)
        ),
        new Triangle(
            new Vertex(-0.5,  0.5, -0.5),
            new Vertex( 0.5,  0.5,  0.5),
            new Vertex(-0.5,  0.5,  0.5),
            vec3.fromValues(0, 1, 0)
        ),
        new Triangle(
            new Vertex(-0.5,  0.5, -0.5),
            new Vertex( 0.5,  0.5, -0.5),
            new Vertex( 0.5,  0.5,  0.5),
            vec3.fromValues(0, 1, 0)
        ),
        new Triangle(
            new Vertex(-0.5, -0.5,  0.5),
            new Vertex( 0.5, -0.5, -0.5),
            new Vertex(-0.5, -0.5, -0.5),
            vec3.fromValues(0, -1, 0)
        ),
        new Triangle(
            new Vertex(-0.5, -0.5,  0.5),
            new Vertex( 0.5, -0.5,  0.5),
            new Vertex( 0.5, -0.5, -0.5),
            vec3.fromValues(0, -1, 0)
        )
    ];
}

function update(dt) {
    if (dt > 0.1) dt = 0.1;
    rotation += 0.1 * dt;
    if (rotation > 2 * Math.PI) {
        rotation -= 2 * Math.PI;
    }

    const radYaw = yaw * Math.PI / 180;
    const radPitch = pitch * Math.PI / 180;

    // Spherical coordinates
    cameraFront[0] = Math.cos(radYaw) * Math.cos(radPitch);
    cameraFront[1] = Math.sin(radPitch);
    cameraFront[2] = Math.sin(radYaw) * Math.cos(radPitch);
    vec3.normalize(cameraFront, cameraFront);

    // FPS
    const moveFront = vec3.fromValues(Math.cos(radYaw), 0, Math.sin(radYaw));
    vec3.normalize(moveFront, moveFront);

    const cameraRight = vec3.create();
    vec3.cross(cameraRight, moveFront, cameraUp);
    vec3.normalize(cameraRight, cameraRight);

    const moveSpeed = 0.8 * dt;

    if (keys.w) vec3.scaleAndAdd(cameraPos, cameraPos, moveFront, moveSpeed);
    if (keys.s) vec3.scaleAndAdd(cameraPos, cameraPos, moveFront, -moveSpeed);
    if (keys.d) vec3.scaleAndAdd(cameraPos, cameraPos, cameraRight, moveSpeed);
    if (keys.a) vec3.scaleAndAdd(cameraPos, cameraPos, cameraRight, -moveSpeed);

    // Spectator
    /*
    const moveSpeed = 2.0 * dt;
    if (keys.w) vec3.scaleAndAdd(cameraPos, cameraPos, cameraFront, moveSpeed);
    if (keys.s) vec3.scaleAndAdd(cameraPos, cameraPos, cameraFront, -moveSpeed);

    const cameraRight = vec3.create();
    vec3.cross(cameraRight, cameraFront, cameraUp);
    vec3.normalize(cameraRight, cameraRight);

    if (keys.d) vec3.scaleAndAdd(cameraPos, cameraPos, cameraRight, moveSpeed);
    if (keys.a) vec3.scaleAndAdd(cameraPos, cameraPos, cameraRight, -moveSpeed);
    */
}

let cameraPos = vec3.fromValues(0, 0, 4);
let yaw = -90;
let pitch = 0;
let cameraFront = vec3.fromValues(0, 0, -1);
let cameraUp = vec3.fromValues(0, 1, 0);
const center = vec3.fromValues(0, 0, 0);

const keys = { w: false, a: false, s: false, d: false };

function render() {
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.logicalWidth, canvas.logicalHeight);

    if (triangles.length === 0) return;

    mat4.fromTranslation(modelMatrix, [0, 0, 0]);
    mat4.rotate(modelMatrix, modelMatrix, rotation, [0, 0, 0]);
    vec3.add(cameraTarget, cameraPos, cameraFront);
    mat4.lookAt(viewMatrix, cameraPos, cameraTarget, cameraUp);
    mat4.multiply(viewProjMatrix, projectionMatrix, viewMatrix);
    mat4.multiply(mvpMatrix, viewProjMatrix, modelMatrix);

    triangles.forEach(triangle => triangle.getAverageDepth(modelMatrix));

    // Create an array with calculated depth
    let sortedTriangles = triangles.map(triangle => {
        return {
            instance: triangle,
            depth: vec3.distance(triangle.worldCenter, cameraPos)
        };
    });

    sortedTriangles.sort((a, b) => b.depth - a.depth);

    sortedTriangles.forEach(item => {
        item.instance.draw(mvpMatrix, modelMatrix, cameraPos, globalLightDirection);
    });
}

function gameLoop(currentTime) {
    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
}

canvas.addEventListener("click", () => canvas.requestPointerLock());
setup();

requestAnimationFrame((time) => {
    lastTime = time;
    requestAnimationFrame(gameLoop);
});