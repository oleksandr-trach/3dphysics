const { mat4, mat3, vec3, vec4 } = glMatrix;

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
const triangleWorldPos = vec3.create();
const tempClipVec4 = vec4.create();

const globalLightDirection = vec3.fromValues(0, 0, 1);
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

function setup() {
    triangles[0] = new Triangle(
        new Vertex(-0.5, 0.5, 0),
        new Vertex(0.5, -0.5, 0),
        new Vertex(-0.5, -0.5, 0),
        vec3.fromValues(0, 0, 1)
    );

    triangles[1] = new Triangle(
        new Vertex(-0.5, 0.5, 0),
        new Vertex(0.5, 0.5, 0),
        new Vertex(0.5, -0.5, 0),
        vec3.fromValues(0, 0, 1)
    );
}

function update(dt) {
    if (dt > 0.1) dt = 0.1;
    rotation += 0.9 * dt;
}

const eye = vec3.fromValues(0, 0, 4);
const center = vec3.fromValues(0, 0, 0);
const up = vec3.fromValues(0, 1, 0);

function render() {
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.logicalWidth, canvas.logicalHeight);

    triangles.forEach(triangle => {
        mat4.fromTranslation(modelMatrix, [0, 0, 0]);
        mat4.rotate(modelMatrix, modelMatrix, rotation, [0, 1, 0]);

        mat4.lookAt(viewMatrix, eye, center, up);

        mat4.multiply(viewProjMatrix, projectionMatrix, viewMatrix);
        mat4.multiply(mvpMatrix, viewProjMatrix, modelMatrix);

        triangle.draw(mvpMatrix, modelMatrix, eye, globalLightDirection);
    });
}

function gameLoop(currentTime) {
    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
}

setup();

requestAnimationFrame((time) => {
    lastTime = time;
    requestAnimationFrame(gameLoop);
});