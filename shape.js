class Vertex {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    draw() {
        context.fillStyle = "#FFFFFF";
        context.fillRect(this.x, this.y, 4, 4);
    }
}

class Triangle {
    constructor() {
        this.vertices = [
            new Vertex(0, 1, 0),
            new Vertex(1, 0, 0),
            new Vertex(-1, 0, 0)
        ];

        this.normal = vec3.fromValues(0, 0, 1);
    }

    draw(mvpMatrix, modelMatrix) {
        // Get 3x3 from ModelMatrix
        let normalMatrix = mat3.create();
        mat3.fromMat4(normalMatrix, modelMatrix);

        let transformedNormal = vec3.create();
        vec3.transformMat3(transformedNormal, this.normal, normalMatrix);
        vec3.normalize(transformedNormal, transformedNormal);

        let lightDirection = vec3.fromValues(0, 0, 1);

        let dot = vec3.dot(transformedNormal, lightDirection);
        let brightness = Math.max(0, dot);
        let colorValue = Math.floor(brightness * 255);
        let colorString = `rgb(${colorValue}, ${colorValue}, ${colorValue})`;

        let screenVertices = this.vertices.map(function(vertex) {
            let localVec4 = vec4.fromValues(vertex.x, vertex.y, vertex.z, 1);
            let clipVec4 = vec4.transformMat4(vec4.create(), localVec4, mvpMatrix);

            const [x, y, z, w] = clipVec4;

            let ndcX = x / w;
            let ndcY = y / w;

            let screenX = (ndcX + 1) * 0.5 * canvas.logicalWidth;
            let screenY = (-ndcY + 1) * 0.5 * canvas.logicalHeight;

            return { x: screenX, y: screenY };
        });

        context.beginPath();

        context.moveTo(screenVertices[0].x, screenVertices[0].y);
        context.lineTo(screenVertices[1].x, screenVertices[1].y);
        context.lineTo(screenVertices[2].x, screenVertices[2].y);

        context.closePath();
        context.fillStyle = colorString;
        context.fill();
    }
}